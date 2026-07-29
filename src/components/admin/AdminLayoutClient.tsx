'use client'

import { useState } from 'react'
import AdminNavbar from '@/components/admin/AdminNavbar'

interface Props {
  sidebar: React.ReactNode
  children: React.ReactNode
}

export default function AdminLayoutClient({ sidebar, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
        color: 'var(--fg)',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Sidebar — hidden when collapsed */}
      <div
        style={{
          width: collapsed ? 0 : 250,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.25s ease',
          borderRight: collapsed ? 'none' : '1px solid var(--bd)',
        }}
      >
        {sidebar}
      </div>

      {/* Main area: topbar + content */}
      <div
        style={{
          flex: '1 1 0%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <AdminNavbar
          onToggleSidebar={() => setCollapsed((c) => !c)}
          sidebarCollapsed={collapsed}
        />

        <main
          style={{
            flex: '1 1 0%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}