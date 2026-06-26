// =====================================================================
// src/lib/responsive.js — the device/breakpoint layer (multi-device Phase 0).
// ONE source of truth for the app's device model, so every adaptive decision
// (CSS via Tailwind breakpoints, or JS via these hooks) agrees.
//
// Device model (matches Tailwind's default md/lg, and the Home dashboard):
//   📱 mobile   < 768px   — base styles (NO breakpoint prefix). Never altered.
//   📲 tablet   768–1023  — Tailwind `md:`  (roomier single/2-col, touch-first)
//   💻 desktop  ≥ 1024     — Tailwind `lg:`  (sidebar, multi-column, hover/keys)
//   🖥 wide     ≥ 1440     — Tailwind `xl:`  (cap max-width so it never sprawls)
//
// RULE OF THE SYSTEM: mobile-first. Write the phone layout with no prefix, then
// LAYER desktop/tablet enhancements with md:/lg:. That way a desktop change can
// never reach the phone — the foundation of "premium on every device without
// breaking the app".
//
// Use the CSS breakpoints (md:/lg:) for layout. Use these JS hooks only when a
// decision can't be expressed in CSS — e.g. rendering a DOCKED side panel vs a
// full-screen modal (different component trees), not just different styles.
// =====================================================================
import { useState, useEffect } from 'react';

export const BREAKPOINTS = { tablet: 768, desktop: 1024, wide: 1440 };

// Reactive matchMedia. SSR/JSDOM-safe; falls back to the legacy add/removeListener
// for older Safari. Returns false where matchMedia is unavailable.
export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);
  return matches;
}

// Reactive device class. { isMobile, isTablet, isDesktop, isWide, device }.
// Prefer Tailwind md:/lg: for styling; reach for this only for structural
// (component-tree) adaptation.
export function useBreakpoint() {
  const isDesktop = useMediaQuery(`(min-width: ${BREAKPOINTS.desktop}px)`);
  const isWide = useMediaQuery(`(min-width: ${BREAKPOINTS.wide}px)`);
  const isTabletOrUp = useMediaQuery(`(min-width: ${BREAKPOINTS.tablet}px)`);
  const isTablet = isTabletOrUp && !isDesktop;
  const isMobile = !isTabletOrUp;
  const device = isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile';
  return { isMobile, isTablet, isDesktop, isWide, device };
}
