import { createAdminClient } from '@/lib/supabase/admin'
import FonListesi from '@/components/FonListesi'

export const revalidate = 1800

export default async function Home() {
  const supabase = createAdminClient()

  const [ozetResult, metaResult] = await Promise.all([
    (async () => {
      const rows: any[] = []
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from('tefas_fon_ozet')
          .select('*')
          .order('portfoyBuyukluk', { ascending: false, nullsFirst: false })
          .range(from, from + 999)
        if (!data || !data.length) break
        rows.push(...data)
        if (data.length < 1000) break
      }
      return rows
    })(),
    (async () => {
      const rows: any[] = []
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from('tefas_fon_meta')
          .select('fonKodu, riskDegeri, kurucuKod, fonTurAciklama, stopaj, yonetimUcreti, tefasDurum')
          .range(from, from + 999)
        if (!data || !data.length) break
        rows.push(...data)
        if (data.length < 1000) break
      }
      return rows
    })(),
  ])

  const metaMap = new Map(metaResult.map((m: any) => [m.fonKodu, m]))

  const sonGuncelleme = ozetResult[0]?.guncellenmeTarihi
    ? new Date(ozetResult[0].guncellenmeTarihi).toLocaleDateString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : ozetResult[0]?.tarih ?? ''

  const fonlar = ozetResult.map(f => {
    const meta = metaMap.get(f.fonKodu)
    return {
      fonKodu: f.fonKodu, fonUnvan: f.fonUnvan, fonTipi: f.fonTipi,
      fiyat: f.fiyat, portfoyBuyukluk: f.portfoyBuyukluk, kisiSayisi: f.kisiSayisi, tarih: f.tarih,
      riskDegeri: meta?.riskDegeri ?? null,
      kurucuKod: meta?.kurucuKod ?? null,
      fonTurAciklama: meta?.fonTurAciklama ?? null,
      stopaj: meta?.stopaj ?? null,
      yonetimUcreti: meta?.yonetimUcreti ?? null,
      tefasAcik: meta?.tefasDurum?.includes('işlem görüyor') ?? null,
      getiriler: {
        '1g': f.getiri1g, '1h': f.getiri1h, '1a': f.getiri1a, '3a': f.getiri3a,
        '6a': f.getiri6a, 'yb': f.getiriYb, '1y': f.getiri1y, '3y': f.getiri3y, '5y': f.getiri5y,
      },
    }
  })

  const kurucular = [...new Set(fonlar.map(f => f.kurucuKod).filter(Boolean))].sort() as string[]
  const fonTurleri = [...new Set(fonlar.map(f => f.fonTurAciklama).filter(Boolean))].sort() as string[]

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Türkiye Yatırım Fonu Tarayıcı</h1>
        <p className="text-slate-400 text-sm mt-1">TEFAS verilerine göre güncellendi: {sonGuncelleme}</p>
      </div>
      <FonListesi fonlar={fonlar} kurucular={kurucular} fonTurleri={fonTurleri} />
    </div>
  )
}
