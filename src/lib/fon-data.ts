import { createAdminClient } from '@/lib/supabase/admin'

export const DONEM_KEYS = ['1g', '1h', '1a', '3a', '6a', 'yb', '1y', '3y', '5y'] as const

export function donemBasTarih(sonTarih: string, key: string): string {
  const d = new Date(sonTarih)
  if (key === '1g') { d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }
  if (key === '1h') { d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) }
  if (key === '1a') { d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10) }
  if (key === '3a') { d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10) }
  if (key === '6a') { d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10) }
  if (key === 'yb') return `${sonTarih.slice(0, 4)}-01-01`
  if (key === '1y') { d.setMonth(d.getMonth() - 12); return d.toISOString().slice(0, 10) }
  if (key === '3y') { d.setMonth(d.getMonth() - 36); return d.toISOString().slice(0, 10) }
  if (key === '5y') { d.setMonth(d.getMonth() - 60); return d.toISOString().slice(0, 10) }
  return sonTarih
}

export function usdAyarli(tlGetiri: number | null, usdYeni: number | null, usdEski: number | null): number | null {
  if (tlGetiri == null || !usdYeni || !usdEski || usdEski === 0) return null
  const usdDegisim = (usdYeni - usdEski) / usdEski
  return +((( 1 + tlGetiri / 100) / (1 + usdDegisim) - 1) * 100).toFixed(2)
}

export async function fetchFonlar(filtre?: { fonKodlari: string[] }) {
  const supabase = createAdminClient()

  const [ozetResult, metaResult] = await Promise.all([
    (async () => {
      const rows: any[] = []
      for (let from = 0; ; from += 1000) {
        let q = supabase.from('tefas_fon_ozet').select('*')
          .order('portfoyBuyukluk', { ascending: false, nullsFirst: false })
          .range(from, from + 999)
        if (filtre?.fonKodlari.length) q = q.in('fonKodu', filtre.fonKodlari)
        const { data } = await q
        if (!data || !data.length) break
        rows.push(...data)
        if (data.length < 1000) break
      }
      return rows
    })(),
    (async () => {
      const rows: any[] = []
      for (let from = 0; ; from += 1000) {
        let q = supabase.from('tefas_fon_meta')
          .select('fonKodu, riskDegeri, kurucuKod, fonTurAciklama, stopaj, yonetimUcreti, tefasDurum')
          .range(from, from + 999)
        if (filtre?.fonKodlari.length) q = q.in('fonKodu', filtre.fonKodlari)
        const { data } = await q
        if (!data || !data.length) break
        rows.push(...data)
        if (data.length < 1000) break
      }
      return rows
    })(),
  ])

  const metaMap = new Map(metaResult.map((m: any) => [m.fonKodu, m]))
  const sonTarih: string = ozetResult[0]?.tarih ?? ''

  const usdFiyatlar: Record<string, number | null> = { [sonTarih]: null }
  if (sonTarih) {
    const tarihler = [sonTarih, ...DONEM_KEYS.map(k => donemBasTarih(sonTarih, k))]
    const benzersiz = [...new Set(tarihler)]
    const results = await Promise.all(benzersiz.map(async t => {
      const { data } = await supabase.from('tefas_benchmark_fiyatlari')
        .select('deger').eq('gosterge', 'USD').lte('tarih', t)
        .order('tarih', { ascending: false }).limit(1).maybeSingle()
      return { t, deger: data ? Number(data.deger) : null }
    }))
    for (const { t, deger } of results) usdFiyatlar[t] = deger
  }

  const usdSon = usdFiyatlar[sonTarih]

  const fonlar = ozetResult.map((f: any) => {
    const meta = metaMap.get(f.fonKodu)
    const tl: Record<string, number | null> = {
      '1g': f.getiri1g, '1h': f.getiri1h, '1a': f.getiri1a, '3a': f.getiri3a,
      '6a': f.getiri6a, 'yb': f.getiriYb, '1y': f.getiri1y, '3y': f.getiri3y, '5y': f.getiri5y,
    }
    const usd: Record<string, number | null> = {}
    for (const k of DONEM_KEYS) {
      const usdEski = usdFiyatlar[donemBasTarih(sonTarih, k)] ?? null
      usd[k] = usdAyarli(tl[k], usdSon, usdEski)
    }
    return {
      fonKodu: f.fonKodu, fonUnvan: f.fonUnvan, fonTipi: f.fonTipi,
      fiyat: f.fiyat, portfoyBuyukluk: f.portfoyBuyukluk, kisiSayisi: f.kisiSayisi, tarih: f.tarih,
      riskDegeri: meta?.riskDegeri ?? null,
      kurucuKod: meta?.kurucuKod ?? null,
      fonTurAciklama: meta?.fonTurAciklama ?? null,
      stopaj: meta?.stopaj ?? null,
      yonetimUcreti: meta?.yonetimUcreti ?? null,
      tefasAcik: meta?.tefasDurum?.includes('işlem görüyor') ?? null,
      getiriler: tl,
      getirilerUsd: usd,
    }
  })

  const sonGuncelleme = ozetResult[0]?.guncellenmeTarihi
    ? new Date(ozetResult[0].guncellenmeTarihi).toLocaleDateString('tr-TR', {
        timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric',
      })
    : sonTarih ?? ''

  const kurucular = [...new Set(fonlar.map((f: any) => f.kurucuKod).filter(Boolean))].sort() as string[]
  const fonTurleri = [...new Set(fonlar.map((f: any) => f.fonTurAciklama).filter(Boolean))].sort() as string[]

  return { fonlar, kurucular, fonTurleri, sonGuncelleme }
}
