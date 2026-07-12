// Contract test for src/lib/cosmetics.js — runnable under Node:
//   node src/lib/cosmetics.test.js
// Pure module (no I/O), so no DOM/build stubs are needed.
//
// Frames are the only thing Coins BUY, so framePrice() is a spend-side gate:
// App.jsx charges framePrice(id) and refuses anything priced <= 0. Prices are
// live-tunable from the game_config row, so the catalog path AND the override
// path are both covered (the override is applied then restored to DEFAULTS).
import assert from 'node:assert/strict';
import { FRAMES, FRAME_IDS, frameDef, framePrice, normalizeFrame, unownedFrames } from './cosmetics.js';
import { DEFAULTS, getConfig, applyRemoteConfig } from './game-config.js';

// ---- FRAME_IDS: the collectible set, 'none' excluded ----
{
  assert.ok(FRAME_IDS.length > 0, 'there are collectible frames');
  assert.ok(!FRAME_IDS.includes('none'), "'none' is the default, not a collectible");
  assert.deepEqual(FRAME_IDS, Object.keys(FRAMES).filter(id => id !== 'none'));
  assert.equal(new Set(FRAME_IDS).size, FRAME_IDS.length, 'no duplicate ids in the catalog');
  for (const id of FRAME_IDS) {
    assert.equal(FRAMES[id].id, id, `${id} carries its own id`);
    assert.ok(FRAMES[id].name && FRAMES[id].rarity, `${id} is a complete def`);
  }
  // The default frame must stay unbuyable-by-construction (price 0, no ring).
  assert.equal(FRAMES.none.price, 0);
  assert.equal(FRAMES.none.ring, null);
}

// ---- frameDef: unknown / null / undefined → the 'none' frame, never a throw ----
{
  for (const id of FRAME_IDS) assert.equal(frameDef(id), FRAMES[id]);
  assert.equal(frameDef('none'), FRAMES.none);
  for (const bad of [undefined, null, '', 'bogus', 42, {}, [], true, 'None', 'GOLD']) {
    assert.equal(frameDef(bad), FRAMES.none, `frameDef(${String(bad)}) falls back to 'none'`);
    assert.equal(frameDef(bad).id, 'none');
  }

  // REGRESSION (was a bug, now fixed): FRAMES is a bare object literal, so
  // `FRAMES[id] || ...` used to resolve INHERITED prototype keys. frameDef(
  // 'toString') handed back a FUNCTION (which ui/framed-avatar.jsx would then try
  // to render) and normalizeFrame('toString') accepted it as a valid equipped id.
  // The lookups are own-property checks now.
  for (const proto of ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__']) {
    assert.equal(frameDef(proto), FRAMES.none, `frameDef('${proto}') is the 'none' frame, not a prototype member`);
    assert.equal(typeof frameDef(proto), 'object', `frameDef('${proto}') is never a function`);
    assert.equal(normalizeFrame(proto), 'none', `'${proto}' is never a valid equipped frame`);
    assert.equal(framePrice(proto), 0, `'${proto}' is priced 0 (unbuyable)`);
    assert.ok(!FRAME_IDS.includes(proto), `'${proto}' is not a collectible id`);
    assert.ok(!unownedFrames([]).includes(proto), `'${proto}' can never drop from a crate`);
  }
}

// ---- framePrice: catalog prices; anything unknown costs 0 (so it can't be bought) ----
{
  for (const id of FRAME_IDS) {
    const p = framePrice(id);
    assert.ok(Number.isFinite(p) && p > 0, `${id} has a real price (${p})`);
    assert.equal(p, DEFAULTS.framePrices[id] ?? FRAMES[id].price, `${id} is priced from the config/catalog`);
  }
  // A bogus id prices at 0, and App.jsx's buy path refuses `price <= 0` — that is
  // what stops "buy a made-up frame for free" from being a thing.
  assert.equal(framePrice('none'), 0, "'none' is never a purchase");
  for (const bad of [undefined, null, '', 'bogus', 42, {}, [], 'toString']) {
    assert.equal(framePrice(bad), 0, `framePrice(${String(bad)}) === 0 (unbuyable)`);
  }
  // Rarity ordering sanity: the epic frame is not cheaper than a common one.
  const common = FRAME_IDS.filter(id => FRAMES[id].rarity === 'common');
  const epic = FRAME_IDS.filter(id => FRAMES[id].rarity === 'epic');
  if (common.length && epic.length) {
    assert.ok(framePrice(epic[0]) >= framePrice(common[0]), 'epic is not cheaper than common');
  }
}

// ---- framePrice: honours the LIVE game_config override, falls back to the catalog ----
{
  const before = getConfig();
  try {
    // A live override wins over the catalog.
    applyRemoteConfig({ framePrices: { gold: 2500 } });
    assert.equal(framePrice('gold'), 2500, 'the live price is charged, not the catalog price');
    assert.equal(framePrice('ember'), DEFAULTS.framePrices.ember, 'un-overridden frames keep their price');

    // A garbage override (non-finite) falls back to the CATALOG price rather than
    // pricing the frame at 0, which would make it free.
    for (const bad of ['400', null, NaN, {}]) {
      applyRemoteConfig({ framePrices: { neon: bad } });
      assert.equal(framePrice('neon'), FRAMES.neon.price, `a ${String(bad)} override falls back to the catalog`);
      assert.ok(framePrice('neon') > 0, 'a corrupt config can never make a frame free');
    }

    // A live price of 0 makes the frame unbuyable (the buy path refuses <= 0),
    // which is the safe direction for a fat-fingered config edit.
    applyRemoteConfig({ framePrices: { royal: 0 } });
    assert.equal(framePrice('royal'), 0);
  } finally {
    applyRemoteConfig(null); // restore DEFAULTS for the rest of the file
  }
  assert.equal(framePrice('gold'), DEFAULTS.framePrices.gold, 'config restored');
  assert.equal(getConfig().framePrices.gold, before.framePrices.gold);
}

// ---- normalizeFrame: only a real frame id survives ----
{
  for (const id of FRAME_IDS) assert.equal(normalizeFrame(id), id);
  assert.equal(normalizeFrame('none'), 'none');
  for (const bad of [undefined, null, '', 'bogus', 42, {}, [], true]) {
    assert.equal(normalizeFrame(bad), 'none', `normalizeFrame(${String(bad)}) → 'none'`);
  }
  // (prototype keys are the one exception — see the frameDef section above)
}

// ---- unownedFrames: the crate drop pool ----
{
  assert.deepEqual(unownedFrames([]), FRAME_IDS, 'own nothing → everything is droppable');
  assert.deepEqual(unownedFrames(FRAME_IDS), [], 'own everything → the pool is EMPTY (nothing left to drop)');
  assert.deepEqual(unownedFrames([...FRAME_IDS, ...FRAME_IDS]), [], 'a duplicated collection is still complete');

  const owned = [FRAME_IDS[0], FRAME_IDS[FRAME_IDS.length - 1]];
  const pool = unownedFrames(owned);
  assert.equal(pool.length, FRAME_IDS.length - 2);
  for (const id of owned) assert.ok(!pool.includes(id), `${id} is owned, so it is out of the pool`);
  for (const id of pool) assert.ok(FRAME_IDS.includes(id), 'the pool only ever contains real frames');

  // Garbage `owned` never throws and never shrinks the pool by accident.
  for (const bad of [null, undefined, 'gold', 42, {}]) {
    assert.deepEqual(unownedFrames(bad), FRAME_IDS, `unownedFrames(${String(bad)}) → the full pool`);
  }
  assert.deepEqual(unownedFrames(['not-a-frame', 'none']), FRAME_IDS, 'junk ownership entries own nothing');
  assert.ok(!unownedFrames([]).includes('none'), "'none' is never a drop");

  // Preserves catalog order, so a crate rng of 0 always picks the same frame.
  assert.deepEqual(unownedFrames([FRAME_IDS[1]]), FRAME_IDS.filter(id => id !== FRAME_IDS[1]));
}

console.log('cosmetics.test.js: all assertions passed');
