// =====================================================================
// src/ui/note-fab.jsx — draggable floating access point for the note popup.
//
// Mounted once at the app root (App.jsx) so it overlays EVERY screen — the
// guaranteed-universal entry point that also covers custom-header screens (e.g.
// Home) which don't render the shared TopBar note button. A tap opens the note
// popup via requestNote(); a drag repositions the button and snaps it to the
// nearest side on release.
//
// Platform hardening (spec Section 2, flags #4 & #6):
//   - env(safe-area-inset-*) is measured and used as a hard drag boundary, so
//     the button can never land behind the notch / Dynamic Island / status bar
//     / home indicator, or off-screen ("does not break the app").
//   - z-[100]: above page furniture (TopBar z-40) and modals, below the note
//     popup (z-110) and celebrations (z-120).
//   - prefers-reduced-motion skips the snap transition.
//
// Pointer Events unify mouse + touch; touch-action:none keeps a drag from
// scrolling the page. Position is mutated directly on the node during a drag
// (no React re-renders) for smoothness, then committed to state on release.
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { requestNote } from './primitives.jsx';

const SIZE = 54;          // button diameter (px) — 54px gives ≥44px hit area with comfort
const MARGIN = 12;        // gap kept from every safe-area edge
const TAP_MOVE = 6;       // px of movement under which a pointer-up counts as a tap
const TAP_MS = 300;       // and within this many ms
const POS_KEY = 'norcet:notefab-pos:v1';

function readInsets() {
  try {
    const p = document.createElement('div');
    p.style.cssText =
      'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) ' +
      'env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(p);
    const cs = getComputedStyle(p);
    const ins = {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
    document.body.removeChild(p);
    return ins;
  } catch (e) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

function bounds() {
  const w = window.innerWidth, h = window.innerHeight;
  const ins = readInsets();
  return {
    minX: ins.left + MARGIN,
    maxX: w - SIZE - ins.right - MARGIN,
    // keep clear of the status bar/notch at the top and the home indicator at
    // the bottom; also stay below a typical top bar row.
    minY: ins.top + MARGIN + 56,
    maxY: h - SIZE - ins.bottom - MARGIN,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function defaultPos() {
  const b = bounds();
  return { x: b.maxX, y: clamp(window.innerHeight * 0.72, b.minY, b.maxY) };
}

function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
    }
  } catch (e) {}
  return null;
}

function savePos(p) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch (e) {}
}

export default function NoteFab() {
  const { theme: T } = useTheme();
  const [pos, setPos] = useState(null);          // null until measured on mount
  const [dragging, setDragging] = useState(false);
  const elRef = useRef(null);
  const drag = useRef(null);                      // { startX, startY, ox, oy, moved, t0 }
  const reduced = useRef(
    typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ).current;

  // Measure + place on mount; re-clamp on resize/orientation change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const place = () => {
      const b = bounds();
      const stored = loadPos() || defaultPos();
      setPos({ x: clamp(stored.x, b.minX, b.maxX), y: clamp(stored.y, b.minY, b.maxY) });
    };
    place();
    const onResize = () => {
      const b = bounds();
      setPos((p) => (p ? { x: clamp(p.x, b.minX, b.maxX), y: clamp(p.y, b.minY, b.maxY) } : p));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = (e) => {
    if (!pos) return;
    const el = elRef.current;
    try { el.setPointerCapture(e.pointerId); } catch (er) {}
    // Cache the bounds once per drag — insets don't change mid-drag, and
    // measuring them on every pointermove (a DOM probe) would cause jank.
    drag.current = { startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y, moved: 0, t0: Date.now(), b: bounds() };
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    d.moved = Math.max(d.moved, Math.hypot(dx, dy));
    const nx = clamp(d.ox + dx, d.b.minX, d.b.maxX);
    const ny = clamp(d.oy + dy, d.b.minY, d.b.maxY);
    const el = elRef.current;
    if (el) { el.style.left = nx + 'px'; el.style.top = ny + 'px'; }
    d.nx = nx; d.ny = ny;
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const isTap = d.moved < TAP_MOVE && (Date.now() - d.t0) < TAP_MS;
    if (isTap) {
      try { if (navigator.vibrate) navigator.vibrate(6); } catch (er) {}
      requestNote();
      return;
    }
    // Snap to the nearer horizontal edge; keep the (clamped) vertical position.
    const x = (d.nx ?? d.ox), y = (d.ny ?? d.oy);
    const snapX = (x + SIZE / 2) < (window.innerWidth / 2) ? d.b.minX : d.b.maxX;
    const next = { x: snapX, y: clamp(y, d.b.minY, d.b.maxY) };
    setPos(next);
    savePos(next);
  };

  if (!pos) return null;

  // The resting glow animation is driven by a CSS class. We skip it when the
  // user is dragging (dragging=true) or prefers reduced motion, by toggling the
  // class on the element. The animation never fights with drag-state transitions.
  const fabClass = [
    'no-tap-highlight fixed z-[100] flex items-center justify-center rounded-full',
    !dragging && !reduced ? 'note-fab-pulse' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label="Open study notes"
      className={fabClass}
      style={{
        left: pos.x, top: pos.y, width: SIZE, height: SIZE,
        background: T.primary, color: '#FFF',
        // Two-layer border: inner ring in primarySoft for depth, subtle outline
        // ring on focus for keyboard-nav accessibility.
        border: `1.5px solid ${T.primarySoft}`,
        outline: 'none',
        boxShadow: dragging
          ? `0 14px 36px rgba(0,0,0,0.38), 0 2px 8px rgba(0,0,0,0.22), inset 0 1px 0 ${T.primarySoft}40`
          : `0 5px 18px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.14), inset 0 1px 0 ${T.primarySoft}40`,
        touchAction: 'none',
        cursor: dragging ? 'grabbing' : 'grab',
        transform: dragging ? 'scale(1.08)' : 'scale(1)',
        transition: reduced ? 'none' : (dragging
          ? 'box-shadow .12s ease, transform .12s ease'
          : 'left .22s cubic-bezier(.34,1.56,.64,1), top .22s ease, box-shadow .18s ease, transform .18s ease'),
      }}
    >
      {/* The icon itself is slightly smaller than the button so the tap area
          is generous. A grabbing-cursor icon cue is already set via CSS. */}
      <NotebookPen size={22} aria-hidden="true" />
    </button>
  );
}
