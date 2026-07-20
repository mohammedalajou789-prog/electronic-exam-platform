'use client'

import { useState } from 'react'
import { Eye, EyeOff, Crown, Shield, UserPlus } from 'lucide-react'

interface Props {
  batches: string[]
}

export default function AddAdminForm({ batches }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [batch, setBatch] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<'admin' | 'super_admin' | 'leader'>('admin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Convert email: mohammedalajou789@gmail.com → mohammedalajou789@examplatform.com
  function convertEmail(raw: string): string {
    const local = raw.split('@')[0]
    return `${local}@examplatform.com`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const adminEmail = convertEmail(email)

    const res = await fetch('/api/admin/create-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName.trim(),
        personal_email: email.trim(),
        email: adminEmail,
        phone: phone.trim(),
        batch: batch || null,
        password,
        role,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to create admin.')
      setLoading(false)
      return
    }

    setSuccess(`Admin created successfully! Login email: ${adminEmail}`)
    setDisplayName('')
    setEmail('')
    setPhone('')
    setBatch('')
    setPassword('')
    setRole('admin')
    setLoading(false)
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(p => !p)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <UserPlus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Add New Administrator</p>
            <p className="text-xs text-muted-foreground">Create a new admin account</p>
          </div>
        </div>
        <span className="text-muted-foreground text-sm">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="border-t border-border/60 p-6 space-y-5">

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-semibold mb-2">Display Name</label>
              <input type="text" placeholder="e.g. Ahmad Al-Hassan" value={displayName}
                onChange={e => setDisplayName(e.target.value)} required
                className="w-full rounded-lg border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-2">Email</label>
              <input type="email" placeholder="e.g. ahmad@gmail.com" value={email}
                onChange={e => setEmail(e.target.value)} required
                className="w-full rounded-lg border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              {email && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Login email: <span className="font-semibold text-primary">{convertEmail(email)}</span>
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold mb-2">Phone Number</label>
              <input type="tel" placeholder="e.g. 0791234567" value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            {/* Batch */}
            <div>
              <label className="block text-sm font-semibold mb-2">Batch</label>
              <select value={batch} onChange={e => setBatch(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Select batch (optional)</option>
                {batches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-2">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="At least 6 characters"
                  value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full rounded-lg border border-border/60 bg-background px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-semibold mb-2">Role</label>
              <div className="flex gap-3 flex-wrap">
                <button type="button" onClick={() => setRole('admin')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                    role === 'admin' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border/60 hover:bg-muted/30'
                  }`}>
                  <Shield className="h-4 w-4" /> Admin
                </button>
                <button type="button" onClick={() => setRole('leader')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                    role === 'leader' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-border/60 hover:bg-muted/30'
                  }`}>
                  <Shield className="h-4 w-4" /> Leader
                </button>
                <button type="button" onClick={() => setRole('super_admin')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                    role === 'super_admin' ? 'border-red-500 bg-red-50 text-red-700' : 'border-border/60 hover:bg-muted/30'
                  }`}>
                  <Crown className="h-4 w-4" /> Super Admin
                </button>
              </div>
              {role === 'super_admin' && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                  ⚠️ Warning: Super Admin has full access to all platform features and settings.
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              ✓ {success}
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-border/40">
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              <UserPlus className="h-4 w-4" />
              {loading ? 'Creating...' : 'Create Admin'}
            </button>
            <button type="button" onClick={() => setIsOpen(false)}
              className="rounded-lg border border-border/60 px-5 py-2.5 text-sm font-medium hover:bg-muted/30">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

