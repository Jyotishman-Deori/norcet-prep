// =====================================================================
// src/lib/levelup.js  (Level Up — XP + level progression engine)
// The permanent progression spine for the gamified drills. PURE + client-side;
// state lives in the synced profile blob (data.levelup) exactly like economy.
//
//   data.levelup = {
//     xp:        integer  — total lifetime XP (only ever grows)
//     dailyDate: 'YYYY-MM-DD' — local date the daily cap window belongs to
//     dailyXp:   integer  — XP banked today (vs DAILY_XP_CAP, anti-grind)
//   }
//
// Coins (spendable) + Hearts (the lives/energy mechanic) live in lib/economy.js
// — Level Up does NOT add new currencies, it adds XP (non-spendable) on top.
// Energy gating is deliberately OFF for now; it can be turned on for a free tier
// later by spending Hearts on entry. See the project plan.
// =====================================================================

export const MAX_LEVEL = 100;
export const DAILY_XP_CAP = 3000;        // anti-grind ceiling per local day

// XP required to advance FROM `level` TO `level+1`. Exponential curve from the
// spec: fast early levels, ever-steeper climb. Rounded to a tidy integer.
export function xpToNext(level) {
  const L = Math.max(1, Math.floor(level));
  if (L >= MAX_LEVEL) return Infinity;
  return Math.round(100 * Math.pow(L, 1.5));
}

// Resolve a total-XP value into { level, into, span, pct } — `into` = XP earned
// inside the current level, `span` = XP that level needs, `pct` = 0..100.
export function progress(xpTotal) {
  let xp = Math.max(0, Math.floor(xpTotal || 0));
  let level = 1;
  let used = 0;
  while (level < MAX_LEVEL) {
    const need = xpToNext(level);
    if (used + need > xp) break;
    used += need;
    level += 1;
  }
  const into = xp - used;
  const span = level >= MAX_LEVEL ? 0 : xpToNext(level);
  const pct = span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 100;
  return { level, into, span, pct, xp };
}

// Six clinical prestige tiers across levels 1–100. ORIGINAL titles only (no
// trademarked/official names) per the brand rules. `accent` is a fixed hue so
// the tier reads the same in light and dark themes.
export const TIERS = [
  { id: 't1', min: 1,  max: 10,  title: 'First Responder',  icon: 'badge',        accent: '#0E7490', blurb: 'Finding your feet on the ward.' },
  { id: 't2', min: 11, max: 25,  title: 'Triage Initiate',  icon: 'clipboard',    accent: '#0891B2', blurb: 'Sorting the sick from the stable.' },
  { id: 't3', min: 26, max: 45,  title: 'Code Blue Knight', icon: 'stethoscope',  accent: '#2563EB', blurb: 'First to the crash, calm under pressure.' },
  { id: 't4', min: 46, max: 70,  title: 'ICU Frontliner',   icon: 'activity',     accent: '#6366F1', blurb: 'The one they call for the hard cases.' },
  { id: 't5', min: 71, max: 95,  title: 'Vitals Commander', icon: 'flame',        accent: '#D97706', blurb: 'Runs the floor without breaking a sweat.' },
  { id: 't6', min: 96, max: 100, title: 'Legend: RN',       icon: 'crown',        accent: '#DC2626', blurb: 'Top of the profession. Untouchable.' },
];

export function tierFor(level) {
  const L = Math.max(1, Math.floor(level || 1));
  return TIERS.find(t => L >= t.min && L <= t.max) || TIERS[TIERS.length - 1];
}

// Next tier the user is climbing toward (null once at the top tier).
export function nextTier(level) {
  const cur = tierFor(level);
  const idx = TIERS.indexOf(cur);
  return idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

export function normalizeLevelup(l) {
  const o = { xp: 0, dailyDate: '', dailyXp: 0, dailyGames: 0, questClaims: [], crates: 0 };
  if (l && typeof l === 'object') {
    if (Number.isFinite(l.xp)) o.xp = Math.max(0, Math.floor(l.xp));
    if (typeof l.dailyDate === 'string') o.dailyDate = l.dailyDate;
    if (Number.isFinite(l.dailyXp)) o.dailyXp = Math.max(0, Math.floor(l.dailyXp));
    if (Number.isFinite(l.dailyGames)) o.dailyGames = Math.max(0, Math.floor(l.dailyGames));
    if (Array.isArray(l.questClaims)) o.questClaims = l.questClaims.filter(x => typeof x === 'string');
    if (Number.isFinite(l.crates)) o.crates = Math.max(0, Math.floor(l.crates));
  }
  return o;
}

// Roll the daily fields over when the local date changes (cap, games, claims).
function rolloverDaily(o, today) {
  if (o.dailyDate === today) return o;
  return { ...o, dailyDate: today, dailyXp: 0, dailyGames: 0, questClaims: [] };
}

// A gamified drill finished: roll over, count the game, award XP (daily-capped),
// and report any level-up so the caller can celebrate. `today` = 'YYYY-MM-DD'.
export function completeGame(l, xpAmount, today) {
  let o = rolloverDaily(normalizeLevelup(l), today);
  const before = progress(o.xp).level;
  const amt = Math.max(0, Math.floor(xpAmount || 0));
  const room = Math.max(0, DAILY_XP_CAP - o.dailyXp);
  const granted = Math.min(amt, room);
  o = { ...o, xp: o.xp + granted, dailyXp: o.dailyXp + granted, dailyGames: o.dailyGames + 1 };
  const after = progress(o.xp).level;
  return { levelup: o, awarded: granted, leveledUp: after > before, fromLevel: before, toLevel: after };
}

// --- Daily quests -------------------------------------------------------------
// A small pool; 3 are drawn deterministically per local day. Rewards are BONUS
// XP on top of play — they don't touch the daily cap (they're the reward for
// engaging, not a grind vector). metric: 'games' (drills played today) or 'xp'
// (XP earned today).
export const QUESTS = {
  play1: { id: 'play1', label: 'Play any drill', goal: 1,   metric: 'games', xp: 30 },
  play3: { id: 'play3', label: 'Play 3 drills',  goal: 3,   metric: 'games', xp: 70 },
  play5: { id: 'play5', label: 'Play 5 drills',  goal: 5,   metric: 'games', xp: 140 },
  xp120: { id: 'xp120', label: 'Earn 120 XP',    goal: 120, metric: 'xp',    xp: 50 },
  xp300: { id: 'xp300', label: 'Earn 300 XP',    goal: 300, metric: 'xp',    xp: 120 },
};
const QUEST_IDS = Object.keys(QUESTS);

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// The 3 quest ids for `today` — deterministic, so they're stable through the day
// and vary day to day.
export function dailyQuestIds(today) {
  const pool = [...QUEST_IDS];
  const out = [];
  let s = hashStr(today || '') || 1;
  while (out.length < 3 && pool.length) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    out.push(pool.splice(s % pool.length, 1)[0]);
  }
  return out;
}

// Today's quests with live progress / claimed flags.
export function questState(l, today) {
  const o = rolloverDaily(normalizeLevelup(l), today);
  return dailyQuestIds(today).map(id => {
    const q = QUESTS[id];
    const current = q.metric === 'games' ? o.dailyGames : o.dailyXp;
    return {
      ...q,
      current: Math.min(current, q.goal),
      pct: Math.min(100, Math.round((current / q.goal) * 100)),
      done: current >= q.goal,
      claimed: o.questClaims.includes(id),
    };
  });
}

// Claim a completed, unclaimed quest → bonus XP (uncapped), mark it claimed.
// Reports any level-up so the caller can celebrate.
export function claimQuest(l, questId, today) {
  let o = rolloverDaily(normalizeLevelup(l), today);
  const lvl = progress(o.xp).level;
  const q = QUESTS[questId];
  const current = q ? (q.metric === 'games' ? o.dailyGames : o.dailyXp) : 0;
  if (!q || !dailyQuestIds(today).includes(questId) || current < q.goal || o.questClaims.includes(questId)) {
    return { levelup: o, claimed: false, leveledUp: false, fromLevel: lvl, toLevel: lvl };
  }
  o = { ...o, xp: o.xp + q.xp, questClaims: [...o.questClaims, questId] };
  // Capstone: claiming the LAST of the day's 3 quests earns a Supply Crate.
  let crateEarned = false;
  if (dailyQuestIds(today).every(id => o.questClaims.includes(id))) {
    o = { ...o, crates: (o.crates || 0) + 1 };
    crateEarned = true;
  }
  const after = progress(o.xp).level;
  return { levelup: o, claimed: true, awarded: q.xp, crateEarned, leveledUp: after > lvl, fromLevel: lvl, toLevel: after };
}

// --- Supply Crates ------------------------------------------------------------
// Earned by clearing all 3 daily quests. A delightful 3-tap reveal pays out with
// TRANSPARENT odds (shown in the UI). Coins for now (cosmetics slot in later);
// the top tier also drops a chunk of bonus XP. No real-money items, ever.
export const CRATE_ODDS = [
  { id: 'common',   weight: 60, coins: 60,  xp: 0,   label: '60 Coins',            tone: '#0CA678' },
  { id: 'uncommon', weight: 28, coins: 150, xp: 0,   label: '150 Coins',           tone: '#2563EB' },
  { id: 'rare',     weight: 9,  coins: 350, xp: 0,   label: '350 Coins',           tone: '#7C3AED' },
  { id: 'epic',     weight: 3,  coins: 500, xp: 200, label: '500 Coins + 200 XP',  tone: '#D97706' },
];

export function rollCrate(rng = Math.random) {
  const total = CRATE_ODDS.reduce((s, r) => s + r.weight, 0);
  let r = (typeof rng === 'function' ? rng() : Math.random()) * total;
  for (const o of CRATE_ODDS) { if ((r -= o.weight) < 0) return o; }
  return CRATE_ODDS[0];
}

// Open one crate: decrement, roll a reward. Bonus XP (top tier) is uncapped and
// applied here; the Coins live in economy, so the caller applies reward.coins.
export function openCrate(l, today, rng = Math.random) {
  let o = rolloverDaily(normalizeLevelup(l), today);
  if ((o.crates || 0) <= 0) return { levelup: o, opened: false, reward: null, leveledUp: false };
  const reward = rollCrate(rng);
  const before = progress(o.xp).level;
  o = { ...o, crates: o.crates - 1, xp: o.xp + (reward.xp || 0) };
  const after = progress(o.xp).level;
  return { levelup: o, opened: true, reward, leveledUp: after > before, fromLevel: before, toLevel: after };
}

// How much of today's cap is left (for a subtle "rested" hint in the hub).
export function dailyRemaining(l, today) {
  const o = rolloverDaily(normalizeLevelup(l), today);
  return Math.max(0, DAILY_XP_CAP - o.dailyXp);
}
