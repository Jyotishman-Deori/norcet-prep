// =====================================================================
// src/lib/hotkeys.js — global keyboard shortcut decisions (pure + testable).
//
// The only shortcut today is the command-palette / quick-search opener
// (doc 15.7): the app's Search screen already IS a shortcut router
// (nav-registry.js), so this just decides WHEN a keydown should open it. The
// DOM wiring lives in App.jsx; the decision lives here so it is unit-tested.
// =====================================================================

// True when a keystroke is being typed into an editable field, so a bare
// character shortcut ('/') must NOT be hijacked.
export function isTypingTarget(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  return false;
}

// paletteAction(descriptor) -> 'open' | null
// descriptor: { key, ctrl, meta, alt, shift, typing }
//   • Cmd/Ctrl+K  -> open, always (the canonical command-palette combo, so it
//     works even while a field is focused; the field keeps its text).
//   • bare '/'    -> open, but ONLY when not typing and no modifier is held
//     (a Slack/Vim style quick-search); inside a text field '/' is a literal.
export function paletteAction(descriptor) {
  const d = descriptor || {};
  const key = d.key || '';
  const k = key.toLowerCase();
  if (k === 'k' && (d.ctrl || d.meta) && !d.alt && !d.shift) return 'open';
  if (key === '/' && !d.ctrl && !d.meta && !d.alt && !d.typing) return 'open';
  return null;
}
