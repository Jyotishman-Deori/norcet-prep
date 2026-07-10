// Smoke-test stub for src/lib/app-context.jsx — provides the hooks the
// screen graph consumes. Data is the app's REAL default shape (DEFAULT_DATA /
// SEED_QUESTIONS from src/data/seed.js) so screens render against faithful
// structures; the theme is a Proxy so any color key resolves to a valid hex.
// i18n: `t` is the REAL lookup from src/lib/i18n.js (English dict), so the
// smoke exercises actual key resolution — a typo'd key renders as the raw
// key in the smoke output instead of passing silently.
import { createContext } from 'react';
import { DEFAULT_DATA, SEED_QUESTIONS } from '../../src/data/seed.js';
import { t } from '../../src/lib/i18n.js';

const themeProxy = new Proxy({}, {
  get: (t, k) => (typeof k === 'string' ? '#446688' : undefined),
});

export const ThemeContext = createContext(null);
export const ProfileContext = createContext(null);
export const DataContext = createContext(null);
export const I18nContext = createContext(null);

export function useI18n() {
  return { lang: 'en', setLang: () => {}, langLoading: false, t };
}

export function useTheme() {
  return { theme: themeProxy, isDark: true, themeMode: 'dark', setThemeMode: () => {} };
}

// Smoke-only data override: entry.jsx can install a populated fixture so
// screens whose interesting code paths need real history (Stats Advanced
// tab: doubt matrix, leak radar, benchmarks) actually EXECUTE them instead
// of early-returning on the empty DEFAULT_DATA.
let smokeData = null;
export function __setSmokeData(d) { smokeData = d; }

export function useData() {
  return {
    data: smokeData || DEFAULT_DATA,
    allQuestions: SEED_QUESTIONS,
    setData: () => {},
  };
}

// Smoke-only profile override (e.g. a premium member for the DesktopNav
// gold-tier pill). Merged over the default smoke profile.
let smokeProfile = null;
export function __setSmokeProfile(p) { smokeProfile = p; }

export function useProfile() {
  return {
    profileId: 'smoke-test',
    profile: { uid: 'smoke', id: 'smoke-test', displayName: 'Smoke', ...(smokeProfile || {}) },
  };
}

export function AppProviders({ children }) { return children; }
