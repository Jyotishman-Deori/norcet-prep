// Contract test for src/lib/doubt-matrix.js — runnable under Node:
//   node src/lib/doubt-matrix.test.js
import assert from 'node:assert/strict';

const { QUADRANTS, QUADRANT_META, doubtMatrixFromHistory, doubtMatrixInsight, emptyDoubtMatrix } =
  await import('./doubt-matrix.js');

const att = (conf, correct, ts = 1, extra = {}) => ({ ts, conf, correct, ...extra });

// ---- empty / malformed input: hasData false, zeroed cells, no crash ----
{
  for (const input of [undefined, null, {}, { q1: {} }, { q1: { attempts: [] } }, 'nonsense']) {
    const m = doubtMatrixFromHistory(input);
    assert.equal(m.hasData, false);
    assert.equal(m.total, 0);
    QUADRANTS.forEach((q) => assert.equal(m.cells[q].n, 0));
  }
  assert.equal(emptyDoubtMatrix().hasData, false);
}

// ---- all four quadrants classify per the spec table ----
{
  const m = doubtMatrixFromHistory({
    q1: { attempts: [att('sure', true)] },     // sweet
    q2: { attempts: [att('sure', false)] },    // fatal
    q3: { attempts: [att('guess', true)] },    // lucky
    q4: { attempts: [att('unsure', false)] },  // gap
  });
  assert.equal(m.hasData, true);
  assert.equal(m.total, 4);
  assert.deepEqual(
    QUADRANTS.map((q) => m.cells[q].n),
    [1, 1, 1, 1]);
  assert.deepEqual(m.cells.sweet.qIds, ['q1']);
  assert.deepEqual(m.cells.fatal.qIds, ['q2']);
  assert.deepEqual(m.cells.lucky.qIds, ['q3']);
  assert.deepEqual(m.cells.gap.qIds, ['q4']);
  // 'unsure' AND 'guess' are both the low band per the spec's 2-level table.
  assert.equal(QUADRANT_META.lucky.conf, 'low');
  assert.equal(QUADRANT_META.gap.conf, 'low');
}

// ---- revealed and conf-less attempts are ignored (legacy safety) ----
{
  const m = doubtMatrixFromHistory({
    q1: { attempts: [att('sure', true, 1, { revealed: true }), { ts: 2, correct: true }, att('bogus', true, 3)] },
  });
  assert.equal(m.hasData, false);
  assert.equal(m.total, 0);
}

// ---- n counts attempts; qIds dedupe with the LATEST attempt winning ----
{
  const m = doubtMatrixFromHistory({
    // Was a fatal miss at ts=1, fixed and sure-correct at ts=9.
    q1: { attempts: [att('sure', false, 1), att('sure', true, 9)] },
  });
  assert.equal(m.total, 2);
  assert.equal(m.cells.fatal.n, 1);
  assert.equal(m.cells.sweet.n, 1);
  assert.deepEqual(m.cells.fatal.qIds, [], 'question moved out of fatal after the later attempt');
  assert.deepEqual(m.cells.sweet.qIds, ['q1']);
}

// ---- pct sums to ~100 and reflects the split ----
{
  const m = doubtMatrixFromHistory({
    q1: { attempts: [att('sure', true), att('sure', true), att('sure', true)] },
    q2: { attempts: [att('guess', false)] },
  });
  assert.equal(m.cells.sweet.pct, 75);
  assert.equal(m.cells.gap.pct, 25);
}

// ---- insight fires only on fatal volume ----
{
  const clean = doubtMatrixFromHistory({ q1: { attempts: [att('sure', true)] } });
  assert.equal(doubtMatrixInsight(clean), null);
  assert.equal(doubtMatrixInsight(emptyDoubtMatrix()), null);

  const risky = doubtMatrixFromHistory({ q1: { attempts: [att('sure', false)] } });
  const ins = doubtMatrixInsight(risky);
  assert.equal(ins.kind, 'fatal');
  assert.match(ins.text, /sure but were wrong/);
}

console.log('doubt-matrix.test.js: all passed');
