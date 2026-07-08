// =====================================================================
// STUDY PLAN SCREEN  (#6)  —  personalised day-by-day revision plan
// =====================================================================
// Orchestrates exam date + weak topics + spaced-due into a dated timeline.
// The schedule skeleton is generated once and persisted (local, per profile)
// so it stays stable; it regenerates only when the exam date changes or the
// user taps Regenerate. Tasks are actionable: tap a topic to practise it now,
// start a mock, or jump into due reviews. Day completion persists.
// =====================================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarDays, Target, BookOpen, Timer, Moon, CheckCircle2, Circle, Play, RefreshCw, ChevronDown, Pencil } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { buildStudyPlan, planProgress, planMatchesExam, PLAN_KINDS } from '../lib/study-plan.js';
import { getWeakTopics, topicName, topicColor } from '../lib/topics.js';
import { reviewForecast } from '../lib/review-forecast.js';
// FEAT-02 — the exam-date + daily-goal editor is embedded here so Study Plan
// is the single home for "set your date" AND "see your day-by-day plan".
import { ExamDateEditor } from './exam-date-screen.jsx';

function dateLabel(ms, offsetFromToday) {
  if (offsetFromToday === 0) return 'Today';
  if (offsetFromToday === 1) return 'Tomorrow';
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

const KIND_ICON = { study: BookOpen, mock: Timer, rest: Moon };

export default function StudyPlan({ profileId, onBack, onStartTopic, onStartMock, onStartReview,
                                    allQuestionsCount = 0, onSetExamDateValue, onClearExamDate, onSaveTarget }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  const examDate = (data && data.stats && data.stats.examDate) || null;
  const accent = (T.sec && T.sec.revision) || T.primary;

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  // FEAT-02 — embedded exam-date/goal editor. Open by default until a date is
  // set (so a first-time user lands straight on the date picker), collapsed once
  // a plan exists (tap "Edit" to change date/goal).
  const [editorOpen, setEditorOpen] = useState(false);

  // Inputs for generation (weak topics worst-first, coverage gaps, all topics).
  const inputs = useMemo(() => {
    const weakTopics = getWeakTopics(data.history, allQuestions);
    const allTopicIds = [...new Set(allQuestions.map(q => q.topic).filter(Boolean))];
    const seenSet = new Set();
    Object.keys(data.history || {}).forEach(qId => {
      const q = allQuestions.find(x => x.id === qId);
      if (q && q.topic) seenSet.add(q.topic);
    });
    return { weakTopics, allTopicIds, seenTopicIds: [...seenSet] };
  }, [data.history, allQuestions]);

  const dueToday = useMemo(() => reviewForecast(data.history, { days: 1 }).dueNow, [data.history]);

  const persist = useCallback(async (p) => {
    try { await safeStorage.set(KEYS.studyPlan(profileId), JSON.stringify(p), false); } catch (e) {}
  }, [profileId]);

  const regenerate = useCallback(() => {
    if (!examDate) return;
    const fresh = buildStudyPlan({ examDate, ...inputs });
    if (fresh.ok) fresh.completed = {};
    setPlan(fresh);
    if (fresh.ok) persist(fresh);
  }, [examDate, inputs, persist]);

  // Load stored plan, or generate when missing / exam date changed. Skeleton is
  // intentionally NOT regenerated on every history change (would shift the plan).
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      let stored = null;
      try { const raw = await safeStorage.get(KEYS.studyPlan(profileId), false); stored = raw ? JSON.parse(raw) : null; } catch (e) {}
      if (!alive) return;
      if (stored && stored.ok && planMatchesExam(stored, examDate)) {
        setPlan(stored);
      } else if (examDate) {
        const fresh = buildStudyPlan({ examDate, ...inputs });
        if (fresh.ok) fresh.completed = (stored && stored.completed) ? stored.completed : {};
        setPlan(fresh);
        if (fresh.ok) persist(fresh);
      } else {
        setPlan({ ok: false, reason: 'no-exam-date' });
      }
      setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examDate, profileId]);

  const toggleDone = useCallback((dateMs) => {
    setPlan(prev => {
      if (!prev || !prev.ok) return prev;
      const completed = { ...(prev.completed || {}) };
      if (completed[dateMs]) delete completed[dateMs]; else completed[dateMs] = true;
      const next = { ...prev, completed };
      persist(next);
      return next;
    });
  }, [persist]);

  const prog = useMemo(() => planProgress(plan, plan && plan.completed, Date.now()), [plan]);

  return (
    <div className="anim-fadeup">
      <TopBar title="Study plan" onBack={onBack} feedback={{ screen: 'Study plan' }}
              right={plan && plan.ok ? (
                <button onClick={regenerate} aria-label="Regenerate plan"
                        className="no-tap-highlight p-2 rounded-full active:bg-black/5">
                  <RefreshCw size={17} style={{ color: T.muted }} />
                </button>
              ) : null} />

      <PageContainer size="content" className="pb-24 pt-2">
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: T.muted }}>Building your plan…</div>
        ) : !plan || !plan.ok ? (
          // No date yet (or it has passed) → the embedded editor IS the screen.
          <>
            <div className="mt-1 mb-4 px-0.5">
              <div className="text-[16px] font-semibold mb-1" style={{ color: T.ink }}>
                {plan && plan.reason === 'past' ? 'Your exam date has passed' : 'Plan your run to exam day'}
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
                {plan && plan.reason === 'past'
                  ? 'Set a new exam date below and we’ll build a fresh day-by-day plan.'
                  : 'Set your exam date below and we’ll build a personalised schedule, weak topics first, spaced reviews daily, and timed mocks as checkpoints.'}
              </p>
            </div>
            <ExamDateEditor allQuestionsCount={allQuestionsCount}
                            onSave={onSetExamDateValue} onClear={onClearExamDate} onSaveTarget={onSaveTarget} />
          </>
        ) : (
          <>
            {/* FEAT-02 — collapsible exam-date / daily-goal editor. Collapsed by
                default (the plan is the star); "Edit" expands the full editor. */}
            <button onClick={() => setEditorOpen(o => !o)}
                    className="no-tap-highlight w-full flex items-center gap-2.5 mb-3 rounded-2xl px-3.5 py-2.5 active:scale-[0.99] transition"
                    style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
              <CalendarDays size={16} style={{ color: accent }} className="flex-shrink-0" />
              <div className="min-w-0 flex-1 text-left">
                <div className="text-[13px] font-semibold" style={{ color: T.ink }}>Exam date &amp; daily goal</div>
                <div className="text-[11px]" style={{ color: T.muted }}>
                  {new Date(examDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {prog.daysLeft >= 0 ? ` · ${prog.daysLeft} day${prog.daysLeft === 1 ? '' : 's'} left` : ''}
                  {data.stats.dailyTarget > 0 ? ` · ${data.stats.dailyTarget}/day` : ' · auto pace'}
                </div>
              </div>
              {editorOpen
                ? <ChevronDown size={16} style={{ color: T.muted }} className="flex-shrink-0" />
                : <Pencil size={14} style={{ color: T.muted }} className="flex-shrink-0" />}
            </button>
            {editorOpen && (
              <div className="mb-5 anim-fadeup">
                <ExamDateEditor allQuestionsCount={allQuestionsCount}
                                onSave={onSetExamDateValue} onClear={onClearExamDate} onSaveTarget={onSaveTarget}
                                onSaved={() => setEditorOpen(false)} />
              </div>
            )}

            <HeaderCard T={T} accent={accent} prog={prog} onRegenerate={regenerate} />
            <div className="mt-5 space-y-2.5">
              {plan.days.map((d) => (
                <DayRow key={d.dateMs} day={d} T={T} accent={accent}
                        isToday={d.offset === prog.todayIndex}
                        isPast={prog.todayIndex >= 0 && d.offset < prog.todayIndex}
                        done={!!(plan.completed && plan.completed[d.dateMs])}
                        dueToday={dueToday}
                        onToggle={() => toggleDone(d.dateMs)}
                        onStartTopic={onStartTopic} onStartMock={onStartMock} onStartReview={onStartReview} />
              ))}
            </div>
          </>
        )}
      </PageContainer>
    </div>
  );
}

function HeaderCard({ T, accent, prog, onRegenerate }) {
  const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
  return (
    <Card className="p-4" style={{ background: accent + '0E', border: `1px solid ${accent}33` }}>
      <div className="flex items-center gap-1.5">
        <Target size={13} style={{ color: accent }} />
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: accent }}>Your plan</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-semibold leading-none" style={{ fontSize: '2.4rem', color: T.ink }}>{prog.daysLeft}</span>
            <span className="text-[13px]" style={{ color: T.muted }}>{prog.daysLeft === 1 ? 'day to exam' : 'days to exam'}</span>
          </div>
          <div className="text-[12px] mt-1" style={{ color: T.muted }}>{prog.done} of {prog.total} days done</div>
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: T.surfaceWarm }}>
        <div style={{ width: `${pct}%`, height: '100%', background: accent, borderRadius: 999, transition: 'width 0.6s ease-out' }} />
      </div>
    </Card>
  );
}

function DayRow({ day, T, accent, isToday, isPast, done, dueToday, onToggle, onStartTopic, onStartMock, onStartReview }) {
  const Icon = KIND_ICON[day.kind] || BookOpen;
  const kindColor = day.kind === 'mock' ? T.sec.mock : day.kind === 'rest' ? T.muted : accent;
  const border = isToday ? accent : (done ? T.borderSoft : T.border);
  const bg = isToday ? accent + '12' : T.surface;

  return (
    <div className="rounded-2xl p-3.5" style={{ background: bg, border: `1.5px solid ${border}`, opacity: isPast && !done ? 0.6 : 1 }}>
      <div className="flex items-start gap-3">
        {/* date rail + toggle */}
        <button onClick={onToggle} aria-label={done ? 'Mark not done' : 'Mark done'}
                className="no-tap-highlight flex flex-col items-center gap-1.5 shrink-0 active:scale-90 transition" style={{ width: 46 }}>
          <span className="text-[10px] font-semibold leading-tight text-center" style={{ color: isToday ? accent : T.muted }}>
            {dateLabel(day.dateMs, day.offset)}
          </span>
          {done
            ? <CheckCircle2 size={22} style={{ color: T.success }} />
            : <Circle size={22} style={{ color: isToday ? accent : T.border }} />}
        </button>

        {/* content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon size={14} style={{ color: kindColor }} />
            <span className="text-[14px] font-semibold" style={{ color: T.ink, textDecoration: done ? 'line-through' : 'none' }}>{day.title}</span>
            {isToday && <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full" style={{ background: accent, color: '#fff' }}>Today</span>}
          </div>

          {day.note && <p className="text-[12px] leading-relaxed mt-1" style={{ color: T.inkSoft }}>{day.note}</p>}

          {/* study: tappable topic chips */}
          {day.kind === 'study' && day.focusTopics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {day.focusTopics.map((tid) => {
                const tc = topicColor(tid);
                return (
                  <button key={tid} onClick={() => onStartTopic && onStartTopic(tid)}
                          className="no-tap-highlight inline-flex items-center gap-1 text-[12px] font-medium rounded-full pl-2.5 pr-2 py-1 active:scale-95 transition"
                          style={{ background: tc + '16', color: tc, border: `1px solid ${tc}33` }}>
                    {topicName(tid)} <Play size={11} fill="currentColor" />
                  </button>
                );
              })}
            </div>
          )}

          {/* mock: start button */}
          {day.kind === 'mock' && (
            <button onClick={() => onStartMock && onStartMock()}
                    className="no-tap-highlight inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-3 py-1.5 mt-2 active:scale-95 transition"
                    style={{ background: T.sec.mock, color: '#fff' }}>
              <Timer size={13} /> Start mock
            </button>
          )}

          {/* today's review nudge (any non-rest day) */}
          {isToday && day.kind !== 'rest' && dueToday > 0 && (
            <button onClick={() => onStartReview && onStartReview()}
                    className="no-tap-highlight inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full px-3 py-1.5 mt-2 ml-1.5 active:scale-95 transition"
                    style={{ background: accent + '16', color: accent, border: `1px solid ${accent}33` }}>
              <RefreshCw size={12} /> Review {dueToday} due
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
