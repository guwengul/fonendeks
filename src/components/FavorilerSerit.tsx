'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type FavoriItem = {
  fonKodu: string
  fonTipi: string
  fonUnvan: string | null
  eklemeFiyati: number | null
  guncelFiyat: number | null
  degisim: number | null
}

export function FavorilerSerit() {
  const [favoriler, setFavoriler] = useState<FavoriItem[] | null>(null)

  useEffect(() => {
    fetch('/api/kullanici/favoriler')
      .then(r => r.json())
      .then(d => setFavoriler(Array.isArray(d) && d.length > 0 ? d : []))
      .catch(() => setFavoriler([]))
  }, [])

  if (!favoriler || favoriler.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Favorilerim</span>
        <Link href="/favoriler" className="text-xs text-indigo-500 hover:text-indigo-700">Tümü →</Link>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {favoriler.map(f => {
          const pozitif = (f.degisim ?? 0) >= 0
          return (
            <Link key={`${f.fonKodu}-${f.fonTipi}`}
              href={`/fon/${f.fonKodu}?tip=${f.fonTipi}`}
              className="flex-shrink-0 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-200 hover:shadow-sm transition-all min-w-[140px]">
              <p className="font-mono font-bold text-indigo-600 text-sm">{f.fonKodu}</p>
              <p className="text-xs text-slate-400 truncate max-w-[120px] mt-0.5">{f.fonUnvan ?? ''}</p>
              {f.degisim != null && (
                <p className={`text-sm font-semibold mt-1 ${pozitif ? 'text-emerald-600' : 'text-red-600'}`}>
                  {pozitif ? '+' : ''}{f.degisim.toFixed(2)}%
                </p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
