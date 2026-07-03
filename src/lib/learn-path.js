// =====================================================================
// src/lib/learn-path.js — the SEQUENTIAL LEARN PATH model (pure).
// Blueprint M1: order the subject units into a Duolingo-style timeline
// that encourages unit-by-unit progression. Deliberate adaptation: the
// path SUGGESTS sequence (prerequisite-ordered, with one "recommended
// next" node) but never hard-locks a unit — live users already have
// nonlinear progress, and exam prep must allow weightage-driven jumps.
//
// Everything is derived from existing signals — no new tracking:
//   • order      — topological over kmap's prerequisite DAG (stable by
//                  the caller's topic order for ties).
//   • state/ring — kmap's mindmapState thresholds + mindmapNextProgress,
//                  aggregated from quiz history via attemptStats.
//   • recommended— first unit in path order that isn't mastered and
//                  whose prerequisites have all been at least touched.
//
// compileGuidebook() builds the per-unit "Guidebook" summary from the
// keypoints/mnemonic cards already authored in concept-cards.json — a
// static review digest, zero new content.
// =====================================================================
import { mindmapState, mindmapNextProgress, mindmapStateRank, DEPENDENCIES } from './kmap.js';
import { attemptStats } from './compact.js';

// Prerequisite edges only (lateral "related" edges don't order the path).
function prereqEdges() {
  return DEPENDENCIES.filter(d => d && d.type === 'prerequisite');
}

// Stable topological order of the given topic ids over the prereq DAG.
// Kahn's algorithm; ties resolve by the caller's original order. Ids with
// no edges keep their relative position among the zero-indegree pool.
export function orderTopicsByPrereq(topicIds) {
  const ids = Array.isArray(topicIds) ? topicIds.filter(Boolean) : [];
  const idSet = new Set(ids);
  const pos = new Map(ids.map((id, i) => [id, i]));
  const indegree = new Map(ids.map(id => [id, 0]));
  const out = new Map(ids.map(id => [id, []]));
  for (const e of prereqEdges()) {
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    indegree.set(e.to, indegree.get(e.to) + 1);
    out.get(e.from).push(e.to);
  }
  const ready = ids.filter(id => indegree.get(id) === 0);
  const order = [];
  while (ready.length) {
    ready.sort((a, b) => pos.get(a) - pos.get(b)); // stable: original order
    const id = ready.shift();
    order.push(id);
    for (const next of out.get(id)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) ready.push(next);
    }
  }
  // Cycle safety (data error): append anything unplaced in original order.
  for (const id of ids) if (!order.includes(id)) order.push(id);
  return order;
}

// buildLearnPath({ history, allQuestions, topics }) → ordered path nodes:
//   { topicId, name, icon, color, state, stateRank, attempted, accuracy,
//     coverage, next: {label, ratio, hint}, recommended, reason }
export function buildLearnPath({ history, allQuestions, topics } = {}) {
  const tList = Array.isArray(topics) ? topics.filter(t => t && t.id) : [];
  if (tList.length === 0) return [];
  const qs = Array.isArray(allQuestions) ? allQuestions : [];
  const h = history && typeof history === 'object' ? history : {};

  // Aggregate per topic from quiz history.
  const agg = {}; // topicId -> { attempted, correct, answeredIds:Set, totalQ }
  for (const t of tList) agg[t.id] = { attempted: 0, correct: 0, answered: 0, totalQ: 0 };
  for (const q of qs) {
    const a = agg[q && q.topic];
    if (!a) continue;
    a.totalQ++;
    const rec = h[q.id];
    if (!rec) continue;
    const s = attemptStats(rec);
    if (s.total === 0) continue;
    a.attempted += s.total;
    a.correct += s.correct;
    a.answered++;
  }

  const byId = Object.fromEntries(tList.map(t => [t.id, t]));
  const order = orderTopicsByPrereq(tList.map(t => t.id));

  const prereqsOf = {};
  for (const e of prereqEdges()) {
    if (!byId[e.from] || !byId[e.to]) continue;
    (prereqsOf[e.to] = prereqsOf[e.to] || []).push(e.from);
  }

  const nodes = order.map(id => {
    const t = byId[id];
    const a = agg[id];
    const accuracy = a.attempted > 0 ? a.correct / a.attempted : 0;
    const state = mindmapState(a.attempted, accuracy);
    return {
      topicId: id,
      name: t.name,
      icon: t.icon || '📘',
      color: t.color || '#0F4C4C',
      state,
      stateRank: mindmapStateRank(state),
      attempted: a.attempted,
      accuracy,
      coverage: a.totalQ > 0 ? a.answered / a.totalQ : 0,
      next: mindmapNextProgress(state, a.attempted, accuracy),
      recommended: false,
      reason: null,
    };
  });

  // Recommended next: first non-mastered unit whose prereqs are all touched.
  const stateOf = Object.fromEntries(nodes.map(n => [n.topicId, n]));
  for (const n of nodes) {
    if (n.state === 'mastered') continue;
    const prereqs = prereqsOf[n.topicId] || [];
    const ok = prereqs.every(p => !stateOf[p] || stateOf[p].stateRank >= 1);
    if (!ok) continue;
    n.recommended = true;
    n.reason = n.state === 'locked'
      ? 'start'
      : (n.attempted >= 5 && n.accuracy < 0.5 ? 'strengthen' : 'continue');
    break;
  }
  return nodes;
}

export const PATH_REASON_LABEL = {
  start: 'Start here',
  continue: 'Continue here',
  strengthen: 'Strengthen this',
};

// compileGuidebook(topicId, conceptCards) — per-unit review digest from the
// authored keypoints + mnemonic cards. Returns null when the topic has no
// concept-card content; modules with neither are dropped.
//   { topicId, totalCards, modules: [{ sub, cardCount, keypoints[],
//     mnemonics: [{title, body}] }] }
export function compileGuidebook(topicId, conceptCards) {
  if (!topicId || !conceptCards || typeof conceptCards !== 'object' || Array.isArray(conceptCards)) return null;
  const groups = conceptCards[topicId];
  if (!Array.isArray(groups) || groups.length === 0) return null;
  let totalCards = 0;
  const modules = [];
  for (const g of groups) {
    if (!g || !Array.isArray(g.cards)) continue;
    totalCards += g.cards.length;
    const keypoints = [];
    const mnemonics = [];
    for (const c of g.cards) {
      if (!c) continue;
      if (c.type === 'keypoints') {
        if (Array.isArray(c.body)) keypoints.push(...c.body.filter(x => typeof x === 'string' && x));
        else if (typeof c.body === 'string' && c.body) keypoints.push(c.body);
      } else if (c.type === 'mnemonic' && c.title) {
        mnemonics.push({ title: c.title, body: Array.isArray(c.body) ? c.body.join(' ') : (c.body || '') });
      }
    }
    if (keypoints.length || mnemonics.length) {
      modules.push({ sub: g.sub || 'General', cardCount: g.cards.length, keypoints, mnemonics });
    }
  }
  if (modules.length === 0) return null;
  return { topicId, totalCards, modules };
}
