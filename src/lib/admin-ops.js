// =====================================================================
// src/lib/admin-ops.js — shared ADMIN operations
//
// Auth/status, announcements, and user-administration logic, extracted so BOTH
// apps can use the SAME implementation WITHOUT importing each other:
//   • the student app (App.jsx) — reads announcements for the in-app banner
//   • the standalone ADMIN APP (AdminApp.jsx) — the full admin surface
//
// Everything here is module-level + dependency-light (lib + Supabase env + fetch
// only), copied VERBATIM from App.jsx. NOTE: App.jsx still defines its own copies
// today; it will be migrated to import from here when admin code is stripped from
// the student bundle (a later phase of the admin-app separation). Until then this
// is the single source of truth for the admin app.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS } from './keys.js';
import { listFeedback, deleteFeedback } from './feedback.js';
import { listBanks, deleteBank } from './banks-storage.js';
import { loadProfileIndex, deleteCredentials, clearPendingSync } from './profiles.js';

// Supabase config — Vite injects these at build time from .env / Vercel env.
const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_URL : undefined;
const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

// ---- admin auth / status -------------------------------------------------

// Server-side passphrase check via the admin-manage Edge Function (action
// "verify"). No passphrase/hash lives in the frontend. Throws on network/config
// failure so the caller can show "offline" instead of a false "wrong passphrase".
export async function verifyAdminPassphrase(passphrase) {
  if (!passphrase) return false;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('admin verify unavailable');
  }
  const r = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'verify', passphrase }),
  });
  if (!r.ok) throw new Error(`verify failed: ${r.status}`);
  const j = await r.json();
  return !!(j && j.ok === true);
}

// True iff profileId OR uid appears in the Supabase `admin_profile_ids` table.
// Never throws — any network/parse/config failure resolves to false (fail-closed:
// a broken admin check should reject, not grant).
export async function checkServerAdmin(profileId, uid) {
  if (!profileId && !uid) return false;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const ids = [profileId, uid].filter(Boolean).map(encodeURIComponent);
    const url = `${SUPABASE_URL}/rest/v1/admin_profile_ids`
      + `?profile_id=in.(${ids.join(',')})&select=profile_id`;
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/json',
      },
    });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    return false;
  }
}

// Admin-only shared writes go through the kv-write broker (which authorizes by
// the admin's session token against admin_profile_ids server-side). Throws on
// failure so the admin sees a real error rather than a silent corruption.
export async function adminWriteShared(key, valueJson) {
  await safeStorage.setSharedStrict(key, valueJson);
}
export async function adminDeleteShared(key) {
  await safeStorage.delSharedStrict(key);
}

// ADMIN_STATUS local cache — a UX shortcut so admin stays unlocked across
// reloads. Truthfulness is verified server-side (checkServerAdmin); this read
// can be stale until that runs.
export async function loadAdminStatus() {
  try {
    const result = await safeStorage.get(KEYS.ADMIN_STATUS);
    if (result && result.value) {
      const parsed = JSON.parse(result.value);
      return parsed && parsed.unlocked === true;
    }
  } catch (e) { /* not unlocked */ }
  return false;
}
export async function saveAdminStatus(unlocked) {
  if (unlocked) {
    await safeStorage.set(KEYS.ADMIN_STATUS, JSON.stringify({ unlocked: true, ts: Date.now() }));
  } else {
    try { await safeStorage.delete(KEYS.ADMIN_STATUS); } catch (e) {}
  }
}

// ---- announcements -------------------------------------------------------
// One shared notice (KEYS.ANNOUNCEMENT) + a capped history (admin-write key).
const ANN_HISTORY_KEY = 'announcement:history';

export async function loadAnnouncement() {
  try {
    const r = await safeStorage.get(KEYS.ANNOUNCEMENT, true);
    if (r && r.value) {
      const parsed = JSON.parse(r.value);
      if (parsed && parsed.text) {
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) return null;
        return parsed;
      }
    }
  } catch (e) { /* none */ }
  return null;
}

export async function loadAnnouncementHistory() {
  try {
    const r = await safeStorage.get(ANN_HISTORY_KEY, true);
    const v = r && r.value ? JSON.parse(r.value) : [];
    return Array.isArray(v) ? v.filter(a => a && a.id && a.text) : [];
  } catch (e) { return []; }
}

export async function saveAnnouncement(text, level, adminProfileId, expiresDays = null) {
  const lv = level === 'important' ? 'important' : 'info';
  const days = Number(expiresDays);
  const entry = {
    id: `ann-${Date.now()}`, text: String(text || '').trim(), level: lv, ts: Date.now(),
    expiresAt: Number.isFinite(days) && days > 0 ? Date.now() + days * 86400000 : null,
  };
  await adminWriteShared(KEYS.ANNOUNCEMENT, JSON.stringify(entry));
  try {
    const hist = await loadAnnouncementHistory();
    await adminWriteShared(ANN_HISTORY_KEY, JSON.stringify([entry, ...hist].slice(0, 30)));
  } catch (e) { /* history is best-effort */ }
  return entry;
}

export async function deleteAnnouncementHistoryItem(id) {
  const hist = await loadAnnouncementHistory();
  await adminWriteShared(ANN_HISTORY_KEY, JSON.stringify(hist.filter(a => a.id !== id)));
}

export async function clearAnnouncementHistory() {
  await adminWriteShared(ANN_HISTORY_KEY, JSON.stringify([]));
}

// DELETE is rejected server-side even for admins; OVERWRITE with an inactive
// tombstone instead (empty text → loadAnnouncement returns null for everyone).
export async function clearAnnouncement() {
  await adminWriteShared(KEYS.ANNOUNCEMENT, JSON.stringify({
    id: `ann-cleared-${Date.now()}`, text: '', level: 'info',
    ts: Date.now(), expiresAt: null, cleared: true,
  }));
}

// ---- user administration -------------------------------------------------
export async function adminListUsers() {
  const list = await loadProfileIndex();
  return list
    .map(p => ({
      id: p.id,
      displayName: p.displayName || p.id,
      createdAt: p.createdAt || null,
      lastActive: p.lastActive || null,
    }))
    .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
}

// Remove a profile entirely: private blob, directory entry, credentials, local
// cache, per-user feedback index, every feedback they authored, and every bank
// they uploaded — so nothing orphaned lingers in shared storage.
export async function adminDeleteProfile(id) {
  if (!id) return;
  try { await safeStorage.delete(KEYS.profile(id), true); } catch (e) {}
  try { await safeStorage.delete(KEYS.profileMeta(id), true); } catch (e) {}
  try { await deleteCredentials(id); } catch (e) {}
  try { await safeStorage.delete(KEYS.userdata(id), false); } catch (e) {}
  try { await clearPendingSync(id); } catch (e) {}
  try { await safeStorage.delete(KEYS.myFeedback(id), true); } catch (e) {}
  try {
    const all = await listFeedback();
    const theirs = all.filter(f => f && f.profileId === id);
    await Promise.all(theirs.map(f => deleteFeedback(f.id)));
  } catch (e) {}
  try {
    const allBanks = await listBanks();
    const theirs = allBanks.filter(b => b && b.ownerId === id);
    await Promise.all(theirs.map(b => deleteBank(b.id)));
  } catch (e) {}
}
