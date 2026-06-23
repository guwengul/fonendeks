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
    const status = r.status
    const text = await r.text()
    if (!r.ok) return { _status: status, _skip: true }
    try {
      const data = JSON.parse(text)
      const list = data?.resultList ?? data
      const hasData = Array.isArray(list) ? list.length > 0 : (data && Object.keys(data).length > 0 && !data.errorCode)
      return { _status: status, _hasData: hasData, data }
    } catch {
      return { _status: status, _skip: true, _parseError: true }
    }
  } catch (e: any) {
    return { _skip: true, _error: e.message }
  }
}

async function scrapeEndpoints() {
  // TEFAS ana sayfasından JS bundle URL'lerini çek
  const pageRes = await fetch('https://www.tefas.gov.tr/tr/fon-detayli-analiz/ABG', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
    cache: 'no-store',
  })
  const html = await pageRes.text()

  // JS bundle'larındaki endpoint isimlerini ara
  const scriptUrls = [...html.matchAll(/src="([^"]*\/_next\/static[^"]*\.js)"/g)].map(m => m[1])

  const endpoints: string[] = []
  for (const src of scriptUrls.slice(0, 5)) {
    try {
      const url = src.startsWith('http') ? src : `https://www.tefas.gov.tr${src}`
      const jsRes = await fetch(url, { cache: 'no-store' })
      const js = await jsRes.text()
      // api/funds/ veya api/statistics/ geçen yerleri bul
      const found = [...js.matchAll(/api\/funds\/(\w+)/g)].map(m => m[1])
      const found2 = [...js.matchAll(/api\/statistics\/tefas\/(\w+)/g)].map(m => m[1])
      endpoints.push(...found, ...found2)
    } catch {}
  }

  return [...new Set(endpoints)]
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const kod = searchParams.get('kod') ?? 'ABG'

  const [discovered, htmlLen] = await Promise.all([
    scrapeEndpoints(),
    fetch('https://www.tefas.gov.tr/tr/fon-detayli-analiz/ABG', {
      headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store'
    }).then(r => r.text()).then(t => t.length),
  ])

  // Bulunan endpoint'leri dene
  const BASE = 'https://www.tefas.gov.tr/api/funds'
  const toTest = [...new Set([
    ...discovered,
    'fonDetayGetir', 'fonDetayBilgiGetir', 'fonIslemBilgiGetir',
    'fonRiskGetir', 'fonIsinGetir', 'fonVarlikDagilimi',
    'fonVarlikDagilimGetir', 'fonPortfoyGetir', 'fonPortfoyBilgiGetir',
    'fonDagilimGetir', 'fonKartGetir', 'fonKartBilgiGetir',
    'fonGenel', 'fonGenelBilgi', 'fonOzetGetir',
  ])]

  const results = await Promise.all(
    toTest.map(async name => ({
      name,
      result: await post(`${BASE}/${name}`, { dil: 'TR', fonKodu: kod })
    }))
  )

  const found = results.filter(r => !r.result._skip && r.result._hasData)
  const notFound = results.filter(r => r.result._skip || !r.result._hasData).map(r => r.name)

  return NextResponse.json({
    htmlLength: htmlLen,
    discoveredFromJs: discovered,
    foundEndpoints: found.map(r => ({ name: r.name, data: r.result.data })),
    notFound,
  })
}
