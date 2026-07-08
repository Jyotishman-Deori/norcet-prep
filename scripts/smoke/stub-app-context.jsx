// Smoke-test stub for src/lib/app-context.jsx — provides the three hooks the
// screen graph consumes. Data is the app's REAL default shape (DEFAULT_DATA /
// SEED_QUESTIONS from src/data/seed.js) so screens render against faithful
// structures; the theme is a Proxy so any color key resolves to a valid hex.
import { createContext } from 'react';
import { DEFAULT_DATA, SEED_QUESTIONS } from '../../src/data/seed.js';

const themeProxy = new Proxy({}, {
  get: (t, k) => (typeof k === 'string' ? '#446688' : undefined),
});

export const ThemeContext = createContext(null);
export const ProfileContext = createContext(null);
export const DataContext = createContext(null);

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
