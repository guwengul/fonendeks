import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
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
    <main className="max-w-7xl mx-auto w-full px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Fonendeks</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Son güncelleme: {sonTarih ?? '-'}
        </p>
      </div>
      <FonListesi fonlar={fonlar ?? []} />
    </main>
  )
}
