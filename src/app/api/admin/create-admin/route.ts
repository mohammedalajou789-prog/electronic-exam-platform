export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSuperAdmin } from '@/lib/auth/requireSuperAdmin'

const ASSIGNABLE_ROLES = ['admin', 'leader'] as const

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdmin()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { display_name, email, phone, batch, password, role } = body

    if (!display_name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required.' },
        { status: 400 }
      )
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    const requestedRole = role || 'admin'
    if (!ASSIGNABLE_ROLES.includes(requestedRole)) {
      return NextResponse.json(
        { error: 'Super Admin accounts must be assigned directly in Supabase.' },
        { status: 400 }
      )
    }

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
      return NextResponse.json(
        { error: createError?.message || 'Failed to create user.' },
        { status: 400 }
      )
    }

    const newUserId = newUser.user.id

    const { error: adminError } = await adminClient.from('admins').insert({
      id: newUserId,
      user_id: newUserId,
      display_name,
      email,
      phone: phone || null,
      batch: batch || null,
      role: requestedRole,
    })

    if (adminError) {
      await adminClient.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: 'Failed to create administrator.' }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}