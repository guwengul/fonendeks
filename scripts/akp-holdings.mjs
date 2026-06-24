// Ak Portföy (AKP) holdings → DB
// node scripts/akp-holdings.mjs
import { processFund, hisseliMap, kurucuKodlari, UA } from './holdings-core.mjs'

const BASE = 'https://www.akportfoy.com.tr'

// fon sayfasından "Son Varlık Dağılım Raporu" PDF URL'i
async function raporUrl(kod) {
  const html = await (await fetch(`${BASE}/tr/fund/${kod}`, { headers: UA, redirect: 'follow' })).text()
  const re = /href="([^"]*\/doc\/\d+)"[^>]*>\s*([^<]{2,80})/gi
  let m
  while ((m = re.exec(html))) {
    if (/Son Varl[ıi]k Da[ğg][ıi]l[ıi]m Rapor/i.test(m[2])) {
      const u = m[1].startsWith('http') ? m[1] : BASE + m[1]
      return u
    }
  }
  return null
}

async function main() {
  const hisse = await hisseliMap()
  const kodlar = (await kurucuKodlari('AKP')).filter(k => hisse[k] > 0)
  console.log(`Ak Portföy hisseli fon: ${kodlar.length}`)
  let ok = 0, fail = 0, nourl = 0
  for (const kod of kodlar) {
    try {
      const url = await raporUrl(kod)
      if (!url) { nourl++; console.log(`  ? ${kod}: rapor yok`); continue }
      const r = await processFund(kod, url, hisse[kod])
      if (r.ok) { ok++; console.log(`  ✓ ${kod}: ${r.hisse} hisse (%${r.toplam}) [${r.kaynak}]`) }
      else { fail++; console.log(`  ✗ ${kod}: ${r.neden}`) }
    } catch (e) { fail++; console.log(`  ✗ ${kod}: ${e.message}`) }
    await new Promise(s => setTimeout(s, 400))
  }
  console.log(`\nBitti. Başarılı: ${ok}, hata: ${fail}, kaynak yok: ${nourl}`)
}
main()
