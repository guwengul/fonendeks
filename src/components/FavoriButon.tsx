'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { favoriEkle, favoriKaldir } from '@/lib/auth-actions'

export function FavoriButon({ fonKodu, fonTipi, fiyat, tarih, baslangicFavori }: {
  fonKodu: string; fonTipi: string; fiyat: number; tarih: string; baslangicFavori: boolean
}) {
  const [favori, setFavori] = useState(baslangicFavori)
  const [yukleniyor, setYukleniyor] = useState(false)
  const router = useRouter()

  async function toggle() {
    setYukleniyor(true)
    if (favori) {
      await favoriKaldir(fonKodu, fonTipi)
      setFavori(false)
    } else {
      await favoriEkle(fonKodu, fonTipi, fiyat, tarih)
      setFavori(true)
    }
    setYukleniyor(false)
    router.refresh()
  }

  return (
    <button onClick={toggle} disabled={yukleniyor}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
        favori
          ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
          : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600'
      }`}
      title={favori ? 'Favorilerden çıkar' : 'Favorilere ekle'}>
      <svg className="w-4 h-4" fill={favori ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
      {favori ? 'Favoride' : 'Favoriye Ekle'}
    </button>
  )
}
