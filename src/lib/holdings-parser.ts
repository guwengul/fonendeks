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

  const t = text.slice(start, grupIdx === -1 ? undefined : grupIdx).replace(/\s+/g, ' ')

  // ISIN ile satırlara böl (her kalem ticker ile başlar, ISIN ile biter)
  const isinRe = /TR[A-Z0-9]{10}/g
  const isinler = t.match(isinRe) || []
  const parts = t.split(isinRe)

  const NOISE = new Set(['GRUP', 'TOPLAM', 'HISSE', 'ISIN', 'KODU', 'TL', 'FPD', 'FTD', 'REPO'])
  const map = new Map<string, Holding>()
  for (let i = 0; i < isinler.length; i++) {
    let chunk = (parts[i] || '').trim()
    if (!chunk) continue
    // Tekrarlı sayfa/kolon başlığı stabil olarak "ISIN KODU" ile biter → sonrasını al
    const k = chunk.lastIndexOf('ISIN KODU')
    if (k !== -1) chunk = chunk.slice(k + 9)
    // İlk kalemde bölüm başlığı "Hisse Türk" sonrası başlar
    const h = chunk.lastIndexOf('Hisse Türk')
    if (h !== -1) chunk = chunk.slice(h + 10)
    // Gerçek ticker: ticker desenine uyan ve noise olmayan ilk token
    const ticker = chunk.split(' ').find(tok => /^[A-Z][A-Z0-9]{2,5}$/.test(tok) && !NOISE.has(tok))
    if (!ticker) continue
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
