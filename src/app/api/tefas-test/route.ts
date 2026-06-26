import { NextResponse } from 'next/server'

const TOKEN = 'ST-tefaswebwse3irfmSBj4iRAzGPbAlS94Se'
const BASE_FUNDS = 'https://www.tefas.gov.tr/api/funds'
const BASE_STATS = 'https://www.tefas.gov.tr/api/statistics/tefas'

async function post(url: string, body: object) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const status = r.status
    if (!r.ok) return { _status: status, _error: `HTTP ${status}` }
    const data = await r.json()
    return { _status: status, ...data }
  } catch (e: any) {
    return { _error: e.message }
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const kod = searchParams.get('kod') ?? 'DPB'

  const endpoints = [
    // Bilinen
    { key: 'fonBilgiGetir',       url: `${BASE_FUNDS}/fonBilgiGetir`,       body: { dil: 'TR', fonKodu: kod } },
    { key: 'fonProfilDtyGetir',   url: `${BASE_FUNDS}/fonProfilDtyGetir`,   body: { dil: 'TR', fonKodu: kod, periyod: '12' } },
    { key: 'fonTipiGetir',        url: `${BASE_FUNDS}/fonTipiGetir`,        body: { fonKodu: kod } },
    { key: 'fonFiyatBilgiGetir', url: `${BASE_FUNDS}/fonFiyatBilgiGetir`,  body: { dil: 'TR', fonKodu: kod, baslangicTarihi: '', bitisTarihi: '' } },
    // Tahmin - fon detay
    { key: 'fonDetayGetir',       url: `${BASE_FUNDS}/fonDetayGetir`,       body: { dil: 'TR', fonKodu: kod } },
    { key: 'fonDetayBilgiGetir',  url: `${BASE_FUNDS}/fonDetayBilgiGetir`,  body: { dil: 'TR', fonKodu: kod } },
    { key: 'fonIslemBilgiGetir',  url: `${BASE_FUNDS}/fonIslemBilgiGetir`,  body: { dil: 'TR', fonKodu: kod } },
    { key: 'fonRiskGetir',        url: `${BASE_FUNDS}/fonRiskGetir`,        body: { dil: 'TR', fonKodu: kod } },
    { key: 'fonIsinGetir',        url: `${BASE_FUNDS}/fonIsinGetir`,        body: { dil: 'TR', fonKodu: kod } },
    // Tahmin - varlık dağılımı
    { key: 'fonVarlikDagilimi',   url: `${BASE_FUNDS}/fonVarlikDagilimi`,   body: { dil: 'TR', fonKodu: kod } },
    { key: 'fonVarlikDagilimGetir', url: `${BASE_FUNDS}/fonVarlikDagilimGetir`, body: { dil: 'TR', fonKodu: kod } },
    { key: 'fonPortfoyGetir',     url: `${BASE_FUNDS}/fonPortfoyGetir`,     body: { dil: 'TR', fonKodu: kod } },
    { key: 'fonPortfoyBilgiGetir',url: `${BASE_FUNDS}/fonPortfoyBilgiGetir`,body: { dil: 'TR', fonKodu: kod } },
    { key: 'fonDagilimGetir',     url: `${BASE_FUNDS}/fonDagilimGetir`,     body: { dil: 'TR', fonKodu: kod } },
    { key: 'fonAssetGetir',       url: `${BASE_FUNDS}/fonAssetGetir`,       body: { dil: 'TR', fonKodu: kod } },
    // statistics altında
    { key: 'getFplDovizList',     url: `${BASE_STATS}/getFplDovizList/v2`,  body: { fonKodu: kod, dil: 'TR' } },
    { key: 'getFplFonList',       url: `${BASE_STATS}/getFplFonList`,       body: {} },
    { key: 'fonVarlik',           url: `${BASE_STATS}/fonVarlik`,           body: { fonKodu: kod } },
    { key: 'fonPortfoy',          url: `${BASE_STATS}/fonPortfoy`,          body: { fonKodu: kod } },
  ]

  const results = await Promise.all(
    endpoints.map(async e => ({ key: e.key, result: await post(e.url, e.body) }))
  )

  // Sadece error olmayan ve anlamlı veri dönenleri göster
  const output: Record<string, any> = {}
  for (const { key, result } of results) {
    const hasError = result._error || result._status === 404 || result._status === 405 || result._status === 500
    const isEmpty = result.resultList?.length === 0
    if (!hasError && !isEmpty) {
      output[key] = result
    } else {
      output[key] = { _skip: true, _status: result._status, _error: result._error }
    }
  }

  return NextResponse.json(output)
}
