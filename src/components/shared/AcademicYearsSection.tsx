import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  BookOpen, FlaskConical, Microscope,
  Stethoscope, Heart, GraduationCap,
} from 'lucide-react'

const YEAR_ICONS = [BookOpen, FlaskConical, Microscope, Stethoscope, Heart, GraduationCap]
const YEAR_STAGE = ['Pre-Clinical', 'Pre-Clinical', 'Pre-Clinical', 'Clinical', 'Clinical', 'Clinical']

interface AcademicYearsSectionProps {
  title?: string
  subtitle?: string
}

export default async function AcademicYearsSection({
  title = 'Academic Years',
  subtitle = 'Pick your year to get started',
}: AcademicYearsSectionProps): Promise<React.JSX.Element> {
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase
    .from('academic_years')
    .select('id, name, display_order')
    .order('display_order')

  const academicYears = data ?? []

  return (
    <section id="years" className="ay-section">
      <style>{`
        .ay-section { padding: 40px 40px 60px; background: var(--bg); }
        .ay-inner   { max-width: 1280px; margin: 0 auto; }
        .ay-grid    { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

        .ay-card {
          display: flex; align-items: center; gap: 14px;
          background: var(--bg-elev); border: 1px solid var(--bd);
          border-radius: 16px; padding: 18px 20px; cursor: pointer;
          text-decoration: none; color: inherit;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .ay-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px var(--shadow); }

        .ay-card-icon {
          width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px;
          background: rgba(196,18,48,0.12); color: #c41230;
          display: flex; align-items: center; justify-content: center;
        }
        .ay-card-name {
          font-weight: 700; font-size: 14.5px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ay-card-stage {
          font-size: 12px; color: var(--clr-primary);
          font-weight: 600; margin-top: 2px;
        }

        .ay-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          border-radius: 18px; border: 1px dashed var(--bd);
          padding: 64px 24px; text-align: center;
        }

        @media (max-width: 768px) {
          .ay-section { padding: 28px 18px 48px; }
          .ay-grid    { grid-template-columns: 1fr 1fr; gap: 10px; }
          .ay-card    { padding: 13px 14px; border-radius: 14px; gap: 10px; }
        }
      `}</style>

      <div className="ay-inner">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>{title}</h2>
          <p style={{ fontSize: 14, color: 'var(--fg-muted)', margin: 0 }}>{subtitle}</p>
        </div>

        {academicYears.length > 0 ? (
          <div className="ay-grid">
            {academicYears.map((year, index) => {
              const Icon = YEAR_ICONS[index % YEAR_ICONS.length]
              const stage = YEAR_STAGE[index] ?? 'Clinical'
              const slug = year.name.toLowerCase().replace(/\s+/g, '-')
              return (
                <Link
                  key={year.id}
                  href={`/${encodeURIComponent(slug)}`}
                  className="ay-card"
                >
                  <div className="ay-card-icon">
                    <Icon size={20} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div className="ay-card-name">{year.name}</div>
                    <div className="ay-card-stage">{stage}</div>
                  </div>
                  <span style={{ color: 'var(--fg-muted)', fontSize: 18, flexShrink: 0 }}>›</span>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="ay-empty">
            <GraduationCap size={48} style={{ marginBottom: 16, opacity: 0.5, color: 'var(--fg-muted)' }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>No academic years available</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>
              Content will appear here once it is added by an administrator.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}