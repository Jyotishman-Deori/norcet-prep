// =====================================================================
// src/screens/sorter.jsx — NEW-10 (Module A) "The Sorter".
// Tap-to-sort drill (touch-robust, no fragile drag): tap an item to pick it
// up, tap a bin to drop it in. Sort all items, then Check to see per-item
// feedback + rationale. Launch content: Bio-Medical Waste segregation and
// Isolation Precautions. Honours the global Pace (per-case countdown that
// auto-checks on timeout) and pays Accuracy Coins per correctly-sorted item.
//   intro → drill (bins + tray → review) → done (coins)
// =====================================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Recycle, Check, X, Play, ChevronRight, Coins, Trophy, TimerOff, RotateCcw, Lightbulb } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { useExitGuard } from '../ui/use-exit-guard.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import PulseTimer from '../ui/pulse-timer.jsx';
import { SORTER_CASES } from '../data/sorter-cases.js';
import { paceFlags, normalizePace } from '../lib/pace.js';
import { mergePackItems } from '../lib/drill-packs.js';
import { shuffle } from '../lib/utils.js';
import ComboBurst, { useCombo } from '../ui/combo-burst.jsx';

const GREEN = '#15803D';
const COIN_PER_ITEM = 3;
const SEC_PER_ITEM = 7;
const SEC_PER_ITEM_FLASH = 4;

function SorterDrill({ onBack, onComplete, onSetPace }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { pulse: paceOn, flashpoint } = paceFlags(normalizePace(data && data.preferences));
  const pace = normalizePace(data && data.preferences);
  const coinPerItem = flashpoint ? COIN_PER_ITEM * 2 : COIN_PER_ITEM;

  // seed sets + any installed Sorter packs
  const pool = useMemo(() => mergePackItems('sorter', SORTER_CASES, data), [data]);
  const POOL = pool.length;
  const COUNT_OPTIONS = useMemo(() => Array.from(new Set([1, POOL])).filter((c) => c >= 1 && c <= POOL), [POOL]);

  const [phase, setPhase] = useState('intro');
  const [count, setCount] = useState(POOL);
  const [cases, setCases] = useState([]);
  const [idx, setIdx] = useState(0);
  const [assign, setAssign] = useState({});      // itemId -> binId
  const [picked, setPicked] = useState(null);    // itemId currently picked up
  const [checked, setChecked] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [correctTotal, setCorrectTotal] = useState(0);
  const [itemTotal, setItemTotal] = useState(0);
  const [finished, setFinished] = useState(false);

  const kase = cases[idx];
  const items = kase ? kase.items : [];
  const tray = items.filter((it) => !assign[it.id]);
  const allAssigned = items.length > 0 && items.every((it) => assign[it.id]);
  const caseCorrect = items.filter((it) => assign[it.id] === it.bin).length;
  const budgetSec = items.length * (flashpoint ? SEC_PER_ITEM_FLASH : SEC_PER_ITEM);
  const coins = correctTotal * coinPerItem;

  useEffect(() => { setAssign({}); setPicked(null); }, [kase && kase.id]);

  const { flash: comboFlash, hit: comboHit, miss: comboMiss, reset: comboReset } = useCombo();

  // Pay out exactly once. onComplete is the ONLY thing that banks the coins, so
  // the results back arrow routes here too: it used to go straight home and
  // silently bin the whole run's earnings.
  const finish = useCallback(() => {
    if (finished) { if (onBack) onBack(); return; }
    setFinished(true);
    try { if (onComplete) onComplete(coins); else if (onBack) onBack(); } catch (e) { if (onBack) onBack(); }
  }, [finished, onComplete, onBack, coins]);

  // Leaving mid-run discards it. Ask first, but only once there is something to lose.
  const { requestExit, dialog: exitDialog } = useExitGuard({
    started: phase === 'drill', finished, earned: coins, progress: idx, onLeave: phase === 'done' ? finish : onBack,
  });

  const begin = () => {
    setCases(shuffle(pool).slice(0, Math.max(1, count)));
    setIdx(0); setAssign({}); setPicked(null); setChecked(false); setTimedOut(false);
    setCorrectTotal(0); setItemTotal(0); comboReset(); setPhase('drill');
  };

  const tapItem = (id) => {
    if (checked) return;
    if (assign[id]) { setAssign((a) => { const n = { ...a }; delete n[id]; return n; }); setPicked(id); }
    else setPicked((p) => (p === id ? null : id));
  };
  const tapBin = (binId) => {
    if (checked || !picked) return;
    setAssign((a) => ({ ...a, [picked]: binId }));
    setPicked(null);
  };
  const resetCase = () => { if (!checked) { setAssign({}); setPicked(null); } };

  const finalize = (viaTimeout) => {
    if (checked) return;
    setChecked(true);
    if (viaTimeout) setTimedOut(true);
    const ok = items.filter((it) => assign[it.id] === it.bin).length;
    if (ok === items.length) comboHit(); else comboMiss();
    try { if (navigator.vibrate) navigator.vibrate(ok === items.length ? 12 : 20); } catch (e) {}
  };
  const check = () => { if (allAssigned && !checked) finalize(false); };
  const onTimeout = () => finalize(true);

  const next = () => {
    const newCorrect = correctTotal + caseCorrect;
    const newItems = itemTotal + items.length;
    setCorrectTotal(newCorrect); setItemTotal(newItems);
    if (idx + 1 < cases.length) { setIdx((i) => i + 1); setChecked(false); setTimedOut(false); }
    else setPhase('done');
  };

  // ── INTRO ──
  if (phase === 'intro') {
    return (
      <div className="anim-fadeup">
        <TopBar title="The Sorter" onBack={onBack} feedback={{ screen: 'Sorter setup' }} solid />
        <div className="max-w-md mx-auto px-4 pt-2 pb-32">
          <Card className="p-5 mb-5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${GREEN}, #0B5132)`, border: 'none' }}>
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="relative flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <Recycle size={26} color="#FFF" />
              </div>
              <div style={{ color: '#FFF' }}>
                <div className="font-display text-xl font-bold leading-tight">Sort it right</div>
                <div className="text-[12.5px] mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>Tap an item, tap its bin. Waste segregation, isolation precautions & more.</div>
              </div>
            </div>
          </Card>

          {COUNT_OPTIONS.length > 1 && (
            <>
              <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many sets?</div>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {COUNT_OPTIONS.map((c, i) => {
                  const on = count === c;
                  return (
                    <button key={c} onClick={() => setCount(c)}
                            className="no-tap-highlight py-3 rounded-xl font-semibold transition-all active:scale-95 anim-fadeup"
                            style={{ background: on ? GREEN : T.surface, color: on ? '#FFF' : T.ink,
                                     border: `1.5px solid ${on ? GREEN : T.border}`, boxShadow: on ? `0 8px 20px ${GREEN}44` : 'none',
                                     animationDelay: `${i * 60}ms` }}>
                      <div className="text-base leading-none">{c === POOL ? 'All' : c}</div>
                      <div className="text-[10px] mt-1 font-medium" style={{ color: on ? 'rgba(255,255,255,0.8)' : T.muted }}>
                        {c === 1 ? 'set' : 'sets'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How it works</div>
          <div className="rounded-2xl p-3.5 mb-5 space-y-2" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
            {['Tap an item to pick it up', 'Tap the bin it belongs in', 'Check once every item is placed'].map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5" style={{ background: GREEN + '18', color: GREEN }}>{i + 1}</span>
                <span className="text-[12.5px] leading-snug" style={{ color: T.inkSoft }}>{s}</span>
              </div>
            ))}
          </div>

          <PaceSelector value={pace} onChange={onSetPace} T={T} />
          <div className="text-[11px] leading-relaxed px-1" style={{ color: T.muted }}>
            With <b style={{ color: '#16A34A' }}>The Pulse</b> on, each set gets a countdown. Run out and it auto-checks.
            <b style={{ color: '#B45309' }}> Flashpoint</b> halves the clock and <b>doubles</b> the coins.
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
             style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="max-w-md mx-auto">
            <Button onClick={begin} size="lg" className="w-full" icon={<Play size={16} fill="#FFF" strokeWidth={0} />}>
              Start sorting
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE ──
  if (phase === 'done') {
    return (
      <div className="anim-fadeup">
        <TopBar title="The Sorter" onBack={finish} />
        <div className="max-w-md mx-auto px-4 pt-10 pb-24 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 q-pulse"
               style={{ background: T.success + '18', border: `1px solid ${T.success}44` }}>
            <Trophy size={28} style={{ color: T.success }} />
          </div>
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Sorted</div>
          <div className="text-[14px] mb-5" style={{ color: T.inkSoft }}>
            You placed <b style={{ color: T.ink }}>{correctTotal} of {itemTotal}</b> items correctly.
          </div>
          {coins > 0 && (
            <div className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full mb-7 q-pulse"
                 style={{ background: '#F59E0B22', color: '#B45309' }}>
              <Coins size={15} /> +{coins} Coins{flashpoint ? ' · 2×' : ''}
            </div>
          )}
          <Button onClick={finish} size="lg" className="w-full" disabled={finished}>
            Finish
          </Button>
        </div>
      </div>
    );
  }

  // ── DRILL ──
  // No case to show (an empty pool). This used to `return null`: a blank white
  // screen with no TopBar and no way back except reloading the app.
  if (!kase) {
    return (
      <div className="anim-fadeup">
        <TopBar title="The Sorter" onBack={onBack} />
        <div className="max-w-md mx-auto px-4 pt-16 text-center">
          <div className="font-display text-lg font-semibold mb-1.5" style={{ color: T.ink }}>Nothing to sort</div>
          <div className="text-[13px] mb-6" style={{ color: T.muted }}>
            There are no Sorter cases available right now. Try again later.
          </div>
          <Button onClick={onBack} size="lg" className="w-full">Back</Button>
        </div>
      </div>
    );
  }
  const binById = {}; kase.bins.forEach((b) => { binById[b.id] = b; });

  return (
    <div className="test-enter">
      {exitDialog}
      <ComboBurst flash={comboFlash} />
      <TopBar title={kase.title} onBack={requestExit}
              right={<div className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full"
                          style={{ color: T.inkSoft, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                       {idx + 1} / {cases.length}
                     </div>} />
      <div className="max-w-md mx-auto px-4 pb-40 pt-3">

        {paceOn && (
          <PulseTimer budgetSec={budgetSec} resetKey={kase.id} flashpoint={flashpoint}
                      onExpire={onTimeout} paused={checked} T={T} />
        )}

        <div className="font-display text-[15px] leading-snug mb-3" style={{ color: T.ink }}>{kase.instruction}</div>

        {/* bins */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {kase.bins.map((b) => {
            const inBin = items.filter((it) => assign[it.id] === b.id);
            return (
              <button key={b.id} onClick={() => tapBin(b.id)} disabled={checked || !picked}
                      className="no-tap-highlight text-left rounded-2xl p-3 transition active:scale-[0.99]"
                      style={{ background: b.color + '0E', border: `1.5px solid ${picked ? b.color : b.color + '44'}`,
                               minHeight: 96, boxShadow: picked ? `0 0 0 3px ${b.color}22` : 'none' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: b.color }} />
                  <span className="font-display text-sm font-bold" style={{ color: b.color }}>{b.label}</span>
                </div>
                <div className="text-[10px] leading-tight mb-2" style={{ color: T.muted }}>{b.hint}</div>
                <div className="flex flex-wrap gap-1">
                  {inBin.map((it) => {
                    const right = checked && assign[it.id] === it.bin;
                    const wrong = checked && assign[it.id] !== it.bin;
                    return (
                      <span key={it.id} onClick={(e) => { e.stopPropagation(); tapItem(it.id); }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-1 rounded-lg"
                            style={{ background: T.surface, color: T.ink,
                                     border: `1.5px solid ${right ? T.success : wrong ? T.error : T.borderSoft}` }}>
                        <span>{it.emoji}</span>{it.text}
                        {checked && (right ? <Check size={11} style={{ color: T.success }} /> : <X size={11} style={{ color: T.error }} />)}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>

        {/* tray of unsorted items */}
        {!checked && (
          <>
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: T.muted }}>
              {picked ? 'Now tap a bin above ↑' : 'Tap an item to pick it up'}
            </div>
            <div className="flex flex-wrap gap-2 min-h-[40px]">
              {tray.length === 0 && <div className="text-[13px] italic" style={{ color: T.muted }}>All items placed, tap Check.</div>}
              {tray.map((it) => {
                const on = picked === it.id;
                return (
                  <button key={it.id} onClick={() => tapItem(it.id)}
                          className="no-tap-highlight inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-2 rounded-xl active:scale-95 transition anim-fadeup"
                          style={{ background: on ? T.primary : T.surface, color: on ? '#FFF' : T.ink,
                                   border: `1.5px solid ${on ? T.primary : T.border}`, boxShadow: on ? `0 6px 16px ${T.primary}33` : 'none' }}>
                    <span>{it.emoji}</span>{it.text}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* review */}
        {checked && (
          <Card className="p-4 anim-fadeup" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
            <div className="flex items-center gap-2 mb-2.5">
              {timedOut ? <TimerOff size={16} style={{ color: T.error }} /> : <Lightbulb size={16} style={{ color: T.accent }} />}
              <div className="font-display text-sm font-semibold" style={{ color: timedOut ? T.error : T.ink }}>
                {timedOut ? 'Time’s up: review' : `${caseCorrect} / ${items.length} correct`}
              </div>
            </div>
            <div className="space-y-2">
              {items.filter((it) => assign[it.id] !== it.bin).length === 0 && (
                <div className="text-[13px]" style={{ color: T.success }}>Flawless segregation. 🎯</div>
              )}
              {items.filter((it) => assign[it.id] !== it.bin).map((it) => (
                <div key={it.id} className="text-[12.5px] leading-relaxed flex items-start gap-1.5" style={{ color: T.inkSoft }}>
                  <X size={13} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
                  <span><b style={{ color: T.ink }}>{it.emoji} {it.text}</b> → <b style={{ color: binById[it.bin] && binById[it.bin].color }}>{binById[it.bin] && binById[it.bin].label}</b>. {it.why}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex gap-2">
          {!checked ? (
            <>
              {Object.keys(assign).length > 0 && (
                <Button variant="ghost" onClick={resetCase} className="flex-shrink-0" icon={<RotateCcw size={15} />}>Reset</Button>
              )}
              <Button onClick={check} disabled={!allAssigned} size="lg" className="flex-1" icon={<Check size={16} />}>Check</Button>
            </>
          ) : (
            <Button onClick={next} size="lg" className="flex-1" icon={<ChevronRight size={16} />}>
              {idx + 1 < cases.length ? 'Next set' : 'Finish'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SorterDrill;
