import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const admin = createAdminClient()
  const { data } = await admin.from('tefas_fon_ozet')
    .select('fonKodu, fonTipi, fonUnvan, fiyat, tarih')
    .or(`fonKodu.ilike.%${q}%,fonUnvan.ilike.%${q}%`)
    .order('portfoyBuyukluk', { ascending: false, nullsFirst: false })
    .limit(8)

  return NextResponse.json(data ?? [])
}
