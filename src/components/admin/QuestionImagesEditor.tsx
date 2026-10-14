// src/components/admin/QuestionImagesEditor.tsx
//
// Images of one question in the admin question editor:
// - Question images: several per question, shown to students in this order. Add,
//   move up / down, remove.
// - Explanation images: one per [Image Slot 1-3] written in the explanation text.
//   Upload, replace, remove.
// Every change is saved immediately (not with "Save Changes"). The files live in
// Cloudflare R2; see src/lib/image-upload.ts and src/app/api/admin/images/.

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseMnSyntax } from '@/lib/mn-syntax/parser'
import { MAX_CAPTION_LENGTH, imageUrl, type ImageSlot } from '@/lib/question-images'
import {
  deleteQuestionImage,
  reorderQuestionImages,
  uploadQuestionImage,
  type QuestionImage,
} from '@/lib/image-upload'

interface QuestionImagesEditorProps {
  questionId: string
  /** The explanation text as currently typed (decides which explanation slots are shown) */
  explanation: string
  /** Called with the number of images whenever it changes */
  onCountChange?: (count: number) => void
}

type SlotNumber = 1 | 2 | 3

const CSS = `
  .qi-box { margin: 4px 0 18px; }
  .qi-title { display:block; font-size:12.5px; font-weight:700; color:var(--fg-muted, #6b7280); margin:16px 0 8px; }
  .qi-hint { font-size:12px; color:var(--fg-muted, #6b7280); margin:6px 0 0; line-height:1.5; }
  .qi-error { font-size:12.5px; font-weight:600; color:#dc2626; background:rgba(220,38,38,0.08); border:1px solid rgba(220,38,38,0.25); border-radius:10px; padding:8px 12px; margin:8px 0; }
  .qi-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:12px; }
  .qi-card { border:1px solid var(--bd, rgba(127,127,127,0.3)); border-radius:12px; overflow:hidden; background:var(--bg-soft, rgba(127,127,127,0.06)); display:flex; flex-direction:column; }
  .qi-img { width:100%; height:130px; object-fit:contain; display:block; background:var(--bg-elev, #fff); }
  .qi-cap { font-size:12px; color:var(--fg-muted, #6b7280); padding:6px 10px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .qi-actions { display:flex; align-items:center; gap:6px; padding:8px 10px; }
  .qi-num { font-size:12px; font-weight:800; color:var(--fg-muted, #6b7280); margin-right:auto; }
  .qi-icon { width:28px; height:28px; border-radius:8px; border:1px solid var(--bd, rgba(127,127,127,0.3)); background:var(--bg-elev, #fff); color:var(--fg, inherit); cursor:pointer; font-size:13px; font-weight:800; display:flex; align-items:center; justify-content:center; font-family:inherit; }
  .qi-icon:hover:not(:disabled) { background:var(--bd, rgba(127,127,127,0.2)); }
  .qi-icon:disabled { opacity:0.35; cursor:not-allowed; }
  .qi-icon.del { color:#ef4444; }
  .qi-add { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:12px; }
  .qi-add input[type=text] { flex:1 1 220px; min-width:0; border:1px solid var(--bd, rgba(127,127,127,0.3)); background:var(--bg-soft, transparent); color:var(--fg, inherit); border-radius:10px; padding:9px 12px; font-size:13px; font-family:inherit; outline:none; }
  .qi-btn { border:1px solid var(--bd, rgba(127,127,127,0.3)); background:var(--bg-soft, transparent); color:var(--fg, inherit); border-radius:10px; padding:9px 16px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap; }
  .qi-btn:hover:not(:disabled) { background:var(--bd, rgba(127,127,127,0.2)); }
  .qi-btn:disabled { opacity:0.55; cursor:wait; }
  .qi-btn.del { color:#ef4444; }
  .qi-slots { display:flex; flex-direction:column; gap:10px; }
  .qi-slot { display:flex; align-items:center; gap:14px; flex-wrap:wrap; border:1px solid var(--bd, rgba(127,127,127,0.3)); border-radius:12px; padding:10px 12px; background:var(--bg-soft, transparent); }
  .qi-slot-img { width:120px; height:80px; object-fit:contain; border-radius:8px; background:var(--bg-elev, #fff); border:1px solid var(--bd, rgba(127,127,127,0.3)); }
  .qi-slot-empty { width:120px; height:80px; border-radius:8px; border:1.5px dashed var(--bd, rgba(127,127,127,0.4)); display:flex; align-items:center; justify-content:center; font-size:11.5px; color:var(--fg-muted, #6b7280); }
  .qi-slot-name { font-size:13px; font-weight:700; }
  .qi-warn { font-size:11.5px; font-weight:600; color:#d97706; margin-top:3px; }
  .qi-skel { height:70px; border-radius:12px; background:var(--bg-soft, rgba(127,127,127,0.08)); }
`

function slotOf(n: SlotNumber): ImageSlot {
  return `explanation_${n}` as ImageSlot
}

function slotsInText(explanation: string): SlotNumber[] {
  if (!explanation.trim()) return []
  const found = new Set<SlotNumber>()
  for (const token of parseMnSyntax(explanation)) {
    if (token.type === 'image_slot') found.add(token.slotNumber)
  }
  return [...found].sort()
}

export default function QuestionImagesEditor({ questionId, explanation, onCountChange }: QuestionImagesEditorProps) {
  const [images, setImages] = useState<QuestionImage[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  const slotInputRef = useRef<HTMLInputElement>(null)
  const pendingSlot = useRef<SlotNumber | null>(null)

  // Load this question's images when the editor opens
  useEffect(() => {
    let active = true
    async function load(): Promise<void> {
      const { data, error: loadError } = await createClient()
        .from('question_images')
        .select('id, question_id, storage_key, slot_type, display_order, caption')
        .eq('question_id', questionId)
        .order('display_order')
      if (!active) return
      if (loadError) {
        setError('Could not load the images of this question.')
        setImages([])
        return
      }
      setImages((data ?? []) as unknown as QuestionImage[])
    }
    load()
    return () => { active = false }
  }, [questionId])

  useEffect(() => {
    if (images && onCountChange) onCountChange(images.length)
  }, [images, onCountChange])

  const questionImages = useMemo(
    () => (images ?? []).filter(i => i.slot_type === 'question').sort((a, b) => a.display_order - b.display_order),
    [images]
  )
  const textSlots = useMemo(() => slotsInText(explanation), [explanation])
  const shownSlots = useMemo(() => {
    const set = new Set<SlotNumber>(textSlots)
    for (const img of images ?? []) {
      if (img.slot_type === 'explanation_1') set.add(1)
      if (img.slot_type === 'explanation_2') set.add(2)
      if (img.slot_type === 'explanation_3') set.add(3)
    }
    return [...set].sort()
  }, [textSlots, images])

  function slotImage(n: SlotNumber): QuestionImage | undefined {
    return (images ?? []).find(i => i.slot_type === slotOf(n))
  }

  async function handleAdd(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    setError('')
    try {
      for (let i = 0; i < list.length; i++) {
        setBusy(list.length > 1 ? `Uploading ${i + 1} of ${list.length}…` : 'Uploading…')
        const saved = await uploadQuestionImage(questionId, 'question', list[i], caption.trim() || null)
        setImages(prev => [...(prev ?? []), saved])
      }
      setCaption('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload failed.')
    } finally {
      setBusy(null)
    }
  }

  async function handleSlotFile(file: File | undefined): Promise<void> {
    const n = pendingSlot.current
    pendingSlot.current = null
    if (!file || !n) return
    setError('')
    setBusy(`slot-${n}`)
    try {
      const saved = await uploadQuestionImage(questionId, slotOf(n), file)
      setImages(prev => [...(prev ?? []).filter(i => i.slot_type !== slotOf(n)), saved])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload failed.')
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove(img: QuestionImage): Promise<void> {
    if (!window.confirm('Remove this image? It will be deleted from storage.')) return
    setError('')
    setBusy(img.id)
    try {
      await deleteQuestionImage(img.id)
      setImages(prev => (prev ?? []).filter(i => i.id !== img.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the image.')
    } finally {
      setBusy(null)
    }
  }

  async function handleMove(index: number, direction: -1 | 1): Promise<void> {
    const target = index + direction
    if (target < 0 || target >= questionImages.length) return
    const ordered = [...questionImages]
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    const renumbered = ordered.map((img, i) => ({ ...img, display_order: i + 1 }))
    const previous = images
    setImages(prev => [...(prev ?? []).filter(i => i.slot_type !== 'question'), ...renumbered])
    setError('')
    setBusy('reorder')
    try {
      await reorderQuestionImages(questionId, renumbered.map(i => i.id))
    } catch (err) {
      setImages(previous)
      setError(err instanceof Error ? err.message : 'Could not change the order.')
    } finally {
      setBusy(null)
    }
  }

  const isBusy = busy !== null

  return (
    <div className="qi-box">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Hidden file inputs */}
      <input
        ref={addInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files; handleAdd(f).finally(() => { e.target.value = '' }) }}
      />
      <input
        ref={slotInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; handleSlotFile(f).finally(() => { e.target.value = '' }) }}
      />

      <span className="qi-title">Question Images</span>

      {error && <div className="qi-error">{error}</div>}

      {images === null ? (
        <div className="qi-skel" />
      ) : (
        <>
          {questionImages.length > 0 ? (
            <div className="qi-grid">
              {questionImages.map((img, i) => (
                <div key={img.id} className="qi-card">
                  <a href={imageUrl(img.storage_key)} target="_blank" rel="noreferrer" title="Open full size">
                    <img className="qi-img" src={imageUrl(img.storage_key)} alt={img.caption || `Question image ${i + 1}`} loading="lazy" />
                  </a>
                  {img.caption && <div className="qi-cap" title={img.caption}>{img.caption}</div>}
                  <div className="qi-actions">
                    <span className="qi-num">#{i + 1}</span>
                    <button type="button" className="qi-icon" title="Move up" disabled={isBusy || i === 0} onClick={() => handleMove(i, -1)}>↑</button>
                    <button type="button" className="qi-icon" title="Move down" disabled={isBusy || i === questionImages.length - 1} onClick={() => handleMove(i, 1)}>↓</button>
                    <button type="button" className="qi-icon del" title="Remove" disabled={isBusy} onClick={() => handleRemove(img)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="qi-hint" style={{ marginTop: 0 }}>No images on this question yet.</p>
          )}

          <div className="qi-add">
            <input
              type="text"
              lang="en"
              dir="ltr"
              maxLength={MAX_CAPTION_LENGTH}
              placeholder="Caption for the images you add next (optional), e.g. ECG on admission"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              disabled={isBusy}
            />
            <button type="button" className="qi-btn" disabled={isBusy} onClick={() => addInputRef.current?.click()}>
              {busy && busy.startsWith('Uploading') ? busy : '+ Add images'}
            </button>
          </div>

          <span className="qi-title">Explanation Images</span>
          {shownSlots.length === 0 ? (
            <p className="qi-hint" style={{ marginTop: 0 }}>
              Write [Image Slot 1] (or 2, 3) in the explanation to place an image inside it.
            </p>
          ) : (
            <div className="qi-slots">
              {shownSlots.map(n => {
                const img = slotImage(n)
                const inText = textSlots.includes(n)
                const slotBusy = busy === `slot-${n}`
                return (
                  <div key={n} className="qi-slot">
                    {img ? (
                      <a href={imageUrl(img.storage_key)} target="_blank" rel="noreferrer" title="Open full size">
                        <img className="qi-slot-img" src={imageUrl(img.storage_key)} alt={`Explanation image ${n}`} loading="lazy" />
                      </a>
                    ) : (
                      <div className="qi-slot-empty">{slotBusy ? 'Uploading…' : 'Empty'}</div>
                    )}
                    <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                      <div className="qi-slot-name">Image Slot {n}</div>
                      {!inText && <div className="qi-warn">Not used in the explanation text (students will not see it)</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="qi-btn"
                        disabled={isBusy}
                        onClick={() => { pendingSlot.current = n; slotInputRef.current?.click() }}
                      >
                        {slotBusy ? 'Uploading…' : img ? 'Replace' : 'Upload'}
                      </button>
                      {img && (
                        <button type="button" className="qi-btn del" disabled={isBusy} onClick={() => handleRemove(img)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="qi-hint">
            Images are saved immediately (no need to press Save Changes). Large pictures are resized to 2000 px and converted to WebP.
          </p>
        </>
      )}
    </div>
  )
}