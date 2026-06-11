// =====================================================================
// src/ui/fav-strip.jsx  (FAV — the premium Favourites section on Home)
// Renders ONLY when the user has turned the section on in Settings AND has
// at least one favourite — otherwise Home is byte-identical to before.
// Sits above every other Home section: a glowing header row (heart pulse),
// then horizontally-snapping premium cards in the USER'S priority order
// (staggered spring entrance, hue glow, spring press). "Edit" opens the
// manage screen. Self-syncing via the 'norcet:favs' window event, so a
// heart tapped anywhere updates the strip without remounting Home.
// =====================================================================
import React, { useEffect, useState } from 'react';
import { ChevronRight, Heart, Pencil } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { favSection, loadFavs } from '../lib/favorites.js';
import { PremiumFavCard } from './fav-icons.jsx';
import { Tip } from './tooltip.jsx';

export default function FavStrip({ onNavigate }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const profileId = (profile && profile.id) || 'guest';
  const [favs, setFavs] = useState(null);

  useEffect(() => {
    let alive = true;
    loadFavs(profileId).then(f => { if (alive) setFavs(f); }).catch(() => {});
    const onFavs = (e) => { if (e.detail) setFavs(e.detail); };
    window.addEventListener('norcet:favs', onFavs);
    return () => { alive = false; window.removeEventListener('norcet:favs', onFavs); };
  }, [profileId]);

  if (!favs || !favs.enabled || favs.order.length === 0) return null;
  const sections = favs.order.map(favSection).filter(Boolean);

  return (
    <div className="mb-4">
      {/* header row */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <Heart size={13} fill="#E0245E" style={{ color: '#E0245E' }} className="fav-beat" />
          <span className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>
            Your favourites
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#E0245E18', color: '#E0245E' }}>{sections.length}</span>
        </div>
        <button onClick={() => onNavigate({ screen: 'favorites' })}
                className="no-tap-highlight inline-flex items-center gap-1 text-[11px] font-semibold active:scale-95 transition px-2 py-1 rounded-full"
                style={{ color: T.primary, background: T.primary + '10' }}>
          <Pencil size={10} /> Edit
        </button>
      </div>

      {/* horizontally-snapping premium cards, user's priority order */}
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 -mx-4 px-4"
           style={{ scrollbarWidth: 'none', scrollSnapType: 'x proximity' }}>
        {sections.map((s, i) => (
          <Tip key={s.id} title={s.label} text={s.blurb}>
          <PremiumFavCard section={s} compact
                          surface={T.surface} ink={T.ink} muted={T.muted}
                          onClick={() => onNavigate({ screen: s.id })}
                          className="seq-item flex-shrink-0"
                          style={{ width: 168, scrollSnapAlign: 'start', animationDelay: `${Math.min(i, 6) * 90}ms` }}>
            <ChevronRight size={14} style={{ color: s.hue, opacity: 0.7 }} className="flex-shrink-0" />
          </PremiumFavCard>
          </Tip>
        ))}
      </div>
    </div>
  );
}
