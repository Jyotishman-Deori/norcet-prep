// [A1 slice 43] The timed-test trio — AdvancedTestSetup -> AdvancedTest ->
// AdvancedTestResults. Extracted VERBATIM from App.jsx (three inserted A7 hook
// lines only). They form one pipeline (Setup.onStart launches AdvancedTest;
// AdvancedTest.onSubmit launches AdvancedTestResults), share the same engine
// look, and were contiguous in App (1394-2127), so they move as one module.
// AdvancedTestSetup's private Row/Segmented helper closures travel inside it.
//
// A7: all three were bare-T readers -> useTheme(). Setup + AdvancedTest also
// read IS_DARK (the fixed-footer translucency) -> `isDark: IS_DARK`. Results is
// T-only. No data/profile/isAdmin context (allQuestions/profileId stay props),
// no fgOnDark, no fontStyles. The four render sites in App (Setup x1 at the
// 'advanced-setup' route; AdvancedTest x2 + Results x2 across the random-pool
// and previous-paper routes) are UNCHANGED — every prop signature identical.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertCircle, AlertTriangle, Bookmark, BookmarkCheck, Check, X, ChevronLeft, ChevronRight,
  ClipboardList, EyeOff, Flag, Hourglass, LayoutGrid, RotateCcw, Send, Lock, Repeat
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Pill, PyqBadge, HighYieldBadge, Card, Button, TopBar } from '../ui/primitives.jsx';
import { confirmBookmarkToggle } from '../ui/bookmark-actions.jsx';
import { Tip } from '../ui/tooltip.jsx';
import { QuestionImage, HelpfulToggle } from '../ui/question-widgets.jsx';
import {
  GuestSavePrompt, MotivationCard, ShareScoreButton, TimeQuadrant
} from '../ui/result-cards.jsx';
import { isPYQ } from '../lib/pyq.js';
import { topicName, topicColor, topicIcon } from '../lib/topics.js';
import { arraysEqualUnordered } from '../lib/utils.js';
import GhostShiftCard from '../ui/ghost-shift-card.jsx';

function AdvancedTestSetup({ allQuestions, onStart, onBack }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const [count, setCount] = useState(100);
  const [difficulty, setDifficulty] = useState(new Set()); // empty = all
  const [pyqOnly, setPyqOnly] = useState(false);
  const [customTime, setCustomTime] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [strict, setStrict] = useState(false); // #2 — no-exit exam-day mode

  const filtered = useMemo(() => {
    return allQuestions.filter(q => {
      if (difficulty.size > 0) {
        const d = q.difficulty || 'unmarked';
        if (!difficulty.has(d)) return false;
      }
      if (pyqOnly && !isPYQ(q)) return false;
      return true;
    });
  }, [allQuestions, difficulty, pyqOnly]);

  const canStart = filtered.length >= count;
  const defaultMinutes = count === 50 ? 45 : count === 200 ? 180 : 90;
  const timeMinutes = customTime ?? defaultMinutes;

  // Time preset chips. The full 6-chip ladder felt over-busy; cut to two
  // sensible defaults (matching the count) + a Custom toggle that reveals a
  // small input. Power users still have full control; new users see two
  // obvious choices.
  const presetA = 45;
  const presetB = 90;
  const isCustom = customTime !== null && customTime !== defaultMinutes && customTime !== presetA && customTime !== presetB;

  // Row component — used inside both cards for visual consistency. Label on
  // the left, control on the right, optional hint below.
  const Row = ({ label, hint, children, last }) => (
    <div className={`flex items-start justify-between gap-3 ${last ? '' : 'mb-4'}`}>
      <div className="min-w-0 flex-1 pt-1.5">
        <div className="text-sm font-medium" style={{ color: T.ink }}>{label}</div>
        {hint && <div className="text-[11px] mt-0.5 leading-snug" style={{ color: T.muted }}>{hint}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  // Small segmented control used in multiple places. Renders a pill of
  // mutually exclusive options.
  const Segmented = ({ value, options, onChange }) => (
    <div className="inline-flex rounded-xl p-0.5" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
      {options.map(opt => {
        const active = value === opt.id;
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)}
                  className="no-tap-highlight px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: active ? T.primary : 'transparent',
                    color: active ? '#FFF' : T.inkSoft
                  }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="anim-fadeup">
      {/* BUG-02 — solid bar (no backdrop-filter) so launching from the colourful
          Favourites honeycomb can't flash a re-sampled backdrop on entry. */}
      <TopBar title="Advanced Test" onBack={onBack} feedback={{ screen: "Advanced test setup" }} solid />
      <div className="max-w-md mx-auto px-4 pt-2 pb-32">

        {/* Slimmed tagline — the heavy teal hero became visual noise once
            the Help popover existed. One line of context is enough. */}
        <div className="text-sm mb-5 leading-relaxed px-1" style={{ color: T.muted }}>
          A full exam simulation — timed, with negative marking, and no feedback until the end.
        </div>

        {/* ===== TEST SETUP ===== */}
        <Card className="p-4 mb-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{ color: T.muted }}>
            Test setup
          </div>

          <Row label="Questions"
               hint={count === 200 ? 'Full-length — closest to the real paper' : undefined}>
            <Segmented value={count}
                       onChange={setCount}
                       options={[{ id: 50, label: '50' }, { id: 100, label: '100' },
                                 ...(allQuestions.length >= 200 ? [{ id: 200, label: '200' }] : [])]} />
          </Row>

          <Row label="Difficulty">
            <Segmented value={difficulty.size === 0 ? 'all' : (difficulty.size === 1 ? Array.from(difficulty)[0] : 'all')}
                       onChange={(v) => {
                         if (v === 'all') setDifficulty(new Set());
                         else setDifficulty(new Set([v]));
                       }}
                       options={[
                         { id: 'all',    label: 'All' },
                         { id: 'easy',   label: 'Easy' },
                         { id: 'medium', label: 'Med' },
                         { id: 'hard',   label: 'Hard' }
                       ]} />
          </Row>

          <Row label="Source"
               hint={pyqOnly ? 'Previous-year questions only' : 'All questions in your pool'}>
            <Segmented value={pyqOnly ? 'pyq' : 'all'}
                       onChange={(v) => setPyqOnly(v === 'pyq')}
                       options={[{ id: 'all', label: 'All' }, { id: 'pyq', label: 'PYQ' }]} />
          </Row>

          <Row label="Strict mode"
               hint={strict ? 'No exit until you submit — real exam conditions' : 'You can quit mid-test'}
               last>
            <Segmented value={strict ? 'on' : 'off'}
                       onChange={(v) => setStrict(v === 'on')}
                       options={[{ id: 'off', label: 'Off' }, { id: 'on', label: 'On' }]} />
          </Row>
        </Card>

        {/* ===== TIMING + SCORING ===== */}
        <Card className="p-4 mb-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{ color: T.muted }}>
            Timing
          </div>

          <Row label="Time limit"
               hint={timeMinutes === 45 ? '~54 sec per question (sprint)'
                     : timeMinutes === 90 ? '~54 sec per question'
                     : `~${Math.round((timeMinutes * 60) / count)} sec per question`}>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { setCustomTime(presetA); setCustomOpen(false); }}
                      className="no-tap-highlight px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: timeMinutes === presetA && !isCustom ? T.primary : T.surface,
                        color: timeMinutes === presetA && !isCustom ? '#FFF' : T.inkSoft,
                        border: `1px solid ${timeMinutes === presetA && !isCustom ? T.primary : T.border}`
                      }}>
                45m
              </button>
              <button onClick={() => { setCustomTime(presetB); setCustomOpen(false); }}
                      className="no-tap-highlight px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: timeMinutes === presetB && !isCustom ? T.primary : T.surface,
                        color: timeMinutes === presetB && !isCustom ? '#FFF' : T.inkSoft,
                        border: `1px solid ${timeMinutes === presetB && !isCustom ? T.primary : T.border}`
                      }}>
                90m
              </button>
              <button onClick={() => setCustomOpen(v => !v)}
                      className="no-tap-highlight px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: isCustom || customOpen ? T.primary : T.surface,
                        color: isCustom || customOpen ? '#FFF' : T.inkSoft,
                        border: `1px solid ${isCustom || customOpen ? T.primary : T.border}`
                      }}>
                Custom
              </button>
            </div>
          </Row>

          {customOpen && (
            <div className="-mt-2 mb-4 flex items-center gap-2 pl-1 anim-fadeup">
              <input type="number" min={5} max={300}
                     value={isCustom ? customTime : ''}
                     onChange={e => {
                       const n = parseInt(e.target.value, 10);
                       setCustomTime(Number.isFinite(n) && n > 0 ? n : null);
                     }}
                     placeholder={String(timeMinutes)}
                     className="w-20 rounded-lg px-2.5 py-1.5 text-sm tabular-nums"
                     style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
              <span className="text-xs" style={{ color: T.muted }}>minutes</span>
            </div>
          )}

          <Row label="Scoring"
               hint="Auto-submits when time runs out. No feedback during the test."
               last>
            <div className="flex items-center gap-1.5 text-[11px] font-medium tabular-nums"
                 style={{ color: T.inkSoft }}>
              <span style={{ color: T.success }}>+1</span>
              <span style={{ color: T.muted }}>·</span>
              <span style={{ color: T.error }}>−⅓</span>
              <span style={{ color: T.muted }}>·</span>
              <span style={{ color: T.muted }}>0</span>
            </div>
          </Row>
        </Card>
      </div>

      {/* Bottom bar: summary + Start. The pool-validity check lives here
          rather than as a separate red card — it's a constraint on Start,
          so it belongs next to Start. */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          {canStart ? (
            <div className="text-xs text-center mb-2 tabular-nums" style={{ color: T.muted }}>
              {count} questions · {timeMinutes} min · ready to start
            </div>
          ) : (
            <div className="flex items-start gap-2 mb-2 px-2 py-2 rounded-lg"
                 style={{ background: T.errorSoft, border: `1px solid ${T.error}30` }}>
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
              <div className="text-[11px] leading-relaxed" style={{ color: T.inkSoft }}>
                <span style={{ color: T.error, fontWeight: 600 }}>
                  Only {filtered.length} question{filtered.length === 1 ? '' : 's'} match your filters — you need {count}.
                </span>{' '}
                Switch difficulty back to All, turn off PYQ, or pick fewer questions.
              </div>
            </div>
          )}
          <Button onClick={() => onStart({ count, difficulty: Array.from(difficulty), pyqOnly, timeMinutes, pool: filtered, strict })}
                  disabled={!canStart} size="lg" className="w-full" icon={<Hourglass size={18} />}>
            Start advanced test
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// ADVANCED TEST — ENGINE
// =====================================================================
function AdvancedTest({ questions, timeMinutes, onSubmit, onAbort, label, bookmarks = [], onToggleBookmark, strict = false }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState({});
  const [visited, setVisited] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(timeMinutes * 60);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'abort' | 'submit' | null
  const [bmAnim, setBmAnim] = useState(null);    // #4 — 'pop' | 'deflate' | null
  const timePerQ = useRef({});
  const lastTick = useRef(Date.now());
  const currentQId = useRef(null);
  // #2 — flip tracker: qIds the user has had correct at any point, so the
  // post-mortem can flag answers they changed from right to wrong.
  const everCorrectRef = useRef(new Set());

  const q = questions[index];

  // #4 — bookmarking inside the timed Advanced Test. Persists immediately via
  // the app-level toggle; #7 — removing one is gated by the shared caution.
  const bookmarkSet = useMemo(() => new Set(bookmarks || []), [bookmarks]);
  const isBookmarked = !!(q && bookmarkSet.has(q.id));
  const applyBookmarkToggle = () => {
    setBmAnim(isBookmarked ? 'deflate' : 'pop');
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    if (onToggleBookmark && q) onToggleBookmark(q.id);
  };
  const toggleBookmark = () => confirmBookmarkToggle(isBookmarked, applyBookmarkToggle);

  // Track visited on question change
  useEffect(() => {
    if (q) {
      currentQId.current = q.id;
      setVisited(v => v[q.id] ? v : { ...v, [q.id]: true });
      lastTick.current = Date.now();
    }
  }, [q?.id]);

  // Timer — single interval; reads currentQId from ref to attribute time correctly
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTick.current) / 1000;
      lastTick.current = now;
      const cid = currentQId.current;
      if (cid) timePerQ.current[cid] = (timePerQ.current[cid] || 0) + delta;

      setTimeRemaining(t => {
        if (t <= 1) {
          clearInterval(interval);
          // Defer the submit by one tick so state has flushed
          setTimeout(() => {
            onSubmit({
              answers,
              timePerQ: { ...timePerQ.current },
              elapsedSec: timeMinutes * 60,
              timeMinutes,
              everCorrectIds: [...everCorrectRef.current],
              auto: true
            });
          }, 50);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeMinutes]);

  if (!q) return <div className="p-6 max-w-md mx-auto text-center">No questions.</div>;

  const toggleOption = (i) => {
    setAnswers(prev => {
      const cur = prev[q.id] || [];
      let nextSel;
      if (q.type === 'mcq') {
        nextSel = cur[0] === i ? [] : [i];
      } else {
        nextSel = cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i];
      }
      // #2 — observe only: remember any question the user has had correct, so a
      // later change away from it can be surfaced as a right→wrong flip. Does not
      // alter answering or scoring; a Set keeps it idempotent under re-renders.
      if (nextSel.length > 0 && arraysEqualUnordered(nextSel, q.correct)) {
        everCorrectRef.current.add(q.id);
      }
      return { ...prev, [q.id]: nextSel };
    });
  };

  const clearAnswer = () => setAnswers(prev => ({ ...prev, [q.id]: [] }));
  const toggleMark = () => setMarked(prev => ({ ...prev, [q.id]: !prev[q.id] }));
  const goNext = () => setIndex(Math.min(questions.length - 1, index + 1));
  const goPrev = () => setIndex(Math.max(0, index - 1));
  const goTo = (i) => { setIndex(i); setPaletteOpen(false); };

  const doManualSubmit = () => {
    onSubmit({
      answers,
      timePerQ: { ...timePerQ.current },
      elapsedSec: timeMinutes * 60 - timeRemaining,
      timeMinutes,
      everCorrectIds: [...everCorrectRef.current],
      auto: false
    });
  };

  const answeredCount = Object.values(answers).filter(a => a && a.length > 0).length;
  const markedCount = Object.values(marked).filter(Boolean).length;
  const blankCount = questions.length - answeredCount;

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const timeColor = timeRemaining < 60 ? T.error : timeRemaining < 300 ? T.accent : T.ink;
  const selected = answers[q.id] || [];
  const isMarked = !!marked[q.id];

  return (
    <div className="test-enter">
      {/* issues round — pad for the device status bar (same fix as TopBar) */}
      <div className="sticky top-0 z-20" style={{ background: T.bg, borderBottom: `1px solid ${T.borderSoft}`, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {strict ? (
            <div className="p-1.5" title="Strict mode — finish the test to exit">
              <Lock size={18} style={{ color: T.muted }} />
            </div>
          ) : (
            <button onClick={() => setConfirm('abort')} className="no-tap-highlight p-1.5 rounded-lg active:bg-black/5">
              <X size={20} style={{ color: T.muted }} />
            </button>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold tabular-nums"
               style={{ background: timeRemaining < 60 ? T.errorSoft : T.surfaceWarm, color: timeColor }}>
            <Hourglass size={14} />
            {fmtTime(timeRemaining)}
          </div>
          <button onClick={() => setPaletteOpen(true)}
                  className="no-tap-highlight flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: T.primary, color: '#FFF' }}>
            <LayoutGrid size={14} />
            {index + 1}/{questions.length}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 pb-40">
        {/* #4 — tags row with the bookmark at the rightmost edge (same
            position as every other test type). */}
        <div className="flex items-start gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {label && (
              <Pill bg={T.primary + '15'} color={T.primary}>
                <ClipboardList size={10} />{label}
              </Pill>
            )}
            <Pill bg={topicColor(q.topic) + '15'} color={topicColor(q.topic)}>
              {topicIcon(q.topic)} {topicName(q.topic)}
            </Pill>
            {q.sub && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{q.sub}</Pill>}
            <Pill bg={q.type === 'msq' ? T.errorSoft : T.successSoft} color={q.type === 'msq' ? T.error : T.success}>
              {q.type === 'msq' ? 'Multi-select' : 'Single answer'}
            </Pill>
            {/* P16 — provenance badge (Advanced test + previous-paper mocks) */}
            <PyqBadge q={q} />
            <HighYieldBadge q={q} />
            {isMarked && <Pill bg={T.accent + '20'} color={T.accent}><Flag size={10} />Marked</Pill>}
          </div>
          {onToggleBookmark && (
            <Tip text={isBookmarked ? 'Bookmarked — tap to remove' : 'Save this question to Bookmarks for later review'}>
            <button onClick={toggleBookmark}
                    aria-pressed={isBookmarked}
                    aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this question'}
                    className="no-tap-highlight p-1 -mr-1 -mt-0.5 rounded-full active:bg-black/5 flex-shrink-0">
              <span className={"inline-block " + (bmAnim === 'pop' ? 'bm-pop' : bmAnim === 'deflate' ? 'bm-deflate' : '')}
                    key={bmAnim ? `${q.id}:${isBookmarked}` : q.id}
                    style={{ lineHeight: 0 }}>
                {isBookmarked
                  ? <BookmarkCheck size={20} className="text-accent" />
                  : <Bookmark size={20} className="text-muted" />}
              </span>
            </button>
            </Tip>
          )}
        </div>

        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: T.muted }}>Question {index + 1}</div>
        <div className="font-display text-xl leading-snug mb-6" style={{ color: T.ink }}>{q.q}</div>
        {/* P17 — optional image, shown between stem and options */}
        <QuestionImage q={q} />

        <div className="space-y-2.5 mb-6">
          {q.options.map((opt, i) => {
            const isSel = selected.includes(i);
            return (
              <div key={i} onClick={() => toggleOption(i)}
                   role="button"
                   tabIndex={0}
                   aria-pressed={isSel}
                   aria-label={`Option ${String.fromCharCode(65 + i)}: ${opt}`}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                       e.preventDefault();
                       toggleOption(i);
                     }
                   }}
                   className="no-tap-highlight rounded-2xl px-4 py-3.5 flex items-start gap-3 cursor-pointer active:scale-[0.99] transition-colors"
                   style={{ background: isSel ? T.primary + '08' : T.surface,
                            border: `1.5px solid ${isSel ? T.primary : T.border}` }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold"
                     style={{ background: isSel ? T.primary : T.surface,
                              border: `1.5px solid ${isSel ? T.primary : T.border}`,
                              color: isSel ? '#FFF' : T.muted }}>
                  {String.fromCharCode(65 + i)}
                </div>
                <div className="text-sm leading-snug pt-0.5" style={{ color: T.ink }}>{opt}</div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={toggleMark}
                  className="no-tap-highlight flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                  style={{ background: isMarked ? T.accent + '15' : T.surface,
                           border: `1px solid ${isMarked ? T.accent : T.border}`,
                           color: isMarked ? T.accent : T.inkSoft }}>
            <Flag size={12} />
            {isMarked ? 'Unmark' : 'Mark for review'}
          </button>
          <button onClick={clearAnswer} disabled={selected.length === 0}
                  className="no-tap-highlight flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
                  style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
            <RotateCcw size={12} />
            Clear answer
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex gap-2">
          <Button variant="ghost" onClick={goPrev} disabled={index === 0} className="flex-1" icon={<ChevronLeft size={16} />}>
            Previous
          </Button>
          {index < questions.length - 1 ? (
            <Button onClick={goNext} className="flex-1" icon={<ChevronRight size={16} />}>
              Next
            </Button>
          ) : (
            <Button variant="accent" onClick={() => setConfirm('submit')} className="flex-1" icon={<Send size={16} />}>
              Submit test
            </Button>
          )}
        </div>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setPaletteOpen(false)}>
          <div className="w-full max-w-md mx-auto rounded-t-2xl anim-fadeup"
               style={{ background: T.bg, maxHeight: '85vh', overflowY: 'auto' }}
               onClick={e => e.stopPropagation()}>
            <div className="p-4 sticky top-0" style={{ background: T.bg, borderBottom: `1px solid ${T.borderSoft}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>Question palette</div>
                <button onClick={() => setPaletteOpen(false)} className="no-tap-highlight p-2 -mr-2 rounded-lg active:bg-black/5">
                  <X size={18} style={{ color: T.muted }} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs" style={{ color: T.inkSoft }}>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: T.success }} />Answered <span style={{ color: T.muted }}>({answeredCount})</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: T.border }} />Blank <span style={{ color: T.muted }}>({blankCount})</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: T.surface, boxShadow: `0 0 0 2px ${T.accent}` }} />Marked <span style={{ color: T.muted }}>({markedCount})</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: T.primary }} />Current</div>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-6 gap-2 mb-4">
                {questions.map((qq, i) => {
                  const ans = answers[qq.id] && answers[qq.id].length > 0;
                  const mk = !!marked[qq.id];
                  const isCurrent = i === index;
                  let bg = T.border, textColor = T.muted;
                  if (ans) { bg = T.success; textColor = '#FFF'; }
                  if (isCurrent) { bg = T.primary; textColor = '#FFF'; }
                  return (
                    <button key={qq.id} onClick={() => goTo(i)}
                            className="no-tap-highlight w-full aspect-square rounded-lg text-sm font-semibold active:scale-95 transition-all"
                            style={{ background: bg, color: textColor,
                                     boxShadow: mk ? `0 0 0 2px ${T.accent}` : 'none' }}>
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <Button variant="accent" onClick={() => { setPaletteOpen(false); setConfirm('submit'); }} size="lg" className="w-full" icon={<Send size={16} />}>
                Submit test now
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setConfirm(null)}>
          <Card className="p-5 max-w-sm w-full anim-scalein" onClick={e => e.stopPropagation()}>
            <div className="font-display text-xl font-semibold mb-2" style={{ color: T.ink }}>
              {confirm === 'abort' ? 'Quit the test?' : 'Submit your test?'}
            </div>
            <div className="text-sm mb-4 leading-relaxed" style={{ color: T.muted }}>
              {confirm === 'abort'
                ? 'Your progress in this test will be lost. The main app data is unaffected.'
                : `You answered ${answeredCount} of ${questions.length}${blankCount > 0 ? `, leaving ${blankCount} blank` : ''}. ${markedCount > 0 ? `${markedCount} marked for review.` : ''}`}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)} className="flex-1">Cancel</Button>
              <Button variant={confirm === 'abort' ? 'accent' : 'primary'}
                      onClick={() => { if (confirm === 'abort') onAbort(); else doManualSubmit(); }}
                      className="flex-1">
                {confirm === 'abort' ? 'Quit' : 'Submit'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// ADVANCED TEST — RESULTS
// =====================================================================
function AdvancedTestResults({ questions, answers, timePerQ, elapsedSec, auto, onHome, onReview, label, timeMinutes, profileId,
                              everCorrectIds = [], advancedTestHistory = null,
                              displayName = null, streak = 0, referralCode = null, isGuest = false, onGuestSignIn, onCribSheet = null }) {
  const { theme: T } = useTheme();
  const summary = useMemo(() => {
    let correct = 0, wrong = 0, blank = 0;
    const detail = [];
    const everCorrect = new Set(everCorrectIds || []);
    let changedRightToWrong = 0;
    questions.forEach(q => {
      const ans = answers[q.id] || [];
      if (ans.length === 0) {
        blank++; detail.push({ q, status: 'blank' });
      } else if (arraysEqualUnordered(ans, q.correct)) {
        correct++; detail.push({ q, status: 'correct', selected: ans });
      } else {
        wrong++; detail.push({ q, status: 'wrong', selected: ans });
        // #2 — flagged a question they once had right and changed away from.
        if (everCorrect.has(q.id)) changedRightToWrong++;
      }
    });
    const netScore = correct - (wrong / 3);
    const attempted = correct + wrong;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const avgTime = questions.length > 0 ? elapsedSec / questions.length : 0;

    const byTopic = {};
    detail.forEach(d => {
      const tid = d.q.topic;
      if (!byTopic[tid]) byTopic[tid] = { correct: 0, wrong: 0, blank: 0, total: 0 };
      byTopic[tid].total++;
      byTopic[tid][d.status]++;
    });
    const topicArr = Object.entries(byTopic).map(([tid, s]) => ({
      tid, ...s,
      accuracy: (s.correct + s.wrong) > 0 ? Math.round((s.correct / (s.correct + s.wrong)) * 100) : 0
    })).sort((a, b) => b.accuracy - a.accuracy);

    return { correct, wrong, blank, netScore, accuracy, avgTime, detail, topicArr, changedRightToWrong };
  }, [questions, answers, elapsedSec, everCorrectIds]);

  const wrongAndBlank = summary.detail.filter(d => d.status !== 'correct');
  const maxScore = questions.length;
  const pctOfMax = (summary.netScore / maxScore) * 100;

  const verdict =
    pctOfMax >= 80 ? { word: 'Exam-ready', color: T.success } :
    pctOfMax >= 60 ? { word: 'On track', color: T.primary } :
    pctOfMax >= 40 ? { word: 'Keep pushing', color: T.accent } :
                     { word: 'More prep needed', color: T.error };

  const fmtTime = (s) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  const qTime = (qid) => timePerQ && timePerQ[qid] ? `${Math.round(timePerQ[qid])}s` : '—';

  return (
    <div className="anim-fadeup">
      <TopBar title={label ? `${label} — results` : "Test results"} onBack={onHome} feedback={{ screen: "Advanced test results" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">
        <MotivationCard pct={Math.max(0, pctOfMax)} label="test" />
        {isGuest && <GuestSavePrompt onSignIn={onGuestSignIn} />}
        {auto && (
          <Card className="p-3 mb-4" style={{ background: T.accent + '15', border: `1px solid ${T.accent}40` }}>
            <div className="flex items-center gap-2 text-sm" style={{ color: T.accent }}>
              <AlertTriangle size={16} />
              <span className="font-medium">Time expired — auto-submitted</span>
            </div>
          </Card>
        )}

        <div className="text-center mb-6 mt-4">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>Net score (after negative marking)</div>
          <div className="font-display text-6xl font-semibold leading-none" style={{ color: verdict.color }}>
            {summary.netScore.toFixed(2)}
          </div>
          <div className="text-sm mt-2" style={{ color: T.muted }}>out of {maxScore} · {verdict.word}</div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card className="p-3 text-center">
            <Check size={16} className="mx-auto mb-1" style={{ color: T.success }} />
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>{summary.correct}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Correct +1</div>
          </Card>
          <Card className="p-3 text-center">
            <X size={16} className="mx-auto mb-1" style={{ color: T.error }} />
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>{summary.wrong}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Wrong −⅓</div>
          </Card>
          <Card className="p-3 text-center">
            <EyeOff size={16} className="mx-auto mb-1" style={{ color: T.muted }} />
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>{summary.blank}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Blank 0</div>
          </Card>
        </div>

        {/* #2 — second-guessing insight */}
        {summary.changedRightToWrong > 0 && (
          <Card className="p-3 mb-4" style={{ background: '#B8791A15', border: '1px solid #B8791A40' }}>
            <div className="flex items-start gap-2">
              <Repeat size={16} style={{ color: '#B8791A', marginTop: 1 }} className="shrink-0" />
              <div className="text-[13px] leading-snug" style={{ color: T.ink }}>
                You changed <b>{summary.changedRightToWrong}</b> {summary.changedRightToWrong === 1 ? 'answer' : 'answers'} from right to wrong. Trust your first instinct unless you’re certain.
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2 mb-6">
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: T.muted }}>Accuracy</div>
            <div className="font-display text-2xl font-semibold" style={{ color: T.ink }}>{summary.accuracy}%</div>
            <div className="text-[10px]" style={{ color: T.muted }}>of attempted</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: T.muted }}>Total time</div>
            <div className="font-display text-2xl font-semibold" style={{ color: T.ink }}>{fmtTime(elapsedSec)}</div>
            <div className="text-[10px]" style={{ color: T.muted }}>~{Math.round(summary.avgTime)}s per Q</div>
          </Card>
        </div>

        {/* PHIL-04 — The Ghost Shift: you vs your ~2-weeks-ago self. Only on the
            random-pool Advanced mock (history passed); hidden on paper results. */}
        <GhostShiftCard history={advancedTestHistory} />

        {summary.topicArr.length > 0 && (
          <Card className="p-4 mb-5">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: T.muted }}>Topic-wise breakdown</div>
            <div className="space-y-3">
              {summary.topicArr.map(t => (
                <div key={t.tid}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="font-medium truncate flex-1 pr-2" style={{ color: T.ink }}>
                      {topicIcon(t.tid)} {topicName(t.tid)}
                    </div>
                    <div className="text-xs tabular-nums flex-shrink-0" style={{ color: T.muted }}>
                      <span style={{ color: T.success }}>{t.correct}</span>
                      <span> / </span>
                      <span style={{ color: T.error }}>{t.wrong}</span>
                      <span> / </span>
                      <span style={{ color: T.muted }}>{t.blank}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: T.borderSoft }}>
                    <div style={{ width: `${(t.correct / t.total) * 100}%`, background: T.success, transition: 'width 0.6s ease-out' }} />
                    <div style={{ width: `${(t.wrong / t.total) * 100}%`, background: T.error, transition: 'width 0.6s ease-out' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* P12 — per-question time quadrant for mock / paper tests. Ideal
            pace = (timeMinutes*60)/n; "slow" = >1.5× that. Blanks map to the
            neutral "Not attempted" bucket (never scored wrong here). Falls
            back to the untimed 60s/90s rule if no limit was supplied. */}
        {questions.length > 0 && (() => {
          const n = questions.length;
          const idealSec = (typeof timeMinutes === 'number' && timeMinutes > 0) ? (timeMinutes * 60) / n : 60;
          const slowSec = (typeof timeMinutes === 'number' && timeMinutes > 0) ? idealSec * 1.5 : 90;
          const items = summary.detail.map(d => ({
            qId: d.q.id,
            q: d.q,
            outcome: d.status === 'blank' ? 'na' : d.status,
            seconds: (timePerQ && Number(timePerQ[d.q.id])) || 0,
          }));
          return (
            <TimeQuadrant
              mode="mock"
              slowSec={slowSec}
              idealSec={(typeof timeMinutes === 'number' && timeMinutes > 0) ? idealSec : null}
              totalSec={elapsedSec}
              items={items}
            />
          );
        })()}

        {wrongAndBlank.length > 0 && (
          <div className="mb-5">
            <div className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: T.muted }}>
              Wrong & skipped questions ({wrongAndBlank.length})
            </div>
            <div className="space-y-3">
              {wrongAndBlank.map(({ q, status, selected }) => {
                const qNum = questions.findIndex(qq => qq.id === q.id) + 1;
                return (
                  <Card key={q.id} className="p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Pill bg={status === 'blank' ? T.surfaceWarm : T.errorSoft}
                            color={status === 'blank' ? T.muted : T.error}>
                        {status === 'blank' ? <><EyeOff size={10} />Skipped</> : <><X size={10} />Wrong</>}
                      </Pill>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>
                        Q{qNum} · {topicName(q.topic)}{q.sub ? ` · ${q.sub}` : ''} · {qTime(q.id)}
                      </span>
                      {/* P16 — provenance badge in review */}
                      <PyqBadge q={q} />
                      <HighYieldBadge q={q} />
                    </div>
                    <div className="text-sm font-medium mb-3 leading-snug" style={{ color: T.ink }}>{q.q}</div>
                    {/* P17 — optional image in review */}
                    <QuestionImage q={q} />

                    <div className="space-y-1.5 mb-3">
                      {q.options.map((opt, i) => {
                        const isCorrect = q.correct.includes(i);
                        const wasSelected = selected && selected.includes(i);
                        let labelBg = T.surfaceWarm, labelColor = T.inkSoft, iconEl = null;
                        if (isCorrect) { labelBg = T.successSoft; labelColor = T.success; iconEl = <Check size={12} />; }
                        else if (wasSelected) { labelBg = T.errorSoft; labelColor = T.error; iconEl = <X size={12} />; }
                        return (
                          <div key={i} className="flex items-start gap-2 text-xs" style={{ color: T.inkSoft }}>
                            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 font-semibold"
                                 style={{ background: labelBg, color: labelColor }}>
                              {iconEl || String.fromCharCode(65 + i)}
                            </div>
                            <div className="leading-snug pt-0.5">{opt}</div>
                          </div>
                        );
                      })}
                    </div>

                    {q.exp && (
                    <div className="text-xs leading-relaxed pt-3 mt-1 border-t" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                      <div className="font-semibold text-[10px] uppercase tracking-wider mb-1.5" style={{ color: T.muted }}>Explanation</div>
                      <div className="whitespace-pre-wrap">{q.exp}</div>
                      {q.wrong && Object.keys(q.wrong).length > 0 && (
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
                          <div className="font-semibold text-[10px] uppercase tracking-wider mb-1.5" style={{ color: T.muted }}>Why the others are wrong</div>
                          <div className="space-y-1">
                            {Object.entries(q.wrong).map(([idx, txt]) => (
                              <div key={idx}><span className="font-semibold">{String.fromCharCode(65 + parseInt(idx))}.</span> {txt}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* P8 — feedback toggle on the finished-test review */}
                      <HelpfulToggle questionId={q.id} explanation={q.exp} profileId={profileId} />
                    </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2 mt-6">
          {/* #28 — opt-in Crib Sheet review (hidden when the Settings toggle
              is off; App passes onCribSheet=null in that case). */}
          {onCribSheet && (
            <Button onClick={onCribSheet} size="lg" className="w-full">
              Review answers — Crib Sheet
            </Button>
          )}
          {wrongAndBlank.length > 0 && onReview && (
            <Button variant="ghost" onClick={() => onReview(wrongAndBlank.map(d => d.q.id))} size="lg" className="w-full">
              Practice the missed ones
            </Button>
          )}
          {/* P5 — share the correct/total score (not the negative-marked net).
              `label` (set for previous-year papers) names the test; mocks fall
              back to "Mock Test". Topic omitted (mocks/papers span topics). */}
          <ShareScoreButton correct={summary.correct} total={questions.length}
                            quizType={label ? String(label) : 'Mock Test'}
                            displayName={displayName} streak={streak} referralCode={referralCode} />
          <Button onClick={onHome} size="lg" className="w-full">
            Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}

export { AdvancedTestSetup, AdvancedTest, AdvancedTestResults };
