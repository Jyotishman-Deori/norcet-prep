// =====================================================================
// src/lib/trending.js — PURE scoring for the free-tier "trending" engine.
//
// A simplified, SAFE adaptation of three industry archetypes (Roblox velocity +
// bounce, Kahoot/Quizlet open-velocity + completion-depth), tuned for a
// serverless free-tier app at ~12–50 users. We keep the ideas that fit:
//   • VELOCITY — normalize today's unique opens against the trailing-day mean
//     and standard deviation → a z-score surge (breakout detection).
//   • DECAY — exponential time-decay from the item's peak day.
//   • QUALITY GUARDRAIL — weight the surge by completion depth, and AGGRESSIVELY
//     penalize a high-bounce spike (opens that don't convert to completes), so an
//     influencer/notification spike of empty opens can't hijack the feed
//     (Spec 1's bounce guardrail == Spec 3's completion-depth multiplier).
//   • THRESHOLD — a minimum total before an item qualifies (kills 0→1 noise).
//   • SAFE MATH — every division is guarded.
//
// Deliberately NOT implemented (don't re-propose): real-time concurrency / 15-min
// windows (no presence infra on free-tier), XP-velocity matchmaking brackets
// (a leaderboard feature, not trending), and TF-IDF keyword uniqueness (needs a
// free-text corpus — our items are fixed ids, and the per-item z-score already
// normalizes against each item's OWN baseline, which is the correct analogue).
//
// Stats come from trending-store.loadTrendStats →
//   { opens: [today, t-1, …], completes: [today, t-1, …] }
// No I/O here, so the whole module is unit-testable (see trending.test.js).
// =====================================================================

export const TRENDING_DEFAULTS = {
  minTotal: 3,        // 7-day open floor to qualify (small-scale tuned)
  zCutoff: 1,         // final score must exceed this to be flagged "trending"
  decayPerDay: 0.15,  // exponential decay per day since the peak day
  flatBonus: 1.25,    // z fallback when std-dev is 0 but today beats the mean
  topN: 3,            // cap how many items get flagged at once
  // Quality guardrail (only applied to "completable" items, e.g. games).
  qualityMinOpens: 4, // need at least this many opens before judging quality
  bounceCeil: 0.8,    // bounce ≥ this (≤20% completion) → aggressive penalty
  bouncePenalty: 0.2, // multiplier applied when the bounce guardrail trips
  qualityFloor: 0.4,  // floor of the smooth quality multiplier (never fully 0)
};

function sum(xs) { return (xs || []).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0); }
function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function stdDev(xs, mu) {
  if (xs.length < 2) return 0;
  const v = xs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / xs.length;
  return Math.sqrt(v);
}

// Velocity surge for one item's daily OPEN counts ([today, t-1, …]). >= 0.
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

// Quality multiplier from opens vs completes over the window. 1 = neutral.
//   • below qualityMinOpens opens → 1 (too little volume to judge; don't punish)
//   • bounce ≥ bounceCeil        → bouncePenalty (aggressive guardrail, Spec 1)
//   • otherwise                  → qualityFloor..1 scaled by completion depth
export function qualityMultiplier(opens, completes, opts = {}) {
  const o = { ...TRENDING_DEFAULTS, ...opts };
  const O = sum(opens);
  const C = sum(completes);
  if (O < o.qualityMinOpens) return 1;
  const completion = Math.max(0, Math.min(1, O > 0 ? C / O : 0)); // safe divide
  const bounce = 1 - completion;
  if (bounce >= o.bounceCeil) return o.bouncePenalty;
  return o.qualityFloor + (1 - o.qualityFloor) * completion;
}

// Annotate items with { trendScore, isTrending }, flagging the top-N items whose
// score clears the cutoff. Returns items in their ORIGINAL order.
//   items:      [{ id, completable? }]   — completable items get the quality gate
//   statsById:  { [id]: { opens:number[], completes:number[] } }
export function rankTrending(items, statsById, opts = {}) {
  const o = { ...TRENDING_DEFAULTS, ...opts };
  const scored = (items || []).map((it, i) => {
    const s = (statsById || {})[it.id] || {};
    const surge = surgeScore(s.opens, o);
    const quality = it.completable ? qualityMultiplier(s.opens, s.completes, o) : 1;
    return { item: it, id: it.id, trendScore: surge * quality, _i: i };
  });
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
