import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PortfoyEkleForm } from '@/components/PortfoyEkleForm'
import { PortfoyGorunum } from '@/components/PortfoyGorunum'

export const dynamic = 'force-dynamic'

export default async function PortfoyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/giris')

  const { data: portfoyler } = await supabase
    .from('tefas_portfoy')
    .select('id, ad, renk')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const { data: islemler } = await supabase
    .from('tefas_portfoy_islem')
    .select('*')
    .eq('user_id', user.id)
    .order('tarih', { ascending: true })

  const portfoyListesi = portfoyler ?? []

  if (!portfoyListesi.length && !islemler?.length) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center mb-1">
          <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 7h18M3 12h18M3 17h7" />
          </svg>
        </div>
        <p className="text-slate-700 font-semibold text-base">Portföyünü oluştur</p>
        <p className="text-slate-400 text-sm text-center max-w-xs">Fonlarını grupla, getirini takip et.</p>
        <div className="mt-2">
          <PortfoyEkleForm portfoyler={[]} bosEkran />
        </div>
      </div>
    )
  }

  const admin = createAdminClient()

  const [sonTarihResult, usdResult] = await Promise.all([
    admin.from('tefas_fon_verileri').select('tarih').order('tarih', { ascending: false }).limit(1).single(),
    admin.from('tefas_benchmark_fiyatlari').select('deger').eq('gosterge', 'USD').order('tarih', { ascending: false }).limit(1).maybeSingle(),
  ])

  const sonTarih = sonTarihResult.data?.tarih
  const usdKuru = usdResult.data ? Number(usdResult.data.deger) : null

  const fonKodlari = [...new Set((islemler ?? []).map((i: any) => i.fonKodu))]
  const islemTarihleri = [...new Set((islemler ?? []).map((i: any) => i.tarih))]

  const [guncelFiyatlarResult, ozetResult, usdTarihResult] = fonKodlari.length ? await Promise.all([
    admin.from('tefas_fon_verileri').select('fonKodu, fonTipi, fonUnvan, fiyat').eq('tarih', sonTarih).in('fonKodu', fonKodlari),
    admin.from('tefas_fon_ozet').select('fonKodu, fonTipi, getiri1g').in('fonKodu', fonKodlari),
    admin.from('tefas_benchmark_fiyatlari').select('tarih, deger').eq('gosterge', 'USD').in('tarih', islemTarihleri),
  ]) : [{ data: [] }, { data: [] }, { data: [] }]

  const fiyatMap = new Map((guncelFiyatlarResult.data ?? []).map((r: any) => [`${r.fonKodu}::${r.fonTipi}`, r]))
  const ozetMap = new Map((ozetResult.data ?? []).map((r: any) => [`${r.fonKodu}::${r.fonTipi}`, r]))
  const usdTarihMap = new Map((usdTarihResult.data ?? []).map((r: any) => [r.tarih, Number(r.deger)]))

  const islemlerZengin = (islemler ?? []).map((i: any) => {
    const g = fiyatMap.get(`${i.fonKodu}::${i.fonTipi}`) as any
    const oz = ozetMap.get(`${i.fonKodu}::${i.fonTipi}`) as any
    return {
      id: i.id,
      portfoy_id: i.portfoy_id ?? '',
      varlik_grubu: i.varlik_grubu ?? 'Diğer',
      fonKodu: i.fonKodu,
      fonTipi: i.fonTipi,
      fonUnvan: g?.fonUnvan ?? null,
      tarih: i.tarih,
      fiyat: Number(i.fiyat),
      adet: Number(i.adet),
      guncelFiyat: g?.fiyat ? Number(g.fiyat) : null,
      getiri1g: oz?.getiri1g != null ? Number(oz.getiri1g) : null,
      usdKuruAlim: usdTarihMap.get(i.tarih) ?? null,
    }
  })

  return (
    <div className="w-full px-3 sm:px-6 py-6 sm:py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Portföyüm</h1>
      <PortfoyGorunum portfoyler={portfoyListesi} islemler={islemlerZengin} usdKuru={usdKuru} />
      {portfoyListesi.length < 3 && (
        <div className="mt-8 flex justify-center">
          <PortfoyEkleForm portfoyler={portfoyListesi} />
        </div>
      )}
    </div>
  )
}
