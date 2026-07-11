// Contract test for src/lib/calc-fluids.js — runnable under Node:
//   node src/lib/calc-fluids.test.js
import assert from 'node:assert/strict';
import {
  hollidaySegarDaily, hollidaySegarHourly, fluidMaintenance, urineOutput, map,
} from './calc-fluids.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const extra = (r, label) => r.extras.find((e) => e.label === label).value;
const matched = (r) => r.bands.find((b) => b.match).label;

// =====================================================================
// 9. FLUID MAINTENANCE — Holliday-Segar
// =====================================================================
{
  // the classic anchor: 25 kg = 1600 mL/day, and 65 mL/hr on the 4-2-1 rule
  assert.equal(hollidaySegarDaily(25), 1600, '1000 + 500 + (5 x 20) = 1600 mL/day');
  assert.equal(hollidaySegarHourly(25), 65, '40 + 20 + (5 x 1) = 65 mL/hr');

  // each bracket boundary
  assert.equal(hollidaySegarDaily(5), 500);
  assert.equal(hollidaySegarHourly(5), 20);
  assert.equal(hollidaySegarDaily(10), 1000, 'top of the first bracket');
  assert.equal(hollidaySegarHourly(10), 40);
  assert.equal(hollidaySegarDaily(15), 1250);
  assert.equal(hollidaySegarHourly(15), 50);
  assert.equal(hollidaySegarDaily(20), 1500, 'top of the second bracket');
  assert.equal(hollidaySegarHourly(20), 60);
  assert.equal(hollidaySegarDaily(70), 2500, '1500 + (50 x 20)');
  assert.equal(hollidaySegarHourly(70), 110, '60 + 50');

  const r = fluidMaintenance({ weightKg: 25 });
  assert.equal(r.ok, true);
  assert.equal(r.value, 1600);
  assert.equal(r.display, '1600');
  assert.equal(r.unit, 'mL/day');
  assert.equal(extra(r, 'Hourly rate (4-2-1 rule)'), '65 mL/hr');
  // 1600/24 is 66.7, NOT the 65 the 4-2-1 rule gives. Both are shown and the
  // mismatch is stated in writing rather than silently papered over.
  assert.equal(extra(r, 'Day rate divided by 24'), '66.7 mL/hr');
  assert.ok(r.warnings.some((w) => w.includes('do not match exactly')));
  // Holliday-Segar is paediatric; no adult range is invented
  assert.ok(r.warnings.some((w) => w.includes('paediatric')));

  assert.equal(fluidMaintenance({ weightKg: 0 }).ok, false);
  assert.equal(fluidMaintenance({ weightKg: -5 }).ok, false);
  assert.equal(fluidMaintenance({ weightKg: 'abc' }).ok, false);
}

// =====================================================================
// 10. URINE OUTPUT RATE
// =====================================================================
{
  // 500 mL from a 70 kg adult over 24 h = 0.2976 mL/kg/hr, which is oliguric
  const r = urineOutput({ volumeMl: 500, weightKg: 70, hours: 24 });
  assert.equal(r.ok, true);
  assert.ok(near(r.value, 500 / 1680));
  assert.equal(r.display, '0.30');
  assert.equal(r.unit, 'mL/kg/hr');
  assert.equal(matched(r), 'Below 0.5 mL/kg/hr, commonly the adult oliguria threshold');
  assert.ok(r.bands.every((b) => b.flagged), 'the thresholds are flagged, the number is not');

  // exactly 1.0 mL/kg/hr
  const one = urineOutput({ volumeMl: 1200, weightKg: 50, hours: 24 });
  assert.equal(one.value, 1);
  assert.equal(matched(one), '1.0 mL/kg/hr and above');

  // exactly 0.5 belongs to the band that STARTS at 0.5, not the oliguric one
  const half = urineOutput({ volumeMl: 600, weightKg: 50, hours: 24 });
  assert.equal(half.value, 0.5);
  assert.equal(matched(half), '0.5 to below 1.0 mL/kg/hr, below the usual paediatric threshold');

  // zero urine is a REAL and important reading, not an input error
  const anuric = urineOutput({ volumeMl: 0, weightKg: 70, hours: 6 });
  assert.equal(anuric.ok, true);
  assert.equal(anuric.value, 0);
  assert.equal(matched(anuric), 'Below 0.5 mL/kg/hr, commonly the adult oliguria threshold');

  assert.equal(urineOutput({ volumeMl: 500, weightKg: 0, hours: 24 }).ok, false, 'never divide by zero weight');
  assert.equal(urineOutput({ volumeMl: 500, weightKg: 70, hours: 0 }).ok, false, 'never divide by zero hours');
  assert.equal(urineOutput({ volumeMl: -10, weightKg: 70, hours: 24 }).ok, false, 'negative urine is rejected');
}

// =====================================================================
// 11. MEAN ARTERIAL PRESSURE
// =====================================================================
{
  // the textbook anchor: 120/80 -> (120 + 160) / 3 = 93.33 mmHg
  const r = map({ systolic: 120, diastolic: 80 });
  assert.equal(r.ok, true);
  assert.ok(near(r.value, 280 / 3));
  assert.equal(r.display, '93.3');
  assert.equal(r.unit, 'mmHg');
  assert.equal(extra(r, 'Pulse pressure'), '40 mmHg');
  assert.equal(matched(r), '70 to 100 mmHg, commonly quoted as the usual adult range');

  // exactly 70
  const r70 = map({ systolic: 90, diastolic: 60 });
  assert.equal(r70.value, 70);
  assert.equal(matched(r70), '70 to 100 mmHg, commonly quoted as the usual adult range');

  // hypotensive: 80/40 -> 53.3, under the 65 threshold
  const low = map({ systolic: 80, diastolic: 40 });
  assert.ok(near(low.value, 160 / 3));
  assert.equal(matched(low), 'Below 65 mmHg, commonly quoted as the minimum for organ perfusion');

  // exactly 65 belongs to the band that STARTS at 65
  const r65 = map({ systolic: 75, diastolic: 60 });
  assert.equal(r65.value, 65);
  assert.equal(matched(r65), '65 to below 70 mmHg');

  // an impossible reading is refused rather than quietly producing a number
  assert.equal(map({ systolic: 80, diastolic: 120 }).error,
    'Diastolic pressure cannot be higher than systolic pressure. Check the two numbers.');
  assert.equal(map({ systolic: 0, diastolic: 0 }).ok, false);
  assert.equal(map({ systolic: 120, diastolic: -10 }).ok, false);
  assert.equal(map({ systolic: 'abc', diastolic: 80 }).ok, false);
  // equal systolic and diastolic is odd but arithmetically valid
  assert.equal(map({ systolic: 90, diastolic: 90 }).value, 90);
}

console.log('calc-fluids.test.js: all passed');
