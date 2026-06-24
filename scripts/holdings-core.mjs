// Paylaşılan holdings çekirdeği: parse + Gemini fallback + DB yazma.
// Kurucu adaptörleri sadece "sourcing" (fon→PDF URL) sağlar.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import { PDFParse } from 'pdf-parse'
import { parseHoldings } from './fon-holdings.mjs'

export { parseHoldings }
export const UA = { 'User-Agent': 'Mozilla/5.0' }

const SBURL = 'https://vojpmfhtddkkbcwqjrvg.supabase.co/rest/v1'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvanBtZmh0ZGRra2Jjd3FqcnZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYzMTY1NSwiZXhwIjoyMDk3MjA3NjU1fQ.X4vrxXhwoLpCZapR6U5nDRc9YFzldHRQUKEHhSPcKNc'
const sbH = { apikey: KEY, Authorization: `Bearer ${KEY}` }

// hisseli fon kodu → hisse% (yerli+yabancı) haritası
export async function hisseliMap() {
  const dag = []
  for (let o = 0; ; o += 1000) {
    const d = await (await fetch(`${SBURL}/tefas_fon_dagilim?select=fonKodu,dagilim&offset=${o}&limit=1000`, { headers: sbH })).json()
    dag.push(...d); if (d.length < 1000) break
  }
  const m = {}
  for (const d of dag) {
    const p = (d.dagilim?.['Hisse Senedi'] || 0) + (d.dagilim?.['Yabancı Hisse Senedi'] || 0)
    if (p > 0) m[d.fonKodu] = p
  }
  return m
}

export async function kurucuKodlari(kurucuKod) {
  const meta = await (await fetch(`${SBURL}/tefas_fon_meta?kurucuKod=eq.${kurucuKod}&select=fonKodu`, { headers: sbH })).json()
  return meta.map(x => x.fonKodu)
}

async function geminiParse(buf, tries = 3) {
  const KEYG = process.env.GEMINI_API_KEY
  if (!KEYG) return null
  const prompt = `Bu PDF bir Türk yatırım fonunun aylık portföy raporu. "III-FON PORTFÖY DEĞERİ TABLOSU" bölümündeki TÜM hisse senetlerini (yerli ve yabancı) çıkar. Her hisse için: ticker (sade kod, örn THYAO veya yabancıda INTC), ISIN, ve "TOPLAM (FTD GÖRE)" kolonundaki yüzde ağırlık. Negatif (açığa satış) değerleri koru. Sadece JSON: {"hisseler":[{"ticker":"X","isin":"...","agirlik":0.0}]}`
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEYG}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: 'application/pdf', data: buf.toString('base64') } }, { text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
      })
      const txt = (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text
      if (txt) {
        const arr = (JSON.parse(txt)?.hisseler ?? []).filter(h => h.ticker && h.isin)
          .map(h => ({ ticker: String(h.ticker).toUpperCase().replace(/ (US|TI|GR|LN|FP) EQUITY$/, '').trim(), isin: h.isin, agirlik: +Number(h.agirlik).toFixed(2) }))
          .sort((a, b) => b.agirlik - a.agirlik)
        if (arr.length) return arr
      }
    } catch { /* retry */ }
    if (i < tries - 1) await new Promise(r => setTimeout(r, 1500 * (i + 1)))
  }
  return null
}

// PDF URL → parse → doğrula → DB. Döner: {ok, hisse, toplam, kaynak} veya {ok:false, neden}
export async function processFund(fonKodu, url, hisseDagilim, ekstra = {}) {
  let buf = Buffer.from(await (await fetch(url, { headers: UA, redirect: 'follow' })).arrayBuffer())
  // KAP file download'u Java-serialized wrapper içinde döner → %PDF'ten kes
  if (buf.slice(0, 5).toString() !== '%PDF-') {
    const i = buf.indexOf('%PDF'), j = buf.lastIndexOf('%%EOF')
    if (i >= 0) buf = buf.slice(i, j > i ? j + 5 : undefined)
  }
  const text = (await new PDFParse({ data: new Uint8Array(buf) }).getText()).text || ''
  let r = parseHoldings(text)
  let kaynak = 'regex'
  if (!r.gecerli) {
    const llm = await geminiParse(buf).catch(() => null)
    if (!llm || !llm.length) return { fonKodu, ok: false, neden: 'regex geçersiz + LLM yok' }
    const toplam = +llm.reduce((s, h) => s + h.agirlik, 0).toFixed(2)
    r = { holdings: llm, gercekToplam: toplam }; kaynak = 'llm'
  }
  if (r.gercekToplam <= 0 || r.gercekToplam > 105) return { fonKodu, ok: false, neden: `imkansız toplam %${r.gercekToplam} [${kaynak}]` }
  const res = await fetch(`${SBURL}/tefas_fon_holdings`, {
    method: 'POST', headers: { ...sbH, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ fonKodu, tarih: new Date().toISOString().slice(0, 10), hisseler: r.holdings, kaynak, gercekToplam: r.gercekToplam, beklenenToplam: r.beklenenToplam ?? null, ...ekstra, guncellenmeTarihi: new Date().toISOString() }),
  })
  return { fonKodu, ok: res.ok, hisse: r.holdings.length, toplam: r.gercekToplam, kaynak }
}
