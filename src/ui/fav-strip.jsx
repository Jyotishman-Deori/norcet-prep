// =====================================================================
// src/ui/fav-strip.jsx  (FAV — the Favourites ENTRY CARD on Home)
// Reworked per feedback: instead of an inline strip of cards, Favourites is
// now a SECTION of its own — one premium card on Home (just like Drill
// Tests) that launches the dedicated honeycomb screen. Renders ONLY when
// the user has turned the section on in Settings (empty list still shows
// the card so the section is discoverable once enabled). Self-syncing via
// the 'norcet:favs' window event.
// =====================================================================
import React, { useEffect, useState } from 'react';
import { ChevronRight, Heart } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { favSection, loadFavs } from '../lib/favorites.js';
import { FavIcon } from './fav-icons.jsx';
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

  if (!favs || !favs.enabled) return null;
  const top = favs.order.slice(0, 4).map(favSection).filter(Boolean);

  return (
    <Tip title="Favourites" text="Your one-stop shortcuts \u2014 pin any section here with its heart. Tap to open and reorder them; your top picks also appear right here on Home.">
    <div role="button" tabIndex={0}
         onClick={() => onNavigate({ screen: 'favorites' })}
         onContextMenu={(e) => e.preventDefault()}
         onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ screen: 'favorites' }); } }}
         className="no-tap-highlight pressable press-safe cursor-pointer rounded-2xl p-4 mb-4 relative overflow-hidden"
         style={{
           background: 'linear-gradient(135deg, #E0245E, #9C1A57 70%)',
           boxShadow: '0 6px 18px rgba(224,36,94,0.30)',
         }}>
      {/* soft glow accent */}
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.22), transparent 70%)' }} aria-hidden="true" />
      <div className="flex items-center gap-3 mb-2.5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'rgba(255,255,255,0.18)' }}>
          <Heart size={20} color="#FFF" fill="#FFF" className="fav-beat" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-base font-semibold mb-0.5" style={{ color: '#FFF' }}>Favourites</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {favs.order.length === 0
              ? 'Tap the hearts around the app to fill this'
              : `${favs.order.length} favourite${favs.order.length === 1 ? '' : 's'} \u00b7 your one-stop section`}
          </div>
        </div>
        <ChevronRight size={20} color="rgba(255,255,255,0.85)" />
      </div>
      {/* mini icon row of the top picks (mirrors the Drill Tests card style) */}
      {top.length > 0 && (
        <div className="flex items-center gap-3 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}>
          {top.map(sct => (
            <span key={sct.id} style={{ lineHeight: 0, opacity: 0.92 }}>
              <FavIcon name={sct.icon} size={15} color="rgba(255,255,255,0.9)" />
            </span>
          ))}
          {favs.order.length > 4 && (
            <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>+{favs.order.length - 4}</span>
          )}
        </div>
      )}
    </div>
    </Tip>
  );
}
