'use client'
// src/components/dashboard/WrongQuestionsClient.tsx
//
// Wrong-questions list. Rendering lives in ReviewQuestionList (shared with Bookmarks).
// Each question can be deleted individually.
// Deletion only removes from the wrong_answers table — accuracy is unaffected.

import { createClient } from '@/lib/supabase/client'
import ReviewQuestionList, { type ReviewItem } from '@/components/dashboard/ReviewQuestionList'

interface Props {
  questions: ReviewItem[]
  userId: string
}

export default function WrongQuestionsClient({ questions, userId }: Props) {
  async function handleDelete(item: ReviewItem): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase
      .from('wrong_answers')
      .delete()
      .eq('id', item.id)
      .eq('user_id', userId)

    if (error) {
      console.error('Could not remove wrong question:', error)
      return false
    }
    return true
  }

  return <ReviewQuestionList items={questions} variant="wrong" onRemove={handleDelete} />
}