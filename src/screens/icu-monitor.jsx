// =====================================================================
// src/screens/icu-monitor.jsx — NEW-10 (Module D) "Read the Monitor".
// A premium ICU rhythm-recognition drill: a live, animated bedside monitor
// (scrolling SVG ECG + synthesized beep whose pitch tracks SpO₂) shows a
// rhythm; the user reads the strip + vitals and names it. Honours the global
// Pace (The Pulse / Flashpoint) with a per-strip countdown that LOCKS on
// timeout. Correct reads earn Accuracy Coins. Self-contained, zero-asset.
//
//   intro  → power-on gate (how many strips + Pace + sound)
//   drill  → monitor + vitals + 4 options → feedback (rationale + first action)
//   done   → shift summary + coins
// =====================================================================
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Activity, HeartPulse, Volume2, VolumeX, Check, X, Play, Stethoscope, ChevronRight, Coins, Trophy, TimerOff, Droplet, Gauge } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import EcgMonitor from '../ui/ecg-monitor.jsx';
import PulseTimer from '../ui/pulse-timer.jsx';
import { ECG_RHYTHMS } from '../data/ecg-rhythms.js';
import { createMonitorAudio } from '../lib/ecg-audio.js';
import { paceFlags, normalizePace } from '../lib/pace.js';
import { shuffle } from '../lib/utils.js';

const TEAL = '#0E7490';
const COIN_BASE = 15;
const SEC_BUDGET = 15;       // The Pulse — seconds to read a strip
const SEC_BUDGET_FLASH = 8;  // Flashpoint — half the clock, double the coins
const POOL = ECG_RHYTHMS.length;
const COUNT_OPTIONS = [3, 5, POOL].filter((c, i, a) => c <= POOL && a.indexOf(c) === i);

const SEV = {
  stable:   { label: 'STABLE',   color: '#22C55E' },
  warning:  { label: 'WATCH',    color: '#F59E0B' },
  critical: { label: 'CRITICAL', color: '#EF4444' },
};

// A single monitor vital (HR / SpO₂ / BP) in the readout rail.
function Vital({ icon: Icon, label, value, unit, color }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#7C8B88' }}>
        <Icon size={10} /> {label}
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="font-display text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
        {unit && <span className="text-[9px] font-semibold" style={{ color: '#7C8B88' }}>{unit}</span>}
      </div>
    </div>
  );
}

function IcuMonitor({ onBack, onComplete, onSetPace }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { pulse: paceOn, flashpoint } = paceFlags(normalizePace(data && data.preferences));
  const pace = normalizePace(data && data.preferences);
  const coinPer = flashpoint ? COIN_BASE * 2 : COIN_BASE;

  const [phase, setPhase] = useState('intro');   // intro | drill | done
  const [count, setCount] = useState(Math.min(5, POOL));
  const [soundOn, setSoundOn] = useState(true);

  const [scenarios, setScenarios] = useState([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const scenario = scenarios[idx];
  const budgetSec = flashpoint ? SEC_BUDGET_FLASH : SEC_BUDGET;

  // Audio engine — created once, scheduled per live strip, closed on unmount.
  const audioRef = useRef(null);
  useEffect(() => {
    audioRef.current = createMonitorAudio();
    return () => { try { audioRef.current && audioRef.current.close(); } catch (e) {} };
  }, []);
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    if (phase === 'drill' && scenario && soundOn && !checked) a.start(scenario);
    else a.stop();
  }, [phase, idx, soundOn, checked, scenario && scenario.id]);

  const begin = () => {
    setScenarios(shuffle(ECG_RHYTHMS).slice(0, Math.max(1, count)));
    setIdx(0); setSelected(null); setChecked(false); setTimedOut(false); setCorrectCount(0);
    setPhase('drill');
  };

  const finalize = (sel, viaTimeout) => {
    if (checked) return;
    setChecked(true); setSelected(sel);
    const correct = sel != null && sel === scenario.answer;
    if (correct) setCorrectCount((c) => c + 1);
    if (viaTimeout) setTimedOut(true);
    try { audioRef.current && audioRef.current.stop(); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(correct ? 12 : 22); } catch (e) {}
  };
  const pick = (i) => { if (!checked) finalize(i, false); };
  const onTimeout = () => finalize(null, true);

  const next = () => {
    if (idx + 1 < scenarios.length) { setIdx((i) => i + 1); setSelected(null); setChecked(false); setTimedOut(false); }
    else { setPhase('done'); }
  };

  // ── INTRO — power on the monitor ──
  if (phase === 'intro') {
    return (
      <div className="anim-fadeup">
        <TopBar title="ICU Monitor" onBack={onBack} feedback={{ screen: 'ICU Monitor setup' }} solid />
        <div className="max-w-md mx-auto px-4 pt-2 pb-32">
          {/* hero — live mini-monitor preview */}
          <Card className="p-0 mb-5 overflow-hidden relative" style={{ background: '#06100E', border: '1px solid #0F2A24' }}>
            <div className="px-4 pt-4 pb-2 relative" style={{ color: '#E6FFF6' }}>
              <div className="flex items-center gap-2">
                <span className="inline-flex w-9 h-9 rounded-xl items-center justify-center" style={{ background: 'rgba(70,240,138,0.14)' }}>
                  <Activity size={18} color="#46F08A" className="timer-beat" />
                </span>
                <div>
                  <div className="font-display text-lg font-bold leading-tight">Read the Monitor</div>
                  <div className="text-[12px]" style={{ color: '#7FA89C' }}>Name the rhythm before the clock runs out.</div>
                </div>
              </div>
            </div>
            <EcgMonitor rhythm={ECG_RHYTHMS[0]} running height={92} speedSec={5} />
          </Card>

          {/* how many strips */}
          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many strips?</div>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {COUNT_OPTIONS.map((c, i) => {
              const on = count === c;
              return (
                <button key={c} onClick={() => setCount(c)}
                        className="no-tap-highlight py-3 rounded-xl font-semibold transition-all active:scale-95 anim-fadeup"
                        style={{ background: on ? TEAL : T.surface, color: on ? '#FFF' : T.ink,
                                 border: `1.5px solid ${on ? TEAL : T.border}`, boxShadow: on ? `0 8px 20px ${TEAL}44` : 'none',
                                 animationDelay: `${i * 60}ms` }}>
                  <div className="text-base leading-none">{c === POOL ? 'All' : c}</div>
                  <div className="text-[10px] mt-1 font-medium" style={{ color: on ? 'rgba(255,255,255,0.8)' : T.muted }}>
                    {c === 1 ? 'rhythm' : 'rhythms'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* sound toggle */}
          <button onClick={() => setSoundOn((s) => !s)}
                  className="no-tap-highlight w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-5 active:scale-[0.99] transition"
                  style={{ background: T.surface, border: `1.5px solid ${soundOn ? TEAL : T.border}` }}>
            <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center flex-shrink-0"
                  style={{ background: soundOn ? TEAL + '18' : T.surfaceWarm, color: soundOn ? TEAL : T.muted }}>
              {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </span>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold" style={{ color: T.ink }}>Monitor sound</div>
              <div className="text-[11px]" style={{ color: T.muted }}>{soundOn ? 'Beep tracks the heart rate & oxygen' : 'Silent — visual only'}</div>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: soundOn ? TEAL : T.muted }}>{soundOn ? 'On' : 'Off'}</span>
          </button>

          {/* Pace */}
          <PaceSelector value={pace} onChange={onSetPace} T={T} />
          <div className="text-[11px] leading-relaxed px-1" style={{ color: T.muted }}>
            With <b style={{ color: '#16A34A' }}>The Pulse</b> on, each strip gets a countdown — run out and it locks.
            <b style={{ color: '#B45309' }}> Flashpoint</b> halves the clock and <b>doubles</b> the coins.
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
             style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="max-w-md mx-auto">
            <Button onClick={begin} size="lg" className="w-full" icon={<Play size={16} fill="#FFF" strokeWidth={0} />}>
              Power on · {count === POOL ? 'All' : count} {count === 1 ? 'rhythm' : 'rhythms'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE — shift summary ──
  if (phase === 'done') {
    const coins = correctCount * coinPer;
    return (
      <div className="anim-fadeup">
        <TopBar title="ICU Monitor" onBack={onBack} />
        <div className="max-w-md mx-auto px-4 pt-10 pb-24 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 q-pulse"
               style={{ background: T.success + '18', border: `1px solid ${T.success}44` }}>
            <Trophy size={28} style={{ color: T.success }} />
          </div>
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Strips cleared</div>
          <div className="text-[14px] mb-5" style={{ color: T.inkSoft }}>
            You read <b style={{ color: T.ink }}>{correctCount} of {scenarios.length}</b> rhythms correctly.
          </div>
          {coins > 0 && (
            <div className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full mb-7 q-pulse"
                 style={{ background: '#F59E0B22', color: '#B45309' }}>
              <Coins size={15} /> +{coins} Coins{flashpoint ? ' · 2×' : ''}
            </div>
          )}
          <Button onClick={() => { try { if (onComplete) onComplete(coins); } catch (e) {} }} size="lg" className="w-full">
            Finish
          </Button>
        </div>
      </div>
    );
  }

  // ── DRILL ──
  if (!scenario) return null;
  const sev = SEV[scenario.severity] || SEV.stable;
  const correctIdx = scenario.answer;
  const isCorrect = checked && selected === correctIdx;

  return (
    <div className="test-enter">
      <TopBar title="ICU Monitor" onBack={onBack}
              right={
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setSoundOn((s) => !s)} aria-label="Toggle sound"
                          className="no-tap-highlight p-1.5 rounded-full active:bg-black/5" style={{ color: soundOn ? TEAL : T.muted }}>
                    {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
                  </button>
                  <div className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full"
                       style={{ color: T.inkSoft, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                    {idx + 1} / {scenarios.length}
                  </div>
                </div>
              } />
      <div className="max-w-md mx-auto px-4 pb-40 pt-3">

        {paceOn && (
          <PulseTimer budgetSec={budgetSec} resetKey={scenario.id} flashpoint={flashpoint}
                      onExpire={onTimeout} paused={checked} T={T} />
        )}

        {/* the monitor — trace + vitals rail */}
        <div className="rounded-2xl overflow-hidden mb-1" style={{ border: '1px solid #0F2A24' }}>
          <div className="flex items-stretch" style={{ background: '#06100E' }}>
            <div className="flex-1 min-w-0">
              <EcgMonitor rhythm={scenario} running={!checked} height={150}
                          speedSec={scenario.hr ? Math.max(2.4, 360 / scenario.hr) : 3.4} />
            </div>
            <div className="flex flex-col justify-between py-3 px-3.5 gap-3 flex-shrink-0" style={{ width: 92, borderLeft: '1px solid #0F2A24' }}>
              <Vital icon={HeartPulse} label="HR" value={scenario.hr == null ? '--' : scenario.hr} unit="bpm" color="#46F08A" />
              <Vital icon={Droplet} label="SpO₂" value={scenario.spo2 == null ? '--' : scenario.spo2} unit="%" color="#67E8F9" />
              <Vital icon={Gauge} label="BP" value={scenario.bp} unit="" color="#E6FFF6" />
            </div>
          </div>
          {/* alarm strip when critical & live */}
          {!checked && scenario.severity === 'critical' && (
            <div className="flex items-center justify-center gap-1.5 py-1 timer-beat-fast"
                 style={{ background: '#EF444422', color: '#FCA5A5' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444' }} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Alarm</span>
            </div>
          )}
        </div>

        <div className="text-[11px] mb-4 px-1" style={{ color: T.muted }}>
          {checked ? 'See the read-out below.' : 'What rhythm is on the monitor?'}
        </div>

        {/* options */}
        <div className="space-y-2.5">
          {scenario.options.map((opt, i) => {
            const isAns = i === correctIdx;
            const isSel = i === selected;
            let bg = T.surface, border = T.border, color = T.ink, badge = null;
            if (checked) {
              if (isAns) { bg = T.successSoft; border = T.success; color = T.ink; badge = <Check size={16} style={{ color: T.success }} />; }
              else if (isSel) { bg = T.errorSoft; border = T.error; color = T.ink; badge = <X size={16} style={{ color: T.error }} />; }
              else { color = T.muted; }
            }
            return (
              <button key={i} onClick={() => pick(i)} disabled={checked}
                      className="no-tap-highlight w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left active:scale-[0.99] transition anim-fadeup"
                      style={{ background: bg, border: `1.5px solid ${border}`, animationDelay: `${i * 45}ms` }}>
                <span className="font-display text-sm font-semibold flex-1" style={{ color }}>{opt}</span>
                {badge}
              </button>
            );
          })}
        </div>

        {/* feedback */}
        {checked && (
          <Card className="p-4 mt-4 anim-fadeup"
                style={{ background: isCorrect ? T.successSoft : T.surfaceWarm,
                         border: `1px solid ${(isCorrect ? T.success : timedOut ? T.error : T.accent)}44` }}>
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? <Check size={16} style={{ color: T.success }} />
                : timedOut ? <TimerOff size={16} style={{ color: T.error }} />
                : <Activity size={16} style={{ color: T.accent }} />}
              <div className="font-display text-sm font-semibold" style={{ color: isCorrect ? T.success : timedOut ? T.error : T.accent }}>
                {isCorrect ? 'Correct read!' : timedOut ? 'Time’s up' : 'Not quite'}
              </div>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: sev.color + '22', color: sev.color }}>{sev.label}</span>
            </div>
            <div className="font-display text-[15px] font-semibold mb-1.5" style={{ color: T.ink }}>{scenario.name}</div>
            <div className="text-[12.5px] leading-relaxed mb-3" style={{ color: T.inkSoft }}>{scenario.rationale}</div>
            <div className="flex items-start gap-1.5 pt-2.5" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
              <Stethoscope size={13} className="flex-shrink-0 mt-0.5" style={{ color: TEAL }} />
              <div className="text-[12.5px] leading-relaxed" style={{ color: T.ink }}>
                <b style={{ color: TEAL }}>First action: </b>{scenario.action}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          {checked ? (
            <Button onClick={next} size="lg" className="w-full" icon={<ChevronRight size={16} />}>
              {idx + 1 < scenarios.length ? 'Next strip' : 'Finish'}
            </Button>
          ) : (
            <div className="text-center text-[12px] py-1.5" style={{ color: T.muted }}>Tap the rhythm you see</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IcuMonitor;
