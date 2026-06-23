import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const TEFAS_URL = 'https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetirDosya'
const TEFAS_TOKEN = process.env.TEFAS_BEARER_TOKEN!
const FON_TIPLERI = ['YAT', 'EMK', 'BYF'] as const

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function getLast7Days(): Date[] {
  const days: Date[] = []
  for (let i = 0; i <= 7; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    days.push(d)
  }
  return days
}

async function fetchTefas(fonTipi: string, basTarih: string, bitTarih: string) {
  const res = await fetch(TEFAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEFAS_TOKEN}`,
    },
    body: JSON.stringify({
      dil: 'TR',
      fonTipi,
      basTarih,
      bitTarih,
      fonKod: null,
      fonGrup: null,
      fonTurKod: null,
      fonUnvanTip: null,
      kurucuKod: null,
      fonTurAciklama: null,
      sfonTurKod: null,
    }),
  })

  if (!res.ok) throw new Error(`TEFAS ${fonTipi} hata: ${res.status}`)
  return res.json()
}

export async function GET(req: Request) {
  // Vercel cron güvenlik kontrolü
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const days = getLast7Days()
  const basTarih = formatDate(days[days.length - 1])
  const bitTarih = formatDate(days[0])
  const tarihler = days.map(isoDate)

  const log: string[] = []
  let toplamEklenen = 0

  try {
    // Sadece son 7 günü sil (o günler henüz gelmemişse boş geçer)
    const { error: deleteError } = await supabase
      .from('tefas_fon_verileri')
      .delete()
      .in('tarih', tarihler)

    if (deleteError) throw new Error(`Silme hatası: ${deleteError.message}`)
    log.push(`Silindi: ${tarihler.join(', ')}`)

    // 3 fon tipi paralel çek
    const sonuclar = await Promise.all(
      FON_TIPLERI.map(tip => fetchTefas(tip, basTarih, bitTarih))
    )

    for (let i = 0; i < FON_TIPLERI.length; i++) {
      const fonTipi = FON_TIPLERI[i]
      const data = sonuclar[i]
      const kayitlar = Array.isArray(data) ? data : (data?.resultList ?? data?.data ?? [])

      if (kayitlar.length === 0) {
        log.push(`${fonTipi}: kayıt yok`)
        continue
      }

      const rows = kayitlar
        .filter((r: any) => r.fiyat > 0)
        .map((r: any) => ({
          tarih: r.tarih,
          fonTipi,
          fonKodu: r.fonKodu,
          fonUnvan: r.fonUnvan ?? null,
          fiyat: r.fiyat ?? null,
          tedPaySayisi: r.tedPaySayisi ?? null,
          kisiSayisi: r.kisiSayisi ?? null,
          portfoyBuyukluk: r.portfoyBuyukluk ?? null,
          borsaBultenFiyat: r.borsaBultenFiyat ?? null,
        }))

      const { error: insertError } = await supabase
        .from('tefas_fon_verileri')
        .insert(rows)

      if (insertError) throw new Error(`${fonTipi} insert hatası: ${insertError.message}`)

      toplamEklenen += rows.length
      log.push(`${fonTipi}: ${rows.length} kayıt eklendi`)
    }

    return NextResponse.json({ ok: true, toplamEklenen, log })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, log }, { status: 500 })
  }
}
