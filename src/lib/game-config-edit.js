// =====================================================================
// src/lib/game-config-edit.js — schema + safe editing helpers for the admin
// Config editor. Pure (no React/IO), unit-tested. The editor reads the live
// `game_config` row, lets the admin change these fields, validates/clamps, and
// writes it back through the broker. Engines pick it up on the next app boot.
//
// Paths use dot notation with numeric segments for arrays, e.g.
// 'premium.plans.0.priceInr' or 'crateOdds.2.coins'.
// =====================================================================
import { DEFAULTS } from './game-config.js';

export function getAtPath(obj, path) {
  let cur = obj;
  for (const seg of String(path).split('.')) {
    if (cur == null) return undefined;
    cur = cur[seg];
  }
  return cur;
}

// Immutable set — returns a new object with `path` set to `value`, cloning only
// the touched spine (so React state updates cleanly).
export function setAtPath(obj, path, value) {
  const segs = String(path).split('.');
  const clone = Array.isArray(obj) ? obj.slice() : { ...obj };
  let cur = clone;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    const child = cur[seg];
    cur[seg] = Array.isArray(child) ? child.slice() : { ...(child || {}) };
    cur = cur[seg];
  }
  cur[segs[segs.length - 1]] = value;
  return clone;
}

// Field/section schema. Each field: { path, label, type, min, max, step, help, prefix, suffix }.
// type: 'slider' | 'int' | 'money' (₹) | 'toggle'.
export const SECTIONS = [
  {
    id: 'xp', title: 'Levelling & XP', icon: 'Gauge',
    blurb: 'How fast players level up and the daily earning ceiling.',
    fields: [
      { path: 'xp.reqScale',   label: 'Level pace', type: 'slider', min: 0.2, max: 2, step: 0.05,
        help: '1 = normal curve · lower = faster levels. 0.2 is the temporary test value.', warnBelow: 1 },
      { path: 'xp.dailyCap',   label: 'Daily XP cap', type: 'int', min: 500, max: 10000, step: 100,
        help: 'Most XP a player can earn in one day (anti-grind).' },
      { path: 'xp.coefficient', label: 'Curve coefficient', type: 'int', min: 20, max: 400, step: 5, advanced: true,
        help: 'Base of the XP-to-next-level curve.' },
      { path: 'xp.exponent',   label: 'Curve exponent', type: 'slider', min: 1.1, max: 2, step: 0.05, advanced: true,
        help: 'How steeply later levels cost more.' },
    ],
  },
  {
    id: 'premium', title: 'Premium & pricing', icon: 'Crown',
    blurb: 'The Premium preview page. Payments are still a placeholder.',
    fields: [
      { path: 'premium.enabled',  label: 'Show Premium page', type: 'toggle', help: 'Adds the Premium entry to the menu.' },
      { path: 'premium.testPhase', label: 'Test phase (all free)', type: 'toggle', help: 'Shows the "free during testing" banner; nothing is gated.' },
      { path: 'premium.adSlot',   label: 'Rewarded-ad slot', type: 'toggle', help: 'Future ad placeholder: keep off until a native wrap exists.' },
      { path: 'premium.gates.cribVault', label: 'Gate: Crib vault + Mistake history', type: 'toggle',
        help: 'ON = free users lose SAVED crib sheets + the Mistake Vault history (post-quiz review stays free) and see the upgrade modal. Keep OFF during testing.' },
      { path: 'premium.plans.0.priceInr', label: 'Monthly price', type: 'money', min: 0, max: 9999, step: 10 },
      { path: 'premium.plans.1.priceInr', label: 'Yearly price',  type: 'money', min: 0, max: 99999, step: 50 },
    ],
  },
  {
    id: 'waitlist', title: 'Launch waitlist', icon: 'Ticket',
    blurb: 'The invite-only launch system. Both switches are server-enforced.',
    fields: [
      { path: 'waitlist.collect', label: 'Waitlist signups open', type: 'toggle',
        help: 'ON = the "Join the waitlist" screen goes live and starts collecting email + WhatsApp signups. The app itself stays open.' },
      { path: 'waitlist.gate', label: 'Invite-only launch wall', type: 'toggle',
        help: '⚠ ON = brand-new visitors see the waitlist INSTEAD of the app, and creating an account requires an approved invite. Existing accounts and devices with progress are never walled.' },
      { path: 'waitlist.batchSize', label: 'Suggested batch size', type: 'int', min: 5, max: 200, step: 5,
        help: 'Default seat count for "Approve top N" in the admin Waitlist panel.' },
    ],
  },
  {
    id: 'security', title: 'Security', icon: 'Shield',
    blurb: 'Server-enforced account protections (the Edge brokers read these).',
    fields: [
      { path: 'security.singleSession', label: 'Single-device sessions', type: 'toggle',
        help: 'ON = logging in on a new device signs out all older devices at their next sync (anti account-sharing for paid plans). Keep OFF during testing, testers use multiple devices.' },
    ],
  },
  {
    id: 'frames', title: 'Cosmetic frame prices', icon: 'Sparkles',
    blurb: 'Coin cost of profile frames in the shop.',
    fields: [
      { path: 'framePrices.ember',  label: 'Ember (common)',  type: 'int', min: 0, max: 20000, step: 50, prefix: '🪙' },
      { path: 'framePrices.frost',  label: 'Frost (common)',  type: 'int', min: 0, max: 20000, step: 50, prefix: '🪙' },
      { path: 'framePrices.forest', label: 'Forest (common)', type: 'int', min: 0, max: 20000, step: 50, prefix: '🪙' },
      { path: 'framePrices.neon',   label: 'Neon (rare)',     type: 'int', min: 0, max: 20000, step: 50, prefix: '🪙' },
      { path: 'framePrices.royal',  label: 'Royal (rare)',    type: 'int', min: 0, max: 20000, step: 50, prefix: '🪙' },
      { path: 'framePrices.gold',   label: 'Gold (epic)',     type: 'int', min: 0, max: 20000, step: 50, prefix: '🪙' },
    ],
  },
  {
    id: 'crate', title: 'Supply crate rewards', icon: 'Gift',
    blurb: 'Coins granted per crate rarity (odds stay fixed).',
    fields: [
      { path: 'crateOdds.0.coins', label: 'Common coins',   type: 'int', min: 0, max: 5000, step: 10, prefix: '🪙' },
      { path: 'crateOdds.1.coins', label: 'Uncommon coins', type: 'int', min: 0, max: 5000, step: 10, prefix: '🪙' },
      { path: 'crateOdds.2.coins', label: 'Rare coins',     type: 'int', min: 0, max: 5000, step: 10, prefix: '🪙' },
      { path: 'crateOdds.3.coins', label: 'Epic coins',     type: 'int', min: 0, max: 5000, step: 10, prefix: '🪙' },
    ],
  },
  {
    id: 'quests', title: 'Daily quests', icon: 'Target',
    blurb: 'Goal and XP reward for each daily quest.',
    fields: [
      { path: 'quests.play1.xp',  label: 'Play 1 · reward', type: 'int', min: 0, max: 1000, step: 5, suffix: 'XP' },
      { path: 'quests.play3.xp',  label: 'Play 3 · reward', type: 'int', min: 0, max: 1000, step: 5, suffix: 'XP' },
      { path: 'quests.play5.xp',  label: 'Play 5 · reward', type: 'int', min: 0, max: 1000, step: 5, suffix: 'XP' },
      { path: 'quests.xp120.xp',  label: 'Earn 120 · reward', type: 'int', min: 0, max: 1000, step: 5, suffix: 'XP' },
      { path: 'quests.xp300.xp',  label: 'Earn 300 · reward', type: 'int', min: 0, max: 1000, step: 5, suffix: 'XP' },
    ],
  },
];

// Flat list of every editable field (for validate/sanitize).
export const ALL_FIELDS = SECTIONS.flatMap(s => s.fields);

function clampNum(v, f) {
  let n = Number(v);
  if (!Number.isFinite(n)) n = getAtPath(DEFAULTS, f.path);
  if (typeof f.min === 'number') n = Math.max(f.min, n);
  if (typeof f.max === 'number') n = Math.min(f.max, n);
  // integer-typed fields round; sliders keep decimals to the step
  if (f.type === 'int' || f.type === 'money') n = Math.round(n);
  else n = Math.round(n / (f.step || 0.01)) * (f.step || 0.01);
  // avoid FP dust like 1.4500000002
  return Number(n.toFixed(4));
}

// sanitizeConfig — clamp every schema field to its valid range; leave unmanaged
// keys untouched. Returns a NEW config object.
export function sanitizeConfig(cfg) {
  let out = cfg;
  for (const f of ALL_FIELDS) {
    if (f.type === 'toggle') {
      out = setAtPath(out, f.path, !!getAtPath(out, f.path));
    } else {
      out = setAtPath(out, f.path, clampNum(getAtPath(out, f.path), f));
    }
  }
  return out;
}

// validateConfig — collect human-readable problems (before clamping). Empty = ok.
export function validateConfig(cfg) {
  const errors = [];
  for (const f of ALL_FIELDS) {
    if (f.type === 'toggle') continue;
    const raw = getAtPath(cfg, f.path);
    const n = Number(raw);
    if (!Number.isFinite(n)) { errors.push(`${f.label}: must be a number`); continue; }
    if (typeof f.min === 'number' && n < f.min) errors.push(`${f.label}: below minimum ${f.min}`);
    if (typeof f.max === 'number' && n > f.max) errors.push(`${f.label}: above maximum ${f.max}`);
  }
  return errors;
}

// xpForLevel — the levelup.js curve, computed against ANY (possibly-unsaved)
// config so the editor can preview the effect live.
export function xpForLevel(cfg, level) {
  const xp = (cfg && cfg.xp) || DEFAULTS.xp;
  const L = Math.max(1, level | 0);
  return Math.max(10, Math.round(xp.coefficient * Math.pow(L, xp.exponent) * xp.reqScale));
}

// hasChanges — did the working copy diverge from the loaded baseline (managed fields only)?
export function changedFields(baseline, working) {
  const changed = [];
  for (const f of ALL_FIELDS) {
    const a = getAtPath(baseline, f.path);
    const b = getAtPath(working, f.path);
    if (a !== b) changed.push(f.path);
  }
  return changed;
}
