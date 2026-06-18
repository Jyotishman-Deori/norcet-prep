// =====================================================================
// src/ui/fav-heart.jsx  (FAV — the heart in every favoritable TopBar)
// Tap = heart pops + saves; tap again = deflates + removes. ALWAYS saves,
// even while the Home Favourites strip is OFF — in that case a subtle
// bottom toast explains where the magic happens ("turn it on in Settings"),
// shown at most once per session so it nudges without nagging.
// Self-contained: reads/writes lib/favorites.js and stays in sync with the
// strip + manage screen via the 'norcet:favs' window event.
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { isFavoritable, loadFavs, toggleFav } from '../lib/favorites.js';
import { Tip } from './tooltip.jsx';

let toastShownThisSession = false;

export default function FavHeart({ favId, inline = false, size = 18 }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const profileId = (profile && profile.id) || 'guest';
  const [isFav, setIsFav] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [anim, setAnim] = useState(null);       // 'pop' | 'deflate'
  const [toast, setToast] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    loadFavs(profileId).then(f => {
      if (!alive) return;
      setIsFav(f.order.includes(favId));
      setEnabled(f.enabled);
    }).catch(() => {});
    const onFavs = (e) => {
      const f = e.detail;
      if (!f) return;
      setIsFav(f.order.includes(favId));
      setEnabled(f.enabled);
    };
    window.addEventListener('norcet:favs', onFavs);
    return () => { alive = false; window.removeEventListener('norcet:favs', onFavs); };
  }, [profileId, favId]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  if (!isFavoritable(favId)) return null;
  // #5 — hearts are only visible/interactive when the Favourites feature is
  // enabled in Settings. Off → no heart anywhere (cards, sidebar, TopBar).
  // The 'norcet:favs' listener above keeps `enabled` live, so toggling it on
  // in Settings makes every heart reappear immediately.
  if (!enabled) return null;

  const onTap = async () => {
    // Premium micro-interaction (issues round): FILLING springs — subtle
    // compress, colour fill, gentle 1.08 overshoot, settle (CSS .heart-spring,
    // ~340ms). UNFILLING never bounces — the colour simply fades back to the
    // white-interior outline via the SVG fill/stroke transitions below.
    const filling = !isFav;
    setAnim(filling ? 'fill' : 'unfill');
    if (filling) {
      // precisely-timed light haptic at the moment the fill begins
      try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); } catch (e) {}
    }
    const { favs, added } = await toggleFav(profileId, favId);
    setIsFav(added);
    setEnabled(favs.enabled);
    // Subtle nudge: hearted something while the strip is OFF → tell them
    // (once per session) where to see the effect.
    if (added && !favs.enabled && !toastShownThisSession) {
      toastShownThisSession = true;
      setToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(false), 3800);
    }
  };

  return (
    <>
      <Tip text={isFav ? 'In your favourites — tap to remove' : 'Add this section to your favourites for one-tap access from home'}>
      <button onClick={(e) => { if (inline) { e.stopPropagation(); e.preventDefault(); } onTap(); }}
              aria-pressed={isFav}
              aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
              className={"no-tap-highlight rounded-full active:bg-black/5 flex-shrink-0 " + (inline ? 'p-1.5' : 'p-2')}>
        <span className={"inline-block " + (anim === 'fill' ? 'heart-spring' : '')}
              style={{ lineHeight: 0 }}>
          <Heart size={inline ? 14 : size}
                 fill={isFav ? '#E0245E' : '#FFFFFF'}
                 strokeWidth={2.2}
                 style={{
                   color: isFav ? '#E0245E' : T.muted,
                   // fluid, flicker-free: colour + fill transition together;
                   // unfavourite is a graceful fade with zero bounce.
                   transition: 'color .28s ease, fill .3s ease',
                 }} />
        </span>
      </button>
      </Tip>

      {toast && (
        <div className="exit-snack-in fixed left-1/2 z-[95] px-4 py-3 rounded-2xl flex items-center gap-2.5"
             style={{
               bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
               transform: 'translateX(-50%)',
               background: 'rgba(15, 5, 25, 0.9)',
               boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
               maxWidth: 'min(92vw, 380px)',
               pointerEvents: 'none',
             }}
             role="status" aria-live="polite">
          <Heart size={14} fill="#E0245E" style={{ color: '#E0245E', flexShrink: 0 }} />
          <span style={{ color: '#FFF', fontSize: 12.5, lineHeight: 1.45 }}>
            Saved to Favourites — turn on the <b>Favourites section</b> in Settings to see it on your home screen
          </span>
        </div>
      )}
    </>
  );
}
