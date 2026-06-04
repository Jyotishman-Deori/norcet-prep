// =====================================================================
// src/lib/safe-storage.js — storage shim + infra (Pipeline step 35 / A1 s2).
// Extracted VERBATIM from App.jsx. The safeStorage shim wraps the low-level
// kvStorage (src/storage.js — UNCHANGED, not in this bundle); raceStorage is
// the promise-timeout helper used by P1 cloud-sync; checkStorageBridge is the
// IndexedDB liveness probe. None read T / IS_DARK / CURRENT_PROFILE or React.
// NOTE: the A1 roadmap called this 'lib/storage.js' — renamed to safe-storage
// to avoid shadowing the existing src/storage.js (kvStorage). 'withStorage
// Timeout' in the roadmap is this raceStorage (name drift).
// =====================================================================

import * as kvStorage from '../storage';

export const STORAGE_OP_TIMEOUT_MS = 6000;

export function raceStorage(op, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => done({ timeout: true }), ms);
    try {
      Promise.resolve(op()).then(
        (value) => done({ ok: true, value }),
        (error) => done({ error: error || true })
      );
    } catch (error) {
      done({ error });
    }
  });
}

export const safeStorage = {
  get:    (key, shared)        => kvStorage.get(key, shared),
  set:    (key, value, shared) => kvStorage.set(key, value, shared),
  delete: (key, shared)        => kvStorage.del(key, shared),
  list:   (prefix, shared)     => kvStorage.list(prefix, shared),
};

export async function checkStorageBridge() {
  return kvStorage.isAlive();
}
