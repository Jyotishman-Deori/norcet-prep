// =====================================================================
// src/ui/back-to-top.jsx — premium floating "back to top" FAB.
// Appears as soon as the user is a short way down (not only near the
// page bottom), floats above the content while they keep scrolling, and
// animates in/out with a springy pop instead of mount/unmount. A thin
// progress ring around the arrow fills with reading progress — updated
// via rAF directly on the SVG node so scrolling never re-renders React.
// Window-level scroll (the app scrolls the window, not an inner
// container). Hidden in print. Respects prefers-reduced-motion (no
// pop/spring, instant jump instead of smooth scroll; the ring still
// reflects position since it is scroll-linked state, not decoration).
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { prefersReducedMotion, haptic, HAPTIC } from '../lib/juice.js';
import { playTapSound } from '../lib/sound.js';

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

// Screens where the global FAB (App root) must NOT float: active test
// players and clinical games own their bottom edge (fixed action bars,
// gameplay), and the Knowledge Map is a full canvas. Gates (auth/waitlist)
// are short pages where the 240px threshold simply never trips, so they
// need no entry. ⚠ RULE: new immersive screens must join this set (same
// convention as DNAV_EXCLUDED_SCREENS / RAGE_EXCLUDED_SCREENS).
export const BTT_EXCLUDED_SCREENS = new Set([
  'quiz', 'advanced-test', 'paper-test', 'dosage-run',
  'skill-setup', 'skill-drill', 'icu-monitor', 'crash-cart', 'sorter',
  'distractor-assassin', 'three-am-chart', 'shift-survival', 'tie-breaker',
  'ibq', 'ward-boss', 'drip-zone', 'wave-hunter',
  'knowledge-map',
]);

// Per-screen tweaks for the global mount (screens with extra fixed chrome
// at the bottom edge that the FAB should clear).
export const BTT_SCREEN_PROPS = {
  'crib-sheet': { bottomOffset: 60, className: 'crib-no-print' },
};

export default function BackToTop({ threshold = 240, label = 'Top', bottomOffset = 0, className = '' }) {
  const { theme: T } = useTheme();
  const [show, setShow] = useState(false);
  const [hover, setHover] = useState(false);
  const [launch, setLaunch] = useState(0); // re-keys the arrow to replay the launch animation
  const ringRef = useRef(null);
  const raf = useRef(0);

  useEffect(() => {
    const update = () => {
      raf.current = 0;
      const y = window.scrollY || 0;
      setShow(y > threshold);
      const el = ringRef.current;
      if (el) {
        const doc = document.documentElement;
        const max = Math.max(1, (doc.scrollHeight || 0) - window.innerHeight);
        const p = Math.min(1, y / max);
        el.style.strokeDashoffset = String(RING_C * (1 - p));
      }
    };
    const onScroll = () => { if (!raf.current) raf.current = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [threshold]);

  const toTop = () => {
    playTapSound();
    haptic(HAPTIC.PLACE);
    setLaunch((c) => c + 1); // the arrow "launches" as the page starts moving
    try { window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); }
    catch (e) { window.scrollTo(0, 0); }
  };

  const reduced = prefersReducedMotion();
  return (
    <button onClick={toTop} aria-label="Back to top" tabIndex={show ? 0 : -1} aria-hidden={!show}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            className={`no-print fixed z-40 inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3.5 py-2 ${className}`}
            style={{
              right: 'calc(16px + env(safe-area-inset-right, 0px))',
              /* --bnav-h is published by the bottom nav bar while it's mounted,
                 so the FAB rides above it instead of colliding (0 elsewhere). */
              bottom: `calc(${20 + bottomOffset}px + env(safe-area-inset-bottom, 0px) + var(--bnav-h, 0px))`,
              background: T.primary, color: '#FFF',
              boxShadow: hover && show ? `0 12px 32px ${T.primary}88` : `0 8px 24px ${T.primary}66`,
              opacity: show ? 1 : 0,
              transform: show ? (hover ? 'translateY(-2px) scale(1.03)' : 'none') : 'translateY(14px) scale(0.85)',
              pointerEvents: show ? 'auto' : 'none',
              transition: reduced ? 'none'
                : 'opacity 0.22s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease',
            }}>
      {/* Arrow inside a scroll-progress ring */}
      <span className="relative inline-flex items-center justify-center" style={{ width: 24, height: 24 }}>
        <svg width="24" height="24" viewBox="0 0 36 36" className="absolute inset-0" aria-hidden="true">
          <circle cx="18" cy="18" r={RING_R} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="3" />
          <circle ref={ringRef} cx="18" cy="18" r={RING_R} fill="none" stroke="#FFF" strokeWidth="3"
                  strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C}
                  transform="rotate(-90 18 18)" />
        </svg>
        <span key={launch} className={'inline-flex' + (launch ? ' btt-launch' : '')} style={{ lineHeight: 0 }}>
          <ArrowUp size={13} style={{ transform: hover && !reduced ? 'translateY(-1px)' : 'none', transition: reduced ? 'none' : 'transform 0.2s' }} />
        </span>
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
