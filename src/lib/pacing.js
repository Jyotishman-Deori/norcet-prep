// =====================================================================
// PACING  —  pure "where do you bleed time" math
// =====================================================================
// No React, no storage. Aggregates per-question time (already captured as
// timeMs on every answer) into a per-TOPIC view so a learner can see which
// subjects cost them minutes — the actionable lens for a speeded exam.
//
// Complements the per-question TimeQuadrant on Results (that's fast/slow ×
// right/wrong per question; this is "Pharmacology averages 82s, target 54s").
//
// Input entries: { topic, timeMs, correct?, revealed? } — caller resolves the
// topic (results carry questions; history is joined with allQuestions). Reveals
// and zero/absent times are ignored.
// =====================================================================

// NORCET Prelims pace: 100 questions in 90 minutes ≈ 54s per question. This is
// the "finish on time" yardstick; it is a target, not a verdict on any single
// question.
export const EXAM_PACE_SEC = 54;

const round = (n) => Math.round(n);

function clean(entries) {
  return (Array.isArray(entries) ? entries : []).filter(
    (e) => e && !e.revealed && typeof e.timeMs === 'number' && e.timeMs > 0
  );
}

export function overallPace(entries) {
  const valid = clean(entries);
  if (valid.length === 0) return { n: 0 };
  const times = valid.map((e) => e.timeMs).sort((a, b) => a - b);
  const avgSec = times.reduce((s, x) => s + x, 0) / times.length / 1000;
  const medianSec = times[Math.floor(times.length / 2)] / 1000;
  return { n: valid.length, avgSec: round(avgSec), medianSec: round(medianSec) };
}

// Per-topic averages, slowest first. `overSec` is how far the average sits
// above exam pace (negative = faster than pace).
export function pacingByTopic(entries, opts = {}) {
  const targetSec = opts.targetSec ?? EXAM_PACE_SEC;
  const byTopic = new Map();
  clean(entries).forEach((e) => {
    if (!e.topic) return;
    if (!byTopic.has(e.topic)) byTopic.set(e.topic, { topic: e.topic, n: 0, totalMs: 0, correct: 0 });
    const t = byTopic.get(e.topic);
    t.n += 1;
    t.totalMs += e.timeMs;
    if (e.correct) t.correct += 1;
  });
  return [...byTopic.values()]
    .map((t) => {
      const avgSec = t.totalMs / t.n / 1000;
      return { topic: t.topic, n: t.n, avgSec: round(avgSec), overSec: round(avgSec - targetSec), acc: round((t.correct / t.n) * 100) };
    })
    .sort((a, b) => b.avgSec - a.avgSec);
}

// Headline verdict for the overall pace, exam-pace relative.
export function paceVerdict(avgSec, targetSec = EXAM_PACE_SEC) {
  if (typeof avgSec !== 'number') return null;
  if (avgSec <= targetSec * 0.7) return { kind: 'fast', text: `Averaging ${avgSec}s — well inside exam pace (~${targetSec}s). Make sure speed isn’t costing accuracy.` };
  if (avgSec <= targetSec * 1.1) return { kind: 'onpace', text: `Averaging ${avgSec}s — right around exam pace (~${targetSec}s).` };
  if (avgSec <= targetSec * 1.5) return { kind: 'slow', text: `Averaging ${avgSec}s — a bit over exam pace (~${targetSec}s). Tighten the slow topics below.` };
  return { kind: 'verslow', text: `Averaging ${avgSec}s — well over exam pace (~${targetSec}s). Time management is the lever here.` };
}
