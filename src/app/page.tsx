import { createAdminClient } from '@/lib/supabase/admin'
import FonListesi from '@/components/FonListesi'

export const dynamic = 'force-dynamic'

const DONEMLER = [
  { key: '1g',  gun: 1,  ay: 0,  sonraki: false },
  { key: '1h',  gun: 7,  ay: 0,  sonraki: false },
  { key: '1a',  gun: 0,  ay: 1,  sonraki: true  },
  { key: '3a',  gun: 0,  ay: 3,  sonraki: true  },
  { key: '6a',  gun: 0,  ay: 6,  sonraki: true  },
  { key: '1y',  gun: 0,  ay: 12, sonraki: true  },
  { key: '3y',  gun: 0,  ay: 36, sonraki: true  },
  { key: '5y',  gun: 0,  ay: 60, sonraki: true  },
]

function hedefTarih(sonTarih: string, gun: number, ay: number): string {
  const d = new Date(sonTarih)
  if (ay > 0) {
    d.setMonth(d.getMonth() - ay)
  } else {
    d.setDate(d.getDate() - gun)
  }
  return d.toISOString().slice(0, 10)
}

function enYakinTarih(tarihler: string[], hedef: string, sonraki: boolean): string | null {
  if (sonraki) {
    // Aylık+: hedef tarihte veya sonrasındaki ilk işlem günü (TEFAS davranışı)
    let result: string | null = null
    for (const t of tarihler) {
      if (t >= hedef) result = t
      else break
    }
    return result ?? tarihler[tarihler.length - 1] ?? null
  } else {
    // Günlük/haftalık: hedef tarihte veya öncesindeki son işlem günü
    for (const t of tarihler) {
      if (t <= hedef) return t
    }
    return null
  }
}

export default async function Home() {
  const supabase = createAdminClient()

  // Son tarihi bul
  const { data: sonTarihRow } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih')
    .order('tarih', { ascending: false })
    .limit(1)
    .single()

  const sonTarih = sonTarihRow?.tarih
  if (!sonTarih) return null

  // Tüm mevcut tarihleri paginated çek (1250+ kayıt, 1000 limit aşıyor)
  const tarihler: string[] = []
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
      tarihler.push(...data.map(r => r.tarih))
      if (data.length < 1000) break
      from += 1000
    }
  }

  // Her dönem için hedef tarihi bul
  const donemTarihler = DONEMLER.map(d => ({
    ...d,
    tarih: enYakinTarih(tarihler, hedefTarih(sonTarih, d.gun, d.ay), d.sonraki),
  }))

  // Benzersiz tarihler (tekrar eden dönem tarihleri olabilir)
  const benzersizTarihler = [...new Set(donemTarihler.map(d => d.tarih).filter(Boolean) as string[])]

  // Supabase max 1000 satır döndürüyor, paginate ediyoruz
  async function fetchAllForDate(tarih: string) {
    const rows: { fonKodu: string; fonTipi: string; fiyat: number }[] = []
    let from = 0
    while (true) {
      const { data } = await supabase
        .from('tefas_fon_verileri')
        .select('fonKodu, fonTipi, fiyat')
        .eq('tarih', tarih)
        .range(from, from + 999)
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
    return rows
  }

  // Son tarih için ana liste (paginated)
  const sonVerilerRows: { fonKodu: string; fonUnvan: string; fonTipi: string; fiyat: number; portfoyBuyukluk: number; kisiSayisi: number; created_at: string }[] = []
  {
    let from = 0
    while (true) {
      const { data } = await supabase
        .from('tefas_fon_verileri')
        .select('fonKodu, fonUnvan, fonTipi, fiyat, portfoyBuyukluk, kisiSayisi, created_at')
        .eq('tarih', sonTarih)
        .order('portfoyBuyukluk', { ascending: false })
        .range(from, from + 999)
      if (!data || data.length === 0) break
      sonVerilerRows.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
  }

  // tarih -> {fonKodu-fonTipi -> fiyat} map'i
  const tarihFiyatMap: Record<string, Record<string, number>> = {}
  await Promise.all(
    benzersizTarihler.map(async tarih => {
      const rows = await fetchAllForDate(tarih)
      tarihFiyatMap[tarih] = {}
      for (const row of rows) {
        tarihFiyatMap[tarih][`${row.fonKodu}-${row.fonTipi}`] = row.fiyat
      }
    })
  )

  const tumFonlar = sonVerilerRows

  // Son güncelleme saati
  const sonGuncelleme = tumFonlar[0]?.created_at
    ? new Date(tumFonlar[0].created_at).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : sonTarih

  // Getiri hesapla
  const fonlar = tumFonlar.map(f => {
    const getiriler: Record<string, number | null> = {}
    for (const d of donemTarihler) {
      if (!d.tarih) { getiriler[d.key] = null; continue }
      const eskiFiyat = tarihFiyatMap[d.tarih]?.[`${f.fonKodu}-${f.fonTipi}`]
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
        <p className="text-slate-400 text-sm mt-1">Son güncelleme: {sonGuncelleme}</p>
      </div>
      <FonListesi fonlar={fonlar} />
    </div>
  )
}
