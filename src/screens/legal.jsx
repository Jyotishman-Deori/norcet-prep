// =====================================================================
// src/screens/legal.jsx — renders a legal document (Privacy / Terms /
// Community Guidelines / Cancellation & Refunds).
//   • LegalContent — intro + sections only (embeddable, e.g. onboarding #17)
//   • LegalScreen  — TopBar + LegalContent (Settings → Legal sub-view #16,
//     and the full-screen `legal` route the desktop footer links to)
// Content comes from lib/legal.js, so every surface stays in sync.
// =====================================================================
import React from 'react';
import { useTheme } from '../lib/app-context.jsx';
import { TopBar } from '../ui/primitives.jsx';
import { legalDoc } from '../lib/legal.js';

export function LegalContent({ doc }) {
  const { theme: T } = useTheme();
  const d = legalDoc(doc);
  if (!d) return null;
  return (
    <div>
      <div className="text-[11px] mb-3" style={{ color: T.muted }}>Last updated · {d.updated}</div>
      {d.intro && (
        <div className="text-sm leading-relaxed mb-4" style={{ color: T.inkSoft }}>{d.intro}</div>
      )}
      <div className="space-y-4">
        {d.sections.map((s, i) => (
          <div key={i}>
            <div className="font-display text-sm font-semibold mb-1" style={{ color: T.ink }}>{s.h}</div>
            <div className="text-[13px] leading-relaxed whitespace-pre-line" style={{ color: T.inkSoft }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LegalScreen({ doc, onBack }) {
  const { theme: T } = useTheme();
  const d = legalDoc(doc);
  return (
    <div className="anim-fadeup">
      <TopBar title={d ? d.title : 'Legal'} onBack={onBack} feedback={{ screen: d ? d.title : 'Legal', noHelp: true }} />
      <div className="max-w-md md:max-w-2xl mx-auto px-4 md:px-6 pt-2 pb-24">
        <div className="font-display text-2xl font-semibold mb-4" style={{ color: T.ink }}>{d ? d.title : 'Legal'}</div>
        <LegalContent doc={doc} />
      </div>
    </div>
  );
}

export default LegalScreen;
