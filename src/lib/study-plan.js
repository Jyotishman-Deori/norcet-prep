// =====================================================================
// STUDY PLAN  —  pure day-by-day revision-plan generator
// =====================================================================
// No React, no storage. Orchestrates the data the app already has — exam date,
// weak topics (worst-accuracy first), coverage gaps (unseen topics) and a mock
// cadence — into a dated schedule from today to exam day.
//
// Philosophy: weak topics front-loaded and revisited; unseen topics covered;
// mocks as periodic checkpoints (denser near the end); the day before the exam
// is a full mock; exam day is light + rest. The schedule is a stable skeleton —
// regenerate only on demand or when the exam date changes, never silently — so
// "Thursday = Pharmacology" doesn't move under the user.
// =====================================================================

const DAY = 86400000;
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

export const PLAN_KINDS = { STUDY: 'study', MOCK: 'mock', REST: 'rest' };

// params:
//   examDate     ISO string (required)
//   weakTopics   [{ topic, accuracy(0..1), total }] weakest-first (getWeakTopics)
//   seenTopicIds iterable of topic ids the user has touched
//   allTopicIds  iterable of every topic id worth scheduling
//   now          ms (default Date.now())
export function buildStudyPlan({ examDate, weakTopics = [], seenTopicIds = [], allTopicIds = [], now = Date.now() } = {}) {
  if (!examDate) return { ok: false, reason: 'no-exam-date' };
  const todayStart = startOfDay(now);
  const examMs = new Date(examDate).getTime();
  if (Number.isNaN(examMs)) return { ok: false, reason: 'bad-date' };
  const daysLeft = daysBetween(todayStart, examMs);
  if (daysLeft < 0) return { ok: false, reason: 'past', daysLeft };

  const seen = new Set(seenTopicIds);
  const all = [...allTopicIds];
  const weakIds = weakTopics.map((w) => w.topic).filter((id) => all.includes(id));
  const weakSet = new Set(weakIds);
  const unseenIds = all.filter((id) => !seen.has(id) && !weakSet.has(id));
  const unseenSet = new Set(unseenIds);
  const restIds = all.filter((id) => !weakSet.has(id) && !unseenSet.has(id));

  // Weak topics listed twice so they get extra time early; then coverage gaps,
  // then everything else for reinforcement. Cycled across study days.
  const queue = [...weakIds, ...weakIds, ...unseenIds, ...restIds];

  const totalDays = daysLeft + 1; // inclusive of today + exam day
  const mockEvery = totalDays >= 14 ? 4 : totalDays >= 7 ? 3 : 2;
  const topicsPerDay = totalDays > 10 ? 2 : 1;

  const days = [];
  let qPtr = 0;

  for (let i = 0; i < totalDays; i++) {
    const dateMs = todayStart + i * DAY;
    const base = { dayNum: i + 1, offset: i, dateMs };

    // exam day → rest
    if (i === totalDays - 1) {
      days.push({ ...base, kind: PLAN_KINDS.REST, title: 'Exam day', focusTopics: [],
        note: 'A light glance at your crib sheets, then rest. Trust your prep: you’ve got this.' });
      continue;
    }
    // day before exam → final full mock (only if there's room)
    if (totalDays >= 3 && i === totalDays - 2) {
      days.push({ ...base, kind: PLAN_KINDS.MOCK, title: 'Final full mock', focusTopics: [],
        note: 'One last timed mock under exam conditions, then review every miss.' });
      continue;
    }
    // periodic mock checkpoints
    if (i > 0 && i % mockEvery === 0) {
      days.push({ ...base, kind: PLAN_KINDS.MOCK, title: 'Mock checkpoint', focusTopics: [],
        note: 'A timed mock to see where you stand, then revise the weak spots it exposes.' });
      continue;
    }
    // study day
    const focus = [];
    for (let k = 0; k < topicsPerDay && queue.length > 0; k++) {
      focus.push(queue[qPtr % queue.length]);
      qPtr += 1;
    }
    days.push({ ...base, kind: PLAN_KINDS.STUDY, title: 'Focused practice', focusTopics: focus, note: null });
  }

  return { ok: true, version: 1, examDate, generatedAt: now, daysLeft, totalDays, days };
}

// Live progress over a stored plan + a completion map keyed by dateMs.
export function planProgress(plan, completed = {}, now = Date.now()) {
  if (!plan || !plan.ok || !Array.isArray(plan.days)) return { total: 0, done: 0, todayIndex: -1, daysLeft: 0 };
  const todayStart = startOfDay(now);
  let todayIndex = -1;
  plan.days.forEach((d, i) => { if (startOfDay(d.dateMs) === todayStart) todayIndex = i; });
  const total = plan.days.length;
  const done = plan.days.filter((d) => completed[d.dateMs]).length;
  const examMs = new Date(plan.examDate).getTime();
  return { total, done, todayIndex, daysLeft: Math.max(0, daysBetween(todayStart, examMs)) };
}

// Does a stored plan still match the user's exam date?
export function planMatchesExam(plan, examDate) {
  if (!plan || !plan.ok || !examDate) return false;
  return startOfDay(new Date(plan.examDate).getTime()) === startOfDay(new Date(examDate).getTime());
}
