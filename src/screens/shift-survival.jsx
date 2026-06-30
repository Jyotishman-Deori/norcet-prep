// =====================================================================
// src/screens/shift-survival.jsx — Strategy Task 3.3 "Shift Survival".
// The high-stress twin of The 3 AM Chart: same block-placement engine, dark
// cinematic skin, a 5-second move timer that drops a COMPLICATION clot if you
// stall, antidote-gated CONDITION rows, a combo "crisis" clinical-math question
// (10s), and a "Patient Expired" malpractice review on death. Harder → pays
// double (1 line = 10 coins). Hooks the existing economy via onComplete(coins).
//
// Interaction: pointer-DRAG with a live valid/invalid shadow preview (the piece
// floats above the thumb). Same cozy juice as the 3 AM Chart — squash-on-drop,
// a particle puff + ascending pentatonic chime + Combo banner on clears, light
// haptics — all gated by prefers-reduced-motion (lib/juice.js) and the sound
// toggle (lib/sound.js). Grid math stays in the pure lib/survival-engine.js.
// =====================================================================
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Pill, Syringe, Bone, AlertTriangle, ArrowLeft, Coins, Skull, HeartPulse, Brain, Activity } from 'lucide-react';
import { Card, Button } from '../ui/primitives.jsx';
import ComboBurst from '../ui/combo-burst.jsx';
import { MATH_QUESTIONS } from '../data/shift-survival.js';
import {
  SIZE, at, canPlace, placeCells, anyMove,
  newSurvivalTray, clearLinesSurvival, spawnComplication, pickCondition, pickConditionRow, conditionById,
} from '../lib/survival-engine.js';
import { prefersReducedMotion, haptic, HAPTIC } from '../lib/juice.js';
import { playPlaceTick, playClearChime } from '../lib/sound.js';

const COINS_PER_LINE = 10;          // spec: harder → double Game A's 5
const MATH_BONUS = 50;
const MOVE_SECONDS = 5;
const MATH_SECONDS = 10;
const COMBO_TRIGGER = 2;            // clearing ≥2 lines at once = a "crisis"

// Fixed dark cinematic palette (independent of the app theme — the spec wants a
// dark, red-pulsing aesthetic in light mode too).
const D = {
  bg: '#0A1120', panel: '#111B2E', slot: '#0E1A2C', slotBorder: '#1E2A40',
  ink: '#E5EDF7', muted: '#8FA3BE', red: '#EF4444', redDeep: '#7F1D1D',
  teal: '#2DD4BF', amber: '#F59E0B',
};
const ICON_OF = { pill: Pill, syringe: Syringe, bone: Bone, alert: AlertTriangle };
const rnd = (n) => Math.floor(Math.random() * n);
const activeIdsOf = (cbr) => Object.values(cbr);

// Shuffle a math question's options so the answer isn't always in the same slot
// (the static bank stores correct at index 0). Returns a fresh presentable q.
function shuffledMath(base) {
  const arr = base.options.map((text, i) => ({ text, correct: i === base.correct }));
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return { q: base.q, options: arr.map(x => x.text), correct: arr.findIndex(x => x.correct) };
}

// Mini render of a piece's bounding box. `cell` = px per cell, `gap` = px gap.
function PieceMini({ piece, cell = 16, gap = 3 }) {
  let maxR = 0, maxC = 0;
  piece.cells.forEach(([r, c]) => { if (r > maxR) maxR = r; if (c > maxC) maxC = c; });
  const filled = new Set(piece.cells.map(([r, c]) => `${r}:${c}`));
  const Icon = ICON_OF[piece.icon] || Pill;
  const rows = [];
  for (let r = 0; r <= maxR; r++) {
    const cells = [];
    for (let c = 0; c <= maxC; c++) {
      const on = filled.has(`${r}:${c}`);
      cells.push(
        <div key={c} className="rounded-[4px] flex items-center justify-center" style={{ width: cell, height: cell, background: on ? piece.color : 'transparent' }}>
          {on && <Icon size={Math.round(cell * 0.56)} color="#FFFFFFDD" />}
        </div>
      );
    }
    rows.push(<div key={r} className="flex" style={{ gap }}>{cells}</div>);
  }
  return <div className="flex flex-col" style={{ gap }}>{rows}</div>;
}

// A linear shrink bar (move timer / math timer). Re-mount via `runKey` to restart.
function TimerBar({ runKey, seconds, paused, color }) {
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: '#00000055' }}>
      <div key={runKey} style={{
        height: '100%', background: color,
        animation: `survShrink ${seconds}s linear forwards`,
        animationPlayState: paused ? 'paused' : 'running',
      }} />
    </div>
  );
}

function ShiftSurvival({ onBack, onComplete }) {
  const [grid, setGrid] = useState(() => Array(SIZE * SIZE).fill(null));
  const [conditionByRow, setConditionByRow] = useState(() => {
    const id = pickCondition([]);
    const row = pickConditionRow(Array(SIZE * SIZE).fill(null), []);
    return (id != null && row != null) ? { [row]: id } : {};
  });
  const [tray, setTray] = useState(() => newSurvivalTray(activeIdsOf({})));
  const [coins, setCoins] = useState(0);
  const [moveKey, setMoveKey] = useState(0);
  const [math, setMath] = useState(null);            // { q, options, correct }
  const [mathKey, setMathKey] = useState(0);
  const [failed, setFailed] = useState([]);          // malpractice review
  const [phase, setPhase] = useState('play');        // play | dead

  // Drag + juice state.
  const [drag, setDrag] = useState(null);            // { index, piece, cellSize, x, y } | null
  const [preview, setPreview] = useState(null);      // { cells:[{r,c}], valid } | null
  const [placed, setPlaced] = useState(null);        // { idx:[i], key } — squash trigger
  const [bursts, setBursts] = useState([]);          // particle divs
  const [comboFlash, setComboFlash] = useState(null);

  const gridRef = useRef(grid); gridRef.current = grid;
  const trayRef = useRef(tray); trayRef.current = tray;
  const condRef = useRef(conditionByRow); condRef.current = conditionByRow;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const mathRef = useRef(math); mathRef.current = math;
  const boardRef = useRef(null);
  const dragInfo = useRef(null);
  const lastPt = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const comboRef = useRef(0);
  const placedTimer = useRef(null);
  const comboTimer = useRef(null);
  const doPlaceRef = useRef(null);

  useEffect(() => () => {
    [placedTimer, comboTimer].forEach(t => t.current && clearTimeout(t.current));
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const die = () => { haptic(60); setPhase('dead'); };

  // Re-top conditions toward 2 active, dropping `resolved` rows first.
  const reconcileConditions = (gridAfter, resolved) => {
    const next = { ...condRef.current };
    resolved.forEach(r => { delete next[r]; });
    if (Object.keys(next).length < 2) {
      const taken = Object.keys(next).map(Number);
      const id = pickCondition(Object.values(next));
      const row = pickConditionRow(gridAfter, taken);
      if (id != null && row != null) next[row] = id;
    }
    setConditionByRow(next);
    return next;
  };

  const afterBoardChange = (g, t) => {
    if (!anyMove(g, t)) setTimeout(() => { if (phaseRef.current === 'play') die(); }, 160);
  };

  // ── 5-second move timer → complication clot ──
  useEffect(() => {
    if (phase !== 'play' || math) return;
    const id = setTimeout(() => {
      const res = spawnComplication(gridRef.current);
      if (!res.ok) { die(); return; }
      const { grid: afterClear, cleared, resolved } = clearLinesSurvival(res.grid, condRef.current);
      if (cleared > 0) setCoins(x => x + cleared * COINS_PER_LINE);
      reconcileConditions(afterClear, resolved);
      setGrid(afterClear);
      haptic(22);
      setMoveKey(k => k + 1);
      afterBoardChange(afterClear, trayRef.current);
    }, MOVE_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [moveKey, phase, math]);

  // ── 10-second math crisis timer ──
  useEffect(() => {
    if (!math || phase !== 'play') return;
    const id = setTimeout(() => resolveMath(-1, true), MATH_SECONDS * 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mathKey, math, phase]);

  // Spawn a small, capped particle puff at each cell that just cleared. Reads
  // positions from the CURRENT DOM (before setGrid commits).
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

  // Commit a placement at (r,c) + fire the juice + the existing survival logic.
  const doPlace = (index, piece, r, c) => {
    const reduced = prefersReducedMotion();
    const fill = { icon: piece.icon, color: piece.color, ...(piece.antidote ? { antidote: piece.antidote } : {}) };
    const placedGrid = placeCells(gridRef.current, piece.cells, r, c, fill);
    const { grid: afterClear, cleared, resolved } = clearLinesSurvival(placedGrid, condRef.current);
    if (cleared > 0 && !reduced) spawnBurst(placedGrid, afterClear);

    let nextTray = trayRef.current.slice(); nextTray[index] = null;
    if (nextTray.every(p => !p)) nextTray = newSurvivalTray(activeIdsOf(condRef.current));
    reconcileConditions(afterClear, resolved);
    setGrid(afterClear); setTray(nextTray);

    const placedIdx = piece.cells.map(([dr, dc]) => at(r + dr, c + dc));
    setPlaced({ idx: placedIdx, key: Date.now() });
    if (placedTimer.current) clearTimeout(placedTimer.current);
    placedTimer.current = setTimeout(() => setPlaced(null), 280);

    if (!reduced) playPlaceTick();
    haptic(HAPTIC.PLACE);
    setMoveKey(k => k + 1);

    if (cleared > 0) {
      setCoins(x => x + cleared * COINS_PER_LINE);
      const nextCombo = comboRef.current + 1; comboRef.current = nextCombo;
      if (!reduced) playClearChime(nextCombo - 1, cleared);
      haptic(cleared > 1 || nextCombo >= 3 ? HAPTIC.COMBO : HAPTIC.CLEAR);
      if (cleared >= COMBO_TRIGGER) {
        // The crisis modal is the payoff for a multi-line clear — no banner.
        setMath(shuffledMath(MATH_QUESTIONS[rnd(MATH_QUESTIONS.length)])); setMathKey(k => k + 1);
      } else {
        if (nextCombo >= 2) {
          setComboFlash({ label: 'Combo', tone: D.amber, combo: nextCombo, key: Date.now() });
          if (comboTimer.current) clearTimeout(comboTimer.current);
          comboTimer.current = setTimeout(() => setComboFlash(null), 1300);
        }
        afterBoardChange(afterClear, nextTray);
      }
    } else {
      comboRef.current = 0;
      afterBoardChange(afterClear, nextTray);
    }
  };
  doPlaceRef.current = doPlace;

  // ── Pointer drag: pick up a tray piece, preview the landing, drop ──
  const LIFT_CELLS = 2.2;
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
      doPlaceRef.current(d.index, d.piece, anchor.r, anchor.c);
    } else {
      haptic(HAPTIC.INVALID);
    }
  }, [onMove, cellUnder]);

  const startDrag = (e, index, piece) => {
    if (phase !== 'play' || math || !piece) return;
    const cellEl = boardRef.current && boardRef.current.querySelector('[data-r]');
    const cellSize = cellEl ? cellEl.getBoundingClientRect().width : 36;
    dragInfo.current = { index, piece, cellSize };
    lastPt.current = { x: e.clientX, y: e.clientY };
    setDrag({ index, piece, cellSize, x: e.clientX, y: e.clientY });
    const anchor = cellUnder(e.clientX, e.clientY, cellSize);
    if (anchor) setPreview({ cells: piece.cells.map(([dr, dc]) => ({ r: anchor.r + dr, c: anchor.c + dc })), valid: canPlace(grid, piece.cells, anchor.r, anchor.c) });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    e.preventDefault();
  };

  function resolveMath(optIndex, viaTimeout) {
    const q = mathRef.current;
    if (!q) return;
    const correct = !viaTimeout && optIndex === q.correct;
    setMath(null);
    if (correct) { setCoins(x => x + MATH_BONUS); haptic(12); }
    else {
      setFailed(f => [...f, { q: q.q, answer: q.options[q.correct], timeout: !!viaTimeout }]);
      haptic(30);
      const res = spawnComplication(gridRef.current);
      if (res.ok) {
        const { grid: g2, cleared, resolved } = clearLinesSurvival(res.grid, condRef.current);
        if (cleared > 0) setCoins(x => x + cleared * COINS_PER_LINE);
        reconcileConditions(g2, resolved);
        setGrid(g2);
      } else { die(); return; }
    }
    setMoveKey(k => k + 1);
    setTimeout(() => { if (phaseRef.current === 'play') afterBoardChange(gridRef.current, trayRef.current); }, 60);
  }

  const styleTag = <style>{`
@keyframes survShrink{from{width:100%}to{width:0%}}
@keyframes survPulse{0%,100%{box-shadow:0 0 0 1px ${D.redDeep},0 0 0 0 ${D.red}00}50%{box-shadow:0 0 0 1px ${D.red},0 0 22px 2px ${D.red}55}}
@keyframes cellPlace{0%{transform:scale(.86)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
.cell-place{animation:cellPlace .26s cubic-bezier(.34,1.56,.64,1)}
@keyframes cozyParticle{0%{transform:translate(-50%,-50%) scale(1);opacity:.9}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.4);opacity:0}}
.cozy-particle{position:fixed;width:6px;height:6px;border-radius:9999px;pointer-events:none;will-change:transform,opacity;z-index:55;animation:cozyParticle .65s ease-out forwards}
@media (prefers-reduced-motion: reduce){.cell-place{animation:none}.cozy-particle{display:none}}
`}</style>;

  // ── PATIENT EXPIRED ──
  if (phase === 'dead') {
    return (
      <div className="min-h-screen" style={{ background: D.bg }}>
        {styleTag}
        <div className="max-w-md mx-auto px-4 pt-12 pb-24 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: D.redDeep, border: `1px solid ${D.red}` }}>
            <Skull size={30} color={D.red} />
          </div>
          <div className="font-display text-2xl font-bold tracking-wide mb-1" style={{ color: D.red }}>PATIENT EXPIRED</div>
          <div className="text-[13px] mb-5" style={{ color: D.muted }}>Shift over. The board overwhelmed you.</div>

          <div className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full mb-6" style={{ background: D.amber + '22', color: D.amber }}>
            <Coins size={15} /> +{coins} Coins
          </div>

          <div className="text-left rounded-2xl p-4 mb-6" style={{ background: D.panel, border: `1px solid ${D.slotBorder}` }}>
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse size={15} color={D.red} />
              <div className="font-display text-sm font-semibold" style={{ color: D.ink }}>Malpractice review</div>
            </div>
            {failed.length === 0 ? (
              <div className="text-[12.5px] leading-relaxed" style={{ color: D.muted }}>No protocol breaches logged — you were simply buried by complications. Clear lines faster next shift.</div>
            ) : (
              <div className="space-y-2.5">
                {failed.map((f, i) => (
                  <div key={i} className="text-[12.5px] leading-relaxed">
                    <div style={{ color: D.ink }}>{f.timeout ? '⏱ ' : '✗ '}{f.q}</div>
                    <div style={{ color: D.teal }}>Correct: {f.answer}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={() => { try { if (onComplete) onComplete(coins); } catch (e) {} }} size="lg" className="w-full">
            End shift
          </Button>
        </div>
      </div>
    );
  }

  // ── PLAY ──
  const activeConditions = Object.entries(conditionByRow)
    .map(([r, id]) => ({ row: Number(r), ...conditionById(id) }))
    .filter(x => x.id);

  return (
    <div className="min-h-screen" style={{ background: D.bg }}>
      {styleTag}
      {/* dark header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
           style={{ background: D.bg + 'F0', borderBottom: `1px solid ${D.slotBorder}`, paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}>
        <button onClick={onBack} className="no-tap-highlight p-1.5 -ml-1.5 rounded-lg active:bg-white/5"><ArrowLeft size={20} color={D.muted} /></button>
        <div className="font-display text-sm font-bold tracking-wide flex items-center gap-1.5" style={{ color: D.ink }}>
          <Activity size={15} color={D.red} className="timer-beat" /> SHIFT SURVIVAL
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold tabular-nums px-2.5 py-1 rounded-full" style={{ color: D.amber, background: D.amber + '1A', border: `1px solid ${D.amber}33` }}>
          <Coins size={13} /> {coins}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pb-40 pt-3">
        {/* active conditions */}
        <div className="space-y-1.5 mb-2.5 min-h-[26px]">
          {activeConditions.map(cond => (
            <div key={cond.row} className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                 style={{ background: D.redDeep + '55', border: `1px solid ${D.red}44`, color: D.ink }}>
              <AlertTriangle size={12} color={D.red} />
              <span style={{ color: D.red }}>{cond.label}</span>
              <span style={{ color: D.muted }}>· row {cond.row + 1} needs</span>
              <span className="px-1.5 py-0.5 rounded" style={{ background: D.teal + '22', color: D.teal }}>{cond.short}</span>
            </div>
          ))}
        </div>

        {/* move timer */}
        <div className="mb-2">
          <TimerBar runKey={moveKey} seconds={MOVE_SECONDS} paused={!!math} color={D.red} />
        </div>

        {/* grid */}
        <div className="mx-auto" style={{ maxWidth: 360 }}>
          <div ref={boardRef} className="grid gap-1 p-1.5 rounded-2xl" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, background: D.panel, animation: 'survPulse 2.4s ease-in-out infinite' }}>
            {grid.map((cell, i) => {
              const r = Math.floor(i / SIZE), c = i % SIZE;
              const isCondRow = conditionByRow[r] != null;
              const Icon = cell ? (ICON_OF[cell.icon] || Pill) : null;
              const isPrev = preview && preview.cells.some(p => p.r === r && p.c === c);
              const ghost = isPrev ? (preview.valid ? D.teal : D.red) : null;
              const justPlaced = placed && placed.idx.includes(i);
              let style;
              if (cell) {
                style = { background: cell.color, boxShadow: ghost ? `inset 0 0 0 2px ${ghost}` : (cell.antidote ? `0 0 6px ${D.teal}` : 'inset 0 -2px 0 rgba(0,0,0,0.25)') };
              } else if (ghost) {
                style = { background: ghost + '33', border: `1px solid ${ghost}` };
              } else {
                style = { background: isCondRow ? D.redDeep + '33' : D.slot, border: `1px solid ${isCondRow ? D.red + '44' : D.slotBorder}` };
              }
              return (
                <div key={i} data-r={r} data-c={c} data-i={i}
                     className={`aspect-square rounded-[6px] flex items-center justify-center${justPlaced ? ' cell-place' : ''}`}
                     style={style}>
                  {Icon && <Icon size={14} color="#FFFFFFE0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* tray */}
        <div className="text-[10px] uppercase tracking-widest font-semibold mt-5 mb-2 text-center" style={{ color: D.muted }}>Supplies · drag to place</div>
        <div className="flex items-start justify-center gap-3">
          {tray.map((piece, i) => {
            const dragging = drag && drag.index === i;
            const cond = piece && piece.antidote ? conditionById(piece.antidote) : null;
            return (
              <div key={piece ? piece.key : `e${i}`} className="flex flex-col items-center gap-1">
                <button disabled={!piece} onPointerDown={(e) => startDrag(e, i, piece)}
                        className="no-tap-highlight flex items-center justify-center rounded-2xl transition active:scale-95"
                        style={{ width: 90, height: 78, touchAction: 'none', background: D.panel, border: `1.5px solid ${D.slotBorder}`, opacity: piece ? (dragging ? 0.35 : 1) : 0.4 }}>
                  {piece ? <PieceMini piece={piece} /> : <AlertTriangle size={15} color={D.muted} />}
                </button>
                {cond && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: D.teal + '22', color: D.teal }}>{cond.short}</span>}
              </div>
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
               filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))',
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
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: D.bg + 'F2', borderTop: `1px solid ${D.slotBorder}` }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="text-[11px] leading-tight flex-1" style={{ color: D.muted }}>
            Drag a supply onto the board. Don’t stall — clots spawn. Drop antidotes on their condition row.
          </div>
          <Button variant="ghost" onClick={die} className="flex-shrink-0">End shift</Button>
        </div>
      </div>

      {/* combo crisis — hard math, 10s */}
      {math && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <Card className="w-full max-w-md anim-scalein p-4" style={{ background: D.panel, border: `1px solid ${D.red}55` }}>
            <div className="flex items-center gap-2 mb-2">
              <Brain size={17} color={D.red} />
              <div className="font-display text-base font-semibold" style={{ color: D.ink }}>Crisis — solve it fast</div>
            </div>
            <div className="mb-3"><TimerBar runKey={mathKey} seconds={MATH_SECONDS} paused={false} color={D.amber} /></div>
            <div className="font-display text-[15px] leading-snug mb-3" style={{ color: D.ink }}>{math.q}</div>
            <div className="grid grid-cols-2 gap-2">
              {math.options.map((opt, i) => (
                <button key={i} onClick={() => resolveMath(i, false)}
                        className="no-tap-highlight text-left px-3 py-2.5 rounded-xl active:scale-95 transition text-[13.5px]"
                        style={{ background: D.slot, border: `1px solid ${D.slotBorder}`, color: D.ink }}>
                  {opt}
                </button>
              ))}
            </div>
            <div className="text-[11px] mt-2.5 text-center" style={{ color: D.muted }}>Wrong or too slow → a complication spawns.</div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default ShiftSurvival;
