// Contract test for src/lib/data-export.js — runnable under Node:
//   node src/lib/data-export.test.js
import assert from 'node:assert/strict';
import {
  EXPORT_VERSION, EXPORT_MANIFEST, EXPORT_NEVER_KEYS,
  sanitizeProfile, buildExport, exportFilename,
} from './data-export.js';
import { KEYS } from './keys.js';

const PID = 'user-123';

// ---- the manifest is a clean allowlist of per-profile keys ----
assert.ok(EXPORT_MANIFEST.length >= 5, 'covers the main data slices');
{
  const labels = new Set();
  const neverSet = new Set(EXPORT_NEVER_KEYS);
  for (const m of EXPORT_MANIFEST) {
    assert.ok(typeof m.label === 'string' && m.label.length > 1, 'each entry has a label');
    assert.ok(!labels.has(m.label), `duplicate label ${m.label}`);
    labels.add(m.label);
    const key = m.key(PID);
    assert.ok(typeof key === 'string' && key.length > 0, `${m.label}: key is a string`);
    assert.ok(key.includes(PID), `${m.label}: key is scoped to the profile id`);
    // THE safety property: no exported key is a device/auth/secret key.
    assert.ok(!neverSet.has(key), `${m.label} must not export the protected key ${key}`);
  }
  // the main progress blob must be included
  assert.ok(EXPORT_MANIFEST.some((m) => m.key(PID) === KEYS.userdata(PID)), 'progress blob is exported');
}

// ---- the protected list actually holds the session pointer ----
assert.ok(EXPORT_NEVER_KEYS.includes(KEYS.SESSION), 'the session key is on the never-export list');

// ---- sanitizeProfile drops anything credential-shaped ----
{
  const p = sanitizeProfile({
    id: 'jyo', uid: 'u-1', displayName: 'Jyo',
    sessionToken: 'SECRET', passwordHash: 'x', otpSecret: 'y', pin: '1234',
    preferences: { theme: 'dark' },
  });
  assert.deepEqual(Object.keys(p).sort(), ['displayName', 'id', 'preferences', 'uid']);
  assert.equal(p.sessionToken, undefined, 'token stripped');
  assert.equal(p.passwordHash, undefined, 'hash stripped');
  assert.equal(p.otpSecret, undefined);
  assert.equal(p.pin, undefined);
  assert.deepEqual(p.preferences, { theme: 'dark' }, 'normal data kept');
  assert.equal(sanitizeProfile(null), null);
  assert.equal(sanitizeProfile('x'), null);
}

// ---- buildExport shapes a versioned, dated object ----
{
  const out = buildExport({
    profile: { id: 'jyo', token: 'nope' },
    entries: { progress: { streak: 5 }, notes: ['a'] },
    now: Date.UTC(2026, 6, 12),
  });
  assert.equal(out._meta.app, 'NurseHolic');
  assert.equal(out._meta.kind, 'user-data-export');
  assert.equal(out._meta.version, EXPORT_VERSION);
  assert.equal(out._meta.exportedAt, '2026-07-12T00:00:00.000Z');
  assert.ok(/no passwords or login tokens/.test(out._meta.note));
  assert.equal(out.profile.token, undefined, 'buildExport sanitizes the profile');
  assert.equal(out.profile.id, 'jyo');
  assert.deepEqual(out.data.progress, { streak: 5 });
  // the whole thing must be JSON-serialisable (no cycles, no secrets)
  const json = JSON.stringify(out);
  assert.ok(!/nope/.test(json), 'the stripped token never reaches the file');
  // empty / missing inputs degrade gracefully
  assert.deepEqual(buildExport({}).data, {});
  assert.equal(buildExport({}).profile, null);
}

// ---- exportFilename ----
assert.equal(exportFilename(Date.UTC(2026, 6, 9)), 'nurseholic-data-2026-07-09.json');
assert.ok(/^nurseholic-data-\d{4}-\d{2}-\d{2}\.json$/.test(exportFilename()));

console.log('data-export.test.js: all passed');
