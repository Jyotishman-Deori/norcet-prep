// =====================================================================
// src/lib/chart-engine.js — pure grid logic for "The 3 AM Chart" (Task 3.2).
// No React / no lucide, so it's unit-testable in isolation. The screen
// (screens/three-am-chart.jsx) owns rendering + the lucide icon map; all the
// placement / line-clearing / stuck-detection rules live here.
// =====================================================================
export const SIZE = 8;
export const ICON_KEYS = ['pill', 'syringe', 'bone'];
// Warm, lo-fi pastel palette (spec: "pastel warm color scheme").
export const PALETTE = ['#E0996F', '#D98C8C', '#C98BB9', '#E3B566', '#B58A6A', '#CC8B86', '#D9A05B'];
// Block shapes — 2–4 cells (plus a rare single "dot"), normalized so [0,0] is
// the top-left of the bounding box (the tapped square becomes [0,0]).
export const SHAPES = [
  [[0, 0]],
  [[0, 0], [0, 1]], [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]], [[0, 1], [1, 0], [1, 1]], [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 1], [1, 1], [2, 0], [2, 1]],
];

const rnd = (n) => Math.floor(Math.random() * n);
export const at = (r, c) => r * SIZE + c;

export function makePiece() {
  return {
    cells: SHAPES[rnd(SHAPES.length)],
    icon: ICON_KEYS[rnd(ICON_KEYS.length)],
    color: PALETTE[rnd(PALETTE.length)],
    key: Math.random().toString(36).slice(2, 8),
  };
}
export const newTray = () => [makePiece(), makePiece(), makePiece()];

export function canPlace(grid, cells, r, c) {
  for (const [dr, dc] of cells) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return false;
    if (grid[at(rr, cc)]) return false;
  }
  return true;
}
export function placeCells(grid, cells, r, c, fill) {
  const g = grid.slice();
  for (const [dr, dc] of cells) g[at(r + dr, c + dc)] = fill;
  return g;
}
// Clear any full row AND any full column (counted together), returning the new
// grid + how many lines cleared (coins = clearedLines × 5).
export function clearFullLines(grid) {
  const g = grid.slice();
  const rows = [], cols = [];
  for (let r = 0; r < SIZE; r++) { let full = true; for (let c = 0; c < SIZE; c++) if (!g[at(r, c)]) { full = false; break; } if (full) rows.push(r); }
  for (let c = 0; c < SIZE; c++) { let full = true; for (let r = 0; r < SIZE; r++) if (!g[at(r, c)]) { full = false; break; } if (full) cols.push(c); }
  for (const r of rows) for (let c = 0; c < SIZE; c++) g[at(r, c)] = null;
  for (const c of cols) for (let r = 0; r < SIZE; r++) g[at(r, c)] = null;
  return { grid: g, cleared: rows.length + cols.length };
}
// Can any tray piece be placed anywhere? false → stuck (lifeline / game over).
export function anyMove(grid, tray) {
  for (const p of tray) {
    if (!p) continue;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (canPlace(grid, p.cells, r, c)) return true;
  }
  return false;
}
// Lifeline payoff: wipe the bottom half so the player can continue.
export function clearBottomHalf(grid) {
  const g = grid.slice();
  for (let r = SIZE / 2; r < SIZE; r++) for (let c = 0; c < SIZE; c++) g[at(r, c)] = null;
  return g;
}
// One easy MCQ from the real bank for the Brain-Rot Lifeline (single-answer, 4
// options). Returns null if the bank has nothing usable (→ lifeline disabled).
export function pickLifelineQuestion(allQuestions) {
  const usable = (allQuestions || []).filter(q =>
    q && q.q && Array.isArray(q.options) && q.options.length === 4 && Array.isArray(q.correct) && q.correct.length === 1);
  return usable.length ? usable[rnd(usable.length)] : null;
}
