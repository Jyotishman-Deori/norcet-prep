// Contract test for src/lib/calc-units.js — runnable under Node:
//   node src/lib/calc-units.test.js
// Pure module (no I/O, no DOM), so no storage/build stubs are needed.
import assert from 'node:assert/strict';
import {
  KG_PER_LB, CM_PER_INCH, kgToLb, lbToKg, cmToIn, inToCm, cToF, fToC,
  roundTo, ok, err, num, nums, pick, bandsFor,
  weightConvert, heightConvert, tempConvert, timeConvert,
} from './calc-units.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ---- exact factors --------------------------------------------------------
assert.equal(KG_PER_LB, 0.45359237, '1 lb is defined as exactly 0.45359237 kg');
assert.equal(CM_PER_INCH, 2.54, '1 inch is defined as exactly 2.54 cm');
assert.ok(near(lbToKg(1), 0.45359237));
assert.ok(near(kgToLb(0.45359237), 1));
assert.ok(near(inToCm(1), 2.54));
assert.ok(near(cmToIn(2.54), 1));
// round trip must not drift
assert.ok(near(lbToKg(kgToLb(70)), 70));
assert.ok(near(inToCm(cmToIn(170)), 170));

// ---- temperature anchors --------------------------------------------------
assert.equal(cToF(0), 32);
assert.equal(cToF(100), 212);
assert.equal(cToF(37), 98.6);
assert.equal(fToC(32), 0);
assert.equal(fToC(212), 100);
assert.ok(near(fToC(98.6), 37, 1e-9));
assert.equal(cToF(-40), -40, 'the one place the two scales meet');

// ---- roundTo --------------------------------------------------------------
assert.equal(roundTo(93.33333, 1), 93.3);
assert.equal(roundTo(31.25, 0), 31, 'half-up on .25 at 0dp is still 31');
assert.equal(roundTo(2.5, 0), 3, 'half up');
assert.equal(roundTo(1.005, 2), 1.01, 'binary float nudge, not 1.00');
assert.equal(roundTo(-2.5, 0), -2, 'half up, toward positive');

// ---- the envelope ---------------------------------------------------------
{
  const r = ok(93.33333333, { unit: 'mmHg', decimals: 1, formula: 'F', standard: 'S' });
  assert.equal(r.ok, true);
  assert.equal(r.value, 93.33333333, 'raw value is NEVER lost');
  assert.equal(r.display, '93.3');
  assert.equal(r.unit, 'mmHg');
  assert.equal(r.rounding, 'Rounded to 1 decimal place.', 'the rounding rule is always stated');
  assert.equal(r.formula, 'F');
  assert.equal(r.standard, 'S');
  assert.ok(Array.isArray(r.bands) && Array.isArray(r.steps) && Array.isArray(r.warnings));

  // an exact value says so rather than implying a loss of precision
  assert.equal(ok(12, { decimals: 0 }).rounding, 'Exact value, no rounding applied.');
  assert.equal(ok(1.5, { decimals: 2 }).rounding, 'Exact value, no rounding applied.');
  assert.equal(ok(1.239, { decimals: 2 }).rounding, 'Rounded to 2 decimal places.');

  const e = err('Weight must be greater than 0 kg.');
  assert.equal(e.ok, false);
  assert.equal(e.error, 'Weight must be greater than 0 kg.');
  assert.equal(e.value, undefined, 'a failure NEVER carries a number');
}

// ---- num() validation: bad input must never become a number ---------------
{
  assert.equal(num(5, { label: 'W' }).ok, true);
  assert.equal(num('5.5', { label: 'W' }).v, 5.5, 'strings from inputs are coerced');
  assert.equal(num('', { label: 'Weight' }).error, 'Weight is required.');
  assert.equal(num(null, { label: 'Weight' }).error, 'Weight is required.');
  assert.equal(num(undefined, { label: 'Weight' }).error, 'Weight is required.');
  assert.equal(num('abc', { label: 'Weight' }).error, 'Weight must be a number.');
  assert.equal(num(NaN, { label: 'Weight' }).error, 'Weight must be a number.');
  assert.equal(num(Infinity, { label: 'Weight' }).error, 'Weight must be a number.');
  assert.equal(num(0, { label: 'Weight', unit: 'kg', gt0: true }).error, 'Weight must be greater than 0 kg.');
  assert.equal(num(-5, { label: 'Weight', unit: 'kg', gt0: true }).error, 'Weight must be greater than 0 kg.');
  assert.equal(num(1.5, { label: 'Doses', integer: true }).error, 'Doses must be a whole number.');
  assert.equal(num(2, { label: 'Age', unit: 'years', min: 5 }).error, 'Age must be at least 5 years.');
  assert.equal(num(99, { label: 'Age', unit: 'years', max: 50 }).error, 'Age must be 50 years or less.');
}

// ---- nums(): first failing field wins, in declared order ------------------
{
  const r = nums({ a: 1, b: -1 }, {
    a: { label: 'A', gt0: true },
    b: { label: 'B', unit: 'kg', gt0: true },
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'B must be greater than 0 kg.');
  const good = nums({ a: 2, b: 3 }, { a: { label: 'A' }, b: { label: 'B' } });
  assert.deepEqual(good.v, { a: 2, b: 3 });
}

// ---- pick() ---------------------------------------------------------------
assert.equal(pick('male', ['male', 'female'], 'Sex').v, 'male');
assert.equal(pick('other', ['male', 'female'], 'Sex').ok, false);
assert.equal(pick(undefined, ['a'], 'X').ok, false);

// ---- bandsFor(): EXCLUSIVE upper bound, so float cutoffs land correctly ----
{
  const defs = [
    { label: 'under', below: 18.5 },
    { label: 'normal', below: 23 },
    { label: 'over' },
  ];
  const matched = (v) => bandsFor(v, defs, 'src').find((b) => b.match).label;
  assert.equal(matched(18.4), 'under');
  assert.equal(matched(18.5), 'normal', '18.5 belongs to the band that STARTS at 18.5');
  assert.equal(matched(22.9), 'normal');
  assert.equal(matched(23), 'over', '23.0 belongs to the band that starts at 23');
  // exactly one band ever matches, and the source/flag travel with it
  const all = bandsFor(20, defs, 'WHO', true, 'G');
  assert.equal(all.filter((b) => b.match).length, 1);
  assert.equal(all[0].source, 'WHO');
  assert.equal(all[0].flagged, true);
  assert.equal(all[0].group, 'G');
}

// =====================================================================
// 12. WEIGHT CONVERSION
// =====================================================================
{
  const r = weightConvert({ value: 70, from: 'kg' });
  assert.equal(r.ok, true);
  assert.ok(near(r.value, 154.323583529, 1e-6), '70 kg is about 154.32 lb');
  assert.equal(r.display, '154.32');
  assert.equal(r.unit, 'lb');

  const back = weightConvert({ value: 154.323583529, from: 'lb' });
  assert.ok(near(back.value, 70, 1e-6), 'round trip returns to 70 kg');
  assert.equal(weightConvert({ value: 1, from: 'lb' }).value, 0.45359237);

  assert.equal(weightConvert({ value: 0, from: 'kg' }).ok, false, 'zero weight is rejected');
  assert.equal(weightConvert({ value: -5, from: 'kg' }).ok, false, 'negative weight is rejected');
  assert.equal(weightConvert({ value: 70, from: 'stone' }).ok, false, 'unknown unit is rejected');
}

// =====================================================================
// 13. HEIGHT CONVERSION (+ feet and inches breakdown)
// =====================================================================
{
  const r = heightConvert({ value: 170, from: 'cm' });
  assert.equal(r.ok, true);
  assert.ok(near(r.value, 66.9291338583, 1e-6));
  const ft = r.extras.find((e) => e.label === 'Feet and inches');
  assert.equal(ft.value, '5 ft 7 in', '170 cm is 5 ft 7 in to the nearest inch');

  // 152.4 cm is exactly 60 inches, i.e. exactly 5 ft 0 in
  const r2 = heightConvert({ value: 152.4, from: 'cm' });
  assert.ok(near(r2.value, 60, 1e-9));
  assert.equal(r2.extras.find((e) => e.label === 'Feet and inches').value, '5 ft 0 in');

  const r3 = heightConvert({ value: 60, from: 'in' });
  assert.ok(near(r3.value, 152.4, 1e-9));
  assert.equal(heightConvert({ value: 0, from: 'cm' }).ok, false);
}

// =====================================================================
// 14. TEMPERATURE CONVERSION
// =====================================================================
{
  const r = tempConvert({ value: 37, from: 'c' });
  assert.equal(r.ok, true);
  assert.equal(r.display, '98.6');
  assert.equal(r.unit, 'F');
  assert.equal(tempConvert({ value: 98.6, from: 'f' }).display, '37.0');
  assert.equal(tempConvert({ value: 0, from: 'c' }).display, '32.0', 'zero is a VALID temperature, not an error');
  assert.equal(tempConvert({ value: -40, from: 'c' }).display, '-40.0');
  assert.equal(tempConvert({ value: 'abc', from: 'c' }).ok, false);
  assert.equal(tempConvert({ value: 500, from: 'c' }).ok, false, 'implausible temperature is rejected');
  // no fever band is shipped until the threshold is source-confirmed
  assert.equal(tempConvert({ value: 39, from: 'c' }).bands.length, 0);
}

// =====================================================================
// 15. TIME CONVERSION (24 hour is the primary format)
// =====================================================================
{
  assert.equal(timeConvert({ from: '24', time: '13:45' }).display, '1:45 PM');
  assert.equal(timeConvert({ from: '24', time: '00:30' }).display, '12:30 AM', 'midnight hour is 12 AM');
  assert.equal(timeConvert({ from: '24', time: '12:00' }).display, '12:00 PM', 'noon is 12 PM');
  assert.equal(timeConvert({ from: '24', time: '00:00' }).display, '12:00 AM');
  assert.equal(timeConvert({ from: '24', time: '23:59' }).display, '11:59 PM');
  assert.equal(timeConvert({ from: '24', time: '09:05' }).display, '9:05 AM');

  assert.equal(timeConvert({ from: '12', hour: 1, minute: 45, meridiem: 'PM' }).display, '13:45');
  assert.equal(timeConvert({ from: '12', hour: 12, minute: 0, meridiem: 'AM' }).display, '00:00');
  assert.equal(timeConvert({ from: '12', hour: 12, minute: 0, meridiem: 'PM' }).display, '12:00');
  assert.equal(timeConvert({ from: '12', hour: 11, minute: 59, meridiem: 'PM' }).display, '23:59');

  // round trip
  assert.equal(timeConvert({ from: '12', hour: 1, minute: 45, meridiem: 'PM' }).value,
    timeConvert({ from: '24', time: '13:45' }).value, 'both directions agree on minutes past midnight');

  assert.equal(timeConvert({ from: '24', time: '25:00' }).ok, false, 'hour 25 is rejected');
  assert.equal(timeConvert({ from: '24', time: '12:75' }).ok, false, 'minute 75 is rejected');
  assert.equal(timeConvert({ from: '24', time: '1345' }).ok, false, 'missing colon is rejected');
  assert.equal(timeConvert({ from: '24', time: '' }).ok, false);
  assert.equal(timeConvert({ from: '12', hour: 13, minute: 0, meridiem: 'PM' }).ok, false, 'hour 13 is not 12 hour time');
  assert.equal(timeConvert({ from: '12', hour: 0, minute: 0, meridiem: 'AM' }).ok, false, 'hour 0 is not 12 hour time');
}

console.log('calc-units.test.js: all passed');
