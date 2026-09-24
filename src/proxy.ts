import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPER_ADMIN_ONLY_PATHS = [
  '/admin/administrators',
  '/api/admin/create-admin',
  '/api/admin/delete-admin',
  '/api/admin/list-admins',
]

export async function proxy(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request })
  const pathname = request.nextUrl.pathname

  if (pathname === '/admin/login') {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAdminArea = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  if (isAdminArea) {
    if (!user) {
      return denyAdmin(request, pathname)
    }

    const { data: admin } = await supabase
      .from('admins')
      .select('role')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

    if (!admin?.role) {
      return denyAdmin(request, pathname)
    }

    const needsSuperAdmin = SUPER_ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p))

    if (needsSuperAdmin && admin.role !== 'super_admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  if (pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

function denyAdmin(request: NextRequest, pathname: string) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login/admin', request.url))
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/dashboard/:path*'],
}