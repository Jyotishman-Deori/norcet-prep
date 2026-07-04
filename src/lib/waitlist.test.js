// Contract test for src/lib/waitlist.js — runnable under Node:
//   node src/lib/waitlist.test.js
import assert from 'node:assert/strict';

const {
  INDIAN_STATES, isValidState, stateLabel,
  normalizeWaitlistEmail, isValidEmail, isTempMail,
  normalizeWhatsapp,
  WAITLIST_CODE_RE, generateWaitlistCode, parseWaitlistRefCode,
  INTENT_HIGH_CHARS, intentScore, sanitizeFreeText,
  priorityScore, nextBatchDrop, DEFAULT_DROP_SCHEDULE, countdownParts, formatIstTime,
  parseClaimParam, buildClaimUrl, WAITLIST_APP_ORIGIN,
  buildWaitlistShareUrl, buildWaitlistShareMessage, buildApprovalNudgeMessage, buildWaUrl,
} = await import('./waitlist.js');

// ---- states ----------------------------------------------------------
{
  assert.equal(INDIAN_STATES.length, 36, '28 states + 8 UTs');
  assert.ok(isValidState('assam'));
  assert.ok(!isValidState('Assam'), 'ids are slugs, not labels');
  assert.ok(!isValidState(''));
  assert.equal(stateLabel('meghalaya'), 'Meghalaya');
  assert.equal(INDIAN_STATES.filter(s => s.ne).length, 7, 'spec §5.5 Northeast launch region');
  const ids = new Set(INDIAN_STATES.map(s => s.id));
  assert.equal(ids.size, INDIAN_STATES.length, 'no duplicate ids');
}

// ---- email normalization (spec §7.2) ---------------------------------
{
  assert.equal(normalizeWaitlistEmail(' Rahul+spam@Gmail.com '), 'rahul@gmail.com');
  assert.equal(normalizeWaitlistEmail('ra.h.ul@gmail.com'), 'rahul@gmail.com', 'gmail dots stripped');
  assert.equal(normalizeWaitlistEmail('ra.hul@yahoo.com'), 'ra.hul@yahoo.com', 'non-gmail dots kept');
  assert.equal(normalizeWaitlistEmail('rahul+1@yahoo.com'), 'rahul@yahoo.com', '+alias stripped everywhere');
  assert.equal(normalizeWaitlistEmail('x@googlemail.com'), 'x@googlemail.com');
  assert.equal(normalizeWaitlistEmail('a.b+c@googlemail.com'), 'ab@googlemail.com');
  assert.ok(isValidEmail('rahul@gmail.com'));
  assert.ok(isValidEmail('a_b-c@nrs.ac.in'));
  assert.ok(!isValidEmail('rahul@gmail'), 'needs a TLD');
  assert.ok(!isValidEmail('@gmail.com'));
  assert.ok(!isValidEmail('rahul gmail.com'));
  assert.ok(!isValidEmail(''));
  // normalize + validate never throws on junk
  assert.equal(normalizeWaitlistEmail(null), '');
  assert.ok(!isValidEmail(normalizeWaitlistEmail(undefined)));
}

// ---- temp-mail (spec §7.1) -------------------------------------------
{
  assert.ok(isTempMail('x@10minutemail.com'));
  assert.ok(isTempMail('x@YOPMAIL.com'), 'case-insensitive domain');
  assert.ok(!isTempMail('x@gmail.com'));
  assert.ok(!isTempMail('not-an-email'));
}

// ---- WhatsApp normalization (spec §7.3) ------------------------------
{
  assert.equal(normalizeWhatsapp('9876543210'), '9876543210');
  assert.equal(normalizeWhatsapp('+91 98765 43210'), '9876543210');
  assert.equal(normalizeWhatsapp('09876543210'), '9876543210');
  assert.equal(normalizeWhatsapp('91-9876-543-210'), '9876543210');
  assert.equal(normalizeWhatsapp('5876543210'), null, 'must start 6-9');
  assert.equal(normalizeWhatsapp('98765'), null, 'too short');
  assert.equal(normalizeWhatsapp('919876543210123'), null, 'too long');
  assert.equal(normalizeWhatsapp(''), null);
  assert.equal(normalizeWhatsapp(null), null);
}

// ---- referral codes ---------------------------------------------------
{
  for (let i = 0; i < 50; i++) {
    const code = generateWaitlistCode();
    assert.match(code, WAITLIST_CODE_RE, `generated code shape: ${code}`);
  }
  // deterministic rand
  assert.match(generateWaitlistCode(() => 0), /^NURSE-AAAAA$/);

  // all arrival shapes → canonical
  assert.equal(parseWaitlistRefCode('NURSE-AB12C'), 'NURSE-AB12C');
  assert.equal(parseWaitlistRefCode('nurse-ab12c'), 'NURSE-AB12C');
  assert.equal(parseWaitlistRefCode('NURSEAB12C'), 'NURSE-AB12C');
  assert.equal(parseWaitlistRefCode('nurseab12c'), 'NURSE-AB12C', 'referral.js slug shape');
  assert.equal(parseWaitlistRefCode('  nurse-ab12c  '), 'NURSE-AB12C');
  // non-matches fall back to null (profile-id refs, garbage)
  assert.equal(parseWaitlistRefCode('priya123'), null);
  assert.equal(parseWaitlistRefCode('nurseriya'), null, '9-char slug is not a code');
  assert.equal(parseWaitlistRefCode('nurseab12c9'), null, '11 chars is not a code');
  assert.equal(parseWaitlistRefCode(''), null);
  assert.equal(parseWaitlistRefCode(null), null);
  // KNOWN AMBIGUITY: a 10-char profile slug starting "nurse" (e.g. "nursepriya")
  // parses as a candidate code — the server disambiguates by table lookup and
  // falls back to arrival_ref when no waitlist row matches. Just assert shape:
  assert.equal(parseWaitlistRefCode('nursepriya'), 'NURSE-PRIYA');
}

// ---- intent score (spec §3.2, 50-char boundary) ------------------------
{
  const exactly50 = 'x'.repeat(INTENT_HIGH_CHARS);
  assert.equal(intentScore(exactly50), 1, '50 chars is NOT high intent (spec: > 50)');
  assert.equal(intentScore(exactly50 + 'x'), 5, '51 chars is high intent');
  assert.equal(intentScore('   ' + exactly50 + '   '), 1, 'whitespace trimmed before measuring');
  assert.equal(intentScore(''), 1);
  assert.equal(intentScore(null), 1);
}

// ---- free-text hygiene --------------------------------------------------
{
  assert.equal(sanitizeFreeText('<b>RCON</b> Guwahati', 120), 'RCON Guwahati');
  assert.equal(sanitizeFreeText('x'.repeat(600), 500).length, 500);
  assert.equal(sanitizeFreeText(null, 10), '');
}

// ---- priority score ------------------------------------------------------
{
  const now = Date.UTC(2026, 6, 20);
  const tenDaysAgo = new Date(now - 10 * 86400000).toISOString();
  const s = priorityScore({ referrals: 3, createdAt: tenDaysAgo }, now);
  assert.deepEqual(s, { referralPts: 300, waitPts: 100, total: 400 });
  // partial day floors; junk clamps to zero
  assert.equal(priorityScore({ referrals: 0, createdAt: now - 86399999 }, now).waitPts, 0);
  assert.deepEqual(priorityScore({}, now), { referralPts: 0, waitPts: 0, total: 0 });
  assert.deepEqual(priorityScore({ referrals: -2, createdAt: 'garbage' }, now), { referralPts: 0, waitPts: 0, total: 0 });
  assert.equal(priorityScore({ referrals: 1, createdAt: now + 9999 }, now).waitPts, 0, 'future createdAt never negative');
}

// ---- nextBatchDrop (IST math; default Tue 10:00 + Fri 15:00) --------------
{
  // 2026-07-06 is a Monday. 12:00 IST Monday = 06:30 UTC.
  const monNoonIst = Date.UTC(2026, 6, 6, 6, 30);
  const tue10Ist = Date.UTC(2026, 6, 7, 4, 30);  // Tue 10:00 IST
  const fri15Ist = Date.UTC(2026, 6, 10, 9, 30); // Fri 15:00 IST
  assert.equal(nextBatchDrop(monNoonIst), tue10Ist, 'Mon noon → Tue 10:00 IST');
  assert.equal(nextBatchDrop(tue10Ist - 60000), tue10Ist, 'Tue 09:59 IST → same-day 10:00');
  assert.equal(nextBatchDrop(tue10Ist), fri15Ist, 'exactly at drop time → next drop (strictly after)');
  assert.equal(nextBatchDrop(fri15Ist + 60000), tue10Ist + 7 * 86400000, 'Fri 15:01 IST → next Tue');
  // custom schedule + garbage schedule fallback
  const sun9 = [{ dow: 0, h: 9, m: 30 }];
  const nextSun = Date.UTC(2026, 6, 12, 4, 0); // Sun 09:30 IST = 04:00 UTC
  assert.equal(nextBatchDrop(monNoonIst, sun9), nextSun);
  assert.equal(nextBatchDrop(monNoonIst, 'garbage'), tue10Ist, 'invalid schedule → default');
  assert.equal(nextBatchDrop(monNoonIst, []), tue10Ist, 'empty schedule → default');
  assert.ok(nextBatchDrop(Date.now()) > Date.now(), 'always strictly in the future');
  assert.equal(DEFAULT_DROP_SCHEDULE.length, 2);
}

// ---- countdown + IST formatting ---------------------------------------------
{
  assert.deepEqual(countdownParts(0), { days: 0, hours: 0, minutes: 0, seconds: 0 });
  assert.deepEqual(countdownParts(-5000), { days: 0, hours: 0, minutes: 0, seconds: 0 });
  assert.deepEqual(countdownParts(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000),
    { days: 2, hours: 3, minutes: 4, seconds: 5 });
  // 2026-07-04 14:00 UTC = 19:30 IST (Saturday)
  assert.equal(formatIstTime(Date.UTC(2026, 6, 4, 14, 0)), 'Sat 4 Jul, 7:30 PM IST');
  assert.equal(formatIstTime('not a date'), '');
}

// ---- claim links -------------------------------------------------------------
{
  const uuid = '9f1b2c3d-4e5f-4a6b-8c7d-0123456789ab';
  assert.equal(parseClaimParam(`?claim=${uuid}`), uuid);
  assert.equal(parseClaimParam(`claim=${uuid.toUpperCase()}`), uuid, 'case-normalized, ?-optional');
  assert.equal(parseClaimParam(`?ref=NURSE-AB12C&claim=${uuid}`), uuid, 'coexists with ?ref');
  assert.equal(parseClaimParam('?claim=short'), null);
  assert.equal(parseClaimParam('?claim='), null);
  assert.equal(parseClaimParam(''), null);
  assert.equal(parseClaimParam(null), null);
  const url = buildClaimUrl('https://www.nurseholic.in/', uuid);
  assert.equal(url, `https://www.nurseholic.in/?claim=${uuid}`, 'trailing slash collapsed');
  assert.equal(parseClaimParam(new URL(url).search), uuid, 'round-trips');
  assert.ok(buildClaimUrl(null, uuid).startsWith(WAITLIST_APP_ORIGIN), 'defaults to student origin');
}

// ---- share / nudge messages ----------------------------------------------------
{
  const shareUrl = buildWaitlistShareUrl('NURSE-AB12C');
  assert.ok(shareUrl.startsWith(`${WAITLIST_APP_ORIGIN}/?ref=NURSE-AB12C`), shareUrl);
  assert.match(shareUrl, /via=whatsapp/);
  const msg = buildWaitlistShareMessage({ code: 'NURSE-AB12C' });
  assert.match(msg, /NURSE-AB12C/);
  assert.match(msg, /nurseholic\.in/);
  assert.doesNotMatch(msg, /\b50 seats\b/i, 'no invented scarcity numbers in default copy');

  const nudge = buildApprovalNudgeMessage({
    claimUrl: 'https://www.nurseholic.in/?claim=x',
    expiresAt: Date.UTC(2026, 6, 4, 14, 0),
  });
  assert.match(nudge, /claim=x/);
  assert.match(nudge, /7:30 PM IST/);
  assert.match(buildApprovalNudgeMessage({ claimUrl: 'u' }), /^Your NORCET Prep seat is ready/, 'no expiry → still valid copy');

  assert.equal(buildWaUrl('+91 98765 43210', 'hi there'), 'https://wa.me/919876543210?text=hi%20there');
  assert.equal(buildWaUrl(null, 'hi'), 'https://wa.me/?text=hi', 'no number → share picker');
}

console.log('waitlist.test.js OK');
