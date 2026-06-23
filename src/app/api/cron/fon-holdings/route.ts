import { createAdminClient } from '@/lib/supabase/admin'
import { parseHoldings } from '@/lib/holdings-parser'
import { NextResponse } from 'next/server'

export const maxDuration = 60

async function pdfText(buf: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const p = new PDFParse({ data: new Uint8Array(buf) })
  const r = await p.getText()
  return r.text || ''
}

// Tek fon: ?fonKodu=TI2&url=<pdf-url>  → indir, parse, doğrula, kaydet
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const fonKodu = searchParams.get('fonKodu')?.toUpperCase()
  const url = searchParams.get('url')
  if (!fonKodu || !url) {
    return NextResponse.json({ error: 'fonKodu ve url gerekli' }, { status: 400 })
  }

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: `PDF indirilemedi: ${res.status}` }, { status: 502 })
    const buf = Buffer.from(await res.arrayBuffer())

    const text = await pdfText(buf)
    const sonuc = parseHoldings(text)

    if (!sonuc.gecerli) {
      // Regex doğrulaması başarısız → LLM fallback gerekiyor (henüz bağlı değil)
      return NextResponse.json({
        ok: false,
        fonKodu,
        neden: 'regex doğrulama başarısız — LLM fallback gerekli',
        gercekToplam: sonuc.gercekToplam,
        beklenenToplam: sonuc.beklenenToplam,
        hisseSayisi: sonuc.holdings.length,
      })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('tefas_fon_holdings').upsert({
      fonKodu,
      tarih: new Date().toISOString().slice(0, 10),
      hisseler: sonuc.holdings,
      kaynak: 'regex',
      gercekToplam: sonuc.gercekToplam,
      beklenenToplam: sonuc.beklenenToplam,
      guncellenmeTarihi: new Date().toISOString(),
    }, { onConflict: 'fonKodu' })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      fonKodu,
      kaynak: 'regex',
      hisseSayisi: sonuc.holdings.length,
      toplam: sonuc.gercekToplam,
      ilk5: sonuc.holdings.slice(0, 5),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
