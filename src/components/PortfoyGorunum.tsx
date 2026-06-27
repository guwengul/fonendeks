'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { portfoyIslemSil, portfoyIslemGuncelle } from '@/lib/auth-actions'
import { renkBul, FonEkleForm } from './PortfoyEkleForm'

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
}

type Portfoy = { id: string; ad: string; renk?: string }

function fmt(n: number | null) {
  if (n == null) return '-'
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' Mr'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' Mn'
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
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
            <input type="number" step="0.0001" min="0.0001" value={yeniAdet}
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
  const maliyet = islemler.reduce((s, i) => s + i.fiyat * i.adet, 0)
  const guncel = islemler.reduce((s, i) => s + (i.guncelFiyat ? i.guncelFiyat * i.adet : i.fiyat * i.adet), 0)
  const kazanc = guncel - maliyet
  const kazancPct = maliyet > 0 ? (kazanc / maliyet) * 100 : 0

  const fonMap = new Map<string, Islem[]>()
  for (const i of islemler) {
    const key = `${i.fonKodu}::${i.fonTipi}`
    if (!fonMap.has(key)) fonMap.set(key, [])
    fonMap.get(key)!.push(i)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 px-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{ad}</span>
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-400">{fmt(maliyet)} ₺</span>
        <span className={`text-xs font-semibold ${kazancPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {pct(kazancPct)}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {[...fonMap.entries()].map(([key, fislemler]) => (
          <FonGrubu key={key}
            fonKodu={fislemler[0].fonKodu}
            fonTipi={fislemler[0].fonTipi}
            fonUnvan={fislemler[0].fonUnvan}
            islemler={fislemler} />
        ))}
      </div>
    </div>
  )
}

function PortfoySection({ portfoy, pislemler }: { portfoy: Portfoy; pislemler: Islem[] }) {
  const [fonEkleAcik, setFonEkleAcik] = useState(false)

  const ptMaliyet = pislemler.reduce((s, i) => s + i.fiyat * i.adet, 0)
  const ptGuncel = pislemler.reduce((s, i) => s + (i.guncelFiyat ? i.guncelFiyat * i.adet : i.fiyat * i.adet), 0)
  const ptKazanc = ptGuncel - ptMaliyet
  const ptPct = ptMaliyet > 0 ? (ptKazanc / ptMaliyet) * 100 : 0

  const grupMap = new Map<string, Islem[]>()
  for (const i of pislemler) {
    if (!grupMap.has(i.varlik_grubu)) grupMap.set(i.varlik_grubu, [])
    grupMap.get(i.varlik_grubu)!.push(i)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className={`w-3 h-3 rounded-full shrink-0 ${renkBul(portfoy.renk ?? 'blue').dot}`} />
          <h2 className="text-lg font-bold text-slate-800">{portfoy.ad}</h2>
          {pislemler.length > 0 && (
            <div className="flex items-center gap-3 ml-2">
              <span className="text-slate-400 text-xs">{fmt(ptMaliyet)} ₺</span>
              <span className={`text-sm font-bold ${ptKazanc >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{pct(ptPct)}</span>
            </div>
          )}
        </div>
        <button onClick={() => setFonEkleAcik(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Fon Ekle
        </button>
      </div>

      {fonEkleAcik && (
        <div className="mb-5">
          <FonEkleForm
            portfoy={portfoy}
            onKapat={() => setFonEkleAcik(false)}
          />
        </div>
      )}

      {pislemler.length === 0 && !fonEkleAcik && (
        <p className="text-slate-400 text-sm">Bu portföyde henüz fon yok.</p>
      )}

      {pislemler.length > 0 && (
        <div className="flex flex-col gap-5">
          {[...grupMap.entries()].map(([grupAd, gislemler]) => (
            <VarlikGrubuSection key={grupAd} ad={grupAd} islemler={gislemler} />
          ))}
        </div>
      )}
    </div>
  )
}

export function PortfoyGorunum({ portfoyler, islemler }: { portfoyler: Portfoy[]; islemler: Islem[] }) {
  const toplamMaliyet = islemler.reduce((s, i) => s + i.fiyat * i.adet, 0)
  const toplamGuncel = islemler.reduce((s, i) => s + (i.guncelFiyat ? i.guncelFiyat * i.adet : i.fiyat * i.adet), 0)
  const toplamKazanc = toplamGuncel - toplamMaliyet
  const toplamPct = toplamMaliyet > 0 ? (toplamKazanc / toplamMaliyet) * 100 : 0

  const islemMap = new Map<string, Islem[]>()
  for (const i of islemler) {
    if (!islemMap.has(i.portfoy_id)) islemMap.set(i.portfoy_id, [])
    islemMap.get(i.portfoy_id)!.push(i)
  }

  return (
    <div className="max-w-4xl flex flex-col gap-8">
      {islemler.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 mb-1">Toplam Maliyet</p>
            <p className="text-lg font-bold text-slate-900">{fmt(toplamMaliyet)} ₺</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 mb-1">Güncel Değer</p>
            <p className="text-lg font-bold text-slate-900">{fmt(toplamGuncel)} ₺</p>
          </div>
          <div className={`rounded-xl border p-4 ${toplamKazanc >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
            <p className="text-xs text-slate-400 mb-1">Toplam Kazanç</p>
            <p className={`text-lg font-bold ${toplamKazanc >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {fmt(toplamKazanc)} ₺
              <span className="text-sm ml-1">({pct(toplamPct)})</span>
            </p>
          </div>
        </div>
      )}

      {portfoyler.map(portfoy => {
        const pislemler = islemMap.get(portfoy.id) ?? []
        const ptMaliyet = pislemler.reduce((s, i) => s + i.fiyat * i.adet, 0)
        const ptGuncel = pislemler.reduce((s, i) => s + (i.guncelFiyat ? i.guncelFiyat * i.adet : i.fiyat * i.adet), 0)
        const ptKazanc = ptGuncel - ptMaliyet
        const ptPct = ptMaliyet > 0 ? (ptKazanc / ptMaliyet) * 100 : 0

        const grupMap = new Map<string, Islem[]>()
        for (const i of pislemler) {
          if (!grupMap.has(i.varlik_grubu)) grupMap.set(i.varlik_grubu, [])
          grupMap.get(i.varlik_grubu)!.push(i)
        }

        return (
          <PortfoySection key={portfoy.id} portfoy={portfoy} pislemler={pislemler} />
        )
      })}
    </div>
  )
}
