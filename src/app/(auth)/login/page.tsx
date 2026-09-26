'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, ArrowLeft, Mail, Lock, AlertCircle, Loader2, ArrowRight } from 'lucide-react'

// Styles for this form live in the auth layout (app/(auth)/layout.tsx).

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (data.user) {
      const { data: adminData } = await supabase
        .from('admins').select('role').eq('user_id', data.user.id).single()
      router.push(adminData ? '/admin' : '/')
      router.refresh()
    }
  }

  return (
    <>
      <div className="au-head">
        <span className="au-eyebrow a-rise">Sign in</span>
        <h1 className="au-h1 a-rise" style={{ ['--i' as string]: 1 } as React.CSSProperties}>Welcome back</h1>
        <p className="au-sub a-rise" style={{ ['--i' as string]: 2 } as React.CSSProperties}>
          Sign in to pick up where you left off — your progress, bookmarks and wrong questions are waiting.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="au-form a-rise" style={{ ['--i' as string]: 3 } as React.CSSProperties}>
        <label className="au-label">
          Email address
          <span className="au-field">
            <Mail size={17} />
            <input
              type="email"
              className="au-input"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </span>
        </label>

        <label className="au-label">
          Password
          <span className="au-field">
            <Lock size={17} />
            <input
              type={showPassword ? 'text' : 'password'}
              className="au-input has-toggle"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="au-eye"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>

        {error && (
          <div className="au-alert au-alert-error a-pop" role="alert">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="au-submit press">
          {loading
            ? <><Loader2 size={17} className="a-spin" />Signing in…</>
            : <>Sign in<ArrowRight size={17} strokeWidth={2.4} /></>}
        </button>

        <div className="au-divider">New to Medical Club?</div>

        <Link href="/register" className="au-alt press">Create an account</Link>

        <Link href="/" className="au-back"><ArrowLeft size={14} />Back to home</Link>
      </form>
    </>
  )
}