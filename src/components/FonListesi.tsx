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


function FilterGroup({ label, options, value, onChange }: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-slate-400 whitespace-nowrap">{label}</span>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            value === o.value
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

type SiraKey = 'portfoyBuyukluk' | 'kisiSayisi' | 'fiyat' | string

export default function FonListesi({ fonlar, kurucular, fonTurleri }: {
  fonlar: Fon[]; kurucular: string[]; fonTurleri: string[]
}) {
  const [arama, setArama] = useState('')
  const [tip, setTip] = useState('HEPSI')
  const [risk, setRisk] = useState('HEPSI')
  const [vergi, setVergi] = useState('HEPSI')
  const [ucret, setUcret] = useState('HEPSI')
  const [siraKey, setSiraKey] = useState<SiraKey>('portfoyBuyukluk')
  const [siraAsc, setSiraAsc] = useState(false)

  function handleSira(key: SiraKey) {
    if (siraKey === key) setSiraAsc(v => !v)
    else { setSiraKey(key); setSiraAsc(false) }
  }

  // Şirket adı map (kurucuKod → şirket adı)
  const kurucuAdMap = new Map<string, string>()
  for (const f of fonlar) {
    if (f.kurucuKod && !kurucuAdMap.has(f.kurucuKod)) kurucuAdMap.set(f.kurucuKod, sirketAdi(f.fonUnvan))
  }

  const filtrelenmis = fonlar.filter(f => {
    if (arama) {
      const q = arama.toLowerCase()
      const sirket = (kurucuAdMap.get(f.kurucuKod ?? '') ?? '').toLowerCase()
      const tur = (f.fonTurAciklama ?? '').toLowerCase()
      if (!f.fonKodu.toLowerCase().includes(q) &&
          !(f.fonUnvan ?? '').toLowerCase().includes(q) &&
          !sirket.includes(q) && !tur.includes(q)) return false
    }
    if (tip !== 'HEPSI' && f.fonTipi !== tip) return false
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
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 mb-4" />

      <div className="flex flex-col gap-2.5 mb-5">
        <FilterGroup label="Tür" value={tip} onChange={setTip} options={[
          { value: 'HEPSI', label: 'Tümü' },
          { value: 'YAT', label: 'Yatırım Fonu' },
          { value: 'EMK', label: 'Emeklilik Fonu' },
          { value: 'BYF', label: 'Borsa Yatırım Fonu' },
        ]} />
        <FilterGroup label="Risk" value={risk} onChange={setRisk} options={[
          { value: 'HEPSI', label: 'Tümü' },
          { value: '1-2', label: '1–2 Düşük' },
          { value: '3-4', label: '3–4 Orta' },
          { value: '5-6', label: '5–6 Yüksek' },
          { value: '7-7', label: '7 Çok Yüksek' },
        ]} />
        <FilterGroup label="Stopaj" value={vergi} onChange={setVergi} options={[
          { value: 'HEPSI', label: 'Tümü' },
          { value: 'YOK', label: 'Vergisiz' },
          { value: 'VAR', label: 'Vergili' },
        ]} />
        <FilterGroup label="Ücret" value={ucret} onChange={setUcret} options={[
          { value: 'HEPSI', label: 'Tümü' },
          { value: 'DUSUK', label: '<%1' },
          { value: 'ORTA', label: '%1–2' },
          { value: 'YUKSEK', label: '>%2' },
        ]} />
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
