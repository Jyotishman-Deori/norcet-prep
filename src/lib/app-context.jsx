// =====================================================================
// APP CONTEXT  (A7 — theme / profile / data single source of truth)
//   src/lib/app-context.jsx
// Replaces the old module-level T / IS_DARK bridge and the data / profile
// props that used to be threaded through every screen. App.jsx wraps every
// render branch in <AppProviders ...> (see the `provide()` helper) and feeds
// this render's live state in; leaf primitives (Pill / Button / TopBar /
// FeedbackButton) and every extracted screen read it back through the hooks.
//
// Contract (derived from how the screens + primitives actually consume it):
//   useTheme()   -> { theme, isDark, themeMode, setThemeMode }
//   useProfile() -> { profile, isAdmin, profileId, setProfile }
//   useData()    -> { data, allQuestions, setData }
//   useI18n()    -> { lang, setLang, langLoading, t }
//     `t` is the stable lookup from lib/i18n.js (UI CHROME strings only —
//     study content is never translated; see the i18n.js header rule).
//     Re-render on language switch is driven by `lang` changing in App.
//
// Notes on the shape:
//   • `theme` is the active theme object (aliased to T at call sites); `isDark`
//     is true only when themeMode === 'dark' (i.e. theme === DARK_THEME).
//   • `profileId` is DERIVED here as `profile ? profile.id : null`, matching
//     App's `profile && profile.id` idiom and KnowledgeMap's
//     `useProfile().profileId`. It is not a separate provider prop.
//   • themeMode/setThemeMode and setProfile are passed into AppProviders by
//     App and carried on the context value so it stays the single source of
//     truth, even though most consumers read the smaller documented subset.
// =====================================================================
import React, { createContext, useContext, useMemo } from 'react';
import { t } from './i18n.js';

// The contexts are exported so callers can use them directly if ever needed;
// the hooks below are the supported access path.
export const ThemeContext = createContext(null);
export const ProfileContext = createContext(null);
export const DataContext = createContext(null);
export const I18nContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx == null) throw new Error('useTheme must be used within <AppProviders>');
  return ctx;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (ctx == null) throw new Error('useProfile must be used within <AppProviders>');
  return ctx;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (ctx == null) throw new Error('useData must be used within <AppProviders>');
  return ctx;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (ctx == null) throw new Error('useI18n must be used within <AppProviders>');
  return ctx;
}

// One provider wrapper for all three contexts, mounted once at the App root.
// Prop order mirrors the <AppProviders ...> call in App.jsx's `provide()`.
export function AppProviders({
  theme, themeMode, setThemeMode, isDark,
  profile, setProfile, isAdmin,
  data, setData, allQuestions,
  lang, setLang, langLoading,
  children,
}) {
  const themeValue = useMemo(
    () => ({ theme, isDark, themeMode, setThemeMode }),
    [theme, isDark, themeMode, setThemeMode]
  );

  // `t` reads the module-level active dict; `lang` in the value is what
  // makes consumers re-render when the dict swaps. Defaults keep older
  // AppProviders call sites (and the admin app, which never passes i18n
  // props) safely on English.
  const i18nValue = useMemo(
    () => ({ lang: lang || 'en', setLang: setLang || (() => {}), langLoading: !!langLoading, t }),
    [lang, setLang, langLoading]
  );

  const profileValue = useMemo(
    () => ({ profile, isAdmin, profileId: profile ? profile.id : null, setProfile }),
    [profile, isAdmin, setProfile]
  );

  const dataValue = useMemo(
    () => ({ data, allQuestions, setData }),
    [data, allQuestions, setData]
  );

  return (
    <I18nContext.Provider value={i18nValue}>
      <ThemeContext.Provider value={themeValue}>
        <ProfileContext.Provider value={profileValue}>
          <DataContext.Provider value={dataValue}>
            {children}
          </DataContext.Provider>
        </ProfileContext.Provider>
      </ThemeContext.Provider>
    </I18nContext.Provider>
  );
}
