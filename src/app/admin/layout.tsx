import { createServerSupabaseClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // No user — show login page without sidebar
  if (!user) {
    return <>{children}</>
  }

  // Get admin role
  const { data: admin } = await supabase
    .from('admins')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (admin?.role as 'admin' | 'super_admin' | 'leader') || 'admin'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar role={role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

