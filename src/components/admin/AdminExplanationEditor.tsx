// src/components/admin/AdminExplanationEditor.tsx
//
// Full explanation editor for the admin question editor page.
// Combines MnEditor (for writing) + ExplanationRenderer (for preview)
// + AdminExplanationImageSlot (for image upload per slot).

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MnEditor } from '@/components/shared/MnEditor';
import { ExplanationRenderer } from '@/components/exam/ExplanationRenderer';
import { AdminExplanationImageSlot } from '@/components/admin/AdminExplanationImageSlot';
import { parseMnSyntax } from '@/lib/mn-syntax/parser';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlotImages {
  1: string | null;
  2: string | null;
  3: string | null;
}

interface AdminExplanationEditorProps {
  /** The question's UUID — needed to save images to the database */
  questionId: string;

  /** Current explanation text (MN Syntax raw) */
  explanation: string;

  /** Called whenever the explanation text changes */
  onExplanationChange: (value: string) => void;

  /** Current images already uploaded for each slot */
  initialSlotImages?: Partial<SlotImages>;
}

// ─── Slot detector ────────────────────────────────────────────────────────────
// Reads the explanation text and returns which slot numbers appear in it.

function detectSlots(explanation: string): (1 | 2 | 3)[] {
  const tokens = parseMnSyntax(explanation);
  const slots = tokens
    .filter((t) => t.type === 'image_slot')
    .map((t) => (t as { type: 'image_slot'; slotNumber: 1 | 2 | 3 }).slotNumber);

  // Deduplicate
  return [...new Set(slots)];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminExplanationEditor({
  questionId,
  explanation,
  onExplanationChange,
  initialSlotImages = {},
}: AdminExplanationEditorProps) {
  const [slotImages, setSlotImages] = useState<SlotImages>({
    1: initialSlotImages[1] ?? null,
    2: initialSlotImages[2] ?? null,
    3: initialSlotImages[3] ?? null,
  });

  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  const supabase = createClient();

  // ── Upload image for a slot ───────────────────────────────────────────────
  async function handleUpload(slotNumber: 1 | 2 | 3, file: File) {
    const slotKey = `explanation_${slotNumber}` as
      | 'explanation_1'
      | 'explanation_2'
      | 'explanation_3';

    // 1. Upload file to Supabase Storage
    const filePath = `explanation-slots/${questionId}/slot-${slotNumber}-${Date.now()}`;
    const { error: uploadError } = await supabase.storage
      .from('question-images')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('Upload failed:', uploadError.message);
      return;
    }

    // 2. Get public URL
    const { data: urlData } = supabase.storage
      .from('question-images')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // 3. Remove old record for this slot if exists
    await supabase
      .from('question_images')
      .delete()
      .eq('question_id', questionId)
      .eq('slot_type', slotKey);

    // 4. Insert new record
    const { error: dbError } = await supabase.from('question_images').insert({
      question_id: questionId,
      image_url: publicUrl,
      slot_type: slotKey,
      display_order: slotNumber,
    });

    if (dbError) {
      console.error('DB insert failed:', dbError.message);
      return;
    }

    // 5. Update local state
    setSlotImages((prev) => ({ ...prev, [slotNumber]: publicUrl }));
  }

  // ── Remove image from a slot ──────────────────────────────────────────────
  async function handleRemove(slotNumber: 1 | 2 | 3) {
    const slotKey = `explanation_${slotNumber}` as
      | 'explanation_1'
      | 'explanation_2'
      | 'explanation_3';

    await supabase
      .from('question_images')
      .delete()
      .eq('question_id', questionId)
      .eq('slot_type', slotKey);

    setSlotImages((prev) => ({ ...prev, [slotNumber]: null }));
  }

  // ── Detect which slots exist in the current explanation text ──────────────
  const activeSlots = detectSlots(explanation);

  return (
    <div className="flex flex-col gap-4">

      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-700">
          Explanation
        </label>
        <span className="text-xs text-neutral-400">
          Supports MN Syntax
        </span>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-neutral-100 rounded-lg p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('write')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'write'
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'preview'
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Preview
        </button>
      </div>

      {/* Write tab: MnEditor */}
      {activeTab === 'write' && (
        <MnEditor
          value={explanation}
          onChange={onExplanationChange}
          placeholder="Write the explanation using MN Syntax..."
          minHeight="200px"
        />
      )}

      {/* Preview tab: rendered explanation + image slots */}
      {activeTab === 'preview' && (
        <div className="flex flex-col gap-4">
          {explanation.trim() ? (
            <>
              {/* Rendered explanation — student view */}
              <ExplanationRenderer
                content={explanation}
                slotImages={slotImages}
              />

              {/* Image upload slots — only show slots that exist in the text */}
              {activeSlots.length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Explanation Images
                  </p>
                  {activeSlots.map((slotNumber) => (
                    <AdminExplanationImageSlot
                      key={slotNumber}
                      slotNumber={slotNumber}
                      currentImageUrl={slotImages[slotNumber]}
                      onUpload={handleUpload}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-400 text-center py-8">
              Nothing to preview yet. Switch to Write and add some content.
            </p>
          )}
        </div>
      )}
    </div>
  );
}