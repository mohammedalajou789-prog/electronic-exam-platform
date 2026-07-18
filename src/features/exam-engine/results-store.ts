import { create } from 'zustand'
import type { QuestionResult } from '@/app/actions/save-exam-results'

interface ResultsState {
  examId: string | null
  examTitle: string
  results: QuestionResult[]
  totalTimeSeconds: number
  score: number
  total: number
  percentage: number
  savedAt: Date | null
  setResults: (data: {
    examId: string
    examTitle: string
    results: QuestionResult[]
    totalTimeSeconds: number
    score: number
    total: number
    percentage: number
  }) => void
  clearResults: () => void
}

export const useResultsStore = create<ResultsState>((set) => ({
  examId: null,
  examTitle: '',
  results: [],
  totalTimeSeconds: 0,
  score: 0,
  total: 0,
  percentage: 0,
  savedAt: null,

  setResults: (data) =>
    set({
      ...data,
      savedAt: new Date(),
    }),

  clearResults: () =>
    set({
      examId: null,
      examTitle: '',
      results: [],
      totalTimeSeconds: 0,
      score: 0,
      total: 0,
      percentage: 0,
      savedAt: null,
    }),
}))
