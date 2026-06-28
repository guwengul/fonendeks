import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const portfoyId = searchParams.get('portfoy_id')
  const gun = Math.min(Number(searchParams.get('gun') ?? '90'), 365)
  if (!portfoyId) return NextResponse.json({ error: 'portfoy_id required' }, { status: 400 })

  // Kullanıcının bu portföye sahip olduğunu doğrula
  const { data: portfoy } = await supabase
    .from('tefas_portfoy')
    .select('id')
    .eq('id', portfoyId)
    .eq('user_id', user.id)
    .single()
  if (!portfoy) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // İşlemleri çek
  const { data: islemler } = await supabase
    .from('tefas_portfoy_islem')
    .select('fonKodu, fonTipi, adet, tarih')
    .eq('portfoy_id', portfoyId)
    .eq('user_id', user.id)
    .order('tarih', { ascending: true })

  if (!islemler?.length) return NextResponse.json({ tarihce: [], usd: [] })

  const admin = createAdminClient()

  // Başlangıç tarihi: ilk işlem veya gun kadar geri, hangisi daha yeniyse
  const bugun = new Date()
  const gunlerOnce = new Date(bugun)
  gunlerOnce.setDate(gunlerOnce.getDate() - gun)
  const ilkIslemTarih = islemler[0].tarih
  const baslangic = ilkIslemTarih > gunlerOnce.toISOString().slice(0, 10)
    ? ilkIslemTarih
    : gunlerOnce.toISOString().slice(0, 10)

  const fonKodlari = [...new Set(islemler.map(i => i.fonKodu))]

  // Tüm fon fiyatlarını başlangıçtan bugüne çek
  const { data: fiyatlar } = await admin
    .from('tefas_fon_verileri')
    .select('fonKodu, fonTipi, tarih, fiyat')
    .in('fonKodu', fonKodlari)
    .gte('tarih', baslangic)
    .order('tarih', { ascending: true })

  // Benchmark'lar (USD + BIST30)
  const { data: benchmarklar } = await admin
    .from('tefas_benchmark_fiyatlari')
    .select('tarih, gosterge, deger')
    .in('gosterge', ['USD', 'BIST30'])
    .gte('tarih', baslangic)
    .order('tarih', { ascending: true })

  const usdFiyatlar = (benchmarklar ?? []).filter(b => b.gosterge === 'USD')
  const bist30Fiyatlar = (benchmarklar ?? []).filter(b => b.gosterge === 'BIST30')

  if (!fiyatlar?.length) return NextResponse.json({ tarihce: [], usd: [], bist30: [] })

  // Tarih bazlı fiyat map: fonKodu::fonTipi → tarih → fiyat
  const fiyatMap = new Map<string, Map<string, number>>()
  for (const f of fiyatlar) {
    const key = `${f.fonKodu}::${f.fonTipi}`
    if (!fiyatMap.has(key)) fiyatMap.set(key, new Map())
    fiyatMap.get(key)!.set(f.tarih, Number(f.fiyat))
  }

  // Tüm benzersiz tarihleri bul
  const tarihler = [...new Set(fiyatlar.map(f => f.tarih))].sort()

  // Her tarih için portföy değeri hesapla
  const tarihce: { tarih: string; deger: number }[] = []

  for (const tarih of tarihler) {
    // Bu tarihe kadar yapılmış işlemler
    const gecerliIslemler = islemler.filter(i => i.tarih <= tarih)
    if (!gecerliIslemler.length) continue

    // Fon bazında toplam adet
    const adetMap = new Map<string, number>()
    for (const i of gecerliIslemler) {
      const key = `${i.fonKodu}::${i.fonTipi}`
      adetMap.set(key, (adetMap.get(key) ?? 0) + Number(i.adet))
    }

    // Portföy değeri: her fon için adet × güncel fiyat
    let toplamDeger = 0
    let eksikFon = false
    for (const [key, adet] of adetMap.entries()) {
      const fiyat = fiyatMap.get(key)?.get(tarih)
      if (fiyat == null) { eksikFon = true; break }
      toplamDeger += adet * fiyat
    }

    if (!eksikFon && toplamDeger > 0) {
      tarihce.push({ tarih, deger: Math.round(toplamDeger * 100) / 100 })
    }
  }

  return NextResponse.json({
    tarihce,
    usd: usdFiyatlar.map(u => ({ tarih: u.tarih, deger: Number(u.deger) })),
    bist30: bist30Fiyatlar.map(b => ({ tarih: b.tarih, deger: Number(b.deger) })),
  })
}
