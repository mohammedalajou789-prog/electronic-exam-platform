import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPER_ADMIN_ONLY_PATHS = [
  '/admin/administrators',
  '/api/admin/create-admin',
  '/api/admin/delete-admin',
  '/api/admin/list-admins',
]

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
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
          // Pass refreshed session cookies to both the page and the browser
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Verifies the session locally with the project's public signing key.
  // With asymmetric JWT signing keys this needs no network call (much faster than getUser).
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null

  const isAdminArea = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  if (isAdminArea) {
    if (!userId) {
      return denyAdmin(request, pathname)
    }

    const { data: admin } = await supabase
      .from('admins')
      .select('role')
      .or(`id.eq.${userId},user_id.eq.${userId}`)
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

  if (pathname.startsWith('/dashboard') && !userId) {
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
