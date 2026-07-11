// Contract test for src/lib/assistant.js — runnable under Node:
//   node src/lib/assistant.test.js
import assert from 'node:assert/strict';
import { tokenize, detectIntent, matchKb, replyFor, notHelpfulReply, followupsFor, kbById } from './assistant.js';
import { ASSISTANT_KB, QUICK_STARTS, KB_CATEGORIES } from '../data/assistant-kb.js';

const pick0 = () => 0; // deterministic pool picks

// ---- KB integrity ----------------------------------------------------
{
  const ids = new Set();
  for (const e of ASSISTANT_KB) {
    assert.ok(e.id && typeof e.id === 'string', 'entry id required');
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    assert.ok(typeof e.q === 'string' && e.q.length > 4, `${e.id}: q required`);
    assert.ok(typeof e.a === 'string' && e.a.length > 20, `${e.id}: a required`);
    assert.ok(KB_CATEGORIES[e.cat], `${e.id}: unknown cat ${e.cat}`);
    assert.ok(Array.isArray(e.keywords) && e.keywords.length >= 2, `${e.id}: keywords`);
    // Display-copy hard rule: no em dashes, no double hyphens, anywhere.
    for (const s of [e.q, e.a, e.routeLabel || '']) {
      assert.ok(!s.includes('—'), `${e.id}: em dash in copy`);
      assert.ok(!s.includes('--'), `${e.id}: double hyphen in copy`);
    }
    // Every related id must resolve (checked after the loop too, but catch
    // obvious typos early with a soft pass here).
  }
  for (const e of ASSISTANT_KB) {
    for (const r of e.related || []) assert.ok(ASSISTANT_KB.some((x) => x.id === r), `${e.id}: broken related '${r}'`);
  }
  for (const qsId of QUICK_STARTS) assert.ok(ids.has(qsId), `quick start '${qsId}' missing`);
}

// ---- tokenize ----------------------------------------------------------
{
  assert.deepEqual(tokenize('How do STREAKS work??'), ['how', 'streaks', 'work']);
  assert.deepEqual(tokenize('the a an is'), []); // stopwords drop
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(null), []);
}

// ---- intents -----------------------------------------------------------
{
  assert.equal(detectIntent('thanks a lot!'), 'thanks');
  assert.equal(detectIntent('Shukriya yaar'), 'thanks');
  assert.equal(detectIntent('hi'), 'greeting');
  assert.equal(detectIntent('hello there'), 'greeting');
  assert.equal(detectIntent('this is not working at all'), 'frustration');
  assert.equal(detectIntent('bakwas app'), 'frustration');
  assert.equal(detectIntent('love this app!'), 'praise');
  assert.equal(detectIntent('bye'), 'bye');
  assert.equal(detectIntent('how do streaks work'), null);
  // 'hi' must not fire from inside words ("this", "which")
  assert.equal(detectIntent('which test should i take'), null);
}

// ---- matching ----------------------------------------------------------
{
  const m = matchKb(ASSISTANT_KB, 'how do streaks work', null);
  assert.equal(m.best.id, 'streak-rules');
  assert.equal(m.confidence, 'high');
}
{
  const m = matchKb(ASSISTANT_KB, 'negative marking', null);
  assert.ok(['advanced-test', 'net-score'].includes(m.best.id), `got ${m.best.id}`);
}
{
  const m = matchKb(ASSISTANT_KB, 'install on iphone', null);
  assert.equal(m.best.id, 'install-app');
}
{
  const m = matchKb(ASSISTANT_KB, 'forgot my password', null);
  assert.equal(m.best.id, 'forgot-password');
}
{
  // context boost: a vague follow-up leans toward the previous entry's
  // related pool instead of a random keyword hit.
  const prev = kbById(ASSISTANT_KB, 'streak-rules');
  const ctx = { id: prev.id, cat: prev.cat, related: prev.related };
  const m = matchKb(ASSISTANT_KB, 'and the leaderboard?', ctx);
  assert.equal(m.best.id, 'leaderboard-basics');
}
{
  const m = matchKb(ASSISTANT_KB, 'zzz qqq xxyyzz', null);
  assert.equal(m.best, null);
  assert.equal(m.confidence, 'low');
}

// ---- replies -----------------------------------------------------------
{
  const r = replyFor(ASSISTANT_KB, 'how do streaks work?', null, { pick: pick0 });
  assert.equal(r.kind, 'answer');
  assert.equal(r.entryId, 'streak-rules');
  assert.ok(r.followups.length >= 1);
  assert.ok(r.ctx && r.ctx.id === 'streak-rules');
  assert.equal(r.route.screen, 'stats');
}
{
  const r = replyFor(ASSISTANT_KB, 'thanks!', null, { companionName: 'Nova', pick: pick0 });
  assert.equal(r.kind, 'chitchat');
  assert.equal(r.mood, 'happy');
  assert.ok(r.text.length > 10);
}
{
  const r = replyFor(ASSISTANT_KB, 'this app is not working', null, { pick: pick0 });
  // frustration with no clear KB question -> concerned chitchat + escalate
  assert.equal(r.mood, 'concerned');
  assert.equal(r.escalate, true);
}
{
  const r = replyFor(ASSISTANT_KB, 'flibber jabber wocky', null, { pick: pick0 });
  assert.equal(r.kind, 'noMatch');
  assert.equal(r.escalate, true);
  assert.equal(r.followups.length, 3);
}
{
  const r = notHelpfulReply({ pick: pick0 });
  assert.equal(r.mood, 'concerned');
  assert.equal(r.escalate, true);
}
{
  const e = kbById(ASSISTANT_KB, 'mistake-vault');
  const f = followupsFor(ASSISTANT_KB, e);
  assert.ok(f.length >= 1 && f.every((x) => x.id && x.q));
}

console.log('assistant.test: OK');
