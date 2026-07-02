// Contract test for src/lib/caliper-engine.js — runnable under Node:
//   node src/lib/caliper-engine.test.js
// PART 1 uses INLINE specs (self-contained, always runs).
// PART 2 lints the real data file IF it exists yet (authored in parallel).
import assert from 'node:assert/strict';
import {
  PX_PER_BOX, SEC_PER_BOX, HEIGHT_UNITS, BASELINE_Y,
  unitsToSec, secToUnits, rateFromRR,
  buildCalibratedStrip, measureTruth, truthSpan,
  validateMeasurement, clampCaliper, validateTask,
} from './caliper-engine.js';

// small helper: floats derived through *200 should be exact for our tenths/
// hundredths inputs, but guard with a tight epsilon where a comparison is math.
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// A well-formed task builder we can dent for the negative cases.
function makePrTask() {
  return {
    id: 'pr-basic', ask: 'pr', title: 'Measure the PR interval',
    question: 'Place the calipers from the start of the P wave to the start of the QRS.',
    strip: { rrSec: 0.8, prSec: 0.16, qrsSec: 0.08, qtSec: 0.40 },
    tolSec: 0.04, windowSec: 3.0, beatIndex: 1,
    verdict: { normal: [0.12, 0.20], label: 'Normal PR 0.12–0.20 s' },
    rationale: 'PR is atrial depolarisation + AV nodal delay.',
    examTip: 'One big box (0.20 s) is the upper limit of normal PR.',
  };
}

// =====================================================================
// PART 1 — engine behaviour against inline specs
// =====================================================================

// ---- Calibration constants + conversions ----
{
  assert.equal(PX_PER_BOX, 8);
  assert.equal(SEC_PER_BOX, 0.04);
  assert.equal(HEIGHT_UNITS, 160);
  assert.equal(BASELINE_Y, 100);
  assert.equal(secToUnits(0.04), 8, '1 small box = 8 units');
  assert.equal(unitsToSec(200), 1, '200 units = 1 second');
  assert.equal(secToUnits(1), 200);
  assert.equal(rateFromRR(0.8), 75, '60/0.8 = 75 bpm');
  assert.equal(rateFromRR(0.32), 188, '60/0.32 ≈ 187.5 → 188 bpm');
  // round-trip
  assert.ok(near(unitsToSec(secToUnits(0.16)), 0.16));
}

// ---- buildCalibratedStrip: exact onset/offset geometry ----
{
  const spec = { rrSec: 0.8, prSec: 0.16, qrsSec: 0.08, qtSec: 0.40 };
  const { pathD, widthUnits, features } = buildCalibratedStrip(spec, 3.0);

  assert.equal(widthUnits, 3.0 * 200, 'widthUnits = windowSec * 200');
  assert.equal(typeof pathD, 'string');
  assert.ok(pathD.length > 0 && pathD.startsWith('M'), "pathD is a non-empty 'M..' string");

  const f1 = features[1];
  // PR width: qrsOnset - pOnset === secToUnits(0.16) EXACTLY.
  assert.equal(f1.qrsOnset - f1.pOnset, secToUnits(0.16), 'PR span exact');
  // QRS width: qrsOffset - qrsOnset === secToUnits(0.08) EXACTLY.
  assert.equal(f1.qrsOffset - f1.qrsOnset, secToUnits(0.08), 'QRS span exact');
  // R-R: rPeak(2) - rPeak(1) === secToUnits(0.8) EXACTLY.
  assert.ok(near(features[2].rPeak - features[1].rPeak, secToUnits(0.8)), 'R-R span exact');
  // QT: tEnd - qrsOnset === secToUnits(0.40) (QT anchored at QRS onset).
  assert.ok(near(f1.tEnd - f1.qrsOnset, secToUnits(0.40)), 'QT span exact');
}

// ---- buildCalibratedStrip: no PR & no prSeq -> no P waves (SVT-ish) ----
{
  const { features } = buildCalibratedStrip({ rrSec: 0.32, qrsSec: 0.08 }, 2.0);
  assert.ok(features.length >= 2);
  for (const fb of features) {
    assert.equal(fb.pOnset, null, 'no P onset when neither prSec nor prSeq given');
    assert.equal(fb.pEnd, null);
    assert.ok(Number.isFinite(fb.qrsOnset), 'QRS still drawn');
  }
}

// ---- prSeq / Wenckebach: progressive PR + a dropped beat ----
{
  const prSeq = [0.20, 0.28, 0.36, null];
  const task = {
    id: 'wenck', ask: 'pr', title: 'Longest PR before the drop',
    question: 'Measure the longest PR in this Wenckebach cycle.',
    strip: { rrSec: 1.0, prSeq, qrsSec: 0.10 },
    tolSec: 0.04, windowSec: 5.0,
    verdict: { normal: [0.12, 0.20], label: 'PR' },
    rationale: 'Mobitz I: PR lengthens until a beat drops.',
    examTip: 'The dropped beat resets the cycle.',
  };
  const { features } = buildCalibratedStrip(task.strip, task.windowSec);

  // Beat 3 (0-based) is the null → P drawn, but NO QRS features.
  assert.ok(Number.isFinite(features[3].pOnset), 'dropped beat still has a P wave');
  assert.equal(features[3].qrsOnset, null, 'dropped beat has NULL qrsOnset');
  assert.equal(features[3].rPeak, null);
  assert.equal(features[3].qrsOffset, null);
  assert.equal(features[3].tEnd, null);

  // Truth = MAX non-null PR = 0.36.
  assert.equal(measureTruth(task), 0.36, 'Wenckebach truth is the longest PR');

  // truthSpan picks the 0.36 beat (index 2) and its span width matches 0.36.
  const span = truthSpan(task, features);
  assert.ok(near(span.x2 - span.x1, secToUnits(0.36)), 'truthSpan targets the longest-PR beat');
  assert.equal(span.x1, features[2].pOnset);
  assert.equal(span.x2, features[2].qrsOnset);
}

// ---- measureTruth per ask ----
{
  const strip = { rrSec: 0.8, prSec: 0.16, qrsSec: 0.10, qtSec: 0.40 };
  assert.equal(measureTruth({ ask: 'pr', strip }), 0.16);
  assert.equal(measureTruth({ ask: 'qrs', strip }), 0.10);
  assert.equal(measureTruth({ ask: 'rr', strip }), 0.8);
  assert.equal(measureTruth({ ask: 'qt', strip }), 0.40);
}

// ---- truthSpan: pr/qrs/qt/rr spans equal secToUnits(truth) ----
{
  // pr
  const prT = makePrTask();
  let strip = buildCalibratedStrip(prT.strip, prT.windowSec);
  let span = truthSpan(prT, strip.features);
  assert.ok(near(span.x2 - span.x1, secToUnits(measureTruth(prT))), 'pr span width == truth');

  // qrs
  const qrsT = { ...makePrTask(), ask: 'qrs' };
  span = truthSpan(qrsT, strip.features);
  assert.ok(near(span.x2 - span.x1, secToUnits(measureTruth(qrsT))), 'qrs span width == truth');

  // qt
  const qtT = { ...makePrTask(), ask: 'qt' };
  span = truthSpan(qtT, strip.features);
  assert.ok(near(span.x2 - span.x1, secToUnits(measureTruth(qtT))), 'qt span width == truth');

  // rr — R peak of beat 1 to beat 2.
  const rrT = { ...makePrTask(), ask: 'rr' };
  span = truthSpan(rrT, strip.features);
  assert.ok(near(span.x2 - span.x1, secToUnits(measureTruth(rrT))), 'rr span width == truth');
  assert.equal(span.x1, strip.features[1].rPeak);
  assert.equal(span.x2, strip.features[2].rPeak);
}

// ---- validateMeasurement: exact / +tol edge inclusive / beyond ----
{
  // exact
  let r = validateMeasurement(0.16, 0.16, 0.04);
  assert.deepEqual(r, { ok: true, errorSec: 0, direction: 'exact' });

  // +tol edge INCLUSIVE (measured = target + tol)
  r = validateMeasurement(0.20, 0.16, 0.04);
  assert.equal(r.ok, true, '+tol edge is inclusive');
  assert.equal(r.errorSec, 0.04);
  assert.equal(r.direction, 'long');

  // -tol edge INCLUSIVE
  r = validateMeasurement(0.12, 0.16, 0.04);
  assert.equal(r.ok, true, '-tol edge is inclusive');
  assert.equal(r.errorSec, -0.04);
  assert.equal(r.direction, 'short');

  // beyond +tol → fail, long, signed error
  r = validateMeasurement(0.24, 0.16, 0.04);
  assert.equal(r.ok, false);
  assert.equal(r.direction, 'long');
  assert.equal(r.errorSec, 0.08);

  // beyond -tol → fail, short, signed error
  r = validateMeasurement(0.08, 0.16, 0.04);
  assert.equal(r.ok, false);
  assert.equal(r.direction, 'short');
  assert.equal(r.errorSec, -0.08);

  // errorSec rounded to 3 dp
  r = validateMeasurement(0.1634, 0.16, 0.04);
  assert.equal(r.errorSec, 0.003);
}

// ---- clampCaliper: bounds + 4-unit gap on both sides ----
{
  // in-bounds, respecting the gap → unchanged
  assert.equal(clampCaliper(50, 100, 0, 600, 'left'), 50);
  assert.equal(clampCaliper(200, 100, 0, 600, 'right'), 200);

  // lower bound clamp
  assert.equal(clampCaliper(-30, 400, 0, 600, 'left'), 0);
  // upper bound clamp
  assert.equal(clampCaliper(900, 100, 0, 600, 'right'), 600);

  // left caliper can't cross/stack: must stay <= otherX - 4.
  assert.equal(clampCaliper(120, 100, 0, 600, 'left'), 96, 'left held 4u left of other');
  // right caliper can't cross/stack: must stay >= otherX + 4.
  assert.equal(clampCaliper(80, 100, 0, 600, 'right'), 104, 'right held 4u right of other');

  // gap constraint never pushes out of [minX, maxX]:
  // left with other near minX still clamps to minX floor.
  assert.equal(clampCaliper(100, 2, 0, 600, 'left'), 0);
}

// ---- validateTask: accepts a good task of each ask ----
{
  assert.equal(validateTask(makePrTask()), null, 'good pr task');
  assert.equal(validateTask({ ...makePrTask(), id: 'qrs-ok', ask: 'qrs' }), null, 'good qrs task');
  assert.equal(validateTask({ ...makePrTask(), id: 'qt-ok', ask: 'qt' }), null, 'good qt task');
  assert.equal(validateTask({ ...makePrTask(), id: 'rr-ok', ask: 'rr' }), null, 'good rr task');

  // rr needs only rrSec — a stripped-down rr task validates.
  const rrMin = {
    id: 'rr-min', ask: 'rr', title: 'R-R', question: 'Measure R to R.',
    strip: { rrSec: 0.8 }, tolSec: 0.04, windowSec: 2.0,
    verdict: { normal: [0.6, 1.0], label: 'RR' },
    rationale: 'r', examTip: 't',
  };
  assert.equal(validateTask(rrMin), null, 'rr needs only rrSec');

  // Wenckebach pr task validates.
  const wenck = {
    id: 'w', ask: 'pr', title: 'w', question: 'q',
    strip: { rrSec: 1.0, prSeq: [0.2, 0.28, 0.36, null] },
    tolSec: 0.04, windowSec: 5.0,
    verdict: { normal: [0.12, 0.20], label: 'PR' }, rationale: 'r', examTip: 't',
  };
  assert.equal(validateTask(wenck), null, 'good wenckebach pr task');
}

// ---- validateTask: catches the classic authoring mistakes ----
{
  // ask/field mismatch: qt task with no qtSec
  const a = makePrTask(); a.id = 'qt-bad'; a.ask = 'qt'; delete a.strip.qtSec;
  assert.ok(/qtSec/i.test(validateTask(a)), 'qt task without qtSec is rejected');

  // ask/field mismatch: qrs task with no qrsSec
  const b = makePrTask(); b.id = 'qrs-bad'; b.ask = 'qrs'; delete b.strip.qrsSec;
  assert.ok(/qrsSec/i.test(validateTask(b)), 'qrs task without qrsSec is rejected');

  // ask/field mismatch: pr task with neither prSec nor prSeq
  const c = makePrTask(); c.id = 'pr-bad'; delete c.strip.prSec;
  assert.ok(/prSec|prSeq/i.test(validateTask(c)), 'pr task without prSec/prSeq is rejected');

  // unknown ask
  const d = makePrTask(); d.ask = 'st';
  assert.ok(/ask/i.test(validateTask(d)));

  // bad rrSec
  const e = makePrTask(); e.strip.rrSec = 0;
  assert.ok(/rrSec/i.test(validateTask(e)));

  // bad verdict range (lo >= hi)
  const g = makePrTask(); g.verdict = { normal: [0.20, 0.12], label: 'oops' };
  assert.ok(/normal/i.test(validateTask(g)), 'inverted verdict range rejected');

  // bad verdict label
  const h = makePrTask(); h.verdict = { normal: [0.12, 0.20], label: '   ' };
  assert.ok(/label/i.test(validateTask(h)));

  // tolSec <= 0
  const j = makePrTask(); j.tolSec = 0;
  assert.ok(/tolSec/i.test(validateTask(j)));

  // windowSec too small
  const k = makePrTask(); k.windowSec = 1.0;
  assert.ok(/windowSec/i.test(validateTask(k)));

  // empty prSeq numbers (all null)
  const l = makePrTask(); l.id = 'seq-bad'; delete l.strip.prSec; l.strip.prSeq = [null, null];
  assert.ok(/prSeq/i.test(validateTask(l)), 'prSeq with no numeric value rejected');

  // prSeq present but not an array
  const m = makePrTask(); m.strip.prSeq = 'nope';
  assert.ok(/prSeq/i.test(validateTask(m)));

  // missing teaching text
  const n = makePrTask(); n.rationale = '';
  assert.ok(/rationale/i.test(validateTask(n)));

  // the id is included in the message when present
  const p = makePrTask(); p.id = 'named'; p.tolSec = -1;
  assert.ok(validateTask(p).startsWith('[named]'), 'error names the task id');
}

console.log('caliper-engine.test.js PART 1: all assertions passed');

// =====================================================================
// PART 2 — data-file lint (authored in parallel; deferred if absent)
// =====================================================================
async function part2() {
  let mod;
  try {
    mod = await import('../data/caliper-tasks.js');
  } catch {
    console.log('caliper-tasks.js not present yet — data lint deferred');
    return;
  }

  // Collect every exported task (support a default array, a named array, or
  // individually-exported task objects).
  const tasks = [];
  const seen = new Set(); // named + default exports may be the SAME array — dedupe by identity
  const pushIfTask = (v) => {
    if (v && typeof v === 'object' && typeof v.ask === 'string' && v.strip && !seen.has(v)) {
      seen.add(v); tasks.push(v);
    }
  };
  for (const val of Object.values(mod)) {
    if (Array.isArray(val)) val.forEach(pushIfTask);
    else pushIfTask(val);
  }
  assert.ok(tasks.length > 0, 'caliper-tasks.js exports at least one task');

  // Every task validates.
  for (const t of tasks) {
    const err = validateTask(t);
    assert.equal(err, null, `task failed validation: ${err}`);
  }

  // Task ids must be unique across the whole merged list.
  const ids = tasks.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length,
    `duplicate task ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);

  console.log(`caliper-engine.test.js PART 2: linted ${tasks.length} task(s), all valid`);
}

await part2();
console.log('caliper-engine.test.js: all assertions passed');
