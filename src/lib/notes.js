// =====================================================================
// src/lib/notes.js — mindmap note storage + serialization (A1 slice 12)
// Extracted VERBATIM from App.jsx. The note subsystem is shared by the
// (still-inline) Mindmap screen and the Settings screen's backup/restore.
//   storage:  loadMindmapNotes / saveMindmapNotes   (safeStorage, profile-scoped)
//   pure:     sanitizeNoteText / mindmapNoteMatch / mergeNotes /
//             buildNotesExport / parseNotesImport
//   const:    NOTE_MAX_LEN (note textarea cap, used by the inline NoteEditor)
// MINDMAP_NOTES_VERSION + mindmapNotesKey stay module-internal.
// =====================================================================
import { safeStorage } from './safe-storage.js';

const MINDMAP_NOTES_VERSION = 1;
export const NOTE_MAX_LEN = 2000;                 // generous cap; keeps the single blob small
function mindmapNotesKey(profileId) { return 'mindmapnotes:v1:' + (profileId || 'guest'); }

// Trim + clamp note text; returns '' for empty/non-string.
export function sanitizeNoteText(s) {
  if (typeof s !== 'string') return '';
  const t = s.replace(/^\s+/, '').replace(/\s+$/, '');
  return t.length > NOTE_MAX_LEN ? t.slice(0, NOTE_MAX_LEN) : t;
}

export async function loadMindmapNotes(profileId) {
  try {
    const r = await safeStorage.get(mindmapNotesKey(profileId), false);
    if (r && r.value) { const v = JSON.parse(r.value); if (v && v.notes && typeof v.notes === 'object') return v.notes; }
  } catch (e) {}
  return {};
}
export async function saveMindmapNotes(profileId, notes) {
  try {
    await safeStorage.set(mindmapNotesKey(profileId),
      JSON.stringify({ v: MINDMAP_NOTES_VERSION, notes: notes || {}, updatedAt: Date.now() }), false);
  } catch (e) {}
}

// PURE: does this node match the search query (by topic name OR note text)?
// Case-insensitive substring; a blank query never matches.
export function mindmapNoteMatch(query, name, noteText) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return false;
  if (typeof name === 'string' && name.toLowerCase().indexOf(q) !== -1) return true;
  if (typeof noteText === 'string' && noteText.toLowerCase().indexOf(q) !== -1) return true;
  return false;
}

// PURE: merge imported notes into existing; newer updatedAt wins per node.
export function mergeNotes(existing, incoming) {
  const out = {};
  const ex = existing && typeof existing === 'object' ? existing : {};
  const inc = incoming && typeof incoming === 'object' ? incoming : {};
  Object.keys(ex).forEach(id => { out[id] = ex[id]; });
  Object.keys(inc).forEach(id => {
    const a = out[id], b = inc[id];
    if (!b || typeof b.text !== 'string') return;
    if (!a || (b.updatedAt || 0) >= (a.updatedAt || 0)) out[id] = { text: b.text, updatedAt: b.updatedAt || 0 };
  });
  return out;
}

// PURE: build the export blob (object form). `now` injectable for tests.
export function buildNotesExport(profileId, notes, now) {
  return {
    kind: 'norcet-mindmap-notes',
    v: MINDMAP_NOTES_VERSION,
    exportedAt: new Date(now || Date.now()).toISOString(),
    profileId: profileId || 'guest',
    notes: notes && typeof notes === 'object' ? notes : {}
  };
}

// PURE: parse an imported notes file -> a clean notes object. Accepts our own
// export shape ({...,notes}) OR a bare { nodeId: {text,updatedAt} } map.
// Throws on anything that has no usable notes.
export function parseNotesImport(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid file');
  const raw = (parsed.notes && typeof parsed.notes === 'object') ? parsed.notes : parsed;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('No notes found in file');
  const out = {};
  Object.keys(raw).forEach(id => {
    const n = raw[id];
    if (n && typeof n.text === 'string') {
      const text = sanitizeNoteText(n.text);
      if (text) out[id] = { text, updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : 0 };
    }
  });
  if (Object.keys(out).length === 0) throw new Error('No valid notes in file');
  return out;
}
