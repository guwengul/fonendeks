'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKLER = [
  { href: '/', label: 'Fonlar' },
  { href: '/analiz', label: 'Analiz' },
]

export function NavMobil() {
  const [acik, setAcik] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setAcik(false) }, [pathname])

  return (
    <>
      <button
        className="ml-auto flex items-center justify-center rounded-md p-2 text-slate-500 hover:bg-slate-100 transition-colors md:hidden"
        onClick={() => setAcik(v => !v)}
        aria-label={acik ? 'Menüyü kapat' : 'Menüyü aç'}
        aria-expanded={acik}
      >
        {acik ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {acik && (
        <div className="absolute left-0 right-0 top-14 z-50 border-b border-slate-200 bg-white shadow-lg md:hidden">
          <nav className="mx-auto max-w-5xl px-4 py-3 flex flex-col gap-1">
            {LINKLER.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}
