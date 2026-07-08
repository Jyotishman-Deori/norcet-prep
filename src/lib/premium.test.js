// Contract test for src/lib/premium.js — runnable under Node:
//   node src/lib/premium.test.js
//
// premium.js imports game-config.js, which imports ../storage.js. storage.js
// reads import.meta.env at load time (a Vite-only global) and so crashes under
// plain Node. Rather than touch storage.js, we register a tiny ESM load hook
// that swaps that one module for an inert stub before importing anything. The
// premium logic itself is pure — only the storage import needs the stub.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const storageStub = [
  'export const get = async () => null;',
  'export const set = async () => null;',
  'export const del = async () => null;',
  'export const list = async () => ({ keys: [] });',
  'export const isAlive = () => false;',
].join('');

const loaderCode = `
export async function load(url, context, nextLoad) {
  if (url.endsWith('/src/storage.js')) {
    return { format: 'module', shortCircuit: true, source: ${JSON.stringify(storageStub)} };
  }
  return nextLoad(url, context);
}
`;
register('data:text/javascript,' + encodeURIComponent(loaderCode), pathToFileURL(import.meta.url));

const {
  getPremiumConfig, getPremiumPlans, getPremiumFeatures,
  isPremiumEnabled, isTestPhase, isAdSlotEnabled,
  getPremiumState, formatInr, isPremiumUser, cribVaultLocked,
} = await import('./premium.js');
const { applyRemoteConfig, DEFAULTS } = await import('./game-config.js');

// Helper: reset live config back to hardcoded DEFAULTS between groups.
const resetConfig = () => applyRemoteConfig(null);

// ---- defaults when the config block is present (untouched DEFAULTS) ----
resetConfig();
{
  const c = getPremiumConfig();
  assert.equal(c.enabled, true);
  assert.equal(c.testPhase, true);
  assert.equal(c.adSlot, false);
  assert.ok(Array.isArray(c.plans) && c.plans.length === 2, 'default has 2 plans');
  assert.equal(DEFAULTS.premium.enabled, true, 'premium block lives in DEFAULTS');
}

// ---- defaults when the config block is ABSENT (remote nuked it to null) ----
{
  // A remote override that replaces `premium` with a non-object → normalize
  // must fall back to a safe object, never throw or return the junk.
  applyRemoteConfig({ premium: null });
  const c = getPremiumConfig();
  assert.equal(c.enabled, true);
  assert.equal(c.testPhase, true);
  assert.equal(c.adSlot, false);
  assert.ok(Array.isArray(c.plans) && c.plans.length === 2, 'absent block → fallback plans');
  // Flags still default sensibly with the block gone.
  assert.equal(isPremiumEnabled(), true);
  assert.equal(isTestPhase(), true);
  assert.equal(isAdSlotEnabled(), false);
  resetConfig();
}

// ---- MANGLED block: adSlot flipped on, plans replaced with garbage string ----
{
  applyRemoteConfig({ premium: { adSlot: true, plans: 'garbage' } });
  const c = getPremiumConfig();
  // The scalar override lands...
  assert.equal(c.adSlot, true);
  // ...enabled/testPhase survive the deep-merge from DEFAULTS...
  assert.equal(c.enabled, true);
  assert.equal(c.testPhase, true);
  // ...and the garbage `plans` string is replaced by safe fallback plans.
  assert.ok(Array.isArray(c.plans) && c.plans.length === 2, 'garbage plans → fallback array');
  assert.equal(isAdSlotEnabled(), true, 'adSlot true honored');
  // getPremiumPlans normalizes the fallback plans (all valid).
  const plans = getPremiumPlans();
  assert.equal(plans.length, 2);
  assert.deepEqual(plans.map(p => p.id), ['monthly', 'yearly']);
  resetConfig();
}

// ---- plan normalization: malformed entries dropped, [] if none valid ----
{
  applyRemoteConfig({
    premium: {
      plans: [
        { id: 'ok', label: 'Good', priceInr: 199, per: 'month', save: 'Save' }, // valid
        { id: 'noLabel', priceInr: 99 },                                          // no label → drop
        { label: 'No id', priceInr: 99 },                                         // no id → drop
        { id: 'nan', label: 'Bad price', priceInr: Infinity },                    // non-finite → drop
        { id: 'strPrice', label: 'Str price', priceInr: '199' },                  // wrong type → drop
        'not an object',                                                          // not object → drop
        { id: 'noPer', label: 'No per', priceInr: 50 },                           // valid, per → ''
      ],
    },
  });
  const plans = getPremiumPlans();
  assert.equal(plans.length, 2, 'only the two well-formed plans survive');
  assert.deepEqual(plans[0], { id: 'ok', label: 'Good', priceInr: 199, per: 'month', save: 'Save' });
  assert.deepEqual(plans[1], { id: 'noPer', label: 'No per', priceInr: 50, per: '' });
  assert.ok(!('save' in plans[1]), 'save omitted when absent');

  // Empty / all-invalid → []
  applyRemoteConfig({ premium: { plans: [{ id: 'x' }, 42, null] } });
  assert.deepEqual(getPremiumPlans(), [], 'no valid plans → []');
  resetConfig();
}

// ---- flag helpers incl. explicit-off overrides ----
{
  resetConfig();
  assert.equal(isPremiumEnabled(), true);
  assert.equal(isTestPhase(), true);
  assert.equal(isAdSlotEnabled(), false);

  applyRemoteConfig({ premium: { enabled: false, testPhase: false, adSlot: true } });
  assert.equal(isPremiumEnabled(), false, 'enabled:false disables');
  assert.equal(isTestPhase(), false, 'testPhase:false leaves test mode');
  assert.equal(isAdSlotEnabled(), true, 'adSlot:true enables ad slot');

  // Non-boolean garbage should not accidentally disable (only explicit false).
  applyRemoteConfig({ premium: { enabled: 'yes', testPhase: 1, adSlot: 'nope' } });
  assert.equal(isPremiumEnabled(), true, 'truthy non-false stays enabled');
  assert.equal(isTestPhase(), true, 'truthy non-false stays in test phase');
  assert.equal(isAdSlotEnabled(), false, 'adSlot needs === true');
  resetConfig();
}

// ---- getPremiumFeatures: exactly the six agreed rows ----
{
  const feats = getPremiumFeatures();
  assert.equal(feats.length, 6);
  assert.deepEqual(feats.map(f => f.id), ['full-mocks', 'analytics', 'adfree', 'early-banks', 'frames', 'support']);
  for (const f of feats) {
    assert.equal(typeof f.label, 'string');
    assert.equal(typeof f.free, 'string');
    assert.equal(typeof f.premium, 'string');
  }
  const byId = Object.fromEntries(feats.map(f => [f.id, f]));
  assert.equal(byId['full-mocks'].label, 'Full mock tests');
  assert.equal(byId['full-mocks'].free, 'Limited / week');
  assert.equal(byId['full-mocks'].premium, 'Unlimited');
  assert.equal(byId['frames'].free, '—');
  assert.equal(byId['support'].premium, 'Direct line');
}

// ---- getPremiumState: null, guest (no premium), tiers, expiry ----
{
  const OFF = { active: false, plan: null, tier: null };
  assert.deepEqual(getPremiumState(null), OFF);
  assert.deepEqual(getPremiumState(undefined), OFF);
  assert.deepEqual(getPremiumState({}), OFF, 'guest with no premium field');
  assert.deepEqual(getPremiumState({ premium: {} }), OFF);
  assert.deepEqual(getPremiumState({ premium: { active: false } }), OFF);
  // An active entitlement carries the plan and defaults to the SUPER tier.
  assert.deepEqual(
    getPremiumState({ premium: { active: true, plan: 'yearly' } }),
    { active: true, plan: 'yearly', tier: 'SUPER' },
  );
  assert.deepEqual(
    getPremiumState({ premium: { active: true } }),
    { active: true, plan: null, tier: 'SUPER' },
    'active without plan → plan null, tier defaults to SUPER',
  );
  // Tier + billing come from the subscription broker's premium blob.
  assert.deepEqual(
    getPremiumState({ premium: { active: true, tier: 'MAX', billing: 'FAMILY' } }),
    { active: true, plan: 'FAMILY', tier: 'MAX' },
    'billing doubles as plan label; MAX tier honored',
  );
  assert.equal(getPremiumState({ premium: { active: true, tier: 'BOGUS' } }).tier, 'SUPER', 'unknown tier → SUPER');
  // Expiry is honored client-side: a lapsed cached entitlement is inactive.
  const now = 1_000_000;
  assert.deepEqual(getPremiumState({ premium: { active: true, expiresAt: now } }, now), OFF, 'expiresAt <= now lapses');
  assert.equal(getPremiumState({ premium: { active: true, expiresAt: now + 1 } }, now).active, true, 'future expiry stays active');
  assert.equal(getPremiumState({ premium: { active: true, expiresAt: null } }, now).active, true, 'null expiry = no expiry');
}

// ---- formatInr: Indian grouping + non-finite ----
{
  assert.equal(formatInr(999), '₹999');
  assert.equal(formatInr(149), '₹149');
  assert.equal(formatInr(0), '₹0');
  assert.equal(formatInr(1499), '₹1,499');
  assert.equal(formatInr(100000), '₹1,00,000');
  assert.equal(formatInr(1000), '₹1,000');
  assert.equal(formatInr(12345), '₹12,345');
  assert.equal(formatInr(1234567), '₹12,34,567');
  assert.equal(formatInr(10000000), '₹1,00,00,000');
  assert.equal(formatInr(-1499), '₹-1,499');
  // Non-finite / non-number → '₹–' (en dash 'no value' glyph; never an em dash)
  assert.equal(formatInr(Infinity), '₹–');
  assert.equal(formatInr(-Infinity), '₹–');
  assert.equal(formatInr(NaN), '₹–');
  assert.equal(formatInr('999'), '₹–');
  assert.equal(formatInr(null), '₹–');
  assert.equal(formatInr(undefined), '₹–');
}

// ---- feature gates: cribVault (default OFF; gate ∧ ¬premium = locked) ----
resetConfig();
{
  // default config: gate OFF → nothing locked for anyone
  assert.equal(getPremiumConfig().gates.cribVault, false);
  assert.equal(cribVaultLocked(null), false);
  assert.equal(cribVaultLocked({ premium: { active: false } }), false);

  // gate ON via remote override: free users locked, premium users pass
  applyRemoteConfig({ premium: { gates: { cribVault: true } } });
  assert.equal(getPremiumConfig().gates.cribVault, true);
  assert.equal(cribVaultLocked(null), true, 'guest/free is locked when the gate is up');
  assert.equal(cribVaultLocked({}), true);
  assert.equal(cribVaultLocked({ premium: { active: true, plan: 'yearly' } }), false, 'premium passes the wall');

  // mangled gates block degrades to FALLBACK (gate off, never throws)
  applyRemoteConfig({ premium: { gates: 'oops' } });
  assert.equal(getPremiumConfig().gates.cribVault, false);
  assert.equal(cribVaultLocked(null), false);
  resetConfig();
}

// ---- isPremiumUser mirrors getPremiumState ----
{
  assert.equal(isPremiumUser(null), false);
  assert.equal(isPremiumUser({ premium: { active: 'yes' } }), false, 'strict boolean check');
  assert.equal(isPremiumUser({ premium: { active: true } }), true);
}

console.log('premium.test.js — all assertions passed');
