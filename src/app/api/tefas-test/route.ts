import { NextResponse } from 'next/server'

const TOKEN = 'ST-tefaswebwse3irfmSBj4iRAzGPbAlS94Se'

async function post(url: string, body: object) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    return await r.json()
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const kod = searchParams.get('kod') ?? 'DPB'

  const [bilgi, fiyatBilgi, profil, tipi] = await Promise.all([
    post('https://www.tefas.gov.tr/api/funds/fonBilgiGetir', { dil: 'TR', fonKodu: kod }),
    post('https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir', { fonKodu: kod, dil: 'TR', periyod: 12 }),
    post('https://www.tefas.gov.tr/api/funds/fonProfilDtyGetir', { dil: 'TR', fonKodu: kod, periyod: '12' }),
    post('https://www.tefas.gov.tr/api/funds/fonTipiGetir', { fonKodu: kod }),
  ])

  return NextResponse.json({ bilgi, fiyatBilgi, profil, tipi })
}
