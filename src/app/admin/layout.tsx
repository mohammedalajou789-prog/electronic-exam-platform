import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminNavbar from '@/components/admin/AdminNavbar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // No user — show login page without sidebar
  if (!user) {
    redirect('/login')
  }

  // Get admin role
  const { data: admin } = await supabase
    .from('admins')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (admin?.role as 'admin' | 'super_admin' | 'leader') || 'admin'

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <AdminNavbar />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar role={role} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}