import { NextResponse } from 'next/server'

const TOKEN = 'ST-tefaswebwse3irfmSBj4iRAzGPbAlS94Se'
const BASE = 'https://www.tefas.gov.tr/api/funds'
const BASE_STATS = 'https://www.tefas.gov.tr/api/statistics/tefas'

async function tryPost(name: string, url: string, body: object) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const text = await r.text()
    if (!r.ok) return { _skip: true, _status: r.status }
    try {
      const data = JSON.parse(text)
      const list = data?.resultList
      if (Array.isArray(list) && list.length > 0) return { _hit: true, data }
      if (!Array.isArray(list) && data && !data.errorCode && Object.keys(data).some(k => !k.startsWith('error'))) return { _hit: true, data }
      return { _skip: true, _empty: true }
    } catch {
      return { _skip: true, _parseError: true }
    }
  } catch (e: any) {
    return { _skip: true, _error: e.message }
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const kod = searchParams.get('kod') ?? 'ABG'

  const tests: { name: string; url: string; body: object }[] = [
    // Farklı parametre kombinasyonları - varlık dağılımı
    { name: 'fonVarlikDagilimGetir_v1', url: `${BASE}/fonVarlikDagilimGetir`, body: { fonKodu: kod } },
    { name: 'fonVarlikDagilimGetir_v2', url: `${BASE}/fonVarlikDagilimGetir`, body: { dil: 'TR', fonKodu: kod, tarih: '' } },
    { name: 'fonVarlikDagilimi_v1',     url: `${BASE}/fonVarlikDagilimi`,     body: { fonKodu: kod } },
    { name: 'fonPortfoyDagilimi',        url: `${BASE}/fonPortfoyDagilimi`,    body: { dil: 'TR', fonKodu: kod } },
    { name: 'fonPortfoyGetir_v1',        url: `${BASE}/fonPortfoyGetir`,       body: { fonKodu: kod } },
    { name: 'fonPortfoyGetir_v2',        url: `${BASE}/fonPortfoyGetir`,       body: { dil: 'TR', fonKodu: kod, tarih: '' } },
    { name: 'fonYatirimAraci',           url: `${BASE}/fonYatirimAraci`,       body: { dil: 'TR', fonKodu: kod } },
    { name: 'fonYatirimAraclari',        url: `${BASE}/fonYatirimAraclari`,    body: { dil: 'TR', fonKodu: kod } },
    { name: 'fonHolding',                url: `${BASE}/fonHolding`,            body: { dil: 'TR', fonKodu: kod } },
    // ISIN / detay
    { name: 'fonKart',                   url: `${BASE}/fonKart`,               body: { dil: 'TR', fonKodu: kod } },
    { name: 'fonDetay',                  url: `${BASE}/fonDetay`,              body: { dil: 'TR', fonKodu: kod } },
    { name: 'fonBilgi',                  url: `${BASE}/fonBilgi`,              body: { dil: 'TR', fonKodu: kod } },
    { name: 'fonIslemSaatleri',          url: `${BASE}/fonIslemSaatleri`,      body: { dil: 'TR', fonKodu: kod } },
    { name: 'fonKomisyon',               url: `${BASE}/fonKomisyon`,           body: { dil: 'TR', fonKodu: kod } },
    { name: 'fonRisk',                   url: `${BASE}/fonRisk`,               body: { dil: 'TR', fonKodu: kod } },
    { name: 'fonIsin',                   url: `${BASE}/fonIsin`,               body: { dil: 'TR', fonKodu: kod } },
    // statistics altı
    { name: 'stats_varlik',              url: `${BASE_STATS}/fonVarlik`,       body: { fonKodu: kod } },
    { name: 'stats_portfoy',             url: `${BASE_STATS}/fonPortfoy`,      body: { fonKodu: kod } },
    { name: 'stats_getFonVarlik',        url: `${BASE_STATS}/getFonVarlik`,    body: { fonKodu: kod, dil: 'TR' } },
    { name: 'stats_getFonDetay',         url: `${BASE_STATS}/getFonDetay`,     body: { fonKodu: kod, dil: 'TR' } },
    { name: 'stats_getFonDagilim',       url: `${BASE_STATS}/getFonDagilim`,   body: { fonKodu: kod, dil: 'TR' } },
    // fonGnlBlgSiraliGetirDosya - kron ile kullanilan, farklı param
    { name: 'fonGnlBilgi',               url: `${BASE}/fonGnlBilgi`,           body: { dil: 'TR', fonKodu: kod } },
    { name: 'fonGnlBlgGetir',            url: `${BASE}/fonGnlBlgGetir`,        body: { dil: 'TR', fonKodu: kod } },
    // GET denemeleri
    { name: 'GET_fonDetay',              url: `${BASE}/fonDetay?fonKodu=${kod}&dil=TR`, body: {} },
  ]

  const results = await Promise.all(tests.map(t => tryPost(t.name, t.url, t.body).then(r => ({ name: t.name, ...r }))))

  const hits = results.filter(r => r._hit)
  const misses = results.filter(r => !r._hit).map(r => r.name)

  return NextResponse.json({ hits, misses })
}
