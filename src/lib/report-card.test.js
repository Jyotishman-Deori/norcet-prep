// =====================================================================
// src/lib/report-card.test.js — locks every honesty rule in report-card.js.
// Run: node src/lib/report-card.test.js  (auto-discovered by run-tests.mjs)
// =====================================================================
import assert from 'node:assert';
import {
  buildReportCard,
  REPORT_DISCLAIMER, REPORT_DISCLAIMER_SHORT, REPORT_TITLE, REPORT_SUBTITLE,
} from './report-card.js';

const NOW = Date.parse('2026-07-11T12:00:00Z');

// A tiny question pool: 8 nursing + 2 GK, so the GK-neutrality check has teeth.
const POOL = [
  { id: 'f1', topic: 'fund', sub: 'Vitals' },
  { id: 'f2', topic: 'fund', sub: 'Vitals' },
  { id: 'f3', topic: 'fund', sub: 'Meds' },
  { id: 'm1', topic: 'msn', sub: 'Cardiac' },
  { id: 'm2', topic: 'msn', sub: 'Cardiac' },
  { id: 'm3', topic: 'msn', sub: 'Renal' },
  { id: 'p1', topic: 'pharm', sub: 'Analgesics' },
  { id: 'p2', topic: 'pharm', sub: 'Analgesics' },
  { id: 'g1', topic: 'gk', sub: 'Current Affairs' },
  { id: 'g2', topic: 'apt', sub: 'Series' },
];

const A = (correct, timeMs = 4000, extra = {}) => ({ ts: NOW - 1000, correct, timeMs, ...extra });
const hist = (attempts) => ({ attempts });

// ---- helper: walk every string in an object tree
function allStrings(obj, out = []) {
  if (typeof obj === 'string') { out.push(obj); return out; }
  if (Array.isArray(obj)) { for (const v of obj) allStrings(v, out); return out; }
  if (obj && typeof obj === 'object') { for (const k of Object.keys(obj)) allStrings(obj[k], out); return out; }
  return out;
}

// =====================================================================
// 1. NO em dash, NO double hyphen anywhere (check-locales never scans src/lib).
// =====================================================================
{
  const out = buildReportCard({
    profile: { displayName: 'Asha' },
    data: {
      history: {
        f1: hist([A(true)]), f2: hist([A(false)]), f3: hist([A(true)]),
        m1: hist([A(true)]), m2: hist([A(true)]), m3: hist([A(false)]),
        p1: hist([A(true)]), p2: hist([A(true)]),
      },
      stats: { streakCurrent: 4, streakBest: 12 },
      levelup: { xp: 5000 },
      advancedTestHistory: [{ netScore: 120, elapsedSec: 3600 }],
    },
    allQuestions: POOL,
    now: NOW,
  });

  const strings = allStrings(out).concat([REPORT_DISCLAIMER, REPORT_DISCLAIMER_SHORT, REPORT_TITLE, REPORT_SUBTITLE]);
  for (const s of strings) {
    assert.ok(!s.includes('—'), `em dash found in: ${JSON.stringify(s)}`);
    assert.ok(!s.includes('--'), `double hyphen found in: ${JSON.stringify(s)}`);
  }
  // The report must call itself honest in words, not just structure.
  assert.ok(REPORT_DISCLAIMER.includes('not a certificate'), 'disclaimer must say "not a certificate"');
  assert.ok(REPORT_DISCLAIMER.includes('not affiliated'), 'disclaimer must carry the no-affiliation clause');
}

// =====================================================================
// 2. Accuracy is FIRST-attempt, and stats.totalCorrect/totalAttempted is UNREAD.
// =====================================================================
{
  // q1 first WRONG, then correct 5 times; q2..q11 first correct. First-attempt
  // accuracy = 10/11. Lifetime all-attempts would be far higher.
  const history = { f1: hist([A(false), A(true), A(true), A(true), A(true), A(true)]) };
  for (let i = 2; i <= 11; i++) history['q' + i] = hist([A(true)]);
  const pool = [{ id: 'f1', topic: 'fund', sub: 'Vitals' }];
  for (let i = 2; i <= 11; i++) pool.push({ id: 'q' + i, topic: 'fund', sub: 'Vitals' });

  const base = { history, stats: { totalCorrect: 999, totalAttempted: 999 }, levelup: { xp: 0 } };
  const out = buildReportCard({ data: base, allQuestions: pool, now: NOW });
  assert.strictEqual(out.headline[1].id, 'accuracy');
  assert.strictEqual(out.headline[1].value, Math.round((10 / 11) * 100), 'must be first-attempt accuracy');
  assert.notStrictEqual(out.headline[1].value, 100, 'must NOT be the flattering lifetime figure');

  // Prove stats.totalCorrect/totalAttempted are never read: mutate to nonsense,
  // output must be byte-identical.
  const out2 = buildReportCard({
    data: { ...base, stats: { totalCorrect: 0, totalAttempted: 1 } },
    allQuestions: pool, now: NOW,
  });
  assert.deepStrictEqual(out2, out, 'stats.totalCorrect/totalAttempted must not affect the report');
}

// =====================================================================
// 3. Null degradation: thin data => "Not enough data yet", never 0%.
// =====================================================================
{
  const out = buildReportCard({
    data: { history: { f1: hist([A(true)]), f2: hist([A(false)]), f3: hist([A(true)]) }, levelup: { xp: 0 } },
    allQuestions: POOL, now: NOW,
  });
  const acc = out.headline[1];
  assert.strictEqual(acc.value, null, '3 first attempts (<10) => null accuracy');
  assert.strictEqual(acc.display, 'Not enough data yet');
  assert.notStrictEqual(acc.value, 0);
  assert.notStrictEqual(acc.display, '0%');
}

// =====================================================================
// 4. levelup.xp === 0 => level null, not Level 1.
// =====================================================================
{
  const out = buildReportCard({ data: { history: {}, levelup: { xp: 0 } }, allQuestions: POOL, now: NOW });
  const level = out.stats.find((s) => s.id === 'level');
  assert.strictEqual(level.value, null, 'xp 0 => null level');
  assert.strictEqual(out.identity, null, 'no XP => no identity block');

  const out2 = buildReportCard({ data: { history: {}, levelup: { xp: 5000 } }, allQuestions: POOL, now: NOW });
  assert.ok(out2.identity && out2.identity.level >= 1, 'XP => identity with a level');
  assert.ok(typeof out2.identity.tierTitle === 'string' && out2.identity.tierTitle.length > 0);
}

// =====================================================================
// 5. Empty / garbage input never throws; isEmpty true.
// =====================================================================
{
  for (const bad of [undefined, {}, { profile: null, data: null }, { data: { history: 'nope', stats: 5, preferences: null } }, { allQuestions: null }, { data: { history: { x: null, y: 7 } }, allQuestions: [{ id: 'z' }] }]) {
    let out;
    assert.doesNotThrow(() => { out = buildReportCard(bad); }, `threw on ${JSON.stringify(bad)}`);
    assert.strictEqual(out.isEmpty, true, `should be empty for ${JSON.stringify(bad)}`);
    for (const h of out.headline) {
      assert.strictEqual(h.value, null, 'empty report => every headline null');
      assert.notStrictEqual(h.display, '0%');
    }
  }
  // name fallback
  assert.strictEqual(buildReportCard({}).meta.name, 'NORCET Aspirant');
  assert.strictEqual(buildReportCard({ profile: { displayName: '  ' } }).meta.name, 'NORCET Aspirant');
  assert.strictEqual(buildReportCard({ profile: { displayName: ' Asha ' } }).meta.name, 'Asha');
}

// =====================================================================
// 6. Mocks/PYQs NEVER leak into the practice figures (the biggest landmine).
// =====================================================================
{
  const out = buildReportCard({
    data: {
      history: {},                          // no quiz practice at all
      advancedTestHistory: [{ count: 100, correct: 80, netScore: 90, elapsedSec: 3600 }],
      previousPapers: { pyq2023: { attempts: [{ netScore: 70, elapsedSec: 3000 }] } },
    },
    allQuestions: POOL, now: NOW,
  });
  const q = out.stats.find((s) => s.id === 'questionsPractised');
  assert.strictEqual(q.value, null, 'a bailed/taken mock must not create practice questions');
  assert.strictEqual(out.subjects, null, 'no practice => no subject table');
  assert.strictEqual(out.headline[1].value, null, 'no first attempts => null accuracy');
  assert.strictEqual(out.timedTests.mocks.value, 1, 'the mock is counted in its own section');
  assert.strictEqual(out.timedTests.papers.value, 1, 'the paper is counted in its own section');
  assert.ok(out.timedTests.timeInTests.value >= 6600, 'timed seconds summed from both sources');
  assert.strictEqual(out.isEmpty, false, 'timed activity alone is not an empty report');
}

// =====================================================================
// 7. Compacted (Tier 3) records: counted, no crash, excluded from first-attempt.
// =====================================================================
{
  const out = buildReportCard({
    data: {
      history: {
        f1: { compacted: true, attemptsTotal: 12, attemptsCorrect: 6, lastAttemptedTs: NOW },
        f2: hist([A(true)]), f3: hist([A(true)]),
      },
      levelup: { xp: 0 },
    },
    allQuestions: POOL, now: NOW,
  });
  const attempts = out.stats.find((s) => s.id === 'practiceAttempts');
  assert.strictEqual(attempts.value, 14, 'compacted 12 + 2 fresh = 14 attempts');
  const q = out.stats.find((s) => s.id === 'questionsPractised');
  assert.strictEqual(q.value, 3, 'compacted record still counts as one practised question');
}

// =====================================================================
// 8. `revealed`-only question is SEEN but not PRACTISED.
// =====================================================================
{
  const out = buildReportCard({
    data: {
      history: {
        f1: hist([{ ts: NOW, revealed: true }]),   // only ever revealed
        f2: hist([A(true)]),
      },
      levelup: { xp: 0 },
    },
    allQuestions: POOL, now: NOW,
  });
  const q = out.stats.find((s) => s.id === 'questionsPractised');
  assert.strictEqual(q.value, 1, 'reveal-only question is not "practised"');
  const cov = out.stats.find((s) => s.id === 'coverage');
  // 2 seen (both opened) of 10 pool = 20%
  assert.strictEqual(cov.value, 20, 'reveal-only question still counts as seen');
}

// =====================================================================
// 9. Coverage never exceeds 100%, even with orphan history ids.
// =====================================================================
{
  const history = {};
  for (const q of POOL) history[q.id] = hist([A(true)]);
  history['ghost1'] = hist([A(true)]);   // not in the pool
  history['ghost2'] = hist([A(true)]);
  const out = buildReportCard({ data: { history, levelup: { xp: 0 } }, allQuestions: POOL, now: NOW });
  const cov = out.stats.find((s) => s.id === 'coverage');
  assert.ok(cov.value <= 100, 'coverage capped at 100%');
  assert.strictEqual(cov.value, 100, 'all 10 pool questions seen => 100%');
}

// =====================================================================
// 10. Forbidden vocabulary never appears in the output.
// =====================================================================
{
  const out = buildReportCard({
    profile: { displayName: 'Asha' },
    data: {
      history: { f1: hist([A(true)]), f2: hist([A(false)]) },
      stats: { streakCurrent: 3, streakBest: 9 },
      levelup: { xp: 5000 },
      advancedTestHistory: [{ netScore: 100, elapsedSec: 3600 }],
    },
    allQuestions: POOL, now: NOW,
  });
  // Scan everything EXCEPT the disclaimers and the scope box, which
  // deliberately NEGATE these words ("not a rank", "no claim about total study
  // hours"). The point is that no metric makes a positive claim.
  const scrub = { ...out, disclaimer: '', disclaimerShort: '', scope: null };
  const blob = JSON.stringify(scrub).toLowerCase();
  assert.ok(!blob.includes('percentile'), 'no percentile');
  assert.ok(!blob.includes('consecutive'), 'no "consecutive" (streak has a grace token)');
  assert.ok(!/\brank\b/.test(blob), 'no rank claim outside the disclaimer');
  assert.ok(!blob.includes('transcript'), 'never calls itself a transcript');
  assert.ok(!blob.includes('study hours'), 'no invented study-hours figure');
  // And the disclaimer MUST carry the negations.
  assert.ok(REPORT_DISCLAIMER_SHORT.toLowerCase().includes('not a rank'), 'short disclaimer denies rank');
}

// =====================================================================
// 11. Subjects mirror StatsScreen byTopic: total>=3 filter, includes GK, sorted.
// =====================================================================
{
  // fund: f1,f2,f3 all attempted => total 3 (passes). msn: only m1 => total 1 (filtered).
  // gk: g1 attempted twice => total 2 (filtered). Give gk 3 to include it.
  const out = buildReportCard({
    data: {
      history: {
        f1: hist([A(true)]), f2: hist([A(true)]), f3: hist([A(false)]),
        m1: hist([A(true)]),                                   // total 1, filtered
        g1: hist([A(true), A(true), A(false)]),                // gk total 3, INCLUDED (no GK filter)
      },
      levelup: { xp: 0 },
    },
    allQuestions: POOL, now: NOW,
  });
  assert.ok(out.subjects, 'subjects present');
  const ids = out.subjects.rows.map((r) => r.id);
  assert.ok(ids.includes('fund'), 'fund (total 3) included');
  assert.ok(!ids.includes('msn'), 'msn (total 1) filtered out');
  assert.ok(ids.includes('gk'), 'GK is NOT filtered (matches StatsScreen, which has no GK filter)');
  // sorted by accuracy desc: fund 67%, gk 67% -> tie broken by total. Both present.
  const fund = out.subjects.rows.find((r) => r.id === 'fund');
  assert.strictEqual(fund.correct, 2);
  assert.strictEqual(fund.total, 3);
  assert.strictEqual(fund.accuracy, 67);
}

// =====================================================================
// 12. Purity: same inputs => deep-equal twice; caller's data is not mutated.
// =====================================================================
{
  const data = {
    history: { f1: hist([A(true)]), f2: hist([A(false)]) },
    stats: { streakCurrent: 2, streakBest: 5 },
    levelup: { xp: 3000 },
    advancedTestHistory: [{ netScore: 80, elapsedSec: 1800 }],
  };
  const snapshot = JSON.stringify(data);
  const a = buildReportCard({ data, allQuestions: POOL, now: NOW });
  const b = buildReportCard({ data, allQuestions: POOL, now: NOW });
  assert.deepStrictEqual(a, b, 'deterministic for identical inputs');
  assert.strictEqual(JSON.stringify(data), snapshot, 'caller data must not be mutated');
}

// =====================================================================
// 13. dailyHistory is never summed as a lifetime total (it is a rolling window).
//     The report simply does not read dailyHistory for any headline; assert the
//     figures come from history, not from an inflated dailyHistory.
// =====================================================================
{
  const daily = [];
  for (let i = 0; i < 200; i++) daily.push({ date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, attempted: 50, correct: 50 });
  const out = buildReportCard({
    data: { history: { f1: hist([A(true)]) }, stats: { dailyHistory: daily, streakCurrent: 3, streakBest: 3 }, levelup: { xp: 0 } },
    allQuestions: POOL, now: NOW,
  });
  const attempts = out.stats.find((s) => s.id === 'practiceAttempts');
  assert.strictEqual(attempts.value, 1, 'attempts come from history (1), never from dailyHistory (would be 10000)');
}

console.log('report-card.test.js: all assertions passed');
