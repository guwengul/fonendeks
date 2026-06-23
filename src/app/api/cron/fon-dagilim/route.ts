import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const TEFAS_URL = 'https://www.tefas.gov.tr/api/funds/dagilimSiraliGetirDosya'
const TEFAS_TOKEN = process.env.TEFAS_BEARER_TOKEN!
const FON_TIPLERI = ['YAT', 'EMK', 'BYF'] as const

// Varlık dağılımı kolon kodu → Türkçe isim (TEFAS i18n'den)
const ALLOC_MAP: Record<string, string> = {
  bpp: 'Borsa İstanbul Para Piyasası', hs: 'Hisse Senedi', dt: 'Devlet Tahvili',
  hb: 'Hazine Bonosu', kibd: 'Döviz Cinsi Kamu İç Borçlanma Araçları', fb: 'Finansman Bonosu',
  ost: 'Özel Sektör Tahvili', vdm: 'Varlığa Dayalı Menkul Kıymetler', gas: 'Gayrı Menkul Sertifikası',
  gyy: 'Gayrimenkul Yatırımları', gsyy: 'Girişim Sermayesi Yatırımları', kba: 'Kamu Dış Borçlanma Araçları',
  osdb: 'Özel Sektör Dış Borçlanma Araçları', tpp: 'Takasbank Para Piyasası',
  kkstl: 'Kamu Kira Sertifikaları (TL)', kksd: 'Kamu Kira Sertifikaları (Döviz)',
  osks: 'Özel Sektör Kira Sertifikaları', kksyd: 'Kamu Yurt Dışı Kira Sertifikaları',
  oksyd: 'Özel Sektör Yurt Dışı Kira Sertifikaları', vmtl: 'Mevduat (TL)', vmd: 'Mevduat (Döviz)',
  khtl: 'Katılma Hesabı (TL)', khd: 'Katılma Hesabı (Döviz)', khau: 'Katılma Hesabı (Altın)',
  r: 'Repo', tr: 'Ters-Repo', btaa: 'BİST Taahhütlü İşlem Pazarı Alım', btas: 'BİST Taahhütlü İşlem Pazarı Satım',
  km: 'Kıymetli Madenler', kmbyf: 'Kıymetli Madenler Cinsinden BYF',
  kmkba: 'Kıymetli Madenler Cinsinden İhraç Edilen Kamu Borçlanma Araçları',
  kmkks: 'Kıymetli Madenler Cinsinden İhraç Edilen Kamu Kira Sertifikaları',
  ybkb: 'Yabancı Kamu Borçlanma Araçları', ybosb: 'Yabancı Özel Sektör Borçlanma Araçları',
  yhs: 'Yabancı Hisse Senedi', ybyf: 'Yabancı Borsa Yatırım Fonları', yyf: 'Yatırım Fonları Katılma Payları',
  byf: 'Borsa Yatırım Fonları Katılma Payları', gykb: 'Gayrimenkul Yatırım Fonları Katılma Payları',
  gsykb: 'Girişim Sermayesi Yatırım Fonları Katılma Payları', db: 'Döviz Ödemeli Bono',
  dot: 'Dövize Ödemeli Tahvil', bb: 'Banka Bonosu', eut: 'Eurobonds', kks: 'Kamu Kira Sertifikaları',
  vm: 'Vadeli Mevduat', vmau: 'Mevduat (Altın)', kh: 'Katılım Hesabı', ymk: 'Yabancı Menkul Kıymet',
  yba: 'Yabancı Borçlanma Aracı', fkb: 'Fon Katılma Belgesi', t: 'Türev Araçları',
  vint: 'Vadeli İşlemler Nakit Teminatları', d: 'Diğer',
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

async function fetchDagilim(fonTipi: string, basTarih: string, bitTarih: string) {
  const res = await fetch(TEFAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TEFAS_TOKEN}` },
    body: JSON.stringify({
      dil: 'TR', fonTipi, basTarih, bitTarih,
      fonKod: null, fonGrup: null, fonTurKod: null, fonUnvanTip: null,
      kurucuKod: null, fonTurAciklama: null, sfonTurKod: null,
    }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`TEFAS ${fonTipi} hata: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data?.resultList ?? data?.data ?? [])
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const bugun = new Date()
  const onceki = new Date()
  onceki.setUTCDate(onceki.getUTCDate() - 7)
  const basTarih = formatDate(onceki)
  const bitTarih = formatDate(bugun)

  const log: string[] = []
  let toplam = 0

  try {
    const sonuclar = await Promise.all(
      FON_TIPLERI.map(tip => fetchDagilim(tip, basTarih, bitTarih))
    )

    for (let i = 0; i < FON_TIPLERI.length; i++) {
      const fonTipi = FON_TIPLERI[i]
      const kayitlar = sonuclar[i]
      if (!kayitlar.length) { log.push(`${fonTipi}: kayıt yok`); continue }

      // Her fon için en güncel tarihli kaydı tut
      const sonKayit = new Map<string, any>()
      for (const k of kayitlar) {
        const mevcut = sonKayit.get(k.fonKodu)
        if (!mevcut || k.tarih > mevcut.tarih) sonKayit.set(k.fonKodu, k)
      }

      const rows = [...sonKayit.values()].map((k) => {
        const dagilim: Record<string, number> = {}
        for (const [kod, isim] of Object.entries(ALLOC_MAP)) {
          const v = k[kod]
          if (typeof v === 'number' && v > 0) dagilim[isim] = v
        }
        return {
          fonKodu: k.fonKodu,
          fonTipi,
          tarih: k.tarih,
          dagilim,
          guncellenmeTarihi: new Date().toISOString(),
        }
      }).filter(r => Object.keys(r.dagilim).length > 0)

      const supabase = createAdminClient()
      // 500'erli upsert
      for (let j = 0; j < rows.length; j += 500) {
        const { error } = await supabase
          .from('tefas_fon_dagilim')
          .upsert(rows.slice(j, j + 500), { onConflict: 'fonKodu' })
        if (error) { log.push(`${fonTipi} upsert hata: ${error.message}`); break }
      }
      toplam += rows.length
      log.push(`${fonTipi}: ${rows.length} fon dağılımı yazıldı`)
    }

    return NextResponse.json({ ok: true, toplam, log })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, log }, { status: 500 })
  }
}
