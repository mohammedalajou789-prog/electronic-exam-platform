export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================================
// ACADEMIC STRUCTURE
// ============================================================

export interface AcademicYear {
  id: string
  name: string
  display_order: number
  created_at: string
  updated_at: string
}

export interface Semester {
  id: string
  academic_year_id: string
  name: string
  display_order: number
  created_at: string
  updated_at: string
}

export interface Subject {
  id: string
  semester_id: string
  name: string
  description: string | null
  icon: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export interface Batch {
  id: string
  subject_id: string
  name: string
  description: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export interface Doctor {
  id: string
  name: string
  department: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// EXAMS
// ============================================================

export type ExamType = 'quiz' | 'midterm' | 'final' | 'practical' | 'mock' | 'custom'
export type TimerMode = 'none' | 'suggested' | 'strict'
export type ExamStatus = 'draft' | 'published' | 'archived'

export interface Exam {
  id: string
  batch_id: string
  doctor_id: string | null
  title: string
  calendar_year: number | null
  exam_type: ExamType | null
  description: string | null
  duration_minutes: number | null
  timer_mode: TimerMode
  status: ExamStatus
  question_count: number
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ============================================================
// QUESTIONS
// ============================================================

export type AnswerChoice = 'a' | 'b' | 'c' | 'd' | 'e'

export interface Question {
  id: string
  exam_id: string
  question_text: string
  question_order: number
  choice_a: string
  choice_b: string
  choice_c: string
  choice_d: string
  choice_e: string | null
  correct_answer: AnswerChoice
  explanation: string | null
  incorrect_explanation_a: string | null
  incorrect_explanation_b: string | null
  incorrect_explanation_c: string | null
  incorrect_explanation_d: string | null
  incorrect_explanation_e: string | null
  chapter: string | null
  lecture: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface QuestionImage {
  id: string
  question_id: string
  image_url: string
  caption: string | null
  display_order: number
  created_at: string
}

// ============================================================
// USER DATA
// ============================================================

export interface User {
  id: string
  email: string | null
  display_name: string | null
  avatar: string | null
  created_at: string
  last_login: string | null
}

export interface Bookmark {
  id: string
  user_id: string
  question_id: string
  created_at: string
}

export interface Flag {
  id: string
  user_id: string
  question_id: string
  created_at: string
}

export interface StudyProgress {
  id: string
  user_id: string
  exam_id: string
  current_question: number
  remaining_time: number | null
  answers_json: Record<string, string>
  flags_json: string[]
  completed: boolean
  started_at: string
  updated_at: string
}

// ============================================================
// REPORTS
// ============================================================

export type ReportCategory =
  | 'wrong_answer'
  | 'typo'
  | 'wrong_explanation'
  | 'missing_image'
  | 'wrong_image'
  | 'wrong_chapter'
  | 'duplicate'
  | 'other'

export type ReportStatus = 'new' | 'under_review' | 'resolved' | 'rejected'

export interface Report {
  id: string
  question_id: string
  reporter_user_id: string | null
  guest_identifier: string | null
  category: ReportCategory
  description: string | null
  status: ReportStatus
  assigned_admin: string | null
  resolved_by: string | null
  resolution_note: string | null
  created_at: string
  resolved_at: string | null
}

// ============================================================
// STATISTICS
// ============================================================

export interface QuestionStatistics {
  id: string
  question_id: string
  attempts: number
  correct_answers: number
  average_time: number
  bookmarks: number
  last_updated: string
}

export interface UserStatistics {
  id: string
  user_id: string
  questions_answered: number
  correct_answers: number
  incorrect_answers: number
  study_time: number
  completed_exams: number
  updated_at: string
}

// ============================================================
// ADMIN
// ============================================================

export type AdminRole = 'admin' | 'super_admin'

export interface Admin {
  id: string
  user_id: string | null
  role: AdminRole
  created_at: string
  last_login: string | null
}

export interface ActivityLog {
  id: string
  admin_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  description: string | null
  created_at: string
}

export interface BulkImport {
  id: string
  admin_id: string | null
  questions_imported: number
  warnings: number
  errors: number
  duration_seconds: number | null
  created_at: string
}