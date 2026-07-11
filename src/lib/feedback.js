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

// collectClientMeta() — a small, non-identifying device snapshot attached to a
// NEW bug/feedback report so triage is not guesswork (doc 7.2). Mirrors the ua
// capture in errorlog.js. Pure read of navigator/window, fully guarded, so it
// never throws and returns {} in a non-browser (Node test / SSR smoke) context.
// It is the user's OWN device info on their OWN report, so no new consent
// surface; it carries no new personal data beyond what the browser already
// sends with every request.
function collectClientMeta() {
  const meta = {};
  try {
    if (typeof __APP_VERSION__ !== 'undefined') meta.appVersion = String(__APP_VERSION__);
  } catch (e) { /* not injected in this context */ }
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav) {
      if (nav.userAgent) meta.ua = String(nav.userAgent).slice(0, 300);
      if (nav.platform) meta.platform = String(nav.platform).slice(0, 40);
      if (nav.language) meta.lang = String(nav.language).slice(0, 20);
      if (typeof nav.onLine === 'boolean') meta.online = nav.onLine;
    }
    if (typeof window !== 'undefined') {
      if (window.innerWidth && window.innerHeight) meta.viewport = `${window.innerWidth}x${window.innerHeight}`;
      try {
        const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
          || (typeof navigator !== 'undefined' && navigator.standalone === true);
        meta.standalone = !!standalone; // installed PWA vs browser tab
      } catch (e) { /* matchMedia unsupported */ }
    }
  } catch (e) { /* never blocks a report */ }
  return meta;
}

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
  newFeedbackId, collectClientMeta, saveFeedback, listFeedback, deleteFeedback,
  FEEDBACK_STATUSES, updateFeedback,
  loadMyFeedbackIndex, saveMyFeedbackIndex, addToMyFeedbackIndex,
};
