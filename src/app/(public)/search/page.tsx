import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search, FileText, BookOpen, User } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

async function searchContent(query: string) {
  if (!query || query.length < 2) return { questions: [], exams: [], subjects: [] }

  const supabase = await createServerSupabaseClient()

  const [{ data: questions }, { data: exams }, { data: subjects }] = await Promise.all([
    supabase
      .from('questions')
      .select(`
        id, question_text, chapter, lecture,
        exam:exams(
          id, title,
          batch:batches(
            name,
            subject:subjects(name)
          )
        )
      `)
      .ilike('question_text', `%${query}%`)
      .is('deleted_at', null)
      .limit(10),

    supabase
      .from('exams')
      .select(`
        id, title, exam_type, calendar_year,
        batch:batches(
          name,
          subject:subjects(
            name,
            semester:semesters(
              name,
              academic_year:academic_years(name)
            )
          )
        )
      `)
      .ilike('title', `%${query}%`)
      .eq('status', 'published')
      .is('deleted_at', null)
      .limit(5),

    supabase
      .from('subjects')
      .select('id, name, description')
      .ilike('name', `%${query}%`)
      .limit(5),
  ])

  return {
    questions: questions || [],
    exams: exams || [],
    subjects: subjects || [],
  }
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const query = q?.trim() || ''
  const results = query ? await searchContent(query) : { questions: [], exams: [], subjects: [] }
  const totalResults = results.questions.length + results.exams.length + results.subjects.length

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">

      {/* Search Header */}
      <div className="mb-8">
        <h1 className="mb-4 text-2xl font-bold">Search</h1>
        <form method="get" action="/search">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search questions, exams, subjects..."
              autoFocus
              className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </form>
      </div>

      {/* No query */}
      {!query && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="mb-2 text-lg font-semibold">Start searching</h2>
          <p className="text-sm text-muted-foreground">
            Search for questions, exams, subjects, or doctors
          </p>
        </div>
      )}

      {/* No results */}
      {query && totalResults === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="mb-2 text-lg font-semibold">No results found</h2>
          <p className="text-sm text-muted-foreground">
            No results for "<strong>{query}</strong>". Try a different keyword.
          </p>
        </div>
      )}

      {/* Results */}
      {query && totalResults > 0 && (
        <div className="space-y-8">
          <p className="text-sm text-muted-foreground">
            {totalResults} result{totalResults !== 1 ? 's' : ''} for "<strong>{query}</strong>"
          </p>

          {/* Subjects */}
          {results.subjects.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Subjects</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {results.subjects.length}
                </span>
              </div>
              <div className="space-y-2">
                {results.subjects.map((subject: any) => (
                  <div
                    key={subject.id}
                    className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
                  >
                    <p className="font-medium">{subject.name}</p>
                    {subject.description && (
                      <p className="text-sm text-muted-foreground">{subject.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Exams */}
          {results.exams.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Exams</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {results.exams.length}
                </span>
              </div>
              <div className="space-y-2">
                {results.exams.map((exam: any) => (
                  <div
                    key={exam.id}
                    className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
                  >
                    <p className="font-medium">{exam.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {exam.batch?.subject?.name} · {exam.batch?.name}
                      {exam.calendar_year && ` · ${exam.calendar_year}`}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Questions */}
          {results.questions.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Questions</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {results.questions.length}
                </span>
              </div>
              <div className="space-y-2">
                {results.questions.map((question: any) => (
                  <div
                    key={question.id}
                    className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
                  >
                    <p className="text-sm font-medium line-clamp-2">{question.question_text}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      {question.exam?.batch?.subject?.name && (
                        <span>{question.exam.batch.subject.name}</span>
                      )}
                      {question.exam?.title && (
                        <span>· {question.exam.title}</span>
                      )}
                      {question.chapter && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                          {question.chapter}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

