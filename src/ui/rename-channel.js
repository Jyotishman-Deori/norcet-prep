// =====================================================================
// src/ui/rename-channel.js — rename-profile opener channel (A1 slice 13)
// Same module-singleton pattern as the support/help/feedback openers in
// primitives.jsx (slice 9): the host modal (RenameProfileHost, still at the
// App root) registers an opener; any screen calls requestRename(ctx) to open
// it. Extracted so the Settings screen can trigger it without a back-prop.
// =====================================================================
let _openRename = null;
export function requestRename(ctx) { if (_openRename) _openRename(ctx || {}); }
export function registerRenameOpener(fn) {
  _openRename = fn;
  return () => { if (_openRename === fn) _openRename = null; };
}
