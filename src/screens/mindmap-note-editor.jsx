// =====================================================================
// src/screens/mindmap-note-editor.jsx — per-node study note dialog (A1 slice 23)
// Props stay { node, initialText, onSave, onDelete, onClose }.
// Map-revamp: now rides the shared KmapDialog (portaled, viewport-centred,
// fixed-size, dvh-clamped) and wears the map's dark HUD shell instead of the
// light surface-card — it floats over the dark constellation, so the light
// card used to read as a foreign layer (deliberate restyle). Save keeps the
// theme primary so the action colour stays familiar.
// =====================================================================
import React, { useState } from 'react';
import { Save, Trash2, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import KmapDialog from '../ui/kmap-dialog.jsx';
import { NOTE_MAX_LEN } from '../lib/notes.js';

// Same dark HUD tokens as mindmap-node-popup.jsx.
const HUD = {
  text: '#EAF0FF',
  muted: 'rgba(234,240,255,0.58)',
  field: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.14)',
  gold: '#FFD27A',
};

function MindmapNoteEditor({ node, initialText = '', onSave, onDelete, onClose }) {
  const { theme: T } = useTheme();
  const [text, setText] = useState(initialText || '');
  const title = node ? (node.kind === 'sub' ? (node.data && node.data.sub) : (node.data && node.data.name)) : '';
  const hadNote = (initialText || '').length > 0;
  const remaining = NOTE_MAX_LEN - text.length;
  return (
    <KmapDialog label={`Note for ${title}`} onClose={onClose}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span aria-hidden="true" style={{ fontSize: 18 }}>{'📌'}</span>
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold truncate" style={{ color: HUD.text }}>{title}</div>
              <div className="text-xs" style={{ color: HUD.muted }}>Your private study note</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
                  className="no-tap-highlight p-2 -m-1 rounded-full active:bg-white/10" style={{ color: HUD.muted }}>
            <X size={18} />
          </button>
        </div>

        {/* text-base on touch widths so iOS doesn't zoom the viewport on focus */}
        <textarea data-autofocus value={text} maxLength={NOTE_MAX_LEN}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={'Mnemonics, doubts, links… anything you want pinned to this topic.'}
                  rows={5}
                  className="w-full rounded-xl px-3 py-2.5 text-base sm:text-sm outline-none resize-none"
                  style={{ background: HUD.field, border: `1px solid ${HUD.border}`, color: HUD.text }} />
        <div className="text-[10px] mt-1 text-right" style={{ color: remaining < 80 ? HUD.gold : HUD.muted }}>
          {remaining} characters left
        </div>

        <div className="flex items-center gap-2 mt-3">
          {hadNote && (
            <button onClick={onDelete} aria-label="Delete note"
                    className="no-tap-highlight inline-flex items-center justify-center gap-1.5 font-medium rounded-xl px-4 py-3 text-sm active:scale-95"
                    style={{ background: 'rgba(224,74,58,0.16)', color: '#FF8A76' }}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button onClick={onClose}
                  className="no-tap-highlight flex-1 inline-flex items-center justify-center font-medium rounded-xl px-4 py-3 text-sm active:scale-95"
                  style={{ background: 'transparent', color: HUD.muted, border: `1px solid ${HUD.border}` }}>
            Cancel
          </button>
          <button onClick={() => onSave(text)}
                  className="no-tap-highlight flex-1 inline-flex items-center justify-center gap-1.5 font-medium rounded-xl px-4 py-3 text-sm active:scale-95"
                  style={{ background: T.primary, color: '#fff' }}>
            <Save size={15} /> Save
          </button>
        </div>
      </div>
    </KmapDialog>
  );
}

export default MindmapNoteEditor;
