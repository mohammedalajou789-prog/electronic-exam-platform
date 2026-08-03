'use client'

import Link from 'next/link'
import { Search, Sun, Moon, User, LogOut, Menu, X, Home, LayoutDashboard, ShieldCheck } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/shared/ThemeProvider'

interface Suggestion {
  type: string
  label: string
  icon: string
}

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState('')
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    setSearchQuery('')
  }, [pathname])
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  const debounceRef    = useRef<NodeJS.Timeout | null>(null)
  const suggestRef     = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestRef.current && !suggestRef.current.contains(e.target as Node) &&
        searchInputRef.current && !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggest(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch suggestions with 300ms debounce
  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const terms = q.split('+')
    const lastTerm = terms[terms.length - 1].trim()
    if (lastTerm.length < 2) {
      setSuggestions([])
      setShowSuggest(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      const res  = await fetch(`/api/search/suggestions?q=${encodeURIComponent(lastTerm)}`)
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
      setShowSuggest((data.suggestions?.length ?? 0) > 0)
    }, 300)
  }, [])

  function handleQueryChange(val: string) {
    setSearchQuery(val)
    fetchSuggestions(val)
  }

  function pickSuggestion(s: Suggestion) {
    const terms = searchQuery.split('+').map((t: string) => t.trim()).filter(Boolean)
    terms[terms.length - 1] = s.label
    const newQuery = terms.join(' + ')
    setSearchQuery(newQuery)
    setShowSuggest(false)
    router.push(`/search?q=${encodeURIComponent(newQuery)}`)
  }

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
      setShowSuggest(false)
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

      {/* Sidebar */}
      <aside className={`mobile-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 12px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/images/logo.jpg" alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)', lineHeight: 1.2 }}>Medical Club</div>
              <div style={{ fontSize: 9.5, color: 'var(--fg-muted)', fontWeight: 500 }}>Exam Platform</div>
            </div>
          </div>
          <button onClick={closeSidebar} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 0' }}>
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
            <Link href="/admin" onClick={closeSidebar} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, background: 'var(--clr-primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, textDecoration: 'none', marginTop: 4 }}>
              <ShieldCheck size={15} />
              Admin Panel
            </Link>
          )}
          <div className="sb-divider" style={{ marginTop: 8 }} />
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="sb-link" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            {mounted
              ? theme === 'dark'
                ? <><Sun size={15} style={{ color: 'var(--clr-primary)' }} /> Light Mode</>
                : <><Moon size={15} style={{ color: 'var(--clr-primary)' }} /> Dark Mode</>
              : <><Moon size={15} /> Dark Mode</>
            }
          </button>
          <div className="sb-divider" />
          {mounted && user ? (
            <button onClick={handleLogout} className="sb-link" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--fg-muted)' }}>
              <LogOut size={15} style={{ flexShrink: 0 }} />
              Logout
            </button>
          ) : mounted ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 2 }}>
              <Link href="/login" onClick={closeSidebar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px', borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>Login</Link>
              <Link href="/register" onClick={closeSidebar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px', borderRadius: 9, background: 'var(--clr-primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>Sign Up</Link>
            </div>
          ) : null}
        </div>

        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--bd)' }}>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--fg-muted)', textAlign: 'center', lineHeight: 1.4 }}>
            Faculty of Medicine<br />Hashemite University
          </p>
        </div>
      </aside>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg-elev)', borderBottom: '1px solid var(--bd)', backdropFilter: 'blur(10px)' }}>
        <div style={{ width: '100%', padding: '0 28px', height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
            <img src="/images/logo.jpg" alt="Medical Club" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg)' }}>Medical Club</div>
              <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--fg-muted)' }}>Exam Platform</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="nb-desktop" style={{ alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <Link href="/" style={{ borderRadius: 10, border: '1px solid var(--bd)', padding: '7px 14px', fontSize: 14, fontWeight: 600, color: 'var(--fg)', textDecoration: 'none' }}>Home</Link>
            {mounted && user && (
              <Link href="/dashboard" style={{ borderRadius: 10, padding: '7px 14px', fontSize: 14, fontWeight: 600, color: 'var(--fg)', textDecoration: 'none' }}>Dashboard</Link>
            )}
          </nav>

          {/* Desktop search */}
          <form onSubmit={handleSearch} className="nb-desktop" style={{ flex: 1, position: 'relative', minWidth: 0, zIndex: 51 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', pointerEvents: 'none' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder='Search — use + to combine (e.g. "Medicine + Heart + 2024")'
              value={searchQuery}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
              onKeyDown={e => e.key === 'Escape' && setShowSuggest(false)}
              style={{ width: '100%', borderRadius: 12, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', padding: '9px 14px 9px 38px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }}
            />
            {showSuggest && (
              <div ref={suggestRef} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 13, boxShadow: '0 8px 30px var(--shadow)', zIndex: 100, overflow: 'hidden' }}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onMouseDown={e => { e.preventDefault(); pickSuggestion(s) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', borderBottom: i < suggestions.length - 1 ? '1px solid var(--bd)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-soft)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{s.icon}</span>
                    <span style={{ fontSize: 13, color: 'var(--fg)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--bg-soft)', color: 'var(--fg-muted)', flexShrink: 0 }}>{s.type}</span>
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Desktop theme + auth */}
          <div className="nb-desktop" style={{ alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {mounted ? (theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />) : <Moon size={17} />}
            </button>
            {mounted && user ? (
              <>
                {isAdmin && (
                  <Link href="/admin" style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--clr-primary)', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Admin Panel</Link>
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
            <button onClick={() => setMobileSearchOpen(v => !v)} style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {mobileSearchOpen ? <X size={16} /> : <Search size={16} />}
            </button>
            <button onClick={() => setSidebarOpen(v => !v)} style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Menu size={17} />
            </button>
          </div>

        </div>

        {/* Mobile search */}
        {mobileSearchOpen && (
          <div style={{ borderTop: '1px solid var(--bd)', padding: '10px 16px', background: 'var(--bg-elev)', position: 'relative' }}>
            <form onSubmit={handleSearch} style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', pointerEvents: 'none' }} />
              <input
                autoFocus
                type="text"
                placeholder='Search — use + to combine terms'
                value={searchQuery}
                onChange={e => handleQueryChange(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setShowSuggest(false)}
                style={{ width: '100%', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bg-soft)', color: 'var(--fg)', padding: '9px 12px 9px 34px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </form>
            {showSuggest && (
              <div style={{ position: 'absolute', top: 'calc(100% - 2px)', left: 16, right: 16, background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 12, boxShadow: '0 8px 24px var(--shadow)', zIndex: 100, overflow: 'hidden' }}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onMouseDown={e => { e.preventDefault(); pickSuggestion(s); setMobileSearchOpen(false) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', borderBottom: i < suggestions.length - 1 ? '1px solid var(--bd)' : 'none' }}
                  >
                    <span style={{ fontSize: 13, flexShrink: 0 }}>{s.icon}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--fg)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>
    </>
  )
}