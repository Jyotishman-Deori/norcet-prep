// =====================================================================
// src/ui/companion-rename-channel.js — opener channel for the study-companion
// rename modal. Same module-singleton pattern as rename-channel.js: the host
// (CompanionRenameHost, mounted at the App root) registers an opener; the note
// popup's title pencil and the Settings card call requestCompanionRename(ctx).
//
// ctx: { profile, currentName, onRenamed(newName) }
// =====================================================================
let _openCompanionRename = null;
export function requestCompanionRename(ctx) { if (_openCompanionRename) _openCompanionRename(ctx || {}); }
export function registerCompanionRenameOpener(fn) {
  _openCompanionRename = fn;
  return () => { if (_openCompanionRename === fn) _openCompanionRename = null; };
}
