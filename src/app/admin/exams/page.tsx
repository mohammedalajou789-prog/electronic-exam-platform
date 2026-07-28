'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, ChevronRight, Search, X } from 'lucide-react'
import Link from 'next/link'

interface Exam {
  id: string
  title: string
  exam_type: string
  calendar_year: number | null
  question_count: number
  status: string
  academic_year: { name: string } | null
  batch: { name: string } | null
  batch_detail: { subject: { name: string; semester_id: string | null; year_id: string | null } | null } | null
  doctor: { name: string } | null
}

interface AcademicYear { id: string; name: string; is_clinical: boolean }
interface Semester { id: string; name: string; academic_year_id: string }

const CLINICAL_YEARS = ['Fourth Year', 'Fifth Year', 'Sixth Year']

export default function QuestionsPage() {
  const supabase = createClient()

  const [exams, setExams] = useState<Exam[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSemester, setFilterSemester] = useState('')
  const [filterBatch, setFilterBatch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    async function load() {
      const [examsRes, yearsRes, semsRes] = await Promise.all([
        supabase.from('exams').select(`
          id, title, exam_type, calendar_year, question_count, status,
          academic_year:academic_years(name),
          batch:batches(name),
          batch_detail:batches(subject:subjects(name, semester_id, year_id)),
          doctor:doctors(name)
        `).is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('academic_years').select('id, name, is_clinical').order('display_order'),
        supabase.from('semesters').select('id, name, academic_year_id').order('display_order'),
      ])
      setExams((examsRes.data ?? []) as any)
      setAcademicYears(yearsRes.data ?? [])
      setSemesters(semsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const preClinicalYears = academicYears.filter(y => !y.is_clinical)
  const clinicalYears = academicYears.filter(y => y.is_clinical)
  const isClinicalSelected = CLINICAL_YEARS.includes(
    academicYears.find(y => y.id === filterYear)?.name ?? ''
  )

  const batches = useMemo(() => {
    return [...new Set(exams.map(e => (e.batch as any)?.name).filter(Boolean))] as string[]
  }, [exams])

  const hasFilters = search || filterYear || filterSemester || filterBatch || filterStatus

  function clearFilters() {
    setSearch(''); setFilterYear(''); setFilterSemester('')
    setFilterBatch(''); setFilterStatus('')
  }

  // فلترة الامتحانات
  const filteredExams = useMemo(() => {
    return exams.filter(exam => {
      const yearName = (exam.academic_year as any)?.name ?? ''
      const batchName = (exam.batch as any)?.name ?? ''
      const subjectName = (exam.batch_detail as any)?.subject?.name ?? ''
      const title = exam.title ?? ''

      const matchSearch = !search ||
        title.toLowerCase().includes(search.toLowerCase()) ||
        subjectName.toLowerCase().includes(search.toLowerCase())

      const matchYear = !filterYear ||
        academicYears.find(y => y.id === filterYear)?.name === yearName

      const matchBatch = !filterBatch || batchName === filterBatch
      const matchStatus = !filterStatus || exam.status === filterStatus

      return matchSearch && matchYear && matchBatch && matchStatus
    })
  }, [exams, search, filterYear, filterSemester, filterBatch, filterStatus, academicYears])

  // تجميع الامتحانات حسب السنة والفصل
  function getExamsForSemester(semesterId: string) {
    return filteredExams.filter(e => {
      const subject = (e.batch_detail as any)?.subject
      return subject?.semester_id === semesterId
    })
  }

  function getExamsForYear(yearId: string) {
    const yearName = academicYears.find(y => y.id === yearId)?.name ?? ''
    return filteredExams.filter(e => (e.academic_year as any)?.name === yearName)
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-12 bg-muted rounded" />
        {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
      </div>
    )
  }

  function ExamCard({ exam }: { exam: Exam }) {
    return (
      <Link
        href={`/admin/questions/${exam.id}/edit`}
        className="flex items-center gap-4 rounded-xl border border-border/60 bg-card px-5 py-4 shadow-sm hover:bg-muted/20 transition-colors group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{exam.title}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              exam.status === 'published' ? 'bg-green-50 text-green-700' :
              exam.status === 'draft' ? 'bg-yellow-50 text-yellow-700' :
              'bg-gray-50 text-gray-700'
            }`}>{exam.status}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="capitalize">{exam.exam_type}{exam.calendar_year ? ` · ${exam.calendar_year}` : ''}</span>
            {(exam.batch_detail as any)?.subject?.name && <span>{(exam.batch_detail as any).subject.name}</span>}
            {(exam.batch as any)?.name && <span>Batch: {(exam.batch as any).name}</span>}
            {(exam.doctor as any)?.name && <span>Dr. {(exam.doctor as any).name}</span>}
            <span>{exam.question_count} questions</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
      </Link>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Exams</h1>
        <p className="text-muted-foreground">Browse and manage all exams and their questions</p>
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
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Academic Year */}
          <select
            value={filterYear}
            onChange={e => { setFilterYear(e.target.value); setFilterSemester('') }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[150px]"
          >
            <option value="">All Years</option>
            {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>

          {/* Semester — hidden for clinical years */}
          {filterYear && !isClinicalSelected && (
            <select
              value={filterSemester}
              onChange={e => setFilterSemester(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[150px]"
            >
              <option value="">All Semesters</option>
              {semesters.filter(s => s.academic_year_id === filterYear).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Batch */}
          <select
            value={filterBatch}
            onChange={e => setFilterBatch(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[130px]"
          >
            <option value="">All Batches</option>
            {batches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[130px]"
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          {/* Clear */}
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
              <X className="h-4 w-4" /> Clear
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filteredExams.length} of {exams.length} exams
        </p>
      </div>

      {/* Exams — grouped by year and semester */}
      {filteredExams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-border/60 bg-card">
          <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-2 text-lg font-semibold">No exams found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-4 flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted/50">
              <X className="h-4 w-4" /> Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">

          {/* Pre-Clinical Years */}
          {preClinicalYears
            .filter(year => !filterYear || filterYear === year.id)
            .map(year => {
              const yearSemesters = semesters
                .filter(s => s.academic_year_id === year.id)
                .filter(s => !filterSemester || filterSemester === s.id)
              const hasExams = yearSemesters.some(sem => getExamsForSemester(sem.id).length > 0)
              if (!hasExams) return null
              return (
                <div key={year.id} className="space-y-4">
                  <h2 className="text-base font-bold border-b border-border/60 pb-2">{year.name}</h2>
                  {yearSemesters.map(sem => {
                    const semExams = getExamsForSemester(sem.id)
                    if (semExams.length === 0) return null
                    return (
                      <div key={sem.id} className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground pl-1">{sem.name}</h3>
                        {semExams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
                      </div>
                    )
                  })}
                </div>
              )
            })}

          {/* Clinical Years */}
          {clinicalYears
            .filter(year => !filterYear || filterYear === year.id)
            .map(year => {
              const yearExams = getExamsForYear(year.id)
              if (yearExams.length === 0) return null
              return (
                <div key={year.id} className="space-y-2">
                  <h2 className="text-base font-bold border-b border-border/60 pb-2">{year.name}</h2>
                  {yearExams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
                </div>
              )
            })}

        </div>
      )}
    </div>
  )
}