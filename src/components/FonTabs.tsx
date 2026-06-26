'use client'

import { useState } from 'react'
import FonGrafik from './FonGrafik'
import FonBuyumeGrafik from './FonBuyumeGrafik'
import { GRAFIK_ARALIKLAR } from './FonGrafik'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ResponsiveContainer, ReferenceLine } from 'recharts'

type GecmisRow = { tarih: string; fiyat: number | null; portfoyBuyukluk: number | null; kisiSayisi: number | null; tedPaySayisi: number | null }
type BenchmarkRow = { tarih: string; fiyat: number | null }
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

const BENCH_DONEMLER_LABELS = ['1H', '1A', '3A', '6A', 'YBB', '1Y', '3Y', '5Y']

export default function FonTabs({
  fonKodu,
  gecmis, benchmark, benchGetiriler, dagilim, dagilimTarih,
  hisseler, holdingsYayinTarihi, holdingsPdfLink, holdingsKapLink,
  getiri1h, getiri1a, getiri3a, getiri6a, getiriYb, birYillik, getiri3y, getiri5y,
}: {
  fonKodu: string
  gecmis: GecmisRow[]
  benchmark: BenchmarkRow[]
  benchGetiriler: Record<string, Record<string, number | null>>
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
  const [tab, setTab] = useState<'performans' | 'benchmark' | 'buyume' | 'dagilim'>('performans')
  const [benchDonem, setBenchDonem] = useState('1Y')

  const TABS = [
    { key: 'performans',  label: 'Fon Performansı' },
    { key: 'benchmark',   label: 'Benchmark' },
    { key: 'buyume',      label: 'Fon Büyümesi' },
    { key: 'dagilim',     label: 'Fon Varlık Dağılımı' },
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

  const d = benchGetiriler[benchDonem] ?? {}
  const benchGostergeDegerleri = BENCH_SERILER.map(s => ({
    key: s.key,
    label: s.key === 'fiyat' ? fonKodu : s.label,
    renk: s.renk,
    val: (d[s.key] ?? null) as number | null,
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
          <FonGrafik data={gecmis} />
        </div>
      )}

      {tab === 'benchmark' && (
        <div className="space-y-6">
          {/* Dönem seçici */}
          <div className="flex flex-wrap gap-2">
            {BENCH_DONEMLER_LABELS.map(l => (
              <button key={l} onClick={() => setBenchDonem(l)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  benchDonem === l
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                }`}>
                {l}
              </button>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={benchGostergeDegerleri} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={v => `%${v}`} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                  formatter={(v: any) => [`%${Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']}
                  labelStyle={{ color: '#64748b', fontSize: 12 }}
                />
                <ReferenceLine y={0} stroke="#e2e8f0" />
                <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                  {benchGostergeDegerleri.map(({ key, val }) => (
                    <Cell key={key} fill={val == null ? '#e2e8f0' : val >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Enstrüman kartları */}
          <div className="grid grid-cols-3 gap-3">
            {benchGostergeDegerleri.map(({ key, label, renk, val }) => (
              <div key={key} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${renk}`}>{label}</span>
                <p className={`font-semibold text-xl ${val == null ? 'text-slate-300' : val >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {val != null ? `%${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                </p>
              </div>
            ))}
          </div>
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
