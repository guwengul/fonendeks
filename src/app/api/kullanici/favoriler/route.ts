import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data: favoriler } = await supabase
    .from('tefas_favoriler')
    .select('fonKodu, fonTipi, ekleme_fiyati, ekleme_tarihi')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (!favoriler?.length) return NextResponse.json([])

  const admin = createAdminClient()
  const { data: sonTarihRow } = await admin.from('tefas_fon_verileri')
    .select('tarih').order('tarih', { ascending: false }).limit(1).single()
  const sonTarih = sonTarihRow?.tarih
  if (!sonTarih) return NextResponse.json([])

  const { data: guncel } = await admin
    .from('tefas_fon_verileri')
    .select('fonKodu, fonTipi, fonUnvan, fiyat')
    .eq('tarih', sonTarih)
    .in('fonKodu', favoriler.map(f => f.fonKodu))

  const fiyatMap = new Map((guncel ?? []).map(r => [`${r.fonKodu}-${r.fonTipi}`, r]))

  return NextResponse.json(favoriler.map(f => {
    const g = fiyatMap.get(`${f.fonKodu}-${f.fonTipi}`)
    const degisim = f.ekleme_fiyati && g?.fiyat
      ? ((g.fiyat - f.ekleme_fiyati) / f.ekleme_fiyati) * 100 : null
    return { fonKodu: f.fonKodu, fonTipi: f.fonTipi, fonUnvan: g?.fonUnvan ?? null, eklemeFiyati: f.ekleme_fiyati, guncelFiyat: g?.fiyat ?? null, degisim }
  }))
}
