// =====================================================================
// src/ui/trending-badge.jsx — small premium "Trending" / "New" pill.
// Pure presentational. A gradient pill with a subtle diagonal shimmer that runs
// ONLY when the user hasn't asked for reduced motion (the shimmer lives behind a
// `@media (prefers-reduced-motion: no-preference)` guard, so it's static for
// anyone who opts out). The keyframes are injected once, module-level.
// =====================================================================
import React from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';

const SHIMMER_CSS = `
.trend-badge { position: relative; overflow: hidden; }
@media (prefers-reduced-motion: no-preference) {
  .trend-badge::after {
    content: ''; position: absolute; inset: 0; border-radius: 9999px; pointer-events: none;
    background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.5) 50%, transparent 65%);
    transform: translateX(-130%);
    animation: trendShimmer 2.8s ease-in-out infinite;
  }
}
@keyframes trendShimmer { 0% { transform: translateX(-130%); } 55%, 100% { transform: translateX(130%); } }
`;

let _styleInjected = false;
function ensureStyle() {
  if (_styleInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.setAttribute('data-trend-badge', '');
  el.textContent = SHIMMER_CSS;
  (document.head || document.documentElement).appendChild(el);
  _styleInjected = true;
}

export default function TrendingBadge({ variant = 'trending', className = '', style }) {
  const { theme: T } = useTheme();
  ensureStyle();

  const isNew = variant === 'new';
  const Icon = isNew ? Sparkles : TrendingUp;
  const label = isNew ? 'New' : 'Trending';
  // Warm flame gradient for trending; cool accent→primary for "new".
  const c1 = isNew ? T.accent : '#F08C00';
  const c2 = isNew ? T.primary : '#E8590C';

  return (
    <span
      className={`trend-badge no-tap-highlight inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${className}`}
      style={{ background: `linear-gradient(95deg, ${c1}, ${c2})`, color: '#FFF', boxShadow: `0 2px 8px ${c2}55`, ...style }}
    >
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </span>
  );
}
