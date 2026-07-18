import type { Question, Exam, Batch, Doctor, Subject } from './database'

// ============================================================
// EXAM ENGINE TYPES
// ============================================================

export type ExamMode = 'interactive' | 'review' | 'pdf'

export interface ExamSettings {
  showAnswerImmediately: boolean
  randomizeQuestions: boolean
  randomizeAnswers: boolean
  timerEnabled: boolean
}

export interface ExamSession {
  examId: string
  mode: ExamMode
  settings: ExamSettings
  startedAt: Date
}

// ============================================================
// QUESTION NAVIGATION
// ============================================================

export type QuestionStatus =
  | 'unanswered'
  | 'answered'
  | 'flagged'
  | 'answered-flagged'

export interface QuestionNavigatorItem {
  index: number
  questionId: string
  status: QuestionStatus
  isBookmarked: boolean
  isCurrent: boolean
}

// ============================================================
// EXAM RESULTS
// ============================================================

export interface ExamResult {
  examId: string
  totalQuestions: number
  answeredQuestions: number
  correctAnswers: number
  incorrectAnswers: number
  skippedQuestions: number
  accuracy: number
  timeSpent: number
  answers: Record<string, string>
  chapterPerformance: ChapterPerformance[]
}

export interface ChapterPerformance {
  chapter: string
  total: number
  correct: number
  incorrect: number
  accuracy: number
}

// ============================================================
// EXTENDED TYPES (with joined data)
// ============================================================

export interface ExamWithDetails extends Exam {
  batch: Batch
  doctor: Doctor | null
  subject: Subject
}

export interface QuestionWithImages extends Question {
  question_images: Array<{
    id: string
    image_url: string
    caption: string | null
    display_order: number
  }>
}

export interface QuestionWithStats extends QuestionWithImages {
  question_statistics: {
    attempts: number
    correct_answers: number
    average_time: number
    bookmarks: number
  } | null
  isBookmarked?: boolean
  isFlagged?: boolean
  userAnswer?: string
}

// ============================================================
// CUSTOM EXAM BUILDER
// ============================================================

export interface CustomExamFilters {
  subjectId: string
  batchIds: string[]
  doctorIds: string[]
  chapters: string[]
  lectures: string[]
  questionCount: number
  randomizeQuestions: boolean
  randomizeAnswers: boolean
}