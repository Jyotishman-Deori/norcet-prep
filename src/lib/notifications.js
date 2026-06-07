// =====================================================================
// src/lib/notifications.js — Session 2 Feature 6, extended by #7
// In-app notification inbox storage + categorisation helpers.
//
// Storage model (UNCHANGED): a per-device JSON array (newest first),
// capped at 50, persisted under KEYS.NOTIFICATIONS. pushNotification()
// de-dupes the same `type` within a window (default 2h) so repeated Home
// mounts don't spam the inbox; slow-cadence items (weekly insights /
// achievements) can pass a longer `dedupeMs`.
//
// #7 Notification Panel adds CATEGORIES. Every notification belongs to one
// of four categories — reminders / achievements / insights / updates —
// derived from its `type` (or an explicit `category` override). Stored
// notifications need NO new field for this to work (categoryOf() falls
// back to the type map), so old persisted entries remain valid.
// UI lives in src/screens/notification-center.jsx.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS } from './keys.js';

// ---- Categories ------------------------------------------------------
// Order matters: Reminders first (most actionable), then the rest.
export const CATEGORY_ORDER = ['reminders', 'achievements', 'insights', 'updates'];
export const CATEGORY_LABELS = {
  reminders:    'Reminders',
  achievements: 'Achievements',
  insights:     'Insights',
  updates:      'Updates',
};

// type -> category. New types added by #7 generators are mapped here.
// Anything unmapped falls through to 'updates' (the catch-all bucket).
const TYPE_CATEGORY = {
  // Reminders (actionable — Review-Due card visual language)
  spaced_due:      'reminders',
  daily_reminder:  'reminders',
  doubt_nudge:     'reminders',
  topic_reminder:  'reminders',
  exam_countdown:  'reminders',
  // Achievements (celebratory)
  streak:          'achievements',
  accuracy_up:     'achievements',
  topic_mastered:  'achievements',
  doubt_milestone: 'achievements',
  session_done:    'achievements',
  // Insights (mentor observations)
  consistency:     'insights',
  exam_readiness:  'insights',
  improvement:     'insights',
  pattern:         'insights',
  weekly:          'insights',
  // Updates (system / content / admin)
  admin:           'updates',
  feature:         'updates',
  content_update:  'updates',
  faq_reply:       'updates',
  feedback_reply:  'updates',
};

// Resolve a notification's category: explicit override wins, else type map,
// else the safe catch-all so nothing is ever dropped from the panel.
export function categoryOf(notif) {
  if (!notif) return 'updates';
  if (notif.category && CATEGORY_LABELS[notif.category]) return notif.category;
  return TYPE_CATEGORY[notif.type] || 'updates';
}

// ---- Load / save -----------------------------------------------------
export async function loadNotifications() {
  try {
    const r = await safeStorage.get(KEYS.NOTIFICATIONS);
    const v = r && r.value ? JSON.parse(r.value) : [];
    return Array.isArray(v) ? v.filter(n => n && typeof n === 'object' && n.id) : [];
  } catch (e) { return []; }
}

export async function saveNotifications(list) {
  try { await safeStorage.set(KEYS.NOTIFICATIONS, JSON.stringify(list || [])); } catch (e) {}
}

// Push a new notification. De-dupes the same `type` within `dedupeMs`
// (default 2 hours) so re-mounts don't spam; pass a larger window for
// slow-cadence items. Any extra fields on `notif` (count, timeContext,
// reason, subject, accent, category, action) are preserved verbatim.
export async function pushNotification(notif) {
  const list = await loadNotifications();
  const dedupeMs = notif.dedupeMs != null ? notif.dedupeMs : 2 * 60 * 60 * 1000;
  const cutoff = Date.now() - dedupeMs;
  const alreadyRecent = list.some(n => n.type === notif.type && n.ts > cutoff);
  if (alreadyRecent) return;
  const { dedupeMs: _omit, ...rest } = notif;
  const updated = [
    { ...rest, id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`, read: false, ts: Date.now() },
    ...list,
  ].slice(0, 50); // keep last 50
  await saveNotifications(updated);
}

// ---- Pure list transforms (used by the panel) -----------------------
export const unreadCount = (list) => (list || []).filter(n => !n.read).length;

// { reminders, achievements, insights, updates } -> unread count per category.
export function unreadByCategory(list) {
  const out = { reminders: 0, achievements: 0, insights: 0, updates: 0 };
  for (const n of (list || [])) {
    if (n.read) continue;
    const c = categoryOf(n);
    if (out[c] != null) out[c] += 1;
  }
  return out;
}

export const markRead    = (list, id) => (list || []).map(n => n.id === id ? { ...n, read: true } : n);
export const markAllRead = (list)     => (list || []).map(n => ({ ...n, read: true }));
export const dismissOne  = (list, id) => (list || []).filter(n => n.id !== id);
