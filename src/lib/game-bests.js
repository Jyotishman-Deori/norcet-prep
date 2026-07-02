// =====================================================================
// src/lib/game-bests.js — pure per-game "personal best" store. Tracks the
// highest score and a done flag per item (e.g. per Ward Boss scenario), keyed
// under a game id. No React, no I/O — the caller persists the returned object
// in the synced profile blob like the rest of the economy.
//
//   gameBests = {
//     [gameId]: {
//       [itemId]: { best: integer, done: bool, ts: ms-timestamp }
//     }
//   }
//
// Every mutator returns a NEW object (never mutates the input) so it plays
// nicely with React state and last-write-wins reconciliation.
// =====================================================================

// Coerce any stored blob into a clean nested map, dropping garbage. Always an
// object, never null. Tolerates partial / legacy entries.
export function normalizeBests(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const gameId of Object.keys(raw)) {
    const games = raw[gameId];
    if (!games || typeof games !== 'object' || Array.isArray(games)) continue;
    const clean = {};
    for (const itemId of Object.keys(games)) {
      const e = games[itemId];
      if (!e || typeof e !== 'object' || Array.isArray(e)) continue;
      const best = Number.isFinite(e.best) ? Math.max(0, Math.floor(e.best)) : 0;
      const done = e.done === true;
      const ts = Number.isFinite(e.ts) ? e.ts : 0;
      clean[itemId] = { best, done, ts };
    }
    if (Object.keys(clean).length) out[gameId] = clean;
  }
  return out;
}

// Record a play. best = max(prev.best, score); done sticks true once a 'won'
// outcome is seen; ts stamps the latest write. `now` is injected for tests
// (defaults to Date.now()). Returns a NEW normalized object.
export function recordBest(gameBests, gameId, itemId, { score, outcome } = {}, now = Date.now()) {
  const base = normalizeBests(gameBests);
  if (typeof gameId !== 'string' || !gameId || typeof itemId !== 'string' || !itemId) return base;

  const games = base[gameId] || {};
  const prev = games[itemId] || { best: 0, done: false, ts: 0 };
  const s = Number.isFinite(score) ? Math.floor(score) : 0;
  const entry = {
    best: Math.max(prev.best, s),
    done: prev.done || outcome === 'won',
    ts: Number.isFinite(now) ? now : 0,
  };
  return { ...base, [gameId]: { ...games, [itemId]: entry } };
}

// The item→entry map for one game, or {} — never null.
export function bestsFor(gameBests, gameId) {
  const base = normalizeBests(gameBests);
  return base[gameId] || {};
}
