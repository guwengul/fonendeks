'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { portfoyIslemEkle } from '@/lib/auth-actions'

export function PortfoyIslemEkle({ fonKoduDefault = '', fonTipiDefault = 'YAT', portfoyAdiDefault = 'Ana Portföy' }: {
  fonKoduDefault?: string; fonTipiDefault?: string; portfoyAdiDefault?: string
}) {
  const [acik, setAcik] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [fiyatYukleniyor, setFiyatYukleniyor] = useState(false)
  const [otomatikFiyat, setOtomatikFiyat] = useState<number | null>(null)
  const router = useRouter()

  async function fiyatCek(fonKodu: string, fonTipi: string, tarih: string) {
    if (!fonKodu || !tarih) return
    setFiyatYukleniyor(true)
    try {
      const r = await fetch(`/api/kullanici/fon-fiyat?kod=${fonKodu.toUpperCase()}&tip=${fonTipi}&tarih=${tarih}`)
      const d = await r.json()
      setOtomatikFiyat(d.fiyat ?? null)
    } catch { setOtomatikFiyat(null) }
    setFiyatYukleniyor(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setYukleniyor(true)
    setHata(null)
    const fd = new FormData(e.currentTarget)
    const sonuc = await portfoyIslemEkle({
      fonKodu: (fd.get('fonKodu') as string).toUpperCase().trim(),
      fonTipi: fd.get('fonTipi') as string,
      islem_tipi: 'AL',
      adet: Number(fd.get('adet')),
      fiyat: Number(fd.get('fiyat')),
      tarih: fd.get('tarih') as string,
      portfoy_id: (fd.get('portfoy_id') as string) || '',
    })
    if (sonuc?.hata) { setHata(sonuc.hata); setYukleniyor(false); return }
    setAcik(false)
    setOtomatikFiyat(null)
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
        Portföye Fon Ekle
      </button>

      {acik && (
        <form onSubmit={handleSubmit}
          className="mt-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Portföy Adı</label>
            <input name="portfoy_adi" defaultValue={portfoyAdiDefault} placeholder="Ana Portföy"
              className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Fon Kodu</label>
            <input name="fonKodu" defaultValue={fonKoduDefault} required placeholder="Örn: AAL"
              onChange={e => setOtomatikFiyat(null)}
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
            <label className="text-xs text-slate-500 font-medium">Adet</label>
            <input name="adet" type="number" step="0.0001" min="0.0001" required placeholder="100"
              className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Tarih</label>
            <input name="tarih" type="date" required
              defaultValue={new Date().toISOString().slice(0, 10)}
              onChange={e => {
                const form = e.currentTarget.form
                if (!form) return
                const kod = (form.elements.namedItem('fonKodu') as HTMLInputElement)?.value
                const tip = (form.elements.namedItem('fonTipi') as HTMLSelectElement)?.value
                fiyatCek(kod, tip, e.target.value)
              }}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">
              Alış Fiyatı
              {fiyatYukleniyor && <span className="text-slate-400 font-normal ml-1">yükleniyor...</span>}
            </label>
            <input name="fiyat" type="number" step="0.0001" min="0" required
              value={otomatikFiyat ?? ''}
              onChange={e => setOtomatikFiyat(e.target.value ? Number(e.target.value) : null)}
              placeholder="otomatik"
              className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={yukleniyor}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {yukleniyor ? 'Kaydediliyor...' : 'Ekle'}
            </button>
            <button type="button" onClick={() => { setAcik(false); setOtomatikFiyat(null) }}
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
