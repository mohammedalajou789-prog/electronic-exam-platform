'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [universityId, setUniversityId] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [batch, setBatch] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [batches, setBatches] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('batches')
      .select('name')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setBatches(data.map((b: { name: string }) => b.name))
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() } },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email,
        display_name: displayName.trim(),
        university_id: universityId.trim() || null,
        phone: phone.trim() || null,
        batch: batch || null,
      })
    }

    router.push('/dashboard')
    router.refresh()
  }

  const inputStyle = {
    width: '100%',
    padding: '13px 16px',
    borderRadius: 12,
    border: '1px solid var(--bd)',
    background: 'var(--bg-soft)',
    color: 'var(--fg)',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontSize: 14,
    outline: 'none',
    marginBottom: 20,
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--fg)',
    marginBottom: 8,
  }

  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--bg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', overflow: 'hidden' }}>

      {/* ── Left panel ── */}
      <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--clr-primary)', color: '#fff', padding: '60px 48px', position: 'relative', overflow: 'hidden', height: '100vh' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%', maxWidth: 360, margin: '0 auto' }}>
          <img src="/images/logo.jpg" alt="Medical Club logo"
            style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', marginBottom: 28, animation: 'heartbeatPulse 3.4s ease-in-out infinite' }} />
          <h2 style={{ margin: '0 0 14px', fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}>Medical Club</h2>
          <p style={{ margin: '0 0 10px', fontSize: 15, opacity: 0.85, fontWeight: 600 }}>Faculty of Medicine</p>
          <p style={{ margin: '0 0 36px', fontSize: 14, opacity: 0.7, lineHeight: 1.7 }}>Hashemite University</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            {[
              { icon: '📚', text: 'Comprehensive question bank' },
              { icon: '🎯', text: 'Track your performance' },
              { icon: '🏆', text: 'Practice previous exams' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px', textAlign: 'left' }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, opacity: 0.9 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '40px 48px', background: 'var(--bg)', overflowY: 'auto', height: '100vh' }}>
        <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', paddingTop: 20 }}>

          <div style={{ marginBottom: 32 }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: 'var(--fg)' }}>Create your account</h1>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Registration unlocks bookmarks, history, and statistics</p>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Display Name */}
            <label style={labelStyle}>Display Name</label>
            <input type="text" placeholder="e.g. Mohammed El-Ajou" value={displayName}
              onChange={e => setDisplayName(e.target.value)} required style={inputStyle} />

            {/* University ID */}
            <label style={labelStyle}>University ID</label>
            <input type="text" placeholder="e.g. 2135752" value={universityId}
              onChange={e => setUniversityId(e.target.value)} style={inputStyle} />

            {/* Phone */}
            <label style={labelStyle}>Phone Number</label>
            <input type="tel" placeholder="e.g. 0791993470" value={phone}
              onChange={e => setPhone(e.target.value)} style={inputStyle} />

            {/* Email */}
            <label style={labelStyle}>Email Address</label>
            <input type="email" placeholder="e.g. mohammedalajou789@gmail.com" value={email}
              onChange={e => setEmail(e.target.value)} required style={inputStyle} />

            {/* Password */}
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <input type={showPassword ? 'text' : 'password'} placeholder="At least 6 characters"
                value={password} onChange={e => setPassword(e.target.value)} required
                style={{ ...inputStyle, marginBottom: 0, padding: '13px 44px 13px 16px' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Batch */}
            <label style={labelStyle}>Batch</label>
            <select value={batch} onChange={e => setBatch(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}>
              <option value="">Select your batch</option>
              {batches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
              <option value="outside">I&apos;m from outside Hashemite University</option>
              <option value="other">Other</option>
            </select>

            {/* Error */}
            {error && (
              <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: 12, background: '#fff1f1', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 15, borderRadius: 12, border: 'none', background: 'var(--clr-primary)', color: '#fff', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginBottom: 18 }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--fg-muted)', margin: '0 0 16px' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--clr-primary)', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
            </p>
            <p style={{ textAlign: 'center', margin: 0 }}>
              <Link href="/" style={{ fontSize: 13, color: 'var(--fg-muted)', textDecoration: 'none' }}>← Back to home</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}