// Contract test for src/lib/kmap.js — runnable under Node:
//   node src/lib/kmap.test.js
// Locks the mastery-state thresholds and the radial layout invariants the
// Knowledge Map screen renders from, so a layout/LOD change can't silently
// move nodes or misgrade mastery.
import assert from 'node:assert/strict';

const {
  KMAP_VIEW, KMAP_R1, KMAP_R2, KMAP_FOCUS_K,
  mindmapState, mindmapNextProgress, mindmapLayout,
  subjectStruggling, masteredSubCount, revealedBonusNodes,
  kmapLabelFont, kmapFocusSubjectId,
} = await import('./kmap.js');

const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const C = KMAP_VIEW / 2;

// ---- mindmapState threshold boundaries ------------------------------------
{
  assert.equal(mindmapState(0, 0), 'locked');
  assert.equal(mindmapState(1, 0), 'discovered');
  assert.equal(mindmapState(9, 1), 'discovered', '9 attempts is not familiar even at 100%');
  assert.equal(mindmapState(10, 0.59), 'discovered', '60% accuracy required for familiar');
  assert.equal(mindmapState(10, 0.60), 'familiar');
  assert.equal(mindmapState(24, 1), 'familiar', '24 attempts is not mastered even at 100%');
  assert.equal(mindmapState(25, 0.79), 'familiar', '80% accuracy required for mastered');
  assert.equal(mindmapState(25, 0.80), 'mastered');
}

// ---- mindmapNextProgress mirrors the same thresholds ----------------------
{
  assert.deepEqual(
    { label: mindmapNextProgress('mastered', 30, 0.9).label, ratio: mindmapNextProgress('mastered', 30, 0.9).ratio },
    { label: 'Mastered', ratio: 1 });
  const fam = mindmapNextProgress('familiar', 20, 0.85);
  assert.equal(fam.label, 'Next: Mastered');
  assert.equal(fam.ratio, 20 / 25);
  const disc = mindmapNextProgress('discovered', 5, 0.5);
  assert.equal(disc.label, 'Next: Familiar');
  assert.equal(disc.ratio, 5 / 10);
  const locked = mindmapNextProgress('locked', 0, 0);
  assert.equal(locked.label, 'Next: Discovered');
  assert.equal(locked.ratio, 0);
}

// ---- layout invariants (synthetic 4-subject model) ------------------------
// Subject ids chosen so NO DEPENDENCIES pair is fully present → tree edges only.
const sub = (name, state = 'discovered') => ({ sub: name, state, attempted: 1, accuracy: 0.5 });
const model4 = {
  subjects: [
    { id: 'aaa', color: '#111111', attempted: 5, accuracy: 0.9, subs: [sub('One'), sub('Two'), sub('Three'), sub('Four'), sub('Five')] },
    { id: 'bbb', color: '#222222', attempted: 0, accuracy: 0, subs: [sub('Solo')] },
    { id: 'ccc', color: '#333333', attempted: 2, accuracy: 0.5, subs: [] },
    { id: 'ddd', color: '#444444', attempted: 9, accuracy: 0.2, subs: [sub('X'), sub('Y')] },
  ],
};
{
  const N = model4.subjects.length;
  const { nodes, edges, cx, cy } = mindmapLayout(model4);
  assert.equal(cx, C); assert.equal(cy, C);

  const root = nodes[0];
  assert.deepEqual({ kind: root.kind, x: root.x, y: root.y }, { kind: 'root', x: C, y: C });

  const subjects = nodes.filter(n => n.kind === 'subject');
  assert.equal(subjects.length, N);
  subjects.forEach((s, i) => {
    assert.ok(Math.abs(dist(C, C, s.x, s.y) - KMAP_R1) < 1e-6, `subject ${s.id} sits on ring 1`);
    const expected = (-Math.PI / 2) + (i * 2 * Math.PI / N);
    assert.ok(Math.abs(s.angle - expected) < 1e-9, `subject ${s.id} evenly spaced from top`);
  });
  // first subject exactly at the top
  assert.ok(Math.abs(subjects[0].x - C) < 1e-6 && Math.abs(subjects[0].y - (C - KMAP_R1)) < 1e-6);

  const subs = nodes.filter(n => n.kind === 'sub');
  assert.equal(subs.length, 5 + 1 + 0 + 2);
  const wedge = (2 * Math.PI / N) * 0.80;
  const byParent = {};
  subs.forEach(n => { (byParent[n.parent] = byParent[n.parent] || []).push(n); });
  // radius stagger: sub j sits at R2 + (j % 3) * 34 (3-step declutter stagger)
  for (const [pid, list] of Object.entries(byParent)) {
    const parent = subjects.find(s => s.id === pid);
    list.forEach((n, j) => {
      const r = dist(C, C, n.x, n.y);
      const expectedR = KMAP_R2 + ((j % 3) * 34);
      assert.ok(Math.abs(r - expectedR) < 1e-6, `${n.id} radius ${r} == ${expectedR}`);
      assert.ok(Math.abs(n.angle - parent.angle) <= wedge / 2 + 1e-9, `${n.id} stays inside its parent's wedge`);
      assert.equal(n.color, parent.data.color, 'sub inherits subject color');
    });
  }
  // single-sub subject centres in its wedge (same angle as parent)
  const solo = subs.find(n => n.parent === 'bbb');
  assert.ok(Math.abs(solo.angle - subjects[1].angle) < 1e-9);

  // tree edges: one per subject + one per sub; no dependency/bonus edges here
  const tree = edges.filter(e => e.kind === 'tree');
  assert.equal(tree.length, N + subs.length);
  assert.equal(edges.filter(e => e.kind === 'prereq' || e.kind === 'related').length, 0,
    'no dependency edge when no DEPENDENCIES pair is present');
  assert.equal(edges.filter(e => e.kind === 'bonus').length, 0);
  // every edge carries a usable SVG path
  edges.forEach(e => assert.match(e.d, /^M [\d.-]+ [\d.-]+ Q /));
}

// ---- dependency edges + struggling pulse ----------------------------------
{
  const mk = (id, attempted, accuracy) => ({ id, attempted, accuracy, subs: [] });
  // anat -> msn is a prerequisite in DEPENDENCIES; msn -> pharm is 'related'
  const strong = mindmapLayout({ subjects: [mk('anat', 20, 0.9), mk('msn', 3, 0.4)] });
  const prereq = strong.edges.find(e => e.kind === 'prereq');
  assert.ok(prereq && prereq.from === 'anat' && prereq.to === 'msn');
  assert.equal(prereq.pulse, false, 'no pulse when the prerequisite source is fine');

  const weak = mindmapLayout({ subjects: [mk('anat', 6, 0.4), mk('msn', 3, 0.4)] });
  assert.equal(weak.edges.find(e => e.kind === 'prereq').pulse, true,
    'prereq pulses when its source is struggling (>=5 attempts, <50%)');
  assert.equal(subjectStruggling({ attempted: 6, accuracy: 0.4 }), true);
  assert.equal(subjectStruggling({ attempted: 4, accuracy: 0.1 }), false, 'needs 5+ attempts to count');

  // a related pair present -> dotted edge, never pulses
  const rel = mindmapLayout({ subjects: [mk('msn', 6, 0.1), mk('pharm', 0, 0)] });
  const relEdge = rel.edges.find(e => e.kind === 'related');
  assert.ok(relEdge, 'related edge present when both endpoints exist');
  assert.ok(!relEdge.pulse);
}

// ---- bonus reveal + placement ---------------------------------------------
{
  const mastered = { sub: 'M', state: 'mastered' };
  const msn1 = { id: 'msn', attempted: 30, accuracy: 0.9, subs: [mastered, sub('open')] };
  assert.equal(masteredSubCount(msn1), 1);
  assert.equal(revealedBonusNodes({ subjects: [msn1] }).length, 0, 'one mastered sub is not enough');

  const msn2 = { ...msn1, subs: [mastered, { sub: 'M2', state: 'mastered' }] };
  const revealed = revealedBonusNodes({ subjects: [msn2] });
  assert.deepEqual(revealed.map(b => b.id).sort(), ['bonus::crit', 'bonus::ecg'],
    'msn unlocks both of its bonus nodes at 2 mastered subs');

  const { nodes } = mindmapLayout({ subjects: [msn2] });
  const bonus = nodes.filter(n => n.kind === 'bonus');
  assert.equal(bonus.length, 2);
  bonus.forEach(b => {
    assert.ok(Math.abs(dist(C, C, b.x, b.y) - (KMAP_R2 + 120)) < 1e-6, 'bonus sits just outside ring 2');
    const parent = nodes.find(n => n.id === 'msn');
    assert.ok(Math.abs(b.angle - parent.angle) < 1e-9, 'bonus rides the parent angle');
  });
}

// ---- kmapLabelFont: screen-constant labels, clamped ------------------------
{
  // degenerate inputs -> today's default (maxLogical)
  assert.equal(kmapLabelFont(0, 800, 11, 3, 9.5), 9.5);
  assert.equal(kmapLabelFont(2, 0, 11, 3, 9.5), 9.5);
  // exact mid-range value: logical = target*VIEW/(k*container)
  assert.ok(Math.abs(kmapLabelFont(3, 800, 11, 1, 20) - (11 * KMAP_VIEW) / (3 * 800)) < 1e-9);
  // non-increasing in k, and clamped at both ends
  const a = kmapLabelFont(1, 448, 11, 3.2, 9.5);
  const b = kmapLabelFont(2.3, 448, 11, 3.2, 9.5);
  const c = kmapLabelFont(6, 448, 11, 3.2, 9.5);
  assert.ok(a >= b && b >= c);
  assert.equal(a, 9.5, 'phone default view clamps to today’s size');
  assert.equal(kmapLabelFont(20, 2000, 11, 3.2, 9.5), 3.2, 'deep zoom clamps at the floor');
}

// ---- kmapFocusSubjectId: dominant wedge under the viewport centre ----------
{
  const N = 4;
  const subjectNodes = Array.from({ length: N }, (_, i) => {
    const angle = (-Math.PI / 2) + (i * 2 * Math.PI / N);
    return { id: 's' + i, angle,
             x: C + KMAP_R1 * Math.cos(angle), y: C + KMAP_R1 * Math.sin(angle) };
  });
  // zoomed out -> no focus
  assert.equal(kmapFocusSubjectId(subjectNodes, { k: 1, x: 0, y: 0 }), null);
  assert.equal(kmapFocusSubjectId([], { k: 3, x: 0, y: 0 }), null);
  // a view centred exactly on subject i (focusNode math: x = C - sx*k) picks it
  for (const n of subjectNodes) {
    const k = KMAP_FOCUS_K + 0.5;
    const v = { k, x: C - n.x * k, y: C - n.y * k };
    assert.equal(kmapFocusSubjectId(subjectNodes, v), n.id, `centred view picks ${n.id}`);
  }
  // wrap-around: a point just past angle pi (i.e. atan2 flips to ~-pi) still
  // picks the subject sitting at +pi (s3 here at angle pi for N=4... s3 = pi).
  const s3 = subjectNodes[3]; // angle = pi (pointing left)
  const k = 3;
  const px = C + (KMAP_R1 + 5) * Math.cos(Math.PI + 0.05);
  const py = C + (KMAP_R1 + 5) * Math.sin(Math.PI + 0.05); // just past pi -> atan2 ~ -pi+0.05
  const v = { k, x: C - px * k, y: C - py * k };
  assert.equal(kmapFocusSubjectId(subjectNodes, v), s3.id, 'circular distance handles the pi wrap');
}

console.log('kmap.test.js OK');
