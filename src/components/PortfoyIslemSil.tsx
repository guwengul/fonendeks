'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { portfoyIslemSil } from '@/lib/auth-actions'

export function PortfoyIslemSil({ id }: { id: string }) {
  const [yukleniyor, setYukleniyor] = useState(false)
  const router = useRouter()

  async function handle() {
    if (!confirm('Bu işlemi silmek istiyor musunuz?')) return
    setYukleniyor(true)
    await portfoyIslemSil(id)
    router.refresh()
  }

  return (
    <button onClick={handle} disabled={yukleniyor}
      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
      title="İşlemi sil">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}
