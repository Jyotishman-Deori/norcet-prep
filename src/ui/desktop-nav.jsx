// =====================================================================
// src/ui/desktop-nav.jsx — the persistent DESKTOP top navbar (≥1024px).
//
// LinkedIn-style shell: App mounts it on EVERY desktop screen EXCEPT the
// immersive surfaces in DNAV_EXCLUDED_SCREENS below, so users can hop
// between sections from anywhere without backing out first. On the four
// tab roots the phone-era headers hide on lg (Home header `lg:hidden`;
// TopBar's `desktopHidden` prop); on other screens the screen's own
// TopBar simply sits BELOW this bar via the `--dnav-h` offset it
// publishes. Bar contents: brand → Home, section links, Search, notes,
// notifications bell, Favourites, golden Premium pill, profile chip →
// Settings, and Menu for the full drawer.
//
// Mechanics mirror bottom-nav.jsx: publishes `--dnav-h` on <html> while
// mounted (sub-view TopBars offset below it via that var) and renders an
// in-flow spacer. Micro-interactions (`dnav-*` + `brand-pop`): bar
// settle-in, hover underline slide + persistent active underline on
// links, icon press pop, bell swing on new unread, gold sheen sweep on
// Premium, brand spring pop on click — all in the reduced-motion block.
// =====================================================================
import React, { useEffect, useState } from 'react';
import {
  Search, Heart, Settings, Menu, Bell, NotebookPen, Crown,
} from 'lucide-react';
import { useTheme, useProfile, useI18n } from '../lib/app-context.jsx';
import { playTapSound } from '../lib/sound.js';
import { isPremiumEnabled, isPremiumUser, getPremiumState } from '../lib/premium.js';

const BAR_H = 64;

// Screens that stay chrome-free on desktop: exam players, clinical games
// and full-canvas surfaces where a persistent bar would break focus (or
// layout), plus the auth/waitlist gates. Everything else gets the bar.
// ⚠ RULE: any NEW immersive screen (game, timed test, full-canvas view)
// must join this set — same convention as RAGE_EXCLUDED_SCREENS.
export const DNAV_EXCLUDED_SCREENS = new Set([
  'auth', 'waitlist',                                   // gates
  'quiz', 'advanced-test', 'paper-test', 'dosage-run',  // active test players
  'skill-setup', 'skill-drill', 'icu-monitor', 'crash-cart', 'sorter',
  'distractor-assassin', 'three-am-chart', 'shift-survival', 'tie-breaker',
  'ibq', 'ward-boss', 'drip-zone', 'wave-hunter',       // clinical games
  'knowledge-map',                                      // full-canvas map
]);

// Section links (center cluster). Routes are nav objects via onNavigate
// (the drawer's dispatcher), so quiz-spec style entries would work too.
// Labels are i18n keys resolved at render (module scope must stay key-only).
// Learn, Level Up and Nursing Calc were REMOVED from this bar by owner request
// (it was crowded). They are all still one tap away in the slide-in Menu, the
// desktop footer, and their Home cards, so nothing became unreachable.
// Support reuses the existing 'settings.sections.support' string ("Support"),
// which already ships in every locale pack, so the bar gains a section without
// forcing a new key into all 15 packs.
const LINKS = [
  { labelKey: 'nav.links.revision', screen: 'revision-sheet' },
  { labelKey: 'nav.links.library',  screen: 'library' },
  { labelKey: 'nav.links.stats',    screen: 'stats' },
  { labelKey: 'settings.sections.support', screen: 'support' },
];

// Child screens that light up a section link while open, so the bar shows
// where you are even deep in a flow. Exact-match wins; unmapped screens
// simply highlight nothing.
const SECTION_OF = {
  'learn-cards': 'learn-topics',
  'crib-sheet': 'revision-sheet',
  'bank-detail': 'library',
  'bank-editor': 'library',
  'add-question': 'library',
};

// Premium gold (matches premium.jsx GOLD + the cosmetics gold ring).
const GOLD = '#D97706';
const GOLD_BRIGHT = '#FCD34D';
const GOLD_DEEP = '#B45309';

export default function DesktopNav({ screen, onTab, onNavigate, onOpenMenu, onOpenNote, unreadNotifCount = 0, onOpenNotifications }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { profile } = useProfile();
  const { t } = useI18n();

  // Publish the bar height so portaled TopBars (Settings sub-views etc.)
  // can sit BELOW the bar instead of colliding with it at top:0.
  useEffect(() => {
    try { document.documentElement.style.setProperty('--dnav-h', `${BAR_H}px`); } catch (e) {}
    return () => { try { document.documentElement.style.removeProperty('--dnav-h'); } catch (e) {} };
  }, []);

  const name = (profile && (profile.displayName || profile.id)) || t('common.guest');
  const initial = String(name).trim().charAt(0).toUpperCase() || 'N';

  // Brand spring pop: re-keying the tile restarts the animation each click.
  const [brandPop, setBrandPop] = useState(0);
  // Owner request: the logo behaves like a browser home button, i.e. it RELOADS
  // the app (even when already on Home), rather than just switching tab or
  // scrolling to top. Safe to do unconditionally: this bar is never rendered on
  // the test/game players (DNAV_EXCLUDED_SCREENS), so a reload can't interrupt a
  // run, and any run that was in progress is resumable or retired anyway.
  // Falls back to the old in-app behaviour if reload is unavailable.
  const onBrand = () => {
    playTapSound();
    setBrandPop((c) => c + 1);
    try {
      window.location.reload();
      return;
    } catch (e) { /* fall through */ }
    if (screen === 'home') {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e2) {}
    } else {
      onTab('home');
    }
  };

  const activeSection = SECTION_OF[screen] || screen;

  // Re-clicking the section you are already on scrolls to top (mirrors the
  // bottom bar's re-tap); otherwise a normal stack push so back always works.
  const onLink = (l) => {
    playTapSound();
    if (screen === l.screen) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
    } else {
      onNavigate({ screen: l.screen });
    }
  };

  const premiumOn = isPremiumEnabled();
  const isMember = isPremiumUser(profile);
  const tier = isMember ? (getPremiumState(profile).tier || 'SUPER') : null;

  const iconBtn = (active) => ({
    background: active ? T.primary + '1A' : 'transparent',
    color: active ? T.primary : T.inkSoft,
  });

  return (
    <>
      <header className="dnav-in fixed top-0 left-0 right-0 z-40"
              style={{
                height: BAR_H,
                background: IS_DARK ? 'rgba(21,19,15,0.92)' : T.bg + 'F2',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                borderBottom: `1px solid ${T.borderSoft}`,
              }}>
        <div className="max-w-6xl mx-auto h-full px-8 flex items-center gap-4">

          {/* Brand → RELOADS the app (owner request: it should behave like a
              browser home button, refreshing even when already on Home). */}
          <button onClick={onBrand}
                  className="no-tap-highlight flex items-center gap-2.5 flex-shrink-0 dnav-brand"
                  aria-label={t('nav.tabs.home')} aria-current={screen === 'home' ? 'page' : undefined}>
            <div key={brandPop} className={'w-9 h-9 rounded-xl flex items-center justify-center font-display text-base font-bold' + (brandPop ? ' brand-pop' : '')}
                 style={{ background: T.primary, color: '#FFF' }}>
              N
            </div>
            <span className="font-display text-lg font-semibold tracking-tight" style={{ color: T.ink }}>
              Nurse<span style={{ color: T.primary }}>Holic</span>
            </span>
          </button>

          {/* Golden Premium pill — the FIRST app section after the brand (owner
              request). For members it turns into a solid gold tier badge
              (SUPER/MAX) that opens the same manage screen. */}
          {premiumOn && (
            <button onClick={() => { playTapSound(); onNavigate({ screen: 'premium' }); }}
                    aria-label={t('nav.drawer.premium.label')}
                    aria-current={screen === 'premium' ? 'page' : undefined}
                    className="dnav-gold no-tap-highlight flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-bold transition-all"
                    style={isMember
                      ? { background: `linear-gradient(135deg, ${GOLD_BRIGHT}, ${GOLD})`,
                          border: `1px solid ${GOLD}`, color: '#FFFFFF',
                          textShadow: '0 1px 2px rgba(0,0,0,0.18)' }
                      : { background: `linear-gradient(135deg, ${GOLD_BRIGHT}${IS_DARK ? '1F' : '26'}, ${GOLD}14)`,
                          border: `1px solid ${GOLD}${IS_DARK ? '66' : '55'}`,
                          color: IS_DARK ? GOLD_BRIGHT : GOLD_DEEP }}>
              <Crown size={14} strokeWidth={2.4} fill={isMember ? 'currentColor' : 'none'} />
              {isMember ? tier : t('nav.drawer.premium.label')}
            </button>
          )}

          {/* Section links — hover underline slides in; the CURRENT section
              keeps its underline lit even on child screens (SECTION_OF).
              Home is via the brand. */}
          <nav className="flex items-center gap-1 flex-1" aria-label={t('nav.mainNavigation')}>
            {LINKS.map((l) => {
              const active = activeSection === l.screen;
              return (
                <button key={l.screen}
                        onClick={() => onLink(l)}
                        aria-current={active ? 'page' : undefined}
                        className={'dnav-link no-tap-highlight relative px-3.5 py-2 rounded-lg text-[13.5px] font-semibold transition-colors' + (active ? ' dnav-link-active' : '')}
                        style={{ color: active ? T.primary : T.inkSoft, '--dnav-underline': T.primary }}>
                  {t(l.labelKey)}
                </button>
              );
            })}
          </nav>

          {/* Right cluster — mirrors the hidden Home header + bottom bar. */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => { playTapSound(); onTab('search'); }} aria-label={t('nav.tabs.search')}
                    aria-current={screen === 'search' ? 'page' : undefined}
                    title={t('nav.tabs.search') + ' (Ctrl K)'}
                    className="dnav-icon no-tap-highlight p-2.5 rounded-xl transition-colors"
                    style={iconBtn(screen === 'search')}>
              <Search size={19} strokeWidth={2.2} />
            </button>
            {/* Note taking — was a "+", which read as "add something". It is the
                note button, so it now looks like one. This is also the ONLY note
                entry on desktop: the in-screen TopBar hides its copy at lg+. */}
            <button onClick={() => { playTapSound(); onOpenNote(); }} aria-label={t('nav.quickNote')}
                    title={t('nav.quickNote')}
                    className="dnav-icon no-tap-highlight p-2.5 rounded-xl transition-colors"
                    style={iconBtn(false)}>
              <NotebookPen size={19} strokeWidth={2.2} />
            </button>
            <button onClick={() => { playTapSound(); onOpenNotifications(); }} aria-label={t('nav.notifications')}
                    className="dnav-icon no-tap-highlight relative p-2.5 rounded-xl transition-colors"
                    style={iconBtn(false)}>
              {/* keyed on the count: the bell swings once whenever unread changes */}
              <span key={unreadNotifCount} className={'inline-block' + (unreadNotifCount > 0 ? ' dnav-bell-ring' : '')} style={{ lineHeight: 0 }}>
                <Bell size={19} strokeWidth={2.2} />
              </span>
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ background: T.error, color: '#FFF' }}>
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
            <button onClick={() => { playTapSound(); onTab('favorites'); }} aria-label={t('nav.tabs.favourites')}
                    aria-current={screen === 'favorites' ? 'page' : undefined}
                    className="dnav-icon no-tap-highlight p-2.5 rounded-xl transition-colors"
                    style={iconBtn(screen === 'favorites')}>
              <Heart size={19} strokeWidth={2.2} />
            </button>

            {/* IDENTITY + SETTINGS — ONE control (owner request). These used to
                be two adjacent buttons, a bordered gear and a quiet profile
                chip, that both did exactly the same thing (onTab('settings')),
                which read as a duplicate and made the pair compete. Merged into
                a single bordered pill so NEITHER is downgraded: the avatar keeps
                its full-size primary circle, the name is now full-strength ink
                (it was muted), and the gear keeps a bordered, hoverable button
                around it. Reuses .dnav-chip (hover lift + shadow, already in the
                reduced-motion catch-all), so no new CSS class is needed. */}
            <button onClick={() => { playTapSound(); onTab('settings'); }}
                    aria-label={`${String(name)}, ${t('nav.tabs.settings')}`}
                    title={t('nav.tabs.settings')}
                    aria-current={screen === 'settings' ? 'page' : undefined}
                    className="dnav-chip no-tap-highlight ml-1 flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition-all"
                    style={screen === 'settings'
                      ? { background: T.primary + '1A', border: `1px solid ${T.primary}55` }
                      : { background: T.surface, border: `1px solid ${T.border}` }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                    style={{ background: T.primary, color: '#FFF' }}>
                {initial}
              </span>
              <span className="text-[12.5px] font-semibold max-w-[96px] truncate"
                    style={{ color: screen === 'settings' ? T.primary : T.ink }}>
                {String(name).split(' ')[0]}
              </span>
              <Settings size={17} strokeWidth={2.2} className="flex-shrink-0"
                        style={{ color: screen === 'settings' ? T.primary : T.muted }} />
            </button>

            <button onClick={() => { playTapSound(); onOpenMenu(); }} aria-label={t('nav.openMenu')}
                    className="dnav-icon no-tap-highlight p-2.5 rounded-xl transition-colors"
                    style={iconBtn(false)}>
              <Menu size={19} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </header>
      {/* In-flow spacer so page content starts below the fixed bar. */}
      <div aria-hidden="true" style={{ height: BAR_H }} />
    </>
  );
}
