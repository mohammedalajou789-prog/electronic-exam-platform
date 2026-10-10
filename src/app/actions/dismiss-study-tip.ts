'use server'
// src/app/actions/dismiss-study-tip.ts

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function dismissStudyTip(tipId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  // getClaims() checks the session locally with the project's signing key (no Auth server call)
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
  if (!userId) return

  await supabase
    .from('study_tips')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', tipId)
    .eq('user_id', userId)   // safety: user can only dismiss their own tips

  revalidatePath('/dashboard')
}