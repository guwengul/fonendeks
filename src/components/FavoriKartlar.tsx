'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { favoriKaldir } from '@/lib/auth-actions'

type Kart = {
  fonKodu: string
  fonTipi: string
  fonUnvan: string | null
  fiyat: number | null
  eklemeFiyati: number | null
  eklemeTarihi: string | null
  degisim: number | null
  riskDegeri: number | null
  yonetimUcreti: number | null
  stopaj: number | null
  portfoyBuyukluk: number | null
  kisiSayisi: number | null
  kisiDegisim1a: number | null
  getiriler: Record<string, number | null>
}

function fmt(n: number | null) {
  if (n == null) return '-'
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' Mr'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' Mn'
  return n.toLocaleString('tr-TR')
}

function GetiriSatir({ label, val }: { label: string; val: number | null }) {
  if (val == null) return null
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-semibold ${val >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {val >= 0 ? '+' : ''}{val.toFixed(2)}%
      </span>
    </div>
  )
}

function FavoriKart({ k }: { k: Kart }) {
  const [, startTransition] = useTransition()
  const router = useRouter()

  function kaldir() {
    startTransition(async () => {
      await favoriKaldir(k.fonKodu, k.fonTipi)
      router.refresh()
    })
  }

  const pozitif = (k.degisim ?? 0) >= 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col">
      {/* Üst: kod + kaldır */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <div className="min-w-0">
          <Link href={`/fon/${k.fonKodu}?tip=${k.fonTipi}`}
            className="font-mono font-bold text-indigo-600 hover:text-indigo-800 text-lg transition-colors">
            {k.fonKodu}
          </Link>
          {k.fonUnvan && (
            <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-2">{k.fonUnvan}</p>
          )}
        </div>
        <button onClick={kaldir} title="Favorilerden çıkar"
          className="text-amber-400 hover:text-slate-300 transition-colors ml-3 shrink-0 mt-0.5">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      </div>

      {/* Ekleme değişimi — ana metrik */}
      {k.degisim != null && (
        <div className={`mx-5 mb-3 rounded-xl px-4 py-3 ${pozitif ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <p className="text-xs text-slate-400 mb-0.5">Eklemeden beri</p>
          <p className={`text-2xl font-bold ${pozitif ? 'text-emerald-600' : 'text-red-600'}`}>
            {pozitif ? '+' : ''}{k.degisim.toFixed(2)}%
          </p>
          {k.eklemeTarihi && (
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(k.eklemeTarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} · {k.eklemeFiyati?.toFixed(4)} → {k.fiyat?.toFixed(4)}
            </p>
          )}
        </div>
      )}

      {/* Getiri özeti */}
      <div className="px-5 flex flex-col gap-1.5 flex-1">
        <GetiriSatir label="1 Günlük" val={k.getiriler['1g']} />
        <GetiriSatir label="1 Aylık" val={k.getiriler['1a']} />
        <GetiriSatir label="1 Yıllık" val={k.getiriler['1y']} />
        <GetiriSatir label="3 Yıllık" val={k.getiriler['3y']} />
      </div>

      {/* Yatırımcı sayısı */}
      {k.kisiSayisi != null && (
        <div className="px-5 pb-3 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs text-slate-500">{k.kisiSayisi.toLocaleString('tr-TR')} yatırımcı</span>
          {k.kisiDegisim1a != null && (
            <span className={`text-xs font-semibold ml-auto ${k.kisiDegisim1a >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {k.kisiDegisim1a >= 0 ? '+' : ''}{k.kisiDegisim1a.toLocaleString('tr-TR')} / ay
            </span>
          )}
        </div>
      )}

      {/* Alt bilgi */}
      <div className="px-5 pt-3 pb-4 border-t border-slate-50 flex flex-wrap gap-x-4 gap-y-1">
        {k.riskDegeri != null && (
          <span className="text-xs text-slate-400">Risk <span className="text-slate-600 font-medium">{k.riskDegeri}</span></span>
        )}
        {k.yonetimUcreti != null && (
          <span className="text-xs text-slate-400">Ücret <span className="text-slate-600 font-medium">%{k.yonetimUcreti}</span></span>
        )}
        {k.stopaj === 0 && (
          <span className="text-xs text-emerald-600 font-medium">Vergisiz</span>
        )}
        {k.portfoyBuyukluk != null && (
          <span className="text-xs text-slate-400">Portföy <span className="text-slate-600 font-medium">{fmt(k.portfoyBuyukluk)}</span></span>
        )}
      </div>
    </div>
  )
}

export function FavoriKartlar({ kartlar }: { kartlar: Kart[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {kartlar.map(k => (
        <FavoriKart key={`${k.fonKodu}::${k.fonTipi}`} k={k} />
      ))}
    </div>
  )
}
