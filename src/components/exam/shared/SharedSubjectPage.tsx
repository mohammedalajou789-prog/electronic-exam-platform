// src/components/exam/shared/SharedSubjectPage.tsx

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import CustomExamBuilder from '@/components/exam/CustomExamBuilder'

interface Props {
  subjectId: string
  subjectName: string
  basePath: string
  breadcrumbs: { label: string; href?: string }[]
}

export default async function SharedSubjectPage({
  subjectId,
  subjectName,
  basePath,
  breadcrumbs,
}: Props) {
  const supabase = await createServerSupabaseClient()

  // Batches
  const { data: rawBatches } = await supabase
    .from('batches')
    .select('id, name, display_order, exams(id, question_count, status, deleted_at)')
    .eq('subject_id', subjectId)
    .order('display_order', { ascending: true })

  const batches = (rawBatches || []).map((b: any) => {
    const pub = (b.exams ?? []).filter(
      (e: any) => e.status === 'published' && !e.deleted_at
    )
    return {
      ...b,
      examCount: pub.length,
      totalQuestions: pub.reduce((n: number, e: any) => n + (e.question_count ?? 0), 0),
    }
  })

  const totalExams = batches.reduce((n: number, b: any) => n + b.examCount, 0)
  const totalQuestions = batches.reduce((n: number, b: any) => n + b.totalQuestions, 0)

  // Doctors & chapters for Custom Exam Builder
  const allExamIds = batches.flatMap((b: any) =>
    (b.exams ?? [])
      .filter((e: any) => e.status === 'published' && !e.deleted_at)
      .map((e: any) => e.id)
  )

  const [doctorsRes, qMeta] = await Promise.all([
    allExamIds.length > 0
      ? supabase.from('exam_doctors').select('doctor:doctors(id, name)').in('exam_id', allExamIds)
      : Promise.resolve({ data: [] }),
    allExamIds.length > 0
      ? supabase.from('questions').select('chapter, lecture').in('exam_id', allExamIds).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
  ])

  const doctorMap = new Map<string, string>()
  ;(doctorsRes.data ?? []).forEach((r: any) => {
    if (r.doctor) doctorMap.set(r.doctor.id, r.doctor.name)
  })
  const doctors = Array.from(doctorMap, ([id, name]) => ({ id, name }))
  const chapters = [...new Set((qMeta.data ?? []).map((q: any) => q.chapter).filter(Boolean))] as string[]
  const lectures = [...new Set((qMeta.data ?? []).map((q: any) => q.lecture).filter(Boolean))] as string[]

  function nameToSlug(s: string) {
    return s.toLowerCase().replace(/\s+/g, '-')
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ padding: '32px 28px 80px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span>›</span>}
              {crumb.href
                ? <Link href={crumb.href} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{crumb.label}</Link>
                : <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{crumb.label}</span>
              }
            </span>
          ))}
        </div>

        {/* Header */}
        <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800 }}>{subjectName}</h1>
        <div style={{ display: 'flex', gap: 16, fontSize: 13.5, color: 'var(--fg-muted)', marginBottom: 26 }}>
          <span>{totalExams} exams</span>
          <span>{totalQuestions} questions</span>
        </div>

        {/* Custom Exam Builder */}
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--bd)', borderRadius: 18, marginBottom: 24, overflow: 'hidden' }}>
          <CustomExamBuilder
            subjectId={subjectId}
            batches={batches.map((b: any) => ({ id: b.id, name: b.name }))}
            doctors={doctors}
            chapters={chapters}
            lectures={lectures}
            basePath={basePath}
          />
        </div>

        {/* Batches */}
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>Batches</h2>
        {batches.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {batches.map((batch: any, i: number) => (
              <Link
                key={batch.id}
                href={`${basePath}/${nameToSlug(batch.name)}`}
                className="year-card"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg)' }}>{batch.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {batch.examCount} exam{batch.examCount !== 1 ? 's' : ''} · {batch.totalQuestions} questions
                  </div>
                </div>
                <ChevronRight size={16} color="var(--fg-muted)" style={{ flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed var(--bd)', padding: '64px 24px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>No batches available</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>Batches will appear here once added by an administrator.</p>
          </div>
        )}
      </main>
    </div>
  )
}