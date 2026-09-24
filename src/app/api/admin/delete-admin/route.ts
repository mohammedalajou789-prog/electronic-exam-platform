export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSuperAdmin } from '@/lib/auth/requireSuperAdmin'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { adminId } = await request.json()

    if (!adminId || typeof adminId !== 'string') {
      return NextResponse.json({ error: 'adminId is required' }, { status: 400 })
    }

    if (adminId === auth.userId) {
      return NextResponse.json(
        { error: 'You cannot delete your own account.' },
        { status: 400 }
      )
    }

    const { data: target } = await adminSupabase
      .from('admins')
      .select('role')
      .eq('id', adminId)
      .maybeSingle()

    if (!target) {
      return NextResponse.json({ error: 'Administrator not found' }, { status: 404 })
    }

    if (target.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot delete a Super Admin account' },
        { status: 403 }
      )
    }

    await adminSupabase.from('admins').delete().eq('id', adminId)
    await adminSupabase.auth.admin.deleteUser(adminId)

    return NextResponse.json({ success: true })

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}