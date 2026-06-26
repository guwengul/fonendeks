import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const kod = searchParams.get('kod')
  const tip = searchParams.get('tip') ?? 'YAT'
  const tarih = searchParams.get('tarih')
  if (!kod || !tarih) return NextResponse.json({ fiyat: null })

  const admin = createAdminClient()
  const { data } = await admin.from('tefas_fon_verileri')
    .select('fiyat, tarih')
    .eq('fonKodu', kod)
    .eq('fonTipi', tip)
    .lte('tarih', tarih)
    .order('tarih', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ fiyat: data?.fiyat ?? null, tarih: data?.tarih ?? null })
}
