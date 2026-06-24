// =====================================================================
// src/lib/back-handler.js — unified back-button interception (BUG-01)
//
// Problem: screens that own an INTERNAL sub-view (Settings sub-pages, the
// Bookmark detail view, the Knowledge-Map overlays, the Revision date view)
// keep that sub-view in local React state, NOT in the app's nav stack. So the
// device/gesture back button and the browser Back button — both handled by the
// global popstate guard in App.jsx — skipped straight past the sub-view (or
// appeared to do nothing), instead of returning to the screen's own previous
// step the way the on-screen ← arrow does.
//
// Fix: a tiny LIFO registry. A screen registers a back handler via the
// useBackHandler hook; the handler pops ONE level of its own internal state and
// returns true when it did so (back "consumed"), or false when there's nothing
// left to pop ("let the app navigate"). App.jsx's popstate guard calls
// runTopBackHandler() right before it would navigate Home, so the hardware
// back, the browser back and the on-screen arrow all behave identically.
//
// Same module-singleton style as the support/help/rename openers (see
// ui/rename-channel.js). Single-root PWA, so a module-level stack is safe.
// =====================================================================
import { useEffect, useRef } from 'react';

// LIFO stack of registered handlers. The app renders ONE screen at a time, so
// this is 0 or 1 entries in practice; a stack keeps it robust if a future
// screen ever mounts another on top of itself.
const stack = [];

// Register `fn` and return an unregister function (call on unmount).
export function pushBackHandler(fn) {
  stack.push(fn);
  return () => {
    const i = stack.indexOf(fn);
    if (i !== -1) stack.splice(i, 1);
  };
}

// Consult the topmost (currently-visible) screen's handler. Returns true when
// that screen consumed the back press by popping its own sub-view; false (or no
// handler) means "nothing internal to pop — the app should navigate".
export function runTopBackHandler() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  // A throwing handler must never break app navigation — fail open (navigate).
  try { return top() === true; } catch (e) { return false; }
}

// Hook: register `handler` for as long as the component is mounted (and
// `enabled`). `handler` returns true when it consumed the back press. We
// register a STABLE wrapper that reads the latest closure through a ref, so an
// inline arrow re-created each render never churns the stack.
export function useBackHandler(handler, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return undefined;
    const wrapper = () => ref.current && ref.current();
    return pushBackHandler(wrapper);
  }, [enabled]);
}
