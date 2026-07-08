// =====================================================================
// src/screens/dosage-results.jsx — Dosage practice results (A1 slice 15)
// Extracted from App.jsx. Body byte-identical; only change is the A7 hook
// line (T -> useTheme). All props stay (results, questions, onHome,
// displayName, streak). No data/profile/isAdmin used.
// =====================================================================
import React from 'react';
import { Calculator, Check, Eye, SkipForward, X, ClipboardList } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import { MotivationCard, ShareScoreButton } from '../ui/result-cards.jsx';
import { referralCodeFor } from '../lib/referral.js';
import HelpfulBulb from '../ui/helpful-bulb.jsx';

function DosageResults({ results, questions, onHome, displayName = null, streak = 0, profile, isAdmin = false, onCribSheet = null }) {
  const { theme: T } = useTheme();
  const referralCode = referralCodeFor(profile);   // null for guests (Phase-1 referrals)
  // Accuracy is measured only over genuinely attempted questions — skipped and
  // revealed items are study actions, not failures, so they don't drag the score.
  const attempted = results.filter(r => !r.skipped && !r.revealed);
  const correct = attempted.filter(r => r.correct).length;
  const total = attempted.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const wrongCount = attempted.filter(r => !r.correct).length;
  const skippedCount = results.filter(r => r.skipped).length;
  const revealedCount = results.filter(r => r.revealed).length;
  // Everything worth another look: wrong attempts, revealed, and skipped.
  const toRevise = results.filter(r => !r.correct);

  const scoreColor = pct >= 75 ? T.success : pct >= 50 ? T.primary : T.error;

  return (
    <div className="anim-fadeup max-w-md mx-auto px-4 pt-8 pb-24">
      <MotivationCard pct={pct} label="calc" />

      {/* Score summary */}
      <Card className="p-6 mb-5">
        <div className="flex items-center gap-5">
          {/* Score ring */}
          <div className="relative flex-shrink-0" style={{ width: 92, height: 92 }}>
            <svg width="92" height="92" viewBox="0 0 92 92" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="46" cy="46" r="40" fill="none" stroke={T.borderSoft} strokeWidth="7" />
              <circle cx="46" cy="46" r="40" fill="none" stroke={scoreColor} strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - pct / 100)}
                      style={{ transition: 'stroke-dashoffset 0.6s ease-out' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-2xl font-semibold leading-none" style={{ color: scoreColor }}>{pct}%</div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Calculator size={13} style={{ color: T.muted }} />
              <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Dosage test complete</div>
            </div>
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>
              {total > 0 ? `${correct} of ${total} correct` : 'No questions attempted'}
            </div>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {correct > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: T.successSoft, color: T.success }}>
                  <Check size={11} /> {correct} right
                </span>
              )}
              {wrongCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: T.errorSoft, color: T.error }}>
                  <X size={11} /> {wrongCount} to fix
                </span>
              )}
              {revealedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: T.primary + '14', color: T.primary }}>
                  <Eye size={11} /> {revealedCount} revealed
                </span>
              )}
              {skippedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: T.surfaceWarm, color: T.muted }}>
                  <SkipForward size={11} /> {skippedCount} skipped
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {toRevise.length > 0 && (
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-widest font-semibold mb-3 px-1" style={{ color: T.muted }}>To revise</div>
          <div className="space-y-2.5">
            {toRevise.map(r => {
              const q = questions.find(qq => qq.id === r.qId);
              if (!q) return null;
              const tag = r.skipped ? { label: 'Skipped', Icon: SkipForward, color: T.muted, edge: T.muted }
                        : r.revealed ? { label: 'Revealed', Icon: Eye, color: T.primary, edge: T.primary }
                        : { label: 'Incorrect', Icon: X, color: T.error, edge: T.error };
              return (
                <Card key={r.qId} className="p-4" style={{ borderLeft: `3px solid ${tag.edge}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: tag.color + '18', color: tag.color }}>
                      <tag.Icon size={9} /> {tag.label}
                    </span>
                    <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>{q.type}</span>
                  </div>
                  <div className="text-sm leading-snug mb-3" style={{ color: T.ink }}>{q.q}</div>
                  <div className="flex items-center gap-4 text-xs">
                    {r.userAnswer != null && (
                      <>
                        <div>
                          <span className="uppercase tracking-wider text-[9px]" style={{ color: T.muted }}>You gave</span>
                          <div className="font-semibold tabular-nums" style={{ color: T.error }}>{r.userAnswer} {q.unit}</div>
                        </div>
                        <div className="w-px self-stretch" style={{ background: T.borderSoft }} />
                      </>
                    )}
                    <div>
                      <span className="uppercase tracking-wider text-[9px]" style={{ color: T.muted }}>Correct</span>
                      <div className="font-semibold tabular-nums" style={{ color: T.success }}>{q.answer} {q.unit}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* #9 — overall: was this dosage session helpful & well structured? */}
      <Card className="p-4 mb-5">
        <div className="text-[10px] uppercase tracking-widest font-semibold mb-2.5" style={{ color: T.muted }}>Rate this session</div>
        <HelpfulBulb voteId="dosagetest" profileId={profile ? profile.id : null} isAdmin={isAdmin} />
      </Card>

      {/* P5 — share the dosage-drill score (over genuinely attempted items). */}
      <div className="space-y-2">
        {onCribSheet && (
          <Button variant="ghost" onClick={onCribSheet} size="lg" className="w-full" icon={<ClipboardList size={16} />}>
            Review answers: Crib Sheet
          </Button>
        )}
        <ShareScoreButton correct={correct} total={total} quizType="Dosage Drill"
                          displayName={displayName} streak={streak} referralCode={referralCode} />
        <Button onClick={onHome} size="lg" className="w-full">Back to home</Button>
      </div>
    </div>
  );
}

export default DosageResults;
