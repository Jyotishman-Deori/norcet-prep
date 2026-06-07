// =====================================================================
// src/ui/empty-state.jsx  (Feature #15 — Empty States)
// One consistent, encouraging empty state used across the app. Mentor voice,
// a single primary action (Type 1) or none (Type 2, admin-controlled content),
// an outlined section icon, and an optional Knowledge-Map throughline note.
// Never says "No data" — an empty section is the START of something.
// =====================================================================
import React from 'react';
import { useTheme } from '../lib/app-context.jsx';

export const KM_THROUGHLINE = 'Every question you answer lights up your Knowledge Map.';

export default function EmptyState({ icon: Icon, title, text, actionLabel, onAction, note, kmNote = false, progress }) {
  const { theme: T } = useTheme();
  return (
    <div className="anim-fadeup text-center px-6 py-14 max-w-sm mx-auto">
      {Icon && (
        <div className="mx-auto mb-4 w-20 h-20 rounded-3xl flex items-center justify-center"
             style={{ background: T.surfaceWarm, border: `1.5px solid ${T.border}` }}>
          <Icon size={34} strokeWidth={1.6} style={{ color: T.muted }} />
        </div>
      )}
      <div className="font-display text-lg font-semibold mb-1.5" style={{ color: T.ink }}>{title}</div>
      {text && <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>{text}</div>}
      {progress && <div className="text-[11px] font-semibold mt-2.5" style={{ color: T.muted }}>{progress}</div>}
      {actionLabel && onAction && (
        <button onClick={onAction}
                className="no-tap-highlight inline-flex items-center justify-center gap-1.5 mt-5 px-5 py-3 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                style={{ background: T.primary, color: '#FFF' }}>
          {actionLabel}
        </button>
      )}
      {(kmNote || note) && (
        <div className="text-[11px] mt-3.5 leading-relaxed" style={{ color: T.muted }}>{note || KM_THROUGHLINE}</div>
      )}
    </div>
  );
}
