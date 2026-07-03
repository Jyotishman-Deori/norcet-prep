// =====================================================================
// STORAGE LAYER (Stage 2 — Supabase-backed shared scope)
//
//   Same public API as before. App.jsx didn't change.
//
//     shared = false (default)
//       Truly local data: session pointer, theme, onboarding flag, admin
//       unlock, etc. Lives in IndexedDB on the device. Works offline.
//
//     shared = true
//       Multi-user data: profiles, profile metadata, banks, feedback,
//       announcements. Lives in Supabase (Postgres) in a single
//       `kv_shared` table. Visible across all users and devices —
//       same behaviour as the original Claude artifact.
//
//   Contract (unchanged from Stage 1):
//     get(key, shared?)        -> { key, value, shared } | null
//     set(key, value, shared?) -> { key, value, shared } | null
//     del(key, shared?)        -> { key, deleted, shared } | null
//     list(prefix?, shared?)   -> { keys, prefix?, shared }
//     isAlive()                -> boolean
//
//   Errors return null / { keys: [] } — same as the old `safeStorage`
//   wrapper. Every call site already guards `if (r && r.value)` so this
//   keeps the app stable when Supabase is briefly unreachable.
// =====================================================================

import { openDB } from 'idb';

// ---------------------------------------------------------------------
// CONFIG
// Vite inlines these at build time. The publishable key is designed to
// be public — it appears in every user's downloaded JS. Real security
// lives in Postgres Row-Level Security (set up in the SQL we ran).
// ---------------------------------------------------------------------
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SHARED_TABLE = 'kv_shared';
const REST_URL = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/${SHARED_TABLE}` : null;

// Soft-fail at module load if env vars are missing: shared features
// won't work, but local-only features (quizzes, stats, theme) still do.
// This lets a developer running `npm run dev` without a `.env` still see
// most of the app instead of a hard crash.
const SUPABASE_OK = !!(SUPABASE_URL && SUPABASE_KEY);
if (!SUPABASE_OK && typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.warn(
    '[storage] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. ' +
    'Shared features (profiles, banks, feedback) will be disabled.'
  );
}

// ---------------------------------------------------------------------
// LOCAL STORAGE — IndexedDB (per-device)
// ---------------------------------------------------------------------
const DB_NAME = 'norcet-prep';
const DB_VERSION = 1;
const STORE_LOCAL = 'local';
// Kept so existing DBs (Stage 1) still open without an upgrade event.
// Stage 1 data in this store is intentionally NOT migrated to Supabase
// — Stage 1 was single-device, the user expects a fresh start.
const STORE_SHARED_LEGACY = 'shared';

let dbPromise = null;
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_LOCAL))         db.createObjectStore(STORE_LOCAL);
        if (!db.objectStoreNames.contains(STORE_SHARED_LEGACY)) db.createObjectStore(STORE_SHARED_LEGACY);
      }
    }).catch((e) => {
      // If IDB can't open at all, null out the cached promise so a
      // later call can retry on a fresh attempt.
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

async function idbGet(key) {
  const db = await getDB();
  const v = await db.get(STORE_LOCAL, key);
  return v === undefined ? null : v;
}
async function idbSet(key, value) {
  const db = await getDB();
  await db.put(STORE_LOCAL, value, key);
}
async function idbDel(key) {
  const db = await getDB();
  await db.delete(STORE_LOCAL, key);
}
async function idbList(prefix) {
  const db = await getDB();
  const keys = await db.getAllKeys(STORE_LOCAL);
  if (!prefix) return keys;
  return keys.filter(k => typeof k === 'string' && k.startsWith(prefix));
}

// ---------------------------------------------------------------------
// EGRESS ESTIMATE — Supabase free tier meters 5 GB/month of EGRESS (data read
// OUT), which a blob-sync app hits before the 500 MB DB limit. This sums the
// bytes received from SHARED reads into a per-MONTH local counter so usage is
// visible. PER-DEVICE estimate — multiply by your active-user count for a rough
// global figure. Inspect via `window.__egress()` in the console, or the
// exported getEgressStats(). content-length is CORS-safelisted, so readable;
// responses that omit it are simply undercounted (it's an estimate).
// ---------------------------------------------------------------------
function egMonthKey() { return new Date().toISOString().slice(0, 7); } // YYYY-MM
let egMonth = egMonthKey();
let egBytes = 0;
let egFlushTimer = null;
(async () => { try { const v = await idbGet(`__egress:${egMonth}`); if (typeof v === 'number') egBytes = v; } catch (e) {} })();

function bumpEgress(res) {
  try {
    const m = egMonthKey();
    if (m !== egMonth) { egMonth = m; egBytes = 0; }
    const n = Number(res && res.headers && res.headers.get && res.headers.get('content-length'));
    if (Number.isFinite(n) && n > 0) egBytes += n;
    if (egFlushTimer) clearTimeout(egFlushTimer);
    egFlushTimer = setTimeout(() => { idbSet(`__egress:${egMonth}`, egBytes).catch(() => {}); egFlushTimer = null; }, 4000);
  } catch (e) {}
}

export function getEgressStats() {
  return { month: egMonth, bytes: egBytes, mb: +(egBytes / 1048576).toFixed(2) };
}
if (typeof window !== 'undefined') { try { window.__egress = getEgressStats; } catch (e) {} }

// ---------------------------------------------------------------------
// SHARED STORAGE — Supabase PostgREST
//
// We talk to PostgREST directly with `fetch()` instead of pulling in
// `@supabase/supabase-js`. The library is ~70 KB and we only need four
// CRUD operations on one table. Direct fetch keeps the bundle small
// and removes one dependency to keep in sync.
//
// Auth: `apikey` + `Authorization: Bearer` headers, both set to the
// publishable key. PostgREST maps the key to the `anon` Postgres role,
// which our RLS policies grant select/insert/update/delete on `kv_shared`.
// ---------------------------------------------------------------------

function supabaseHeaders(extra = {}) {
  return {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json',
    ...extra
  };
}

// ---------------------------------------------------------------------
// STAGE 2 (C-1 writes): all SHARED WRITES now go through the `kv-write`
// Edge Function (the "broker"), which holds the service-role key and
// enforces per-user authorization. The anon key can no longer write
// kv_shared at all once the open anon policies are dropped. READS stay
// on the direct anon path above — public content is still world-readable.
//
// The broker needs to know WHO is writing: a signed session token issued
// by `auth-secure` at login. The app sets it via setAuthToken() on login
// and on boot (restored from local storage by profiles.js). Writes attach
// it. No token (e.g. a guest, who only writes LOCAL data) → the broker is
// never called for shared writes, so guests are unaffected.
// ---------------------------------------------------------------------
const KV_WRITE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/kv-write` : null;
let _authToken = null;
let _onAuthError = null;

// Set the current session token (called on login + on boot-restore).
export function setAuthToken(token) { _authToken = token || null; }
export function getAuthToken() { return _authToken; }
// Optional hook: invoked when the broker rejects a call for an expired/
// invalid token, so the app can nudge a re-login. Data is never lost — the
// failed write returns null and the caller's pending-sync queue retries it
// after the next successful login mints a fresh token. The callback receives
// a reason string: 'SESSION_EXPIRED' = the single-session guard fired (this
// account logged in on a NEWER device — the app force-signs-out), anything
// else = a plain bad/expired token (soft nudge only).
export function setOnAuthError(cb) { _onAuthError = (typeof cb === 'function') ? cb : null; }

// Classify a broker 401 body and fire the hook (best-effort, never throws).
function fireAuthError(bodyText) {
  if (!_onAuthError) return;
  const reason = (typeof bodyText === 'string' && bodyText.includes('SESSION_EXPIRED'))
    ? 'SESSION_EXPIRED' : 'auth';
  try { _onAuthError(reason); } catch (_) {}
}

async function brokerWrite(op, key, value) {
  if (!SUPABASE_OK || !KV_WRITE_URL) throw new Error('Supabase not configured');
  const res = await fetch(KV_WRITE_URL, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      op, key, token: _authToken,
      ...(op === 'set' ? { value: String(value) } : {}),
    }),
  });
  if (!res.ok) {
    // 401 = token missing/expired/invalid — or SESSION_EXPIRED when the
    // single-session guard fired. Signal the app (best-effort) so it can
    // prompt a re-login; the write still fails and queues locally.
    const bodyText = await safeText(res);
    if (res.status === 401) fireAuthError(bodyText);
    throw new Error(`kv-write ${op} ${res.status} ${bodyText}`);
  }
}

// ---------------------------------------------------------------------
// STAGE 3 (C-1 reads): non-public prefixes are not anon-SELECTable; they are
// served ONLY by the `kv-read` broker (service-role + the same session token),
// which authorizes each read:
//   profile: / myfeedback: -> owner (or admin)
//   feedback:              -> the row's author (or admin); admin lists all
//   errlog: / analytics:   -> admin only
// Everything else (announcement/bank/faq/faqq/qgate/trend/favsec/favorder/
// helpful/notHelpful/leaderboard/profilemeta) stays on the direct anon read
// path below — genuinely public content + the display-name/timestamps the
// profile switcher needs for all users.
// ---------------------------------------------------------------------
const KV_READ_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/kv-read` : null;
const BROKER_READ_PREFIXES = ['profile:', 'myfeedback:', 'feedback:', 'errlog:', 'analytics:', 'adminlog:'];
function isPrivateReadKey(key) {
  return typeof key === 'string' && BROKER_READ_PREFIXES.some(p => key.startsWith(p));
}
function isPrivateReadPrefix(prefix) {
  return typeof prefix === 'string' && BROKER_READ_PREFIXES.some(p => prefix === p || prefix.startsWith(p));
}

async function brokerGet(key) {
  // No token (guest, or token not yet restored) → behave like "no row".
  // Guests never have private shared keys, and a logged-in user always has
  // a token before loadProfile runs (restoreAuthToken is awaited in loadSession).
  if (!SUPABASE_OK || !KV_READ_URL || !_authToken) return null;
  const res = await fetch(KV_READ_URL, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ op: 'get', key, token: _authToken }),
  });
  if (!res.ok) {
    const bodyText = await safeText(res);
    if (res.status === 401) fireAuthError(bodyText);
    throw new Error(`kv-read get ${res.status} ${bodyText}`);
  }
  bumpEgress(res);
  const j = await res.json();
  return (j && j.value != null) ? j.value : null;
}

async function brokerList(prefix) {
  if (!SUPABASE_OK || !KV_READ_URL || !_authToken) return [];
  const res = await fetch(KV_READ_URL, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ op: 'list', prefix, token: _authToken }),
  });
  if (!res.ok) {
    const bodyText = await safeText(res);
    if (res.status === 401) fireAuthError(bodyText);
    throw new Error(`kv-read list ${res.status} ${bodyText}`);
  }
  bumpEgress(res);
  const j = await res.json();
  return (j && Array.isArray(j.keys)) ? j.keys : [];
}

// Strict shared write/delete that THROW on failure (no silent swallow).
// Used by the admin announcement path, where a silent failure would corrupt
// the admin's mental model of what they just posted.
export async function setSharedStrict(key, value) { await brokerWrite('set', key, value); }
export async function delSharedStrict(key)        { await brokerWrite('del', key); }

async function supabaseGet(key) {
  if (!SUPABASE_OK) return null;
  // STAGE 3: private prefixes go through the read broker (owner-scoped).
  if (isPrivateReadKey(key)) return await brokerGet(key);
  const url = `${REST_URL}?key=eq.${encodeURIComponent(key)}&select=value`;
  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) throw new Error(`Supabase GET ${res.status} ${await safeText(res)}`);
  bumpEgress(res);
  const rows = await res.json();
  if (!rows || !rows.length) return null;
  return rows[0].value;
}

async function supabaseSet(key, value) {
  if (!SUPABASE_OK) throw new Error('Supabase not configured');
  // STAGE 2: writes go through the broker (service-role), not direct anon
  // PostgREST. The broker authorizes by session token + key ownership.
  await brokerWrite('set', key, value);
}

async function supabaseDel(key) {
  if (!SUPABASE_OK) throw new Error('Supabase not configured');
  await brokerWrite('del', key);
}

async function supabaseList(prefix) {
  if (!SUPABASE_OK) return [];
  // STAGE 3: listing a private prefix is owner-scoped via the read broker.
  if (isPrivateReadPrefix(prefix)) return await brokerList(prefix);
  // PostgREST accepts `*` as a `like` wildcard (translated to SQL `%`).
  // URL-safer than putting raw `%` in the query string.
  const pattern = prefix ? `${prefix}*` : '*';
  const url = `${REST_URL}?key=like.${encodeURIComponent(pattern)}&select=key`;
  // Default PostgREST page size is 1000 rows — fine for a beta. If we
  // ever exceed it for a single prefix, we add a Range header here.
  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) throw new Error(`Supabase LIST ${res.status} ${await safeText(res)}`);
  bumpEgress(res);
  const rows = await res.json();
  return (rows || []).map(r => r.key);
}

// Read response text without throwing if the body is already consumed
// or non-text. Used only for nicer error messages.
async function safeText(res) {
  try { return (await res.text()).slice(0, 200); } catch { return ''; }
}

// ---------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------
export async function get(key, shared = false) {
  try {
    const value = shared
      ? await supabaseGet(key)
      : await idbGet(key);
    if (value === null || value === undefined) return null;
    return { key, value, shared: !!shared };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[storage.get]', key, shared, e.message || e);
    return null;
  }
}

export async function set(key, value, shared = false) {
  try {
    if (shared) await supabaseSet(key, value);
    else        await idbSet(key, value);
    return { key, value, shared: !!shared };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[storage.set]', key, shared, e.message || e);
    return null;
  }
}

// Named `del` (not `delete`) because `delete` is a reserved word in
// some lint configs when used as a property name shorthand. The shim
// in App.jsx maps `safeStorage.delete(...)` -> `kvStorage.del(...)`.
export async function del(key, shared = false) {
  try {
    if (shared) await supabaseDel(key);
    else        await idbDel(key);
    return { key, deleted: true, shared: !!shared };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[storage.del]', key, shared, e.message || e);
    return null;
  }
}

export async function list(prefix = '', shared = false) {
  try {
    const keys = shared
      ? await supabaseList(prefix)
      : await idbList(prefix);
    return { keys: keys || [], prefix, shared: !!shared };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[storage.list]', prefix, shared, e.message || e);
    return { keys: [] };
  }
}

// Liveness probe. IndexedDB is the bare minimum — the app can boot and
// run personal-only mode without Supabase. Supabase being briefly slow
// (cold-start after a week of inactivity on the free tier) should not
// raise the "your progress won't be saved" banner.
export async function isAlive() {
  try {
    await idbSet('__health__', Date.now());
    const v = await idbGet('__health__');
    return typeof v === 'number';
  } catch (e) {
    return false;
  }
}
