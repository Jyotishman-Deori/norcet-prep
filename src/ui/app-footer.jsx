// =====================================================================
// src/ui/app-footer.jsx — the Duolingo-style link-column FOOTER (desktop).
//
// Mounted by App on the same four tab-root screens as DesktopNav, and only
// on desktop (JS gate + `hidden lg:block` belt). Four link columns + a
// brand block. Every link is a nav object through the drawer's dispatcher
// (or an imperative popup for feedback/support), so nothing here invents
// routing. A Socials column is DELIBERATELY absent — the owner will add
// channels at launch (journaled reminder).
// =====================================================================
import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, RefreshCw, ChevronUp } from 'lucide-react';
import { useTheme, useI18n } from '../lib/app-context.jsx';
import { LOCALES } from '../lib/i18n.js';
import { requestFeedback, requestSupport } from './primitives.jsx';

// Desktop footer language switcher — same data + pick contract as the
// Settings → Language page (settings-language.jsx), condensed into an
// upward popover so the choice is one click from any tab root.
function FooterLanguage() {
  const { theme: T } = useTheme();
  const { lang, setLang, langLoading, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busyCode, setBusyCode] = useState(null);
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const current = LOCALES.find(l => l.code === lang) || LOCALES[0];

  const pick = async (code) => {
    if (busyCode || langLoading) return;
    if (code === lang) { setOpen(false); return; }
    setBusyCode(code);
    setFailed(false);
    try { await setLang(code); setOpen(false); }
    catch (e) { setFailed(true); }
    finally { setBusyCode(null); }
  };

  return (
    <div ref={wrapRef} className="relative">
      {open && (
        <div className="absolute bottom-full right-0 mb-2 p-2 rounded-2xl anim-fadeup z-40"
             style={{ background: T.surface, border: `1px solid ${T.border}`,
                      boxShadow: '0 12px 32px rgba(0,0,0,0.14)', width: 420 }}
             role="menu" aria-label={t('settings.language.title')}>
          {failed && (
            <div className="text-[11px] px-2 py-1.5 mb-1 rounded-lg" style={{ background: T.errorSoft, color: T.error }}>
              {t('settings.language.downloadFailed')}
            </div>
          )}
          <div className="grid grid-cols-3 gap-1">
            {LOCALES.map(l => {
              const active = l.code === lang;
              const busy = busyCode === l.code;
              return (
                <button key={l.code} onClick={() => pick(l.code)} role="menuitem"
                        aria-pressed={active} lang={l.bcp47}
                        className="no-tap-highlight rounded-xl px-2.5 py-2 text-left transition-colors"
                        style={active
                          ? { background: T.primary + '12', border: `1px solid ${T.primary}` }
                          : { background: 'transparent', border: '1px solid transparent' }}>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[13px] font-semibold truncate" style={{ color: active ? T.primary : T.ink }}>
                      {l.native}
                    </span>
                    {busy
                      ? <RefreshCw size={12} className="animate-spin flex-shrink-0" style={{ color: T.primary }} />
                      : active && <Check size={12} className="flex-shrink-0" style={{ color: T.primary }} />}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: T.muted }}>{l.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)}
              aria-haspopup="menu" aria-expanded={open}
              className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors"
              style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
        <Globe size={13} style={{ color: T.muted }} />
        <span lang={current.bcp47}>{current.native}</span>
        <ChevronUp size={13} style={{ color: T.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
    </div>
  );
}

export default function AppFooter({ onNavigate }) {
  const { theme: T } = useTheme();
  const { t } = useI18n();

  const COLS = [
    {
      h: 'About',
      links: [
        { label: 'About us', go: () => onNavigate({ screen: 'about' }) },
        { label: 'Share the app', go: () => onNavigate({ screen: 'share-app' }) },
        { label: 'Support the app', go: () => requestSupport() },
        { label: 'Premium', go: () => onNavigate({ screen: 'premium' }) },
      ],
    },
    {
      h: 'Study',
      links: [
        { label: 'Library', go: () => onNavigate({ screen: 'library' }) },
        { label: 'Learn', go: () => onNavigate({ screen: 'learn-topics' }) },
        { label: 'Level Up', go: () => onNavigate({ screen: 'level-up' }) },
        { label: 'Revision', go: () => onNavigate({ screen: 'revision-sheet' }) },
        { label: 'Exam weightage', go: () => onNavigate({ screen: 'weightage' }) },
      ],
    },
    {
      h: 'Help and support',
      links: [
        { label: 'FAQ', go: () => onNavigate({ screen: 'faq' }) },
        { label: 'Study Methods', go: () => onNavigate({ screen: 'study-methods' }) },
        { label: 'Send feedback', go: () => requestFeedback({ screen: 'Footer' }) },
        { label: 'My reports', go: () => onNavigate({ screen: 'my-reports' }) },
      ],
    },
    {
      h: 'Privacy and terms',
      links: [
        { label: 'Privacy Policy', go: () => onNavigate({ screen: 'legal', doc: 'privacy' }) },
        { label: 'Terms of Use', go: () => onNavigate({ screen: 'legal', doc: 'terms' }) },
        { label: 'Community Guidelines', go: () => onNavigate({ screen: 'legal', doc: 'guidelines' }) },
        { label: 'Cancellation & Refunds', go: () => onNavigate({ screen: 'legal', doc: 'refunds' }) },
        { label: 'Content Disclaimer', go: () => onNavigate({ screen: 'legal', doc: 'disclaimer' }) },
      ],
    },
  ];

  return (
    <footer className="hidden lg:block mt-16" style={{ borderTop: `1px solid ${T.borderSoft}`, background: T.surfaceWarm }}>
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="grid grid-cols-5 gap-8">
          {/* Brand block */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display text-base font-bold"
                   style={{ background: T.primary, color: '#FFF' }}>
                N
              </div>
              <span className="font-display text-base font-semibold" style={{ color: T.ink }}>
                Nurse<span style={{ color: T.primary }}>Holic</span>
              </span>
            </div>
            <div className="text-[12px] leading-relaxed" style={{ color: T.muted }}>
              Serious NORCET preparation.
              <br />Free · Ad-free · Always.
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.h}>
              <div className="text-[12px] font-bold uppercase tracking-wider mb-3.5" style={{ color: T.ink }}>
                {col.h}
              </div>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <button onClick={l.go}
                            className="foot-link no-tap-highlight text-[13px] font-medium text-left transition-colors"
                            style={{ color: T.inkSoft, '--foot-hover': T.primary }}>
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 flex items-center justify-between gap-4"
             style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="text-[12px]" style={{ color: T.muted }}>
            © 2026 NurseHolic™. All rights reserved.
            <span className="mx-2" aria-hidden="true">·</span>
            {t('common.eduTag')}
          </div>
          <FooterLanguage />
        </div>
      </div>
    </footer>
  );
}
