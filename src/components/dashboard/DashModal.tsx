'use client'

// src/components/dashboard/DashModal.tsx
//
// Small popup window for the dashboard (details the student opens only when needed).
// Closes with the X button, the Escape key or a click outside. While it is open the
// page behind does not scroll. On phones it slides up from the bottom as a sheet.
//
// It is rendered straight into <body> (a portal): the dashboard cards animate in with
// a transform, and a transformed parent would trap a position:fixed window inside it.

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}

const MODAL_CSS = `
  @keyframes dm-in { from { opacity: 0; transform: translate(-50%, -46%) scale(.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
  .dm-scrim { position: fixed; inset: 0; z-index: 200; background: var(--scrim); backdrop-filter: blur(2px); }
  .dm-box {
    position: fixed; z-index: 201; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(560px, calc(100vw - 32px)); max-height: min(80vh, 720px);
    display: flex; flex-direction: column;
    background: var(--bg-elev); color: var(--fg); border: 1px solid var(--bd); border-radius: 22px;
    box-shadow: 0 30px 80px var(--shadow-lg);
    animation: dm-in .34s var(--ease-spring) both;
  }
  .dm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 22px 22px 14px; border-bottom: 1px solid var(--bd); }
  .dm-title { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
  .dm-sub { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: var(--fg-muted); }
  .dm-close {
    width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; border: 1px solid var(--bd);
    background: var(--bg-soft); color: var(--fg); display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .dm-close:hover { border-color: var(--bd-strong); }
  .dm-body { padding: 18px 22px 22px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
  @media (max-width: 640px) {
    .dm-box {
      top: auto; bottom: 0; left: 0; right: 0; transform: none; width: 100%; max-height: 85vh;
      border-radius: 22px 22px 0 0; animation: mc-sheet .42s var(--ease-out) both;
    }
  }
`

export default function DashModal({ open, onClose, title, subtitle, children }: Props) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: MODAL_CSS }} />
      <div className="dm-scrim a-fade" onClick={onClose} />
      <div className="dm-box" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dm-head">
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} className="dm-title">{title}</h2>
            {subtitle && <p className="dm-sub">{subtitle}</p>}
          </div>
          <button ref={closeRef} type="button" className="dm-close press" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
        <div className="dm-body">{children}</div>
      </div>
    </>,
    document.body
  )
}