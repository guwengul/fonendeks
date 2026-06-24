// İş Portföy tüm hisse fonları için holdings çek → DB
// node scripts/isp-holdings.mjs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import { PDFParse } from 'pdf-parse'
import { parseHoldings } from './fon-holdings.mjs'

const SBURL = 'https://vojpmfhtddkkbcwqjrvg.supabase.co/rest/v1'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvanBtZmh0ZGRra2Jjd3FqcnZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYzMTY1NSwiZXhwIjoyMDk3MjA3NjU1fQ.X4vrxXhwoLpCZapR6U5nDRc9YFzldHRQUKEHhSPcKNc'
const sbH = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const UA = { 'User-Agent': 'Mozilla/5.0' }
const BASE = 'https://www.isportfoy.com.tr'

// 1) ticker→slug haritası (autocomplete JSON, herhangi bir fon sayfasından)
async function slugMap() {
  const html = await (await fetch(`${BASE}/is-portfoy-hisse-senedi-tl-fonu-hisse-senedi-yogun-fon`, { headers: UA })).text()
  const m = html.match(/data-autocomplete="(\[.*?\])"/s)
  const json = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#x27;/g, "'"))
  const map = {}
  for (const it of json) {
    const tic = (it.title.split(' - ')[0] || '').trim().toUpperCase()
    if (/^[A-Z0-9]{2,6}$/.test(tic)) map[tic] = it.url
  }
  return map
}

// 2) fon sayfasından "Detaylı Aylık Varlık Raporu" PDF URL'i
async function raporUrl(slug) {
  const html = await (await fetch(`${BASE}${slug}`, { headers: UA })).text()
  const re = /SyncDisclosure\/Document\/([a-f0-9-]+)"[^>]*>(?:<em[^>]*><\/em>)?\s*([^<]{0,60})/g
  let m
  while ((m = re.exec(html))) {
    if (/Ayl[ıi]k Varl[ıi]k Rapor/i.test(m[2])) return `${BASE}/medium/SyncDisclosure/Document/${m[1]}`
  }
  return null
}

// LLM fallback: PDF'i doğrudan Gemini'ye ver (multimodal, tabloyu görsel okur)
async function geminiParse(buf) {
  const KEYG = process.env.GEMINI_API_KEY
  if (!KEYG) return null
  const prompt = `Bu PDF bir Türk yatırım fonunun aylık portföy raporu. "III-FON PORTFÖY DEĞERİ TABLOSU" bölümündeki TÜM hisse senetlerini (yerli ve yabancı) çıkar. Her hisse için: ticker (sade kod, örn THYAO veya yabancıda INTC), ISIN, ve "TOPLAM (FTD GÖRE)" kolonundaki yüzde ağırlık. Negatif (açığa satış) değerleri koru. Sadece JSON: {"hisseler":[{"ticker":"X","isin":"...","agirlik":0.0}]}`
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEYG}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: 'application/pdf', data: buf.toString('base64') } }, { text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  })
  const j = await res.json()
  const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!txt) return null
  const arr = JSON.parse(txt)?.hisseler ?? []
  return arr.filter(h => h.ticker && h.isin).map(h => ({
    ticker: String(h.ticker).toUpperCase().replace(/ (US|TI|GR|LN|FP) EQUITY$/, '').trim(),
    isin: h.isin, agirlik: +Number(h.agirlik).toFixed(2),
  })).sort((a, b) => b.agirlik - a.agirlik)
}

async function holdingsYaz(fonKodu, url, hisseDagilim) {
  const buf = Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer())
  const text = (await new PDFParse({ data: new Uint8Array(buf) }).getText()).text || ''
  let r = parseHoldings(text)
  let kaynak = 'regex'
  if (!r.gecerli) {
    const llm = await geminiParse(buf).catch(() => null)
    if (llm && llm.length) {
      const toplam = +llm.reduce((s, h) => s + h.agirlik, 0).toFixed(2)
      r = { holdings: llm, gercekToplam: toplam, beklenenToplam: r.beklenenToplam, gecerli: true }
      kaynak = 'llm'
    } else {
      return { fonKodu, ok: false, neden: `regex geçersiz + LLM yok/boş` }
    }
  }
  // Sanity: hisse toplamı 0-105 arası olmalı (rapor tarihi ≠ dağılım tarihi olduğu için
  // dağılıma karşı kıyas yapılmaz; regex zaten kendi GRUP TOPLAMI'na karşı doğrulanmış)
  if (r.gercekToplam <= 0 || r.gercekToplam > 105) {
    return { fonKodu, ok: false, neden: `imkansız toplam %${r.gercekToplam} [${kaynak}]` }
  }
  const res = await fetch(`${SBURL}/tefas_fon_holdings`, {
    method: 'POST',
    headers: { ...sbH, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      fonKodu, tarih: new Date().toISOString().slice(0, 10), hisseler: r.holdings,
      kaynak, gercekToplam: r.gercekToplam, beklenenToplam: r.beklenenToplam,
      guncellenmeTarihi: new Date().toISOString(),
    }),
  })
  return { fonKodu, ok: res.ok, hisse: r.holdings.length, toplam: r.gercekToplam, kaynak }
}

async function main() {
  // ISP fonları + hisse içerenler (dağılımda Hisse Senedi olanlar)
  const meta = await (await fetch(`${SBURL}/tefas_fon_meta?kurucuKod=eq.ISP&select=fonKodu`, { headers: sbH })).json()
  const ispKodlar = new Set(meta.map(x => x.fonKodu))
  const dag = await (await fetch(`${SBURL}/tefas_fon_dagilim?select=fonKodu,dagilim&limit=3000`, { headers: sbH })).json()
  const hissePct = {}
  for (const d of dag) hissePct[d.fonKodu] = (d.dagilim?.['Hisse Senedi'] || 0) + (d.dagilim?.['Yabancı Hisse Senedi'] || 0)
  const hisseliler = dag.filter(d => ispKodlar.has(d.fonKodu) && hissePct[d.fonKodu] > 0).map(d => d.fonKodu)

  const map = await slugMap()
  console.log(`İş Portföy hisseli fon: ${hisseliler.length} | slug haritası: ${Object.keys(map).length}`)

  let ok = 0, fail = 0, nourl = 0
  for (const kod of hisseliler) {
    const slug = map[kod]
    if (!slug) { nourl++; console.log(`  ? ${kod}: slug yok`); continue }
    try {
      const url = await raporUrl(slug)
      if (!url) { nourl++; console.log(`  ? ${kod}: rapor linki yok`); continue }
      const r = await holdingsYaz(kod, url, hissePct[kod])
      if (r.ok) { ok++; console.log(`  ✓ ${kod}: ${r.hisse} hisse (%${r.toplam}) [${r.kaynak}]`) }
      else { fail++; console.log(`  ✗ ${kod}: ${r.neden || 'db hata'}`) }
    } catch (e) { fail++; console.log(`  ✗ ${kod}: ${e.message}`) }
    await new Promise(s => setTimeout(s, 400))
  }
  console.log(`\nBitti. Başarılı: ${ok}, geçersiz/hata: ${fail}, kaynak yok: ${nourl}`)
}
main()
