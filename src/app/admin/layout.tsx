import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminLayoutClient from '@/components/admin/AdminLayoutClient'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Use select('*') to avoid errors if specific columns don't exist
  const { data: admin } = await supabase
    .from('admins')
    .select('*')
    .eq('id', user.id)
    .single()

  const role = (admin?.role as 'admin' | 'super_admin' | 'leader') || 'admin'

  // Safely read optional columns — won't crash if they don't exist in DB
  const adminRecord = admin as Record<string, unknown> | null
  const userName  = (adminRecord?.['display_name'] as string | undefined)
                    || (adminRecord?.['full_name'] as string | undefined)
                    || (adminRecord?.['name'] as string | undefined)
                    || undefined
  const userEmail = user.email || undefined
  const userBatch = adminRecord?.['batch'] as string | undefined

  return (
    <AdminLayoutClient
      sidebar={
        <AdminSidebar
          role={role}
          userName={userName}
          userEmail={userEmail}
          userBatch={userBatch}
        />
      }
    >
      {children}
    </AdminLayoutClient>
  )
}