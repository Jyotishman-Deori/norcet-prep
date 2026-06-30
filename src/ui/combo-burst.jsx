// =====================================================================
// src/ui/combo-burst.jsx  (Level Up P3 — in-game combo juice)
// A reusable "streak of correct answers" combo: call hit() on a correct answer,
// miss() on a wrong one, reset() at the start of a round. When the streak hits a
// milestone (3/5/8/12) a transient banner bursts in ("Steady hands! ×5"). Pure
// presentation + a tiny haptic; no scoring side-effects. Zero-asset, reduced-
// motion safe. Drop <ComboBurst flash={flash} /> anywhere in the drill view.
// =====================================================================
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getConfig } from '../lib/game-config.js';
import { haptic, HAPTIC } from '../lib/juice.js';

// Combo milestones (consecutive correct answers) are LIVE-TUNABLE via the
// game_config row (lib/game-config.js).

const COMBO_CSS = `
@keyframes comboBurst {
  0%   { transform: translateX(-50%) translateY(10px) scale(.7); opacity: 0 }
  18%  { transform: translateX(-50%) translateY(0) scale(1.08); opacity: 1 }
  32%  { transform: translateX(-50%) translateY(0) scale(1) }
  78%  { opacity: 1 }
  100% { transform: translateX(-50%) translateY(-16px) scale(1); opacity: 0 }
}
.combo-burst { animation: comboBurst 1.3s ease-out forwards; }
@media (prefers-reduced-motion: reduce) { .combo-burst { animation: none; } }
`;

// Streak combo state. hit() advances; landing exactly on a milestone fires a
// flash. miss()/reset() clear the streak.
export function useCombo() {
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState(null);   // { label, tone, combo, key } | null
  const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const hit = useCallback(() => {
    setCombo(c => {
      const n = c + 1;
      const tier = (getConfig().comboTiers || []).find(t => t.at === n);
      if (tier) {
        setFlash({ label: tier.label, tone: tier.tone, combo: n, key: Date.now() });
        haptic(HAPTIC.COMBO); // reduced-motion-gated + feature-detected

        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setFlash(null), 1300);
      }
      return n;
    });
  }, []);

  const miss = useCallback(() => setCombo(0), []);
  const reset = useCallback(() => { setCombo(0); setFlash(null); if (timer.current) clearTimeout(timer.current); }, []);

  return { combo, flash, hit, miss, reset };
}

export default function ComboBurst({ flash }) {
  if (!flash) return null;
  const node = (
    <div key={flash.key} className="combo-burst fixed left-1/2 z-[60] pointer-events-none"
         style={{ top: 'calc(78px + env(safe-area-inset-top, 0px))' }} aria-hidden="true">
      <style>{COMBO_CSS}</style>
      <div className="px-5 py-2.5 rounded-2xl flex items-center gap-2.5"
           style={{ background: `linear-gradient(135deg, ${flash.tone}, ${flash.tone}CC)`, boxShadow: `0 10px 30px ${flash.tone}66` }}>
        <span className="font-display text-lg font-bold whitespace-nowrap" style={{ color: '#FFF' }}>{flash.label}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums" style={{ background: 'rgba(255,255,255,0.26)', color: '#FFF' }}>×{flash.combo}</span>
      </div>
    </div>
  );
  return (typeof document !== 'undefined') ? createPortal(node, document.body) : node;
}
