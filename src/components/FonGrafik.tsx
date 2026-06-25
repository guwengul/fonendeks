'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { useState } from 'react'

type Veri = {
  tarih: string
  fiyat: number | null
  portfoyBuyukluk: number | null
  kisiSayisi: number | null
}

type BenchNokta = { tarih: string; fiyat: number | null } & Record<string, number | null>

const BENCHMARKLAR = [
  { key: 'fiyat', label: 'Fon', renk: '#4f46e5' },
  { key: 'USD', label: 'USD', renk: '#059669' },
  { key: 'EUR', label: 'EUR', renk: '#0891b2' },
  { key: 'BIST100', label: 'BIST 100', renk: '#dc2626' },
  { key: 'BIST30', label: 'BIST 30', renk: '#ea580c' },
  { key: 'GRAM_ALTIN', label: 'Gram Altın', renk: '#ca8a04' },
] as const

function ayGeri(son: string, ay: number) {
  const d = new Date(son); d.setMonth(d.getMonth() - ay); return d.toISOString().slice(0, 10)
}

export const GRAFIK_ARALIKLAR = [
  { label: '1H',  bas: (s: string) => { const d = new Date(s); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) } },
  { label: '1A',  bas: (s: string) => ayGeri(s, 1) },
  { label: '3A',  bas: (s: string) => ayGeri(s, 3) },
  { label: '6A',  bas: (s: string) => ayGeri(s, 6) },
  { label: 'YBB', bas: (s: string) => `${new Date(s).getFullYear()}-01-01` },
  { label: '1Y',  bas: (s: string) => ayGeri(s, 12) },
  { label: '3Y',  bas: (s: string) => ayGeri(s, 36) },
  { label: '5Y',  bas: (s: string) => ayGeri(s, 60) },
  { label: 'Tümü', bas: () => '' },
]

function AralikButonlari({ aralik, setAralik }: { aralik: string; setAralik: (l: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {GRAFIK_ARALIKLAR.map(a => (
        <button
          key={a.label}
          onClick={() => setAralik(a.label)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            aralik === a.label
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}

function formatTarih(t: string) { return t.slice(5) }

const TOOLTIP_STYLE = {
  contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  labelStyle: { color: '#64748b', fontSize: 12 },
}

export default function FonGrafik({ data, benchmark = [] }: { data: Veri[]; benchmark?: BenchNokta[] }) {
  const [aralik, setAralik] = useState('1Y')
  const [secili, setSecili] = useState<Record<string, boolean>>({
    fiyat: true, USD: true, BIST100: true, GRAM_ALTIN: true, EUR: false, BIST30: false,
  })

  const sonTarih = data.length > 0 ? data[data.length - 1].tarih : ''
  const secilenAralik = GRAFIK_ARALIKLAR.find(a => a.label === aralik) ?? GRAFIK_ARALIKLAR[GRAFIK_ARALIKLAR.length - 1]
  const baslangicTarih = sonTarih ? secilenAralik.bas(sonTarih) : ''

  const filtrelenmis = baslangicTarih === '' ? data : data.filter(d => d.tarih >= baslangicTarih)
  const benchFiltreli = baslangicTarih === '' ? benchmark : benchmark.filter(d => d.tarih >= baslangicTarih)

  const baz: Record<string, number> = {}
  for (const { key } of BENCHMARKLAR) {
    const ilkGecerli = benchFiltreli.find(d => d[key] != null)?.[key]
    if (ilkGecerli) baz[key] = ilkGecerli
  }
  const karsilastirma = benchFiltreli.map(d => {
    const nokta: Record<string, any> = { tarih: d.tarih }
    for (const { key } of BENCHMARKLAR) {
      const v = d[key]
      nokta[key] = v != null && baz[key] ? ((v / baz[key]) - 1) * 100 : null
    }
    return nokta
  })

  return (
    <div className="space-y-6">
      <AralikButonlari aralik={aralik} setAralik={setAralik} />

      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <p className="text-slate-500 text-sm font-medium mb-4">Fiyat</p>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={filtrelenmis}>
            <defs>
              <linearGradient id="fiyatGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="tarih" tickFormatter={formatTarih} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={70}
              tickFormatter={v => v.toFixed(4)}
              domain={[(d: number) => d * 0.999, (d: number) => d * 1.001]}
            />
            <Tooltip {...TOOLTIP_STYLE} itemStyle={{ color: '#4f46e5' }} formatter={(v: any) => [Number(v).toFixed(6), 'Fiyat']} />
            <Area type="monotone" dataKey="fiyat" stroke="#4f46e5" strokeWidth={2} fill="url(#fiyatGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {benchmark.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-slate-500 text-sm font-medium">Karşılaştırmalı Getiri (%)</p>
            <div className="flex gap-1.5 flex-wrap">
              {BENCHMARKLAR.map(b => (
                <button
                  key={b.key}
                  onClick={() => setSecili(s => ({ ...s, [b.key]: !s[b.key] }))}
                  className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                    secili[b.key] ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                  style={secili[b.key] ? { backgroundColor: b.renk } : undefined}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={karsilastirma}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="tarih" tickFormatter={formatTarih} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={50} tickFormatter={v => `%${v.toFixed(0)}`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, name: any) => [v == null ? '-' : `%${Number(v).toFixed(2)}`, name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {BENCHMARKLAR.filter(b => secili[b.key]).map(b => (
                <Line key={b.key} type="monotone" dataKey={b.key} name={b.label} stroke={b.renk} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
