'use client'

import { useState } from 'react'

interface Props {
  batches: string[]
}

type Role = 'admin' | 'leader' | 'super_admin'

const roleMeta: Record<Role, { label: string; icon: string }> = {
  admin:       { label: 'Admin',       icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  leader:      { label: 'Leader',      icon: 'M12 8c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-6C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z' },
  super_admin: { label: 'Super Admin', icon: 'M2 20h20l-2-9-5 4-3-8-3 8-5-4z' },
}

export default function AddAdminForm({ batches }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [batch, setBatch] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<Role>('admin')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const disabled = !name.trim() || !email.trim() || !password.trim() || loading

  async function handleCreate() {
    if (disabled) return
    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          batch,
          password,
          role,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Failed to create admin')
      }

      // Success — reload to show the new admin in the list
      window.location.reload()

    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.')
      setLoading(false)
    }
  }

  const css = `
    .aaf-root {
      --aaf-bg:      oklch(98% 0.006 55);
      --aaf-elev:    oklch(100% 0 0);
      --aaf-soft:    oklch(96% 0.009 55);
      --aaf-fg:      oklch(22% 0.02 50);
      --aaf-muted:   oklch(46% 0.02 50);
      --aaf-bd:      oklch(89% 0.012 50);
      --aaf-primary: oklch(50% 0.19 25);
      --aaf-psoft:   oklch(94% 0.035 25);
    }
    .dark .aaf-root {
      --aaf-elev:    oklch(22% 0.012 50);
      --aaf-soft:    oklch(20% 0.01 50);
      --aaf-fg:      oklch(92% 0.008 50);
      --aaf-muted:   oklch(62% 0.015 50);
      --aaf-bd:      oklch(32% 0.015 50);
      --aaf-primary: oklch(68% 0.18 25);
      --aaf-psoft:   oklch(28% 0.06 25);
    }
    .aaf-card { background:var(--aaf-elev); border:1px solid var(--aaf-bd); border-radius:18px; overflow:hidden; margin-bottom:20px; }
    .aaf-header { padding:20px 22px; display:flex; align-items:center; justify-content:space-between; cursor:pointer; transition:background 0.12s; }
    .aaf-header:hover { background:var(--aaf-soft); }
    .aaf-icon-wrap { width:36px; height:36px; border-radius:11px; background:var(--aaf-psoft); color:var(--aaf-primary); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .aaf-body { padding:0 22px 22px; border-top:1px solid var(--aaf-bd); }
    .aaf-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:18px; }
    .aaf-label { font-size:12.5px; font-weight:700; color:var(--aaf-muted); margin-bottom:6px; display:block; }
    .aaf-input { width:100%; border:1px solid var(--aaf-bd); background:var(--aaf-soft); color:var(--aaf-fg); border-radius:10px; padding:10px 13px; font-size:13.5px; outline:none; font-family:inherit; transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box; }
    .aaf-input:focus { border-color:var(--aaf-primary); box-shadow:0 0 0 3px var(--aaf-psoft); }
    .aaf-pw-wrap { position:relative; }
    .aaf-pw-wrap .aaf-input { padding-right:40px; }
    .aaf-pw-eye { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--aaf-muted); cursor:pointer; padding:2px; display:flex; align-items:center; }
    .aaf-role-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
    .aaf-role-btn { padding:9px; border-radius:10px; border:1px solid var(--aaf-bd); background:var(--aaf-soft); color:var(--aaf-fg); font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; text-align:center; transition:all 0.15s; display:flex; align-items:center; justify-content:center; gap:6px; }
    .aaf-role-btn.active { background:var(--aaf-primary); color:#fff; border-color:var(--aaf-primary); }
    .aaf-role-btn:not(.active):hover { border-color:var(--aaf-primary); }
    .aaf-warning { display:flex; align-items:center; gap:8px; padding:12px 14px; border-radius:10px; background:oklch(95% 0.025 25); border:1px solid oklch(85% 0.05 25); margin-top:14px; }
    .dark .aaf-warning { background:oklch(26% 0.04 25); border-color:oklch(36% 0.06 25); }
    .aaf-warning-text { font-size:13px; color:var(--aaf-primary); font-weight:600; }
    .aaf-actions { display:flex; gap:10px; margin-top:18px; }
    .aaf-btn-primary { background:var(--aaf-primary); color:#fff; border:none; border-radius:11px; padding:11px 20px; font-size:13.5px; font-weight:700; cursor:pointer; font-family:inherit; transition:transform 0.15s,opacity 0.15s; display:flex; align-items:center; gap:7px; }
    .aaf-btn-primary:hover { opacity:0.92; transform:translateY(-1px); }
    .aaf-btn-primary:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
    .aaf-btn-ghost { background:var(--aaf-soft); color:var(--aaf-fg); border:1px solid var(--aaf-bd); border-radius:11px; padding:10px 18px; font-size:13.5px; font-weight:700; cursor:pointer; font-family:inherit; transition:background 0.15s; }
    .aaf-btn-ghost:hover { background:var(--aaf-bd); }
    .aaf-error { padding:10px 14px; border-radius:10px; background:#fee2e2; color:#b91c1c; font-size:13px; font-weight:600; margin-top:12px; }
    @media (max-width:600px) {
      .aaf-grid { grid-template-columns:1fr !important; }
      .aaf-role-grid { grid-template-columns:1fr !important; }
    }
  `

  return (
    <>
      <style>{css}</style>
      <div className="aaf-root aaf-card">

        {/* Collapsible header */}
        <div className="aaf-header" onClick={() => setOpen(v => !v)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="aaf-icon-wrap">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800 }}>Add New Administrator</div>
              <div style={{ fontSize: 12, color: 'var(--aaf-muted)' }}>Create a new admin account</div>
            </div>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--aaf-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}
          >
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </div>

        {/* Form body */}
        {open && (
          <div className="aaf-body">
            <div className="aaf-grid">

              {/* Display Name */}
              <label>
                <div className="aaf-label">Display Name</div>
                <input
                  className="aaf-input"
                  placeholder="e.g. Ahmad Al-Hassan"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </label>

              {/* Email */}
              <label>
                <div className="aaf-label">Email</div>
                <input
                  className="aaf-input"
                  type="email"
                  placeholder="e.g. ahmad@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </label>

              {/* Phone */}
              <label>
                <div className="aaf-label">Phone Number</div>
                <input
                  className="aaf-input"
                  placeholder="e.g. 0791234567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </label>

              {/* Batch */}
              <label>
                <div className="aaf-label">Batch</div>
                <select className="aaf-input" value={batch} onChange={e => setBatch(e.target.value)}>
                  <option value="">Select batch (optional)</option>
                  {batches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>

              {/* Password */}
              <label>
                <div className="aaf-label">Password</div>
                <div className="aaf-pw-wrap">
                  <input
                    className="aaf-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button type="button" className="aaf-pw-eye" onClick={() => setShowPassword(v => !v)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {showPassword
                        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                      }
                    </svg>
                  </button>
                </div>
              </label>

              {/* Role */}
              <div>
                <div className="aaf-label">Role</div>
                <div className="aaf-role-grid">
                  {(Object.keys(roleMeta) as Role[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      className={`aaf-role-btn${role === r ? ' active' : ''}`}
                      onClick={() => setRole(r)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24"
                        fill={r === 'super_admin' ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth={r === 'super_admin' ? '1' : '2'}
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d={roleMeta[r].icon}/>
                      </svg>
                      {roleMeta[r].label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Super Admin warning */}
            {role === 'super_admin' && (
              <div className="aaf-warning">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--aaf-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span className="aaf-warning-text">Super Admin has full access to all platform features and settings.</span>
              </div>
            )}

            {/* Error message */}
            {errorMsg && <div className="aaf-error">{errorMsg}</div>}

            {/* Actions */}
            <div className="aaf-actions">
              <button className="aaf-btn-primary" onClick={handleCreate} disabled={disabled}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                {loading ? 'Creating...' : 'Create Admin'}
              </button>
              <button className="aaf-btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}