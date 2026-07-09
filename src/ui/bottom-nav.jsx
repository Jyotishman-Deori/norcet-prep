// =====================================================================
// src/ui/bottom-nav.jsx — the mobile/tablet BOTTOM NAVIGATION BAR.
// Five slots: Home · Search · (+ notes) · Favourites · Settings, in the
// "Option B" style — a thin indicator line that glides above the active
// tab (spring easing), icon+label tabs, and a raised round center "+"
// that opens the existing study-notes popup (requestNote channel).
//
// App.jsx mounts this at the ROOT (outside every screen's `anim-fadeup`
// transform wrapper, so position:fixed stays viewport-relative — no
// portal needed) and only while `bottomNavVisible` is true: mobile or
// tablet width AND one of BOTTOM_NAV_SCREENS. Quizzes, timed tests,
// games and every sub-screen never show it (answer integrity + focus).
//
// The component renders TWO things: the fixed bar, and an in-flow spacer
// that reserves the bar's height at the end of the document so page
// content never hides underneath. While mounted it also publishes
// --bnav-h on <html> so other bottom-anchored chrome (back-to-top FAB)
// can offset itself.
// z-40: above content and ActionBar (z-30), below NavDrawer (z-70) and
// every modal — the drawer scrim and sheets cover the bar as expected.
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { House, Search, Plus, Heart, Settings } from 'lucide-react';
import { useTheme, useI18n } from '../lib/app-context.jsx';
import { haptic, prefersReducedMotion } from '../lib/juice.js';

// The tab-root screens on which App shows the bar. Exported so App.jsx is
// the single wiring point; broadening the bar later = add a key here.
export const BOTTOM_NAV_SCREENS = new Set(['home', 'search', 'favorites', 'settings']);

// Slot layout (index 2 is the raised "+", not a route). Labels are i18n
// KEYS resolved with t() at render time — never call t() at module scope
// (the active dict can change; a module-scope call would freeze English).
const TABS = [
  { screen: 'home',      labelKey: 'nav.tabs.home',       Icon: House,    slot: 0 },
  { screen: 'search',    labelKey: 'nav.tabs.search',     Icon: Search,   slot: 1 },
  { screen: 'favorites', labelKey: 'nav.tabs.favourites', Icon: Heart,    slot: 3 },
  { screen: 'settings',  labelKey: 'nav.tabs.settings',   Icon: Settings, slot: 4 },
];

const BAR_H = 64; // content height (px) — spacer + --bnav-h must agree

export default function BottomNav({ screen, onNavigate, onOpenNote }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { t } = useI18n();
  // Icon pop runs only on the tab that just BECAME active (not on mount and
  // not on the passive re-render when another tab was tapped).
  const prevScreenRef = useRef(screen);
  const [popScreen, setPopScreen] = useState(null);
  useEffect(() => {
    if (prevScreenRef.current !== screen) {
      prevScreenRef.current = screen;
      setPopScreen(screen);
      const t = setTimeout(() => setPopScreen(null), 360);
      return () => clearTimeout(t);
    }
  }, [screen]);

  // Publish the bar height for other fixed bottom chrome (back-to-top FAB).
  useEffect(() => {
    try { document.documentElement.style.setProperty('--bnav-h', BAR_H + 'px'); } catch (e) {}
    return () => {
      try { document.documentElement.style.removeProperty('--bnav-h'); } catch (e) {}
    };
  }, []);

  const activeTab = TABS.find(t => t.screen === screen) || null;

  const tapTab = (tab) => {
    haptic(5);
    if (tab.screen === screen) {
      // Re-tap of the active tab = back to top (standard tab-bar behaviour).
      try { window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); }
      catch (e) { try { window.scrollTo(0, 0); } catch (_) {} }
      return;
    }
    onNavigate(tab.screen);
  };

  const bar = (
    <nav className="bnav-in fixed bottom-0 left-0 right-0 z-40"
         aria-label={t('nav.mainNavigation')}
         style={{
           background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2',
           backdropFilter: 'blur(12px)',
           WebkitBackdropFilter: 'blur(12px)',
           borderTop: `1px solid ${T.borderSoft}`,
           paddingBottom: 'env(safe-area-inset-bottom, 0px)',
         }}>
      <div className="relative max-w-md md:max-w-3xl mx-auto flex items-stretch"
           style={{ height: BAR_H }}>
        {/* Option-B indicator — one 3px line gliding between the 5 slots. */}
        {activeTab && (
          <div aria-hidden="true" className="bnav-indicator absolute rounded-full"
               style={{
                 top: 0, height: 3, width: 40,
                 left: `calc(${activeTab.slot * 20}% + 10% - 20px)`,
                 background: T.primary,
               }} />
        )}
        {[0, 1, 2, 3, 4].map(slot => {
          if (slot === 2) {
            // Center "+" — raised circular note button (opens the existing
            // notes popup; an action, not a route, so no indicator/active state).
            return (
              <div key="plus" className="flex-1 flex justify-center">
                <button onClick={() => { haptic(5); onOpenNote(); }}
                        aria-label={t('nav.openStudyNotes')}
                        className="no-tap-highlight press-safe group self-start -translate-y-[14px] flex items-center justify-center rounded-full active:scale-90 transition-transform duration-150"
                        style={{
                          width: 54, height: 54,
                          background: T.primary, color: '#FFF',
                          border: `3px solid ${T.bg}`,
                          boxShadow: `0 8px 24px ${T.primary}66`,
                        }}>
                  <Plus size={26} strokeWidth={2.5}
                        className="transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] group-active:rotate-90" />
                </button>
              </div>
            );
          }
          const tab = TABS.find(t => t.slot === slot);
          const active = tab.screen === screen;
          const TabIcon = tab.Icon;
          return (
            <button key={tab.screen} onClick={() => tapTab(tab)}
                    aria-label={t(tab.labelKey)}
                    aria-current={active ? 'page' : undefined}
                    className="no-tap-highlight press-safe flex-1 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform duration-150"
                    style={{ color: active ? T.primary : T.muted }}>
              <TabIcon size={23} strokeWidth={active ? 2.5 : 2}
                       className={popScreen === tab.screen ? 'bnav-pop' : undefined}
                       fill={active && tab.screen === 'favorites' ? T.primary : 'none'} />
              <span className={`text-[10px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}>
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {bar}
      {/* In-flow spacer (App renders this component AFTER the active screen,
          so this sits at the end of the page flow) — content scrolls clear
          of the fixed bar on every bar screen. */}
      <div aria-hidden="true" style={{ height: `calc(${BAR_H}px + env(safe-area-inset-bottom, 0px))` }} />
    </>
  );
}
