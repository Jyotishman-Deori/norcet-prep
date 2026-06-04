// =====================================================================
// src/screens/previous-papers.jsx — Previous Year Papers list (A1 slice 14)
// Extracted from App.jsx. Body byte-identical to the original; the only
// change is the A7 hook line (T -> useTheme). All props stay props
// (papers, previousPapers, onStart, onBack); no data/profile/isAdmin used.
// =====================================================================
import React from 'react';
import { ClipboardList, ListChecks, Hourglass, Check, ChevronRight } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';

function PreviousPapers({ papers, previousPapers, onStart, onBack }) {
  const { theme: T } = useTheme();
  const records = previousPapers || {};
  // Newest paper year first; stable within a year by original order.
  const sorted = [...(papers || [])].sort((a, b) => (b.year || 0) - (a.year || 0));

  return (
    <div className="anim-fadeup">
      <TopBar title="Previous Year Papers" onBack={onBack} feedback={{ screen: "Previous year papers" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">
        <div className="text-sm leading-relaxed mb-5" style={{ color: T.muted }}>
          Sit a full official AIIMS NORCET paper under exam conditions — real countdown,
          negative marking, and a question palette. Your score is saved per paper so you
          can track improvement on each one.
        </div>

        {sorted.length === 0 ? (
          <Card className="p-6 text-center">
            <ClipboardList size={28} className="mx-auto mb-3" style={{ color: T.muted }} />
            <div className="text-sm" style={{ color: T.muted }}>No papers available yet.</div>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {sorted.map(paper => {
              const rec = records[paper.id];
              const attempts = (rec && Array.isArray(rec.attempts)) ? rec.attempts : [];
              const attempted = attempts.length > 0;
              const last = attempted ? attempts[attempts.length - 1] : null;
              const bestNet = attempted
                ? (typeof rec.bestNet === 'number' ? rec.bestNet : Math.max(...attempts.map(a => a.netScore)))
                : null;
              const qCount = (paper.questions || []).length;
              return (
                <Card key={paper.id} className="p-4 cursor-pointer no-tap-highlight pressable"
                      onClick={() => onStart(paper)}
                      style={{ borderTop: `3px solid ${T.sec.mock}` }}>
                  <div className="flex items-center justify-between gap-3">
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
                    <ChevronRight size={18} style={{ color: T.muted }} className="flex-shrink-0" />
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
