// =====================================================================
// QUIZ SCREEN  (Pipeline step 38 / A1 session 4 — batch 1b slice 7 —
// extracted from App.jsx)
// The core question-runner: renders one question at a time (MCQ/MSQ),
// handles selection, reveal, bookmarking, per-question timing, the
// reference lookup, and exit confirmation; calls onComplete with the run.
// [A7] theme + isDark via useTheme(); app data via useData(); the
// per-run config + callbacks stay props. profileId stays a prop (scalar,
// forwarded to HelpfulToggle). The previously-passed `allQuestions` prop
// was dead in the body and has been dropped.
// =====================================================================
import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Bookmark, BookmarkCheck, Brain, Check, ChevronRight, Eye, Flag, FlaskConical, Lightbulb, Timer, X } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { topicName, topicColor, topicIcon } from '../lib/topics.js';
import { arraysEqualUnordered } from '../lib/utils.js';
import { loadQDoubts, saveQDoubts, toggleQDoubt } from '../lib/qdoubts.js';
// TIP — hold (mobile) / hover (PC) info bubbles on quiz chrome.
import { Tip } from '../ui/tooltip.jsx';
import { Card, Button, Pill, PyqBadge, TopBar } from '../ui/primitives.jsx';
import { QuestionImage, TTSButton, HelpfulToggle } from '../ui/question-widgets.jsx';
import { ConfirmExitDialog } from '../ui/confirm-exit-dialog.jsx';
import { confirmBookmarkToggle } from '../ui/bookmark-actions.jsx';
import { ReferenceLookupModal } from './reference.jsx';

function Quiz({ questions, mode, onComplete, onBack, timed, timeLimitMin, profileId }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { data } = useData();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);   // user tapped "Show answer" without selecting
  const [results, setResults] = useState([]);        // per question { qId, correct, selected, timeMs, revealed? }
  const [bookmarkedLocal, setBookmarkedLocal] = useState(new Set(data.bookmarks));
  // For count-down (mock): seconds remaining. For count-up (legacy): seconds elapsed.
  // `isCountdown` is the single switch: true iff timeLimitMin > 0.
  const isCountdown = !!(timed && timeLimitMin && timeLimitMin > 0);
  const totalSeconds = isCountdown ? timeLimitMin * 60 : 0;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const [elapsed, setElapsed] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [altShown, setAltShown] = useState(false);
  // #18 — question solution flags ("explanation still unclear"). Loaded once;
  // toggled from the explanation card; persisted on every toggle.
  const [qDoubts, setQDoubts] = useState({});
  useEffect(() => {
    let alive = true;
    if (profileId) loadQDoubts(profileId).then(m => { if (alive) setQDoubts(m); }).catch(() => {});
    return () => { alive = false; };
  }, [profileId]);
  const toggleSolutionFlag = () => {
    if (!profileId) return;
    const next = toggleQDoubt(qDoubts, q);
    setQDoubts(next);
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); } catch (e) {}
    saveQDoubts(profileId, next);
  };
  // #19/#23 — bookmark micro-interaction: pop on set, deflate on unset.
  const [bmAnim, setBmAnim] = useState(null); // 'pop' | 'deflate' | null

  // Skip queue. When the user taps "Skip" we move the current question to the
  // end of the round so they can try the rest first. Tracking is by question
  // ID (not index) because positions in `questions` are stable but our
  // traversal is dynamic.
  //
  // `schedule` is the actual play order. It starts as 0..n-1. Skipping the
  // current item moves its INDEX (into `questions`) to the end of `schedule`.
  // If a question is skipped twice, it stays where it is (cap loop) and
  // continues to the next item.
  const [schedule, setSchedule] = useState(() => questions.map((_, i) => i));
  const [skipCounts, setSkipCounts] = useState({});   // qId -> number of times skipped
  // Confirm-before-exit. The user can lose meaningful progress if they tap
  // back accidentally — and they will, on phones. Any tap on Back during an
  // active test routes through this dialog instead of immediately exiting.
  // The dialog is also triggered when the device's back button or browser
  // back fires (popstate handler below).
  const [confirmExit, setConfirmExit] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const questionStart = useRef(Date.now());

  // Mode capabilities:
  //   - Hints & Show-answer are study aids — Quick Practice only.
  //   - Skip exists in Quick AND Mock. In Mock it mirrors real exam strategy:
  //     defer hard questions, attempt easy ones first. The "Show answer"
  //     bypass stays gated so mocks remain content-honest.
  const isPractice = mode === 'quick';
  const hintsAllowed = isPractice;
  const showAnswerAllowed = isPractice;
  const skipAllowed = isPractice || mode === 'mock';

  // Position in the schedule, not in the original `questions` array.
  const scheduleIndex = index;
  const realIndex = schedule[scheduleIndex];
  const q = questions[realIndex];

  // How many questions remain AFTER this one in the current schedule.
  const remainingAfter = schedule.length - scheduleIndex - 1;
  const canSkip = skipAllowed && !submitted && !revealed && remainingAfter > 0;

  // Time tracking. For mock we count DOWN from totalSeconds; for any other
  // timed mode we count UP (legacy behaviour, unused today but kept for
  // future modes). When countdown hits zero, finish the test with whatever
  // we have. `elapsed` is always reported to onComplete as time spent.
  useEffect(() => {
    if (!timed) return;
    const t = setInterval(() => {
      if (isCountdown) {
        setSecondsRemaining(s => {
          if (s <= 1) {
            clearInterval(t);
            return 0;
          }
          return s - 1;
        });
        setElapsed(e => e + 1);
      } else {
        setElapsed(e => e + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [timed, isCountdown]);

  // Auto-finish when the countdown hits 0. Submits whatever's been answered.
  // We defer to a tick so React commits state cleanly before navigating away.
  useEffect(() => {
    if (!isCountdown) return;
    if (secondsRemaining > 0) return;
    // Avoid double-fire by checking against a ref-less guard: just run once.
    const id = setTimeout(() => onComplete(results, bookmarkedLocal, elapsed, skipCounts), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCountdown, secondsRemaining]);

  // Intercept device/browser back button so it routes through the confirm
  // dialog too — same rule as the in-app back arrow. We push a placeholder
  // history entry on mount; when the user fires back, popstate triggers, we
  // push the entry again (cancelling the navigation) and show the confirm.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;
    window.history.pushState({ quizGuard: true }, '');
    const onPop = (e) => {
      // Each pop consumes the guard entry; push another so the next back
      // tap is intercepted too. Then surface the confirm.
      window.history.pushState({ quizGuard: true }, '');
      setConfirmExit(true);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Best-effort: on normal completion or programmatic exit we leave the
      // guard entry in place. Browsers collapse forward stack on next nav so
      // this doesn't pollute history meaningfully.
    };
  }, []);

  // Reset question start time + hint/reveal visibility on every question change
  useEffect(() => {
    questionStart.current = Date.now();
    setHintShown(false);
    setAltShown(false);
    setRevealed(false);
  }, [index]);

  if (!q) {
    const emptyTitle = mode === 'bookmarks' ? 'Bookmarks'
      : mode === 'review-due' ? 'Review'
      : mode === 'wrong' ? 'Review'
      : 'Practice';
    return (
      <div className="anim-fadeup">
        <TopBar title={emptyTitle} onBack={onBack}
                feedback={{ screen: `Quiz · ${mode || 'practice'} (empty)` }} />
        <div className="p-6 text-center max-w-md mx-auto pt-16">
          <div className="font-display text-xl mb-2 text-ink">No questions available</div>
          <div className="text-sm text-muted">
            {mode === 'bookmarks' && 'You have no bookmarked questions yet — bookmark a few during practice, then come back.'}
            {mode === 'review-due' && 'Nothing is due for review yet — come back tomorrow.'}
            {mode === 'wrong' && 'No wrong answers to review.'}
            {!['bookmarks', 'review-due', 'wrong'].includes(mode) && 'Nothing to show here.'}
          </div>
        </div>
      </div>
    );
  }

  const toggleSelect = (i) => {
    if (submitted || revealed) return;
    if (q.type === 'mcq') setSelected([i]);
    else setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const submit = () => {
    if (selected.length === 0) return;
    const correct = arraysEqualUnordered(selected, q.correct);
    const timeMs = Date.now() - questionStart.current;
    setResults(r => [...r, { qId: q.id, correct, selected, timeMs }]);
    setSubmitted(true);
  };

  // "Show answer" — reveals the explanation without an attempt. Recorded as
  // INCORRECT (so the question feeds into spaced repetition and Weak Areas),
  // with `revealed: true` so future stats can distinguish a true miss from
  // a "didn't try". The submitted/revealed flags both gate option taps so
  // the user can't sneakily turn a reveal into a free correct answer.
  const revealAnswer = () => {
    if (submitted || revealed) return;
    const timeMs = Date.now() - questionStart.current;
    setResults(r => [...r, { qId: q.id, correct: false, selected: [], timeMs, revealed: true }]);
    setRevealed(true);
  };

  // "Skip" — defer this question to the end of the round so the user can
  // attempt easier ones first. Each question can only be skipped twice
  // before it sticks in place; this caps the worst-case "infinite skip" loop.
  const skipQuestion = () => {
    if (!canSkip) return;
    const qId = q.id;
    const skips = skipCounts[qId] || 0;

    setSkipCounts(s => ({ ...s, [qId]: skips + 1 }));

    if (skips >= 1) {
      // Already skipped once — leave in place and just advance the cursor.
      // (We'd otherwise risk shuffling the queue forever.)
      setSelected([]);
      setIndex(i => i + 1);
      return;
    }

    // Move the realIndex from `scheduleIndex` to the end of the schedule.
    setSchedule(prev => {
      const next = prev.slice();
      const [moved] = next.splice(scheduleIndex, 1);
      next.push(moved);
      return next;
    });
    setSelected([]);
    // Stay at the same scheduleIndex — the next question now occupies it.
    // Force a question-change effect by bumping a non-existent state? No —
    // schedule itself changed, so q updates automatically. Reset per-question
    // state explicitly here since the index didn't change.
    questionStart.current = Date.now();
    setHintShown(false);
    setAltShown(false);
    setRevealed(false);
  };

  const next = () => {
    if (scheduleIndex + 1 < schedule.length) {
      setIndex(i => i + 1);
      setSelected([]);
      setSubmitted(false);
      setRevealed(false);
    } else {
      onComplete(results, bookmarkedLocal, elapsed, skipCounts);
    }
  };

  const applyBookmarkToggle = () => {
    const newSet = new Set(bookmarkedLocal);
    if (newSet.has(q.id)) { newSet.delete(q.id); setBmAnim('deflate'); }
    else { newSet.add(q.id); setBmAnim('pop'); }
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    setBookmarkedLocal(newSet);
  };
  // #7 — removing a bookmark asks first; adding stays frictionless.
  const toggleBookmark = () => confirmBookmarkToggle(bookmarkedLocal.has(q.id), applyBookmarkToggle);

  // Progress reflects how far along the schedule (which may include re-queued
  // skipped items), not the original questions array.
  const progress = ((scheduleIndex + ((submitted || revealed) ? 1 : 0)) / schedule.length) * 100;
  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <>
    <div className="test-enter">
      <TopBar
        title={`Q ${scheduleIndex + 1} of ${schedule.length}`}
        onBack={() => setConfirmExit(true)}
        feedback={{ screen: `Quiz · ${mode || 'practice'}`, questionId: q.id }}
        right={
          <div className="flex items-center gap-2">
            {timed && (() => {
              // Countdown: show time remaining; flash red when under a minute.
              // Count-up: show elapsed (legacy).
              const displaySec = isCountdown ? secondsRemaining : elapsed;
              const lowTime   = isCountdown && secondsRemaining <= 60 && secondsRemaining > 0;
              const noTime    = isCountdown && secondsRemaining === 0;
              // #26 — heartbeat pulse on the timer chip as the countdown ends:
              // 1 pulse/s under 10s, 2 pulses/s under 3s. Reduced-motion safe.
              const beatClass = isCountdown && secondsRemaining > 0
                ? (secondsRemaining <= 3 ? ' timer-beat-fast' : secondsRemaining <= 10 ? ' timer-beat' : '')
                : '';
              const bg = noTime ? T.errorSoft : (lowTime ? T.errorSoft : T.surfaceWarm);
              const fg = (lowTime || noTime) ? T.error : T.ink;
              return (
                <Tip text={isCountdown ? 'Time remaining — the chip pulses in the final seconds' : 'Time elapsed on this session'}>
                <div className={"flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tabular-nums" + beatClass}
                     style={{ background: bg, color: fg }}>
                  <Timer size={12} />
                  {fmtTime(displaySec)}
                </div>
                </Tip>
              );
            })()}
          </div>
        }
      />

      <div className="max-w-md mx-auto px-4 pb-40 pt-2">
        {/* Progress */}
        <div className="mb-5">
          <div className="h-1 rounded-full" style={{ background: T.borderSoft }}>
            <div className="h-1 rounded-full transition-all duration-300" style={{ background: T.primary, width: `${progress}%` }} />
          </div>
        </div>

        {/* Topic + type pills — #4: the bookmark sits at the rightmost edge of
            this tags row, inline with the question's metadata (same position
            in every test type). */}
        <div className="flex items-start gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <Pill bg={topicColor(q.topic) + '15'} color={topicColor(q.topic)}>
              {topicIcon(q.topic)} {topicName(q.topic)}
            </Pill>
            {q.sub && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{q.sub}</Pill>}
            <Pill bg={q.type === 'msq' ? T.errorSoft : T.successSoft} color={q.type === 'msq' ? T.error : T.success}>
              {q.type === 'msq' ? 'Multi-select' : 'Single answer'}
            </Pill>
            {/* P16 — provenance badge (Quick / Topic / Mock all render via Quiz) */}
            <PyqBadge q={q} />
          </div>
          <Tip text={bookmarkedLocal.has(q.id) ? 'Bookmarked — tap to remove' : 'Save this question to Bookmarks for later review'}>
          <button onClick={toggleBookmark}
                  aria-pressed={bookmarkedLocal.has(q.id)}
                  aria-label={bookmarkedLocal.has(q.id) ? 'Remove bookmark' : 'Bookmark this question'}
                  className="no-tap-highlight p-1 -mr-1 -mt-0.5 rounded-full active:bg-black/5 flex-shrink-0">
            <span className={"inline-block " + (bmAnim === 'pop' ? 'bm-pop' : bmAnim === 'deflate' ? 'bm-deflate' : '')}
                  key={bmAnim ? `${q.id}:${bookmarkedLocal.has(q.id)}` : q.id}
                  style={{ lineHeight: 0 }}>
              {bookmarkedLocal.has(q.id)
                ? <BookmarkCheck size={20} className="text-accent" />
                : <Bookmark size={20} className="text-muted" />}
            </span>
          </button>
          </Tip>
        </div>

        {/* Question */}
        <div className="flex items-start gap-2 mb-4">
          <div className="font-display text-xl leading-snug flex-1 text-ink select-none"
               onContextMenu={e => e.preventDefault()}>
            {q.q}
          </div>
          <TTSButton text={q.q} className="flex-shrink-0 mt-1" />
        </div>

        {/* P17 — optional image, shown between stem and options */}
        <QuestionImage q={q} />

        {/* Hint (Quick Practice only, and only if question has one) */}
        {hintsAllowed && q.hint && !submitted && (
          <div className="mb-5">
            {!hintShown ? (
              <button onClick={() => setHintShown(true)}
                      className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition"
                      style={{ background: T.accent + '15', color: T.accent, border: `1px solid ${T.accent}40` }}>
                <Lightbulb size={12} />
                Need a hint?
              </button>
            ) : (
              <Card className="anim-fadeup p-3" style={{ background: T.accent + '12', border: `1px solid ${T.accent}40` }}>
                <div className="flex items-start gap-2">
                  <Lightbulb size={14} className="flex-shrink-0 mt-0.5 text-accent" />
                  <div className="text-sm leading-snug italic text-ink-soft">{q.hint}</div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Options */}
        <div className="space-y-2.5 mb-6 select-none">
          {q.options.map((opt, i) => {
            const isSelected = selected.includes(i);
            const isCorrect = q.correct.includes(i);
            // After submit OR reveal, options become read-only and the correct
            // answers light up green. Submit also marks wrong picks in red;
            // reveal has no "selected" picks so only correct ones are styled.
            const isLocked = submitted || revealed;
            let bg = T.surface;
            let border = T.border;
            let textColor = T.ink;
            let dotBg = T.surface;
            let dotBorder = T.border;
            let dotColor = T.muted;
            if (isLocked) {
              if (isCorrect) {
                bg = T.successSoft;
                border = T.success;
                dotBg = T.success;
                dotColor = '#FFF';
              } else if (isSelected) {
                // Only happens on submit (reveal has no selection)
                bg = T.errorSoft;
                border = T.error;
                dotBg = T.error;
                dotColor = '#FFF';
              }
            } else if (isSelected) {
              bg = T.primary + '08';
              border = T.primary;
              dotBg = T.primary;
              dotColor = '#FFF';
            }
            // #23/4 — answer feedback: the correct option pulses on lock-in;
            // a wrongly-selected option shakes (decaying amplitude, CSS).
            const fbClass = isLocked
              ? (isCorrect ? ' q-pulse' : (submitted && isSelected ? ' q-shake' : ''))
              : '';
            return (
              <div key={i} onClick={() => toggleSelect(i)}
                   onContextMenu={e => e.preventDefault()}
                   role="button"
                   tabIndex={isLocked ? -1 : 0}
                   aria-pressed={isSelected}
                   aria-disabled={isLocked || undefined}
                   aria-label={`Option ${String.fromCharCode(65 + i)}: ${opt}`}
                   onKeyDown={(e) => {
                     if (isLocked) return;
                     if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                       e.preventDefault();
                       toggleSelect(i);
                     }
                   }}
                   className={"no-tap-highlight rounded-2xl px-4 py-3.5 flex items-start gap-3 transition-colors cursor-pointer active:scale-[0.99]" + fbClass}
                   style={{ background: bg, border: `1.5px solid ${border}` }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold"
                     style={{ background: dotBg, border: `1.5px solid ${isLocked && isCorrect ? T.success : (isSelected ? border : T.border)}`, color: dotColor }}>
                  {isLocked && isCorrect ? <Check size={14} /> : isLocked && isSelected ? <X size={14} /> : String.fromCharCode(65 + i)}
                </div>
                <div className="text-sm leading-snug pt-0.5" style={{ color: textColor }}>{opt}</div>
              </div>
            );
          })}
        </div>

        {/* "You revealed this" banner — gentle nudge so she sees this was an
            assist, not a real attempt. Honest about the consequence for stats. */}
        {revealed && (
          <Card className="p-3 mb-3 anim-fadeup"
                style={{ background: T.accent + '12', border: `1px solid ${T.accent}40` }}>
            <div className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-soft">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-accent" />
              <div>
                Answer revealed. This question will show up in Weak Areas so you can revisit it.
              </div>
            </div>
          </Card>
        )}

        {/* Explanation */}
        {(submitted || revealed) && (
          <div className="anim-fadeup space-y-3 mb-6">
            <Card className="p-4" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Lightbulb size={16} className="text-accent" />
                  <div className="text-xs uppercase tracking-wider font-semibold text-muted">Explanation</div>
                </div>
                <TTSButton text={q.exp} />
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{q.exp}</div>
              {/* #18 — Question Solution Flag. One tap = "this explanation is
                  still unclear"; toggles off on a second tap. Saved per
                  profile; surfaces in Doubts → Questions; auto-resolves when
                  this question is later answered correctly. Hidden for guests
                  (no profile to store against). */}
              {profileId && (
                <Tip text="Flagged questions are saved to My Doubts — find them in the sidebar.">
                <button onClick={toggleSolutionFlag}
                        aria-pressed={!!(qDoubts[q.id] && !qDoubts[q.id].resolvedAt)}
                        className="no-tap-highlight w-full mt-3 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium active:scale-95 transition"
                        style={(qDoubts[q.id] && !qDoubts[q.id].resolvedAt)
                          ? { background: T.error + '15', color: T.error, border: `1.5px solid ${T.error}60` }
                          : { background: T.surface, color: T.muted, border: `1.5px dashed ${T.border}` }}>
                  <span className={"inline-block " + ((qDoubts[q.id] && !qDoubts[q.id].resolvedAt) ? 'bm-pop' : '')} style={{ lineHeight: 0 }}>
                    <Flag size={12} fill={(qDoubts[q.id] && !qDoubts[q.id].resolvedAt) ? 'currentColor' : 'none'} />
                  </span>
                  {(qDoubts[q.id] && !qDoubts[q.id].resolvedAt)
                    ? 'Flagged — explanation unclear (tap to unflag)'
                    : 'Still confused? Flag this explanation'}
                </button>
                </Tip>
              )}
              {/* P8 — "Was this helpful?" (question is finished + explanation visible) */}
              <HelpfulToggle questionId={q.id} explanation={q.exp} profileId={profileId} />
            </Card>
            {/* Memory tip (Intuition anchor) — fixed amber across all themes so
                students learn amber = memory hook. Renders only when present. */}
            {q.memoryTip && (
              <Card className="anim-fadeup p-4 overflow-hidden"
                    style={{
                      background: IS_DARK ? '#2A2010' : '#FFF8E8',
                      border: `1px solid #D4900A33`,
                      borderLeft: `3px solid #D4900A`
                    }}>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={14} style={{ color: '#D4900A' }} />
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#D4900A' }}>Memory tip</div>
                </div>
                <div className="text-sm leading-relaxed" style={{ color: T.ink }}>
                  {q.memoryTip}
                </div>
              </Card>
            )}
            {q.wrong && Object.keys(q.wrong).length > 0 && (
              <Card className="p-4 bg-surface">
                <div className="text-xs uppercase tracking-wider font-semibold mb-3 text-muted">Why the others are wrong</div>
                <div className="space-y-2.5">
                  {Object.entries(q.wrong).map(([idx, text]) => (
                    <div key={idx} className="flex gap-2.5 text-sm text-ink-soft">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-semibold"
                           style={{ background: T.errorSoft, color: T.error }}>
                        {String.fromCharCode(65 + parseInt(idx))}
                      </div>
                      <div className="leading-relaxed pt-0.5">{text}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Explain differently (only if alt_exp present) */}
            {q.alt_exp && !altShown && (
              <button onClick={() => setAltShown(true)}
                      className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium active:scale-95 transition"
                      style={{ background: T.surface, border: `1.5px dashed ${T.primary}50`, color: T.primary }}>
                <Brain size={14} />
                I still don't get it
              </button>
            )}
            {q.alt_exp && altShown && (
              <Card className="anim-fadeup p-4" style={{ background: T.primary + '12', border: `1px solid ${T.primary}40` }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Brain size={14} className="text-primary" />
                    <div className="text-xs uppercase tracking-wider font-semibold text-primary">Explained another way</div>
                  </div>
                  <TTSButton text={q.alt_exp} />
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{q.alt_exp}</div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          {/* Quick reference — opens a lookup overlay (labs, drugs, vitals,
              conversions) without leaving the question. Always available in
              Quick / Topic / Mock; Advanced Test is a separate component and
              intentionally has no reference. */}
          <div className="flex justify-center mb-2">
            <button onClick={() => setShowReference(true)}
                    className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition"
                    style={{ background: T.surfaceWarm, color: T.accent, border: `1px solid ${T.border}` }}>
              <FlaskConical size={13} />
              Reference
            </button>
          </div>
          {(submitted || revealed) ? (
            <Button onClick={next} size="lg" className="w-full" variant="primary"
                    icon={<ChevronRight size={18} />}>
              {scheduleIndex + 1 < schedule.length ? 'Next question' : 'Finish'}
            </Button>
          ) : (
            <>
              {/* Quick Practice gets both shortcuts: Skip (defer to later) and
                  Show answer (peek the explanation, counted as wrong). Mock
                  gets Skip only — exam-realistic strategy aid without letting
                  the user peek at answers. Other modes get no shortcuts. */}
              {showAnswerAllowed ? (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button onClick={skipQuestion}
                          disabled={!canSkip}
                          className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium active:scale-95 transition disabled:opacity-40"
                          style={{ background: T.surface, color: T.inkSoft, border: `1px solid ${T.border}` }}>
                    <ChevronRight size={12} />
                    Skip{remainingAfter > 0 ? ` (try later)` : ''}
                  </button>
                  <button onClick={revealAnswer}
                          className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium active:scale-95 transition"
                          style={{ background: T.surface, color: T.accent, border: `1px solid ${T.accent}50` }}>
                    <Eye size={12} />
                    Show answer
                  </button>
                </div>
              ) : skipAllowed && (
                <button onClick={skipQuestion}
                        disabled={!canSkip}
                        className="no-tap-highlight w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium active:scale-95 transition disabled:opacity-40 mb-2"
                        style={{ background: T.surface, color: T.inkSoft, border: `1px solid ${T.border}` }}>
                  <ChevronRight size={12} />
                  Skip{remainingAfter > 0 ? ` (come back to this)` : ''}
                </button>
              )}
              <Button onClick={submit} disabled={selected.length === 0} size="lg" className="w-full">
                Check answer
              </Button>
            </>
          )}
        </div>
      </div>
    </div>

    {/* Confirm-before-exit modal. Lives as a sibling of the anim-fadeup wrapper
        so its `position: fixed` is relative to the viewport rather than to a
        transformed ancestor. Tapping the dim overlay defaults to "Stay" — safer
        when an accidental tap is what triggered the prompt in the first place. */}
    {confirmExit && (
      <ConfirmExitDialog mode={mode} answered={results.length} total={schedule.length}
                         onStay={() => setConfirmExit(false)}
                         onLeave={() => { setConfirmExit(false); onBack(); }} />
    )}

    {/* Reference lookup overlay — sibling of the anim-fadeup wrapper so its
        position:fixed anchors to the viewport. Toggling it preserves all quiz
        state, so the user returns to the exact same question. */}
    <ReferenceLookupModal open={showReference} onClose={() => setShowReference(false)} />
    </>
  );
}

export default Quiz;
