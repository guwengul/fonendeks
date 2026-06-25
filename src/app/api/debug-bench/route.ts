import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createAdminClient()

  const { data, count, error } = await supabase
    .from('tefas_benchmark_fiyatlari')
    .select('tarih, gosterge, deger', { count: 'exact' })
    .eq('gosterge', 'USD')
    .order('tarih', { ascending: false })
    .limit(5)

  return NextResponse.json({ toplam_usd: count, son5: data, error: error?.message })
}
