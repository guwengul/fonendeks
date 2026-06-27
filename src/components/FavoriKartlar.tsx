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
  portfoyDegisim1a: number | null
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

function DegisimBadge({ val, fmt: fmtFn }: { val: number | null; fmt?: (n: number) => string }) {
  if (val == null) return null
  const pozitif = val >= 0
  const label = fmtFn ? fmtFn(val) : val.toLocaleString('tr-TR')
  return (
    <span className={`text-xs font-semibold ${pozitif ? 'text-emerald-500' : 'text-red-500'}`}>
      {pozitif ? '+' : ''}{label}
    </span>
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

      {/* Üst: kod + etiketler + kaldır */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/fon/${k.fonKodu}?tip=${k.fonTipi}`}
              className="font-mono font-bold text-indigo-600 hover:text-indigo-800 text-lg transition-colors">
              {k.fonKodu}
            </Link>
            {k.riskDegeri != null && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                Risk {k.riskDegeri}
              </span>
            )}
            {k.yonetimUcreti != null && k.yonetimUcreti > 0 && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                %{k.yonetimUcreti}
              </span>
            )}
            {k.stopaj === 0 && (
              <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
                Vergisiz
              </span>
            )}
          </div>
          {k.fonUnvan && (
            <p className="text-xs text-slate-400 mt-1 leading-snug line-clamp-2">{k.fonUnvan}</p>
          )}
        </div>
        <button onClick={kaldir} title="Favorilerden çıkar"
          className="text-amber-400 hover:text-slate-300 transition-colors shrink-0 mt-0.5">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      </div>

      {/* Eklemeden beri değişim */}
      {k.degisim != null && (
        <div className={`mx-5 mb-3 rounded-xl px-4 py-3 ${pozitif ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <p className="text-xs text-slate-400 mb-0.5">Eklemeden beri</p>
          <p className={`text-2xl font-bold ${pozitif ? 'text-emerald-600' : 'text-red-600'}`}>
            {pozitif ? '+' : ''}{k.degisim.toFixed(2)}%
          </p>
          {k.eklemeTarihi && (
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(k.eklemeTarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}{k.eklemeFiyati?.toFixed(4)} → {k.fiyat?.toFixed(4)}
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

      {/* Yatırımcı + portföy büyüklüğü */}
      <div className="px-5 pt-4 pb-4 mt-3 border-t border-slate-50 flex flex-col gap-2">
        {k.kisiSayisi != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Yatırımcı</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">{k.kisiSayisi.toLocaleString('tr-TR')}</span>
              <DegisimBadge val={k.kisiDegisim1a} fmt={n => `${Math.abs(n).toLocaleString('tr-TR')} / ay`} />
            </div>
          </div>
        )}
        {k.portfoyBuyukluk != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Portföy</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">{fmt(k.portfoyBuyukluk)}</span>
              <DegisimBadge val={k.portfoyDegisim1a} fmt={n => `${fmt(Math.abs(n))} / ay`} />
            </div>
          </div>
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
