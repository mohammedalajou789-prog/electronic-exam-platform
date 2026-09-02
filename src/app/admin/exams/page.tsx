'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
  exam_doctors: Array<{ doctor: { name: string } | null }> | null
}

interface AcademicYear { id: string; name: string; is_clinical: boolean }
interface Semester     { id: string; name: string; academic_year_id: string }

const CSS = `
  .ep-root {
    --bg:           oklch(98% 0.006 55);
    --bg-elev:      oklch(100% 0 0);
    --bg-soft:      oklch(96% 0.009 55);
    --fg:           oklch(22% 0.02 50);
    --fg-muted:     oklch(46% 0.02 50);
    --bd:           oklch(89% 0.012 50);
    --clr-primary:  oklch(50% 0.19 25);
    --clr-soft:     oklch(94% 0.035 25);
    --shadow:       rgba(20,10,10,0.08);
    --accent-green: #22c55e;
    --accent-orange:#f97316;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: var(--fg);
  }
  .dark .ep-root {
    --bg:           oklch(18% 0.01 50);
    --bg-elev:      oklch(22% 0.012 50);
    --bg-soft:      oklch(20% 0.01 50);
    --fg:           oklch(92% 0.008 50);
    --fg-muted:     oklch(62% 0.015 50);
    --bd:           oklch(32% 0.015 50);
    --clr-primary:  oklch(68% 0.18 25);
    --clr-soft:     oklch(28% 0.06 25);
    --shadow:       rgba(0,0,0,0.35);
    --accent-green: #4ade80;
    --accent-orange:#fb923c;
  }
  @keyframes ep-fadeSlide {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes ep-fadeUp {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .ep-fade     { animation: ep-fadeSlide 0.4s ease-out; }
  .ep-row-anim { animation: ep-fadeUp 0.35s ease-out; }
  .ep-card     { background:var(--bg-elev); border:1px solid var(--bd); border-radius:18px; }
  .ep-input {
    border:1px solid var(--bd); background:var(--bg-soft); color:var(--fg);
    border-radius:10px; padding:10px 13px; font-size:13.5px; outline:none;
    font-family:inherit; transition:border-color 0.15s, box-shadow 0.15s;
    box-sizing:border-box;
  }
  .ep-input:focus { border-color:var(--clr-primary); box-shadow:0 0 0 3px var(--clr-soft); }
  .ep-btn-primary {
    background:var(--clr-primary); color:#fff; border:none; border-radius:11px;
    padding:11px 20px; font-size:13.5px; font-weight:700; cursor:pointer;
    font-family:inherit; transition:opacity 0.15s, transform 0.15s;
    display:flex; align-items:center; gap:7px; white-space:nowrap;
  }
  .ep-btn-primary:hover  { opacity:0.9; transform:translateY(-1px); }
  .ep-btn-primary:active { transform:translateY(0); }
  .ep-btn-ghost {
    background:var(--bg-soft); color:var(--fg); border:1px solid var(--bd);
    border-radius:11px; padding:9px 18px; font-size:12.5px; font-weight:700;
    cursor:pointer; font-family:inherit; transition:background 0.15s; white-space:nowrap;
  }
  .ep-btn-ghost:hover { background:var(--bd); }
  .ep-del-btn {
    width:32px; height:32px; border-radius:9px; border:1px solid var(--bd);
    background:transparent; color:var(--accent-orange); display:flex;
    align-items:center; justify-content:center; cursor:pointer; transition:background 0.15s;
    flex-shrink:0;
  }
  .ep-del-btn:hover { background:rgba(249,115,22,0.1); }
  .ep-exam-row {
    display:flex; align-items:center; justify-content:space-between;
    border:1px solid var(--bd); border-radius:14px; padding:14px 16px;
    background:var(--bg-soft); cursor:pointer;
    transition:background 0.12s, box-shadow 0.12s;
    animation: ep-fadeUp 0.35s ease-out;
  }
  .ep-exam-row:hover { background:var(--bg-elev); box-shadow:0 2px 8px var(--shadow); }
  .ep-year-block {
    margin-bottom:16px; border:1px solid var(--bd); border-radius:18px;
    background:var(--bg-elev); overflow:hidden; animation:ep-fadeSlide 0.4s ease-out;
  }
  .ep-year-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:16px 20px; cursor:pointer; background:var(--bg-soft);
    transition:background 0.12s;
  }
  .ep-year-header:hover { background:var(--bd); }
  .ep-stat-card {
    background:var(--bg-elev); border:1px solid var(--bd); border-radius:18px; padding:18px 20px;
  }
  .ep-sem-block { padding:14px 20px 4px; }
  .ep-sem-label {
    font-size:12.5px; font-weight:800; color:var(--fg);
    margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid var(--bd);
  }
  .ep-subject-label {
    font-size:12px; font-weight:800; color:var(--clr-primary);
    text-transform:uppercase; letter-spacing:0.3px; margin-bottom:10px;
  }
  .ep-clinical-block { padding:16px 20px; }
`

export default function ExamsPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [exams,         setExams]         = useState<Exam[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [semesters,     setSemesters]     = useState<Semester[]>([])
  const [loading,       setLoading]       = useState(true)
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({})

  const [search,       setSearch]       = useState('')
  const [filterYear,   setFilterYear]   = useState('')
  const [filterBatch,  setFilterBatch]  = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  async function load() {
    const [examsRes, yearsRes, semsRes] = await Promise.all([
      supabase.from('exams').select(`
        id, serial_number, title, exam_type, calendar_year, question_count, status,
        academic_year:academic_years(name),
        batch:batches(name),
        batch_detail:batches(subject:subjects(name, semester_id, year_id)),
        exam_doctors(doctor:doctors(name))
      `).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('academic_years').select('id, name, is_clinical').order('display_order'),
      supabase.from('semesters').select('id, name, academic_year_id').order('display_order'),
    ])
    setExams((examsRes.data ?? []) as any)
    setAcademicYears(yearsRes.data ?? [])
    setSemesters(semsRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Init: expand all years
  useEffect(() => {
    if (academicYears.length > 0) {
      const init: Record<string, boolean> = {}
      academicYears.forEach(y => { init[y.id] = false })
      setExpandedYears(init)
    }
  }, [academicYears])

  function toggleYear(yearId: string) {
    setExpandedYears(p => ({ ...p, [yearId]: !p[yearId] }))
  }

  const preClinicalYears = academicYears.filter(y => !y.is_clinical)
  const clinicalYears    = academicYears.filter(y => y.is_clinical)

  const batches = useMemo(() =>
    [...new Set(exams.map(e => (e.batch as any)?.name).filter(Boolean))] as string[]
  , [exams])

  const hasFilters = search || filterYear || filterBatch || filterStatus

  function clearFilters() {
    setSearch(''); setFilterYear(''); setFilterBatch(''); setFilterStatus('')
  }

  const filteredExams = useMemo(() => {
    return exams.filter(exam => {
      const yearName    = (exam.academic_year as any)?.name ?? ''
      const batchName   = (exam.batch as any)?.name ?? ''
      const subjectName = (exam.batch_detail as any)?.subject?.name ?? ''
      const title       = exam.title ?? ''
      const matchSearch = !search ||
        title.toLowerCase().includes(search.toLowerCase()) ||
        subjectName.toLowerCase().includes(search.toLowerCase()) ||
        batchName.toLowerCase().includes(search.toLowerCase())
      const matchYear   = !filterYear || academicYears.find(y => y.id === filterYear)?.name === yearName
      const matchBatch  = !filterBatch  || batchName  === filterBatch
      const matchStatus = !filterStatus || exam.status === filterStatus
      return matchSearch && matchYear && matchBatch && matchStatus
    })
  }, [exams, search, filterYear, filterBatch, filterStatus, academicYears])

  // Stats
  const stats = useMemo(() => ({
    total:     exams.length,
    filtered:  filteredExams.length,
    published: exams.filter(e => e.status === 'published').length,
    drafts:    exams.filter(e => e.status === 'draft').length,
    questions: exams.reduce((n, e) => n + (e.question_count ?? 0), 0),
  }), [exams, filteredExams])

  function getExamsForSemester(semesterId: string) {
    return filteredExams.filter(e => (e.batch_detail as any)?.subject?.semester_id === semesterId)
  }

  function getExamsForYear(yearId: string) {
    const yearName = academicYears.find(y => y.id === yearId)?.name ?? ''
    return filteredExams.filter(e => (e.academic_year as any)?.name === yearName)
  }

  function groupBySubject(list: Exam[]): { subjectName: string; exams: Exam[] }[] {
    const map = new Map<string, Exam[]>()
    for (const exam of list) {
      const name = (exam.batch_detail as any)?.subject?.name ?? 'Other'
      if (!map.has(name)) map.set(name, [])
      map.get(name)!.push(exam)
    }
    return Array.from(map.entries()).map(([subjectName, exams]) => ({ subjectName, exams }))
  }

  async function togglePublish(exam: Exam, e: React.MouseEvent) {
    e.stopPropagation()
    const newStatus = exam.status === 'published' ? 'draft' : 'published'
    await supabase.from('exams').update({ status: newStatus }).eq('id', exam.id)
    await load()
  }

  async function deleteExam(examId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this exam and all its questions?')) return
    await supabase.from('exams').update({ deleted_at: new Date().toISOString() }).eq('id', examId)
    await load()
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '28px 32px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 76, borderRadius: 18, background: 'oklch(93% 0.008 50)', opacity: 0.5 }} />
        ))}
      </div>
    )
  }

  // ── Exam Row ────────────────────────────────────────────────────────────────
  function ExamRow({ exam }: { exam: Exam }) {
    const subjectName = (exam.batch_detail as any)?.subject?.name ?? ''
    const batchName   = (exam.batch as any)?.name ?? ''
    const doctorName  = (Array.isArray((exam as any).exam_doctors) ? (exam as any).exam_doctors.map((ed: any) => Array.isArray(ed.doctor) ? ed.doctor[0]?.name : ed.doctor?.name).filter(Boolean).join(', ') : '') ?? ''
    const isPublished = exam.status === 'published'

    const statusBg    = isPublished
      ? 'color-mix(in srgb, #22c55e 16%, transparent)'
      : 'color-mix(in srgb, #f97316 16%, transparent)'
    const statusColor = isPublished ? '#16803f' : '#c2560a'

    return (
      <div
        className="ep-exam-row"
        onClick={() => router.push(`/admin/exams/${(exam as any).serial_number}`)}
      >
        {/* Left */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 14.5, fontWeight: 800 }}>{exam.title}</span>
            <span style={{
              fontSize: 11.5, fontWeight: 700, padding: '3px 10px',
              borderRadius: 20, background: statusBg, color: statusColor,
              textTransform: 'capitalize',
            }}>
              {exam.status}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 5, fontWeight: 500 }}>
            <span style={{ textTransform: 'capitalize' }}>{exam.exam_type}</span>
            {exam.calendar_year && <> · {exam.calendar_year}</>}
            {subjectName && <> · {subjectName}</>}
            {batchName   && <> · {batchName}</>}
            {doctorName  && <> · Dr. {doctorName}</>}
            {' '}· {exam.question_count} questions
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button className="ep-btn-ghost" onClick={e => togglePublish(exam, e)}>
            {isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button className="ep-del-btn" onClick={e => deleteExam(exam.id, e)} title="Delete exam">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    )
  }

  // ── Subject group renderer ──────────────────────────────────────────────────
  function SubjectGroups({ list }: { list: Exam[] }) {
    const groups = groupBySubject(list)
    return (
      <>
        {groups.map(({ subjectName, exams: subExams }) => (
          <div key={subjectName} style={{ paddingBottom: 14 }}>
            <div className="ep-subject-label">{subjectName}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {subExams.map(exam => <ExamRow key={exam.id} exam={exam} />)}
            </div>
          </div>
        ))}
      </>
    )
  }

  // ── Year block renderer ─────────────────────────────────────────────────────
  function YearBlock({ year, examsInYear, hasSemesters }: {
    year: AcademicYear
    examsInYear: Exam[]
    hasSemesters: boolean
  }) {
    const expanded = !!expandedYears[year.id]
    const yearSemesters = semesters.filter(s => s.academic_year_id === year.id)

    return (
      <div className="ep-year-block">
        {/* Year header — collapsible */}
        <div className="ep-year-header" onClick={() => toggleYear(year.id)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 12, color: 'var(--fg-muted)', display: 'inline-block',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
            }}>▸</span>
            <span style={{ fontSize: 16, fontWeight: 800 }}>{year.name}</span>
            <span style={{
              fontSize: 11.5, color: 'var(--fg-muted)', fontWeight: 700,
              background: 'var(--bg-elev)', border: '1px solid var(--bd)',
              padding: '3px 10px', borderRadius: 20,
            }}>
              {examsInYear.length} exams
            </span>
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div style={{ borderTop: '1px solid var(--bd)' }}>
            {hasSemesters ? (
              // Pre-clinical: Year → Semester → Subject → Exams
              yearSemesters.map(sem => {
                const semExams = getExamsForSemester(sem.id)
                if (semExams.length === 0) return null
                return (
                  <div key={sem.id} className="ep-sem-block">
                    <div className="ep-sem-label">{sem.name}</div>
                    <SubjectGroups list={semExams} />
                  </div>
                )
              })
            ) : (
              // Clinical: Year → Subject → Exams
              <div className="ep-clinical-block">
                <SubjectGroups list={examsInYear} />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  const hasResults = filteredExams.length > 0

  return (
    <>
      <style>{CSS}</style>
      <div
        className="ep-root ep-fade"
        style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px 64px', width: '100%' }}
      >

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px' }}>Exams</div>
            <div style={{ fontSize: 14.5, color: 'var(--fg-muted)', marginTop: 4, fontWeight: 500 }}>
              Browse and manage all exams and their questions.
            </div>
          </div>
          <button className="ep-btn-primary" onClick={() => router.push('/admin/content?tab=exams&openModal=true')}>
            + New Exam
          </button>
        </div>

        {/* ── Stats grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Exams',     value: stats.total,     color: 'var(--fg)' },
            { label: 'Published',       value: stats.published, color: 'var(--accent-green)' },
            { label: 'Drafts',          value: stats.drafts,    color: 'var(--accent-orange)' },
            { label: 'Total Questions', value: stats.questions, color: 'var(--fg)' },
          ].map(s => (
            <div key={s.label} className="ep-stat-card">
              <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 25, fontWeight: 800, marginTop: 6, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Filter card ── */}
        <div className="ep-card" style={{ padding: 20, marginBottom: 28 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>Filter Exams</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              className="ep-input"
              style={{ flex: '1 1 0%', minWidth: 200, width: 'auto' }}
              placeholder="Search by title, subject, or batch..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="ep-input" style={{ minWidth: 150, width: 'auto' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">All Years</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
            <select className="ep-input" style={{ minWidth: 150, width: 'auto' }} value={filterBatch} onChange={e => setFilterBatch(e.target.value)}>
              <option value="">All Batches</option>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className="ep-input" style={{ minWidth: 150, width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            {hasFilters && (
              <button className="ep-btn-ghost" onClick={clearFilters} style={{ padding: '10px 16px' }}>✕ Clear</button>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 12, fontWeight: 500 }}>
            Showing {stats.filtered} of {stats.total} exams
          </div>
        </div>

        {/* ── Exams list ── */}
        {!hasResults ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px', color: 'var(--fg-muted)',
            fontSize: 14.5, fontWeight: 500, background: 'var(--bg-elev)',
            border: '1px solid var(--bd)', borderRadius: 18,
          }}>
            No exams match your filters. Try clearing the search or filters.
            {hasFilters && (
              <div style={{ marginTop: 14 }}>
                <button className="ep-btn-ghost" onClick={clearFilters}>Clear Filters</button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Pre-clinical years */}
            {preClinicalYears
              .filter(year => !filterYear || filterYear === year.id)
              .map(year => {
                const yearSems = semesters.filter(s => s.academic_year_id === year.id)
                const examsInYear = yearSems.flatMap(sem => getExamsForSemester(sem.id))
                if (examsInYear.length === 0) return null
                return (
                  <YearBlock key={year.id} year={year} examsInYear={examsInYear} hasSemesters={true} />
                )
              })}

            {/* Clinical years */}
            {clinicalYears
              .filter(year => !filterYear || filterYear === year.id)
              .map(year => {
                const examsInYear = getExamsForYear(year.id)
                if (examsInYear.length === 0) return null
                return (
                  <YearBlock key={year.id} year={year} examsInYear={examsInYear} hasSemesters={false} />
                )
              })}
          </div>
        )}

      </div>
    </>
  )
}