import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const fon = new URL(req.url).searchParams.get('fon') ?? 'TI2'
  const supabase = createAdminClient()

  // Tüm fiyatları çek, günlük % değişimi hesapla, en büyük düşüşleri bul
  const rows: { tarih: string; fiyat: number }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('tefas_fon_verileri')
      .select('tarih, fiyat')
      .eq('fonKodu', fon).eq('fonTipi', 'YAT')
      .order('tarih', { ascending: true })
      .range(from, from + 999)
    if (!data?.length) break
    rows.push(...data as any)
    if (data.length < 1000) break
  }

  const degisimler = rows.slice(1).map((r, i) => ({
    tarih: r.tarih,
    fiyat: r.fiyat,
    onceki: rows[i].fiyat,
    pct: ((r.fiyat / rows[i].fiyat) - 1) * 100,
  })).filter(r => Math.abs(r.pct) > 10).sort((a, b) => a.pct - b.pct)

  return NextResponse.json({ toplamSatir: rows.length, buyukDegisimler: degisimler })
}
