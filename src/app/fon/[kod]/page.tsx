import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FonGrafik from '@/components/FonGrafik'

export const revalidate = 3600

export default async function FonDetay({
  params,
  searchParams,
}: {
  params: Promise<{ kod: string }>
  searchParams: Promise<{ tip?: string }>
}) {
  const { kod } = await params
  const { tip = 'YAT' } = await searchParams
  const fonKodu = kod.toUpperCase()

  const supabase = await createClient()

  const { data: gecmis } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih, fiyat, portfoyBuyukluk, kisiSayisi, tedPaySayisi')
    .eq('fonKodu', fonKodu)
    .eq('fonTipi', tip)
    .order('tarih', { ascending: true })

  if (!gecmis || gecmis.length === 0) notFound()

  const son = gecmis[gecmis.length - 1]
  const ilk = gecmis[0]

  const { data: info } = await supabase
    .from('tefas_fon_verileri')
    .select('fonUnvan, fonTipi')
    .eq('fonKodu', fonKodu)
    .eq('fonTipi', tip)
    .limit(1)
    .single()

  const toplamGetiri = son.fiyat && ilk.fiyat
    ? (((son.fiyat - ilk.fiyat) / ilk.fiyat) * 100).toFixed(2)
    : null

  return (
    <main className="max-w-5xl mx-auto w-full px-4 py-8">
      <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm mb-6 inline-block">
        ← Tüm fonlar
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white font-mono">{fonKodu}</h1>
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
            {info?.fonTipi}
          </span>
        </div>
        <p className="text-zinc-400 mt-1">{info?.fonUnvan}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <p className="text-zinc-500 text-xs mb-1">Son Fiyat</p>
          <p className="text-white font-mono font-semibold">{son.fiyat?.toFixed(6) ?? '-'}</p>
          <p className="text-zinc-500 text-xs mt-1">{son.tarih}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <p className="text-zinc-500 text-xs mb-1">Toplam Getiri</p>
          <p className={`font-semibold text-lg ${toplamGetiri && +toplamGetiri >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {toplamGetiri ? `%${toplamGetiri}` : '-'}
          </p>
          <p className="text-zinc-500 text-xs mt-1">{ilk.tarih} → {son.tarih}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <p className="text-zinc-500 text-xs mb-1">Portföy Büyüklüğü</p>
          <p className="text-white font-semibold">
            {son.portfoyBuyukluk
              ? (son.portfoyBuyukluk / 1_000_000).toFixed(1) + ' Mn ₺'
              : '-'}
          </p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <p className="text-zinc-500 text-xs mb-1">Yatırımcı Sayısı</p>
          <p className="text-white font-semibold">
            {son.kisiSayisi?.toLocaleString('tr-TR') ?? '-'}
          </p>
        </div>
      </div>

      <FonGrafik data={gecmis} />
    </main>
  )
}
