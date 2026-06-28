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

  const { data: portfoy } = await supabase
    .from('tefas_portfoy')
    .select('id')
    .eq('id', portfoyId)
    .eq('user_id', user.id)
    .single()
  if (!portfoy) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: islemler } = await supabase
    .from('tefas_portfoy_islem')
    .select('fonKodu, fonTipi, adet, fiyat, tarih')
    .eq('portfoy_id', portfoyId)
    .eq('user_id', user.id)
    .order('tarih', { ascending: true })

  if (!islemler?.length) return NextResponse.json({ tarihce: [], usdKarsilastirma: [], bist30: [] })

  const admin = createAdminClient()

  const bugun = new Date()
  const gunlerOnce = new Date(bugun)
  gunlerOnce.setDate(gunlerOnce.getDate() - gun)
  const ilkIslemTarih = islemler[0].tarih
  const baslangic = ilkIslemTarih > gunlerOnce.toISOString().slice(0, 10)
    ? ilkIslemTarih
    : gunlerOnce.toISOString().slice(0, 10)

  const fonKodlari = [...new Set(islemler.map(i => i.fonKodu))]

  // Fon fiyatları (grafik dönemi)
  const { data: fiyatlar } = await admin
    .from('tefas_fon_verileri')
    .select('fonKodu, fonTipi, tarih, fiyat')
    .in('fonKodu', fonKodlari)
    .gte('tarih', baslangic)
    .order('tarih', { ascending: true })

  if (!fiyatlar?.length) return NextResponse.json({ tarihce: [], usdKarsilastirma: [], bist30: [] })

  // USD: ilk işlem tarihinden itibaren (alış kurlarına bakmak için)
  // BIST30: grafik döneminden itibaren
  const [usdResult, bist30Result] = await Promise.all([
    admin
      .from('tefas_benchmark_fiyatlari')
      .select('tarih, deger')
      .eq('gosterge', 'USD')
      .gte('tarih', ilkIslemTarih)
      .order('tarih', { ascending: true }),
    admin
      .from('tefas_benchmark_fiyatlari')
      .select('tarih, deger')
      .eq('gosterge', 'BIST30')
      .gte('tarih', baslangic)
      .order('tarih', { ascending: true }),
  ])

  // USD map: tarih → kur
  const usdMap = new Map((usdResult.data ?? []).map(u => [u.tarih, Number(u.deger)]))

  // Her işlem için o günkü USD kurunu bul (yoksa en yakın önceki)
  // Önce sıralı tarih listesi oluştur
  const usdTarihler = [...usdMap.keys()].sort()
  function kurBul(tarih: string): number | null {
    // Tam eşleşme
    if (usdMap.has(tarih)) return usdMap.get(tarih)!
    // En yakın önceki iş günü
    let best: string | null = null
    for (const t of usdTarihler) {
      if (t <= tarih) best = t
      else break
    }
    return best ? usdMap.get(best)! : null
  }

  // Her işlemin TL maliyetini o günkü kura bölerek "kaç USD" alınırdı hesapla
  // Kümülatif USD miktarını tut
  let kumulatifUsd = 0
  const islemUsdMap = new Map<string, number>() // tarih → o güne kadar birikmiş USD
  for (const i of islemler) {
    const kur = kurBul(i.tarih)
    if (kur && kur > 0) {
      const tlMaliyet = Number(i.fiyat) * Number(i.adet)
      kumulatifUsd += tlMaliyet / kur
    }
    islemUsdMap.set(i.tarih, kumulatifUsd)
  }

  // Fon fiyat map
  const fiyatMap = new Map<string, Map<string, number>>()
  for (const f of fiyatlar) {
    const key = `${f.fonKodu}::${f.fonTipi}`
    if (!fiyatMap.has(key)) fiyatMap.set(key, new Map())
    fiyatMap.get(key)!.set(f.tarih, Number(f.fiyat))
  }

  const tarihler = [...new Set(fiyatlar.map(f => f.tarih))].sort()

  // Portföy değeri ve USD karşılaştırması
  const tarihce: { tarih: string; deger: number }[] = []
  const usdKarsilastirma: { tarih: string; deger: number }[] = []

  for (const tarih of tarihler) {
    const gecerliIslemler = islemler.filter(i => i.tarih <= tarih)
    if (!gecerliIslemler.length) continue

    const adetMap = new Map<string, number>()
    for (const i of gecerliIslemler) {
      const key = `${i.fonKodu}::${i.fonTipi}`
      adetMap.set(key, (adetMap.get(key) ?? 0) + Number(i.adet))
    }

    let toplamDeger = 0
    let eksikFon = false
    for (const [key, adet] of adetMap.entries()) {
      const fiyat = fiyatMap.get(key)?.get(tarih)
      if (fiyat == null) { eksikFon = true; break }
      toplamDeger += adet * fiyat
    }

    if (eksikFon || toplamDeger <= 0) continue

    tarihce.push({ tarih, deger: Math.round(toplamDeger * 100) / 100 })

    // USD karşılaştırması: o tarihe kadar birikmiş USD × o günün kuru
    // Birikmiş USD: son işlemden önce gelen kümülatif değer
    let usdMiktar = 0
    for (const [isTarih, usd] of islemUsdMap.entries()) {
      if (isTarih <= tarih) usdMiktar = usd
    }
    const gunKur = kurBul(tarih)
    if (usdMiktar > 0 && gunKur) {
      usdKarsilastirma.push({ tarih, deger: Math.round(usdMiktar * gunKur * 100) / 100 })
    }
  }

  return NextResponse.json({
    tarihce,
    usdKarsilastirma,
    bist30: (bist30Result.data ?? []).map(b => ({ tarih: b.tarih, deger: Number(b.deger) })),
  })
}
