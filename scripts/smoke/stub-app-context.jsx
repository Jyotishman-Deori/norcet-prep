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

export function useData() {
  return {
    data: DEFAULT_DATA,
    allQuestions: SEED_QUESTIONS,
    setData: () => {},
  };
}

export function useProfile() {
  return {
    profileId: 'smoke-test',
    profile: { uid: 'smoke', id: 'smoke-test', displayName: 'Smoke' },
  };
}

export function AppProviders({ children }) { return children; }
