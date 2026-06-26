import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PortfoyIslemSil } from '@/components/PortfoyIslemSil'
import { PortfoyIslemEkle } from '@/components/PortfoyIslemEkle'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Portföyüm' }

export default async function PortfoyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/giris')

  const { data: islemler } = await supabase
    .from('tefas_portfoy_islem')
    .select('*')
    .eq('user_id', user.id)
    .order('tarih', { ascending: false })

  const admin = createAdminClient()
  const { data: sonTarihRow } = await admin.from('tefas_fon_verileri')
    .select('tarih').order('tarih', { ascending: false }).limit(1).single()
  const sonTarih = sonTarihRow?.tarih

  // Net pozisyon hesapla
  const pozisyonlar: Record<string, { fonKodu: string; fonTipi: string; adet: number; maliyetToplam: number }> = {}
  for (const i of (islemler ?? [])) {
    const k = `${i.fonKodu}-${i.fonTipi}`
    if (!pozisyonlar[k]) pozisyonlar[k] = { fonKodu: i.fonKodu, fonTipi: i.fonTipi, adet: 0, maliyetToplam: 0 }
    if (i.islem_tipi === 'AL') {
      pozisyonlar[k].adet += Number(i.adet)
      pozisyonlar[k].maliyetToplam += Number(i.adet) * Number(i.fiyat)
    } else {
      pozisyonlar[k].adet -= Number(i.adet)
      pozisyonlar[k].maliyetToplam -= Number(i.adet) * Number(i.fiyat)
    }
  }
  const aktifPozisyonlar = Object.values(pozisyonlar).filter(p => p.adet > 0.0001)

  // Güncel fiyatlar
  const kodlar = [...new Set(aktifPozisyonlar.map(p => p.fonKodu))]
  const { data: guncelFiyatlar } = kodlar.length && sonTarih ? await admin
    .from('tefas_fon_verileri')
    .select('fonKodu, fonTipi, fonUnvan, fiyat')
    .eq('tarih', sonTarih)
    .in('fonKodu', kodlar) : { data: [] }

  const fiyatMap = new Map(
    (guncelFiyatlar ?? []).map(r => [`${r.fonKodu}-${r.fonTipi}`, r])
  )

  let toplamMaliyet = 0, toplamGuncelDeger = 0
  const pozDetay = aktifPozisyonlar.map(p => {
    const guncel = fiyatMap.get(`${p.fonKodu}-${p.fonTipi}`)
    const ortalamaMaliyet = p.adet > 0 ? p.maliyetToplam / p.adet : 0
    const guncelDeger = guncel?.fiyat ? p.adet * guncel.fiyat : null
    const kazanc = guncelDeger != null ? guncelDeger - p.maliyetToplam : null
    const kazancYuzde = kazanc != null && p.maliyetToplam > 0 ? (kazanc / p.maliyetToplam) * 100 : null
    toplamMaliyet += p.maliyetToplam
    if (guncelDeger) toplamGuncelDeger += guncelDeger
    return { ...p, guncel, ortalamaMaliyet, guncelDeger, kazanc, kazancYuzde }
  })

  const toplamKazanc = toplamGuncelDeger - toplamMaliyet
  const toplamKazancYuzde = toplamMaliyet > 0 ? (toplamKazanc / toplamMaliyet) * 100 : 0

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Portföyüm</h1>
        <p className="text-slate-400 text-sm">{sonTarih} itibarıyla</p>
      </div>

      {/* Özet kartları */}
      {aktifPozisyonlar.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 mb-1">Toplam Maliyet</p>
            <p className="text-lg font-bold text-slate-800">{toplamMaliyet.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 mb-1">Güncel Değer</p>
            <p className="text-lg font-bold text-slate-800">{toplamGuncelDeger.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</p>
          </div>
          <div className={`bg-white rounded-xl border p-4 col-span-2 sm:col-span-1 ${toplamKazanc >= 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
            <p className="text-xs text-slate-400 mb-1">Kazanç / Kayıp</p>
            <p className={`text-lg font-bold ${toplamKazanc >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {toplamKazanc >= 0 ? '+' : ''}{toplamKazanc.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
              <span className="text-sm font-medium ml-1">({toplamKazancYuzde >= 0 ? '+' : ''}{toplamKazancYuzde.toFixed(2)}%)</span>
            </p>
          </div>
        </div>
      )}

      {/* Aktif pozisyonlar */}
      {pozDetay.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-700 mb-3">Pozisyonlar</h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Fon</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Adet</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Ort. Maliyet</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Güncel Fiyat</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Değer</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Kazanç</th>
                </tr>
              </thead>
              <tbody>
                {pozDetay.map((p, i) => (
                  <tr key={`${p.fonKodu}-${p.fonTipi}`} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/fon/${p.fonKodu}?tip=${p.fonTipi}`}
                        className="font-mono font-semibold text-indigo-600 hover:text-indigo-800">
                        {p.fonKodu}
                      </Link>
                      <p className="text-xs text-slate-400 truncate max-w-[180px]">{p.guncel?.fonUnvan ?? ''}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-700">{p.adet.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-500">{p.ortalamaMaliyet.toFixed(4)}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-700">{p.guncel?.fiyat?.toFixed(4) ?? '—'}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-700">{p.guncelDeger?.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) ?? '—'}</td>
                    <td className={`px-3 py-3 text-right font-mono font-semibold ${(p.kazancYuzde ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {p.kazancYuzde != null ? `${p.kazancYuzde >= 0 ? '+' : ''}${p.kazancYuzde.toFixed(2)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* İşlem ekle */}
      <PortfoyIslemEkle />

      {/* İşlem geçmişi */}
      {(islemler ?? []).length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-700 mb-3">İşlem Geçmişi</h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Tarih</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Fon</th>
                  <th className="px-3 py-3 text-center font-semibold text-slate-600">İşlem</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Adet</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Fiyat</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Tutar</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {islemler!.map((i, idx) => (
                  <tr key={i.id} className={`border-b border-slate-100 hover:bg-slate-50 ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{new Date(i.tarih).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/fon/${i.fonKodu}?tip=${i.fonTipi}`} className="font-mono font-semibold text-indigo-600 hover:text-indigo-800">{i.fonKodu}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${i.islem_tipi === 'AL' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {i.islem_tipi}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{Number(i.adet).toLocaleString('tr-TR', { maximumFractionDigits: 4 })}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{Number(i.fiyat).toFixed(4)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{(Number(i.adet) * Number(i.fiyat)).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-2.5"><PortfoyIslemSil id={i.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(islemler ?? []).length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p className="mb-2">Henüz işlem girmediniz.</p>
          <p className="text-sm">Aşağıdan fon alım/satım işlemi ekleyin.</p>
        </div>
      )}
    </div>
  )
}
