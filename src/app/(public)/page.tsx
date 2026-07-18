'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen, FlaskConical, Microscope,
  Stethoscope, Heart, GraduationCap,
} from 'lucide-react'

interface AcademicYear {
  id: string
  name: string
  display_order: number
}

const YEAR_ICONS = [BookOpen, FlaskConical, Microscope, Stethoscope, Heart, GraduationCap]
const YEAR_STAGE = ['Pre-Clinical', 'Pre-Clinical', 'Pre-Clinical', 'Clinical', 'Clinical', 'Clinical']

function EcgCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = canvas.parentElement!.clientWidth
      canvas.height = 120
    }
    resize()
    window.addEventListener('resize', resize)

    let x = 0
    const points = new Array(Math.ceil(window.screen.width)).fill(canvas.height / 2)
    const speedX = 3

    const getEcgY = (currentX: number) => {
      const mid = canvas.height / 2
      const wavelength = 240
      const localX = currentX % wavelength
      if (localX > 20 && localX < 40) {
        return mid - Math.sin((localX - 20) * Math.PI / 20) * 6
      }
      if (localX >= 45 && localX <= 65) {
        const t = localX - 45
        if (t < 3) return mid + (t / 3) * 5
        else if (t < 7) return (mid + 5) - ((t - 3) / 4) * 45
        else if (t < 12) return (mid - 40) + ((t - 7) / 5) * 53
        else return (mid + 13) - ((t - 12) / 8) * 13
      }
      if (localX > 95 && localX < 130) {
        return mid - Math.sin((localX - 95) * Math.PI / 35) * 9
      }
      return mid
    }

    let raf: number
    const draw = () => {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'source-over'

      ctx.beginPath()
      ctx.strokeStyle = '#a30024'
      ctx.lineWidth = 2.4
      ctx.lineJoin = 'miter'
      ctx.miterLimit = 10
      ctx.lineCap = 'round'
      ctx.shadowBlur = 4
      ctx.shadowColor = 'rgba(163,0,36,0.35)'

      const prevX = x <= 0 ? canvas.width - speedX : x - speedX
      ctx.moveTo(prevX, points[prevX])
      for (let i = 0; i < speedX; i++) {
        const currX = (prevX + i + 1) % canvas.width
        points[currX] = getEcgY(x - speedX + i + 1)
        ctx.lineTo(currX, points[currX])
      }
      ctx.stroke()

      ctx.shadowBlur = 0
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fillRect((x + speedX) % canvas.width, 0, 40, canvas.height)
      ctx.globalCompositeOperation = 'source-over'

      x = (x + speedX) % canvas.width
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: 120, display: 'block' }} />
}

export default function HomePage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [stats, setStats] = useState({ totalYears: 0, totalSubjects: 0, totalExams: 0, totalDoctors: 0 })

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const [yearsRes, subjectsRes, examsRes] = await Promise.all([
        supabase.from('academic_years').select('*').order('display_order', { ascending: true }),
        supabase.from('subjects').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('doctor_name'),
      ])

      setAcademicYears(yearsRes.data || [])
      const totalDoctors = examsRes.data
        ? new Set(examsRes.data.map((e: { doctor_name: string }) => e.doctor_name)).size
        : 0
      setStats({
        totalYears: yearsRes.data?.length ?? 0,
        totalSubjects: subjectsRes.count ?? 0,
        totalExams: examsRes.data?.length ?? 0,
        totalDoctors,
      })
    }
    load()
  }, [])

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#fffdfc', minHeight: '100vh', color: '#221a19' }}>
      <style>{`
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes glow   { 0%,100%{opacity:.55} 50%{opacity:.9} }
        .year-card-new {
          display:flex; align-items:center; gap:14px;
          background:#ffffff; border:1px solid #f0dfdc;
          border-radius:16px; padding:18px 20px; cursor:pointer;
          text-decoration:none; color:inherit;
          transition:transform 0.2s, box-shadow 0.2s;
        }
        .year-card-new:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(196,18,48,0.10); }
        .btn-primary {
          text-decoration:none; color:#fff; font-weight:700; font-size:15px;
          padding:14px 26px; border-radius:12px; background:#c41230;
          box-shadow:rgba(196,18,48,0.14) 0px 10px 24px;
        }
        .btn-secondary {
          text-decoration:none; color:#221a19; font-weight:700; font-size:15px;
          padding:14px 26px; border-radius:12px; border:1px solid #f0dfdc; background:#ffffff;
        }
      `}</style>

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '64px 40px 40px', background: '#fff8f6' }}>
        {/* Background layers */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 50% at 25% 0%, rgba(196,18,48,0.08), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 1, backgroundImage: 'radial-gradient(rgba(196,18,48,0.10) 1px, transparent 1px)', backgroundSize: '26px 26px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -140, right: -140, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,18,48,0.14), transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 56, alignItems: 'center' }}>

          {/* Left */}
          <div>
            {/* Badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ffffff', border: '1px solid #f0dfdc', borderRadius: 999, padding: '7px 16px', fontSize: 13, fontWeight: 700, color: '#c41230', marginBottom: 22 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c41230', display: 'inline-block' }} />
              Faculty of Medicine — Hashemite University
            </div>

            <h1 style={{ fontSize: 56, lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 20px', color: '#221a19' }}>
              Medical Club
            </h1>

            <p style={{ fontSize: 17, lineHeight: 1.65, color: '#7c6f6c', maxWidth: 520, margin: '0 0 30px' }}>
              Test your knowledge, learn from your mistakes, and elevate your academic level through a comprehensive question bank covering all medical study years.
            </p>

            <div style={{ display: 'flex', gap: 14, marginBottom: 38 }}>
              <a href="#years" className="btn-primary">Start Practicing</a>
              <a href="#years" className="btn-secondary">Browse Years</a>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, maxWidth: 560 }}>
              {[
                { value: stats.totalYears,    label: 'Years'    },
                { value: stats.totalSubjects, label: 'Subjects' },
                { value: stats.totalExams,    label: 'Exams'    },
                { value: stats.totalDoctors,  label: 'Doctors'  },
              ].map(s => (
                <div key={s.label} style={{ background: '#ffffff', border: '1px solid #f0dfdc', borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#c41230' }}>{s.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#7c6f6c', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — logo */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420 }}>
            <div style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,18,48,0.14), transparent 72%)', animation: 'glow 4s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', width: 300, height: 300, border: '1.5px dashed #f0dfdc', borderRadius: '50%' }} />

            <div style={{ position: 'relative', width: 230, height: 230, filter: 'drop-shadow(rgba(196,18,48,0.14) 0px 18px 36px)' }}>
              <img src="/images/logo.jpg" alt="Medical Club logo" style={{ width: 230, height: 230, display: 'block', objectFit: 'contain', borderRadius: '50%' }} />
            </div>

            {/* Floating badge 1 */}
            <div style={{ position: 'absolute', top: 14, left: 0, background: '#ffffff', border: '1px solid #f0dfdc', borderRadius: 14, padding: '10px 14px', boxShadow: 'rgba(196,18,48,0.1) 0px 10px 24px', display: 'flex', alignItems: 'center', gap: 8, animation: 'floatY 5s ease-in-out infinite' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c41230" strokeWidth="2"><path d="M4 12h4l2 6 4-12 2 6h4" /></svg>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Live Question Bank</span>
            </div>

            {/* Floating badge 2 */}
            <div style={{ position: 'absolute', bottom: 26, right: -6, background: '#ffffff', border: '1px solid #f0dfdc', borderRadius: 14, padding: '10px 14px', boxShadow: 'rgba(196,18,48,0.1) 0px 10px 24px', display: 'flex', alignItems: 'center', gap: 8, animation: 'floatY 6s ease-in-out 1s infinite' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c41230" strokeWidth="2"><path d="M12 3l9 4-9 4-9-4 9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 16l9 4 9-4"/></svg>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>6 Academic Years</span>
            </div>
          </div>
        </div>

        {/* ECG Canvas */}
        <div style={{ position: 'relative', marginTop: 36 }}>
          <EcgCanvas />
        </div>
      </section>

      {/* Academic Years */}
      <section id="years" style={{ padding: '8px 40px 60px', background: '#fffdfc' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 22 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Academic Years</h2>
            <span style={{ fontSize: 14, color: '#7c6f6c' }}>Pick your year to get started</span>
          </div>

          {academicYears.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {academicYears.map((year, index) => {
                const Icon  = YEAR_ICONS[index % YEAR_ICONS.length]
                const stage = YEAR_STAGE[index] ?? 'Clinical'
                const slug  = year.name.toLowerCase().replace(/\s+/g, '-')
                return (
                  <Link key={year.id} href={`/${encodeURIComponent(slug)}`} className="year-card-new">
                    <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 12, background: 'rgba(196,18,48,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c41230' }}>
                      <Icon size={20} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex: '1 1 0' }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{year.name}</div>
                      <div style={{ fontSize: 12.5, color: '#c41230', fontWeight: 600 }}>{stage}</div>
                    </div>
                    <span style={{ color: '#7c6f6c', fontSize: 18 }}>›</span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: '1px dashed #f0dfdc', padding: '64px 24px', textAlign: 'center' }}>
              <GraduationCap size={48} style={{ marginBottom: 16, opacity: 0.5, color: '#7c6f6c' }} />
              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>No academic years available</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#7c6f6c' }}>Content will appear here once it is added by an administrator.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}