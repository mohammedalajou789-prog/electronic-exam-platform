'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { BookOpen, Plus, Search, X } from 'lucide-react'

interface Exam {
  id: string
  title: string
  exam_type: string
  calendar_year: number | null
  question_count: number
  status: string
  batch: {
    name: string
    subject: {
      name: string
      semester: {
        name: string
        academic_year: {
          name: string
        }
      } | null
      direct_year: {
        name: string
      } | null
    }
  } | null
  doctor: { name: string } | null
}

interface Props {
  exams: Exam[]
  academicYears: string[]
  semesters: string[]
  batches: string[]
}

export default function ExamsClientPage({ exams, academicYears, semesters, batches }: Props) {
  const [search, setSearch] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('')

  const filtered = useMemo(() => {
    return exams.filter((exam) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subjectAny = exam.batch?.subject as any
      const year = String(
        subjectAny?.semester?.academic_year?.name ||
        subjectAny?.direct_year?.name ||
        ''
      )
        ?? exam.batch?.subject?.direct_year?.name
        ?? ''
      const semester = exam.batch?.subject?.semester?.name ?? ''
      const batch = exam.batch?.name ?? ''
      const subject = exam.batch?.subject?.name ?? ''
      const title = exam.title ?? ''

      const matchSearch =
        search === '' ||
        title.toLowerCase().includes(search.toLowerCase()) ||
        subject.toLowerCase().includes(search.toLowerCase())

      const matchYear = selectedYear === '' || year === selectedYear
      const matchSemester = selectedSemester === '' || semester === selectedSemester
      const matchBatch = selectedBatch === '' || batch === selectedBatch

      return matchSearch && matchYear && matchSemester && matchBatch
    })
  }, [exams, search, selectedYear, selectedSemester, selectedBatch])

  const hasActiveFilters = search || selectedYear || selectedSemester || selectedBatch

  function clearFilters() {
    setSearch('')
    setSelectedYear('')
    setSelectedSemester('')
    setSelectedBatch('')
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Create Exam</h1>
          <p className="text-muted-foreground">
            Manage and create exams on the platform
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

      {/* Filters */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Filter Exams</p>

        <div className="flex flex-wrap gap-3">

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Academic Year */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[150px]"
          >
            <option value="">All Years</option>
            {academicYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Semester — hidden for clinical years */}
          {!['Fourth Year', 'Fifth Year', 'Sixth Year'].includes(selectedYear) && (
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[150px]"
            >
              <option value="">All Semesters</option>
              {semesters.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {/* Batch */}
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[150px]"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        {/* Results count */}
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {exams.length} exams
        </p>
      </div>

      {/* Exams Table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Exam Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Year · Semester
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
                {filtered.map((exam) => (
                  <tr key={exam.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium">{exam.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {exam.exam_type}{exam.calendar_year ? ` · ${exam.calendar_year}` : ''}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      <p>
                        {exam.batch?.subject?.semester?.academic_year?.name
                          ?? exam.batch?.subject?.direct_year?.name
                          ?? '—'}
                      </p>
                      <p className="text-xs">
                        {exam.batch?.subject?.semester?.name ?? ''}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {exam.batch?.subject?.name ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {exam.batch?.name ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {exam.doctor?.name ?? '—'}
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
            <h3 className="mb-2 text-lg font-semibold">No exams found</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first exam to get started'}
            </p>
            {!hasActiveFilters && (
              <Link
                href="/admin/exams/new"
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Create Exam
              </Link>
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted/50"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}