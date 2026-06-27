'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { favoriEkle, favoriKaldir } from '@/lib/auth-actions'

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
  getirilerUsd: Record<string, number | null>
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
  return slice.map(k => k.charAt(0).toUpperCase() + k.slice(1).toLocaleLowerCase('tr-TR')).join(' ')
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
    {val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
  </span>
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

function toggle(set: Set<string>, val: string): Set<string> {
  const next = new Set(set)
  next.has(val) ? next.delete(val) : next.add(val)
  return next
}

type SiraKey = 'portfoyBuyukluk' | 'kisiSayisi' | 'fiyat' | string

export default function FonListesi({ fonlar, kurucular, fonTurleri, girisYapildi = false }: {
  fonlar: Fon[]; kurucular: string[]; fonTurleri: string[]; girisYapildi?: boolean
}) {
  const [arama, setArama] = useState('')
  const [favoriler, setFavoriler] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (!girisYapildi) return
    fetch('/api/kullanici/favoriler')
      .then(r => r.json())
      .then((d: { fonKodu: string; fonTipi: string }[]) => {
        if (Array.isArray(d)) setFavoriler(new Set(d.map(f => `${f.fonKodu}::${f.fonTipi}`)))
      })
      .catch(() => {})
  }, [girisYapildi])

  function toggleFavori(fon: Fon) {
    if (!girisYapildi) { router.push('/giris'); return }
    const key = `${fon.fonKodu}::${fon.fonTipi}`
    const zatenVar = favoriler.has(key)
    setFavoriler(prev => {
      const next = new Set(prev)
      zatenVar ? next.delete(key) : next.add(key)
      return next
    })
    startTransition(async () => {
      if (zatenVar) await favoriKaldir(fon.fonKodu, fon.fonTipi)
      else await favoriEkle(fon.fonKodu, fon.fonTipi, fon.fiyat ?? 0, fon.tarih)
    })
  }
  // Yatırım Fonu default seçili; diğer gruplar hepsi seçili
  const [tipler, setTipler] = useState(new Set(['YAT']))
  const [riskler, setRiskler] = useState(new Set(RISK_OPTIONS))
  const [vergiler, setVergiler] = useState(new Set(VERGI_OPTIONS))
  const [ucretler, setUcretler] = useState(new Set(UCRET_OPTIONS))
  const [tefas, setTefas] = useState(new Set(['ACIK']))
  const [sirketler, setSirketler] = useState<Set<string>>(new Set())
  const [serbest, setSerbest] = useState(true)
  const [sadecKatilim, setSadecKatilim] = useState(false)
  const [sadecHisse, setSadecHisse] = useState(false)
  const [dovizMod, setDovizMod] = useState<'tumu' | 'haric' | 'sadece'>('tumu')
  const [filtrePaneli, setFiltrePaneli] = useState(false)
  const [paraBirimi, setParaBirimi] = useState<'TL' | 'USD'>('TL')
  const [siraKey, setSiraKey] = useState<SiraKey>('portfoyBuyukluk')
  const [siraAsc, setSiraAsc] = useState(false)

  const kurucuAdMap = new Map<string, string>()
  const kurucuTipMap = new Map<string, Set<string>>()
  for (const f of fonlar) {
    if (f.kurucuKod) {
      if (!kurucuAdMap.has(f.kurucuKod)) kurucuAdMap.set(f.kurucuKod, sirketAdi(f.fonUnvan))
      if (!kurucuTipMap.has(f.kurucuKod)) kurucuTipMap.set(f.kurucuKod, new Set())
      kurucuTipMap.get(f.kurucuKod)!.add(f.fonTipi)
    }
  }

  // Seçili fon tiplerine göre görünür şirketler
  const gorunurKurucular = kurucular.filter(k => {
    const tipler_ = kurucuTipMap.get(k)
    if (!tipler_) return false
    return [...tipler].some(t => tipler_.has(t))
  })

  function handleTipToggle(tip: string) {
    const yeniTipler = toggle(tipler, tip)
    setTipler(yeniTipler)
    // Fon tipi değişince şirket listesini sıfırla (tümünü seç)
    setSirketler(new Set())
  }

  function handleSira(key: SiraKey) {
    if (siraKey === key) setSiraAsc(v => !v)
    else { setSiraKey(key); setSiraAsc(false) }
  }

  // Hepsi seçiliyse = filtre yok (null dahil geç)
  const sirketFiltre = sirketler.size > 0
  const aktifFiltreCount = (tipler.size < TIP_OPTIONS.length ? 1 : 0) +
    (!serbest ? 1 : 0) +
    (sadecKatilim ? 1 : 0) +
    (sadecHisse ? 1 : 0) +
    (dovizMod !== 'tumu' ? 1 : 0) +
    (riskler.size < RISK_OPTIONS.length ? 1 : 0) +
    (vergiler.size < VERGI_OPTIONS.length ? 1 : 0) +
    (ucretler.size < UCRET_OPTIONS.length ? 1 : 0) +
    (tefas.size < TEFAS_OPTIONS.length ? 1 : 0) +
    (sirketler.size > 0 ? 1 : 0)

  const tipFiltre = tipler.size < TIP_OPTIONS.length
  const riskFiltre = riskler.size < RISK_OPTIONS.length
  const vergiFiltre = vergiler.size < VERGI_OPTIONS.length
  const ucretFiltre = ucretler.size < UCRET_OPTIONS.length
  const tefasFiltre = tefas.size < TEFAS_OPTIONS.length

  const filtrelenmis = fonlar.filter(f => {
    if (arama) {
      const q = arama.toLocaleLowerCase('tr-TR')
      const qEn = arama.toLowerCase()
      const sirket = (kurucuAdMap.get(f.kurucuKod ?? '') ?? '').toLocaleLowerCase('tr-TR')
      if (!f.fonKodu.toLowerCase().includes(qEn) &&
          !(f.fonUnvan ?? '').toLocaleLowerCase('tr-TR').includes(q) &&
          !sirket.includes(q) &&
          !(f.fonTurAciklama ?? '').toLocaleLowerCase('tr-TR').includes(q)) return false
    }
    if (tipFiltre && !tipler.has(f.fonTipi)) return false
    if (!serbest && (f.fonTurAciklama ?? '').toLocaleLowerCase('tr-TR').includes('serbest')) return false
    if (sadecHisse && !(f.fonTurAciklama ?? '').toLocaleLowerCase('tr-TR').includes('hisse')) return false
    if (dovizMod !== 'tumu') {
      const u = (f.fonUnvan ?? '').toLocaleLowerCase('tr-TR')
      const isDoviz = /\busd\b|\beur\b|\bdolar\b|\beuro\b|\bdöviz\b|\bavro\b|\bsterlin\b|\bgbp\b|\bchf\b|\bjpy\b/.test(u)
      if (dovizMod === 'haric' && isDoviz) return false
      if (dovizMod === 'sadece' && !isDoviz) return false
    }
    const isKatilim = (f.fonTurAciklama ?? '').toLocaleLowerCase('tr-TR').includes('katılım')
    if (sadecKatilim && !isKatilim) return false
    if (sirketFiltre && f.kurucuKod && !sirketler.has(f.kurucuKod)) return false
    if (riskFiltre) {
      const r = f.riskDegeri
      if (r != null) {
        const match = [...riskler].some(band => {
          const [min, max] = band.split('-').map(Number)
          return r >= min && r <= max
        })
        if (!match) return false
      }
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
      const src = paraBirimi === 'USD' ? 'getirilerUsd' : 'getiriler'
      av = a[src][siraKey] ?? null; bv = b[src][siraKey] ?? null
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
      <th title={title}
        className={`px-3 py-2 font-medium text-right cursor-pointer select-none whitespace-nowrap transition-colors ${aktif ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}
        onClick={() => handleSira(col)}>
        {label}{aktif ? (siraAsc ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="Fon kodu, kurucu şirket veya fon adı ile arayın..."
          value={arama} onChange={e => setArama(e.target.value)}
          className="flex-1 border border-indigo-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-white shadow-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white text-sm shrink-0">
          {(['TL', 'USD'] as const).map(pb => (
            <button key={pb} onClick={() => setParaBirimi(pb)}
              className={`px-4 py-2.5 font-medium transition-colors ${paraBirimi === pb ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {pb}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <button onClick={() => setFiltrePaneli(v => !v)}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${filtrePaneli ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>
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
          <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-4">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Fon Türü</span>
                <div className="flex flex-wrap gap-1.5">
                  {TIP_OPTIONS.map(o => (
                    <Chip key={o.value} label={o.label} active={tipler.has(o.value)}
                      onClick={() => handleTipToggle(o.value)} />
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
                    <Chip key={v} label={RISK_LABELS[v]} active={riskler.has(v)}
                      onClick={() => setRiskler(s => toggle(s, v))} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Stopaj Durumu</span>
                <div className="flex flex-wrap gap-1.5">
                  {VERGI_OPTIONS.map(v => (
                    <Chip key={v} label={VERGI_LABELS[v]} active={vergiler.has(v)}
                      onClick={() => setVergiler(s => toggle(s, v))} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 font-medium">TEFAS Durumu</span>
                <div className="flex flex-wrap gap-1.5">
                  {TEFAS_OPTIONS.map(v => (
                    <Chip key={v} label={TEFAS_LABELS[v]} active={tefas.has(v)}
                      onClick={() => setTefas(s => toggle(s, v))} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Yönetim Ücreti</span>
                <div className="flex flex-wrap gap-1.5">
                  {UCRET_OPTIONS.map(v => (
                    <Chip key={v} label={UCRET_LABELS[v]} active={ucretler.has(v)}
                      onClick={() => setUcretler(s => toggle(s, v))} />
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <span className="text-xs text-slate-500 font-medium block mb-1.5">Portföy Şirketi</span>
              <SirketCombo secili={sirketler} onChange={setSirketler} adMap={kurucuAdMap} tumKodlar={gorunurKurucular} />
            </div>
          </div>
        )}
      </div>

      <p className="text-slate-400 text-sm mb-3">{filtrelenmis.length.toLocaleString('tr-TR')} fon listeleniyor</p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-20 bg-slate-50">
            <tr className="border-b border-slate-100 text-slate-500 text-left">
              <th className="px-4 py-2 font-medium sticky left-0 bg-slate-50 z-30 w-[90px]">Kod</th>
              <ThBtn col="fiyat" label="Fiyat" title="Birim pay fiyatı (son işlem günü)" />
              <ThBtn col="portfoyBuyukluk" label="Portföy" title="Portföy büyüklüğü (₺)" />
              <ThBtn col="kisiSayisi" label="Yatırımcı" title="Yatırımcı sayısı" />
              {DONEMLER.map(d => <ThBtn key={d.key} col={d.key} label={d.label} title={d.title} />)}
            </tr>
          </thead>
          <tbody>
            {filtrelenmis.map(f => {
              const favori = favoriler.has(`${f.fonKodu}::${f.fonTipi}`)
              return (
              <tr key={`${f.fonKodu}-${f.fonTipi}`}
                className={`border-b transition-colors ${favori ? 'border-amber-100 bg-amber-50/30 hover:bg-amber-50/60' : 'border-slate-50 hover:bg-indigo-50/40'}`}>
                <td className={`px-4 py-2 sticky left-0 group/row ${favori ? 'bg-amber-50/60' : 'bg-white'}`}>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleFavori(f)}
                      title={favori ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                      className={`shrink-0 transition-opacity focus:opacity-100 ${favori ? 'opacity-100' : 'opacity-20 group-hover/row:opacity-60'}`}>
                      <svg className={`w-4 h-4 ${favori ? 'text-amber-400 fill-current' : 'text-slate-300 fill-none stroke-current'}`}
                        strokeWidth={1.5} viewBox="0 0 20 20">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                    <Link href={`/fon/${f.fonKodu}?tip=${f.fonTipi}`}
                      title={f.fonUnvan ?? undefined}
                      className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                      {f.fonKodu}
                    </Link>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-slate-600">{f.fiyat != null ? f.fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '-'}</td>
                <td className="px-3 py-2 text-right text-slate-500">{fmt(f.portfoyBuyukluk)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{f.kisiSayisi?.toLocaleString('tr-TR') ?? '-'}</td>
                {DONEMLER.map(d => (
                  <td key={d.key} className="px-3 py-2 text-right">
                    <GetiriCell val={(paraBirimi === 'USD' ? f.getirilerUsd : f.getiriler)[d.key]} />
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
