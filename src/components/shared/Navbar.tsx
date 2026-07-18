'use client'

import Link from 'next/link'
import { Search, Sun, Moon, User, LogOut } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/shared/ThemeProvider'

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState('')
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)
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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur-sm"
      style={{ background: 'var(--bg-elev)', borderColor: 'var(--bd)' }}>
      <div className="mx-auto flex flex-wrap items-center gap-5 px-6 py-3.5"
        style={{ maxWidth: 1180 }}>

        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-3 no-underline">
          <img
            src="/images/logo.jpg"
            alt="Medical Club logo"
            className="h-11 w-11 rounded-full object-cover"
            style={{ boxShadow: '0 2px 8px var(--shadow)' }}
          />
          <div className="flex flex-col leading-tight">
            <span className="text-[17px] font-extrabold" style={{ color: 'var(--fg)' }}>
              Medical Club
            </span>
            <span className="text-[11.5px] font-medium" style={{ color: 'var(--fg-muted)' }}>
              Exam Platform
            </span>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 ml-2">
          <Link
            href="/"
            className="rounded-[10px] border px-3.5 py-2 text-[14.5px] font-semibold no-underline"
            style={{ color: 'var(--fg)', borderColor: 'var(--bd)' }}
          >
            Home
          </Link>
          {mounted && user && (
            <Link
              href="/dashboard"
              className="rounded-[10px] px-3.5 py-2 text-[14.5px] font-semibold no-underline"
              style={{ color: 'var(--fg)' }}
            >
              Dashboard
            </Link>
          )}
        </nav>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative min-w-[180px] flex-1">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--fg-muted)' }}>
            <Search size={17} />
          </div>
          <input
            type="text"
            placeholder="Search subjects, exams, doctors..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border py-2.5 pl-10 pr-3.5 text-sm outline-none"
            style={{
              background: 'var(--bg-soft)',
              borderColor: 'var(--bd)',
              color: 'var(--fg)',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}
          />
        </form>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle dark mode"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border"
          style={{
            background: 'var(--bg-soft)',
            borderColor: 'var(--bd)',
            color: 'var(--fg)',
          }}
        >
          {mounted ? (
            theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />
          ) : (
            <Moon size={18} />
          )}
        </button>

        {/* Auth buttons */}
        {mounted && user ? (
          <div className="flex shrink-0 items-center gap-2.5">
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13.5px] font-bold no-underline"
                style={{ background: 'var(--clr-primary)', color: '#ffffff' }}
              >
                ? Admin Panel
              </Link>
            )}
            {!isAdmin && (
              <Link
                href="/dashboard"
                className="flex h-9 w-9 items-center justify-center rounded-full no-underline"
                style={{ background: 'var(--clr-soft)', color: 'var(--clr-primary)' }}
              >
                <User size={18} />
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border bg-transparent px-3.5 py-2 text-[13.5px] font-semibold"
              style={{
                borderColor: 'var(--bd)',
                color: 'var(--fg-muted)',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
              }}
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        ) : mounted ? (
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login" className="no-underline">
              <button
                className="cursor-pointer rounded-[10px] border bg-transparent px-4 py-2 text-[13.5px] font-bold"
                style={{
                  borderColor: 'var(--bd)',
                  color: 'var(--fg)',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              >
                Login
              </button>
            </Link>
            <Link href="/register" className="no-underline">
              <button
                className="cursor-pointer rounded-[10px] border-none px-4 py-2 text-[13.5px] font-bold text-white"
                style={{
                  background: 'var(--clr-primary)',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              >
                Sign Up
              </button>
            </Link>
          </div>
        ) : (
          // Placeholder during SSR to avoid hydration mismatch
          <div className="flex shrink-0 items-center gap-2">
            <div className="h-9 w-16 rounded-[10px] border" style={{ borderColor: 'var(--bd)' }} />
            <div className="h-9 w-20 rounded-[10px]" style={{ background: 'var(--clr-primary)' }} />
          </div>
        )}
      </div>
    </header>
  )
}

