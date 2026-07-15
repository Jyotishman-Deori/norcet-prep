// =====================================================================
// src/lib/quick-revision.test.js
// Run: node src/lib/quick-revision.test.js
//
// Quick Revision decides WHAT a student revises when time is short, and it had
// no tests at all. Its failure mode is silent: it simply serves fewer cards than
// it promised, or the wrong ones, and nobody notices.
// =====================================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildQuickRevisionPlan, cardBudget, buildRevisionStream, readMinutes, REASON_LABELS,
} from './quick-revision.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CARDS = JSON.parse(readFileSync(join(root, 'public', 'data', 'concept-cards.json'), 'utf8'));
const TOPICS = Object.keys(CARDS);

// ---- cardBudget: it tightens as the exam approaches ----
{
  assert.deepEqual(cardBudget(null), { perTopic: 5, essentialOnly: false }, 'no exam date: the relaxed budget');
  assert.deepEqual(cardBudget(90), { perTopic: 5, essentialOnly: false });
  assert.deepEqual(cardBudget(30), { perTopic: 3, essentialOnly: true }, 'inside a month: essentials only');
  assert.deepEqual(cardBudget(7), { perTopic: 2, essentialOnly: true }, 'final week: a critical sweep');
  assert.deepEqual(cardBudget(0), { perTopic: 2, essentialOnly: true }, 'exam day still works');
  // Garbage never throws and never yields a nonsense budget.
  for (const bad of [undefined, NaN, 'x', {}, -5]) {
    const b = cardBudget(bad);
    assert.ok(b.perTopic > 0, `budget for ${String(bad)} is still positive`);
  }
}

// ---- the plan: priority order, and no duplicate topics ----
{
  const availableTopics = ['fund', 'msn', 'pharm', 'peds'];
  const plan = buildQuickRevisionPlan({
    weakTopics: [{ topic: 'pharm' }],
    dueTopicIds: ['msn'],
    recentTopics: ['fund'],
    availableTopics,
    examDaysLeft: null,
  });
  assert.equal(plan[0].topic, 'pharm', 'a WEAK topic outranks everything');
  assert.equal(plan[0].reason, 'weak');
  assert.equal(plan[1].topic, 'msn', 'then DUE for review');
  assert.equal(plan[1].reason, 'due');

  // A topic appears at most ONCE, even when it qualifies several ways.
  const ids = plan.map(p => p.topic);
  assert.equal(new Set(ids).size, ids.length, 'no topic is listed twice');

  // Every reason has a user facing label, or the UI renders a blank chip.
  for (const p of plan) {
    assert.ok(REASON_LABELS[p.reason], `reason "${p.reason}" has a label`);
  }
}

// ---- the plan never invents a topic that has no cards ----
{
  const plan = buildQuickRevisionPlan({
    weakTopics: [{ topic: 'does-not-exist' }],
    dueTopicIds: ['also-fake'],
    recentTopics: ['nope'],
    availableTopics: ['fund'],
    examDaysLeft: 10,
  });
  assert.ok(plan.every(p => p.topic === 'fund'), 'only AVAILABLE topics can be planned');
  assert.ok(plan.length > 0, 'and it still produces a plan');
}

// ---- the plan is never EMPTY (a brand new user with no history) ----
{
  const plan = buildQuickRevisionPlan({ availableTopics: ['fund', 'msn'] });
  assert.ok(plan.length > 0, 'a brand new user still gets a revision plan');
  assert.equal(plan[0].reason, 'broad', 'falling back to broad coverage');

  assert.deepEqual(buildQuickRevisionPlan({ availableTopics: [] }), [], 'no topics: an empty plan, not a crash');
  assert.deepEqual(buildQuickRevisionPlan({}), [], 'no args at all');
}

// ---- THE BUG THIS CONTENT BUILD FIXED: the budget must be FILLABLE ----
{
  // cardBudget asks for 5 cards per topic. Before the content build, 7 of the 10
  // nursing topics had FEWER THAN 5 CARDS IN TOTAL, so Quick Revision silently
  // under-delivered on almost every topic it chose. Assert against the REAL
  // content that every topic can now actually fill the relaxed budget.
  const budget = cardBudget(null);   // perTopic: 5
  for (const topic of TOPICS) {
    const plan = [{ topic, reason: 'broad' }];
    const stream = buildRevisionStream(plan, CARDS, budget);
    assert.equal(stream.length, budget.perTopic,
      `${topic}: Quick Revision promised ${budget.perTopic} cards and delivered ${stream.length}`);
  }
}

// ---- and the ESSENTIAL-ONLY budget must be fillable too ----
{
  // Inside 30 days the budget keeps only keypoints/concept/mnemonic cards. The
  // aptitude topic used to have NONE of those (its cards were all whatTests/
  // method/worked/mistake), so it vanished from revision entirely near the exam.
  const budget = cardBudget(30);     // perTopic: 3, essentialOnly: true
  for (const topic of TOPICS) {
    const stream = buildRevisionStream([{ topic, reason: 'highyield' }], CARDS, budget);
    assert.equal(stream.length, budget.perTopic,
      `${topic}: the essentials-only budget delivered ${stream.length} of ${budget.perTopic}`);
    for (const item of stream) {
      assert.ok(['keypoints', 'concept', 'mnemonic'].includes(item.card.type),
        `${topic}: essentialOnly served a "${item.card.type}" card`);
    }
  }
}

// ---- the stream: doubts come FIRST, and are never served twice ----
{
  const topic = TOPICS[0];
  const firstCard = CARDS[topic][0].cards[0];
  const stream = buildRevisionStream(
    [{ topic, reason: 'broad' }],
    CARDS,
    { perTopic: 5, essentialOnly: false },
    [{ topic, cardTitle: firstCard.title, text: 'unclear' }],
  );
  assert.equal(stream[0].reason, 'doubt', 'a flagged card is surfaced FIRST');
  assert.equal(stream[0].card.title, firstCard.title);

  // ...and it must not then reappear in the normal stream.
  const titles = stream.map(s => s.card.title);
  assert.equal(new Set(titles).size, titles.length, 'no card is served twice in one stream');
}

// ---- a doubt on a card that no longer exists is dropped, not crashed on ----
{
  const stream = buildRevisionStream(
    [{ topic: TOPICS[0], reason: 'broad' }],
    CARDS,
    { perTopic: 2, essentialOnly: false },
    [{ topic: TOPICS[0], cardTitle: 'A Card That Was Deleted', text: 'x' }],
  );
  assert.ok(stream.every(s => s.reason !== 'doubt'), 'a stale doubt is silently skipped');
  assert.ok(stream.length > 0, 'and the rest of the stream still builds');
}

// ---- degenerate inputs never throw ----
{
  assert.deepEqual(buildRevisionStream([], CARDS, cardBudget(null)), [], 'empty plan');
  assert.deepEqual(buildRevisionStream([{ topic: 'ghost', reason: 'broad' }], CARDS, cardBudget(null)), [],
    'a topic with no cards yields nothing, rather than throwing');
  assert.deepEqual(buildRevisionStream([{ topic: 'fund', reason: 'broad' }], null, cardBudget(null)), [],
    'null content is survivable');
  assert.deepEqual(buildRevisionStream(null, null, null), [], 'everything null');
}

// ---- readMinutes ----
{
  assert.equal(readMinutes([]), 1, 'never zero minutes, that would read as an error');
  assert.equal(readMinutes(null), 1);
  const many = CARDS[TOPICS[0]][0].cards;
  assert.ok(readMinutes(many) >= 1);
  assert.ok(Number.isFinite(readMinutes(many)), 'always a finite number');
  // An array body (keypoints) is counted, not stringified to "[object Object]".
  const bullets = readMinutes([{ title: 'T', body: ['one two three', 'four five six'] }]);
  assert.ok(bullets >= 1);
}

console.log('quick-revision.test.js: all assertions passed');
