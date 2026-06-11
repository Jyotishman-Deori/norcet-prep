// =====================================================================
// src/screens/previous-papers.jsx — Previous Year Papers list (A1 slice 14)
// Extracted from App.jsx. Body byte-identical to the original; the only
// change is the A7 hook line (T -> useTheme). All props stay props
// (papers, previousPapers, onStart, onBack); no data/profile/isAdmin used.
// =====================================================================
import React from 'react';
import { BookOpen, ClipboardList, ListChecks, Hourglass, Check, ChevronRight, Play } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import EmptyState from '../ui/empty-state.jsx';

function PreviousPapers({ papers, previousPapers, onStart, onRead, onBack }) {
  const { theme: T } = useTheme();
  const records = previousPapers || {};
  // Newest paper year first; stable within a year by original order.
  const sorted = [...(papers || [])].sort((a, b) => (b.year || 0) - (a.year || 0));

  return (
    <div className="anim-fadeup">
      <TopBar title="Previous Year Papers" onBack={onBack} feedback={{ screen: "Previous year papers" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">
        <div className="text-sm leading-relaxed mb-5" style={{ color: T.muted }}>
          Sit a full official AIIMS NORCET paper under exam conditions — or just{' '}
          <span style={{ color: T.inkSoft, fontWeight: 500 }}>read</span> through its questions
          and answers for a quick no-pressure revision session. Scores are saved per paper
          for attempted tests only.
        </div>

        {sorted.length === 0 ? (
          // #15 — admin-controlled (Type 2): reassuring "coming soon", no CTA.
          // This state shows when no previous-paper banks have been published.
          <EmptyState
            icon={ClipboardList}
            title="Papers coming soon"
            text="Official AIIMS NORCET previous year papers will appear here once uploaded." />
        ) : (
          <div className="space-y-2.5">
            {sorted.map((paper, pi) => {
              const rec = records[paper.id];
              const attempts = (rec && Array.isArray(rec.attempts)) ? rec.attempts : [];
              const attempted = attempts.length > 0;
              const last = attempted ? attempts[attempts.length - 1] : null;
              const bestNet = attempted
                ? (typeof rec.bestNet === 'number' ? rec.bestNet : Math.max(...attempts.map(a => a.netScore)))
                : null;
              const qCount = (paper.questions || []).length;
              return (
                <Card key={paper.id} className="p-4 seq-item"
                      style={{ borderTop: `3px solid ${T.sec.mock}`, animationDelay: `${Math.min(pi, 8) * 110}ms` }}>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className="font-display text-base font-semibold truncate" style={{ color: T.ink }}>
                          {paper.name}
                        </div>
                        {paper.year && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                                style={{ background: T.sec.mock, color: '#FFF' }}>
                            {paper.year}
                          </span>
                        )}
                      </div>
                      <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: T.muted }}>
                        <span className="inline-flex items-center gap-1"><ListChecks size={11} />{qCount} Qs</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1"><Hourglass size={11} />{paper.timeMinutes} min</span>
                      </div>
                      {attempted ? (
                        <div className="text-xs mt-2 flex items-center gap-2 flex-wrap" style={{ color: T.inkSoft }}>
                          <span className="inline-flex items-center gap-1" style={{ color: T.success }}>
                            <Check size={11} />Best {bestNet.toFixed(2)}
                          </span>
                          <span style={{ color: T.muted }}>· Last {last.accuracy}% · {attempts.length} attempt{attempts.length > 1 ? 's' : ''}</span>
                        </div>
                      ) : (
                        <div className="text-xs mt-2" style={{ color: T.muted }}>Not attempted yet</div>
                      )}
                    </div>
                  </div>
                  {/* #17 — two clear entry points: the timed simulation (existing,
                      unchanged) and the new calm Read Mode for quick revision. */}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => onStart(paper)}
                            className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition"
                            style={{ background: T.sec.mock, color: '#FFF' }}>
                      <Play size={13} /> Attempt
                    </button>
                    <button onClick={() => onRead && onRead(paper)}
                            className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition"
                            style={{ background: T.sec.mock + '14', color: T.sec.mock, border: `1.5px solid ${T.sec.mock}50` }}>
                      <BookOpen size={13} /> Read
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default PreviousPapers;
