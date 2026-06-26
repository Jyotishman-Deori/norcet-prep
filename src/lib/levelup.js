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
  const o = { xp: 0, dailyDate: '', dailyXp: 0 };
  if (l && typeof l === 'object') {
    if (Number.isFinite(l.xp)) o.xp = Math.max(0, Math.floor(l.xp));
    if (typeof l.dailyDate === 'string') o.dailyDate = l.dailyDate;
    if (Number.isFinite(l.dailyXp)) o.dailyXp = Math.max(0, Math.floor(l.dailyXp));
  }
  return o;
}

// Award XP (pure). Honours the per-day cap (resets when the local date rolls
// over). Returns the fresh slice plus what actually landed and any level-up so
// callers can celebrate. `today` is a 'YYYY-MM-DD' local date string.
export function awardXp(l, amount, today) {
  const o = normalizeLevelup(l);
  const before = progress(o.xp).level;
  const amt = Math.max(0, Math.floor(amount || 0));
  if (amt === 0) {
    return { levelup: o, awarded: 0, leveledUp: false, fromLevel: before, toLevel: before };
  }
  const dailyXp = o.dailyDate === today ? o.dailyXp : 0;   // roll over at local midnight
  const room = Math.max(0, DAILY_XP_CAP - dailyXp);
  const granted = Math.min(amt, room);
  const xp = o.xp + granted;
  const after = progress(xp).level;
  return {
    levelup: { xp, dailyDate: today, dailyXp: dailyXp + granted },
    awarded: granted,
    leveledUp: after > before,
    fromLevel: before,
    toLevel: after,
  };
}

// How much of today's cap is left (for a subtle "rested" hint in the hub).
export function dailyRemaining(l, today) {
  const o = normalizeLevelup(l);
  const used = o.dailyDate === today ? o.dailyXp : 0;
  return Math.max(0, DAILY_XP_CAP - used);
}
