'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'

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

    // Check if user is admin
    if (data.user) {
      const { data: adminData } = await supabase
        .from('admins')
        .select('role')
        .eq('user_id', data.user.id)
        .single()

      if (adminData) {
        router.push('/admin')
      } else {
        router.push('/')
      }
      router.refresh()
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)', fontFamily:'"Plus Jakarta Sans", system-ui, sans-serif' }}>

      {/* ?? Left panel ?? */}
      <div style={{
        flex:'1 1 0%', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        background:'var(--clr-primary)', color:'#fff',
        padding:'60px 48px', position:'relative', overflow:'hidden',
      }}>
        {/* decorative blobs */}
        <div style={{ position:'absolute', top:-80, right:-80, width:280, height:280, borderRadius:'50%', background:'rgba(255,255,255,0.06)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, left:-60, width:220, height:220, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:'40%', left:-40, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />

        {/* Content � centered independently from blobs */}
        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', width:'100%', maxWidth:360 }}>
          <img
            src="/images/logo.jpg"
            alt="Medical Club logo"
            style={{ width:110, height:110, borderRadius:'50%', objectFit:'cover', boxShadow:'0 8px 32px rgba(0,0,0,0.25)', marginBottom:28, animation:'heartbeatPulse 3.4s ease-in-out infinite' }}
          />
          <h2 style={{ margin:'0 0 14px', fontSize:30, fontWeight:800, lineHeight:1.2 }}>Medical Club</h2>
          <p style={{ margin:'0 0 10px', fontSize:15, opacity:0.85, fontWeight:600 }}>Faculty of Medicine</p>
          <p style={{ margin:'0 0 36px', fontSize:14, opacity:0.7, lineHeight:1.7 }}>Hashemite University</p>
          <div style={{ display:'flex', flexDirection:'column', gap:12, width:'100%' }}>
            {[
              { icon:'??', text:'Comprehensive question bank' },
              { icon:'??', text:'Track your performance' },
              { icon:'??', text:'Practice previous exams' },
            ].map(item => (
              <div key={item.text} style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(255,255,255,0.1)', borderRadius:12, padding:'12px 16px', textAlign:'left' }}>
                <span style={{ fontSize:18 }}>{item.icon}</span>
                <span style={{ fontSize:13.5, fontWeight:600, opacity:0.9 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ?? Right panel ?? */}
      <div style={{
        flex:'1 1 0%', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'60px 48px', background:'var(--bg)',
      }}>
        <div style={{ width:'100%', maxWidth:420, animation:'0.45s ease-out 0s 1 normal none running fadeSlideIn' }}>

          <div style={{ marginBottom:36 }}>
            <h1 style={{ margin:'0 0 8px', fontSize:28, fontWeight:800, color:'var(--fg)' }}>Welcome back</h1>
            <p style={{ margin:0, fontSize:14, color:'var(--fg-muted)' }}>Sign in to your Medical Club account</p>
          </div>

          <form onSubmit={handleSubmit}>
            <label style={{ display:'block', fontSize:13, fontWeight:700, color:'var(--fg)', marginBottom:8 }}>Email Address</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width:'100%', padding:'13px 16px', borderRadius:12, border:'1px solid var(--bd)', background:'var(--bg-soft)', color:'var(--fg)', fontFamily:'"Plus Jakarta Sans", sans-serif', fontSize:14, outline:'none', marginBottom:20, boxSizing:'border-box' }} />

            <label style={{ display:'block', fontSize:13, fontWeight:700, color:'var(--fg)', marginBottom:8 }}>Password</label>
            <div style={{ position:'relative', marginBottom:24 }}>
              <input type={showPassword ? 'text' : 'password'} placeholder="��������" value={password} onChange={e => setPassword(e.target.value)} required
                style={{ width:'100%', padding:'13px 44px 13px 16px', borderRadius:12, border:'1px solid var(--bd)', background:'var(--bg-soft)', color:'var(--fg)', fontFamily:'"Plus Jakarta Sans", sans-serif', fontSize:14, outline:'none', boxSizing:'border-box' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position:'absolute', top:'50%', right:12, transform:'translateY(-50%)', background:'none', border:'none', color:'var(--fg-muted)', cursor:'pointer', display:'flex', padding:0 }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div style={{ marginBottom:18, padding:'12px 16px', borderRadius:12, background:'#fff1f1', border:'1px solid #fecaca', color:'#dc2626', fontSize:13, fontWeight:600 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:15, borderRadius:12, border:'none', background:'var(--clr-primary)', color:'#fff', fontFamily:'"Plus Jakarta Sans", sans-serif', fontSize:15, fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginBottom:18 }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p style={{ textAlign:'center', fontSize:13.5, color:'var(--fg-muted)', margin:'0 0 16px' }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" style={{ color:'var(--clr-primary)', fontWeight:700, textDecoration:'none' }}>Create one</Link>
            </p>

            <p style={{ textAlign:'center', margin:0 }}>
              <Link href="/" style={{ fontSize:13, color:'var(--fg-muted)', textDecoration:'none' }}>? Back to home</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

