'use client'

import { useState } from 'react'
import FonGrafik from './FonGrafik'
import FonBuyumeGrafik from './FonBuyumeGrafik'
import { GRAFIK_ARALIKLAR } from './FonGrafik'

type GecmisRow = { tarih: string; fiyat: number | null; portfoyBuyukluk: number | null; kisiSayisi: number | null; tedPaySayisi: number | null }
type BenchmarkRow = Record<string, number | null> & { tarih: string; fiyat: number | null }
type Hisse = { ticker: string; isin: string; agirlik: number }
type Dagilim = [string, number][]

const BENCH_SERILER = [
  { key: 'fiyat',      label: 'Fon',        renk: 'bg-indigo-600 text-white' },
  { key: 'USD',        label: 'USD/TL',     renk: 'bg-emerald-600 text-white' },
  { key: 'EUR',        label: 'EUR/TL',     renk: 'bg-cyan-600 text-white' },
  { key: 'BIST100',    label: 'BIST 100',   renk: 'bg-red-600 text-white' },
  { key: 'BIST30',     label: 'BIST 30',    renk: 'bg-orange-500 text-white' },
  { key: 'GRAM_ALTIN', label: 'Gram Altın', renk: 'bg-yellow-500 text-white' },
] as const

const BENCH_DONEMLER = GRAFIK_ARALIKLAR.filter(a => a.label !== 'Tümü')

function hesaplaBenchGetiri(benchmark: BenchmarkRow[], key: string, baslangicTarih: string): number | null {
  const filtreli = baslangicTarih ? benchmark.filter(d => d.tarih >= baslangicTarih) : benchmark
  const ilk = filtreli.find(d => d[key] != null)?.[key]
  const son = [...filtreli].reverse().find(d => d[key] != null)?.[key]
  if (ilk == null || son == null || ilk === 0) return null
  return ((son / ilk) - 1) * 100
}

export default function FonTabs({
  gecmis, benchmark, dagilim, dagilimTarih,
  hisseler, holdingsYayinTarihi, holdingsPdfLink, holdingsKapLink,
  getiri1h, getiri1a, getiri3a, getiri6a, getiriYb, birYillik, getiri3y, getiri5y,
}: {
  gecmis: GecmisRow[]
  benchmark: BenchmarkRow[]
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
  const [tab, setTab] = useState<'performans' | 'buyume' | 'dagilim'>('performans')
  const [benchDonem, setBenchDonem] = useState('1Y')

  const TABS = [
    { key: 'performans', label: 'Fon Performansı' },
    { key: 'buyume', label: 'Fon Büyümesi' },
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

  const sonTarih = benchmark.length > 0 ? benchmark[benchmark.length - 1].tarih : ''
  const secilenDonem = BENCH_DONEMLER.find(a => a.label === benchDonem) ?? BENCH_DONEMLER[5]
  const benchBaslangic = sonTarih ? secilenDonem.bas(sonTarih) : ''

  const benchGetiriler = BENCH_SERILER.map(s => ({
    ...s,
    val: hesaplaBenchGetiri(benchmark, s.key, benchBaslangic),
  }))

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
          {/* Getiri kartları */}
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

          {/* Benchmark karşılaştırması */}
          {benchmark.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <h2 className="font-semibold text-slate-800 text-sm">Benchmark Karşılaştırması</h2>
                <div className="flex flex-wrap gap-1.5">
                  {BENCH_DONEMLER.map(a => (
                    <button
                      key={a.label}
                      onClick={() => setBenchDonem(a.label)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        benchDonem === a.label
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-slate-100">
                {benchGetiriler.map(({ key, label, renk, val }) => (
                  <div key={key} className="p-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${renk}`}>{label}</span>
                    <p className={`font-semibold text-lg ${val == null ? 'text-slate-300' : val >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {val != null ? `%${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <FonGrafik data={gecmis} benchmark={benchmark} />
        </div>
      )}

      {tab === 'buyume' && (
        <FonBuyumeGrafik data={gecmis} />
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
                <h2 className="font-semibold text-slate-800">Hisse Senedi Dağılımı</h2>
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
