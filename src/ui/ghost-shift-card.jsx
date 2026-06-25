// =====================================================================
// src/ui/ghost-shift-card.jsx — PHIL-04 "The Ghost Shift"
// Renders on the Advanced Test results screen. You vs your ~2-weeks-ago self
// (Oubaitori). Never a global ranking — the leaderboard lives on separately;
// this is the private, kinder race against your own Ghost.
// =====================================================================
import React from 'react';
import { Ghost, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from './primitives.jsx';
import { buildGhostShift } from '../lib/ghost.js';

const VERDICT_TONE = {
  up:     '#16A34A',
  steady: '#6366F1',
  down:   '#B8791A',
};

function MetricRow({ m, T, first }) {
  const tone = m.same ? T.muted : (m.better ? '#16A34A' : '#B8791A');
  const Icon = m.same ? Minus : (m.delta > 0 ? ArrowUp : ArrowDown);
  return (
    <div className="flex items-center gap-3 py-2" style={first ? undefined : { borderTop: `1px solid ${T.borderSoft}` }}>
      <div className="text-[12px] flex-1 min-w-0" style={{ color: T.inkSoft }}>{m.label}</div>
      <div className="flex items-center gap-2 flex-shrink-0 tabular-nums">
        <span className="text-sm font-semibold" style={{ color: T.ink }}>{m.fmt(m.cur)}</span>
        <span className="text-[11px]" style={{ color: T.muted }}>vs {m.fmt(m.gho)}</span>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0"
              style={{ background: tone + '1A' }}>
          <Icon size={13} style={{ color: tone }} />
        </span>
      </div>
    </div>
  );
}

export default function GhostShiftCard({ history }) {
  const { theme: T } = useTheme();
  const g = buildGhostShift(history);
  if (!g) return null;

  // First-ever scored mock — no Ghost to race yet.
  if (g.firstGhost) {
    return (
      <Card className="p-4 mb-5 anim-fadeup" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
        <div className="flex items-center gap-2 mb-1.5">
          <Ghost size={18} style={{ color: T.muted }} />
          <div className="font-display text-sm font-semibold" style={{ color: T.ink }}>No Ghost yet</div>
        </div>
        <div className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
          This score becomes your first <b>Ghost</b>. Come back in about two weeks and race it — your only opponent is the version of you from a fortnight ago.
        </div>
      </Card>
    );
  }

  const tone = VERDICT_TONE[g.verdict.kind] || T.primary;
  const rows = [g.metrics.net, g.metrics.accuracy, g.metrics.penalty, g.metrics.pace].filter(Boolean);

  return (
    <Card className="p-4 mb-5 anim-fadeup overflow-hidden" style={{ border: `1px solid ${tone}40`, background: `linear-gradient(180deg, ${tone}10, transparent)` }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: tone + '1A', border: `1px solid ${tone}40` }}>
          <Ghost size={16} style={{ color: tone }} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] font-bold" style={{ color: tone }}>The Ghost Shift</div>
          <div className="text-[11px]" style={{ color: T.muted }}>
            You vs your self from {g.gapDays} days ago{!g.ideal ? ' · closest past run' : ''}
          </div>
        </div>
      </div>

      <div className="font-display text-lg font-semibold mb-0.5" style={{ color: tone }}>{g.verdict.title}</div>
      <div className="text-[13px] leading-relaxed mb-2.5" style={{ color: T.inkSoft }}>{g.verdict.line}</div>

      <div className="rounded-xl px-3" style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}>
        {rows.map((m, i) => <MetricRow key={i} m={m} T={T} first={i === 0} />)}
      </div>

      <div className="text-[10.5px] mt-2 leading-snug" style={{ color: T.muted }}>
        Oubaitori — bloom in your own time. This is your private benchmark; it never ranks you against anyone else.
      </div>
    </Card>
  );
}
