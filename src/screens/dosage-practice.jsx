// =====================================================================
// src/screens/dosage-practice.jsx — dosage-calculation practice (A1 slice 29)
// Extracted from App.jsx. Body byte-identical except the one A7 hook line:
//   T       -> useTheme().theme
//   IS_DARK -> useTheme().isDark   (fixed-footer bg branch)
// Props stay { onComplete, onBack }; render site UNCHANGED. Uses NO fgOnDark
// (only T + isDark), so a single useTheme() destructure suffices. Questions
// load lazily via useContent('dosage'); shuffle from lib/utils.
// =====================================================================
import React, { useState, useMemo, useCallback } from 'react';
import { Bookmark, BookmarkCheck, Calculator, Check, X, Eye, FlaskConical, Sigma, Lightbulb, SkipForward, ChevronRight } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { useContent } from '../lib/content.js';
import { useBackHandler } from '../lib/back-handler.js';
import { confirmBookmarkToggle } from '../ui/bookmark-actions.jsx';
import { Tip } from '../ui/tooltip.jsx';
import { ContentGate } from '../ui/content-gate.jsx';
import { shuffle } from '../lib/utils.js';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PulseTimer from '../ui/pulse-timer.jsx';
import { normalizePace, paceFlags } from '../lib/pace.js';
import { ConfirmExitDialog } from '../ui/confirm-exit-dialog.jsx';

// Dosage is compute-AND-type, so it gets a more generous budget than the
// aptitude MCQ tier — never rush patient-safety math into an error.
const DOSAGE_PULSE_SEC = 75;
const DOSAGE_FLASHPOINT_SEC = 40;
import HelpfulBulb from '../ui/helpful-bulb.jsx';
// Issues round — the same quick Reference lookup the other quiz modes have.
import { ReferenceLookupModal } from './reference.jsx';

function DosagePractice({ onComplete, onBack, profile, isAdmin = false, bookmarks = [], onToggleBookmark, count = 10, onlyIds = null }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { data } = useData();
  // Dosage inherits the global Pace (same Off/Pulse/Flashpoint setting). The
  // clock enforces like the other instant-feedback drills, on a generous budget.
  const { pulse: paceOn, flashpoint } = paceFlags(normalizePace(data && data.preferences));
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]);
  const [bmAnim, setBmAnim] = useState(null); // #4 — 'pop' | 'deflate' | null
  // Exit guard. Back used to wire STRAIGHT to goHome, so a half-finished calc run
  // was thrown away with no warning, while every other player (quiz.jsx,
  // advanced-test.jsx) asks first. Not resumable: the calc drill has no snapshot,
  // so this is the honest "you will lose this run" shape.
  const [confirmExit, setConfirmExit] = useState(false);
  // Issues round — Reference overlay (labs/drugs/values), same as Quick/Topic/Mock.
  const [showReference, setShowReference] = useState(false);
  // A2 — dosage questions loaded lazily from /public/data/dosage.json.
  const { data: dosageData, loading, error, reload } = useContent('dosage');
  // REDO: `onlyIds` re-runs exactly the questions the user missed last round (in
  // the same order they were served), instead of drawing a fresh random set.
  // Otherwise: a fresh shuffled draw of `count`.
  const questions = useMemo(() => {
    if (!dosageData) return [];
    if (Array.isArray(onlyIds) && onlyIds.length) {
      const byId = {};
      dosageData.forEach(q => { byId[q.id] = q; });
      return onlyIds.map(id => byId[id]).filter(Boolean);
    }
    return shuffle(dosageData).slice(0, Math.max(1, count));
  }, [dosageData, count, onlyIds]);
  const q = questions[index];

  // #4 — bookmarking a dosage question. Persists immediately via the app-level
  // toggle (the Bookmarks screen resolves dosage questions from their own pool).
  // #7 — removing one is gated by the shared caution.
  const bookmarkSet = useMemo(() => new Set(bookmarks || []), [bookmarks]);
  const isBookmarked = !!(q && bookmarkSet.has(q.id));
  const applyBookmarkToggle = () => {
    setBmAnim(isBookmarked ? 'deflate' : 'pop');
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    if (onToggleBookmark && q) onToggleBookmark(q.id);
  };
  const toggleBookmark = () => confirmBookmarkToggle(isBookmarked, applyBookmarkToggle);

  // Guard the DEVICE / gesture back too, not just the on-screen arrow. The quiz
  // is in NAV_SELF_GUARDED_SCREENS and pushes its own history entry; this drill
  // is not, so its hardware back used to fall through to App's global handler and
  // go straight home. App consults this registry before navigating, so returning
  // true here routes the press through the same confirm the arrow uses. Only
  // while a run is on screen (`q` exists); the empty state keeps its plain back.
  useBackHandler(useCallback(() => {
    if (confirmExit) { setConfirmExit(false); return true; }
    setConfirmExit(true);
    return true;
  }, [confirmExit]), !!q);

  if (!q) {
    // A2 — show a load/retry state while the question bank is fetching, and a
    // genuine "no questions" only once data has arrived but is empty.
    if (!dosageData && (loading || error)) {
      return (
        <div className="anim-fadeup">
          <TopBar title="Nursing Calc Test" onBack={onBack} />
          <div className="max-w-md mx-auto px-4">
            <ContentGate loading={loading} error={error} onRetry={reload} label="dosage questions" />
          </div>
        </div>
      );
    }
    // Data arrived but is empty. This used to render a bare line with NO TopBar
    // and NO back button, stranding the user with nothing but a page reload.
    return (
      <div className="anim-fadeup">
        <TopBar title="Nursing Calc Test" onBack={onBack} />
        <div className="p-6 max-w-md mx-auto text-center pt-16">
          <div className="font-display text-xl mb-2" style={{ color: T.ink }}>No questions available</div>
          <div className="text-sm" style={{ color: T.muted }}>
            The calculation bank could not be loaded. Please try again in a moment.
          </div>
        </div>
      </div>
    );
  }

  const userValue = parseFloat(input);
  const isValidInput = !isNaN(userValue) && input.trim() !== '';
  const isCorrect = isValidInput && Math.abs(userValue - q.answer) <= q.tolerance;
  // A question is "resolved" once it's been checked or its answer revealed —
  // both lock the input and surface the worked solution.
  const done = submitted || revealed;

  // Advance to the next question, or finish. `finalResults` is passed
  // explicitly so a skip on the LAST question still hands a complete set to
  // onComplete (state updates wouldn't have flushed yet).
  const goNext = (finalResults) => {
    if (index + 1 < questions.length) {
      setIndex(i => i + 1);
      setInput('');
      setSubmitted(false);
      setRevealed(false);
    } else {
      onComplete(finalResults, questions);
    }
  };

  const submit = () => {
    if (!isValidInput) return;
    setResults(r => [...r, { qId: q.id, correct: isCorrect, userAnswer: userValue }]);
    setSubmitted(true);
  };

  // Reveal the answer without judging the user — recorded as not-correct but
  // tagged `revealed` so results can show it as "revealed" rather than "wrong".
  const reveal = () => {
    setResults(r => [...r, { qId: q.id, correct: false, revealed: true, userAnswer: null }]);
    setRevealed(true);
  };

  // Skip straight past — recorded as `skipped` and excluded from accuracy.
  const skip = () => {
    const entry = { qId: q.id, correct: false, skipped: true, userAnswer: null };
    setResults(r => [...r, entry]);
    goNext([...results, entry]);
  };

  const next = () => goNext(results);

  // Pulse/Flashpoint — the clock enforces: a valid answer auto-checks; an empty
  // field reveals the worked solution (recorded as revealed, not a harsh wrong).
  const onTimerExpire = () => {
    if (done) return;
    if (isValidInput) submit();
    else reveal();
  };

  const progress = ((index + (done ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="test-enter">
      {/* Issues round — the counter is a separated chip (was running straight
          into the title as "Dosage calculation test1/10"). */}
      {/* Only nag if there is something to lose: leaving before answering anything
          costs nothing, so do not put a dialog in the way of that. */}
      <TopBar title="Nursing Calc Test"
              onBack={() => setConfirmExit(true)}
              feedback={{ screen: "Nursing calc" }}
              right={<div className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full flex-shrink-0"
                          style={{ color: T.inkSoft, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                       {index + 1} / {questions.length}
                     </div>} />

      <div className="max-w-md mx-auto px-4 pb-40 pt-3">
        {/* Progress */}
        <div className="h-1.5 rounded-full mb-6" style={{ background: T.borderSoft }}>
          <div className="h-1.5 rounded-full transition-all duration-300" style={{ background: T.primary, width: `${progress}%` }} />
        </div>

        {/* NEW-03 — optional Pulse/Flashpoint (inherits the global Pace). Generous
            budget; the clock enforces but reveals the solution on an empty timeout. */}
        {paceOn && (
          <PulseTimer budgetSec={flashpoint ? DOSAGE_FLASHPOINT_SEC : DOSAGE_PULSE_SEC}
                      resetKey={q.id} flashpoint={flashpoint}
                      onExpire={onTimerExpire} paused={done} T={T} />
        )}

        {/* Order card — reads like a prescription */}
        <Card className="p-5 mb-5" style={{ borderLeft: `3px solid ${T.primary}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: T.primary + '14', color: T.primary }}>
              <Calculator size={11} /> {q.type}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Order</span>
              {onToggleBookmark && (
                <Tip text={isBookmarked ? 'Bookmarked: tap to remove' : 'Save this question to Bookmarks for later review'}>
                <button onClick={toggleBookmark}
                        aria-pressed={isBookmarked}
                        aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this question'}
                        className="no-tap-highlight p-1 -mr-1 rounded-full active:bg-black/5 flex-shrink-0">
                  <span className={"inline-block " + (bmAnim === 'pop' ? 'bm-pop' : bmAnim === 'deflate' ? 'bm-deflate' : '')}
                        key={bmAnim ? `${q.id}:${isBookmarked}` : q.id}
                        style={{ lineHeight: 0 }}>
                    {isBookmarked
                      ? <BookmarkCheck size={18} className="text-accent" />
                      : <Bookmark size={18} className="text-muted" />}
                  </span>
                </button>
                </Tip>
              )}
            </div>
          </div>
          <div className="font-display text-xl leading-snug whitespace-pre-wrap" style={{ color: T.ink }}>
            {q.q}
          </div>
        </Card>

        {/* Answer input — calculator-style field */}
        <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 px-1" style={{ color: T.muted }}>Your answer</div>
        <div className="relative mb-2">
          <input type="text" inputMode="decimal" value={input}
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter' && !done) submit(); }}
                 disabled={done}
                 placeholder="Enter your answer"
                 className="w-full rounded-2xl pl-5 pr-24 py-5 text-3xl font-display font-semibold tabular-nums outline-none dosage-input"
                 style={{ background: T.surface,
                          border: `1.5px solid ${submitted ? (isCorrect ? T.success : T.error) : revealed ? T.primary : T.border}`,
                          color: submitted ? (isCorrect ? T.success : T.error) : T.ink,
                          boxShadow: '0 1px 2px rgba(26,43,35,0.04)' }} />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold px-3 py-1.5 rounded-xl"
               style={{ background: T.surfaceWarm, color: T.muted }}>
            {q.unit}
          </div>
        </div>
        {q.tolerance > 0 && !done && (
          <div className="text-xs mb-4 px-1" style={{ color: T.muted }}>Accepted within ±{q.tolerance} {q.unit}</div>
        )}

        {done && (
          <div className="anim-fadeup space-y-3 mt-5">
            {submitted ? (
              <Card className="p-4" style={{ background: isCorrect ? T.successSoft : T.errorSoft,
                                              border: `1px solid ${isCorrect ? T.success : T.error}40` }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: isCorrect ? T.success : T.error }}>
                    {isCorrect ? <Check size={14} style={{ color: '#FFF' }} /> : <X size={14} style={{ color: '#FFF' }} />}
                  </span>
                  <div className="font-display text-base font-semibold" style={{ color: isCorrect ? T.success : T.error }}>
                    {isCorrect ? 'Correct' : 'Not quite'}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: T.muted }}>You gave</div>
                    <div className="font-semibold tabular-nums" style={{ color: T.inkSoft }}>{userValue} {q.unit}</div>
                  </div>
                  {!isCorrect && (
                    <>
                      <div className="w-px self-stretch" style={{ background: T.error + '30' }} />
                      <div>
                        <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: T.muted }}>Correct</div>
                        <div className="font-semibold tabular-nums" style={{ color: T.success }}>{q.answer} {q.unit}</div>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-4" style={{ background: T.primary + '12', border: `1px solid ${T.primary}33` }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: T.primary }}>
                    <Eye size={14} style={{ color: '#FFF' }} />
                  </span>
                  <div className="font-display text-base font-semibold" style={{ color: T.primary }}>Answer revealed</div>
                </div>
                <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: T.muted }}>Correct answer</div>
                <div className="font-display text-2xl font-semibold tabular-nums" style={{ color: T.ink }}>{q.answer} {q.unit}</div>
              </Card>
            )}

            <Card className="p-4" style={{ background: T.surfaceWarm }}>
              <div className="flex items-center gap-2 mb-3">
                <Sigma size={14} style={{ color: T.accent }} />
                <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Worked solution</div>
              </div>
              <ol className="space-y-3">
                {q.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold mt-0.5"
                          style={{ background: T.primary, color: '#FFF' }}>
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed font-mono" style={{ color: T.ink }}>{step}</span>
                  </li>
                ))}
              </ol>
              {q.intuition && (
                <div className="mt-4 rounded-xl p-3.5" style={{ background: T.accent + '12', border: `1px solid ${T.accent}2E` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Lightbulb size={14} style={{ color: T.accent }} />
                    <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Why it works</div>
                  </div>
                  <div className="text-sm leading-relaxed" style={{ color: T.ink }}>{q.intuition}</div>
                </div>
              )}
            </Card>

            {/* #9 — was this explanation helpful? (per dosage question) */}
            <Card className="p-4">
              <HelpfulBulb voteId={`dosageq:${q.id}`} profileId={profile ? profile.id : null} isAdmin={isAdmin} />
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 backdrop-blur-md"
           style={{ background: IS_DARK ? 'rgba(21,19,15,0.9)' : T.bg + 'E6', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          {/* Quick reference — identical position + behaviour to the other
              quiz modes (issues round: it was missing from Dosage). */}
          <div className="flex justify-center mb-2">
            <button onClick={() => setShowReference(true)}
                    className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition"
                    style={{ background: T.surfaceWarm, color: T.accent, border: `1px solid ${T.border}` }}>
              <FlaskConical size={12} />
              Reference
            </button>
          </div>
          {!done ? (
            <div className="space-y-2.5">
              {/* Morphing primary: empty field -> neutral "Submit" (reveals the
                  worked solution, no accuracy hit); a value typed -> "Check
                  answer". Clearing the field morphs it straight back. */}
              {(() => {
                const hasInput = isValidInput;
                return (
                  <button onClick={hasInput ? submit : reveal}
                          aria-label={hasInput ? 'Check answer' : 'Submit without answering'}
                          className={'no-tap-highlight w-full rounded-2xl py-3.5 font-semibold text-base active:brightness-95 transition-[background-color,color,box-shadow,border-color] duration-300 ease-out' + (hasInput ? ' qbtn-ready' : '')}
                          style={hasInput
                            ? { background: T.primary, color: '#FFF', border: '1.5px solid transparent', boxShadow: `0 10px 26px ${T.primary}45` }
                            : { background: T.primary + '12', color: T.primary, border: `1.5px solid ${T.primary}33`, boxShadow: 'none' }}>
                    <span key={hasInput ? 'check' : 'submit'} className="qbtn-label inline-flex items-center justify-center gap-2">
                      {hasInput ? <><Check size={18} /> Check answer</> : <>Submit</>}
                    </span>
                  </button>
                );
              })()}
              <Button variant="ghost" onClick={skip} size="md" className="w-full" icon={<SkipForward size={16} />}>
                Skip
              </Button>
            </div>
          ) : (
            <Button onClick={next} size="lg" className="w-full" icon={<ChevronRight size={18} />}>
              {index + 1 < questions.length ? 'Next question' : 'Finish'}
            </Button>
          )}
        </div>
      </div>

      {/* Reference lookup overlay */}
      <ReferenceLookupModal open={showReference} onClose={() => setShowReference(false)} />

      {/* Exit guard — same shape the Quiz uses for a non-resumable run. */}
      {confirmExit && (
        <ConfirmExitDialog mode="dosage" answered={results.length} total={questions.length}
                           timed={false} resumable={false}
                           onStay={() => setConfirmExit(false)}
                           onLeave={() => { setConfirmExit(false); onBack(); }} />
      )}
    </div>
  );
}

export default DosagePractice;
