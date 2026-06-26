// KAP doküman fetch: PDF linkini bulur, metni çıkarır, tefas_kap_raporlar'a yazar.
// Parse etmez (holdings hesaplamaz). node scripts/kap-fetch.mjs [kurucuKod|ALL] [limit]
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import { PDFParse } from 'pdf-parse'
import { UA, hisseliMap } from './holdings-core.mjs'

const SBURL = 'https://vojpmfhtddkkbcwqjrvg.supabase.co/rest/v1'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvanBtZmh0ZGRra2Jjd3FqcnZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYzMTY1NSwiZXhwIjoyMDk3MjA3NjU1fQ.X4vrxXhwoLpCZapR6U5nDRc9YFzldHRQUKEHhSPcKNc'
const sbH = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const TYPE = '8aca490d502e34b801502e380044002b' // Portföy Dağılım Raporu
const SCRAPE_TOKEN = 'd14e3b368bc14429be8f10040b6bc95b23c78965815'

// KAP HTML sayfaları scrape.do üzerinden, JSON API ve PDF direkt
function scrapeUrl(url) {
  return `https://api.scrape.do?token=${SCRAPE_TOKEN}&url=${encodeURIComponent(url)}`
}

async function fetchR(url, kind = 'text', tries = 4) {
  // KAP HTML sayfaları (genel + bildirim) → scrape.do proxy; API + PDF → direkt
  const proxyUrl = url.includes('kap.org.tr/tr/fon-bilgileri') || url.includes('kap.org.tr/tr/Bildirim')
    ? scrapeUrl(url) : url
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(proxyUrl, { headers: UA, signal: AbortSignal.timeout(30000) })
      if (r.status === 200) return kind === 'json' ? await r.json() : kind === 'buf' ? Buffer.from(await r.arrayBuffer()) : await r.text()
    } catch { }
    if (i < tries - 1) await new Promise(s => setTimeout(s, 800 * (i + 1)))
  }
  return null
}

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
  const yayinTarihi = (d.disclosureBasic?.publishDate || d.publishDate || '').slice(0, 10)
  const kapBildirimLink = `https://www.kap.org.tr/tr/Bildirim/${idx}`
  for (let i = 0; i < 4; i++) {
    const bil = await fetchR(kapBildirimLink)
    const file = bil?.match(/file\/download\/([a-f0-9]{32})/)?.[1]
    if (file) {
      return { kapBildirimLink, pdfLink: `https://www.kap.org.tr/tr/api/file/download/${file}`, yayinTarihi }
    }
    await new Promise(s => setTimeout(s, 1000 * (i + 1)))
  }
  return null
}

async function pdfMetinCikar(pdfLink) {
  let buf = await fetchR(pdfLink, 'buf')
  if (!buf) return null
  // KAP Java wrapper'ı → %PDF'ten kes
  if (buf.slice(0, 5).toString() !== '%PDF-') {
    const i = buf.indexOf('%PDF'), j = buf.lastIndexOf('%%EOF')
    if (i >= 0) buf = buf.slice(i, j > i ? j + 5 : undefined)
    else return null
  }
  const metin = await Promise.race([
    new PDFParse({ data: new Uint8Array(buf) }).getText().then(r => r.text || '').catch(() => ''),
    new Promise(res => setTimeout(() => res(''), 25000)),
  ])
  return metin || null
}

async function main() {
  const kurucu = (process.argv[2] || 'ALL').toUpperCase()
  const limit = process.argv[3] ? parseInt(process.argv[3]) : 9999

  const meta = []
  for (let o = 0; ; o += 1000) {
    let q = `${SBURL}/tefas_fon_meta?select=fonKodu,kapLink&kapLink=not.is.null&offset=${o}&limit=1000`
    if (kurucu !== 'ALL') q += `&kurucuKod=eq.${kurucu}`
    const d = await (await fetch(q, { headers: sbH })).json()
    meta.push(...d)
    if (d.length < 1000) break
  }

  const hisse = await hisseliMap()
  const liste = meta.filter(m => hisse[m.fonKodu] >= 80).slice(0, limit)
  console.log(`${kurucu}: ${liste.length} hisseli fon (kapLink'li, toplam meta: ${meta.length})`)

  let bulundu = 0, bulunamadi = 0, metinYok = 0
  for (const m of liste) {
    const slug = m.kapLink?.match(/genel\/([a-z0-9-]+)/)?.[1]
    if (!slug) { bulunamadi++; console.log(`  ? ${m.fonKodu}: slug yok`); continue }
    try {
      const k = await kapKaynak(slug)
      if (!k) { bulunamadi++; console.log(`  ? ${m.fonKodu}: rapor bulunamadı`); continue }

      const metin = await pdfMetinCikar(k.pdfLink)
      if (!metin) metinYok++

      const row = {
        fonKodu: m.fonKodu,
        kapBildirimLink: k.kapBildirimLink,
        pdfLink: k.pdfLink,
        yayinTarihi: k.yayinTarihi || null,
        pdfMetin: metin,
        guncellenmeTarihi: new Date().toISOString(),
      }
      const r = await fetch(`${SBURL}/tefas_kap_raporlar`, {
        method: 'POST',
        headers: { ...sbH, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(row),
      })
      if (r.ok) {
        bulundu++
        console.log(`  ✓ ${m.fonKodu}: ${k.yayinTarihi} metin=${metin ? metin.length + 'kr' : 'YOK'}`)
      } else {
        const err = await r.text()
        bulunamadi++
        console.log(`  ✗ ${m.fonKodu}: DB hata ${r.status} ${err.slice(0, 80)}`)
      }
    } catch (e) {
      bulunamadi++
      console.log(`  ✗ ${m.fonKodu}: ${e.message}`)
    }
    await new Promise(s => setTimeout(s, 1200))
  }
  console.log(`\nBitti. Bulundu: ${bulundu}, bulunamadı: ${bulunamadi}, metin yok: ${metinYok}`)
}
main()
