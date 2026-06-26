import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const fon = new URL(req.url).searchParams.get('fon') ?? 'TI2'
  const supabase = createAdminClient()

  // Bölünme etrafındaki 5 gün öncesi ve sonrası
  const { data: etraf } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih, fiyat')
    .eq('fonKodu', fon).eq('fonTipi', 'YAT')
    .gte('tarih', '2025-01-13')
    .lte('tarih', '2025-01-27')
    .order('tarih', { ascending: true })

  // Ozetteki getiri5y — TEFAS'ın hesapladığı
  const { data: ozet } = await supabase
    .from('tefas_fon_ozet')
    .select('getiri5y, getiri1y, getiri3y, fiyat, tarih')
    .eq('fonKodu', fon).eq('fonTipi', 'YAT')
    .maybeSingle()

  // KAP linki
  const { data: meta } = await supabase
    .from('tefas_fon_meta')
    .select('kapLink')
    .eq('fonKodu', fon)
    .maybeSingle()

  // Bölünme oranı hesabı: onceki / sonraki
  const rows = etraf ?? []
  const splitIdx = rows.findIndex(r => r.fiyat < 1)
  const bolunmeHesabi = splitIdx > 0 ? {
    oncesi: rows[splitIdx - 1],
    sonrasi: rows[splitIdx],
    oran: rows[splitIdx - 1].fiyat / rows[splitIdx].fiyat,
    en_yakin_yuvarlak: [100, 500, 1000, 5000, 10000].map(n => ({
      n,
      fark_pct: Math.abs(n - rows[splitIdx - 1].fiyat / rows[splitIdx].fiyat) / n * 100
    })).sort((a, b) => a.fark_pct - b.fark_pct)[0]
  } : null

  return NextResponse.json({ etraf, ozet, kapLink: meta?.kapLink, bolunmeHesabi })
}
