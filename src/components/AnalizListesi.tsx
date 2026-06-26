'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'

type FonAnaliz = {
  fonKodu: string
  fonTipi: string
  fonUnvan: string
  altiAylik: (number | null)[]
  altiAylikUsd: (number | null)[]
  yillik: (number | null)[]
  yillikUsd: (number | null)[]
  altiAyPozitif: number
  altiAyToplam: number
  yillikPozitif: number
  yillikToplam: number
  toplamGetiri5y: number | null
  toplamGetiri5yUsd: number | null
  riskDegeri: number | null
  kurucuKod: string | null
  fonTurAciklama: string | null
  stopaj: number | null
  yonetimUcreti: number | null
  tefasAcik: boolean | null
}

type SiralamaKey = 'tutarlilik' | '5y' | `donem_${number}`

const TIP_RENK: Record<string, string> = {
  YAT: 'bg-indigo-50 text-indigo-600',
  EMK: 'bg-emerald-50 text-emerald-600',
  BYF: 'bg-purple-50 text-purple-600',
}

const RISK_OPTIONS = ['1-2', '3-4', '5-6', '7-7']
const RISK_LABELS: Record<string, string> = { '1-2': '1–2', '3-4': '3–4', '5-6': '5–6', '7-7': '7' }
const VERGI_OPTIONS = ['YOK', 'VAR']
const VERGI_LABELS: Record<string, string> = { YOK: 'Vergisiz', VAR: 'Vergili' }
const UCRET_OPTIONS = ['DUSUK', 'ORTA', 'YUKSEK']
const UCRET_LABELS: Record<string, string> = { DUSUK: '<%1', ORTA: '%1–2', YUKSEK: '>%2' }
const TEFAS_OPTIONS = ['ACIK', 'KAPALI']
const TEFAS_LABELS: Record<string, string> = { ACIK: "TEFAS'ta İşlem Görüyor", KAPALI: "TEFAS'a Kapalı" }

function toggle(set: Set<string>, val: string): Set<string> {
  const next = new Set(set)
  next.has(val) ? next.delete(val) : next.add(val)
  return next
}

function sirketAdi(fonUnvan: string | null): string {
  if (!fonUnvan) return '-'
  const kelimeler = fonUnvan.trim().split(/\s+/)
  const idx = kelimeler.findIndex(k => ['PORTFÖY', 'EMEKLİLİK', 'HAYAT', 'PORTFOY'].includes(k.toUpperCase()))
  const slice = idx >= 0 ? kelimeler.slice(0, idx + 1) : kelimeler.slice(0, 2)
  return slice.map(k => k.charAt(0).toUpperCase() + k.slice(1).toLocaleLowerCase('tr-TR')).join(' ')
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
          : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-200 hover:text-indigo-500'
      }`}>
      {label}
    </button>
  )
}

function SirketCombo({ secili, onChange, adMap, tumKodlar }: {
  secili: Set<string>; onChange: (s: Set<string>) => void
  adMap: Map<string, string>; tumKodlar: string[]
}) {
  const [acik, setAcik] = useState(false)
  const [ara, setAra] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function kapat(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener('mousedown', kapat)
    return () => document.removeEventListener('mousedown', kapat)
  }, [])

  const filtrelenmis = tumKodlar.filter(k =>
    (adMap.get(k) ?? k).toLocaleLowerCase('tr-TR').includes(ara.toLocaleLowerCase('tr-TR'))
  )

  function toggleKod(k: string) {
    const next = new Set(secili)
    next.has(k) ? next.delete(k) : next.add(k)
    onChange(next)
  }

  const seciliListe = tumKodlar.filter(k => secili.has(k))

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setAcik(v => !v)}
        className="min-h-[34px] w-full flex flex-wrap gap-1 items-center px-3 py-1.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-slate-300 transition-colors">
        {seciliListe.length === 0 ? (
          <span className="text-xs text-slate-400">Tüm şirketler</span>
        ) : (
          seciliListe.map(k => (
            <span key={k} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs px-2 py-0.5 rounded-full font-medium">
              {adMap.get(k) ?? k}
              <button onClick={e => { e.stopPropagation(); toggleKod(k) }} className="hover:text-indigo-900 leading-none">×</button>
            </span>
          ))
        )}
        <svg className={`w-3 h-3 text-slate-400 ml-auto shrink-0 transition-transform ${acik ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {acik && (
        <div className="absolute z-50 mt-1 w-full min-w-[320px] bg-white border border-slate-200 rounded-xl shadow-lg">
          <div className="px-3 py-2 border-b border-slate-100 flex gap-2 items-center">
            <input autoFocus type="text" placeholder="Ara..." value={ara} onChange={e => setAra(e.target.value)}
              className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-400 text-slate-700 placeholder-slate-400" />
            {secili.size > 0 && <button onClick={() => onChange(new Set())} className="text-xs text-slate-400 hover:text-slate-600 whitespace-nowrap">Temizle</button>}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtrelenmis.map(k => (
              <label key={k} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={secili.has(k)} onChange={() => toggleKod(k)} className="accent-indigo-600 w-3.5 h-3.5 shrink-0" />
                <span className="text-xs text-indigo-600">{adMap.get(k) ?? k}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function hucreRenk(deger: number | null): string {
  if (deger === null) return 'bg-slate-50 text-slate-300'
  if (deger >= 10) return 'bg-emerald-600 text-white'
  if (deger >= 5) return 'bg-emerald-500 text-white'
  if (deger > 0) return 'bg-emerald-100 text-emerald-800'
  if (deger === 0) return 'bg-slate-100 text-slate-500'
  if (deger >= -5) return 'bg-red-100 text-red-700'
  return 'bg-red-500 text-white'
}

function skorCubugu(pozitif: number, toplam: number) {
  if (toplam === 0) return null
  const oran = pozitif / toplam
  const renk = oran === 1 ? 'bg-emerald-500' : oran >= 0.7 ? 'bg-emerald-400' : oran >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${renk}`} style={{ width: `${oran * 100}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-600">{pozitif}/{toplam}</span>
    </div>
  )
}

function ThSort({ label, aktif, onClick }: { label: string; aktif: boolean; onClick: () => void }) {
  return (
    <th onClick={onClick}
      className={`px-2 py-3 text-center min-w-24 text-xs font-semibold cursor-pointer select-none transition-colors ${aktif ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-indigo-500 hover:bg-slate-100'}`}>
      {label} {aktif ? '↓' : ''}
    </th>
  )
}

export default function AnalizListesi({
  fonlar, altiAyEtiketler, yillikEtiketler, kurucular,
}: {
  fonlar: FonAnaliz[]
  altiAyEtiketler: string[]
  yillikEtiketler: string[]
  kurucular: string[]
}) {
  const [mod, setMod] = useState<'6ay' | 'yil'>('yil')
  const [doviz, setDoviz] = useState<'TL' | 'USD'>('TL')
  const [minPozitif, setMinPozitif] = useState(0)
  const [tipFiltre, setTipFiltre] = useState<'HEPSI' | 'YAT' | 'EMK' | 'BYF'>('YAT')
  const [siralama, setSiralama] = useState<SiralamaKey>('tutarlilik')
  const [filtrePaneli, setFiltrePaneli] = useState(false)

  // Ek filtreler
  const [serbest, setSerbest] = useState(true)
  const [sadecKatilim, setSadecKatilim] = useState(false)
  const [riskler, setRiskler] = useState(new Set(RISK_OPTIONS))
  const [vergiler, setVergiler] = useState(new Set(VERGI_OPTIONS))
  const [ucretler, setUcretler] = useState(new Set(UCRET_OPTIONS))
  const [tefas, setTefas] = useState(new Set(['ACIK']))
  const [sirketler, setSirketler] = useState<Set<string>>(new Set())

  const kurucuAdMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of fonlar) {
      if (f.kurucuKod && !m.has(f.kurucuKod)) m.set(f.kurucuKod, sirketAdi(f.fonUnvan))
    }
    return m
  }, [fonlar])

  const aktifFiltreCount =
    (!serbest ? 1 : 0) +
    (sadecKatilim ? 1 : 0) +
    (riskler.size < RISK_OPTIONS.length ? 1 : 0) +
    (vergiler.size < VERGI_OPTIONS.length ? 1 : 0) +
    (ucretler.size < UCRET_OPTIONS.length ? 1 : 0) +
    (tefas.size < TEFAS_OPTIONS.length ? 1 : 0) +
    (sirketler.size > 0 ? 1 : 0)

  const etiketler = mod === '6ay' ? altiAyEtiketler : yillikEtiketler
  const maxDonem = etiketler.length

  function periyotlar(f: FonAnaliz) {
    if (mod === '6ay') return doviz === 'USD' ? f.altiAylikUsd : f.altiAylik
    return doviz === 'USD' ? f.yillikUsd : f.yillik
  }

  const filtreli = useMemo(() => {
    return fonlar
      .filter(f => tipFiltre === 'HEPSI' || f.fonTipi === tipFiltre)
      .filter(f => {
        if (!serbest && (f.fonTurAciklama ?? '').toLocaleLowerCase('tr-TR').includes('serbest')) return false
        const isKatilim = (f.fonTurAciklama ?? '').toLocaleLowerCase('tr-TR').includes('katılım')
        if (sadecKatilim && !isKatilim) return false
        if (sirketler.size > 0 && f.kurucuKod && !sirketler.has(f.kurucuKod)) return false
        if (riskler.size < RISK_OPTIONS.length) {
          const r = f.riskDegeri
          if (r != null) {
            const match = [...riskler].some(band => {
              const [min, max] = band.split('-').map(Number)
              return r >= min && r <= max
            })
            if (!match) return false
          }
        }
        if (vergiler.size < VERGI_OPTIONS.length) {
          if (vergiler.has('YOK') && !vergiler.has('VAR') && f.stopaj !== 0) return false
          if (vergiler.has('VAR') && !vergiler.has('YOK') && (f.stopaj == null || f.stopaj === 0)) return false
        }
        if (tefas.size < TEFAS_OPTIONS.length) {
          const acik = f.tefasAcik === true
          if (tefas.has('ACIK') && !tefas.has('KAPALI') && !acik) return false
          if (tefas.has('KAPALI') && !tefas.has('ACIK') && acik) return false
        }
        if (ucretler.size < UCRET_OPTIONS.length) {
          const u = f.yonetimUcreti
          const match = u != null && [...ucretler].some(band => {
            if (band === 'DUSUK') return u < 1
            if (band === 'ORTA') return u >= 1 && u <= 2
            return u > 2
          })
          if (!match) return false
        }
        const per = periyotlar(f)
        const pozitif = per.filter(p => p !== null && p > 0).length
        const toplam = per.filter(p => p !== null).length
        return toplam > 0 && pozitif >= minPozitif
      })
      .sort((a, b) => {
        if (siralama === '5y') {
          const aV = doviz === 'USD' ? a.toplamGetiri5yUsd : a.toplamGetiri5y
          const bV = doviz === 'USD' ? b.toplamGetiri5yUsd : b.toplamGetiri5y
          return (bV ?? -Infinity) - (aV ?? -Infinity)
        }
        if (siralama.startsWith('donem_')) {
          const idx = parseInt(siralama.replace('donem_', ''))
          const aVal = periyotlar(a)[idx] ?? -Infinity
          const bVal = periyotlar(b)[idx] ?? -Infinity
          return bVal - aVal
        }
        const perA = periyotlar(a)
        const perB = periyotlar(b)
        const aPoz = perA.filter(p => p !== null && p > 0).length
        const bPoz = perB.filter(p => p !== null && p > 0).length
        const aTop = perA.filter(p => p !== null).length
        const bTop = perB.filter(p => p !== null).length
        const aOran = aTop > 0 ? aPoz / aTop : 0
        const bOran = bTop > 0 ? bPoz / bTop : 0
        if (bOran !== aOran) return bOran - aOran
        return bPoz - aPoz
      })
  }, [fonlar, mod, doviz, minPozitif, tipFiltre, siralama, serbest, sadecKatilim, riskler, vergiler, ucretler, tefas, sirketler])

  return (
    <div>
      {/* Ana kontroller */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white text-sm">
          {(['yil', '6ay'] as const).map(m => (
            <button key={m} onClick={() => { setMod(m); setMinPozitif(0); setSiralama('tutarlilik') }}
              className={`px-4 py-2 font-medium transition-colors ${mod === m ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {m === 'yil' ? 'Yıllık' : '6 Aylık'}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white text-sm">
          {(['TL', 'USD'] as const).map(d => (
            <button key={d} onClick={() => setDoviz(d)}
              className={`px-4 py-2 font-medium transition-colors ${doviz === d ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {d}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white text-sm">
          {(['HEPSI', 'YAT', 'EMK', 'BYF'] as const).map(tip => (
            <button key={tip} onClick={() => setTipFiltre(tip)}
              className={`px-3 py-2 font-medium transition-colors ${tipFiltre === tip ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {tip === 'HEPSI' ? 'Tümü' : tip}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Min pozitif dönem:</span>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
            {Array.from({ length: maxDonem + 1 }, (_, i) => i).map(n => (
              <button key={n} onClick={() => setMinPozitif(n)}
                className={`px-2.5 py-2 font-medium transition-colors ${minPozitif === n ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {n === 0 ? 'Hepsi' : n}
              </button>
            ))}
          </div>
        </div>

        <span className="text-sm text-slate-400 ml-auto">{filtreli.length} fon</span>
      </div>

      {/* Ek filtreler paneli */}
      <div className="mb-4">
        <button onClick={() => setFiltrePaneli(v => !v)}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${filtrePaneli ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>
          <svg className={`w-4 h-4 transition-transform ${filtrePaneli ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Filtreler
          {aktifFiltreCount > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-1.5 py-0.5 rounded-full">{aktifFiltreCount}</span>
          )}
        </button>

        {filtrePaneli && (
          <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-4">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Serbest Fonlar</span>
                <div className="flex flex-wrap gap-1.5">
                  <Chip label="Dahil" active={serbest} onClick={() => setSerbest(true)} />
                  <Chip label="Hariç" active={!serbest} onClick={() => setSerbest(false)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Katılım Fonları</span>
                <div className="flex flex-wrap gap-1.5">
                  <Chip label="Tümü" active={!sadecKatilim} onClick={() => setSadecKatilim(false)} />
                  <Chip label="Sadece Katılım" active={sadecKatilim} onClick={() => setSadecKatilim(true)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Risk Seviyesi</span>
                <div className="flex flex-wrap gap-1.5">
                  {RISK_OPTIONS.map(v => (
                    <Chip key={v} label={RISK_LABELS[v]} active={riskler.has(v)} onClick={() => setRiskler(s => toggle(s, v))} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Stopaj Durumu</span>
                <div className="flex flex-wrap gap-1.5">
                  {VERGI_OPTIONS.map(v => (
                    <Chip key={v} label={VERGI_LABELS[v]} active={vergiler.has(v)} onClick={() => setVergiler(s => toggle(s, v))} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 font-medium">TEFAS Durumu</span>
                <div className="flex flex-wrap gap-1.5">
                  {TEFAS_OPTIONS.map(v => (
                    <Chip key={v} label={TEFAS_LABELS[v]} active={tefas.has(v)} onClick={() => setTefas(s => toggle(s, v))} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Yönetim Ücreti</span>
                <div className="flex flex-wrap gap-1.5">
                  {UCRET_OPTIONS.map(v => (
                    <Chip key={v} label={UCRET_LABELS[v]} active={ucretler.has(v)} onClick={() => setUcretler(s => toggle(s, v))} />
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <span className="text-xs text-slate-500 font-medium block mb-1.5">Portföy Şirketi</span>
              <SirketCombo secili={sirketler} onChange={setSirketler} adMap={kurucuAdMap} tumKodlar={kurucular} />
            </div>
          </div>
        )}
      </div>

      {/* Tablo */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold text-slate-600 w-24">Kod</th>
              <th className="px-3 py-3 font-semibold text-slate-600 text-center">Tip</th>
              {etiketler.map((e, i) => (
                <ThSort key={i} label={e} aktif={siralama === `donem_${i}`} onClick={() => setSiralama(`donem_${i}`)} />
              ))}
              <ThSort label="5Y Toplam" aktif={siralama === '5y'} onClick={() => setSiralama('5y')} />
              <th onClick={() => setSiralama('tutarlilik')}
                className={`px-4 py-3 font-semibold min-w-36 cursor-pointer select-none transition-colors ${siralama === 'tutarlilik' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-indigo-500 hover:bg-slate-100'}`}>
                Tutarlılık {siralama === 'tutarlilik' ? '↓' : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtreli.map((f, idx) => {
              const per = periyotlar(f)
              const pozitif = per.filter(p => p !== null && p > 0).length
              const toplam = per.filter(p => p !== null).length
              const getiri5y = doviz === 'USD' ? f.toplamGetiri5yUsd : f.toplamGetiri5y
              return (
                <tr key={`${f.fonKodu}-${f.fonTipi}`}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                    <Link href={`/fon/${f.fonKodu}?tip=${f.fonTipi}`}
                      className="font-mono font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                      title={f.fonUnvan}>
                      {f.fonKodu}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TIP_RENK[f.fonTipi] ?? ''}`}>
                      {f.fonTipi}
                    </span>
                  </td>
                  {per.map((p, i) => (
                    <td key={i} className={`px-2 py-2.5 text-center ${siralama === `donem_${i}` ? 'bg-indigo-50/50' : ''}`}>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono font-medium ${hucreRenk(p)}`}>
                        {p !== null ? `${p >= 0 ? '+' : ''}${p.toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  ))}
                  <td className={`px-3 py-2.5 text-center ${siralama === '5y' ? 'bg-indigo-50/50' : ''}`}>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono font-medium ${hucreRenk(getiri5y)}`}>
                      {getiri5y !== null ? `${getiri5y >= 0 ? '+' : ''}${getiri5y.toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {skorCubugu(pozitif, toplam)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtreli.length === 0 && (
          <div className="py-16 text-center text-slate-400 text-sm">Bu kriterlere uyan fon bulunamadı.</div>
        )}
      </div>
    </div>
  )
}
