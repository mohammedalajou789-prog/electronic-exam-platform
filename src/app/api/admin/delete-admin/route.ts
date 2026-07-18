import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(request: NextRequest) {
  try {
    const { adminId } = await request.json()

    if (!adminId) {
      return NextResponse.json({ error: 'adminId is required' }, { status: 400 })
    }

    // Verify caller is super_admin
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (token) {
      const { data: { user } } = await adminSupabase.auth.getUser(token)
      if (user) {
        const { data: caller } = await adminSupabase
          .from('admins').select('role').eq('user_id', user.id).single()
        if (caller?.role !== 'super_admin') {
          return NextResponse.json({ error: 'Only Super Admins can delete admins.' }, { status: 403 })
        }
      }
    }

    const { data: admin } = await adminSupabase
      .from('admins')
      .select('role')
      .eq('id', adminId)
      .single()

    if (admin?.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot delete a Super Admin account' },
        { status: 403 }
      )
    }

    await adminSupabase.from('admins').delete().eq('id', adminId)
    await adminSupabase.auth.admin.deleteUser(adminId)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete admin error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}