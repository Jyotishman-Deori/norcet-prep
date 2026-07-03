// Contract test for src/lib/subscription.js — runnable under Node:
//   node src/lib/subscription.test.js
//
// Only the PURE layer is tested (tier catalog, entitlement normalizers, join
// links). The fetch layer lazy-imports storage.js at CALL time, so importing
// the module under Node is safe without any loader stub.
import assert from 'node:assert/strict';

const {
  TIERS, TIER_ORDER, FAMILY_SEATS,
  normalizeEntitlement, entitlementToPremium,
  parseJoinToken, buildJoinLink, JOIN_PARAM,
} = await import('./subscription.js');

// ---- tier catalog sanity ----
{
  assert.deepEqual(TIER_ORDER, ['SUPER', 'MAX']);
  for (const id of TIER_ORDER) {
    const t = TIERS[id];
    assert.equal(t.id, id);
    assert.equal(typeof t.label, 'string');
    assert.ok(Array.isArray(t.features) && t.features.length > 0, `${id} has features`);
    for (const f of t.features) assert.equal(typeof f.label, 'string');
  }
  // MAX explicitly includes Super and its coach features are flagged as
  // NOT-built ("Coming later") — the NO-runtime-AI rule means they may only
  // ever be marketing copy until the owner sanctions otherwise.
  assert.equal(TIERS.MAX.features[0].label, 'Everything in Super');
  assert.ok(TIERS.MAX.features.slice(1).every(f => f.soon === true), 'all MAX extras are soon-flagged');
  assert.equal(FAMILY_SEATS, 6);
}

// ---- normalizeEntitlement: garbage → inactive ----
{
  const none = normalizeEntitlement(null);
  assert.equal(none.active, false);
  assert.equal(none.tier, null);
  assert.equal(normalizeEntitlement(undefined).active, false);
  assert.equal(normalizeEntitlement('junk').active, false);
  assert.equal(normalizeEntitlement({}).active, false);
  assert.equal(normalizeEntitlement({ active: 'yes' }).active, false, 'strict boolean');
  assert.equal(normalizeEntitlement({ active: true }).active, false, 'active without a valid tier is not an entitlement');
  assert.equal(normalizeEntitlement({ active: true, tier: 'GOLD' }).active, false, 'unknown tier rejected');
}

// ---- normalizeEntitlement: valid shapes ----
{
  const now = 1_000_000;
  const e = normalizeEntitlement({ active: true, tier: 'SUPER', billing: 'INDIVIDUAL', role: 'owner', seats: 1, seatsUsed: 1 }, now);
  assert.deepEqual(e, { active: true, tier: 'SUPER', billing: 'INDIVIDUAL', role: 'owner', expiresAt: null, seats: 1, seatsUsed: 1, ownerId: null });

  const fam = normalizeEntitlement({ active: true, tier: 'MAX', billing: 'FAMILY', role: 'member', ownerId: 'didi', expiresAt: now + 5 }, now);
  assert.equal(fam.tier, 'MAX');
  assert.equal(fam.billing, 'FAMILY');
  assert.equal(fam.role, 'member');
  assert.equal(fam.ownerId, 'didi');
  assert.equal(fam.expiresAt, now + 5);
  assert.equal(fam.seats, FAMILY_SEATS, 'family seats default to 6 when absent');

  // Unknown billing/role default safely.
  const d = normalizeEntitlement({ active: true, tier: 'SUPER', billing: 'weird', role: 'boss' }, now);
  assert.equal(d.billing, 'INDIVIDUAL');
  assert.equal(d.role, 'owner');
}

// ---- normalizeEntitlement: client-side expiry ----
{
  const now = 1_000_000;
  assert.equal(normalizeEntitlement({ active: true, tier: 'SUPER', expiresAt: now }, now).active, false, 'expiresAt <= now lapses');
  assert.equal(normalizeEntitlement({ active: true, tier: 'SUPER', expiresAt: now - 1 }, now).active, false);
  assert.equal(normalizeEntitlement({ active: true, tier: 'SUPER', expiresAt: now + 1 }, now).active, true);
  assert.equal(normalizeEntitlement({ active: true, tier: 'SUPER', expiresAt: 'soon' }, now).active, true, 'non-numeric expiry treated as none');
}

// ---- entitlementToPremium: the profile.premium blob ----
{
  const now = 2_000_000;
  const off = entitlementToPremium(null, now);
  assert.deepEqual(off, { active: false, checkedAt: now });

  const on = entitlementToPremium({ active: true, tier: 'MAX', billing: 'FAMILY', role: 'owner', expiresAt: now + 10 }, now);
  assert.deepEqual(on, { active: true, tier: 'MAX', billing: 'FAMILY', role: 'owner', expiresAt: now + 10, checkedAt: now });

  // Already-expired input produces an inactive blob (never a stale active).
  const lapsed = entitlementToPremium({ active: true, tier: 'SUPER', expiresAt: now - 1 }, now);
  assert.equal(lapsed.active, false);
}

// ---- join links: parse + build round-trip ----
{
  assert.equal(JOIN_PARAM, 'join');
  const token = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
  assert.equal(parseJoinToken(`?join=${token}`), token);
  assert.equal(parseJoinToken(`join=${token}`), token, 'leading ? optional');
  assert.equal(parseJoinToken(`?utm=x&join=${token}&y=1`), token, 'other params ignored');
  // Rejections: missing, too short, bad charset, non-string.
  assert.equal(parseJoinToken('?join='), null);
  assert.equal(parseJoinToken('?join=short'), null);
  assert.equal(parseJoinToken('?join=has-dash-chars-here-not-allowed!!'), null);
  assert.equal(parseJoinToken(''), null);
  assert.equal(parseJoinToken(null), null);
  assert.equal(parseJoinToken(undefined), null);

  const link = buildJoinLink('https://www.nurseholic.in/', token);
  assert.equal(link, `https://www.nurseholic.in/?join=${token}`, 'trailing slash normalized');
  // Round-trip: what we build, we can parse.
  assert.equal(parseJoinToken(new URL(link).search), token);
}

console.log('subscription.test.js — all assertions passed');
