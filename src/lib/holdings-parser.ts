// KAP aylık fon raporundaki "III-FON PORTFÖY DEĞERİ TABLOSU" → hisse holdings
// Regex (ISIN-anchored) parse + belgenin kendi GRUP TOPLAMI'na karşı doğrulama.

export type Holding = { ticker: string; isin: string; agirlik: number }
export type ParseSonuc = {
  holdings: Holding[]
  gercekToplam: number
  beklenenToplam: number | null
  gecerli: boolean
}

function trNum(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

export function parseHoldings(text: string): ParseSonuc {
  const start = text.indexOf('HİSSE SENETLERİ')
  if (start === -1) return { holdings: [], gercekToplam: 0, beklenenToplam: null, gecerli: false }

  // Hisse grubunun kendi GRUP TOPLAMI satırı (start'tan sonraki ilki)
  const grupIdx = text.indexOf('GRUP TOPLAMI', start)
  let beklenenToplam: number | null = null
  if (grupIdx !== -1) {
    // Jumbled metinde FTD toplamı "GRUP TOPLAMI"dan hemen sonra gelir
    const m = text.slice(grupIdx, grupIdx + 60).match(/GRUP TOPLAMI\s+(\d+,\d+)/)
    if (m) beklenenToplam = trNum(m[1])
  }

  let t = text.slice(start, grupIdx === -1 ? undefined : grupIdx).replace(/\s+/g, ' ')
  // Gürültü temizliği: bölüm başlığı, sayfa numaraları, tekrarlı sayfa/kolon başlıkları
  t = t.replace(/HİSSE SENETLERİ Hisse Türk/g, ' ')
  t = t.replace(/HİSSE SENETLERİ/g, ' ')
  t = t.replace(/-- \d+ of \d+ --/g, ' ')
  t = t.replace(/[A-ZÇĞİÖŞÜ0-9-]+-İŞ PORTFÖY[^]*?FONU \([^)]*\)/g, ' ')
  t = t.replace(/Mayıs-\d{4}|Ocak-\d{4}|Şubat-\d{4}|Mart-\d{4}|Nisan-\d{4}|Haziran-\d{4}|Temmuz-\d{4}|Ağustos-\d{4}|Eylül-\d{4}|Ekim-\d{4}|Kasım-\d{4}|Aralık-\d{4}/g, ' ')
  t = t.replace(/TOPLAM \(FPD GÖRE\)[^]*?ISIN KODU/g, ' ')

  // ISIN ile satırlara böl (her kalem ticker ile başlar, ISIN ile biter)
  const isinRe = /TR[A-Z0-9]{10}/g
  const isinler = t.match(isinRe) || []
  const parts = t.split(isinRe)

  const map = new Map<string, Holding>()
  for (let i = 0; i < isinler.length; i++) {
    const chunk = (parts[i] || '').trim()
    if (!chunk) continue
    const ticker = chunk.split(' ')[0]
    if (!/^[A-Z][A-Z0-9]{2,5}$/.test(ticker)) continue
    const nums = chunk.match(/-?\d[\d.]*,\d+/g) || []
    if (!nums.length) continue
    const w = trNum(nums[nums.length - 1]) // ISIN'den önceki son sayı = FTD%
    const mevcut = map.get(ticker)
    if (mevcut) mevcut.agirlik += w
    else map.set(ticker, { ticker, isin: isinler[i], agirlik: w })
  }

  const holdings = [...map.values()]
    .filter(h => Math.abs(h.agirlik) > 0.001)
    .map(h => ({ ...h, agirlik: +h.agirlik.toFixed(2) }))
    .sort((a, b) => b.agirlik - a.agirlik)

  const gercekToplam = +holdings.reduce((s, h) => s + h.agirlik, 0).toFixed(2)
  const gecerli = beklenenToplam != null && Math.abs(gercekToplam - beklenenToplam) <= 0.5 && holdings.length > 0

  return { holdings, gercekToplam, beklenenToplam, gecerli }
}
