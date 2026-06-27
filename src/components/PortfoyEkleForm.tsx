'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { portfoyIslemEkle } from '@/lib/auth-actions'

type FonSonuc = { fonKodu: string; fonTipi: string; fonUnvan: string | null; fiyat: number | null; tarih: string }

export function PortfoyEkleForm({ portfoyler }: { portfoyler: string[] }) {
  const [acik, setAcik] = useState(false)
  const [aramaQ, setAramaQ] = useState('')
  const [sonuclar, setSonuclar] = useState<FonSonuc[]>([])
  const [seciliFon, setSeciliFon] = useState<FonSonuc | null>(null)
  const [portfoyAdi, setPortfoyAdi] = useState(portfoyler[0] ?? 'Ana Portföy')
  const [yeniPortfoy, setYeniPortfoy] = useState('')
  const [adet, setAdet] = useState('')
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10))
  const [fiyat, setFiyat] = useState('')
  const [fiyatYukleniyor, setFiyatYukleniyor] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const aramaRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!aramaQ || aramaQ.length < 2) { setSonuclar([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/fon-ara?q=${encodeURIComponent(aramaQ)}`)
      setSonuclar(await r.json())
    }, 250)
    return () => clearTimeout(t)
  }, [aramaQ])

  async function fonSec(fon: FonSonuc) {
    setSeciliFon(fon)
    setAramaQ('')
    setSonuclar([])
    await fiyatCek(fon.fonKodu, fon.fonTipi, tarih)
  }

  async function fiyatCek(kod: string, tip: string, t: string) {
    setFiyatYukleniyor(true)
    try {
      const r = await fetch(`/api/kullanici/fon-fiyat?kod=${kod}&tip=${tip}&tarih=${t}`)
      const d = await r.json()
      setFiyat(d.fiyat ? String(d.fiyat) : '')
    } catch { setFiyat('') }
    setFiyatYukleniyor(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!seciliFon) { setHata('Lütfen bir fon seçin'); return }
    setYukleniyor(true)
    setHata(null)
    const adSon = yeniPortfoy.trim() || portfoyAdi
    const sonuc = await portfoyIslemEkle({
      fonKodu: seciliFon.fonKodu, fonTipi: seciliFon.fonTipi,
      islem_tipi: 'AL', adet: Number(adet), fiyat: Number(fiyat),
      tarih, portfoy_adi: adSon,
    })
    if (sonuc?.hata) { setHata(sonuc.hata); setYukleniyor(false); return }
    setAcik(false)
    setSeciliFon(null)
    setAdet('')
    setYukleniyor(false)
    router.refresh()
  }

  function reset() {
    setAcik(false); setSeciliFon(null); setAramaQ(''); setSonuclar([])
    setAdet(''); setFiyat(''); setHata(null)
  }

  return (
    <div>
      <button onClick={() => { setAcik(v => !v); setTimeout(() => aramaRef.current?.focus(), 50) }}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Fon Ekle
      </button>

      {acik && (
        <form onSubmit={handleSubmit}
          className="mt-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 max-w-lg">

          {/* Portföy adı */}
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1.5">Portföy</label>
            <div className="flex gap-2">
              {portfoyler.length > 0 && (
                <select value={portfoyAdi} onChange={e => setPortfoyAdi(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
                  {portfoyler.map(p => <option key={p}>{p}</option>)}
                  <option value="__yeni__">+ Yeni portföy</option>
                </select>
              )}
              {(portfoyler.length === 0 || portfoyAdi === '__yeni__') && (
                <input value={yeniPortfoy} onChange={e => setYeniPortfoy(e.target.value)}
                  placeholder="Portföy adı" required={portfoyler.length === 0}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              )}
            </div>
          </div>

          {/* Fon arama */}
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1.5">Fon</label>
            {seciliFon ? (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                <div>
                  <span className="font-mono font-bold text-indigo-700 text-sm">{seciliFon.fonKodu}</span>
                  {seciliFon.fonUnvan && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">{seciliFon.fonUnvan}</p>}
                </div>
                <button type="button" onClick={() => { setSeciliFon(null); setFiyat('') }}
                  className="text-slate-400 hover:text-slate-600 text-lg ml-2">×</button>
              </div>
            ) : (
              <div className="relative">
                <input ref={aramaRef} value={aramaQ} onChange={e => setAramaQ(e.target.value)}
                  placeholder="Fon kodu veya adıyla ara..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                {sonuclar.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    {sonuclar.map(f => (
                      <button key={`${f.fonKodu}-${f.fonTipi}`} type="button"
                        onClick={() => fonSec(f)}
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0">
                        <span className="font-mono font-bold text-indigo-600 text-sm">{f.fonKodu}</span>
                        {f.fonUnvan && <p className="text-xs text-slate-400 truncate">{f.fonUnvan}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {/* Adet */}
            <div className="flex-1">
              <label className="text-xs text-slate-500 font-medium block mb-1.5">Adet</label>
              <input type="number" step="0.0001" min="0.0001" required
                value={adet} onChange={e => setAdet(e.target.value)} placeholder="100"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>

            {/* Tarih */}
            <div className="flex-1">
              <label className="text-xs text-slate-500 font-medium block mb-1.5">Tarih</label>
              <input type="date" required value={tarih}
                onChange={e => {
                  setTarih(e.target.value)
                  if (seciliFon) fiyatCek(seciliFon.fonKodu, seciliFon.fonTipi, e.target.value)
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>

          {/* Fiyat */}
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1.5">
              Alış Fiyatı
              {fiyatYukleniyor && <span className="text-slate-400 font-normal ml-1">yükleniyor...</span>}
            </label>
            <input type="number" step="0.000001" min="0" required
              value={fiyat} onChange={e => setFiyat(e.target.value)} placeholder="otomatik"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
          </div>

          {hata && <p className="text-sm text-red-600">{hata}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={yukleniyor || !seciliFon}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {yukleniyor ? 'Ekleniyor...' : 'Ekle'}
            </button>
            <button type="button" onClick={reset}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              İptal
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
