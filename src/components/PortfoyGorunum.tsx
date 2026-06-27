'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { portfoyIslemSil, portfoyIslemGuncelle, portfoyGuncelle, portfoySil } from '@/lib/auth-actions'
import { renkBul, FonEkleForm, RENKLER } from './PortfoyEkleForm'

type Islem = {
  id: string
  portfoy_id: string
  varlik_grubu: string
  fonKodu: string
  fonTipi: string
  fonUnvan: string | null
  tarih: string
  fiyat: number
  adet: number
  guncelFiyat: number | null
  getiri1g: number | null
}

type Portfoy = { id: string; ad: string; renk?: string }

function fmt(n: number | null) {
  if (n == null) return '-'
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' Mr'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' Mn'
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtUsd(n: number | null, kur: number | null) {
  if (n == null || !kur) return null
  const usd = n / kur
  if (Math.abs(usd) >= 1_000_000) return (usd / 1_000_000).toFixed(2) + ' M$'
  if (Math.abs(usd) >= 1_000) return (usd / 1_000).toFixed(1) + ' K$'
  return usd.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $'
}

function pct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

const GRUP_RENKLER: Record<string, string> = {
  'Hisse Senedi': '#6366f1',
  'Borçlanma Araçları': '#3b82f6',
  'Para Piyasası': '#10b981',
  'Kıymetli Maden': '#f59e0b',
  'Döviz': '#8b5cf6',
  'Karma / Değişken': '#64748b',
  'Diğer': '#94a3b8',
}

function grupRenk(ad: string) {
  return GRUP_RENKLER[ad] ?? '#94a3b8'
}

// Basit donut chart SVG
function DonutChart({ segments, size = 80 }: {
  segments: { label: string; value: number; color: string }[]
  size?: number
}) {
  const total = segments.reduce((s, g) => s + g.value, 0)
  if (total === 0) return null

  const r = size / 2 - 6
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const gap = 2

  let offset = 0
  const paths = segments.map((seg, i) => {
    const pct = seg.value / total
    const dash = Math.max(0, circumference * pct - gap)
    const el = (
      <circle key={i} cx={cx} cy={cy} r={r}
        fill="none" stroke={seg.color} strokeWidth={10}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-offset + circumference / 4}
        style={{ transition: 'stroke-dasharray 0.3s' }} />
    )
    offset += circumference * pct
    return el
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths}
    </svg>
  )
}

// Dumbbell chart — allocation drift görselleştirmesi
function DagilimPanel({ grupMap }: { grupMap: Map<string, Islem[]> }) {
  const [mod, setMod] = useState<'grup' | 'fon'>('grup')

  const grupRows = [...grupMap.entries()].map(([ad, islemler]) => ({
    label: ad,
    color: grupRenk(ad),
    maliyet: islemler.reduce((s, i) => s + i.fiyat * i.adet, 0),
    guncel: islemler.reduce((s, i) => s + (i.guncelFiyat ?? i.fiyat) * i.adet, 0),
  })).filter(r => r.maliyet > 0)

  const fonAcc = new Map<string, { label: string; maliyet: number; guncel: number; color: string }>()
  for (const [grupAd, islemler] of grupMap.entries()) {
    for (const i of islemler) {
      const key = `${i.fonKodu}::${i.fonTipi}`
      if (!fonAcc.has(key)) fonAcc.set(key, { label: i.fonKodu, maliyet: 0, guncel: 0, color: grupRenk(grupAd) })
      const e = fonAcc.get(key)!
      e.maliyet += i.fiyat * i.adet
      e.guncel += (i.guncelFiyat ?? i.fiyat) * i.adet
    }
  }
  const fonRows = [...fonAcc.values()].filter(r => r.maliyet > 0)

  const rows = mod === 'grup' ? grupRows : fonRows
  const totalMaliyet = rows.reduce((s, r) => s + r.maliyet, 0)
  const totalGuncel = rows.reduce((s, r) => s + r.guncel, 0)

  const data = rows.map(r => ({
    label: r.label,
    color: r.color,
    mp: totalMaliyet > 0 ? r.maliyet / totalMaliyet * 100 : 0,
    gp: totalGuncel > 0 ? r.guncel / totalGuncel * 100 : 0,
  }))

  // SVG dumbbell chart
  const W = 280
  const ROW_H = 20
  const LABEL_W = 88
  const CHART_W = W - LABEL_W - 36
  const H = data.length * ROW_H + 16
  const maxPct = Math.ceil(Math.max(...data.map(d => Math.max(d.mp, d.gp))) / 10) * 10 || 100

  function xPos(pct: number) {
    return LABEL_W + (pct / maxPct) * CHART_W
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dağılım Kayması</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-slate-300 bg-white" />
              Alış
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-700" />
              Güncel
            </span>
          </div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            <button onClick={() => setMod('grup')}
              className={`px-2.5 py-1 transition-colors ${mod === 'grup' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              Grup
            </button>
            <button onClick={() => setMod('fon')}
              className={`px-2.5 py-1 transition-colors ${mod === 'fon' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              Fon
            </button>
          </div>
        </div>
      </div>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {/* Axis gridlines */}
        {[0, 25, 50, 75, 100].filter(v => v <= maxPct).map(v => (
          <g key={v}>
            <line x1={xPos(v)} y1={0} x2={xPos(v)} y2={H - 14}
              stroke="#f1f5f9" strokeWidth={1} />
            <text x={xPos(v)} y={H - 4} textAnchor="middle" fontSize="7" fill="#cbd5e1">{v}%</text>
          </g>
        ))}

        {/* Rows */}
        {data.map((d, i) => {
          const y = i * ROW_H + ROW_H / 2
          const x1 = xPos(d.mp)
          const x2 = xPos(d.gp)
          const diff = d.gp - d.mp
          const lineColor = Math.abs(diff) < 0.5 ? '#e2e8f0' : diff > 0 ? '#10b981' : '#f87171'
          const moved = Math.abs(diff) >= 0.5

          return (
            <g key={d.label}>
              {/* Label */}
              <text x={LABEL_W - 6} y={y + 1} textAnchor="end" dominantBaseline="middle"
                fontSize="9" fill="#475569">
                {d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label}
              </text>

              {/* Connecting line */}
              {moved && (
                <line x1={x1} y1={y} x2={x2} y2={y}
                  stroke={lineColor} strokeWidth={2} strokeLinecap="round" />
              )}

              {/* Alış dot (hollow) */}
              <circle cx={x1} cy={y} r={5} fill="white" stroke={d.color} strokeWidth={2} opacity={0.7} />

              {/* Güncel dot (filled) */}
              <circle cx={x2} cy={y} r={5.5} fill={d.color} />

              {/* Delta label */}
              {moved && (
                <text x={W - 2} y={y + 1} textAnchor="end" dominantBaseline="middle"
                  fontSize="9" fontWeight="600"
                  fill={diff > 0 ? '#10b981' : '#f87171'}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)}pp
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function IslemSatir({ islem }: { islem: Islem }) {
  const [duzenle, setDuzenle] = useState(false)
  const [yeniAdet, setYeniAdet] = useState(String(islem.adet))
  const [, startTransition] = useTransition()
  const router = useRouter()

  const maliyet = islem.fiyat * islem.adet
  const guncel = islem.guncelFiyat ? islem.guncelFiyat * islem.adet : null
  const kazanc = guncel != null ? guncel - maliyet : null
  const kazancPct = kazanc != null && maliyet > 0 ? (kazanc / maliyet) * 100 : null

  function kaydet() {
    const a = Number(yeniAdet)
    if (!a || a <= 0) return
    startTransition(async () => {
      await portfoyIslemGuncelle(islem.id, a)
      router.refresh()
    })
    setDuzenle(false)
  }

  function sil() {
    startTransition(async () => {
      await portfoyIslemSil(islem.id)
      router.refresh()
    })
  }

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors text-sm">
      <td className="px-4 py-2.5 text-slate-400 text-xs">{islem.tarih}</td>
      <td className="px-4 py-2.5 text-right text-slate-500 text-xs">{islem.fiyat.toFixed(6)}</td>
      <td className="px-4 py-2.5 text-right">
        {duzenle ? (
          <div className="flex items-center justify-end gap-1">
            <input type="number" step="1" min="1" value={yeniAdet}
              onChange={e => setYeniAdet(e.target.value)}
              className="w-24 border border-indigo-300 rounded px-2 py-0.5 text-xs focus:outline-none" />
            <button onClick={kaydet} className="text-xs text-indigo-600 font-medium hover:text-indigo-800">✓</button>
            <button onClick={() => { setDuzenle(false); setYeniAdet(String(islem.adet)) }}
              className="text-xs text-slate-400 hover:text-slate-600">✕</button>
          </div>
        ) : (
          <button onClick={() => setDuzenle(true)}
            className="text-slate-700 hover:text-indigo-600 transition-colors">
            {islem.adet.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
          </button>
        )}
      </td>
      <td className="px-4 py-2.5 text-right text-slate-500 text-xs">{fmt(maliyet)} ₺</td>
      <td className="px-4 py-2.5 text-right text-slate-600 text-xs">{guncel ? fmt(guncel) + ' ₺' : '—'}</td>
      <td className="px-4 py-2.5 text-right">
        {kazancPct != null && (
          <span className={`text-xs font-semibold ${kazancPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {pct(kazancPct)}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center">
        <button onClick={sil} className="text-slate-200 hover:text-red-400 transition-colors text-base leading-none">×</button>
      </td>
    </tr>
  )
}

function FonGrubu({ fonKodu, fonTipi, fonUnvan, islemler }: {
  fonKodu: string; fonTipi: string; fonUnvan: string | null; islemler: Islem[]
}) {
  const [acik, setAcik] = useState(false)

  const toplamAdet = islemler.reduce((s, i) => s + i.adet, 0)
  const toplamMaliyet = islemler.reduce((s, i) => s + i.fiyat * i.adet, 0)
  const ortFiyat = toplamAdet > 0 ? toplamMaliyet / toplamAdet : 0
  const guncelFiyat = islemler[0]?.guncelFiyat
  const guncelDeger = guncelFiyat ? toplamAdet * guncelFiyat : null
  const kazanc = guncelDeger != null ? guncelDeger - toplamMaliyet : null
  const kazancPct = kazanc != null && toplamMaliyet > 0 ? (kazanc / toplamMaliyet) * 100 : null

  // günlük kazanç
  const getiri1g = islemler[0]?.getiri1g
  const gunlukKazanc = guncelDeger != null && getiri1g != null
    ? guncelDeger * getiri1g / 100 / (1 + getiri1g / 100)
    : null

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button onClick={() => setAcik(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${acik ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/fon/${fonKodu}?tip=${fonTipi}`} onClick={e => e.stopPropagation()}
          className="font-mono font-bold text-indigo-600 hover:underline text-sm shrink-0">
          {fonKodu}
        </Link>
        {fonUnvan && <span className="text-xs text-slate-400 truncate">{fonUnvan}</span>}
        <div className="ml-auto flex items-center gap-4 shrink-0 text-sm">
          <span className="text-slate-500 text-xs">{toplamAdet.toLocaleString('tr-TR', { maximumFractionDigits: 4 })} adet</span>
          <span className="text-slate-400 text-xs">ort. {ortFiyat.toFixed(6)}</span>
          {guncelDeger != null && <span className="text-slate-700 font-medium text-xs">{fmt(guncelDeger)} ₺</span>}
          {gunlukKazanc != null && (
            <span className={`text-xs ${gunlukKazanc >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
              {gunlukKazanc >= 0 ? '+' : ''}{fmt(gunlukKazanc)} ₺ bugün
            </span>
          )}
          {kazancPct != null && (
            <span className={`font-bold text-sm ${kazancPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {pct(kazancPct)}
            </span>
          )}
        </div>
      </button>

      {acik && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-100">
              <th className="text-left px-4 py-2">Tarih</th>
              <th className="text-right px-4 py-2">Alış Fiyatı</th>
              <th className="text-right px-4 py-2">Adet</th>
              <th className="text-right px-4 py-2">Maliyet</th>
              <th className="text-right px-4 py-2">Güncel</th>
              <th className="text-right px-4 py-2">Kazanç</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {islemler.map(i => <IslemSatir key={i.id} islem={i} />)}
          </tbody>
        </table>
      )}
    </div>
  )
}

function VarlikGrubuSection({ ad, islemler }: { ad: string; islemler: Islem[] }) {
  const [acik, setAcik] = useState(true)

  const maliyet = islemler.reduce((s, i) => s + i.fiyat * i.adet, 0)
  const guncel = islemler.reduce((s, i) => s + (i.guncelFiyat ? i.guncelFiyat * i.adet : i.fiyat * i.adet), 0)
  const kazanc = guncel - maliyet
  const kazancPct = maliyet > 0 ? (kazanc / maliyet) * 100 : 0

  const gunlukKazanc = islemler.reduce((s, i) => {
    if (i.guncelFiyat == null || i.getiri1g == null) return s
    const gd = i.guncelFiyat * i.adet
    return s + gd * i.getiri1g / 100 / (1 + i.getiri1g / 100)
  }, 0)

  const renk = grupRenk(ad)

  const fonMap = new Map<string, Islem[]>()
  for (const i of islemler) {
    const key = `${i.fonKodu}::${i.fonTipi}`
    if (!fonMap.has(key)) fonMap.set(key, [])
    fonMap.get(key)!.push(i)
  }

  return (
    <div>
      <button onClick={() => setAcik(v => !v)}
        className="w-full flex items-center gap-3 mb-2 px-1 text-left hover:opacity-80 transition-opacity">
        <svg className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${acik ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: renk }} />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{ad}</span>
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-400">{fmt(maliyet)} ₺</span>
        {gunlukKazanc !== 0 && (
          <span className={`text-xs ${gunlukKazanc >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {gunlukKazanc >= 0 ? '+' : ''}{fmt(gunlukKazanc)} bugün
          </span>
        )}
        <span className={`text-xs font-semibold ${kazancPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {pct(kazancPct)}
        </span>
      </button>
      {acik && (
        <div className="flex flex-col gap-2">
          {[...fonMap.entries()].map(([key, fislemler]) => (
            <FonGrubu key={key}
              fonKodu={fislemler[0].fonKodu}
              fonTipi={fislemler[0].fonTipi}
              fonUnvan={fislemler[0].fonUnvan}
              islemler={fislemler} />
          ))}
        </div>
      )}
    </div>
  )
}

// Portföy edit modal
function PortfoyEditModal({ portfoy, onKapat }: { portfoy: Portfoy; onKapat: () => void }) {
  const [ad, setAd] = useState(portfoy.ad)
  const [renk, setRenk] = useState(portfoy.renk ?? 'blue')
  const [silOnayi, setSilOnayi] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function handleKaydet() {
    const adSon = ad.trim()
    if (!adSon) return
    setYukleniyor(true)
    const sonuc = await portfoyGuncelle(portfoy.id, adSon, renk)
    setYukleniyor(false)
    if (sonuc?.hata) { setHata(sonuc.hata); return }
    router.refresh()
    onKapat()
  }

  function handleSil() {
    startTransition(async () => {
      await portfoySil(portfoy.id)
      router.refresh()
      onKapat()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onKapat}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Portföyü Düzenle</h3>
          <button onClick={onKapat} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        <div>
          <label className="text-xs text-slate-500 font-medium block mb-1.5">Ad</label>
          <input value={ad} onChange={e => setAd(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-2">Renk</label>
          <div className="flex gap-2">
            {RENKLER.map(r => (
              <button key={r.key} type="button" onClick={() => setRenk(r.key)}
                style={{ backgroundColor: r.hex, outline: renk === r.key ? `3px solid ${r.hex}` : 'none', outlineOffset: '3px', opacity: renk === r.key ? 1 : 0.4 }}
                className="w-7 h-7 rounded-full transition-all hover:opacity-100" />
            ))}
          </div>
        </div>
        {hata && <p className="text-sm text-red-600">{hata}</p>}
        <div className="flex gap-2">
          <button onClick={handleKaydet} disabled={yukleniyor || !ad.trim()}
            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {yukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button onClick={onKapat}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            İptal
          </button>
        </div>

        <div className="border-t border-slate-100 pt-4">
          {!silOnayi ? (
            <button onClick={() => setSilOnayi(true)}
              className="w-full py-2 text-red-500 border border-red-200 rounded-lg text-sm hover:bg-red-50 transition-colors">
              Portföyü Sil
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-slate-500 text-center">Tüm işlemler de silinecek. Emin misin?</p>
              <div className="flex gap-2">
                <button onClick={handleSil}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  Evet, Sil
                </button>
                <button onClick={() => setSilOnayi(false)}
                  className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Vazgeç
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PortfoySection({ portfoy, pislemler, usdKuru }: {
  portfoy: Portfoy; pislemler: Islem[]; usdKuru: number | null
}) {
  const [acik, setAcik] = useState(true)
  const [fonEkleAcik, setFonEkleAcik] = useState(false)
  const [editAcik, setEditAcik] = useState(false)

  const ptMaliyet = pislemler.reduce((s, i) => s + i.fiyat * i.adet, 0)
  const ptGuncel = pislemler.reduce((s, i) => s + (i.guncelFiyat ? i.guncelFiyat * i.adet : i.fiyat * i.adet), 0)
  const ptKazanc = ptGuncel - ptMaliyet
  const ptPct = ptMaliyet > 0 ? (ptKazanc / ptMaliyet) * 100 : 0

  const ptGunlukKazanc = pislemler.reduce((s, i) => {
    if (i.guncelFiyat == null || i.getiri1g == null) return s
    const gd = i.guncelFiyat * i.adet
    return s + gd * i.getiri1g / 100 / (1 + i.getiri1g / 100)
  }, 0)

  const hex = renkBul(portfoy.renk ?? 'blue').hex

  const grupMap = new Map<string, Islem[]>()
  for (const i of pislemler) {
    if (!grupMap.has(i.varlik_grubu)) grupMap.set(i.varlik_grubu, [])
    grupMap.get(i.varlik_grubu)!.push(i)
  }

  return (
    <>
      {editAcik && <PortfoyEditModal portfoy={portfoy} onKapat={() => setEditAcik(false)} />}
      <div className="rounded-2xl border border-slate-200 overflow-hidden"
        style={{ borderLeftColor: hex, borderLeftWidth: 4 }}>

        {/* Accordion başlık */}
        <div className="flex items-center gap-3 px-5 py-4 bg-white">
          <button onClick={() => setAcik(v => !v)} className="flex items-center gap-3 flex-1 text-left min-w-0">
            <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${acik ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-semibold text-slate-800">{portfoy.ad}</span>
            {pislemler.length > 0 && !acik && (
              <span className="flex items-center gap-3 ml-1">
                <span className="text-slate-400 text-xs">{fmt(ptMaliyet)} ₺</span>
                <span className="text-slate-300 text-xs">→</span>
                <span className="text-slate-600 text-xs font-medium">{fmt(ptGuncel)} ₺</span>
                <span className={`text-sm font-bold ${ptKazanc >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{pct(ptPct)}</span>
              </span>
            )}
          </button>
          <button onClick={() => setEditAcik(true)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            title="Düzenle">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={() => { setFonEkleAcik(v => !v); if (!acik) setAcik(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Fon Ekle
          </button>
        </div>

        {/* Accordion içerik */}
        {acik && (
          <div className="border-t border-slate-100 px-5 py-5 flex flex-col gap-5 bg-slate-50/40">

            {/* Özet kartlar + dağılım grafikleri yan yana */}
            {pislemler.length > 0 && (
              <div className="flex gap-4 items-start">
                {/* Sol: özet kartlar 2x2 */}
                <div className="grid grid-cols-2 gap-3 shrink-0 w-72">
                  <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-xs text-slate-400 mb-0.5">Maliyet</p>
                    <p className="text-sm font-bold text-slate-900">{fmt(ptMaliyet)} ₺</p>
                    {usdKuru && <p className="text-xs text-slate-400 mt-0.5">{fmtUsd(ptMaliyet, usdKuru)}</p>}
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-xs text-slate-400 mb-0.5">Güncel</p>
                    <p className="text-sm font-bold text-slate-900">{fmt(ptGuncel)} ₺</p>
                    {usdKuru && <p className="text-xs text-slate-400 mt-0.5">{fmtUsd(ptGuncel, usdKuru)}</p>}
                  </div>
                  <div className={`rounded-xl border px-4 py-3 ${ptKazanc >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <p className="text-xs text-slate-400 mb-0.5">Toplam Kazanç</p>
                    <p className={`text-sm font-bold ${ptKazanc >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmt(ptKazanc)} ₺
                    </p>
                    <p className={`text-xs ${ptKazanc >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{pct(ptPct)}</p>
                  </div>
                  <div className={`rounded-xl border px-4 py-3 ${ptGunlukKazanc >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                    <p className="text-xs text-slate-400 mb-0.5">Günlük Getiri</p>
                    <p className={`text-sm font-bold ${ptGunlukKazanc >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
                      {ptGunlukKazanc >= 0 ? '+' : ''}{fmt(ptGunlukKazanc)} ₺
                    </p>
                    {usdKuru && <p className="text-xs text-slate-400 mt-0.5">{fmtUsd(ptGunlukKazanc, usdKuru)}</p>}
                  </div>
                </div>

                {/* Sağ: dağılım grafikleri */}
                {grupMap.size > 1 && (
                  <div className="flex-1 min-w-0">
                    <DagilimPanel grupMap={grupMap} />
                  </div>
                )}
              </div>
            )}

            {fonEkleAcik && (
              <FonEkleForm portfoy={portfoy} onKapat={() => setFonEkleAcik(false)} />
            )}
            {pislemler.length === 0 && !fonEkleAcik && (
              <p className="text-slate-400 text-sm">Henüz fon eklenmedi.</p>
            )}
            {pislemler.length > 0 && (
              <div className="flex flex-col gap-5">
                {[...grupMap.entries()].map(([grupAd, gislemler]) => (
                  <VarlikGrubuSection key={grupAd} ad={grupAd} islemler={gislemler} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export function PortfoyGorunum({ portfoyler, islemler, usdKuru }: {
  portfoyler: Portfoy[]
  islemler: Islem[]
  usdKuru: number | null
}) {
  const islemMap = new Map<string, Islem[]>()
  for (const i of islemler) {
    if (!islemMap.has(i.portfoy_id)) islemMap.set(i.portfoy_id, [])
    islemMap.get(i.portfoy_id)!.push(i)
  }

  return (
    <div className="flex flex-col gap-4">
      {portfoyler.map(portfoy => (
        <PortfoySection key={portfoy.id} portfoy={portfoy}
          pislemler={islemMap.get(portfoy.id) ?? []}
          usdKuru={usdKuru} />
      ))}
    </div>
  )
}
