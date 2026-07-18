export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Get all auth users
    const { data: authData, error: authError } = await adminSupabase.auth.admin.listUsers()
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Get all admin records
    const { data: adminRecords, error: adminError } = await adminSupabase
      .from('admins')
      .select('*')
      .order('created_at', { ascending: false })

    if (adminError) {
      return NextResponse.json({ error: adminError.message }, { status: 500 })
    }

    // Merge auth users with admin records
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

  } catch (error) {
    console.error('List admins error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}