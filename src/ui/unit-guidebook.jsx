// =====================================================================
// src/ui/unit-guidebook.jsx — the per-unit GUIDEBOOK sheet (blueprint M1).
// A static review digest attached to each unit on the Learn path: the
// unit's keypoints + mnemonics, auto-compiled from concept-cards.json by
// lib/learn-path.js compileGuidebook() — deliberately read-only summary
// consumption before/alongside the full card reader. Bottom sheet,
// scrollable, closes on scrim tap / Esc / the X.
// =====================================================================
import React, { useEffect } from 'react';
import { X, BookOpen, Lightbulb, ListChecks } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';

export default function UnitGuidebook({ open, topic, guidebook, onClose, onRead }) {
  const { theme: T } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open || !topic) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end md:items-center justify-center"
         role="dialog" aria-modal="true" aria-label={`${topic.name} guidebook`}
         style={{ background: 'rgba(15,20,17,0.55)', backdropFilter: 'blur(3px)' }}
         onClick={onClose}>
      <div className="sheet-up w-full md:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl md:rounded-3xl overflow-hidden"
           style={{ background: T.bg, border: `1px solid ${T.border}` }}
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 flex-shrink-0"
             style={{ borderBottom: `1px solid ${T.borderSoft}`, background: `linear-gradient(150deg, ${topic.color}14, transparent 70%)` }}>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
               style={{ background: topic.color + '1A', boxShadow: `inset 0 0 0 1px ${topic.color}33` }}>
            {topic.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: topic.color }}>Unit guidebook</div>
            <div className="font-display text-base font-semibold leading-tight truncate" style={{ color: T.ink }}>{topic.name}</div>
          </div>
          <button onClick={onClose} aria-label="Close guidebook"
                  className="no-tap-highlight p-2 rounded-full active:scale-90 transition-transform flex-shrink-0"
                  style={{ color: T.muted }}>
            <X size={18} />
          </button>
        </div>

        {/* Digest body */}
        <div className="overflow-y-auto px-5 py-4 flex-1">
          {!guidebook ? (
            <div className="text-sm text-center py-8" style={{ color: T.muted }}>
              No summary content for this unit yet, open the full cards instead.
            </div>
          ) : guidebook.modules.map(m => (
            <div key={m.sub} className="mb-5">
              <div className="text-xs font-bold mb-2" style={{ color: T.inkSoft }}>{m.sub}</div>
              {m.keypoints.length > 0 && (
                <div className="rounded-2xl px-3.5 py-3 mb-2" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: topic.color }}>
                    <ListChecks size={11} /> Key points
                  </div>
                  <ul className="space-y-1.5">
                    {m.keypoints.map((k, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: T.inkSoft }}>
                        <span className="mt-[7px] w-1 h-1 rounded-full flex-shrink-0" style={{ background: topic.color }} />
                        {k}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {m.mnemonics.map((mn, i) => (
                <div key={i} className="rounded-2xl px-3.5 py-3 mb-2"
                     style={{ background: T.accentSoft, border: `1px solid ${T.accent}33` }}>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: T.accent }}>
                    <Lightbulb size={11} /> Mnemonic, {mn.title}
                  </div>
                  <div className="text-[13px] leading-snug" style={{ color: T.inkSoft }}>{mn.body}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer CTA into the full reader */}
        <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          <button onClick={onRead}
                  className="no-tap-highlight w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold active:scale-[0.98] transition-transform"
                  style={{ background: topic.color, color: '#FFF', boxShadow: `0 6px 18px ${topic.color}44` }}>
            <BookOpen size={15} />
            Read the full cards
          </button>
        </div>
      </div>
    </div>
  );
}
