export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSuperAdmin } from '@/lib/auth/requireSuperAdmin'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const auth = await requireSuperAdmin()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: authData, error: authError } = await adminSupabase.auth.admin.listUsers()
    if (authError) {
      return NextResponse.json({ error: 'Failed to load administrators' }, { status: 500 })
    }

    const { data: adminRecords, error: adminError } = await adminSupabase
      .from('admins')
      .select('*')
      .order('created_at', { ascending: false })

    if (adminError) {
      return NextResponse.json({ error: 'Failed to load administrators' }, { status: 500 })
    }

    const admins = (adminRecords || []).map(a => {
      const authUser = (authData?.users || []).find(u => u.id === a.id)
      return {
        id: a.id,
        role: a.role,
        created_at: a.created_at,
        email: authUser?.email || '',
        display_name: authUser?.user_metadata?.display_name || '',
        phone: authUser?.user_metadata?.phone || '',
      }
    })

    return NextResponse.json({ admins })

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}