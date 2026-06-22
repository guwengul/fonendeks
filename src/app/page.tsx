import { createClient } from '@/lib/supabase/server'
import FonListesi from '@/components/FonListesi'

export const revalidate = 3600

export default async function Home() {
  const supabase = await createClient()

  const { data: sonTarihRow } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih')
    .order('tarih', { ascending: false })
    .limit(1)
    .single()

  const sonTarih = sonTarihRow?.tarih

  const { data: fonlar } = await supabase
    .from('tefas_fon_verileri')
    .select('fonKodu, fonUnvan, fonTipi, fiyat, portfoyBuyukluk, kisiSayisi, tarih')
    .eq('tarih', sonTarih)
    .order('portfoyBuyukluk', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Yatırım Fonları</h1>
        <p className="text-slate-400 text-sm mt-1">
          Son güncelleme: {sonTarih ?? '-'}
        </p>
      </div>
      <FonListesi fonlar={fonlar ?? []} />
    </div>
  )
}
