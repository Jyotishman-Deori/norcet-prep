// =====================================================================
// src/screens/shift-survival.jsx — Strategy Task 3.3 "Shift Survival".
// The high-stress twin of The 3 AM Chart: same block-placement engine, dark
// cinematic skin, a 5-second move timer that drops a COMPLICATION clot if you
// stall, antidote-gated CONDITION rows, a combo "crisis" clinical-math question
// (10s), and a "Patient Expired" malpractice review on death. Harder → pays
// double (1 line = 10 coins). Hooks the existing economy via onComplete(coins).
// =====================================================================
import React, { useState, useRef, useEffect } from 'react';
import { Pill, Syringe, Bone, AlertTriangle, ArrowLeft, Coins, Skull, HeartPulse, Brain, Activity } from 'lucide-react';
import { Card, Button } from '../ui/primitives.jsx';
import { MATH_QUESTIONS } from '../data/shift-survival.js';
import {
  SIZE, at, canPlace, placeCells, anyMove,
  newSurvivalTray, clearLinesSurvival, spawnComplication, pickCondition, pickConditionRow, conditionById,
} from '../lib/survival-engine.js';

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
const vibrate = (n) => { try { if (navigator.vibrate) navigator.vibrate(n); } catch (e) {} };
const activeIdsOf = (cbr) => Object.values(cbr);

// Shuffle a math question's options so the answer isn't always in the same slot
// (the static bank stores correct at index 0). Returns a fresh presentable q.
function shuffledMath(base) {
  const arr = base.options.map((text, i) => ({ text, correct: i === base.correct }));
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return { q: base.q, options: arr.map(x => x.text), correct: arr.findIndex(x => x.correct) };
}

function PieceMini({ piece }) {
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
        <div key={c} className="rounded-[4px] flex items-center justify-center" style={{ width: 16, height: 16, background: on ? piece.color : 'transparent' }}>
          {on && <Icon size={9} color="#FFFFFFDD" />}
        </div>
      );
    }
    rows.push(<div key={r} className="flex gap-[3px]">{cells}</div>);
  }
  return <div className="flex flex-col gap-[3px]">{rows}</div>;
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
  const [sel, setSel] = useState(null);
  const [coins, setCoins] = useState(0);
  const [moveKey, setMoveKey] = useState(0);
  const [math, setMath] = useState(null);            // { q, options, correct }
  const [mathKey, setMathKey] = useState(0);
  const [failed, setFailed] = useState([]);          // malpractice review
  const [phase, setPhase] = useState('play');        // play | dead

  const gridRef = useRef(grid); gridRef.current = grid;
  const trayRef = useRef(tray); trayRef.current = tray;
  const condRef = useRef(conditionByRow); condRef.current = conditionByRow;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const mathRef = useRef(math); mathRef.current = math;

  const die = () => { vibrate(60); setPhase('dead'); };

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
      vibrate(22);
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

  const placePiece = (r, c) => {
    if (phase !== 'play' || math || sel == null) return;
    const piece = tray[sel];
    if (!piece) return;
    if (!canPlace(grid, piece.cells, r, c)) { vibrate(16); return; }
    const fill = { icon: piece.icon, color: piece.color, ...(piece.antidote ? { antidote: piece.antidote } : {}) };
    const placed = placeCells(grid, piece.cells, r, c, fill);
    const { grid: afterClear, cleared, resolved } = clearLinesSurvival(placed, conditionByRow);
    let nextTray = tray.slice(); nextTray[sel] = null;
    if (nextTray.every(p => !p)) nextTray = newSurvivalTray(activeIdsOf(conditionByRow));
    const nextCond = reconcileConditions(afterClear, resolved);
    setGrid(afterClear); setTray(nextTray); setSel(null);
    if (cleared > 0) { setCoins(x => x + cleared * COINS_PER_LINE); vibrate(14); } else vibrate(6);
    setMoveKey(k => k + 1);
    if (cleared >= COMBO_TRIGGER) {
      setMath(shuffledMath(MATH_QUESTIONS[rnd(MATH_QUESTIONS.length)])); setMathKey(k => k + 1);
    } else {
      afterBoardChange(afterClear, nextTray);
    }
  };

  function resolveMath(optIndex, viaTimeout) {
    const q = mathRef.current;
    if (!q) return;
    const correct = !viaTimeout && optIndex === q.correct;
    setMath(null);
    if (correct) { setCoins(x => x + MATH_BONUS); vibrate(12); }
    else {
      setFailed(f => [...f, { q: q.q, answer: q.options[q.correct], timeout: !!viaTimeout }]);
      vibrate(30);
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

  const styleTag = <style>{`@keyframes survShrink{from{width:100%}to{width:0%}}@keyframes survPulse{0%,100%{box-shadow:0 0 0 1px ${D.redDeep},0 0 0 0 ${D.red}00}50%{box-shadow:0 0 0 1px ${D.red},0 0 22px 2px ${D.red}55}}`}</style>;

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
          <div className="grid gap-1 p-1.5 rounded-2xl" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, background: D.panel, animation: 'survPulse 2.4s ease-in-out infinite' }}>
            {grid.map((cell, i) => {
              const r = Math.floor(i / SIZE), c = i % SIZE;
              const isCondRow = conditionByRow[r] != null;
              const Icon = cell ? (ICON_OF[cell.icon] || Pill) : null;
              return (
                <button key={i} onClick={() => placePiece(r, c)}
                        className="no-tap-highlight aspect-square rounded-[6px] flex items-center justify-center active:scale-95 transition-transform"
                        style={cell
                          ? { background: cell.color, boxShadow: cell.antidote ? `0 0 6px ${D.teal}` : 'inset 0 -2px 0 rgba(0,0,0,0.25)' }
                          : { background: isCondRow ? D.redDeep + '33' : D.slot, border: `1px solid ${isCondRow ? D.red + '44' : D.slotBorder}` }}>
                  {Icon && <Icon size={14} color="#FFFFFFE0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* tray */}
        <div className="text-[10px] uppercase tracking-widest font-semibold mt-5 mb-2 text-center" style={{ color: D.muted }}>Supplies</div>
        <div className="flex items-start justify-center gap-3">
          {tray.map((piece, i) => {
            const active = sel === i;
            const cond = piece && piece.antidote ? conditionById(piece.antidote) : null;
            return (
              <div key={piece ? piece.key : `e${i}`} className="flex flex-col items-center gap-1">
                <button disabled={!piece} onClick={() => setSel(active ? null : i)}
                        className="no-tap-highlight flex items-center justify-center rounded-2xl transition active:scale-95"
                        style={{ width: 90, height: 78, background: active ? D.teal + '14' : D.panel, border: `1.5px solid ${active ? D.teal : D.slotBorder}`, opacity: piece ? 1 : 0.4 }}>
                  {piece ? <PieceMini piece={piece} /> : <AlertTriangle size={15} color={D.muted} />}
                </button>
                {cond && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: D.teal + '22', color: D.teal }}>{cond.short}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: D.bg + 'F2', borderTop: `1px solid ${D.slotBorder}` }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="text-[11px] leading-tight flex-1" style={{ color: D.muted }}>
            {sel == null ? 'Pick a supply, then place it. Don’t stall — clots spawn.' : 'Tap a square. Drop antidotes on their condition row.'}
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
