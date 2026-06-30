// =====================================================================
// src/screens/three-am-chart.jsx — Strategy Task 3.2 "The 3 AM Chart".
//
// A CHILL block-placement puzzle (1010!-style): you get a tray of 3 small
// medical-icon pieces; DRAG a piece onto the chart. Fill any full row OR column
// and it clears with a 1-line nursing fact. When no piece fits, the "Brain-Rot
// Lifeline" offers one easy MCQ (a real bank question) — get it right and the
// bottom half of the chart clears so you can keep going.
//
// Interaction: pointer-DRAG with a live valid/invalid shadow preview (the piece
// floats above the thumb so it never blocks the board). Cozy juice on top —
// squash-on-drop, a warm particle puff + ascending pentatonic chime on a clear,
// a "Combo ×N" banner on consecutive clears, and light haptics. Every motion /
// audio / haptic path is gated by prefers-reduced-motion (lib/juice.js) and the
// sound toggle (lib/sound.js). Grid math stays in the pure lib/chart-engine.js.
//
// Hooks into the EXISTING Level Up economy: onComplete(coins) awards XP +
// Accuracy Coins (1 cleared line = 5), counts the game toward daily quests, and
// fires the level-up celebration — same contract every other game uses.
// =====================================================================
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Pill, Syringe, Bone, Moon, Coins, Trophy, Sparkles, Brain, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import ComboBurst from '../ui/combo-burst.jsx';
import { CHART_FACTS } from '../data/chart-facts.js';
import {
  SIZE, at, newTray, canPlace, placeCells, clearFullLines, anyMove, clearBottomHalf, pickLifelineQuestion,
} from '../lib/chart-engine.js';
import { prefersReducedMotion, haptic, HAPTIC } from '../lib/juice.js';
import { playPlaceTick, playClearChime } from '../lib/sound.js';

const COINS_PER_LINE = 5;                         // spec: 1 row = 5
const COMBO_TONE = '#E8A23D';                      // warm amber — fits the night-shift palette
const ICON_OF = { pill: Pill, syringe: Syringe, bone: Bone };
const rnd = (n) => Math.floor(Math.random() * n);

const JUICE_CSS = `
@keyframes cellPlace { 0%{transform:scale(.86)} 60%{transform:scale(1.06)} 100%{transform:scale(1)} }
.cell-place { animation: cellPlace .26s cubic-bezier(.34,1.56,.64,1); }
@keyframes cozyParticle {
  0%   { transform: translate(-50%,-50%) scale(1); opacity: .9 }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.4); opacity: 0 }
}
.cozy-particle { position: fixed; width: 6px; height: 6px; border-radius: 9999px; pointer-events: none; will-change: transform, opacity; z-index: 55; animation: cozyParticle .65s ease-out forwards; }
@media (prefers-reduced-motion: reduce) { .cell-place { animation: none } .cozy-particle { display: none } }
`;

// Mini render of a piece's bounding box. `cell` = px per cell, `gap` = px gap.
function PieceMini({ piece, cell = 17, gap = 3 }) {
  let maxR = 0, maxC = 0;
  piece.cells.forEach(([r, c]) => { if (r > maxR) maxR = r; if (c > maxC) maxC = c; });
  const filled = new Set(piece.cells.map(([r, c]) => `${r}:${c}`));
  const Icon = ICON_OF[piece.icon];
  const rows = [];
  for (let r = 0; r <= maxR; r++) {
    const cells = [];
    for (let c = 0; c <= maxC; c++) {
      const on = filled.has(`${r}:${c}`);
      cells.push(
        <div key={c} className="rounded-[4px] flex items-center justify-center"
             style={{ width: cell, height: cell, background: on ? piece.color : 'transparent' }}>
          {on && <Icon size={Math.round(cell * 0.58)} color="#FFFFFFDD" />}
        </div>
      );
    }
    rows.push(<div key={r} className="flex" style={{ gap }}>{cells}</div>);
  }
  return <div className="flex flex-col" style={{ gap }}>{rows}</div>;
}

function ThreeAmChart({ onBack, onComplete, allQuestions = [] }) {
  const { theme: T } = useTheme();
  const [grid, setGrid] = useState(() => Array(SIZE * SIZE).fill(null));
  const [tray, setTray] = useState(() => newTray());
  const [cleared, setCleared] = useState(0);
  const [fact, setFact] = useState(null);
  const [lifeline, setLifeline] = useState(null);   // { q } | null
  const [lifelineUsed, setLifelineUsed] = useState(false);
  const [phase, setPhase] = useState('play');       // play | done

  // Drag + juice state.
  const [drag, setDrag] = useState(null);           // { index, piece, cellSize, x, y } | null
  const [preview, setPreview] = useState(null);     // { cells:[{r,c}], valid } | null
  const [placed, setPlaced] = useState(null);       // { idx:[i], key } — squash trigger
  const [bursts, setBursts] = useState([]);         // particle divs
  const [comboFlash, setComboFlash] = useState(null);

  const gridRef = useRef(grid); gridRef.current = grid;
  const trayRef = useRef(tray); trayRef.current = tray;
  const boardRef = useRef(null);                    // the 8×8 grid container
  const dragInfo = useRef(null);                    // sync mirror of the active drag
  const lastPt = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const comboRef = useRef(0);
  const factTimer = useRef(null);
  const placedTimer = useRef(null);
  const comboTimer = useRef(null);

  useEffect(() => () => {
    [factTimer, placedTimer, comboTimer].forEach(t => t.current && clearTimeout(t.current));
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const coins = cleared * COINS_PER_LINE;

  const flashFact = () => {
    setFact(CHART_FACTS[rnd(CHART_FACTS.length)]);
    if (factTimer.current) clearTimeout(factTimer.current);
    factTimer.current = setTimeout(() => setFact(null), 1600);
  };

  const resolveStuck = (g, t) => {
    if (!lifelineUsed) {
      const q = pickLifelineQuestion(allQuestions);
      if (q) { setLifeline({ q }); return; }
    }
    setPhase('done');
  };

  // Spawn a small, capped warm-pastel particle puff at each cell that just
  // cleared. Reads positions from the CURRENT DOM (before setGrid commits).
  const spawnBurst = (filled, afterClear) => {
    const gridEl = boardRef.current;
    if (!gridEl) return;
    const parts = [];
    let count = 0;
    for (let i = 0; i < filled.length && count < 48; i++) {
      if (filled[i] && !afterClear[i]) {
        const el = gridEl.querySelector(`[data-i="${i}"]`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const color = filled[i].color;
        for (let k = 0; k < 4 && count < 48; k++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 10 + Math.random() * 18;
          parts.push({
            id: `${Date.now()}-${i}-${k}-${Math.random().toString(36).slice(2, 6)}`,
            x: cx, y: cy, dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist - 6, color,
          });
          count++;
        }
      }
    }
    if (!parts.length) return;
    setBursts(b => [...b, ...parts]);
    const ids = new Set(parts.map(p => p.id));
    setTimeout(() => setBursts(b => b.filter(p => !ids.has(p.id))), 700);
  };

  // Commit a placement at (r,c) + fire all the juice. Mirrors the old tapCell.
  const doPlace = useCallback((index, piece, r, c) => {
    const reduced = prefersReducedMotion();
    const filled = placeCells(gridRef.current, piece.cells, r, c, { icon: piece.icon, color: piece.color });
    const { grid: afterClear, cleared: n } = clearFullLines(filled);
    if (n > 0 && !reduced) spawnBurst(filled, afterClear);

    let nextTray = trayRef.current.slice();
    nextTray[index] = null;
    if (nextTray.every(p => !p)) nextTray = newTray();

    setGrid(afterClear);
    setTray(nextTray);
    const placedIdx = piece.cells.map(([dr, dc]) => at(r + dr, c + dc));
    setPlaced({ idx: placedIdx, key: Date.now() });
    if (placedTimer.current) clearTimeout(placedTimer.current);
    placedTimer.current = setTimeout(() => setPlaced(null), 280);

    if (!reduced) playPlaceTick();
    haptic(HAPTIC.PLACE);

    if (n > 0) {
      const nextCombo = comboRef.current + 1;
      comboRef.current = nextCombo;
      setCleared(x => x + n);
      flashFact();
      if (!reduced) playClearChime(nextCombo - 1, n);
      haptic(n > 1 || nextCombo >= 3 ? HAPTIC.COMBO : HAPTIC.CLEAR);
      if (nextCombo >= 2) {
        setComboFlash({ label: 'Combo', tone: COMBO_TONE, combo: nextCombo, key: Date.now() });
        if (comboTimer.current) clearTimeout(comboTimer.current);
        comboTimer.current = setTimeout(() => setComboFlash(null), 1300);
      }
    } else {
      comboRef.current = 0;
    }

    if (!anyMove(afterClear, nextTray)) setTimeout(() => resolveStuck(afterClear, nextTray), 160);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifelineUsed, allQuestions]);

  // ── Pointer drag: pick up a tray piece, preview the landing, drop ──
  const LIFT_CELLS = 2.2; // how far above the thumb the piece floats (in cells)

  const cellUnder = useCallback((x, y, cellSize) => {
    const el = document.elementFromPoint(x, y - cellSize * LIFT_CELLS);
    const cellEl = el && el.closest ? el.closest('[data-r]') : null;
    if (!cellEl) return null;
    return { r: +cellEl.getAttribute('data-r'), c: +cellEl.getAttribute('data-c') };
  }, []);

  const onMove = useCallback((e) => {
    lastPt.current = { x: e.clientX, y: e.clientY };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const d = dragInfo.current;
      if (!d) return;
      const { x, y } = lastPt.current;
      setDrag(prev => (prev ? { ...prev, x, y } : prev));
      const anchor = cellUnder(x, y, d.cellSize);
      if (!anchor) { setPreview(null); return; }
      const valid = canPlace(gridRef.current, d.piece.cells, anchor.r, anchor.c);
      setPreview({ cells: d.piece.cells.map(([dr, dc]) => ({ r: anchor.r + dr, c: anchor.c + dc })), valid });
    });
  }, [cellUnder]);

  const onUp = useCallback(() => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    const d = dragInfo.current;
    dragInfo.current = null;
    const { x, y } = lastPt.current;
    setDrag(null);
    setPreview(null);
    if (!d) return;
    const anchor = cellUnder(x, y, d.cellSize);
    if (anchor && canPlace(gridRef.current, d.piece.cells, anchor.r, anchor.c)) {
      doPlace(d.index, d.piece, anchor.r, anchor.c);
    } else {
      haptic(HAPTIC.INVALID);
    }
  }, [onMove, cellUnder, doPlace]);

  const startDrag = (e, index, piece) => {
    if (phase !== 'play' || lifeline || !piece) return;
    const cellEl = boardRef.current && boardRef.current.querySelector('[data-r]');
    const cellSize = cellEl ? cellEl.getBoundingClientRect().width : 36;
    dragInfo.current = { index, piece, cellSize };
    lastPt.current = { x: e.clientX, y: e.clientY };
    setDrag({ index, piece, cellSize, x: e.clientX, y: e.clientY });
    // Pre-seed the preview so the first frame already shows the landing.
    const anchor = cellUnder(e.clientX, e.clientY, cellSize);
    if (anchor) setPreview({ cells: piece.cells.map(([dr, dc]) => ({ r: anchor.r + dr, c: anchor.c + dc })), valid: canPlace(grid, piece.cells, anchor.r, anchor.c) });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    e.preventDefault();
  };

  const answerLifeline = (optIndex) => {
    if (!lifeline) return;
    const correct = lifeline.q.correct[0] === optIndex;
    setLifeline(null); setLifelineUsed(true);
    if (correct) {
      const g2 = clearBottomHalf(gridRef.current);
      setGrid(g2); flashFact(); haptic(HAPTIC.CLEAR);
      if (!prefersReducedMotion()) playClearChime(0, 2);
      setTimeout(() => { if (!anyMove(g2, trayRef.current)) setPhase('done'); }, 160);
    } else {
      haptic(HAPTIC.INVALID);
      setTimeout(() => setPhase('done'), 240);
    }
  };

  // ── DONE — summary + reward ──
  if (phase === 'done') {
    return (
      <div className="anim-fadeup">
        <TopBar title="The 3 AM Chart" onBack={onBack} />
        <div className="max-w-md mx-auto px-4 pt-10 pb-24 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 q-pulse"
               style={{ background: T.primary + '18', border: `1px solid ${T.primary}44` }}>
            <Trophy size={28} style={{ color: T.primary }} />
          </div>
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Chart logged</div>
          <div className="text-[14px] mb-5" style={{ color: T.inkSoft }}>
            You cleared <b style={{ color: T.ink }}>{cleared}</b> {cleared === 1 ? 'line' : 'lines'} on the night shift.
          </div>
          {coins > 0 ? (
            <div className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full mb-7 q-pulse"
                 style={{ background: '#F59E0B22', color: '#B45309' }}>
              <Coins size={15} /> +{coins} Coins
            </div>
          ) : (
            <div className="text-[13px] mb-7" style={{ color: T.muted }}>No lines cleared this time — chip away at a row or column next round.</div>
          )}
          <Button onClick={() => { try { if (onComplete) onComplete(coins); } catch (e) {} }} size="lg" className="w-full">
            Finish
          </Button>
        </div>
      </div>
    );
  }

  // ── PLAY ──
  return (
    <div className="test-enter">
      <style>{JUICE_CSS}</style>
      <TopBar title="The 3 AM Chart" onBack={onBack}
              right={
                <div className="flex items-center gap-1.5 text-xs font-bold tabular-nums px-2.5 py-1 rounded-full"
                     style={{ color: '#B45309', background: '#F59E0B1A', border: '1px solid #F59E0B33' }}>
                  <Coins size={13} /> {coins}
                </div>
              } />
      <div className="max-w-md mx-auto px-4 pb-40 pt-2">
        <div className="flex items-center gap-1.5 text-[12px] leading-snug mb-3" style={{ color: T.muted }}>
          <Moon size={13} style={{ color: T.primary }} />
          Drag a piece onto the chart. Fill a row or column to clear it. No timer — pure chill.
        </div>

        {/* fact flash */}
        <div className="h-7 mb-1.5 flex items-center justify-center">
          {fact && (
            <div className="anim-fadeup inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
                 style={{ background: T.success + '1A', color: T.success, border: `1px solid ${T.success}44` }}>
              <Sparkles size={12} /> {fact}
            </div>
          )}
        </div>

        {/* the 8×8 chart */}
        <div className="mx-auto" style={{ maxWidth: 360 }}>
          <div ref={boardRef} className="grid gap-1 p-1.5 rounded-2xl"
               style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}`, boxShadow: fact ? `0 0 0 2px ${T.success}55` : 'none', transition: 'box-shadow .25s' }}>
            {grid.map((cell, i) => {
              const r = Math.floor(i / SIZE), c = i % SIZE;
              const Icon = cell ? ICON_OF[cell.icon] : null;
              const isPrev = preview && preview.cells.some(p => p.r === r && p.c === c);
              const ghost = isPrev ? (preview.valid ? T.success : T.error) : null;
              const justPlaced = placed && placed.idx.includes(i);
              let style;
              if (cell) {
                style = { background: cell.color, boxShadow: ghost ? `inset 0 0 0 2px ${ghost}` : 'inset 0 -2px 0 rgba(0,0,0,0.12)' };
              } else if (ghost) {
                style = { background: ghost + '33', border: `1px solid ${ghost}` };
              } else {
                style = { background: T.bg, border: `1px solid ${T.borderSoft}` };
              }
              return (
                <div key={i} data-r={r} data-c={c} data-i={i}
                     className={`aspect-square rounded-[6px] flex items-center justify-center${justPlaced ? ' cell-place' : ''}`}
                     style={style}>
                  {Icon && <Icon size={15} color="#FFFFFFE0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* tray */}
        <div className="text-[10px] uppercase tracking-widest font-semibold mt-5 mb-2 text-center" style={{ color: T.muted }}>Your pieces · drag to place</div>
        <div className="flex items-stretch justify-center gap-3">
          {tray.map((piece, i) => {
            const dragging = drag && drag.index === i;
            return (
              <button key={piece ? piece.key : `empty-${i}`} disabled={!piece}
                      onPointerDown={(e) => startDrag(e, i, piece)}
                      className="no-tap-highlight flex items-center justify-center rounded-2xl transition active:scale-95"
                      style={{
                        width: 92, height: 84, touchAction: 'none',
                        background: T.surface,
                        border: `1.5px solid ${T.borderSoft}`,
                        opacity: piece ? (dragging ? 0.35 : 1) : 0.4,
                      }}>
                {piece ? <PieceMini piece={piece} /> : <X size={16} style={{ color: T.muted }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* floating dragged piece — follows the pointer, lifted above the thumb */}
      {drag && drag.piece && (
        <div className="fixed z-[58] pointer-events-none"
             style={{
               left: drag.x, top: drag.y - drag.cellSize * LIFT_CELLS,
               transform: 'translate(-50%, -50%)',
               filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.28))',
             }}>
          <PieceMini piece={drag.piece} cell={drag.cellSize} gap={4} />
        </div>
      )}

      {/* particle puffs (cleared cells) */}
      {bursts.map(p => (
        <div key={p.id} className="cozy-particle"
             style={{ left: p.x, top: p.y, background: p.color, '--dx': `${p.dx}px`, '--dy': `${p.dy}px` }} />
      ))}

      {/* combo banner (reuses the shared kinetic-typography component) */}
      <ComboBurst flash={comboFlash} />

      {/* fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="text-[11px] leading-tight flex-1" style={{ color: T.muted }}>
            Drag a piece onto the chart to place it.
          </div>
          <Button variant="ghost" onClick={() => setPhase('done')} className="flex-shrink-0">End &amp; collect</Button>
        </div>
      </div>

      {/* Brain-Rot Lifeline */}
      {lifeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <Card className="w-full max-w-md anim-scalein p-4" style={{ border: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={17} style={{ color: T.accent }} />
              <div className="font-display text-base font-semibold" style={{ color: T.ink }}>Brain-Rot Lifeline</div>
            </div>
            <div className="text-[12px] leading-relaxed mb-3" style={{ color: T.muted }}>
              No room left. Answer this and the bottom half of the chart clears — keep your shift going.
            </div>
            <div className="font-display text-[15px] leading-snug mb-3" style={{ color: T.ink }}>{lifeline.q.q}</div>
            <div className="space-y-2">
              {lifeline.q.options.map((opt, i) => (
                <button key={i} onClick={() => answerLifeline(i)}
                        className="no-tap-highlight w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl active:scale-[0.99] transition"
                        style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-bold"
                        style={{ background: T.surfaceWarm, color: T.muted }}>{String.fromCharCode(65 + i)}</span>
                  <span className="text-[14px] leading-snug" style={{ color: T.ink }}>{opt}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default ThreeAmChart;
