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
  tefasAcik: boolean | null
  getiriler: Record<string, number | null>
}

const DONEMLER = [
  { key: '1g', label: '1G', title: '1 Günlük Getiri' },
  { key: '1h', label: '1H', title: '1 Haftalık Getiri' },
  { key: '1a', label: '1A', title: '1 Aylık Getiri' },
  { key: '3a', label: '3A', title: '3 Aylık Getiri' },
  { key: '6a', label: '6A', title: '6 Aylık Getiri' },
  { key: 'yb', label: 'YBB', title: 'Yılbaşından Beri' },
  { key: '1y', label: '1Y', title: '1 Yıllık Getiri' },
  { key: '3y', label: '3Y', title: '3 Yıllık Getiri' },
  { key: '5y', label: '5Y', title: '5 Yıllık Getiri' },
]

const TIP_OPTIONS = [
  { value: 'YAT', label: 'Yatırım Fonu' },
  { value: 'EMK', label: 'Emeklilik Fonu' },
  { value: 'BYF', label: 'Borsa Yatırım Fonu' },
]
const RISK_OPTIONS = ['1-2', '3-4', '5-6', '7-7']
const RISK_LABELS: Record<string, string> = { '1-2': '1–2', '3-4': '3–4', '5-6': '5–6', '7-7': '7' }
const VERGI_OPTIONS = ['YOK', 'VAR']
const VERGI_LABELS: Record<string, string> = { YOK: 'Vergisiz', VAR: 'Vergili' }
const UCRET_OPTIONS = ['DUSUK', 'ORTA', 'YUKSEK']
const UCRET_LABELS: Record<string, string> = { DUSUK: '<%1', ORTA: '%1–2', YUKSEK: '>%2' }
const TEFAS_OPTIONS = ['ACIK', 'KAPALI']
const TEFAS_LABELS: Record<string, string> = { ACIK: 'TEFAS\'ta İşlem Görüyor', KAPALI: 'TEFAS\'a Kapalı' }

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
    {val >= 0 ? '+' : ''}{val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
  </span>
}

function SirketListe({ secili, onChange, adMap, tumKodlar }: {
  secili: Set<string>; onChange: (s: Set<string>) => void
  adMap: Map<string, string>; tumKodlar: string[]
}) {
  const [ara, setAra] = useState('')

  const filtrelenmis = tumKodlar.filter(k =>
    (adMap.get(k) ?? k).toLowerCase().includes(ara.toLowerCase())
  )

  function toggleKod(k: string) {
    const next = new Set(secili)
    next.has(k) ? next.delete(k) : next.add(k)
    onChange(next)
  }

  return (
    <div className="w-56">
      <div className="flex gap-2 mb-1.5">
        <button onClick={() => onChange(new Set(tumKodlar))} className="text-xs text-indigo-600 hover:underline">Tümü</button>
        <button onClick={() => onChange(new Set())} className="text-xs text-slate-400 hover:underline">Temizle</button>
      </div>
      <input type="text" placeholder="Ara..." value={ara} onChange={e => setAra(e.target.value)}
        className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-400 mb-1.5" />
      <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
        {filtrelenmis.map(k => (
          <label key={k} className="flex items-center gap-2 px-1 py-0.5 hover:bg-slate-100 rounded cursor-pointer">
            <input type="checkbox" checked={secili.has(k)} onChange={() => toggleKod(k)}
              className="accent-indigo-600 w-3.5 h-3.5 shrink-0" />
            <span className="text-xs text-slate-700 truncate">{adMap.get(k) ?? k}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
          : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300'
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
  // Yatırım Fonu default seçili; diğer gruplar hepsi seçili
  const [tipler, setTipler] = useState(new Set(['YAT']))
  const [riskler, setRiskler] = useState(new Set(RISK_OPTIONS))
  const [vergiler, setVergiler] = useState(new Set(VERGI_OPTIONS))
  const [ucretler, setUcretler] = useState(new Set(UCRET_OPTIONS))
  const [tefas, setTefas] = useState(new Set(TEFAS_OPTIONS))
  const [sirketler, setSirketler] = useState<Set<string>>(new Set(kurucular))
  const [filtrePaneli, setFiltrePaneli] = useState(false)
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

  // Hepsi seçiliyse = filtre yok (null dahil geç)
  const sirketFiltre = sirketler.size < kurucular.length
  const aktifFiltreCount = (tipler.size < TIP_OPTIONS.length ? 1 : 0) +
    (riskler.size < RISK_OPTIONS.length ? 1 : 0) +
    (vergiler.size < VERGI_OPTIONS.length ? 1 : 0) +
    (ucretler.size < UCRET_OPTIONS.length ? 1 : 0) +
    (tefas.size < TEFAS_OPTIONS.length ? 1 : 0) +
    (sirketFiltre ? 1 : 0)

  const tipFiltre = tipler.size < TIP_OPTIONS.length
  const riskFiltre = riskler.size < RISK_OPTIONS.length
  const vergiFiltre = vergiler.size < VERGI_OPTIONS.length
  const ucretFiltre = ucretler.size < UCRET_OPTIONS.length
  const tefasFiltre = tefas.size < TEFAS_OPTIONS.length

  const filtrelenmis = fonlar.filter(f => {
    if (arama) {
      const q = arama.toLowerCase()
      const sirket = (kurucuAdMap.get(f.kurucuKod ?? '') ?? '').toLowerCase()
      if (!f.fonKodu.toLowerCase().includes(q) &&
          !(f.fonUnvan ?? '').toLowerCase().includes(q) &&
          !sirket.includes(q) &&
          !(f.fonTurAciklama ?? '').toLowerCase().includes(q)) return false
    }
    if (tipFiltre && !tipler.has(f.fonTipi)) return false
    if (sirketFiltre && !sirketler.has(f.kurucuKod ?? '')) return false
    if (riskFiltre) {
      const r = f.riskDegeri
      const match = r != null && [...riskler].some(band => {
        const [min, max] = band.split('-').map(Number)
        return r >= min && r <= max
      })
      if (!match) return false
    }
    if (vergiFiltre) {
      if (vergiler.has('YOK') && !vergiler.has('VAR') && f.stopaj !== 0) return false
      if (vergiler.has('VAR') && !vergiler.has('YOK') && (f.stopaj == null || f.stopaj === 0)) return false
    }
    if (tefasFiltre) {
      const acik = f.tefasAcik === true
      if (tefas.has('ACIK') && !tefas.has('KAPALI') && !acik) return false
      if (tefas.has('KAPALI') && !tefas.has('ACIK') && acik) return false
    }
    if (ucretFiltre) {
      const u = f.yonetimUcreti
      const match = u != null && [...ucretler].some(band => {
        if (band === 'DUSUK') return u < 1
        if (band === 'ORTA') return u >= 1 && u <= 2
        return u > 2
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

  function ThBtn({ col, label, title }: { col: string; label: string; title?: string }) {
    const aktif = siraKey === col
    return (
      <th title={title} className="px-3 py-3 font-medium text-right cursor-pointer select-none hover:text-indigo-600 whitespace-nowrap"
        onClick={() => handleSira(col)}>
        {label}{aktif ? (siraAsc ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  return (
    <div>
      <input type="text" placeholder="Fon kodu, kurucu şirket veya fon adı ile arayın..."
        value={arama} onChange={e => setArama(e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 mb-4" />

      <div className="mb-4">
        <button onClick={() => setFiltrePaneli(v => !v)}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
          <svg className={`w-4 h-4 transition-transform ${filtrePaneli ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Filtreler
          {aktifFiltreCount > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
              {aktifFiltreCount}
            </span>
          )}
        </button>

        {filtrePaneli && (
          <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap gap-x-8 gap-y-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Portföy Şirketi</span>
              <SirketListe secili={sirketler} onChange={setSirketler} adMap={kurucuAdMap} tumKodlar={kurucular} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Fon Türü</span>
              <div className="flex flex-wrap gap-1.5">
                {TIP_OPTIONS.map(o => (
                  <Chip key={o.value} label={o.label} active={tipler.has(o.value)}
                    onClick={() => setTipler(s => toggle(s, o.value))} />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Risk Seviyesi</span>
              <div className="flex flex-wrap gap-1.5">
                {RISK_OPTIONS.map(v => (
                  <Chip key={v} label={RISK_LABELS[v]} active={riskler.has(v)}
                    onClick={() => setRiskler(s => toggle(s, v))} />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Stopaj Durumu</span>
              <div className="flex flex-wrap gap-1.5">
                {VERGI_OPTIONS.map(v => (
                  <Chip key={v} label={VERGI_LABELS[v]} active={vergiler.has(v)}
                    onClick={() => setVergiler(s => toggle(s, v))} />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400 font-medium">TEFAS Durumu</span>
              <div className="flex flex-wrap gap-1.5">
                {TEFAS_OPTIONS.map(v => (
                  <Chip key={v} label={TEFAS_LABELS[v]} active={tefas.has(v)}
                    onClick={() => setTefas(s => toggle(s, v))} />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Yönetim Ücreti</span>
              <div className="flex flex-wrap gap-1.5">
                {UCRET_OPTIONS.map(v => (
                  <Chip key={v} label={UCRET_LABELS[v]} active={ucretler.has(v)}
                    onClick={() => setUcretler(s => toggle(s, v))} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-slate-400 text-sm mb-3">{filtrelenmis.length.toLocaleString('tr-TR')} fon listeleniyor</p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 bg-white">
            <tr className="border-b border-slate-100 text-slate-500 text-left">
              <th className="px-4 py-3 font-medium sticky left-0 bg-white z-30">Kod</th>
              <ThBtn col="fiyat" label="Fiyat" />
              <ThBtn col="portfoyBuyukluk" label="Portföy" />
              <ThBtn col="kisiSayisi" label="Yatırımcı" />
              {DONEMLER.map(d => <ThBtn key={d.key} col={d.key} label={d.label} title={d.title} />)}
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.map(f => (
              <tr key={`${f.fonKodu}-${f.fonTipi}`}
                className="border-b border-slate-50 hover:bg-indigo-50/40 transition-colors">
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <Link href={`/fon/${f.fonKodu}?tip=${f.fonTipi}`}
                    title={f.fonUnvan ?? undefined}
                    className="font-mono font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                    {f.fonKodu}
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
