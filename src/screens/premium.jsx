// =====================================================================
// src/screens/premium.jsx — Premium / pricing PREVIEW screen
//
// A polished, honest preview of the freemium plan. NOTHING is gated anywhere
// in the app: during the test phase every feature is already free, and the
// purchase CTA opens an in-file "coming soon" placeholder sheet — there is no
// payment SDK, no Razorpay, no gating logic here. All display data (plans,
// features, prices, phase flags) comes from the pure lib contract in
// ../lib/premium.js — this file computes NOTHING about pricing itself.
//
// Structure (all read via useTheme(), shared TopBar/Card/Button primitives):
//   Hero (Crown + pitch) → test-phase banner → plan cards (selectable) →
//   Free-vs-Premium comparison → "Get Premium" CTA → coming-soon sheet →
//   optional ad-slot placeholder (flag-gated, off today) → footer microcopy.
//
// Accessibility: colour is never the only selected signal (a filled fill +
// white text + a check + aria-pressed all agree); the sheet is a labelled
// role="dialog"; JS-driven motion is gated by prefersReducedMotion() and every
// animation class opts out in the reduced-motion block in font-styles.js.
// =====================================================================
import React, { useState } from 'react';
import { Crown, Sparkles, Check, X, PlayCircle } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import { prefersReducedMotion } from '../lib/juice.js';
import {
  getPremiumPlans, getPremiumFeatures, isPremiumEnabled, isTestPhase,
  isAdSlotEnabled, formatInr,
} from '../lib/premium.js';

// Gold accent for the Premium surface — matches the drawer row's '#D97706'.
// A deliberate, distinct "premium" tone, warmer than T.primary.
const GOLD = '#D97706';

function PremiumScreen({ onBack }) {
  const { theme: T } = useTheme();
  const reduced = prefersReducedMotion();

  // Server/contract is authority for the plan list; the UI only picks a
  // highlight. Default the selection to the yearly plan when present (its
  // `save` chip marks it best value), else the first plan.
  const plans = getPremiumPlans() || [];
  const features = getPremiumFeatures() || [];
  const defaultId = (plans.find(p => p.save) || plans[0] || {}).id || null;
  const [selectedId, setSelectedId] = useState(defaultId);
  const [showSheet, setShowSheet] = useState(false);

  // Safety net: if Premium is switched off in the contract, the drawer row is
  // already hidden — but a deep-link could still land here, so show a minimal,
  // honest empty state instead of an unusable pricing page.
  if (!isPremiumEnabled()) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Premium" onBack={onBack} feedback={{ screen: 'Premium' }} />
        <div className="max-w-md mx-auto px-4 pt-16 pb-24 text-center">
          <div className="mx-auto mb-4 w-20 h-20 rounded-3xl flex items-center justify-center"
               style={{ background: T.surfaceWarm, border: `1.5px solid ${T.border}` }}>
            <Crown size={34} strokeWidth={1.6} style={{ color: T.muted }} />
          </div>
          <div className="font-display text-lg font-semibold mb-1.5" style={{ color: T.ink }}>
            Premium is not available right now
          </div>
          <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
            Everything in the app is free to use. Check back later — we'll share plans here when there's something to show.
          </div>
        </div>
      </div>
    );
  }

  const testPhase = isTestPhase();
  const openSheet = () => {
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    setShowSheet(true);
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Premium" onBack={onBack} feedback={{ screen: 'Premium' }} />
      <div className="max-w-md mx-auto px-4 pb-28 pt-2"
           style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="text-center pt-3 pb-5">
          <div className="mx-auto mb-3.5 w-16 h-16 rounded-3xl flex items-center justify-center"
               style={{ background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}0C)`,
                        border: `1px solid ${GOLD}33`, boxShadow: `0 6px 20px ${GOLD}1F` }}>
            <Crown size={30} style={{ color: GOLD }} />
          </div>
          <h1 className="font-display text-2xl font-semibold leading-tight" style={{ color: T.ink }}>Premium</h1>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: T.muted }}>
            Everything you need to crack NORCET, supercharged.
          </p>
        </div>

        {/* ── Test-phase banner (honest, warm, prominent) ──────────────── */}
        {testPhase && (
          <Card className="p-4 mb-5" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}3D` }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: `${GOLD}1F` }}>
                <Sparkles size={17} style={{ color: GOLD }} />
              </div>
              <div className="min-w-0">
                <div className="font-display text-[15px] font-semibold leading-snug" style={{ color: T.ink }}>
                  You're an early tester <span aria-hidden="true">🎉</span>
                </div>
                <div className="text-[13px] mt-1 leading-relaxed" style={{ color: T.inkSoft }}>
                  Every feature is <span className="font-semibold" style={{ color: GOLD }}>FREE</span> right now.
                  The prices below are a preview of what's coming.
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── Plan cards (selectable) ──────────────────────────────────── */}
        <div className="space-y-3 mb-6">
          {plans.map((plan, i) => {
            const selected = plan.id === selectedId;
            const perLabel = plan.per ? `/${plan.per}` : '';
            const isBest = !!plan.save;
            return (
              <button
                key={plan.id}
                onClick={() => {
                  if (selected) return;
                  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(6); } catch (e) {}
                  setSelectedId(plan.id);
                }}
                aria-pressed={selected}
                aria-label={`${plan.label} plan, ${formatInr(plan.priceInr)}${perLabel}${isBest ? `, ${plan.save}, best value` : ''}${selected ? ', selected' : ''}`}
                className={
                  'no-tap-highlight w-full text-left rounded-2xl p-4 pressable relative overflow-hidden'
                  + (!reduced ? ' premium-card-in' : '')
                  + (!reduced && selected ? ' premium-select-pop' : '')
                }
                style={{
                  background: selected ? T.primary : T.surface,
                  border: `2px solid ${selected ? T.primary : (isBest ? GOLD + '55' : T.border)}`,
                  boxShadow: selected ? `0 8px 24px ${T.primary}40` : '0 1px 4px rgba(0,0,0,0.05)',
                  color: selected ? '#FFFFFF' : T.ink,
                  animationDelay: !reduced ? `${Math.min(i, 4) * 70}ms` : undefined,
                }}>

                {/* Best-value ribbon chip (kept legible on both fills). */}
                {isBest && (
                  <span className="absolute top-0 right-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-bl-xl"
                        style={{ background: selected ? '#FFFFFF' : GOLD, color: selected ? T.primary : '#FFFFFF' }}>
                    Best value
                  </span>
                )}

                <div className="flex items-center gap-3">
                  {/* Selection indicator — a filled check ring. Never colour-only:
                      the ring fills AND shows a check AND the whole card inverts. */}
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                       style={{
                         background: selected ? '#FFFFFF' : 'transparent',
                         border: `2px solid ${selected ? '#FFFFFF' : (isBest ? GOLD : T.border)}`,
                       }}>
                    {selected && <Check size={14} strokeWidth={3} style={{ color: T.primary }} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-[15px] font-semibold"
                            style={{ color: selected ? '#FFFFFF' : T.ink }}>
                        {plan.label}
                      </span>
                      {isBest && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full leading-none"
                              style={{ background: selected ? 'rgba(255,255,255,0.22)' : GOLD + '1A',
                                       color: selected ? '#FFFFFF' : GOLD }}>
                          {plan.save}
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] mt-0.5"
                         style={{ color: selected ? 'rgba(255,255,255,0.82)' : T.muted }}>
                      {isBest ? 'Billed yearly' : 'Cancel anytime'}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="font-display text-xl font-semibold leading-none"
                          style={{ color: selected ? '#FFFFFF' : T.ink }}>
                      {formatInr(plan.priceInr)}
                    </span>
                    <span className="text-[12px]" style={{ color: selected ? 'rgba(255,255,255,0.82)' : T.muted }}>
                      {perLabel}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Free vs Premium comparison ───────────────────────────────── */}
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-wider font-semibold px-1 mb-2.5" style={{ color: T.muted }}>
            What's included
          </div>
          <Card className="overflow-hidden">
            {/* Column header row */}
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 py-2.5"
                 style={{ background: T.surfaceWarm, borderBottom: `1px solid ${T.borderSoft}` }}>
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>Feature</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide w-16 text-center" style={{ color: T.muted }}>Free</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide w-16 text-center inline-flex items-center justify-center gap-1" style={{ color: GOLD }}>
                <Crown size={11} style={{ color: GOLD }} /> Pro
              </span>
            </div>
            {features.map((f, i) => (
              <div key={f.id}
                   className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 py-3"
                   style={{ borderTop: i === 0 ? 'none' : `1px solid ${T.borderSoft}` }}>
                <span className="text-[13px] leading-snug" style={{ color: T.ink }}>{f.label}</span>
                <span className="text-[12px] w-16 text-center font-medium" style={{ color: T.muted }}>{f.free}</span>
                <span className="text-[12px] w-16 text-center font-semibold" style={{ color: GOLD }}>{f.premium}</span>
              </div>
            ))}
          </Card>
        </div>

        {/* ── Ad-slot placeholder (flag-gated; off today → renders nothing).
            The code path stays in place so enabling the flag later is a
            one-line change with no UI work. Disabled + labelled honestly. */}
        {isAdSlotEnabled() && (
          <Card className="p-4 mb-6 opacity-70" aria-disabled="true"
                style={{ borderStyle: 'dashed' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: T.surfaceWarm }}>
                <PlayCircle size={18} style={{ color: T.muted }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium" style={{ color: T.ink }}>Watch an ad → earn coins</div>
                <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>Coming soon</div>
              </div>
            </div>
          </Card>
        )}

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <Button onClick={openSheet} size="lg" icon={<Crown size={17} />}
                className="w-full" >
          Get Premium
        </Button>

        {/* ── Footer microcopy ─────────────────────────────────────────── */}
        <p className="text-center text-[11px] mt-4 leading-relaxed" style={{ color: T.muted }}>
          Prices are a preview and may change before launch.
        </p>
      </div>

      {/* ── Coming-soon placeholder sheet (NO payment logic) ────────────── */}
      {showSheet && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.45)' }}
             onClick={() => setShowSheet(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="premium-soon-title"
               className={'relative w-full max-w-sm rounded-3xl p-6 text-center' + (!reduced ? ' anim-scalein' : '')}
               style={{ background: T.surface, boxShadow: '0 18px 48px rgba(0,0,0,0.32)' }}
               onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowSheet(false)} aria-label="Close"
                    className="no-tap-highlight absolute top-3 right-3 p-1.5 rounded-full active:bg-black/5">
              <X size={18} style={{ color: T.muted }} />
            </button>
            <div className="mx-auto mb-4 w-16 h-16 rounded-3xl flex items-center justify-center"
                 style={{ background: `linear-gradient(135deg, ${GOLD}26, ${GOLD}0C)`, border: `1px solid ${GOLD}33` }}>
              <Sparkles size={28} style={{ color: GOLD }} />
            </div>
            <h2 id="premium-soon-title" className="font-display text-xl font-semibold" style={{ color: T.ink }}>
              Payments open soon
            </h2>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: T.inkSoft }}>
              During the test phase everything is already unlocked — enjoy! When we launch, you'll subscribe right here.
            </p>
            <button onClick={() => setShowSheet(false)}
                    className="no-tap-highlight w-full mt-5 py-3.5 rounded-xl text-sm font-semibold active:scale-95 transition"
                    style={{ background: T.primary, color: '#FFFFFF' }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PremiumScreen;
