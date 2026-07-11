// Contract test for src/lib/calc-scores.js — runnable under Node:
//   node src/lib/calc-scores.test.js
import assert from 'node:assert/strict';
import {
  GCS_EYE, GCS_VERBAL, GCS_MOTOR, gcs,
  APGAR_APPEARANCE, APGAR_PULSE, APGAR_GRIMACE, APGAR_ACTIVITY, APGAR_RESPIRATION, apgar,
  BRADEN_SENSORY, BRADEN_MOISTURE, BRADEN_ACTIVITY, BRADEN_MOBILITY, BRADEN_NUTRITION, BRADEN_FRICTION, braden,
  MORSE_HISTORY, MORSE_SECONDARY, MORSE_AID, MORSE_IV, MORSE_GAIT, MORSE_MENTAL, morse,
} from './calc-scores.js';

const matched = (r) => r.bands.find((b) => b.match).label;

// ---- the option lists ARE the scale: ranges must be exact -----------------
assert.deepEqual(GCS_EYE.map((o) => o.value), [4, 3, 2, 1]);
assert.deepEqual(GCS_VERBAL.map((o) => o.value), [5, 4, 3, 2, 1]);
assert.deepEqual(GCS_MOTOR.map((o) => o.value), [6, 5, 4, 3, 2, 1]);
for (const list of [APGAR_APPEARANCE, APGAR_PULSE, APGAR_GRIMACE, APGAR_ACTIVITY, APGAR_RESPIRATION]) {
  assert.deepEqual(list.map((o) => o.value), [2, 1, 0], 'every APGAR item scores 0, 1 or 2');
}
for (const list of [BRADEN_SENSORY, BRADEN_MOISTURE, BRADEN_ACTIVITY, BRADEN_MOBILITY, BRADEN_NUTRITION]) {
  assert.deepEqual(list.map((o) => o.value), [4, 3, 2, 1], 'five Braden subscales score 1 to 4');
}
assert.deepEqual(BRADEN_FRICTION.map((o) => o.value), [3, 2, 1], 'friction and shear scores 1 to 3');
assert.deepEqual(MORSE_HISTORY.map((o) => o.value), [0, 25]);
assert.deepEqual(MORSE_SECONDARY.map((o) => o.value), [0, 15]);
assert.deepEqual(MORSE_AID.map((o) => o.value), [0, 15, 30]);
assert.deepEqual(MORSE_IV.map((o) => o.value), [0, 20]);
assert.deepEqual(MORSE_GAIT.map((o) => o.value), [0, 10, 20]);
assert.deepEqual(MORSE_MENTAL.map((o) => o.value), [0, 15]);

// =====================================================================
// 16. GLASGOW COMA SCALE — total 3 to 15
// =====================================================================
{
  const max = gcs({ eye: 4, verbal: 5, motor: 6 });
  assert.equal(max.ok, true);
  assert.equal(max.value, 15, 'fully awake is 15');
  assert.equal(matched(max), 'Mild, 13 to 15');

  const min = gcs({ eye: 1, verbal: 1, motor: 1 });
  assert.equal(min.value, 3, 'the GCS floor is 3, never 0');
  assert.equal(matched(min), 'Severe, 8 or less');

  // the classic intubation boundary: 8 is severe, 9 is moderate
  assert.equal(matched(gcs({ eye: 2, verbal: 2, motor: 4 })), 'Severe, 8 or less');
  assert.equal(matched(gcs({ eye: 2, verbal: 3, motor: 4 })), 'Moderate, 9 to 12');
  assert.equal(matched(gcs({ eye: 4, verbal: 4, motor: 4 })), 'Moderate, 9 to 12');
  assert.equal(matched(gcs({ eye: 4, verbal: 4, motor: 5 })), 'Mild, 13 to 15');

  // the working names every component so the score is auditable
  assert.ok(max.steps.some((s) => s.includes('Eye opening: Spontaneous (4)')));
  assert.ok(max.steps.some((s) => s.includes('Total = 15 out of 15')));
  assert.ok(max.bands.every((b) => b.flagged), 'severity bands are flagged reference info');

  // values not on the scale are ERRORS, never a silently dropped zero
  assert.equal(gcs({ eye: 5, verbal: 5, motor: 6 }).ok, false, 'eye tops out at 4');
  assert.equal(gcs({ eye: 0, verbal: 5, motor: 6 }).ok, false, 'there is no 0 on the GCS');
  assert.equal(gcs({ eye: 4, verbal: 5 }).ok, false, 'a missing component is an error');
  assert.equal(gcs({ eye: 2.5, verbal: 5, motor: 6 }).ok, false);
}

// =====================================================================
// 17. APGAR — total 0 to 10
// =====================================================================
{
  const perfect = apgar({ appearance: 2, pulse: 2, grimace: 2, activity: 2, respiration: 2 });
  assert.equal(perfect.value, 10);
  assert.equal(matched(perfect), 'Reassuring, 7 to 10');

  const flat = apgar({ appearance: 0, pulse: 0, grimace: 0, activity: 0, respiration: 0 });
  assert.equal(flat.ok, true, 'a total of 0 is a valid, meaningful score');
  assert.equal(flat.value, 0);
  assert.equal(matched(flat), 'Low, 0 to 3');

  // band boundaries: 3 low, 4 moderate, 6 moderate, 7 reassuring
  assert.equal(matched(apgar({ appearance: 1, pulse: 1, grimace: 1, activity: 0, respiration: 0 })), 'Low, 0 to 3');
  assert.equal(matched(apgar({ appearance: 1, pulse: 1, grimace: 1, activity: 1, respiration: 0 })), 'Moderately abnormal, 4 to 6');
  assert.equal(matched(apgar({ appearance: 2, pulse: 2, grimace: 1, activity: 1, respiration: 0 })), 'Moderately abnormal, 4 to 6');
  assert.equal(matched(apgar({ appearance: 2, pulse: 2, grimace: 1, activity: 1, respiration: 1 })), 'Reassuring, 7 to 10');

  assert.equal(apgar({ appearance: 3, pulse: 2, grimace: 2, activity: 2, respiration: 2 }).ok, false, 'no APGAR item scores 3');
  assert.equal(apgar({ appearance: 2, pulse: 2, grimace: 2, activity: 2 }).ok, false, 'all five items are required');
}

// =====================================================================
// 18. BRADEN — total 6 to 23, LOWER is WORSE
// =====================================================================
{
  const best = braden({ sensory: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 4, friction: 3 });
  assert.equal(best.value, 23, 'the ceiling is 23, not 24: friction tops out at 3');
  assert.equal(matched(best), 'Not at risk, 19 and above');

  const worst = braden({ sensory: 1, moisture: 1, activity: 1, mobility: 1, nutrition: 1, friction: 1 });
  assert.equal(worst.value, 6, 'the floor is 6, never 0');
  assert.equal(matched(worst), 'Very high risk, 9 or less');
  assert.ok(worst.warnings.some((w) => w.includes('LOWER')), 'the inverted direction is stated');

  // band boundaries: 9/10, 12/13, 14/15, 18/19
  assert.equal(matched(braden({ sensory: 2, moisture: 2, activity: 1, mobility: 1, nutrition: 2, friction: 1 })), 'Very high risk, 9 or less');   // 9
  assert.equal(matched(braden({ sensory: 2, moisture: 2, activity: 2, mobility: 1, nutrition: 2, friction: 1 })), 'High risk, 10 to 12');          // 10
  assert.equal(matched(braden({ sensory: 3, moisture: 2, activity: 2, mobility: 2, nutrition: 2, friction: 1 })), 'High risk, 10 to 12');          // 12
  assert.equal(matched(braden({ sensory: 3, moisture: 3, activity: 2, mobility: 2, nutrition: 2, friction: 1 })), 'Moderate risk, 13 to 14');      // 13
  assert.equal(matched(braden({ sensory: 3, moisture: 3, activity: 2, mobility: 2, nutrition: 2, friction: 2 })), 'Moderate risk, 13 to 14');      // 14
  assert.equal(matched(braden({ sensory: 3, moisture: 3, activity: 3, mobility: 2, nutrition: 2, friction: 2 })), 'Mild risk, 15 to 18');          // 15
  assert.equal(matched(braden({ sensory: 4, moisture: 3, activity: 3, mobility: 3, nutrition: 3, friction: 2 })), 'Mild risk, 15 to 18');          // 18
  assert.equal(matched(braden({ sensory: 4, moisture: 4, activity: 3, mobility: 3, nutrition: 3, friction: 2 })), 'Not at risk, 19 and above');    // 19

  assert.equal(braden({ sensory: 5, moisture: 4, activity: 4, mobility: 4, nutrition: 4, friction: 3 }).ok, false, 'sensory tops out at 4');
  assert.equal(braden({ sensory: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 4, friction: 4 }).ok, false, 'friction tops out at 3');
  assert.equal(braden({ sensory: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 4 }).ok, false, 'all six components are required');
}

// =====================================================================
// 19. MORSE FALL SCALE — total 0 to 125, weighted items only
// =====================================================================
{
  const max = morse({ history: 25, secondary: 15, aid: 30, iv: 20, gait: 20, mental: 15 });
  assert.equal(max.value, 125, 'the ceiling is exactly 125');
  assert.equal(matched(max), 'High risk, 45 and above');

  const zero = morse({ history: 0, secondary: 0, aid: 0, iv: 0, gait: 0, mental: 0 });
  assert.equal(zero.value, 0);
  assert.equal(matched(zero), 'Low risk, 0 to 24');

  // band boundaries: 24 low, 25 moderate, 44 moderate, 45 high
  assert.equal(matched(morse({ history: 0, secondary: 0, aid: 0, iv: 20, gait: 0, mental: 0 })), 'Low risk, 0 to 24');           // 20
  assert.equal(matched(morse({ history: 25, secondary: 0, aid: 0, iv: 0, gait: 0, mental: 0 })), 'Moderate risk, 25 to 44');     // 25
  assert.equal(matched(morse({ history: 0, secondary: 0, aid: 0, iv: 0, gait: 20, mental: 15 })), 'Moderate risk, 25 to 44');    // 35
  assert.equal(matched(morse({ history: 25, secondary: 0, aid: 0, iv: 0, gait: 0, mental: 15 })), 'Moderate risk, 25 to 44');    // 40
  assert.equal(matched(morse({ history: 25, secondary: 0, aid: 0, iv: 20, gait: 0, mental: 0 })), 'High risk, 45 and above');    // 45

  // the alternate institutional cutoffs are disclosed in writing
  assert.ok(max.warnings.some((w) => w.includes('25 to 50')), 'the variant band set is disclosed');

  // only the exact weighted values exist on the scale
  assert.equal(morse({ history: 10, secondary: 0, aid: 0, iv: 0, gait: 0, mental: 0 }).ok, false, 'history is 0 or 25, nothing else');
  assert.equal(morse({ history: 0, secondary: 0, aid: 20, iv: 0, gait: 0, mental: 0 }).ok, false, 'aid is 0, 15 or 30');
  assert.equal(morse({ history: 0, secondary: 0, aid: 0, iv: 0, gait: 0 }).ok, false, 'all six items are required');
}

console.log('calc-scores.test.js: all passed');
