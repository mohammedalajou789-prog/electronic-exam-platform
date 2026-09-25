// src/app/actions/save-exam-results.ts
//
// Saving exam results now happens answer by answer through
// src/features/exam-engine/attempt-client.ts and the attempt functions
// in the database. Only this type remains, because the results store uses it.

export interface QuestionResult {
  questionId: string
  selectedAnswer: string | null
  correctAnswer: string
  isBookmarked: boolean
  isFlagged: boolean
}