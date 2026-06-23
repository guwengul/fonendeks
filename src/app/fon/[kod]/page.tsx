import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FonGrafik from '@/components/FonGrafik'

export const revalidate = 3600

const TEFAS_TOKEN = 'ST-tefaswebwse3irfmSBj4iRAzGPbAlS94Se'

async function fetchTefasInfo(fonKodu: string, fonTipi: string) {
  const post = (endpoint: string, body: object) =>
    fetch(`https://www.tefas.gov.tr/api/funds/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TEFAS_TOKEN}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    }).then(r => r.json()).catch(() => null)

  try {
    const [bilgiRes, profilRes, profilBilgiRes, getiriRes] = await Promise.all([
      post('fonBilgiGetir', { dil: 'TR', fonKodu }),
      post('fonProfilDtyGetir', { dil: 'TR', fonKodu, periyod: '12' }),
      post('fonProfilBilgiGetir', { dil: 'TR', fonKodu }),
      post('fonGetiriBazliBilgiGetir', {
        fonTipi, dil: 'TR', calismaTipi: 2,
        donemGetiri1a: '1', donemGetiri3a: '1', donemGetiri6a: '1',
        donemGetiriyb: '1', donemGetiri1y: '1', donemGetiri3y: '1', donemGetiri5y: '1',
      }),
    ])
    const bilgi = bilgiRes?.resultList?.[0] ?? null
    const profilList: any[] = profilRes?.resultList ?? []
    const profilBilgi = profilBilgiRes?.resultList?.[0] ?? null
    const getiriBilgi = (getiriRes?.resultList as any[] ?? []).find((r: any) => r.fonKodu === fonKodu) ?? null
    return { bilgi, profilList, profilBilgi, getiriBilgi }
  } catch {
    return { bilgi: null, profilList: [], profilBilgi: null, getiriBilgi: null }
  }
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

  const { data: info } = await supabase
    .from('tefas_fon_verileri')
    .select('fonUnvan, fonTipi')
    .eq('fonKodu', fonKodu)
    .eq('fonTipi', tip)
    .limit(1)
    .single()

  const { bilgi, profilList, profilBilgi, getiriBilgi } = await fetchTefasInfo(fonKodu, info?.fonTipi ?? tip)

  const toplamGetiri = son.fiyat && ilk.fiyat
    ? (((son.fiyat - ilk.fiyat) / ilk.fiyat) * 100).toFixed(2)
    : null

  const TIP_RENK: Record<string, string> = {
    YAT: 'bg-indigo-50 text-indigo-600',
    EMK: 'bg-emerald-50 text-emerald-600',
    BYF: 'bg-purple-50 text-purple-600',
  }

  // Fonun kendi getirisi profil listesinden
  const fonGetiri = profilList.find(r => r.fonKodu === fonKodu)?.fonTurGetiri ?? null
  // Kıyas listesi: fonun kendisi hariç
  const kiyaslar = profilList.filter(r => r.fonKodu !== fonKodu)

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
          {(getiriBilgi?.fonTurAciklama ?? bilgi?.fonKategori) && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
              {getiriBilgi?.fonTurAciklama ?? bilgi?.fonKategori}
            </span>
          )}
          {profilBilgi?.riskDegeri && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-600">
              Risk {profilBilgi.riskDegeri}/7
            </span>
          )}
        </div>
        <p className="text-slate-500 mt-1">{info?.fonUnvan}</p>
        {/* ISIN + detay bilgiler */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
          {profilBilgi?.isinKodu && <span>ISIN: <span className="font-mono text-slate-600">{profilBilgi.isinKodu}</span></span>}
          {profilBilgi?.basIsSaat && profilBilgi?.sonIsSaat && (
            <span>İşlem: {profilBilgi.basIsSaat}–{profilBilgi.sonIsSaat}</span>
          )}
          {profilBilgi?.fonSatisValor != null && <span>Alış valörü: {profilBilgi.fonSatisValor} gün</span>}
          {profilBilgi?.fonGeriAlisValor != null && <span>Satış valörü: {profilBilgi.fonGeriAlisValor} gün</span>}
          {profilBilgi?.tefasDurum && <span>{profilBilgi.tefasDurum}</span>}
          {profilBilgi?.kapLink && (
            <a href={profilBilgi.kapLink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600 transition-colors">
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
          <p className={`font-semibold text-lg ${(bilgi?.gunlukGetiri ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {bilgi?.gunlukGetiri != null ? `%${bilgi.gunlukGetiri.toFixed(4)}` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">1 Yıllık Getiri</p>
          <p className={`font-semibold text-lg ${(fonGetiri ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {fonGetiri != null ? `%${(fonGetiri * 100).toFixed(2)}` : '-'}
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
            {bilgi?.yatirimciSayi?.toLocaleString('tr-TR') ?? son.kisiSayisi?.toLocaleString('tr-TR') ?? '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Kategori Sırası</p>
          <p className="text-slate-900 font-semibold">
            {bilgi?.kategoriDerece != null && bilgi?.kategoriFonSay != null
              ? `${bilgi.kategoriDerece} / ${bilgi.kategoriFonSay}`
              : '-'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-400 text-xs mb-1">Pazar Payı</p>
          <p className="text-slate-900 font-semibold">
            {bilgi?.pazarPayi != null ? `%${bilgi.pazarPayi.toFixed(2)}` : '-'}
          </p>
        </div>
      </div>

      <FonGrafik data={gecmis} />

      {/* Dönemsel getiriler */}
      {getiriBilgi && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Dönemsel Getiriler</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-7 divide-x divide-slate-100">
            {[
              { label: '1 Ay', val: getiriBilgi.getiri1a },
              { label: '3 Ay', val: getiriBilgi.getiri3a },
              { label: '6 Ay', val: getiriBilgi.getiri6a },
              { label: 'YBB', val: getiriBilgi.getiriyb },
              { label: '1 Yıl', val: getiriBilgi.getiri1y },
              { label: '3 Yıl', val: getiriBilgi.getiri3y },
              { label: '5 Yıl', val: getiriBilgi.getiri5y },
            ].map(({ label, val }) => (
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

      {/* Benchmark karşılaştırma */}
      {kiyaslar.length > 0 && (
        <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Kıyaslama (1 Yıllık)</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs">
                <th className="px-5 py-3 text-left font-medium">Kıyas</th>
                <th className="px-5 py-3 text-right font-medium">{fonKodu}</th>
                <th className="px-5 py-3 text-right font-medium">Kıyas</th>
                <th className="px-5 py-3 text-right font-medium">Fark</th>
              </tr>
            </thead>
            <tbody>
              {kiyaslar.map((row, i) => {
                const kiyasG = row.fonTurGetiri ?? null
                const fark = fonGetiri != null && kiyasG != null ? fonGetiri - kiyasG : null
                return (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700 font-medium">{row.fonUnvan ?? row.fonKodu}</td>
                    <td className={`px-5 py-3 text-right font-mono ${(fonGetiri ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {fonGetiri != null ? `%${(fonGetiri * 100).toFixed(2)}` : '-'}
                    </td>
                    <td className={`px-5 py-3 text-right font-mono ${(kiyasG ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {kiyasG != null ? `%${(kiyasG * 100).toFixed(2)}` : '-'}
                    </td>
                    <td className={`px-5 py-3 text-right font-mono font-semibold ${(fark ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {fark != null ? `${fark >= 0 ? '+' : ''}%${(fark * 100).toFixed(2)}` : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
