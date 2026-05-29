// =====================================================================
// COMPACT.JS — Tiered data retention + lazy compaction  (Pipeline step 5 / P15)
// ---------------------------------------------------------------------
// Why this file exists:
//   data.history / data.stats.dailyHistory / data.revisionLog /
//   data.advancedTestHistory grow unbounded. A heavy user (50 q/day
//   for 12 months) produces ~18k attempt records (~2 MB). Once that
//   blob lives in Supabase (after P1), big users pay Supabase storage
//   AND every sync gets slower. This module trims old detail while
//   preserving the user-visible facts (totals, SRS state, identity).
//
// THREE TIERS:
//   TIER 1 — IDENTITY (retain forever, NEVER compact):
//     - data.stats summary scalars (totalAttempted, totalCorrect,
//       streakCurrent, streakBest, lastStudiedDate, dailyTarget,
//       examDate, streakGraceAvailable, lastCompactedTs)
//     - data.bookmarks, data.customQuestions, data.preferences
//     - data.disabledBanks, bankVersionsSeen, bankPublishedSeen
//     - data.feedbackRepliesSeen, data.dismissedAnnouncementId
//     - schemaVersion
//
//   TIER 2 — DETAIL (full per-attempt records, retained for):
//     - data.history[qId].attempts       → 730 days (~2 years)
//     - data.stats.dailyHistory entries  → 180 days
//     - data.revisionLog entries         → 180 days
//     - data.advancedTestHistory entries → 365 days
//
//   TIER 3 — SUMMARY (replaces Tier 2 past its window):
//     - For each question whose OLDEST attempt is >730 days, replace
//       the attempts array with a 5-attempt tail + summary scalars.
//       SRS state on the record (reviewCount, nextDue, lastResult,
//       easeFactor) is preserved exactly.
//     - For dailyHistory entries older than 180 days, fold into
//       monthly aggregates: { month: 'YYYY-MM', attempted, correct }.
//
// COMPACTED RECORD SHAPE (for data.history[qId] after compaction):
//   {
//     attempts: [{ts, correct, timeMs, selected}, ...],  // LAST 5 only
//     attemptsTotal: number,        // pre-compaction total count
//     attemptsCorrect: number,      // pre-compaction correct count
//     lastAttemptedTs: number,
//     meanTimeMs: number,
//     compacted: true,
//     // SRS state preserved verbatim:
//     reviewCount, nextDue, lastResult, easeFactor
//   }
//   NOTE: `attempts` stays an ARRAY (length 5) deliberately. Every
//   existing reader that does `h.attempts.length`, `h.attempts.forEach`,
//   `h.attempts.some(...)` keeps working without modification — it
//   simply operates on the most-recent 5. Code paths that need the
//   ACCURATE pre-compaction total (per-topic aggregators, weak-topic
//   detection, "ever wrong" checks) should use `attemptStats(h)` below.
//
// CONTRACTS:
//   - compactData is PURE — no I/O, no Date.now() side effects
//     (the caller passes opts.now or we default to Date.now()).
//   - compactData is IDEMPOTENT — running it twice yields the same
//     result as running it once.
//   - compactData PRESERVES Tier 1 fields untouched (===-equal where
//     possible to keep React memo references stable).
//   - SRS state on history records is preserved verbatim.
//
// =====================================================================

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DETAIL_DAYS = 730;
const DAILY_HISTORY_DAYS = 180;
const REVISION_LOG_DAYS = 180;
const ADVANCED_TEST_DAYS = 365;
const TAIL_KEEP = 5;
export const COMPACTION_SIZE_THRESHOLD = 500_000; // ~500 KB

// Accurate attempt counts for a history record, transparent to whether
// the record has been compacted. Every consumer that needs accurate
// totals (per-topic aggregators, weak-topic detection, "ever wrong"
// checks) should route through this helper.
export function attemptStats(h) {
  if (!h) return { total: 0, correct: 0, lastTs: 0, anyWrong: false };
  if (h.compacted) {
    const total = (typeof h.attemptsTotal === 'number') ? h.attemptsTotal : 0;
    const correct = (typeof h.attemptsCorrect === 'number') ? h.attemptsCorrect : 0;
    return {
      total,
      correct,
      lastTs: h.lastAttemptedTs || 0,
      anyWrong: correct < total,
    };
  }
  const arr = Array.isArray(h.attempts) ? h.attempts : [];
  if (arr.length === 0) return { total: 0, correct: 0, lastTs: 0, anyWrong: false };
  let correct = 0;
  let anyWrong = false;
  for (const a of arr) {
    if (a && a.correct) correct++;
    else anyWrong = true;
  }
  const last = arr[arr.length - 1];
  return {
    total: arr.length,
    correct,
    lastTs: (last && last.ts) || 0,
    anyWrong,
  };
}

// "Has this question ever been seen?" — true for both Tier 2 records
// with attempts and Tier 3 (compacted) records.
export function hasBeenSeen(h) {
  if (!h) return false;
  if (h.compacted) return true; // compacted by definition had attempts
  return Array.isArray(h.attempts) && h.attempts.length > 0;
}

// Compact a single history record IF its oldest attempt is older than
// the detail window. Returns the original reference if nothing changes
// (idempotent + React-memo-friendly).
function compactHistoryRecord(h, cutoffTs) {
  if (!h) return h;
  if (h.compacted) return h; // already compacted, leave alone
  const arr = Array.isArray(h.attempts) ? h.attempts : null;
  if (!arr || arr.length === 0) return h;
  // Find oldest. Attempts are typically appended chronologically, so
  // arr[0].ts is usually the oldest, but don't rely on it — scan.
  let oldest = Infinity;
  for (const a of arr) {
    const ts = (a && a.ts) || 0;
    if (ts && ts < oldest) oldest = ts;
  }
  if (oldest === Infinity || oldest >= cutoffTs) return h; // young enough
  // Roll up.
  let total = 0, correct = 0, timeSum = 0, timeN = 0, lastTs = 0;
  for (const a of arr) {
    total++;
    if (a && a.correct) correct++;
    if (a && typeof a.timeMs === 'number' && a.timeMs >= 0) {
      timeSum += a.timeMs;
      timeN++;
    }
    if (a && (a.ts || 0) > lastTs) lastTs = a.ts || 0;
  }
  const tail = arr.slice(-TAIL_KEEP).map(a => ({
    ts: (a && a.ts) || 0,
    correct: !!(a && a.correct),
    timeMs: (a && typeof a.timeMs === 'number') ? a.timeMs : 0,
    // `selected` is intentionally dropped from the tail — it was useful
    // for debugging recent attempts but isn't worth bytes long-term.
  }));
  const out = {
    // Spread original FIRST so SRS state and any unrelated fields ride
    // through untouched (reviewCount, nextDue, lastResult, easeFactor,
    // any forward-compat additions). Then overwrite the bits we own.
    ...h,
    attempts: tail,
    attemptsTotal: total,
    attemptsCorrect: correct,
    lastAttemptedTs: lastTs,
    meanTimeMs: timeN > 0 ? Math.round(timeSum / timeN) : 0,
    compacted: true,
  };
  return out;
}

// Roll dailyHistory entries older than the cutoff into monthly buckets.
// Newer entries pass through verbatim. Returns a fresh array sorted by
// date ascending; monthly buckets sit at the front, daily entries at
// the back.
function compactDailyHistory(daily, cutoffTs) {
  if (!Array.isArray(daily) || daily.length === 0) return daily || [];
  const cutoffISO = new Date(cutoffTs).toISOString().slice(0, 10);
  const monthly = {}; // 'YYYY-MM' → { attempted, correct, byTopic }
  const kept = [];
  let anyOld = false;
  for (const e of daily) {
    if (!e || !e.date) continue;
    // Monthly bucket marker (idempotent): if this entry already has a
    // `month` key set (i.e. we compacted it on a previous run), keep
    // it grouped in `monthly` so subsequent compactions don't shuffle
    // dates around.
    if (e.month && typeof e.month === 'string') {
      const m = e.month;
      if (!monthly[m]) monthly[m] = { month: m, attempted: 0, correct: 0, byTopic: {} };
      monthly[m].attempted += e.attempted || 0;
      monthly[m].correct += e.correct || 0;
      if (e.byTopic && typeof e.byTopic === 'object') {
        for (const [k, v] of Object.entries(e.byTopic)) {
          monthly[m].byTopic[k] = (monthly[m].byTopic[k] || 0) + (v || 0);
        }
      }
      continue;
    }
    if (e.date < cutoffISO) {
      anyOld = true;
      const m = e.date.slice(0, 7); // 'YYYY-MM'
      if (!monthly[m]) monthly[m] = { month: m, attempted: 0, correct: 0, byTopic: {} };
      monthly[m].attempted += e.attempted || 0;
      monthly[m].correct += e.correct || 0;
      if (e.byTopic && typeof e.byTopic === 'object') {
        for (const [k, v] of Object.entries(e.byTopic)) {
          monthly[m].byTopic[k] = (monthly[m].byTopic[k] || 0) + (v || 0);
        }
      }
    } else {
      kept.push(e);
    }
  }
  if (!anyOld && Object.keys(monthly).length === 0) return daily; // no-op
  const monthlyArr = Object.values(monthly).sort((a, b) => (a.month < b.month ? -1 : 1));
  // dailyHistory readers sort by date themselves where they need to;
  // we deliver monthly first (oldest) then daily entries in original order.
  return [...monthlyArr, ...kept];
}

// Generic age-based filter for log-style arrays (revisionLog,
// advancedTestHistory). Entries past the window are dropped. Keeps
// arrays small enough that JSON.stringify stays under the threshold.
function trimByAge(arr, tsField, cutoffTs) {
  if (!Array.isArray(arr) || arr.length === 0) return arr || [];
  let dropped = 0;
  const out = arr.filter(e => {
    const ts = (e && e[tsField]) || 0;
    if (ts && ts < cutoffTs) { dropped++; return false; }
    return true;
  });
  return dropped > 0 ? out : arr;
}

// Main entry point. Pure function: returns a NEW data blob (or the
// same reference if nothing changed) with old detail compacted.
export function compactData(data, opts = {}) {
  if (!data || typeof data !== 'object') return data;
  const now = (typeof opts.now === 'number') ? opts.now : Date.now();
  const historyCutoff = now - HISTORY_DETAIL_DAYS * DAY_MS;
  const dailyCutoff = now - DAILY_HISTORY_DAYS * DAY_MS;
  const revisionCutoff = now - REVISION_LOG_DAYS * DAY_MS;
  const advancedTestCutoff = now - ADVANCED_TEST_DAYS * DAY_MS;

  // history: compact each record whose oldest attempt predates the
  // detail window. Reuse the same reference when nothing changed so
  // React doesn't see a fresh object every boot.
  let history = data.history;
  if (history && typeof history === 'object') {
    let changed = false;
    const next = {};
    for (const [qId, rec] of Object.entries(history)) {
      const compacted = compactHistoryRecord(rec, historyCutoff);
      if (compacted !== rec) changed = true;
      next[qId] = compacted;
    }
    if (changed) history = next;
  }

  // dailyHistory: roll old daily into monthly buckets.
  let stats = data.stats;
  if (stats && Array.isArray(stats.dailyHistory)) {
    const nextDaily = compactDailyHistory(stats.dailyHistory, dailyCutoff);
    if (nextDaily !== stats.dailyHistory) {
      stats = { ...stats, dailyHistory: nextDaily };
    }
  }

  // revisionLog + advancedTestHistory: age-based trim.
  let revisionLog = data.revisionLog;
  if (Array.isArray(revisionLog)) {
    revisionLog = trimByAge(revisionLog, 'ts', revisionCutoff);
  }
  let advancedTestHistory = data.advancedTestHistory;
  if (Array.isArray(advancedTestHistory)) {
    advancedTestHistory = trimByAge(advancedTestHistory, 'ts', advancedTestCutoff);
  }

  // If nothing changed, return the original reference — keeps React
  // memos stable and tells the caller "no save needed".
  const unchanged = (
    history === data.history &&
    stats === data.stats &&
    revisionLog === data.revisionLog &&
    advancedTestHistory === data.advancedTestHistory
  );
  if (unchanged) return data;

  // Stamp lastCompactedTs (Tier 1) so the Settings debug line and the
  // boot heuristic can show "last compacted X days ago". Live in stats
  // since that's where related identity scalars live.
  const finalStats = { ...(stats || {}), lastCompactedTs: now };

  return {
    ...data,
    history,
    stats: finalStats,
    revisionLog,
    advancedTestHistory,
  };
}

// Reports whether running compactData on this blob WOULD change it,
// without actually doing the work. Used by the boot hook to decide
// whether to spend cycles before scheduling a save.
export function needsCompaction(data, opts = {}) {
  if (!data || typeof data !== 'object') return false;
  const sizeBytes = (() => {
    try { return JSON.stringify(data).length; } catch (e) { return 0; }
  })();
  if (sizeBytes <= COMPACTION_SIZE_THRESHOLD) return false;
  // Over-threshold by itself doesn't mean compaction will reduce size —
  // a user could have 600 KB of bookmarks (Tier 1, untouched). Do a
  // dry run to check if compactData would actually trim anything.
  const compacted = compactData(data, opts);
  return compacted !== data;
}

// =====================================================================
// SANITY ASSERTIONS (run once at module load, dev mode only)
// Catches regressions in the contracts above (purity, idempotence,
// SRS preservation, Tier 1 immutability). Silent in production.
// =====================================================================
function _runSanityAssertions() {
  const assert = (cond, msg) => { if (!cond) throw new Error('[compact] ' + msg); };
  const NOW = 1_700_000_000_000; // fixed reference time
  const ONE_DAY = 86_400_000;
  const veryOld = NOW - 800 * ONE_DAY;
  const recent = NOW - 30 * ONE_DAY;

  // 1) Fresh user (no old data) → exact same reference back.
  const fresh = {
    history: { q1: { attempts: [{ ts: recent, correct: true, timeMs: 5000 }] } },
    stats: { totalAttempted: 1, dailyHistory: [] },
    bookmarks: ['q1'],
  };
  const r1 = compactData(fresh, { now: NOW });
  assert(r1 === fresh, 'fresh data should pass through unchanged');

  // 2) Old attempts → trimmed to last 5, summary populated, SRS preserved.
  const oldAttempts = [];
  for (let i = 0; i < 12; i++) {
    oldAttempts.push({ ts: veryOld + i * 1000, correct: i % 2 === 0, timeMs: 4000 + i * 100 });
  }
  const aged = {
    history: {
      q1: {
        attempts: oldAttempts,
        reviewCount: 7,
        nextDue: '2025-12-01',
        lastResult: 'correct',
        easeFactor: 2.5,
      },
    },
    stats: { totalAttempted: 12, dailyHistory: [] },
    bookmarks: [],
  };
  const r2 = compactData(aged, { now: NOW });
  const rec = r2.history.q1;
  assert(rec.compacted === true, 'old record should be marked compacted');
  assert(rec.attempts.length === 5, 'tail kept to 5');
  assert(rec.attemptsTotal === 12, 'total preserved');
  assert(rec.attemptsCorrect === 6, 'correct count preserved');
  assert(rec.reviewCount === 7, 'SRS reviewCount preserved');
  assert(rec.nextDue === '2025-12-01', 'SRS nextDue preserved');
  assert(rec.lastResult === 'correct', 'SRS lastResult preserved');
  assert(rec.easeFactor === 2.5, 'SRS easeFactor preserved');
  assert(r2.bookmarks === aged.bookmarks, 'Tier 1 bookmarks preserved by reference');

  // 3) Idempotent — second run is a no-op.
  const r3 = compactData(r2, { now: NOW });
  assert(r3 === r2, 'second run on already-compacted data is a no-op');

  // 4) attemptStats reports accurate totals for both shapes.
  const tier2 = { attempts: [{ correct: true, ts: 1 }, { correct: false, ts: 2 }] };
  const s2 = attemptStats(tier2);
  assert(s2.total === 2 && s2.correct === 1 && s2.anyWrong === true,
    'attemptStats: Tier 2 totals');
  const s3 = attemptStats(rec);
  assert(s3.total === 12 && s3.correct === 6 && s3.anyWrong === true,
    'attemptStats: Tier 3 totals');

  // 5) hasBeenSeen handles all shapes.
  assert(hasBeenSeen(null) === false, 'hasBeenSeen: null → false');
  assert(hasBeenSeen({ attempts: [] }) === false, 'hasBeenSeen: empty → false');
  assert(hasBeenSeen(tier2) === true, 'hasBeenSeen: Tier 2 with attempts → true');
  assert(hasBeenSeen(rec) === true, 'hasBeenSeen: Tier 3 → true');
}

try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    _runSanityAssertions();
  }
} catch (e) {
  // Surface failures during dev but never crash production.
  try { console.error('[compact] sanity assertions failed:', e); } catch (_e) {}
}
