// =====================================================================
// src/lib/ui-prefs.js  (#21 Sidebar Gesture Controls + #29 Crib Sheet toggle)
// Small per-device UI preferences, persisted via safeStorage (same pattern as
// lib/sound.js): a module-level cache hydrated once at boot, synchronous
// getters for hot paths (touch handlers), async setters that persist.
//
//   Sidebar gestures (KEY_PREFIXES.SIDEBAR_GESTURES, JSON):
//     { close: true, open: false }
//     - close (swipe right on the open drawer to close): default ON — safe on
//       all devices, the user is already inside the overlay.
//     - open (swipe left anywhere on Home): default OFF — conflicts
//       with the Android 10+ system back gesture on many devices.
//
//   Crib sheet (KEY_PREFIXES.CRIB_SHEET, 'true'/'false'): default ON. When
//     off, the "Review answers — Crib Sheet" button is absent from results.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEY_PREFIXES } from './keys.js';

const GESTURE_DEFAULTS = { close: true, open: true };

let _gestures = { ...GESTURE_DEFAULTS };
let _cribEnabled = true;

export async function loadUiPrefs() {
  try {
    const r = await safeStorage.get(KEY_PREFIXES.SIDEBAR_GESTURES, false);
    if (r && r.value) {
      const v = JSON.parse(r.value);
      if (v && typeof v === 'object') {
        _gestures = {
          close: v.close !== false,             // default true
          open: v.open !== false,               // default true
        };
      }
    }
  } catch (e) {}
  try {
    const r = await safeStorage.get(KEY_PREFIXES.CRIB_SHEET, false);
    if (r && r.value != null) {
      _cribEnabled = !(r.value === 'false' || r.value === false || r.value === '0');
    }
  } catch (e) {}
  return { gestures: { ..._gestures }, cribEnabled: _cribEnabled };
}

// -- Sidebar gestures ---------------------------------------------------
export const getSidebarGestures = () => ({ ..._gestures });

export async function setSidebarGesture(which, on) {
  if (which !== 'close' && which !== 'open') return getSidebarGestures();
  _gestures = { ..._gestures, [which]: !!on };
  try { await safeStorage.set(KEY_PREFIXES.SIDEBAR_GESTURES, JSON.stringify(_gestures), false); } catch (e) {}
  return getSidebarGestures();
}

// -- Crib sheet -----------------------------------------------------------
export const isCribSheetEnabled = () => _cribEnabled;

export async function setCribSheetEnabled(on) {
  _cribEnabled = !!on;
  try { await safeStorage.set(KEY_PREFIXES.CRIB_SHEET, _cribEnabled ? 'true' : 'false', false); } catch (e) {}
  return _cribEnabled;
}
