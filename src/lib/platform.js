// =====================================================================
// src/lib/platform.js — tiny runtime platform checks.
// Currently just iOS detection, used to disable the swipe-to-open-sidebar
// gesture on iPhone/iPad: iOS reserves the left-edge swipe for its own
// back navigation, so the app's edge gesture conflicts with it (the page
// blanks and a "press back to exit" prompt fires). We can't suppress the
// system gesture from a passive touch listener, so on iOS we simply don't
// attach our own — the Menu button still opens the sidebar.
// =====================================================================

// True on iPhone/iPad, including iPadOS 13+ which masquerades as "MacIntel"
// (distinguished by it being a touch device).
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ desktop-class Safari reports as Mac; touch points disambiguate.
  if (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return true;
  return false;
}
