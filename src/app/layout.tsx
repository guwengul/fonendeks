import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { NavMobil } from '@/components/NavMobil'
import { createClient } from '@/lib/supabase/server'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://fonendeks.com'),
  title: {
    default: 'Fonendeks — TEFAS Fon Analizi',
    template: '%s | Fonendeks',
  },
  description: 'TEFAS yatırım fonlarını analiz edin, fiyat geçmişini ve portföy büyüklüklerini takip edin.',
  openGraph: { siteName: 'Fonendeks', type: 'website', locale: 'tr_TR' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const girisYapildi = !!user

  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50">
        <header className="relative border-b border-slate-200 bg-white">
          <nav className="mx-auto flex w-full max-w-7xl items-center gap-1 px-4 sm:px-6 h-14">
            <Link href="/" className="mr-4 flex items-center gap-2 font-semibold text-slate-900 tracking-tight shrink-0">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="#1e293b" strokeWidth="2" />
                <path d="M12 7v5l3 3" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xl font-bold">fonendeks</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <Link href="/" className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors rounded-md hover:bg-indigo-50">
                Fonlar
              </Link>
              <Link href="/analiz" className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors rounded-md hover:bg-indigo-50">
                Analiz
              </Link>
              {girisYapildi && (
                <>
                  <Link href="/favoriler" className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors rounded-md hover:bg-indigo-50">
                    Favoriler
                  </Link>
                  <Link href="/portfoy" className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors rounded-md hover:bg-indigo-50">
                    Portföy
                  </Link>
                </>
              )}
            </div>

            <div className="hidden md:flex items-center ml-auto">
              {girisYapildi ? (
                <form action="/api/auth/cikis" method="POST">
                  <button type="submit" className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-red-600 transition-colors rounded-md hover:bg-red-50">
                    Çıkış
                  </button>
                </form>
              ) : (
                <Link href="/giris" className="px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                  Giriş Yap
                </Link>
              )}
            </div>

            <NavMobil girisYapildi={girisYapildi} />
          </nav>
        </header>

        <main className="flex-1">
          {children}
        </main>

        <footer className="mt-auto border-t border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-5xl px-6 py-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Link href="/" className="flex items-center gap-1.5 font-semibold text-slate-900 w-fit">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="9" stroke="#1e293b" strokeWidth="2" />
                    <path d="M12 7v5l3 3" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm">fonendeks</span>
                </Link>
                <p className="mt-2 text-xs text-slate-400 max-w-xs">
                  TEFAS verilerine dayalı yatırım fonu analiz platformu.
                </p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Veri</p>
                <ul className="space-y-1.5">
                  <li><span className="text-sm text-slate-400">Kaynak: TEFAS</span></li>
                  <li><span className="text-sm text-slate-400">Her iş günü güncellenir</span></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-400">
              © {new Date().getFullYear()} Fonendeks. Sunulan veriler bilgi amaçlıdır; yatırım tavsiyesi değildir.
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
