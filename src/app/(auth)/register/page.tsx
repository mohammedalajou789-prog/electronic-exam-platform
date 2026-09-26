'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Eye, EyeOff, ArrowLeft, User, IdCard, Phone, Mail, Lock, Users,
  ChevronDown, AlertCircle, CircleCheck, Loader2, ArrowRight,
} from 'lucide-react'

// Styles for this form live in the auth layout (app/(auth)/layout.tsx).

/** Visual-only password hint: 0 = empty, 1 = too short … 4 = strong */
function strengthOf(pw: string) {
  if (!pw) return { level: 0, label: '', color: 'var(--track)' }
  if (pw.length < 6) return { level: 1, label: 'Too short', color: 'var(--clr-primary)' }
  let score = 2
  if (pw.length >= 10) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]|[A-Z]/.test(pw)) score++
  return score >= 4
    ? { level: 4, label: 'Strong', color: 'var(--ok)' }
    : score === 3
      ? { level: 3, label: 'Good', color: 'var(--accent-blue)' }
      : { level: 2, label: 'Okay', color: 'var(--warn)' }
}

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [universityId, setUniversityId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [batch, setBatch] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [batches, setBatches] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('batches').select('name').order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setBatches(data.map((b: { name: string }) => b.name))
      })
  }, [])

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setNotice('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)

    const supabase = createClient()

    // All profile fields are sent with the account itself.
    // The database trigger (on_auth_user_created) copies them into the users table.
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
          university_id: universityId.trim() || null,
          phone: phone.trim() || null,
          batch: batch || null,
        },
      },
    })

    if (authError) { setError(authError.message); setLoading(false); return }

    // Email confirmation is required: the student is not signed in yet
    if (!data.session) {
      setNotice('Account created. Please check your email to confirm your account, then sign in.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const strength = strengthOf(password)
  const locked = loading || notice !== ''

  return (
    <>
      <div className="au-head">
        <span className="au-eyebrow a-rise">Create account</span>
        <h1 className="au-h1 a-rise" style={{ ['--i' as string]: 1 } as React.CSSProperties}>Join Medical Club</h1>
        <p className="au-sub a-rise" style={{ ['--i' as string]: 2 } as React.CSSProperties}>
          Registration unlocks bookmarks, history and statistics. It takes less than a minute.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="au-form a-rise" style={{ ['--i' as string]: 3 } as React.CSSProperties}>

        {/* ── About you ── */}
        <div className="au-group">
          <span className="au-group-title">About you</span>

          <label className="au-label">
            Display name
            <span className="au-field">
              <User size={17} />
              <input
                type="text" className="au-input" placeholder="e.g. Mohammed El-Ajou" autoComplete="name"
                value={displayName} onChange={e => setDisplayName(e.target.value)} required
              />
            </span>
          </label>

          <div className="au-grid-2">
            <label className="au-label">
              <span>University ID <em>· optional</em></span>
              <span className="au-field">
                <IdCard size={17} />
                <input
                  type="text" className="au-input" placeholder="e.g. 2135752" inputMode="numeric"
                  value={universityId} onChange={e => setUniversityId(e.target.value)}
                />
              </span>
            </label>

            <label className="au-label">
              <span>Phone <em>· optional</em></span>
              <span className="au-field">
                <Phone size={17} />
                <input
                  type="tel" className="au-input" placeholder="e.g. 0791993470" autoComplete="tel"
                  value={phone} onChange={e => setPhone(e.target.value)}
                />
              </span>
            </label>
          </div>

          <label className="au-label">
            <span>Batch <em>· optional</em></span>
            <span className="au-field">
              <Users size={17} />
              <select className={`au-input${batch ? '' : ' is-empty'}`} value={batch} onChange={e => setBatch(e.target.value)}>
                <option value="">Select your batch</option>
                {batches.map(b => <option key={b} value={b}>{b}</option>)}
                <option value="outside">I&apos;m from outside Hashemite University</option>
                <option value="other">Other</option>
              </select>
              <ChevronDown size={16} className="au-chev" />
            </span>
          </label>
        </div>

        {/* ── Account ── */}
        <div className="au-group">
          <span className="au-group-title">Account</span>

          <label className="au-label">
            Email address
            <span className="au-field">
              <Mail size={17} />
              <input
                type="email" className="au-input" placeholder="you@example.com" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)} required
              />
            </span>
          </label>

          <label className="au-label">
            Password
            <span className="au-field">
              <Lock size={17} />
              <input
                type={showPassword ? 'text' : 'password'} className="au-input has-toggle"
                placeholder="At least 6 characters" autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)} required
              />
              <button
                type="button" className="au-eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
            {password && (
              <span className="au-meter" aria-live="polite">
                <span className="au-meter-bars">
                  {[1, 2, 3, 4].map(n => (
                    <i key={n} style={{ background: n <= strength.level ? strength.color : undefined }} />
                  ))}
                </span>
                <span style={{ color: strength.color }}>{strength.label}</span>
              </span>
            )}
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="au-alert au-alert-error a-pop" role="alert">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Success notice (email confirmation) */}
        {notice && (
          <div className="au-alert au-alert-ok a-pop" role="status">
            <CircleCheck size={16} />
            {notice}
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={locked} className="au-submit press">
          {loading
            ? <><Loader2 size={17} className="a-spin" />Creating account…</>
            : <>Create account<ArrowRight size={17} strokeWidth={2.4} /></>}
        </button>

        <div className="au-divider">Already have an account?</div>

        <Link href="/login" className="au-alt press">Sign in</Link>

        <Link href="/" className="au-back"><ArrowLeft size={14} />Back to home</Link>
      </form>
    </>
  )
}