// =====================================================================
// src/lib/quick-revision.js  (Feature F-D)
// Pure logic for "Quick Revision Mode": decide WHICH topics' notes to surface
// and in what order, then flatten them into a labelled card stream. No React,
// no storage — easy to reason about and test.
//
// Priority stack (F-E will later prepend 'doubt' above 'weak'):
//   1 weak areas (low quiz accuracy)  2 due for review  3 exam-proximity
//   broadening  4 recently studied. Each item carries a transparency `reason`.
// =====================================================================

export const REASON_LABELS = {
  doubt: 'You flagged this as unclear', // reserved for F-D's successor (F-E)
  weak: 'Weak area',
  due: 'Due for review',
  highyield: 'High yield: exam soon',
  broad: 'Broad coverage',
  recent: 'Recently studied',
};

// Ordered list of { topic, reason } from the available (has-cards) topics.
export function buildQuickRevisionPlan({ weakTopics = [], dueTopicIds = [], recentTopics = [], availableTopics = [], examDaysLeft = null }) {
  const avail = new Set(availableTopics);
  const seen = new Set();
  const order = [];
  const add = (topic, reason) => {
    if (!topic || !avail.has(topic) || seen.has(topic)) return;
    seen.add(topic);
    order.push({ topic, reason });
  };
  weakTopics.forEach(w => add(w.topic, 'weak'));     // 1
  dueTopicIds.forEach(t => add(t, 'due'));           // 2
  const soon = examDaysLeft != null && examDaysLeft <= 30;
  const mid = examDaysLeft != null && examDaysLeft > 30 && examDaysLeft <= 60;
  if (soon) availableTopics.forEach(t => add(t, 'highyield'));   // 3 (<30d: high-yield breadth)
  else if (mid) availableTopics.forEach(t => add(t, 'broad'));   // 3 (30–60d: broad coverage)
  recentTopics.forEach(t => add(t, 'recent'));       // 4
  // Fallback so the mode is never empty (brand-new user, no exam date).
  if (order.length === 0) availableTopics.forEach(t => add(t, 'broad'));
  return order;
}

// How many cards per topic + whether to keep only "essential" card types,
// tightening as the exam approaches (final week = critical sweep).
export function cardBudget(examDaysLeft) {
  if (examDaysLeft != null && examDaysLeft <= 7) return { perTopic: 2, essentialOnly: true };
  if (examDaysLeft != null && examDaysLeft <= 30) return { perTopic: 3, essentialOnly: true };
  return { perTopic: 5, essentialOnly: false };
}

const ESSENTIAL_TYPES = new Set(['keypoints', 'concept', 'mnemonic']);

// Find a card (and its module sub) by topic + title.
function findCardByTitle(conceptCards, topic, cardTitle) {
  const mods = (conceptCards && conceptCards[topic]) || [];
  for (const m of mods) {
    for (const card of m.cards) {
      if (card.title === cardTitle) return { card, sub: m.sub };
    }
  }
  return null;
}

// Flatten a plan into an ordered stream of { topic, sub, card, reason }.
// F-E: `doubtCards` (unique flagged cards: {topic, cardTitle, text}) are
// surfaced FIRST with reason 'doubt', and skipped from the normal stream.
// conceptCards shape: { topicId: [ { sub, cards: [ {type,title,body,...} ] } ] }
export function buildRevisionStream(plan, conceptCards, budget, doubtCards = []) {
  const out = [];
  const used = new Set(); // `${topic}::${title}` already emitted
  const b = budget || { perTopic: 5, essentialOnly: false };
  // Tolerate a missing plan / doubt list the way every other function here does.
  // The content blob loads ASYNCHRONOUSLY, so a first render can legitimately
  // call this before anything has arrived.
  const steps = Array.isArray(plan) ? plan : [];
  const doubts = Array.isArray(doubtCards) ? doubtCards : [];

  // 1) Doubts first.
  for (const d of doubts) {
    const found = findCardByTitle(conceptCards, d.topic, d.cardTitle);
    if (!found) continue;
    const key = `${d.topic}::${d.cardTitle}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push({ topic: d.topic, sub: found.sub, card: found.card, reason: 'doubt' });
  }

  // 2) The prioritised plan (skipping cards already shown as doubts).
  for (const { topic, reason } of steps) {
    const mods = (conceptCards && conceptCards[topic]) || [];
    let taken = 0;
    for (const m of mods) {
      if (taken >= b.perTopic) break;
      for (const card of m.cards) {
        if (taken >= b.perTopic) break;
        if (b.essentialOnly && !ESSENTIAL_TYPES.has(card.type)) continue;
        if (used.has(`${topic}::${card.title}`)) continue;
        out.push({ topic, sub: m.sub, card, reason });
        taken++;
      }
    }
  }
  return out;
}

// ---- read-time estimation (study-mode "N min read") ----
function wordsInCard(card) {
  const b = card && card.body;
  let text = '';
  if (Array.isArray(b)) text = b.join(' ');
  else if (typeof b === 'string') text = b;
  const bodyWords = (text.trim().match(/\S+/g) || []).length;
  const titleWords = card && card.title ? (card.title.trim().match(/\S+/g) || []).length : 0;
  return bodyWords + titleWords;
}

// Minutes to read a set of cards at ~200 wpm (min 1).
export function readMinutes(cards) {
  const words = (cards || []).reduce((a, c) => a + wordsInCard(c), 0);
  return Math.max(1, Math.round(words / 200));
}
