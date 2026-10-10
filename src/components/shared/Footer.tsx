export default function Footer() {
  return (
    <footer style={{ borderTop:'1px solid var(--bd)', background:'var(--bg-soft)' }}>
      <div style={{ maxWidth:'var(--page-max)', margin:'0 auto', padding:'22px var(--page-pad)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/images/logo.jpg" alt="Medical Club logo" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' }} />
          <span style={{ fontWeight:800, fontSize:13.5, color:'var(--fg)' }}>Medical Club</span>
          <span style={{ fontSize:12, color:'var(--fg-muted)' }}>— Hashemite University</span>
        </div>
        <span style={{ fontSize:12, color:'var(--fg-muted)' }}>© 2026</span>
      </div>
    </footer>
  )
}

