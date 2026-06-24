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
  fonTurAciklama: string | null
  stopaj: number | null
  yonetimUcreti: number | null
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

const TIP_AD: Record<string, string> = {
  YAT: 'Yatırım Fonu',
  EMK: 'Emeklilik Fonu',
  BYF: 'Borsa Yatırım Fonu',
}

const RISK_BAR: string[] = [
  '', 'bg-green-400', 'bg-green-400', 'bg-yellow-300',
  'bg-yellow-400', 'bg-orange-400', 'bg-red-400', 'bg-red-600',
]

function sirketAdi(fonUnvan: string | null): string {
  if (!fonUnvan) return '-'
  const kelimeler = fonUnvan.trim().split(/\s+/)
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
  return <span className={`font-medium ${renk}`}>{val >= 0 ? '+' : ''}{val.toFixed(2)}%</span>
}

function FonKart({ fon, mouseY }: { fon: Fon; mouseY: number }) {
  const top = Math.min(mouseY - 10, (typeof window !== 'undefined' ? window.innerHeight : 800) - 300)
  return (
    <div
      className="fixed left-4 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 pointer-events-none"
      style={{ top }}
    >
      <p className="text-sm font-semibold text-slate-800 leading-snug mb-1">{fon.fonUnvan ?? fon.fonKodu}</p>
      <p className="text-xs text-indigo-400 mb-4">{fon.fonKodu}</p>
      <div className="space-y-2.5 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Şirket</span>
          <span className="font-medium text-slate-700">{sirketAdi(fon.fonUnvan)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Tür</span>
          <span className="font-medium text-slate-700 text-right max-w-[160px]">{fon.fonTurAciklama ?? (TIP_AD[fon.fonTipi] ?? fon.fonTipi)}</span>
        </div>
        {fon.riskDegeri != null && (
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Risk</span>
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5,6,7].map(i => (
                <div key={i} className={`w-4 h-2.5 rounded-sm ${i <= fon.riskDegeri! ? RISK_BAR[fon.riskDegeri!] : 'bg-slate-100'}`} />
              ))}
              <span className="ml-1.5 font-bold text-slate-600">{fon.riskDegeri}/7</span>
            </div>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-400">Stopaj</span>
          <span className={`font-medium ${fon.stopaj === 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
            {fon.stopaj != null ? (fon.stopaj === 0 ? 'Yok (%0)' : `%${fon.stopaj}`) : '-'}
          </span>
        </div>
        {fon.yonetimUcreti != null && (
          <div className="flex justify-between">
            <span className="text-slate-400">Yönetim ücreti</span>
            <span className="font-medium text-slate-700">%{fon.yonetimUcreti}</span>
          </div>
        )}
      </div>
    </div>
  )
}

type SiraKey = 'portfoyBuyukluk' | 'kisiSayisi' | 'fiyat' | string

export default function FonListesi({
  fonlar, kurucular, fonTurleri,
}: {
  fonlar: Fon[]
  kurucular: string[]
  fonTurleri: string[]
}) {
  const [arama, setArama] = useState('')
  const [tip, setTip] = useState<'HEPSI' | 'YAT' | 'EMK' | 'BYF'>('YAT')
  const [kurucu, setKurucu] = useState('HEPSI')
  const [fonTur, setFonTur] = useState('HEPSI')
  const [risk, setRisk] = useState('HEPSI')
  const [vergi, setVergi] = useState('HEPSI')
  const [ucret, setUcret] = useState('HEPSI')
  const [siraKey, setSiraKey] = useState<SiraKey>('portfoyBuyukluk')
  const [siraAsc, setSiraAsc] = useState(false)
  const [hoveredFon, setHoveredFon] = useState<Fon | null>(null)
  const [mouseY, setMouseY] = useState(0)

  const handleMouseMove = useCallback((e: React.MouseEvent) => setMouseY(e.clientY), [])

  function handleSira(key: SiraKey) {
    if (siraKey === key) setSiraAsc(v => !v)
    else { setSiraKey(key); setSiraAsc(false) }
  }

  const filtrelenmis = fonlar
    .filter(f => {
      if (arama && !f.fonKodu.toLowerCase().includes(arama.toLowerCase()) &&
          !(f.fonUnvan ?? '').toLowerCase().includes(arama.toLowerCase())) return false
      if (tip !== 'HEPSI' && f.fonTipi !== tip) return false
      if (kurucu !== 'HEPSI' && f.kurucuKod !== kurucu) return false
      if (fonTur !== 'HEPSI' && f.fonTurAciklama !== fonTur) return false
      if (risk !== 'HEPSI') {
        const [min, max] = risk.split('-').map(Number)
        if (f.riskDegeri == null || f.riskDegeri < min || f.riskDegeri > (max ?? min)) return false
      }
      if (vergi === 'YOK' && f.stopaj !== 0) return false
      if (vergi === 'VAR' && (f.stopaj == null || f.stopaj === 0)) return false
      if (ucret === 'DUSUK' && (f.yonetimUcreti == null || f.yonetimUcreti >= 1)) return false
      if (ucret === 'ORTA' && (f.yonetimUcreti == null || f.yonetimUcreti < 1 || f.yonetimUcreti > 2)) return false
      if (ucret === 'YUKSEK' && (f.yonetimUcreti == null || f.yonetimUcreti <= 2)) return false
      return true
    })
    .sort((a, b) => {
      let av: number | null, bv: number | null
      if (DONEMLER.find(d => d.key === siraKey)) {
        av = a.getiriler[siraKey] ?? null; bv = b.getiriler[siraKey] ?? null
      } else {
        av = (a as any)[siraKey] ?? null; bv = (b as any)[siraKey] ?? null
      }
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return siraAsc ? av - bv : bv - av
    })

  const kurucuAdMap = new Map<string, string>()
  for (const f of fonlar) {
    if (f.kurucuKod && !kurucuAdMap.has(f.kurucuKod)) kurucuAdMap.set(f.kurucuKod, sirketAdi(f.fonUnvan))
  }

  function ThBtn({ col, label }: { col: string; label: string }) {
    const aktif = siraKey === col
    return (
      <th className="px-3 py-3 font-medium text-right cursor-pointer select-none hover:text-indigo-600 whitespace-nowrap"
        onClick={() => handleSira(col)}>
        {label}{aktif ? (siraAsc ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  const sel = 'border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400'

  return (
    <div>
      {/* Arama + şirket */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <input type="text" placeholder="Fon kodu veya unvan ara..." value={arama}
          onChange={e => setArama(e.target.value)}
          className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400" />
        <select value={kurucu} onChange={e => setKurucu(e.target.value)} className={sel}>
          <option value="HEPSI">Tüm şirketler</option>
          {kurucular.map(k => <option key={k} value={k}>{kurucuAdMap.get(k) ?? k}</option>)}
        </select>
      </div>

      {/* Filtre satırı */}
      <div className="flex flex-wrap gap-2 mb-5">
        {/* Fon tipi */}
        <div className="flex gap-1">
          {(['HEPSI', 'YAT', 'EMK', 'BYF'] as const).map(t => (
            <button key={t} onClick={() => setTip(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tip === t ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}
              title={TIP_AD[t]}>
              {t === 'HEPSI' ? 'Tümü' : t}
            </button>
          ))}
        </div>

        <select value={fonTur} onChange={e => setFonTur(e.target.value)} className={sel}>
          <option value="HEPSI">Tüm türler</option>
          {fonTurleri.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={risk} onChange={e => setRisk(e.target.value)} className={sel}>
          <option value="HEPSI">Risk: Tümü</option>
          <option value="1-2">Risk 1–2 (Düşük)</option>
          <option value="3-4">Risk 3–4 (Orta)</option>
          <option value="5-6">Risk 5–6 (Yüksek)</option>
          <option value="7-7">Risk 7 (Çok Yüksek)</option>
        </select>

        <select value={vergi} onChange={e => setVergi(e.target.value)} className={sel}>
          <option value="HEPSI">Stopaj: Tümü</option>
          <option value="YOK">Stopaj yok (%0)</option>
          <option value="VAR">Stopajlı</option>
        </select>

        <select value={ucret} onChange={e => setUcret(e.target.value)} className={sel}>
          <option value="HEPSI">Ücret: Tümü</option>
          <option value="DUSUK">Düşük (&lt;%1)</option>
          <option value="ORTA">Orta (%1–2)</option>
          <option value="YUKSEK">Yüksek (&gt;%2)</option>
        </select>
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
              {DONEMLER.map(d => <ThBtn key={d.key} col={d.key} label={d.label} />)}
            </tr>
          </thead>
          <tbody onMouseMove={handleMouseMove}>
            {filtrelenmis.map(f => (
              <tr key={`${f.fonKodu}-${f.fonTipi}`}
                className="border-b border-slate-50 hover:bg-indigo-50/40 transition-colors"
                onMouseEnter={() => setHoveredFon(f)}
                onMouseLeave={() => setHoveredFon(null)}>
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
