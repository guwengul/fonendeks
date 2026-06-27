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
    .select('id, ad')
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
      <div className="w-full px-4 sm:px-6 py-8 flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-slate-400 text-sm">Henüz portföy oluşturmadınız.</p>
        <PortfoyEkleForm portfoyler={[]} />
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
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Portföyüm</h1>
        <PortfoyEkleForm portfoyler={portfoyListesi} />
      </div>
      <PortfoyGorunum portfoyler={portfoyListesi} islemler={islemlerZengin} />
    </div>
  )
}
