// =====================================================================
// CALIBRATION  —  pure "how well do you know what you know" math
// =====================================================================
// No React, no storage. Buckets answered questions by the confidence the user
// declared (sure / unsure / guess) and reports accuracy within each bucket.
// The gap between stated confidence and real accuracy is the learning signal:
// being "Sure" but often wrong = blind spots; "Guesses" often right = latent
// knowledge.
//
// Input items: { correct: bool, conf?: 'sure'|'unsure'|'guess', revealed?: bool }
// (also accepts `confidence` as an alias). Items with no conf, or revealed
// (neutral) items, are ignored — so legacy history without confidence is safe.
// =====================================================================

export const CONF_LEVELS = ['sure', 'unsure', 'guess'];

export const CONF_META = {
  sure:   { label: 'Sure',   blurb: 'confident' },
  unsure: { label: 'Unsure', blurb: 'leaning' },
  guess:  { label: 'Guess',  blurb: 'no idea' },
};

export function emptyCalibration() {
  const buckets = {};
  CONF_LEVELS.forEach((l) => { buckets[l] = { n: 0, correct: 0, acc: null }; });
  return { buckets, total: 0 };
}

export function calibrationFromItems(items) {
  const cal = emptyCalibration();
  (Array.isArray(items) ? items : []).forEach((it) => {
    if (!it || it.revealed) return;
    const c = it.conf || it.confidence;
    if (!c || !cal.buckets[c]) return;
    cal.buckets[c].n += 1;
    if (it.correct) cal.buckets[c].correct += 1;
  });
  CONF_LEVELS.forEach((l) => {
    const b = cal.buckets[l];
    if (b.n > 0) b.acc = Math.round((b.correct / b.n) * 100);
    cal.total += b.n;
  });
  return cal;
}

// One honest headline insight, or null when there isn't enough signal.
export function calibrationInsight(cal) {
  if (!cal || cal.total < 5) return null;
  const sure = cal.buckets.sure;
  const guess = cal.buckets.guess;
  if (sure.n >= 3 && sure.acc !== null && sure.acc < 70) {
    return { kind: 'overconfident', text: `You felt "Sure" but were right ${sure.acc}% of the time. Those are the blind spots to hunt down.` };
  }
  if (guess.n >= 3 && guess.acc !== null && guess.acc >= 60) {
    return { kind: 'underconfident', text: `Your "Guesses" landed ${guess.acc}% right: you know more than you give yourself credit for.` };
  }
  if (sure.n >= 3 && sure.acc !== null && sure.acc >= 85) {
    return { kind: 'calibrated', text: `Your "Sure" answers are ${sure.acc}% right: nicely calibrated. Trust that instinct in the exam.` };
  }
  return null;
}
