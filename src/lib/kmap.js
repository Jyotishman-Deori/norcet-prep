// =====================================================================
// src/lib/kmap.js — pure knowledge-map model: state thresholds, ring layout,
// and SVG path helpers (A1 slice 32). No React, no DOM, no theme, no storage.
// Extracted VERBATIM from App.jsx (consts + pure helpers were scattered across
// the KnowledgeMap region); consumers (KnowledgeMap, MindmapNodePopup) import
// from here. `mindmapState`/`accuracy` convention: attempted = attempt count,
// accuracy = correct/attempted in 0..1.
// =====================================================================

const KMAP_STATES = ['locked', 'discovered', 'familiar', 'mastered'];
function mindmapState(attempted, accuracy) {
  const a = Number(attempted) || 0;
  const acc = Number(accuracy) || 0;
  if (a >= 25 && acc >= 0.80) return 'mastered';
  if (a >= 10 && acc >= 0.60) return 'familiar';
  if (a >= 1) return 'discovered';
  return 'locked';
}

// Progress toward the NEXT state, for the popup's progress bar. Returns
// { label, ratio (0..1), hint }. Mirrors the thresholds above.
function mindmapNextProgress(state, attempted, accuracy) {
  const a = Number(attempted) || 0;
  const acc = Number(accuracy) || 0;
  if (state === 'mastered') return { label: 'Mastered', ratio: 1, hint: 'You\u2019ve mastered this topic.' };
  if (state === 'familiar') {
    const ratio = Math.min(a / 25, 1);
    const need = acc >= 0.80 ? `${Math.max(0, 25 - a)} more attempts` : 'keep accuracy \u2265 80%';
    return { label: 'Next: Mastered', ratio, hint: `25 attempts & 80% \u2014 ${need}.` };
  }
  if (state === 'discovered') {
    const ratio = Math.min(a / 10, 1);
    const need = acc >= 0.60 ? `${Math.max(0, 10 - a)} more attempts` : 'lift accuracy to \u2265 60%';
    return { label: 'Next: Familiar', ratio, hint: `10 attempts & 60% \u2014 ${need}.` };
  }
  // locked
  return { label: 'Next: Discovered', ratio: 0, hint: 'Answer one question to unlock this topic.' };
}

function mindmapStateRank(state) {
  const i = KMAP_STATES.indexOf(state);
  return i < 0 ? 0 : i;
}

// Lays the model out in a logical 0..VIEW box. Root at centre, subjects on
// ring 1 (evenly), subtopics fanned across each subject's angular wedge on
// ring 2 (alternating radius to reduce label overlap). Returns nodes (with
// x,y) + edges (quadratic-bezier path strings) — no DOM, no React.
const KMAP_VIEW = 1000;               // logical viewBox is KMAP_VIEW x KMAP_VIEW
const KMAP_R1 = 232;                  // subject ring radius
const KMAP_R2 = 392;                  // subtopic ring base radius
function _kmapEdgePath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const off = Math.min(46, len * 0.16);          // gentle bow -> curved Bezier
  const cx = mx + (-dy / len) * off;
  const cy = my + (dx / len) * off;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
// Phase B — flat-top hexagon path centred at (cx,cy) with circumradius r.
function _kmapHexPath(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);   // -30 => flat top
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += (i === 0 ? 'M ' : 'L ') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  return d + 'Z';
}
// "Beyond syllabus" enrichment nodes. Each hangs off a parent subject and is
// HIDDEN until the user has mastered >= BONUS_REVEAL_MASTERED subtopics in that
// parent (prompt item 5). Hexagonal/amber, sit outside the parent's ring.
// `id` is namespaced so it can never collide with a real topic id.
const BONUS_REVEAL_MASTERED = 2;
const BONUS_NODES = [
  { id: 'bonus::ecg',     parent: 'msn',   name: 'Advanced ECG & Arrhythmias' },
  { id: 'bonus::pgx',     parent: 'pharm', name: 'Pharmacogenomics Basics' },
  { id: 'bonus::crit',    parent: 'msn',   name: 'Critical Care Pharmacology' },
  { id: 'bonus::neonate', parent: 'peds',  name: 'Neonatal Intensive Care' },
  { id: 'bonus::epi',     parent: 'ch',    name: 'Outbreak Epidemiology' }
];

// How many subtopics in a subject are 'mastered' — used for bonus reveal.
function masteredSubCount(subject) {
  if (!subject || !Array.isArray(subject.subs)) return 0;
  return subject.subs.reduce((n, s) => n + (s.state === 'mastered' ? 1 : 0), 0);
}

// Which bonus nodes are revealed for the current model (parent has >= N
// mastered subs). Pure; returns an array of {…bonusNode, parentNode}.
function revealedBonusNodes(model) {
  const subjectsById = {};
  (model && model.subjects || []).forEach(s => { subjectsById[s.id] = s; });
  return BONUS_NODES.filter(b => {
    const parent = subjectsById[b.parent];
    return parent && masteredSubCount(parent) >= BONUS_REVEAL_MASTERED;
  }).map(b => ({ ...b, parentSubject: subjectsById[b.parent] }));
}

const DEPENDENCIES = [
  // prerequisites
  { from: 'anat',  to: 'msn',   type: 'prerequisite' },   // anatomy & physiology underpins med-surg
  { from: 'anat',  to: 'pharm', type: 'prerequisite' },   // physiology before pharmacology
  { from: 'fund',  to: 'msn',   type: 'prerequisite' },   // fundamentals before med-surg
  { from: 'fund',  to: 'peds',  type: 'prerequisite' },
  { from: 'fund',  to: 'obg',   type: 'prerequisite' },
  { from: 'pharm', to: 'msn',   type: 'prerequisite' },   // drug knowledge supports med-surg mgmt
  { from: 'micro', to: 'ch',    type: 'prerequisite' },   // microbiology before community epidemiology
  { from: 'anat',  to: 'obg',   type: 'prerequisite' },
  // related (lateral)
  { from: 'msn',   to: 'pharm', type: 'related' },
  { from: 'peds',  to: 'obg',   type: 'related' },
  { from: 'ch',    to: 'nutr',  type: 'related' },
  { from: 'mhn',   to: 'fund',  type: 'related' },
  { from: 'micro', to: 'pharm', type: 'related' },        // antimicrobials link
  { from: 'nutr',  to: 'msn',   type: 'related' }
];

function subjectStruggling(subject) {
  return !!(subject && subject.attempted >= 5 && subject.accuracy < 0.5);
}
function mindmapLayout(model) {
  const cx = KMAP_VIEW / 2, cy = KMAP_VIEW / 2;
  const subjects = (model && model.subjects) || [];
  const N = subjects.length || 1;
  const nodes = [{ kind: 'root', id: '__root__', x: cx, y: cy, label: 'NORCET' }];
  const edges = [];
  const subjectPos = {};   // id -> {x,y,angle} (for Phase B dependency + bonus edges)

  subjects.forEach((subj, i) => {
    const ang = (-Math.PI / 2) + (i * 2 * Math.PI / N);     // start at top, clockwise
    const sx = cx + KMAP_R1 * Math.cos(ang);
    const sy = cy + KMAP_R1 * Math.sin(ang);
    subjectPos[subj.id] = { x: sx, y: sy, angle: ang };
    nodes.push({ kind: 'subject', id: subj.id, x: sx, y: sy, angle: ang, data: subj });
    edges.push({ kind: 'tree', from: '__root__', to: subj.id, d: _kmapEdgePath(cx, cy, sx, sy) });

    const subs = subj.subs || [];
    const M = subs.length;
    const wedge = (2 * Math.PI / N) * 0.80;                 // angular room for this subject's subs
    subs.forEach((sub, j) => {
      const frac = M <= 1 ? 0.5 : j / (M - 1);
      const a = ang + (frac - 0.5) * wedge;
      const r = KMAP_R2 + ((j % 3) * 34);                   // 3-step radial stagger -> fewer label clashes
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      const subId = `${subj.id}::${sub.sub}`;
      nodes.push({ kind: 'sub', id: subId, x, y, angle: a, parent: subj.id, color: subj.color, data: sub });
      edges.push({ kind: 'tree', from: subj.id, to: subId, d: _kmapEdgePath(sx, sy, x, y) });
    });
  });

  // Phase B — DEPENDENCY EDGES between subjects that are BOTH present in the
  // current model (a subject is dropped when it has no questions / is gk-off).
  // type 'prereq' (solid) pulses when the prerequisite SOURCE is struggling, to
  // suggest "strengthen this first". type 'related' (dotted) never pulses.
  const struggling = {};
  subjects.forEach(s => { struggling[s.id] = subjectStruggling(s); });
  DEPENDENCIES.forEach((dep, i) => {
    const a = subjectPos[dep.from], b = subjectPos[dep.to];
    if (!a || !b) return;                                   // skip if either subject absent
    const kind = dep.type === 'prerequisite' ? 'prereq' : 'related';
    edges.push({
      kind, id: `dep${i}`, from: dep.from, to: dep.to,
      d: _kmapEdgePath(a.x, a.y, b.x, b.y),
      pulse: kind === 'prereq' && struggling[dep.from]
    });
  });

  // Phase B — BONUS NODES: revealed when the parent subject has >= N mastered
  // subs. Placed just OUTSIDE the parent on the same radial angle.
  const bonus = revealedBonusNodes(model);
  bonus.forEach(b => {
    const p = subjectPos[b.parent];
    if (!p) return;
    const bx = cx + (KMAP_R2 + 120) * Math.cos(p.angle);
    const by = cy + (KMAP_R2 + 120) * Math.sin(p.angle);
    nodes.push({ kind: 'bonus', id: b.id, x: bx, y: by, angle: p.angle, parent: b.parent, data: b });
    edges.push({ kind: 'bonus', id: `be_${b.id}`, from: b.parent, to: b.id, d: _kmapEdgePath(p.x, p.y, bx, by) });
  });

  return { nodes, edges, cx, cy };
}

// ---- LOD helpers (label declutter) ----------------------------------------
// Screen-constant label sizing: the SVG scales text by `k · containerPx/VIEW`,
// so a fixed logical font balloons as you zoom (and on wide screens). This
// returns the logical font that renders as ~targetPx on screen, clamped so the
// default view keeps today's sizes (maxLogical) and text never vanishes
// (minLogical). Degenerate inputs fall back to maxLogical (today's look).
function kmapLabelFont(k, containerPx, targetPx, minLogical, maxLogical) {
  if (!(k > 0) || !(containerPx > 0) || !(targetPx > 0)) return maxLogical;
  const logical = (targetPx * KMAP_VIEW) / (k * containerPx);
  return Math.max(minLogical, Math.min(maxLogical, logical));
}

// Zoom level at which sub-topic labels appear AND label focus kicks in
// (== the pre-revamp label threshold, so labels appear at the same zoom).
const KMAP_FOCUS_K = 2.3;

// The "dominant" subject when zoomed in: the wedge whose angle is circularly
// nearest to the viewport centre's angle from the root. Only that wedge shows
// its sub-topic labels (everyone else stays dots) — the label-soup fix.
// `view` is the screen's {k,x,y} transform; returns null when zoomed out.
function kmapFocusSubjectId(subjectNodes, view, minK = KMAP_FOCUS_K) {
  if (!view || !(view.k >= minK) || !subjectNodes || !subjectNodes.length) return null;
  const c = KMAP_VIEW / 2;
  const cx = (c - view.x) / view.k, cy = (c - view.y) / view.k;  // logical point at screen centre
  const a = Math.atan2(cy - c, cx - c);
  let best = null, bd = Infinity;
  for (const n of subjectNodes) {
    let d = Math.abs(a - n.angle) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d < bd) { bd = d; best = n.id; }
  }
  return best;
}

const KMAP_STATE_LABEL = { locked: 'Locked', discovered: 'Discovered', familiar: 'Familiar', mastered: 'Mastered' };
const KMAP_BONUS_COLOR = '#E0A52E';   // amber/gold for "beyond syllabus" bonus nodes (Phase B)

// Shared mastery tally — counts sub-topics by state using the SAME aggregation
// + thresholds the map uses, so Home, the leaderboard, and the map all agree.
// `attemptStatsFn` is injected (lib/compact's attemptStats) to avoid a circular
// import; `nursingFilter(topicId)` lets callers honour the GK/Aptitude toggle.
function masteryTally(history, allQuestions, attemptStatsFn, nursingFilter) {
  const agg = {};   // `${topic}::${sub}` -> { attempted, correct }
  const byId = {};
  (allQuestions || []).forEach(q => { byId[q.id] = q; });
  Object.entries(history || {}).forEach(([qId, h]) => {
    const q = byId[qId];
    if (!q || !q.topic) return;
    if (nursingFilter && !nursingFilter(q.topic)) return;
    const s = attemptStatsFn(h);
    if (!s || s.total === 0) return;
    const key = `${q.topic}::${(q.sub && String(q.sub).trim()) || 'General'}`;
    if (!agg[key]) agg[key] = { attempted: 0, correct: 0 };
    agg[key].attempted += s.total;
    agg[key].correct += s.correct;
  });
  let mastered = 0, inProgress = 0, touched = 0;
  Object.values(agg).forEach(a => {
    touched += 1;
    const st = mindmapState(a.attempted, a.attempted > 0 ? a.correct / a.attempted : 0);
    if (st === 'mastered') mastered += 1;
    else if (st === 'discovered' || st === 'familiar') inProgress += 1;
  });
  return { mastered, inProgress, touched };
}

export {
  KMAP_STATES, KMAP_VIEW, KMAP_R1, KMAP_R2, KMAP_STATE_LABEL, KMAP_BONUS_COLOR,
  KMAP_FOCUS_K, kmapLabelFont, kmapFocusSubjectId,
  mindmapState, mindmapNextProgress, mindmapStateRank, masteryTally,
  _kmapEdgePath, _kmapHexPath, mindmapLayout, subjectStruggling, DEPENDENCIES,
  BONUS_NODES, BONUS_REVEAL_MASTERED, masteredSubCount, revealedBonusNodes,
};
