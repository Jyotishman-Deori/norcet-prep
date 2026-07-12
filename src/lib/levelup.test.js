// Contract test for src/lib/levelup.js — runnable under Node:
//   node src/lib/levelup.test.js
// Pure module (no I/O), so no DOM/build stubs are needed.
//
// This is the XP/level/quest/crate engine — the thing that decides how much
// CURRENCY a user gets — so every expectation here is DERIVED from getConfig()
// (xp curve, daily cap, quest defs, crate odds) instead of hardcoded. The knobs
// are live-tunable from the game_config row (reqScale is currently 0.2, a
// deliberate 5x test setting), and a rebalance must not turn this test red.
// Anything random takes an INJECTED rng, so nothing here is flaky.
import assert from 'node:assert/strict';
import {
  MAX_LEVEL, TIERS, xpToNext, progress, tierFor, nextTier,
  normalizeLevelup, equipFrame, completeGame,
  dailyQuestIds, questState, claimQuest,
  crateOdds, rollCrate, openCrate, dailyRemaining,
} from './levelup.js';
import { getConfig } from './game-config.js';
import { FRAME_IDS } from './cosmetics.js';
import { weekStartStr } from './utils.js';

const CAP = getConfig().xp.dailyCap;
const QUESTS = getConfig().quests;
const ODDS = crateOdds();

const TODAY = '2026-07-15';      // Wednesday
const TOMORROW = '2026-07-16';
const LAST_WEEK = '2026-07-09';
const WK = weekStartStr(new Date(`${TODAY}T00:00:00Z`));

const clone = (o) => JSON.parse(JSON.stringify(o));
// Deterministic rng: yields the given values in order, then sticks on the last.
const seqRng = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
// Total XP needed to sit exactly AT level n (i.e. progress(x).level === n, into 0).
const xpAtLevel = (n) => { let t = 0; for (let l = 1; l < n; l++) t += xpToNext(l); return t; };
// An rng() value that lands rollCrate() squarely in the middle of tier `id`.
function rngForTier(id) {
  const total = ODDS.reduce((s, o) => s + o.weight, 0);
  let cum = 0;
  for (const o of ODDS) { if (o.id === id) return (cum + o.weight / 2) / total; cum += o.weight; }
  throw new Error(`no crate tier '${id}' in config`);
}
const tierDef = (id) => ODDS.find(o => o.id === id);
// A levelup blob whose windows are already open on TODAY (no rollover surprises).
const luToday = (over = {}) => normalizeLevelup({
  xp: 0, dailyDate: TODAY, dailyXp: 0, dailyGames: 0, weekStart: WK, weekXp: 0, ...over,
});

// ---- xpToNext: floor of 10, monotonic, Infinity at the ceiling ----
{
  for (let l = 1; l < MAX_LEVEL; l++) {
    const need = xpToNext(l);
    assert.ok(Number.isFinite(need), `xpToNext(${l}) finite below MAX_LEVEL`);
    assert.ok(need >= 10, `xpToNext(${l}) never dips below the floor of 10 (got ${need})`);
  }
  for (let l = 1; l < MAX_LEVEL - 1; l++) {
    assert.ok(xpToNext(l + 1) >= xpToNext(l), `xpToNext must not fall from ${l} to ${l + 1}`);
  }
  assert.ok(xpToNext(MAX_LEVEL - 1) > xpToNext(1), 'the curve genuinely rises');
  assert.equal(xpToNext(MAX_LEVEL), Infinity, 'no level beyond MAX_LEVEL to buy');
  assert.equal(xpToNext(MAX_LEVEL + 500), Infinity);
  // Garbage level clamps to >= 1 and floors, never throws.
  assert.equal(xpToNext(0), xpToNext(1));
  assert.equal(xpToNext(-99), xpToNext(1));
  assert.equal(xpToNext(3.9), xpToNext(3));
}

// ---- progress: consistent into/span/pct, exact thresholds ----
{
  const p0 = progress(0);
  assert.equal(p0.level, 1, '0 XP is level 1');
  assert.equal(p0.into, 0);
  assert.equal(p0.span, xpToNext(1));
  assert.equal(p0.pct, 0);

  // Sweep: the invariants hold at every point of the curve.
  for (const xp of [0, 1, 9, 25, 100, 500, 1234, 9999, 50000, 250000]) {
    const p = progress(xp);
    assert.ok(p.level >= 1 && p.level <= MAX_LEVEL, `level in range for ${xp}`);
    assert.equal(p.xp, xp);
    assert.ok(p.into >= 0, `into >= 0 for ${xp}`);
    assert.equal(p.span, p.level >= MAX_LEVEL ? 0 : xpToNext(p.level));
    if (p.span > 0) {
      assert.ok(p.into < p.span, `into < span for ${xp} (else the level should have ticked over)`);
      assert.equal(p.pct, Math.min(100, Math.round((p.into / p.span) * 100)));
    }
    assert.ok(p.pct >= 0 && p.pct <= 100, `pct in 0..100 for ${xp}`);
    assert.equal(p.into + xpAtLevel(p.level), xp, `into + XP-consumed-by-earlier-levels === total (${xp})`);
  }

  // Level-up lands EXACTLY on the threshold, not one XP early or late.
  const need1 = xpToNext(1);
  assert.equal(progress(need1 - 1).level, 1, 'one XP short is still level 1');
  assert.equal(progress(need1 - 1).into, need1 - 1, 'the last XP sits INSIDE the level, unbanked');
  assert.equal(progress(need1).level, 2, 'exactly on the threshold levels up');
  assert.equal(progress(need1).into, 0);
  assert.equal(progress(need1).pct, 0);
  assert.equal(progress(xpAtLevel(7)).level, 7);
  assert.equal(progress(xpAtLevel(7) - 1).level, 6);
}

// ---- progress: garbage never throws, never yields a level below 1 ----
{
  for (const bad of [null, undefined, NaN, -5, -1e9, [], false, '', 0]) {
    const p = progress(bad);
    assert.ok(p.level >= 1, `level >= 1 for ${String(bad)}`);
    assert.equal(p.level, 1, `${String(bad)} floors to level 1`);
    assert.equal(p.into, 0);
    assert.equal(p.pct, 0);
  }
  // A numeric STRING still resolves sanely (it coerces cleanly).
  assert.equal(progress(String(xpAtLevel(4))).level, 4);

  // REGRESSION (was a bug, now fixed): a truthy NON-numeric value ('x', {}) used
  // to survive `xpTotal || 0` as NaN, and because every `used + need > NaN`
  // comparison is false the loop ran to the ceiling: a corrupt blob was reported
  // as MAX_LEVEL with into: NaN. Corrupt input must read as level 1, not legend.
  for (const bad of ['x', {}, NaN, Infinity, -Infinity, [], () => {}]) {
    const p = progress(bad);
    assert.equal(p.level, 1, `corrupt XP (${String(bad)}) must be level 1, never MAX_LEVEL`);
    assert.equal(p.into, 0);
    assert.ok(Number.isFinite(p.pct), 'pct is never NaN');
  }
}

// ---- progress: a huge XP value clamps at MAX_LEVEL (span 0 / pct 100) ----
{
  const top = xpAtLevel(MAX_LEVEL);
  for (const xp of [top, top + 1, 1e12]) {
    const p = progress(xp);
    assert.equal(p.level, MAX_LEVEL, 'clamped at the ceiling');
    assert.equal(p.span, 0, 'no span left at MAX_LEVEL');
    assert.equal(p.pct, 100);
  }
  assert.equal(progress(top - 1).level, MAX_LEVEL - 1, 'one XP short of the ceiling');
}

// ---- tiers ----
{
  assert.equal(tierFor(1).id, TIERS[0].id);
  assert.equal(tierFor(MAX_LEVEL).id, TIERS[TIERS.length - 1].id);
  assert.equal(tierFor(0).id, TIERS[0].id, 'garbage clamps to the first tier');
  assert.equal(tierFor(null).id, TIERS[0].id);
  assert.equal(nextTier(MAX_LEVEL), null, 'top tier has no next');
  assert.equal(nextTier(1).id, TIERS[1].id);
  for (let l = 1; l <= MAX_LEVEL; l++) assert.ok(tierFor(l), `every level has a tier (${l})`);
}

// ---- normalizeLevelup: defaults, clamps, DE-DUPE, ownership invariant ----
{
  const DEFAULT = { xp: 0, dailyDate: '', dailyXp: 0, dailyGames: 0, weekStart: '', weekXp: 0, questClaims: [], crates: 0, cosmetics: [], frame: 'none' };
  assert.deepEqual(normalizeLevelup(null), DEFAULT);
  assert.deepEqual(normalizeLevelup(undefined), DEFAULT);
  assert.deepEqual(normalizeLevelup(42), DEFAULT);
  assert.deepEqual(normalizeLevelup('x'), DEFAULT);
  assert.deepEqual(normalizeLevelup([]), DEFAULT);
  assert.deepEqual(normalizeLevelup({}), DEFAULT);

  // Negative clamps to 0; floats floor; non-finite falls back to the default.
  const n = normalizeLevelup({ xp: -500, dailyXp: -1, dailyGames: -3, crates: -2, weekXp: -7 });
  assert.equal(n.xp, 0, 'XP can never go negative');
  assert.equal(n.dailyXp, 0);
  assert.equal(n.dailyGames, 0);
  assert.equal(n.crates, 0, 'crates can never go negative');
  assert.equal(n.weekXp, 0);
  const f = normalizeLevelup({ xp: 10.9, dailyXp: 7.6, dailyGames: 2.9, crates: 1.8, weekXp: 3.3 });
  assert.deepEqual(
    [f.xp, f.dailyXp, f.dailyGames, f.crates, f.weekXp],
    [10, 7, 2, 1, 3],
    'floats floored (never round UP into free currency)',
  );
  const g = normalizeLevelup({ xp: NaN, dailyXp: Infinity, crates: '5', dailyDate: 7, weekStart: null });
  assert.deepEqual([g.xp, g.dailyXp, g.crates, g.dailyDate, g.weekStart], [0, 0, 0, '', '']);

  // Unknown frame ids are dropped from `cosmetics`.
  const c = normalizeLevelup({ cosmetics: ['gold', 'not-a-frame', 'none', 42, null, 'ember'] });
  assert.deepEqual(c.cosmetics, ['gold', 'ember'], "'none' and junk are not ownable");

  // DUPLICATES ARE DE-DUPED. Regression: a double-tap on Buy pushed 'gold' in
  // twice and the hub rendered an impossible "7/6 unlocked".
  const dupe = normalizeLevelup({ cosmetics: ['gold', 'gold', 'gold', 'ember', 'ember'], frame: 'gold' });
  assert.deepEqual(dupe.cosmetics, ['gold', 'ember']);
  assert.equal(dupe.cosmetics.length, 2);
  assert.ok(dupe.cosmetics.length <= FRAME_IDS.length, 'you can never own more frames than exist');
  const all = normalizeLevelup({ cosmetics: [...FRAME_IDS, ...FRAME_IDS] });
  assert.equal(all.cosmetics.length, FRAME_IDS.length, 'owning everything twice still owns it once');

  // A frame equipped but NOT owned is reset to 'none'.
  assert.equal(normalizeLevelup({ frame: 'gold', cosmetics: [] }).frame, 'none');
  assert.equal(normalizeLevelup({ frame: 'gold', cosmetics: ['ember'] }).frame, 'none');
  assert.equal(normalizeLevelup({ frame: 'gold', cosmetics: ['gold'] }).frame, 'gold', 'owned stays equipped');
  assert.equal(normalizeLevelup({ frame: 'bogus', cosmetics: ['bogus'] }).frame, 'none', 'unknown id can never be equipped');
  assert.equal(normalizeLevelup({ frame: 42 }).frame, 'none');
  assert.equal(normalizeLevelup({ frame: 'none' }).frame, 'none');

  // questClaims: de-duped, non-strings dropped.
  const q = normalizeLevelup({ questClaims: ['play1', 'play1', 'play1', 7, null, 'xp120'] });
  assert.deepEqual(q.questClaims, ['play1', 'xp120']);
}

// ---- equipFrame: only what you own ----
{
  const owned = luToday({ cosmetics: ['ember', 'gold'] });
  assert.equal(equipFrame(owned, 'gold').frame, 'gold');
  assert.equal(equipFrame(owned, 'neon').frame, 'none', 'cannot equip an unowned frame');
  assert.equal(equipFrame(equipFrame(owned, 'gold'), 'none').frame, 'none');
  assert.equal(equipFrame(owned, 'bogus').frame, 'none');
  const snap = clone(owned);
  equipFrame(owned, 'gold');
  assert.deepEqual(owned, snap, 'equipFrame is pure');
}

// ---- completeGame: awards, daily cap, rollover, level-up, purity ----
{
  // Purity: the input object is never mutated.
  const input = { xp: 100, dailyDate: TODAY, dailyXp: 40, dailyGames: 1, weekStart: WK, weekXp: 40, questClaims: [], crates: 0, cosmetics: [], frame: 'none' };
  const snap = clone(input);
  completeGame(input, 250, TODAY);
  assert.deepEqual(input, snap, 'completeGame must not mutate its input');

  // Plain award.
  const r = completeGame(luToday({ xp: 100, dailyXp: 40, dailyGames: 1, weekXp: 40 }), 250, TODAY);
  assert.equal(r.awarded, 250);
  assert.equal(r.levelup.xp, 350);
  assert.equal(r.levelup.dailyXp, 290);
  assert.equal(r.levelup.weekXp, 290);
  assert.equal(r.levelup.dailyGames, 2, 'dailyGames increments');

  // Non-positive / non-finite amounts award nothing but still count the game.
  for (const amt of [0, -500, null, undefined, NaN, false]) {
    const z = completeGame(luToday({ xp: 500, weekXp: 10 }), amt, TODAY);
    assert.equal(z.awarded, 0, `no XP for ${String(amt)}`);
    assert.equal(z.levelup.xp, 500, 'XP unchanged');
    assert.equal(z.levelup.dailyGames, 1);
  }
  // Infinity is GARBAGE, not a free full day's cap. It used to be floored to
  // Infinity and then min()'d down to the whole remaining cap, so one bad call
  // silently handed out a full day of XP. A non-finite award is now worth 0.
  const inf = completeGame(luToday({}), Infinity, TODAY);
  assert.equal(inf.awarded, 0, 'Infinity grants nothing (it certainly does not grant a full day cap)');
  assert.equal(inf.levelup.xp, 0);
  assert.ok(inf.levelup.dailyGames > 0, 'the game still COUNTS as played, it just pays no XP');

  // REGRESSION (was a bug, now fixed): a truthy non-numeric amount used to survive
  // `xpAmount || 0` as NaN and poison xp/dailyXp/weekXp; the blob then normalized
  // back to xp: 0 on the next load, silently WIPING lifetime XP with no error.
  // A garbage award must be worth 0 and must never touch the balance.
  for (const bad of ['abc', {}, NaN, [], null, undefined]) {
    const nanRes = completeGame(luToday({ xp: 500 }), bad, TODAY);
    assert.equal(nanRes.awarded, 0, `garbage award (${String(bad)}) grants nothing`);
    assert.equal(nanRes.levelup.xp, 500, '...and the existing XP is untouched');
    assert.equal(normalizeLevelup(nanRes.levelup).xp, 500, '...and survives a normalize round-trip');
  }
  // A numeric STRING still coerces cleanly (unchanged behaviour).
  assert.equal(completeGame(luToday({ xp: 0 }), '25', TODAY).awarded, 25);
}

// ---- completeGame: the DAILY CAP is the anti-farm bound ----
{
  // Partial room: only the room is granted, the rest is NOT minted.
  const nearCap = completeGame(luToday({ xp: 1000, dailyXp: CAP - 10, weekXp: CAP - 10, dailyGames: 5 }), 500, TODAY);
  assert.equal(nearCap.awarded, 10, 'awarded reflects what was ACTUALLY given');
  assert.equal(nearCap.levelup.xp, 1010, 'xp only rises by the granted amount');
  assert.equal(nearCap.levelup.dailyXp, CAP, 'dailyXp lands exactly on the cap, never over');
  assert.equal(nearCap.levelup.weekXp, CAP - 10 + 10);

  // At the cap: a farming loop of 50 more games mints nothing.
  let lu = nearCap.levelup;
  const xpAtCap = lu.xp;
  for (let i = 0; i < 50; i++) {
    const res = completeGame(lu, 999999, TODAY);
    assert.equal(res.awarded, 0, 'no XP beyond the cap, however many games are replayed');
    assert.equal(res.leveledUp, false, 'a capped grind can never level you up');
    lu = res.levelup;
  }
  assert.equal(lu.xp, xpAtCap, 'XP is unchanged after 50 capped games');
  assert.equal(lu.dailyXp, CAP);
  assert.equal(lu.dailyGames, nearCap.levelup.dailyGames + 50, 'games still counted (quest progress is honest)');
  assert.equal(dailyRemaining(lu, TODAY), 0);

  // A corrupt over-cap dailyXp still yields no XP and no negative "room".
  const over = completeGame(luToday({ dailyXp: CAP + 5000 }), 400, TODAY);
  assert.equal(over.awarded, 0);
  assert.equal(dailyRemaining(luToday({ dailyXp: CAP + 5000 }), TODAY), 0, 'remaining floors at 0');
}

// ---- completeGame: a NEW day rolls the window over ----
{
  const yesterday = normalizeLevelup({
    xp: 5000, dailyDate: TODAY, dailyXp: CAP, dailyGames: 9,
    questClaims: ['play1', 'xp120'], weekStart: WK, weekXp: CAP, crates: 2,
  });
  const rolled = completeGame(yesterday, 200, TOMORROW);
  assert.equal(rolled.levelup.dailyDate, TOMORROW);
  assert.equal(rolled.awarded, 200, 'the new day has a fresh cap');
  assert.equal(rolled.levelup.dailyXp, 200, 'dailyXp reset then credited');
  assert.equal(rolled.levelup.dailyGames, 1, 'dailyGames reset then counted');
  assert.deepEqual(rolled.levelup.questClaims, [], 'questClaims reset for the new day');
  assert.equal(rolled.levelup.xp, 5200, 'lifetime XP survives the rollover');
  assert.equal(rolled.levelup.crates, 2, 'unopened crates survive the rollover');
  assert.equal(rolled.levelup.weekXp, CAP + 200, 'same week: weekXp keeps accumulating');
  assert.equal(dailyRemaining(yesterday, TOMORROW), CAP, 'a new day restores the full cap');

  // A NEW WEEK rolls the weekly accumulator (UTC-Monday), not the lifetime XP.
  const lastWeek = normalizeLevelup({
    xp: 5000, dailyDate: LAST_WEEK, dailyXp: 300, dailyGames: 4,
    weekStart: weekStartStr(new Date(`${LAST_WEEK}T00:00:00Z`)), weekXp: 900,
  });
  const newWeek = completeGame(lastWeek, 100, TODAY);
  assert.equal(newWeek.levelup.weekStart, WK);
  assert.equal(newWeek.levelup.weekXp, 100, 'weekXp reset then credited');
  assert.equal(newWeek.levelup.xp, 5100, 'lifetime XP is never reset');
}

// ---- completeGame: leveledUp / fromLevel / toLevel ----
{
  const need1 = xpToNext(1);
  const one = completeGame(luToday({ xp: need1 - 1 }), 1, TODAY);
  assert.deepEqual(
    [one.leveledUp, one.fromLevel, one.toLevel], [true, 1, 2],
    'the level-up fires exactly ON the threshold',
  );
  const short = completeGame(luToday({ xp: need1 - 2 }), 1, TODAY);
  assert.deepEqual([short.leveledUp, short.fromLevel, short.toLevel], [false, 1, 1], 'one XP short: no level-up');

  // A big award can cross more than one level and reports the true span.
  const target = xpAtLevel(5);
  const multi = completeGame(luToday({ xp: 0 }), Math.min(target, CAP), TODAY);
  const expected = progress(Math.min(target, CAP)).level;
  assert.equal(multi.toLevel, expected);
  assert.equal(multi.fromLevel, 1);
  assert.equal(multi.leveledUp, expected > 1);
}

// ---- dailyQuestIds: deterministic, exactly 3, drawn from the config pool ----
{
  const poolIds = Object.keys(QUESTS);
  const want = Math.min(3, poolIds.length);
  const a = dailyQuestIds(TODAY);
  const b = dailyQuestIds(TODAY);
  assert.deepEqual(a, b, 'same date string → same 3 quests (stable all day)');
  assert.equal(a.length, want, 'exactly 3 quests are drawn');
  assert.equal(new Set(a).size, a.length, 'no duplicate quest in a day');
  for (const id of a) assert.ok(poolIds.includes(id), `${id} is a real quest`);
  assert.deepEqual(dailyQuestIds(TOMORROW), dailyQuestIds(TOMORROW), 'stable for any date');
  if (poolIds.length > want) {
    assert.notDeepEqual(dailyQuestIds(TODAY), dailyQuestIds(TOMORROW), 'the draw varies day to day');
  }
  assert.equal(dailyQuestIds('').length, want, 'an empty date still returns a full, stable set');
  assert.deepEqual(dailyQuestIds(''), dailyQuestIds(''));
}

// Today's 3 quests + a state where all of them are complete (derived, not magic).
const TODAY_IDS = dailyQuestIds(TODAY);
const OFF_ROTA = Object.keys(QUESTS).filter(id => !TODAY_IDS.includes(id));
const goalOf = (metric) => Math.max(0, ...TODAY_IDS.filter(id => QUESTS[id].metric === metric).map(id => QUESTS[id].goal));
const ALL_DONE = luToday({
  xp: 1000,
  dailyGames: goalOf('games'),
  // Sit at/over the cap too, so a claim proves the bonus is NOT cap-limited.
  dailyXp: Math.max(CAP, goalOf('xp')),
  weekXp: Math.max(CAP, goalOf('xp')),
});

// ---- questState: progress / done / claimed, clamped ----
{
  const st = questState(ALL_DONE, TODAY);
  assert.equal(st.length, TODAY_IDS.length);
  for (const q of st) {
    assert.equal(q.done, true);
    assert.equal(q.current, q.goal, 'current is clamped to the goal, never past it');
    assert.equal(q.pct, 100);
    assert.equal(q.claimed, false);
  }
  const fresh = questState(luToday({}), TODAY);
  for (const q of fresh) {
    assert.equal(q.done, false);
    assert.equal(q.current, 0);
    assert.equal(q.pct, 0);
  }
  const claimedOne = questState(luToday({ questClaims: [TODAY_IDS[0]] }), TODAY);
  assert.equal(claimedOne[0].claimed, true);
  assert.equal(claimedOne[1].claimed, false);
}

// ---- claimQuest: refuses unknown / off-rota / incomplete / double claims ----
{
  const before = clone(ALL_DONE);

  const unknown = claimQuest(ALL_DONE, 'no-such-quest', TODAY);
  assert.equal(unknown.claimed, false, 'an unknown quest id awards nothing');
  assert.equal(unknown.levelup.xp, ALL_DONE.xp);
  assert.equal(unknown.awarded, undefined);
  assert.equal(claimQuest(ALL_DONE, null, TODAY).claimed, false);
  assert.equal(claimQuest(ALL_DONE, '', TODAY).claimed, false);

  if (OFF_ROTA.length) {
    // A REAL quest that simply is not one of today's 3 (goals are satisfied!).
    const off = claimQuest(ALL_DONE, OFF_ROTA[0], TODAY);
    assert.equal(off.claimed, false, "a quest outside today's 3 cannot be claimed");
    assert.equal(off.levelup.xp, ALL_DONE.xp, 'and awards no XP');
  }

  const incomplete = claimQuest(luToday({ xp: 1000 }), TODAY_IDS[0], TODAY);
  assert.equal(incomplete.claimed, false, 'an incomplete quest cannot be claimed');
  assert.equal(incomplete.levelup.xp, 1000);
  assert.deepEqual(incomplete.levelup.questClaims, []);

  assert.deepEqual(ALL_DONE, before, 'claimQuest is pure (refused claims mutate nothing)');
}

// ---- claimQuest: valid claim pays UNCAPPED bonus XP, once, and the 3rd earns a crate ----
{
  let lu = ALL_DONE;
  let earned = 0;
  const crates0 = lu.crates;
  for (let i = 0; i < TODAY_IDS.length; i++) {
    const id = TODAY_IDS[i];
    const def = QUESTS[id];
    const beforeXp = lu.xp;
    const beforeDaily = lu.dailyXp;
    const res = claimQuest(lu, id, TODAY);
    assert.equal(res.claimed, true, `${id} claims`);
    assert.equal(res.awarded, def.xp, `${id} pays its configured bonus`);
    assert.equal(res.levelup.xp, beforeXp + def.xp, 'bonus XP is added in full');
    assert.equal(res.levelup.dailyXp, beforeDaily, 'the bonus does NOT count against the daily cap');
    assert.ok(res.levelup.questClaims.includes(id));
    const isLast = i === TODAY_IDS.length - 1;
    assert.equal(res.crateEarned, isLast, `crate only on the LAST of the ${TODAY_IDS.length} quests`);
    assert.equal(res.levelup.crates, crates0 + (isLast ? 1 : 0), 'exactly one crate, and not before');
    earned += def.xp;
    lu = res.levelup;

    // Double claim: no second payout, no second crate.
    const again = claimQuest(lu, id, TODAY);
    assert.equal(again.claimed, false, `${id} cannot be claimed twice`);
    assert.equal(again.levelup.xp, lu.xp, 'a double claim awards nothing');
    assert.equal(again.levelup.crates, lu.crates, 'a double claim mints no crate');
    assert.equal(again.crateEarned, undefined);
  }
  assert.equal(lu.xp, ALL_DONE.xp + earned);
  assert.equal(lu.crates, crates0 + 1, 'clearing the board earns exactly ONE crate per day');
  assert.equal(lu.dailyXp, ALL_DONE.dailyXp, 'the whole quest payout stayed outside the cap');

  // Replaying the whole claim loop mints nothing more (the farming case).
  for (const id of TODAY_IDS) {
    const res = claimQuest(lu, id, TODAY);
    assert.equal(res.claimed, false);
    assert.equal(res.levelup.crates, lu.crates, 'no crate farming by re-claiming');
  }

  // A claim can level you up, and it reports the jump.
  const need = xpToNext(1);
  const def0 = QUESTS[TODAY_IDS[0]];
  const brink = claimQuest({ ...ALL_DONE, xp: Math.max(0, need - def0.xp) }, TODAY_IDS[0], TODAY);
  assert.equal(brink.claimed, true);
  assert.equal(brink.leveledUp, brink.toLevel > brink.fromLevel);
  if (def0.xp >= need) assert.equal(brink.leveledUp, true, 'a bonus that crosses the threshold levels up');

  // A NEW day wipes the claims: the same quests are claimable again tomorrow
  // (that is the intended daily reset, and it is bounded to 1 crate/day).
  const tmr = questState(lu, TOMORROW);
  for (const q of tmr) assert.equal(q.claimed, false, 'claims reset with the day');
}

// ---- rollCrate: every tier is reachable, and the rng is injectable ----
{
  assert.ok(ODDS.length > 0, 'a crate table exists');
  assert.equal(rollCrate(() => 0).id, ODDS[0].id, 'rng 0 → the first tier');
  assert.equal(rollCrate(() => 0.999999).id, ODDS[ODDS.length - 1].id, 'rng ~1 → the last tier');
  assert.equal(rollCrate(() => 1).id, ODDS[0].id, 'an out-of-range rng falls back, never undefined');
  for (const o of ODDS) {
    assert.equal(rollCrate(() => rngForTier(o.id)).id, o.id, `tier ${o.id} is reachable`);
    assert.ok(o.weight > 0 && Number.isFinite(o.coins), `tier ${o.id} is well-formed`);
  }
}

// ---- openCrate: refuses at 0, decrements by exactly 1, never goes negative ----
{
  const none = luToday({ crates: 0, xp: 700 });
  const snap = clone(none);
  const r = openCrate(none, TODAY, () => rngForTier(ODDS[0].id));
  assert.equal(r.opened, false);
  assert.equal(r.reward, null);
  assert.equal(r.leveledUp, false);
  assert.equal(r.levelup.crates, 0, 'crates never go below zero');
  assert.equal(r.levelup.xp, 700, 'no XP from an empty crate');
  assert.deepEqual(none, snap, 'openCrate is pure');

  // Exactly one crate is spent per open; a second open on an emptied balance fails.
  const one = luToday({ crates: 1, xp: 700 });
  const first = openCrate(one, TODAY, seqRng(rngForTier(ODDS[0].id), 0));
  assert.equal(first.opened, true);
  assert.equal(first.levelup.crates, 0, 'decrements by exactly 1');
  const second = openCrate(first.levelup, TODAY, seqRng(rngForTier(ODDS[0].id), 0));
  assert.equal(second.opened, false, 'a double-tap on Open cannot mint a second reward');
  assert.equal(second.reward, null);
  assert.equal(second.levelup.crates, 0);
  assert.deepEqual(one, clone(luToday({ crates: 1, xp: 700 })), 'still pure');
}

// ---- openCrate: the tier's reward is applied; rare/epic drop an unowned frame ----
{
  // A non-frame tier drops NO frame even with an empty collection.
  const plainTier = ODDS.find(o => o.id !== 'rare' && o.id !== 'epic') || ODDS[0];
  const plain = openCrate(luToday({ crates: 1, xp: 500, weekXp: 20 }), TODAY, seqRng(rngForTier(plainTier.id), 0));
  assert.equal(plain.reward.id, plainTier.id);
  assert.equal(plain.reward.frame, null, `'${plainTier.id}' never drops a cosmetic`);
  assert.deepEqual(plain.levelup.cosmetics, []);
  assert.equal(plain.reward.coins, plainTier.coins, 'coins are REPORTED, not applied here (economy owns coins)');
  assert.equal(plain.levelup.xp, 500 + (plainTier.xp || 0));
  assert.equal(plain.levelup.weekXp, 20 + (plainTier.xp || 0));
  assert.equal(plain.levelup.coins, undefined, 'levelup never grows a coins field');

  // A rare/epic tier DOES drop a frame the user does not own — rng injected, so
  // the pick is deterministic: rng() #1 picks the tier, rng() #2 picks the frame.
  for (const id of ['rare', 'epic']) {
    const t = tierDef(id);
    if (!t) continue;
    const start = luToday({ crates: 1, xp: 0, cosmetics: [] });
    const got = openCrate(start, TODAY, seqRng(rngForTier(id), 0));
    assert.equal(got.opened, true);
    assert.equal(got.reward.id, id);
    assert.equal(got.reward.frame, FRAME_IDS[0], `${id} drops the first unowned frame at rng 0`);
    assert.deepEqual(got.levelup.cosmetics, [FRAME_IDS[0]], 'the frame is added to the collection');
    assert.equal(got.levelup.xp, t.xp || 0);

    // Last frame in the pool (rng just under 1) is reachable too.
    const last = openCrate(start, TODAY, seqRng(rngForTier(id), 0.999999));
    assert.equal(last.reward.frame, FRAME_IDS[FRAME_IDS.length - 1]);

    // A frame you already own is never re-dropped (no duplicate in cosmetics).
    const partial = luToday({ crates: 1, cosmetics: [FRAME_IDS[0]] });
    const nodupe = openCrate(partial, TODAY, seqRng(rngForTier(id), 0));
    assert.notEqual(nodupe.reward.frame, FRAME_IDS[0], 'an owned frame is out of the pool');
    assert.equal(new Set(nodupe.levelup.cosmetics).size, nodupe.levelup.cosmetics.length, 'no duplicate ownership');
    assert.equal(nodupe.levelup.cosmetics.length, 2);

    // ALL frames owned → no frame drops, no crash, the rest of the reward still pays.
    const maxed = luToday({ crates: 1, xp: 100, cosmetics: [...FRAME_IDS] });
    const full = openCrate(maxed, TODAY, seqRng(rngForTier(id), 0));
    assert.equal(full.opened, true);
    assert.equal(full.reward.frame, null, 'nothing left to drop');
    assert.equal(full.levelup.cosmetics.length, FRAME_IDS.length, 'collection is unchanged');
    assert.equal(full.levelup.xp, 100 + (t.xp || 0), 'the XP part of the reward still lands');
    assert.equal(full.levelup.crates, 0);
  }

  // Crate XP is uncapped by design, and reports a level-up.
  const xpTier = ODDS.find(o => (o.xp || 0) > 0);
  if (xpTier) {
    const base = Math.max(0, xpToNext(1) - xpTier.xp);
    const lifted = openCrate(luToday({ crates: 1, xp: base, dailyXp: CAP, weekXp: CAP }), TODAY, seqRng(rngForTier(xpTier.id), 0));
    assert.equal(lifted.levelup.xp, base + xpTier.xp, 'crate XP lands even with the daily cap exhausted');
    assert.equal(lifted.levelup.dailyXp, CAP, 'and does not touch dailyXp');
    assert.equal(lifted.leveledUp, lifted.toLevel > lifted.fromLevel);
    assert.equal(lifted.toLevel, progress(base + xpTier.xp).level);
  }
}

// ---- openCrate: rolls the day/week window over like everything else ----
{
  const stale = normalizeLevelup({
    xp: 300, crates: 1, dailyDate: LAST_WEEK, dailyXp: CAP, dailyGames: 9,
    questClaims: ['play1'], weekStart: weekStartStr(new Date(`${LAST_WEEK}T00:00:00Z`)), weekXp: 800,
  });
  const t0 = ODDS[0];
  const res = openCrate(stale, TODAY, seqRng(rngForTier(t0.id), 0));
  assert.equal(res.opened, true);
  assert.equal(res.levelup.dailyDate, TODAY);
  assert.equal(res.levelup.dailyXp, 0, 'the stale daily window is reset');
  assert.deepEqual(res.levelup.questClaims, []);
  assert.equal(res.levelup.weekStart, WK);
  assert.equal(res.levelup.weekXp, t0.xp || 0, 'the stale weekly accumulator is reset');
}

// ---- dailyRemaining ----
{
  assert.equal(dailyRemaining(luToday({ dailyXp: 0 }), TODAY), CAP);
  assert.equal(dailyRemaining(luToday({ dailyXp: 100 }), TODAY), CAP - 100);
  assert.equal(dailyRemaining(luToday({ dailyXp: CAP }), TODAY), 0);
  assert.equal(dailyRemaining(null, TODAY), CAP, 'a missing blob is a fresh day');
  assert.equal(dailyRemaining(luToday({ dailyXp: CAP }), TOMORROW), CAP, 'tomorrow is a clean slate');
}

console.log('levelup.test.js: all assertions passed');
