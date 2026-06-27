'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { portfoyIslemEkle, portfoyOlustur } from '@/lib/auth-actions'

const VARLIK_GRUPLARI = [
  'Hisse Senedi',
  'Borçlanma Araçları',
  'Para Piyasası',
  'Kıymetli Maden',
  'Döviz',
  'Karma / Değişken',
  'Diğer',
]

export const RENKLER = [
  { key: 'blue',    hex: '#60a5fa' },
  { key: 'emerald', hex: '#34d399' },
  { key: 'violet',  hex: '#a78bfa' },
  { key: 'orange',  hex: '#fb923c' },
  { key: 'pink',    hex: '#f472b6' },
  { key: 'amber',   hex: '#fbbf24' },
  { key: 'teal',    hex: '#2dd4bf' },
  { key: 'rose',    hex: '#fb7185' },
]

export function renkBul(key: string) {
  return RENKLER.find(r => r.key === key) ?? RENKLER[0]
}

type FonSonuc = { fonKodu: string; fonTipi: string; fonUnvan: string | null; fiyat: number | null; tarih: string }
type FavoriSonuc = { fonKodu: string; fonTipi: string; fonUnvan: string | null; guncelFiyat: number | null; degisim: number | null }

// --- Fon ekleme formu (portföy dışarıdan gelir, bilgi olarak gösterilir) ---
export function FonEkleForm({
  portfoy,
  onKapat,
}: {
  portfoy: { id: string; ad: string; renk?: string }
  onKapat?: () => void
}) {
  const [aramaQ, setAramaQ] = useState('')
  const [sonuclar, setSonuclar] = useState<FonSonuc[]>([])
  const [seciliFon, setSeciliFon] = useState<FonSonuc | null>(null)
  const [favorilerAcik, setFavorilerAcik] = useState(false)
  const [favoriler, setFavoriler] = useState<FavoriSonuc[]>([])
  const [favorilerYukleniyor, setFavorilerYukleniyor] = useState(false)
  const [varlikGrubu, setVarlikGrubu] = useState(VARLIK_GRUPLARI[0])
  const [adet, setAdet] = useState('')
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10))
  const [fiyat, setFiyat] = useState('')
  const [fiyatYukleniyor, setFiyatYukleniyor] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [eklendi, setEklendi] = useState(false)
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
    setFavorilerAcik(false)
    setFiyatYukleniyor(true)
    try {
      const r = await fetch(`/api/kullanici/fon-fiyat?kod=${fon.fonKodu}&tip=${fon.fonTipi}&tarih=${tarih}`)
      const d = await r.json()
      setFiyat(d.fiyat ? String(d.fiyat) : '')
    } catch { setFiyat('') }
    setFiyatYukleniyor(false)
  }

  async function favorilerAc() {
    if (favorilerAcik) { setFavorilerAcik(false); return }
    setFavorilerYukleniyor(true)
    try {
      const r = await fetch('/api/kullanici/favoriler')
      setFavoriler(await r.json())
    } catch { setFavoriler([]) }
    setFavorilerYukleniyor(false)
    setFavorilerAcik(true)
  }

  function favoridentSec(f: FavoriSonuc) {
    fonSec({ fonKodu: f.fonKodu, fonTipi: f.fonTipi, fonUnvan: f.fonUnvan, fiyat: f.guncelFiyat, tarih: '' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!seciliFon) { setHata('Lütfen bir fon seçin'); return }
    setYukleniyor(true)
    setHata(null)
    const sonuc = await portfoyIslemEkle({
      fonKodu: seciliFon.fonKodu, fonTipi: seciliFon.fonTipi,
      islem_tipi: 'AL', adet: Number(adet), fiyat: Number(fiyat),
      tarih, portfoy_id: portfoy.id, varlik_grubu: varlikGrubu,
    })
    if (sonuc?.hata) { setHata(sonuc.hata); setYukleniyor(false); return }
    setSeciliFon(null); setAramaQ(''); setAdet(''); setFiyat('')
    setYukleniyor(false)
    setEklendi(true)
    setTimeout(() => { setEklendi(false); aramaRef.current?.focus() }, 2000)
  }

  const toplam = fiyat && adet && Number(fiyat) > 0 && Number(adet) > 0
    ? (Number(fiyat) * Number(adet)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null

  const r = renkBul(portfoy.renk ?? 'blue')

  return (
    <form onSubmit={handleSubmit}
      className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 max-w-lg">

      {/* Portföy — bilgi olarak */}
      <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.hex }} />
        <span className="text-sm font-semibold text-slate-700">{portfoy.ad}</span>
      </div>

      {/* Varlık grubu */}
      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1.5">Varlık Grubu</label>
        <select value={varlikGrubu} onChange={e => setVarlikGrubu(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400">
          {VARLIK_GRUPLARI.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      {/* Fon arama */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-slate-500 font-medium">Fon</label>
          {!seciliFon && (
            <button type="button" onClick={favorilerAc}
              className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              {favorilerYukleniyor ? 'Yükleniyor...' : 'Favorilerden seç'}
            </button>
          )}
        </div>

        {favorilerAcik && !seciliFon && (
          <div className="mb-2 border border-slate-200 rounded-xl overflow-hidden">
            {favoriler.length === 0 ? (
              <p className="text-xs text-slate-400 px-4 py-3">Favori fon bulunamadı.</p>
            ) : (
              favoriler.map(f => (
                <button key={`${f.fonKodu}-${f.fonTipi}`} type="button"
                  onClick={() => favoridentSec(f)}
                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-indigo-600 text-sm">{f.fonKodu}</span>
                    {f.fonUnvan && <p className="text-xs text-slate-400 truncate">{f.fonUnvan}</p>}
                  </div>
                  {f.degisim != null && (
                    <span className={`text-xs font-semibold shrink-0 ${f.degisim >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {f.degisim >= 0 ? '+' : ''}{f.degisim.toFixed(2)}%
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

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
              placeholder="Fon kodu veya adıyla ara..." autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            {sonuclar.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {sonuclar.map(f => (
                  <button key={`${f.fonKodu}-${f.fonTipi}`} type="button" onClick={() => fonSec(f)}
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
        <div className="flex-1">
          <label className="text-xs text-slate-500 font-medium block mb-1.5">Adet</label>
          <input type="number" step="0.0001" min="0.0001" required
            value={adet} onChange={e => setAdet(e.target.value)} placeholder="100"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500 font-medium block mb-1.5">Tarih</label>
          <input type="date" required value={tarih}
            onChange={async e => {
              setTarih(e.target.value)
              if (seciliFon) {
                setFiyatYukleniyor(true)
                try {
                  const res = await fetch(`/api/kullanici/fon-fiyat?kod=${seciliFon.fonKodu}&tip=${seciliFon.fonTipi}&tarih=${e.target.value}`)
                  const d = await res.json()
                  setFiyat(d.fiyat ? String(d.fiyat) : '')
                } catch { setFiyat('') }
                setFiyatYukleniyor(false)
              }
            }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500 font-medium block mb-1.5">
          Birim Fiyat
          {fiyatYukleniyor && <span className="text-slate-400 font-normal ml-1">yükleniyor...</span>}
        </label>
        <input type="number" step="0.000001" min="0" required
          value={fiyat} onChange={e => setFiyat(e.target.value)} placeholder="otomatik"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
        {toplam && (
          <p className="text-xs text-slate-500 mt-1.5">Toplam: <span className="font-semibold text-slate-700">{toplam} ₺</span></p>
        )}
      </div>

      {hata && <p className="text-sm text-red-600">{hata}</p>}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={yukleniyor || !seciliFon}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${eklendi ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
          {yukleniyor ? 'Ekleniyor...' : eklendi ? '✓ Eklendi' : 'Ekle'}
        </button>
        {onKapat && (
          <button type="button" onClick={() => { router.refresh(); onKapat() }}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Bitti
          </button>
        )}
      </div>
    </form>
  )
}

// --- Yeni portföy oluşturma formu ---
export function PortfoyEkleForm({
  portfoyler,
  bosEkran = false,
}: {
  portfoyler: { id: string; ad: string; renk?: string }[]
  bosEkran?: boolean
}) {
  const [acik, setAcik] = useState(bosEkran)
  const [ad, setAd] = useState('')
  const [renk, setRenk] = useState('blue')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  // bosEkran: oluşturulan portföyü refresh beklemeden lokal tut → FonEkleForm'a ver
  const [lokalPortfoy, setLokalPortfoy] = useState<{ id: string; ad: string; renk: string } | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const adSon = ad.trim()
    if (!adSon) return
    setYukleniyor(true)
    setHata(null)
    const sonuc = await portfoyOlustur(adSon, renk)
    setYukleniyor(false)
    if (sonuc?.hata) { setHata(sonuc.hata); return }
    if (bosEkran && sonuc?.id) {
      setLokalPortfoy({ id: sonuc.id, ad: adSon, renk })
      setAcik(false)
    } else {
      router.refresh()
      setAcik(false)
    }
    setAd('')
  }

  // bosEkran: portföy oluşturuldu, fon ekleme formunu göster
  if (bosEkran && lokalPortfoy) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        <FonEkleForm
          portfoy={lokalPortfoy}
          onKapat={() => { router.refresh() }}
        />
      </div>
    )
  }

  // bosEkran: henüz portföy yok, oluşturma formu
  if (bosEkran) {
    return (
      <form onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-4">İlk portföyünü oluştur</h2>
          <label className="text-xs text-slate-500 font-medium block mb-1.5">Portföy Adı</label>
          <input value={ad} onChange={e => setAd(e.target.value)}
            placeholder="Örn: Ana Portföy" autoFocus
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-2">Renk</label>
          <div className="flex gap-2">
            {RENKLER.map(r => (
              <button key={r.key} type="button" onClick={() => setRenk(r.key)}
                style={{ backgroundColor: r.hex, outline: renk === r.key ? `3px solid ${r.hex}` : 'none', outlineOffset: '3px', opacity: renk === r.key ? 1 : 0.4 }}
                  className="w-7 h-7 rounded-full transition-all hover:opacity-100" />
            ))}
          </div>
        </div>
        {hata && <p className="text-sm text-red-600">{hata}</p>}
        <button type="submit" disabled={yukleniyor || !ad.trim()}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {yukleniyor ? 'Oluşturuluyor...' : 'Oluştur →'}
        </button>
      </form>
    )
  }

  // Normal mod: "Yeni Portföy" butonu + form (üstte sağda)
  return (
    <div>
      {!acik && portfoyler.length < 3 && (
        <button onClick={() => setAcik(true)}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
          + Yeni Portföy
        </button>
      )}

      {acik && (
        <form onSubmit={handleSubmit}
          className="mt-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 max-w-sm">
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1.5">Portföy Adı</label>
            <input value={ad} onChange={e => setAd(e.target.value)}
              placeholder="Örn: Emeklilik, Deneme..." autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
            <p className="text-xs text-slate-400 mt-1">{portfoyler.length}/3 portföy kullanılıyor</p>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-2">Renk</label>
            <div className="flex gap-2">
              {RENKLER.map(r => (
                <button key={r.key} type="button" onClick={() => setRenk(r.key)}
                  style={{ backgroundColor: r.hex, outline: renk === r.key ? `3px solid ${r.hex}` : 'none', outlineOffset: '3px', opacity: renk === r.key ? 1 : 0.4 }}
                  className="w-7 h-7 rounded-full transition-all hover:opacity-100" />
              ))}
            </div>
          </div>
          {hata && <p className="text-sm text-red-600">{hata}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={yukleniyor || !ad.trim()}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {yukleniyor ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
            <button type="button" onClick={() => { setAcik(false); setAd(''); setHata(null) }}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              İptal
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
