// =====================================================================
// INTERNAL (TEST) ACCOUNTS — pure membership check + session bridge
// =====================================================================
// Test/staff accounts must never pollute the shared surfaces real students
// see: the leaderboard, trending counters, the admin Engagement stats and
// Umami analytics. The flag store is `internalIds` in the live game_config
// row (edited via the admin Live config editor; empty by default), so
// marking a tester needs no redeploy.
//
// profile.id is a display-name slug that CHANGES on rename, so membership
// matches the id OR the durable uid — the owner may list either.
//
// The kv-write broker enforces the same list server-side (leaderboard:,
// analytics:user:, trend: writes are silently skipped for internal
// accounts); these client checks are the polite first line, not the lock.
//
// No React, no storage import here — getConfig() from game-config.js is
// pure (its storage import is lazy inside loadGameConfig only).
// =====================================================================
import { getConfig } from './game-config.js';

// Accept an array or a comma/whitespace-separated string; return a clean,
// lowercased, deduped array. Junk in, [] out.
export function normalizeInternalIds(raw) {
  const parts = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' ? raw.split(/[\s,]+/) : [];
  const out = [];
  for (const p of parts) {
    const v = String(p == null ? '' : p).trim().toLowerCase();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

// True when the profile's id OR uid is on the config's internal list.
export function isInternalAccount(cfg, profile) {
  if (!profile) return false;
  const ids = normalizeInternalIds(cfg && cfg.internalIds);
  if (ids.length === 0) return false;
  const id = String(profile.id || '').toLowerCase();
  const uid = String(profile.uid || '').toLowerCase();
  return (!!id && ids.includes(id)) || (!!uid && ids.includes(uid));
}

// ---- session bridge -------------------------------------------------
// Call sites like trending-store fire-and-forget without a profile in
// scope. App.jsx registers the active profile here; the check itself is
// evaluated LAZILY against getConfig() at call time, so it does not matter
// whether the remote config finished loading before or after login.
let _session = null;

export function setInternalSessionProfile(profile) {
  _session = profile && (profile.id || profile.uid)
    ? { id: profile.id, uid: profile.uid }
    : null;
}

export function isInternalSession() {
  return isInternalAccount(getConfig(), _session);
}
