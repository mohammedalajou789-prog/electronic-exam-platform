'use client'
// src/components/dashboard/WrongQuestionsClient.tsx
//
// Wrong-questions list. Rendering lives in ReviewQuestionList (shared with Bookmarks).
// Each question can be removed individually. Removing only takes it off this list:
// accuracy and the solved / skipped counts are unaffected, and the question comes
// back the next time it is answered wrong.

import { createClient } from '@/lib/supabase/client'
import ReviewQuestionList, { type ReviewItem } from '@/components/dashboard/ReviewQuestionList'

interface Props {
  /** Each item's id is the question id */
  questions: ReviewItem[]
}

export default function WrongQuestionsClient({ questions }: Props) {
  async function handleDelete(item: ReviewItem): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.rpc('remove_from_wrong_list', { p_question_id: item.question_id })

    if (error) {
      console.error('Could not remove wrong question:', error)
      return false
    }
    return true
  }

  return <ReviewQuestionList items={questions} variant="wrong" onRemove={handleDelete} />
}