// =====================================================================
// WHAT-IF  —  pure negative-marking simulator math (NEW-07.1 v2)
// =====================================================================
// No React, no storage. Extracted from src/ui/what-if-card.jsx (v1 kept
// the math inline) and extended to the spec's dual-slider model:
//
//   whatIfScore({ correct, wrong, blank, count, attempted, doubtfulSkipped })
//
// - `attempted` re-plans HOW MANY of the paper's questions you touch.
//   Attempting fewer than you actually did drops answers from the WRONG
//   pile first (the honest reading: the ones you'd skip are your shaky
//   ones). Attempting MORE than you did adds blind guesses at the 4-option
//   expected value: +0.25 correct and +0.75 wrong per extra attempt, which
//   nets ~0 marks. That zero is the lesson, not a bug.
// - `doubtfulSkipped` is the v1 slider: leave your riskiest remaining
//   guesses blank and watch the -1/3 penalty come back.
// With attempted at its actual value the model reduces exactly to v1.
//
// estimatePercentile() is deliberately COARSE. The official prelims data
// is category cut-off percentiles (see src/data/norcet-benchmarks.js),
// not a marks-to-percentile curve, so anything precise would be fake.
// We anchor broad bands to the stable Mains qualifying floors (UR = 50
// marks%) and the verified prelims cut-offs (UR cut sits ~90-96th
// percentile) and say so in `basis`.
// =====================================================================

export const NEG = 1 / 3;

export function bandFor(pct) {
  if (pct >= 65) return { label: 'SAFE', color: '#16A34A' };
  if (pct >= 45) return { label: 'BORDERLINE', color: '#F59E0B' };
  return { label: 'RISKY', color: '#DC2626' };
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function whatIfScore({ correct = 0, wrong = 0, blank = 0, count = 0, attempted = null, doubtfulSkipped = 0 } = {}) {
  if (!count || count <= 0) {
    return { adjustedNet: 0, penaltyLeft: 0, marksSaved: 0, pct: 0, band: bandFor(0), correctEff: 0, wrongEff: 0, skipped: 0 };
  }
  const actualAttempted = correct + wrong;
  const plan = attempted === null || attempted === undefined
    ? actualAttempted
    : clamp(Math.round(attempted), correct, count);

  let correctEff = correct;
  let wrongEff = wrong;
  if (plan < actualAttempted) {
    // Skipping some of what you attempted: shed from the wrong pile first.
    wrongEff = Math.max(0, wrong - (actualAttempted - plan));
  } else if (plan > actualAttempted) {
    // Extra attempts beyond what you did are blind guesses: expected value
    // on 4 options is +0.25 correct / +0.75 wrong each (net ~0 marks).
    const extra = plan - actualAttempted;
    correctEff = correct + extra * 0.25;
    wrongEff = wrong + extra * 0.75;
  }

  const skipped = clamp(Math.round(doubtfulSkipped) || 0, 0, Math.floor(wrongEff));
  const wrongFinal = wrongEff - skipped;

  const adjustedNet = correctEff - wrongFinal * NEG;
  const penaltyLeft = wrongFinal * NEG;
  const marksSaved = skipped * NEG;
  const pct = clamp((adjustedNet / count) * 100, 0, 100);

  return { adjustedNet, penaltyLeft, marksSaved, pct, band: bandFor(pct), correctEff, wrongEff, skipped };
}

// Coarse, honest percentile band for a practice marks-%. Returns
// { value: string|null, basis: string }. `value` is a broad band, never a
// precise rank; null when the score is too low for any defensible claim.
const PERCENTILE_BASIS = 'A broad estimate anchored to the official Mains qualifying floors and recent Prelims cut-off percentiles. Not a rank prediction.';

export function estimatePercentile(pct) {
  const p = Number(pct);
  if (!isFinite(p)) return { value: null, basis: PERCENTILE_BASIS };
  let value = null;
  if (p >= 65) value = 'around the 97th percentile or above';
  else if (p >= 50) value = 'roughly the 90th to 96th percentile band';
  else if (p >= 45) value = 'roughly the 85th to 90th percentile band';
  else if (p >= 35) value = 'roughly the 70th to 85th percentile band';
  return { value, basis: PERCENTILE_BASIS };
}
