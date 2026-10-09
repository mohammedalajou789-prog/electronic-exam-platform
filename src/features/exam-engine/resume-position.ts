// src/features/exam-engine/resume-position.ts
//
// Where "Continue" takes the student: the first unanswered question from the
// position where they left, wrapping around to the start of the exam. If every
// question is answered, the saved position is kept.
// Used by the prep page ("Next: question N") and by the exam screen, so both agree.

/**
 * @param questionIds   the attempt's questions, in exam order
 * @param isAnswered    true for a question that already has an answer
 * @param savedIndex    the position saved on the attempt (0-based)
 * @returns the 0-based index to continue from
 */
export function resumeIndex(
  questionIds: string[],
  isAnswered: (questionId: string) => boolean,
  savedIndex: number
): number {
  if (questionIds.length === 0) return 0
  const start = Math.min(Math.max(savedIndex, 0), questionIds.length - 1)

  for (let i = start; i < questionIds.length; i++) {
    if (!isAnswered(questionIds[i])) return i
  }
  for (let i = 0; i < start; i++) {
    if (!isAnswered(questionIds[i])) return i
  }
  return start
}