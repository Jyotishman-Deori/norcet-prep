// =====================================================================
// src/ui/rich-text.jsx — the reader + the admin editor for rich content.
//   <RichText text={...} />                  reader-side, styled output
//   <RichTextEditor value onChange ... />    admin-side, toolbar + live preview
// All formatting logic is the pure, unit-tested src/lib/rich-text.js. This file
// is just presentation. Safe: renderRich() escapes before styling (see lib).
// =====================================================================
import React, { useRef, useEffect, useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Highlighter, Code,
  Heading1, Heading2, List, ListOrdered, Quote, Link2, Eye, Pencil,
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { renderRich, applyMark } from '../lib/rich-text.js';

// ---- reader ----
export function RichText({ text, className = '', style = {} }) {
  const html = renderRich(text);
  if (!html.__html) return null;
  return <div className={`rich ${className}`} style={style} dangerouslySetInnerHTML={html} />;
}
export default RichText;

// ---- editor ----
const GROUPS = [
  [
    { type: 'bold',      Icon: Bold,          label: 'Bold' },
    { type: 'italic',    Icon: Italic,        label: 'Italic' },
    { type: 'underline', Icon: Underline,     label: 'Underline' },
    { type: 'strike',    Icon: Strikethrough, label: 'Strikethrough' },
    { type: 'highlight', Icon: Highlighter,   label: 'Highlight' },
    { type: 'code',      Icon: Code,          label: 'Code' },
  ],
  [
    { type: 'h1',     Icon: Heading1,    label: 'Heading' },
    { type: 'h2',     Icon: Heading2,    label: 'Subheading' },
    { type: 'bullet', Icon: List,        label: 'Bulleted list' },
    { type: 'number', Icon: ListOrdered, label: 'Numbered list' },
    { type: 'quote',  Icon: Quote,       label: 'Quote' },
    { type: 'link',   Icon: Link2,       label: 'Link' },
  ],
];

export function RichTextEditor({ value, onChange, placeholder, rows = 6, maxLength, disabled }) {
  const { theme: T } = useTheme();
  const taRef = useRef(null);
  const pendingSel = useRef(null);
  const [preview, setPreview] = useState(false);

  // Restore the caret/selection after a controlled value update so the toolbar
  // feels WYSIWYG-ish without a fragile contentEditable.
  useEffect(() => {
    if (pendingSel.current && taRef.current) {
      const { s, e } = pendingSel.current;
      taRef.current.focus();
      try { taRef.current.setSelectionRange(s, e); } catch (_) {}
      pendingSel.current = null;
    }
  });

  const doMark = (type) => {
    if (disabled) return;
    const ta = taRef.current;
    const s0 = ta ? ta.selectionStart : (value || '').length;
    const e0 = ta ? ta.selectionEnd : (value || '').length;
    const r = applyMark(value || '', s0, e0, type);
    pendingSel.current = { s: r.selStart, e: r.selEnd };
    onChange(r.value);
  };

  const barBtn = {
    background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft,
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
      {/* toolbar */}
      <div className="flex items-center gap-1 flex-wrap px-2 py-1.5" style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.border}` }}>
        {GROUPS.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <span className="w-px self-stretch mx-0.5" style={{ background: T.border }} />}
            {group.map(({ type, Icon, label }) => (
              <button key={type} type="button" title={label} aria-label={label} disabled={disabled || preview}
                      onMouseDown={(e) => e.preventDefault()} onClick={() => doMark(type)}
                      className="no-tap-highlight w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-90 disabled:opacity-40"
                      style={barBtn}>
                <Icon size={15} />
              </button>
            ))}
          </React.Fragment>
        ))}
        <div className="flex-1" />
        <button type="button" onClick={() => setPreview(p => !p)} disabled={disabled}
                className="no-tap-highlight h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[12px] font-semibold transition active:scale-95"
                style={{ background: preview ? T.primary : T.surface, color: preview ? '#FFF' : T.inkSoft, border: `1px solid ${preview ? T.primary : T.border}` }}>
          {preview ? <Pencil size={13} /> : <Eye size={13} />}{preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {/* body: textarea OR live preview */}
      {preview ? (
        <div className="px-3.5 py-3 min-h-[6rem]" style={{ background: T.surface }}>
          {(value || '').trim()
            ? <RichText text={value} />
            : <div className="text-sm italic" style={{ color: T.muted }}>Nothing to preview yet.</div>}
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          className="w-full text-sm px-3.5 py-3 resize-none outline-none block"
          style={{ background: T.surface, color: T.ink, fontFamily: 'inherit' }}
        />
      )}

      {/* hint */}
      <div className="px-3 py-1.5 text-[10.5px] flex items-center justify-between" style={{ background: T.surfaceWarm, borderTop: `1px solid ${T.border}`, color: T.muted }}>
        <span>Select text, then tap a style. Preview shows what students see.</span>
        {typeof maxLength === 'number' && <span>{(value || '').length}/{maxLength}</span>}
      </div>
    </div>
  );
}
