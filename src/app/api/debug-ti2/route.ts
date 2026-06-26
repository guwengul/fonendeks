import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const fon = new URL(req.url).searchParams.get('fon') ?? 'TI2'
  const supabase = createAdminClient()

  const { data: ilk20 } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih, fiyat')
    .eq('fonKodu', fon).eq('fonTipi', 'YAT')
    .order('tarih', { ascending: true })
    .limit(20)

  const { data: son5 } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih, fiyat')
    .eq('fonKodu', fon).eq('fonTipi', 'YAT')
    .order('tarih', { ascending: false })
    .limit(5)

  return NextResponse.json({ ilk20, son5 })
}
