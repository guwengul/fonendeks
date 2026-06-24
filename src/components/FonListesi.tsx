'use client'

import { useState, useCallback } from 'react'
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

const RISK_BAR_RENK = [
  '', 'bg-green-400', 'bg-green-400', 'bg-yellow-400',
  'bg-yellow-400', 'bg-orange-400', 'bg-red-400', 'bg-red-600',
]

// "AK PORTFÖY BİST 30..." → "Ak Portföy"
function sirketAdi(fonUnvan: string | null): string {
  if (!fonUnvan) return '-'
  const kelimeler = fonUnvan.trim().split(/\s+/)
  // İlk "PORTFÖY"/"EMEKLİLİK"/"HAYAT" ile biten kısmı al
  const idx = kelimeler.findIndex(k =>
    ['PORTFÖY', 'EMEKLİLİK', 'HAYAT', 'PORTFOY'].includes(k.toUpperCase())
  )
  const slice = idx >= 0 ? kelimeler.slice(0, idx + 1) : kelimeler.slice(0, 2)
  return slice.map(k => k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()).join(' ')
}

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

function FonKart({ fon, mouseY }: { fon: Fon; mouseY: number }) {
  const top = Math.min(mouseY - 10, window.innerHeight - 320)
  return (
    <div
      className="fixed left-4 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 pointer-events-none"
      style={{ top }}
    >
      <p className="text-sm font-semibold text-slate-800 leading-snug mb-1">{fon.fonUnvan ?? fon.fonKodu}</p>
      <p className="text-xs text-slate-400 mb-4">{fon.fonKodu} · {fon.fonTipi}</p>
      <div className="space-y-2.5 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Şirket</span>
          <span className="font-medium text-slate-700">{sirketAdi(fon.fonUnvan)}</span>
        </div>
        {fon.riskDegeri != null && (
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Risk</span>
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5,6,7].map(i => (
                <div key={i} className={`w-4 h-2.5 rounded-sm ${i <= fon.riskDegeri! ? RISK_BAR_RENK[fon.riskDegeri!] : 'bg-slate-100'}`} />
              ))}
              <span className="ml-1.5 font-bold text-slate-600">{fon.riskDegeri}/7</span>
            </div>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-400">Portföy</span>
          <span className="font-medium text-slate-700">{fmt(fon.portfoyBuyukluk)} ₺</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Yatırımcı</span>
          <span className="font-medium text-slate-700">{fon.kisiSayisi?.toLocaleString('tr-TR') ?? '-'}</span>
        </div>
        <div className="border-t border-slate-100 pt-3 grid grid-cols-4 gap-2">
          {(['1g','1a','yb','1y'] as const).map(k => (
            <div key={k} className="text-center">
              <div className="text-slate-400 text-[10px] uppercase mb-1">{k === 'yb' ? 'YBB' : k}</div>
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
  const [hoveredFon, setHoveredFon] = useState<Fon | null>(null)
  const [mouseY, setMouseY] = useState(0)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMouseY(e.clientY)
  }, [])

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

  // Kurucu dropdown için: kurucuKod → şirket adı (fonUnvan'dan türet)
  const kurucuAdMap = new Map<string, string>()
  for (const f of fonlar) {
    if (f.kurucuKod && !kurucuAdMap.has(f.kurucuKod)) {
      kurucuAdMap.set(f.kurucuKod, sirketAdi(f.fonUnvan))
    }
  }

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
          {kurucular.map(k => (
            <option key={k} value={k}>{kurucuAdMap.get(k) ?? k}</option>
          ))}
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

      {hoveredFon && <FonKart fon={hoveredFon} mouseY={mouseY} />}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 bg-white">
            <tr className="border-b border-slate-100 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium sticky left-0 bg-white z-30">Kod</th>
              <ThBtn col="fiyat" label="Fiyat" />
              <ThBtn col="portfoyBuyukluk" label="Portföy" />
              <ThBtn col="kisiSayisi" label="Yatırımcı" />
              {DONEMLER.map(d => (
                <ThBtn key={d.key} col={d.key} label={d.label} />
              ))}
            </tr>
          </thead>
          <tbody onMouseMove={handleMouseMove}>
            {filtrelenmis.map(f => (
              <tr
                key={`${f.fonKodu}-${f.fonTipi}`}
                className="border-b border-slate-50 hover:bg-indigo-50/40 transition-colors"
                onMouseEnter={() => setHoveredFon(f)}
                onMouseLeave={() => setHoveredFon(null)}
              >
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <Link href={`/fon/${f.fonKodu}?tip=${f.fonTipi}`} className="block group">
                    <span className="font-mono font-semibold text-indigo-600 group-hover:text-indigo-800 transition-colors">
                      {f.fonKodu}
                    </span>
                    {f.fonUnvan && (
                      <span className="block text-xs text-slate-400 font-normal max-w-[220px] truncate">
                        {f.fonUnvan}
                      </span>
                    )}
                  </Link>
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
