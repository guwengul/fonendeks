import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchFonlar } from '@/lib/fon-data'
import FonListesi from '@/components/FonListesi'

export const dynamic = 'force-dynamic'

export default async function FavorilerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/giris')

  const { data: favoriler } = await supabase
    .from('tefas_favoriler')
    .select('fonKodu')
    .eq('user_id', user.id)

  const fonKodlari = (favoriler ?? []).map((f: any) => f.fonKodu)

  if (!fonKodlari.length) {
    return (
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Favorilerim</h1>
        <p className="text-slate-400">Henüz favori fon eklemediniz. Ana sayfada yıldıza tıklayarak ekleyebilirsiniz.</p>
      </div>
    )
  }

  const { fonlar, kurucular, fonTurleri } = await fetchFonlar({ fonKodlari })

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Favorilerim</h1>
      <FonListesi fonlar={fonlar} kurucular={kurucular} fonTurleri={fonTurleri} girisYapildi={true} basit={true} />
    </div>
  )
}
