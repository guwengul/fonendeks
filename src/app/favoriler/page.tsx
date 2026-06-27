import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { fetchFonlar } from '@/lib/fon-data'
import { FavoriKartlar } from '@/components/FavoriKartlar'

export const dynamic = 'force-dynamic'

export default async function FavorilerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/giris')

  const { data: favoriler } = await supabase
    .from('tefas_favoriler')
    .select('fonKodu, fonTipi, ekleme_fiyati, ekleme_tarihi')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const fonKodlari = (favoriler ?? []).map((f: any) => f.fonKodu)

  if (!fonKodlari.length) {
    return (
      <div className="w-full px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Favorilerim</h1>
        <p className="text-slate-400">Henüz favori fon eklemediniz. Ana sayfada yıldıza tıklayarak ekleyebilirsiniz.</p>
      </div>
    )
  }

  const { fonlar } = await fetchFonlar({ fonKodlari })
  const fonMap = new Map(fonlar.map((f: any) => [`${f.fonKodu}::${f.fonTipi}`, f]))

  // 1 ay önceki yatırımcı sayılarını çek
  const admin = createAdminClient()
  const sonTarih: string = (fonlar[0] as any)?.tarih ?? ''
  const birAyOnce = sonTarih ? (() => {
    const d = new Date(sonTarih); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10)
  })() : ''

  const kisiEskiMap = new Map<string, number>()
  const portfoyEskiMap = new Map<string, number>()
  if (birAyOnce && fonKodlari.length) {
    const { data: eskiVeriler } = await admin
      .from('tefas_fon_verileri')
      .select('fonKodu, fonTipi, kisiSayisi, portfoyBuyukluk')
      .in('fonKodu', fonKodlari)
      .lte('tarih', birAyOnce)
      .order('tarih', { ascending: false })

    const goruldu = new Set<string>()
    for (const r of eskiVeriler ?? []) {
      const key = `${r.fonKodu}::${r.fonTipi}`
      if (!goruldu.has(key)) {
        if (r.kisiSayisi != null) kisiEskiMap.set(key, r.kisiSayisi)
        if (r.portfoyBuyukluk != null) portfoyEskiMap.set(key, Number(r.portfoyBuyukluk))
        goruldu.add(key)
      }
    }
  }

  const kartlar = (favoriler ?? []).map((fav: any) => {
    const key = `${fav.fonKodu}::${fav.fonTipi}`
    const fon = fonMap.get(key) as any
    const eklemeFiyati = fav.ekleme_fiyati ?? null
    const degisim = eklemeFiyati && fon?.fiyat
      ? ((fon.fiyat - eklemeFiyati) / eklemeFiyati) * 100 : null
    const kisiSon = fon?.kisiSayisi ?? null
    const kisiEski = kisiEskiMap.get(key) ?? null
    const kisiDegisim = kisiSon != null && kisiEski != null ? kisiSon - kisiEski : null
    const portfoySon = fon?.portfoyBuyukluk ? Number(fon.portfoyBuyukluk) : null
    const portfoyEski = portfoyEskiMap.get(key) ?? null
    const portfoyDegisim = portfoySon != null && portfoyEski != null ? portfoySon - portfoyEski : null

    return {
      fonKodu: fav.fonKodu,
      fonTipi: fav.fonTipi,
      fonUnvan: fon?.fonUnvan ?? null,
      fiyat: fon?.fiyat ?? null,
      eklemeFiyati,
      eklemeTarihi: fav.ekleme_tarihi ?? null,
      degisim,
      riskDegeri: fon?.riskDegeri ?? null,
      yonetimUcreti: fon?.yonetimUcreti ?? null,
      stopaj: fon?.stopaj ?? null,
      portfoyBuyukluk: portfoySon,
      portfoyDegisim1a: portfoyDegisim,
      kisiSayisi: kisiSon,
      kisiDegisim1a: kisiDegisim,
      getiriler: fon?.getiriler ?? {},
    }
  })

  return (
    <div className="w-full px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Favorilerim</h1>
      <FavoriKartlar kartlar={kartlar} />
    </div>
  )
}
