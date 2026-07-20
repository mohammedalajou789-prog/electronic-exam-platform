export const runtime = 'nodejs'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: currentAdmin } = await supabase
      .from('admins').select('role').eq('id', user.id).single()
    if (currentAdmin?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admins can create new admins.' }, { status: 403 })
    }

    const { display_name, email, phone, batch, password, role } = await req.json()

    if (!display_name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 })
    }

    const { createClient } = await import('@supabase/supabase-js')
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name },
    })

    if (createError || !newUser.user) {
      return NextResponse.json({ error: createError?.message || 'Failed to create user.' }, { status: 400 })
    }

    const newUserId = newUser.user.id

    const { error: adminError } = await adminClient.from('admins').insert({
      id: newUserId,
      user_id: newUserId,
      display_name,
      email,
      phone: phone || null,
      batch: batch || null,
      role: role || 'admin',
    })

    if (adminError) {
      await adminClient.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: adminError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}