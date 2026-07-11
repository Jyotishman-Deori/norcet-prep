// =====================================================================
// src/lib/report-card.js — the pure, honest data model behind the
// Progress Report (a shareable PNG card + a printable PDF).
//
// ONE model, TWO renderers: src/lib/qr-canvas.js paints the PNG and
// src/ui/report-print.jsx lays out the PDF, both from this object. Neither
// does any math. This module is where every honesty decision lives, so the
// two artifacts can never disagree.
//
// Node-testable: no storage/React import. It reaches into game-config only
// through progress()/tierFor(), which read an in-memory CONFIG synchronously
// (game-config lazy-imports storage inside loadGameConfig only), so `node
// src/lib/report-card.test.js` runs it directly.
//
// THE HONESTY RULES (each has a test that locks it):
//   1. Accuracy is FIRST-attempt (firstAttemptTotals), never lifetime
//      totalCorrect/totalAttempted, which counts re-answers and is inflatable.
//   2. A metric with too little data degrades to null ("Not enough data yet"),
//      NEVER to a flattering zero. Mirrors the benchmark.js HONESTY NOTES rule.
//   3. Mock tests and previous-year papers write NEITHER data.stats NOR
//      data.history, so the practice figures are quiz-mode only. Timed tests
//      get their own section and never leak into the practice numbers.
//   4. No wall-clock/session time exists, so there is NO "study hours" figure.
//      Only the two real, honestly-labelled time signals: time in timed tests
//      (elapsedSec) and a floor for time on quiz questions (timeMs).
//   5. Every string here is English, with no em dash and no double hyphen
//      (report-card.test.js scans for both; check-locales never sees src/lib).
// =====================================================================
import { attemptStats, hasBeenSeen } from './compact.js';
import { firstAttemptTotals } from './leaderboard-score.js';
import { progress, tierFor } from './levelup.js';
import { masteryTally } from './kmap.js';
import { resolveTopicId, topicName, topicColor } from './topics.js';
import { buildMistakes, unresolvedCount } from './mistakes.js';

export const REPORT_VERSION = 1;
// User-facing name is "Progress Card". The plain word "report" collides with the
// app's "report a problem" / "My reports" feedback surfaces, and "transcript"
// would over-claim (it reads as an official academic record, which this is not,
// and the legal disclaimer explicitly says "not a transcript"). Internal ids and
// filenames keep the report-card / progress-report slugs.
export const REPORT_TITLE = 'Progress Card';
export const REPORT_SUBTITLE = 'A summary of your own practice in NurseHolic';

// One line, baked onto the PNG canvas so a screenshot carries its own context
// (the existing share card has no disclaimer at all, which is the gap this closes).
export const REPORT_DISCLAIMER_SHORT =
  'Self-generated summary. Not a certificate, not a rank, not an official result.';

// The full paragraph, printed in the PDF and shown on the screen preview. The
// last sentence repeats common.eduTag verbatim so the report reads in the same
// voice as the rest of the app.
export const REPORT_DISCLAIMER =
  'This is a self-generated summary of your own practice inside NurseHolic. It is not a certificate, not a transcript, not a result and not proof of any qualification. The numbers are produced on your device from your own activity and are not verified by anyone. NurseHolic is an independent study tool and is not affiliated with, endorsed by or connected to AIIMS, any examination authority or any government body. Educational use only. Not for clinical decisions.';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Deterministic across Node and every browser locale (toLocaleDateString is
// not, and it would break the test assertions).
function formatDate(ts) {
  const d = new Date(typeof ts === 'number' ? ts : Date.now());
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function commaNum(n) {
  const v = Math.max(0, Math.round(n || 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Whole minutes into "2h 40m" / "40m" / "0m". Never "study hours".
function durationFromSeconds(totalSec) {
  const sec = Math.max(0, Math.round(totalSec || 0));
  const mins = Math.round(sec / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function stat(id, label, value, display, detail) {
  return { id, label, value, display, detail };
}

// The one degradation path. A thin metric says "Not enough data yet", so the
// artifacts can render `display` blindly and never print a flattering "0%".
function none(id, label, detail) {
  return { id, label, value: null, display: 'Not enough data yet', detail };
}

export function buildReportCard({ profile, data, allQuestions, now } = {}) {
  const nowTs = typeof now === 'number' ? now : Date.now();
  const d = (data && typeof data === 'object') ? data : {};
  const history = (d.history && typeof d.history === 'object') ? d.history : {};
  const stats = (d.stats && typeof d.stats === 'object') ? d.stats : {};
  const qs = Array.isArray(allQuestions) ? allQuestions : [];

  const byId = {};
  for (const q of qs) { if (q && q.id != null) byId[q.id] = q; }

  // ---- one scoped pass over history feeds every practice figure, so the
  // page is internally consistent. Mirrors StatsScreen's byTopic + coverage
  // (no GK filter: StatsScreen does not filter GK either, verified).
  let uniquePractised = 0;   // distinct questions with a real (non-reveal) attempt
  let totalAttempts = 0;     // every attempt, repeats included
  let totalCorrect = 0;
  let seen = 0;              // distinct questions opened at least once (in pool)
  let timeOnMs = 0;          // floor: quiz-mode per-question timer only
  const topicAgg = {};       // canonical topic id -> { correct, total }

  for (const qId of Object.keys(history)) {
    const h = history[qId];
    if (!h) continue;
    const q = byId[qId];
    if (!q) continue;                       // orphan from a removed bank
    if (hasBeenSeen(h)) seen += 1;
    const s = attemptStats(h);              // compaction-transparent, excludes reveals
    if (s.total === 0) continue;            // reveal-only questions are seen, not practised
    uniquePractised += 1;
    totalAttempts += s.total;
    totalCorrect += s.correct;
    if (!h.compacted && Array.isArray(h.attempts)) {
      for (const a of h.attempts) {
        if (a && !a.revealed && typeof a.timeMs === 'number' && a.timeMs > 0) timeOnMs += a.timeMs;
      }
    }
    const tid = resolveTopicId(q.topic);
    if (!topicAgg[tid]) topicAgg[tid] = { correct: 0, total: 0 };
    topicAgg[tid].total += s.total;
    topicAgg[tid].correct += s.correct;
  }

  // ---- accuracy: FIRST attempts only. Never stats.totalCorrect/totalAttempted.
  const fa = firstAttemptTotals(history);
  const accuracy = fa.attempted >= 10
    ? stat('accuracy', 'First-attempt accuracy', Math.round(fa.accuracy * 100),
        `${Math.round(fa.accuracy * 100)}%`,
        'Your very first answer to each question, before any retry. Questions where you revealed the answer first are not counted, and very old records that have been summarised to save space are not counted either.')
    : none('accuracy', 'First-attempt accuracy',
        'This needs at least ten first attempts before it means anything. Keep practising and it will appear.');

  const practiceAccuracy = totalAttempts >= 10
    ? stat('practiceAccuracy', 'Practice accuracy, repeats included', Math.round((totalCorrect / totalAttempts) * 100),
        `${Math.round((totalCorrect / totalAttempts) * 100)}%`,
        'Counts every attempt, including retries of a question you have seen before. This is the figure your Stats screen shows, so it is usually higher than the first-attempt figure.')
    : none('practiceAccuracy', 'Practice accuracy, repeats included',
        'This appears once you have given at least ten answers.');

  // ---- questions practised / attempts
  const questionsPractised = uniquePractised > 0
    ? stat('questionsPractised', 'Questions practised', uniquePractised, commaNum(uniquePractised),
        'Unique questions you have answered in quiz mode. Answering the same question again is counted once. Mock tests and previous-year papers are not included here.')
    : none('questionsPractised', 'Questions practised',
        'Answer a few questions in a Quick or Topic test and this starts counting.');

  const practiceAttempts = totalAttempts > 0
    ? stat('practiceAttempts', 'Practice attempts', totalAttempts, commaNum(totalAttempts),
        'Every answer you have given in quiz mode, including repeats of the same question.')
    : none('practiceAttempts', 'Practice attempts',
        'Every answer you give in quiz mode is counted here.');

  // ---- streaks (grace token can cover one rest day, so never "consecutive")
  const streakCur = Math.max(0, Math.floor(stats.streakCurrent || 0));
  const streakBestN = Math.max(0, Math.floor(stats.streakBest || 0));
  const streakBest = streakBestN > 0
    ? stat('streakBest', 'Best study streak', streakBestN, `${streakBestN} days`,
        `Your longest run of study days. One rest day can be covered by a grace token, so this is a study streak rather than a strict count of days in a row.${streakCur > 0 ? ` You are on a ${streakCur}-day streak right now.` : ''}`)
    : none('streakBest', 'Best study streak',
        'Study on any two days and your streak starts to build.');
  const streakCurrent = streakCur > 0
    ? stat('streakCurrent', 'Current study streak', streakCur, `${streakCur} days`,
        'Days you have kept studying in a row, up to today. A grace token can cover one rest day.')
    : none('streakCurrent', 'Current study streak',
        'Study today to start a new streak.');

  // ---- subtopic mastery (no GK filter: consistent with the rest of the page)
  let mt = { mastered: 0, inProgress: 0, touched: 0 };
  try { mt = masteryTally(history, qs, attemptStats, null) || mt; } catch (e) { /* keep zeros */ }
  const mastery = mt.touched > 0
    ? stat('mastery', 'Subtopics mastered', mt.mastered, commaNum(mt.mastered),
        `${mt.mastered} of the ${mt.touched} subtopics you have practised are at mastered level. ${mt.inProgress} are still building. Mastered means enough attempts at a high accuracy.`)
    : none('mastery', 'Subtopics mastered',
        'Practise a subtopic enough times at a good accuracy and it reaches mastered.');

  // ---- coverage of the current pool
  const poolSize = qs.length;
  const coverage = (poolSize > 0 && seen > 0)
    ? stat('coverage', 'Questions seen', Math.min(100, Math.round((seen / poolSize) * 100)),
        `${Math.min(100, Math.round((seen / poolSize) * 100))}%`,
        `${commaNum(seen)} of the ${commaNum(poolSize)} questions currently in your app opened at least once.`)
    : none('coverage', 'Questions seen',
        'This grows as you open more of the question bank.');

  // ---- level + prestige tier (XP comes from games, not quiz accuracy)
  const xp = Math.max(0, Math.floor((d.levelup && d.levelup.xp) || 0));
  const prog = progress(xp);
  const tier = tierFor(prog.level);
  const identity = xp > 0
    ? { level: prog.level, tierTitle: tier.title, tierAccent: tier.accent, xp }
    : null;
  const level = xp > 0
    ? stat('level', 'Level', prog.level, `Level ${prog.level}`,
        `${tier.title}. Your level rises with the Level Up mini-games and daily quests. It does not come from quiz accuracy.`)
    : none('level', 'Level',
        'Play the Level Up mini-games to start earning levels.');

  // ---- time (two honest signals, never "study hours")
  const timeOnQuestions = timeOnMs > 0
    ? stat('timeOnQuestions', 'Time on quiz questions, at least', Math.round(timeOnMs / 1000),
        durationFromSeconds(timeOnMs / 1000),
        'A floor, not a total. It adds up the per-question timer in quiz mode only, so it leaves out mock tests, reading explanations, revision and very old summarised records.')
    : none('timeOnQuestions', 'Time on quiz questions, at least',
        'The per-question timer adds up here as you practise.');

  // ---- timed tests (scored on their own, never fold into the figures above)
  const ath = Array.isArray(d.advancedTestHistory) ? d.advancedTestHistory : [];
  const mocksN = ath.length;
  let mockBestNet = null;
  let timedSec = 0;
  for (const r of ath) {
    if (!r) continue;
    if (typeof r.netScore === 'number') mockBestNet = mockBestNet === null ? r.netScore : Math.max(mockBestNet, r.netScore);
    if (typeof r.elapsedSec === 'number') timedSec += r.elapsedSec;
  }
  const mocks = mocksN > 0
    ? stat('mocks', 'Full-length mock tests', mocksN, commaNum(mocksN),
        `Mock tests are scored on their own and do not feed the accuracy, subject or streak figures.${mockBestNet !== null ? ` Your best net score is ${mockBestNet}.` : ''} Counts tests from the last year.`)
    : none('mocks', 'Full-length mock tests',
        'Take a timed Advanced Test and it appears here, scored separately.');

  const pp = (d.previousPapers && typeof d.previousPapers === 'object') ? d.previousPapers : {};
  let papersAttempted = 0;
  let paperAttemptCount = 0;
  let paperBestNet = null;
  for (const key of Object.keys(pp)) {
    const rec = pp[key];
    const attempts = rec && Array.isArray(rec.attempts) ? rec.attempts : [];
    if (attempts.length === 0) continue;
    papersAttempted += 1;
    for (const a of attempts) {
      if (!a) continue;
      paperAttemptCount += 1;
      if (typeof a.netScore === 'number') paperBestNet = paperBestNet === null ? a.netScore : Math.max(paperBestNet, a.netScore);
      if (typeof a.elapsedSec === 'number') timedSec += a.elapsedSec;
    }
  }
  const papers = papersAttempted > 0
    ? stat('papers', 'Previous-year papers', papersAttempted, commaNum(papersAttempted),
        `Scored on their own, like mock tests, so they do not feed the figures above.${paperAttemptCount > papersAttempted ? ` ${commaNum(paperAttemptCount)} attempts in total.` : ''}${paperBestNet !== null ? ` Your best net score is ${paperBestNet}.` : ''}`)
    : none('papers', 'Previous-year papers',
        'Attempt a previous-year paper and it appears here, scored separately.');

  const timeInTests = timedSec > 0
    ? stat('timeInTests', 'Time in timed tests', Math.round(timedSec), durationFromSeconds(timedSec),
        'Measured by the test clock in your mock tests and previous-year papers.')
    : none('timeInTests', 'Time in timed tests',
        'The test clock in mock tests and papers adds up here.');

  // ---- open mistakes (PDF only)
  let openMistakesN = 0;
  try { openMistakesN = unresolvedCount(buildMistakes(history, qs, nowTs)); } catch (e) { openMistakesN = 0; }
  const openMistakes = openMistakesN > 0
    ? stat('openMistakes', 'Open mistakes', openMistakesN, commaNum(openMistakesN),
        'Questions you got wrong and have not yet answered correctly since. Clear them in the Mistake Vault.')
    : none('openMistakes', 'Open mistakes',
        'Questions you get wrong wait here until you answer them correctly again.');

  // ---- subjects table (mirrors StatsScreen byTopic + the total>=3 filter)
  const subjectRows = Object.keys(topicAgg)
    .map((tid) => {
      const a = topicAgg[tid];
      return { id: tid, name: topicName(tid), color: topicColor(tid),
        correct: a.correct, total: a.total,
        accuracy: a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0 };
    })
    .filter((r) => r.total >= 3)
    .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total);
  const subjects = subjectRows.length > 0
    ? { rows: subjectRows,
        note: 'Accuracy here counts every attempt, including retries, so it can differ from the first-attempt figure above. It matches your Stats screen.' }
    : null;

  // ---- honesty leads: this box is rendered FIRST on both artifacts
  const scope = {
    title: 'What this counts',
    lines: [
      'These numbers come from quiz practice inside NurseHolic.',
      'Mock tests and previous-year papers are listed on their own. They do not feed the accuracy, subject or streak figures.',
      'The app does not track how long it stays open, so this report makes no claim about total study hours.',
    ],
  };

  const isEmpty = uniquePractised === 0 && mocksN === 0 && papersAttempted === 0 && xp === 0;

  const meta = {
    generatedAt: nowTs,
    generatedOnDisplay: formatDate(nowTs),
    name: (profile && typeof profile.displayName === 'string' && profile.displayName.trim())
      ? profile.displayName.trim()
      : 'NORCET Aspirant',
    isGuest: !!(profile && profile.isGuest),
    poolSize,
  };

  return {
    version: REPORT_VERSION,
    title: REPORT_TITLE,
    subtitle: REPORT_SUBTITLE,
    isEmpty,
    meta,
    identity,
    headline: [questionsPractised, accuracy, streakBest, mastery],
    stats: [
      questionsPractised, practiceAttempts, accuracy, practiceAccuracy,
      streakBest, streakCurrent, mastery, coverage, level,
      timeOnQuestions, openMistakes,
    ],
    subjects,
    timedTests: {
      mocks, papers, timeInTests,
      note: 'These are scored separately and are never mixed into the practice numbers above.',
    },
    scope,
    disclaimerShort: REPORT_DISCLAIMER_SHORT,
    disclaimer: REPORT_DISCLAIMER,
  };
}
