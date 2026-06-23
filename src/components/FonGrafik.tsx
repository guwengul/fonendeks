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
  BarChart,
  Bar,
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

const ARALIKLAR = [
  { label: '1A', ay: 1 },
  { label: '3A', ay: 3 },
  { label: '6A', ay: 6 },
  { label: '1Y', ay: 12 },
  { label: '3Y', ay: 36 },
  { label: 'Tümü', ay: 0 },
]

function hedefTarihHesapla(sonTarih: string, ay: number): string {
  const d = new Date(sonTarih)
  d.setMonth(d.getMonth() - ay)
  return d.toISOString().slice(0, 10)
}

function formatTarih(t: string) { return t.slice(5) }
function formatMn(v: number) { return (v / 1_000_000).toFixed(1) + ' Mn' }

const TOOLTIP_STYLE = {
  contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  labelStyle: { color: '#64748b', fontSize: 12 },
}

export default function FonGrafik({ data, benchmark = [] }: { data: Veri[]; benchmark?: BenchNokta[] }) {
  const [aralik, setAralik] = useState(12)
  // Varsayılan açık karşılaştırmalar
  const [secili, setSecili] = useState<Record<string, boolean>>({
    fiyat: true, USD: true, BIST100: true, GRAM_ALTIN: true, EUR: false, BIST30: false,
  })

  const baslangicTarih = (() => {
    if (aralik === 0 || data.length === 0) return ''
    return hedefTarihHesapla(data[data.length - 1].tarih, aralik)
  })()

  const filtrelenmis = aralik === 0 ? data : data.filter(d => d.tarih >= baslangicTarih)

  // Karşılaştırma: seçili aralıkta her seriyi başlangıçta 100'e endeksle (% getiri)
  const benchFiltreli = aralik === 0 ? benchmark : benchmark.filter(d => d.tarih >= baslangicTarih)
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
      <div className="flex gap-2">
        {ARALIKLAR.map(a => (
          <button
            key={a.label}
            onClick={() => setAralik(a.ay)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              aralik === a.ay
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

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
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={v => v.toFixed(4)} />
            <Tooltip {...TOOLTIP_STYLE} itemStyle={{ color: '#4f46e5' }} formatter={(v: any) => [Number(v).toFixed(6), 'Fiyat']} />
            <Area type="monotone" dataKey="fiyat" stroke="#4f46e5" strokeWidth={2} fill="url(#fiyatGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Karşılaştırmalı getiri */}
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

      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <p className="text-slate-500 text-sm font-medium mb-4">Portföy Büyüklüğü (₺)</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={filtrelenmis}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="tarih" tickFormatter={formatTarih} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={formatMn} />
            <Tooltip {...TOOLTIP_STYLE} itemStyle={{ color: '#10b981' }} formatter={(v: any) => [formatMn(Number(v)), 'Portföy']} />
            <Bar dataKey="portfoyBuyukluk" fill="#10b981" opacity={0.8} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <p className="text-slate-500 text-sm font-medium mb-4">Yatırımcı Sayısı</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={filtrelenmis}>
            <defs>
              <linearGradient id="kisiGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="tarih" tickFormatter={formatTarih} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={v => v.toLocaleString('tr-TR')} />
            <Tooltip {...TOOLTIP_STYLE} itemStyle={{ color: '#a855f7' }} formatter={(v: any) => [Number(v).toLocaleString('tr-TR'), 'Yatırımcı']} />
            <Area type="monotone" dataKey="kisiSayisi" stroke="#a855f7" strokeWidth={2} fill="url(#kisiGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
