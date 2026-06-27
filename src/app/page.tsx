import { createClient } from '@/lib/supabase/server'
import { fetchFonlar } from '@/lib/fon-data'
import FonListesi from '@/components/FonListesi'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  const { fonlar, kurucular, fonTurleri, sonGuncelleme } = await fetchFonlar()

  return (
    <div className="w-full px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Türkiye Yatırım Fonları Analizi</h1>
        <p className="text-slate-400 text-sm mt-1">TEFAS verilerine göre güncellendi: {sonGuncelleme}</p>
      </div>
      <FonListesi fonlar={fonlar} kurucular={kurucular} fonTurleri={fonTurleri} girisYapildi={!!user} />
    </div>
  )
}
