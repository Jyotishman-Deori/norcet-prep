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
import { normalizeProfileId, genUid } from './profile-crypto.js';

// =====================================================================
// STAGE 1 (C-1 + C-2): credentials moved OFF the public kv_shared table.
// Password/DOB hashing + verification now happen server-side in the
// `auth-secure` Edge Function (service-role, RLS-bypassing). The browser
// no longer hashes anything or reads any salt/hash — it only POSTs the
// plaintext password over TLS (exactly like any login API) and gets back
// { ok }. profile_secrets is unreadable by the anon key, so the bulk
// hash-scrape from the audit (C-2) is no longer possible.
// =====================================================================
const SUPABASE_URL_FOR_AUTH = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_URL : undefined;
const SUPABASE_ANON_KEY_FOR_AUTH = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

// POST an action to the auth-secure Edge Function. The anon key is only a
// transport credential (lets the request reach the function); the function
// authorizes nothing on it. Throws on network/config failure so callers can
// tell "couldn't reach the server" apart from "wrong password" ({ ok:false }).
async function callAuthFn(action, body) {
  if (!SUPABASE_URL_FOR_AUTH || !SUPABASE_ANON_KEY_FOR_AUTH) {
    throw new Error('Sign-in service is not configured');
  }
  const r = await fetch(`${SUPABASE_URL_FOR_AUTH}/functions/v1/auth-secure`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY_FOR_AUTH,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY_FOR_AUTH}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...body }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`auth-secure ${action} failed: ${r.status} ${text}`.trim());
  }
  return r.json();
}

// =====================================================================
// STAGE 2: session token plumbing. auth-secure returns a signed token on
// login/signup/reset; we (a) activate it in the storage layer so shared
// writes are authorized, and (b) persist it LOCALLY (per-device) so it
// survives reloads. On boot, loadSession() restores it. On logout,
// saveSession(null) clears it.
// =====================================================================
const AUTH_TOKEN_KEY = 'authToken';

async function persistAuthToken(token) {
  kvStorage.setAuthToken(token || null);
  try { await safeStorage.set(AUTH_TOKEN_KEY, token || '', false); } catch (_) {}
}
async function clearAuthToken() {
  kvStorage.setAuthToken(null);
  try { await safeStorage.delete(AUTH_TOKEN_KEY, false); } catch (_) {}
}
// Re-activate a previously-saved token into the storage layer (called on boot
// via loadSession). Returns the token string or null.
export async function restoreAuthToken() {
  try {
    const r = await safeStorage.get(AUTH_TOKEN_KEY, false);
    if (r && r.value) { kvStorage.setAuthToken(r.value); return r.value; }
  } catch (_) {}
  kvStorage.setAuthToken(null);
  return null;
}

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
  // Read the legacy monolithic list if present — but DON'T delete it yet.
  let legacyArr = null;
  try {
    const legacy = await safeStorage.get(KEYS.PROFILE_INDEX, true);
    if (legacy && legacy.value) {
      const arr = JSON.parse(legacy.value);
      if (Array.isArray(arr) && arr.length > 0) {
        legacyArr = arr;
        // Fold each old entry into a per-user meta key (tolerant of partial
        // failure: a missed entry simply reappears when it's next touched).
        await Promise.all(arr.map(p => p && p.id ? saveProfileMeta({
          id: p.id,
          displayName: p.displayName || p.id,
          createdAt: p.createdAt || null,
          lastActive: p.lastActive || null
        }) : null));
      }
    }
  } catch (e) { /* no legacy list — fine */ }

  let keys = [];
  try {
    const r = await safeStorage.list(KEY_PREFIXES.PROFILE_META, true);
    keys = (r && r.keys) ? r.keys : [];
  } catch (e) { keys = []; }
  const metas = (await Promise.all(keys.map(async k => {
    try {
      const r = await safeStorage.get(k, true);
      if (r && r.value) return JSON.parse(r.value);
    } catch (e) {}
    return null;
  }))).filter(Boolean);

  // #27a — only RETIRE the legacy list once the per-user writes have verifiably
  // landed (metas read back non-empty). Previously the delete ran unconditionally
  // right after the writes, so if those writes were blocked (e.g. by a
  // restrictive RLS policy) we'd delete the ONLY copy of the directory and the
  // admin Users list would be permanently empty ("No profiles yet").
  if (legacyArr && metas.length > 0) {
    try { await safeStorage.delete(KEYS.PROFILE_INDEX, true); } catch (e) {}
  }

  // #27a — if per-user metas are unavailable but the legacy list still exists,
  // fall back to it so the directory still populates instead of showing empty.
  if (metas.length === 0 && legacyArr) {
    return legacyArr
      .filter(p => p && p.id)
      .map(p => ({
        id: p.id,
        displayName: p.displayName || p.id,
        createdAt: p.createdAt || null,
        lastActive: p.lastActive || null
      }));
  }
  return metas;
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

export async function createProfile({ displayName, password, dob, email, importData }) {
  const id = normalizeProfileId(displayName);
  if (!id) throw new Error('Display name needs at least one letter or number');
  if (password.length < 8) throw new Error('Password must be at least 8 characters');
  const normDob = normalizeDob(dob);
  if (!normDob) throw new Error('Pick your date of birth — used to recover your password if you forget it');
  const existing = await loadProfile(id);
  if (existing) throw new Error('That display name is already taken — pick another, or log in instead');
  const uid = genUid();  // permanent, name-independent handle (survives renames)

  // STAGE 1: credentials are created server-side and stored ONLY in the
  // protected profile_secrets table. The browser never sees a hash or salt.
  const reg = await callAuthFn('register', {
    id, uid,
    displayName: displayName.trim(),
    password,
    dob: normDob,
    // Optional, unverified email. Stored ONLY in profile_secrets (never in
    // the public blob below), so it isn't PII-exposed via the anon key.
    email: (email && String(email).trim()) || null,
  });
  if (!reg || reg.ok !== true) {
    if (reg && reg.reason === 'exists') {
      throw new Error('That display name is already taken — pick another, or log in instead');
    }
    throw new Error('Could not create your account. Check your connection and try again.');
  }

  // STAGE 2: activate the session token BEFORE saveProfile — saveProfile does a
  // shared write, which now requires a valid token at the broker.
  await persistAuthToken(reg.token);

  // The PUBLIC profile blob now carries NO credentials — just identity +
  // progress. (passwordHash/salt/dobHash/dobSalt deliberately absent.)
  const profile = {
    id,
    uid,
    displayName: displayName.trim(),
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
  // STAGE 1: password check happens server-side. The function returns ok:false
  // for BOTH "no such account" and "wrong password" — one generic message, so
  // we no longer leak which display names exist (fixes the enumeration finding).
  const res = await callAuthFn('verify', { id, password });
  if (!res || res.ok !== true) {
    throw new Error('Display name or password is incorrect');
  }
  // STAGE 2: activate + persist the session token so shared writes are authorized.
  await persistAuthToken(res.token);
  // Credentials are valid; load the (now hash-free) profile blob for the app.
  const profile = await loadProfile(id);
  if (!profile) {
    throw new Error("Signed in, but your profile data couldn't be loaded. Check your connection and try again.");
  }
  return profile;
}

// DOB-gated recovery. The DOB check now runs server-side against
// profile_secrets; the client only sends name + DOB + new password.
// (DOB is a weak recovery factor — a known C-2 item to harden later.)
export async function recoverPasswordWithDob(displayName, dob, newPassword) {
  const id = normalizeProfileId(displayName);
  if (!id) throw new Error('Enter your display name');
  const normDob = normalizeDob(dob);
  if (!normDob) throw new Error('Pick a valid date of birth');
  if (!newPassword || newPassword.length < 8) throw new Error('New password must be at least 8 characters');
  const res = await callAuthFn('reset', { id, dob: normDob, newPassword });
  if (!res || res.ok !== true) {
    if (res && res.reason === 'no-dob') {
      throw new Error("This profile doesn't have a date of birth on file, so password recovery isn't available. Create a new profile.");
    }
    if (res && res.reason === 'no-account') {
      throw new Error('No profile with that name');
    }
    if (res && res.reason === 'weak-password') {
      throw new Error('New password must be at least 8 characters');
    }
    // dob-mismatch / bad-dob → generic, don't confirm what's on file.
    throw new Error("That date of birth doesn't match what's on file for this profile");
  }
  // STAGE 2: a successful reset proves identity → activate a fresh token so the
  // user is effectively logged in (and any immediate shared write is authorized).
  await persistAuthToken(res.token);
  // Return the current profile blob so callers can proceed if they want.
  const profile = await loadProfile(id);
  return profile || { id };
}

// STAGE 1: re-key the protected credential row when a profile's id (slug)
// changes on rename. Without this, a renamed user would have NO secret under
// their new id and could not log in. Throws on failure so renameProfile can
// abort cleanly before it deletes the old keys.
export async function renameCredentials(oldId, newId, displayName) {
  const res = await callAuthFn('rename', { id: newId, oldId, displayName });
  if (!res || res.ok !== true) {
    if (res && res.reason === 'exists') {
      throw new Error('That name is already taken by another profile. Pick a different name.');
    }
    throw new Error('Could not move your account credentials. Rename cancelled — please try again.');
  }
  return true;
}

// STAGE 1: remove the protected credential row when an account is deleted, so
// the display name can be registered again later. Best-effort (never throws).
export async function deleteCredentials(id) {
  try { await callAuthFn('delete', { id }); } catch (e) { try { log.warn('auth.deleteCredentials', e); } catch (_) {} }
}

export async function loadSession() {
  // STAGE 2: re-activate the saved session token into the storage layer so that
  // shared writes work immediately on boot for an already-logged-in user,
  // before any auth function runs. Safe for guests (no token → stays null).
  try { await restoreAuthToken(); } catch (_) {}
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
    // Logout / switch-profile: clear the session pointer AND the token.
    try { await safeStorage.delete(KEYS.SESSION); } catch (e) {}
    try { await clearAuthToken(); } catch (e) {}
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
