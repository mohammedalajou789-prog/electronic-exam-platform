import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ChevronRight } from 'lucide-react'

interface PageProps {
  params: Promise<{ year: string }>
}

export default async function AcademicYearPage({ params }: PageProps) {
  const { year } = await params

  const yearName = year
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  const supabase = await createServerSupabaseClient()

  // جلب السنة مع is_clinical
  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('*, semesters(*)')
    .eq('name', yearName)
    .order('display_order', { referencedTable: 'semesters', ascending: true })
    .single()

  if (!academicYear) notFound()

  const isClinical = academicYear.is_clinical === true

  // للسنوات السريرية: جلب المواد مباشرة
  const { data: clinicalSubjects } = isClinical
    ? await supabase
        .from('subjects')
        .select('*, batches(id, exams(id, question_count, status, deleted_at))')
        .eq('year_id', academicYear.id)
        .order('name')
    : { data: null }

  const subjects = (clinicalSubjects ?? []).map((subject: {
    id: string
    name: string
    batches?: { exams?: { id: string; question_count: number; status: string; deleted_at: string | null }[] }[]
  }) => {
    const allExams = (subject.batches ?? [])
      .flatMap(b => b.exams ?? [])
      .filter(e => e.status === 'published' && !e.deleted_at)
    return {
      ...subject,
      examCount: allExams.length,
      questionCount: allExams.reduce((sum, e) => sum + (e.question_count ?? 0), 0),
    }
  })

  const semesters = academicYear.semesters ?? []

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', width: '100%', overflowX: 'hidden' }}>
      <style>{`
        .year-page-main { max-width: 1180px; margin: 0 auto; padding: 32px 24px 24px; box-sizing: border-box; width: 100%; }
        .year-page-title { font-size: 26px; }
        .year-page-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
        .sem-card { display: flex; align-items: center; gap: 16px; background: var(--bg-elev); border: 1px solid var(--bd); border-radius: 18px; padding: 20px; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; width: 100%; box-sizing: border-box; }
        .sem-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px var(--shadow); }
        .subject-card { display: flex; align-items: center; gap: 16px; background: var(--bg-elev); border: 1px solid var(--bd); border-radius: 18px; padding: 20px; text-decoration: none; color: inherit; transition: transform 0.2s, box-shadow 0.2s; }
        .subject-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px var(--shadow); }
        @media (max-width: 768px) {
          .year-page-main { padding: 20px 16px 20px; }
          .year-page-title { font-size: 22px !important; }
          .year-page-grid { grid-template-columns: 1fr; gap: 10px; }
          .sem-card { padding: 14px 16px; border-radius: 14px; gap: 12px; }
          .subject-card { padding: 14px 16px; border-radius: 14px; gap: 12px; }
        }
      `}</style>

      <main className="year-page-main">

        {/* Breadcrumb */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 16 }}>
          <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{academicYear.name}</span>
        </div>

        {/* Header */}
        <h1 className="year-page-title" style={{ margin: '0 0 4px', fontWeight: 800, color: 'var(--fg)' }}>
          {academicYear.name}
        </h1>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--fg-muted)' }}>
          {isClinical ? 'Select a subject to browse exams' : 'Select a semester to browse subjects and exams'}
        </p>

        {/* ══ CLINICAL: عرض المواد مباشرة ══ */}
        {isClinical ? (
          subjects.length > 0 ? (
            <div className="year-page-grid">
              {(subjects as { id: string; name: string; examCount: number; questionCount: number }[]).map((subject, index) => (
                <Link
                  key={subject.id}
                  href={`/${year}/${subject.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="subject-card"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{subject.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                      {subject.examCount} exams · {subject.questionCount} questions
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--fg-muted)" style={{ flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '48px 24px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>No subjects available</h3>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Subjects will appear here once added by an administrator.</p>
            </div>
          )
        ) : (
          /* ══ PRE-CLINICAL: عرض الفصول ══ */
          semesters.length > 0 ? (
            <div className="year-page-grid">
              {semesters.map((semester: { id: string; name: string }, index: number) => (
                <Link
                  key={semester.id}
                  href={`/${year}/${semester.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="sem-card"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className="sem-card-icon" style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="3" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sem-card-title" style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}>{semester.name}</div>
                    <div className="sem-card-sub" style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 2 }}>Browse subjects and exams</div>
                  </div>
                  <ChevronRight size={18} color="var(--fg-muted)" style={{ flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '48px 24px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>No semesters available</h3>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Semesters will appear here once added by an administrator.</p>
            </div>
          )
        )}
      </main>
    </div>
  )
}