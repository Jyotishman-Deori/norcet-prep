// =====================================================================
// src/lib/rage-click.js — rage-click detection: flag UX failures before a
// support ticket is filed.
//
// A "rage click" is N rapid pointerdowns clustered in one small spot: the
// classic "this button is broken / nothing is happening" frustration
// signal. Detected bursts are reported through the EXISTING errlog pipeline
// (captureError -> errlog:{sig}) with severity 'ux', so they surface in the
// admin Crash-reports triage list with the same group/resolve/delete
// workflow as crashes, plus a Umami 'rage-click' event for aggregate trends.
//
// Two parts, mirroring errorlog.js:
//   - createRageDetector(): PURE state machine (no DOM, no imports) so the
//     contract test runs under plain Node.
//   - installRageClickCapture(): one document-level pointerdown listener,
//     installed once at boot (main.jsx), fail-safe (never throws). Its
//     errorlog/umami deps are LAZY dynamic imports (same idiom as
//     game-config.js) because storage.js reads import.meta.env at module
//     level and must stay out of Node test import chains.
//
// False-positive guards: game/drill screens where rapid tapping is the
// point are excluded (EXCLUDED_SCREENS), as is the knowledge map (double-
// tap zoom makes 3-4 quick taps legitimate). The quiz screen is INCLUDED
// on purpose: hammering a locked or unresponsive option is a real UX
// signal. Reports are burst-deduped (cooldown) and session-capped; the
// errlog pipeline adds its own signature grouping and flush throttle on
// top, so a tantrum can never flood storage.
// =====================================================================

// Tunable thresholds (constants so prod tuning is a one-line change).
export const RAGE_CLICKS = 4;            // pointerdowns to qualify
export const RAGE_WINDOW_MS = 1500;      // all within this span from the burst's first click
export const RAGE_RADIUS_PX = 32;        // all within this radius of the burst's first click
export const RAGE_COOLDOWN_MS = 30000;   // one report per tantrum
export const RAGE_MAX_REPORTS_PER_SESSION = 6;

// Screens where rapid tapping is legitimate gameplay or navigation.
export const RAGE_EXCLUDED_SCREENS = [
  'skill-setup', 'skill-drill', 'icu-monitor', 'crash-cart', 'sorter',
  'distractor-assassin', 'three-am-chart', 'shift-survival', 'tie-breaker',
  'ibq', 'ward-boss', 'drip-zone', 'wave-hunter',
  'knowledge-map', // double-tap zoom: 3-4 quick taps in place are normal
];

// ---- pure detector -------------------------------------------------
// feed(click) -> null | rage event.
// click = { x, y, ts, screen, interactive, label, xPct, yPct }
// (xPct/yPct are carried through untouched; radius math uses x/y.)
export function createRageDetector(opts = {}) {
  const clicks = opts.clicks || RAGE_CLICKS;
  const windowMs = opts.windowMs || RAGE_WINDOW_MS;
  const radiusPx = opts.radiusPx || RAGE_RADIUS_PX;
  const cooldownMs = opts.cooldownMs || RAGE_COOLDOWN_MS;
  const maxReports = opts.maxReports || RAGE_MAX_REPORTS_PER_SESSION;
  const excluded = new Set(opts.excludedScreens || RAGE_EXCLUDED_SCREENS);

  let burst = null;          // { x, y, ts, screen, interactive, label, xPct, yPct, count }
  let cooldownUntil = 0;
  let reports = 0;

  function feed(click) {
    if (!click || typeof click.x !== 'number' || typeof click.y !== 'number' || !click.screen) return null;
    if (excluded.has(click.screen)) { burst = null; return null; }
    if (click.ts < cooldownUntil) return null;

    const fresh = burst
      && click.screen === burst.screen
      && (click.ts - burst.ts) <= windowMs
      && Math.hypot(click.x - burst.x, click.y - burst.y) <= radiusPx;

    if (!fresh) {
      // anchor a new burst on this click; its target is "the thing that
      // didn't respond" and names the eventual report
      burst = { ...click, count: 1 };
      return null;
    }

    burst.count += 1;
    if (burst.count < clicks) return null;

    // qualified: one report per tantrum, capped per session
    const b = burst;
    burst = null;
    cooldownUntil = click.ts + cooldownMs;
    reports += 1;
    if (reports > maxReports) return null;
    return {
      screen: b.screen,
      label: b.label || 'unknown target',
      interactive: !!b.interactive,
      clicks: b.count,
      xPct: b.xPct, yPct: b.yPct,
    };
  }

  return { feed };
}

// ---- DOM installer -------------------------------------------------

const INTERACTIVE_SEL = 'button,a,[role="button"],input,select,textarea,label,summary';

// Human-readable, PII-safe target description: tag + trimmed visible text
// or aria-label (40 chars, whitespace collapsed). NEVER reads input values.
export function describeTarget(el) {
  try {
    if (!el || el.nodeType !== 1) return 'page background';
    const tag = (el.tagName || '?').toLowerCase();
    let text = el.getAttribute && (el.getAttribute('aria-label') || '');
    if (!text && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
      text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    }
    text = String(text || '').slice(0, 40).trim();
    return text ? `${tag} "${text}"` : `<${tag}>`;
  } catch (e) { return 'unknown target'; }
}

let installed = false;
let mods = null; // { captureError, getErrorContext, trackUmami } once lazy-load resolves

export function installRageClickCapture() {
  if (installed || typeof document === 'undefined' || typeof window === 'undefined') return;
  installed = true;

  // Lazy deps: errorlog pulls in storage.js (import.meta.env at module
  // level), so it must not be a static import of this module.
  try {
    Promise.all([import('./errorlog.js'), import('./umami.js')]).then(([e, u]) => {
      mods = { captureError: e.captureError, getErrorContext: e.getErrorContext, trackUmami: u.trackUmami };
    }).catch(() => {});
  } catch (e) { /* reporting stays off; detector harmlessly idle */ }

  const detector = createRageDetector();

  try {
    document.addEventListener('pointerdown', (e) => {
      try {
        if (!mods || !e.isTrusted) return; // deps still loading, or synthetic event
        const screen = (mods.getErrorContext() || {}).screen;
        if (!screen) return; // pre-boot / unattributable
        const target = e.target && e.target.nodeType === 1 ? e.target : null;
        const control = target && target.closest ? target.closest(INTERACTIVE_SEL) : null;
        const vw = window.innerWidth || 1;
        const vh = window.innerHeight || 1;
        const ev = detector.feed({
          x: e.clientX, y: e.clientY, ts: Date.now(), screen,
          interactive: !!control,
          label: describeTarget(control || target),
          xPct: Math.round((e.clientX / vw) * 100),
          yPct: Math.round((e.clientY / vh) * 100),
        });
        if (ev) reportRage(ev, vw, vh);
      } catch (err) { /* detection must never break the app */ }
    }, { passive: true, capture: true });
  } catch (e) { /* ignore */ }
}

function reportRage(ev, vw, vh) {
  try {
    const kind = ev.interactive ? 'unresponsive control' : 'dead zone';
    // Message names the group: screen + target (errorlog normalize() strips
    // digits, so coordinate noise can never split groups).
    const message = `[UX] Rage click on ${ev.screen}: ${ev.label} (${kind})`;
    // Detail rides the sampleStack field; the "at ..." line becomes the
    // group's stackTop in the admin card.
    const detail = [
      'rage-click detail',
      `at ${ev.label} [${ev.screen}]`,
      `clicks in burst: ${ev.clicks}`,
      `target kind: ${kind}`,
      `position: ${ev.xPct}%, ${ev.yPct}% of ${vw}x${vh} viewport`,
    ].join('\n');
    mods.captureError(message, { source: 'ux', severity: 'ux', stack: detail, screen: ev.screen });
    mods.trackUmami('rage-click', { screen: ev.screen });
  } catch (e) { /* never throw */ }
}
