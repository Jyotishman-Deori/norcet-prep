// =====================================================================
// src/lib/profile-crypto.js — profile identity + auth crypto (step 35 / A1 s2).
// Extracted VERBATIM from App.jsx. normalizeProfileId (pure id slug), genSalt
// and hashPassword (PBKDF2-SHA256, 100k iter) use only Web Crypto / TextEncoder
// globals — no module state, no React. The A1 roadmap folds these into
// profiles.js; kept separate here because the rest of the profile/guest/merge
// subsystem is deferred to its own focused session (see notes).
// =====================================================================

export function normalizeProfileId(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '').slice(0, 32);
}

export function genSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Permanent, name-independent unique id for a profile (survives renames).
// Prefer crypto.randomUUID; fall back to 16 random bytes for older webviews.
export function genUid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) { /* fall through */ }
  return genSalt();
}

export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}
