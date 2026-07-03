// Contract test for src/lib/content-filter.js — runnable under Node:
//   node src/lib/content-filter.test.js
import assert from 'node:assert/strict';

const {
  normalizeForMatch, containsProfanity, maskProfanity,
  redactPII, sanitizeUserText, cleanForDisplay, PROFANITY_BLOCK_MESSAGE,
} = await import('./content-filter.js');

// ---- Scunthorpe protection: NURSING/exam vocabulary must NEVER trip ----
{
  const clean = [
    'I am from Assam and preparing for NORCET',       // 'ass' inside Assam
    'Assamese is my mother tongue',
    'nursing assessment of the patient',
    'the whole class passed the mock test',
    'update your bank passbook',
    'classic presentation of preeclampsia',
    'breast cancer screening guidelines',              // clinical anatomy is legit
    'sexual assault examination protocol FMT',         // clinical topic is legit
    'give the drug per vagina as prescribed',
    'khela dekhba? assamese culture question',         // khela ≠ khanki
    'mujhe kela khana pasand hai (banana nutrition)',  // kela = banana, excluded
    'baal jhadna (hair fall) ka reason kya hai',       // baal = hair, excluded
    'B.Com graduate switching to nursing',
    'because of this I scored well',
    'scock… peacock anatomy of birds',                 // cock inside peacock
  ];
  for (const s of clean) {
    const r = containsProfanity(s);
    assert.equal(r.hit, false, `false positive on: "${s}" (matched: ${r.matches})`);
  }
}

// ---- profanity hits: English / Hinglish / Assamese / scripts ----
{
  const dirty = [
    'what the fuck is this question',
    'this is complete bullshit yaar',
    'kya chutiya question hai',
    'admin madarchod hai kya',
    'bc yeh kya hai',                       // standalone initialism
    'tu gandu hai',
    'saala yeh app slow hai',
    'khanki r dore likha question',         // Assamese romanized
    'suda question ekta',
    'यह चूतिया सवाल है',                     // Devanagari
    'साला बकवास है',
    'খানকি প্ৰশ্ন',                           // Assamese script
    'চুদা কথা',
  ];
  for (const s of dirty) {
    assert.equal(containsProfanity(s).hit, true, `missed: "${s}"`);
  }
}

// ---- evasion: repeats, leetspeak, dot-padding ----
{
  assert.equal(containsProfanity('fuuuuck this').hit, true, 'letter repeats');
  assert.equal(containsProfanity('fuk off').hit, true, 'shorthand spelling');
  assert.equal(containsProfanity('l0da kya hai').hit, true, 'leet 0→o');
  assert.equal(containsProfanity('sh!t question').hit, true, 'leet !→i');
  assert.equal(containsProfanity('f.u.c.k').hit, true, 'dot padding');
  assert.equal(containsProfanity('b-i-t-c-h').hit, true, 'dash padding');
  assert.equal(containsProfanity('c.h.u.t.i.y.a bola').hit, true, 'dot-padded hinglish');
  // Self-censored forms (star replacing a letter, e.g. "f**k", "ch*tiya")
  // are deliberately ALLOWED — the author already hid the word.
  assert.equal(containsProfanity('f**k this').hit, false, 'self-censored passes');
  // normalizeForMatch itself
  assert.equal(normalizeForMatch('F.U-C_K'), 'fuck');
  assert.equal(normalizeForMatch('sh1t'), 'shit');
}

// ---- maskProfanity: plain forms masked in place, rest untouched ----
{
  const m = maskProfanity('this fuck question from Assam');
  assert.ok(!m.includes('fuck'), 'word masked');
  assert.ok(m.includes('▇▇▇'), 'mask glyphs present');
  assert.ok(m.includes('Assam'), 'innocent text untouched');
  assert.equal(maskProfanity('a clean sentence'), 'a clean sentence');
  assert.ok(!maskProfanity('साला बकवास').includes('साला'), 'script word masked');
}

// ---- redactPII: emails, UPI, phones, 12-digit IDs ----
{
  const email = redactPII('contact me at meera.nurse@gmail.com please');
  assert.equal(email.redacted, true);
  assert.ok(!email.text.includes('gmail.com'), 'email hidden');
  assert.ok(email.text.includes('me••••'), 'hint kept');

  const upi = redactPII('pay me on meera@okaxis');
  assert.equal(upi.redacted, true);
  assert.ok(!upi.text.includes('okaxis'));

  for (const p of ['9876543210', '+91 98765 43210', '+91-9876543210', '09876543210', '98765-43210']) {
    const r = redactPII(`call me ${p} anytime`);
    assert.equal(r.redacted, true, `phone missed: ${p}`);
    assert.ok(!/\d{5}/.test(r.text), `digits leaked for: ${p} → ${r.text}`);
  }

  const id = redactPII('aadhaar 1234 5678 9012 hai');
  assert.equal(id.redacted, true, '12-digit ID');

  // Numbers that are NOT contact info stay: scores, doses, years, small ids.
  for (const s of ['scored 145 out of 200', 'give 0.5 mg adrenaline', 'NORCET 2026 exam', 'roll no 4521']) {
    const r = redactPII(s);
    assert.equal(r.redacted, false, `over-redacted: "${s}" → ${r.text}`);
    assert.equal(r.text, s);
  }
  assert.equal(redactPII(null).text, '', 'nullish-safe');
}

// ---- sanitizeUserText policy: profanity blocks, PII redacts-and-passes ----
{
  const blocked = sanitizeUserText('bc yeh kya bakwas hai');
  assert.equal(blocked.blocked, true);
  assert.ok(blocked.reasons.includes('profanity'));
  assert.equal(typeof PROFANITY_BLOCK_MESSAGE, 'string');

  const pii = sanitizeUserText('doubt hai, whatsapp me on 9876543210');
  assert.equal(pii.blocked, false, 'PII alone never blocks');
  assert.ok(pii.reasons.includes('contact-info'));
  assert.ok(!pii.text.includes('9876543210'), 'phone hidden in submitted text');

  const clean = sanitizeUserText('what is the antidote of heparin?');
  assert.equal(clean.blocked, false);
  assert.deepEqual(clean.reasons, []);
  assert.equal(clean.text, 'what is the antidote of heparin?');
}

// ---- cleanForDisplay: one-pass render-side defense ----
{
  const out = cleanForDisplay('shit doubt, call 9876543210 or mail x@y.com');
  assert.ok(!out.includes('shit'));
  assert.ok(!out.includes('9876543210'));
  assert.ok(!out.includes('y.com'));
}

console.log('content-filter.test.js: all passed');
