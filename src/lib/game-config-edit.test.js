// Contract test for src/lib/game-config-edit.js — runnable under Node:
//   node src/lib/game-config-edit.test.js
import assert from 'node:assert/strict';
import { DEFAULTS } from './game-config.js';
import {
  getAtPath, setAtPath, sanitizeConfig, validateConfig, xpForLevel, changedFields, ALL_FIELDS,
} from './game-config-edit.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- getAtPath / setAtPath, incl. array indices ----
assert.equal(getAtPath(DEFAULTS, 'xp.reqScale'), 0.2);
assert.equal(getAtPath(DEFAULTS, 'premium.plans.0.priceInr'), 149);
assert.equal(getAtPath(DEFAULTS, 'crateOdds.2.coins'), 350);
assert.equal(getAtPath(DEFAULTS, 'nope.missing'), undefined);

// setAtPath is immutable and only clones the touched spine
{
  const before = clone(DEFAULTS);
  const after = setAtPath(before, 'premium.plans.1.priceInr', 1299);
  assert.equal(getAtPath(after, 'premium.plans.1.priceInr'), 1299);
  assert.equal(getAtPath(before, 'premium.plans.1.priceInr'), 999, 'original untouched');
  assert.notEqual(after, before);
  assert.notEqual(after.premium.plans, before.premium.plans, 'array spine cloned');
  assert.equal(after.xp, before.xp, 'untouched branches shared');
}

// ---- sanitizeConfig clamps out-of-range + coerces types ----
{
  let cfg = clone(DEFAULTS);
  cfg = setAtPath(cfg, 'xp.dailyCap', 999999);       // above max 10000
  cfg = setAtPath(cfg, 'framePrices.gold', -50);      // below min 0
  cfg = setAtPath(cfg, 'xp.reqScale', 5);             // above max 2
  cfg = setAtPath(cfg, 'premium.enabled', 'yes');     // toggle coercion
  cfg = setAtPath(cfg, 'quests.play1.xp', 12.7);      // int rounding
  const s = sanitizeConfig(cfg);
  assert.equal(getAtPath(s, 'xp.dailyCap'), 10000);
  assert.equal(getAtPath(s, 'framePrices.gold'), 0);
  assert.equal(getAtPath(s, 'xp.reqScale'), 2);
  assert.equal(getAtPath(s, 'premium.enabled'), true);
  assert.equal(getAtPath(s, 'quests.play1.xp'), 13);
}

// NaN falls back to the DEFAULT for that field
{
  let cfg = setAtPath(clone(DEFAULTS), 'xp.coefficient', 'abc');
  const s = sanitizeConfig(cfg);
  assert.equal(getAtPath(s, 'xp.coefficient'), DEFAULTS.xp.coefficient);
}

// ---- validateConfig reports problems, empty when clean ----
assert.deepEqual(validateConfig(DEFAULTS), []);
{
  const bad = setAtPath(setAtPath(clone(DEFAULTS), 'xp.dailyCap', 50), 'premium.plans.0.priceInr', NaN);
  const errs = validateConfig(bad);
  assert.ok(errs.some(e => /below minimum/.test(e)));
  assert.ok(errs.some(e => /must be a number/.test(e)));
}

// ---- xpForLevel uses the given (unsaved) config ----
{
  const fast = setAtPath(clone(DEFAULTS), 'xp.reqScale', 0.2);
  const real = setAtPath(clone(DEFAULTS), 'xp.reqScale', 1);
  assert.ok(xpForLevel(real, 10) > xpForLevel(fast, 10), 'reqScale 1 costs more than 0.2');
  assert.ok(xpForLevel(real, 20) > xpForLevel(real, 10), 'later levels cost more');
  assert.ok(xpForLevel(real, 1) >= 10, 'floor of 10');
}

// ---- changedFields tracks the diff of managed fields ----
{
  const base = clone(DEFAULTS);
  const work = setAtPath(clone(DEFAULTS), 'xp.reqScale', 1);
  assert.deepEqual(changedFields(base, base), []);
  assert.deepEqual(changedFields(base, work), ['xp.reqScale']);
}

// ---- idlist (internalIds): sanitize + no phantom dirty ----
{
  // string form (pasted list) becomes a clean array; junk is dropped
  let cfg = setAtPath(clone(DEFAULTS), 'internalIds', ' Jyoti, tester2  tester2 ,');
  const s = sanitizeConfig(cfg);
  assert.deepEqual(getAtPath(s, 'internalIds'), ['jyoti', 'tester2']);
  assert.deepEqual(getAtPath(sanitizeConfig(setAtPath(clone(DEFAULTS), 'internalIds', 42)), 'internalIds'), []);
  // idlist never produces validation errors
  assert.deepEqual(validateConfig(setAtPath(clone(DEFAULTS), 'internalIds', 'anything')), []);
  // deep-cloned but equal arrays are NOT flagged as changed (no phantom dirty)
  const base = setAtPath(clone(DEFAULTS), 'internalIds', ['a', 'b']);
  const same = clone(base);
  assert.deepEqual(changedFields(base, same), []);
  // a real edit IS flagged
  const edited = setAtPath(clone(base), 'internalIds', ['a', 'b', 'c']);
  assert.deepEqual(changedFields(base, edited), ['internalIds']);
}

// ---- maintenance kill switch: default off, toggle coerces, text trims ----
{
  assert.equal(getAtPath(DEFAULTS, 'maintenance.on'), false, 'ships OFF (fail-open)');
  assert.equal(getAtPath(DEFAULTS, 'maintenance.title'), '');
  let cfg = setAtPath(clone(DEFAULTS), 'maintenance.on', 'yes');       // toggle coercion
  cfg = setAtPath(cfg, 'maintenance.title', '  Back soon  ');          // text trim
  const s = sanitizeConfig(cfg);
  assert.equal(getAtPath(s, 'maintenance.on'), true);
  assert.equal(getAtPath(s, 'maintenance.title'), 'Back soon');
  // toggling maintenance is a clean single-field diff (no phantom dirty)
  assert.deepEqual(changedFields(clone(DEFAULTS), setAtPath(clone(DEFAULTS), 'maintenance.on', true)), ['maintenance.on']);
  assert.deepEqual(validateConfig(setAtPath(clone(DEFAULTS), 'maintenance.on', true)), [], 'toggles never error');
}

// every schema field resolves to a real path in DEFAULTS (no typos)
for (const f of ALL_FIELDS) {
  assert.notEqual(getAtPath(DEFAULTS, f.path), undefined, `schema path exists: ${f.path}`);
}

console.log('game-config-edit.test.js: all passed');
