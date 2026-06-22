import { createAdminClient } from '@/lib/supabase/admin'
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

  const supabase = createAdminClient()

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

  const TIP_RENK: Record<string, string> = {
    YAT: 'bg-indigo-50 text-indigo-600',
    EMK: 'bg-emerald-50 text-emerald-600',
    BYF: 'bg-purple-50 text-purple-600',
  }

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
      <Link href="/" className="text-slate-400 hover:text-indigo-600 text-sm mb-6 inline-block transition-colors">
        ← Tüm fonlar
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 font-mono">{fonKodu}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIP_RENK[info?.fonTipi ?? ''] ?? ''}`}>
            {info?.fonTipi}
          </span>
        </div>
        <p className="text-slate-500 mt-1">{info?.fonUnvan}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Son Fiyat</p>
          <p className="text-slate-900 font-mono font-semibold">{son.fiyat?.toFixed(6) ?? '-'}</p>
          <p className="text-slate-400 text-xs mt-1">{son.tarih}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Toplam Getiri</p>
          <p className={`font-semibold text-lg ${toplamGetiri && +toplamGetiri >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {toplamGetiri ? `%${toplamGetiri}` : '-'}
          </p>
          <p className="text-slate-400 text-xs mt-1">{ilk.tarih} → {son.tarih}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Portföy Büyüklüğü</p>
          <p className="text-slate-900 font-semibold">
            {son.portfoyBuyukluk
              ? (son.portfoyBuyukluk / 1_000_000).toFixed(1) + ' Mn ₺'
              : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Yatırımcı Sayısı</p>
          <p className="text-slate-900 font-semibold">
            {son.kisiSayisi?.toLocaleString('tr-TR') ?? '-'}
          </p>
        </div>
      </div>

      <FonGrafik data={gecmis} />
    </div>
  )
}
