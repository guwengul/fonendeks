// KAP-evrensel holdings: TÜM kurucular için tek mekanizma (server-side, scrape.do ile)
// node scripts/kap-holdings.mjs <kurucuKod|ALL> [limit]
// Akış (borsapy yöntemi): genel sayfa→fund_id → disclosure filter API → Bildirim → file download → parse
import { processFund, hisseliMap, UA } from './holdings-core.mjs'

const SBURL = 'https://vojpmfhtddkkbcwqjrvg.supabase.co/rest/v1'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvanBtZmh0ZGRra2Jjd3FqcnZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYzMTY1NSwiZXhwIjoyMDk3MjA3NjU1fQ.X4vrxXhwoLpCZapR6U5nDRc9YFzldHRQUKEHhSPcKNc'
const sbH = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const TYPE = '8aca490d502e34b801502e380044002b' // Portföy Dağılım Raporu
const SCRAPE_TOKEN = 'd14e3b368bc14429be8f10040b6bc95b23c78965815'

function scrapeUrl(url) {
  return `https://api.scrape.do?token=${SCRAPE_TOKEN}&url=${encodeURIComponent(url)}`
}

// KAP HTML sayfaları scrape.do üzerinden (JS render gerekli), JSON API ve PDF direkt
async function fetchR(url, kind = 'text', tries = 4) {
  const isKapHtml = url.includes('kap.org.tr/tr/fon-bilgileri') || url.includes('kap.org.tr/tr/Bildirim')
  const target = isKapHtml ? scrapeUrl(url) : url
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(target, { headers: UA, signal: AbortSignal.timeout(30000) })
      if (r.status === 200) return kind === 'json' ? await r.json() : (kind === 'buf' ? Buffer.from(await r.arrayBuffer()) : await r.text())
    } catch { /* fetch failed / timeout → retry */ }
    if (i < tries - 1) await new Promise(s => setTimeout(s, 800 * (i + 1)))
  }
  return null
}

// kapLink slug → { pdfUrl, kapBildirimLink, pdfLink, yayinTarihi }
async function kapKaynak(slug) {
  const g = await fetchR(`https://www.kap.org.tr/tr/fon-bilgileri/genel/${slug}`)
  if (!g) return null
  const fid = g.match(/objId[\\"':]+([A-F0-9]{32})/)?.[1]
  if (!fid) return null
  const list = await fetchR(`https://kap.org.tr/tr/api/disclosure/filter/FILTERYFBF/${fid}/${TYPE}/365`, 'json')
  if (!Array.isArray(list) || !list.length) return null
  const d = list[0]
  const idx = d.disclosureIndex ?? d.disclosureBasic?.disclosureIndex
  if (!idx) return null
  const yayinTarihi = (d.disclosureBasic?.publishDate || '').slice(0, 10) // "08.06.2026"
  const kapBildirimLink = `https://www.kap.org.tr/tr/Bildirim/${idx}`
  // Bildirim sayfası → file_id (kararsız → retry)
  for (let i = 0; i < 4; i++) {
    const bil = await fetchR(kapBildirimLink)
    const file = bil?.match(/file\/download\/([a-f0-9]{32})/)?.[1]
    if (file) {
      const pdfLink = `https://www.kap.org.tr/tr/api/file/download/${file}`
      return { pdfUrl: pdfLink, kapBildirimLink, pdfLink, yayinTarihi }
    }
    await new Promise(s => setTimeout(s, 1000 * (i + 1)))
  }
  return null
}

async function main() {
  const kurucu = (process.argv[2] || 'ALL').toUpperCase()
  const limit = process.argv[3] ? parseInt(process.argv[3]) : 9999

  const hisse = await hisseliMap()
  let q = `${SBURL}/tefas_fon_meta?select=fonKodu,kapLink&kapLink=not.is.null`
  if (kurucu !== 'ALL') q += `&kurucuKod=eq.${kurucu}`
  const meta = await (await fetch(q, { headers: sbH })).json()

  // En son tarihteki portföy büyüklüklerini çek
  const { data: sonTarihRow } = await (await fetch(`${SBURL}/tefas_fon_verileri?select=tarih&order=tarih.desc&limit=1`, { headers: sbH })).json().then(d => ({ data: d[0] }))
  const sonTarih = sonTarihRow?.tarih
  let buyuklukMap = {}
  if (sonTarih) {
    let from = 0
    while (true) {
      const rows = await (await fetch(`${SBURL}/tefas_fon_verileri?select=fonKodu,portfoyBuyukluk&tarih=eq.${sonTarih}&range=${from}-${from+999}`, { headers: sbH })).json()
      if (!Array.isArray(rows) || rows.length === 0) break
      for (const r of rows) buyuklukMap[r.fonKodu] = r.portfoyBuyukluk ?? 0
      if (rows.length < 1000) break
      from += 1000
    }
  }

  const liste = meta
    .filter(m => hisse[m.fonKodu] > 0)
    .sort((a, b) => (Number(buyuklukMap[b.fonKodu]) || 0) - (Number(buyuklukMap[a.fonKodu]) || 0))
    .slice(0, limit)
  console.log(`${kurucu}: ${liste.length} hisseli fon (kapLink'li, portföy büyüklüğüne göre sıralı)`)
  if (liste[0]) console.log(`  En büyük: ${liste[0].fonKodu} (${Math.round(Number(buyuklukMap[liste[0].fonKodu])/1e6)}M TL)`)

  let ok = 0, fail = 0, nourl = 0
  for (const m of liste) {
    const slug = m.kapLink.match(/genel\/([a-z0-9-]+)/)?.[1]
    if (!slug) { nourl++; continue }
    try {
      const k = await kapKaynak(slug)
      if (!k) { nourl++; console.log(`  ? ${m.fonKodu}: rapor/file bulunamadı`); continue }
      const r = await processFund(m.fonKodu, k.pdfUrl, hisse[m.fonKodu], {
        kapBildirimLink: k.kapBildirimLink, pdfLink: k.pdfLink, yayinTarihi: k.yayinTarihi,
      })
      const buyukluk = buyuklukMap[m.fonKodu] ? ` [${Math.round(Number(buyuklukMap[m.fonKodu])/1e6)}M]` : ''
      if (r.ok) { ok++; console.log(`  ✓ ${m.fonKodu}${buyukluk}: ${r.hisse} hisse (%${r.toplam}) [${r.kaynak}]`) }
      else { fail++; console.log(`  ✗ ${m.fonKodu}${buyukluk}: ${r.neden}`) }
    } catch (e) { fail++; console.log(`  ✗ ${m.fonKodu}: ${e.message}`) }
    await new Promise(s => setTimeout(s, 500))
  }
  console.log(`\nBitti. Başarılı: ${ok}, hata: ${fail}, kaynak yok: ${nourl}`)
}
main()
