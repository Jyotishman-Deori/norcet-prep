// =====================================================================
// src/lib/leaderboard-score.js — PURE scoring for the Study "Growth" board.
//
// The anti-elitism fix: instead of ranking the weekly study board on raw volume
// (grindable, favours free time) or all-time mastery (locks the top for advanced
// students), rank on a GROWTH score that blends effort + accuracy + improvement
// vs the user's own recent baseline, and resets every week. A struggling-but-
// improving student can top it; a coasting expert cannot lock it down.
//
// Reads only `data.stats.dailyHistory` ({date, attempted, correct} × 60d) and
// utils.weekStartStr — NO storage/React imports, so it's node-unit-testable
// (leaderboard.js itself pulls the storage chain and can't run under node).
// =====================================================================
import { weekStartStr } from './utils.js';

export const GROWTH_DEFAULTS = {
  effortCap: 60,      // cap weekly questions so raw volume can't dominate (anti-grind)
  improveWeight: 60,  // how much an accuracy gain vs baseline is worth
  baselineWeeks: 3,   // prior weeks that form the personal accuracy baseline
};

const DAY_MS = 86400000;

// Sum {attempted, correct} over dailyHistory rows in [fromStr, toStrExclusive).
// Also sums the FIRST-ATTEMPT counters (freshAttempted/freshCorrect) that
// completeQuiz stamps on new rows (2026-07-10 leaderboard-integrity change).
function sumRange(daily, fromStr, toStrExclusive) {
  let attempted = 0, correct = 0, freshAttempted = 0, freshCorrect = 0;
  for (const d of (daily || [])) {
    if (!d || typeof d.date !== 'string' || d.date < fromStr) continue;
    if (toStrExclusive && d.date >= toStrExclusive) continue;
    attempted += d.attempted || 0;
    correct += d.correct || 0;
    freshAttempted += d.freshAttempted || 0;
    freshCorrect += d.freshCorrect || 0;
  }
  return { attempted, correct, freshAttempted, freshCorrect };
}

// Accuracy for the board: FIRST attempts only when the window has them.
// Re-answering a question whose solution was already shown teaches, but it
// can't move leaderboard accuracy. Rows written before the fresh counters
// shipped have no fresh fields, so the window falls back to all-attempts
// accuracy until new data flows in (self-heals within a week).
function rangeAccuracy(sum) {
  if (sum.freshAttempted > 0) return sum.freshCorrect / sum.freshAttempted;
  return sum.attempted > 0 ? sum.correct / sum.attempted : 0;
}

// Lifetime FIRST-attempt totals from data.history — the un-gameable base
// for the all-time Accuracy board. Rules:
//   • only each question's first recorded interaction counts;
//   • if that first interaction was a reveal (answer shown without an
//     attempt), the question is tainted and never counts;
//   • compacted records lost their first attempt, so they are skipped
//     (conservative: excluding them can only shrink the sample).
export function firstAttemptTotals(history) {
  let attempted = 0, correct = 0;
  if (history && typeof history === 'object') {
    for (const h of Object.values(history)) {
      if (!h || h.compacted) continue;
      const first = Array.isArray(h.attempts) ? h.attempts[0] : null;
      if (!first || first.revealed) continue;
      attempted += 1;
      if (first.correct) correct += 1;
    }
  }
  return { attempted, correct, accuracy: attempted > 0 ? correct / attempted : 0 };
}

// Weekly study totals + the growth score. Pure; `now` is injectable for tests.
export function weeklyGrowth(dailyHistory, opts = {}, now = new Date()) {
  const o = { ...GROWTH_DEFAULTS, ...opts };
  const wk = weekStartStr(now);
  const cur = sumRange(dailyHistory, wk, null); // this week (date >= wk)
  const weeklyAccuracy = rangeAccuracy(cur);

  // Personal baseline = the N weeks immediately before this week.
  const baseStart = weekStartStr(new Date(Date.parse(`${wk}T00:00:00Z`) - o.baselineWeeks * 7 * DAY_MS));
  const base = sumRange(dailyHistory, baseStart, wk); // [baseStart, wk)
  const baselineAcc = rangeAccuracy(base);

  // Only credit improvement when a baseline actually exists — otherwise a
  // brand-new (or grinding-with-no-history) user would get a full accuracy
  // windfall and the effort cap would be meaningless.
  const improvement = base.attempted > 0 ? Math.max(0, weeklyAccuracy - baselineAcc) : 0;
  const effort = Math.min(cur.attempted, o.effortCap);
  const growthScore = Math.round(effort * (0.5 + 0.5 * weeklyAccuracy) + improvement * o.improveWeight);

  return {
    weeklyAnswered: cur.attempted,
    weeklyCorrect: cur.correct,
    weeklyAccuracy,
    growthScore,
  };
}
