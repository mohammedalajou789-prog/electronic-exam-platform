import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BookOpen, Plus } from 'lucide-react'

async function getExams() {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('exams')
    .select(`
      *,
      batch:batches(
        name,
        subject:subjects(
          name,
          semester:semesters(
            name,
            academic_year:academic_years(name)
          )
        )
      ),
      doctor:doctors(name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching exams:', error)
    return []
  }

  return data || []
}

export default async function AdminExamsPage() {
  const exams = await getExams()

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exams</h1>
          <p className="text-muted-foreground">
            Manage all exams on the platform
          </p>
        </div>
        <Link
          href="/admin/exams/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Exam
        </Link>
      </div>

      {/* Exams Table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        {exams.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Exam Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Batch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Doctor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Questions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {exams.map((exam: any) => (
                  <tr key={exam.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium">{exam.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {exam.exam_type} {exam.calendar_year && `· ${exam.calendar_year}`}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {exam.batch?.subject?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {exam.batch?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {exam.doctor?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {exam.question_count}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        exam.status === 'published'
                          ? 'bg-green-50 text-green-700'
                          : exam.status === 'draft'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-gray-50 text-gray-700'
                      }`}>
                        {exam.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/exams/${exam.id}/edit`}
                        className="text-sm text-primary hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">No exams yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first exam to get started
            </p>
            <Link
              href="/admin/exams/new"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create Exam
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

