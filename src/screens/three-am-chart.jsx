// =====================================================================
// src/screens/three-am-chart.jsx — Strategy Task 3.2 "The 3 AM Chart".
//
// A CHILL block-placement puzzle (1010!-style, not falling-Tetris — the spec's
// "no timer, no pressure, pure chill placement"): you get a tray of 3 small
// medical-icon pieces; tap a piece, tap a square to drop it. Fill any full row
// OR column and it clears with a 1-line nursing fact. When no piece fits, the
// "Brain-Rot Lifeline" offers one easy MCQ (a real bank question) — get it right
// and the bottom half of the chart clears so you can keep going.
//
// Hooks into the EXISTING Level Up economy (NOT the doc's abandoned Tickets):
// onComplete(coins) awards XP + Accuracy Coins (1 cleared line = 5), counts the
// game toward daily quests, and fires the level-up celebration — same contract
// every other game uses (handleGameComplete in App).
// =====================================================================
import React, { useState, useRef } from 'react';
import { Pill, Syringe, Bone, Moon, Coins, Trophy, Sparkles, Brain, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import { CHART_FACTS } from '../data/chart-facts.js';
import {
  SIZE, newTray, canPlace, placeCells, clearFullLines, anyMove, clearBottomHalf, pickLifelineQuestion,
} from '../lib/chart-engine.js';

const COINS_PER_LINE = 5;                         // spec: 1 row = 5
const ICON_OF = { pill: Pill, syringe: Syringe, bone: Bone };
const rnd = (n) => Math.floor(Math.random() * n);
const vibrate = (n) => { try { if (navigator.vibrate) navigator.vibrate(n); } catch (e) {} };

// Mini render of a tray piece (its bounding box).
function PieceMini({ piece, T }) {
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
             style={{ width: 17, height: 17, background: on ? piece.color : 'transparent' }}>
          {on && <Icon size={10} color="#FFFFFFDD" />}
        </div>
      );
    }
    rows.push(<div key={r} className="flex gap-[3px]">{cells}</div>);
  }
  return <div className="flex flex-col gap-[3px]">{rows}</div>;
}

function ThreeAmChart({ onBack, onComplete, allQuestions = [] }) {
  const { theme: T } = useTheme();
  const [grid, setGrid] = useState(() => Array(SIZE * SIZE).fill(null));
  const [tray, setTray] = useState(() => newTray());
  const [sel, setSel] = useState(null);
  const [cleared, setCleared] = useState(0);
  const [fact, setFact] = useState(null);
  const [lifeline, setLifeline] = useState(null);   // { q } | null
  const [lifelineUsed, setLifelineUsed] = useState(false);
  const [phase, setPhase] = useState('play');       // play | done
  const gridRef = useRef(grid); gridRef.current = grid;
  const trayRef = useRef(tray); trayRef.current = tray;
  const factTimer = useRef(null);

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

  const tapCell = (r, c) => {
    if (phase !== 'play' || lifeline || sel == null) return;
    const piece = tray[sel];
    if (!piece) return;
    if (!canPlace(grid, piece.cells, r, c)) { vibrate(16); return; }
    const filled = placeCells(grid, piece.cells, r, c, { icon: piece.icon, color: piece.color });
    const { grid: afterClear, cleared: n } = clearFullLines(filled);
    let nextTray = tray.slice();
    nextTray[sel] = null;
    if (nextTray.every(p => !p)) nextTray = newTray();
    setGrid(afterClear); setTray(nextTray); setSel(null);
    if (n > 0) { setCleared(x => x + n); flashFact(); vibrate(12); } else vibrate(5);
    if (!anyMove(afterClear, nextTray)) setTimeout(() => resolveStuck(afterClear, nextTray), 140);
  };

  const answerLifeline = (optIndex) => {
    if (!lifeline) return;
    const correct = lifeline.q.correct[0] === optIndex;
    setLifeline(null); setLifelineUsed(true);
    if (correct) {
      const g2 = clearBottomHalf(gridRef.current);
      setGrid(g2); flashFact(); vibrate(12);
      setTimeout(() => { if (!anyMove(g2, trayRef.current)) setPhase('done'); }, 160);
    } else {
      vibrate(28);
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
          Tap a piece, then a square. Fill a row or column to clear it. No timer — pure chill.
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
          <div className="grid gap-1 p-1.5 rounded-2xl"
               style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}`, boxShadow: fact ? `0 0 0 2px ${T.success}55` : 'none', transition: 'box-shadow .25s' }}>
            {grid.map((cell, i) => {
              const r = Math.floor(i / SIZE), c = i % SIZE;
              const Icon = cell ? ICON_OF[cell.icon] : null;
              return (
                <button key={i} onClick={() => tapCell(r, c)}
                        className="no-tap-highlight aspect-square rounded-[6px] flex items-center justify-center active:scale-95 transition-transform"
                        style={cell
                          ? { background: cell.color, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.12)' }
                          : { background: T.bg, border: `1px solid ${T.borderSoft}` }}>
                  {Icon && <Icon size={15} color="#FFFFFFE0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* tray */}
        <div className="text-[10px] uppercase tracking-widest font-semibold mt-5 mb-2 text-center" style={{ color: T.muted }}>Your pieces</div>
        <div className="flex items-stretch justify-center gap-3">
          {tray.map((piece, i) => {
            const active = sel === i;
            return (
              <button key={piece ? piece.key : `empty-${i}`} disabled={!piece}
                      onClick={() => setSel(active ? null : i)}
                      className="no-tap-highlight flex items-center justify-center rounded-2xl transition active:scale-95"
                      style={{
                        width: 92, height: 84,
                        background: active ? T.primary + '14' : T.surface,
                        border: `1.5px solid ${active ? T.primary : T.borderSoft}`,
                        opacity: piece ? 1 : 0.4,
                      }}>
                {piece ? <PieceMini piece={piece} T={T} /> : <X size={16} style={{ color: T.muted }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="text-[11px] leading-tight flex-1" style={{ color: T.muted }}>
            {sel == null ? 'Pick a piece above to place it.' : 'Now tap a square on the chart.'}
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
