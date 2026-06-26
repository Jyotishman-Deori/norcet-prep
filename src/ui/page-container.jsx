// =====================================================================
// src/ui/page-container.jsx — the content WIDTH primitive (multi-device Phase 0).
// The single source of truth for how wide a screen's content gets, and its
// horizontal padding, across phone → tablet → desktop. Replaces ad-hoc
// `max-w-md mx-auto px-4` so screens scale CONSISTENTLY instead of each picking
// its own width. Adopt gradually, one screen at a time (mobile is identical —
// the base width is the same max-w-md every screen already uses).
//
//   size:
//     'app'     dashboards / hubs            (md:2xl · lg:5xl)
//     'content' reading / forms / lists      (md:2xl · lg:3xl)   ← single column
//     'narrow'  setups / focused flows       (md:xl)
//     'wide'    wide tools (admin, maps)      (md:3xl · lg:6xl)
//
// Mobile (<768) is always max-w-md — byte-identical to today.
// =====================================================================
import React from 'react';

const WIDTHS = {
  app:     'max-w-md md:max-w-2xl lg:max-w-5xl',
  content: 'max-w-md md:max-w-2xl lg:max-w-3xl',
  narrow:  'max-w-md md:max-w-xl',
  wide:    'max-w-md md:max-w-3xl lg:max-w-6xl',
};

export default function PageContainer({ size = 'app', className = '', children, ...rest }) {
  const w = WIDTHS[size] || WIDTHS.app;
  return (
    <div className={`${w} mx-auto px-4 lg:px-8 ${className}`} {...rest}>
      {children}
    </div>
  );
}
