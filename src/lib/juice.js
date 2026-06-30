// =====================================================================
// src/lib/juice.js — shared "game juice" gates.
//
// Centralizes the prefers-reduced-motion check that was duplicated inline across
// ~8 components, and provides a haptic() helper that honors it. Per the project
// accessibility rule (CLAUDE.md): reduced-motion must skip haptics + chimes, and
// vibration is mobile-only + feature-detected. Reusable by every game.
// =====================================================================

// True when the user has asked the OS to minimize motion. Never throws.
export function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { return false; }
}

// Named vibration patterns (ms, or [on, off, on, …]) for game feedback.
export const HAPTIC = {
  PLACE:   5,            // a piece landed
  CLEAR:   12,           // a line cleared
  COMBO:   [8, 24, 10],  // a combo / multi-line blast
  INVALID: 16,           // rejected (can't place here)
};

// Fire a haptic pulse — SKIPPED under reduced-motion, feature-detected, silent on
// failure. Safe to call un-guarded from anywhere.
export function haptic(pattern) {
  if (pattern == null || prefersReducedMotion()) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch (e) { /* never let feedback break the game */ }
}
