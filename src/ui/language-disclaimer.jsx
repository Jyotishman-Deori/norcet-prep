// =====================================================================
// src/ui/language-disclaimer.jsx — the honest notice about our translations.
//
// Shown in BOTH places a user can switch language: the desktop footer's
// language popover (ui/app-footer.jsx) and Settings -> Language
// (screens/settings-language.jsx), so the caveat can never be missed by
// picking one route over the other.
//
// Deliberately ENGLISH-ONLY, and that is not laziness:
//   • a notice whose whole point is "these translations are not reliable yet"
//     is worth the least in a possibly-wrong translation of itself, and
//   • routing it through t() would force the string into all 15 locale packs
//     (the check-locales gate fails on a missing key), which would mean
//     machine-drafting the very text that warns about machine drafts.
// English is the canonical, trustworthy version. See docs / CLAUDE.md i18n rules.
//
// House rule: no em dashes and no double hyphens in any of this copy.
// =====================================================================
import React from 'react';
import { Languages } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';

// `compact` is the popover variant (tighter, fewer lines); the full variant is
// used on the Settings language page where there is room to be complete.
export default function LanguageDisclaimer({ compact = false }) {
  const { theme: T } = useTheme();

  return (
    <div className={'flex items-start gap-2.5 rounded-xl ' + (compact ? 'p-2.5' : 'p-3.5')}
         style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
      <Languages size={compact ? 13 : 15} aria-hidden="true"
                 className="flex-shrink-0"
                 style={{ color: T.muted, marginTop: compact ? 1 : 2 }} />
      <div className={compact ? 'text-[11px] leading-relaxed' : 'text-[12px] leading-relaxed'}
           style={{ color: T.muted }}>
        {!compact && (
          <div className="font-semibold mb-1" style={{ color: T.inkSoft }}>
            About these translations
          </div>
        )}
        These are early drafts. Some wording may be inaccurate, and a few languages are
        only partly translated, so please do not rely on them completely.
        {!compact && (
          <>
            {' '}Questions, explanations and study content always stay in English, the same
            as the real exam.
          </>
        )}
        {' '}We are improving them as fast as we can. If a line reads wrong in your language,
        tell us with the Report button.
      </div>
    </div>
  );
}
