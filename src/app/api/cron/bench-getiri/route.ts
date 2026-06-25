import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const GOSTERGELER = ['USD', 'EUR', 'BIST100', 'BIST30', 'GRAM_ALTIN'] as const

function donemBaslangic(sonTarih: string, donem: string): string {
  const d = new Date(sonTarih)
  switch (donem) {
    case '1h':  d.setDate(d.getDate() - 7);   break
    case '1a':  d.setMonth(d.getMonth() - 1);  break
    case '3a':  d.setMonth(d.getMonth() - 3);  break
    case '6a':  d.setMonth(d.getMonth() - 6);  break
    case 'yb':  return `${sonTarih.slice(0, 4)}-01-01`
    case '1y':  d.setMonth(d.getMonth() - 12); break
    case '3y':  d.setMonth(d.getMonth() - 36); break
    case '5y':  d.setMonth(d.getMonth() - 60); break
  }
  return d.toISOString().slice(0, 10)
}

// Belirli bir tarihteki (veya öncesindeki) son benchmark değerini çeker
async function degerAt(supabase: ReturnType<typeof createAdminClient>, gosterge: string, tarih: string) {
  const { data } = await supabase
    .from('tefas_benchmark_fiyatlari')
    .select('deger')
    .eq('gosterge', gosterge)
    .lte('tarih', tarih)
    .order('tarih', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? Number(data.deger) : null
}

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // En son benchmark tarihi
  const { data: sonRow } = await supabase
    .from('tefas_benchmark_fiyatlari')
    .select('tarih')
    .order('tarih', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sonTarih = sonRow?.tarih
  if (!sonTarih) return NextResponse.json({ error: 'benchmark verisi yok' }, { status: 500 })

  const DONEMLER = ['1h', '1a', '3a', '6a', 'yb', '1y', '3y', '5y'] as const
  const basTarihler = Object.fromEntries(DONEMLER.map(d => [d, donemBaslangic(sonTarih, d)]))

  const rows = await Promise.all(GOSTERGELER.map(async (g) => {
    // Son değer + her dönem başı değeri paralel çek
    const [sonDeger, ...ilkDegerler] = await Promise.all([
      degerAt(supabase, g, sonTarih),
      ...DONEMLER.map(d => degerAt(supabase, g, basTarihler[d])),
    ])

    function getiri(ilk: number | null): number | null {
      if (!ilk || !sonDeger || ilk === 0) return null
      return +((sonDeger / ilk - 1) * 100).toFixed(2)
    }

    const [g1h, g1a, g3a, g6a, gyb, g1y, g3y, g5y] = ilkDegerler.map(getiri)

    return {
      gosterge: g,
      son_tarih: sonTarih,
      son_deger: sonDeger,
      getiri1h: g1h, getiri1a: g1a, getiri3a: g3a, getiri6a: g6a,
      getiriYb: gyb, getiri1y: g1y, getiri3y: g3y, getiri5y: g5y,
    }
  }))

  const { error } = await supabase
    .from('tefas_benchmark_getiri')
    .upsert(rows, { onConflict: 'gosterge' })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, sonTarih, gostergeler: rows.map(r => ({ g: r.gosterge, son: r.son_deger, g1y: r.getiri1y })) })
}
