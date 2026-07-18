import { createClient } from '@supabase/supabase-js'

// This client uses the service role key which bypasses RLS.
// Never use this on the client side — server only.
export const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)