// =====================================================================
// src/lib/errorlog.js — lightweight client error/crash tracking (#29)
//
// Captures uncaught errors (window.onerror), unhandled promise rejections,
// and React render crashes (via ErrorBoundary -> captureError), GROUPS them
// by a stable signature so repeated crashes aggregate into one row instead of
// flooding, and stores each group in shared storage (errlog:{sig}) so the
// admin can see crashes happening across every user's device — the same
// anon shared-write path feedback:/favsec: already use.
//
// Safety: every path is wrapped so the logger can NEVER itself throw (a
// throwing error-handler would loop). Writes are throttled per signature and
// the number of NEW signatures per session is capped, so a tight error loop
// can't hammer storage.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS, KEY_PREFIXES } from './keys.js';

const FLUSH_MS = 4000;          // min gap between storage writes for one signature
const MAX_NEW_SIGS_PER_SESSION = 40;
const MAX_STACK_CHARS = 1200;

// in-memory accumulators (per tab/session)
const pending = new Map();       // sig -> { count, lastFlush }
const knownSigs = new Set();
let newSigCount = 0;
let installed = false;
let ctx = { screen: null };

export function setErrorContext(next) {
  try { ctx = { ...ctx, ...(next || {}) }; } catch (e) {}
}

// djb2 → base36; stable, tiny, no deps.
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Normalise a message so near-identical errors group together: drop digits,
// URLs, hex addresses and quoted specifics.
function normalize(msg) {
  return String(msg || 'Unknown error')
    .replace(/https?:\/\/[^\s)]+/g, '<url>')
    .replace(/0x[0-9a-f]+/gi, '<hex>')
    .replace(/\d+/g, '<n>')
    .slice(0, 240);
}

function topFrame(stack) {
  if (!stack) return '';
  const lines = String(stack).split('\n').map(l => l.trim()).filter(Boolean);
  // first line is usually the message; the first "at ..." is the top frame
  const at = lines.find(l => l.startsWith('at ')) || lines[1] || '';
  return at.replace(/https?:\/\/[^\s)]+/g, '<url>').replace(/:\d+:\d+/g, '').slice(0, 160);
}

async function flush(sig, base) {
  try {
    const acc = pending.get(sig);
    const add = acc ? acc.count : 1;
    let prev = null;
    try {
      const r = await safeStorage.get(KEYS.errlog(sig), true);
      if (r && r.value) prev = JSON.parse(r.value);
    } catch (e) { /* none yet */ }
    const now = Date.now();
    const rec = prev ? {
      ...prev,
      count: (prev.count || 0) + add,
      lastSeen: now,
      // a re-occurrence un-resolves the group so it resurfaces
      resolved: false,
      lastScreen: base.screen || prev.lastScreen || null,
    } : {
      sig,
      message: base.message,
      stackTop: base.stackTop,
      source: base.source,
      severity: base.severity,
      count: add,
      firstSeen: now,
      lastSeen: now,
      sampleStack: base.sampleStack,
      ua: base.ua,
      firstScreen: base.screen || null,
      lastScreen: base.screen || null,
      resolved: false,
    };
    await safeStorage.set(KEYS.errlog(sig), JSON.stringify(rec), true);
    if (acc) acc.count = 0;
  } catch (e) { /* swallow — logging must never throw */ }
}

export function captureError(errOrMsg, meta = {}) {
  try {
    const isErr = errOrMsg && typeof errOrMsg === 'object';
    const message = String((isErr ? errOrMsg.message : errOrMsg) || meta.message || 'Unknown error').slice(0, 300);
    if (!message || message === 'Script error.') return; // opaque cross-origin noise
    const stack = (isErr && errOrMsg.stack) ? errOrMsg.stack : (meta.stack || '');
    const sig = hash(normalize(message) + '|' + topFrame(stack) + '|' + (meta.source || ''));

    if (!knownSigs.has(sig)) {
      if (newSigCount >= MAX_NEW_SIGS_PER_SESSION) return; // cap new groups
      knownSigs.add(sig);
      newSigCount += 1;
    }

    const acc = pending.get(sig) || { count: 0, lastFlush: 0 };
    acc.count += 1;
    pending.set(sig, acc);

    const base = {
      message,
      stackTop: topFrame(stack),
      source: meta.source || 'window',
      severity: meta.severity || 'error',
      sampleStack: String(stack || '').slice(0, MAX_STACK_CHARS),
      ua: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 200),
      screen: meta.screen || ctx.screen || null,
    };

    const now = Date.now();
    if (now - acc.lastFlush >= FLUSH_MS || acc.lastFlush === 0) {
      acc.lastFlush = now;
      flush(sig, base);
    }
  } catch (e) { /* never throw */ }
}

export function installGlobalErrorCapture() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  try {
    window.addEventListener('error', (e) => {
      if (e && e.error) captureError(e.error, { source: 'window' });
      else captureError(e && e.message, { source: 'window', stack: e && `${e.filename}:${e.lineno}:${e.colno}` });
    });
    window.addEventListener('unhandledrejection', (e) => {
      const r = e && e.reason;
      captureError(r && r.message ? r : String(r), { source: 'promise', stack: r && r.stack });
    });
  } catch (e) { /* ignore */ }
}

// ---- admin query API ----
export async function listErrorGroups() {
  let keys = [];
  try { const r = await safeStorage.list(KEY_PREFIXES.ERRLOG, true); keys = (r && r.keys) ? r.keys : []; } catch (e) { return []; }
  const items = await Promise.all(keys.map(async k => {
    try { const r = await safeStorage.get(k, true); if (r && r.value) return JSON.parse(r.value); } catch (e) {}
    return null;
  }));
  return items.filter(Boolean).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
}

export async function setErrorResolved(sig, resolved) {
  try {
    const r = await safeStorage.get(KEYS.errlog(sig), true);
    if (r && r.value) {
      const rec = JSON.parse(r.value);
      rec.resolved = !!resolved;
      await safeStorage.set(KEYS.errlog(sig), JSON.stringify(rec), true);
    }
  } catch (e) {}
}

export async function deleteErrorGroup(sig) {
  try { await safeStorage.delete(KEYS.errlog(sig), true); } catch (e) {}
}
