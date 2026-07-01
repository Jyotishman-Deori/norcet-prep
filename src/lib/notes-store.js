// =====================================================================
// src/lib/notes-store.js — AI Learning Notes persistence (local-only).
//
// A thin async wrapper over safeStorage, mirroring src/lib/notes.js. The
// notes blob is stored per profile in IndexedDB (shared:false) and is NEVER
// synced to the server — the user is cautioned about this in the popup. All
// reads/writes are defensive (try/catch -> safe fallback) so a briefly
// unreachable storage layer never throws into the UI.
//
// The pure bullet logic lives in note-prompt.js (normalizeBullets) and is
// unit-tested there; these functions are just I/O, kept out of the test path
// (importing safeStorage pulls in idb / import.meta.env, same as notes.js).
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS } from './keys.js';
import { normalizeBullets } from './note-prompt.js';
import { sanitizeName } from './note-companion.js';

const NOTES_VERSION = 1;

// Coerce whatever is on disk into a clean bullets array (<=10). Accepts the
// current { v, bullets:[...] } shape and tolerates a bare array or missing data.
function coerceStored(value) {
  try {
    const v = JSON.parse(value);
    if (Array.isArray(v)) return normalizeBullets(v);
    if (v && Array.isArray(v.bullets)) return normalizeBullets(v.bullets);
  } catch (e) {}
  return [];
}

export async function loadNotes(profileId) {
  try {
    const r = await safeStorage.get(KEYS.notes(profileId), false);
    if (r && r.value) return coerceStored(r.value);
  } catch (e) {}
  return [];
}

export async function saveNotes(profileId, bullets) {
  const clean = normalizeBullets(bullets);
  try {
    await safeStorage.set(
      KEYS.notes(profileId),
      JSON.stringify({ v: NOTES_VERSION, bullets: clean, updatedAt: Date.now() }),
      false
    );
  } catch (e) {}
  return clean;
}

export async function clearNotes(profileId) {
  try {
    await safeStorage.delete(KEYS.notes(profileId), false);
  } catch (e) {}
}

// ---------------------------------------------------------------------
// FEEDBACK ROW (spec Section 12) — the user's interest in a future in-app AI
// chat. Stored locally so the popup remembers their vote and doesn't re-ask;
// the shared signal that reaches the owner is sent separately via feedback.js.
// ---------------------------------------------------------------------
export async function loadAiInterest(profileId) {
  try {
    const r = await safeStorage.get(KEYS.notesAiVote(profileId), false);
    if (r && (r.value === 'up' || r.value === 'down')) return r.value;
  } catch (e) {}
  return null;
}

export async function saveAiInterest(profileId, vote) {
  if (vote !== 'up' && vote !== 'down') return;
  try {
    await safeStorage.set(KEYS.notesAiVote(profileId), vote, false);
  } catch (e) {}
}

// ---------------------------------------------------------------------
// COMPANION NAME (the pet name the user gives the feature) — local, per
// profile. Sanitised (<=10 chars) on the way in AND out so a bad stored value
// can never break the title/greeting. Deliberately NOT touched by clearNotes.
// ---------------------------------------------------------------------
export async function loadCompanionName(profileId) {
  try {
    const r = await safeStorage.get(KEYS.notesName(profileId), false);
    if (r && r.value) return sanitizeName(r.value);
  } catch (e) {}
  return '';
}

export async function saveCompanionName(profileId, name) {
  const clean = sanitizeName(name);
  if (!clean) return '';
  try {
    await safeStorage.set(KEYS.notesName(profileId), clean, false);
  } catch (e) {}
  return clean;
}

// ---------------------------------------------------------------------
// AUTO-SAVE-ON-CLOSE preference — local, per profile. Default OFF (manual
// Store is the baseline; the exit-guard still prevents silent loss when off).
// Stored as 'true'/'false' strings, tolerant parse.
// ---------------------------------------------------------------------
export async function loadNotesAutoSave(profileId) {
  try {
    const r = await safeStorage.get(KEYS.notesAutoSave(profileId), false);
    if (r && r.value != null) return r.value === 'true' || r.value === true;
  } catch (e) {}
  return false;
}

export async function saveNotesAutoSave(profileId, on) {
  try {
    await safeStorage.set(KEYS.notesAutoSave(profileId), on ? 'true' : 'false', false);
  } catch (e) {}
}
