// =====================================================================
// src/lib/content-filter.js — community-content moderation (pure, tested).
//
// Owner policy (2026-07-04): on PUBLIC user-generated surfaces (FAQ doubts,
// display names — and any future ones):
//   • cuss words → BLOCK the submission (English, Hindi/Hinglish romanized,
//     Devanagari, Assamese romanized + Assamese script), with a friendly
//     message so the user can fix it;
//   • personal contact info (phone numbers, emails, UPI handles, 12-digit
//     ID-like numbers) → silently REDACT (post goes through, digits hidden).
// Render-side, the same masking runs over DISPLAYED community text so
// anything that slipped in earlier is still hidden.
//
// Precision over recall — this is a NURSING app: clinical vocabulary
// (anatomy, assault/abuse topics, drug names) is legitimate exam content
// and must never trip the filter. Therefore:
//   • strict WORD-BOUNDARY matching only (no substring hits — "Assam",
//     "class", "assessment", "passbook" can never match),
//   • the list holds slurs/abuse only, never anatomy or clinical terms,
//   • ambiguous cross-language words with innocent meanings (kela=banana,
//     baal=hair) are deliberately excluded.
// The block path also normalizes common evasions: leetspeak (fuck→f0ck),
// letter repeats (fuuuck), and dot/dash padding (f.u.c.k).
//
// Client-side by design at this scale — the admin's delete tools remain
// the backstop; a broker-side check is a possible later hardening.
// =====================================================================

// ---- profanity lists -------------------------------------------------
// Latin-script entries are matched with repeat-tolerant boundary regexes
// (each letter may repeat: "fuuuck" still hits). Keep entries lowercase.
const LATIN_PROFANITY = [
  // English (incl. the common shorthand spellings)
  'fuck', 'fucker', 'fucking', 'fuk', 'fck', 'fcuk', 'shit', 'bullshit',
  'motherfucker', 'bitch',
  'asshole', 'ass', 'arse', 'jackass', 'dumbass', 'bastard', 'dick',
  'dickhead', 'cunt', 'pussy', 'slut', 'whore', 'wanker', 'prick', 'douche',
  'douchebag', 'retard', 'nigger', 'nigga', 'faggot', 'cock',
  // Hindi / Hinglish (romanized). bc/mc are the common initialisms — they
  // are boundary-matched standalone, so "because"/"B.Com" never hit.
  'chutiya', 'chutia', 'chutiye', 'bhosdike', 'bhosdi', 'bhosda', 'bhosadike',
  'madarchod', 'behenchod', 'bahenchod', 'bhenchod', 'benchod', 'bc', 'mc',
  'gandu', 'gaandu', 'gaand', 'gand', 'harami', 'haramkhor', 'haramzada',
  'kamina', 'kamine', 'kaminey', 'saala', 'saale', 'randi', 'raand',
  'chod', 'chodu', 'chutmarike', 'lund', 'lauda', 'laude', 'loda', 'lode',
  'jhant', 'jhaatu', 'tatti',
  // Assamese (romanized). High-precision picks only — common expletives
  // with no innocent homographs (kela/bal excluded: banana/hair).
  'khanki', 'khankir', 'bessya', 'beshya', 'beissya', 'suda', 'sudi',
  'sudibo', 'sudiba', 'chuda', 'chudi',
];

// Script entries (Devanagari + Assamese/Bengali script) — matched with
// unicode-letter boundaries (no leet/repeat pass; scripts aren't leeted).
const SCRIPT_PROFANITY = [
  // Devanagari (Hindi)
  'चूतिया', 'चुतिया', 'मादरचोद', 'भोसड़ी', 'भोसड़ीके', 'भोसडीके', 'बहनचोद',
  'बहेनचोद', 'गांड', 'गांडू', 'गंदु', 'रंडी', 'लंड', 'लौड़ा', 'हरामी',
  'कमीना', 'कमीने', 'साला', 'साले', 'चोद', 'चूत',
  // Assamese script (shared with Bengali)
  'খানকি', 'খানকীৰ', 'বেশ্যা', 'চুদ', 'চুদা', 'চুদি', 'মাগী',
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One repeat-tolerant, boundary-anchored regex per latin word:
// 'ass' → /\ba+s+s+\b/ — "asssss" hits, "Assam"/"class"/"passbook" cannot
// (no word boundary inside them).
const LATIN_RES = LATIN_PROFANITY.map((w) => ({
  word: w,
  re: new RegExp('\\b' + w.split('').map((ch) => esc(ch) + '+').join('') + '\\b', 'gi'),
}));

// Script words: \b is ASCII-only, so use unicode-letter lookarounds.
const SCRIPT_RES = SCRIPT_PROFANITY.map((w) => ({
  word: w,
  re: new RegExp('(?<!\\p{L})' + esc(w) + '(?!\\p{L})', 'gu'),
}));

// ---- normalization (the block path's evasion pass) -------------------
const LEET = { 4: 'a', '@': 'a', 1: 'i', '!': 'i', 0: 'o', 3: 'e', 5: 's', $: 's', 7: 't' };

// normalizeForMatch(text) → a latin-normalized shadow copy: lowercased,
// leet-mapped, single-char separators between letters removed (f.u.c.k →
// fuck). Script text passes through untouched. NOT index-preserving —
// used only for detection, never for masking.
export function normalizeForMatch(text) {
  let s = String(text == null ? '' : text).toLowerCase();
  s = s.replace(/[4@1!035$7]/g, (ch) => LEET[ch] || ch);
  // drop ., -, _, * used as padding between single latin letters
  for (let i = 0; i < 3; i++) s = s.replace(/([a-z])[.\-_*]+(?=[a-z])/g, '$1');
  return s;
}

// ---- profanity API ----------------------------------------------------
// containsProfanity(text) → { hit, matches } — checks the raw text AND the
// normalized shadow so leet/padded evasions are caught.
export function containsProfanity(text) {
  const raw = String(text == null ? '' : text);
  const norm = normalizeForMatch(raw);
  const matches = [];
  for (const { word, re } of LATIN_RES) {
    re.lastIndex = 0;
    if (re.test(raw) || (norm !== raw.toLowerCase() && (re.lastIndex = 0, re.test(norm)))) {
      matches.push(word);
    }
  }
  for (const { word, re } of SCRIPT_RES) {
    re.lastIndex = 0;
    if (re.test(raw)) matches.push(word);
  }
  return { hit: matches.length > 0, matches };
}

// maskProfanity(text) → text with offending words replaced by '▇▇▇'.
// Works on the ORIGINAL string (indices preserved — only plain/repeated
// forms are masked; leet evasions are handled by the block path instead).
export function maskProfanity(text) {
  let s = String(text == null ? '' : text);
  for (const { re } of LATIN_RES) { re.lastIndex = 0; s = s.replace(re, '▇▇▇'); }
  for (const { re } of SCRIPT_RES) { re.lastIndex = 0; s = s.replace(re, '▇▇▇'); }
  return s;
}

// ---- PII redaction -----------------------------------------------------
// Mask keeps a 2-char hint so the author recognizes their own text:
// "9876543210" → "98••••", "meera@gmail.com" → "me••••".
const hint = (m) => m.slice(0, 2) + '••••';

// Order matters: emails (dot in domain) → UPI-style handles (no dot) →
// 12-digit ID-like runs → 10-digit Indian mobiles (with +91/0 prefixes and
// space/dash padding).
const RE_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const RE_UPI = /\b[\w.-]{2,}@[a-z][a-z0-9]{1,}\b/gi;
const RE_ID12 = /(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g;
const RE_PHONE = /(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d(?:[\s-]?\d){8}(?!\d)/g;

export function redactPII(text) {
  let s = String(text == null ? '' : text);
  let redacted = false;
  const sub = (re) => { s = s.replace(re, (m) => { redacted = true; return hint(m); }); };
  sub(RE_EMAIL);
  sub(RE_UPI);
  sub(RE_ID12);
  sub(RE_PHONE);
  return { text: s, redacted };
}

// ---- the submission policy ---------------------------------------------
export const PROFANITY_BLOCK_MESSAGE =
  'Please keep it respectful, remove the flagged word and try again.';

// sanitizeUserText(text) → { text, blocked, reasons }
//   blocked=true  → do NOT submit; show PROFANITY_BLOCK_MESSAGE.
//   blocked=false → submit `text` (PII already hidden if any was found).
export function sanitizeUserText(text) {
  const prof = containsProfanity(text);
  const pii = redactPII(text);
  const reasons = [];
  if (prof.hit) reasons.push('profanity');
  if (pii.redacted) reasons.push('contact-info');
  return { text: pii.text, blocked: prof.hit, reasons };
}

// cleanForDisplay(text) → render-side defense for community content that
// is ALREADY stored: hides PII and masks plain profanity in one pass.
export function cleanForDisplay(text) {
  return maskProfanity(redactPII(text).text);
}
