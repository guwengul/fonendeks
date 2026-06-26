'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { favoriKaldir } from '@/lib/auth-actions'

export function FavoriKaldir({ fonKodu, fonTipi }: { fonKodu: string; fonTipi: string }) {
  const [yukleniyor, setYukleniyor] = useState(false)
  const router = useRouter()

  async function handle() {
    setYukleniyor(true)
    await favoriKaldir(fonKodu, fonTipi)
    router.refresh()
  }

  return (
    <button onClick={handle} disabled={yukleniyor}
      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
      title="Favorilerden çıkar">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}
