import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const TEFAS_TOKEN = process.env.TEFAS_BEARER_TOKEN!
const BASE = 'https://www.tefas.gov.tr/api/funds'

const FON_TIPLERI = ['YAT', 'EMK', 'BYF'] as const

function post(endpoint: string, body: object) {
  return fetch(`${BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TEFAS_TOKEN}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  }).then(r => r.json()).catch(() => null)
}

function hesaplaStopaj(faizIcerigi: string | null, fonUnvan: string): number {
  if (faizIcerigi === 'Faiz içerir') return 10
  const unvan = (fonUnvan ?? '').toUpperCase()
  if (unvan.includes('HİSSE SENEDİ YOĞUN') || unvan.includes('HISSE SENEDI YOGUN')) return 0
  return 10
}

function hesaplaDovizli(fonUnvan: string): boolean {
  const unvan = (fonUnvan ?? '').toUpperCase()
  return unvan.includes('YABANCI') || unvan.includes('DÖVİZ') || unvan.includes('DOVIZ') ||
    unvan.includes('USD') || unvan.includes('EUR') || unvan.includes('ALTIN') || unvan.includes('DOLAR')
}

async function fetchFonMeta(fonKodu: string, fonTipi: string, fonUnvan: string) {
  const [profilBilgi, bilgi, yonetim] = await Promise.all([
    post('fonProfilBilgiGetir', { dil: 'TR', fonKodu }),
    post('fonBilgiGetir', { dil: 'TR', fonKodu }),
    post('fonYonetimBazliBilgiGetir', { fonTipi, dil: 'TR' }),
  ])

  const p = profilBilgi?.resultList?.[0] ?? null
  const b = bilgi?.resultList?.[0] ?? null
  const y = (yonetim?.resultList as any[] ?? []).find((r: any) => r.fonKodu === fonKodu) ?? null

  const unvan = p?.fonUnvan ?? b?.fonUnvan ?? fonUnvan

  return {
    fonKodu,
    fonUnvan: unvan,
    fonTipi,
    fonTurAciklama: y?.fonTurAciklama ?? null,
    fonTurKod: y?.fonTurKod ?? null,
    isinKodu: p?.isinKodu ?? null,
    riskDegeri: p?.riskDegeri ?? null,
    basIsSaat: p?.basIsSaat ?? null,
    sonIsSaat: p?.sonIsSaat ?? null,
    fonSatisValor: p?.fonSatisValor ?? null,
    fonGeriAlisValor: p?.fonGeriAlisValor ?? null,
    tefasDurum: p?.tefasDurum ?? null,
    kapLink: p?.kapLink ?? null,
    girisKomisyonu: p?.girisKomisyonu ?? null,
    cikisKomisyonu: p?.cikisKomisyonu ?? null,
    faizIcerigi: p?.faizIcerigi ?? null,
    yonetimUcreti: y?.uygulananYu1Y ?? null,
    toplamGiderOrani: y?.fonTopGiderKesoran ?? null,
    kurucuKod: y?.kurucuKod ?? null,
    minAlis: p?.minAlis ?? null,
    maxAlis: p?.maxAlis ?? null,
    fonKategori: b?.fonKategori ?? null,
    kategoriDerece: b?.kategoriDerece ?? null,
    kategoriFonSay: b?.kategoriFonSay ?? null,
    pazarPayi: b?.pazarPayi ?? null,
    stopaj: hesaplaStopaj(p?.faizIcerigi ?? null, unvan),
    dovizli: hesaplaDovizli(unvan),
    guncellenmeTarihi: new Date().toISOString(),
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limitParam = searchParams.get('limit')
  const offsetParam = searchParams.get('offset')

  const supabase = createAdminClient()

  // En son tarihi bul
  const { data: sonTarihRow, error: tarihErr } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih')
    .order('tarih', { ascending: false })
    .limit(1)
    .single()

  if (tarihErr) return NextResponse.json({ error: tarihErr.message }, { status: 500 })

  // O tarihteki tüm fonları çek — her fonKodu bir kez geliyor
  const { data: fonlar, error } = await supabase
    .from('tefas_fon_verileri')
    .select('fonKodu, fonTipi, fonUnvan')
    .eq('tarih', sonTarihRow.tarih)
    .order('fonKodu')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unique = new Map<string, { fonKodu: string; fonTipi: string; fonUnvan: string }>()
  for (const f of fonlar ?? []) {
    if (!unique.has(f.fonKodu)) {
      unique.set(f.fonKodu, { fonKodu: f.fonKodu, fonTipi: f.fonTipi, fonUnvan: f.fonUnvan ?? '' })
    }
  }

  let liste = [...unique.values()]

  const offset = offsetParam ? parseInt(offsetParam) : 0
  const limit = limitParam ? parseInt(limitParam) : 50
  liste = liste.slice(offset, offset + limit)

  const log: string[] = []
  let basarili = 0
  let hatali = 0

  // 5'erli batch — TEFAS rate limit
  for (let i = 0; i < liste.length; i += 5) {
    const batch = liste.slice(i, i + 5)
    const results = await Promise.allSettled(
      batch.map(f => fetchFonMeta(f.fonKodu, f.fonTipi, f.fonUnvan))
    )

    const rows: any[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') {
        rows.push(r.value)
        basarili++
      } else {
        hatali++
        log.push(`HATA: ${r.reason}`)
      }
    }

    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('tefas_fon_meta')
        .upsert(rows, { onConflict: 'fonKodu' })

      if (upsertErr) log.push(`Upsert hata: ${upsertErr.message}`)
    }

    // Rate limit için kısa bekleme
    if (i + 5 < liste.length) await new Promise(r => setTimeout(r, 300))
  }

  return NextResponse.json({
    ok: true,
    toplam: unique.size,
    islenen: liste.length,
    offset,
    limit,
    basarili,
    hatali,
    log,
  })
}
