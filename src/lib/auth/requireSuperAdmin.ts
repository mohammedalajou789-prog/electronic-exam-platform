import { createServerSupabaseClient } from '@/lib/supabase/server'

export type AdminRole = 'admin' | 'leader' | 'super_admin'

export interface AuthResult {
  ok: boolean
  status: number
  error: string
  role: AdminRole | null
  userId: string | null
}

const DENIED: AuthResult = {
  ok: false,
  status: 403,
  error: 'Forbidden',
  role: null,
  userId: null,
}

/**
 * Reads the signed-in user from the request cookies and returns their admin role.
 * Fails closed: any missing session, missing record, or query error returns a denial.
 */
export async function getAdminRole(): Promise<AuthResult> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { ...DENIED, status: 401, error: 'Unauthorized' }
    }

    const { data: admin, error } = await supabase
      .from('admins')
      .select('role')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

    if (error || !admin?.role) {
      return DENIED
    }

    return {
      ok: true,
      status: 200,
      error: '',
      role: admin.role as AdminRole,
      userId: user.id,
    }
  } catch {
    return { ...DENIED, status: 500, error: 'Forbidden' }
  }
}

/** Allows only super_admin. Every other case is denied. */
export async function requireSuperAdmin(): Promise<AuthResult> {
  const result = await getAdminRole()

  if (!result.ok) return result

  if (result.role !== 'super_admin') {
    return { ...DENIED, error: 'Only Super Admins can perform this action.' }
  }

  return result
}