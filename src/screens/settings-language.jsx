// =====================================================================
// src/screens/settings-language.jsx — Settings → Language sub page.
// Owner-approved reference: Spotify desktop's "Choose a language" modal.
// A responsive grid where every cell leads with the language's NATIVE
// name in its own script (system fonts cover rendering before the
// subsetted pack downloads) and the English name sits muted below.
//
// I18N SCOPE (restated from src/lib/i18n.js): switching language changes
// UI CHROME ONLY. Questions, options, explanations and all study content
// stay in English on purpose: NORCET is conducted in English. The
// subtitle on this page says exactly that to the student.
//
// Selecting a non-English language lazily downloads its ui.json (and its
// subsetted font) once; both persist offline (IndexedDB + the SW's
// locale-assets cache). A failed first download (offline) shows an
// inline error + retry and the app stays on the current language.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Check, Search, RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';
import { useTheme, useI18n } from '../lib/app-context.jsx';
import { LOCALES, checkStorageHeadroom } from '../lib/i18n.js';
import LanguageDisclaimer from '../ui/language-disclaimer.jsx';

export default function SettingsLanguage() {
  const { theme: T } = useTheme();
  const { lang, setLang, langLoading, t } = useI18n();
  const [query, setQuery] = useState('');
  const [busyCode, setBusyCode] = useState(null);
  const [failedCode, setFailedCode] = useState(null);
  const [storageLow, setStorageLow] = useState(false);
  useEffect(() => {
    let alive = true;
    checkStorageHeadroom().then(r => { if (alive) setStorageLow(!r.ok); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const q = query.trim().toLowerCase();
  const list = LOCALES.filter(l =>
    !q || l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code.includes(q));

  const pick = async (code) => {
    if (busyCode || langLoading || code === lang) return;
    setBusyCode(code);
    setFailedCode(null);
    try { await setLang(code); }
    catch (e) { setFailedCode(code); }
    finally { setBusyCode(null); }
  };

  return (
    <>
      {/* Scope note: chrome translates, study content deliberately doesn't. */}
      <div className="text-xs mb-4 leading-relaxed" style={{ color: T.muted }}>
        {t('settings.language.subtitle')}
      </div>

      {/* Search — filters on native + English names (16 languages later). */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
               placeholder={t('settings.language.searchPlaceholder')}
               autoCapitalize="none" autoCorrect="off"
               className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
               style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
      </div>

      {/* Low-storage caution — informative only, never blocks the switch. */}
      {storageLow && (
        <div className="flex items-start gap-2.5 rounded-2xl p-3 mb-4"
             style={{ background: T.accent + '12', border: `1px solid ${T.accent}40` }}>
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
          <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
            {t('settings.language.storageWarning')}
          </div>
        </div>
      )}

      {/* Offline first-download failure — retry row, app stays as it was. */}
      {failedCode && (
        <div className="flex items-start gap-2.5 rounded-2xl p-3 mb-4 anim-fadeup"
             style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
          <WifiOff size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
          <div className="text-xs leading-relaxed flex-1" style={{ color: T.error }}>
            {t('settings.language.downloadFailed')}
          </div>
          <button onClick={() => pick(failedCode)}
                  className="no-tap-highlight text-xs font-semibold underline flex-shrink-0"
                  style={{ color: T.error }}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* The language grid — native name leads, English name below. */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {list.map(l => {
          const active = l.code === lang;
          const busy = busyCode === l.code;
          return (
            <button key={l.code} onClick={() => pick(l.code)}
                    aria-pressed={active}
                    lang={l.bcp47}
                    className="no-tap-highlight rounded-2xl p-3.5 text-left transition active:scale-[0.98]"
                    style={active
                      ? { background: T.primary + '12', border: `1.5px solid ${T.primary}` }
                      : { background: T.surface, border: `1px solid ${T.border}` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-display text-[15px] font-semibold leading-snug"
                     style={{ color: active ? T.primary : T.ink }}>
                  {l.native}
                </div>
                {busy
                  ? <RefreshCw size={15} className="animate-spin flex-shrink-0 mt-0.5" style={{ color: T.primary }} />
                  : active && <Check size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} />}
              </div>
              <div className="text-[11px] mt-1" style={{ color: T.muted }}>{l.name}</div>
            </button>
          );
        })}
      </div>

      {/* Draft-quality notice. Supersedes the older one-line t('...draftNotice')
          footnote: it also says that some languages are only PARTLY translated and
          that the drafts should not be relied on completely. English on purpose
          (see ui/language-disclaimer.jsx for why). */}
      <div className="mt-5">
        <LanguageDisclaimer />
      </div>
    </>
  );
}
