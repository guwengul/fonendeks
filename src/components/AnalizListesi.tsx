'use client'

import { useState, useMemo, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { favoriEkle, favoriKaldir } from '@/lib/auth-actions'

type FonAnaliz = {
  fonKodu: string
  fonTipi: string
  fonUnvan: string
  altiAylik: (number | null)[]
  altiAylikUsd: (number | null)[]
  yillik: (number | null)[]
  yillikUsd: (number | null)[]
  ceyreklik: (number | null)[]
  ceyreklikUsd: (number | null)[]
  toplamGetiri3y: number | null
  toplamGetiri3yUsd: number | null
  toplamGetiri5y: number | null
  toplamGetiri5yUsd: number | null
  riskDegeri: number | null
  kurucuKod: string | null
  fonTurAciklama: string | null
  stopaj: number | null
  yonetimUcreti: number | null
  tefasAcik: boolean | null
}

type Mod = '5y' | '3y' | '1y'
type SiralamaKey = 'tutarlilik' | '3y' | '5y' | `donem_${number}`

const RISK_OPTIONS = ['1-2', '3-4', '5-6', '7-7']
const RISK_LABELS: Record<string, string> = { '1-2': '1–2', '3-4': '3–4', '5-6': '5–6', '7-7': '7' }
const VERGI_OPTIONS = ['YOK', 'VAR']
const VERGI_LABELS: Record<string, string> = { YOK: 'Vergisiz', VAR: 'Vergili' }
const UCRET_OPTIONS = ['DUSUK', 'ORTA', 'YUKSEK']
const UCRET_LABELS: Record<string, string> = { DUSUK: '<%1', ORTA: '%1–2', YUKSEK: '>%2' }
const TEFAS_OPTIONS = ['ACIK', 'KAPALI']
const TEFAS_LABELS: Record<string, string> = { ACIK: "TEFAS'ta İşlem Görüyor", KAPALI: "TEFAS'a Kapalı" }
const TIP_OPTIONS = [
  { value: 'YAT', label: 'Yatırım Fonu' },
  { value: 'EMK', label: 'Emeklilik Fonu' },
  { value: 'BYF', label: 'Borsa Yatırım Fonu' },
]

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
      <div onClick={() => setAcik(v => !v)}
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

function YildizButon({ fav, onClick }: { fav: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`p-1 transition-all ${fav ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}>
      <svg className={`w-3.5 h-3.5 ${fav ? 'text-amber-400' : 'text-slate-400'}`}
        fill={fav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    </button>
  )
}

export default function AnalizListesi({
  fonlar, altiAyEtiketler, yillikEtiketler, ceyreklikEtiketler, kurucular, girisYapildi, initialFavoriler,
}: {
  fonlar: FonAnaliz[]
  altiAyEtiketler: string[]
  yillikEtiketler: string[]
  ceyreklikEtiketler: string[]
  kurucular: string[]
  girisYapildi?: boolean
  initialFavoriler?: Set<string>
}) {
  const [arama, setArama] = useState('')
  const [mod, setMod] = useState<Mod>('5y')
  const [doviz, setDoviz] = useState<'TL' | 'USD'>('TL')
  const [tipler, setTipler] = useState(new Set(['YAT']))
  const [siralama, setSiralama] = useState<SiralamaKey>('tutarlilik')
  const [filtrePaneli, setFiltrePaneli] = useState(false)
  const [favoriler, setFavoriler] = useState<Set<string>>(initialFavoriler ?? new Set())
  const [, startTransition] = useTransition()
  const router = useRouter()

  const [serbest, setSerbest] = useState(true)
  const [sadecKatilim, setSadecKatilim] = useState(false)
  const [sadecHisse, setSadecHisse] = useState(false)
  const [dovizMod, setDovizMod] = useState<'tumu' | 'haric' | 'sadece'>('tumu')
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
    (tipler.size < TIP_OPTIONS.length ? 1 : 0) +
    (!serbest ? 1 : 0) +
    (sadecKatilim ? 1 : 0) +
    (sadecHisse ? 1 : 0) +
    (dovizMod !== 'tumu' ? 1 : 0) +
    (riskler.size < RISK_OPTIONS.length ? 1 : 0) +
    (vergiler.size < VERGI_OPTIONS.length ? 1 : 0) +
    (ucretler.size < UCRET_OPTIONS.length ? 1 : 0) +
    (tefas.size < TEFAS_OPTIONS.length ? 1 : 0) +
    (sirketler.size > 0 ? 1 : 0)

  function periyotlar(f: FonAnaliz) {
    if (mod === '5y') return doviz === 'USD' ? f.yillikUsd : f.yillik
    if (mod === '3y') return (doviz === 'USD' ? f.altiAylikUsd : f.altiAylik).slice(0, 6)
    return doviz === 'USD' ? f.ceyreklikUsd : f.ceyreklik
  }

  function etiketler() {
    if (mod === '5y') return yillikEtiketler
    if (mod === '3y') return altiAyEtiketler.slice(0, 6)
    return ceyreklikEtiketler
  }

  const filtreli = useMemo(() => {
    return fonlar
      .filter(f => {
        if (!arama) return true
        const q = arama.toLocaleLowerCase('tr-TR')
        return f.fonKodu.toLowerCase().includes(arama.toLowerCase()) ||
          (f.fonUnvan ?? '').toLocaleLowerCase('tr-TR').includes(q)
      })
      .filter(f => tipler.size >= TIP_OPTIONS.length || tipler.has(f.fonTipi))
      .filter(f => {
        if (!serbest && (f.fonTurAciklama ?? '').toLocaleLowerCase('tr-TR').includes('serbest')) return false
        if (sadecKatilim && !(f.fonTurAciklama ?? '').toLocaleLowerCase('tr-TR').includes('katılım')) return false
        if (sadecHisse && !(f.fonTurAciklama ?? '').toLocaleLowerCase('tr-TR').includes('hisse')) return false
        if (dovizMod !== 'tumu') {
          const u = (f.fonUnvan ?? '').toLocaleLowerCase('tr-TR')
          const isDoviz = /\busd\b|\beur\b|\bdolar\b|\beuro\b|\bdöviz\b|\bavro\b|\bsterlin\b|\bgbp\b|\bchf\b|\bjpy\b/.test(u)
          if (dovizMod === 'haric' && isDoviz) return false
          if (dovizMod === 'sadece' && !isDoviz) return false
        }
        if (sirketler.size > 0 && f.kurucuKod && !sirketler.has(f.kurucuKod)) return false
        if (riskler.size < RISK_OPTIONS.length && f.riskDegeri != null) {
          const match = [...riskler].some(band => {
            const [min, max] = band.split('-').map(Number)
            return f.riskDegeri! >= min && f.riskDegeri! <= max
          })
          if (!match) return false
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
        return true
      })
      .sort((a, b) => {
        if (siralama === '3y') {
          const aV = doviz === 'USD' ? a.toplamGetiri3yUsd : a.toplamGetiri3y
          const bV = doviz === 'USD' ? b.toplamGetiri3yUsd : b.toplamGetiri3y
          return (bV ?? -Infinity) - (aV ?? -Infinity)
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonlar, mod, doviz, tipler, siralama, arama, serbest, sadecKatilim, sadecHisse, dovizMod, riskler, vergiler, ucretler, tefas, sirketler])

  function toggleFavori(f: FonAnaliz) {
    if (!girisYapildi) { router.push('/giris'); return }
    const key = `${f.fonKodu}::${f.fonTipi}`
    const zatenVar = favoriler.has(key)
    setFavoriler(prev => {
      const next = new Set(prev)
      zatenVar ? next.delete(key) : next.add(key)
      return next
    })
    startTransition(async () => {
      if (zatenVar) {
        await favoriKaldir(f.fonKodu, f.fonTipi)
      } else {
        const sonuc = await favoriEkle(f.fonKodu, f.fonTipi, 0, '')
        if (sonuc?.hata) {
          setFavoriler(prev => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        }
      }
    })
  }

  const etiketListesi = etiketler()

  return (
    <div>
      <input type="text" placeholder="Fon kodu veya adı ile arayın..."
        value={arama} onChange={e => setArama(e.target.value)}
        className="w-full border border-indigo-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-white shadow-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 mb-4" />

      {/* Tab'lar */}
      <div className="flex items-end gap-0 border-b border-slate-200 mb-4">
        {([['5y', '5 Yıllık', 'yıl yıl'], ['3y', '3 Yıllık', '6ay 6ay'], ['1y', 'Yıllık', '3ay 3ay']] as [Mod, string, string][]).map(([m, label, alt]) => (
          <button key={m} onClick={() => { setMod(m); setSiralama('tutarlilik') }}
            className={`relative px-5 py-3 text-sm font-medium transition-colors focus:outline-none ${
              mod === m
                ? 'text-indigo-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            {label}
            <span className={`ml-1.5 text-xs font-normal ${mod === m ? 'text-indigo-400' : 'text-slate-400'}`}>{alt}</span>
          </button>
        ))}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white text-sm ml-auto mb-2">
          {(['TL', 'USD'] as const).map(d => (
            <button key={d} onClick={() => setDoviz(d)}
              className={`px-3 py-1.5 font-medium transition-colors ${doviz === d ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="text-right text-sm text-slate-400 -mt-2 mb-3">{filtreli.length} fon</div>

      {/* Filtreler */}
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
                <span className="text-xs text-slate-500 font-medium">Fon Türü</span>
                <div className="flex flex-wrap gap-1.5">
                  {TIP_OPTIONS.map(o => (
                    <Chip key={o.value} label={o.label} active={tipler.has(o.value)}
                      onClick={() => setTipler(s => toggle(s, o.value))} />
                  ))}
                </div>
              </div>
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
                <span className="text-xs text-slate-500 font-medium">Hisse Senedi Fonları</span>
                <div className="flex flex-wrap gap-1.5">
                  <Chip label="Tümü" active={!sadecHisse} onClick={() => setSadecHisse(false)} />
                  <Chip label="Sadece Hisse" active={sadecHisse} onClick={() => setSadecHisse(true)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Döviz Fonları</span>
                <div className="flex flex-wrap gap-1.5">
                  <Chip label="Hariç" active={dovizMod === 'haric'} onClick={() => setDovizMod(dovizMod === 'haric' ? 'tumu' : 'haric')} />
                  <Chip label="Sadece" active={dovizMod === 'sadece'} onClick={() => setDovizMod(dovizMod === 'sadece' ? 'tumu' : 'sadece')} />
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
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold text-slate-600 w-28">Kod</th>
              {etiketListesi.map((e, i) => (
                <ThSort key={i} label={e} aktif={siralama === `donem_${i}`} onClick={() => setSiralama(`donem_${i}`)} />
              ))}
              <ThSort label="3Y Toplam" aktif={siralama === '3y'} onClick={() => setSiralama('3y')} />
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
              const favori = favoriler.has(`${f.fonKodu}::${f.fonTipi}`)
              return (
                <tr key={`${f.fonKodu}-${f.fonTipi}`}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="sticky left-0 z-10 bg-white px-2 py-2.5">
                    <div className="flex items-center gap-1">
                      <YildizButon fav={favori} onClick={() => toggleFavori(f)} />
                      <Link href={`/fon/${f.fonKodu}?tip=${f.fonTipi}`}
                        className="font-mono font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                        title={f.fonUnvan}>
                        {f.fonKodu}
                      </Link>
                    </div>
                  </td>
                  {per.map((p, i) => (
                    <td key={i} className={`px-2 py-2.5 text-center ${siralama === `donem_${i}` ? 'bg-indigo-50/50' : ''}`}>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono font-medium ${hucreRenk(p)}`}>
                        {p !== null ? `${p >= 0 ? '+' : ''}${p.toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  ))}
                  <td className={`px-3 py-2.5 text-center ${siralama === '3y' ? 'bg-indigo-50/50' : ''}`}>
                    {(() => { const v = doviz === 'USD' ? f.toplamGetiri3yUsd : f.toplamGetiri3y; return (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono font-medium ${hucreRenk(v)}`}>
                        {v !== null ? `${v >= 0 ? '+' : ''}${v.toFixed(0)}%` : '—'}
                      </span>
                    )})()}
                  </td>
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
