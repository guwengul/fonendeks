'use client'

import { useState } from 'react'
import Link from 'next/link'

type Fon = {
  fonKodu: string
  fonUnvan: string | null
  fonTipi: string
  fiyat: number | null
  portfoyBuyukluk: number | null
  kisiSayisi: number | null
  tarih: string
}

function fmt(n: number | null) {
  if (n == null) return '-'
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' Mr'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' Mn'
  return n.toLocaleString('tr-TR')
}

const TIP_RENK: Record<string, string> = {
  YAT: 'bg-blue-500/20 text-blue-300',
  EMK: 'bg-emerald-500/20 text-emerald-300',
  BYF: 'bg-purple-500/20 text-purple-300',
}

export default function FonListesi({ fonlar }: { fonlar: Fon[] }) {
  const [arama, setArama] = useState('')
  const [tip, setTip] = useState<'HEPSI' | 'YAT' | 'EMK' | 'BYF'>('HEPSI')

  const filtrelenmis = fonlar.filter(f => {
    const aramaEsles = arama === '' ||
      f.fonKodu.toLowerCase().includes(arama.toLowerCase()) ||
      (f.fonUnvan ?? '').toLowerCase().includes(arama.toLowerCase())
    const tipEsles = tip === 'HEPSI' || f.fonTipi === tip
    return aramaEsles && tipEsles
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Fon kodu veya unvan ara..."
          value={arama}
          onChange={e => setArama(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
        <div className="flex gap-2">
          {(['HEPSI', 'YAT', 'EMK', 'BYF'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTip(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tip === t
                  ? 'bg-white text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <p className="text-zinc-500 text-sm mb-3">{filtrelenmis.length} fon</p>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-left">
              <th className="px-4 py-3 font-medium">Kod</th>
              <th className="px-4 py-3 font-medium">Fon Unvanı</th>
              <th className="px-4 py-3 font-medium">Tip</th>
              <th className="px-4 py-3 font-medium text-right">Fiyat</th>
              <th className="px-4 py-3 font-medium text-right">Portföy</th>
              <th className="px-4 py-3 font-medium text-right">Kişi</th>
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.map(f => (
              <tr
                key={`${f.fonKodu}-${f.fonTipi}`}
                className="border-b border-zinc-800/50 hover:bg-zinc-900 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/fon/${f.fonKodu}?tip=${f.fonTipi}`}
                    className="font-mono font-semibold text-white hover:text-blue-400 transition-colors"
                  >
                    {f.fonKodu}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-300 max-w-xs truncate">
                  {f.fonUnvan ?? '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIP_RENK[f.fonTipi] ?? ''}`}>
                    {f.fonTipi}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-zinc-200">
                  {f.fiyat != null ? f.fiyat.toFixed(6) : '-'}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {fmt(f.portfoyBuyukluk)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {f.kisiSayisi?.toLocaleString('tr-TR') ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
