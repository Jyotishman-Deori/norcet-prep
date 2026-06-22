// =====================================================================
// HIGH-YIELD INDEX  —  what the exam actually repeats
// =====================================================================
// Pure, dependency-light. Mines the official previous-year papers for how
// often each CONCEPT (topic + sub) and each TOPIC recurs across papers/years.
// "High-yield" = repeatedly asked, which is the single most useful lens for an
// aspirant deciding what to study first.
//
// Reads the canonical archive (PREVIOUS_YEAR_PAPERS); every question there is
// tagged { topic, sub } and every paper has a { year }. No React, no storage.
// =====================================================================
import { PREVIOUS_YEAR_PAPERS } from '../norcet-pyq-data.js';

const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
const keyOf = (topic, sub) => `${topic}|${norm(sub)}`;

// Build an index from ANY papers array (pure — used directly in tests and for
// admin-extended archives). Returns { concepts, topics, conceptCount, conceptYears }.
export function buildHighYieldIndex(papers) {
  const concept = new Map(); // key -> { topic, sub, count, years:Set }
  const topic = new Map();   // topicId -> { topic, count, years:Set, subs:Set }

  (Array.isArray(papers) ? papers : []).forEach((p) => {
    if (!p || !Array.isArray(p.questions)) return;
    const yr = typeof p.year === 'number' ? p.year : null;
    p.questions.forEach((q) => {
      if (!q || !q.topic) return;
      const k = keyOf(q.topic, q.sub);
      if (!concept.has(k)) concept.set(k, { topic: q.topic, sub: (q.sub || '').trim(), count: 0, years: new Set() });
      const c = concept.get(k);
      c.count += 1;
      if (yr) c.years.add(yr);

      if (!topic.has(q.topic)) topic.set(q.topic, { topic: q.topic, count: 0, years: new Set(), subs: new Set() });
      const t = topic.get(q.topic);
      t.count += 1;
      if (yr) t.years.add(yr);
      if (q.sub) t.subs.add(norm(q.sub));
    });
  });

  const concepts = [...concept.values()]
    .filter((c) => c.sub) // skip blank sub — can't name a concept
    .map((c) => ({ topic: c.topic, sub: c.sub, count: c.count, years: [...c.years].sort(), yearSpan: c.years.size }))
    .sort((a, b) => b.count - a.count || b.yearSpan - a.yearSpan || a.sub.localeCompare(b.sub));

  const topics = [...topic.values()]
    .map((t) => ({ topic: t.topic, count: t.count, years: [...t.years].sort(), yearSpan: t.years.size, conceptCount: t.subs.size }))
    .sort((a, b) => b.count - a.count);

  return {
    concepts,
    topics,
    conceptCount: (tp, sb) => { const e = concept.get(keyOf(tp, sb)); return e ? e.count : 0; },
    conceptYears: (tp, sb) => { const e = concept.get(keyOf(tp, sb)); return e ? [...e.years].sort() : []; },
  };
}

// Memoized default index over the canonical archive — used by the inline badge
// (which has no papers in scope) so the chip is cheap on every PYQ render.
let _default = null;
export function defaultHighYieldIndex() {
  if (!_default) _default = buildHighYieldIndex(PREVIOUS_YEAR_PAPERS);
  return _default;
}

// How many times this exact concept (topic + sub) appears across the archive.
export function conceptCount(topic, sub) {
  return defaultHighYieldIndex().conceptCount(topic, sub);
}

// Tier for chip styling / thresholds. Tuned in code below against the real
// distribution; only genuinely-recurring concepts get flagged.
export function highYieldTier(count) {
  if (count >= HIGH_YIELD_HIGH) return 'high';
  if (count >= HIGH_YIELD_MIN) return 'medium';
  return 'none';
}

// Thresholds (see distribution check). MIN = the floor to call something
// "repeated" at all; HIGH = the "hot" tier.
export const HIGH_YIELD_MIN = 3;
export const HIGH_YIELD_HIGH = 5;
