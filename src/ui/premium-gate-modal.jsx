// =====================================================================
// src/ui/premium-gate-modal.jsx — PremiumCribSheetModal: the conversion
// dialog shown when a FREE user (with the cribVault gate up) taps a
// locked history surface — saved crib sheets or the Mistake Vault.
// Psychology per the blueprint: lead with the user's OWN number (their
// unresolved-mistake count) as the reason to upgrade, then a short value
// list, then an animated CTA into the Premium page. Dismissible always
// ("Maybe later") — it's a pitch, not a trap.
//
// Placeholder-era honesty: the Premium page it routes to still says
// payments open soon; this modal ships dark behind premium.gates.cribVault
// (default OFF) and is enforced only when the owner flips the gate live.
// =====================================================================
import React, { useEffect } from 'react';
import { Crown, Lock, X, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { haptic } from '../lib/juice.js';

const PERKS = [
  'Every mistake saved forever — nothing slips away after a session',
  'A smart review queue that resurfaces mistakes until you fix them',
  'A coach note on every mistake: why your pick was wrong, why the answer is right',
];

export default function PremiumCribSheetModal({ open, count = 0, onClose, onUpgrade }) {
  const { theme: T } = useTheme();

  // ESC closes (desktop nicety); body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-5"
         role="dialog" aria-modal="true" aria-label="Premium mistake vault"
         style={{ background: 'rgba(15,20,17,0.55)', backdropFilter: 'blur(4px)' }}
         onClick={onClose}>
      <div className="pgate-in w-full max-w-sm rounded-3xl overflow-hidden"
           style={{ background: T.bg, border: `1px solid ${T.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
           onClick={e => e.stopPropagation()}>

        {/* Header band */}
        <div className="relative px-6 pt-7 pb-5 text-center"
             style={{ background: `linear-gradient(160deg, ${T.primary}18, ${T.accent}10)` }}>
          <button onClick={onClose} aria-label="Close"
                  className="no-tap-highlight absolute right-3 top-3 p-2 rounded-full active:scale-90 transition-transform"
                  style={{ color: T.muted }}>
            <X size={16} />
          </button>
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
               style={{ background: T.primary, boxShadow: `0 8px 24px ${T.primary}55` }}>
            <Lock size={24} color="#FFF" />
          </div>
          <div className="font-display text-lg font-bold" style={{ color: T.ink }}>
            Your mistakes are worth keeping
          </div>
          {count > 0 ? (
            <div className="text-sm mt-2 leading-relaxed" style={{ color: T.inkSoft }}>
              You have{' '}
              <span className="font-display font-bold text-base tabular-nums" style={{ color: T.primary }}>
                {count} unresolved mistake{count === 1 ? '' : 's'}
              </span>{' '}
              waiting to be turned into marks. Premium keeps them until you fix every one.
            </div>
          ) : (
            <div className="text-sm mt-2 leading-relaxed" style={{ color: T.inkSoft }}>
              Premium keeps your full mistake history and crib sheets — permanently.
            </div>
          )}
        </div>

        {/* Value list */}
        <div className="px-6 py-4 space-y-2.5">
          {PERKS.map((p, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[13px] leading-snug" style={{ color: T.inkSoft }}>
              <CheckCircle2 size={15} className="flex-shrink-0 mt-[1px]" style={{ color: T.success }} />
              {p}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 pt-1">
          <button onClick={() => { haptic(12); onUpgrade(); }}
                  className="pgate-cta no-tap-highlight w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold active:scale-[0.98] transition-transform"
                  style={{ background: T.primary, color: '#FFF', boxShadow: `0 8px 24px ${T.primary}55` }}>
            <Crown size={16} />
            See Premium plans
          </button>
          <button onClick={onClose}
                  className="no-tap-highlight w-full mt-2 py-2.5 text-xs font-medium"
                  style={{ color: T.muted }}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
