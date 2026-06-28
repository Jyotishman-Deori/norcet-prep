// =====================================================================
// src/lib/analytics.js — lightweight engagement analytics (#28)
//
// Tracks how the app is actually used — sessions, screen visits, active days —
// for BOTH logged-in users and guests. Each identity writes ONE shared key
// (analytics:user:{id}) holding a rolling summary, so concurrent writes never
// clobber each other (same pattern as favorder:/errlog:). The admin Engagement
// view AGGREGATES these — it never shows a feed of any single person's activity
// (matches the Privacy Policy).
//
// Writes are throttled (accumulate in memory, flush on a timer + when the tab
// is hidden) so navigation never hammers storage.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS, KEY_PREFIXES } from './keys.js';

const SUMMARY_V = 1;
const FLUSH_MS = 20000;       // min gap between shared writes
const MAX_DAYS = 60;          // cap stored active-day history

const dayStr = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

let ident = null;             // { id, isGuest }
let summary = null;           // in-memory rolling summary
let dirty = false;
let lastFlush = 0;
let flushTimer = null;
let started = false;

function blank(id, isGuest) {
  const today = dayStr();
  return { id, isGuest: !!isGuest, v: SUMMARY_V, firstSeen: Date.now(), lastSeen: Date.now(),
           sessions: 0, screens: {}, games: {}, days: [today] };
}

async function ensureGuestLocalId() {
  try {
    const r = await safeStorage.get(KEYS.ANALYTICS_LOCAL_ID, false);
    if (r && r.value) return r.value;
  } catch (e) {}
  const id = 'g-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  try { await safeStorage.set(KEYS.ANALYTICS_LOCAL_ID, id, false); } catch (e) {}
  return id;
}

async function loadExisting(key) {
  try { const r = await safeStorage.get(key, true); if (r && r.value) { const p = JSON.parse(r.value); if (p && typeof p === 'object') return p; } } catch (e) {}
  return null;
}

function scheduleFlush() {
  dirty = true;
  if (flushTimer) return;
  const wait = Math.max(0, FLUSH_MS - (Date.now() - lastFlush));
  flushTimer = setTimeout(() => { flushTimer = null; flush(); }, wait);
}

async function flush() {
  if (!dirty || !ident || !summary) return;
  dirty = false;
  lastFlush = Date.now();
  try {
    await safeStorage.set(KEYS.analyticsUser(ident.id), JSON.stringify(summary), true);
  } catch (e) { dirty = true; /* retry next time */ }
}

// Call once the active identity is known (logged-in profile or guest).
export async function initAnalytics(profileId, isGuest) {
  try {
    const id = (profileId && !isGuest) ? String(profileId) : ('guest-' + (await ensureGuestLocalId()));
    if (ident && ident.id === id && started) return;   // already running for this identity
    ident = { id, isGuest: !!isGuest || !profileId };
    // Merge with any existing shared summary so counts persist across devices/sessions.
    const existing = await loadExisting(KEYS.analyticsUser(id));
    summary = existing && existing.screens ? { ...blank(id, ident.isGuest), ...existing, screens: existing.screens || {}, games: existing.games || {}, days: Array.isArray(existing.days) ? existing.days : [] }
                                           : blank(id, ident.isGuest);
    summary.id = id; summary.isGuest = ident.isGuest;
    if (!started) { started = true; bumpSession(); }
    markToday();
    // Flush on tab-hide so short sessions still record.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
      window.addEventListener('pagehide', () => { flush(); });
    }
    scheduleFlush();
  } catch (e) { /* analytics must never break the app */ }
}

function markToday() {
  if (!summary) return;
  const t = dayStr();
  if (!summary.days.includes(t)) {
    summary.days.push(t);
    if (summary.days.length > MAX_DAYS) summary.days = summary.days.slice(-MAX_DAYS);
  }
  summary.lastSeen = Date.now();
}

function bumpSession() {
  if (!summary) return;
  summary.sessions = (summary.sessions || 0) + 1;
  markToday();
  scheduleFlush();
}

export function trackScreen(screenId) {
  try {
    if (!summary || !screenId) return;
    summary.screens[screenId] = (summary.screens[screenId] || 0) + 1;
    markToday();
    scheduleFlush();
  } catch (e) {}
}

// UPGRADE 1 — the gamification "feedback valve". Records a game COMPLETION (and
// coins earned) per game id. Paired with the existing per-screen visit count
// (= opens), the admin can read a completion rate per game and see at a glance
// which drills are actually played vs ignored — before investing in more of
// them. Aggregate only (no per-user feed), same privacy model as everything here.
export function trackGameComplete(gameId, coins = 0) {
  try {
    if (!summary || !gameId) return;
    if (!summary.games) summary.games = {};
    const g = summary.games[gameId] || { plays: 0, coins: 0 };
    g.plays += 1;
    g.coins += Math.max(0, Math.floor(coins || 0));
    summary.games[gameId] = g;
    markToday();
    scheduleFlush();
  } catch (e) {}
}

// ---- admin aggregate (never exposes a single user's feed) ----
// Pure over an array of user summary blobs → the dashboard aggregate. Extracted
// so the rollup (incl. the UPGRADE 1 game feedback-valve math) is unit-testable
// without touching storage. loadEngagement() just fetches the blobs and calls it.
export function aggregateEngagement(users) {
  users = Array.isArray(users) ? users : [];
  const today = dayStr();
  const weekDays = new Set();
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); weekDays.add(dayStr(d)); }

  let guests = 0, members = 0, sessions = 0, activeToday = 0, activeWeek = 0, newWeek = 0;
  const weekStart = Date.now() - 7 * 86400000;
  const screenTotals = {};
  const gameTotals = {};                 // id -> { plays, coins }
  users.forEach(u => {
    if (u.isGuest) guests += 1; else members += 1;
    sessions += (u.sessions || 0);
    const days = Array.isArray(u.days) ? u.days : [];
    if (days.includes(today)) activeToday += 1;
    if (days.some(d => weekDays.has(d))) activeWeek += 1;
    if ((u.firstSeen || 0) >= weekStart) newWeek += 1;
    Object.entries(u.screens || {}).forEach(([s, n]) => { screenTotals[s] = (screenTotals[s] || 0) + n; });
    Object.entries(u.games || {}).forEach(([id, g]) => {
      const t = gameTotals[id] || { plays: 0, coins: 0 };
      t.plays += (g && g.plays) || 0;
      t.coins += (g && g.coins) || 0;
      gameTotals[id] = t;
    });
  });
  const topScreens = Object.entries(screenTotals)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const totalUsers = users.length;
  // UPGRADE 1 feedback valve: the caller pairs per-game COMPLETIONS (gameStats)
  // with OPENS (screenViews — a game's screen-visit count) to get a completion
  // rate. We expose both full maps rather than a pre-joined list so the admin
  // can include games that were OPENED but NEVER completed (rate 0 = the
  // strongest "ignored" signal), which a completions-only list would hide.
  return {
    totalUsers, guests, members, sessions, activeToday, activeWeek, newWeek,
    avgSessions: totalUsers ? (sessions / totalUsers) : 0,
    topScreens,
    screenViews: screenTotals,
    gameStats: gameTotals,
    totalScreenViews: Object.values(screenTotals).reduce((a, b) => a + b, 0),
  };
}

export async function loadEngagement() {
  let keys = [];
  try { const r = await safeStorage.list(KEY_PREFIXES.ANALYTICS_USER, true); keys = (r && r.keys) ? r.keys : []; } catch (e) { return null; }
  const users = (await Promise.all(keys.map(k => loadExisting(k)))).filter(Boolean);
  return aggregateEngagement(users);
}
