// =====================================================================
// src/ui/tooltip.jsx  (TIP — hold-for-info / hover-for-info system)
// Desktop-style tooltips for everyone: HOVER an icon/button/section on a
// PC (450ms intent delay) or LONG-PRESS it on a phone (480ms hold + a
// light haptic tick) and a premium glass bubble explains what it does.
//
// ONE host, ONE bubble. <TipHost/> renders once at the app root (same
// transformed-ancestor reasoning as FeedbackHost: position:fixed must be
// viewport-relative). <Tip text="…">{element}</Tip> wraps any trigger with
// a display:contents shell, so LAYOUT IS UNTOUCHED — flex rows, grids and
// cards render exactly as before; events simply bubble through the shell.
//
// Bug-proofing baked in:
//   • touchmove >10px cancels the hold (scrolling never triggers tips)
//   • the click that follows a long-press is SWALLOWED (capture-phase),
//     so holding a button never accidentally activates it
//   • the native context menu is suppressed only while a hold is live
//   • mouseenter within 700ms of a touch is ignored (synthetic hover)
//   • bubble auto-flips above/below by available space, clamps to the
//     viewport, and the arrow keeps tracking the anchor's centre
//   • any scroll / resize / outside tap / Escape hides it instantly;
//     touch tips also linger 2.6s after the finger lifts, then fade
//   • prefers-reduced-motion: no spring, instant appear
// =====================================================================
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

// ---- module channel (Tip -> TipHost) -----------------------------------
let _show = null, _hide = null, _release = null;
let _lastTouchTs = 0;

export function hideTip() { if (_hide) _hide(); }

// ---- the wrapper --------------------------------------------------------
export function Tip({ text, title = null, children, holdMs = 480, hoverMs = 450, disabled = false }) {
  const ref = useRef(null);
  const holdTimer = useRef(null);
  const hoverTimer = useRef(null);
  const firedRef = useRef(false);    // a long-press tip is showing → swallow the click
  const holdingRef = useRef(false);  // a hold timer is live or fired → block context menu
  const startPt = useRef(null);

  useEffect(() => () => {            // unmount: never leak timers
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  const anchorRect = () => {
    const el = ref.current && ref.current.firstElementChild;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return (r.width === 0 && r.height === 0) ? null : r;
  };
  const show = (touch) => {
    const r = anchorRect();
    if (!r || !_show || !text) return;
    _show({ rect: { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom }, text, title, touch });
  };

  if (disabled || !text) return children;

  // -- touch: long-press to show --
  const onTouchStart = (e) => {
    _lastTouchTs = Date.now();
    const t = e.touches && e.touches[0]; if (!t) return;
    startPt.current = { x: t.clientX, y: t.clientY };
    firedRef.current = false;
    holdingRef.current = true;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      firedRef.current = true;
      try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12); } catch (err) {}
      show(true);
    }, holdMs);
  };
  const onTouchMove = (e) => {
    const t = e.touches && e.touches[0];
    if (!t || !startPt.current) return;
    const moved = Math.hypot(t.clientX - startPt.current.x, t.clientY - startPt.current.y);
    if (moved > 10) {
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; holdingRef.current = false; }
      if (firedRef.current) { hideTip(); firedRef.current = false; holdingRef.current = false; }
    }
  };
  const onTouchEnd = () => {
    _lastTouchTs = Date.now();
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (firedRef.current && _release) _release();   // start the linger fade
    holdingRef.current = false;
    // firedRef stays true until the trailing click is swallowed below.
  };
  const onContextMenu = (e) => { if (holdingRef.current || firedRef.current) e.preventDefault(); };
  const onClickCapture = (e) => {
    if (firedRef.current) { e.preventDefault(); e.stopPropagation(); firedRef.current = false; }
  };

  // -- mouse: hover-intent to show --
  const onMouseEnter = () => {
    if (Date.now() - _lastTouchTs < 700) return;    // synthetic hover after touch
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => { hoverTimer.current = null; show(false); }, hoverMs);
  };
  const onMouseLeave = () => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    hideTip();
  };
  const onMouseDownCapture = () => {                 // clicking = intent; tip steps aside
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    if (Date.now() - _lastTouchTs >= 700) hideTip();
  };

  return (
    <div ref={ref} style={{ display: 'contents' }}
         onTouchStart={onTouchStart} onTouchMove={onTouchMove}
         onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
         onContextMenu={onContextMenu} onClickCapture={onClickCapture}
         onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
         onMouseDownCapture={onMouseDownCapture}>
      {children}
    </div>
  );
}

// ---- the host (render ONCE at the app root) ------------------------------
const W_MAX = 264;

export function TipHost() {
  const [tip, setTip] = useState(null);              // { rect, text, title, touch }
  const [pos, setPos] = useState(null);              // { top, left, arrowLeft, below }
  const bubbleRef = useRef(null);
  const lingerTimer = useRef(null);

  useEffect(() => {
    _show = (payload) => {
      if (lingerTimer.current) { clearTimeout(lingerTimer.current); lingerTimer.current = null; }
      setPos(null);                                  // re-measure for the new anchor
      setTip(payload);
    };
    _hide = () => {
      if (lingerTimer.current) { clearTimeout(lingerTimer.current); lingerTimer.current = null; }
      setTip(null); setPos(null);
    };
    _release = () => {                               // finger lifted → linger, then fade
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
      lingerTimer.current = setTimeout(() => { setTip(null); setPos(null); lingerTimer.current = null; }, 2600);
    };
    return () => { _show = _hide = _release = null; if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, []);

  // Two-pass placement: render invisibly, measure, then position + flip.
  useLayoutEffect(() => {
    if (!tip || !bubbleRef.current) return;
    const b = bubbleRef.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const cx = tip.rect.left + tip.rect.width / 2;
    let left = Math.min(Math.max(cx - b.width / 2, 10), Math.max(10, vw - b.width - 10));
    let top = tip.rect.top - b.height - 10;
    let below = false;
    if (top < 10) { top = tip.rect.bottom + 10; below = true; }
    if (below && top + b.height > vh - 10) top = Math.max(10, vh - b.height - 10);
    const arrowLeft = Math.min(Math.max(cx - left, 16), b.width - 16);
    setPos({ top, left, arrowLeft, below });
  }, [tip]);

  // While open: any scroll, resize, outside press, or Escape dismisses.
  useEffect(() => {
    if (!tip) return;
    const hide = () => { if (_hide) _hide(); };
    const onKey = (e) => { if (e.key === 'Escape') hide(); };
    const onPress = (e) => {
      if (bubbleRef.current && bubbleRef.current.contains(e.target)) return;
      hide();
    };
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener('resize', hide);
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress, true);
    return () => {
      window.removeEventListener('scroll', hide, { capture: true });
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress, true);
    };
  }, [tip]);

  if (!tip) return null;
  const measured = !!pos;
  return (
    <div ref={bubbleRef} role="tooltip"
         className={measured ? 'tip-in' : ''}
         style={{
           position: 'fixed', zIndex: 96,
           top: measured ? pos.top : -9999,
           left: measured ? pos.left : -9999,
           maxWidth: `min(${W_MAX}px, calc(100vw - 20px))`,
           visibility: measured ? 'visible' : 'hidden',
           transformOrigin: measured ? `${pos.arrowLeft}px ${pos.below ? '0%' : '100%'}` : 'center',
           // NOTE: no backdrop-filter here on purpose. blur() behind the
           // bubble triggered GPU compositing corruption (garbage stripes
           // across the screen) on some Android devices during long-press.
           // The gradient is already ~97% opaque, so nothing is lost.
           background: 'linear-gradient(160deg, rgba(38,20,52,0.985), rgba(15,8,26,0.985))',
           border: '1px solid rgba(255,255,255,0.14)',
           borderRadius: 14,
           boxShadow: '0 10px 32px rgba(0,0,0,0.38), 0 0 0 0.5px rgba(255,255,255,0.06) inset',
           padding: '10px 13px',
           pointerEvents: 'none',
         }}>
      {tip.title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Info size={11} style={{ color: '#D8B4FE', flexShrink: 0 }} />
          <span style={{ color: '#FFF', fontSize: 12, fontWeight: 600, letterSpacing: 0.2 }}>{tip.title}</span>
        </div>
      )}
      <div style={{ color: 'rgba(255,255,255,0.86)', fontSize: 12, lineHeight: 1.5 }}>{tip.text}</div>
      {/* arrow — tracks the anchor centre */}
      {measured && (
        <div aria-hidden="true"
             style={{
               position: 'absolute', left: pos.arrowLeft - 5,
               [pos.below ? 'top' : 'bottom']: -5,
               width: 10, height: 10, transform: 'rotate(45deg)',
               background: pos.below ? 'rgba(38,20,52,0.985)' : 'rgba(15,8,26,0.985)',
               borderLeft: pos.below ? '1px solid rgba(255,255,255,0.14)' : 'none',
               borderTop: pos.below ? '1px solid rgba(255,255,255,0.14)' : 'none',
               borderRight: pos.below ? 'none' : '1px solid rgba(255,255,255,0.14)',
               borderBottom: pos.below ? 'none' : '1px solid rgba(255,255,255,0.14)',
             }} />
      )}
    </div>
  );
}
