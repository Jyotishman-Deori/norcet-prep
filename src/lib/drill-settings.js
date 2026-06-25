// =====================================================================
// src/lib/drill-settings.js — per-feature toggles for the Drill-Tests coaching
// behaviours (Vitals Check, Code Blue, Ghost Shift, …). All default ON so the
// app behaves exactly as before for anyone who never opens the settings; a user
// who finds them intrusive can switch any of them off. Stored in the synced
// blob under preferences.drillCoaching = { [key]: false } (only OFF is written;
// absent ⇒ ON).
// =====================================================================
export const DRILL_FEATURE_KEYS = ['vitalsCheck', 'codeBlue', 'ghostShift', 'whatIf'];

// Default ON: a feature is OFF only when explicitly set to false.
export function drillFeatureOn(prefs, key) {
  const c = prefs && prefs.drillCoaching;
  return !(c && c[key] === false);
}

// Pure setter — merge one toggle into the preferences object.
export function setDrillFeature(prefs, key, on) {
  const cur = (prefs && prefs.drillCoaching) || {};
  return { ...(prefs || {}), drillCoaching: { ...cur, [key]: !!on } };
}
