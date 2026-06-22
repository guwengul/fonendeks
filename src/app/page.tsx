import { createClient } from '@/lib/supabase/server'
import FonListesi from '@/components/FonListesi'

export const revalidate = 3600

const DONEMLER = [
  { key: '1g',  gun: 1   },
  { key: '1h',  gun: 7   },
  { key: '1a',  gun: 30  },
  { key: '3a',  gun: 90  },
  { key: '6a',  gun: 180 },
  { key: '1y',  gun: 365 },
  { key: '3y',  gun: 1095},
  { key: '5y',  gun: 1825},
]

function hedefTarih(sonTarih: string, gun: number): string {
  const d = new Date(sonTarih)
  d.setDate(d.getDate() - gun)
  return d.toISOString().slice(0, 10)
}

export default async function Home() {
  const supabase = await createClient()

  const { data: sonTarihRow } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih')
    .order('tarih', { ascending: false })
    .limit(1)
    .single()

  const sonTarih = sonTarihRow?.tarih
  if (!sonTarih) return null

  // Her dönem için en yakın mevcut tarihi ayrı sorguyla bul
  const donemTarihler = await Promise.all(
    DONEMLER.map(async d => {
      const hedef = hedefTarih(sonTarih, d.gun)
      const { data } = await supabase
        .from('tefas_fon_verileri')
        .select('tarih')
        .lte('tarih', hedef)
        .order('tarih', { ascending: false })
        .limit(1)
        .single()
      return { ...d, tarih: data?.tarih ?? null }
    })
  )

  // Son tarih + tüm dönem tarihleri için paralel sorgu
  const [sonVeriler, ...donemVerileri] = await Promise.all([
    supabase
      .from('tefas_fon_verileri')
      .select('fonKodu, fonUnvan, fonTipi, fiyat, portfoyBuyukluk, kisiSayisi')
      .eq('tarih', sonTarih)
      .order('portfoyBuyukluk', { ascending: false })
      .limit(5000)
      .then(r => r.data ?? []),
    ...donemTarihler.map(d =>
      d.tarih
        ? supabase
            .from('tefas_fon_verileri')
            .select('fonKodu, fonTipi, fiyat')
            .eq('tarih', d.tarih)
            .limit(5000)
            .then(r => ({ key: d.key, data: r.data ?? [] }))
        : Promise.resolve({ key: d.key, data: [] })
    ),
  ])

  // Dönem fiyatlarını map'e al: key -> {fonKodu-fonTipi -> fiyat}
  const donemMap: Record<string, Record<string, number>> = {}
  for (const dv of donemVerileri) {
    donemMap[dv.key] = {}
    for (const row of dv.data) {
      donemMap[dv.key][`${row.fonKodu}-${row.fonTipi}`] = row.fiyat
    }
  }

  // Getiri hesapla
  const fonlar = sonVeriler.map(f => {
    const getiriler: Record<string, number | null> = {}
    for (const d of DONEMLER) {
      const eskiFiyat = donemMap[d.key]?.[`${f.fonKodu}-${f.fonTipi}`]
      getiriler[d.key] = eskiFiyat && f.fiyat
        ? ((f.fiyat - eskiFiyat) / eskiFiyat) * 100
        : null
    }
    return { ...f, tarih: sonTarih, getiriler }
  })

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Yatırım Fonları</h1>
        <p className="text-slate-400 text-sm mt-1">Son güncelleme: {sonTarih}</p>
      </div>
      <FonListesi fonlar={fonlar} />
    </div>
  )
}
