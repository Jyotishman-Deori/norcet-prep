// Contract test for src/lib/trash.js — runnable under Node:
//   node src/lib/trash.test.js
import assert from 'node:assert/strict';

const {
  TRASH_RETENTION_DAYS, TRASH_RETENTION_MS, TRASH_MAX,
  trashDaysLeft, normalizeTrash, purgeTrash, addToTrash, takeFromTrash,
  markDeleted, liveItems, deletedItems, restoreIn, dropExpired, dropItem,
} = await import('./trash.js');

const DAY = 86400000;
const NOW = 1783000000000;

// ---- the promised undo window: at least 24 hours ----
assert.ok(TRASH_RETENTION_MS >= DAY, 'retention must honour the 24h minimum');
assert.equal(TRASH_RETENTION_MS, TRASH_RETENTION_DAYS * DAY);

// ---- trash list: add / purge / take ----
{
  let list = addToTrash([], { kind: 'kmap-note', label: 'Cardiac', payload: { key: 'x', text: 'mnemonic' } }, NOW);
  assert.equal(list.length, 1);
  const e = list[0];
  assert.ok(e.id && e.deletedAt === NOW && e.kind === 'kmap-note');
  assert.equal(trashDaysLeft(e.deletedAt, NOW), TRASH_RETENTION_DAYS);
  assert.equal(trashDaysLeft(e.deletedAt, NOW + TRASH_RETENTION_MS - 1), 1, 'last hour still shows 1 day');
  assert.equal(trashDaysLeft(e.deletedAt, NOW + TRASH_RETENTION_MS), 0);

  // newest first
  list = addToTrash(list, { kind: 'kmap-note', label: 'Renal' }, NOW + 1000);
  assert.equal(list[0].label, 'Renal');

  // adding purges expired entries automatically
  const later = NOW + TRASH_RETENTION_MS + 1000;
  const after = addToTrash(list, { kind: 'kmap-note', label: 'Fresh' }, later);
  assert.equal(after.length, 1, 'expired entries are gone for real');
  assert.equal(after[0].label, 'Fresh');

  // purgeTrash alone
  assert.equal(purgeTrash(list, NOW + 1000).length, 2);
  assert.equal(purgeTrash(list, later).length, 0);

  // take pulls one out and leaves the rest
  const { entry, rest } = takeFromTrash(list, list[1].id);
  assert.equal(entry.label, 'Cardiac');
  assert.equal(rest.length, 1);
  assert.equal(takeFromTrash(list, 'nope').entry, null);

  // garbage tolerated
  assert.deepEqual(normalizeTrash(null), []);
  assert.deepEqual(normalizeTrash([null, {}, { id: 'a' }]), []);
}

// ---- trash list: distinct ids under same-ms adds + the cap ----
{
  let list = [];
  for (let i = 0; i < TRASH_MAX + 10; i++) list = addToTrash(list, { kind: 'k', label: `n${i}` }, NOW);
  assert.equal(list.length, TRASH_MAX, 'capped');
  assert.equal(new Set(list.map(e => e.id)).size, list.length, 'ids stay unique within the same millisecond');
}

// ---- soft delete in place (cribs pattern) ----
{
  const cribs = [{ id: 'c1', title: 'Mock #1' }, { id: 'c2', title: 'Mock #2' }];
  const afterDelete = markDeleted(cribs, 'c1', NOW);
  assert.equal(afterDelete.find(c => c.id === 'c1').deletedAt, NOW);
  assert.equal(afterDelete.find(c => c.id === 'c2').deletedAt, undefined);
  // double delete keeps the ORIGINAL deletion time (window can't be extended)
  const again = markDeleted(afterDelete, 'c1', NOW + 5000);
  assert.equal(again.find(c => c.id === 'c1').deletedAt, NOW);

  assert.deepEqual(liveItems(afterDelete).map(c => c.id), ['c2']);
  assert.deepEqual(deletedItems(afterDelete, NOW + 1000).map(c => c.id), ['c1']);
  assert.deepEqual(deletedItems(afterDelete, NOW + TRASH_RETENTION_MS + 1).map(c => c.id), [], 'window closed');

  // restore brings it back to the live list with no deletion residue
  const restored = restoreIn(afterDelete, 'c1');
  assert.deepEqual(liveItems(restored).map(c => c.id), ['c1', 'c2']);
  assert.equal('deletedAt' in restored.find(c => c.id === 'c1'), false);

  // dropExpired hard-removes only the closed-window deletions
  assert.equal(dropExpired(afterDelete, NOW + 1000).length, 2, 'still restorable, kept');
  assert.deepEqual(dropExpired(afterDelete, NOW + TRASH_RETENTION_MS + 1).map(c => c.id), ['c2']);

  // dropItem = "Delete forever" for one id
  assert.deepEqual(dropItem(afterDelete, 'c1').map(c => c.id), ['c2']);
}

console.log('trash.test.js: all assertions passed');
