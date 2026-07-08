// Smoke-test stub for src/lib/app-context.jsx — provides the three hooks the
// knowledge-map graph consumes, with a Proxy theme so any color key resolves.
const themeProxy = new Proxy({}, {
  get: (t, k) => (typeof k === 'string' ? '#446688' : undefined),
});

export function useTheme() {
  return { theme: themeProxy, isDark: true, themeMode: 'dark', setThemeMode: () => {} };
}

export function useData() {
  return {
    data: { history: {}, preferences: {}, stats: {}, mindmapNotes: undefined },
    allQuestions: [],
    setData: () => {},
  };
}

export function useProfile() {
  return {
    profileId: 'smoke-test',
    profile: { uid: 'smoke', id: 'smoke-test', displayName: 'Smoke' },
  };
}
