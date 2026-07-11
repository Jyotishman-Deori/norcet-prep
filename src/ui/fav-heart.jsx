// =====================================================================
// src/ui/fav-heart.jsx  (FAV — the heart in every favoritable TopBar)
// Tap = heart pops + saves; tap again = deflates + removes.
// Favourites is ALWAYS ON (the old Settings on/off toggle and the Home strip
// it gated are gone), so the heart is always shown and hearted sections appear
// straight away on the Favourites screen, reached from the top-bar / tab heart.
// Self-contained: reads/writes lib/favorites.js and stays in sync with the
// manage screen via the 'norcet:favs' window event.
// =====================================================================
import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { isFavoritable, loadFavs, toggleFav } from '../lib/favorites.js';
import { Tip } from './tooltip.jsx';

export default function FavHeart({ favId, inline = false, size = 18, emptyColor }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const profileId = (profile && profile.id) || 'guest';
  const [isFav, setIsFav] = useState(false);
  const [anim, setAnim] = useState(null);       // 'fill' | 'unfill'

  useEffect(() => {
    let alive = true;
    loadFavs(profileId).then(f => {
      if (!alive) return;
      setIsFav(f.order.includes(favId));
    }).catch(() => {});
    const onFavs = (e) => {
      const f = e.detail;
      if (!f) return;
      setIsFav(f.order.includes(favId));
    };
    window.addEventListener('norcet:favs', onFavs);
    return () => { alive = false; window.removeEventListener('norcet:favs', onFavs); };
  }, [profileId, favId]);

  if (!isFavoritable(favId)) return null;

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
    const { added } = await toggleFav(profileId, favId);
    setIsFav(added);
  };

  return (
    <Tip text={isFav ? 'In your favourites: tap to remove' : 'Add this section to your favourites for one-tap access'}>
      <button onClick={(e) => { if (inline) { e.stopPropagation(); e.preventDefault(); } onTap(); }}
              aria-pressed={isFav}
              aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
              className={"no-tap-highlight rounded-full active:bg-black/5 flex-shrink-0 " + (inline ? 'p-1.5' : 'p-2')}>
        <span className={"inline-block " + (anim === 'fill' ? 'heart-spring' : '')}
              style={{ lineHeight: 0 }}>
          <Heart size={inline ? 14 : size}
                 fill={isFav ? '#E0245E' : 'transparent'}
                 strokeWidth={2.2}
                 style={{
                   // Empty = TRANSPARENT interior with just the outline, so in dark
                   // mode it no longer looks pre-filled. Filled = pink. 'transparent'
                   // (not 'none') is a real colour, so the fill still animates
                   // smoothly when favouriting/unfavouriting.
                   color: isFav ? '#E0245E' : (emptyColor || T.muted),
                   transition: 'color .28s ease, fill .3s ease',
                 }} />
        </span>
      </button>
    </Tip>
  );
}
