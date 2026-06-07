// =====================================================================
// src/ui/quick-revision-view.jsx  (Feature F-D)
// The "Quick Revision Mode" stream: a fast, app-curated sweep of the most
// relevant concept-card points across topics, each tagged with WHY it
// surfaced (transparency label). Rendered inline inside LearnTopics when the
// user flips the mode toggle. Tapping a card opens it in full context in the
// normal card reader (onPick).
// =====================================================================
import React from 'react';
import { Check, ChevronRight, Zap } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { topicName } from '../lib/topics.js';
import { Card } from './primitives.jsx';
import { REASON_LABELS } from '../lib/quick-revision.js';

function reasonStyle(reason, T) {
  switch (reason) {
    case 'weak': return { color: T.error, bg: T.error + '18' };
    case 'due': return { color: T.accent, bg: T.accent + '18' };
    case 'highyield': return { color: T.primary, bg: T.primary + '18' };
    case 'recent': return { color: T.success, bg: T.successSoft };
    default: return { color: T.muted, bg: T.surfaceWarm };
  }
}

function headerNote(examDaysLeft) {
  if (examDaysLeft != null && examDaysLeft <= 7) return 'Final week — only the most critical facts, nothing new.';
  if (examDaysLeft != null && examDaysLeft <= 30) return 'Exam soon — a high-yield sweep across everything.';
  if (examDaysLeft != null && examDaysLeft <= 60) return 'A mix of your weak spots and broad coverage.';
  return 'A smart sweep — your weak spots and what is due, first.';
}

export default function QuickRevisionView({ stream, examDaysLeft, onPick }) {
  const { theme: T } = useTheme();

  if (!stream || stream.length === 0) {
    return (
      <div className="text-center py-12 px-6">
        <div className="font-display text-lg font-semibold mb-1" style={{ color: T.ink }}>Nothing to sweep yet</div>
        <div className="text-sm" style={{ color: T.muted }}>
          Practise a few questions or read some topics, and Quick Revision will start surfacing what matters most.
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fadeup">
      <div className="flex items-start gap-2 mb-4 px-1">
        <Zap size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} />
        <div className="text-sm leading-snug" style={{ color: T.muted }}>{headerNote(examDaysLeft)}</div>
      </div>

      <div className="space-y-2.5">
        {stream.map((it, i) => {
          const rs = reasonStyle(it.reason, T);
          const c = it.card;
          return (
            <Card key={`${it.topic}-${it.sub}-${i}`} className="p-4" style={{ borderLeft: `3px solid ${rs.color}` }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: rs.bg, color: rs.color }}>
                  {REASON_LABELS[it.reason] || it.reason}
                </span>
                <span className="text-[10px] uppercase tracking-widest font-semibold truncate" style={{ color: T.muted }}>
                  {topicName(it.topic)}{it.sub ? ` · ${it.sub}` : ''}
                </span>
              </div>

              <div className="font-display text-base font-semibold leading-snug mb-1.5" style={{ color: T.ink }}>{c.title}</div>

              {Array.isArray(c.body) ? (
                <ul className="space-y-1.5 mb-1">
                  {c.body.map((b, j) => (
                    <li key={j} className="flex gap-2 items-start">
                      <Check size={13} className="flex-shrink-0 mt-0.5" style={{ color: rs.color }} />
                      <span className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.inkSoft }}>{c.body}</div>
              )}

              <button onClick={() => onPick && onPick(it.topic, it.sub)}
                      className="no-tap-highlight mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold active:scale-95 transition"
                      style={{ color: T.primary }}>
                Read in context <ChevronRight size={13} />
              </button>
            </Card>
          );
        })}
      </div>

      <div className="mt-5 text-center text-[11px]" style={{ color: T.muted }}>
        Quick Revision updates as your weak areas, due reviews and exam date change.
      </div>
    </div>
  );
}
