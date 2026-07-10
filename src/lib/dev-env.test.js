// Contract test for src/lib/dev-env.js — runnable under Node:
//   node src/lib/dev-env.test.js
import assert from 'node:assert/strict';

const { devDataLabel, initDevBadge } = await import('./dev-env.js');

// ---- devDataLabel: the three states ----
{
  // dev serve against the dev project (the safe case)
  assert.equal(devDataLabel({ DEV: true, VITE_ENV_LABEL: 'dev' }), 'DEV DATA');
  // label wins even if DEV is not set (defensive)
  assert.equal(devDataLabel({ VITE_ENV_LABEL: 'dev' }), 'DEV DATA');
  // dev serve WITHOUT the label = silent fallback to production data -> warn
  assert.equal(devDataLabel({ DEV: true }), 'LIVE DATA');
  // production build: no label, DEV false -> inert
  assert.equal(devDataLabel({ DEV: false, PROD: true }), null);
  assert.equal(devDataLabel({}), null);
  assert.equal(devDataLabel(null), null);
  // an unexpected label value is NOT the dev project -> treated like no label
  assert.equal(devDataLabel({ DEV: true, VITE_ENV_LABEL: 'staging' }), 'LIVE DATA');
  assert.equal(devDataLabel({ DEV: false, VITE_ENV_LABEL: 'staging' }), null);
}

// ---- initDevBadge: inert in prod, label returned in dev, never throws without DOM ----
{
  assert.equal(initDevBadge({ DEV: false }), null, 'prod build: no badge, no work');
  // no document in Node: must not throw, still reports the label
  assert.equal(initDevBadge({ DEV: true, VITE_ENV_LABEL: 'dev' }), 'DEV DATA');
  assert.equal(initDevBadge({ DEV: true }), 'LIVE DATA');
}

console.log('dev-env.test.js: all assertions passed');
