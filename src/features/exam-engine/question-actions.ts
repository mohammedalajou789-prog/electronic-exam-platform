// src/features/exam-engine/question-actions.ts
//
// Actions a student can take on a single question:
//   - Report an issue (goes through the submit_report database function,
//     which identifies the reporter from the session and prevents spam)
//   - Bookmark / remove a bookmark (signed-in students only)

import { createClient } from '@/lib/supabase/client'

export const REPORT_CATEGORIES = [
  { value: 'wrong_answer',      label: 'Wrong Answer' },
  { value: 'typo',              label: 'Typo or Spelling Error' },
  { value: 'wrong_explanation', label: 'Wrong Explanation' },
  { value: 'missing_image',     label: 'Missing Image' },
  { value: 'wrong_image',       label: 'Wrong Image' },
  { value: 'wrong_chapter',     label: 'Wrong Chapter' },
  { value: 'duplicate',         label: 'Duplicate Question' },
  { value: 'other',             label: 'Other' },
] as const

export const MAX_REPORT_DESCRIPTION_LENGTH = 1000

/**
 * Sends a report about a question. Works for guests and signed-in students.
 * Throws an Error with a student-friendly message if it fails.
 */
export async function submitReport(
  questionId: string,
  category: string,
  description: string
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('submit_report', {
    p_question_id: questionId,
    p_category: category,
    p_description: description.trim() || null,
  })

  if (error) {
    console.error('submit_report failed:', error.message)
    if (error.message.includes('Too many reports')) {
      throw new Error('You have sent many reports recently. Please try again later.')
    }
    throw new Error('Could not send the report. Please try again.')
  }
}

/** Returns which of the given questions the student has bookmarked. */
export async function loadBookmarkedIds(userId: string, questionIds: string[]): Promise<Set<string>> {
  if (questionIds.length === 0) return new Set()

  const supabase = createClient()
  const { data, error } = await supabase
    .from('bookmarks')
    .select('question_id')
    .eq('user_id', userId)
    .in('question_id', questionIds)

  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((row: { question_id: string }) => row.question_id))
}

/** Adds or removes a bookmark. Throws if it could not be saved. */
export async function setBookmark(userId: string, questionId: string, isBookmarked: boolean): Promise<void> {
  const supabase = createClient()

  const { error } = isBookmarked
    ? await supabase
        .from('bookmarks')
        .upsert(
          { user_id: userId, question_id: questionId },
          { onConflict: 'user_id,question_id', ignoreDuplicates: true }
        )
    : await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('question_id', questionId)

  if (error) throw new Error(error.message)
}
