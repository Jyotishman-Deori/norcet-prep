// Contract test for src/lib/note-prompt.js — runnable under Node:
//   node src/lib/note-prompt.test.js
// Pure module (no I/O, no DOM), so no storage/build stubs are needed.
import assert from 'node:assert/strict';
import {
  DESIGNATIONS, LEVELS, STRATEGIES,
  DEFAULT_DESIGNATION_INDEX, DEFAULT_LEVEL_ID, DEFAULT_STRATEGY_ID,
  MAX_BULLETS, MASTERY_BASELINE,
  normalizeBullets, formatTargetMaterial,
  isClinicalDesignation, strategiesFor, isValidCombo,
  assembleMasterPrompt,
} from './note-prompt.js';

// ---- content sanity ----
assert.equal(DESIGNATIONS.length, 6, 'six designations (spec Section 9)');
assert.equal(STRATEGIES.length, 4, 'four strategies (spec Section 10)');
assert.equal(LEVELS.length, 3);
// The recommended default designation is the 5th — "Ultimate Designation".
assert.equal(DEFAULT_DESIGNATION_INDEX, 4);
assert.ok(DESIGNATIONS[DEFAULT_DESIGNATION_INDEX].recommended);
assert.match(DESIGNATIONS[DEFAULT_DESIGNATION_INDEX].title, /Clinical Residency Coordinator/);
assert.equal(DEFAULT_LEVEL_ID, 'intermediate');
assert.ok(LEVELS.find((l) => l.id === DEFAULT_LEVEL_ID).recommended);
assert.equal(DEFAULT_STRATEGY_ID, 'gatekeeper');

// Exactly the two clinical designations (indices 4 & 5) are clinical.
assert.equal(isClinicalDesignation(0), false);
assert.equal(isClinicalDesignation(3), false);
assert.equal(isClinicalDesignation(4), true);
assert.equal(isClinicalDesignation(5), true);
assert.equal(isClinicalDesignation(99), false); // out of range -> not clinical

// ---- normalizeBullets ----
{
  // splits lines, trims, drops blanks, strips leading bullet markers, keeps unicode.
  const b = normalizeBullets('• Sepsis\n- SIRS criteria\n\n  1. Lactate ≥ 2 mmol/L  \n');
  assert.deepEqual(b, ['Sepsis', 'SIRS criteria', 'Lactate ≥ 2 mmol/L']);
  // preserves symbols/characters that are NOT a leading marker
  assert.deepEqual(normalizeBullets('K+ 5.9 mEq/L → treat'), ['K+ 5.9 mEq/L → treat']);
  // array input works too
  assert.deepEqual(normalizeBullets(['a', '  ', 'b']), ['a', 'b']);
  // caps at MAX_BULLETS
  const many = Array.from({ length: 25 }, (_, i) => `note ${i}`);
  assert.equal(normalizeBullets(many).length, MAX_BULLETS);
  // junk-safe
  assert.deepEqual(normalizeBullets(null), []);
  assert.deepEqual(normalizeBullets(undefined), []);
  assert.deepEqual(normalizeBullets(42), []);
}

// ---- formatTargetMaterial ----
assert.equal(formatTargetMaterial(['Sepsis']), 'Sepsis');           // single -> inline
assert.equal(formatTargetMaterial(['A', 'B']), '- A\n- B');          // multi -> dash list
assert.match(formatTargetMaterial([]), /No notes entered/);          // empty placeholder

// ---- strategiesFor / restrict map (spec OD #5) ----
{
  // Non-clinical designations: only the two domain-agnostic strategies.
  const nonClinical = strategiesFor(0).map((s) => s.id);
  assert.deepEqual(nonClinical, ['gatekeeper', 'blindspots']);
  // Clinical designations: all four (bedside strategies unlocked).
  const clinical = strategiesFor(4).map((s) => s.id);
  assert.deepEqual(clinical, ['gatekeeper', 'blindspots', 'stresstest', 'traptester']);
  // Combo validity mirrors the map.
  assert.equal(isValidCombo(0, 'stresstest'), false); // bedside blocked for CNO
  assert.equal(isValidCombo(0, 'gatekeeper'), true);
  assert.equal(isValidCombo(5, 'traptester'), true);  // bedside ok for Pathophysiologist
}

// ---- assembleMasterPrompt ----
{
  // Defaults: omitted selection -> recommended designation/level/strategy.
  const p = assembleMasterPrompt({ bullets: ['Digoxin toxicity'] });
  assert.match(p, /^Designation: Director of Nursing Excellence & Clinical Residency Coordinator$/m);
  assert.match(p, /^My Level: Intermediate$/m);
  assert.match(p, /^Target Material: Digoxin toxicity$/m);
  assert.match(p, /CRITICAL STRATEGY RULES:/);
  assert.match(p, /^Execution: /m);
  // Gatekeeper scorecard uses the explicit turn-one baseline (spec OD #6).
  assert.ok(p.includes(MASTERY_BASELINE), 'scorecard baseline present on turn one');
  // Rules are numbered starting at 1.
  assert.match(p, /^1\. Structural Pacing:/m);
}
{
  // Multi-bullet target renders as a dash list.
  const p = assembleMasterPrompt({ strategyId: 'blindspots', bullets: ['ARDS', 'PEEP'] });
  assert.match(p, /Target Material:\n- ARDS\n- PEEP/);
  assert.match(p, /Understanding Estimate/);
}
{
  // DEFENSIVE: a bedside strategy on a non-clinical designation falls back to
  // Gatekeeper rather than emitting an out-of-domain prompt.
  const p = assembleMasterPrompt({ designationIndex: 0, strategyId: 'stresstest', bullets: ['x'] });
  assert.match(p, /^Designation: Chief Nursing Officer \(CNO\)$/m);
  assert.match(p, /^1\. Structural Pacing:/m);        // Gatekeeper rule 1
  assert.ok(!p.includes('Acuity Level'), 'bedside tracker must not leak into a CNO prompt');
}
{
  // A valid bedside combo keeps its own tracker shape.
  const p = assembleMasterPrompt({ designationIndex: 5, strategyId: 'stresstest', bullets: ['MI'] });
  assert.match(p, /Current Acuity Level/);
  assert.match(p, /Active Complications/);
}

console.log('note-prompt.test.js — all assertions passed');
