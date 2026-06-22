import { createAdminClient } from '@/lib/supabase/admin'
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
  // Önce >= hedef (sonraki), bulamazsa <= hedef (önceki)
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

  const { data: sonTarihRow } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih')
    .order('tarih', { ascending: false })
    .limit(1)
    .single()

  const sonTarih = sonTarihRow?.tarih
  if (!sonTarih) return null

  const { data: tarihRows } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih')
    .eq('fonKodu', 'AAL')
    .eq('fonTipi', 'YAT')
    .order('tarih', { ascending: false })
    .limit(2000)

  const tarihler = (tarihRows ?? []).map(r => r.tarih)

  // 6 aylık checkpoint'ler: 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60
  const AYLAR = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60]
  const checkpointler = AYLAR.map(ay => ({
    ay,
    tarih: ay === 0 ? sonTarih : (enYakinTarih(tarihler, hedefTarihHesapla(sonTarih, ay)) ?? null),
  }))

  const benzersizTarihler = [...new Set(checkpointler.map(c => c.tarih).filter(Boolean) as string[])]

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

  const tarihVerileri = await Promise.all(
    benzersizTarihler.map(async tarih => ({
      tarih,
      data: await fetchAllForDate(tarih),
    }))
  )

  const fiyatMap: Record<string, Record<string, number>> = {}
  for (const { tarih, data } of tarihVerileri) {
    fiyatMap[tarih] = {}
    for (const r of data) {
      fiyatMap[tarih][`${r.fonKodu}-${r.fonTipi}`] = r.fiyat
    }
  }

  const sonTarihData = tarihVerileri.find(t => t.tarih === sonTarih)?.data ?? []
  const unvanMap: Record<string, string> = {}
  for (const r of sonTarihData) {
    unvanMap[`${r.fonKodu}-${r.fonTipi}`] = r.fonUnvan
  }

  // Checkpoint tarihlerini sıralı tut (desc)
  const cpTarihler = checkpointler.map(c => c.tarih)

  const fonAnalizler = sonTarihData.map(r => {
    const key = `${r.fonKodu}-${r.fonTipi}`

    // Her checkpoint için fiyat (desc: cp[0]=bugün, cp[1]=-6ay, ...)
    const fiyatlar = cpTarihler.map(t => (t ? fiyatMap[t]?.[key] ?? null : null))

    // 6 aylık periyotlar: cp[i] → cp[i+1] arası getiri
    const altiAylik: (number | null)[] = []
    for (let i = 0; i < cpTarihler.length - 1; i++) {
      const t0 = cpTarihler[i]
      const t1 = cpTarihler[i + 1]
      // Aynı tarihe düşmüşse veri yok demektir
      if (!t0 || !t1 || t0 === t1) { altiAylik.push(null); continue }
      const yeni = fiyatlar[i]
      const eski = fiyatlar[i + 1]
      altiAylik.push(yeni != null && eski != null && eski !== 0
        ? ((yeni - eski) / eski) * 100
        : null)
    }

    // Yıllık periyotlar: cp[0]→cp[2], cp[2]→cp[4], ...
    const yillik: (number | null)[] = []
    for (let i = 0; i < cpTarihler.length - 2; i += 2) {
      const t0 = cpTarihler[i]
      const t2 = cpTarihler[i + 2]
      if (!t0 || !t2 || t0 === t2) { yillik.push(null); continue }
      const yeni = fiyatlar[i]
      const eski = fiyatlar[i + 2]
      yillik.push(yeni != null && eski != null && eski !== 0
        ? ((yeni - eski) / eski) * 100
        : null)
    }

    const altiAyPozitif = altiAylik.filter(p => p !== null && p > 0).length
    const altiAyToplam = altiAylik.filter(p => p !== null).length
    const yillikPozitif = yillik.filter(p => p !== null && p > 0).length
    const yillikToplam = yillik.filter(p => p !== null).length

    // 5 yıllık toplam getiri: bugün vs -60ay checkpoint
    const fiyatBugün = fiyatlar[0]
    const fiyat5y = fiyatlar[fiyatlar.length - 1]
    const toplamGetiri5y = fiyatBugün != null && fiyat5y != null && fiyat5y !== 0
      ? ((fiyatBugün - fiyat5y) / fiyat5y) * 100
      : null

    return {
      fonKodu: r.fonKodu,
      fonTipi: r.fonTipi,
      fonUnvan: r.fonUnvan,
      altiAylik,
      yillik,
      altiAyPozitif,
      altiAyToplam,
      yillikPozitif,
      yillikToplam,
      toplamGetiri5y,
    }
  }).filter(f => f.altiAyToplam >= 2)

  // Etiketler: "Ara'25→Haz'26" formatında
  function ayEtiketi(tarih: string | null) {
    if (!tarih) return '?'
    const d = new Date(tarih)
    return d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })
  }

  const altiAyEtiketler = checkpointler.slice(0, -1).map((c, i) => {
    const t0 = checkpointler[i + 1]?.tarih
    const t1 = c.tarih
    return `${ayEtiketi(t0)}→${ayEtiketi(t1)}`
  })

  const yillikEtiketler = checkpointler.filter((_, i) => i % 2 === 0).slice(0, -1).map((c, i) => {
    const t0 = checkpointler[(i + 1) * 2]?.tarih
    const t1 = c.tarih
    return `${ayEtiketi(t0)}→${ayEtiketi(t1)}`
  })

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
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
      />
    </div>
  )
}
