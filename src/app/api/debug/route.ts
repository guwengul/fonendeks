import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const DONEMLER = [
  { key: '1g', gun: 1 },
  { key: '1a', gun: 30 },
  { key: '1y', gun: 365 },
]

function hedefTarih(sonTarih: string, gun: number) {
  const d = new Date(sonTarih)
  d.setDate(d.getDate() - gun)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: sonTarihRow } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih')
    .order('tarih', { ascending: false })
    .limit(1)
    .single()

  const sonTarih = sonTarihRow?.tarih

  const donemTarihler = await Promise.all(
    DONEMLER.map(async d => {
      const hedef = hedefTarih(sonTarih, d.gun)
      const { data, error } = await supabase
        .from('tefas_fon_verileri')
        .select('tarih')
        .lte('tarih', hedef)
        .order('tarih', { ascending: false })
        .limit(1)
        .single()
      return { key: d.key, hedef, bulunan: data?.tarih ?? null, error: error?.message }
    })
  )

  // TLY icin donem fiyatlari
  const tlyFiyatlari: Record<string, any> = {}
  for (const d of donemTarihler) {
    if (!d.bulunan) continue
    const { data } = await supabase
      .from('tefas_fon_verileri')
      .select('fonKodu, fonTipi, fiyat')
      .eq('tarih', d.bulunan)
      .eq('fonKodu', 'TLY')
    tlyFiyatlari[d.key] = { tarih: d.bulunan, rows: data }
  }

  const { data: tlyNow } = await supabase
    .from('tefas_fon_verileri')
    .select('fonKodu, fonTipi, fiyat')
    .eq('tarih', sonTarih)
    .eq('fonKodu', 'TLY')

  return NextResponse.json({ sonTarih, donemTarihler, tlyNow, tlyFiyatlari })
}
