import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const maxDuration = 60

// Hobby planı: tek invocation 60s'e sığmalı → her gün dönen dilim işlenir
const SLICE = 200

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

// resultList dolu gelene kadar yeniden dene (rate-limit düşüşlerine karşı)
async function postRetry(endpoint: string, body: object, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const d = await post(endpoint, body)
    if (d?.resultList?.length) return d
    if (i < tries - 1) await new Promise(r => setTimeout(r, 700 * (i + 1)))
  }
  return null
}

// GVK Geçici 67 / 27.03.2026 tarihli 11107 sayılı Cumhurbaşkanı Kararı
// Hisse senedi yoğun fon (>1 yıl) ve >2 yıl tutulan GSYF/GYF → %0; diğer tüm fonlar → %17.5
function hesaplaStopaj(fonTurAciklama: string | null, fonUnvan: string): number {
  const unvan = (fonUnvan ?? '').toUpperCase()
  const tur = (fonTurAciklama ?? '').toUpperCase()
  if (unvan.includes('HİSSE SENEDİ YOĞUN') || unvan.includes('HISSE SENEDI YOGUN')) return 0
  if (tur.includes('GİRİŞİM SERMAYES') || tur.includes('GIRISIM SERMAYES') ||
      tur.includes('GAYRİMENKUL') || tur.includes('GAYRIMENKUL')) return 0
  return 17.5
}

function hesaplaDovizli(fonUnvan: string): boolean {
  const unvan = (fonUnvan ?? '').toUpperCase()
  return unvan.includes('YABANCI') || unvan.includes('DÖVİZ') || unvan.includes('DOVIZ') ||
    unvan.includes('USD') || unvan.includes('EUR') || unvan.includes('ALTIN') || unvan.includes('DOLAR')
}

// Yönetim listelerini (YAT/EMK/BYF) bir kez topluca çek → fonKodu bazlı map
async function fetchYonetimMap() {
  const map = new Map<string, any>()
  for (const tip of FON_TIPLERI) {
    const d = await postRetry('fonYonetimBazliBilgiGetir', { fonTipi: tip, dil: 'TR' })
    for (const x of (d?.resultList as any[] ?? [])) {
      if (!map.has(x.fonKodu)) map.set(x.fonKodu, x)
    }
  }
  return map
}

async function fetchFonMeta(fonKodu: string, fonTipi: string, fonUnvan: string, yonetimMap: Map<string, any>) {
  const [profilBilgi, bilgi] = await Promise.all([
    postRetry('fonProfilBilgiGetir', { dil: 'TR', fonKodu }),
    postRetry('fonBilgiGetir', { dil: 'TR', fonKodu }),
  ])

  const p = profilBilgi?.resultList?.[0] ?? null
  const b = bilgi?.resultList?.[0] ?? null
  const y = yonetimMap.get(fonKodu) ?? null

  // fonTurAciklama: önce yönetim listesi, yoksa fonProfilDtyGetir.fonTuru fallback (kalkmış fonlar için)
  let fonTurAciklama = y?.fonTurAciklama ?? null
  if (!fonTurAciklama) {
    const dty = await postRetry('fonProfilDtyGetir', { dil: 'TR', fonKodu, periyod: '1' })
    fonTurAciklama = dty?.resultList?.[0]?.fonTuru ?? null
  }

  const unvan = p?.fonUnvan ?? b?.fonUnvan ?? fonUnvan

  return {
    fonKodu,
    fonUnvan: unvan,
    fonTipi,
    fonTurAciklama,
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
    stopaj: hesaplaStopaj(fonTurAciklama, unvan),
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

  // O tarihteki tüm fonları çek — Supabase 1000 satır limitini aşmak için sayfalı
  const fonlar: { fonKodu: string; fonTipi: string; fonUnvan: string }[] = []
  const PAGE = 1000
  for (let sayfa = 0; ; sayfa++) {
    const { data, error } = await supabase
      .from('tefas_fon_verileri')
      .select('fonKodu, fonTipi, fonUnvan')
      .eq('tarih', sonTarihRow.tarih)
      .order('fonKodu')
      .range(sayfa * PAGE, sayfa * PAGE + PAGE - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    fonlar.push(...data)
    if (data.length < PAGE) break
  }

  const unique = new Map<string, { fonKodu: string; fonTipi: string; fonUnvan: string }>()
  for (const f of fonlar) {
    if (!unique.has(f.fonKodu)) {
      unique.set(f.fonKodu, { fonKodu: f.fonKodu, fonTipi: f.fonTipi, fonUnvan: f.fonUnvan ?? '' })
    }
  }

  const tumListe = [...unique.values()]

  // offset verilmezse gün bazlı dönen pencere (Hobby: her gün farklı dilim, ~13 günde tam tur)
  const limit = limitParam ? parseInt(limitParam) : SLICE
  const gunIndex = Math.floor(Date.now() / 86_400_000)
  const dilimSayisi = Math.max(1, Math.ceil(tumListe.length / limit))
  const offset = offsetParam ? parseInt(offsetParam) : (gunIndex % dilimSayisi) * limit
  const liste = tumListe.slice(offset, offset + limit)

  // Yönetim verisini topluca al (per-fon çağrı yok → rate-limit'e takılmaz)
  const yonetimMap = await fetchYonetimMap()

  const log: string[] = []
  let basarili = 0
  let hatali = 0

  // 5'erli batch — TEFAS rate limit
  for (let i = 0; i < liste.length; i += 5) {
    const batch = liste.slice(i, i + 5)
    const results = await Promise.allSettled(
      batch.map(f => fetchFonMeta(f.fonKodu, f.fonTipi, f.fonUnvan, yonetimMap))
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
    if (i + 5 < liste.length) await new Promise(r => setTimeout(r, 200))
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
