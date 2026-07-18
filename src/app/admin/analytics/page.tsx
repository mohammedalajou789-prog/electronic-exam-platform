import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  BarChart3, FileText, BookOpen, Flag,
  TrendingUp, Users, AlertCircle
} from 'lucide-react'

async function getAnalyticsData() {
  const supabase = await createServerSupabaseClient()

  const [
    { data: subjectStats },
    { data: mostReportedQuestions },
    { data: reportsByCategory },
    { data: recentImports },
    { count: totalStudents },
    { count: totalQuestions },
    { count: totalExams },
    { count: totalReports },
  ] = await Promise.all([

    // Questions per subject
    supabase.rpc('get_questions_per_subject'),

    // Most reported questions
    supabase
      .from('reports')
      .select('question_id, questions(question_text, exam:exams(title))')
      .not('question_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50),

    // Reports grouped by category
    supabase
      .from('reports')
      .select('category')
      .not('category', 'is', null),

    // Recent bulk imports
    supabase
      .from('bulk_imports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5),

    // Total students
    supabase.from('users').select('*', { count: 'exact', head: true }),

    // Total questions
    supabase.from('questions').select('*', { count: 'exact', head: true }).is('deleted_at', null),

    // Total exams
    supabase.from('exams').select('*', { count: 'exact', head: true }).is('deleted_at', null),

    // Total reports
    supabase.from('reports').select('*', { count: 'exact', head: true }),
  ])

  // Count reports by category
  const categoryCount: Record<string, number> = {}
  for (const r of reportsByCategory || []) {
    if (r.category) {
      categoryCount[r.category] = (categoryCount[r.category] || 0) + 1
    }
  }

  // Count most reported question IDs
  const questionReportCount: Record<string, number> = {}
  for (const r of mostReportedQuestions || []) {
    if (r.question_id) {
      questionReportCount[r.question_id] = (questionReportCount[r.question_id] || 0) + 1
    }
  }

  // Build top reported questions list
  const topReportedMap = new Map<string, { text: string; exam: string; count: number }>()
  for (const r of mostReportedQuestions || []) {
    if (!r.question_id) continue
    if (!topReportedMap.has(r.question_id)) {
      const q = r.questions as any
      topReportedMap.set(r.question_id, {
        text: q?.question_text || 'Unknown',
        exam: q?.exam?.title || 'Unknown',
        count: questionReportCount[r.question_id],
      })
    }
  }

  const topReported = Array.from(topReportedMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    subjectStats: subjectStats || [],
    topReported,
    categoryCount,
    recentImports: recentImports || [],
    totals: {
      students: totalStudents || 0,
      questions: totalQuestions || 0,
      exams: totalExams || 0,
      reports: totalReports || 0,
    },
  }
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData()

  const totalCategoryReports = Object.values(data.categoryCount).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Platform statistics and content quality overview
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Students</p>
              <p className="mt-1 text-3xl font-bold">{data.totals.students.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/40">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Questions</p>
              <p className="mt-1 text-3xl font-bold">{data.totals.questions.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-3">
              <FileText className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Exams</p>
              <p className="mt-1 text-3xl font-bold">{data.totals.exams.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/40">
              <BookOpen className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Reports</p>
              <p className="mt-1 text-3xl font-bold">{data.totals.reports.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-950/40">
              <Flag className="h-5 w-5 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Questions per Subject */}
        {data.subjectStats.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 px-6 py-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Questions per Subject</h2>
            </div>
            <div className="p-6 space-y-3">
              {(data.subjectStats as any[]).map((s: any) => {
                const max = Math.max(...(data.subjectStats as any[]).map((x: any) => x.question_count))
                const pct = max > 0 ? Math.round((s.question_count / max) * 100) : 0
                return (
                  <div key={s.subject_name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{s.subject_name}</span>
                      <span className="text-muted-foreground">
                        {s.question_count.toLocaleString()} questions
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Reports by Category */}
        {Object.keys(data.categoryCount).length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 px-6 py-4">
              <Flag className="h-5 w-5 text-orange-500" />
              <h2 className="font-semibold">Reports by Category</h2>
            </div>
            <div className="p-6 space-y-3">
              {Object.entries(data.categoryCount)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => {
                  const pct = totalCategoryReports > 0
                    ? Math.round((count / totalCategoryReports) * 100)
                    : 0
                  return (
                    <div key={category}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{formatCategory(category)}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-orange-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

      </div>

      {/* Most Reported Questions */}
      {data.topReported.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/60 px-6 py-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h2 className="font-semibold">Most Reported Questions</h2>
          </div>
          <div className="divide-y divide-border/60">
            {data.topReported.map((q, i) => (
              <div key={i} className="flex items-start justify-between px-6 py-4 gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2">{q.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{q.exam}</p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
                  {q.count} report{q.count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Imports */}
      {data.recentImports.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/60 px-6 py-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Recent Bulk Imports</h2>
          </div>
          <div className="divide-y divide-border/60">
            {data.recentImports.map((imp: any) => (
              <div key={imp.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium">
                    {imp.questions_imported} questions imported
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(imp.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {imp.warnings > 0 && (
                    <span className="rounded-full bg-yellow-50 px-2.5 py-1 text-yellow-700 dark:bg-yellow-950/40">
                      {imp.warnings} warnings
                    </span>
                  )}
                  {imp.errors > 0 && (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700 dark:bg-red-950/40">
                      {imp.errors} errors
                    </span>
                  )}
                  {imp.errors === 0 && imp.warnings === 0 && (
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700 dark:bg-green-950/40">
                      Clean
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

