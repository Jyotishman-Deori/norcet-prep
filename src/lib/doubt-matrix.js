// =====================================================================
// DOUBT MATRIX  —  pure confidence-vs-accuracy quadrant math (NEW-07.2)
// =====================================================================
// No React, no storage. Maps every confidence-tagged attempt in
// data.history into the spec's four quadrants:
//
//   sweet  high confidence + correct   -> trust it
//   fatal  high confidence + wrong     -> misconceptions, target FIRST
//   lucky  low  confidence + correct   -> latent knowledge, still revise
//   gap    low  confidence + wrong     -> honest gaps, learn from basics
//
// Confidence bands follow the spec's two-level table: 'sure' = high;
// 'unsure' and 'guess' = low. Attempts without conf, and revealed
// (answer-shown) attempts, are ignored — same safety rule as
// src/lib/calibration.js, so legacy history can never skew the grid.
//
// Cell `n`/`pct` count ATTEMPTS (the volume of the habit). Cell `qIds`
// are DISTINCT question ids classified by each question's MOST RECENT
// conf-tagged attempt, so tapping a cell reviews where the question
// stands today, not where it was three weeks ago.
// =====================================================================

export const QUADRANTS = ['sweet', 'fatal', 'lucky', 'gap'];

export const QUADRANT_META = {
  sweet: { label: 'Sweet Spot',        conf: 'high', result: 'right', tone: 'success',
           action: 'Solid and self-aware. No action needed.' },
  fatal: { label: 'Fatal Danger Zone', conf: 'high', result: 'wrong', tone: 'error',
           action: 'You were sure and still wrong. These misconceptions cost the most negative marks: fix them first.' },
  lucky: { label: 'Lucky Guesses',     conf: 'low',  result: 'right', tone: 'warn',
           action: 'Right answer, shaky ground. Revise the concept so luck becomes knowledge.' },
  gap:   { label: 'Knowledge Gaps',    conf: 'low',  result: 'wrong', tone: 'muted',
           action: 'You knew you did not know. Feed these into basic subject revision.' },
};

const isHigh = (conf) => conf === 'sure';

function quadrantOf(conf, correct) {
  if (isHigh(conf)) return correct ? 'sweet' : 'fatal';
  return correct ? 'lucky' : 'gap';
}

export function emptyDoubtMatrix() {
  const cells = {};
  QUADRANTS.forEach((q) => { cells[q] = { n: 0, pct: 0, qIds: [] }; });
  return { total: 0, hasData: false, cells };
}

export function doubtMatrixFromHistory(history) {
  const m = emptyDoubtMatrix();
  if (!history || typeof history !== 'object') return m;

  for (const [qId, h] of Object.entries(history)) {
    const attempts = h && Array.isArray(h.attempts) ? h.attempts : [];
    let latest = null; // most recent conf-tagged attempt for this question
    for (const a of attempts) {
      if (!a || a.revealed) continue;
      const conf = a.conf || a.confidence;
      if (!conf || (conf !== 'sure' && conf !== 'unsure' && conf !== 'guess')) continue;
      m.cells[quadrantOf(conf, !!a.correct)].n += 1;
      m.total += 1;
      if (!latest || (a.ts || 0) >= (latest.ts || 0)) latest = { ts: a.ts || 0, conf, correct: !!a.correct };
    }
    if (latest) m.cells[quadrantOf(latest.conf, latest.correct)].qIds.push(qId);
  }

  if (m.total > 0) {
    m.hasData = true;
    QUADRANTS.forEach((q) => { m.cells[q].pct = Math.round((m.cells[q].n / m.total) * 100); });
  }
  return m;
}

// One headline insight; fires only when the dangerous quadrant has volume.
export function doubtMatrixInsight(matrix) {
  if (!matrix || !matrix.hasData) return null;
  const fatal = matrix.cells.fatal;
  if (fatal.n === 0) return null;
  return {
    kind: 'fatal',
    text: `${fatal.n} answer${fatal.n === 1 ? '' : 's'} where you felt sure but were wrong. In the exam each of those costs the full negative penalty: hunt these misconceptions down first.`,
  };
}
