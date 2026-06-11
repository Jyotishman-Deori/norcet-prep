// =====================================================================
// src/screens/favorites.jsx  (FAV — "Your Favourites" manage screen)
// The one-stop home for everything the user hearted: full premium cards
// (icon bubble + hue glow + blurb), opened with a tap. PRIORITY is the
// user's to shape — up/down chevrons reorder with a smooth FLIP-style
// settle (mobile-friendly; no fiddly long-press drag), #1 wears a "TOP"
// badge, and the broken-heart button removes with the row fade-out.
// Order saves instantly (local + shared mirror for admin insight) and the
// Home strip follows it live.
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Heart, HeartCrack, Sparkles } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import EmptyState from '../ui/empty-state.jsx';
import { favSection, loadFavs, removeFav, setFavOrder, setFavEnabled } from '../lib/favorites.js';
import { PremiumFavCard } from '../ui/fav-icons.jsx';

function FavoritesScreen({ onBack, onNavigate, onOpenSettings }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const profileId = (profile && profile.id) || 'guest';
  const [favs, setFavs] = useState(null);
  const [removing, setRemoving] = useState(() => new Set());
  const [movedId, setMovedId] = useState(null);   // brief highlight after a reorder
  const moveTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    loadFavs(profileId).then(f => { if (alive) setFavs(f); }).catch(() => {});
    return () => { alive = false; if (moveTimer.current) clearTimeout(moveTimer.current); };
  }, [profileId]);

  const move = (id, dir) => {
    if (!favs) return;
    const order = [...favs.order];
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setFavs(f => ({ ...f, order }));
    setMovedId(id);
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(6); } catch (e) {}
    if (moveTimer.current) clearTimeout(moveTimer.current);
    moveTimer.current = setTimeout(() => setMovedId(null), 450);
    setFavOrder(profileId, order);
  };

  const drop = (id) => {
    setRemoving(prev => new Set(prev).add(id));
    setTimeout(async () => {
      const f = await removeFav(profileId, id);
      setFavs(f);
      setRemoving(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, 280);
  };

  const flipEnabled = async () => {
    if (!favs) return;
    const f = await setFavEnabled(profileId, !favs.enabled);
    setFavs(f);
  };

  if (!favs) return <div className="anim-fadeup"><TopBar title="Your Favourites" onBack={onBack} /></div>;
  const sections = favs.order.map(favSection).filter(Boolean);

  return (
    <div className="anim-fadeup">
      <TopBar title="Your Favourites" onBack={onBack} feedback={{ screen: 'Favourites' }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">
        <div className="px-1 mb-4">
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>
            One stop for everything you love
          </div>
          <div className="text-sm leading-relaxed" style={{ color: T.muted }}>
            Tap the <Heart size={12} fill="#E0245E" style={{ color: '#E0245E', display: 'inline', verticalAlign: '-1px' }} /> on
            any section to collect it here. Use the arrows to set your priority — #1 leads your home screen strip.
          </div>
        </div>

        {/* strip on/off status — one tap to flip, no trip to Settings needed */}
        <Card className="p-3.5 mb-4 cursor-pointer no-tap-highlight pressable" onClick={flipEnabled}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles size={16} style={{ color: favs.enabled ? '#E0245E' : T.muted }} className="flex-shrink-0" />
              <div className="text-[13px]" style={{ color: T.inkSoft }}>
                {favs.enabled
                  ? 'Showing on your home screen, in this order'
                  : 'Home screen strip is OFF — your hearts are saved, flip this on to show them'}
              </div>
            </div>
            <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                 style={{ background: favs.enabled ? T.success : T.border }}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                   style={{ transform: favs.enabled ? 'translateX(20px)' : 'translateX(0)' }} />
            </div>
          </div>
        </Card>

        {sections.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Nothing hearted yet"
            text="Open any section — Quick Test, Stats, Bookmarks, Dosage Calculation and more — and tap the heart at the top. It lands here, in your order."
            actionLabel="Browse Drill Tests"
            onAction={() => onNavigate && onNavigate({ screen: 'drill-tests' })} />
        ) : (
          <div className="space-y-2.5">
            {sections.map((s, i) => (
              <div key={s.id}
                   className={(removing.has(s.id) ? 'row-fade-out ' : 'seq-item ') + 'transition-transform duration-300'}
                   style={{
                     animationDelay: removing.has(s.id) ? '0ms' : `${Math.min(i, 8) * 80}ms`,
                     transform: movedId === s.id ? 'scale(1.02)' : 'scale(1)',
                   }}>
                <PremiumFavCard section={s}
                                surface={T.surface} ink={T.ink} muted={T.muted}
                                onClick={() => onNavigate({ screen: s.id })}>
                  <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {i === 0 && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full mr-1 uppercase tracking-wider"
                            style={{ background: s.hue, color: '#FFF' }}>Top</span>
                    )}
                    <div className="flex flex-col">
                      <button onClick={() => move(s.id, -1)} disabled={i === 0}
                              aria-label="Move up"
                              className="no-tap-highlight p-1 rounded-md active:bg-black/10"
                              style={{ opacity: i === 0 ? 0.25 : 1 }}>
                        <ChevronUp size={15} style={{ color: T.inkSoft }} />
                      </button>
                      <button onClick={() => move(s.id, 1)} disabled={i === sections.length - 1}
                              aria-label="Move down"
                              className="no-tap-highlight p-1 rounded-md active:bg-black/10"
                              style={{ opacity: i === sections.length - 1 ? 0.25 : 1 }}>
                        <ChevronDown size={15} style={{ color: T.inkSoft }} />
                      </button>
                    </div>
                    <button onClick={() => drop(s.id)}
                            aria-label={`Remove ${s.label} from favourites`}
                            className="no-tap-highlight p-1.5 rounded-full active:bg-black/10 ml-0.5">
                      <HeartCrack size={16} style={{ color: T.muted }} />
                    </button>
                  </div>
                </PremiumFavCard>
              </div>
            ))}
          </div>
        )}

        {sections.length > 0 && (
          <div className="text-[11px] leading-relaxed mt-4 px-2 text-center" style={{ color: T.muted }}>
            Priority #1 appears first on your home screen. Tap a card to open the section.
          </div>
        )}
      </div>
    </div>
  );
}

export default FavoritesScreen;
