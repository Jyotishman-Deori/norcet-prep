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

// =====================================================================
// FEAT-01 — VERIFIED NORCET PACING DATA
// =====================================================================
// PRELIMS: 5 sections × 20 questions × 18 min/section = 100 Qs / 90 min
//          → 5400s / 100 = 54s per-question ceiling (the "finish on time"
//          yardstick; a target, not a verdict on any single question).
// MAINS:   4 sections × 40 questions × 45 min/section = 160 Qs / 180 min
//          → 10800s / 160 = 67.5s per-question ceiling.
export const PRELIMS_PACE_SEC = 54;
export const MAINS_PACE_SEC   = 67.5;
// Back-compat alias — existing callers (pacing-card, paceVerdict default) use
// EXAM_PACE_SEC and the app's tests are Prelims-style (100 Q), so it maps to
// the Prelims ceiling.
export const EXAM_PACE_SEC = PRELIMS_PACE_SEC;

// Negative marking — AIIMS NORCET deducts 1/3 mark per wrong answer.
export const NEGATIVE_MARK = -1 / 3;
export const NEGATIVE_MARK_LABEL = '−1/3';

// Topper vs average per-question pacing, by TOPIC TYPE (verified ranges, in
// seconds). `avg` = typical candidate; `topper` = the target a top-rank
// aspirant holds. Consumed by the pacing analytics + (later) NEW-04 Three-Wave
// and NEW-07 benchmark panel. Ranges are inclusive [min, max].
export const PACING_TIERS = {
  gk_current: {
    label: 'GK & Current Affairs',
    avg: [35, 45], topper: [15, 20],
  },
  aptitude: {
    label: 'Aptitude & Reasoning',
    avg: [70, 90], topper: [45, 60],
  },
  fact_heavy: {
    label: 'Fact-Heavy Nursing',          // Anatomy, Microbiology, BMW, Nutrition
    avg: [45, 50], topper: [25, 30],
  },
  conceptual: {
    label: 'Conceptual Nursing',          // Pharmacology, Med-Surg basics
    avg: [55, 65], topper: [40, 45],
  },
  priority_clinical: {
    label: 'Priority / Clinical Nursing', // Critical care, Fundamentals, OBG, Peds, MHN, CH
    avg: [65, 80], topper: [50, 55],
  },
};

// Map each app topic id (src/data/seed.js) to a pacing tier above. Anything
// unmapped falls back to the mid 'conceptual' tier.
export const TOPIC_PACING_TIER = {
  gk: 'gk_current',
  apt: 'aptitude',
  anat: 'fact_heavy', micro: 'fact_heavy', nutr: 'fact_heavy',
  pharm: 'conceptual', msn: 'conceptual',
  fund: 'priority_clinical', peds: 'priority_clinical', obg: 'priority_clinical',
  ch: 'priority_clinical', mhn: 'priority_clinical',
};

// Resolve a topic id to its tier object (never null).
export function pacingTierForTopic(topicId) {
  return PACING_TIERS[TOPIC_PACING_TIER[topicId] || 'conceptual'];
}
// Topper target range [min,max] seconds for a topic (mid-point is a good single target).
export function topperTargetForTopic(topicId) {
  return pacingTierForTopic(topicId).topper;
}

// NEW-03 "The Pulse" + "Flashpoint" — per-CATEGORY per-question time budgets.
//
// FLASHPOINT_SEC is the intense, "fingers ready" tier (timers cut in half).
// Recall-heavy categories get the least time; calculation the most. Normal
// Pulse = 2× Flashpoint (tense but fair) and is nudged by question difficulty so
// a genuinely hard / deep-thinking item earns more time and an easy recall less.
// These replace the older average-band budget, which felt too generous.
//
// Category → seconds (FLASHPOINT tier). Topics not in the table fall back to 15s.
//   gk·anat·ch·micro      10s   (recall: GK, Anatomy, CHN, Microbiology)
//   pharm·nutr            15s   (applied recall: Pharmacology, Nutrition)
//   msn·obg·peds·fund·mhn 20s   (clinical reasoning)
//   apt                   30s   (Aptitude / Math — calculation)
export const FLASHPOINT_SEC = {
  gk: 10, anat: 10, ch: 10, micro: 10,
  pharm: 15, nutr: 15,
  msn: 20, obg: 20, peds: 20, fund: 20, mhn: 20,
  apt: 30,
};
const FLASHPOINT_DEFAULT = 15;

// Difficulty multiplier for NORMAL pulse only (Flashpoint timers stay fixed).
// Hard = more thinking time; easy = less. Unknown difficulty → neutral (1.0).
const DIFFICULTY_FACTOR = { easy: 0.8, medium: 1, moderate: 1, hard: 1.3 };

// Flashpoint (halved) budget for a topic — fixed, the "make time matter" tier.
export function flashpointBudgetSec(topicId) {
  return FLASHPOINT_SEC[topicId] || FLASHPOINT_DEFAULT;
}

// Per-question budget. opts.flashpoint → the fixed Flashpoint tier; otherwise
// the normal pulse tier (2× Flashpoint) nudged by opts.difficulty. Sane floor.
export function questionBudgetSec(topicId, opts = {}) {
  const base = flashpointBudgetSec(topicId);
  if (opts && opts.flashpoint) return base;
  const factor = (opts && DIFFICULTY_FACTOR[opts.difficulty]) || 1;
  return Math.max(8, Math.round(base * 2 * factor));
}

// ── Context the engine assumes (notes, not code) ─────────────────────
// • Toppers typically attempt only 78–85 of 100 questions in Prelims — they
//   deliberately SKIP rather than risk the 1/3 negative penalty. "Attempt all"
//   is an average-candidate mistake.
// • Sectional lock: each Prelims section locks 18 minutes after it opens, for
//   good. So PER-SECTION pacing matters more than overall paper pacing — you
//   cannot borrow time from a later section.

// ── TODO (future features — do NOT implement here) ───────────────────
// • NEW-04 Three-Wave topper strategy:
//     Sprint       (0–8 min)  — sure-shot recalls, max 20s/question.
//     Deep Dive    (8–15 min) — return to skipped clinical/aptitude, 60–80s buffer.
//     Calculated Risk (15–18 min) — eliminate 2 of 4 or skip; never blind-guess.
// • Topper tie-breaker rule: "If I can only do ONE thing and leave the room,
//   which action keeps the patient alive?"
// • Clinical priority frameworks to surface in rationale/coaching: ADPIE
//   (assess before intervening), ABCs (airway beats everything), Maslow
//   (physiological before psychosocial), Acute vs Chronic (unexpected
//   deterioration over expected symptoms), Least Restrictive first.
// • PwBD pacing considerations may differ (extra time / scribe) — tier targets
//   above are for the standard candidate.

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
  if (avgSec <= targetSec * 0.7) return { kind: 'fast', text: `Averaging ${avgSec}s: well inside exam pace (~${targetSec}s). Make sure speed isn’t costing accuracy.` };
  if (avgSec <= targetSec * 1.1) return { kind: 'onpace', text: `Averaging ${avgSec}s: right around exam pace (~${targetSec}s).` };
  if (avgSec <= targetSec * 1.5) return { kind: 'slow', text: `Averaging ${avgSec}s: a bit over exam pace (~${targetSec}s). Tighten the slow topics below.` };
  return { kind: 'verslow', text: `Averaging ${avgSec}s: well over exam pace (~${targetSec}s). Time management is the lever here.` };
}
