// =====================================================================
// src/lib/notifications.js — Session 2, Feature 6
// In-app notification inbox storage. A per-device JSON array (newest
// first), capped at 50. pushNotification() de-dupes the same `type`
// within a 2-hour window so repeated Home mounts don't spam the inbox.
// Storage only — UI lives in src/screens/notification-center.jsx.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS } from './keys.js';

export async function loadNotifications() {
  try {
    const r = await safeStorage.get(KEYS.NOTIFICATIONS);
    return r && r.value ? JSON.parse(r.value) : [];
  } catch (e) { return []; }
}

export async function saveNotifications(list) {
  try { await safeStorage.set(KEYS.NOTIFICATIONS, JSON.stringify(list)); } catch (e) {}
}

export async function pushNotification(notif) {
  const list = await loadNotifications();
  // De-dupe: don't push the same type twice within 2 hours.
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const alreadyRecent = list.some(n => n.type === notif.type && n.ts > twoHoursAgo);
  if (alreadyRecent) return;
  const updated = [
    { ...notif, id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`, read: false, ts: Date.now() },
    ...list
  ].slice(0, 50); // keep last 50
  await saveNotifications(updated);
}
