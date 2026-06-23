import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const TROY_OUNCE_GRAM = 31.1034768

// Yahoo Finance chart API (key gerektirmez)
async function yahoo(symbol: string, range = '5y'): Promise<Map<string, number>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
  const d = await r.json()
  const res = d?.chart?.result?.[0]
  const ts: number[] = res?.timestamp ?? []
  const close: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? []
  const map = new Map<string, number>()
  for (let i = 0; i < ts.length; i++) {
    const v = close[i]
    if (v == null) continue
    const tarih = new Date(ts[i] * 1000).toISOString().slice(0, 10)
    map.set(tarih, v)
  }
  return map
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [usd, eur, bist100, bist30, altinOns] = await Promise.all([
      yahoo('TRY=X'),       // USD/TRY
      yahoo('EURTRY=X'),    // EUR/TRY
      yahoo('XU100.IS'),    // BIST100
      yahoo('XU030.IS'),    // BIST30
      yahoo('GC=F'),        // Altın ons (USD)
    ])

    // Gram altın (TRY) = ons(USD)/31.1035 × USD/TRY (aynı tarih)
    const gramAltin = new Map<string, number>()
    for (const [tarih, ons] of altinOns) {
      const kur = usd.get(tarih)
      if (kur) gramAltin.set(tarih, (ons / TROY_OUNCE_GRAM) * kur)
    }

    const seriler: [string, Map<string, number>][] = [
      ['USD', usd],
      ['EUR', eur],
      ['BIST100', bist100],
      ['BIST30', bist30],
      ['GRAM_ALTIN', gramAltin],
    ]

    const rows: { tarih: string; gosterge: string; deger: number }[] = []
    for (const [gosterge, map] of seriler) {
      for (const [tarih, deger] of map) {
        rows.push({ tarih, gosterge, deger: Number(deger.toFixed(6)) })
      }
    }

    const supabase = createAdminClient()
    let yazilan = 0
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await supabase
        .from('benchmark_fiyatlari')
        .upsert(rows.slice(i, i + 1000), { onConflict: 'tarih,gosterge' })
      if (error) return NextResponse.json({ ok: false, error: error.message, yazilan }, { status: 500 })
      yazilan += Math.min(1000, rows.length - i)
    }

    const ozet = Object.fromEntries(seriler.map(([g, m]) => [g, m.size]))
    return NextResponse.json({ ok: true, yazilan, ozet })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
