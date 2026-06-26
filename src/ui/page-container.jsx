// =====================================================================
// src/ui/page-container.jsx — the content WIDTH primitive (multi-device Phase 0).
// The single source of truth for how wide a screen's content gets, and its
// horizontal padding, across phone → tablet → desktop. Replaces ad-hoc
// `max-w-md mx-auto px-4` so screens scale CONSISTENTLY instead of each picking
// its own width. Adopt gradually, one screen at a time (mobile is identical —
// the base width is the same max-w-md every screen already uses).
//
//   size:
//     'app'     dashboards / hubs            (md:3xl · lg:5xl)
//     'content' reading / forms / lists      (md:3xl)            ← single column
//     'narrow'  setups / focused flows       (md:xl)
//     'wide'    wide tools (admin, maps)      (md:3xl · lg:6xl)
//
// TABLET (md, 768–1023): the content tier widened from 2xl→3xl so a portrait
// iPad FILLS the screen (it used to leave a phone-width column with big side
// margins). Paired with md:-gated multi-column layouts on the dashboards/lists,
// this is the premium tablet tier — no longer "a tall phone".
// Mobile (<768) is always max-w-md — byte-identical to today.
// =====================================================================
import React from 'react';

const WIDTHS = {
  app:     'max-w-md md:max-w-3xl lg:max-w-5xl',
  content: 'max-w-md md:max-w-3xl',
  narrow:  'max-w-md md:max-w-xl',
  wide:    'max-w-md md:max-w-3xl lg:max-w-6xl',
};

export default function PageContainer({ size = 'app', className = '', children, ...rest }) {
  const w = WIDTHS[size] || WIDTHS.app;
  return (
    <div className={`${w} mx-auto px-4 md:px-6 lg:px-8 ${className}`} {...rest}>
      {children}
    </div>
  );
}
