// Contract test for src/lib/calc-body.js — runnable under Node:
//   node src/lib/calc-body.test.js
import assert from 'node:assert/strict';
import {
  daysInMonth, parseDate, ageParts, exactAge,
  bsaMosteller, bsaDuBois, bsa, bmi,
} from './calc-body.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const matched = (r, group) =>
  r.bands.filter((b) => (group === undefined || b.group === group)).find((b) => b.match).label;
const ageOf = (r) => r.extras.find((e) => e.label === 'Exact age').value;

// ---- daysInMonth ----------------------------------------------------------
assert.equal(daysInMonth(2024, 2), 29, '2024 is a leap year');
assert.equal(daysInMonth(2023, 2), 28);
assert.equal(daysInMonth(2000, 2), 29, '2000 is a leap year, divisible by 400');
assert.equal(daysInMonth(1900, 2), 28, '1900 is NOT a leap year, divisible by 100 but not 400');
assert.equal(daysInMonth(2024, 1), 31);
assert.equal(daysInMonth(2024, 4), 30);
assert.equal(daysInMonth(2024, 12), 31);

// ---- parseDate: reject impossible calendar dates --------------------------
assert.equal(parseDate('2024-02-29', 'D').ok, true, '29 Feb exists in a leap year');
assert.equal(parseDate('2023-02-29', 'D').ok, false, '29 Feb does not exist in 2023');
assert.equal(parseDate('2023-02-31', 'D').error, 'D is not a real calendar date.');
assert.equal(parseDate('2023-13-01', 'D').error, 'D has an invalid month.');
assert.equal(parseDate('not-a-date', 'D').error, 'D must be a valid date.');
assert.equal(parseDate('', 'D').error, 'D is required.');
assert.equal(parseDate('2024-1-5', 'D').ok, false, 'unpadded is rejected, the date input always pads');
{
  // parsed in UTC, so it can never slip a day because of the device timezone
  const p = parseDate('2024-07-11', 'D');
  assert.deepEqual([p.y, p.m, p.d], [2024, 7, 11]);
  assert.equal(p.utc, Date.UTC(2024, 6, 11));
}

// =====================================================================
// 8. EXACT AGE — the borrow cases are where naive implementations break
// =====================================================================
{
  const A = (dob, ref) => ageParts(parseDate(dob, 'a'), parseDate(ref, 'b'));

  // straightforward
  assert.deepEqual(
    (({ years, months, days }) => ({ years, months, days }))(A('2000-01-15', '2024-07-11')),
    { years: 24, months: 5, days: 26 },
  );
  // same day
  assert.deepEqual(
    (({ years, months, days }) => ({ years, months, days }))(A('2000-05-10', '2000-05-10')),
    { years: 0, months: 0, days: 0 },
  );
  // the day BEFORE a birthday is still the previous year
  assert.equal(A('2000-05-10', '2024-05-09').years, 23);
  assert.equal(A('2000-05-10', '2024-05-10').years, 24, 'on the birthday you turn 24');

  // BORROW CASE: birth day (31) is later than the previous month's length (29).
  // A naive "borrow one month" leaves days negative here.
  assert.deepEqual(
    (({ years, months, days }) => ({ years, months, days }))(A('2000-01-31', '2000-03-01')),
    { years: 0, months: 1, days: 1 },
  );
  // leap-day birthday, checked against a non-leap year
  assert.deepEqual(
    (({ years, months, days }) => ({ years, months, days }))(A('2000-02-29', '2001-02-28')),
    { years: 0, months: 11, days: 30 },
  );
  assert.equal(A('2000-02-29', '2001-03-01').years, 1, 'turns 1 on 1 March in a non-leap year');

  // total days is a plain UTC day count
  assert.equal(A('2024-01-01', '2024-01-31').totalDays, 30);
  assert.equal(A('2024-02-28', '2024-03-01').totalDays, 2, '2024 has a 29 Feb');
  assert.equal(A('2023-02-28', '2023-03-01').totalDays, 1, '2023 does not');
}

// exactAge() wrapper + validation
{
  const r = exactAge({ dob: '2000-01-15', asOf: '2024-07-11' });
  assert.equal(r.ok, true);
  assert.equal(r.value, 24);
  assert.equal(ageOf(r), '24 y, 5 m, 26 d');
  assert.equal(r.extras.find((e) => e.label === 'Age in months').value, '293 months');

  assert.equal(exactAge({ dob: '2024-07-11', asOf: '2000-01-15' }).error,
    'Date of birth cannot be after the reference date.');
  assert.equal(exactAge({ dob: '', asOf: '2024-01-01' }).ok, false);
  assert.equal(exactAge({ dob: '2023-02-31', asOf: '2024-01-01' }).ok, false);
  // a blank reference date means "today", which must still produce a number
  assert.equal(exactAge({ dob: '2000-01-01', asOf: '' }).ok, true);
}

// =====================================================================
// 6. BODY SURFACE AREA
// =====================================================================
{
  // the identity: height x weight = 3600 makes the Mosteller square root exactly 1
  assert.equal(bsaMosteller(60, 60), 1, 'Mosteller 3600 identity');
  assert.equal(bsaMosteller(180, 20), 1);
  assert.ok(near(bsaMosteller(170, 70), Math.sqrt(11900 / 3600)));
  assert.ok(near(bsaMosteller(170, 70), 1.8181, 1e-4));

  // DuBois on the same patient lands close to, but not on, Mosteller
  assert.ok(near(bsaDuBois(170, 70), 1.8096, 1e-3));

  const m = bsa({ heightCm: 170, weightKg: 70, method: 'mosteller' });
  assert.equal(m.ok, true);
  assert.equal(m.display, '1.82');
  assert.equal(m.unit, 'm2');
  assert.equal(m.standard, 'Mosteller formula');

  const d = bsa({ heightCm: 170, weightKg: 70, method: 'dubois' });
  assert.equal(d.display, '1.81');
  assert.equal(d.standard, 'DuBois and DuBois formula');

  // BOTH methods are always reported, so the choice is never hidden
  assert.ok(m.extras.some((e) => e.label === 'Mosteller'));
  assert.ok(m.extras.some((e) => e.label === 'DuBois'));

  assert.equal(bsa({ heightCm: 0, weightKg: 70, method: 'mosteller' }).ok, false);
  assert.equal(bsa({ heightCm: 170, weightKg: -1, method: 'mosteller' }).ok, false);
  assert.equal(bsa({ heightCm: 170, weightKg: 70, method: 'boyd' }).ok, false, 'unknown formula is rejected');
}

// =====================================================================
// 7. BMI — one number, TWO labelled standards
// =====================================================================
const ASIAN = 'WHO Asian cutoffs (Indian practice)';
const INTL = 'WHO international cutoffs';
{
  const r = bmi({ weightKg: 70, heightCm: 170 });
  assert.equal(r.ok, true);
  assert.equal(r.display, '24.2');
  assert.equal(r.unit, 'kg/m2');
  // THE point of showing both: 24.2 is "normal" internationally but
  // "overweight" on the Asian cutoffs used in Indian practice.
  assert.equal(matched(r, INTL), 'Normal, 18.5 to 24.9');
  assert.equal(matched(r, ASIAN), 'Overweight or at risk, 23.0 to 24.9');
  assert.equal(r.bands.filter((b) => b.match).length, 2, 'exactly one match per standard');
  assert.ok(r.bands.every((b) => b.flagged), 'both cutoff sets are flagged for source confirmation');

  // exact boundary 23.0: the Asian cutoff flips here, the international one does not
  const b23 = bmi({ weightKg: 23, heightCm: 100 });
  assert.equal(b23.display, '23.0');
  assert.equal(matched(b23, ASIAN), 'Overweight or at risk, 23.0 to 24.9');
  assert.equal(matched(b23, INTL), 'Normal, 18.5 to 24.9');

  // exact boundary 18.5 belongs to Normal under BOTH standards
  const b185 = bmi({ weightKg: 18.5, heightCm: 100 });
  assert.equal(matched(b185, ASIAN), 'Normal, 18.5 to 22.9');
  assert.equal(matched(b185, INTL), 'Normal, 18.5 to 24.9');
  // a hair under is underweight under both
  assert.equal(matched(bmi({ weightKg: 18.4, heightCm: 100 }), ASIAN), 'Underweight, below 18.5');

  // top of the scale
  assert.equal(matched(bmi({ weightKg: 45, heightCm: 100 }), INTL), 'Obese III, 40.0 and above');
  assert.equal(matched(bmi({ weightKg: 45, heightCm: 100 }), ASIAN), 'Obese II, 30.0 and above');

  assert.equal(bmi({ weightKg: 0, heightCm: 170 }).ok, false, 'zero weight is rejected');
  assert.equal(bmi({ weightKg: 70, heightCm: 0 }).ok, false, 'zero height is rejected, never divide by zero');
  assert.equal(bmi({ weightKg: -70, heightCm: 170 }).ok, false);
  assert.equal(bmi({ weightKg: 'abc', heightCm: 170 }).ok, false);
}

console.log('calc-body.test.js: all passed');
