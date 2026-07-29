'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  role: 'admin' | 'super_admin' | 'leader'
  userName?: string
  userEmail?: string
  userBatch?: string
}

export default function AdminSidebar({ role, userName, userEmail, userBatch }: Props) {
  const pathname = usePathname()
  const isSuperAdmin = role === 'super_admin'
  const isLeader = role === 'leader'

  function isActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const allItems = [
    {
      label: 'Dashboard',
      href: '/admin',
      dotColor: '#ffffff',
      roles: ['super_admin', 'admin', 'leader'],
    },
    {
      label: 'Content',
      href: '/admin/content',
      dotColor: 'var(--accent-blue)',
      roles: ['super_admin', 'admin', 'leader'],
    },
    {
      label: 'Exams',
      href: '/admin/exams',
      dotColor: 'var(--accent-purple)',
      roles: ['super_admin', 'admin', 'leader'],
    },
    {
      label: 'Bulk Import',
      href: '/admin/import',
      dotColor: 'var(--accent-orange)',
      roles: ['super_admin', 'admin', 'leader'],
    },
    {
      label: 'Manual Import',
      href: '/admin/manual-import',
      dotColor: 'var(--accent-green)',
      roles: ['super_admin', 'admin', 'leader'],
    },
    {
      label: 'Reports',
      href: '/admin/reports',
      dotColor: 'var(--accent-orange)',
      roles: ['super_admin', 'admin', 'leader'],
    },
    {
      label: 'Analytics',
      href: '/admin/analytics',
      dotColor: 'var(--accent-blue)',
      roles: ['super_admin', 'admin', 'leader'],
    },
    {
      label: 'Administrators',
      href: '/admin/administrators',
      dotColor: '#eab308',
      roles: ['super_admin'],
    },
  ]

  const navItems = allItems.filter((item) => item.roles.includes(role))

  const roleLabel = isSuperAdmin ? 'Super Admin' : isLeader ? 'Leader' : 'Admin'

  const roleBadgeStyle: React.CSSProperties = isSuperAdmin
    ? {
        color: '#eab308',
        background: 'rgba(234,179,8,0.12)',
      }
    : isLeader
    ? {
        color: 'var(--accent-purple)',
        background: 'rgba(168,85,247,0.12)',
      }
    : {
        color: 'var(--fg-muted)',
        background: 'var(--bg-soft)',
      }

  return (
    <>
      <style>{`
        .adm-sidebar-new {
          --bg:            oklch(98% 0.006 55);
          --bg-elev:       oklch(100% 0 0);
          --bg-soft:       oklch(96% 0.009 55);
          --fg:            oklch(22% 0.02 50);
          --fg-muted:      oklch(46% 0.02 50);
          --bd:            oklch(89% 0.012 50);
          --clr-primary:   oklch(50% 0.19 25);
          --clr-soft:      oklch(94% 0.035 25);
          --shadow:        rgba(20,10,10,0.08);
          --accent-green:  #22c55e;
          --accent-blue:   #3b82f6;
          --accent-purple: #a855f7;
          --accent-orange: #f97316;
        }

        .dark .adm-sidebar-new {
          --bg:            oklch(18% 0.01 50);
          --bg-elev:       oklch(22% 0.012 50);
          --bg-soft:       oklch(20% 0.01 50);
          --fg:            oklch(92% 0.008 50);
          --fg-muted:      oklch(62% 0.015 50);
          --bd:            oklch(32% 0.015 50);
          --clr-primary:   oklch(68% 0.18 25);
          --clr-soft:      oklch(28% 0.06 25);
          --shadow:        rgba(0,0,0,0.35);
          --accent-green:  #4ade80;
          --accent-blue:   #60a5fa;
          --accent-purple: #c084fc;
          --accent-orange: #fb923c;
        }

        .adm-nav-link-new {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 12px;
          color: var(--fg-muted);
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
          font-family: inherit;
        }
        .adm-nav-link-new:hover {
          background: var(--bg-soft);
          color: var(--fg);
        }
        .adm-nav-link-new.active {
          background: var(--clr-primary);
          color: #fff;
        }

        .adm-scrollbar-new::-webkit-scrollbar { width: 8px; }
        .adm-scrollbar-new::-webkit-scrollbar-thumb {
          background: var(--bd);
          border-radius: 8px;
        }
      `}</style>

      <aside
        className="adm-sidebar-new adm-scrollbar-new"
        style={{
          width: 250,
          flexShrink: 0,
          background: 'var(--bg-elev)',
          borderRight: '1px solid var(--bd)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 18px 16px',
              borderBottom: '1px solid var(--bd)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src="/images/logo.jpg"
                alt="Medical Club"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg)' }}>
                  Electronic
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-muted)', fontWeight: 600 }}>
                  Exam Platform
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav
            style={{
              flex: '1 1 0%',
              overflowY: 'auto',
              padding: '14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`adm-nav-link-new${isActive(item.href) ? ' active' : ''}`}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 3,
                    flexShrink: 0,
                    background: isActive(item.href) ? '#ffffff' : item.dotColor,
                  }}
                />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Footer: User Profile Card + Logout */}
          <div
            style={{
              padding: 16,
              borderTop: '1px solid var(--bd)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* User avatar + name + role badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--clr-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
                  <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                </svg>
              </div>
              <div style={{ lineHeight: 1.3, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: 'var(--fg)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {userName || 'Electronic'}
                </div>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: 2,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 20,
                    ...roleBadgeStyle,
                  }}
                >
                  {roleLabel}
                </span>
              </div>
            </div>

            {/* Batch + Email info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {userBatch && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11.5,
                    color: 'var(--fg-muted)',
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Batch: {userBatch}
                </div>
              )}
              {userEmail && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11.5,
                    color: 'var(--fg-muted)',
                    minWidth: 0,
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M22 6c0-1.1-.9-2-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2z" />
                    <polyline points="22 6 12 13 2 6" />
                  </svg>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {userEmail}
                  </span>
                </div>
              )}
            </div>

            {/* Team */}
            <p
              style={{
                margin: '2px 0 0',
                paddingTop: 10,
                borderTop: '1px solid var(--bd)',
                fontSize: 9.5,
                color: 'var(--fg-muted)',
                textAlign: 'center',
                lineHeight: 1.6,
                direction: 'rtl',
              }}
            >
             Electronic Examination Platform Team              <br />
              Medical Club
            </p>

          </div>
        </div>
      </aside>
    </>
  )
}