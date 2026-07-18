import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BookOpen, Clock, FileText, Play, Eye, Download } from 'lucide-react'

interface PageProps {
  params: Promise<{
    year: string
    semester: string
    subject: string
    customExamId: string
  }>
}

export default async function CustomExamPrepPage({ params }: PageProps) {
  const { year, semester, subject, customExamId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: customExam } = await supabase
    .from('custom_exams')
    .select('*')
    .eq('id', customExamId)
    .single()

  if (!customExam) notFound()

  const { data: questions } = await supabase
    .from('questions')
    .select('chapter, lecture')
    .in('id', customExam.question_ids)
    .is('deleted_at', null)

  if (!questions || questions.length === 0) notFound()

  const chapters = [...new Set(questions.map(q => q.chapter).filter(Boolean))] as string[]
  const questionCount = customExam.question_count
  const estimatedTime = questionCount

  const basePath = `/${year}/${semester}/${subject}/custom/${customExamId}`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--fg-muted)', marginBottom: 18 }}>
          <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</Link>
          <span>›</span>
          <Link href={`/${year}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{year.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</Link>
          <span>›</span>
          <Link href={`/${year}/${semester}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{semester.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</Link>
          <span>›</span>
          <Link href={`/${year}/${semester}/${subject}`} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>{subject.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</Link>
          <span>›</span>
          <span style={{ color: 'var(--fg)', fontWeight: 700 }}>Custom Exam</span>
        </div>

        {/* Hero Card */}
        <div style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--bd)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 1px 3px var(--shadow)',
          marginBottom: 24,
        }}>
          <div style={{ height: 5, background: 'linear-gradient(90deg, var(--clr-primary), oklch(56% 0.14 300))' }} />

          <div style={{ padding: '30px 30px 26px' }}>
            <h1 style={{ margin: '0 0 20px', fontSize: 30, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--fg)' }}>
              Custom Exam
            </h1>

            {/* Stat tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 22 }}>
              <div style={{ background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <FileText size={18} color="var(--accent-blue, oklch(58% 0.13 250))" />
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)' }}>{questionCount}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}>Questions</div>
              </div>
              <div style={{ background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Clock size={18} color="oklch(56% 0.14 300)" />
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)' }}>{estimatedTime}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}>Minutes</div>
              </div>
              <div style={{ background: 'var(--bg-soft)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <BookOpen size={18} color="oklch(60% 0.14 145)" />
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)' }}>{chapters.length}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}>Chapters</div>
              </div>
            </div>

            {/* Chapter tags */}
            {chapters.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {chapters.map(chapter => (
                  <span key={chapter} style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--bg-soft)', border: '1px solid var(--bd)', fontSize: 13, fontWeight: 600, color: 'var(--fg-muted)' }}>
                    {chapter}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mode heading */}
        <div style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>
          Choose how to begin
        </div>

        {/* Mode Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <Link href={`${basePath}/play`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, border: '1.5px solid var(--clr-primary)', background: 'var(--bg-elev)', textDecoration: 'none', boxShadow: '0 1px 2px var(--shadow)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--clr-soft)', color: 'var(--clr-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Play size={20} />
            </div>
            <div style={{ flex: '1 1 auto' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>Interactive Exam</div>
              <div style={{ fontSize: 13.5, color: 'var(--fg-muted)', marginTop: 2 }}>Simulate a real exam with a countdown timer and instant scoring</div>
            </div>
            <span style={{ padding: '5px 11px', borderRadius: 999, background: 'var(--clr-primary)', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>Recommended</span>
          </Link>

          <Link href={`${basePath}/review`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bg-elev)', textDecoration: 'none', boxShadow: '0 1px 2px var(--shadow)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'oklch(92% 0.04 250)', color: 'oklch(58% 0.13 250)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Eye size={20} />
            </div>
            <div style={{ flex: '1 1 auto' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>Review Mode</div>
              <div style={{ fontSize: 13.5, color: 'var(--fg-muted)', marginTop: 2 }}>Browse every question with answers and explanations, no timer</div>
            </div>
          </Link>

          <Link href={`${basePath}/pdf`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bg-elev)', textDecoration: 'none', boxShadow: '0 1px 2px var(--shadow)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'oklch(92% 0.04 300)', color: 'oklch(56% 0.14 300)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Download size={20} />
            </div>
            <div style={{ flex: '1 1 auto' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>Export as PDF</div>
              <div style={{ fontSize: 13.5, color: 'var(--fg-muted)', marginTop: 2 }}>Download a printable version of this exam</div>
            </div>
          </Link>

        </div>
      </main>
    </div>
  )
}