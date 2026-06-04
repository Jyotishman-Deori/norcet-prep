// [A1 slice 48 / tidy-up] Bank storage CRUD — the shared-storage read/write ops
// for question banks (list/load/save/delete + visibility flip). Extracted
// VERBATIM from App.jsx; these are pure storage plumbing (no React, no theme),
// the natural sibling of the already-extracted pure helpers in ./banks.js.
// App and any screen can import them instead of relying on App-local defs.
import { KEYS, KEY_PREFIXES } from './keys.js';
import { safeStorage } from './safe-storage.js';
import { bankVisibility } from './banks.js';

export async function listBanks() {
  let keys = [];
  try {
    const result = await safeStorage.list(KEY_PREFIXES.BANK, true);
    keys = (result && result.keys) ? result.keys : [];
  } catch (e) {
    return [];
  }
  // Fetch all bank blobs in parallel; tolerate per-bank failures
  const banks = await Promise.all(keys.map(async (k) => {
    try {
      const r = await safeStorage.get(k, true);
      if (r && r.value) {
        const parsed = JSON.parse(r.value);
        if (parsed && parsed.id && Array.isArray(parsed.questions)) return parsed;
      }
    } catch (e) { /* skip */ }
    return null;
  }));
  return banks.filter(Boolean).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function loadBank(id) {
  try {
    const r = await safeStorage.get(KEYS.bank(id), true);
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) { /* not found */ }
  return null;
}

export async function saveBank(bank) {
  await safeStorage.set(KEYS.bank(bank.id), JSON.stringify(bank), true);
}

export async function deleteBank(id) {
  try { await safeStorage.delete(KEYS.bank(id), true); return true; }
  catch (e) { return false; }
}

// Visibility-only change. Content version/updatedAt are deliberately left
// untouched (a public/private flip is not a content release). But we DO stamp
// `publishedAt` on the moment a bank first becomes public, so the home
// "What's new" sync can use it as a discovery signal — otherwise newly-shared
// banks would never surface for users until their next version bump.
export async function setBankVisibility(id, visibility) {
  const bank = await loadBank(id);
  if (!bank) return null;
  const newVis = visibility === 'private' ? 'private' : 'public';
  const becomingPublic = newVis === 'public' && bankVisibility(bank) !== 'public';
  const updated = {
    ...bank,
    visibility: newVis,
    ...(becomingPublic ? { publishedAt: Date.now() } : {})
  };
  await saveBank(updated);
  return updated;
}
