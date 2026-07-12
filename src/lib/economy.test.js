// Contract test for src/lib/economy.js — runnable under Node:
//   node src/lib/economy.test.js
// Pure module (no I/O), so no DOM/build stubs are needed.
//
// Coins are the app's only spendable currency and `addCoins(e, -price)` is its
// ONLY spend path, so the clamp-at-zero invariant below is the whole wallet.
// Every regen/time expectation injects `now` — nothing here reads a clock.
import assert from 'node:assert/strict';
import {
  normalizeEconomy, addCoins, claimWhyBonus, restoreHearts, withRegenHearts,
  HEART_MAX, HEART_REGEN_MS, WHY_BONUS_COINS, COIN_GLYPH,
} from './economy.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const DEFAULT = { coins: 0, hearts: HEART_MAX, heartsTs: 0, whyClaimed: [] };

// ---- constants are sane (a zero/negative reward would break every award) ----
assert.ok(HEART_MAX > 0 && Number.isInteger(HEART_MAX));
assert.ok(HEART_REGEN_MS > 0);
assert.ok(WHY_BONUS_COINS > 0 && Number.isInteger(WHY_BONUS_COINS));
assert.equal(typeof COIN_GLYPH, 'string');

// ---- normalizeEconomy: defaults, garbage never throws ----
{
  assert.deepEqual(normalizeEconomy(null), DEFAULT);
  assert.deepEqual(normalizeEconomy(undefined), DEFAULT);
  assert.deepEqual(normalizeEconomy(42), DEFAULT);
  assert.deepEqual(normalizeEconomy('x'), DEFAULT);
  assert.deepEqual(normalizeEconomy([]), DEFAULT);
  assert.deepEqual(normalizeEconomy({}), DEFAULT);
  assert.deepEqual(normalizeEconomy(true), DEFAULT);
  assert.equal(normalizeEconomy(null).coins, 0, 'a new wallet starts empty');
  assert.equal(normalizeEconomy(null).hearts, HEART_MAX, 'a new wallet starts with full hearts');
}

// ---- normalizeEconomy: coins can never be minted by a corrupt blob ----
{
  for (const bad of [NaN, Infinity, -Infinity, '500', '0', null, undefined, {}, [], true]) {
    assert.equal(normalizeEconomy({ coins: bad }).coins, 0, `coins: ${String(bad)} → 0`);
  }
  assert.equal(normalizeEconomy({ coins: -9999 }).coins, 0, 'a negative balance is impossible');
  assert.equal(normalizeEconomy({ coins: 7.9 }).coins, 7, 'floats FLOOR (never round up into free coins)');
  assert.equal(normalizeEconomy({ coins: 1234 }).coins, 1234);
}

// ---- normalizeEconomy: hearts clamped 0..HEART_MAX ----
{
  assert.equal(normalizeEconomy({ hearts: 999 }).hearts, HEART_MAX);
  assert.equal(normalizeEconomy({ hearts: HEART_MAX + 1 }).hearts, HEART_MAX);
  assert.equal(normalizeEconomy({ hearts: -3 }).hearts, 0);
  assert.equal(normalizeEconomy({ hearts: 2.7 }).hearts, 2, 'floored');
  assert.equal(normalizeEconomy({ hearts: 0 }).hearts, 0);
  for (const bad of [NaN, Infinity, '3', null]) {
    assert.equal(normalizeEconomy({ hearts: bad }).hearts, HEART_MAX, `hearts: ${String(bad)} → default`);
  }
  assert.equal(normalizeEconomy({ heartsTs: 'nope' }).heartsTs, 0);
  assert.equal(normalizeEconomy({ heartsTs: 1783100000000 }).heartsTs, 1783100000000);
}

// ---- normalizeEconomy: whyClaimed is a list of strings, or nothing ----
{
  assert.deepEqual(normalizeEconomy({ whyClaimed: 'q1' }).whyClaimed, [], 'a non-array is dropped');
  assert.deepEqual(normalizeEconomy({ whyClaimed: ['q1', 7, null, {}, 'q2'] }).whyClaimed, ['q1', 'q2']);
}

// ---- addCoins: adds, floors, and CLAMPS AT ZERO (the only spend path) ----
{
  const e = normalizeEconomy({ coins: 100 });
  const snap = clone(e);

  assert.equal(addCoins(e, 50).coins, 150);
  assert.equal(addCoins(e, 0).coins, 100);
  assert.equal(addCoins(e, 10.9).coins, 110, 'a fractional award floors');
  assert.equal(addCoins(e, -10.9).coins, 89, 'a fractional spend floors the DELTA (-11), never rounds in the user\'s favour');

  // Spending is addCoins(e, -price). Spending more than you own leaves EXACTLY 0.
  assert.equal(addCoins(e, -100).coins, 0, 'spending the exact balance empties the wallet');
  assert.equal(addCoins(e, -101).coins, 0, 'overspend clamps to 0');
  assert.equal(addCoins(e, -1e9).coins, 0, 'a huge overspend still clamps to 0, never negative');
  assert.ok(addCoins(e, -1e9).coins >= 0, 'coins can NEVER go negative');
  assert.equal(addCoins({ coins: 0 }, -400).coins, 0, 'an empty wallet cannot be driven into debt');

  // A non-finite delta is a no-op (never poisons the balance to NaN).
  for (const bad of [NaN, Infinity, -Infinity, '50', null, undefined, {}, []]) {
    const r = addCoins(e, bad);
    assert.equal(r.coins, 100, `addCoins(e, ${String(bad)}) is a no-op`);
    assert.ok(Number.isFinite(r.coins));
  }

  // Purity + a garbage wallet still normalizes.
  assert.deepEqual(e, snap, 'addCoins must not mutate its input');
  assert.equal(addCoins(null, 500).coins, 500);
  assert.equal(addCoins('x', 500).coins, 500);
  assert.equal(addCoins(undefined, -500).coins, 0);
  // Other fields survive a coin move.
  const rich = addCoins({ coins: 10, hearts: 2, heartsTs: 99, whyClaimed: ['q1'] }, 5);
  assert.deepEqual(rich, { coins: 15, hearts: 2, heartsTs: 99, whyClaimed: ['q1'] });
}

// ---- claimWhyBonus: once per question, ever (the dedupe IS the anti-farm) ----
{
  const e0 = normalizeEconomy({ coins: 0 });
  const snap = clone(e0);

  const first = claimWhyBonus(e0, 'q-101');
  assert.equal(first.awarded, true);
  assert.equal(first.economy.coins, WHY_BONUS_COINS);
  assert.deepEqual(first.economy.whyClaimed, ['q-101']);
  assert.deepEqual(e0, snap, 'claimWhyBonus is pure');

  // Double-submit: the SAME question never pays twice.
  const again = claimWhyBonus(first.economy, 'q-101');
  assert.equal(again.awarded, false);
  assert.equal(again.economy.coins, WHY_BONUS_COINS, 'no second payout');
  assert.deepEqual(again.economy.whyClaimed, ['q-101'], 'and no duplicate entry');

  // Hammering it 20x mints nothing more (the farming case).
  let econ = first.economy;
  for (let i = 0; i < 20; i++) econ = claimWhyBonus(econ, 'q-101').economy;
  assert.equal(econ.coins, WHY_BONUS_COINS, 'a replayed claim is idempotent');

  // A different question pays once.
  const second = claimWhyBonus(econ, 'q-102');
  assert.equal(second.awarded, true);
  assert.equal(second.economy.coins, WHY_BONUS_COINS * 2);

  // A falsy / missing question id awards nothing (no anonymous mint).
  for (const bad of ['', null, undefined, 0]) {
    const r = claimWhyBonus(second.economy, bad);
    assert.equal(r.awarded, false, `questionId ${String(bad)} awards nothing`);
    assert.equal(r.economy.coins, second.economy.coins);
  }

  // A pre-duplicated blob still only ever pays for an id once more (includes()).
  const dupBlob = { coins: 0, hearts: HEART_MAX, heartsTs: 0, whyClaimed: ['q-9', 'q-9'] };
  assert.equal(claimWhyBonus(dupBlob, 'q-9').awarded, false);
}

// ---- claimWhyBonus: the dedupe list is a HARD ceiling, NOT a rolling window ----
{
  // REGRESSION (was a coin-minting exploit, now fixed). The list used to be
  // trimmed with `.slice(-CAP)`, so a question that fell out of the window became
  // claimable AGAIN: with a bank bigger than the cap, a user could cycle the
  // oldest ids forever and mint unbounded coins at WHY_BONUS_COINS a pop. A
  // bounded, EVICTING list cannot be a permanent "once ever" ledger. It is now a
  // hard ceiling: at the cap we simply stop awarding. Bounded AND unmintable.
  let econ = normalizeEconomy(null);
  const N = 1200;
  for (let i = 0; i < N; i++) econ = claimWhyBonus(econ, `q${i}`).economy;

  // The cap is well above a realistic bank, so 1200 distinct claims all land and
  // NOTHING is evicted. Every id ever claimed is still remembered.
  assert.equal(econ.whyClaimed.length, N, 'nothing was evicted');
  assert.equal(econ.coins, WHY_BONUS_COINS * N, 'every distinct question paid exactly once');
  assert.equal(new Set(econ.whyClaimed).size, N, 'no duplicates');
  assert.ok(econ.whyClaimed.includes('q0'), 'the OLDEST claim is still remembered (it used to be evicted)');

  // ...so the oldest question can never re-pay. This is the exploit, closed.
  const refarm = claimWhyBonus(econ, 'q0');
  assert.equal(refarm.awarded, false, 'an already-claimed question NEVER re-pays');
  assert.equal(refarm.economy.coins, econ.coins, '...and mints no coins');

  // At the hard ceiling we stop awarding rather than evicting (memory stays
  // bounded and no coin is ever minted twice).
  const atCap = { coins: 0, hearts: 5, heartsTs: 0, whyClaimed: Array.from({ length: 10000 }, (_, i) => `x${i}`) };
  const overflow = claimWhyBonus(atCap, 'brand-new-question');
  assert.equal(overflow.awarded, false, 'at the ceiling, a NEW question stops paying rather than evicting an old one');
  assert.equal(overflow.economy.coins, 0, '...minting nothing');
  assert.equal(overflow.economy.whyClaimed.length, 10000, '...and the list stays bounded');
}

// ---- restoreHearts: capped, resets the regen clock when full ----
{
  const e = normalizeEconomy({ hearts: 2, heartsTs: 500 });
  const snap = clone(e);

  assert.equal(restoreHearts(e, 1).hearts, 3);
  assert.equal(restoreHearts(e, 1).heartsTs, 500, 'still draining: the clock keeps running');
  assert.equal(restoreHearts(e).hearts, 3, 'default restore is 1');
  assert.equal(restoreHearts(e, 999).hearts, HEART_MAX, 'never above HEART_MAX');
  assert.equal(restoreHearts(e, 999).heartsTs, 0, 'a full bar clears the regen clock');
  assert.equal(restoreHearts(e, HEART_MAX - 2).hearts, HEART_MAX);
  assert.equal(restoreHearts(e, 1.9).hearts, 3, 'floors');

  // A negative n can never DRAIN hearts through the restore path.
  for (const bad of [-3, -0.5, -1e9]) {
    assert.equal(restoreHearts(e, bad).hearts, 2, `restoreHearts(e, ${String(bad)}) is a no-op, never a drain`);
  }
  assert.equal(restoreHearts(e, '2').hearts, 4, 'a numeric string still coerces cleanly');

  // REGRESSION (was a bug, now fixed): a non-finite n used to poison `hearts` to
  // NaN, and normalizeEconomy's fallback for a non-finite hearts value is
  // HEART_MAX, so a garbage restore silently handed the user a FULL bar. Free
  // lives the day hearts become spendable. A garbage restore must be a no-op.
  // (`undefined` is excluded on purpose: it triggers the `n = 1` default param,
  // which is the intended behaviour, not a garbage value.)
  for (const bad of [NaN, 'x', {}, [], null]) {
    const r = restoreHearts(e, bad);
    assert.equal(r.hearts, e.hearts, `garbage restore (${String(bad)}) changes nothing`);
    assert.equal(normalizeEconomy(r).hearts, e.hearts, '...and survives a normalize round-trip');
  }
  assert.equal(restoreHearts(e, undefined).hearts, e.hearts + 1, 'undefined uses the n = 1 default');
  assert.equal(restoreHearts(e, Infinity).hearts, e.hearts, 'Infinity is garbage, not a free refill');

  assert.deepEqual(e, snap, 'restoreHearts is pure');
  assert.equal(restoreHearts(null, 1).hearts, HEART_MAX, 'a fresh wallet is already full');
}

// ---- withRegenHearts: time is INJECTED, never read from a clock ----
{
  const T0 = 1783100000000;

  // Full bar: the clock is cleared, nothing else moves.
  const full = withRegenHearts({ hearts: HEART_MAX, heartsTs: 12345 }, T0);
  assert.equal(full.hearts, HEART_MAX);
  assert.equal(full.heartsTs, 0);

  // Drained with no clock running: the clock STARTS now, no free heart.
  const started = withRegenHearts({ hearts: 1, heartsTs: 0 }, T0);
  assert.equal(started.hearts, 1, 'starting the clock does not itself grant a heart');
  assert.equal(started.heartsTs, T0);

  // Before one full interval: nothing.
  const early = withRegenHearts({ hearts: 1, heartsTs: T0 }, T0 + HEART_REGEN_MS - 1);
  assert.equal(early.hearts, 1, 'a partial interval regenerates nothing');
  assert.equal(early.heartsTs, T0, 'and does not slide the clock');

  // Exactly one interval → exactly one heart, and the clock advances by ONE interval
  // (the remainder is carried, so no time is silently lost or double-counted).
  const one = withRegenHearts({ hearts: 1, heartsTs: T0 }, T0 + HEART_REGEN_MS);
  assert.equal(one.hearts, 2);
  assert.equal(one.heartsTs, T0 + HEART_REGEN_MS);
  const oneAndAHalf = withRegenHearts({ hearts: 1, heartsTs: T0 }, T0 + HEART_REGEN_MS * 1.5);
  assert.equal(oneAndAHalf.hearts, 2, 'partial intervals do not round up');
  assert.equal(oneAndAHalf.heartsTs, T0 + HEART_REGEN_MS, 'the half interval is carried forward');

  // Many intervals: capped at HEART_MAX and the clock is cleared.
  const capped = withRegenHearts({ hearts: 0, heartsTs: T0 }, T0 + HEART_REGEN_MS * 500);
  assert.equal(capped.hearts, HEART_MAX, 'idling for a month does not overfill');
  assert.equal(capped.heartsTs, 0);

  // A clock in the FUTURE (device-clock skew) never drains hearts.
  const skew = withRegenHearts({ hearts: 2, heartsTs: T0 + 1e9 }, T0);
  assert.equal(skew.hearts, 2, 'a backwards clock cannot take hearts away');

  // Purity + garbage.
  const input = { hearts: 1, heartsTs: T0 };
  const snap = clone(input);
  withRegenHearts(input, T0 + HEART_REGEN_MS * 3);
  assert.deepEqual(input, snap, 'withRegenHearts is pure');
  assert.equal(withRegenHearts(null, T0).hearts, HEART_MAX);
  assert.equal(withRegenHearts('x', T0).heartsTs, 0);
}

console.log('economy.test.js: all assertions passed');
