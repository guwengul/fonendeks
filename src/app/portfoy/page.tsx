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
  const { data: sonTarihRow } = await admin.from('tefas_fon_verileri')
    .select('tarih').order('tarih', { ascending: false }).limit(1).single()
  const sonTarih = sonTarihRow?.tarih

  const fonKodlari = [...new Set((islemler ?? []).map((i: any) => i.fonKodu))]
  const guncelFiyatlar = fonKodlari.length ? (await admin.from('tefas_fon_verileri')
    .select('fonKodu, fonTipi, fonUnvan, fiyat')
    .eq('tarih', sonTarih)
    .in('fonKodu', fonKodlari)).data : []

  const fiyatMap = new Map((guncelFiyatlar ?? []).map((r: any) => [`${r.fonKodu}::${r.fonTipi}`, r]))

  const islemlerZengin = (islemler ?? []).map((i: any) => {
    const g = fiyatMap.get(`${i.fonKodu}::${i.fonTipi}`) as any
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
    }
  })

  return (
    <div className="w-full px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Portföyüm</h1>
      <PortfoyGorunum portfoyler={portfoyListesi} islemler={islemlerZengin} />
      {portfoyListesi.length < 3 && (
        <div className="mt-8 flex justify-center">
          <PortfoyEkleForm portfoyler={portfoyListesi} />
        </div>
      )}
    </div>
  )
}
