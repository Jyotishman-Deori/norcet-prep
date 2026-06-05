// =====================================================================
// src/lib/admin.js — admin allow-list client for the Manage Admins screen.
//
//   listAdmins()  — direct REST read of admin_profile_ids (anon SELECT policy).
//   addAdmin()    — POST to the admin-manage Edge Function, action "add".
//   removeAdmin() — POST to the admin-manage Edge Function, action "remove".
//
// Writes go through the Edge Function so the passphrase is verified SERVER-SIDE
// (against the ADMIN_PASSPHRASE secret) and the row is written with the
// service-role key. A wrong passphrase comes back as HTTP 401 — callers can
// check `err.status === 401` to show "Wrong passphrase".
//
// Supabase config is read from Vite env, same as the rest of the app:
//   VITE_SUPABASE_URL       e.g. https://jabmjyhdfacoikkgmjzl.supabase.co
//   VITE_SUPABASE_ANON_KEY
// =====================================================================
const URL = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_URL : undefined;
const KEY = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

const FN_URL = URL ? `${URL}/functions/v1/admin-manage` : undefined;

function configured() { return !!(URL && KEY); }
function anonHeaders(extra) {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, ...(extra || {}) };
}

// READ: direct anon SELECT. Returns [{ profile_id, note, added_at }] (note and
// added_at may be absent on older rows).
export async function listAdmins() {
  if (!configured()) {
    throw new Error('Supabase not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
  }
  const url = `${URL}/rest/v1/admin_profile_ids`
    + `?select=profile_id,note,added_at&order=added_at.asc.nullslast`;
  const r = await fetch(url, { headers: anonHeaders({ Accept: 'application/json' }) });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    const err = new Error(`list failed: ${r.status} ${t}`.trim());
    err.status = r.status;
    throw err;
  }
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

// WRITES: through the passphrase-gated Edge Function.
async function callFn(action, profileId, passphrase, note) {
  if (!FN_URL) throw new Error('Supabase not configured');
  const r = await fetch(FN_URL, {
    method: 'POST',
    headers: anonHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ action, profileId, passphrase: passphrase || '', note: note ?? null }),
  });
  if (!r.ok) {
    let msg = `${r.status}`;
    try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (e) { /* ignore */ }
    const err = new Error(msg);
    err.status = r.status; // 401 => wrong passphrase
    throw err;
  }
  return r.json().catch(() => ({}));
}

export async function addAdmin(profileId, passphrase, note) {
  const id = String(profileId || '').trim();
  if (!id) throw new Error('Enter a profile id');
  return callFn('add', id, passphrase, note || null);
}

export async function removeAdmin(profileId, passphrase) {
  const id = String(profileId || '').trim();
  if (!id) throw new Error('Missing profile id');
  return callFn('remove', id, passphrase);
}
