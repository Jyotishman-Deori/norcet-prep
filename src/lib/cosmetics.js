// =====================================================================
// src/lib/cosmetics.js  (Level Up P3 — cosmetic avatar frames)
// Pure catalog + helpers for collectible profile frames. Frames are won from
// Supply Crates (rare/epic tiers), owned in data.levelup.cosmetics[], and one is
// equipped via data.levelup.frame. Cosmetic ONLY — no gameplay effect. The
// visual (a gradient ring + soft glow around the avatar) is rendered by
// ui/framed-avatar.jsx. NO real-money items.
// =====================================================================

// id -> { name, rarity, ring:[from,to] | null, glow }. 'none' = the default.
export const FRAMES = {
  none:   { id: 'none',   name: 'No frame', rarity: 'base',   ring: null,                  glow: null },
  ember:  { id: 'ember',  name: 'Ember',    rarity: 'common', ring: ['#FB923C', '#B45309'], glow: 'rgba(249,115,22,0.5)' },
  frost:  { id: 'frost',  name: 'Frost',    rarity: 'common', ring: ['#38BDF8', '#1D4ED8'], glow: 'rgba(56,189,248,0.5)' },
  forest: { id: 'forest', name: 'Forest',   rarity: 'common', ring: ['#34D399', '#15803D'], glow: 'rgba(52,211,153,0.45)' },
  neon:   { id: 'neon',   name: 'Neon',     rarity: 'rare',   ring: ['#F472B6', '#7C3AED'], glow: 'rgba(244,114,182,0.55)' },
  royal:  { id: 'royal',  name: 'Royal',    rarity: 'rare',   ring: ['#818CF8', '#3730A3'], glow: 'rgba(129,140,248,0.55)' },
  gold:   { id: 'gold',   name: 'Gold',     rarity: 'epic',   ring: ['#FCD34D', '#B45309'], glow: 'rgba(252,211,77,0.6)' },
};

// All collectible (non-default) frame ids.
export const FRAME_IDS = Object.keys(FRAMES).filter(id => id !== 'none');

export function frameDef(id) {
  return FRAMES[id] || FRAMES.none;
}

// Sanitise a stored equipped-frame id.
export function normalizeFrame(id) {
  return FRAMES[id] ? id : 'none';
}

// Frames the user hasn't won yet (candidates for a crate drop). `owned` is the
// data.levelup.cosmetics array.
export function unownedFrames(owned) {
  const have = new Set(Array.isArray(owned) ? owned : []);
  return FRAME_IDS.filter(id => !have.has(id));
}
