import { createAdminClient } from '@/lib/supabase/admin'
import FonListesi from '@/components/FonListesi'

export const revalidate = 1800

export default async function Home() {
  const supabase = createAdminClient()

  // Precompute edilmiş özet tablodan oku (cron/fon-ozet günlük hesaplıyor)
  const ozet: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('tefas_fon_ozet')
      .select('*')
      .order('portfoyBuyukluk', { ascending: false })
      .range(from, from + 999)
    if (!data || !data.length) break
    ozet.push(...data)
    if (data.length < 1000) break
  }

  const sonGuncelleme = ozet[0]?.guncellenmeTarihi
    ? new Date(ozet[0].guncellenmeTarihi).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : ozet[0]?.tarih ?? ''

  const fonlar = ozet.map(f => ({
    fonKodu: f.fonKodu, fonUnvan: f.fonUnvan, fonTipi: f.fonTipi,
    fiyat: f.fiyat, portfoyBuyukluk: f.portfoyBuyukluk, kisiSayisi: f.kisiSayisi, tarih: f.tarih,
    getiriler: {
      '1g': f.getiri1g, '1h': f.getiri1h, '1a': f.getiri1a, '3a': f.getiri3a,
      '6a': f.getiri6a, '1y': f.getiri1y, '3y': f.getiri3y, '5y': f.getiri5y,
    },
  }))

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Yatırım Fonları</h1>
        <p className="text-slate-400 text-sm mt-1">Son güncelleme: {sonGuncelleme}</p>
      </div>
      <FonListesi fonlar={fonlar} />
    </div>
  )
}
