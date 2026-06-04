import { useRef, useEffect } from 'react';

// A9 — Accessibility: reusable focus management for modal dialogs.
// Usage: const ref = useFocusTrap(onClose); then put `ref` + role="dialog"
// aria-modal="true" on the dialog container. On mount it remembers the
// previously-focused element, moves focus to the first focusable control
// inside the dialog, and:
//   - Escape calls onClose
//   - Tab / Shift+Tab cycle within the dialog (focus can't escape behind it)
//   - on unmount, focus returns to the trigger that opened the dialog
// `active` (default true) lets always-mounted modals that toggle visibility
// internally (e.g. ReferenceLookupModal with `if (!open) return null`) drive
// the trap by their open flag: pass useFocusTrap(onClose, open).
// All wrapped defensively so a missing DOM API never throws.
function useFocusTrap(onClose, active = true) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node || typeof document === 'undefined') return;
    const prevActive = document.activeElement;
    const SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(node.querySelectorAll(SELECTOR))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    // Move focus inside on open (first focusable, else the container itself).
    const first = focusables()[0];
    if (first) { try { first.focus(); } catch (e) {} }
    else { try { node.setAttribute('tabindex', '-1'); node.focus(); } catch (e) {} }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (onClose) onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey) {
        if (activeEl === firstEl || !node.contains(activeEl)) { e.preventDefault(); try { lastEl.focus(); } catch (er) {} }
      } else {
        if (activeEl === lastEl || !node.contains(activeEl)) { e.preventDefault(); try { firstEl.focus(); } catch (er) {} }
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      // Restore focus to the opener so keyboard users aren't dumped at <body>.
      if (prevActive && typeof prevActive.focus === 'function') {
        try { prevActive.focus(); } catch (e) {}
      }
    };
  }, [onClose, active]);
  return ref;
}

export { useFocusTrap };
