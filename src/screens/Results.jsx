// =====================================================================
// RESULTS SCREEN  (Pipeline step 38 / A1 session 4 — extracted from App.jsx)
// Verbatim screen body. A7 migration: theme via useTheme() (was the module-
// level T bridge). Results is purely presentational — it consumes only nav
// props (results/questions/elapsed/...), so it needs NO useData/useProfile.
// The result cards it renders now come from ../ui/result-cards.jsx.
// =====================================================================
import React, { useEffect, useState } from 'react';
import { Check, Timer, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { topicIcon, topicName } from '../lib/topics.js';
import { Button, Card } from '../ui/primitives.jsx';
import { GuestSavePrompt, MotivationCard, ShareScoreButton, TimeQuadrant } from '../ui/result-cards.jsx';


function Results({ results, questions, elapsed, onHome, onReview,
                   displayName = null, streak = 0, quizType = 'Quick Test',
                   isGuest = false, onGuestSignIn, onCribSheet = null }) {
  const { theme: T } = useTheme();
  const total = results.length;
  const correct = results.filter(r => r.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const wrong = results.filter(r => !r.correct);

  // P5 — derive the topic for the share card only when this round is clearly
  // single-topic (all questions share one topic). Mixed rounds → no topic line.
  const shareTopic = (() => {
    if (!Array.isArray(questions) || questions.length === 0) return null;
    const first = questions[0] && questions[0].topic;
    if (!first) return null;
    return questions.every(q => q && q.topic === first) ? topicName(first) : null;
  })();

  const verdict =
    pct >= 90 ? { word: 'Exceptional', color: T.success } :
    pct >= 75 ? { word: 'Strong work', color: T.success } :
    pct >= 60 ? { word: 'Solid effort', color: T.primary } :
    pct >= 40 ? { word: 'Keep going', color: T.accent } :
                { word: 'Time to learn', color: T.error };

  const fmtTime = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;

  // #25 — score reveal: the percentage counts up from 0 alongside the ring
  // draw (the ring already animates via stroke-dasharray). 800ms ease-out;
  // reduced-motion users see the final value immediately.
  const [shownPct, setShownPct] = useState(0);
  useEffect(() => {
    let raf = null;
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || pct === 0) { setShownPct(pct); return; }
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / 800);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setShownPct(Math.round(pct * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [pct]);

  return (
    <div className="anim-fadeup max-w-md mx-auto px-4 pt-8 pb-24">
      <MotivationCard pct={pct} label="round" />
      {isGuest && <GuestSavePrompt onSignIn={onGuestSignIn} />}
      <div className="text-center mb-8">
        <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>Session complete</div>
        <div className="font-display text-3xl font-semibold mb-1" style={{ color: verdict.color }}>{verdict.word}</div>
        <div className="text-sm" style={{ color: T.muted }}>{correct} of {total} correct</div>
      </div>

      {/* Big score circle */}
      <div className="flex justify-center mb-8">
        <div className="relative w-44 h-44">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke={T.borderSoft} strokeWidth="7" />
            <circle cx="50" cy="50" r="44" fill="none" stroke={verdict.color} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * 276.46} 276.46`}
                    style={{ transition: 'stroke-dasharray 0.8s ease-out' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-display text-5xl font-semibold tabular-nums" style={{ color: T.ink }}>{shownPct}<span className="text-2xl" style={{ color: T.muted }}>%</span></div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {elapsed > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-8">
          <Card className="p-3 text-center">
            <Check size={16} className="mx-auto mb-1" style={{ color: T.success }} />
            <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>{correct}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Correct</div>
          </Card>
          <Card className="p-3 text-center">
            <X size={16} className="mx-auto mb-1" style={{ color: T.error }} />
            <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>{total - correct}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Wrong</div>
          </Card>
          <Card className="p-3 text-center">
            <Timer size={16} className="mx-auto mb-1" style={{ color: T.primary }} />
            <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>{fmtTime(elapsed)}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Time</div>
          </Card>
        </div>
      )}

      {/* P12 — per-question time quadrant. Quick rounds are untimed:
          baseline 60s/Q, "slow" = >90s. The Quiz already records a
          `revealed` flag on show-answer attempts; those carry through as
          "Not attempted" here (a quick round has no true blank). totalSec
          falls back to the sum of per-question times when `elapsed`
          wasn't tracked, so the summary line is always meaningful. */}
      {total > 0 && (
        <TimeQuadrant
          mode="quick"
          slowSec={90}
          idealSec={null}
          totalSec={elapsed > 0 ? elapsed : Math.round(results.reduce((a, r) => a + (Number(r.timeMs) || 0), 0) / 1000)}
          items={results.map(r => ({
            qId: r.qId,
            q: questions.find(qq => qq.id === r.qId),
            outcome: r.revealed ? 'na' : (r.correct ? 'correct' : 'wrong'),
            seconds: (Number(r.timeMs) || 0) / 1000,
          }))}
        />
      )}

      {/* Wrong question list */}
      {wrong.length > 0 && (
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: T.muted }}>To revise</div>
          <div className="space-y-2">
            {wrong.map(r => {
              const q = questions.find(qq => qq.id === r.qId);
              if (!q) return null;
              return (
                <Card key={r.qId} className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="text-base flex-shrink-0">{topicIcon(q.topic)}</div>
                    <div className="text-sm leading-snug" style={{ color: T.ink }}>{q.q}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Post-test actions (issues round) — one clear hierarchy:
            PRIMARY    Review answers — Crib Sheet (the learning action)
            SECONDARY  Re-do the wrong ones · Share score (a balanced pair)
            TERTIARY   Back to home (a quiet text action, never competing) */}
      <div className="space-y-2.5">
        {/* #28 — opt-in Crib Sheet review. App passes onCribSheet=null when the
            Settings toggle (#29) is off, so the prompt vanishes entirely. */}
        {onCribSheet && (
          <Button onClick={onCribSheet} size="lg" className="w-full">
            Review answers — Crib Sheet
          </Button>
        )}
        <div className={`grid gap-2.5 ${wrong.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {wrong.length > 0 && (
            <Button onClick={() => onReview(wrong.map(r => r.qId))} variant="ghost" size="md" className="w-full">
              Re-do wrong ones
            </Button>
          )}
          <ShareScoreButton correct={correct} total={total} quizType={quizType}
                            topicName={shareTopic} displayName={displayName} streak={streak}
                            size="md" />
        </div>
        <button onClick={onHome}
                className="no-tap-highlight w-full py-3 text-sm font-medium active:scale-95 transition rounded-xl"
                style={{ color: T.muted, background: 'transparent' }}>
          Back to home
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// LEARN — Topic List
// =====================================================================

export default Results;
