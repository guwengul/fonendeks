'use client'

import { useState } from 'react'
import { girisYap } from '@/lib/auth-actions'

export default function GirisPage() {
  const [hata, setHata] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setYukleniyor(true)
    setHata(null)
    const fd = new FormData(e.currentTarget)
    const sonuc = await girisYap(fd)
    if (sonuc?.hata) { setHata(sonuc.hata); setYukleniyor(false) }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Giriş Yap</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
            <input name="email" type="email" required autoComplete="email"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
            <input name="password" type="password" required autoComplete="current-password"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
          {hata && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{hata}</p>}
          <button type="submit" disabled={yukleniyor}
            className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60">
            {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
