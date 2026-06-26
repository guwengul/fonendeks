import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FonTabs from '@/components/FonTabs'

export const dynamic = 'force-dynamic'

function sirketFonLinki(fonKodu: string, fonUnvan: string | null): string | null {
  if (!fonUnvan) return null
  const u = fonUnvan.toUpperCase()
  // Fon kodundan direkt URL üretilenler
  if (u.startsWith('AK PORTFÖY') || u.startsWith('AK PORTFOY'))
    return `https://www.akportfoy.com.tr/tr/fund/${fonKodu}`
  if (u.includes('QNB') && (u.includes('PORTFÖY') || u.includes('PORTFOY')))
    return `https://www.qnbportfoy.com.tr/tr-TR/FonDetay/${fonKodu}`
  // Fon listesine yönlenenler
  if (u.startsWith('İŞ PORTFÖY') || u.startsWith('IS PORTFOY'))
    return 'https://www.isportfoy.com.tr/yatirim-fonlari'
  if (u.includes('GARANTİ') && u.includes('PORTFÖY'))
    return 'https://www.garantibbvaportfoy.com.tr/fon-getirileri'
  if (u.startsWith('ZİRAAT PORTFÖY') || u.startsWith('ZIRAAT PORTFOY'))
    return 'https://www.ziraatportfoy.com.tr/tr/yatirim-fonlari'
  if (u.startsWith('YAPI KREDİ PORTFÖY') || u.startsWith('YAPI KREDI PORTFOY'))
    return 'https://www.ykportfoy.com.tr/urun-ve-hizmetlerimiz/yatirim-fonlari'
  if (u.startsWith('TEB PORTFÖY') || u.startsWith('TEB PORTFOY'))
    return 'https://www.tebportfoy.com.tr/yatirim-fonlari'
  if (u.startsWith('ATA PORTFÖY') || u.startsWith('ATA PORTFOY'))
    return 'https://www.ataportfoy.com.tr/tum-yatirim-fonlari.html'
  if (u.startsWith('DENİZ PORTFÖY') || u.startsWith('DENIZ PORTFOY'))
    return 'https://www.denizportfoy.com/Fon/Index'
  if (u.startsWith('HALK PORTFÖY') || u.startsWith('HALK PORTFOY'))
    return 'https://www.halkportfoy.com.tr/yatirim-fonlari'
  if (u.startsWith('İSTANBUL PORTFÖY') || u.startsWith('ISTANBUL PORTFOY'))
    return 'https://www.istanbulportfoy.com/fon-listesi'
  if (u.startsWith('FİBA PORTFÖY') || u.startsWith('FIBA PORTFOY'))
    return 'https://www.fibaportfoy.com.tr/yatirim-fonlari'
  if (u.startsWith('NEUTRON PORTFÖY') || u.startsWith('NEUTRON PORTFOY'))
    return 'https://www.neutronportfoy.com.tr'
  if (u.startsWith('ALTERNATİF PORTFÖY') || u.startsWith('ALTERNATIF PORTFOY'))
    return 'https://www.alternatiportfoy.com.tr'
  if (u.startsWith('BNP PARİBAS') || u.startsWith('BNP PARIBAS'))
    return 'https://www.tebportfoy.com.tr/yatirim-fonlari'
  return null
}

type Gecmis = {
  tarih: string
  fiyat: number | null
  portfoyBuyukluk: number | null
  kisiSayisi: number | null
  tedPaySayisi: number | null
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

  // Özet + meta paralel çek
  const [gecmisRes, ozetRes, metaRes] = await Promise.all([
    supabase
      .from('tefas_fon_verileri')
      .select('tarih, fiyat, portfoyBuyukluk, kisiSayisi, tedPaySayisi')
      .eq('fonKodu', fonKodu)
      .eq('fonTipi', tip)
      .order('tarih', { ascending: false })
      .limit(2000),
    supabase
      .from('tefas_fon_ozet')
      .select('fonUnvan, fonTipi, fiyat, portfoyBuyukluk, kisiSayisi, tarih, getiri1g, getiri1h, getiri1a, getiri3a, getiri6a, getiriYb, getiri1y, getiri3y, getiri5y')
      .eq('fonKodu', fonKodu)
      .eq('fonTipi', tip)
      .maybeSingle(),
    supabase
      .from('tefas_fon_meta')
      .select('*')
      .eq('fonKodu', fonKodu)
      .maybeSingle(),
  ])

  const gecmis = (gecmisRes.data ?? []).slice().reverse()
  const ozet = ozetRes.data
  const meta = metaRes.data

  if (!gecmis || gecmis.length === 0) notFound()

  const son = gecmis[gecmis.length - 1]
  const ilk = gecmis[0]

  // info artık ozet'ten geliyor
  const info = ozet ? { fonUnvan: ozet.fonUnvan, fonTipi: ozet.fonTipi } : null

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

  // Benchmark getirileri önceden hesaplanmış tablodan
  const { data: benchGetiriRows } = await supabase
    .from('tefas_benchmark_getiri')
    .select('gosterge, getiri1h, getiri1a, getiri3a, getiri6a, getiriyb, getiri1y, getiri3y, getiri5y')

  // { '1H': { USD: x, EUR: y, ... }, '1A': { ... }, ... }
  const benchGetiriler: Record<string, Record<string, number | null>> = {
    '1H': {}, '1A': {}, '3A': {}, '6A': {}, 'YBB': {}, '1Y': {}, '3Y': {}, '5Y': {},
  }
  for (const r of benchGetiriRows ?? []) {
    benchGetiriler['1H'][r.gosterge]  = r.getiri1h
    benchGetiriler['1A'][r.gosterge]  = r.getiri1a
    benchGetiriler['3A'][r.gosterge]  = r.getiri3a
    benchGetiriler['6A'][r.gosterge]  = r.getiri6a
    benchGetiriler['YBB'][r.gosterge] = r.getiriyb
    benchGetiriler['1Y'][r.gosterge]  = r.getiri1y
    benchGetiriler['3Y'][r.gosterge]  = r.getiri3y
    benchGetiriler['5Y'][r.gosterge]  = r.getiri5y
  }

  // Fon getirilerini ozet'ten al (TEFAS önceden hesaplar, daha güvenilir)
  const ozetFonGetiri: Record<string, number | null> = {
    '1H': ozet?.getiri1h ?? null,
    '1A': ozet?.getiri1a ?? null,
    '3A': ozet?.getiri3a ?? null,
    '6A': ozet?.getiri6a ?? null,
    'YBB': ozet?.getiriYb ?? null,
    '1Y': ozet?.getiri1y ?? null,
    '3Y': ozet?.getiri3y ?? null,
    '5Y': ozet?.getiri5y ?? null,
  }
  for (const [label, val] of Object.entries(ozetFonGetiri)) {
    benchGetiriler[label]['fiyat'] = val
  }

  const benchmarkData: { tarih: string; fiyat: number | null }[] = gecmis.map(r => ({ tarih: r.tarih, fiyat: r.fiyat }))

  // Getiriler özet tablosundan gelir (önceden hesaplanmış)
  const gunlukGetiri = ozet?.getiri1g ?? null
  const getiri1h = ozet?.getiri1h ?? null
  const getiri1a = ozet?.getiri1a ?? null
  const birYillik = ozet?.getiri1y ?? null

  const donemler = [
    { label: '1 Hafta', val: ozet?.getiri1h ?? null },
    { label: '1 Ay',   val: ozet?.getiri1a ?? null },
    { label: '3 Ay',   val: ozet?.getiri3a ?? null },
    { label: '6 Ay',   val: ozet?.getiri6a ?? null },
    { label: 'YBB',    val: ozet?.getiriYb ?? null },
    { label: '1 Yıl',  val: ozet?.getiri1y ?? null },
    { label: '3 Yıl',  val: ozet?.getiri3y ?? null },
    { label: '5 Yıl',  val: ozet?.getiri5y ?? null },
  ]

  const TIP_RENK: Record<string, string> = {
    YAT: 'bg-indigo-50 text-indigo-600',
    EMK: 'bg-emerald-50 text-emerald-600',
    BYF: 'bg-purple-50 text-purple-600',
  }

  const TIP_AD: Record<string, string> = {
    YAT: 'Yatırım Fonu',
    EMK: 'Emeklilik Fonu',
    BYF: 'Borsa Yatırım Fonu',
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
            {TIP_AD[info?.fonTipi ?? ''] ?? info?.fonTipi}
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
          <span>Yönetim ücreti: <span className="text-slate-600">{meta?.yonetimUcreti ? `%${meta.yonetimUcreti}` : '-'}</span></span>
          {meta?.stopaj != null && <span>Stopaj: <span className="text-slate-600">%{meta.stopaj}</span></span>}
          {meta?.basIsSaat && meta?.sonIsSaat && <span>İşlem saatleri: <span className="text-slate-600">{meta.basIsSaat}–{meta.sonIsSaat}</span></span>}
          {meta?.fonGeriAlisValor != null && <span>Alış valörü: <span className="text-slate-600">{meta.fonGeriAlisValor} gün</span></span>}
          {meta?.fonSatisValor != null && <span>Satış valörü: <span className="text-slate-600">{meta.fonSatisValor} gün</span></span>}
          {meta?.kapLink && (
            <a href={meta.kapLink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600 transition-colors">KAP →</a>
          )}
          {(() => {
            const link = sirketFonLinki(fonKodu, info?.fonUnvan ?? null)
            return link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600 transition-colors">Portföy Şirketi →</a>
            ) : null
          })()}
        </div>

        {/* Snapshot çubuğu */}
        <div className="grid grid-cols-2 sm:flex gap-px mt-4 bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
          <div className="flex-1 min-w-[120px] bg-white px-4 py-3">
            <p className="text-slate-400 text-xs mb-0.5">Son Fiyat</p>
            <div className="flex items-baseline gap-2">
              <p className="text-slate-900 font-semibold text-base">
                {son.fiyat != null ? son.fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '-'}
              </p>
              {gunlukGetiri != null && (
                <span className={`text-sm font-semibold ${gunlukGetiri >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  %{gunlukGetiri.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-slate-400 font-normal text-xs ml-1">günlük</span>
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs mt-0.5">{son.tarih}</p>
          </div>
          <div className="flex-1 min-w-[120px] bg-white px-4 py-3">
            <p className="text-slate-400 text-xs mb-0.5">Portföy Büyüklüğü</p>
            <p className="text-slate-900 font-semibold text-base">
              {son.portfoyBuyukluk != null
                ? (son.portfoyBuyukluk / 1_000_000).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Mn ₺'
                : '-'}
            </p>
          </div>
          <div className="flex-1 min-w-[120px] bg-white px-4 py-3">
            <p className="text-slate-400 text-xs mb-0.5">Yatırımcı Sayısı</p>
            <p className="text-slate-900 font-semibold text-base">
              {son.kisiSayisi?.toLocaleString('tr-TR') ?? '-'}
            </p>
          </div>
          <div className="flex-1 min-w-[120px] bg-white px-4 py-3">
            <p className="text-slate-400 text-xs mb-0.5">Pay Sayısı</p>
            <p className="text-slate-900 font-semibold text-base">
              {son.tedPaySayisi != null
                ? (son.tedPaySayisi / 1_000_000).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Mn'
                : '-'}
            </p>
          </div>
        </div>
      </div>

      <FonTabs
        fonKodu={fonKodu}
        getiri1h={getiri1h}
        getiri1a={getiri1a}
        getiri3a={ozet?.getiri3a ?? null}
        getiri6a={ozet?.getiri6a ?? null}
        getiriYb={ozet?.getiriYb ?? null}
        birYillik={birYillik}
        getiri3y={ozet?.getiri3y ?? null}
        getiri5y={ozet?.getiri5y ?? null}
        gecmis={gecmis}
        benchmark={benchmarkData}
        benchGetiriler={benchGetiriler}
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
