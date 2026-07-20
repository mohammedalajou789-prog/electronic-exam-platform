'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Library,
  Upload,
  PenLine,
  Flag,
  BarChart3,
  Users,
  LogOut,
  Crown,
} from 'lucide-react'

interface Props {
  role: 'admin' | 'super_admin' | 'leader'
}

export default function AdminSidebar({ role }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const isSuperAdmin = role === 'super_admin'
  const isLeader = role === 'leader'
  const isAdmin = role === 'admin'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  function isActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const allItems = [
    { label: 'Dashboard',      href: '/admin',                icon: <LayoutDashboard className="h-4 w-4" />, roles: ['super_admin', 'admin', 'leader'] },
    { label: 'Exams',          href: '/admin/exams',          icon: <BookOpen className="h-4 w-4" />,        roles: ['super_admin', 'admin', 'leader'] },
    { label: 'Questions',      href: '/admin/questions',      icon: <FileText className="h-4 w-4" />,        roles: ['super_admin', 'admin', 'leader'] },
    { label: 'Content',        href: '/admin/content',        icon: <Library className="h-4 w-4" />,         roles: ['super_admin', 'admin', 'leader'] },
    { label: 'Bulk Import',    href: '/admin/import',         icon: <Upload className="h-4 w-4" />,          roles: ['super_admin', 'admin', 'leader'] },
    { label: 'Manual Import',  href: '/admin/manual-import',  icon: <PenLine className="h-4 w-4" />,         roles: ['super_admin', 'admin', 'leader'] },
    { label: 'Reports',        href: '/admin/reports',        icon: <Flag className="h-4 w-4" />,            roles: ['super_admin', 'admin', 'leader'] },
    { label: 'Analytics',      href: '/admin/analytics',      icon: <BarChart3 className="h-4 w-4" />,       roles: ['super_admin', 'admin', 'leader'] },
    { label: 'Administrators', href: '/admin/administrators',  icon: <Users className="h-4 w-4" />,           roles: ['super_admin'] },
  ]

  const navItems = allItems.filter(item => item.roles.includes(role))

  const roleLabel = isSuperAdmin ? 'Super Admin' : isLeader ? 'Leader' : 'Admin'
  const roleBadgeColor = isSuperAdmin
    ? 'text-yellow-600'
    : isLeader
    ? 'text-purple-600'
    : 'text-muted-foreground'

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border/60 bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border/60 px-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <BookOpen className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold">Electronic</p>
          <p className={`text-xs font-semibold ${roleBadgeColor}`}>
            {roleLabel}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {item.icon}
                {item.label}
                {item.label === 'Administrators' && (
                  <Crown className="ml-auto h-3 w-3 text-yellow-500" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border/60 p-3 space-y-1">
        <Link
          href="/"
          target="_blank"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LayoutDashboard className="h-4 w-4" />
          Student Home
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  )
}

