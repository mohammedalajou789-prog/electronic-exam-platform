import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, Search } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ exam?: string; chapter?: string; q?: string }>
}

async function getQuestions(examId?: string, chapter?: string, query?: string) {
  const supabase = await createServerSupabaseClient()

  let queryBuilder = supabase
    .from('questions')
    .select(`
      *,
      exam:exams(
        title,
        batch:batches(
          name,
          subject:subjects(name)
        )
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (examId) queryBuilder = queryBuilder.eq('exam_id', examId)
  if (chapter) queryBuilder = queryBuilder.eq('chapter', chapter)
  if (query) queryBuilder = queryBuilder.ilike('question_text', `%${query}%`)

  const { data } = await queryBuilder
  return data || []
}

async function getExams() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('exams')
    .select('id, title, batch:batches(name)')
    .is('deleted_at', null)
    .order('title')
  return data || []
}

export default async function QuestionsPage({ searchParams }: PageProps) {
  const { exam, chapter, q } = await searchParams
  const [questions, exams] = await Promise.all([
    getQuestions(exam, chapter, q),
    getExams(),
  ])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Questions</h1>
          <p className="text-muted-foreground">Browse and manage all questions</p>
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search questions..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <select
          name="exam"
          defaultValue={exam}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="">All Exams</option>
          {exams.map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.title} — {e.batch?.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Filter
        </button>
        {(exam || chapter || q) && (
          <Link
            href="/admin/questions"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Questions Table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">No questions found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or import questions via Bulk Import.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Question</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Exam</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Chapter</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Answer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {questions.map((question: any, index: number) => (
                  <tr key={question.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {question.question_order || index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium line-clamp-2 max-w-sm">
                        {question.question_text}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <p>{question.exam?.title}</p>
                      <p className="text-xs">{question.exam?.batch?.subject?.name}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {question.chapter && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {question.chapter}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-xs font-bold uppercase text-green-700">
                        {question.correct_answer}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/questions/${question.id}/edit`}
                        className="text-sm text-primary hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
              Showing {questions.length} questions
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

