// Contract test for src/lib/clinical-systems.js — runnable under Node:
//   node src/lib/clinical-systems.test.js
import assert from 'node:assert/strict';

const { CLINICAL_SYSTEMS, MIN_ATTEMPTS, normalizeSub, systemForQuestion, clinicalLeaks, leakInsight } =
  await import('./clinical-systems.js');

// ---- normalizeSub ----
{
  assert.equal(normalizeSub('  Cardiac   Care '), 'cardiac care');
  assert.equal(normalizeSub(null), '');
}

// ---- synonym collapse: Cardiac / Cardiovascular / Hypertension all -> cardio ----
{
  for (const sub of ['Cardiac', 'Cardiovascular', 'Hypertension', 'Anticoagulants', 'Blood']) {
    assert.equal(systemForQuestion({ sub, topic: 'msn' }), 'cardio', sub);
  }
  for (const sub of ['Respiratory', 'Asthma care']) assert.equal(systemForQuestion({ sub, topic: 'msn' }), 'resp', sub);
  for (const sub of ['Neuro', 'Neurology', 'CNS', 'Nervous System']) assert.equal(systemForQuestion({ sub, topic: 'anat' }), 'neuro', sub);
  for (const sub of ['Endocrine', 'Insulin', 'Corticosteroids']) assert.equal(systemForQuestion({ sub, topic: 'pharm' }), 'endo', sub);
  for (const sub of ['Renal', 'Fluid Balance', 'Acid-Base Balance', 'IV Therapy']) assert.equal(systemForQuestion({ sub, topic: 'fund' }), 'renal', sub);
  for (const sub of ['Diet Therapy', 'Vitamin Deficiency', 'Diarrhoea', 'BMI']) assert.equal(systemForQuestion({ sub, topic: 'nutr' }), 'gi', sub);
  for (const sub of ['Sterilisation', 'Immunisation', 'Antibiotics', 'Tuberculosis', 'HAI']) assert.equal(systemForQuestion({ sub, topic: 'micro' }), 'infection', sub);
  for (const sub of ['Labour', 'Postpartum', 'Newborn Assessment', 'Pre-eclampsia', 'Family Planning']) assert.equal(systemForQuestion({ sub, topic: 'obg' }), 'perinatal', sub);
  for (const sub of ['Schizophrenia', 'ECT', 'Therapeutic Communication', 'Defence Mechanisms']) assert.equal(systemForQuestion({ sub, topic: 'mhn' }), 'mental', sub);
}

// ---- topic fallback when the sub is unknown or 'General' (imported banks) ----
{
  assert.equal(systemForQuestion({ sub: 'General', topic: 'obg' }), 'perinatal');
  assert.equal(systemForQuestion({ sub: '', topic: 'peds' }), 'perinatal');
  assert.equal(systemForQuestion({ sub: 'Zzz Unknown', topic: 'mhn' }), 'mental');
  assert.equal(systemForQuestion({ sub: 'Zzz Unknown', topic: 'micro' }), 'infection');
  assert.equal(systemForQuestion({ sub: 'Zzz Unknown', topic: 'nutr' }), 'gi');
  // No mapping at all -> 'other', never a crash.
  assert.equal(systemForQuestion({ sub: 'Positioning', topic: 'fund' }), 'other');
  assert.equal(systemForQuestion(null), 'other');
}

// ---- clinicalLeaks: counts, wrongRate, min-attempts gate, wrongQIds ----
{
  const questions = [
    { id: 'c1', topic: 'msn', sub: 'Cardiac' },
    { id: 'c2', topic: 'msn', sub: 'Hypertension' },
    { id: 'r1', topic: 'msn', sub: 'Respiratory' },
    { id: 'g1', topic: 'gk',  sub: 'Important Health Days' }, // non-clinical: excluded
  ];
  const wrong = { correct: false }; const right = { correct: true };
  const history = {
    c1: { attempts: [wrong, wrong] },
    c2: { attempts: [right, wrong] },
    r1: { attempts: [right] },              // 1 attempt < MIN_ATTEMPTS -> not reported
    g1: { attempts: [wrong, wrong, wrong] } // gk: excluded even with volume
  };
  const leaks = clinicalLeaks(history, questions);
  assert.equal(leaks.hasData, true);
  assert.equal(leaks.systems.length, 1, 'only cardio clears the gate');
  const cardio = leaks.systems[0];
  assert.equal(cardio.id, 'cardio');
  assert.equal(cardio.attempts, 4);
  assert.equal(cardio.wrong, 3);
  assert.equal(cardio.wrongRate, 75);
  assert.deepEqual(cardio.wrongQIds.sort(), ['c1', 'c2']);
  assert.ok(MIN_ATTEMPTS >= 3);
}

// ---- severity: volume-weighted so a 2-attempt fluke can't outrank a real leak ----
{
  const questions = [
    { id: 'a1', topic: 'msn', sub: 'Cardiac' }, { id: 'a2', topic: 'msn', sub: 'Cardiac' },
    { id: 'b1', topic: 'msn', sub: 'Respiratory' },
  ];
  const wrong = { correct: false }; const right = { correct: true };
  const history = {
    // cardio: 3 attempts, all wrong (100% but tiny volume)
    a1: { attempts: [wrong, wrong] }, a2: { attempts: [wrong] },
    // resp: 20 attempts, 60% wrong (the real leak)
    b1: { attempts: [...Array(12).fill(wrong), ...Array(8).fill(right)] },
  };
  const { systems } = clinicalLeaks(history, questions);
  assert.equal(systems[0].id, 'resp', 'volume-weighted severity ranks the sustained leak first');
}

// ---- revealed attempts ignored; empty inputs safe ----
{
  const leaks = clinicalLeaks({ c1: { attempts: [{ correct: false, revealed: true }] } },
                              [{ id: 'c1', topic: 'msn', sub: 'Cardiac' }]);
  assert.equal(leaks.hasData, false);
  assert.equal(clinicalLeaks(null, null).hasData, false);
  assert.equal(leakInsight(clinicalLeaks(null, null)), null);
}

// ---- leakInsight fires only on a genuine leak (>=35% wrong) ----
{
  const questions = [{ id: 'c1', topic: 'msn', sub: 'Cardiac' }];
  const strong = clinicalLeaks({ c1: { attempts: [{ correct: false }, { correct: false }, { correct: true }] } }, questions);
  const ins = leakInsight(strong);
  assert.ok(ins && /Cardiovascular/.test(ins.text));

  const healthy = clinicalLeaks({ c1: { attempts: [{ correct: true }, { correct: true }, { correct: false }] } }, questions);
  assert.equal(leakInsight(healthy), null, '33% wrong is not a leak headline');
}

// ---- taxonomy sanity ----
{
  const ids = CLINICAL_SYSTEMS.map(s => s.id);
  assert.ok(ids.includes('other'));
  assert.equal(new Set(ids).size, ids.length);
}

console.log('clinical-systems.test.js: all passed');
