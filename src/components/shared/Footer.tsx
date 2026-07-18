import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ borderTop:'1px solid var(--bd)', background:'var(--bg-soft)' }}>
      <div style={{ maxWidth:'100%', padding:'22px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/images/logo.jpg" alt="Medical Club logo" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' }} />
          <span style={{ fontWeight:800, fontSize:13.5, color:'var(--fg)' }}>Medical Club</span>
          <span style={{ fontSize:12, color:'var(--fg-muted)' }}>— Hashemite University</span>
        </div>
        <div style={{ display:'flex', gap:20, fontSize:13, color:'var(--fg-muted)' }}>
          <Link href="/about" style={{ color:'var(--fg-muted)', textDecoration:'none' }}>About</Link>
          <Link href="/contact" style={{ color:'var(--fg-muted)', textDecoration:'none' }}>Contact</Link>
          <Link href="/privacy" style={{ color:'var(--fg-muted)', textDecoration:'none' }}>Privacy</Link>
        </div>
        <span style={{ fontSize:12, color:'var(--fg-muted)' }}>© 2026</span>
      </div>
    </footer>
  )
}

