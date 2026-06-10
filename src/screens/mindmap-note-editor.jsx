// =====================================================================
// src/screens/mindmap-note-editor.jsx — per-node study note dialog (A1 slice 23)
// Extracted from App.jsx. Body byte-identical; only change is the A7 hook line
// (T -> useTheme). Props stay { node, initialText, onSave, onDelete, onClose }.
// (`data` refs were node.data property access, not App data context.)
// =====================================================================
import React, { useState } from 'react';
import { Save, Trash2, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { NOTE_MAX_LEN } from '../lib/notes.js';

function MindmapNoteEditor({ node, initialText = '', onSave, onDelete, onClose }) {
  const { theme: T } = useTheme();
  const trapRef = useFocusTrap(onClose);
  const [text, setText] = useState(initialText || '');
  const title = node ? (node.kind === 'sub' ? (node.data && node.data.sub) : (node.data && node.data.name)) : '';
  const hadNote = (initialText || '').length > 0;
  const remaining = NOTE_MAX_LEN - text.length;
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label={`Note for ${title}`}
           className="w-full max-w-sm rounded-2xl surface-card anim-scalein"
           style={{ padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span aria-hidden="true" style={{ fontSize: 18 }}>{'\uD83D\uDCCC'}</span>
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold truncate" style={{ color: T.ink }}>{title}</div>
              <div className="text-xs" style={{ color: T.muted }}>Your private study note</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
                  className="no-tap-highlight p-1.5 rounded-full active:bg-black/5" style={{ color: T.muted }}>
            <X size={18} />
          </button>
        </div>

        <textarea autoFocus value={text} maxLength={NOTE_MAX_LEN}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={'Mnemonics, doubts, links\u2026 anything you want pinned to this topic.'}
                  rows={5}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.ink }} />
        <div className="text-[10px] mt-1 text-right" style={{ color: remaining < 80 ? T.accent : T.muted }}>
          {remaining} characters left
        </div>

        <div className="flex items-center gap-2 mt-3">
          {hadNote && (
            <button onClick={onDelete} aria-label="Delete note"
                    className="no-tap-highlight inline-flex items-center justify-center gap-1.5 font-medium rounded-xl px-4 py-3 text-sm active:scale-95"
                    style={{ background: (T.error || '#C04A2E') + '1A', color: T.error || '#C04A2E' }}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button onClick={onClose}
                  className="no-tap-highlight flex-1 inline-flex items-center justify-center font-medium rounded-xl px-4 py-3 text-sm active:scale-95"
                  style={{ background: T.surfaceWarm, color: T.inkSoft, border: `1px solid ${T.border}` }}>
            Cancel
          </button>
          <button onClick={() => onSave(text)}
                  className="no-tap-highlight flex-1 inline-flex items-center justify-center gap-1.5 font-medium rounded-xl px-4 py-3 text-sm active:scale-95"
                  style={{ background: T.primary, color: '#fff' }}>
            <Save size={15} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default MindmapNoteEditor;
