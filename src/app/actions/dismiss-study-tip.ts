'use server'
// src/app/actions/dismiss-study-tip.ts

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function dismissStudyTip(tipId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('study_tips')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', tipId)
    .eq('user_id', user.id)   // safety: user can only dismiss their own tips

  revalidatePath('/dashboard')
}