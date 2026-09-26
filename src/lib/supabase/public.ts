import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client for PUBLIC academic content only:
 * academic years, semesters, subjects, batches and published exams.
 *
 * It never reads cookies, so it always acts as a guest (anon role, RLS applies).
 * Because no cookies are read, Next.js is allowed to cache pages that use it.
 *
 * Do NOT use it for anything user-specific
 * (bookmarks, progress, dashboard, admin) — use createServerSupabaseClient instead.
 */
export function createPublicSupabaseClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}

/**
 * Stops rendering when a Supabase query fails (network problem, database down, etc.).
 *
 * Why this matters for cached pages: without it, a failed query looks like "no data",
 * and an empty page or a 404 would be cached and shown to every student for up to 5 minutes.
 * Throwing instead tells Next.js to keep serving the last good cached version and try again later.
 *
 * The message is only written to the server logs; Next.js never shows it to students.
 */
export function assertQuerySucceeded(error: { message: string } | null, queryName: string): void {
  if (error) {
    throw new Error(`Supabase query failed (${queryName}): ${error.message}`)
  }
}