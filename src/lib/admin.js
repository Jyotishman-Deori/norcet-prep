// =====================================================================
// src/lib/admin.js — admin allow-list client.
//
// READS go straight to the anon-readable `admin_profile_ids` table (the
// `admin_select` policy stays open so checkServerAdmin works everywhere).
//
// WRITES go through the `admin-manage` Edge Function, which verifies the
// passphrase SERVER-SIDE and writes with the service-role key. The anon key
// can no longer write the table directly (locked-down policy), so admin
// membership can't be self-granted from the browser.
// =====================================================================
const URL = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_URL : undefined;
const KEY = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

const FN_URL = URL ? `${URL}/functions/v1/admin-manage` : undefined;

function configured() { return !!(URL && KEY); }
function authHeaders(extra) {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, ...(extra || {}) };
}

// ---- READ: direct anon SELECT (read policy stays open) ----
// Returns [{ profile_id, note, added_at }] (note/added_at may be absent on old rows).
export async function listAdmins() {
  if (!configured()) throw new Error('Supabase not configured');
  const url = `${URL}/rest/v1/admin_profile_ids`
    + `?select=profile_id,note,added_at&order=added_at.asc.nullslast`;
  const r = await fetch(url, { headers: authHeaders({ Accept: 'application/json' }) });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`list admins failed: ${r.status} ${t}`.trim());
  }
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

// ---- WRITES: go through the passphrase-gated Edge Function ----
async function callFn(action, profileId, passphrase, note) {
  if (!FN_URL) throw new Error('Supabase not configured');
  const r = await fetch(FN_URL, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ action, profileId, note: note ?? null, passphrase: passphrase || '' }),
  });
  if (!r.ok) {
    let msg = `${r.status}`;
    try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (e) { /* ignore */ }
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return r.json().catch(() => ({}));
}

export async function addAdmin(profileId, note, passphrase) {
  const id = String(profileId || '').trim();
  if (!id) throw new Error('Enter a profile id');
  return callFn('add', id, passphrase, note || null);
}

export async function removeAdmin(profileId, passphrase) {
  const id = String(profileId || '').trim();
  if (!id) throw new Error('Missing profile id');
  return callFn('remove', id, passphrase);
}
