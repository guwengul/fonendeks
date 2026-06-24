// Aylık çalıştırılır: KAP/kurucu portföy raporu PDF → hisse holdings → DB
// Kullanım: node scripts/fon-holdings.mjs <fonKodu> <pdfUrl>
// pdf-parse local Node'da çalışır (Vercel serverless'te DOMMatrix sorunu var, o yüzden script).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import { PDFParse } from 'pdf-parse'

const SB = 'https://vojpmfhtddkkbcwqjrvg.supabase.co/rest/v1/tefas_fon_holdings'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvanBtZmh0ZGRra2Jjd3FqcnZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYzMTY1NSwiZXhwIjoyMDk3MjA3NjU1fQ.X4vrxXhwoLpCZapR6U5nDRc9YFzldHRQUKEHhSPcKNc'

function trNum(s) { return parseFloat(s.replace(/\./g, '').replace(',', '.')) }

export function parseHoldings(text) {
  const start = text.indexOf('HİSSE SENETLERİ')
  if (start === -1) return { holdings: [], gercekToplam: 0, beklenenToplam: null, gecerli: false }
  const grupIdx = text.indexOf('GRUP TOPLAMI', start)
  let beklenenToplam = null
  if (grupIdx !== -1) {
    const m = text.slice(grupIdx, grupIdx + 60).match(/GRUP TOPLAMI\s+(\d+,\d+)/)
    if (m) beklenenToplam = trNum(m[1])
  }
  const t = text.slice(start, grupIdx === -1 ? undefined : grupIdx).replace(/\s+/g, ' ')
  const isinRe = /TR[A-Z0-9]{10}/g
  const isinler = t.match(isinRe) || []
  const parts = t.split(isinRe)
  const NOISE = new Set(['GRUP', 'TOPLAM', 'HISSE', 'ISIN', 'KODU', 'TL', 'FPD', 'FTD', 'REPO'])
  const map = new Map()
  for (let i = 0; i < isinler.length; i++) {
    let chunk = (parts[i] || '').trim()
    if (!chunk) continue
    const k = chunk.lastIndexOf('ISIN KODU'); if (k !== -1) chunk = chunk.slice(k + 9)
    const h = chunk.lastIndexOf('Hisse Türk'); if (h !== -1) chunk = chunk.slice(h + 10)
    const ticker = chunk.split(' ').find(tok => /^[A-Z][A-Z0-9]{2,5}$/.test(tok) && !NOISE.has(tok))
    if (!ticker) continue
    const nums = chunk.match(/-?\d[\d.]*,\d+/g) || []
    if (!nums.length) continue
    const w = trNum(nums[nums.length - 1])
    const m = map.get(ticker)
    if (m) m.agirlik += w; else map.set(ticker, { ticker, isin: isinler[i], agirlik: w })
  }
  const holdings = [...map.values()].filter(h => Math.abs(h.agirlik) > 0.001)
    .map(h => ({ ...h, agirlik: +h.agirlik.toFixed(2) })).sort((a, b) => b.agirlik - a.agirlik)
  const gercekToplam = +holdings.reduce((s, h) => s + h.agirlik, 0).toFixed(2)
  const gecerli = beklenenToplam != null && Math.abs(gercekToplam - beklenenToplam) <= 0.5 && holdings.length > 0
  return { holdings, gercekToplam, beklenenToplam, gecerli }
}

async function main() {
  const [fonKodu, url] = process.argv.slice(2)
  if (!fonKodu || !url) { console.log('Kullanım: node scripts/fon-holdings.mjs <fonKodu> <pdfUrl>'); process.exit(1) }

  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).arrayBuffer())
  const text = (await new PDFParse({ data: new Uint8Array(buf) }).getText()).text || ''
  const r = parseHoldings(text)
  console.log(`${fonKodu}: ${r.holdings.length} hisse, toplam %${r.gercekToplam} (beklenen %${r.beklenenToplam}) → ${r.gecerli ? 'GEÇERLİ' : 'GEÇERSİZ (LLM gerekli)'}`)
  if (!r.gecerli) process.exit(2)

  const res = await fetch(`${SB}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      fonKodu, tarih: new Date().toISOString().slice(0, 10), hisseler: r.holdings,
      kaynak: 'regex', gercekToplam: r.gercekToplam, beklenenToplam: r.beklenenToplam,
      guncellenmeTarihi: new Date().toISOString(),
    }),
  })
  console.log(res.ok ? 'DB: yazıldı' : `DB hata: ${await res.text()}`)
  console.log('İlk 8:', r.holdings.slice(0, 8).map(h => `${h.ticker} %${h.agirlik}`).join(', '))
}

// Sadece doğrudan çalıştırılınca main() (import edilince değil)
if (process.argv[1] && process.argv[1].endsWith('fon-holdings.mjs')) main()
