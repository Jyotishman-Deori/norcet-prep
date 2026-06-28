// =====================================================================
// src/lib/survival-engine.js — pure rules for "Shift Survival" (Task 3.3).
// Reuses the chart-engine grid primitives and adds the high-stress mechanics:
// antidote-gated CONDITION rows, single-cell COMPLICATION spawns (the move
// timer's penalty), and a tray that mixes in antidote pieces. No React.
// =====================================================================
import { SIZE, at, canPlace, placeCells, anyMove, makePiece } from './chart-engine.js';
import { CONDITIONS } from '../data/shift-survival.js';

export { SIZE, at, canPlace, placeCells, anyMove };

const rnd = (n) => Math.floor(Math.random() * n);
export const ANTIDOTE_COLOR = '#0EA5A5';                 // antidote pieces glow teal
export const COMPLICATION_FILL = { complication: true, color: '#7F1D1D', icon: 'alert' };
const CONDITION_BY_ID = Object.fromEntries(CONDITIONS.map(c => [c.id, c]));
export const conditionById = (id) => CONDITION_BY_ID[id] || null;

// A tray piece is either normal, or — when conditions are active — a ~40%-chance
// antidote piece bound to one active condition (whole piece counts as antidote).
export function makeSurvivalPiece(activeConditionIds = []) {
  const p = makePiece();
  if (activeConditionIds.length && Math.random() < 0.4) {
    return { ...p, antidote: activeConditionIds[rnd(activeConditionIds.length)], color: ANTIDOTE_COLOR, icon: 'syringe' };
  }
  return p;
}
export const newSurvivalTray = (activeConditionIds = []) =>
  [makeSurvivalPiece(activeConditionIds), makeSurvivalPiece(activeConditionIds), makeSurvivalPiece(activeConditionIds)];

const rowFull = (g, r) => { for (let c = 0; c < SIZE; c++) if (!g[at(r, c)]) return false; return true; };
const colFull = (g, c) => { for (let r = 0; r < SIZE; r++) if (!g[at(r, c)]) return false; return true; };
const rowHasAntidote = (g, r, condId) => { for (let c = 0; c < SIZE; c++) { const cell = g[at(r, c)]; if (cell && cell.antidote === condId) return true; } return false; };

// Clear full rows + columns. A CONDITION row clears ONLY if it also holds a
// matching antidote cell (otherwise it stays full — the pressure). Returns the
// new grid, the cleared-line count (coins ×10), and which condition rows resolved.
export function clearLinesSurvival(grid, conditionByRow = {}) {
  const g = grid.slice();
  const rows = [], resolved = [];
  for (let r = 0; r < SIZE; r++) {
    if (!rowFull(g, r)) continue;
    const cond = conditionByRow[r];
    if (!cond) { rows.push(r); }
    else if (rowHasAntidote(g, r, cond)) { rows.push(r); resolved.push(r); }
    // full condition row without antidote → does NOT clear
  }
  const cols = [];
  for (let c = 0; c < SIZE; c++) if (colFull(g, c)) cols.push(c);
  for (const r of rows) for (let c = 0; c < SIZE; c++) g[at(r, c)] = null;
  for (const c of cols) for (let r = 0; r < SIZE; r++) g[at(r, c)] = null;
  return { grid: g, cleared: rows.length + cols.length, resolved };
}

// The move-timer penalty: drop one complication clot on a random empty square.
// ok:false when the board is full → the shift is lost (game over).
export function spawnComplication(grid) {
  const empties = [];
  for (let i = 0; i < grid.length; i++) if (!grid[i]) empties.push(i);
  if (!empties.length) return { grid, ok: false };
  const i = empties[rnd(empties.length)];
  const g = grid.slice();
  g[i] = { ...COMPLICATION_FILL };
  return { grid: g, ok: true };
}

// Pick a fresh condition id not already active (null when all are in play).
export function pickCondition(excludeIds = []) {
  const pool = CONDITIONS.filter(c => !excludeIds.includes(c.id));
  return pool.length ? pool[rnd(pool.length)].id : null;
}

// A random grid row to assign a new condition to (prefers a mostly-empty row,
// never one that already has a condition). Returns null if none suitable.
export function pickConditionRow(grid, takenRows = []) {
  const candidates = [];
  for (let r = 0; r < SIZE; r++) {
    if (takenRows.includes(r)) continue;
    let filled = 0;
    for (let c = 0; c < SIZE; c++) if (grid[at(r, c)]) filled++;
    if (filled <= 3) candidates.push(r);          // room to actually solve it
  }
  return candidates.length ? candidates[rnd(candidates.length)] : null;
}
