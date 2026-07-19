'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'

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
      .from('batches').select('name').order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setBatches(data.map((b: { name: string }) => b.name))
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName.trim() } },
    })
    if (authError) { setError(authError.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id, email,
        display_name: displayName.trim(),
        university_id: universityId.trim() || null,
        phone: phone.trim() || null,
        batch: batch || null,
      })
    }
    router.push('/dashboard')
    router.refresh()
  }

  const inp = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1px solid var(--bd)', background: 'var(--bg-soft)',
    color: 'var(--fg)', fontFamily: 'inherit', fontSize: 14,
    outline: 'none', marginBottom: 16, boxSizing: 'border-box' as const,
  }

  const lbl = {
    display: 'block', fontSize: 12.5, fontWeight: 700,
    color: 'var(--fg)', marginBottom: 6,
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'var(--bg)',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
    }}>
      <style>{`
        .reg-left  { display: flex; }
        .reg-right { flex: 1 1 0%; }
        .reg-mobile-logo { display: none; }

        @media (max-width: 768px) {
          .reg-left        { display: none; }
          .reg-mobile-logo { display: flex !important; }
          .reg-right {
            padding: 28px 22px 48px !important;
            align-items: flex-start !important;
            justify-content: flex-start !important;
          }
        }
      `}</style>

      {/* ── Left panel (desktop only) ── */}
      <div className="reg-left" style={{
        flex: '1 1 0%', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--clr-primary)', color: '#fff',
        padding: '60px 48px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%', maxWidth: 360 }}>
          <img src="/images/logo.jpg" alt="Medical Club"
            style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', marginBottom: 28 }} />
          <h2 style={{ margin: '0 0 10px', fontSize: 30, fontWeight: 800 }}>Medical Club</h2>
          <p style={{ margin: '0 0 6px', fontSize: 15, opacity: 0.85, fontWeight: 600 }}>Faculty of Medicine</p>
          <p style={{ margin: '0 0 36px', fontSize: 14, opacity: 0.7 }}>Hashemite University</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            {[
              { icon: '📚', text: 'Comprehensive question bank' },
              { icon: '📊', text: 'Track your performance' },
              { icon: '📝', text: 'Practice previous exams' },
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
      <div className="reg-right" style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: '40px 48px', background: 'var(--bg)',
        overflowY: 'auto', maxHeight: '100vh',
      }}>
        <div style={{ width: '100%', maxWidth: 420, paddingTop: 12 }}>

          {/* Mobile: logo */}
          <div className="reg-mobile-logo" style={{
            flexDirection: 'column', alignItems: 'center',
            marginBottom: 28,
          }}>
            <img src="/images/logo.jpg" alt="Medical Club"
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', marginBottom: 10, boxShadow: '0 4px 16px rgba(196,18,48,0.2)' }} />
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--fg)' }}>Medical Club</div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 2 }}>
              Faculty of Medicine — Hashemite University
            </div>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: '0 0 5px', fontSize: 24, fontWeight: 800, color: 'var(--fg)' }}>
              Create your account
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-muted)' }}>
              Registration unlocks bookmarks, history, and statistics
            </p>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Display Name */}
            <label style={lbl}>Display Name</label>
            <input type="text" placeholder="e.g. Mohammed El-Ajou"
              value={displayName} onChange={e => setDisplayName(e.target.value)}
              required style={inp} />

            {/* University ID */}
            <label style={lbl}>University ID</label>
            <input type="text" placeholder="e.g. 2135752"
              value={universityId} onChange={e => setUniversityId(e.target.value)}
              style={inp} />

            {/* Phone */}
            <label style={lbl}>Phone Number</label>
            <input type="tel" placeholder="e.g. 0791993470"
              value={phone} onChange={e => setPhone(e.target.value)}
              style={inp} />

            {/* Email */}
            <label style={lbl}>Email Address</label>
            <input type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required style={inp} />

            {/* Password */}
            <label style={lbl}>Password</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password} onChange={e => setPassword(e.target.value)}
                required
                style={{ ...inp, marginBottom: 0, padding: '11px 40px 11px 14px' }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Batch */}
            <label style={lbl}>Batch</label>
            <select value={batch} onChange={e => setBatch(e.target.value)}
              style={{ ...inp, cursor: 'pointer', appearance: 'auto' }}>
              <option value="">Select your batch</option>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
              <option value="outside">I&apos;m from outside Hashemite University</option>
              <option value="other">Other</option>
            </select>

            {/* Error */}
            {error && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#fff1f1', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px', borderRadius: 11,
              border: 'none', background: 'var(--clr-primary)', color: '#fff',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, marginBottom: 14,
            }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--fg-muted)', margin: '0 0 12px' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--clr-primary)', fontWeight: 700, textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>

            <p style={{ textAlign: 'center', margin: 0 }}>
              <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--fg-muted)', textDecoration: 'none' }}>
                <ArrowLeft size={13} /> Back to home
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}