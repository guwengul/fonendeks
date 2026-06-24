'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

type Fon = {
  fonKodu: string
  fonUnvan: string | null
  fonTipi: string
  fiyat: number | null
  portfoyBuyukluk: number | null
  kisiSayisi: number | null
  tarih: string
  riskDegeri: number | null
  kurucuKod: string | null
  getiriler: Record<string, number | null>
}

const DONEMLER = [
  { key: '1g',  label: '1G'  },
  { key: '1h',  label: '1H'  },
  { key: '1a',  label: '1A'  },
  { key: '3a',  label: '3A'  },
  { key: '6a',  label: '6A'  },
  { key: 'yb',  label: 'YBB' },
  { key: '1y',  label: '1Y'  },
  { key: '3y',  label: '3Y'  },
  { key: '5y',  label: '5Y'  },
]

const TIP_RENK: Record<string, string> = {
  YAT: 'bg-indigo-50 text-indigo-600',
  EMK: 'bg-emerald-50 text-emerald-600',
  BYF: 'bg-purple-50 text-purple-600',
}

const RISK_RENK = ['', 'bg-green-100 text-green-700', 'bg-green-100 text-green-700',
  'bg-yellow-100 text-yellow-700', 'bg-yellow-100 text-yellow-700',
  'bg-orange-100 text-orange-700', 'bg-red-100 text-red-600', 'bg-red-200 text-red-700']

function fmt(n: number | null) {
  if (n == null) return '-'
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' Mr'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' Mn'
  return n.toLocaleString('tr-TR')
}

function GetiriCell({ val }: { val: number | null }) {
  if (val == null) return <span className="text-slate-300">-</span>
  const renk = val >= 0 ? 'text-emerald-600' : 'text-red-500'
  const isaret = val >= 0 ? '+' : ''
  return <span className={`font-medium ${renk}`}>{isaret}{val.toFixed(2)}%</span>
}

function FonKart({ fon }: { fon: Fon }) {
  return (
    <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 pointer-events-none">
      <p className="text-sm font-semibold text-slate-800 leading-snug mb-3">{fon.fonUnvan ?? fon.fonKodu}</p>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Kurucu</span>
          <span className="font-medium text-slate-700">{fon.kurucuKod ?? '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Tür</span>
          <span className={`px-2 py-0.5 rounded font-medium ${TIP_RENK[fon.fonTipi] ?? ''}`}>{fon.fonTipi}</span>
        </div>
        {fon.riskDegeri != null && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Risk</span>
            <span className={`px-2 py-0.5 rounded font-bold ${RISK_RENK[fon.riskDegeri] ?? ''}`}>
              {fon.riskDegeri}/7
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Portföy</span>
          <span className="font-medium text-slate-700">{fmt(fon.portfoyBuyukluk)} ₺</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Yatırımcı</span>
          <span className="font-medium text-slate-700">{fon.kisiSayisi?.toLocaleString('tr-TR') ?? '-'}</span>
        </div>
        <div className="border-t border-slate-100 pt-2 mt-2 grid grid-cols-3 gap-1">
          {(['1g','1a','1y'] as const).map(k => (
            <div key={k} className="text-center">
              <div className="text-slate-400 text-[10px] uppercase">{k}</div>
              <GetiriCell val={fon.getiriler[k]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type SiraKey = 'portfoyBuyukluk' | 'kisiSayisi' | 'fiyat' | string

export default function FonListesi({ fonlar, kurucular }: { fonlar: Fon[]; kurucular: string[] }) {
  const [arama, setArama] = useState('')
  const [tip, setTip] = useState<'HEPSI' | 'YAT' | 'EMK' | 'BYF'>('YAT')
  const [kurucu, setKurucu] = useState<string>('HEPSI')
  const [siraKey, setSiraKey] = useState<SiraKey>('portfoyBuyukluk')
  const [siraAsc, setSiraAsc] = useState(false)
  const [hoveredKod, setHoveredKod] = useState<string | null>(null)

  function handleSira(key: SiraKey) {
    if (siraKey === key) setSiraAsc(v => !v)
    else { setSiraKey(key); setSiraAsc(false) }
  }

  const filtrelenmis = fonlar
    .filter(f => {
      const aramaEsles = arama === '' ||
        f.fonKodu.toLowerCase().includes(arama.toLowerCase()) ||
        (f.fonUnvan ?? '').toLowerCase().includes(arama.toLowerCase())
      const tipEsles = tip === 'HEPSI' || f.fonTipi === tip
      const kurucuEsles = kurucu === 'HEPSI' || f.kurucuKod === kurucu
      return aramaEsles && tipEsles && kurucuEsles
    })
    .sort((a, b) => {
      let av: number | null, bv: number | null
      if (DONEMLER.find(d => d.key === siraKey)) {
        av = a.getiriler[siraKey] ?? null
        bv = b.getiriler[siraKey] ?? null
      } else {
        av = (a as any)[siraKey] ?? null
        bv = (b as any)[siraKey] ?? null
      }
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return siraAsc ? av - bv : bv - av
    })

  function ThBtn({ col, label }: { col: string; label: string }) {
    const aktif = siraKey === col
    return (
      <th
        className="px-3 py-3 font-medium text-right cursor-pointer select-none hover:text-indigo-600 whitespace-nowrap"
        onClick={() => handleSira(col)}
      >
        {label}{aktif ? (siraAsc ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Fon kodu veya unvan ara..."
          value={arama}
          onChange={e => setArama(e.target.value)}
          className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
        <select
          value={kurucu}
          onChange={e => setKurucu(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400"
        >
          <option value="HEPSI">Tüm şirketler</option>
          {kurucular.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mb-5">
        {(['HEPSI', 'YAT', 'EMK', 'BYF'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTip(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tip === t
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <p className="text-slate-400 text-sm mb-3">{filtrelenmis.length} fon</p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 bg-white">
            <tr className="border-b border-slate-100 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium sticky left-0 bg-white z-30">Kod</th>
              <th className="px-4 py-3 font-medium">Tip</th>
              <th className="px-3 py-3 font-medium text-center">Risk</th>
              <ThBtn col="fiyat" label="Fiyat" />
              <ThBtn col="portfoyBuyukluk" label="Portföy" />
              <ThBtn col="kisiSayisi" label="Yatırımcı" />
              {DONEMLER.map(d => (
                <ThBtn key={d.key} col={d.key} label={d.label} />
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.map(f => (
              <tr
                key={`${f.fonKodu}-${f.fonTipi}`}
                className="border-b border-slate-50 hover:bg-indigo-50/40 transition-colors"
              >
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <div
                    className="relative"
                    onMouseEnter={() => setHoveredKod(`${f.fonKodu}-${f.fonTipi}`)}
                    onMouseLeave={() => setHoveredKod(null)}
                  >
                    <Link
                      href={`/fon/${f.fonKodu}?tip=${f.fonTipi}`}
                      className="block group"
                    >
                      <span className="font-mono font-semibold text-indigo-600 group-hover:text-indigo-800 transition-colors">
                        {f.fonKodu}
                      </span>
                      {f.fonUnvan && (
                        <span className="block text-xs text-slate-400 font-normal max-w-[220px] truncate">
                          {f.fonUnvan}
                        </span>
                      )}
                    </Link>
                    {hoveredKod === `${f.fonKodu}-${f.fonTipi}` && <FonKart fon={f} />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIP_RENK[f.fonTipi] ?? ''}`}>
                    {f.fonTipi}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  {f.riskDegeri != null
                    ? <span className={`px-2 py-0.5 rounded text-xs font-bold ${RISK_RENK[f.riskDegeri] ?? ''}`}>{f.riskDegeri}</span>
                    : <span className="text-slate-300">-</span>
                  }
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-700">
                  {f.fiyat != null ? f.fiyat.toFixed(4) : '-'}
                </td>
                <td className="px-3 py-3 text-right text-slate-600">{fmt(f.portfoyBuyukluk)}</td>
                <td className="px-3 py-3 text-right text-slate-600">{f.kisiSayisi?.toLocaleString('tr-TR') ?? '-'}</td>
                {DONEMLER.map(d => (
                  <td key={d.key} className="px-3 py-3 text-right">
                    <GetiriCell val={f.getiriler[d.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
