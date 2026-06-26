import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { portfoyIslemSil } from '@/lib/auth-actions'
import { PortfoyIslemEkle } from '@/components/PortfoyIslemEkle'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Pozisyon = {
  portfoy_adi: string
  fonKodu: string
  fonTipi: string
  fonUnvan: string | null
  eklemeTarihi: string
  eklemeFiyati: number
  guncelFiyat: number | null
  adet: number
  maliyet: number
  guncelDeger: number | null
  kazanc: number | null
  kazancYuzde: number | null
  islemId: string
}

export default async function PortfoyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/giris')

  const { data: islemler } = await supabase
    .from('tefas_portfoy_islem')
    .select('*')
    .eq('user_id', user.id)
    .order('tarih', { ascending: false })

  if (!islemler?.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Portföyüm</h1>
          <PortfoyIslemEkle />
        </div>
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg mb-2">Portföyünüz boş</p>
          <p className="text-sm">Fon ekleyerek başlayabilirsiniz.</p>
        </div>
      </div>
    )
  }

  const admin = createAdminClient()
  const { data: sonTarihRow } = await admin.from('tefas_fon_verileri')
    .select('tarih').order('tarih', { ascending: false }).limit(1).single()
  const sonTarih = sonTarihRow?.tarih

  const { data: guncelFiyatlar } = await admin.from('tefas_fon_verileri')
    .select('fonKodu, fonTipi, fonUnvan, fiyat')
    .eq('tarih', sonTarih)
    .in('fonKodu', [...new Set(islemler.map(i => i.fonKodu))])

  const fiyatMap = new Map((guncelFiyatlar ?? []).map(r => [`${r.fonKodu}::${r.fonTipi}`, r]))

  const pozisyonlar: Pozisyon[] = islemler.map(i => {
    const g = fiyatMap.get(`${i.fonKodu}::${i.fonTipi}`)
    const maliyet = i.adet * i.fiyat
    const guncelDeger = g?.fiyat ? i.adet * g.fiyat : null
    const kazanc = guncelDeger != null ? guncelDeger - maliyet : null
    const kazancYuzde = kazanc != null && maliyet > 0 ? (kazanc / maliyet) * 100 : null
    return {
      portfoy_adi: i.portfoy_adi ?? 'Ana Portföy',
      fonKodu: i.fonKodu, fonTipi: i.fonTipi,
      fonUnvan: g?.fonUnvan ?? null,
      eklemeTarihi: i.tarih,
      eklemeFiyati: i.fiyat, guncelFiyat: g?.fiyat ?? null,
      adet: i.adet, maliyet, guncelDeger, kazanc, kazancYuzde,
      islemId: i.id,
    }
  })

  const portfoyler = new Map<string, Pozisyon[]>()
  for (const p of pozisyonlar) {
    if (!portfoyler.has(p.portfoy_adi)) portfoyler.set(p.portfoy_adi, [])
    portfoyler.get(p.portfoy_adi)!.push(p)
  }

  const toplamMaliyet = pozisyonlar.reduce((s, p) => s + p.maliyet, 0)
  const toplamGuncel = pozisyonlar.reduce((s, p) => s + (p.guncelDeger ?? p.maliyet), 0)
  const toplamKazanc = toplamGuncel - toplamMaliyet
  const toplamKazancYuzde = toplamMaliyet > 0 ? (toplamKazanc / toplamMaliyet) * 100 : 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Portföyüm</h1>
        <PortfoyIslemEkle />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 mb-1">Toplam Maliyet</p>
          <p className="text-lg font-bold text-slate-900">
            {toplamMaliyet.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 mb-1">Güncel Değer</p>
          <p className="text-lg font-bold text-slate-900">
            {toplamGuncel.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${toplamKazanc >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs text-slate-400 mb-1">Toplam Kazanç</p>
          <p className={`text-lg font-bold ${toplamKazanc >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {toplamKazanc >= 0 ? '+' : ''}{toplamKazanc.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            <span className="text-sm font-medium ml-1">
              ({toplamKazancYuzde >= 0 ? '+' : ''}{toplamKazancYuzde.toFixed(2)}%)
            </span>
          </p>
        </div>
      </div>

      {[...portfoyler.entries()].map(([portfoyAdi, pozlar]) => {
        const ptMaliyet = pozlar.reduce((s, p) => s + p.maliyet, 0)
        const ptGuncel = pozlar.reduce((s, p) => s + (p.guncelDeger ?? p.maliyet), 0)
        const ptKazanc = ptGuncel - ptMaliyet
        const ptKazancYuzde = ptMaliyet > 0 ? (ptKazanc / ptMaliyet) * 100 : 0

        return (
          <div key={portfoyAdi} className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-700">{portfoyAdi}</h2>
              <span className={`text-sm font-medium ${ptKazanc >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {ptKazanc >= 0 ? '+' : ''}{ptKazancYuzde.toFixed(2)}%
              </span>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Fon</th>
                    <th className="text-right px-4 py-3">Adet</th>
                    <th className="text-right px-4 py-3">Alış Fiyatı</th>
                    <th className="text-right px-4 py-3">Güncel Fiyat</th>
                    <th className="text-right px-4 py-3">Maliyet</th>
                    <th className="text-right px-4 py-3">Güncel Değer</th>
                    <th className="text-right px-4 py-3">Kazanç</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pozlar.map(p => {
                    const pozitif = (p.kazancYuzde ?? 0) >= 0
                    return (
                      <tr key={p.islemId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/fon/${p.fonKodu}?tip=${p.fonTipi}`}
                            className="font-mono font-bold text-indigo-600 hover:underline">
                            {p.fonKodu}
                          </Link>
                          {p.fonUnvan && (
                            <p className="text-xs text-slate-400 truncate max-w-[180px]">{p.fonUnvan}</p>
                          )}
                          <p className="text-xs text-slate-300">{p.eklemeTarihi}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {p.adet.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">{p.eklemeFiyati.toFixed(6)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {p.guncelFiyat ? p.guncelFiyat.toFixed(6) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">
                          {p.maliyet.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 font-medium">
                          {p.guncelDeger
                            ? p.guncelDeger.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.kazancYuzde != null && (
                            <span className={`font-semibold ${pozitif ? 'text-emerald-600' : 'text-red-600'}`}>
                              {pozitif ? '+' : ''}{p.kazancYuzde.toFixed(2)}%
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <form action={async () => {
                            'use server'
                            await portfoyIslemSil(p.islemId)
                          }}>
                            <button type="submit"
                              className="text-slate-300 hover:text-red-500 transition-colors text-lg leading-none px-1">
                              ×
                            </button>
                          </form>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
