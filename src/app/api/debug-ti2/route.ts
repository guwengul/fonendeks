import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // TEFAS'tan TI2'nin 2021-06-25 fiyatını şimdi çek — düzeltilmiş mi?
  const res = await fetch('https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetirDosya', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TEFAS_BEARER_TOKEN}`,
    },
    body: JSON.stringify({
      dil: 'TR', fonTipi: 'YAT',
      basTarih: '20210625', bitTarih: '20210625',
      fonKod: null, fonGrup: null, fonTurKod: null,
      fonUnvanTip: null, kurucuKod: null, fonTurAciklama: null, sfonTurKod: null,
    }),
  })

  const json = await res.json()
  const ti2 = (json?.data ?? []).find((r: any) => r.FONKODU === 'TI2')

  // DB'deki değerle karşılaştır
  const supabase = createAdminClient()
  const { data: dbRow } = await supabase
    .from('tefas_fon_verileri')
    .select('tarih, fiyat')
    .eq('fonKodu', 'TI2').eq('fonTipi', 'YAT').eq('tarih', '2021-06-25')
    .maybeSingle()

  return NextResponse.json({
    tefas_fiyat: ti2?.BIRIMPAYFIYATI,
    db_fiyat: dbRow?.fiyat,
    duzeltilmis_mi: ti2 ? Math.abs(ti2.BIRIMPAYFIYATI - (dbRow?.fiyat ?? 0)) > 1 : null,
  })
}
