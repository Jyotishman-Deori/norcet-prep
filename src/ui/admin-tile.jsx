// =====================================================================
// src/ui/admin-tile.jsx — admin dashboard tile (A1 slice 19)
// Extracted from App.jsx (A7 hook line: T -> useTheme). Props stay
// { icon, accent, label, hint, signal, onClick, wide }. Revamp adds
// pointer/keyboard affordances (md: hover lift, focus ring) — mobile look
// and behavior unchanged.
// =====================================================================
import React from 'react';
import { useTheme } from '../lib/app-context.jsx';

function AdminTile({ icon, accent, label, hint, signal, onClick, wide }) {
  const { theme: T } = useTheme();
  return (
    <button onClick={onClick}
            className={`no-tap-highlight text-left rounded-2xl p-5 active:scale-[0.98] transition-all duration-150 md:hover:shadow-md md:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 ${wide ? 'col-span-2' : ''}`}
            style={{ background: T.surface, border: `1px solid ${T.border}`, minHeight: 132 }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
             style={{ background: accent + '18' }}>
          {icon}
        </div>
        {signal}
      </div>
      <div className="font-display text-base font-semibold leading-tight" style={{ color: T.ink }}>{label}</div>
      {hint && (
        <div className="text-xs mt-0.5 overflow-hidden"
             style={{
               color: T.muted,
               display: '-webkit-box',
               WebkitLineClamp: 2,
               WebkitBoxOrient: 'vertical'
             }}>
          {hint}
        </div>
      )}
    </button>
  );
}

export default AdminTile;
