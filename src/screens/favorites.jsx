// =====================================================================
// src/screens/favorites.jsx  (FAV — honeycomb Favourites section, reworked)
// The dedicated Favourites SECTION (launched from its Home card, like Drill
// Tests): an n-row × 3-column honeycomb of premium tiles — hue-gradient
// icon bubble, soft glow, label — in the user's priority order, with a
// staggered pop-in entrance and spring presses. Tap a tile → straight into
// that feature.
//
// EDIT MODE (reworked): tap "Edit" and the grid starts a gentle iOS-style
// JIGGLE; each tile grows an × badge (remove, with a shrink-out) and
// reordering is tap-to-move — tap a tile to pick it up (it lifts + glows),
// then tap the tile whose spot it should take; everything reflows with a
// smooth settle. Haptic ticks on pick/drop. Order saves instantly (local +
// shared admin mirror) and the Home card follows live.
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { Check, Heart, Pencil, Plus, X } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { TopBar } from '../ui/primitives.jsx';
import EmptyState from '../ui/empty-state.jsx';
import { favSection, loadFavs, removeFav, setFavOrder } from '../lib/favorites.js';
import { FavIcon } from '../ui/fav-icons.jsx';
import { Tip } from '../ui/tooltip.jsx';

const buzz = (ms) => { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

function FavoritesScreen({ onBack, onNavigate, startInEdit = false }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const profileId = (profile && profile.id) || 'guest';
  const [favs, setFavs] = useState(null);
  const [editing, setEditing] = useState(!!startInEdit);
  const [picked, setPicked] = useState(null);     // tile id "lifted" for reorder
  const [removing, setRemoving] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    loadFavs(profileId).then(f => { if (alive) setFavs(f); }).catch(() => {});
    const onFavs = (e) => { if (e.detail) setFavs(e.detail); };
    window.addEventListener('norcet:favs', onFavs);
    return () => { alive = false; window.removeEventListener('norcet:favs', onFavs); };
  }, [profileId]);

  const sections = favs ? favs.order.map(favSection).filter(Boolean) : [];

  const tapTile = (id) => {
    if (!editing) { buzz(8); onNavigate({ screen: id }); return; }
    // edit mode: tap-to-move
    if (!picked) { setPicked(id); buzz(10); return; }
    if (picked === id) { setPicked(null); return; }
    const order = [...favs.order];
    const from = order.indexOf(picked);
    const to = order.indexOf(id);
    if (from < 0 || to < 0) { setPicked(null); return; }
    order.splice(from, 1);
    order.splice(to, 0, picked);
    setFavs(f => ({ ...f, order }));
    setPicked(null);
    buzz(14);
    setFavOrder(profileId, order);
  };

  const drop = (id) => {
    setRemoving(prev => new Set(prev).add(id));
    buzz(8);
    setTimeout(async () => {
      const f = await removeFav(profileId, id);
      setFavs(f);
      setRemoving(prev => { const n = new Set(prev); n.delete(id); return n; });
      if (picked === id) setPicked(null);
    }, 240);
  };

  if (!favs) return <div className="anim-fadeup"><TopBar title="Favourites" onBack={onBack} /></div>;

  return (
    <div className="anim-fadeup">
      <TopBar title="Favourites" onBack={onBack} feedback={{ screen: 'Favourites' }}
              right={sections.length > 0 ? (
                <Tip text={editing ? 'Done editing' : 'Reorder tiles (tap to move) or remove them'}>
                <button onClick={() => { setEditing(e => !e); setPicked(null); buzz(8); }}
                        className="no-tap-highlight flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full active:scale-95 transition-transform flex-shrink-0"
                        style={{ background: editing ? '#E0245E' : T.surfaceWarm,
                                 border: `1px solid ${editing ? '#E0245E' : T.border}`,
                                 color: editing ? '#FFF' : T.inkSoft }}>
                  {editing ? <Check size={14} /> : <Pencil size={13} />}
                  <span className="text-xs font-medium">{editing ? 'Done' : 'Edit'}</span>
                </button>
                </Tip>
              ) : null} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">
        <div className="px-1 mb-4">
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>
            One stop for everything you love
          </div>
          <div className="text-sm leading-relaxed" style={{ color: T.muted }}>
            {editing
              ? 'Tap a tile to pick it up, then tap where it should go. Use \u00d7 to remove. Priority #1 is top-left.'
              : <>Tap the <Heart size={12} fill="#E0245E" style={{ color: '#E0245E', display: 'inline', verticalAlign: '-1px' }} /> beside any section's title to collect it here.</>}
          </div>
        </div>

        {sections.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Nothing hearted yet"
            text="Open Drill Tests or the menu and tap the heart beside any section's title — Quick Test, Stats, Bookmarks, Dosage and more. They land here, in your order."
            actionLabel="Browse Drill Tests"
            onAction={() => onNavigate && onNavigate({ screen: 'drill-tests' })} />
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {sections.map((s, i) => {
              const isPicked = picked === s.id;
              const isRemoving = removing.has(s.id);
              return (
                <Tip key={s.id} title={s.label} text={s.blurb} disabled={editing}>
                <div role="button" tabIndex={0}
                     onClick={() => tapTile(s.id)}
                     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapTile(s.id); } }}
                     className={
                       'no-tap-highlight cursor-pointer rounded-2xl relative overflow-visible fav-tile ' +
                       (isRemoving ? 'fav-tile-out ' : 'fav-tile-in ') +
                       (editing && !isPicked ? 'fav-jiggle ' : '') +
                       (isPicked ? 'fav-picked ' : '')
                     }
                     style={{
                       background: `linear-gradient(150deg, ${s.hue}1C 0%, ${T.surface} 60%)`,
                       border: `1.5px solid ${isPicked ? s.hue : s.hue + '40'}`,
                       boxShadow: isPicked ? `0 8px 24px ${s.hue}50` : `0 3px 12px ${s.hue}1C`,
                       animationDelay: isRemoving ? '0ms' : `${Math.min(i, 11) * 55}ms`,
                       aspectRatio: '1 / 1.06',
                     }}>
                  {/* priority number (edit mode) */}
                  {editing && (
                    <span className="absolute top-1.5 left-2 text-[9px] font-bold tabular-nums"
                          style={{ color: s.hue, opacity: 0.8 }}>#{i + 1}</span>
                  )}
                  {/* remove badge (edit mode) */}
                  {editing && (
                    <button onClick={(e) => { e.stopPropagation(); drop(s.id); }}
                            aria-label={`Remove ${s.label}`}
                            className="no-tap-highlight absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center z-10 active:scale-90 transition"
                            style={{ background: T.ink, color: T.bg, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
                      <X size={11} />
                    </button>
                  )}
                  <div className="h-full flex flex-col items-center justify-center gap-2 px-1.5 py-2 text-center">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                         style={{ background: `linear-gradient(135deg, ${s.hue}, ${s.hue}B3)`, boxShadow: `0 4px 12px ${s.hue}55` }}>
                      <FavIcon name={s.icon} size={19} />
                    </div>
                    <div className="text-[11px] font-semibold leading-tight" style={{ color: T.ink }}>{s.label}</div>
                  </div>
                </div>
                </Tip>
              );
            })}
            {/* "+ add more" ghost tile (issues round): completes the row for
                small collections so the grid never trails into bare
                whitespace, and doubles as the add-more prompt. */}
            {!editing && sections.length % 3 !== 0 && (
              <div role="button" tabIndex={0}
                   onClick={() => onNavigate && onNavigate({ screen: 'drill-tests' })}
                   onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate && onNavigate({ screen: 'drill-tests' }); } }}
                   className="no-tap-highlight cursor-pointer rounded-2xl fav-tile-in flex flex-col items-center justify-center gap-1.5 px-1.5 py-2 text-center"
                   style={{ border: `1.5px dashed ${T.border}`, background: T.surfaceWarm,
                            aspectRatio: '1 / 1.06',
                            animationDelay: `${Math.min(sections.length, 11) * 55}ms` }}>
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
                     style={{ background: T.surface, border: `1.5px dashed ${T.border}` }}>
                  <Plus size={16} style={{ color: T.muted }} />
                </div>
                <div className="text-[10px] font-medium leading-tight" style={{ color: T.muted }}>Heart more sections</div>
              </div>
            )}
          </div>
        )}

        {sections.length > 0 && !editing && (
          <div className="text-[11px] leading-relaxed mt-4 px-2 text-center" style={{ color: T.muted }}>
            Your order is the priority — top-left first. Tap Edit to rearrange or remove.
          </div>
        )}

        {/* The home-screen on/off toggle was REMOVED from this screen — the
            single source of truth is Settings → Favourites (issues round). */}
      </div>
    </div>
  );
}

export default FavoritesScreen;
