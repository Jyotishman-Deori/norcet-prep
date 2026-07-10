// =====================================================================
// TRASH — pure "recently deleted" math (undo window for user deletes)
// =====================================================================
// Deletion is a STATE, not an event: everything a student deletes stays
// restorable for TRASH_RETENTION_DAYS before it is gone for real. Two
// storage patterns share this one pure module:
//
//   1. TRASH LIST (small items — e.g. Knowledge Map notes): the deleted
//      payload moves into `data.trash` in the synced blob:
//        { id, kind, label, sub, payload, deletedAt }
//      addToTrash / purgeTrash / takeFromTrash operate on that list.
//
//   2. SOFT DELETE IN PLACE (big items — e.g. saved Crib Sheets, which
//      live in their own LOCAL store and would bloat the synced blob):
//      the item stays in its own list and just gains `deletedAt`.
//      markDeleted / liveItems / deletedItems / restoreIn / dropExpired
//      operate on any list of {id, deletedAt?} items.
//
// No React, no storage. `now` is injectable for tests.
// =====================================================================

export const TRASH_RETENTION_DAYS = 7;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 86400000;
// The synced trash list is capped so a delete spree can't bloat the blob.
export const TRASH_MAX = 60;

const expired = (deletedAt, now) =>
  typeof deletedAt !== 'number' || now - deletedAt >= TRASH_RETENTION_MS;

// Whole days of undo left (ceil, min 0) — for "6 days left" copy.
export function trashDaysLeft(deletedAt, now = Date.now()) {
  if (typeof deletedAt !== 'number') return 0;
  return Math.max(0, Math.ceil((deletedAt + TRASH_RETENTION_MS - now) / 86400000));
}

// ---- pattern 1: the synced trash list --------------------------------

export function normalizeTrash(raw) {
  return Array.isArray(raw)
    ? raw.filter(e => e && e.id && e.kind && typeof e.deletedAt === 'number')
    : [];
}

// Entries older than the retention window are gone for real.
export function purgeTrash(raw, now = Date.now()) {
  return normalizeTrash(raw).filter(e => !expired(e.deletedAt, now));
}

// Newest first; purged + capped on every add.
let _seq = 0;
export function addToTrash(raw, { kind, label, sub, payload }, now = Date.now()) {
  const entry = {
    id: `t-${now}-${(_seq = (_seq + 1) % 1000)}`,
    kind: String(kind || 'item'),
    label: String(label || 'Deleted item'),
    sub: sub ? String(sub) : '',
    payload: payload ?? null,
    deletedAt: now,
  };
  return [entry, ...purgeTrash(raw, now)].slice(0, TRASH_MAX);
}

// Pull one entry out (for restore or delete-forever).
export function takeFromTrash(raw, id) {
  const list = normalizeTrash(raw);
  const entry = list.find(e => e.id === id) || null;
  return { entry, rest: list.filter(e => e.id !== id) };
}

// ---- pattern 2: soft delete in place ---------------------------------

// Mark one item deleted (no-op if the id is unknown or already deleted).
export function markDeleted(list, id, now = Date.now()) {
  return (Array.isArray(list) ? list : []).map(it =>
    it && it.id === id && typeof it.deletedAt !== 'number' ? { ...it, deletedAt: now } : it
  );
}

// The visible items: never deleted. (Expired deleted ones are removed by
// dropExpired on load, so callers can chain: liveItems(dropExpired(list)).)
export function liveItems(list) {
  return (Array.isArray(list) ? list : []).filter(it => it && typeof it.deletedAt !== 'number');
}

// The restorable items: deleted, still inside the retention window.
export function deletedItems(list, now = Date.now()) {
  return (Array.isArray(list) ? list : [])
    .filter(it => it && typeof it.deletedAt === 'number' && !expired(it.deletedAt, now))
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

// Undelete one item.
export function restoreIn(list, id) {
  return (Array.isArray(list) ? list : []).map(it => {
    if (!it || it.id !== id) return it;
    const { deletedAt, ...rest } = it;
    return rest;
  });
}

// Hard-remove everything whose undo window has closed (call on load),
// or one specific id ("Delete forever").
export function dropExpired(list, now = Date.now()) {
  return (Array.isArray(list) ? list : []).filter(
    it => it && (typeof it.deletedAt !== 'number' || !expired(it.deletedAt, now))
  );
}
export function dropItem(list, id) {
  return (Array.isArray(list) ? list : []).filter(it => it && it.id !== id);
}
