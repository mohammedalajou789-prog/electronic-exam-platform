import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Pages regular admins (non-super) are allowed to access
const ADMIN_ALLOWED_PATHS = [
  '/admin/import',
  '/admin/manual-import',
]

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Allow admin login page without authentication
  if (pathname === '/admin/login') {
    return supabaseResponse
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    const { data: admin } = await supabase
      .from('admins')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!admin) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // Regular admin — only allowed on import pages
    if (admin.role === 'admin') {
      const isAllowed = ADMIN_ALLOWED_PATHS.some(p => pathname.startsWith(p))
      if (!isAllowed) {
        return NextResponse.redirect(new URL('/admin/import', request.url))
      }
    }
  }

  // Protect /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*'],
}