'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { portfoyIslemEkle } from '@/lib/auth-actions'

export function PortfoyIslemEkle({ fonKoduDefault = '', fonTipiDefault = 'YAT' }: {
  fonKoduDefault?: string; fonTipiDefault?: string
}) {
  const [acik, setAcik] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setYukleniyor(true)
    setHata(null)
    const fd = new FormData(e.currentTarget)
    const sonuc = await portfoyIslemEkle({
      fonKodu: (fd.get('fonKodu') as string).toUpperCase().trim(),
      fonTipi: fd.get('fonTipi') as string,
      islem_tipi: fd.get('islem_tipi') as 'AL' | 'SAT',
      adet: Number(fd.get('adet')),
      fiyat: Number(fd.get('fiyat')),
      tarih: fd.get('tarih') as string,
    })
    if (sonuc?.hata) { setHata(sonuc.hata); setYukleniyor(false); return }
    setAcik(false)
    setYukleniyor(false)
    router.refresh()
  }

  return (
    <div>
      <button onClick={() => setAcik(v => !v)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        İşlem Ekle
      </button>

      {acik && (
        <form onSubmit={handleSubmit}
          className="mt-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Fon Kodu</label>
            <input name="fonKodu" defaultValue={fonKoduDefault} required placeholder="Örn: AAL"
              className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Tip</label>
            <select name="fonTipi" defaultValue={fonTipiDefault}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
              <option value="YAT">YAT</option>
              <option value="EMK">EMK</option>
              <option value="BYF">BYF</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">İşlem</label>
            <select name="islem_tipi"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
              <option value="AL">AL</option>
              <option value="SAT">SAT</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Adet</label>
            <input name="adet" type="number" step="0.0001" min="0.0001" required placeholder="100"
              className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Fiyat</label>
            <input name="fiyat" type="number" step="0.0001" min="0" required placeholder="0.0000"
              className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Tarih</label>
            <input name="tarih" type="date" required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={yukleniyor}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {yukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button type="button" onClick={() => setAcik(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              İptal
            </button>
          </div>
          {hata && <p className="w-full text-sm text-red-600">{hata}</p>}
        </form>
      )}
    </div>
  )
}
