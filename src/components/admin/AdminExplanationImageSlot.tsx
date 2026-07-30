// src/components/admin/AdminExplanationImageSlot.tsx
//
// Image slot component for the admin view.
// Shows an upload frame when empty, and the image with a replace button when filled.

'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdminExplanationImageSlotProps {
  slotNumber: 1 | 2 | 3;
  currentImageUrl: string | null;
  onUpload: (slotNumber: 1 | 2 | 3, file: File) => Promise<void>;
  onRemove: (slotNumber: 1 | 2 | 3) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminExplanationImageSlot({
  slotNumber,
  currentImageUrl,
  onUpload,
  onRemove,
}: AdminExplanationImageSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const accentDark = 'oklch(38% 0.06 150)';
  const borderColor = 'oklch(87% 0.045 150)';

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await onUpload(slotNumber, file);
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await onRemove(slotNumber);
    } finally {
      setIsRemoving(false);
    }
  }

  // ── If image exists: show it with Replace + Remove buttons ────────────────
  if (currentImageUrl) {
    return (
      <div
        style={{
          margin: '16px 0',
          border: `1px solid ${borderColor}`,
          borderRadius: '14px',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.5)',
        }}
      >
        {/* Image */}
        <div style={{ position: 'relative' }}>
          <Image
            src={currentImageUrl}
            alt={`Explanation image slot ${slotNumber}`}
            width={720}
            height={400}
            style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Action bar below image */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderTop: `1px solid ${borderColor}`,
            background: 'rgba(255,255,255,0.6)',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: accentDark,
              opacity: 0.7,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Image Slot {slotNumber}
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Replace button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: accentDark,
                background: 'rgba(255,255,255,0.8)',
                border: `1px solid ${borderColor}`,
                borderRadius: '8px',
                padding: '5px 12px',
                cursor: 'pointer',
                opacity: isUploading ? 0.5 : 1,
              }}
            >
              {isUploading ? 'Uploading...' : 'Replace'}
            </button>

            {/* Remove button */}
            <button
              type="button"
              onClick={handleRemove}
              disabled={isRemoving}
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: '#dc2626',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '5px 12px',
                cursor: 'pointer',
                opacity: isRemoving ? 0.5 : 1,
              }}
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  // ── If slot is empty: show upload frame ───────────────────────────────────
  return (
    <div style={{ margin: '16px 0' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        style={{
          width: '100%',
          border: `1.5px dashed ${borderColor}`,
          borderRadius: '14px',
          background: 'rgba(255,255,255,0.5)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          cursor: isUploading ? 'wait' : 'pointer',
          transition: 'background 0.15s',
          opacity: isUploading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            'rgba(255,255,255,0.75)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            'rgba(255,255,255,0.5)';
        }}
      >
        {/* Image icon */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <rect
            x="3" y="4" width="18" height="16" rx="2.5"
            stroke={accentDark} strokeWidth="1.6" opacity="0.6"
          />
          <circle cx="8.5" cy="9.5" r="1.6" fill={accentDark} opacity="0.6" />
          <path
            d="M4 16l5-5 4.5 4.5L16 12l4 4"
            stroke={accentDark} strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.6"
          />
        </svg>

        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: accentDark,
            opacity: 0.85,
          }}
        >
          {isUploading ? 'Uploading...' : `Image Slot ${slotNumber}`}
        </span>

        <span style={{ fontSize: '12px', color: accentDark, opacity: 0.55 }}>
          {isUploading ? 'Please wait' : 'Click to upload an image'}
        </span>
      </button>
    </div>
  );
}