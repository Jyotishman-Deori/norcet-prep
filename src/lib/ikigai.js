// =====================================================================
// src/lib/ikigai.js — PHIL-01 "Clinical Ikigai Compass" (pure math).
// No React, no storage. Turns the data we ALREADY collect into the four Ikigai
// dimensions, each a 0..1 score that drives the compass (size + how close the
// circle drifts to the shared centre). Every score is quality × data-confidence,
// so a brand-new user starts with four small, separated circles that grow and
// converge as they practise — and never looks "broken/empty".
//
// Adapted to this app's reality (there is no "Shift Simulator"):
//   Passion    — how much you CHOOSE to engage (streak · breadth · volume)
//   Profession — what you're good at (overall accuracy, volume-trusted)
//   Mission    — what NORCET demands (mastery of FOUNDATIONAL questions)
//   Vocation   — what gets you placed (exam pacing + negative-marking restraint)
// =====================================================================
import { attemptStats } from './compact.js';
import { isFoundational } from './foundational.js';
import { EXAM_PACE_SEC } from './pacing.js';
import { countsInNursingStats } from '../data/seed.js';

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const ramp = (n, full) => clamp01(n / full);          // 0→1 data-confidence ramp

export const IKIGAI_DIMENSIONS = [
  { key: 'passion',    label: 'What you love',     short: 'Passion',    color: '#E0245E', hint: 'How much you show up, streak, breadth, volume.' },
  { key: 'profession', label: "What you're good at", short: 'Profession', color: '#0B7285', hint: 'Your overall accuracy across everything you attempt.' },
  { key: 'mission',    label: 'What NORCET demands', short: 'Mission',    color: '#9333EA', hint: 'Mastery of the must-know, foundational questions.' },
  { key: 'vocation',   label: 'What gets you placed', short: 'Vocation',  color: '#16A34A', hint: 'Exam pacing + restraint against negative marking.' },
];

export function computeIkigai(data, allQuestions) {
  const history = (data && data.history) || {};
  const stats = (data && data.stats) || {};
  const includeGk = !!(data && data.preferences && data.preferences.includeGkInStats === true);
  const qById = new Map((allQuestions || []).map((q) => [q.id, q]));

  let attempted = 0, correct = 0;
  let foundAtt = 0, foundCorrect = 0;
  let timeSum = 0, timeN = 0;
  let guessN = 0, guessWrong = 0;
  const topicsTouched = new Set();

  Object.entries(history).forEach(([qId, h]) => {
    const q = qById.get(qId);
    const s = attemptStats(h);
    if (s.total > 0) {
      attempted += s.total;
      correct += s.correct;
      if (q && q.topic) topicsTouched.add(q.topic);
      if (q && isFoundational(q)) { foundAtt += s.total; foundCorrect += s.correct; }
    }
    const atts = Array.isArray(h && h.attempts) ? h.attempts : [];
    atts.forEach((a) => {
      if (!a || a.revealed) return;
      if (typeof a.timeMs === 'number' && a.timeMs > 0) { timeSum += a.timeMs; timeN += 1; }
      if ((a.conf || a.confidence) === 'guess') { guessN += 1; if (!a.correct) guessWrong += 1; }
    });
  });

  const accuracy = attempted > 0 ? correct / attempted : 0;
  const foundAcc = foundAtt > 0 ? foundCorrect / foundAtt : 0;
  const avgSec = timeN > 0 ? timeSum / timeN / 1000 : null;

  // Breadth — distinct nursing topics touched / nursing topics available.
  const nursingTopics = new Set();
  (allQuestions || []).forEach((q) => { if (q && q.topic && countsInNursingStats(q.topic, includeGk)) nursingTopics.add(q.topic); });
  const touchedNursing = [...topicsTouched].filter((t) => countsInNursingStats(t, includeGk)).length;
  const breadthScore = nursingTopics.size > 0 ? touchedNursing / nursingTopics.size : 0;

  // ── PASSION — engagement (you choose to show up) ──
  const streakScore = clamp01((stats.streakCurrent || 0) / 14);
  const volumeScore = ramp(attempted, 200);
  const passion = clamp01(0.40 * streakScore + 0.30 * breadthScore + 0.30 * volumeScore);

  // ── PROFESSION — accuracy, trusted as volume grows ──
  const profession = clamp01(accuracy) * ramp(attempted, 40);

  // ── MISSION — foundational mastery ──
  const mission = clamp01(foundAcc) * ramp(foundAtt, 12);

  // ── VOCATION — pacing + negative-marking restraint ──
  const pacingScore = avgSec ? clamp01(EXAM_PACE_SEC / avgSec) : 0;
  const restraintScore = guessN >= 3 ? clamp01(1 - guessWrong / guessN) : clamp01(accuracy);
  const vocation = clamp01(0.6 * pacingScore + 0.4 * restraintScore) * ramp(timeN || attempted, 30);

  const scores = { passion, profession, mission, vocation };
  const vals = Object.values(scores);
  const overall = vals.reduce((a, b) => a + b, 0) / vals.length;
  const master = vals.every((v) => v >= 0.8);

  // Weakest dimension (for the Alignment nudge) — only meaningful with some data.
  let weakest = null;
  if (attempted >= 5) {
    weakest = IKIGAI_DIMENSIONS.reduce((lo, d) => (scores[d.key] < scores[lo.key] ? d : lo), IKIGAI_DIMENSIONS[0]);
  }

  return {
    scores, overall, master, weakest,
    hasData: attempted > 0,
    // raw signals, surfaced as small readouts under the compass
    detail: {
      attempted, accuracy: Math.round(accuracy * 100),
      foundAtt, foundAcc: Math.round(foundAcc * 100),
      avgSec: avgSec ? Math.round(avgSec) : null,
      streak: stats.streakCurrent || 0,
      breadthPct: Math.round(breadthScore * 100),
    },
  };
}
