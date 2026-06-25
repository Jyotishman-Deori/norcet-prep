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

const FAVSEC_PREFIX = 'favsec:';
const FAVORDER_PREFIX = 'favorder:';

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

// ---- shared admin mirrors (fire-and-forget, never block the UI) --------
async function readIdList(key) {
  try {
    const r = await safeStorage.get(key, true);
    if (r && r.value) { const a = JSON.parse(r.value); if (Array.isArray(a)) return a; }
  } catch (e) {}
  return [];
}

async function mirrorSection(sectionId, profileId, on) {
  if (isGuest(profileId)) return;
  try {
    let ids = await readIdList(FAVSEC_PREFIX + sectionId);
    ids = ids.filter(id => id !== profileId);
    if (on) ids.push(profileId);
    await safeStorage.set(FAVSEC_PREFIX + sectionId, JSON.stringify(ids), true);
  } catch (e) {}
}

async function mirrorOrder(profileId, order) {
  if (isGuest(profileId)) return;
  try { await safeStorage.set(FAVORDER_PREFIX + profileId, JSON.stringify(order), true); } catch (e) {}
}

// ---- mutations (all return the fresh record) ----------------------------
export async function toggleFav(profileId, sectionId) {
  if (!byId[sectionId]) return { favs: await loadFavs(profileId), added: false };
  const favs = await loadFavs(profileId);
  const had = favs.order.includes(sectionId);
  favs.order = had ? favs.order.filter(id => id !== sectionId) : [...favs.order, sectionId];
  await persist(profileId, favs);
  mirrorSection(sectionId, profileId, !had);
  mirrorOrder(profileId, favs.order);
  return { favs, added: !had };
}

export async function setFavOrder(profileId, order) {
  const favs = await loadFavs(profileId);
  favs.order = (order || []).filter(id => byId[id]);
  await persist(profileId, favs);
  mirrorOrder(profileId, favs.order);
  return favs;
}

export async function removeFav(profileId, sectionId) {
  const favs = await loadFavs(profileId);
  if (!favs.order.includes(sectionId)) return favs;
  favs.order = favs.order.filter(id => id !== sectionId);
  await persist(profileId, favs);
  mirrorSection(sectionId, profileId, false);
  mirrorOrder(profileId, favs.order);
  return favs;
}

export async function setFavEnabled(profileId, on) {
  const favs = await loadFavs(profileId);
  favs.enabled = !!on;
  await persist(profileId, favs);
  return favs;
}

// ---- admin insights ------------------------------------------------------
// One row per registry section (zero-heart sections included on purpose —
// "not attracting users" is exactly the signal the admin asked for):
//   { id, label, hearts, avgRank (1-based | null), top3 (times ranked #1-#3) }
// Plus { users } = number of profiles with at least one favourite.
export async function loadFavInsights() {
  let secKeys = [], orderKeys = [];
  try { const r = await safeStorage.list(FAVSEC_PREFIX, true); secKeys = (r && r.keys) ? r.keys : []; } catch (e) {}
  try { const r = await safeStorage.list(FAVORDER_PREFIX, true); orderKeys = (r && r.keys) ? r.keys : []; } catch (e) {}

  const hearts = {};
  await Promise.all(secKeys.map(async k => {
    const id = k.slice(FAVSEC_PREFIX.length);
    if (!byId[id]) return;
    hearts[id] = (await readIdList(k)).length;
  }));

  const rankSum = {}, rankN = {}, top3 = {};
  let users = 0;
  await Promise.all(orderKeys.map(async k => {
    const order = await readIdList(k);
    if (!Array.isArray(order) || order.length === 0) return;
    users += 1;
    order.forEach((id, i) => {
      if (!byId[id]) return;
      rankSum[id] = (rankSum[id] || 0) + (i + 1);
      rankN[id] = (rankN[id] || 0) + 1;
      if (i < 3) top3[id] = (top3[id] || 0) + 1;
    });
  }));

  const rows = FAV_SECTIONS.map(s => ({
    id: s.id, label: s.label, hue: s.hue, icon: s.icon,
    hearts: hearts[s.id] || 0,
    avgRank: rankN[s.id] ? (rankSum[s.id] / rankN[s.id]) : null,
    top3: top3[s.id] || 0,
  })).sort((a, b) => b.hearts - a.hearts || (a.avgRank || 99) - (b.avgRank || 99));

  return { rows, users };
}
