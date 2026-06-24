import { NextResponse } from 'next/server'

export const maxDuration = 60

// Hobby planı: 2 cron limiti → fiyat + dağılımı tek cron'da sırayla çalıştıran orkestratör.
// İkisi de ucuz (toplam ~6 TEFAS çağrısı), 60s'e rahat sığar.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = new URL(req.url).origin
  const h = { Authorization: `Bearer ${process.env.CRON_SECRET}` }

  const cagir = (path: string) =>
    fetch(`${origin}${path}`, { headers: h, cache: 'no-store' })
      .then(r => r.json())
      .catch((e: any) => ({ ok: false, error: e.message }))

  // Fiyat önce, sonra fiyata bağlı özet; dağılım/benchmark bağımsız
  const fiyat = await cagir('/api/cron/tefas-daily')
  const ozet = await cagir('/api/cron/fon-ozet') // anasayfa precompute (fiyat sonrası)
  const dagilim = await cagir('/api/cron/fon-dagilim')
  const benchmark = await cagir('/api/cron/benchmark')

  return NextResponse.json({ ok: true, fiyat, ozet, dagilim, benchmark })
}
