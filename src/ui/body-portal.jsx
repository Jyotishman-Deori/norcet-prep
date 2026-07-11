// =====================================================================
// src/ui/body-portal.jsx — render a popup overlay into <body>.
//
// position:fixed is contained by ANY transformed/filtered ancestor, and every
// screen root animates in with a transform (anim-fadeup and friends). An
// overlay rendered inline inside a screen can therefore anchor to the PAGE
// instead of the viewport — the "dialog opens at the top while I'm scrolled
// down" bug on iOS/Android/desktop alike. Portaling to <body> (the TopBar /
// ConfirmDialog / KmapDialog pattern) makes viewport centring unconditional.
//
// Wrap the overlay's OUTERMOST fixed element. SSR-safe: without a document
// (render smoke) children render inline.
// =====================================================================
import { createPortal } from 'react-dom';

export default function BodyPortal({ children }) {
  return (typeof document !== 'undefined' && document.body)
    ? createPortal(children, document.body)
    : children;
}
