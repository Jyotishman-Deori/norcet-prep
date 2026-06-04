// =====================================================================
// src/screens/mindmap-node-popup.jsx — knowledge-map node detail dialog (A1 slice 33)
// Extracted from App.jsx. Child of KnowledgeMap (rendered there; render site
// unchanged). Body byte-identical except the 2 A7 hook lines (useTheme/useFgOnDark).
// Pulls shared model from lib/kmap (slice 32): KMAP_BONUS_COLOR, KMAP_STATE_LABEL,
// mindmapNextProgress. Props unchanged.
// =====================================================================
import React from 'react';
import { Brain, Check, Edit3, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFgOnDark } from '../lib/theme-helpers.js';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { topicIcon } from '../lib/topics.js';
import { relativeTimeShort } from '../lib/utils.js';
import { KMAP_BONUS_COLOR, KMAP_STATE_LABEL, mindmapNextProgress } from '../lib/kmap.js';
import { Button } from '../ui/primitives.jsx';

function MindmapNodePopup({ node, onClose, onPracticeTopic, onPracticeSub, explorerEarned = false, onExplore, note = null, onEditNote = null }) {
  const { theme: T } = useTheme();
  const fgOnDark = useFgOnDark();
  const trapRef = useFocusTrap(onClose);

  // Phase B — bonus "beyond syllabus" node has a different data shape and its
  // own card (no accuracy/attempts). Tapping "Mark as explored" earns the
  // Explorer badge (local-only).
  if (node.kind === 'bonus') {
    const b = node.data;
    const markExplored = () => { if (onExplore) onExplore(b.id); onClose(); };
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
           style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
        <div ref={trapRef} role="dialog" aria-modal="true" aria-label={`${b.name} — bonus topic`}
             className="w-full max-w-sm rounded-2xl surface-card anim-scalein"
             style={{ padding: 18, borderColor: KMAP_BONUS_COLOR }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ fontSize: 20, color: KMAP_BONUS_COLOR }}>{explorerEarned ? '\u2605' : '\u2727'}</span>
              <div className="min-w-0">
                <div className="font-display text-lg font-semibold truncate" style={{ color: T.ink }}>{b.name}</div>
                <div className="text-xs" style={{ color: KMAP_BONUS_COLOR }}>Beyond syllabus {'\u00b7'} bonus</div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close"
                    className="no-tap-highlight p-1.5 rounded-full active:bg-black/5" style={{ color: T.muted }}>
              <X size={18} />
            </button>
          </div>
          <div className="text-sm leading-relaxed mb-3" style={{ color: T.inkSoft }}>
            Extra-credit material that goes past the core NORCET syllabus. It doesn't count toward your coverage — it's here to stretch you once you've mastered the basics.
          </div>
          {explorerEarned ? (
            <div className="text-sm font-medium flex items-center gap-1.5 px-3 py-2 rounded-xl"
                 style={{ background: KMAP_BONUS_COLOR + '1A', color: KMAP_BONUS_COLOR }}>
              <Check size={16} /> Explorer badge earned
            </div>
          ) : (
            <button onClick={markExplored}
                    className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 font-medium rounded-xl px-5 py-4 text-base transition-all active:scale-95"
                    style={{ background: KMAP_BONUS_COLOR, color: '#1a1205' }}>
              Mark as explored
            </button>
          )}
        </div>
      </div>
    );
  }

  const isSub = node.kind === 'sub';
  const d = node.data;
  const color = isSub ? node.color : d.color;
  const name = isSub ? d.sub : d.name;
  const state = d.state;
  const accPct = d.attempted > 0 ? Math.round(d.accuracy * 100) : null;
  const prog = mindmapNextProgress(state, d.attempted, d.accuracy);
  const fg = fgOnDark(color);

  const practice = () => {
    if (isSub) { if (onPracticeSub) onPracticeSub(node.parent, d.sub); }
    else { if (onPracticeTopic) onPracticeTopic(node.id); }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label={`${name} details`}
           className="w-full max-w-sm rounded-2xl surface-card anim-scalein"
           style={{ padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {!isSub && <span style={{ fontSize: 22 }}>{topicIcon(node.id)}</span>}
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold truncate" style={{ color: T.ink }}>{name}</div>
              <div className="text-xs" style={{ color: T.muted }}>
                {isSub ? 'Subtopic' : 'Subject'} {'\u00b7'} <span style={{ color: fg }}>{KMAP_STATE_LABEL[state]}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
                  className="no-tap-highlight p-1.5 rounded-full active:bg-black/5" style={{ color: T.muted }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <div>
            <div className="font-display text-2xl font-semibold" style={{ color: accPct == null ? T.muted : fg }}>
              {accPct == null ? '\u2014' : `${accPct}%`}
            </div>
            <div className="text-[11px]" style={{ color: T.muted }}>accuracy</div>
          </div>
          <div className="flex-1">
            <div className="text-[11px]" style={{ color: T.muted }}>
              {d.attempted} attempt{d.attempted === 1 ? '' : 's'} {'\u00b7'} {d.uniqueAnswered}/{d.total} questions seen
            </div>
            <div className="mt-1.5 h-2 rounded-full overflow-hidden" style={{ background: T.surfaceWarm }}>
              <div className="h-full rounded-full" style={{ width: `${Math.round(prog.ratio * 100)}%`, background: color }} />
            </div>
            <div className="text-[10px] mt-1" style={{ color: T.muted }}>{prog.label} {'\u2014'} {prog.hint}</div>
          </div>
        </div>

        {/* P11 Feature C — note view (read-only here; editing opens the editor). */}
        {onEditNote && (
          <div className="mb-3">
            {note && note.text ? (
              <div className="rounded-xl p-3" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-semibold flex items-center gap-1" style={{ color: T.inkSoft }}>
                    <span aria-hidden="true">{'\uD83D\uDCCC'}</span> Your note
                  </span>
                  <button onClick={onEditNote}
                          className="no-tap-highlight text-[11px] font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md active:scale-95"
                          style={{ color: T.accent }}>
                    <Edit3 size={12} /> Edit
                  </button>
                </div>
                <div className="text-sm whitespace-pre-wrap break-words" style={{ color: T.ink }}>{note.text}</div>
                {note.updatedAt ? (
                  <div className="text-[10px] mt-1.5" style={{ color: T.muted }}>Updated {relativeTimeShort(note.updatedAt)}</div>
                ) : null}
              </div>
            ) : (
              <button onClick={onEditNote}
                      className="no-tap-highlight w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium rounded-xl px-4 py-2.5 active:scale-95"
                      style={{ background: T.surfaceWarm, border: `1px dashed ${T.border}`, color: T.inkSoft }}>
                <Edit3 size={14} /> Add a note
              </button>
            )}
          </div>
        )}

        <Button onClick={practice} className="w-full" icon={<Brain size={16} />}>
          {isSub ? `Practice \u2014 ${d.sub.length > 18 ? d.sub.slice(0, 17) + '\u2026' : d.sub}` : `Practice ${name}`}
        </Button>
      </div>
    </div>
  );
}

export default MindmapNodePopup;
