'use client'
// src/components/dashboard/BookmarksClient.tsx
//
// Bookmarks list. Rendering lives in ReviewQuestionList (shared with Wrong Questions).
// Removing a card deletes the row from the bookmarks table.

import { createClient } from '@/lib/supabase/client'
import ReviewQuestionList, { type ReviewItem } from '@/components/dashboard/ReviewQuestionList'

interface Props {
  questions: ReviewItem[]
  userId: string
}

export default function BookmarksClient({ questions, userId }: Props) {
  async function handleRemove(item: ReviewItem): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', item.id)
      .eq('user_id', userId)

    if (error) {
      console.error('Could not remove bookmark:', error)
      return false
    }
    return true
  }

  return <ReviewQuestionList items={questions} variant="bookmark" onRemove={handleRemove} />
}