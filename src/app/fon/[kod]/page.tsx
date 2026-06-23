import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FonGrafik from '@/components/FonGrafik'

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
    { label: '1 Ay', val: getiriHesapla(gecmis, sonFiyat, 30) },
    { label: '3 Ay', val: getiriHesapla(gecmis, sonFiyat, 90) },
    { label: '6 Ay', val: getiriHesapla(gecmis, sonFiyat, 180) },
    { label: 'YBB', val: ybbEski ? ((sonFiyat - ybbEski) / ybbEski) * 100 : null },
    { label: '1 Yıl', val: getiriHesapla(gecmis, sonFiyat, 365) },
    { label: '3 Yıl', val: getiriHesapla(gecmis, sonFiyat, 365 * 3) },
    { label: '5 Yıl', val: getiriHesapla(gecmis, sonFiyat, 365 * 5) },
  ] : []
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
        {/* ISIN + detay bilgiler */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
          {meta?.isinKodu && <span>ISIN: <span className="font-mono text-slate-600">{meta.isinKodu}</span></span>}
          {meta?.basIsSaat && meta?.sonIsSaat && (
            <span>İşlem: {meta.basIsSaat}–{meta.sonIsSaat}</span>
          )}
          {meta?.fonSatisValor != null && <span>Alış valörü: {meta.fonSatisValor} gün</span>}
          {meta?.fonGeriAlisValor != null && <span>Satış valörü: {meta.fonGeriAlisValor} gün</span>}
          {meta?.yonetimUcreti && <span>Yönetim ücreti: %{meta.yonetimUcreti}</span>}
          {meta?.stopaj != null && <span>Stopaj: %{meta.stopaj}</span>}
          {meta?.tefasDurum && <span>{meta.tefasDurum === true || meta.tefasDurum === 'true' ? "TEFAS'ta işlem görüyor" : meta.tefasDurum}</span>}
          {meta?.kapLink && (
            <a href={meta.kapLink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600 transition-colors">
              KAP →
            </a>
          )}
        </div>
      </div>

      {/* Metrik kartlar - satır 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Son Fiyat</p>
          <p className="text-slate-900 font-mono font-semibold">{son.fiyat?.toFixed(6) ?? '-'}</p>
          <p className="text-slate-400 text-xs mt-1">{son.tarih}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Günlük Getiri</p>
          <p className={`font-semibold text-lg ${(gunlukGetiri ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {gunlukGetiri != null ? `%${gunlukGetiri.toFixed(4)}` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">1 Yıllık Getiri</p>
          <p className={`font-semibold text-lg ${(birYillik ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {birYillik != null ? `%${birYillik.toFixed(2)}` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Toplam Getiri</p>
          <p className={`font-semibold text-lg ${toplamGetiri && +toplamGetiri >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {toplamGetiri ? `%${toplamGetiri}` : '-'}
          </p>
          <p className="text-slate-400 text-xs mt-1">{ilk.tarih} → {son.tarih}</p>
        </div>
      </div>

      {/* Metrik kartlar - satır 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Portföy Büyüklüğü</p>
          <p className="text-slate-900 font-semibold">
            {son.portfoyBuyukluk ? (son.portfoyBuyukluk / 1_000_000).toFixed(1) + ' Mn ₺' : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Yatırımcı Sayısı</p>
          <p className="text-slate-900 font-semibold">
            {son.kisiSayisi?.toLocaleString('tr-TR') ?? '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Kategori Sırası</p>
          <p className="text-slate-900 font-semibold">
            {meta?.kategoriDerece != null && meta?.kategoriFonSay != null
              ? `${meta.kategoriDerece} / ${meta.kategoriFonSay}`
              : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Pazar Payı</p>
          <p className="text-slate-900 font-semibold">
            {meta?.pazarPayi != null ? `%${Number(meta.pazarPayi).toFixed(2)}` : '-'}
          </p>
        </div>
      </div>

      <FonGrafik data={gecmis} />

      {/* Dönemsel getiriler - ham fiyat verisinden hesaplanır */}
      {donemler.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Dönemsel Getiriler</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-7 divide-x divide-slate-100">
            {donemler.map(({ label, val }) => (
              <div key={label} className="px-4 py-4 text-center">
                <p className="text-slate-400 text-xs mb-1">{label}</p>
                <p className={`font-mono font-semibold text-sm ${val == null ? 'text-slate-300' : val >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {val != null ? `%${val.toFixed(2)}` : '-'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
