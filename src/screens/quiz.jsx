// =====================================================================
// QUIZ SCREEN  (Pipeline step 38 / A1 session 4 — batch 1b slice 7 —
// extracted from App.jsx)
// The core question-runner: renders one question at a time (MCQ/MSQ),
// handles selection, reveal, bookmarking, per-question timing, the
// reference lookup, and exit confirmation; calls onComplete with the run.
// [A7] theme + isDark via useTheme(); app data via useData(); the
// per-run config + callbacks stay props.
// I18N: only CHROME strings go through t() here. The question payload
// (q.q / q.options / q.exp / q.wrong / q.memoryTip / q.hint / q.alt_exp)
// is exam-mirroring study content and must stay English verbatim. profileId stays a prop (scalar,
// forwarded to HelpfulToggle). The previously-passed `allQuestions` prop
// was dead in the body and has been dropped.
// =====================================================================
import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Bookmark, BookmarkCheck, Brain, Check, ChevronRight, Coins, Flag, FlaskConical, Lightbulb, Sparkles, Timer, X } from 'lucide-react';
import { useTheme, useData, useI18n } from '../lib/app-context.jsx';
import { topicName, topicColor, topicIcon } from '../lib/topics.js';
import { arraysEqualUnordered } from '../lib/utils.js';
import { loadQDoubts, saveQDoubts, toggleQDoubt } from '../lib/qdoubts.js';
// TIP — hold (mobile) / hover (PC) info bubbles on quiz chrome.
import { Tip } from '../ui/tooltip.jsx';
import { Card, Button, Pill, PyqBadge, TopBar, requestFeedback, EduTag } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import { QuestionImage, QuestionVideo, TTSButton, HelpfulToggle } from '../ui/question-widgets.jsx';
import { ConfirmExitDialog, ResumeWelcomeDialog } from '../ui/confirm-exit-dialog.jsx';
import { confirmBookmarkToggle } from '../ui/bookmark-actions.jsx';
import { getConfig } from '../lib/game-config.js';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { isResumable, buildSnapshot } from '../lib/test-session.js';
import { buildCaution } from '../lib/resume-cautions.js';
import { ReferenceLookupModal } from './reference.jsx';
import PulseTimer from '../ui/pulse-timer.jsx';
import VitalsCheck from '../ui/vitals-check.jsx';
import CodeBlue from '../ui/code-blue.jsx';
import { questionBudgetSec } from '../lib/pacing.js';
import { isFoundational } from '../lib/foundational.js';
import { drillFeatureOn } from '../lib/drill-settings.js';

// PHIL-02 — Code Blue fires after this many wrong answers in a row (gentle
// mode: in-session streak only, no Hearts drain).
const CODE_BLUE_STREAK = 3;
const RECOVERY_MAX = 5;
const DIFF_RANK = { easy: 0, medium: 1, moderate: 1, hard: 2 };

// NEW-03 — modes where the per-question Pulse/Flashpoint clock + learning
// interrupts (Vitals Check, Code Blue) are meaningful: the linear, instant-
// feedback test modes. Mock IS included — it's the timed-practice drill (the
// Advanced Test is the deferred exam simulation; that's where the palette +
// editable answers live). Review modes (bookmarks/due/wrong) are excluded —
// revisiting mistakes shouldn't be a race.
const PACE_MODES = ['quick', 'topic', 'weak-topic', 'mock'];
// How long "Next" ignores taps after an answer lands. It occupies the same pixel
// as the "Check answer" button the user just hit, so without this a fast
// double-tap advances past the explanation. Well below a deliberate second tap.
const NEXT_LOCKOUT_MS = 450;

// #4 — per-question self-rating. Defaults to "Unsure" so it's a zero-friction
// optional tap; the choice feeds the calibration report on Results + Stats.
const CONF_OPTS = [
  { key: 'sure',   labelKey: 'quiz.conf.sure',   color: (T) => T.success },
  { key: 'unsure', labelKey: 'quiz.conf.unsure', color: (T) => (T.sec && T.sec.stats) || T.primary },
  { key: 'guess',  labelKey: 'quiz.conf.guess',  color: () => '#B8791A' },
];
function ConfidenceChips({ value, onChange, T }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-[11px] font-medium shrink-0" style={{ color: T.muted }}>{t('quiz.conf.howSure')}</span>
      <div className="flex gap-1.5 flex-1">
        {CONF_OPTS.map((o) => {
          const active = value === o.key;
          const c = o.color(T);
          return (
            <button key={o.key} type="button" onClick={() => onChange(o.key)}
              aria-pressed={active}
              className="no-tap-highlight flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition active:scale-95"
              style={active
                ? { background: c + '1F', color: c, border: `1.5px solid ${c}` }
                : { background: T.surface, color: T.muted, border: `1.5px solid ${T.border}` }}>
              {t(o.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Quiz({ questions, mode, onComplete, onBack, timed, timeLimitMin, profileId, coins = 0, onWhyBonus, onCodeBlueResolved, onToggleBookmark = null, pulse = false, flashpoint = false, resumeState = null }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { data } = useData();
  const { t } = useI18n();
  // RESUME — when relaunched from a saved snapshot, seed the position + answers
  // so the user lands exactly where they left off. App rebuilds `questions` in
  // the saved play order, so `schedule` (0..n-1) stays correct and `index` is
  // just the saved position, clamped to the surviving pool.
  const [index, setIndex] = useState(() => {
    if (!resumeState) return 0;
    const n = resumeState.index | 0;
    return Math.max(0, Math.min(n, Math.max(0, questions.length - 1)));
  });
  const [selected, setSelected] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);   // user tapped "Show answer" without selecting
  const [confidence, setConfidence] = useState('unsure'); // #4 — per-question self-rating
  // PHIL-03 — The Why Bonus: staying on a CORRECT answer's explanation for 15s
  // rewards coins (depth over speed). `lastCorrect` marks the current question's
  // outcome; `whyBonus` drives the celebratory toast.
  const [lastCorrect, setLastCorrect] = useState(false);
  const [whyBonus, setWhyBonus] = useState(false);
  const [results, setResults] = useState(() => (resumeState && Array.isArray(resumeState.results) ? resumeState.results : []));        // per question { qId, correct, selected, timeMs, revealed? }
  const [bookmarkedLocal, setBookmarkedLocal] = useState(new Set(data.bookmarks));
  // Stable for the whole run. Gates the back-button guard below (see the effect):
  // an empty run must NOT install it, or back gets swallowed with no dialog.
  const hasQuestions = Array.isArray(questions) && questions.length > 0;
  // When the current question's answer landed. `next()` ignores taps within
  // NEXT_LOCKOUT_MS of it, because "Next" replaces "Check answer" at the same
  // pixel and a double-tap would otherwise skip the explanation entirely.
  const answeredAtRef = useRef(0);
  // completeQuiz is not idempotent-safe to call twice: one-way latch.
  const finishedRef = useRef(false);
  // For count-down (mock): seconds remaining. For count-up (legacy): seconds elapsed.
  // `isCountdown` is the single switch: true iff timeLimitMin > 0.
  const isCountdown = !!(timed && timeLimitMin && timeLimitMin > 0);
  const totalSeconds = isCountdown ? timeLimitMin * 60 : 0;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const [elapsed, setElapsed] = useState(() => (resumeState ? Math.max(0, resumeState.elapsed | 0) : 0));
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

  // ---- RESUME AN IN-PROGRESS TEST (untimed practice only) --------------------
  // A run the user steps away from is snapshotted locally and offered back from
  // the Home screen. The timed Mock and the Advanced Test exam simulation are
  // NEVER resumable (pausing a clock is the "unfair means" the caution warns
  // against). Instantly killable via the game_config.resumeTests flag.
  const canResume = !!(getConfig() && getConfig().resumeTests) && isResumable(mode, timed);
  const startedAtRef = useRef(resumeState && resumeState.startedAt ? resumeState.startedAt : Date.now());
  // Rotating mentor caution. `cursorRef` advances each time a caution is shown so
  // the gentle nudge differs every session; the fixed integrity line never rotates.
  const cursorRef = useRef(0);
  const [caution, setCaution] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!profileId) return undefined;
    safeStorage.get(KEYS.resumeCursor(profileId), false)
      .then((r) => {
        if (!alive) return;
        const c = r && Number.isFinite(r.value) ? Math.trunc(r.value) : 0;
        cursorRef.current = c;
        setCaution({ exit: buildCaution({ kind: 'exit', cursor: c }), resume: buildCaution({ kind: 'resume', cursor: c }) });
      })
      .catch(() => { if (alive) setCaution({ exit: buildCaution({ kind: 'exit', cursor: 0 }), resume: buildCaution({ kind: 'resume', cursor: 0 }) }); });
    return () => { alive = false; };
  }, [profileId]);
  const bumpCursor = () => {
    const nextC = (cursorRef.current | 0) + 1;
    cursorRef.current = nextC;
    if (profileId) { try { safeStorage.set(KEYS.resumeCursor(profileId), nextC, false); } catch (e) {} }
  };
  // The warm "welcome back" note, shown once when a saved run is reopened.
  const [showResumeWelcome, setShowResumeWelcome] = useState(!!resumeState);

  // Persist / clear the snapshot. Persist is fire-and-forget (local IndexedDB);
  // a storage failure must never block the quiz.
  //
  // NOTE: written for EVERY mode, including the timed Mock, and regardless of the
  // resumeTests flag. The record is the "unfinished run" receipt, not just a
  // resume point: if the run is abandoned (or the app is swiped away) rather than
  // resumed, App retires it by folding the questions the user actually reached but
  // never attempted into the B2 repeat pool, so they come back in a later test.
  // Resume itself is still only OFFERED for untimed practice (isValidSnapshot
  // refuses a Mock), so snapshotting a Mock can never make it resumable.
  const persistSnapshot = () => {
    if (!profileId) return;
    try {
      const ids = schedule.map((i) => questions[i] && questions[i].id).filter(Boolean);
      if (ids.length === 0) return;
      const skipped = Object.keys(skipCounts).filter((qid) => (skipCounts[qid] || 0) > 0);
      const snap = buildSnapshot({ mode, questionIds: ids, results, index, elapsed, skipped, startedAt: startedAtRef.current });
      safeStorage.set(KEYS.activeTest(profileId), snap, false);
    } catch (e) { /* best-effort */ }
  };
  const clearSnapshot = () => {
    if (!profileId) return;
    try { safeStorage.delete(KEYS.activeTest(profileId), false); } catch (e) {}
  };
  // Autosave whenever the answered set / position / play order / skips change, so
  // an accidental hard-close (not just the Back button) is recoverable. An
  // untouched run (nothing answered, still on the first question) is not worth
  // saving: there is nothing to resume and nothing to repeat.
  useEffect(() => {
    if (!profileId) return;
    if (results.length === 0 && index === 0) return;
    persistSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, index, schedule, skipCounts]);
  // ---------------------------------------------------------------------------
  // Confirm-before-exit. The user can lose meaningful progress if they tap
  // back accidentally — and they will, on phones. Any tap on Back during an
  // active test routes through this dialog instead of immediately exiting.
  // The dialog is also triggered when the device's back button or browser
  // back fires (popstate handler below).
  const [confirmExit, setConfirmExit] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const questionStart = useRef(Date.now());
  // NEW-03 — carry the Pulse clock across re-visits of a SKIPPED question, so
  // coming back doesn't grant a fresh timer (the exploit). pulseSpent banks the
  // live seconds already spent per qId; pulseShownAt marks when this visit began.
  const pulseSpentRef = useRef({});
  const pulseShownAtRef = useRef(Date.now());
  // PHIL-06 — Vitals Check. Fires once per question per session when a
  // FOUNDATIONAL (must-know) question is missed; pauses the timer until the
  // user reviews the rationale. `vitalsOpenRef` gates the countdown tick so the
  // mock clock (and elapsed) freeze while the overlay is up.
  const [vitalsCheck, setVitalsCheck] = useState(null);     // the missed question, or null
  const [vitalsShown, setVitalsShown] = useState(() => new Set());
  const vitalsOpenRef = useRef(false);
  // PHIL-02 — Code Blue. consecutiveWrong is in-session only; on the 3rd wrong
  // in a row a recovery drill of this session's mistakes takes over. codeBlue
  // holds the pre-loaded recovery set; codeBlueOpenRef pauses the timer.
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [codeBlue, setCodeBlue] = useState(null);           // recovery question array, or null
  const [codeBlueDone, setCodeBlueDone] = useState(false);  // one Code Blue per session is plenty
  const codeBlueOpenRef = useRef(false);

  // Mode capabilities:
  //   - Hints & Show-answer are study aids — Quick Practice only.
  //   - Skip exists in Quick AND Mock. In Mock it mirrors real exam strategy:
  //     defer hard questions, attempt easy ones first. The "Show answer"
  //     bypass stays gated so mocks remain content-honest.
  const isPractice = mode === 'quick';
  const hintsAllowed = isPractice;
  const skipAllowed = isPractice || mode === 'mock';

  // Position in the schedule, not in the original `questions` array.
  const scheduleIndex = index;
  const realIndex = schedule[scheduleIndex];
  const q = questions[realIndex];

  // How many questions remain AFTER this one in the current schedule.
  const remainingAfter = schedule.length - scheduleIndex - 1;
  // Issue 3 — a question may be skipped at most twice; after that Skip is
  // disabled (so the queue can't cycle forever) but the question is NEVER
  // dropped — it stays in the schedule and must be attempted before the test
  // ends. (Previously the 2nd skip advanced the cursor PAST it, so a skipped
  // question could vanish and never be shown again.)
  const skipsForCurrent = q ? (skipCounts[q.id] || 0) : 0;
  const canSkip = skipAllowed && !submitted && !revealed && remainingAfter > 0 && skipsForCurrent < 2;

  // Time tracking. For mock we count DOWN from totalSeconds; for any other
  // timed mode we count UP (legacy behaviour, unused today but kept for
  // future modes). When countdown hits zero, finish the test with whatever
  // we have. `elapsed` is always reported to onComplete as time spent.
  useEffect(() => {
    if (!timed) return;
    const t = setInterval(() => {
      // PHIL-06 / PHIL-02 — the timer pauses during a Vitals Check or Code Blue.
      if (vitalsOpenRef.current || codeBlueOpenRef.current) return;
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
    const id = setTimeout(() => {
      // Same one-way finish guard as next(): completeQuiz is not free to run
      // twice (it would double-count the run's stats).
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearSnapshot();  // the run FINISHED (time ran out): it is not an abandoned run
      onComplete(results, bookmarkedLocal, elapsed, skipCounts);
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCountdown, secondsRemaining]);

  // Intercept device/browser back button so it routes through the confirm
  // dialog too — same rule as the in-app back arrow. We push a placeholder
  // history entry on mount; when the user fires back, popstate triggers, we
  // push the entry again (cancelling the navigation) and show the confirm.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;
    // ⚠ Only guard a run that HAS questions. The `if (!q)` early return below
    // bails out before ConfirmExitDialog is rendered, so on an empty quiz this
    // handler would swallow every back press and show nothing: the user could
    // never leave with the device back button or the iOS back gesture. Reachable
    // for real (bookmarks review with no bookmarks, review-due with nothing due,
    // "re-do wrong ones" whose ids the question gate has since hidden). The empty
    // screen has its own working TopBar back arrow, so it needs no guard.
    // Keyed on the QUESTION COUNT, not on `q`: the count is stable for the whole
    // run, so we push exactly one guard entry (keying on `q` would push a fresh
    // one on every question).
    if (!hasQuestions) return;
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
  }, [hasQuestions]);

  // Reset question start time + hint/reveal visibility on every question change
  useEffect(() => {
    questionStart.current = Date.now();
    pulseShownAtRef.current = Date.now();   // new question's Pulse visit starts now
    setHintShown(false);
    setAltShown(false);
    setRevealed(false);
    setConfidence('unsure');   // #4 — start each question neutral
    setLastCorrect(false);     // PHIL-03 — reset Why-Bonus tracking per question
    setWhyBonus(false);
  }, [index]);

  if (!q) {
    const emptyTitle = mode === 'bookmarks' ? t('quiz.title.bookmarks')
      : mode === 'review-due' ? t('quiz.title.review')
      : mode === 'wrong' ? t('quiz.title.review')
      : t('quiz.title.practice');
    return (
      <div className="anim-fadeup">
        <TopBar title={emptyTitle} onBack={onBack}
                feedback={{ screen: `Quiz · ${mode || 'practice'} (empty)` }} />
        <div className="p-6 text-center max-w-md mx-auto pt-16">
          <div className="font-display text-xl mb-2 text-ink">{t('quiz.empty.none')}</div>
          <div className="text-sm text-muted">
            {mode === 'bookmarks' && t('quiz.empty.bookmarks')}
            {mode === 'review-due' && t('quiz.empty.reviewDue')}
            {mode === 'wrong' && t('quiz.empty.wrong')}
            {!['bookmarks', 'review-due', 'wrong'].includes(mode) && t('quiz.empty.generic')}
          </div>
        </div>
      </div>
    );
  }

  const toggleSelect = (i) => {
    if (submitted || revealed) return;
    // Single-answer: tapping the chosen option again CLEARS it (back to none),
    // which morphs the primary button back to "Submit". Multi-select toggles
    // each option independently.
    if (q.type === 'mcq') setSelected(prev => (prev[0] === i ? [] : [i]));
    else setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const submit = () => {
    if (selected.length === 0) return;
    // Symmetry with revealAnswer/onTimerExpire, which both guard this way. Also
    // stops a second click in the same batch from double-appending a result.
    if (submitted || revealed) return;
    answeredAtRef.current = Date.now();
    const correct = arraysEqualUnordered(selected, q.correct);
    const timeMs = Date.now() - questionStart.current;
    const newResults = [...results, { qId: q.id, correct, selected, timeMs, confidence }];
    setResults(newResults);
    setLastCorrect(correct);
    setSubmitted(true);

    // Consecutive-wrong streak (in-session) — drives Code Blue.
    const streak = correct ? 0 : consecutiveWrong + 1;
    setConsecutiveWrong(streak);

    const inTestMode = PACE_MODES.includes(mode);
    // Drill-Tests settings — each coaching behaviour can be switched off (default ON).
    const prefs = data && data.preferences;
    // PHIL-06 — Vitals Check takes precedence: missing a FOUNDATIONAL question
    // forcibly pauses the session for a rationale read (once per question/session).
    const fireVitals = !correct && inTestMode && drillFeatureOn(prefs, 'vitalsCheck') && isFoundational(q) && !vitalsShown.has(q.id);
    // PHIL-02 — Code Blue: 3 wrong in a row → recovery drill of this session's
    // mistakes. Suppressed if a Vitals Check is opening on the same submit.
    const fireCodeBlue = !correct && inTestMode && drillFeatureOn(prefs, 'codeBlue') && !fireVitals && !codeBlueDone && streak >= CODE_BLUE_STREAK;

    if (fireVitals) {
      setVitalsShown(prev => { const n = new Set(prev); n.add(q.id); return n; });
      vitalsOpenRef.current = true;
      setVitalsCheck(q);
    } else if (fireCodeBlue) {
      const recovery = buildRecoverySet(newResults);
      if (recovery.length > 0) {
        codeBlueOpenRef.current = true;
        setCodeBlue(recovery);
      }
    }
  };

  // The clock ENFORCES in both The Pulse and Flashpoint — when it hits zero the
  // question locks. If the user has a selection, auto-submit it (full normal
  // flow); otherwise lock it as a timed-out blank (counts as wrong, scores no
  // Flashpoint points). This is what makes the timer "matter".
  const onTimerExpire = () => {
    if (submitted || revealed) return;
    if (selected.length > 0) { submit(); return; }
    const timeMs = Date.now() - questionStart.current;
    setResults(r => [...r, { qId: q.id, correct: false, selected: [], timeMs, timedOut: true }]);
    setLastCorrect(false);
    setSubmitted(true);
    setConsecutiveWrong(w => w + 1);
  };

  // Pre-load the recovery drill from THIS session's mistakes (no fetch): unique
  // wrong (non-revealed) questions, easiest-first, capped at RECOVERY_MAX.
  const buildRecoverySet = (resultList) => {
    const byId = new Map(questions.map(x => [x.id, x]));
    const seen = new Set();
    const wrong = [];
    resultList.forEach(r => {
      if (r.correct || r.revealed || seen.has(r.qId)) return;
      const qq = byId.get(r.qId);
      if (qq) { seen.add(r.qId); wrong.push(qq); }
    });
    wrong.sort((a, b) => (DIFF_RANK[a.difficulty] ?? 1.5) - (DIFF_RANK[b.difficulty] ?? 1.5));
    return wrong.slice(0, RECOVERY_MAX);
  };

  const resumeFromVitals = () => {
    vitalsOpenRef.current = false;
    setVitalsCheck(null);
  };

  // Code Blue cleared all recovery questions → restore a Heart + resume.
  const resolveCodeBlue = () => {
    codeBlueOpenRef.current = false;
    setCodeBlue(null);
    setCodeBlueDone(true);
    setConsecutiveWrong(0);
    try { if (onCodeBlueResolved) onCodeBlueResolved(); } catch (e) {}
  };
  // Manual bail-out — never trapped. Resets the streak so it won't instantly
  // re-fire, but no Heart reward (the drill wasn't completed).
  const exitCodeBlue = () => {
    codeBlueOpenRef.current = false;
    setCodeBlue(null);
    setCodeBlueDone(true);
    setConsecutiveWrong(0);
  };

  // PHIL-03 — The Why Bonus. After a CORRECT answer, if the explanation stays
  // open for 15s, award the bonus once (server-of-record is the data blob via
  // onWhyBonus, which dedups per question forever). The timer resets/cancels on
  // question change or unmount (useEffect cleanup) so there's no farming and no
  // memory leak. Capped at 15s — staying 10 minutes earns the same as 15s.
  useEffect(() => {
    if (!submitted || !lastCorrect || revealed || !onWhyBonus || !q) return undefined;
    const t = setTimeout(() => {
      try { if (onWhyBonus(q.id)) setWhyBonus(true); } catch (e) {}
    }, 15000);
    return () => clearTimeout(t);
  }, [submitted, lastCorrect, revealed, q && q.id, onWhyBonus]);
  // Auto-dismiss the bonus toast.
  useEffect(() => {
    if (!whyBonus) return undefined;
    const t = setTimeout(() => setWhyBonus(false), 3600);
    return () => clearTimeout(t);
  }, [whyBonus]);

  // Neutral "Submit" — the user chose not to answer; reveal the solution
  // WITHOUT it counting for or against them. Recorded with `revealed: true`,
  // which attemptStats / completeQuiz / Stats all treat as neutral (excluded
  // from accuracy + mastery). It is still scheduled for review (lastResult
  // below) so a question they didn't know resurfaces. The submitted/revealed
  // flags gate option taps so a reveal can never become a free correct answer.
  const revealAnswer = () => {
    if (submitted || revealed) return;
    answeredAtRef.current = Date.now();
    const timeMs = Date.now() - questionStart.current;
    setResults(r => [...r, { qId: q.id, correct: false, selected: [], timeMs, revealed: true }]);
    setRevealed(true);
  };

  // "Skip" — defer this question to the END of the round so the user can
  // attempt easier ones first, and so it ALWAYS comes back around. Each
  // question can be skipped at most twice (enforced via canSkip / skipsForCurrent
  // above); on the 2nd skip it's still re-queued, just no longer skippable, so
  // it must be answered before the test can finish. It is never dropped.
  const skipQuestion = () => {
    if (!canSkip) return;
    const qId = q.id;
    setSkipCounts(s => ({ ...s, [qId]: (s[qId] || 0) + 1 }));
    // Bank the Pulse time spent on this question THIS visit, so when it cycles
    // back the clock resumes from what's left instead of restarting (the exploit).
    pulseSpentRef.current[qId] = (pulseSpentRef.current[qId] || 0) + (Date.now() - pulseShownAtRef.current) / 1000;

    // Move the realIndex from `scheduleIndex` to the end of the schedule.
    setSchedule(prev => {
      const next = prev.slice();
      const [moved] = next.splice(scheduleIndex, 1);
      next.push(moved);
      return next;
    });
    setSelected([]);
    // Stay at the same scheduleIndex — the next question now occupies it.
    // schedule itself changed, so `q` updates automatically; reset per-question
    // state explicitly here since the index didn't change.
    questionStart.current = Date.now();
    pulseShownAtRef.current = Date.now();   // the next question's Pulse visit starts now
    setHintShown(false);
    setAltShown(false);
    setRevealed(false);
  };

  const next = () => {
    // ⚠ "Next" renders at the EXACT screen position the user just tapped to
    // check their answer, so the 2nd tap of a fast double-tap used to land on it
    // and blow straight past the explanation they never saw. Ignore Next for a
    // beat after the answer lands. (Deliberate taps are always far slower; this
    // is invisible to a real user and also covers the keyboard Enter path.)
    if (Date.now() - answeredAtRef.current < NEXT_LOCKOUT_MS) return;
    if (scheduleIndex + 1 < schedule.length) {
      setIndex(i => i + 1);
      setSelected([]);
      setSubmitted(false);
      setRevealed(false);
    } else {
      // Finishing is one-way: a second onComplete would re-run completeQuiz and
      // double-count the whole run's stats.
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearSnapshot();   // finished — there is nothing left to resume
      onComplete(results, bookmarkedLocal, elapsed, skipCounts);
    }
  };

  const applyBookmarkToggle = () => {
    const newSet = new Set(bookmarkedLocal);
    if (newSet.has(q.id)) { newSet.delete(q.id); setBmAnim('deflate'); }
    else { newSet.add(q.id); setBmAnim('pop'); }
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    setBookmarkedLocal(newSet);
    // PERSIST NOW, not at completion. This used to live only in `bookmarkedLocal`
    // (a mount-time snapshot) and was written just once, by completeQuiz. Anyone
    // who bookmarked a question and then left the run (back, Save and exit, or a
    // mock whose clock ran out) SILENTLY LOST every bookmark they made. The
    // Advanced Test always did it this way; the quiz now matches.
    if (onToggleBookmark) onToggleBookmark(q.id);
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
        title={t('quiz.qOf', { n: scheduleIndex + 1, total: schedule.length })}
        onBack={() => setConfirmExit(true)}
        feedback={{ screen: `Quiz · ${mode || 'practice'}`, questionId: q.id }}
        right={
          <div className="flex items-center gap-2">
            {/* PHIL-03 — Accuracy Coins balance (premium, non-monetary). Pops
                when a Why Bonus lands. */}
            <Tip text={t('quiz.coinsTip')}>
            <div className={"flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums" + (whyBonus ? ' q-pulse' : '')}
                 style={{ background: '#F59E0B18', color: '#B45309', border: '1px solid #F59E0B40' }}>
              <Coins size={12} />
              {coins}
            </div>
            </Tip>
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
                <Tip text={isCountdown ? t('quiz.timerRemainingTip') : t('quiz.timerElapsedTip')}>
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

      {/* PHIL-03 — The Why Bonus celebration. Rewards depth over speed. */}
      {whyBonus && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md"
             style={{ top: 'calc(64px + env(safe-area-inset-top, 0px))', pointerEvents: 'none' }}>
          <div className="anim-fadeup rounded-2xl px-4 py-3 flex items-center gap-3"
               style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)', boxShadow: '0 12px 30px rgba(180,83,9,0.4)', color: '#FFF' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <Sparkles size={18} color="#FFF" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold">{t('quiz.whyBonusTitle')}</div>
              <div className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {t('quiz.whyBonusBody')}
              </div>
            </div>
          </div>
        </div>
      )}

      <PageContainer size="content" className="pb-40 pt-2">
        {/* Progress */}
        <div className="mb-5">
          <div className="h-1 rounded-full" style={{ background: T.borderSoft }}>
            <div className="h-1 rounded-full transition-all duration-300" style={{ background: T.primary, width: `${progress}%` }} />
          </div>
        </div>

        {/* NEW-03 "The Pulse" — opt-in per-question countdown. Non-enforcing;
            freezes the instant the answer is locked in, resets each question. */}
        {pulse && PACE_MODES.includes(mode) && (
          <PulseTimer budgetSec={questionBudgetSec(q.topic, { flashpoint, difficulty: q.difficulty })}
                      resetKey={q.id} flashpoint={flashpoint}
                      initialElapsedSec={pulseSpentRef.current[q.id] || 0}
                      onExpire={onTimerExpire}
                      paused={submitted || revealed} T={T} />
        )}

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
              {q.type === 'msq' ? t('quiz.multiSelect') : t('quiz.singleAnswer')}
            </Pill>
            {/* P16 — provenance badge (Quick / Topic / Mock all render via Quiz) */}
            <PyqBadge q={q} />
          </div>
          <Tip text={bookmarkedLocal.has(q.id) ? t('quiz.bookmarkedTip') : t('quiz.bookmarkTip')}>
          <button onClick={toggleBookmark}
                  aria-pressed={bookmarkedLocal.has(q.id)}
                  aria-label={bookmarkedLocal.has(q.id) ? t('quiz.removeBookmark') : t('quiz.addBookmark')}
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
        <QuestionVideo q={q} />

        {/* Hint (Quick Practice only, and only if question has one) */}
        {hintsAllowed && q.hint && !submitted && (
          <div className="mb-5">
            {!hintShown ? (
              <button onClick={() => setHintShown(true)}
                      className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition"
                      style={{ background: T.accent + '15', color: T.accent, border: `1px solid ${T.accent}40` }}>
                <Lightbulb size={12} />
                {t('quiz.needHint')}
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
                   aria-label={t('quiz.optionAria', { letter: String.fromCharCode(65 + i), text: opt })}
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
                {t('quiz.revealedBanner')}
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
                  <div className="text-xs uppercase tracking-wider font-semibold text-muted">{t('quiz.explanation')}</div>
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
                <Tip text={t('quiz.flagTip')}>
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
                    ? t('quiz.flagged')
                    : t('quiz.flagCta')}
                </button>
                </Tip>
              )}
              {/* P8 — "Was this helpful?" (question is finished + explanation visible) */}
              <HelpfulToggle questionId={q.id} explanation={q.exp} profileId={profileId} />
              {/* Content-trust line: opens the existing report modal pre-tagged
                  with this question's id (FeedbackModal resolves source:'question'). */}
              <button onClick={() => requestFeedback({ screen: 'Quiz', questionId: q.id })}
                      className="no-tap-highlight w-full mt-2 text-center text-[11px] font-medium hover:underline"
                      style={{ color: T.muted }}>
                {t('quiz.reportErrorCta')}
              </button>
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
                  <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#D4900A' }}>{t('quiz.memoryTip')}</div>
                </div>
                <div className="text-sm leading-relaxed" style={{ color: T.ink }}>
                  {q.memoryTip}
                </div>
              </Card>
            )}
            {q.wrong && Object.keys(q.wrong).length > 0 && (
              <Card className="p-4 bg-surface">
                <div className="text-xs uppercase tracking-wider font-semibold mb-3 text-muted">{t('quiz.whyOthersWrong')}</div>
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
                {t('quiz.stillDontGetIt')}
              </button>
            )}
            {q.alt_exp && altShown && (
              <Card className="anim-fadeup p-4" style={{ background: T.primary + '12', border: `1px solid ${T.primary}40` }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Brain size={14} className="text-primary" />
                    <div className="text-xs uppercase tracking-wider font-semibold text-primary">{t('quiz.explainedAnotherWay')}</div>
                  </div>
                  <TTSButton text={q.alt_exp} />
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{q.alt_exp}</div>
              </Card>
            )}
          </div>
        )}

        {/* Layer 3 — the quiet educational footnote travels with any
            screenshot of a question. */}
        <EduTag className="mt-6" />
      </PageContainer>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md md:max-w-3xl mx-auto md:px-6 lg:px-8">
          {/* Quick reference — opens a lookup overlay (labs, drugs, vitals,
              conversions) without leaving the question. Always available in
              Quick / Topic / Mock; Advanced Test is a separate component and
              intentionally has no reference. */}
          <div className="flex justify-center mb-2">
            <button onClick={() => setShowReference(true)}
                    className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition"
                    style={{ background: T.surfaceWarm, color: T.accent, border: `1px solid ${T.border}` }}>
              <FlaskConical size={13} />
              {t('quiz.reference')}
            </button>
          </div>
          {(submitted || revealed) ? (
            <Button onClick={next} size="lg" className="w-full" variant="primary"
                    icon={<ChevronRight size={18} />}>
              {scheduleIndex + 1 < schedule.length ? t('quiz.nextQuestion') : t('quiz.finish')}
            </Button>
          ) : (
            <>
              {/* Skip = defer this question to the end of the round (Quick &
                  Mock only). The old "Show answer" shortcut is gone: the
                  primary button below now doubles as a neutral Submit. */}
              {skipAllowed && (
                <button onClick={skipQuestion}
                        disabled={!canSkip}
                        className="no-tap-highlight w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium active:scale-95 transition disabled:opacity-40 mb-2"
                        style={{ background: T.surface, color: T.inkSoft, border: `1px solid ${T.border}` }}>
                  <ChevronRight size={12} />
                  {remainingAfter > 0 ? (skipsForCurrent >= 2 ? t('quiz.skipDeferred') : t('quiz.skipComeBack')) : t('quiz.skip')}
                </button>
              )}
              {/* #4 — rate confidence once an answer is picked (before checking) */}
              {selected.length > 0 && (
                <ConfidenceChips value={confidence} onChange={setConfidence} T={T} />
              )}
              {/* Morphing primary. Nothing picked → "Submit": reveals the
                  solution NEUTRALLY (no right/wrong, no accuracy hit) so the
                  user is never forced to guess to finish. The instant an option
                  is picked it fills into a confident "Check answer" CTA — a
                  premium micro-interaction shown on every single question. */}
              {(() => {
                const hasSel = selected.length > 0;
                return (
                  <button onClick={hasSel ? submit : revealAnswer}
                          aria-label={hasSel ? t('quiz.checkAnswer') : t('quiz.submitWithoutAnswering')}
                          className={'no-tap-highlight w-full rounded-2xl py-3.5 font-semibold text-base active:brightness-95 transition-[background-color,color,box-shadow,border-color] duration-300 ease-out' + (hasSel ? ' qbtn-ready' : '')}
                          style={hasSel
                            ? { background: T.primary, color: '#FFF', border: '1.5px solid transparent', boxShadow: `0 10px 26px ${T.primary}45` }
                            : { background: T.primary + '12', color: T.primary, border: `1.5px solid ${T.primary}33`, boxShadow: 'none' }}>
                    <span key={hasSel ? 'check' : 'submit'} className="qbtn-label inline-flex items-center justify-center gap-2">
                      {hasSel ? <><Check size={18} /> {t('quiz.checkAnswer')}</> : <>{t('quiz.submit')}</>}
                    </span>
                  </button>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>

    {/* Confirm-before-exit modal. Lives as a sibling of the anim-fadeup wrapper
        so its `position: fixed` is relative to the viewport rather than to a
        transformed ancestor. Tapping the dim overlay defaults to "Stay" — safer
        when an accidental tap is what triggered the prompt in the first place. */}
    {confirmExit && (() => {
      const exitC = (caution && caution.exit) || buildCaution({ kind: 'exit', cursor: 0 });
      return (
        <ConfirmExitDialog mode={mode} answered={results.length} total={schedule.length}
                           timed={timed} resumable={canResume}
                           exitTip={exitC.tip} integrity={exitC.integrity} breakNote={exitC.breakNote}
                           onStay={() => setConfirmExit(false)}
                           onSaveExit={() => { setConfirmExit(false); persistSnapshot(); bumpCursor(); onBack(); }}
                           onLeave={() => { setConfirmExit(false); onBack(); }} />
      );
    })()}

    {/* RESUME — the warm "welcome back" note shown once when a saved run is
        reopened, before the first question. Sibling of the anim-fadeup wrapper
        so its position:fixed anchors to the viewport. */}
    {showResumeWelcome && (() => {
      const resumeC = (caution && caution.resume) || buildCaution({ kind: 'resume', cursor: 0 });
      return (
        <ResumeWelcomeDialog resumeTip={resumeC.tip} integrity={resumeC.integrity}
                             answered={results.length} total={schedule.length}
                             onContinue={() => { setShowResumeWelcome(false); bumpCursor(); }} />
      );
    })()}

    {/* Reference lookup overlay — sibling of the anim-fadeup wrapper so its
        position:fixed anchors to the viewport. Toggling it preserves all quiz
        state, so the user returns to the exact same question. */}
    <ReferenceLookupModal open={showReference} onClose={() => setShowReference(false)} />

    {/* PHIL-06 — Vitals Check (React Portal; pauses the session on a
        foundational miss until the rationale is reviewed). */}
    <VitalsCheck open={!!vitalsCheck} question={vitalsCheck} onResume={resumeFromVitals} />

    {/* PHIL-02 — Code Blue (React Portal; recovery drill after 3 wrong in a row). */}
    <CodeBlue open={!!codeBlue} questions={codeBlue || []} onResolve={resolveCodeBlue} onExit={exitCodeBlue} />
    </>
  );
}

export default Quiz;
