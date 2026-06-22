'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

type FonAnaliz = {
  fonKodu: string
  fonTipi: string
  fonUnvan: string
  altiAylik: (number | null)[]
  yillik: (number | null)[]
  altiAyPozitif: number
  altiAyToplam: number
  yillikPozitif: number
  yillikToplam: number
  toplamGetiri5y: number | null
}

type SiralamaKey = 'tutarlilik' | '5y' | `donem_${number}`

const TIP_RENK: Record<string, string> = {
  YAT: 'bg-indigo-50 text-indigo-600',
  EMK: 'bg-emerald-50 text-emerald-600',
  BYF: 'bg-purple-50 text-purple-600',
}

function hucreRenk(deger: number | null): string {
  if (deger === null) return 'bg-slate-50 text-slate-300'
  if (deger >= 10) return 'bg-emerald-600 text-white'
  if (deger >= 5) return 'bg-emerald-500 text-white'
  if (deger > 0) return 'bg-emerald-100 text-emerald-800'
  if (deger === 0) return 'bg-slate-100 text-slate-500'
  if (deger >= -5) return 'bg-red-100 text-red-700'
  return 'bg-red-500 text-white'
}

function skorCubugu(pozitif: number, toplam: number) {
  if (toplam === 0) return null
  const oran = pozitif / toplam
  const renk = oran === 1 ? 'bg-emerald-500' : oran >= 0.7 ? 'bg-emerald-400' : oran >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${renk}`} style={{ width: `${oran * 100}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-600">{pozitif}/{toplam}</span>
    </div>
  )
}

function ThSort({ label, aktif, onClick }: { label: string; aktif: boolean; onClick: () => void }) {
  return (
    <th
      onClick={onClick}
      className={`px-2 py-3 text-center min-w-24 text-xs font-semibold cursor-pointer select-none transition-colors ${aktif ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-indigo-500 hover:bg-slate-100'}`}
    >
      {label} {aktif ? '↓' : ''}
    </th>
  )
}

export default function AnalizListesi({
  fonlar,
  altiAyEtiketler,
  yillikEtiketler,
}: {
  fonlar: FonAnaliz[]
  altiAyEtiketler: string[]
  yillikEtiketler: string[]
}) {
  const [mod, setMod] = useState<'6ay' | 'yil'>('yil')
  const [minPozitif, setMinPozitif] = useState(0)
  const [tipFiltre, setTipFiltre] = useState<'HEPSI' | 'YAT' | 'EMK' | 'BYF'>('YAT')
  const [siralama, setSiralama] = useState<SiralamaKey>('tutarlilik')

  const etiketler = mod === '6ay' ? altiAyEtiketler : yillikEtiketler
  const maxDonem = etiketler.length

  const filtreli = useMemo(() => {
    return fonlar
      .filter(f => tipFiltre === 'HEPSI' || f.fonTipi === tipFiltre)
      .filter(f => {
        const pozitif = mod === '6ay' ? f.altiAyPozitif : f.yillikPozitif
        const toplam = mod === '6ay' ? f.altiAyToplam : f.yillikToplam
        return toplam > 0 && pozitif >= minPozitif
      })
      .sort((a, b) => {
        if (siralama === '5y') {
          return (b.toplamGetiri5y ?? -Infinity) - (a.toplamGetiri5y ?? -Infinity)
        }
        if (siralama.startsWith('donem_')) {
          const idx = parseInt(siralama.replace('donem_', ''))
          const aVal = (mod === '6ay' ? a.altiAylik : a.yillik)[idx] ?? -Infinity
          const bVal = (mod === '6ay' ? b.altiAylik : b.yillik)[idx] ?? -Infinity
          return bVal - aVal
        }
        // tutarlilik
        const aPoz = mod === '6ay' ? a.altiAyPozitif : a.yillikPozitif
        const bPoz = mod === '6ay' ? b.altiAyPozitif : b.yillikPozitif
        const aTop = mod === '6ay' ? a.altiAyToplam : a.yillikToplam
        const bTop = mod === '6ay' ? b.altiAyToplam : b.yillikToplam
        const aOran = aTop > 0 ? aPoz / aTop : 0
        const bOran = bTop > 0 ? bPoz / bTop : 0
        if (bOran !== aOran) return bOran - aOran
        return bPoz - aPoz
      })
  }, [fonlar, mod, minPozitif, tipFiltre, siralama])

  return (
    <div>
      {/* Kontroller */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white text-sm">
          {(['yil', '6ay'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMod(m); setMinPozitif(0); setSiralama('tutarlilik') }}
              className={`px-4 py-2 font-medium transition-colors ${mod === m ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {m === 'yil' ? 'Yıllık' : '6 Aylık'}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white text-sm">
          {(['HEPSI', 'YAT', 'EMK', 'BYF'] as const).map(tip => (
            <button
              key={tip}
              onClick={() => setTipFiltre(tip)}
              className={`px-3 py-2 font-medium transition-colors ${tipFiltre === tip ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {tip === 'HEPSI' ? 'Tümü' : tip}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Min pozitif dönem:</span>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
            {Array.from({ length: maxDonem + 1 }, (_, i) => i).map(n => (
              <button
                key={n}
                onClick={() => setMinPozitif(n)}
                className={`px-2.5 py-2 font-medium transition-colors ${minPozitif === n ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {n === 0 ? 'Hepsi' : n}
              </button>
            ))}
          </div>
        </div>

        <span className="text-sm text-slate-400 ml-auto">{filtreli.length} fon</span>
      </div>

      {/* Tablo */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold text-slate-600 w-24">Kod</th>
              <th className="px-4 py-3 font-semibold text-slate-600 min-w-48">Fon Adı</th>
              <th className="px-3 py-3 font-semibold text-slate-600 text-center">Tip</th>
              {etiketler.map((e, i) => (
                <ThSort
                  key={i}
                  label={e}
                  aktif={siralama === `donem_${i}`}
                  onClick={() => setSiralama(`donem_${i}`)}
                />
              ))}
              <ThSort
                label="5Y Toplam"
                aktif={siralama === '5y'}
                onClick={() => setSiralama('5y')}
              />
              <th
                onClick={() => setSiralama('tutarlilik')}
                className={`px-4 py-3 font-semibold min-w-36 cursor-pointer select-none transition-colors ${siralama === 'tutarlilik' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-indigo-500 hover:bg-slate-100'}`}
              >
                Tutarlılık {siralama === 'tutarlilik' ? '↓' : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtreli.map((f, idx) => {
              const periyotlar = mod === '6ay' ? f.altiAylik : f.yillik
              const pozitif = mod === '6ay' ? f.altiAyPozitif : f.yillikPozitif
              const toplam = mod === '6ay' ? f.altiAyToplam : f.yillikToplam
              return (
                <tr
                  key={`${f.fonKodu}-${f.fonTipi}`}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                >
                  <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                    <Link
                      href={`/fon/${f.fonKodu}?tip=${f.fonTipi}`}
                      className="font-mono font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {f.fonKodu}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 text-xs max-w-xs truncate">{f.fonUnvan}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TIP_RENK[f.fonTipi] ?? ''}`}>
                      {f.fonTipi}
                    </span>
                  </td>
                  {periyotlar.map((p, i) => (
                    <td key={i} className={`px-2 py-2.5 text-center ${siralama === `donem_${i}` ? 'bg-indigo-50/50' : ''}`}>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono font-medium ${hucreRenk(p)}`}>
                        {p !== null ? `${p >= 0 ? '+' : ''}${p.toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  ))}
                  <td className={`px-3 py-2.5 text-center ${siralama === '5y' ? 'bg-indigo-50/50' : ''}`}>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono font-medium ${hucreRenk(f.toplamGetiri5y)}`}>
                      {f.toplamGetiri5y !== null ? `${f.toplamGetiri5y >= 0 ? '+' : ''}${f.toplamGetiri5y.toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {skorCubugu(pozitif, toplam)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtreli.length === 0 && (
          <div className="py-16 text-center text-slate-400 text-sm">
            Bu kriterlere uyan fon bulunamadı.
          </div>
        )}
      </div>
    </div>
  )
}
