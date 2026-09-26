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