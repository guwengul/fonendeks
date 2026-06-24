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
  riskDegeri: number | null
  kurucuKod: string | null
  fonTurAciklama: string | null
  stopaj: number | null
  yonetimUcreti: number | null
  getiriler: Record<string, number | null>
}

const DONEMLER = [
  { key: '1g', label: '1G' }, { key: '1h', label: '1H' }, { key: '1a', label: '1A' },
  { key: '3a', label: '3A' }, { key: '6a', label: '6A' }, { key: 'yb', label: 'YBB' },
  { key: '1y', label: '1Y' }, { key: '3y', label: '3Y' }, { key: '5y', label: '5Y' },
]

function sirketAdi(fonUnvan: string | null): string {
  if (!fonUnvan) return '-'
  const kelimeler = fonUnvan.trim().split(/\s+/)
  const idx = kelimeler.findIndex(k => ['PORTFÖY', 'EMEKLİLİK', 'HAYAT', 'PORTFOY'].includes(k.toUpperCase()))
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
  return <span className={`font-medium ${val >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
    {val >= 0 ? '+' : ''}{val.toFixed(2)}%
  </span>
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}>
      {label}
    </button>
  )
}

function toggle(set: Set<string>, val: string): Set<string> {
  const next = new Set(set)
  next.has(val) ? next.delete(val) : next.add(val)
  return next
}

type SiraKey = 'portfoyBuyukluk' | 'kisiSayisi' | 'fiyat' | string

export default function FonListesi({ fonlar, kurucular, fonTurleri }: {
  fonlar: Fon[]; kurucular: string[]; fonTurleri: string[]
}) {
  const [arama, setArama] = useState('')
  const [tipler, setTipler] = useState(new Set<string>())
  const [riskler, setRiskler] = useState(new Set<string>())
  const [vergiler, setVergiler] = useState(new Set<string>())
  const [ucretler, setUcretler] = useState(new Set<string>())
  const [siraKey, setSiraKey] = useState<SiraKey>('portfoyBuyukluk')
  const [siraAsc, setSiraAsc] = useState(false)

  const kurucuAdMap = new Map<string, string>()
  for (const f of fonlar) {
    if (f.kurucuKod && !kurucuAdMap.has(f.kurucuKod)) kurucuAdMap.set(f.kurucuKod, sirketAdi(f.fonUnvan))
  }

  function handleSira(key: SiraKey) {
    if (siraKey === key) setSiraAsc(v => !v)
    else { setSiraKey(key); setSiraAsc(false) }
  }

  const filtrelenmis = fonlar.filter(f => {
    if (arama) {
      const q = arama.toLowerCase()
      const sirket = (kurucuAdMap.get(f.kurucuKod ?? '') ?? '').toLowerCase()
      if (!f.fonKodu.toLowerCase().includes(q) &&
          !(f.fonUnvan ?? '').toLowerCase().includes(q) &&
          !sirket.includes(q) &&
          !(f.fonTurAciklama ?? '').toLowerCase().includes(q)) return false
    }
    if (tipler.size > 0 && !tipler.has(f.fonTipi)) return false
    if (riskler.size > 0) {
      const r = f.riskDegeri
      const match = r != null && [...riskler].some(band => {
        const [min, max] = band.split('-').map(Number)
        return r >= min && r <= max
      })
      if (!match) return false
    }
    if (vergiler.size > 0) {
      if (vergiler.has('YOK') && !vergiler.has('VAR') && f.stopaj !== 0) return false
      if (vergiler.has('VAR') && !vergiler.has('YOK') && (f.stopaj == null || f.stopaj === 0)) return false
    }
    if (ucretler.size > 0) {
      const u = f.yonetimUcreti
      const match = u != null && [...ucretler].some(band => {
        if (band === 'DUSUK') return u < 1
        if (band === 'ORTA') return u >= 1 && u <= 2
        if (band === 'YUKSEK') return u > 2
        return false
      })
      if (!match) return false
    }
    return true
  }).sort((a, b) => {
    let av: number | null, bv: number | null
    if (DONEMLER.find(d => d.key === siraKey)) {
      av = a.getiriler[siraKey] ?? null; bv = b.getiriler[siraKey] ?? null
    } else {
      av = (a as any)[siraKey] ?? null; bv = (b as any)[siraKey] ?? null
    }
    if (av == null && bv == null) return 0
    if (av == null) return 1; if (bv == null) return -1
    return siraAsc ? av - bv : bv - av
  })

  function ThBtn({ col, label }: { col: string; label: string }) {
    const aktif = siraKey === col
    return (
      <th className="px-3 py-3 font-medium text-right cursor-pointer select-none hover:text-indigo-600 whitespace-nowrap"
        onClick={() => handleSira(col)}>
        {label}{aktif ? (siraAsc ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  return (
    <div>
      <input type="text" placeholder="Fon kodu, şirket, tür veya unvan ara..."
        value={arama} onChange={e => setArama(e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 mb-3" />

      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <span className="text-xs text-slate-400 mr-1">Tür</span>
        <Chip label="Yatırım Fonu" active={tipler.has('YAT')} onClick={() => setTipler(s => toggle(s, 'YAT'))} />
        <Chip label="Emeklilik Fonu" active={tipler.has('EMK')} onClick={() => setTipler(s => toggle(s, 'EMK'))} />
        <Chip label="Borsa Yatırım Fonu" active={tipler.has('BYF')} onClick={() => setTipler(s => toggle(s, 'BYF'))} />

        <span className="text-xs text-slate-300 mx-1">|</span>
        <span className="text-xs text-slate-400 mr-1">Risk</span>
        <Chip label="1–2" active={riskler.has('1-2')} onClick={() => setRiskler(s => toggle(s, '1-2'))} />
        <Chip label="3–4" active={riskler.has('3-4')} onClick={() => setRiskler(s => toggle(s, '3-4'))} />
        <Chip label="5–6" active={riskler.has('5-6')} onClick={() => setRiskler(s => toggle(s, '5-6'))} />
        <Chip label="7" active={riskler.has('7-7')} onClick={() => setRiskler(s => toggle(s, '7-7'))} />

        <span className="text-xs text-slate-300 mx-1">|</span>
        <span className="text-xs text-slate-400 mr-1">Stopaj</span>
        <Chip label="Vergisiz" active={vergiler.has('YOK')} onClick={() => setVergiler(s => toggle(s, 'YOK'))} />
        <Chip label="Vergili" active={vergiler.has('VAR')} onClick={() => setVergiler(s => toggle(s, 'VAR'))} />

        <span className="text-xs text-slate-300 mx-1">|</span>
        <span className="text-xs text-slate-400 mr-1">Ücret</span>
        <Chip label="<%1" active={ucretler.has('DUSUK')} onClick={() => setUcretler(s => toggle(s, 'DUSUK'))} />
        <Chip label="%1–2" active={ucretler.has('ORTA')} onClick={() => setUcretler(s => toggle(s, 'ORTA'))} />
        <Chip label=">%2" active={ucretler.has('YUKSEK')} onClick={() => setUcretler(s => toggle(s, 'YUKSEK'))} />
      </div>

      <p className="text-slate-400 text-sm mb-3">{filtrelenmis.length} fon</p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 bg-white">
            <tr className="border-b border-slate-100 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium sticky left-0 bg-white z-30">Kod</th>
              <ThBtn col="fiyat" label="Fiyat" />
              <ThBtn col="portfoyBuyukluk" label="Portföy" />
              <ThBtn col="kisiSayisi" label="Yatırımcı" />
              {DONEMLER.map(d => <ThBtn key={d.key} col={d.key} label={d.label} />)}
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.map(f => (
              <tr key={`${f.fonKodu}-${f.fonTipi}`}
                className="border-b border-slate-50 hover:bg-indigo-50/40 transition-colors">
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <Link href={`/fon/${f.fonKodu}?tip=${f.fonTipi}`} className="block group">
                    <span className="font-mono font-semibold text-indigo-600 group-hover:text-indigo-800 transition-colors">{f.fonKodu}</span>
                    {f.fonUnvan && <span className="block text-xs text-slate-400 font-normal max-w-[220px] truncate">{f.fonUnvan}</span>}
                  </Link>
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-700">{f.fiyat != null ? f.fiyat.toFixed(4) : '-'}</td>
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
