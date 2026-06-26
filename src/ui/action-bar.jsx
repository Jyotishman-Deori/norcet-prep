// =====================================================================
// src/ui/action-bar.jsx — the sticky bottom ACTION BAR primitive (Phase 0).
// Centralises the fixed-footer pattern used across the app (Start, Save & Next,
// Submit, Check…). Two reasons it exists:
//   1. Consistency — one blurred, theme-aware bar; inner content aligns to the
//      same width ladder as PageContainer, so buttons line up with the screen.
//   2. SIDEBAR-READY — it offsets its left edge by the CSS variable
//      --app-rail-w (default 0). Today that's 0 everywhere, so it behaves
//      exactly like the current full-width footers. When the desktop sidebar
//      lands (Phase 3) and sets --app-rail-w on large screens, EVERY bar that
//      uses this primitive shifts to respect the rail automatically — no
//      per-screen rework. That single variable is why adopting this now is the
//      leverage that prevents touching dozens of footers later.
//
// Width ladder mirrors PageContainer so the bar's content tracks the page.
// =====================================================================
import React from 'react';
import { useTheme } from '../lib/app-context.jsx';

const INNER = {
  app:     'max-w-md md:max-w-2xl lg:max-w-5xl',
  content: 'max-w-md md:max-w-2xl lg:max-w-3xl',
  narrow:  'max-w-md md:max-w-xl',
  wide:    'max-w-md md:max-w-3xl lg:max-w-6xl',
};

export default function ActionBar({ size = 'app', className = '', innerClassName = '', children }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  return (
    <div className={`fixed bottom-0 right-0 z-30 px-4 lg:px-8 py-3 ${className}`}
         style={{
           left: 'var(--app-rail-w, 0px)',
           background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2',
           backdropFilter: 'blur(12px)',
           borderTop: `1px solid ${T.borderSoft}`,
         }}>
      <div className={`${INNER[size] || INNER.app} mx-auto ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}
