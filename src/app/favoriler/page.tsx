import { createClient } from '@/lib/supabase/server'
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
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Favorilerim</h1>
        <p className="text-slate-400">Henüz favori fon eklemediniz. Ana sayfada yıldıza tıklayarak ekleyebilirsiniz.</p>
      </div>
    )
  }

  const { fonlar } = await fetchFonlar({ fonKodlari })
  const fonMap = new Map(fonlar.map((f: any) => [`${f.fonKodu}::${f.fonTipi}`, f]))

  const kartlar = (favoriler ?? []).map((fav: any) => {
    const fon = fonMap.get(`${fav.fonKodu}::${fav.fonTipi}`) as any
    const eklemeFiyati = fav.ekleme_fiyati ?? null
    const degisim = eklemeFiyati && fon?.fiyat
      ? ((fon.fiyat - eklemeFiyati) / eklemeFiyati) * 100 : null
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
      portfoyBuyukluk: fon?.portfoyBuyukluk ?? null,
      getiriler: fon?.getiriler ?? {},
    }
  })

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Favorilerim</h1>
      <FavoriKartlar kartlar={kartlar} />
    </div>
  )
}
