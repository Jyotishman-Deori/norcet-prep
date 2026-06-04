// =====================================================================
// src/lib/feedback.js — feedback / bug-report storage subsystem
//   (extracted verbatim from App.jsx). Reports live in shared storage under
//   `feedback:{id}`; a per-user index (`myfeedback:{profileId}`) lets a device
//   fetch only its own reports without pulling the whole shared inbox.
//   The theme-coupled `feedbackStatusMeta` did NOT move here — it became
//   statusMetaFor()/useStatusMeta() in lib/theme-helpers.js.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS, KEY_PREFIXES } from './keys.js';

const newFeedbackId = () => `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function saveFeedback(entry) {
  await safeStorage.set(KEYS.feedback(entry.id), JSON.stringify(entry), true);
}

async function listFeedback() {
  let keys = [];
  try {
    const r = await safeStorage.list(KEY_PREFIXES.FEEDBACK, true);
    keys = (r && r.keys) ? r.keys : [];
  } catch (e) { return []; }
  const items = await Promise.all(keys.map(async k => {
    try {
      const r = await safeStorage.get(k, true);
      if (r && r.value) return JSON.parse(r.value);
    } catch (e) {}
    return null;
  }));
  return items.filter(Boolean).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

async function deleteFeedback(id) {
  try { await safeStorage.delete(KEYS.feedback(id), true); } catch (e) {}
}

// Admin reply + status live on the same feedback entry (kept lightweight).
const FEEDBACK_STATUSES = [
  { id: 'looking', label: 'Looking into it' },
  { id: 'fixed',   label: 'Fixed' },
  { id: 'wontfix', label: "Won't fix" },
  { id: 'thanks',  label: 'Thanks' }
];

// Merge an admin reply/status onto an entry and persist it.
async function updateFeedback(entry, patch) {
  const updated = { ...entry, ...patch, repliedAt: Date.now() };
  await saveFeedback(updated);
  return updated;
}

// ---- Per-user feedback index ----
// A small per-user pointer list so a device fetches only its OWN reports, rather
// than pulling the entire shared inbox down and filtering. Other users' feedback
// never reaches the device.

async function loadMyFeedbackIndex(profileId) {
  // Array of feedback ids, or null if the index has never been written.
  try {
    const r = await safeStorage.get(KEYS.myFeedback(profileId), true);
    if (r && r.value) {
      const parsed = JSON.parse(r.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* none yet */ }
  return null;
}

async function saveMyFeedbackIndex(profileId, ids) {
  try { await safeStorage.set(KEYS.myFeedback(profileId), JSON.stringify(ids), true); } catch (e) {}
}

// Record a freshly-submitted report against its author.
async function addToMyFeedbackIndex(profileId, id) {
  if (!profileId || !id) return;
  const existing = (await loadMyFeedbackIndex(profileId)) || [];
  if (!existing.includes(id)) {
    existing.push(id);
    await saveMyFeedbackIndex(profileId, existing);
  }
}

export {
  newFeedbackId, saveFeedback, listFeedback, deleteFeedback,
  FEEDBACK_STATUSES, updateFeedback,
  loadMyFeedbackIndex, saveMyFeedbackIndex, addToMyFeedbackIndex,
};
