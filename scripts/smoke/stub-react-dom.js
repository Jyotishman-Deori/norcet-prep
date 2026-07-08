// Smoke-test wrapper for 'react-dom': identical to the real module except
// createPortal renders nothing — react-dom/server cannot traverse portals,
// and portal CONTENT is normally gated UI (dialogs, toasts). The component
// bodies that call createPortal still execute in full, which is what the
// smoke is for. REAL_REACT_DOM is resolved by the build plugin to the actual
// package (explicit exports shadow the star re-export per ESM semantics).
export * from 'REAL_REACT_DOM';
export const createPortal = () => null;
