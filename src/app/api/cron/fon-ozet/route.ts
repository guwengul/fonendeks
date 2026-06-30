import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const DONEMLER = [
  { key: '1g', gun: 1, ay: 0, sonraki: false },
  { key: '1h', gun: 7, ay: 0, sonraki: false },
  { key: '1a', gun: 0, ay: 1, sonraki: true },
  { key: '3a', gun: 0, ay: 3, sonraki: true },
  { key: '6a', gun: 0, ay: 6, sonraki: true },
  { key: 'yb', gun: 0, ay: 0, sonraki: true, ybasi: true }, // yılbaşından beri
  { key: '1y', gun: 0, ay: 12, sonraki: true },
  { key: '3y', gun: 0, ay: 36, sonraki: true },
  { key: '5y', gun: 0, ay: 60, sonraki: true },
] as const

function hedefTarih(sonTarih: string, gun: number, ay: number): string {
  const d = new Date(sonTarih)
  if (ay > 0) d.setMonth(d.getMonth() - ay)
  else d.setDate(d.getDate() - gun)
  return d.toISOString().slice(0, 10)
}

function enYakinTarih(tarihler: string[], hedef: string, sonraki: boolean): string | null {
  if (sonraki) {
    let result: string | null = null
    for (const t of tarihler) { if (t >= hedef) result = t; else break }
    return result ?? tarihler[tarihler.length - 1] ?? null
  }
  for (const t of tarihler) if (t <= hedef) return t
  return null
}

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: sonTarihRow } = await supabase
    .from('tefas_fon_verileri').select('tarih').order('tarih', { ascending: false }).limit(1).single()
  const sonTarih = sonTarihRow?.tarih
  if (!sonTarih) return NextResponse.json({ error: 'tarih yok' }, { status: 500 })

  // Mevcut tüm işlem tarihleri (bir referans fondan)
  const tarihler: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('tefas_fon_verileri').select('tarih')
      .eq('fonKodu', 'AAL').eq('fonTipi', 'YAT').order('tarih', { ascending: false }).range(from, from + 999)
    if (!data || !data.length) break
    tarihler.push(...data.map(r => r.tarih))
    if (data.length < 1000) break
  }

  const donemTarihler = DONEMLER.map(d => ({
    ...d,
    tarih: (d as any).ybasi
      ? enYakinTarih(tarihler, `${sonTarih.slice(0, 4)}-01-01`, true)
      : enYakinTarih(tarihler, hedefTarih(sonTarih, d.gun, d.ay), d.sonraki),
  }))
  const benzersizTarihler = [...new Set(donemTarihler.map(d => d.tarih).filter(Boolean) as string[])]

  async function fetchAllForDate(tarih: string) {
    const rows: { fonKodu: string; fonTipi: string; fiyat: number }[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('tefas_fon_verileri').select('fonKodu, fonTipi, fiyat').eq('tarih', tarih).range(from, from + 999)
      if (!data || !data.length) break
      rows.push(...data as any)
      if (data.length < 1000) break
    }
    return rows
  }

  // Son tarih ana liste
  const son: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('tefas_fon_verileri')
      .select('fonKodu, fonUnvan, fonTipi, fiyat, portfoyBuyukluk, kisiSayisi').eq('tarih', sonTarih).range(from, from + 999)
    if (!data || !data.length) break
    son.push(...data)
    if (data.length < 1000) break
  }

  // Bugün için özeti zaten olan fonları atla
  const mevcutOzetler = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('tefas_fon_ozet')
      .select('fonKodu, fonTipi').eq('tarih', sonTarih).range(from, from + 999)
    if (!data || !data.length) break
    for (const r of data) mevcutOzetler.add(`${r.fonKodu}-${r.fonTipi}`)
    if (data.length < 1000) break
  }
  const islenecek = son.filter(f => !mevcutOzetler.has(`${f.fonKodu}-${f.fonTipi}`))

  const tarihFiyatMap: Record<string, Record<string, number>> = {}
  await Promise.all(benzersizTarihler.map(async t => {
    const rows = await fetchAllForDate(t)
    tarihFiyatMap[t] = {}
    for (const r of rows) tarihFiyatMap[t][`${r.fonKodu}-${r.fonTipi}`] = r.fiyat
  }))

  const rows = islenecek.map(f => {
    const g: Record<string, number | null> = {}
    for (const d of donemTarihler) {
      const eski = d.tarih ? tarihFiyatMap[d.tarih]?.[`${f.fonKodu}-${f.fonTipi}`] : null
      g[d.key] = eski && f.fiyat ? +(((f.fiyat - eski) / eski) * 100).toFixed(2) : null
    }
    return {
      fonKodu: f.fonKodu, fonTipi: f.fonTipi, fonUnvan: f.fonUnvan,
      fiyat: f.fiyat, portfoyBuyukluk: f.portfoyBuyukluk, kisiSayisi: f.kisiSayisi,
      getiri1g: g['1g'], getiri1h: g['1h'], getiri1a: g['1a'], getiri3a: g['3a'],
      getiri6a: g['6a'], getiriYb: g['yb'], getiri1y: g['1y'], getiri3y: g['3y'], getiri5y: g['5y'],
      tarih: sonTarih, guncellenmeTarihi: new Date().toISOString(),
    }
  })

  let yazilan = 0
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('tefas_fon_ozet').upsert(rows.slice(i, i + 500), { onConflict: 'fonKodu,fonTipi' })
    if (error) return NextResponse.json({ ok: false, error: error.message, yazilan }, { status: 500 })
    yazilan += Math.min(500, rows.length - i)
  }

  return NextResponse.json({ ok: true, yazilan, sonTarih })
}
