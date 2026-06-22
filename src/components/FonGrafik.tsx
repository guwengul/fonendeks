'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
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

const ARALIKLAR = [
  { label: '1A', gun: 30 },
  { label: '3A', gun: 90 },
  { label: '6A', gun: 180 },
  { label: '1Y', gun: 365 },
  { label: '3Y', gun: 1095 },
  { label: 'Tümü', gun: 0 },
]

function formatTarih(t: string) { return t.slice(5) }
function formatMn(v: number) { return (v / 1_000_000).toFixed(1) + ' Mn' }

const TOOLTIP_STYLE = {
  contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  labelStyle: { color: '#64748b', fontSize: 12 },
}

export default function FonGrafik({ data }: { data: Veri[] }) {
  const [aralik, setAralik] = useState(365)

  const filtrelenmis = aralik === 0 ? data : data.slice(-aralik)

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {ARALIKLAR.map(a => (
          <button
            key={a.label}
            onClick={() => setAralik(a.gun)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              aralik === a.gun
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
