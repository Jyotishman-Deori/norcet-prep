// =====================================================================
// LOG.JS — Structured logging + error reporting  (Pipeline step 7 / A10)
// ---------------------------------------------------------------------
// Why this exists:
//   The app has ~57 try/catch blocks, many swallowing errors silently.
//   That resilience is good (a failed write shouldn't crash the app),
//   but in production it means when a user says "it crashed" or "my
//   progress vanished", we have nothing — no stack, no breadcrumbs.
//
// What this does — two layers:
//   DEV  : prints to console with severity colours. Nothing leaves
//          the device.
//   PROD : every call appends to an in-memory ring buffer (last 50
//          entries). On a level=error call, the whole buffer is
//          POSTed to a Supabase `error_logs` table (fire-and-forget)
//          so a single report carries the breadcrumbs that led to it.
//
// CONTRACTS (important — a logger that crashes the app is worse than
// no logger):
//   - No method ever throws. Everything is wrapped; a logging failure
//     is itself swallowed (we can't very well log it).
//   - The Supabase POST is fire-and-forget: never awaited by callers,
//     never blocks UI, failures are silent.
//   - Errors are de-duplicated within a short window so a render loop
//     that throws 500x/sec doesn't spam 500 POSTs.
//   - No PII beyond what the app already stores: we attach profileId
//     (already the user's chosen handle id), current screen, and the
//     user-agent string. We do NOT serialise `data` blobs.
//
// DEPLOY: needs the `error_logs` table — see A10-supabase-setup.sql.
//   Until that table + insert policy exist, POSTs simply 404/401 and
//   are silently dropped. The console layer works regardless, so dev
//   is unaffected if you haven't run the SQL yet.
// =====================================================================

const RING_SIZE = 50;
const ring = [];               // [{ ts, level, tag, msg, detail }]
const DEDUPE_WINDOW_MS = 5000; // collapse identical errors within 5s
let _lastErrorSig = '';
let _lastErrorAt = 0;

// Context the app can set once it knows who's signed in / where they
// are. Kept module-local so call sites stay terse: log.warn('tag', e).
let _ctx = { profileId: null, screen: null };
export function setLogContext(partial) {
  try {
    if (partial && typeof partial === 'object') {
      _ctx = { ..._ctx, ...partial };
    }
  } catch (e) { /* never throw from the logger */ }
}

const IS_DEV = (() => {
  try {
    return typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV === true;
  } catch (e) { return false; }
})();

const SUPABASE_URL = (() => {
  try { return (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || undefined; }
  catch (e) { return undefined; }
})();
const SUPABASE_ANON_KEY = (() => {
  try { return (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || undefined; }
  catch (e) { return undefined; }
})();

const CONSOLE_STYLE = {
  debug: 'color:#888',
  info: 'color:#0F4C4C',
  warn: 'color:#B8860B;font-weight:bold',
  error: 'color:#B84040;font-weight:bold',
};

// Normalise whatever a caller passes as `detail` (usually an Error,
// sometimes a string or object) into something JSON-serialisable and
// bounded in size.
function describe(detail) {
  if (detail == null) return null;
  try {
    if (detail instanceof Error) {
      return {
        name: detail.name,
        message: detail.message,
        stack: (detail.stack || '').slice(0, 2000),
      };
    }
    if (typeof detail === 'string') return detail.slice(0, 2000);
    // Generic object — shallow stringify, capped.
    return JSON.stringify(detail).slice(0, 2000);
  } catch (e) {
    try { return String(detail).slice(0, 2000); } catch (_e) { return null; }
  }
}

function pushRing(entry) {
  try {
    ring.push(entry);
    while (ring.length > RING_SIZE) ring.shift();
  } catch (e) { /* never throw */ }
}

// Fire-and-forget POST of the current breadcrumb buffer. Called only
// on error level. Never awaited, never throws.
function reportError(entry) {
  try {
    if (IS_DEV) return;                          // dev stays local
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    // De-dupe: identical tag+message within the window → skip the POST
    // (the entry is still in the ring buffer for the next real report).
    const sig = (entry.tag || '') + '|' + (entry.msg || '');
    const now = Date.now();
    if (sig === _lastErrorSig && (now - _lastErrorAt) < DEDUPE_WINDOW_MS) return;
    _lastErrorSig = sig;
    _lastErrorAt = now;

    const payload = {
      ts: new Date(entry.ts).toISOString(),
      level: entry.level,
      tag: entry.tag || null,
      message: entry.msg || null,
      detail: entry.detail || null,
      profile_id: _ctx.profileId || null,
      screen: _ctx.screen || null,
      user_agent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent.slice(0, 500) : null,
      // Breadcrumbs: the ring buffer leading up to this error, trimmed.
      breadcrumbs: ring.slice(-RING_SIZE).map(e => ({
        ts: new Date(e.ts).toISOString(),
        level: e.level,
        tag: e.tag || null,
        message: e.msg || null,
      })),
    };

    // Fire-and-forget. We intentionally do not await this; we attach a
    // no-op catch so an unhandled rejection never surfaces.
    fetch(`${SUPABASE_URL}/rest/v1/error_logs`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
      keepalive: true, // let it complete even if the page is unloading
    }).catch(() => { /* reporting is best-effort */ });
  } catch (e) { /* never throw from the logger */ }
}

function emit(level, tag, detail) {
  try {
    const entry = {
      ts: Date.now(),
      level,
      tag: (typeof tag === 'string') ? tag : 'untagged',
      msg: (detail instanceof Error) ? detail.message
        : (typeof detail === 'string') ? detail
        : (tag && typeof tag !== 'string') ? '' : '',
      detail: describe(detail),
    };
    pushRing(entry);

    if (IS_DEV) {
      const style = CONSOLE_STYLE[level] || '';
      const fn = (level === 'error') ? console.error
        : (level === 'warn') ? console.warn
        : console.log;
      // eslint-disable-next-line no-console
      try { fn('%c[' + level + '] ' + entry.tag, style, detail != null ? detail : ''); }
      catch (e) { /* console may be absent */ }
    }

    if (level === 'error') reportError(entry);
  } catch (e) { /* never throw from the logger */ }
}

export const log = {
  debug: (tag, detail) => emit('debug', tag, detail),
  info: (tag, detail) => emit('info', tag, detail),
  warn: (tag, detail) => emit('warn', tag, detail),
  error: (tag, detail) => emit('error', tag, detail),
  // Exposed for tests / a future "export my logs" debug action.
  _ring: () => ring.slice(),
};

export default log;
