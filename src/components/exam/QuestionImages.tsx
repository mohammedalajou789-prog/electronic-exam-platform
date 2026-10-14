// src/components/exam/QuestionImages.tsx
//
// The images of one question (slot 'question'), in their order, with captions.
// Used by the exam screen, review pages, PDF export and the dashboard review lists.
// Each picture opens full size in a new tab (useful for ECGs and X-rays on phones).
// The files live in Cloudflare R2; see src/lib/question-images.ts.

import { imageUrl, questionImagesOf, type QuestionImageRow } from '@/lib/question-images'

interface QuestionImagesProps {
  images?: readonly QuestionImageRow[] | null
  /** Largest height of one picture on screen, in px */
  maxHeight?: number
  /** Space under the images, in px */
  marginBottom?: number
}

export default function QuestionImages({ images, maxHeight = 360, marginBottom = 16 }: QuestionImagesProps) {
  const list = questionImagesOf(images)
  if (list.length === 0) return null

  return (
    <div
      style={{
        display: 'grid',
        // Several pictures sit side by side on wide screens, one under the other on phones
        gridTemplateColumns: list.length > 1 ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr',
        gap: 10,
        alignItems: 'start',
        marginBottom,
      }}
    >
      {list.map((img, i) => (
        <figure
          key={img.storage_key}
          style={{
            margin: 0,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--bd, var(--border, rgba(127,127,127,0.3)))',
            breakInside: 'avoid',
          }}
        >
          <a href={imageUrl(img.storage_key)} target="_blank" rel="noreferrer" title="Open full size" style={{ display: 'block' }}>
            <img
              src={imageUrl(img.storage_key)}
              alt={img.caption || `Question image ${i + 1}`}
              loading="lazy"
              style={{ width: '100%', maxHeight, objectFit: 'contain', display: 'block' }}
            />
          </a>
          {img.caption && (
            <figcaption
              style={{
                padding: '7px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--fg-muted, #6b7280)',
                borderTop: '1px solid var(--bd, var(--border, rgba(127,127,127,0.3)))',
              }}
            >
              {img.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}