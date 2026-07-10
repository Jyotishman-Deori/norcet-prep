// Contract test for src/lib/whatif.js — runnable under Node:
//   node src/lib/whatif.test.js
import assert from 'node:assert/strict';

const { NEG, bandFor, whatIfScore, estimatePercentile } = await import('./whatif.js');

// ---- bandFor: thresholds at 45 / 65 (matches the shipped v1 card) ----
{
  assert.equal(bandFor(65).label, 'SAFE');
  assert.equal(bandFor(64.9).label, 'BORDERLINE');
  assert.equal(bandFor(45).label, 'BORDERLINE');
  assert.equal(bandFor(44.9).label, 'RISKY');
  assert.equal(bandFor(0).label, 'RISKY');
}

// ---- v1 equivalence: attempted at its actual value = the old single slider ----
{
  // 100 Qs: 60 correct, 15 wrong, 25 blank. netScore = 60 - 5 = 55.
  const base = { correct: 60, wrong: 15, blank: 25, count: 100 };
  const r0 = whatIfScore({ ...base, doubtfulSkipped: 0 });
  assert.ok(Math.abs(r0.adjustedNet - 55) < 1e-9);
  assert.ok(Math.abs(r0.penaltyLeft - 5) < 1e-9);
  assert.equal(r0.marksSaved, 0);

  const r5 = whatIfScore({ ...base, doubtfulSkipped: 5 });
  assert.ok(Math.abs(r5.adjustedNet - (55 + 5 * NEG)) < 1e-9);
  assert.ok(Math.abs(r5.marksSaved - 5 * NEG) < 1e-9);
  assert.ok(Math.abs(r5.penaltyLeft - 10 * NEG) < 1e-9);

  // Skipping every wrong answer removes the whole penalty.
  const rAll = whatIfScore({ ...base, doubtfulSkipped: 15 });
  assert.ok(Math.abs(rAll.adjustedNet - 60) < 1e-9);
  assert.equal(rAll.penaltyLeft, 0);
}

// ---- attempting fewer: sheds from the wrong pile first ----
{
  const base = { correct: 60, wrong: 15, blank: 25, count: 100 };
  // Actual attempted = 75. Planning 65 removes 10 wrongs -> 5 wrong left.
  const r = whatIfScore({ ...base, attempted: 65 });
  assert.equal(r.wrongEff, 5);
  assert.equal(r.correctEff, 60);
  assert.ok(Math.abs(r.adjustedNet - (60 - 5 * NEG)) < 1e-9);
  // Cannot plan below your correct count (clamped).
  const rFloor = whatIfScore({ ...base, attempted: 10 });
  assert.equal(rFloor.wrongEff, 0);
  assert.equal(rFloor.correctEff, 60);
}

// ---- attempting more: blind guesses net ~zero marks ----
{
  const base = { correct: 60, wrong: 15, blank: 25, count: 100 };
  const actual = whatIfScore({ ...base });
  const more = whatIfScore({ ...base, attempted: 95 }); // +20 blind guesses
  assert.ok(Math.abs(more.adjustedNet - actual.adjustedNet) < 1e-9,
    'expected value of blind guessing is zero net marks');
  assert.ok(more.penaltyLeft > actual.penaltyLeft, 'but the penalty exposure grows');
  assert.equal(more.correctEff, 60 + 20 * 0.25);
  assert.equal(more.wrongEff, 15 + 20 * 0.75);
}

// ---- doubtfulSkipped clamps to the effective wrong pile; never negative ----
{
  const r = whatIfScore({ correct: 10, wrong: 3, blank: 0, count: 13, doubtfulSkipped: 99 });
  assert.equal(r.skipped, 3);
  assert.equal(r.penaltyLeft, 0);
  const rNeg = whatIfScore({ correct: 10, wrong: 3, blank: 0, count: 13, doubtfulSkipped: -4 });
  assert.equal(rNeg.skipped, 0);
}

// ---- zero/empty input never NaNs ----
{
  const r = whatIfScore({});
  assert.equal(r.adjustedNet, 0);
  assert.equal(r.pct, 0);
  assert.equal(r.band.label, 'RISKY');
  const r0 = whatIfScore({ correct: 0, wrong: 0, blank: 0, count: 0 });
  assert.ok(!Number.isNaN(r0.pct));
}

// ---- estimatePercentile: coarse bands, honest null at the bottom ----
{
  assert.match(estimatePercentile(70).value, /97th/);
  assert.match(estimatePercentile(55).value, /90th to 96th/);
  assert.match(estimatePercentile(46).value, /85th to 90th/);
  assert.match(estimatePercentile(40).value, /70th to 85th/);
  assert.equal(estimatePercentile(20).value, null);
  assert.equal(estimatePercentile(NaN).value, null);
  assert.match(estimatePercentile(70).basis, /[Nn]ot a rank prediction/);
}

console.log('whatif.test.js: all passed');
