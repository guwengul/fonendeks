'use client'

import { useState } from 'react'
import FonGrafik from './FonGrafik'

type GecmisRow = { tarih: string; fiyat: number | null; portfoyBuyukluk: number | null; kisiSayisi: number | null; tedPaySayisi: number | null }
type BenchmarkRow = Record<string, number | null> & { tarih: string; fiyat: number | null }
type Donem = { label: string; val: number | null }
type Hisse = { ticker: string; isin: string; agirlik: number }
type Dagilim = [string, number][]

export default function FonTabs({
  gecmis, benchmark, donemler, dagilim, dagilimTarih,
  hisseler, holdingsYayinTarihi, holdingsPdfLink, holdingsKapLink,
  getiri1h, getiri1a, getiri3a, getiri6a, getiriYb, birYillik, getiri3y, getiri5y,
}: {
  gecmis: GecmisRow[]
  benchmark: BenchmarkRow[]
  donemler: Donem[]
  dagilim: Dagilim
  dagilimTarih?: string | null
  hisseler: Hisse[]
  holdingsYayinTarihi?: string | null
  holdingsPdfLink?: string | null
  holdingsKapLink?: string | null
  getiri1h: number | null
  getiri1a: number | null
  getiri3a: number | null
  getiri6a: number | null
  getiriYb: number | null
  birYillik: number | null
  getiri3y: number | null
  getiri5y: number | null
}) {
  const [tab, setTab] = useState<'performans' | 'dagilim'>('performans')

  const TABS = [
    { key: 'performans', label: 'Fon Performansı' },
    { key: 'dagilim', label: 'Fon Varlık Dağılımı' },
  ] as const

  const getiriKartlari = [
    { label: '1 Haftalık', val: getiri1h },
    { label: '1 Aylık',   val: getiri1a },
    { label: '3 Aylık',   val: getiri3a },
    { label: '6 Aylık',   val: getiri6a },
    { label: 'YBB',       val: getiriYb },
    { label: '1 Yıllık',  val: birYillik },
    { label: '3 Yıllık',  val: getiri3y },
    { label: '5 Yıllık',  val: getiri5y },
  ]

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'performans' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-3">
            {getiriKartlari.map(({ label, val }) => (
              <div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <p className="text-slate-400 text-xs mb-1">{label}</p>
                <p className={`font-semibold text-xl ${(val ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {val != null ? `%${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                </p>
              </div>
            ))}
          </div>

          <FonGrafik data={gecmis} benchmark={benchmark} />

          {donemler.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800">Dönemsel Getiriler</h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-7 divide-x divide-slate-100">
                {donemler.map(({ label, val }) => (
                  <div key={label} className="px-4 py-4 text-center">
                    <p className="text-slate-400 text-xs mb-1">{label}</p>
                    <p className={`font-semibold text-base ${val == null ? 'text-slate-300' : val >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {val != null ? `%${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'dagilim' && (
        <div className="space-y-6">
          {dagilim.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-baseline justify-between">
                <h2 className="font-semibold text-slate-800">Varlık Dağılımı</h2>
                {dagilimTarih && <span className="text-xs text-slate-400">{dagilimTarih}</span>}
              </div>
              <div className="p-5 space-y-2.5">
                {dagilim.map(([isim, oran]) => (
                  <div key={isim}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{isim}</span>
                      <span className="font-mono font-medium text-slate-900">%{oran.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(oran, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hisseler.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-baseline justify-between gap-2 flex-wrap">
                <h2 className="font-semibold text-slate-800">Hisse Dağılımı</h2>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{hisseler.length} hisse{holdingsYayinTarihi ? ` · rapor ${holdingsYayinTarihi}` : ''}</span>
                  {holdingsPdfLink && (
                    <a href={holdingsPdfLink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600">PDF →</a>
                  )}
                  {holdingsKapLink && (
                    <a href={holdingsKapLink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600">KAP →</a>
                  )}
                </div>
              </div>
              <div className="p-5 space-y-2.5">
                {hisseler.filter(h => h.agirlik > 0).map(h => (
                  <div key={h.isin}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 font-mono font-medium">{h.ticker}</span>
                      <span className="font-mono text-slate-900">%{h.agirlik.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(h.agirlik * 5, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dagilim.length === 0 && hisseler.length === 0 && (
            <p className="text-slate-400 text-sm">Bu fon için portföy verisi bulunmuyor.</p>
          )}
        </div>
      )}
    </div>
  )
}
