import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AddAdminForm from '@/components/admin/AddAdminForm'
import DeleteAdminButton from '@/components/admin/DeleteAdminButton'

async function getAdministrators() {
  const supabase = await createServerSupabaseClient()
  const { data: admins } = await supabase
    .from('admins')
    .select('*')
    .order('created_at', { ascending: false })
  return admins || []
}

async function getBatches() {
  const supabase = await createServerSupabaseClient()
  const { data: batches } = await supabase
    .from('batches')
    .select('name')
    .order('name', { ascending: true })
  return [...new Set((batches || []).map((b: { name: string }) => b.name))]
}

export default async function AdministratorsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: admin } = await supabase
      .from('admins').select('role').eq('user_id', user.id).single()
    if (admin?.role !== 'super_admin') redirect('/admin')
  }

  const [admins, batches] = await Promise.all([getAdministrators(), getBatches()])

  const css = `
    .admp-root {
      --ap-elev:    oklch(100% 0 0);
      --ap-soft:    oklch(96% 0.009 55);
      --ap-fg:      oklch(22% 0.02 50);
      --ap-muted:   oklch(46% 0.02 50);
      --ap-bd:      oklch(89% 0.012 50);
      --ap-primary: oklch(50% 0.19 25);
      --ap-psoft:   oklch(94% 0.035 25);
    }
    .dark .admp-root {
      --ap-elev:    oklch(22% 0.012 50);
      --ap-soft:    oklch(20% 0.01 50);
      --ap-fg:      oklch(92% 0.008 50);
      --ap-muted:   oklch(62% 0.015 50);
      --ap-bd:      oklch(32% 0.015 50);
      --ap-primary: oklch(68% 0.18 25);
      --ap-psoft:   oklch(28% 0.06 25);
    }
    @keyframes ap-fade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes ap-row  { from{opacity:0;transform:translateY(6px)}  to{opacity:1;transform:translateY(0)} }
    .ap-fade { animation: ap-fade 0.35s ease-out; }
    .ap-card { background:var(--ap-elev); border:1px solid var(--ap-bd); border-radius:18px; overflow:hidden; }
    .ap-avatar { width:40px; height:40px; border-radius:50%; flex-shrink:0; background:var(--ap-psoft); color:var(--ap-primary); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:14px; }
    .ap-role-badge { font-size:11.5px; font-weight:700; padding:4px 12px; border-radius:20px; background:var(--ap-soft); border:1px solid var(--ap-bd); white-space:nowrap; }
    .ap-del-btn { width:32px; height:32px; border-radius:9px; border:1px solid var(--ap-bd); background:transparent; color:#f97316; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.15s,border-color 0.15s; }
    .ap-del-btn:hover { background:rgba(249,115,22,0.08); border-color:#f97316; }
    .ap-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:64px 20px; text-align:center; color:var(--ap-muted); gap:10px; }
  `

  return (
    <>
      <style>{css}</style>
      <div
        className="admp-root ap-fade"
        style={{
          fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
          color: 'var(--ap-fg)',
          maxWidth: 1280,
          margin: '0 auto',
          padding: '28px 32px 64px',
          width: '100%',
        }}
      >

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>Administrators</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ap-muted)' }}>
            Manage who can access and edit this admin panel.
          </p>
        </div>

        {/* Add New Admin — collapsible (all logic inside AddAdminForm) */}
        <AddAdminForm batches={batches} />

        {/* Admin Accounts heading */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, marginBottom: 12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ap-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Admin Accounts
        </div>

        {/* Admin list */}
        {admins.length === 0 ? (
          <div className="ap-card">
            <div className="ap-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <div style={{ fontSize: 15, fontWeight: 700 }}>No administrators found</div>
              <div style={{ fontSize: 13 }}>Add your first admin using the form above.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {admins.map((admin: any, idx: number) => {
              const isSuperAdmin = admin.role === 'super_admin'
              const isLeader     = admin.role === 'leader'
              const roleColor    = isSuperAdmin ? '#eab308' : isLeader ? '#a855f7' : 'var(--ap-muted)'
              const roleLabel    = isSuperAdmin ? 'Super Admin' : isLeader ? 'Leader' : 'Admin'
              const initial      = (admin.display_name || admin.email || 'A')[0].toUpperCase()

              return (
                <div
                  key={admin.id}
                  className="ap-card"
                  style={{
                    padding: '16px 20px',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12, flexWrap: 'wrap',
                    animation: `ap-row 0.28s ease-out ${idx * 0.04}s both`,
                  }}
                >
                  {/* Left */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                    <div className="ap-avatar">{initial}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {admin.display_name || 'Unknown'}
                        {isSuperAdmin && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" strokeWidth="1">
                            <path d="M2 20h20l-2-9-5 4-3-8-3 8-5-4z"/>
                          </svg>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ap-muted)', marginTop: 1 }}>
                        {admin.email}
                        {admin.phone && <span style={{ marginLeft: 8 }}>{admin.phone}</span>}
                      </div>
                      {admin.batch && (
                        <div style={{ fontSize: 12, color: 'var(--ap-muted)', marginTop: 1 }}>
                          Batch: {admin.batch}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--ap-muted)' }}>
                      {new Date(admin.created_at).toLocaleDateString()}
                    </span>
                    <span className="ap-role-badge" style={{ color: roleColor }}>
                      {roleLabel}
                    </span>
                    {!isSuperAdmin && <DeleteAdminButton adminId={admin.id} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </>
  )
}