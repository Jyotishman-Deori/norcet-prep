// =====================================================================
// src/lib/pace.js — the test "Pace" setting (NEW-03 / Flashpoint).
// One global preference (data.preferences.pace) drives the per-question timer
// across Quick, Topic-wise and Mock so the choice is set once and inherited
// everywhere (topic tests launch instantly, with no setup screen of their own).
//
//   'off'        — no timer
//   'pulse'      — The Pulse: a non-blocking countdown bar (normal budgets)
//   'flashpoint' — Flashpoint: half-time budgets, the clock ENFORCES (a timeout
//                  auto-locks the question), answers score 2× into a separate
//                  Flashpoint leaderboard.
// =====================================================================
export const PACE_VALUES = ['off', 'pulse', 'flashpoint'];

// Back-compat: read the new enum, falling back to the old `pulseTimer` boolean.
export function normalizePace(prefs) {
  const p = prefs && prefs.pace;
  if (p === 'off' || p === 'pulse' || p === 'flashpoint') return p;
  if (prefs && prefs.pulseTimer) return 'pulse';
  return 'off';
}

// Resolve a pace into the two flags the Quiz/nav use.
export function paceFlags(pace) {
  return {
    pulse: pace === 'pulse' || pace === 'flashpoint',
    flashpoint: pace === 'flashpoint',
  };
}

export const FLASHPOINT_POINTS_MULTIPLIER = 2;
