import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const fon = new URL(req.url).searchParams.get('fon') ?? 'TPP'
  const supabase = createAdminClient()

  const { data: benchRows, error } = await supabase
    .from('tefas_benchmark_fiyatlari')
    .select('tarih, gosterge, deger')
    .order('tarih', { ascending: true })
    .limit(10000)

  const usdRows = (benchRows ?? []).filter(r => r.gosterge === 'USD')
  const son = usdRows[usdRows.length - 1]
  const birYilOnce = usdRows.filter(r => r.tarih <= '2025-06-25').at(-1)

  return NextResponse.json({
    toplam: benchRows?.length,
    usdSatir: usdRows.length,
    sonUSD: son,
    birYilOnceUSD: birYilOnce,
    hesaplama: birYilOnce && son ? ((Number(son.deger) / Number(birYilOnce.deger) - 1) * 100).toFixed(2) + '%' : null,
    error: error?.message,
  })
}
