import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import AnalizListesi from '@/components/AnalizListesi'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Tutarlı Büyüme Analizi',
}

function hedefTarihHesapla(sonTarih: string, ay: number): string {
  const d = new Date(sonTarih)
  d.setMonth(d.getMonth() - ay)
  return d.toISOString().slice(0, 10)
}

function enYakinTarih(tarihler: string[], hedef: string): string | null {
  let sonraki: string | null = null
  for (const t of tarihler) {
    if (t >= hedef) sonraki = t
    else break
  }
  if (sonraki) return sonraki
  for (const t of tarihler) {
    if (t <= hedef) return t
  }
  return null
}

export default async function AnalizPage() {
  const supabase = createAdminClient()
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  const { data: sonTarihRow } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih')
    .order('tarih', { ascending: false })
    .limit(1)
    .single()

  const sonTarih = sonTarihRow?.tarih
  if (!sonTarih) return null

  // AAL tarihleri paginated
  const tarihlerRaw: string[] = []
  {
    let from = 0
    while (true) {
      const { data } = await supabase
        .from('tefas_fon_verileri')
        .select('tarih')
        .eq('fonKodu', 'AAL')
        .eq('fonTipi', 'YAT')
        .order('tarih', { ascending: false })
        .range(from, from + 999)
      if (!data || data.length === 0) break
      tarihlerRaw.push(...data.map(r => r.tarih))
      if (data.length < 1000) break
      from += 1000
    }
  }
  const tarihler = tarihlerRaw

  // 6 aylık checkpoint'ler: 0..60 ay
  const AYLAR = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60]
  const checkpointler = AYLAR.map(ay => ({
    ay,
    tarih: ay === 0 ? sonTarih : (enYakinTarih(tarihler, hedefTarihHesapla(sonTarih, ay)) ?? null),
  }))

  // 3 aylık checkpoint'ler: 0..12 ay
  const AYLAR_CEYREK = [0, 3, 6, 9, 12]
  const ceyrekCheckpointler = AYLAR_CEYREK.map(ay => ({
    ay,
    tarih: ay === 0 ? sonTarih : (enYakinTarih(tarihler, hedefTarihHesapla(sonTarih, ay)) ?? null),
  }))

  const benzersizTarihler = [...new Set([
    ...checkpointler.map(c => c.tarih),
    ...ceyrekCheckpointler.map(c => c.tarih),
  ].filter(Boolean) as string[])]

  async function fetchAllForDate(tarih: string) {
    const rows: { fonKodu: string; fonTipi: string; fonUnvan: string; fiyat: number }[] = []
    let from = 0
    while (true) {
      const { data } = await supabase
        .from('tefas_fon_verileri')
        .select('fonKodu, fonTipi, fonUnvan, fiyat')
        .eq('tarih', tarih)
        .range(from, from + 999)
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
    return rows
  }

  const metaRows: any[] = []
  {
    let from = 0
    while (true) {
      const { data } = await supabase
        .from('tefas_fon_meta')
        .select('fonKodu, riskDegeri, kurucuKod, fonTurAciklama, stopaj, yonetimUcreti, tefasDurum')
        .range(from, from + 999)
      if (!data || data.length === 0) break
      metaRows.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
  }
  const metaMap = new Map(metaRows.map((m: any) => [m.fonKodu, m]))

  // USD tek sorguda
  const enEskiTarih = benzersizTarihler.slice().sort()[0]
  const { data: usdRows } = await supabase
    .from('tefas_benchmark_fiyatlari')
    .select('tarih, deger')
    .eq('gosterge', 'USD')
    .gte('tarih', enEskiTarih)
    .lte('tarih', sonTarih)
    .order('tarih', { ascending: true })

  const usdSirali = (usdRows ?? []).map(r => ({ tarih: r.tarih, deger: Number(r.deger) }))
  function usdKurBul(hedef: string): number | null {
    let best: number | null = null
    for (const u of usdSirali) {
      if (u.tarih <= hedef) best = u.deger
      else break
    }
    return best
  }

  const [tarihVerileri, favoriSatirlar] = await Promise.all([
    Promise.all(benzersizTarihler.map(async tarih => ({ tarih, data: await fetchAllForDate(tarih) }))),
    user
      ? authClient.from('tefas_favoriler').select('fonKodu, fonTipi').eq('user_id', user.id).then(r => r.data ?? [])
      : Promise.resolve([]),
  ])

  const fiyatMap: Record<string, Record<string, number>> = {}
  for (const { tarih, data } of tarihVerileri) {
    fiyatMap[tarih] = {}
    for (const r of data) fiyatMap[tarih][`${r.fonKodu}-${r.fonTipi}`] = r.fiyat
  }

  const sonTarihData = tarihVerileri.find(t => t.tarih === sonTarih)?.data ?? []

  const cpTarihler = checkpointler.map(c => c.tarih)
  const cqTarihler = ceyrekCheckpointler.map(c => c.tarih)

  function usdAyarli(tlGetiri: number | null, usdYeni: number | null, usdEski: number | null): number | null {
    if (tlGetiri == null || !usdYeni || !usdEski || usdEski === 0) return null
    const usdDegisim = (usdYeni - usdEski) / usdEski
    return ((1 + tlGetiri / 100) / (1 + usdDegisim) - 1) * 100
  }

  const fonAnalizler = sonTarihData.map(r => {
    const key = `${r.fonKodu}-${r.fonTipi}`

    const fiyatlar = cpTarihler.map(t => (t ? fiyatMap[t]?.[key] ?? null : null))
    const usdFiyatlar = cpTarihler.map(t => (t ? usdKurBul(t) : null))

    // 6 aylık periyotlar (10 dönem, 5 yıl)
    const altiAylik: (number | null)[] = []
    const altiAylikUsd: (number | null)[] = []
    for (let i = 0; i < cpTarihler.length - 1; i++) {
      const t0 = cpTarihler[i]; const t1 = cpTarihler[i + 1]
      if (!t0 || !t1 || t0 === t1) { altiAylik.push(null); altiAylikUsd.push(null); continue }
      const yeni = fiyatlar[i]; const eski = fiyatlar[i + 1]
      const tl = yeni != null && eski != null && eski !== 0 ? ((yeni - eski) / eski) * 100 : null
      altiAylik.push(tl)
      altiAylikUsd.push(usdAyarli(tl, usdFiyatlar[i], usdFiyatlar[i + 1]))
    }

    // Yıllık periyotlar (5 dönem)
    const yillik: (number | null)[] = []
    const yillikUsd: (number | null)[] = []
    for (let i = 0; i < cpTarihler.length - 2; i += 2) {
      const yeni = fiyatlar[i]; const eski = fiyatlar[i + 2]
      const tl = yeni != null && eski != null && eski !== 0 ? ((yeni - eski) / eski) * 100 : null
      yillik.push(tl)
      yillikUsd.push(usdAyarli(tl, usdFiyatlar[i], usdFiyatlar[i + 2]))
    }

    // 3 aylık periyotlar (4 dönem, son 1 yıl)
    const cqFiyatlar = cqTarihler.map(t => (t ? fiyatMap[t]?.[key] ?? null : null))
    const cqUsdFiyatlar = cqTarihler.map(t => (t ? usdKurBul(t) : null))
    const ceyreklik: (number | null)[] = []
    const ceyreklikUsd: (number | null)[] = []
    for (let i = 0; i < cqTarihler.length - 1; i++) {
      const yeni = cqFiyatlar[i]; const eski = cqFiyatlar[i + 1]
      const tl = yeni != null && eski != null && eski !== 0 ? ((yeni - eski) / eski) * 100 : null
      ceyreklik.push(tl)
      ceyreklikUsd.push(usdAyarli(tl, cqUsdFiyatlar[i], cqUsdFiyatlar[i + 1]))
    }

    const fiyatBugün = fiyatlar[0]
    const fiyat3y = fiyatlar[6]
    const fiyat5y = fiyatlar[fiyatlar.length - 1]
    const toplamGetiri3y = fiyatBugün != null && fiyat3y != null && fiyat3y !== 0
      ? ((fiyatBugün - fiyat3y) / fiyat3y) * 100 : null
    const toplamGetiri3yUsd = usdAyarli(toplamGetiri3y, usdFiyatlar[0], usdFiyatlar[6])
    const toplamGetiri5y = fiyatBugün != null && fiyat5y != null && fiyat5y !== 0
      ? ((fiyatBugün - fiyat5y) / fiyat5y) * 100 : null
    const toplamGetiri5yUsd = usdAyarli(toplamGetiri5y, usdFiyatlar[0], usdFiyatlar[usdFiyatlar.length - 1])

    const fiyat1y = cqFiyatlar[cqFiyatlar.length - 1]
    const usd1y = cqUsdFiyatlar[cqUsdFiyatlar.length - 1]
    const toplamGetiri1y = cqFiyatlar[0] != null && fiyat1y != null && fiyat1y !== 0
      ? ((cqFiyatlar[0]! - fiyat1y) / fiyat1y) * 100 : null
    const toplamGetiri1yUsd = usdAyarli(toplamGetiri1y, cqUsdFiyatlar[0], usd1y)

    const meta = metaMap.get(r.fonKodu)
    return {
      fonKodu: r.fonKodu, fonTipi: r.fonTipi, fonUnvan: r.fonUnvan,
      altiAylik, altiAylikUsd,
      yillik, yillikUsd,
      ceyreklik, ceyreklikUsd,
      toplamGetiri3y, toplamGetiri3yUsd,
      toplamGetiri5y, toplamGetiri5yUsd,
      toplamGetiri1y, toplamGetiri1yUsd,
      riskDegeri: meta?.riskDegeri ?? null,
      kurucuKod: meta?.kurucuKod ?? null,
      fonTurAciklama: meta?.fonTurAciklama ?? null,
      stopaj: meta?.stopaj ?? null,
      yonetimUcreti: meta?.yonetimUcreti ?? null,
      tefasAcik: meta?.tefasDurum?.includes('işlem görüyor') ?? null,
    }
  }).filter(f => f.yillik.filter(p => p !== null).length >= 1)

  function ayEtiketi(tarih: string | null) {
    if (!tarih) return '?'
    return new Date(tarih).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })
  }

  const altiAyEtiketler = checkpointler.slice(0, -1).map((c, i) => {
    const t0 = checkpointler[i + 1]?.tarih
    return `${ayEtiketi(t0)}→${ayEtiketi(c.tarih)}`
  })
  const yillikEtiketler = checkpointler.filter((_, i) => i % 2 === 0).slice(0, -1).map((c, i) => {
    const t0 = checkpointler[(i + 1) * 2]?.tarih
    return `${ayEtiketi(t0)}→${ayEtiketi(c.tarih)}`
  })
  const ceyreklikEtiketler = ceyrekCheckpointler.slice(0, -1).map((c, i) => {
    const t0 = ceyrekCheckpointler[i + 1]?.tarih
    return `${ayEtiketi(t0)}→${ayEtiketi(c.tarih)}`
  })

  const kurucular = [...new Set(fonAnalizler.map(f => f.kurucuKod).filter(Boolean))].sort() as string[]
  const initialFavoriler = new Set((favoriSatirlar as { fonKodu: string; fonTipi: string }[]).map(f => `${f.fonKodu}::${f.fonTipi}`))

  return (
    <div className="w-full px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tutarlı Büyüme Analizi</h1>
        <p className="text-slate-400 text-sm mt-1">
          Her dönemde düzenli artış gösteren fonlar · {sonTarih} itibarıyla
        </p>
      </div>
      <AnalizListesi
        fonlar={fonAnalizler}
        altiAyEtiketler={altiAyEtiketler}
        yillikEtiketler={yillikEtiketler}
        ceyreklikEtiketler={ceyreklikEtiketler}
        kurucular={kurucular}
        girisYapildi={!!user}
        initialFavoriler={initialFavoriler}
      />
    </div>
  )
}
