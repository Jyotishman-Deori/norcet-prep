// Contract test for src/lib/storage-selftest.js — runnable under Node:
//   node src/lib/storage-selftest.test.js
// Pure module with injected IO, so no DOM/build stubs are needed.
import assert from 'node:assert/strict';
import {
  runStorageSelfTest, SELFTEST_PREFIX, PRIVATE_READ_PREFIXES, PRIVACY_PROBES, writeFailHint,
} from './storage-selftest.js';

const NOW = 1782900000000;

// Fake IO factory: a tiny in-memory store with knobs to simulate broker/RLS faults.
// leakPrefixes: raw anon read RETURNS the stored value for keys under these
// prefixes (an RLS denylist drift). rejectProbePrefixes: broker refuses the
// canary write there (stale kv-write deploy).
function makeIo({ rejectWrite = null, hideRead = false, corruptRead = false,
                  raw = true, leakPrefixes = [], rejectProbePrefixes = [] } = {}) {
  const store = new Map();
  const calls = { writes: [], reads: [], rawReads: [], dels: [] };
  const io = {
    calls,
    write: async (k, v) => {
      calls.writes.push(k);
      if (rejectWrite) throw new Error(rejectWrite);
      if (rejectProbePrefixes.some(p => k.startsWith(p))) throw new Error('kv-write set 403 Forbidden');
      store.set(k, v);
    },
    readAnon: async (k) => {
      calls.reads.push(k);
      if (hideRead) return null;                 // RLS blocks the read (returns empty, not error)
      if (corruptRead) return JSON.stringify({ probe: true, token: 'WRONG' });
      return store.has(k) ? store.get(k) : null;
    },
    del: async (k) => { calls.dels.push(k); store.delete(k); },
  };
  if (raw) {
    io.readAnonRaw = async (k) => {
      calls.rawReads.push(k);
      // healthy policy: private rows exist but anon sees NOTHING…
      if (leakPrefixes.some(p => k.startsWith(p))) return store.has(k) ? store.get(k) : null;
      return null; // …which is exactly a null read
    };
  }
  return io;
}

// ---- happy path: control round-trip ok + all six prefixes blocked -> pass ----
{
  const io = makeIo();
  const r = await runStorageSelfTest(io, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.verdict, 'pass');
  assert.equal(r.write, 'ok');
  assert.equal(r.read, 'ok');
  assert.equal(r.cleanup, 'ok');
  assert.ok(r.key.startsWith(SELFTEST_PREFIX), 'canary uses the dedicated prefix');
  assert.match(r.hint, /private prefixes are hidden/);
  // one privacy row per protected prefix, all blocked
  assert.equal(r.privacy.length, PRIVATE_READ_PREFIXES.length);
  assert.ok(r.privacy.every(p => p.state === 'blocked'));
  // every probe wrote under a broker-accepted family (analytics: -> analytics:user:)
  const analyticsRow = r.privacy.find(p => p.prefix === 'analytics:');
  assert.ok(analyticsRow.key.startsWith('analytics:user:'), 'analytics probe uses the writable key family');
  // errlog probe must be UX-severity so it never burns the owner-alert budget
  const errlogWrite = io.calls.writes.find(k => k.startsWith('errlog:'));
  assert.ok(errlogWrite, 'errlog prefix probed');
  // every written probe key was cleaned up
  for (const p of r.privacy) assert.ok(io.calls.dels.includes(p.key), `cleanup attempted for ${p.prefix}`);
  // control canary still checked first
  assert.equal(io.calls.writes[0], r.key);
  assert.equal(io.calls.reads[0], r.key);
}

// ---- probe VALUES carry severity ux (the errlog alert suppressor) ----
{
  const seen = [];
  const io = makeIo();
  const origWrite = io.write;
  io.write = async (k, v) => { seen.push([k, v]); return origWrite(k, v); };
  await runStorageSelfTest(io, NOW);
  for (const [k, v] of seen.filter(([k]) => k !== `${SELFTEST_PREFIX}canary-${NOW}`)) {
    assert.equal(JSON.parse(v).severity, 'ux', `probe under ${k} is ux-severity`);
  }
}

// ---- one prefix LEAKS -> rls-leak, ok:false, hint names the fix ----
{
  const io = makeIo({ leakPrefixes: ['errlog:', 'adminlog:'] });
  const r = await runStorageSelfTest(io, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.verdict, 'rls-leak');
  assert.match(r.hint, /secure-admin-read-policy\.sql/);
  assert.match(r.hint, /errlog:/);
  assert.equal(r.privacy.find(p => p.prefix === 'errlog:').state, 'leaked');
  assert.equal(r.privacy.find(p => p.prefix === 'profile:').state, 'blocked');
}

// ---- broker refuses a probe write -> no-probe, ok:false, redeploy hint ----
{
  const io = makeIo({ rejectProbePrefixes: ['adminlog:'] });
  const r = await runStorageSelfTest(io, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.verdict, 'probe-write-failed');
  assert.match(r.hint, /redeploy/i);
  assert.equal(r.privacy.find(p => p.prefix === 'adminlog:').state, 'no-probe');
}

// ---- no readAnonRaw provided -> privacy phase skipped, legacy behavior ----
{
  const io = makeIo({ raw: false });
  const r = await runStorageSelfTest(io, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.verdict, 'pass');
  assert.equal(r.privacy, null);
}

// ---- broker rejects the write (403) -> broker-write-failed, no read attempted ----
{
  const io = makeIo({ rejectWrite: 'kv-write set 403 Forbidden' });
  const r = await runStorageSelfTest(io, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.write, 'fail');
  assert.equal(r.verdict, 'broker-write-failed');
  assert.equal(r.read, 'pending', 'must not attempt a read after a failed write');
  assert.equal(io.calls.reads.length, 0);
  assert.match(r.hint, /Broker rejected/);
}

// ---- write ok but RLS hides the CONTROL read -> rls-read-blocked (2026-07-02 bug) ----
{
  const io = makeIo({ hideRead: true });
  const r = await runStorageSelfTest(io, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.write, 'ok');
  assert.equal(r.read, 'blocked');
  assert.equal(r.verdict, 'rls-read-blocked');
  assert.match(r.hint, /fix-anon-read-policy\.sql/);
  assert.ok(io.calls.dels.includes(r.key), 'still cleans up the canary');
}

// ---- read returns a different value -> read-mismatch ----
{
  const io = makeIo({ corruptRead: true });
  const r = await runStorageSelfTest(io, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.read, 'stale');
  assert.equal(r.verdict, 'read-mismatch');
}

// ---- writeFailHint maps status codes to guidance ----
assert.match(writeFailHint(new Error('kv-write set 401 x')), /session expired/i);
assert.match(writeFailHint(new Error('kv-write set 403 x')), /not admin|redeploy/i);
assert.match(writeFailHint(new Error('kv-write set 429 x')), /rate/i);
assert.match(writeFailHint(new Error('network down')), /online/i);

// ---- private-prefix invariant matches storage.js BROKER_READ_PREFIXES ----
assert.deepEqual(PRIVATE_READ_PREFIXES, ['profile:', 'myfeedback:', 'feedback:', 'errlog:', 'analytics:', 'adminlog:']);
assert.equal(PRIVACY_PROBES.length, 6);

console.log('storage-selftest.test.js: all passed');
