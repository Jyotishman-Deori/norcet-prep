// =====================================================================
// src/lib/profiles.js — async profile / session / guest-IO subsystem
// (Pipeline step 35 / A1 session 2, continued).
//
// Extracted VERBATIM from App.jsx (no logic edits). This is the app's auth +
// persistence layer: profile load/save (Supabase-canonical, local-cache
// fallback), the pending-sync replay queue, the per-user profile-meta
// directory, account create/authenticate/recover, session persistence, guest
// local-IO, and the legacy-data peek. Depends only on already-extracted
// modules (KEYS/KEY_PREFIXES, runMigrations, log, kvStorage, DEFAULT_DATA, the
// safe-storage shim, and profile-crypto) so it moves as one internally-closed
// unit.
//
// renameProfile is INTENTIONALLY NOT here: it orchestrates across the bank +
// feedback subsystems (listBanks/saveBank/listFeedback/saveFeedback/
// loadMyFeedbackIndex), so it stays in App.jsx to avoid a circular import.
// It consumes this module's loadProfile/saveProfile/loadOneProfileMeta/
// saveProfileMeta/clearPendingSync as normal imports.
//
// _flushInFlight is a module-private re-entry lock (NOT exported).
//
// SAFETY-CRITICAL + UNBUILDABLE IN THE SANDBOX: verified here via transpile +
// esbuild bundle-with-stubs + behaviour tests (verbatim identity of every
// moved block + async round-trips against a mock store). The OWNER must run a
// real `npm run build` and the login/sync/session/guest-merge device pass.
// =====================================================================

import { KEYS, KEY_PREFIXES } from './keys.js';
import { runMigrations } from './migrations.js';
import { log } from './log.js';
import * as kvStorage from '../storage';
import { DEFAULT_DATA } from '../data/seed.js';
import { STORAGE_OP_TIMEOUT_MS, raceStorage, safeStorage } from './safe-storage.js';
import { normalizeProfileId, genSalt, genUid, hashPassword } from './profile-crypto.js';

// =====================================================================
// GUEST MODE  (Pipeline step 26 / P-GUEST, Phase A)
// ---------------------------------------------------------------------
// Anonymous-first: anyone can open the app and use it fully WITHOUT an
// account. A guest is represented by a sentinel profile whose id can never
// collide with a real profile id (real ids are derived from display names;
// '__guest__' contains characters a real id never has). Everything a guest
// does persists to LOCAL IndexedDB only — guest data is NEVER written to
// Supabase (shared:true). A server identity is created only on sign-up,
// where Phase B will offer to merge the guest's local progress.
//
// Guest local blob lives under a fixed local key so it survives reloads and
// is available for Phase B's merge. We reuse KEYS.userdata(GUEST_ID) — the
// SAME local-cache key shape a logged-in user's blob uses — so the data
// shape is identical and the merge is trivial. We do NOT write
// KEYS.profile(GUEST_ID) (that's the Supabase key) — ever.
export const GUEST_ID = '__guest__';

export function makeGuestProfile() {
  // Mirrors the real profile shape closely enough that every `profile.x`
  // read in the UI resolves; isGuest is the discriminator everything else
  // keys off. No dobHash/dobSalt — a guest can't authenticate.
  return { id: GUEST_ID, uid: GUEST_ID, displayName: 'Guest', isGuest: true, createdAt: Date.now() };
}

export function isGuestProfile(p) { return !!(p && (p.isGuest || p.id === GUEST_ID)); }

// Persist the guest's data blob to LOCAL storage only (shared:false). This is
// the guest analogue of saveProfile, minus every Supabase (shared:true) write
// and minus the pending-sync bookkeeping (guests never sync).
export async function saveGuestData(data) {
  try {
    await safeStorage.set(KEYS.userdata(GUEST_ID), JSON.stringify({ id: GUEST_ID, isGuest: true, data }), false);
  } catch (e) { log.error('guest.save.cache', e); }
}

// Load the guest's previously-saved local blob (or null on first run / miss).
export async function loadGuestData() {
  try {
    const cached = await safeStorage.get(KEYS.userdata(GUEST_ID), false);
    if (cached && cached.value) {
      const parsed = JSON.parse(cached.value);
      return parsed && parsed.data ? parsed.data : null;
    }
  } catch (e) { log.warn('guest.load.cache', e); }
  return null;
}

// Lightweight, PRIVACY-RESPECTING guest signal. Local-only counters used to
// drive the sign-in nudges and (later) measure explore->convert. No PII, no
// cross-session fingerprint, nothing sent anywhere. Stored under a single
// local kv key. Read defensively (absent -> fresh).
export const GUEST_META_KEY = 'guestmeta:v1';

export async function loadGuestMeta() {
  try {
    const r = await safeStorage.get(GUEST_META_KEY, false);
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) {}
  return { firstSeen: Date.now(), quizzesAttempted: 0, signedUp: false, bannerDismissed: false };
}

export async function saveGuestMeta(meta) {
  try { await safeStorage.set(GUEST_META_KEY, JSON.stringify(meta), false); } catch (e) {}
}

// PHASE B: end the guest session by deleting the local guest blob. Called after
// a sign-up MERGE (kept) OR discard. Removing it is the "already merged" guard:
// once cleared, loadGuestData() returns null, so a later logout->login can't
// re-offer/re-merge stale guest data — only genuinely NEW guest activity (a
// fresh blob built after this point) would qualify again.
export async function clearGuestData() {
  try { await safeStorage.delete(KEYS.userdata(GUEST_ID), false); } catch (e) { try { log.warn('guest.clear', e); } catch (_) {} }
}

// Backfill a permanent uid onto profiles created before uids existed. Runs on
// the canonical (network) load path only and persists once; after that the
// stored blob carries the uid so this is a no-op. Best-effort: a failed persist
// just retries on the next online load. We do NOT backfill on the offline boot
// path (loadProfileCached) so the instant-paint read stays network-free.
async function ensureUid(profile) {
  if (!profile) return profile;
  if (profile.uid) return profile;
  if (isGuestProfile(profile)) { profile.uid = GUEST_ID; return profile; }
  const withUid = { ...profile, uid: genUid() };
  try { await saveProfile(withUid); } catch (e) { /* retry next load */ }
  return withUid;
}

export async function loadProfile(id) {
  // Try Supabase (canonical) first.
  try {
    const result = await safeStorage.get(KEYS.profile(id), true);
    if (result && result.value) {
      const profile = JSON.parse(result.value);
      // Refresh the local cache so a subsequent offline reload still
      // returns the latest known-good copy.
      try {
        await safeStorage.set(KEYS.userdata(id), result.value, false);
      } catch (e) { /* cache refresh is best-effort */ }
      return await ensureUid(profile);
    }
  } catch (e) { log.warn('storage.profileLoad.supabase', e); /* fall through to cache */ }
  // Supabase didn't return a profile — either offline, timed out, or
  // genuinely not there. Fall back to the local cache.
  try {
    const cached = await safeStorage.get(KEYS.userdata(id), false);
    if (cached && cached.value) return await ensureUid(JSON.parse(cached.value));
  } catch (e) { log.warn('storage.profileLoad.cache', e); /* no cache either */ }
  return null;
}

// P-NAV (Bug 1) — LOCAL-FIRST profile read for the BOOT path only. Reads the
// IndexedDB cache (KEYS.userdata, shared:false) WITHOUT touching the network,
// so a returning user's account paints instantly with zero Supabase wait (and
// therefore no login-screen flash). The boot effect calls this first, commits
// the cached account, then calls loadProfile() in the BACKGROUND to reconcile
// against the canonical Supabase copy (last-write-wins, as before). Returns the
// parsed profile or null on a cache miss / error.
export async function loadProfileCached(id) {
  try {
    const cached = await safeStorage.get(KEYS.userdata(id), false);
    if (cached && cached.value) return JSON.parse(cached.value);
  } catch (e) { log.warn('storage.profileLoad.cacheOnly', e); }
  return null;
}

// Saves the full profile blob. Last-write-wins on the SAME profile is fine — but
// we debounce writes at the call site so rapid `setData` bursts coalesce into a
// single network write, drastically reducing the chance of multi-device clobber.
export async function saveProfile(profile) {
  if (!profile || !profile.id) return;
  const payload = JSON.stringify(profile);
  // 1) Write-through to the local IndexedDB cache FIRST. This is fast,
  //    cannot fail meaningfully offline, and means even if the Supabase
  //    write below times out the user's progress survives a reload.
  try { await safeStorage.set(KEYS.userdata(profile.id), payload, false); }
  catch (e) { log.error('storage.profileSave.cache', e); }
  // 2) Mark this profile as pending before attempting the Supabase write.
  //    If the Supabase write succeeds we clear the flag; if not, the next
  //    `flushPendingSync` (on reconnect or boot) will replay this write.
  try { await markPendingSync(profile.id); } catch (e) {}
  // 3) Attempt the canonical Supabase write. raceStorage gives us a clear
  //    success/timeout/error signal that safeStorage flattens away.
  const r = await raceStorage(
    () => kvStorage.set(KEYS.profile(profile.id), payload, true),
    STORAGE_OP_TIMEOUT_MS
  );
  if (r.ok) {
    try { await clearPendingSync(profile.id); } catch (e) {}
  }
  // On timeout/error: pending flag remains set, flush handler will retry.
}

// Returns the current pending-sync map: { [profileId]: timestamp }. Safe to
// call when the key doesn't exist yet — returns {}.
export async function getPendingSync() {
  try {
    const r = await safeStorage.get(KEYS.PENDING_SYNC, false);
    if (r && r.value) {
      const obj = JSON.parse(r.value);
      return (obj && typeof obj === 'object') ? obj : {};
    }
  } catch (e) {}
  return {};
}

export async function markPendingSync(profileId) {
  const obj = await getPendingSync();
  obj[profileId] = Date.now();
  try { await safeStorage.set(KEYS.PENDING_SYNC, JSON.stringify(obj), false); } catch (e) {}
}

export async function clearPendingSync(profileId) {
  const obj = await getPendingSync();
  if (!(profileId in obj)) return;
  delete obj[profileId];
  try {
    if (Object.keys(obj).length === 0) {
      await safeStorage.delete(KEYS.PENDING_SYNC, false);
    } else {
      await safeStorage.set(KEYS.PENDING_SYNC, JSON.stringify(obj), false);
    }
  } catch (e) {}
}

// Replays any pending local writes up to Supabase. Called on the `online`
// event, on boot once after the initial load settles, and after any
// explicit user action that would benefit from a sync attempt. Idempotent:
// each successful push clears that profile's pending flag; failures leave
// the flag for the next attempt. Re-entry-safe via an in-memory lock so a
// rapid online/offline flap doesn't spawn parallel flushes.
let _flushInFlight = false;

export async function flushPendingSync() {
  if (_flushInFlight) return;
  _flushInFlight = true;
  try {
    const pending = await getPendingSync();
    const ids = Object.keys(pending);
    if (ids.length === 0) return;
    for (const id of ids) {
      try {
        const cached = await safeStorage.get(KEYS.userdata(id), false);
        if (!cached || !cached.value) {
          // Nothing in cache to flush — drop the stale flag.
          await clearPendingSync(id);
          continue;
        }
        const r = await raceStorage(
          () => kvStorage.set(KEYS.profile(id), cached.value, true),
          STORAGE_OP_TIMEOUT_MS
        );
        if (r.ok) await clearPendingSync(id);
        // r.timeout / r.error: leave flag, retry next time.
      } catch (e) { /* leave flag set */ }
    }
  } finally {
    _flushInFlight = false;
  }
}

export async function loadOneProfileMeta(id) {
  try {
    const r = await safeStorage.get(KEYS.profileMeta(id), true);
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) { /* none */ }
  return null;
}

export async function saveProfileMeta(meta) {
  if (!meta || !meta.id) return;
  try { await safeStorage.set(KEYS.profileMeta(meta.id), JSON.stringify(meta), true); } catch (e) {}
}

// List every profile's lightweight metadata. Each user has their own key, so
// listing here means a simple prefix scan + parallel fetch — no contention.
// One-time migration: if the legacy monolithic `profile_index` key still
// exists, fold its entries into per-user meta keys and remove it. Subsequent
// reads use only the new keys.
export async function listProfileMetas() {
  // Migrate the legacy list, if present, then continue. The migration writes
  // one new key per old entry, so it's tolerant of partial failures: any
  // entry that was missed will simply not appear until it's touched again,
  // at which point it gets written fresh.
  try {
    const legacy = await safeStorage.get(KEYS.PROFILE_INDEX, true);
    if (legacy && legacy.value) {
      const arr = JSON.parse(legacy.value);
      if (Array.isArray(arr) && arr.length > 0) {
        await Promise.all(arr.map(p => p && p.id ? saveProfileMeta({
          id: p.id,
          displayName: p.displayName || p.id,
          createdAt: p.createdAt || null,
          lastActive: p.lastActive || null
        }) : null));
        try { await safeStorage.delete(KEYS.PROFILE_INDEX, true); } catch (e) {}
      }
    }
  } catch (e) { /* no legacy list — fine */ }

  let keys = [];
  try {
    const r = await safeStorage.list(KEY_PREFIXES.PROFILE_META, true);
    keys = (r && r.keys) ? r.keys : [];
  } catch (e) { return []; }
  const metas = await Promise.all(keys.map(async k => {
    try {
      const r = await safeStorage.get(k, true);
      if (r && r.value) return JSON.parse(r.value);
    } catch (e) {}
    return null;
  }));
  return metas.filter(Boolean);
}

// Back-compat shim: anywhere old code called loadProfileIndex(), keep returning
// the unified list. Internally it now reads the per-user keys.
export async function loadProfileIndex() {
  return listProfileMetas();
}

// Upsert a user's directory entry. Writes ONLY that user's key — never a
// shared list — so concurrent signups/logins do not clobber each other.
export async function upsertProfileIndex(entry) {
  if (!entry || !entry.id) return;
  const prev = await loadOneProfileMeta(entry.id);
  await saveProfileMeta({
    id: entry.id,
    displayName: entry.displayName,
    createdAt: entry.createdAt || (prev && prev.createdAt) || Date.now(),
    lastActive: entry.lastActive || (prev && prev.lastActive) || Date.now()
  });
}

// Bump lastActive for one user. Per-user key + per-session throttle (see App)
// keeps writes tiny and contention-free.
export async function touchProfileActivity(id) {
  if (!id) return;
  const prev = await loadOneProfileMeta(id);
  if (!prev) return;
  await saveProfileMeta({ ...prev, lastActive: Date.now() });
}

// DOB normalization — accept what the date input gives us (YYYY-MM-DD)
// and reject anything else. Hashed separately from the password so the
// profile blob never carries a plaintext date of birth.
export function normalizeDob(dob) {
  if (!dob) return null;
  const s = String(dob).trim();
  // YYYY-MM-DD only — that's what <input type="date"> produces.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export async function createProfile({ displayName, password, dob, importData }) {
  const id = normalizeProfileId(displayName);
  if (!id) throw new Error('Display name needs at least one letter or number');
  if (password.length < 4) throw new Error('Password must be at least 4 characters');
  const normDob = normalizeDob(dob);
  if (!normDob) throw new Error('Pick your date of birth — used to recover your password if you forget it');
  const existing = await loadProfile(id);
  if (existing) throw new Error('That display name is already taken — pick another, or log in instead');
  const salt = genSalt();
  const passwordHash = await hashPassword(password, salt);
  // DOB gets its OWN salt so a compromised password salt doesn't help an
  // attacker brute-force the DOB (dates have low entropy).
  const dobSalt = genSalt();
  const dobHash = await hashPassword(normDob, dobSalt);
  const profile = {
    id,
    uid: genUid(),  // permanent, name-independent handle (survives renames)
    displayName: displayName.trim(),
    passwordHash,
    salt,
    dobHash,
    dobSalt,
    createdAt: Date.now(),
    // Run migrations on legacy/imported data so an old shape gets walked
    // forward to current before it's stored. DEFAULT_DATA is already at
    // current version so doesn't need it.
    data: importData ? runMigrations(importData) : DEFAULT_DATA
  };
  await saveProfile(profile);
  await upsertProfileIndex({ ...profile, lastActive: Date.now() });
  return profile;
}

export async function authenticateProfile(displayName, password) {
  const id = normalizeProfileId(displayName);
  if (!id) throw new Error('Enter your display name');
  const profile = await loadProfile(id);
  if (!profile) throw new Error('No profile with that name. Check the spelling or create a new profile.');
  const hash = await hashPassword(password, profile.salt);
  if (hash !== profile.passwordHash) throw new Error('Incorrect password');
  return profile;
}

// Older profiles that pre-date the DOB requirement will have no dobHash —
// for those, recovery is impossible and we say so honestly.
export async function recoverPasswordWithDob(displayName, dob, newPassword) {
  const id = normalizeProfileId(displayName);
  if (!id) throw new Error('Enter your display name');
  const profile = await loadProfile(id);
  if (!profile) throw new Error('No profile with that name');
  if (!profile.dobHash || !profile.dobSalt) {
    throw new Error("This profile doesn't have a date of birth on file, so password recovery isn't available. Create a new profile.");
  }
  const normDob = normalizeDob(dob);
  if (!normDob) throw new Error('Pick a valid date of birth');
  const tryHash = await hashPassword(normDob, profile.dobSalt);
  if (tryHash !== profile.dobHash) throw new Error("That date of birth doesn't match what's on file for this profile");
  if (!newPassword || newPassword.length < 4) throw new Error('New password must be at least 4 characters');
  const newSalt = genSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  const updated = { ...profile, salt: newSalt, passwordHash: newHash };
  await saveProfile(updated);
  return updated;
}

export async function loadSession() {
  try {
    const result = await safeStorage.get(KEYS.SESSION);
    if (result && result.value) return JSON.parse(result.value);
  } catch (e) { /* not found */ }
  return null;
}

export async function saveSession(session) {
  if (session) {
    await safeStorage.set(KEYS.SESSION, JSON.stringify(session));
  } else {
    try { await safeStorage.delete(KEYS.SESSION); } catch (e) {}
  }
}

// Returns legacy on-device data IF it represents real progress worth migrating
export async function peekLegacyData() {
  try {
    const result = await safeStorage.get(KEYS.USERDATA);
    if (result && result.value) {
      const parsed = JSON.parse(result.value);
      const attempted = parsed?.stats?.totalAttempted || 0;
      const customs = parsed?.customQuestions?.length || 0;
      const bookmarks = parsed?.bookmarks?.length || 0;
      if (attempted > 0 || customs > 0 || bookmarks > 0) {
        return parsed;
      }
    }
  } catch (e) { /* none */ }
  return null;
}
