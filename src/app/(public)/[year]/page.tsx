import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ChevronRight } from 'lucide-react'
import type { AcademicYear, Semester } from '@/types/database'

interface PageProps {
  params: Promise<{ year: string }>
}

async function getAcademicYearWithSemesters(yearSlug: string): Promise<{
  academicYear: AcademicYear
  semesters: Semester[]
} | null> {
  const supabase = await createServerSupabaseClient()

  const yearName = yearSlug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  const { data: academicYear, error: yearError } = await supabase
    .from('academic_years')
    .select('*')
    .eq('name', yearName)
    .single()

  if (yearError || !academicYear) return null

  const { data: semesters, error: semestersError } = await supabase
    .from('semesters')
    .select('*')
    .eq('academic_year_id', academicYear.id)
    .order('display_order', { ascending: true })

  if (semestersError) return null

  return { academicYear, semesters: semesters || [] }
}

export default async function AcademicYearPage({ params }: PageProps) {
  const { year } = await params
  const result = await getAcademicYearWithSemesters(year)

  if (!result) notFound()

  const { academicYear, semesters } = result

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px', animation: '0.45s ease-out 0s 1 normal none running fadeSlideIn' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{academicYear.name}</span>
        </div>

        {/* Header */}
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: 'var(--fg)' }}>
          {academicYear.name}
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 14.5, color: 'var(--fg-muted)' }}>
          Select a semester to browse subjects and exams
        </p>

        {/* Semester Cards */}
        {semesters.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {semesters.map((semester, index) => (
              <Link
                key={semester.id}
                href={`/${year}/${semester.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="year-card"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                {/* Icon */}
                <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="3" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}>{semester.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 2 }}>Browse subjects and exams</div>
                </div>

                {/* Arrow */}
                <ChevronRight size={18} color="var(--fg-muted)" style={{ flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '64px 24px', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16, opacity: 0.5 }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--fg)' }}>No semesters available</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Semesters will appear here once they are added by an administrator.</p>
          </div>
        )}
      </main>
    </div>
  )
}