// =====================================================================
// BENCHMARK  —  pure "you vs topper targets" math (NEW-07.5)
// =====================================================================
// No React, no storage. Compares the user's measurable habits against
// the strategic targets toppers hit in NORCET. Every metric degrades to
// value:null with an honest detail line when its data source is absent,
// so the panel renders sensibly for brand-new users.
//
// HONESTY NOTES (reflected in the labels, keep them that way):
// - "Clinical topic speed" approximates the spec's "clinical scenario
//   speed": no clinical-scenario flag exists on questions, so we average
//   time over questions in clinical body systems (clinical-systems.js).
// - "Overall accuracy" is a proxy for "Mains section accuracy": practice
//   attempts are not split into Prelims/Mains papers.
// - Blind guesses only count what the user tagged as "Guess": if they
//   never tag confidence the metric reports null, not a flattering zero.
// =====================================================================

import { systemForQuestion } from './clinical-systems.js';

export const TOPPER_TARGETS = [
  { id: 'attempts', label: 'Attempts per 100 Qs', target: '78 to 85', why: 'Toppers attempt selectively. Blanket attempting feeds the negative penalty.' },
  { id: 'guesses',  label: 'Blind guesses',       target: 'Zero',    why: 'A blind guess has negative expected value once the penalty is counted.' },
  { id: 'clinical', label: 'Clinical topic speed', target: 'Under 50s per Q', why: 'Clinical questions must be pattern-recognised, not derived from scratch.' },
  { id: 'mains',    label: 'Overall accuracy',    target: 'Above 82%', why: 'Mains-level accuracy is what separates qualifying from ranking.' },
];

const MIN_TIMED = 5;    // timed clinical attempts needed before speed is claimed
const MIN_ATTEMPTS = 10; // attempts needed before accuracy is claimed

const none = (detail) => ({ value: null, meets: null, detail });

export function userBenchmarks(advancedTestHistory, history, allQuestions) {
  const mocks = Array.isArray(advancedTestHistory) ? advancedTestHistory : [];
  const hasMock = mocks.length > 0;

  // --- attempts per 100 (latest full test) ---
  let attemptsPer100 = none('Take a full Advanced test to measure this.');
  if (hasMock) {
    const m = mocks[mocks.length - 1];
    const attempted = (m.correct || 0) + (m.wrong || 0);
    if (m.count > 0) {
      const v = Math.round((attempted / m.count) * 100);
      attemptsPer100 = { value: v, meets: v >= 78 && v <= 85, detail: `Latest full test: ${attempted} of ${m.count} attempted.` };
    }
  }

  // --- walk history once for guesses, clinical speed, accuracy ---
  const byId = {};
  (Array.isArray(allQuestions) ? allQuestions : []).forEach((q) => { if (q && q.id) byId[q.id] = q; });

  let confTagged = 0, guessCount = 0;
  let clinTimeMs = 0, clinTimed = 0;
  let attempts = 0, correct = 0;
  if (history && typeof history === 'object') {
    for (const [qId, h] of Object.entries(history)) {
      const atts = h && Array.isArray(h.attempts) ? h.attempts : [];
      const q = byId[qId];
      const clinical = q && q.topic !== 'gk' && q.topic !== 'apt' && systemForQuestion(q) !== 'other';
      for (const a of atts) {
        if (!a || a.revealed) continue;
        attempts += 1;
        if (a.correct) correct += 1;
        const conf = a.conf || a.confidence;
        if (conf) { confTagged += 1; if (conf === 'guess') guessCount += 1; }
        if (clinical && a.timeMs > 0) { clinTimeMs += a.timeMs; clinTimed += 1; }
      }
    }
  }

  const guesses = confTagged === 0
    ? none('Tag your confidence during quizzes to track this.')
    : { value: guessCount, meets: guessCount === 0, detail: `${guessCount} of ${confTagged} tagged answers were blind guesses.` };

  const clinicalSpeedSec = clinTimed < MIN_TIMED
    ? none('Answer more timed clinical questions to measure this.')
    : (() => {
        const v = Math.round(clinTimeMs / clinTimed / 1000);
        return { value: v, meets: v < 50, detail: `Average over ${clinTimed} timed clinical-topic questions.` };
      })();

  const mainsAccuracy = attempts < MIN_ATTEMPTS
    ? none('Answer more questions to measure this.')
    : (() => {
        const v = Math.round((correct / attempts) * 100);
        return { value: v, meets: v > 82, detail: `Across ${attempts} practice attempts (proxy for Mains accuracy).` };
      })();

  return { attemptsPer100, guesses, clinicalSpeedSec, mainsAccuracy, hasMock };
}
