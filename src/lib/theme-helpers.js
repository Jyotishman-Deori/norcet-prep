// =====================================================================
// src/lib/theme-helpers.js — theme-derived colour helpers (A1 slice 25)
// Extracted from App.jsx. The _dm* colour-math helpers are byte-identical.
// fgOnDark/feedbackStatusMeta were theme-coupled (read the bare bridge T /
// DARK_THEME), which blocked ~8 screens. Here they become:
//   • pure fns  — fgOnDarkFor(hex, isDark), statusMetaFor(id, theme)
//   • hooks     — useFgOnDark(), useStatusMeta()  (read isDark/theme from
//                 useTheme so extracted screens keep call sites byte-identical)
// App keeps thin bridge wrappers (fgOnDark/feedbackStatusMeta) for its still-
// inline consumers; `T !== DARK_THEME` is exactly `!isDark` (IS_DARK is true
// only when themeMode === 'dark', i.e. T === DARK_THEME).
// =====================================================================
import { useCallback } from 'react';
import { useTheme } from './app-context.jsx';

function _dmHexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function _dmRgbToHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function _dmRelLum([r, g, b]) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// Lift a too-dark accent toward white so it stays readable in dark mode.
export function fgOnDarkFor(hex, isDark) {
  if (!isDark || typeof hex !== 'string' || hex[0] !== '#') return hex;
  const rgb = _dmHexToRgb(hex);
  if (_dmRelLum(rgb) >= 0.18) return hex;          // already readable on dark
  const [r, g, b] = rgb, m = 0.55;                  // mix ~55% toward white
  return _dmRgbToHex(r + (255 - r) * m, g + (255 - g) * m, b + (255 - b) * m);
}

// Admin reply/status badge metadata (label + theme colour).
export function statusMetaFor(id, T) {
  switch (id) {
    case 'looking': return { label: 'Looking into it', color: T.sec.stats };
    case 'fixed':   return { label: 'Fixed', color: T.success };
    case 'wontfix': return { label: "Won't fix", color: T.muted };
    case 'thanks':  return { label: 'Thanks', color: T.accent };
    default:        return null;
  }
}

export function useFgOnDark() {
  const { isDark } = useTheme();
  return useCallback((hex) => fgOnDarkFor(hex, isDark), [isDark]);
}

export function useStatusMeta() {
  const { theme: T } = useTheme();
  return useCallback((id) => statusMetaFor(id, T), [T]);
}
