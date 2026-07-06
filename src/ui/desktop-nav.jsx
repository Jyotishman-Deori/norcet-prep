// =====================================================================
// src/ui/desktop-nav.jsx — the persistent DESKTOP top navbar (≥1024px).
//
// The PC counterpart of the mobile bottom tab bar (Duolingo/Playo-style):
// App mounts it only when `isDesktop && BOTTOM_NAV_SCREENS.has(nav.screen)`
// — the same four tab-root screens the bottom bar owns, so quiz/test/game
// screens stay chrome-free. On these screens the phone-era headers hide on
// lg (Home header `lg:hidden`; TopBar's `desktopHidden` prop) and this bar
// takes over their actions: brand → Home, section links, Search, notes,
// notifications bell, Favourites, profile chip → Settings, and Menu for
// the full drawer.
//
// Mechanics mirror bottom-nav.jsx: publishes `--dnav-h` on <html> while
// mounted (sub-view TopBars offset below it via that var) and renders an
// in-flow spacer. Micro-interactions (`dnav-*`): bar settle-in, hover
// underline slide on links, icon pop — all in the reduced-motion block.
// =====================================================================
import React, { useEffect } from 'react';
import {
  Search, Heart, Settings, Menu, Bell, Plus,
} from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { playTapSound } from '../lib/sound.js';

const BAR_H = 64;

// Section links (center cluster). Routes are nav objects via onNavigate
// (the drawer's dispatcher), so quiz-spec style entries would work too.
const LINKS = [
  { label: 'Learn', screen: 'learn-topics' },
  { label: 'Level Up', screen: 'level-up' },
  { label: 'Revision', screen: 'revision-sheet' },
  { label: 'Library', screen: 'library' },
  { label: 'Stats', screen: 'stats' },
];

export default function DesktopNav({ screen, onTab, onNavigate, onOpenMenu, onOpenNote, unreadNotifCount = 0, onOpenNotifications }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { profile } = useProfile();

  // Publish the bar height so portaled TopBars (Settings sub-views etc.)
  // can sit BELOW the bar instead of colliding with it at top:0.
  useEffect(() => {
    try { document.documentElement.style.setProperty('--dnav-h', `${BAR_H}px`); } catch (e) {}
    return () => { try { document.documentElement.style.removeProperty('--dnav-h'); } catch (e) {} };
  }, []);

  const name = (profile && (profile.displayName || profile.id)) || 'Guest';
  const initial = String(name).trim().charAt(0).toUpperCase() || 'N';

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
        <div className="max-w-6xl mx-auto h-full px-8 flex items-center gap-6">

          {/* Brand → Home (tab-root switch, clears the back stack) */}
          <button onClick={() => { playTapSound(); onTab('home'); }}
                  className="no-tap-highlight flex items-center gap-2.5 flex-shrink-0 dnav-brand"
                  aria-label="Home" aria-current={screen === 'home' ? 'page' : undefined}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display text-base font-bold"
                 style={{ background: T.primary, color: '#FFF' }}>
              N
            </div>
            <span className="font-display text-lg font-semibold tracking-tight" style={{ color: T.ink }}>
              Nurse<span style={{ color: T.primary }}>Holic</span>
            </span>
          </button>

          {/* Section links — hover underline slides in; Home is via the brand. */}
          <nav className="flex items-center gap-1 flex-1" aria-label="Primary">
            {LINKS.map((l) => (
              <button key={l.screen}
                      onClick={() => { playTapSound(); onNavigate({ screen: l.screen }); }}
                      className="dnav-link no-tap-highlight relative px-3.5 py-2 rounded-lg text-[13.5px] font-semibold transition-colors"
                      style={{ color: T.inkSoft, '--dnav-underline': T.primary }}>
                {l.label}
              </button>
            ))}
          </nav>

          {/* Right cluster — mirrors the hidden Home header + bottom bar. */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => { playTapSound(); onTab('search'); }} aria-label="Search"
                    aria-current={screen === 'search' ? 'page' : undefined}
                    className="dnav-icon no-tap-highlight p-2.5 rounded-xl transition-colors"
                    style={iconBtn(screen === 'search')}>
              <Search size={19} strokeWidth={2.2} />
            </button>
            <button onClick={() => { playTapSound(); onOpenNote(); }} aria-label="Quick note"
                    className="dnav-icon no-tap-highlight p-2.5 rounded-xl transition-colors"
                    style={iconBtn(false)}>
              <Plus size={19} strokeWidth={2.2} />
            </button>
            <button onClick={() => { playTapSound(); onOpenNotifications(); }} aria-label="Notifications"
                    className="dnav-icon no-tap-highlight relative p-2.5 rounded-xl transition-colors"
                    style={iconBtn(false)}>
              <Bell size={19} strokeWidth={2.2} />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ background: T.error, color: '#FFF' }}>
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
            <button onClick={() => { playTapSound(); onTab('favorites'); }} aria-label="Favourites"
                    aria-current={screen === 'favorites' ? 'page' : undefined}
                    className="dnav-icon no-tap-highlight p-2.5 rounded-xl transition-colors"
                    style={iconBtn(screen === 'favorites')}>
              <Heart size={19} strokeWidth={2.2} />
            </button>

            {/* Profile chip → Settings */}
            <button onClick={() => { playTapSound(); onTab('settings'); }}
                    aria-label="Settings" aria-current={screen === 'settings' ? 'page' : undefined}
                    className="dnav-chip no-tap-highlight flex items-center gap-2 ml-1 pl-1.5 pr-3 py-1.5 rounded-full transition-all"
                    style={{
                      background: screen === 'settings' ? T.primary + '14' : T.surface,
                      border: `1px solid ${screen === 'settings' ? T.primary + '55' : T.border}`,
                    }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold"
                    style={{ background: T.primary, color: '#FFF' }}>
                {initial}
              </span>
              <span className="text-[12.5px] font-semibold max-w-[110px] truncate" style={{ color: T.ink }}>
                {String(name).split(' ')[0]}
              </span>
              <Settings size={14} style={{ color: T.muted }} />
            </button>

            <button onClick={() => { playTapSound(); onOpenMenu(); }} aria-label="Open menu"
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
