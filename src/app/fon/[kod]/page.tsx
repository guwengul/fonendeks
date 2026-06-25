import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FonTabs from '@/components/FonTabs'

export const revalidate = 3600

type Gecmis = {
  tarih: string
  fiyat: number | null
  portfoyBuyukluk: number | null
  kisiSayisi: number | null
  tedPaySayisi: number | null
}

// Hedef tarihteki (veya hemen öncesindeki) fiyatı bul
function fiyatBul(gecmis: Gecmis[], hedef: Date): number | null {
  const hedefStr = hedef.toISOString().slice(0, 10)
  let bulunan: number | null = null
  for (const g of gecmis) {
    if (g.tarih <= hedefStr && g.fiyat) bulunan = g.fiyat
    else if (g.tarih > hedefStr) break
  }
  return bulunan
}

// Son fiyata göre, N gün önceki fiyattan yüzde getiri
function getiriHesapla(gecmis: Gecmis[], sonFiyat: number, gunOnce: number): number | null {
  const hedef = new Date()
  hedef.setUTCDate(hedef.getUTCDate() - gunOnce)
  const eski = fiyatBul(gecmis, hedef)
  if (!eski) return null
  return ((sonFiyat - eski) / eski) * 100
}

export default async function FonDetay({
  params,
  searchParams,
}: {
  params: Promise<{ kod: string }>
  searchParams: Promise<{ tip?: string }>
}) {
  const { kod } = await params
  const { tip = 'YAT' } = await searchParams
  const fonKodu = kod.toUpperCase()

  const supabase = createAdminClient()

  const { data: gecmis } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih, fiyat, portfoyBuyukluk, kisiSayisi, tedPaySayisi')
    .eq('fonKodu', fonKodu)
    .eq('fonTipi', tip)
    .order('tarih', { ascending: true })

  if (!gecmis || gecmis.length === 0) notFound()

  const son = gecmis[gecmis.length - 1]
  const ilk = gecmis[0]
  const onceki = gecmis.length > 1 ? gecmis[gecmis.length - 2] : null

  const { data: info } = await supabase
    .from('tefas_fon_verileri')
    .select('fonUnvan, fonTipi')
    .eq('fonKodu', fonKodu)
    .eq('fonTipi', tip)
    .limit(1)
    .single()

  // Meta bilgiler kendi DB tablomuzdan
  const { data: meta } = await supabase
    .from('tefas_fon_meta')
    .select('*')
    .eq('fonKodu', fonKodu)
    .maybeSingle()

  // Varlık dağılımı kendi DB tablomuzdan
  const { data: dagilimRow } = await supabase
    .from('tefas_fon_dagilim')
    .select('dagilim, tarih')
    .eq('fonKodu', fonKodu)
    .maybeSingle()

  const dagilim: [string, number][] = dagilimRow?.dagilim
    ? Object.entries(dagilimRow.dagilim as Record<string, number>).sort((a, b) => b[1] - a[1])
    : []

  // Portföydeki hisseler (menkul-kıymet seviyesi, KAP raporundan)
  const { data: holdingsRow } = await supabase
    .from('tefas_fon_holdings')
    .select('hisseler, tarih, kapBildirimLink, pdfLink, yayinTarihi')
    .eq('fonKodu', fonKodu)
    .maybeSingle()
  const hisseler: { ticker: string; isin: string; agirlik: number }[] = holdingsRow?.hisseler ?? []

  // Benchmark serileri (fon başlangıcından itibaren) — grafikte karşılaştırma için
  const GOSTERGELER = ['USD', 'EUR', 'BIST100', 'BIST30', 'GRAM_ALTIN'] as const
  const { data: benchRows } = await supabase
    .from('tefas_benchmark_fiyatlari')
    .select('tarih, gosterge, deger')
    .gte('tarih', ilk.tarih)
    .order('tarih', { ascending: true })

  // gosterge → sıralı [tarih, deger] dizisi
  const benchSerileri = new Map<string, { tarih: string; deger: number }[]>()
  for (const g of GOSTERGELER) benchSerileri.set(g, [])
  for (const r of benchRows ?? []) {
    benchSerileri.get(r.gosterge)?.push({ tarih: r.tarih, deger: r.deger })
  }

  // Fon tarihlerine forward-fill ile hizala
  const benchPtr: Record<string, number> = {}
  for (const g of GOSTERGELER) benchPtr[g] = 0
  const benchmarkData = gecmis.map(row => {
    const nokta: Record<string, number | null> = { }
    for (const g of GOSTERGELER) {
      const seri = benchSerileri.get(g)!
      while (benchPtr[g] < seri.length && seri[benchPtr[g]].tarih <= row.tarih) benchPtr[g]++
      nokta[g] = benchPtr[g] > 0 ? seri[benchPtr[g] - 1].deger : null
    }
    return { tarih: row.tarih, fiyat: row.fiyat, ...nokta }
  })

  const sonFiyat = son.fiyat ?? null

  const toplamGetiri = son.fiyat && ilk.fiyat
    ? (((son.fiyat - ilk.fiyat) / ilk.fiyat) * 100).toFixed(2)
    : null

  // Günlük getiri: son iki fiyat
  const gunlukGetiri = son.fiyat && onceki?.fiyat
    ? ((son.fiyat - onceki.fiyat) / onceki.fiyat) * 100
    : null

  // Dönemsel getiriler ham fiyat verisinden hesaplanır
  const yilBasi = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))
  const ybbEski = sonFiyat ? fiyatBul(gecmis, yilBasi) : null
  const donemler = sonFiyat ? [
    { label: '1 Hafta', val: getiriHesapla(gecmis, sonFiyat, 7) },
    { label: '1 Ay', val: getiriHesapla(gecmis, sonFiyat, 30) },
    { label: '3 Ay', val: getiriHesapla(gecmis, sonFiyat, 90) },
    { label: '6 Ay', val: getiriHesapla(gecmis, sonFiyat, 180) },
    { label: 'YBB', val: ybbEski ? ((sonFiyat - ybbEski) / ybbEski) * 100 : null },
    { label: '1 Yıl', val: getiriHesapla(gecmis, sonFiyat, 365) },
    { label: '3 Yıl', val: getiriHesapla(gecmis, sonFiyat, 365 * 3) },
    { label: '5 Yıl', val: getiriHesapla(gecmis, sonFiyat, 365 * 5) },
  ] : []
  const getiri1h = donemler.find(d => d.label === '1 Hafta')?.val ?? null
  const getiri1a = donemler.find(d => d.label === '1 Ay')?.val ?? null
  const birYillik = donemler.find(d => d.label === '1 Yıl')?.val ?? null

  const TIP_RENK: Record<string, string> = {
    YAT: 'bg-indigo-50 text-indigo-600',
    EMK: 'bg-emerald-50 text-emerald-600',
    BYF: 'bg-purple-50 text-purple-600',
  }

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
      <Link href="/" className="text-slate-400 hover:text-indigo-600 text-sm mb-6 inline-block transition-colors">
        ← Tüm fonlar
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900 font-mono">{fonKodu}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIP_RENK[info?.fonTipi ?? ''] ?? ''}`}>
            {info?.fonTipi}
          </span>
          {(meta?.fonTurAciklama ?? meta?.fonKategori) && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
              {meta?.fonTurAciklama ?? meta?.fonKategori}
            </span>
          )}
          {meta?.riskDegeri && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-600">
              Risk {meta.riskDegeri}/7
            </span>
          )}
        </div>
        <p className="text-slate-500 mt-1">{info?.fonUnvan}</p>
        {/* Bilgi çubuğu */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
          {meta?.isinKodu && <span>ISIN: <span className="font-mono text-slate-600">{meta.isinKodu}</span></span>}
          <span>Kuruluş: <span className="text-slate-600">{ilk.tarih}</span></span>
          {meta?.riskDegeri && <span>Risk: <span className="text-slate-600">{meta.riskDegeri}/7</span></span>}
          {meta?.yonetimUcreti && <span>Yönetim ücreti: <span className="text-slate-600">%{meta.yonetimUcreti}</span></span>}
          {meta?.stopaj != null && <span>Stopaj: <span className="text-slate-600">%{meta.stopaj}</span></span>}
          {meta?.basIsSaat && meta?.sonIsSaat && <span>İşlem saatleri: <span className="text-slate-600">{meta.basIsSaat}–{meta.sonIsSaat}</span></span>}
          {meta?.fonSatisValor != null && <span>Alış valörü: <span className="text-slate-600">{meta.fonSatisValor} gün</span></span>}
          {meta?.fonGeriAlisValor != null && <span>Satış valörü: <span className="text-slate-600">{meta.fonGeriAlisValor} gün</span></span>}
          {meta?.kapLink && (
            <a href={meta.kapLink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600 transition-colors">KAP →</a>
          )}
        </div>
      </div>

      {/* Metrik kartlar */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 mb-8">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Son Fiyat</p>
          <p className="text-slate-900 font-mono font-semibold text-sm">
            {son.fiyat != null ? son.fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
          </p>
          <p className="text-slate-400 text-xs mt-1">{son.tarih}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Günlük</p>
          <p className={`font-semibold text-lg ${(gunlukGetiri ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {gunlukGetiri != null ? `%${gunlukGetiri.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">1 Haftalık</p>
          <p className={`font-semibold text-lg ${(getiri1h ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {getiri1h != null ? `%${getiri1h.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">1 Aylık</p>
          <p className={`font-semibold text-lg ${(getiri1a ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {getiri1a != null ? `%${getiri1a.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">1 Yıllık</p>
          <p className={`font-semibold text-lg ${(birYillik ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {birYillik != null ? `%${birYillik.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Portföy Büyüklüğü</p>
          <p className="text-slate-900 font-semibold text-sm">
            {son.portfoyBuyukluk != null
              ? (son.portfoyBuyukluk / 1_000_000).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Mn ₺'
              : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Yatırımcı</p>
          <p className="text-slate-900 font-semibold text-sm">
            {son.kisiSayisi?.toLocaleString('tr-TR') ?? '-'}
          </p>
        </div>
      </div>

      <FonTabs
        gecmis={gecmis}
        benchmark={benchmarkData}
        donemler={donemler}
        dagilim={dagilim}
        dagilimTarih={dagilimRow?.tarih}
        hisseler={hisseler}
        holdingsYayinTarihi={holdingsRow?.yayinTarihi}
        holdingsPdfLink={holdingsRow?.pdfLink}
        holdingsKapLink={holdingsRow?.kapBildirimLink}
      />
    </div>
  )
}
