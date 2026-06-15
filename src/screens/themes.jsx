// =====================================================================
// src/screens/themes.jsx  (issues round — Settings → Themes sub-page)
// The old inline "Appearance" block in Settings is now this dedicated
// page: a Light/Dark mode selector plus the full colour-theme picker with
// larger, well-spaced swatches and clear selected states. Settings keeps a
// single tappable "Themes" row, which makes the main Settings screen far
// less cluttered. Props are the exact pair Settings already used:
// themeMode + onSetColorTheme.
// =====================================================================
import React from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import { LIGHT_THEMES } from '../lib/light-themes.js';

function Swatch({ opt, active, onPick, ring = '28' }) {
  const { theme: T } = useTheme();
  return (
    <button onClick={() => onPick(opt.id)}
            className="flex flex-col items-center gap-2 no-tap-highlight pressable"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
      <div className="relative w-14 h-14 rounded-full flex items-center justify-center transition-shadow duration-300"
           style={{ background: opt.bg,
                    border: active ? `2.5px solid ${opt.swatch}` : `2px solid ${T.border}`,
                    boxShadow: active ? `0 0 0 4px ${opt.swatch}${ring}` : 'none' }}>
        <div className="w-7 h-7 rounded-full transition-transform duration-300"
             style={{ background: opt.swatch, opacity: 0.9, transform: active ? 'scale(1.06)' : 'scale(1)' }} />
        {active && (
          <div className="anim-scalein absolute inset-0 flex items-center justify-center rounded-full"
               style={{ background: opt.swatch + '1C' }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3.5 8.5l3 3 6-6" stroke={opt.swatch} strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>
      <span className="text-[11px] font-medium leading-tight"
            style={{ color: active ? opt.swatch : T.muted }}>{opt.label}</span>
    </button>
  );
}

function ThemesScreen({ themeMode, onSetColorTheme, onBack }) {
  const { theme: T } = useTheme();
  return (
    <div className="anim-fadeup">
      <TopBar title="Themes" onBack={onBack} feedback={{ screen: 'Settings' }} />
      <div className="max-w-md mx-auto px-4 pt-3 pb-24">

        <div className="text-xs leading-relaxed mb-4 px-1" style={{ color: T.muted }}>
          Pick a mode and a colour. Changes apply instantly across the whole app.
        </div>

        {/* Mode selector — Light / Dark */}
        <div className="mb-2 text-[11px] uppercase tracking-wider font-semibold px-1" style={{ color: T.muted }}>Mode</div>
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { id: 'light', label: 'Light', icon: '\u2600\uFE0F', desc: 'Default' },
              { id: 'dark',  label: 'Dark',  icon: '\uD83C\uDF19', desc: 'Easy on eyes' },
            ].map(opt => {
              const active = opt.id === 'dark' ? themeMode === 'dark' : themeMode !== 'dark';
              const isDarkOpt = opt.id === 'dark';
              return (
                <button key={opt.id}
                        onClick={() => onSetColorTheme && onSetColorTheme(opt.id)}
                        className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl no-tap-highlight pressable transition-colors duration-300"
                        style={{
                          background: active ? (isDarkOpt ? '#1A1A1A' : T.primary + '12') : T.surfaceWarm,
                          border: `1.5px solid ${active ? (isDarkOpt ? '#444' : T.primary) : T.border}`,
                        }}>
                  <span className="text-2xl leading-none">{opt.icon}</span>
                  <span className="text-sm font-semibold"
                        style={{ color: active ? (isDarkOpt ? '#FFF' : T.primary) : T.ink }}>
                    {opt.label}
                  </span>
                  <span className="text-[10px] flex items-center gap-1"
                        style={{ color: active ? (isDarkOpt ? '#999' : T.primarySoft) : T.muted }}>
                    {active && <Check size={10} />}{opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Colour picker — hidden in dark mode (dark has one canonical palette) */}
        {themeMode !== 'dark' ? (
          <>
            <div className="mb-2 text-[11px] uppercase tracking-wider font-semibold px-1" style={{ color: T.muted }}>Colour</div>
            <Card className="p-5">
              <div className="text-xs font-medium mb-3" style={{ color: T.muted }}>Soft</div>
              <div className="grid grid-cols-4 gap-3 mb-6">
                {LIGHT_THEMES.slice(0, 4).map(opt => (
                  <Swatch key={opt.id} opt={opt} active={themeMode === opt.id}
                          onPick={(id) => onSetColorTheme && onSetColorTheme(id)} ring="28" />
                ))}
              </div>

              <div className="text-xs font-medium mb-3" style={{ color: T.muted }}>Vivid</div>
              <div className="grid grid-cols-4 gap-3 mb-6">
                {LIGHT_THEMES.slice(4).map(opt => (
                  <Swatch key={opt.id} opt={opt} active={themeMode === opt.id}
                          onPick={(id) => onSetColorTheme && onSetColorTheme(id)} ring="38" />
                ))}
              </div>

              <div className="text-xs font-medium mb-3" style={{ color: T.muted }}>Minimal</div>
              <div className="grid grid-cols-4 gap-3">
                {[{ id: 'midnight', label: 'Midnight', swatch: '#000000', bg: '#FFFFFF' }].map(opt => (
                  <Swatch key={opt.id} opt={opt} active={themeMode === opt.id}
                          onPick={(id) => onSetColorTheme && onSetColorTheme(id)} ring="22" />
                ))}
              </div>
            </Card>
          </>
        ) : (
          <Card className="p-4" style={{ background: T.surfaceWarm }}>
            <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
              Colour themes are a light-mode feature — switch to Light above to pick a palette.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export default ThemesScreen;
