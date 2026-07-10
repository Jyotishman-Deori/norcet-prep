// Contract test for src/lib/internal-accounts.js — runnable under Node:
//   node src/lib/internal-accounts.test.js
import assert from 'node:assert/strict';

const { normalizeInternalIds, isInternalAccount, setInternalSessionProfile, isInternalSession } =
  await import('./internal-accounts.js');
const { applyRemoteConfig, DEFAULTS } = await import('./game-config.js');

// ---- normalization: arrays, strings, junk ----
{
  assert.deepEqual(normalizeInternalIds(['Alice', ' bob ', 'alice']), ['alice', 'bob'], 'trim, lowercase, dedupe');
  assert.deepEqual(normalizeInternalIds('a1, b2  c3,,'), ['a1', 'b2', 'c3'], 'comma/whitespace string form');
  assert.deepEqual(normalizeInternalIds(''), []);
  assert.deepEqual(normalizeInternalIds(null), []);
  assert.deepEqual(normalizeInternalIds(42), []);
  assert.deepEqual(normalizeInternalIds([null, '', '  ']), []);
}

// ---- membership: id OR uid, case-insensitive, empty list never matches ----
{
  const cfg = { internalIds: ['jyoti', 'ABC-123-uid'] };
  assert.equal(isInternalAccount(cfg, { id: 'jyoti', uid: 'x' }), true, 'matches by slug id');
  assert.equal(isInternalAccount(cfg, { id: 'renamed', uid: 'abc-123-UID' }), true, 'matches by uid, case-insensitive');
  assert.equal(isInternalAccount(cfg, { id: 'student', uid: 'y' }), false);
  assert.equal(isInternalAccount({ internalIds: [] }, { id: 'jyoti' }), false, 'empty list flags nobody');
  assert.equal(isInternalAccount({}, { id: 'jyoti' }), false, 'absent list flags nobody');
  assert.equal(isInternalAccount(cfg, null), false);
  assert.equal(isInternalAccount(cfg, { id: '', uid: '' }), false, 'blank identity never matches');
}

// ---- DEFAULTS ships an EMPTY list (no tester baked into the bundle) ----
{
  assert.deepEqual(DEFAULTS.internalIds, [], 'DEFAULTS.internalIds must exist and be empty');
}

// ---- session bridge evaluates lazily against the live config ----
{
  setInternalSessionProfile({ id: 'tester1', uid: 'uid-1' });
  applyRemoteConfig({});                                   // remote list empty
  assert.equal(isInternalSession(), false, 'not flagged before the list arrives');
  applyRemoteConfig({ internalIds: ['tester1'] });         // config lands later
  assert.equal(isInternalSession(), true, 'flag applies without re-registering the profile');
  applyRemoteConfig({ internalIds: 'uid-1, other' });      // string form via config row
  assert.equal(isInternalSession(), true, 'uid match through the string form');
  setInternalSessionProfile(null);
  assert.equal(isInternalSession(), false, 'no session, never internal');
  applyRemoteConfig(null);                                 // reset to DEFAULTS for other tests
}

console.log('internal-accounts.test.js: all assertions passed');
