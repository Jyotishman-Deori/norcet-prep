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
import React from 'react';
import { useTheme } from '../lib/app-context.jsx';
import { requestFeedback, requestSupport } from './primitives.jsx';

export default function AppFooter({ onNavigate }) {
  const { theme: T } = useTheme();

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

        <div className="mt-10 pt-6 text-[12px]" style={{ borderTop: `1px solid ${T.borderSoft}`, color: T.muted }}>
          © 2026 NurseHolic. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
