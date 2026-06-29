// =====================================================================
// src/lib/favorites.js  (FAV — Favourites system)
// Users heart the sections they use most; an opt-in premium strip on Home
// gives one-tap access in THEIR priority order. The same signal doubles as
// product telemetry for the admin: which sections are loved, which are
// ignored, and how users actually rank them.
//
// THREE STORES:
//   1. LOCAL, per profile (KEY_PREFIXES.FAVORITES + profileId):
//        { enabled: false, order: ['stats', 'quick-setup', …] }
//      `enabled` gates the Home strip (OFF by default — hearts still save).
//      `order` IS the favourite set — membership and priority in one array.
//   2. SHARED `favsec:{sectionId}` → JSON array of profileIds currently
//      hearting that section (helpful-votes pattern; guests never write).
//   3. SHARED `favorder:{profileId}` → that user's order array, so the admin
//      can aggregate average priority rank per section.
//
// Saves dispatch a window event ('norcet:favs') so the Home strip, the
// TopBar hearts, and the manage screen stay in sync without prop drilling.
//
// REGISTRY: only genuinely destination-like sections are favoritable.
// Excluded on purpose: Settings/Notifications/Admin (chrome, not content),
// sections already one tap away on Home (Learn Topic Wise, Knowledge Map,
// the Drill Tests hub itself), and transient flows (quiz, results, editors).
// Drill-test SUB-modes are included — that's the whole point.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEY_PREFIXES } from './keys.js';
import { GUEST_ID } from './profiles.js';
import { trackUmami } from './umami.js';

// id = App nav screen id (tap → onNavigate({ screen: id })).
// icon = key into ui/fav-icons.jsx; hue = fixed accent for the premium card
// gradient (theme-independent, same approach as topicColor).
export const FAV_SECTIONS = [
  { id: 'quick-setup',     label: 'Quick Test',          blurb: '10 questions, zero setup',          icon: 'zap',      hue: '#E8590C' },
  { id: 'topic-select',    label: 'Topic Test',          blurb: 'Drill one subject at a time',       icon: 'target',   hue: '#0B7285' },
  { id: 'mock-setup',      label: 'Mock Test',           blurb: 'Timed exam simulation',             icon: 'timer',    hue: '#5F3DC4' },
  { id: 'advanced-setup',  label: 'Advanced Test',       blurb: 'Negative marking + palette',        icon: 'flask',    hue: '#C2255C' },
  { id: 'dosage',          label: 'Dosage Calculation',  blurb: 'Numeric drug-math drills',          icon: 'syringe',  hue: '#2F9E44' },
  { id: 'previous-papers', label: 'Previous Papers',     blurb: 'Official NORCET PYQs',              icon: 'scroll',   hue: '#E67700' },
  // Interactive drill modes (the gamified "earn coins" simulators). ids match
  // their App nav screen, so a heart in the manage screen routes straight in.
  { id: 'skill-setup',         label: 'Clinical Skill Drill', blurb: 'Order the procedure steps',     icon: 'listordered', hue: '#0E7490' },
  { id: 'icu-monitor',         label: 'ICU Monitor',          blurb: 'Read the rhythm',               icon: 'activity',    hue: '#047857' },
  { id: 'crash-cart',          label: 'Crash Cart',           blurb: 'Grab the right emergency drug',  icon: 'syringe',     hue: '#B91C1C' },
  { id: 'sorter',              label: 'The Sorter',           blurb: 'Sort waste & isolation',         icon: 'recycle',     hue: '#15803D' },
  { id: 'ibq',                 label: 'Spot the Structure',   blurb: 'Tap it on the diagram',          icon: 'scan',        hue: '#0891B2' },
  { id: 'distractor-assassin', label: 'Distractor Assassin',  blurb: 'Eliminate the wrong options',    icon: 'crosshair',   hue: '#9F1239' },
  { id: 'tie-breaker',         label: 'Tie-Breaker',          blurb: 'Which comes first',              icon: 'scale',       hue: '#4338CA' },
  { id: 'three-am-chart',      label: 'The 3 AM Chart',       blurb: 'Chill block-placement puzzle',   icon: 'moon',        hue: '#B45309' },
  { id: 'shift-survival',      label: 'Shift Survival',       blurb: 'High-stress survival mode',      icon: 'heartpulse',  hue: '#B91C1C' },
  { id: 'revision-sheet',  label: 'Revision',            blurb: 'High-yield digest + crib sheets',   icon: 'file',     hue: '#A61E4D' },
  { id: 'study-methods',   label: 'Study Methods',       blurb: 'How to study smarter',              icon: 'grad',     hue: '#1971C2' },
  { id: 'ikigai',          label: 'Ikigai Compass',      blurb: 'Your 4-circle readiness map',       icon: 'compass',  hue: '#9333EA' },
  { id: 'stats',           label: 'Your Stats',          blurb: 'Accuracy, streaks, trends',         icon: 'chart',    hue: '#6741D9' },
  { id: 'leaderboard',     label: 'Leaderboard',         blurb: 'Where you rank this week',          icon: 'trophy',   hue: '#F08C00' },
  { id: 'bookmarks-view',  label: 'Bookmarks',           blurb: 'Questions you saved',               icon: 'bookmark', hue: '#D6336C' },
  { id: 'doubts',          label: 'My Doubts',           blurb: 'Flags waiting to be resolved',      icon: 'flag',     hue: '#C92A2A' },
  { id: 'library',         label: 'Question Banks',      blurb: 'Browse + upload banks',             icon: 'layers',   hue: '#0CA678' },
  { id: 'faq',             label: 'FAQ & Help',          blurb: 'Answers + community Q&A',           icon: 'help',     hue: '#3B5BDB' },
  { id: 'weightage',       label: 'Exam Weightage',      blurb: 'Marks per subject, at a glance',    icon: 'sigma',    hue: '#9C36B5' },
  { id: 'reference',       label: 'Reference',           blurb: 'Normal values + quick tables',      icon: 'book',     hue: '#862E9C' },
];

const byId = {};
FAV_SECTIONS.forEach(s => { byId[s.id] = s; });
export const favSection = (id) => byId[id] || null;
export const isFavoritable = (id) => !!byId[id];

const isGuest = (pid) => !pid || pid === GUEST_ID || pid === '__guest__';

// ---- local per-profile record -----------------------------------------
const clean = (v) => {
  const out = { enabled: false, order: [] };
  if (v && typeof v === 'object') {
    out.enabled = v.enabled === true;
    if (Array.isArray(v.order)) out.order = v.order.filter(id => byId[id]);
  }
  return out;
};

export async function loadFavs(profileId) {
  try {
    const r = await safeStorage.get(`${KEY_PREFIXES.FAVORITES}${profileId || 'guest'}`, false);
    return clean(r && r.value ? JSON.parse(r.value) : null);
  } catch (e) { return clean(null); }
}

async function persist(profileId, favs) {
  try { await safeStorage.set(`${KEY_PREFIXES.FAVORITES}${profileId || 'guest'}`, JSON.stringify(favs), false); } catch (e) {}
  // Notify live UI (Home strip, hearts, manage screen) in this tab.
  try { window.dispatchEvent(new CustomEvent('norcet:favs', { detail: favs })); } catch (e) {}
}

// ---- mutations (all return the fresh record) ----------------------------
export async function toggleFav(profileId, sectionId) {
  if (!byId[sectionId]) return { favs: await loadFavs(profileId), added: false };
  const favs = await loadFavs(profileId);
  const had = favs.order.includes(sectionId);
  favs.order = had ? favs.order.filter(id => id !== sectionId) : [...favs.order, sectionId];
  await persist(profileId, favs);
  // Section popularity → Umami (admin reads it there). Count adds only, and
  // exclude guests to mirror the old insight's "members only" scope.
  if (!had && !isGuest(profileId)) trackUmami('favourite', { section: sectionId });
  return { favs, added: !had };
}

export async function setFavOrder(profileId, order) {
  const favs = await loadFavs(profileId);
  favs.order = (order || []).filter(id => byId[id]);
  await persist(profileId, favs);
  return favs;
}

export async function removeFav(profileId, sectionId) {
  const favs = await loadFavs(profileId);
  if (!favs.order.includes(sectionId)) return favs;
  favs.order = favs.order.filter(id => id !== sectionId);
  await persist(profileId, favs);
  return favs;
}

export async function setFavEnabled(profileId, on) {
  const favs = await loadFavs(profileId);
  favs.enabled = !!on;
  await persist(profileId, favs);
  return favs;
}
