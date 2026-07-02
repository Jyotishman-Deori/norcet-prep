// Contract test for src/lib/admin-audit.js — runnable under Node:
//   node src/lib/admin-audit.test.js
import assert from 'node:assert/strict';
import { buildAuditEntry, normalizeEntries, describeEntry, actionMeta, ACTION_META } from './admin-audit.js';

// ---- buildAuditEntry: deterministic with injected now/rand ----
{
  const e = buildAuditEntry({ action: 'coins.grant', target: 'suraj', targetName: 'Suraj', detail: { amount: 500, before: 100, after: 600 }, actorName: 'iyro' }, 1000, 'abc');
  assert.equal(e.id, 'al-1000-abc');
  assert.equal(e.action, 'coins.grant');
  assert.equal(e.target, 'suraj');
  assert.equal(e.ts, 1000);
  assert.deepEqual(e.detail, { amount: 500, before: 100, after: 600 });
}
{
  // string detail wrapped; missing fields -> null; action coerced
  const e = buildAuditEntry({ action: 'user.reset', detail: 'manual' }, 5, 'z');
  assert.deepEqual(e.detail, { note: 'manual' });
  assert.equal(e.target, null);
  assert.equal(e.targetName, null);
  const e2 = buildAuditEntry({}, 5, 'z');
  assert.equal(e2.action, 'unknown');
}

// ---- normalizeEntries: drops junk, newest first ----
{
  const n = normalizeEntries([
    { action: 'a', ts: 10 },
    null, 'junk', { ts: 5 },        // no action -> dropped
    { action: 'b', ts: 30, actorId: 'iyro' },
    { action: 'c', ts: 20 },
  ]);
  assert.equal(n.length, 3);
  assert.deepEqual(n.map(x => x.action), ['b', 'c', 'a']); // ts desc
  assert.equal(n[0].actorId, 'iyro');
  assert.equal(n[2].ts, 10);
}
assert.deepEqual(normalizeEntries(null), []);
{
  // bad ts -> 0, non-object detail dropped to null
  const n = normalizeEntries([{ action: 'x', ts: 'nope', detail: 'str' }]);
  assert.equal(n[0].ts, 0);
  assert.equal(n[0].detail, null);
}

// ---- actionMeta: known + fallback ----
assert.equal(actionMeta('coins.grant').severity, 'high');
assert.equal(actionMeta('faq.create').severity, 'normal');
{
  const m = actionMeta('totally.unknown');
  assert.equal(m.label, 'totally.unknown');
  assert.equal(m.severity, 'normal');
}
// every meta entry has the fields the UI needs
for (const [k, m] of Object.entries(ACTION_META)) {
  assert.ok(m.label && m.icon && m.tone && m.severity, `meta complete: ${k}`);
}

// ---- describeEntry: readable sentences ----
{
  const grant = describeEntry({ action: 'coins.grant', actorName: 'iyro', targetName: 'Suraj', detail: { amount: 500, before: 100, after: 600 } });
  assert.match(grant, /iyro gave 500 .* to Suraj \(100 → 600\)/);
  const deduct = describeEntry({ action: 'coins.deduct', actorName: 'iyro', targetName: 'PK', detail: { amount: 200 } });
  assert.match(deduct, /iyro took 200 .* from PK/);
  assert.match(describeEntry({ action: 'user.reset', actorName: 'iyro', targetName: 'PK' }), /reset PK's progress/);
  assert.match(describeEntry({ action: 'push.send', actorName: 'iyro', detail: { title: 'Hi', sent: 12 } }), /sent a push .*Hi.* to 12 devices/);
  assert.match(describeEntry({ action: 'config.save', actorName: 'iyro', detail: { changed: ['xp.reqScale', 'premium.plans.0.priceInr'] } }), /changed 2 config values/);
  // fallback actor when name/id missing
  assert.match(describeEntry({ action: 'user.delete', targetName: 'X' }), /An admin deleted X's account/);
}

console.log('admin-audit.test.js: all passed');
