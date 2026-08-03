// src/app/(public)/[year]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import CustomExamBuilder from '@/components/exam/CustomExamBuilder'
import { ChevronRight } from 'lucide-react'

interface PageProps {
  params: Promise<{ year: string }>
}

function slugToName(s: string) {
  return s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}
function nameToSlug(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-')
}

export default async function YearPage({ params }: PageProps) {
  const { year: yearSlug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: academicYear } = await supabase
    .from('academic_years')
    .select('id, name, is_clinical')
    .eq('name', slugToName(yearSlug))
    .single()

  if (!academicYear) notFound()

  // ── PRE-CLINICAL → show semesters ────────────────────────────────────────
  if (!academicYear.is_clinical) {
    const { data: semesters } = await supabase
      .from('semesters')
      .select('id, name, display_order')
      .eq('academic_year_id', academicYear.id)
      .order('display_order', { ascending: true })

    return (
      <PageWrapper>
        <BC items={[{ label: 'Home', href: '/' }, { label: academicYear.name }]} />
        <h1 style={S.h1}>{academicYear.name}</h1>
        <p style={S.subtitle}>Select a semester to browse subjects</p>
        {(semesters || []).length > 0 ? (
          <div style={S.grid}>
            {(semesters || []).map((sem, i) => (
              <Link key={sem.id} href={`/${yearSlug}/${nameToSlug(sem.name)}`} className="year-card" style={{ animationDelay: `${i * 60}ms` }}>
                <CardIcon><CalIcon /></CardIcon>
                <div style={{ flex: 1 }}>
                  <div style={S.cardTitle}>{sem.name}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : <EmptyState title="No semesters available" />}
      </PageWrapper>
    )
  }

  // ── CLINICAL → show subjects directly ─────────────────────────────────────
  const { data: rawSubjects } = await supabase
    .from('subjects')
    .select('id, name, display_order, batches(id, exams(id, question_count, status, deleted_at))')
    .eq('year_id', academicYear.id)
    .order('display_order', { ascending: true })

  const subjects = (rawSubjects || []).map(s => {
    const exams = (s.batches ?? [])
      .flatMap((b: any) => b.exams ?? [])
      .filter((e: any) => e.status === 'published' && !e.deleted_at)
    return { ...s, examCount: exams.length, questionCount: exams.reduce((n: number, e: any) => n + (e.question_count ?? 0), 0) }
  })

  return (
    <PageWrapper>
      <BC items={[{ label: 'Home', href: '/' }, { label: academicYear.name }]} />
      <h1 style={S.h1}>{academicYear.name}</h1>
      <p style={S.subtitle}>Select a subject to browse exams</p>
      {subjects.length > 0 ? (
        <div style={{ ...S.grid, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {subjects.map((sub, i) => (
            <Link key={sub.id} href={`/${yearSlug}/${nameToSlug(sub.name)}`} className="year-card" style={{ animationDelay: `${i * 60}ms`, flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ ...S.cardIconWrap, marginBottom: 14 }}><BookIcon /></div>
              <div style={S.cardTitle}>{sub.name}</div>
              <div style={S.cardMeta}>{sub.examCount} exams · {sub.questionCount} questions</div>
            </Link>
          ))}
        </div>
      ) : <EmptyState title="No subjects available" />}
    </PageWrapper>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ padding: '32px 28px 80px' }}>{children}</main>
    </div>
  )
}
function BC({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span>›</span>}
          {it.href ? <Link href={it.href} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{it.label}</Link>
            : <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{it.label}</span>}
        </span>
      ))}
    </div>
  )
}
function CardIcon({ children }: { children: React.ReactNode }) {
  return <div style={S.cardIconWrap}>{children}</div>
}
function EmptyState({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '64px 24px', textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Content will appear here once added by an administrator.</p>
    </div>
  )
}
function CalIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
}
function BookIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
}

const S = {
  h1: { margin: '0 0 4px', fontSize: 26, fontWeight: 800 } as React.CSSProperties,
  subtitle: { margin: '0 0 28px', fontSize: 14.5, color: 'var(--fg-muted)' } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 } as React.CSSProperties,
  cardTitle: { fontSize: 15, fontWeight: 800, color: 'var(--fg)' } as React.CSSProperties,
  cardMeta: { fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 4 } as React.CSSProperties,
  cardIconWrap: { width: 42, height: 42, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } as React.CSSProperties,
}