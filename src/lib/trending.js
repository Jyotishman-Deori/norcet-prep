// =====================================================================
// src/lib/trending.js — PURE scoring for the free-tier "trending" engine.
//
// A simplified, SAFE adaptation of the requested "rolling z-score with
// exponential time-decay" (the original Redis/always-on spec doesn't fit a
// serverless free-tier app at ~12–50 users). We keep the good ideas:
//   • normalize today's unique-interaction count against the trailing-day mean
//     and standard deviation  → a z-score,
//   • apply exponential time-decay from the item's peak day,
//   • require a minimum total before an item qualifies (kills 0→1 noise),
//   • guard every division (std-dev 0, empty input).
//
// String normalization from the spec is N/A here: items are keyed by stable ids
// (game routes / FAQ ids), not free-text topics. Counts come from
// trending-store.loadDailyCounts → [today, t-1, … t-(n-1)]. No I/O here, so the
// whole module is unit-testable (see trending.test.js).
// =====================================================================

export const TRENDING_DEFAULTS = {
  minTotal: 3,       // 7-day unique-interaction floor to qualify (small-scale tuned)
  zCutoff: 1,        // score must exceed this to be flagged "trending"
  decayPerDay: 0.15, // exponential decay rate per day since the peak day
  flatBonus: 1.25,   // z fallback when std-dev is 0 but today beats the mean
  topN: 3,           // cap how many items get flagged at once
};

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function stdDev(xs, mu) {
  if (xs.length < 2) return 0;
  const v = xs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / xs.length;
  return Math.sqrt(v);
}

// Surge score for one item's daily counts ([today, t-1, …]). >= 0; higher =
// trending harder. Returns 0 when there isn't enough signal or it's cooling.
export function surgeScore(dailyCounts, opts = {}) {
  const o = { ...TRENDING_DEFAULTS, ...opts };
  const c = Array.isArray(dailyCounts) ? dailyCounts.map(n => (Number.isFinite(n) ? n : 0)) : [];
  if (c.length === 0) return 0;

  const total = c.reduce((a, b) => a + b, 0);
  if (total < o.minTotal) return 0;             // not enough signal yet

  const today = c[0];
  const baseline = c.slice(1);                  // trailing days
  const mu = mean(baseline);
  const sd = stdDev(baseline, mu);

  // z-score with safe division (sd === 0 → fallback instead of NaN/Infinity).
  let z;
  if (sd > 0) z = (today - mu) / sd;
  else z = today > mu ? o.flatBonus : 0;
  if (z <= 0) return 0;                          // flat or declining → not trending

  // Exponential decay from the peak day (index 0 = peak is today → no decay).
  let peakIdx = 0, peakVal = -Infinity;
  c.forEach((v, i) => { if (v > peakVal) { peakVal = v; peakIdx = i; } });
  const decay = Math.exp(-o.decayPerDay * peakIdx);
  return z * decay;
}

// Annotate items with { trendScore, isTrending }, flagging the top-N items whose
// score clears the cutoff. Returns items in their ORIGINAL order (callers render
// their own layout and just read the flag).
//   items: [{ id, … }]   countsById: { [id]: number[] }
export function rankTrending(items, countsById, opts = {}) {
  const o = { ...TRENDING_DEFAULTS, ...opts };
  const scored = (items || []).map((it, i) => ({
    item: it,
    id: it.id,
    trendScore: surgeScore((countsById || {})[it.id], o),
    _i: i,
  }));
  const winners = new Set(
    scored
      .slice()
      .sort((a, b) => (b.trendScore - a.trendScore) || (a._i - b._i))
      .filter(x => x.trendScore >= o.zCutoff)
      .slice(0, o.topN)
      .map(x => x.id),
  );
  return scored.map(s => ({ ...s.item, trendScore: s.trendScore, isTrending: winners.has(s.id) }));
}
