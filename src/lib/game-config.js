// =====================================================================
// src/lib/game-config.js — live, tunable game numbers (no redeploy to balance).
//
// All balance knobs live HERE as DEFAULTS, and are overridden at boot by a
// single row in the existing `kv_shared` Supabase table:
//
//     key   = 'game_config'
//     value = JSON of *partial* overrides, deep-merged over DEFAULTS, e.g.
//             {"xp":{"reqScale":1},"framePrices":{"gold":2500}}
//
// loadGameConfig() reads that row once at boot (a normal public anon read —
// negligible egress) and merges it in. Change the row in Supabase → every
// client picks it up on next load, WITHOUT a redeploy. If the row is absent or
// unreachable, the hardcoded DEFAULTS are used (so the app never depends on it).
//
// Engines (levelup.js, cosmetics.js, combo-burst.jsx) read these via getConfig()
// at call time — never import the raw numbers.
//
// NOTE: storage.js is imported LAZILY inside loadGameConfig() (not at the top),
// so pure consumers of DEFAULTS/getConfig (e.g. the admin Config editor + its
// Node test) don't drag in the Vite-only storage module.
// =====================================================================

export const DEFAULTS = {
  // XP curve: xpToNext(level) = round(coefficient * level^exponent * reqScale).
  // reqScale is the live "how fast do levels come" knob (1 = real curve).
  // NOTE: 0.2 is the TEMPORARY test value (≈5× faster) — set reqScale to 1 (here
  // or, better, in the game_config row) to restore the real curve for launch.
  xp: { coefficient: 100, exponent: 1.5, reqScale: 0.2, dailyCap: 3000 },

  // Daily quests. metric: 'games' (drills played today) | 'xp' (XP earned today).
  // `xp` here is the BONUS reward for claiming. Keys are the quest ids; 3 are
  // drawn deterministically per day from this set.
  quests: {
    play1: { label: 'Play any drill', goal: 1,   metric: 'games', xp: 30 },
    play3: { label: 'Play 3 drills',  goal: 3,   metric: 'games', xp: 70 },
    play5: { label: 'Play 5 drills',  goal: 5,   metric: 'games', xp: 140 },
    xp120: { label: 'Earn 120 XP',    goal: 120, metric: 'xp',    xp: 50 },
    xp300: { label: 'Earn 300 XP',    goal: 300, metric: 'xp',    xp: 120 },
  },

  // Supply Crate reward table (weighted). Rare/epic also drop an unowned frame.
  crateOdds: [
    { id: 'common',   weight: 60, coins: 60,  xp: 0,   label: '60 Coins',           tone: '#0CA678' },
    { id: 'uncommon', weight: 28, coins: 150, xp: 0,   label: '150 Coins',          tone: '#2563EB' },
    { id: 'rare',     weight: 9,  coins: 350, xp: 0,   label: '350 Coins',          tone: '#7C3AED' },
    { id: 'epic',     weight: 3,  coins: 500, xp: 200, label: '500 Coins + 200 XP', tone: '#D97706' },
  ],

  // Cosmetic frame shop prices (Coins). Keys = frame ids from cosmetics.js.
  framePrices: { ember: 400, frost: 400, forest: 400, neon: 900, royal: 900, gold: 1800 },

  // Premium / freemium placeholder (owner-approved 2026-07). Payments are NOT
  // wired yet — the page is a preview; nothing in the app is gated on this.
  // All knobs live-tunable via the game_config row like everything else.
  premium: {
    enabled: true,     // show the Premium page + drawer entry
    testPhase: true,   // true = "everything free during testing" banner + placeholder CTA
    adSlot: false,     // future rewarded-ad slot (hidden while false)
    // Feature gates — which premium walls are ENFORCED. All ship OFF during
    // the test phase (everything stays free); flip live from the admin Live
    // config tool at launch, no redeploy. cribVault = saved crib sheets +
    // the Mistake Vault history (the post-quiz session crib stays free).
    gates: { cribVault: false },
    plans: [
      { id: 'monthly', label: 'Monthly', priceInr: 149, per: 'month' },
      { id: 'yearly',  label: 'Yearly',  priceInr: 999, per: 'year', save: 'Save 44%' },
    ],
  },

  // Launch waitlist (see waitlist-implementation-plan.md + src/lib/waitlist.js).
  // Both switches ship OFF; flip live from the admin Config editor.
  waitlist: {
    // collect: the Join-the-waitlist screen is live (public join/status/stats
    // actions accepted by the waitlist Edge Function). Turn ON to start
    // gathering signups while the app is still open.
    collect: false,
    // gate: the invite-only launch wall. ON = brand-new visitors (no account,
    // no local progress) land on the waitlist instead of guest mode, and the
    // auth-secure broker REQUIRES a one-time claim token to register.
    // SERVER-enforced (auth-secure + waitlist Edge Functions read this row).
    gate: false,
    // Suggested batch size shown in the admin panel (spec §5.2: 25 per drop
    // once running twice a week).
    batchSize: 25,
    // Batch drop schedule, IST (dow 0=Sun…6=Sat). Default Tue 10:00 + Fri 15:00.
    schedule: [{ dow: 2, h: 10, m: 0 }, { dow: 5, h: 15, m: 0 }],
  },

  // Security switches. UNLIKE the rest of this config, these are enforced
  // SERVER-side: the kv-write / kv-read / content-staging / subscription
  // Edge Functions read this same game_config row (cached ~60s) directly.
  security: {
    // Single concurrent session ("last one wins"): ON = logging in on a new
    // device invalidates every older device's session token at its next
    // sync (the brokers answer 401 SESSION_EXPIRED). Anti account-sharing
    // for the paid era. Ships OFF so multi-device testers stay logged in.
    singleSession: false,
  },

  // In-game combo banner milestones (consecutive correct answers).
  comboTiers: [
    { at: 3,  label: 'On a roll!',    tone: '#0CA678' },
    { at: 5,  label: 'Steady hands!', tone: '#2563EB' },
    { at: 8,  label: 'Unstoppable!',  tone: '#7C3AED' },
    { at: 12, label: 'Flawless!',     tone: '#D97706' },
  ],
};

function isPlainObject(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

// Deep-merge `over` onto `base`: objects recurse; arrays + primitives REPLACE.
function deepMerge(base, over) {
  if (!isPlainObject(over)) return over === undefined ? base : over;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over)) {
    out[k] = isPlainObject(base && base[k]) && isPlainObject(over[k])
      ? deepMerge(base[k], over[k])
      : over[k];
  }
  return out;
}

// Live config — starts as DEFAULTS, replaced when a remote override loads.
let CONFIG = DEFAULTS;

export function getConfig() { return CONFIG; }

// Merge partial overrides over DEFAULTS (always from DEFAULTS so it's idempotent).
export function applyRemoteConfig(remote) {
  CONFIG = isPlainObject(remote) ? deepMerge(DEFAULTS, remote) : DEFAULTS;
  return CONFIG;
}

// Read the `game_config` row once at boot and apply it. Public anon read; safe
// to call early. Never throws; returns true if a remote override was applied.
export async function loadGameConfig() {
  try {
    const { get: kvGet } = await import('../storage.js');
    const r = await kvGet('game_config', true);
    if (r && r.value != null) {
      const remote = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
      applyRemoteConfig(remote);
      return true;
    }
  } catch (e) { /* fall back to DEFAULTS */ }
  return false;
}
