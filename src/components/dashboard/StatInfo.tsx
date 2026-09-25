'use client'
// src/components/dashboard/StatInfo.tsx
//
// A small "?" button next to a statistic. Clicking it shows a short
// explanation of what the number means.
//
// The explanation is positioned relative to the screen (position: fixed),
// so it is never squeezed by its parent and always stays inside the screen.
// It closes on outside click, Escape, scroll, or window resize.

import { useEffect, useId, useRef, useState } from 'react'

interface StatInfoProps {
  /** The statistic's name, shown as the heading of the explanation. */
  label: string
  /** Plain-language explanation for students. */
  description: string
  /** Use 'dark' when the button sits on a dark card. */
  tone?: 'light' | 'dark'
}

interface PanelPosition {
  top: number
  left: number
  width: number
}

const PANEL_WIDTH = 280
const SCREEN_MARGIN = 12
const GAP_BELOW_BUTTON = 8

export default function StatInfo({ label, description, tone = 'light' }: StatInfoProps) {
  const [position, setPosition] = useState<PanelPosition | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const open = position !== null

  function toggle(): void {
    if (open || !buttonRef.current) {
      setPosition(null)
      return
    }
    const rect = buttonRef.current.getBoundingClientRect()
    const width = Math.min(PANEL_WIDTH, window.innerWidth - SCREEN_MARGIN * 2)
    // Start under the button, but never past the right or left edge of the screen
    const left = Math.min(
      Math.max(SCREEN_MARGIN, rect.left),
      window.innerWidth - width - SCREEN_MARGIN
    )
    setPosition({ top: rect.bottom + GAP_BELOW_BUTTON, left, width })
  }

  useEffect(() => {
    if (!open) return

    function close(): void {
      setPosition(null)
    }
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      close()
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const isDark = tone === 'dark'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`What does "${label}" mean?`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        style={{
          width: 20,
          height: 20,
          padding: 0,
          flexShrink: 0,
          borderRadius: '50%',
          border: `1px solid ${isDark ? 'var(--panel-dark-bd)' : 'var(--bd)'}`,
          background: 'transparent',
          color: isDark ? 'var(--panel-dark-mut)' : 'var(--fg-muted)',
          fontSize: 11.5,
          fontWeight: 800,
          lineHeight: 1,
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ?
      </button>

      {position && (
        <div
          ref={panelRef}
          id={panelId}
          role="note"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: position.width,
            maxWidth: 'none',
            boxSizing: 'border-box',
            zIndex: 1000,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--bg-elev)',
            color: 'var(--fg)',
            border: '1px solid var(--bd)',
            boxShadow: '0 12px 32px var(--shadow)',
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.6,
            letterSpacing: 'normal',
            textTransform: 'none',
            textAlign: 'left',
            whiteSpace: 'normal',
            wordBreak: 'normal',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 800 }}>
            {label}
          </strong>
          {description}
        </div>
      )}
    </>
  )
}
