// =====================================================================
// src/ui/pull-to-refresh.jsx  (Feature F-B)
// ONE global pull-to-refresh, mounted once in App. The app scrolls at the
// window level, so a window-listening overlay behaves the same as wrapping
// every screen — without touching each screen's markup (keeps the feel
// identical everywhere and the risk contained).
//
// Engages only when: not disabled, scrolled to the very top, a single touch,
// and the gesture didn't start inside a [data-no-ptr] surface (custom-gesture
// screens opt out). On release past threshold: soft sound (on release only) +
// haptic + onRefresh(), with a minimum spinner duration so it always feels
// deliberate. preventDefault is called ONLY while actively pulling down at the
// top, so normal scrolling is never blocked.
// =====================================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RotateCw, Loader2 } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { playRefreshSound, loadSoundEnabled } from '../lib/sound.js';

const THRESHOLD = 70;   // px of (resisted) pull needed to trigger
const MAX = 110;        // max indicator travel
const RESIST = 0.5;     // finger-to-indicator ratio (rubber-band feel)
const DEADZONE = 6;     // px before a pull is recognised (lets taps through)
const MIN_SPIN = 600;   // ms — minimum visible spinner time

export default function PullToRefresh({ onRefresh, disabled = false }) {
  const { theme: T } = useTheme();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const st = useRef({ armed: false, pulling: false, startY: 0, startX: 0 });
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const disabledRef = useRef(disabled);
  pullRef.current = pull;
  disabledRef.current = disabled;

  useEffect(() => { loadSoundEnabled(); }, []);

  const trigger = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setPull(THRESHOLD);
    try { playRefreshSound(); } catch (e) {}
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15); } catch (e) {}
    const t0 = Date.now();
    try { if (onRefresh) await onRefresh(); } catch (e) {}
    const elapsed = Date.now() - t0;
    if (elapsed < MIN_SPIN) { await new Promise(r => setTimeout(r, MIN_SPIN - elapsed)); }
    setRefreshing(false);
    refreshingRef.current = false;
    setPull(0);
    st.current.armed = false;
    st.current.pulling = false;
  }, [onRefresh]);

  useEffect(() => {
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 0;

    const onStart = (e) => {
      if (disabledRef.current || refreshingRef.current) { st.current.armed = false; return; }
      if (!e.touches || e.touches.length !== 1) { st.current.armed = false; return; }
      const t = e.touches[0];
      if (t.target && t.target.closest && t.target.closest('[data-no-ptr]')) { st.current.armed = false; return; }
      st.current.startY = t.clientY;
      st.current.startX = t.clientX;
      st.current.armed = atTop();
      st.current.pulling = false;
    };

    const onMove = (e) => {
      const s = st.current;
      if (!s.armed || refreshingRef.current) return;
      if (!e.touches || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - s.startY;
      if (dy <= 0) { if (!s.pulling) s.armed = false; return; } // upward → normal scroll
      if (!atTop()) { s.armed = false; if (s.pulling) { s.pulling = false; setPull(0); } return; }
      // Once movement is meaningful, only engage if it's a downward (vertical-
      // dominant) drag — otherwise it's a horizontal swipe (tabs/charts), let go.
      if (!s.pulling && dy > DEADZONE) {
        const dx = Math.abs(e.touches[0].clientX - s.startX);
        if (dx > dy) { s.armed = false; return; }
        s.pulling = true;
      }
      if (s.pulling) {
        if (e.cancelable) e.preventDefault();
        setPull(Math.min(MAX, dy * RESIST));
      }
    };

    const onEnd = () => {
      const s = st.current;
      if (!s.armed) return;
      if (s.pulling && pullRef.current >= THRESHOLD) { trigger(); }
      else { setPull(0); s.armed = false; s.pulling = false; }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [trigger]);

  const progress = Math.min(pull / THRESHOLD, 1);
  const ready = pull >= THRESHOLD;
  const travel = refreshing ? THRESHOLD : pull;
  if (pull <= 0 && !refreshing) return null;

  return (
    <div aria-hidden="true"
         style={{
           position: 'fixed', top: 0, left: 0, right: 0,
           display: 'flex', justifyContent: 'center',
           pointerEvents: 'none', zIndex: 60,
           transform: `translateY(${travel - 4}px)`,
           transition: (st.current.pulling && !refreshing) ? 'none' : 'transform 0.25s ease',
         }}>
      <div style={{
        marginTop: 6, width: 38, height: 38, borderRadius: '50%',
        background: T.surface, border: `1px solid ${T.border}`,
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: Math.min(1, 0.3 + progress),
      }}>
        {refreshing
          ? <Loader2 size={18} className="animate-spin" style={{ color: T.primary }} />
          : <RotateCw size={18} style={{ color: ready ? T.primary : T.muted, transform: `rotate(${progress * 270}deg)`, transition: 'color 0.15s' }} />}
      </div>
    </div>
  );
}
