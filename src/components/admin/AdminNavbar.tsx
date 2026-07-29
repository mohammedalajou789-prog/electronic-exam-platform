'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface Props {
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
}

const PAGE_LABELS: Record<string, string> = {
  '/admin':                  'Dashboard',
  '/admin/content':          'Content',
  '/admin/exams':            'Exams',
  '/admin/import':           'Bulk Import',
  '/admin/manual-import':    'Manual Import',
  '/admin/reports':          'Reports',
  '/admin/analytics':        'Analytics',
  '/admin/administrators':   'Administrators',
  '/admin/settings':         'Settings',
  '/admin/images':           'Images',
}

export default function AdminNavbar({ onToggleSidebar, sidebarCollapsed }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [dark, setDark] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function toggleDark() {
    setDark((prev) => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      return next
    })
  }

  // Build breadcrumb label
  const pageLabel =
    PAGE_LABELS[pathname] ??
    (pathname.startsWith('/admin/exams/') ? 'Exams' : 'Admin')

  return (
    <>
      <style>{`
        .adm-topbar-root {
          --bg-elev:     oklch(100% 0 0);
          --bg-soft:     oklch(96% 0.009 55);
          --fg:          oklch(22% 0.02 50);
          --fg-muted:    oklch(46% 0.02 50);
          --bd:          oklch(89% 0.012 50);
          --clr-primary: oklch(50% 0.19 25);
          --shadow:      rgba(20,10,10,0.08);
        }
        .dark .adm-topbar-root {
          --bg-elev:     oklch(22% 0.012 50);
          --bg-soft:     oklch(20% 0.01 50);
          --fg:          oklch(92% 0.008 50);
          --fg-muted:    oklch(62% 0.015 50);
          --bd:          oklch(32% 0.015 50);
          --clr-primary: oklch(68% 0.18 25);
          --shadow:      rgba(0,0,0,0.35);
        }
        .adm-topbar-iconbtn {
          width: 38px; height: 38px;
          border-radius: 10px;
          border: 1px solid var(--bd);
          background: var(--bg-soft);
          color: var(--fg);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .adm-topbar-iconbtn:hover { background: var(--bd); }
        .adm-topbar-studentbtn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 15px; border-radius: 10px;
          background: var(--clr-primary);
          font-size: 13px; font-weight: 700;
          color: #fff; text-decoration: none;
          transition: opacity 0.15s;
        }
        .adm-topbar-studentbtn:hover { opacity: 0.9; }
        .adm-topbar-logoutbtn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 10px;
          border: 1px solid var(--bd); background: transparent;
          color: var(--fg-muted); font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: background 0.15s, color 0.15s;
        }
        .adm-topbar-logoutbtn:hover { background: var(--bg-soft); color: var(--fg); }
      `}</style>

      <div
        className="adm-topbar-root"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          borderBottom: '1px solid var(--bd)',
          background: 'var(--bg-elev)',
          flexShrink: 0,
          zIndex: 40,
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        {/* Left: toggle + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            className="adm-topbar-iconbtn"
            onClick={onToggleSidebar}
            title="Toggle sidebar"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="9" y1="4" x2="9" y2="20" />
            </svg>
          </button>

          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-muted)' }}>
            Medical Club Admin /{' '}
            <span style={{ color: 'var(--fg)' }}>{pageLabel}</span>
          </div>
        </div>

        {/* Right: dark mode + student panel + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/" className="adm-topbar-studentbtn">
            Student Panel
          </Link>

          <button
            className="adm-topbar-iconbtn"
            onClick={toggleDark}
            title="Toggle dark mode"
            style={{ transition: 'transform 0.3s' }}
          >
            {dark ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <button onClick={handleLogout} className="adm-topbar-logoutbtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </>
  )
}