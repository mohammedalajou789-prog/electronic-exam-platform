import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AddAdminForm from '@/components/admin/AddAdminForm'
import DeleteAdminButton from '@/components/admin/DeleteAdminButton'
import { Users, Crown, Shield } from 'lucide-react'

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
    if (admin?.role !== 'super_admin') {
      redirect('/admin')
    }
  }

  const [admins, batches] = await Promise.all([getAdministrators(), getBatches()])

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold">Administrators</h1>
        <p className="text-muted-foreground">Manage admin accounts and roles</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Admins</p>
              <p className="mt-1 text-3xl font-bold">{admins.length}</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-3">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Super Admins</p>
              <p className="mt-1 text-3xl font-bold">
                {admins.filter((a: any) => a.role === 'super_admin').length}
              </p>
            </div>
            <div className="rounded-lg bg-yellow-50 p-3">
              <Crown className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Regular Admins</p>
              <p className="mt-1 text-3xl font-bold">
                {admins.filter((a: any) => a.role === 'admin').length}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <AddAdminForm batches={batches} />

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border/60 px-6 py-4">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Admin Accounts</h2>
        </div>

        {admins.length > 0 ? (
          <div className="divide-y divide-border/60">
            {admins.map((admin: any) => (
              <div key={admin.id} className="flex items-center justify-between px-6 py-4 flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {(admin.display_name || admin.email || 'A')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{admin.display_name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{admin.email}</p>
                    {admin.phone && <p className="text-xs text-muted-foreground">{admin.phone}</p>}
                    {admin.batch && <p className="text-xs text-muted-foreground">Batch: {admin.batch}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    admin.role === 'super_admin'
                      ? 'bg-yellow-100 text-yellow-700'
                      : admin.role === 'leader'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {admin.role === 'super_admin' ? <><Crown className="h-3 w-3" /> Super Admin</>
                      : admin.role === 'leader' ? <><Shield className="h-3 w-3" /> Leader</>
                      : <><Shield className="h-3 w-3" /> Admin</>
                    }
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(admin.created_at).toLocaleDateString()}
                  </span>
                  {admin.role !== 'super_admin' && (
                    <DeleteAdminButton adminId={admin.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">No administrators found</h3>
            <p className="text-sm text-muted-foreground">Add your first admin using the form above.</p>
          </div>
        )}
      </div>
    </div>
  )
}

