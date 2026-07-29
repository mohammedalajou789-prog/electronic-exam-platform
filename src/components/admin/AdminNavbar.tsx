'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Home } from 'lucide-react'

export default function AdminNavbar() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'var(--bg-elev)',
      borderBottom: '1px solid var(--bd)',
      backdropFilter: 'blur(10px)',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '0 20px', height: 60,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>

        {/* Logo */}
        <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <img src="/images/logo.jpg" alt="Medical Club"
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg)' }}>Medical Club</div>
            <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--fg-muted)' }}>Admin Panel</div>
          </div>
        </Link>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Link href="/" target="_blank" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            border: '1px solid var(--bd)', background: 'transparent',
            color: 'var(--fg)', fontSize: 13, fontWeight: 600,
            textDecoration: 'none',
          }}>
            <Home size={14} /> Student Panel
          </Link>

          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            border: '1px solid var(--bd)', background: 'transparent',
            color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <LogOut size={14} /> Logout
          </button>
        </div>

      </div>
    </header>
  )
}