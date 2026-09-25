'use client'
// src/components/exam/ReportButton.tsx
//
// "Report Issue" button with its dialog. Reports are sent through the
// submit_report database function, which links the report to the signed-in
// student automatically and prevents duplicates and spam.

import { useState } from 'react'
import {
  REPORT_CATEGORIES,
  MAX_REPORT_DESCRIPTION_LENGTH,
  submitReport,
} from '@/features/exam-engine/question-actions'

interface Props {
  questionId: string
}

export default function ReportButton({ questionId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(): Promise<void> {
    if (!category || isSubmitting) return
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await submitReport(questionId, category, description)
      setIsDone(true)
      setTimeout(() => {
        setIsOpen(false)
        setIsDone(false)
        setCategory('')
        setDescription('')
      }, 2000)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not send the report. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleClose(): void {
    setIsOpen(false)
    setCategory('')
    setDescription('')
    setIsDone(false)
    setErrorMessage(null)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '9px 16px',
          borderRadius: 11,
          border: '1px solid var(--primary)',
          background: 'color-mix(in srgb, var(--primary) 12%, var(--bg-elev))',
          color: 'var(--primary)',
          fontWeight: 700,
          fontSize: 13.5,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
        Report Issue
      </button>

      {isOpen && (
        <>
          <div
            onClick={handleClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,.45)',
              zIndex: 200,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report an issue"
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(480px, 90vw)',
              background: 'var(--bg-elev)',
              borderRadius: 18,
              border: '1px solid var(--border)',
              padding: '22px 24px',
              zIndex: 201,
              fontFamily: 'inherit',
            }}
          >
            {isDone ? (
              <div style={{ padding: '16px 0', textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--accent-green) 15%, var(--bg-soft))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)', marginBottom: 6 }}>Report Submitted</div>
                <div style={{ fontSize: 13.5, color: 'var(--fg-muted)' }}>Thank you for helping improve the platform.</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--fg)' }}>Report an Issue</div>
                  <button
                    onClick={handleClose}
                    aria-label="Close"
                    style={{
                      width: 30, height: 30, borderRadius: 9,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-soft)', color: 'var(--fg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <label htmlFor="report-category" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Issue Type</label>
                <select
                  id="report-category"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    width: '100%', padding: '11px 12px', borderRadius: 11,
                    border: '1px solid var(--border)', background: 'var(--bg-soft)',
                    color: 'var(--fg)', fontSize: 14, fontFamily: 'inherit',
                    marginBottom: 16, outline: 'none',
                  }}
                >
                  <option value="">Select issue type</option>
                  {REPORT_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>

                <label htmlFor="report-description" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>Description (Optional)</label>
                <textarea
                  id="report-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={MAX_REPORT_DESCRIPTION_LENGTH}
                  placeholder="Describe the issue..."
                  style={{
                    width: '100%', minHeight: 84, padding: '11px 12px',
                    borderRadius: 11, border: '1px solid var(--border)',
                    background: 'var(--bg-soft)', color: 'var(--fg)',
                    fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
                    marginBottom: errorMessage ? 10 : 18, outline: 'none',
                  }}
                />

                {errorMessage && (
                  <div role="alert" style={{ marginBottom: 14, fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
                    {errorMessage}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleClose}
                    style={{
                      padding: '10px 18px', borderRadius: 11,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--fg)', fontWeight: 700, fontSize: 14,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!category || isSubmitting}
                    style={{
                      padding: '10px 18px', borderRadius: 11, border: 'none',
                      background: 'var(--primary)',
                      color: 'white',
                      fontWeight: 700, fontSize: 14,
                      cursor: !category || isSubmitting ? 'not-allowed' : 'pointer',
                      opacity: !category || isSubmitting ? 0.5 : 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}