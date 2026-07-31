// src/components/exam/ExplanationRenderer.tsx
//
// Renders a parsed MN Syntax explanation inside the exam view.
// Matches the visual design: sage-green card, callout box, table, image slots.

'use client';

import Image from 'next/image';
import { parseMnSyntax, parseInline, type MnToken, type MnInlineToken } from '@/lib/mn-syntax/parser';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExplanationRendererProps {
  content: string;
  slotImages?: Record<1 | 2 | 3, string | null>;
  onSlotUpload?: (slotNumber: 1 | 2 | 3, file: File) => void;
}

// ─── Inline Token Renderer ───────────────────────────────────────────────────
// Renders inline MN tokens within rich contexts like bold

function InlineToken({ token }: { token: MnInlineToken }) {
  switch (token.type) {
    case 'text':
      return <span>{token.value}</span>;

    case 'bold':
      return (
        <strong style={{ fontWeight: 700 }}>
          <InlineContent children={parseInline(token.value)} />
        </strong>
      );

    case 'italic':
      return <em>{token.value}</em>;

    case 'highlight':
      return (
        <span
          style={{
            background: 'oklch(88% 0.11 95)',
            color: 'oklch(30% 0.06 95)',
            padding: '1px 5px',
            borderRadius: '4px',
            fontWeight: 600,
          }}
        >
          {token.value}
        </span>
      );

    case 'highlight_bold':
      return (
        <span
          style={{
            background: 'oklch(88% 0.11 95)',
            color: 'oklch(30% 0.06 95)',
            padding: '1px 5px',
            borderRadius: '4px',
            fontWeight: 800,
          }}
        >
          {token.value}
        </span>
      );

    case 'green':
      return (
        <span style={{ color: 'oklch(42% 0.14 150)', fontWeight: 700 }}>
          {token.value}
        </span>
      );

    case 'blue':
      return (
        <span style={{ color: 'oklch(38% 0.16 230)', fontWeight: 600 }}>
          {token.value}
        </span>
      );

    case 'underline':
      return (
        <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>
          {token.value}
        </span>
      );

    default:
      return null;
  }
}

// ─── Inline Children Renderer ────────────────────────────────────────────────

function InlineContent({ children }: { children: MnInlineToken[] }) {
  return (
    <>
      {children.map((token, i) => (
        <InlineToken key={i} token={token} />
      ))}
    </>
  );
}

// ─── Block Token Renderer ────────────────────────────────────────────────────

function BlockToken({
  token,
  slotImages,
  accentDark,
  borderColor,
  onSlotUpload,
}: {
  token: MnToken;
  slotImages: Record<1 | 2 | 3, string | null>;
  accentDark: string;
  borderColor: string;
  onSlotUpload?: (slotNumber: 1 | 2 | 3, file: File) => void;
}) {
  switch (token.type) {
case 'list':
      return (
        <ul style={{ margin: '0 0 16px 0', paddingLeft: '1.5rem', lineHeight: 1.9, fontSize: '16.5px', listStyleType: 'disc' }}>
          {token.items.map((item, i) => (
            <li key={i} style={{ paddingLeft: '4px' }}>
              <InlineContent children={item} />
            </li>
          ))}
        </ul>
      );
    case 'paragraph':
      return (
        <p style={{ fontSize: '16.5px', lineHeight: 1.75, margin: '0 0 16px 0' }}>
          <InlineContent children={token.children} />
        </p>
      );

    case 'callout':
      return (
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            background: 'oklch(96% 0.02 25)',
            border: '1px solid oklch(88% 0.05 25)',
            borderRadius: '12px',
            padding: '14px 16px',
            fontSize: '16.5px',
            margin: '16px 0',
          }}
        >
          {/* Info icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            style={{ flexShrink: 0, marginTop: '2px' }}
          >
            <circle cx="12" cy="12" r="10" stroke="oklch(48% 0.18 25)" strokeWidth="2" />
            <path d="M12 7v6" stroke="oklch(48% 0.18 25)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="1.1" fill="oklch(48% 0.18 25)" />
          </svg>
          <p
            style={{
              margin: 0,
              color: 'oklch(38% 0.16 25)',
              fontWeight: 600,
              lineHeight: 1.6,
            }}
          >
            <InlineContent children={token.children} />
          </p>
        </div>
      );

    case 'image_slot': {
      const slotNum = token.slotNumber;
      const imageUrl = slotImages[slotNum] ?? null;

      if (imageUrl) {
        return (
          <div style={{ margin: '16px 0', borderRadius: '14px', overflow: 'hidden' }}>
            <Image
              src={imageUrl}
              alt={`Explanation image ${slotNum}`}
              width={720}
              height={400}
              style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
            />
          </div>
        );
      }

      return (
        <>
          <input
            type="file"
            accept="image/*"
            id={`slot-upload-${slotNum}`}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onSlotUpload) onSlotUpload(slotNum, file);
              e.target.value = '';
            }}
          />
          <label
            htmlFor={`slot-upload-${slotNum}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              margin: '16px 0',
              border: `1.5px dashed ${borderColor}`,
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.5)',
              padding: '28px',
              cursor: onSlotUpload ? 'pointer' : 'default',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="16" rx="2.5" stroke={accentDark} strokeWidth="1.6" opacity="0.6" />
              <circle cx="8.5" cy="9.5" r="1.6" fill={accentDark} opacity="0.6" />
              <path d="M4 16l5-5 4.5 4.5L16 12l4 4" stroke={accentDark} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
            </svg>
            <span style={{ fontSize: '13px', fontWeight: 600, color: accentDark, opacity: 0.85 }}>
              Image Slot {slotNum}
            </span>
            <span style={{ fontSize: '12px', color: accentDark, opacity: 0.55 }}>
              {onSlotUpload ? 'Click to upload an image' : 'Upload after import'}
            </span>
          </label>
        </>
      );
    }

    case 'table':
      return (
        <div
          style={{
            margin: '16px 0',
            border: `1px solid ${borderColor}`,
            borderRadius: '10px',
            overflowX: 'auto',
            background: 'rgba(255,255,255,0.35)',
          }}
        >
          <table style={{ width: '100%', minWidth: '400px', borderCollapse: 'collapse', fontSize: '15px' }}>
            {token.headers.length > 0 && (
              <thead>
                <tr
                  style={{
                    background: 'rgba(255,255,255,0.5)',
                    color: accentDark,
                    borderBottom: `1px solid ${borderColor}`,
                  }}
                >
                  {token.headers.map((headerTokens, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <InlineContent children={headerTokens} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {token.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  style={{
                    borderBottom:
                      rowIndex < token.rows.length - 1
                        ? `1px solid ${borderColor}`
                        : 'none',
                    background:
                      rowIndex % 2 === 0
                        ? 'transparent'
                        : 'rgba(255,255,255,0.2)',
                  }}
                >
                  {row.map((cellTokens, cellIndex) => (
                    <td
                      key={cellIndex}
                      style={{
                        padding: '10px 14px',
                        lineHeight: 1.5,
                        verticalAlign: 'top',
                      }}
                    >
                      <InlineContent children={cellTokens} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExplanationRenderer({
  content,
  slotImages = { 1: null, 2: null, 3: null },
  onSlotUpload,
}: ExplanationRendererProps) {

  // Design tokens — matches the sage palette from your HTML file
  const accentDark = 'oklch(38% 0.06 150)';
  const borderColor = 'oklch(87% 0.045 150)';
  const bg1 = 'oklch(97% 0.018 152)';
  const bg2 = 'oklch(94.5% 0.025 150)';

  const tokens = parseMnSyntax(content);

  return (
    <div
      style={{
        background: `linear-gradient(160deg, ${bg1}, ${bg2})`,
        border: `1px solid ${borderColor}`,
        borderRadius: '20px',
        padding: '32px 36px',
        boxShadow:
          '0 1px 2px rgba(20,30,20,0.04), 0 8px 24px rgba(20,30,20,0.05)',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        color: 'oklch(24% 0.015 150)',
      }}
    >
      {/* Header badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.6)',
            border: `1px solid ${borderColor}`,
            borderRadius: '999px',
            padding: '5px 14px 5px 10px',
          }}
        >
          {/* Checkmark icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" stroke={accentDark} strokeWidth="2" />
            <path
              d="M8 12.5l2.5 2.5L16 9.5"
              stroke={accentDark}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: accentDark,
              textTransform: 'uppercase',
            }}
          >
            Explanation
          </span>
        </div>

        {/* Three dots decoration */}
        <svg width="18" height="4" viewBox="0 0 18 4" fill="none" style={{ opacity: 0.35 }}>
          <circle cx="2" cy="2" r="2" fill="currentColor" />
          <circle cx="9" cy="2" r="2" fill="currentColor" />
          <circle cx="16" cy="2" r="2" fill="currentColor" />
        </svg>
      </div>

      {tokens.map((token, i) => (
        <BlockToken
          key={i}
          token={token}
          slotImages={slotImages}
          accentDark={accentDark}
          borderColor={borderColor}
          onSlotUpload={onSlotUpload}
        />
      ))}
    </div>
  );
}