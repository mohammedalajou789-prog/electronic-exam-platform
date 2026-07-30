// src/components/shared/MnEditor.tsx
//
// MN Syntax editor with toolbar and live preview toggle.
// Used in both the Manual Question Editor and Bulk Import pages.

'use client';

import { useState, useRef } from 'react';
import { ExplanationRenderer } from '@/components/exam/ExplanationRenderer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MnEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

// ─── Toolbar Button ───────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
}

function ToolbarButton({ label, title, onClick, active }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`
        px-2 py-1 text-xs font-medium rounded border transition-colors
        ${active
          ? 'bg-neutral-800 text-white border-neutral-800'
          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
        }
      `}
    >
      {label}
    </button>
  );
}

// ─── Toolbar Definition ───────────────────────────────────────────────────────

const TOOLBAR_ACTIONS = [
  { label: 'B',         title: 'Bold — **text**',             wrap: ['**', '**'],       display: 'B'         },
  { label: 'I',         title: 'Italic — *text*',             wrap: ['*', '*'],          display: 'I'         },
  { label: 'H',         title: 'Highlight — ==text==',        wrap: ['==', '=='],        display: 'H'         },
  { label: '!!',        title: 'Callout — !!text!!',          wrap: ['!!', '!!'],        display: '!!'        },
  { label: '~~',        title: 'Green — ~~text~~',            wrap: ['~~', '~~'],        display: '~~'        },
  { label: '::',        title: 'Blue — ::text::',             wrap: ['::', '::'],        display: '::'        },
  { label: '_U_',       title: 'Underline — __text__',        wrap: ['__', '__'],        display: '_U_'       },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export function MnEditor({
  value,
  onChange,
  placeholder = 'Write explanation using MN Syntax...',
  minHeight = '180px',
}: MnEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Wrap selected text with syntax tokens ──────────────────────────────────
  function applyWrap(before: string, after: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);

    const newValue =
      value.slice(0, start) +
      before +
      (selected || 'text') +
      after +
      value.slice(end);

    onChange(newValue);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      const newCursorPos = start + before.length + (selected || 'text').length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }

  // ── Insert image slot tag ──────────────────────────────────────────────────
  function insertImageSlot(slotNumber: 1 | 2 | 3) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = textarea.selectionStart;
    const tag = `[Image Slot ${slotNumber}]`;
    const newValue = value.slice(0, pos) + '\n' + tag + '\n' + value.slice(pos);
    onChange(newValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(pos + tag.length + 2, pos + tag.length + 2);
    });
  }

  // ── Insert empty table template ────────────────────────────────────────────
  function insertTable() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = textarea.selectionStart;
    const template = `
[TABLE]
| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
| Value 3  | Value 4  |
[/TABLE]`;

    const newValue = value.slice(0, pos) + template + value.slice(pos);
    onChange(newValue);

    requestAnimationFrame(() => {
      textarea.focus();
    });
  }

  return (
    <div className="flex flex-col gap-0 border border-neutral-200 rounded-xl overflow-hidden bg-white">

      {/* ── Top bar: mode toggle + toolbar ── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-neutral-100 bg-neutral-50">

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'edit'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'preview'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            Preview
          </button>
        </div>

        {/* Toolbar — only visible in edit mode */}
        {mode === 'edit' && (
          <div className="flex items-center gap-1 flex-wrap">
            {TOOLBAR_ACTIONS.map((action) => (
              <ToolbarButton
                key={action.label}
                label={action.display}
                title={action.title}
                onClick={() => applyWrap(action.wrap[0], action.wrap[1])}
              />
            ))}

            {/* Divider */}
            <div className="w-px h-4 bg-neutral-200 mx-1" />

            {/* Image slot buttons */}
            <ToolbarButton
              label="IMG 1"
              title="Insert Image Slot 1"
              onClick={() => insertImageSlot(1)}
            />
            <ToolbarButton
              label="IMG 2"
              title="Insert Image Slot 2"
              onClick={() => insertImageSlot(2)}
            />
            <ToolbarButton
              label="IMG 3"
              title="Insert Image Slot 3"
              onClick={() => insertImageSlot(3)}
            />

            {/* Divider */}
            <div className="w-px h-4 bg-neutral-200 mx-1" />

            {/* Table button */}
            <ToolbarButton
              label="TABLE"
              title="Insert Table"
              onClick={insertTable}
            />
          </div>
        )}
      </div>

      {/* ── Edit mode: textarea ── */}
      {mode === 'edit' && (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight }}
          className="w-full px-4 py-3 text-sm font-mono text-neutral-800 bg-white resize-y outline-none placeholder:text-neutral-400 leading-relaxed"
        />
      )}

      {/* ── Preview mode: rendered explanation ── */}
      {mode === 'preview' && (
        <div className="p-4">
          {value.trim() ? (
            <ExplanationRenderer content={value} />
          ) : (
            <p className="text-sm text-neutral-400 text-center py-8">
              Nothing to preview yet. Switch to Edit and write something.
            </p>
          )}
        </div>
      )}

      {/* ── Syntax reference footer ── */}
      {mode === 'edit' && (
        <div className="px-3 py-2 border-t border-neutral-100 bg-neutral-50 flex flex-wrap gap-x-4 gap-y-1">
          {[
            { syntax: '**text**',     label: 'Bold'      },
            { syntax: '*text*',       label: 'Italic'    },
            { syntax: '==text==',     label: 'Highlight' },
            { syntax: '!!text!!',     label: 'Callout'   },
            { syntax: '~~text~~',     label: 'Green'     },
            { syntax: '::text::',     label: 'Blue'      },
            { syntax: '__text__',     label: 'Underline' },
            { syntax: '[Image Slot 1]', label: 'Image'   },
            { syntax: '[TABLE]',      label: 'Table'     },
          ].map(({ syntax, label }) => (
            <span key={label} className="text-xs text-neutral-400">
              <code className="text-neutral-600 bg-neutral-100 px-1 rounded">{syntax}</code>
              {' '}{label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}