// Contract test for src/lib/calc-obstetric.js — runnable under Node:
//   node src/lib/calc-obstetric.test.js
//
// NOTE ON "TODAY": naegele() rejects a future LMP and gestationalAge() defaults
// a blank reference date to today, so tests that need a stable answer always
// pass an explicit asOf, and LMP dates are chosen safely in the past.
import assert from 'node:assert/strict';
import { naegele, gestationalAge, TERM_DAYS } from './calc-obstetric.js';

const extra = (r, label) => r.extras.find((e) => e.label === label).value;
const matched = (r) => r.bands.find((b) => b.match).label;

assert.equal(TERM_DAYS, 280, 'term is 40 weeks');

// =====================================================================
// 20. NAEGELE'S RULE
// =====================================================================
{
  // the classic textbook case: LMP 10 Jan -> EDD 17 Oct the same year
  const r = naegele({ lmp: '2025-01-10' });
  assert.equal(r.ok, true);
  assert.equal(r.display, '2025-10-17', 'LMP + 1 year - 3 months + 7 days');
  assert.equal(extra(r, 'Estimated due date'), '2025-10-17');
  // for THIS date the simple 280 day count agrees exactly
  assert.equal(extra(r, 'LMP plus 280 days'), '2025-10-17');

  // a case where the calendar rule and +280 days DISAGREE: the 9 month window
  // crosses a leap February, so it holds 274 days instead of 273. LMP 31 May
  // 2023: the calendar rule gives 7 Mar 2024, but +280 days lands on 6 Mar.
  // Both must be shown, and the mismatch stated.
  const d = naegele({ lmp: '2023-05-31' });
  assert.equal(d.display, '2024-03-07');
  assert.equal(extra(d, 'LMP plus 280 days'), '2024-03-06');
  assert.ok(d.warnings.some((w) => w.includes('day or two apart')), 'the divergence is disclosed');

  // and when the window has exactly 273 days the two methods agree
  const same = naegele({ lmp: '2025-05-31' });
  assert.equal(same.display, '2026-03-07');
  assert.equal(extra(same, 'LMP plus 280 days'), '2026-03-07');

  // month clamping: LMP 30 Nov 2024. +7d = 7 Dec, -3mo = 7 Sep, +1y = 7 Sep 2025.
  const c = naegele({ lmp: '2024-11-30' });
  assert.equal(c.display, '2025-09-07');

  // December LMP: the -3 months must roll the year back before +1 year
  const dec = naegele({ lmp: '2024-12-10' });
  assert.equal(dec.display, '2025-09-17');

  // leap handling: LMP 2024-02-29 (+7d = 7 Mar, -3mo = 7 Dec 2023, +1y = 7 Dec 2024)
  const leap = naegele({ lmp: '2024-02-29' });
  assert.equal(leap.display, '2024-12-07');

  // cycle adjustment: a 35 day cycle shifts the EDD 7 days later
  const c35 = naegele({ lmp: '2025-01-10', cycleLength: 35 });
  assert.equal(c35.display, '2025-10-24');
  assert.ok(c35.standard.includes('35 day cycle'), 'the adjustment is named in the standard line');
  // a 21 day cycle shifts it 7 days earlier
  assert.equal(naegele({ lmp: '2025-01-10', cycleLength: 21 }).display, '2025-10-10');
  // blank cycle length means the standard 28 day cycle
  assert.equal(naegele({ lmp: '2025-01-10', cycleLength: '' }).display, '2025-10-17');

  // validation
  assert.equal(naegele({ lmp: '2023-02-31' }).ok, false, 'impossible date is rejected');
  assert.equal(naegele({ lmp: '' }).ok, false);
  assert.equal(naegele({ lmp: '2999-01-01' }).error, 'The last menstrual period cannot be in the future.');
  assert.equal(naegele({ lmp: '2025-01-10', cycleLength: 10 }).ok, false, 'a 10 day cycle is rejected');
  assert.equal(naegele({ lmp: '2025-01-10', cycleLength: 60 }).ok, false);
  assert.equal(naegele({ lmp: '2025-01-10', cycleLength: 28.5 }).ok, false, 'whole days only');
}

// =====================================================================
// 21. GESTATIONAL AGE
// =====================================================================
{
  // 10 weeks exactly
  const r = gestationalAge({ lmp: '2025-01-01', asOf: '2025-03-12' });
  assert.equal(r.ok, true);
  assert.equal(r.value, 70, '70 days');
  assert.equal(r.display, '10w 0d');
  assert.equal(matched(r), 'First trimester, 0w0d to 13w6d');
  assert.equal(extra(r, 'Estimated due date (LMP plus 280 days)'), '2025-10-08');
  assert.equal(extra(r, 'Days to the due date'), '210 days');
  assert.equal(extra(r, 'Percent of a 40 week pregnancy'), '25 percent');

  // weeks + remainder days
  const wd = gestationalAge({ lmp: '2025-01-01', asOf: '2025-03-15' });
  assert.equal(wd.value, 73);
  assert.equal(wd.display, '10w 3d');

  // trimester boundaries: 13w6d (97d) is first, 14w0d (98d) is second,
  // 27w6d (195d) is second, 28w0d (196d) is third.
  assert.equal(gestationalAge({ lmp: '2025-01-01', asOf: '2025-04-08' }).display, '13w 6d');
  assert.equal(matched(gestationalAge({ lmp: '2025-01-01', asOf: '2025-04-08' })), 'First trimester, 0w0d to 13w6d');
  assert.equal(gestationalAge({ lmp: '2025-01-01', asOf: '2025-04-09' }).display, '14w 0d');
  assert.equal(matched(gestationalAge({ lmp: '2025-01-01', asOf: '2025-04-09' })), 'Second trimester, 14w0d to 27w6d');
  assert.equal(gestationalAge({ lmp: '2025-01-01', asOf: '2025-07-15' }).display, '27w 6d');
  assert.equal(matched(gestationalAge({ lmp: '2025-01-01', asOf: '2025-07-15' })), 'Second trimester, 14w0d to 27w6d');
  assert.equal(gestationalAge({ lmp: '2025-01-01', asOf: '2025-07-16' }).display, '28w 0d');
  assert.equal(matched(gestationalAge({ lmp: '2025-01-01', asOf: '2025-07-16' })), 'Third trimester, 28w0d and beyond');

  // day zero
  const zero = gestationalAge({ lmp: '2025-01-01', asOf: '2025-01-01' });
  assert.equal(zero.value, 0);
  assert.equal(zero.display, '0w 0d');

  // exactly at term
  const term = gestationalAge({ lmp: '2025-01-01', asOf: '2025-10-08' });
  assert.equal(term.display, '40w 0d');
  assert.equal(extra(term, 'Days to the due date'), '0 days');
  assert.equal(term.warnings.length, 0, '40 weeks is term, not an error');

  // past term: computed AND warned, never silent
  const late = gestationalAge({ lmp: '2025-01-01', asOf: '2025-11-01' });
  assert.equal(late.ok, true);
  assert.ok(late.warnings.some((w) => w.includes('42 weeks')), 'past 42 weeks warns to re-check the LMP');
  assert.ok(extra(late, 'Days to the due date').includes('past'));

  // leap year day count across Feb 2024
  assert.equal(gestationalAge({ lmp: '2024-02-01', asOf: '2024-03-01' }).value, 29, '2024 has a 29 Feb');
  assert.equal(gestationalAge({ lmp: '2023-02-01', asOf: '2023-03-01' }).value, 28);

  // validation
  assert.equal(gestationalAge({ lmp: '2025-03-12', asOf: '2025-01-01' }).error,
    'The last menstrual period cannot be after the reference date.');
  assert.equal(gestationalAge({ lmp: 'nope', asOf: '2025-01-01' }).ok, false);
  assert.equal(gestationalAge({ lmp: '2025-02-30', asOf: '2025-03-12' }).ok, false, 'impossible date is rejected');
  // a blank reference date means today and must still produce a number
  assert.equal(gestationalAge({ lmp: '2025-01-01', asOf: '' }).ok, true);
}

console.log('calc-obstetric.test.js: all passed');
