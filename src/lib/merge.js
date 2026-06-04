// =====================================================================
// src/lib/merge.js — guest→account data MERGE ENGINE (Pipeline step 35 / A1).
// Extracted VERBATIM from App.jsx. PURE (no async, no storage, no React, no
// render globals): normalizeUserData (migrate+fill to DEFAULT_DATA shape,
// idempotent), guestBlobHasActivity (offer-merge predicate), and
// mergeGuestIntoAccount (account-canonical additive fold) + its 12 private
// _g* helpers. This is the safe, fully-testable core of the profile/auth
// subsystem; the ASYNC storage/auth/session/guest-IO functions remain in
// App.jsx and should be extracted to src/lib/profiles.js LOCALLY, where a real
// `npm run build` + login/sync/merge device testing can validate them.
// =====================================================================

import { DEFAULT_DATA } from '../data/seed.js';
import { CURRENT_SCHEMA_VERSION, runMigrations } from './migrations.js';

export function _gnum(x) { return (typeof x === 'number' && isFinite(x)) ? x : 0; }
export function _gmaxNum(a, b) {
  const an = (typeof a === 'number' && isFinite(a)) ? a : null;
  const bn = (typeof b === 'number' && isFinite(b)) ? b : null;
  if (an == null) return bn; if (bn == null) return an; return Math.max(an, bn);
}
export function _gmaxDateStr(a, b) {
  // dailyHistory/lastStudiedDate are ISO 'YYYY-MM-DD' — lexically sortable.
  if (!a) return b || null; if (!b) return a || null; return a >= b ? a : b;
}
export function _gunionArr(a, b) {
  return Array.from(new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]));
}
export function _gunionById(a, b) {
  // account (a) listed first => account's object wins on an id collision.
  const out = []; const seen = new Set();
  const push = (arr) => (Array.isArray(arr) ? arr : []).forEach(q => {
    if (!q) return;
    const id = q.id;
    if (id == null) { out.push(q); return; }
    if (seen.has(id)) return;
    seen.add(id); out.push(q);
  });
  push(a); push(b);
  return out;
}
export function _gconcatCappedByTs(a, b, cap) {
  const all = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
  const seen = new Set(); const out = [];
  for (const e of all) {
    const ts = e && e.ts;
    if (ts != null) { if (seen.has(ts)) continue; seen.add(ts); }
    out.push(e);
  }
  out.sort((x, y) => _gnum(x && x.ts) - _gnum(y && y.ts));
  return cap ? out.slice(-cap) : out;
}
export function _gunionDailyHistory(a, b) {
  const map = new Map();
  const add = (arr) => (Array.isArray(arr) ? arr : []).forEach(e => {
    if (!e || !e.date) return;
    const cur = map.get(e.date) || { date: e.date, attempted: 0, correct: 0 };
    cur.attempted += _gnum(e.attempted);
    cur.correct += _gnum(e.correct);
    map.set(e.date, cur);
  });
  add(a); add(b);
  return Array.from(map.values()).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}
export function _gunionRevisionLog(a, b) {
  const map = new Map();
  const add = (arr) => (Array.isArray(arr) ? arr : []).forEach(e => {
    if (!e || !e.date) return;
    const cur = map.get(e.date);
    if (!cur) {
      map.set(e.date, { date: e.date, ts: _gnum(e.ts), ids: Array.isArray(e.ids) ? [...e.ids] : [] });
    } else {
      cur.ids = Array.from(new Set([...(cur.ids || []), ...(Array.isArray(e.ids) ? e.ids : [])]));
      cur.ts = Math.max(_gnum(cur.ts), _gnum(e.ts));
    }
  });
  add(a); add(b);
  // newest-first, capped 60 — matches how revisionLog is stored elsewhere.
  return Array.from(map.values())
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    .slice(0, 60);
}
export function _gmergeHistoryEntry(ae, be) {
  const a = ae || {}; const b = be || {};
  const attempts = _gconcatCappedByTs(a.attempts, b.attempts, 0);
  const aLast = (Array.isArray(a.attempts) && a.attempts.length) ? _gnum(a.attempts[a.attempts.length - 1].ts) : -1;
  const bLast = (Array.isArray(b.attempts) && b.attempts.length) ? _gnum(b.attempts[b.attempts.length - 1].ts) : -1;
  const recent = bLast > aLast ? b : a; // most-recent side informs SR scheduling
  const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;
  return {
    attempts,
    reviewCount: _gnum(recent.reviewCount),
    nextDue: recent.nextDue || null,
    lastResult: lastAttempt ? (lastAttempt.correct ? 'right' : 'wrong') : (recent.lastResult || null)
  };
}
export function _gmergeHistory(a, b) {
  const out = { ...(a && typeof a === 'object' ? a : {}) };
  const g = (b && typeof b === 'object') ? b : {};
  for (const qid in g) {
    out[qid] = out[qid] ? _gmergeHistoryEntry(out[qid], g[qid]) : g[qid];
  }
  return out;
}
export function _gmergeMaxMap(a, b) {
  const out = { ...(b || {}), ...(a || {}) }; // account values as base
  const g = b || {};
  for (const k in g) {
    const av = a ? a[k] : undefined;
    if (typeof av === 'number' && typeof g[k] === 'number') out[k] = Math.max(av, g[k]);
  }
  return out;
}
export function _gmergePreviousPapers(a, b) {
  const out = { ...(a && typeof a === 'object' && !Array.isArray(a) ? a : {}) };
  const g = (b && typeof b === 'object' && !Array.isArray(b)) ? b : {};
  for (const pid in g) {
    const ge = g[pid] || {};
    if (!out[pid]) { out[pid] = ge; continue; }
    const ae = out[pid] || {};
    const attempts = _gconcatCappedByTs(ae.attempts, ge.attempts, 20);
    const bestNet = attempts.reduce((m, x) => Math.max(m, _gnum(x && x.netScore)), -Infinity);
    const last = attempts.reduce((acc, x) => (!acc || _gnum(x && x.ts) > _gnum(acc.ts)) ? x : acc, null);
    out[pid] = {
      attempts,
      bestNet: isFinite(bestNet) ? bestNet : (_gnum(ae.bestNet) || _gnum(ge.bestNet)),
      lastTs: last ? last.ts : _gmaxNum(ae.lastTs, ge.lastTs),
      lastAccuracy: last ? _gnum(last.accuracy) : (_gnum(ae.lastAccuracy) || _gnum(ge.lastAccuracy))
    };
  }
  return out;
}
// Walk a raw blob to current schema and fill it out to DEFAULT_DATA's full
// shape, guarding container types. Idempotent. Mirrors the boot path so auth/
// merge data is shaped exactly like a freshly-booted account.
export function normalizeUserData(raw) {
  const migrated = runMigrations(raw || {});
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  return {
    ...DEFAULT_DATA,
    ...migrated,
    customQuestions: Array.isArray(migrated.customQuestions) ? migrated.customQuestions : DEFAULT_DATA.customQuestions,
    bookmarks: Array.isArray(migrated.bookmarks) ? migrated.bookmarks : DEFAULT_DATA.bookmarks,
    history: isObj(migrated.history) ? migrated.history : {},
    stats: { ...DEFAULT_DATA.stats, ...(migrated.stats || {}) },
    advancedTestHistory: Array.isArray(migrated.advancedTestHistory) ? migrated.advancedTestHistory : [],
    previousPapers: isObj(migrated.previousPapers) ? migrated.previousPapers : {},
    bankVersionsSeen: isObj(migrated.bankVersionsSeen) ? migrated.bankVersionsSeen : {},
    bankPublishedSeen: isObj(migrated.bankPublishedSeen) ? migrated.bankPublishedSeen : {},
    disabledBanks: isObj(migrated.disabledBanks) ? migrated.disabledBanks : {},
    feedbackRepliesSeen: isObj(migrated.feedbackRepliesSeen) ? migrated.feedbackRepliesSeen : {},
    revisionLog: Array.isArray(migrated.revisionLog) ? migrated.revisionLog : DEFAULT_DATA.revisionLog,
    preferences: { ...DEFAULT_DATA.preferences, ...(migrated.preferences || {}) }
  };
}
// Genuine activity test — only OFFER the merge when the guest actually did
// something worth keeping (so a fresh/empty guest session never prompts).
export function guestBlobHasActivity(d) {
  if (!d) return false;
  const s = d.stats || {};
  if (_gnum(s.totalAttempted) > 0) return true;
  if (d.history && typeof d.history === 'object' && Object.keys(d.history).length > 0) return true;
  if (Array.isArray(d.bookmarks) && d.bookmarks.length > 0) return true;
  if (Array.isArray(d.customQuestions) && d.customQuestions.length > 0) return true;
  if (Array.isArray(d.advancedTestHistory) && d.advancedTestHistory.length > 0) return true;
  if (Array.isArray(d.revisionLog) && d.revisionLog.length > 0) return true;
  if (d.previousPapers && typeof d.previousPapers === 'object' && Object.keys(d.previousPapers).length > 0) return true;
  return false;
}
// THE MERGE. account is canonical; guest folds in additively. Both inputs are
// normalized first so this is safe to call on raw-ish blobs and is idempotent.
export function mergeGuestIntoAccount(account, guest) {
  const a = normalizeUserData(account);
  const g = normalizeUserData(guest);
  const aS = a.stats; const gS = g.stats;
  const stats = {
    ...DEFAULT_DATA.stats,
    ...aS, // account scalars win by default (examDate, dailyTarget, grace flags)
    totalAttempted: _gnum(aS.totalAttempted) + _gnum(gS.totalAttempted),
    totalCorrect: _gnum(aS.totalCorrect) + _gnum(gS.totalCorrect),
    streakCurrent: Math.max(_gnum(aS.streakCurrent), _gnum(gS.streakCurrent)),
    streakBest: Math.max(_gnum(aS.streakBest), _gnum(gS.streakBest)),
    dailyHistory: _gunionDailyHistory(aS.dailyHistory, gS.dailyHistory),
    lastStudiedDate: _gmaxDateStr(aS.lastStudiedDate, gS.lastStudiedDate),
    lastCompactedTs: _gmaxNum(aS.lastCompactedTs, gS.lastCompactedTs)
  };
  return {
    ...DEFAULT_DATA,
    ...a, // account canonical base — preserves every field, incl. future ones
    schemaVersion: CURRENT_SCHEMA_VERSION,
    stats,
    history: _gmergeHistory(a.history, g.history),
    bookmarks: _gunionArr(a.bookmarks, g.bookmarks),
    customQuestions: _gunionById(a.customQuestions, g.customQuestions),
    revisionLog: _gunionRevisionLog(a.revisionLog, g.revisionLog),
    advancedTestHistory: _gconcatCappedByTs(a.advancedTestHistory, g.advancedTestHistory, 50),
    previousPapers: _gmergePreviousPapers(a.previousPapers, g.previousPapers),
    bankVersionsSeen: _gmergeMaxMap(a.bankVersionsSeen, g.bankVersionsSeen),
    bankPublishedSeen: _gmergeMaxMap(a.bankPublishedSeen, g.bankPublishedSeen),
    disabledBanks: { ...(g.disabledBanks || {}), ...(a.disabledBanks || {}) },
    feedbackRepliesSeen: { ...(g.feedbackRepliesSeen || {}), ...(a.feedbackRepliesSeen || {}) },
    // ACCOUNT preferences win entirely.
    preferences: { ...DEFAULT_DATA.preferences, ...(g.preferences || {}), ...(a.preferences || {}) }
  };
}
