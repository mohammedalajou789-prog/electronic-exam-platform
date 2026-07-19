'use client'

import Link from 'next/link'
import { Search, Sun, Moon, User, LogOut, Menu, X, Home, LayoutDashboard, ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/shared/ThemeProvider'

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState('')
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      if (data.user) {
        const { data: adminData } = await supabase
          .from('admins').select('role').eq('user_id', data.user.id).single()
        setIsAdmin(!!adminData)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user || null)
        if (session?.user) {
          const { data: adminData } = await supabase
            .from('admins').select('role').eq('user_id', session.user.id).single()
          setIsAdmin(!!adminData)
        } else {
          setIsAdmin(false)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  async function handleLogout() {
    await supabase.auth.signOut()
    setSidebarOpen(false)
    router.push('/')
    router.refresh()
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      setMobileSearchOpen(false)
      setSidebarOpen(false)
    }
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <>
      <style>{`
        .nb-desktop     { display: flex; }
        .nb-mobile-only { display: none; }

        @media (max-width: 768px) {
          .nb-desktop     { display: none; }
          .nb-mobile-only { display: flex; }
        }

        .mobile-sidebar {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: 240px;
          background: var(--bg-elev);
          border-left: 1px solid var(--bd);
          z-index: 200;
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
          box-shadow: -6px 0 24px rgba(0,0,0,0.10);
        }
        .mobile-sidebar.open { transform: translateX(0); }

        .sidebar-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.25);
          z-index: 199;
          opacity: 0; pointer-events: none;
          transition: opacity 0.25s ease;
        }
        .sidebar-backdrop.open { opacity: 1; pointer-events: all; }

        .sb-link {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 9px;
          color: var(--fg); font-size: 13.5px; font-weight: 600;
          text-decoration: none;
          transition: background 0.15s;
        }
        .sb-link:hover { background: var(--bg-soft); }

        .sb-divider {
          height: 1px; background: var(--bd);
          margin: 6px 0;
        }
      `}</style>

      {/* Backdrop */}
      <div className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={closeSidebar} />

      {/* ── Sidebar ── */}
      <aside className={`mobile-sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 14px 12px',
          borderBottom: '1px solid var(--bd)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/images/logo.jpg" alt=""
              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)', lineHeight: 1.2 }}>Medical Club</div>
              <div style={{ fontSize: 9.5, color: 'var(--fg-muted)', fontWeight: 500 }}>Exam Platform</div>
            </div>
          </div>
          <button onClick={closeSidebar} style={{
            width: 28, height: 28, borderRadius: 7,
            border: '1px solid var(--bd)', background: 'transparent',
            color: 'var(--fg-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 0' }}>

          {/* Nav links */}
          <Link href="/" onClick={closeSidebar} className="sb-link">
            <Home size={15} style={{ color: 'var(--clr-primary)', flexShrink: 0 }} />
            Home
          </Link>

          {mounted && user && (
            <Link href="/dashboard" onClick={closeSidebar} className="sb-link">
              <LayoutDashboard size={15} style={{ color: 'var(--clr-primary)', flexShrink: 0 }} />
              Dashboard
            </Link>
          )}

          {mounted && isAdmin && (
            <Link href="/admin" onClick={closeSidebar} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 9,
              background: 'var(--clr-primary)', color: '#fff',
              fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
              marginTop: 4,
            }}>
              <ShieldCheck size={15} />
              Admin Panel
            </Link>
          )}

          <div className="sb-divider" style={{ marginTop: 8 }} />

          {/* Theme */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="sb-link"
            style={{
              width: '100%', border: 'none', background: 'transparent',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            {mounted
              ? theme === 'dark'
                ? <><Sun size={15} style={{ color: 'var(--clr-primary)' }} /> Light Mode</>
                : <><Moon size={15} style={{ color: 'var(--clr-primary)' }} /> Dark Mode</>
              : <><Moon size={15} /> Dark Mode</>
            }
          </button>

          <div className="sb-divider" />

          {/* Auth */}
          {mounted && user ? (
            <button onClick={handleLogout} className="sb-link" style={{
              width: '100%', border: 'none', background: 'transparent',
              cursor: 'pointer', fontFamily: 'inherit', color: 'var(--fg-muted)',
            }}>
              <LogOut size={15} style={{ flexShrink: 0 }} />
              Logout
            </button>
          ) : mounted ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 2 }}>
              <Link href="/login" onClick={closeSidebar} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '9px', borderRadius: 9,
                border: '1px solid var(--bd)', background: 'var(--bg-soft)',
                color: 'var(--fg)', fontSize: 13.5, fontWeight: 700,
                textDecoration: 'none',
              }}>
                Login
              </Link>
              <Link href="/register" onClick={closeSidebar} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '9px', borderRadius: 9,
                background: 'var(--clr-primary)', color: '#fff',
                fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
              }}>
                Sign Up
              </Link>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--bd)' }}>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--fg-muted)', textAlign: 'center', lineHeight: 1.4 }}>
            Faculty of Medicine<br />Hashemite University
          </p>
        </div>
      </aside>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--bd)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto',
          padding: '0 20px', height: 60,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
            <img src="/images/logo.jpg" alt="Medical Club"
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg)' }}>Medical Club</div>
              <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--fg-muted)' }}>Exam Platform</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="nb-desktop" style={{ alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <Link href="/" style={{ borderRadius: 10, border: '1px solid var(--bd)', padding: '7px 14px', fontSize: 14, fontWeight: 600, color: 'var(--fg)', textDecoration: 'none' }}>
              Home
            </Link>
            {mounted && user && (
              <Link href="/dashboard" style={{ borderRadius: 10, padding: '7px 14px', fontSize: 14, fontWeight: 600, color: 'var(--fg)', textDecoration: 'none' }}>
                Dashboard
              </Link>
            )}
          </nav>

          {/* Desktop search */}
          <form onSubmit={handleSearch} className="nb-desktop" style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search subjects, exams, doctors..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', borderRadius: 12, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', padding: '9px 14px 9px 38px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }}
            />
          </form>

          {/* Desktop theme + auth */}
          <div className="nb-desktop" style={{ alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {mounted ? (theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />) : <Moon size={17} />}
            </button>

            {mounted && user ? (
              <>
                {isAdmin && (
                  <Link href="/admin" style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--clr-primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                    Admin Panel
                  </Link>
                )}
                {!isAdmin && (
                  <Link href="/dashboard" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                    <User size={17} />
                  </Link>
                )}
                <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <LogOut size={14} /> Logout
                </button>
              </>
            ) : mounted ? (
              <>
                <Link href="/login" style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--fg)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Login</Link>
                <Link href="/register" style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--clr-primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Sign Up</Link>
              </>
            ) : (
              <div style={{ width: 120, height: 36, borderRadius: 10, background: 'var(--bg-soft)' }} />
            )}
          </div>

          {/* Mobile buttons */}
          <div className="nb-mobile-only" style={{ marginLeft: 'auto', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setMobileSearchOpen(v => !v)}
              style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {mobileSearchOpen ? <X size={16} /> : <Search size={16} />}
            </button>
            <button onClick={() => setSidebarOpen(v => !v)}
              style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Menu size={17} />
            </button>
          </div>

        </div>

        {/* Mobile search */}
        {mobileSearchOpen && (
          <div style={{ borderTop: '1px solid var(--bd)', padding: '10px 16px', background: 'var(--bg-elev)' }}>
            <form onSubmit={handleSearch} style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', pointerEvents: 'none' }} />
              <input
                autoFocus type="text"
                placeholder="Search subjects, exams, doctors..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', padding: '9px 12px 9px 34px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </form>
          </div>
        )}
      </header>
    </>
  )
}