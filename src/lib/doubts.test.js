// =====================================================================
// src/lib/doubts.test.js
// Run: node src/lib/doubts.test.js
//
// The doubt store is how a student flags "I do not understand this". Its id
// scheme is topic+title with NO module in the key, and that had a real
// consequence: all 8 aptitude modules shipped the SAME 4 card titles, so
// flagging one flagged all eight. These tests pin the id contract and check the
// live content still honours it.
// =====================================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { register } from 'node:module';

// doubts.js statically imports the storage layer, which reads a Vite-only env
// value and therefore explodes under plain Node. Stub it (in memory, never the
// real store) so the PURE logic above it can finally be tested.
register('../../scripts/stub-storage-loader.mjs', import.meta.url);
const {
  pointId, toggleDoubt, setResolved, listDoubts, unresolved, resolved,
  groupByTopic, unresolvedCount, staleUnresolvedCount, unresolvedCards, relativeAge,
} = await import('./doubts.js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CARDS = JSON.parse(readFileSync(join(root, 'public', 'data', 'concept-cards.json'), 'utf8'));

// ---- pointId: the id contract, and the collision it can cause ----
{
  assert.equal(pointId('msn', 'Shock: Early vs Late Signs'), 'msn::Shock: Early vs Late Signs');
  assert.equal(pointId('msn', 'Card', 0), 'msn::Card::b0', 'a bullet gets its own id');
  assert.equal(pointId('msn', 'Card', 2), 'msn::Card::b2');
  assert.notEqual(pointId('msn', 'Card'), pointId('msn', 'Card', 0), 'card id and bullet-0 id differ');
  assert.equal(pointId('msn', ''), 'msn::', 'never throws on an empty title');
  assert.equal(pointId('msn'), 'msn::');

  // ⚠ THE CONTRACT THAT BIT US: the MODULE is NOT part of the id. So two cards
  // in DIFFERENT modules of the same topic that share a title are THE SAME
  // DOUBT. Flag one and you flag both.
  assert.equal(pointId('apt', 'Worked example'), pointId('apt', 'Worked example'),
    'same topic + same title = the same id, whatever module it lives in');
}

// ---- ...so the live content must never reuse a title within a topic ----
{
  for (const [topic, mods] of Object.entries(CARDS)) {
    const seen = new Map();
    for (const m of mods) {
      for (const c of m.cards) {
        const id = pointId(topic, c.title);
        if (seen.has(id)) {
          assert.fail(`${topic}: "${c.title}" appears in both "${seen.get(id)}" and "${m.sub}". `
            + 'Doubt ids are topic+title, so flagging it in one module flags it in the other.');
        }
        seen.set(id, m.sub);
      }
    }
  }
}

// ---- toggleDoubt: add, then remove ----
{
  const rec = { topic: 'msn', sub: 'Shock', cardTitle: 'Types of Shock', text: 'unclear' };
  const id = pointId('msn', 'Types of Shock');

  const a = toggleDoubt({}, id, rec);
  assert.equal(unresolvedCount(a), 1, 'flagging adds it');
  assert.ok(a[id], 'keyed by the point id');
  assert.equal(a[id].id, id);
  assert.ok(a[id].createdAt > 0, 'stamped with a creation time');

  const b = toggleDoubt(a, id, rec);
  assert.equal(unresolvedCount(b), 0, 'toggling the SAME id removes it');
  assert.ok(!b[id]);

  // Purity: the original map is not mutated.
  assert.equal(unresolvedCount(a), 1, 'toggleDoubt does not mutate its input');
}

// ---- setResolved: resolving does not delete ----
{
  const id = pointId('pharm', 'X');
  let m = toggleDoubt({}, id, { topic: 'pharm', cardTitle: 'X' });
  m = setResolved(m, id, true);

  assert.equal(unresolvedCount(m), 0, 'a resolved doubt leaves the unresolved list');
  assert.equal(resolved(m).length, 1, '...but it is still there, in the resolved list');
  assert.ok(m[id].resolvedAt > 0, 'stamped with a resolve time');

  m = setResolved(m, id, false);
  assert.equal(unresolvedCount(m), 1, 'un-resolving brings it back');
  assert.equal(m[id].resolvedAt, null, 'and clears the timestamp');

  // Resolving an id that does not exist is a no-op, not a crash.
  const before = JSON.stringify(m);
  const after = setResolved(m, 'not::a::real::id', true);
  assert.equal(unresolvedCount(after), 1);
  assert.equal(JSON.stringify(m), before, 'the input map is untouched');
}

// ---- selectors survive a corrupt map ----
{
  for (const bad of [null, undefined, {}, { x: null }, { y: 42 }, { z: 'str' }]) {
    assert.doesNotThrow(() => listDoubts(bad), `listDoubts(${JSON.stringify(bad)})`);
    assert.doesNotThrow(() => unresolved(bad));
    assert.doesNotThrow(() => unresolvedCount(bad));
    assert.doesNotThrow(() => unresolvedCards(bad));
    assert.doesNotThrow(() => groupByTopic(unresolved(bad)));
    assert.ok(Array.isArray(listDoubts(bad)), 'always an array');
  }
  assert.equal(unresolvedCount(null), 0);
  // Non-object entries are filtered out rather than reaching the UI.
  assert.equal(listDoubts({ a: null, b: 7, c: { id: 'c', topic: 't', createdAt: 1 } }).length, 1);
}

// ---- unresolvedCards: one entry per CARD, even when several bullets are flagged ----
{
  const t = 'fund';
  const title = 'Normal Vital Sign Ranges (Adult)';
  let m = {};
  m = toggleDoubt(m, pointId(t, title, 0), { topic: t, cardTitle: title, text: 'b0' });
  m = toggleDoubt(m, pointId(t, title, 1), { topic: t, cardTitle: title, text: 'b1' });
  m = toggleDoubt(m, pointId(t, title, 2), { topic: t, cardTitle: title, text: 'b2' });

  assert.equal(unresolvedCount(m), 3, 'three separate bullets are flagged');
  const cards = unresolvedCards(m);
  assert.equal(cards.length, 1, '...but they collapse to ONE card for revision');
  assert.equal(cards[0].cardTitle, title);
  assert.equal(cards[0].topic, t);
}

// ---- groupByTopic ----
{
  let m = {};
  m = toggleDoubt(m, pointId('msn', 'A'), { topic: 'msn', cardTitle: 'A' });
  m = toggleDoubt(m, pointId('msn', 'B'), { topic: 'msn', cardTitle: 'B' });
  m = toggleDoubt(m, pointId('peds', 'C'), { topic: 'peds', cardTitle: 'C' });

  const g = groupByTopic(unresolved(m));
  assert.equal(g.msn.length, 2);
  assert.equal(g.peds.length, 1);
  assert.deepEqual(groupByTopic([]), {}, 'empty in, empty out');
  assert.deepEqual(groupByTopic(null), {}, 'null in, empty out');
}

// ---- staleUnresolvedCount: the nudge that says "you flagged this a week ago" ----
{
  const DAY = 24 * 60 * 60 * 1000;
  const old = { id: 'a', topic: 'msn', cardTitle: 'A', createdAt: Date.now() - 10 * DAY, resolvedAt: null };
  const fresh = { id: 'b', topic: 'msn', cardTitle: 'B', createdAt: Date.now() - 1 * DAY, resolvedAt: null };
  const done = { id: 'c', topic: 'msn', cardTitle: 'C', createdAt: Date.now() - 30 * DAY, resolvedAt: Date.now() };

  const m = { a: old, b: fresh, c: done };
  assert.equal(staleUnresolvedCount(m, 7), 1, 'only the 10-day-old UNRESOLVED one is stale');
  assert.equal(staleUnresolvedCount(m, 30), 0, 'nothing is 30 days stale');
  assert.equal(staleUnresolvedCount({}, 7), 0);
  assert.equal(staleUnresolvedCount(null, 7), 0);
}

// ---- relativeAge never renders garbage into the UI ----
{
  for (const bad of [null, undefined, NaN, 0, 'x', {}]) {
    const s = relativeAge(bad);
    assert.equal(typeof s, 'string', `relativeAge(${String(bad)}) is a string`);
    assert.ok(!s.includes('NaN'), 'never leaks NaN into the UI');
    assert.ok(!s.includes('undefined'), 'never leaks undefined into the UI');
  }
  assert.equal(typeof relativeAge(Date.now()), 'string');
}

console.log('doubts.test.js: all assertions passed');
