// KAP-evrensel holdings: TÜM kurucular için tek mekanizma (server-side, scrape.do yok)
// node scripts/kap-holdings.mjs <kurucuKod|ALL> [limit]
// Akış (borsapy yöntemi): genel sayfa→fund_id → disclosure filter API → Bildirim → file download → parse
import { processFund, hisseliMap, UA } from './holdings-core.mjs'

const SBURL = 'https://vojpmfhtddkkbcwqjrvg.supabase.co/rest/v1'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvanBtZmh0ZGRra2Jjd3FqcnZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYzMTY1NSwiZXhwIjoyMDk3MjA3NjU1fQ.X4vrxXhwoLpCZapR6U5nDRc9YFzldHRQUKEHhSPcKNc'
const sbH = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const TYPE = '8aca490d502e34b801502e380044002b' // Portföy Dağılım Raporu

// kapLink slug → en güncel portföy raporu PDF download URL'i
async function kapDownloadUrl(slug) {
  const g = await (await fetch(`https://www.kap.org.tr/tr/fon-bilgileri/genel/${slug}`, { headers: UA })).text()
  const fid = g.match(/objId[\\"':]+([A-F0-9]{32})/)?.[1]
  if (!fid) return null
  const list = await (await fetch(`https://kap.org.tr/tr/api/disclosure/filter/FILTERYFBF/${fid}/${TYPE}/365`, { headers: UA })).json()
  if (!Array.isArray(list) || !list.length) return null
  const idx = list[0].disclosureIndex ?? list[0].disclosureBasic?.disclosureIndex
  if (!idx) return null
  // Bildirim sayfası → file_id (kararsız olabilir → retry)
  for (let i = 0; i < 3; i++) {
    const bil = await (await fetch(`https://kap.org.tr/tr/Bildirim/${idx}`, { headers: UA })).text()
    const file = bil.match(/file\/download\/([a-f0-9]{32})/)?.[1]
    if (file) return `https://kap.org.tr/tr/api/file/download/${file}`
    await new Promise(s => setTimeout(s, 1200 * (i + 1)))
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
  const liste = meta.filter(m => hisse[m.fonKodu] > 0).slice(0, limit)
  console.log(`${kurucu}: ${liste.length} hisseli fon (kapLink'li)`)

  let ok = 0, fail = 0, nourl = 0
  for (const m of liste) {
    const slug = m.kapLink.match(/genel\/([a-z0-9-]+)/)?.[1]
    if (!slug) { nourl++; continue }
    try {
      const url = await kapDownloadUrl(slug)
      if (!url) { nourl++; console.log(`  ? ${m.fonKodu}: rapor/file bulunamadı`); continue }
      const r = await processFund(m.fonKodu, url, hisse[m.fonKodu])
      if (r.ok) { ok++; console.log(`  ✓ ${m.fonKodu}: ${r.hisse} hisse (%${r.toplam}) [${r.kaynak}]`) }
      else { fail++; console.log(`  ✗ ${m.fonKodu}: ${r.neden}`) }
    } catch (e) { fail++; console.log(`  ✗ ${m.fonKodu}: ${e.message}`) }
    await new Promise(s => setTimeout(s, 500))
  }
  console.log(`\nBitti. Başarılı: ${ok}, hata: ${fail}, kaynak yok: ${nourl}`)
}
main()
