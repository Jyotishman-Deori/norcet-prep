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
function sumRange(daily, fromStr, toStrExclusive) {
  let attempted = 0, correct = 0;
  for (const d of (daily || [])) {
    if (!d || typeof d.date !== 'string' || d.date < fromStr) continue;
    if (toStrExclusive && d.date >= toStrExclusive) continue;
    attempted += d.attempted || 0;
    correct += d.correct || 0;
  }
  return { attempted, correct };
}

// Weekly study totals + the growth score. Pure; `now` is injectable for tests.
export function weeklyGrowth(dailyHistory, opts = {}, now = new Date()) {
  const o = { ...GROWTH_DEFAULTS, ...opts };
  const wk = weekStartStr(now);
  const cur = sumRange(dailyHistory, wk, null); // this week (date >= wk)
  const weeklyAccuracy = cur.attempted > 0 ? cur.correct / cur.attempted : 0;

  // Personal baseline = the N weeks immediately before this week.
  const baseStart = weekStartStr(new Date(Date.parse(`${wk}T00:00:00Z`) - o.baselineWeeks * 7 * DAY_MS));
  const base = sumRange(dailyHistory, baseStart, wk); // [baseStart, wk)
  const baselineAcc = base.attempted > 0 ? base.correct / base.attempted : 0;

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
