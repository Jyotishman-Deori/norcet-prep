// =====================================================================
// src/lib/data-export.js — "Export my data" (doc 5.2, local self-serve).
//
// Assembles everything the app stores about a user on THIS device into one
// JSON object they can download. Fully client-side: no endpoint, nothing
// leaves the device except by the user's own download. This is the free,
// no-server version of the deferred GDPR export endpoint (P-09).
//
// The key list is a strict ALLOWLIST (never a wildcard scan of storage), so a
// session token or any secret can never end up in the file. `data-export.test.js`
// asserts that none of the manifest keys collide with the device/auth keys.
//
// Pure: the caller (settings.jsx) fetches each key via safeStorage and passes
// the parsed values in; this module only defines WHAT to gather and shapes the
// final object, so it stays Node-testable.
// =====================================================================
import { KEYS, KEY_PREFIXES } from './keys.js';

export const EXPORT_VERSION = 1;

// Allowlist of the user's own LOCAL (shared:false) data slices. label = a
// friendly, stable name in the file; key(pid) = the storage key to read.
export const EXPORT_MANIFEST = [
  { label: 'progress',          key: (pid) => KEYS.userdata(pid) },   // stats, streaks, bookmarks, revision, mistakes, preferences
  { label: 'studyPlan',         key: (pid) => KEYS.studyPlan(pid) },
  { label: 'favourites',        key: (pid) => `${KEY_PREFIXES.FAVORITES}${pid}` },
  { label: 'notes',             key: (pid) => KEYS.notes(pid) },
  { label: 'companionName',     key: (pid) => KEYS.notesName(pid) },
  { label: 'recentSearches',    key: (pid) => KEYS.searchRecent(pid) },
  { label: 'assistantChat',     key: (pid) => KEYS.assistantChat(pid) },
  { label: 'calculatorHistory', key: (pid) => KEYS.nursingCalc(pid) },
];

// Device / auth keys that must NEVER appear in an export, even if a future
// manifest edit slips. The test cross-checks the manifest against this list.
export const EXPORT_NEVER_KEYS = [
  KEYS.SESSION, KEYS.ADMIN_STATUS, KEYS.HEALTH,
  KEYS.PUSH_SUB_TOKEN, KEYS.PUSH_SUB_ID, KEYS.WAITLIST_IDENTITY,
];

// Strip anything that even looks like a credential from the profile object
// before it goes in the file (defence in depth; the profile should carry none).
const SECRET_HINT = /(token|secret|password|passphrase|hash|hmac|session|otp|\bpin\b)/i;
export function sanitizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const out = {};
  for (const k of Object.keys(profile)) {
    if (SECRET_HINT.test(k)) continue;
    out[k] = profile[k];
  }
  return out;
}

// buildExport({ profile, entries, now }) -> the final JSON-able object.
// `entries` is { label -> already-parsed value | null } fetched by the caller.
export function buildExport({ profile, entries, now } = {}) {
  return {
    _meta: {
      app: 'NurseHolic',
      kind: 'user-data-export',
      version: EXPORT_VERSION,
      exportedAt: new Date(typeof now === 'number' ? now : Date.now()).toISOString(),
      note: 'A snapshot of your NurseHolic data from this device, for your own records. It contains no passwords or login tokens.',
    },
    profile: sanitizeProfile(profile),
    data: entries && typeof entries === 'object' ? entries : {},
  };
}

// exportFilename(now) -> 'nurseholic-data-YYYY-MM-DD.json'
export function exportFilename(now) {
  const d = new Date(typeof now === 'number' ? now : Date.now());
  return `nurseholic-data-${d.toISOString().slice(0, 10)}.json`;
}
