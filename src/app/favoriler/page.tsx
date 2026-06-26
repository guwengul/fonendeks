import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FavoriKaldir } from '@/components/FavoriKaldir'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Favorilerim' }

export default async function FavorilerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/giris')

  const { data: favoriler } = await supabase
    .from('tefas_favoriler')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!favoriler || favoriler.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Favorilerim</h1>
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">Henüz favori fon eklemediniz.</p>
          <Link href="/" className="text-indigo-600 hover:underline text-sm">Fonları incele →</Link>
        </div>
      </div>
    )
  }

  const admin = createAdminClient()
  const { data: sonTarihRow } = await admin.from('tefas_fon_verileri')
    .select('tarih').order('tarih', { ascending: false }).limit(1).single()
  const sonTarih = sonTarihRow?.tarih

  // Güncel fiyatları çek
  const kodlar = favoriler.map(f => f.fonKodu)
  const { data: guncelFiyatlar } = sonTarih ? await admin
    .from('tefas_fon_verileri')
    .select('fonKodu, fonTipi, fonUnvan, fiyat')
    .eq('tarih', sonTarih)
    .in('fonKodu', kodlar) : { data: [] }

  const fiyatMap = new Map(
    (guncelFiyatlar ?? []).map(r => [`${r.fonKodu}-${r.fonTipi}`, r])
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Favorilerim</h1>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Fon</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Eklendiğindeki</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Güncel</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Değişim</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Eklenme</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {favoriler.map((f, i) => {
              const guncel = fiyatMap.get(`${f.fonKodu}-${f.fonTipi}`)
              const degisim = f.ekleme_fiyati && guncel?.fiyat
                ? ((guncel.fiyat - f.ekleme_fiyati) / f.ekleme_fiyati) * 100
                : null
              const degisimRenk = degisim == null ? 'text-slate-400'
                : degisim > 0 ? 'text-emerald-600 font-semibold'
                : degisim < 0 ? 'text-red-600 font-semibold'
                : 'text-slate-500'
              return (
                <tr key={f.id} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    <Link href={`/fon/${f.fonKodu}?tip=${f.fonTipi}`}
                      className="font-mono font-semibold text-indigo-600 hover:text-indigo-800">
                      {f.fonKodu}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                      {guncel?.fonUnvan ?? ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {f.ekleme_fiyati ? f.ekleme_fiyati.toFixed(4) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {guncel?.fiyat ? guncel.fiyat.toFixed(4) : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${degisimRenk}`}>
                    {degisim != null ? `${degisim >= 0 ? '+' : ''}${degisim.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 text-xs">
                    {new Date(f.ekleme_tarihi).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-2 py-3">
                    <FavoriKaldir fonKodu={f.fonKodu} fonTipi={f.fonTipi} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
