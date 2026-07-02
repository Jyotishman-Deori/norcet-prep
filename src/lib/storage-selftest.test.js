// Contract test for src/lib/storage-selftest.js — runnable under Node:
//   node src/lib/storage-selftest.test.js
// Pure module with injected IO, so no DOM/build stubs are needed.
import assert from 'node:assert/strict';
import { runStorageSelfTest, SELFTEST_PREFIX, PRIVATE_READ_PREFIXES, writeFailHint } from './storage-selftest.js';

const NOW = 1782900000000;

// Fake IO factory: a tiny in-memory store with knobs to simulate broker/RLS faults.
function makeIo({ rejectWrite = null, hideRead = false, corruptRead = false } = {}) {
  const store = new Map();
  const calls = { writes: [], reads: [], dels: [] };
  return {
    calls,
    write: async (k, v) => { calls.writes.push(k); if (rejectWrite) throw new Error(rejectWrite); store.set(k, v); },
    readAnon: async (k) => {
      calls.reads.push(k);
      if (hideRead) return null;                 // RLS blocks the read (returns empty, not error)
      if (corruptRead) return JSON.stringify({ probe: true, token: 'WRONG' });
      return store.has(k) ? store.get(k) : null;
    },
    del: async (k) => { calls.dels.push(k); store.delete(k); },
  };
}

// ---- happy path: write ok + read matches -> pass ----
{
  const io = makeIo();
  const r = await runStorageSelfTest(io, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.verdict, 'pass');
  assert.equal(r.write, 'ok');
  assert.equal(r.read, 'ok');
  assert.equal(r.cleanup, 'ok');
  assert.ok(r.key.startsWith(SELFTEST_PREFIX), 'canary uses the dedicated prefix');
  // round-trip touched the SAME key for write, read, and delete
  assert.equal(io.calls.writes[0], r.key);
  assert.equal(io.calls.reads[0], r.key);
  assert.equal(io.calls.dels[0], r.key);
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

// ---- write ok but RLS hides the read -> rls-read-blocked (THE 2026-07-02 bug) ----
{
  const io = makeIo({ hideRead: true });
  const r = await runStorageSelfTest(io, NOW);
  assert.equal(r.ok, false);
  assert.equal(r.write, 'ok');
  assert.equal(r.read, 'blocked');
  assert.equal(r.verdict, 'rls-read-blocked');
  assert.match(r.hint, /fix-anon-read-policy\.sql/);
  assert.equal(io.calls.dels[0], r.key, 'still cleans up the canary');
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

// ---- private-prefix invariant matches storage.js ----
assert.deepEqual(PRIVATE_READ_PREFIXES, ['profile:', 'myfeedback:']);

console.log('storage-selftest.test.js: all passed');
