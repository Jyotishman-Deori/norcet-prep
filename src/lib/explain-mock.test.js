// Contract test for src/lib/explain-mock.js — runnable under Node:
//   node src/lib/explain-mock.test.js
import assert from 'node:assert/strict';
import { composeExplanation, explainMistake, EXPLAIN_DELAY_MS, EXPLAIN_DISCLOSURE } from './explain-mock.js';

const Q = {
  id: 'q1', q: 'Which insulin is rapid acting?',
  options: ['Lispro', 'NPH', 'Glargine', 'Regular'],
  correct: [0],
  exp: 'Lispro has an onset of 10–15 minutes, making it rapid acting.',
  wrong: { 1: 'NPH is intermediate acting (onset 1–2 hours).', 2: 'Glargine is long acting with no peak.' },
};

// ---- wrong pick WITH an authored per-option rationale ----
{
  const t = composeExplanation({ question: Q, pick: [1] });
  assert.match(t, /You answered "NPH"/);
  assert.match(t, /correct answer is "Lispro"/);
  assert.match(t, /WHY YOUR PICK IS WRONG\nNPH is intermediate acting/);
  assert.match(t, /WHY IT'S RIGHT\nLispro has an onset/);
  assert.match(t, /twice in a row/, 'coaches the resolve rule');
  assert.ok(!t.includes('**'), 'plain text, never markdown');
}

// ---- wrong pick WITHOUT a rationale for that option ----
{
  const t = composeExplanation({ question: { ...Q, wrong: {} }, pick: [3] });
  assert.match(t, /You answered "Regular"/);
  assert.ok(!t.includes('WHY YOUR PICK IS WRONG'), 'no fabricated rationale');
  assert.match(t, /WHY IT'S RIGHT/, 'exp still included');
}

// ---- unknown pick (timeout / reveal / pre-pick history) ----
{
  const t = composeExplanation({ question: Q, pick: [] });
  assert.match(t, /didn't lock in an answer/);
  assert.match(t, /correct answer is "Lispro"/);
}

// ---- multi-answer (MSQ): names the correct set; first WRONG pick explained ----
{
  const msq = { ...Q, correct: [0, 3], wrong: { 1: 'NPH is intermediate.' } };
  const t = composeExplanation({ question: msq, pick: [0, 1] });
  assert.match(t, /"Lispro \+ Regular"/, 'correct set joined');
  assert.match(t, /You answered "NPH"/, 'the wrong half of the pick is the teaching point');
  assert.match(t, /WHY YOUR PICK IS WRONG/);
}

// ---- degenerate question degrades, never throws ----
{
  const t = composeExplanation({ question: null, pick: [2] });
  assert.match(t, /the marked answer/);
  assert.equal(typeof composeExplanation(), 'string');
}

// ---- explainMistake: async wrapper, controllable delay, same text ----
{
  const started = Date.now();
  const r = await explainMistake({ question: Q, pick: [1] }, { delayMs: 30 });
  assert.ok(Date.now() - started >= 25, 'simulated delay elapsed');
  assert.equal(r.text, composeExplanation({ question: Q, pick: [1] }));
  const r0 = await explainMistake({ question: Q, pick: [1] }, { delayMs: 0 });
  assert.equal(typeof r0.text, 'string');
}

// ---- constants sane ----
assert.ok(EXPLAIN_DELAY_MS >= 500 && EXPLAIN_DELAY_MS <= 3000, 'delay feels like processing, not lag');
assert.match(EXPLAIN_DISCLOSURE, /no AI/i, 'honest disclosure');

console.log('explain-mock.test.js: all passed');
