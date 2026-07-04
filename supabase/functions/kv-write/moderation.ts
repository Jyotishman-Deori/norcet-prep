// =====================================================================
// supabase/functions/kv-write/moderation.ts — SERVER-side copy of the
// community content filter for `faqq:` writes.
//
// The client filter (src/lib/content-filter.js) is the UX; THIS is the
// enforcement — frontend checks are cosmetic per this app's security
// rules, and any logged-in user can hit the broker directly. Keep the
// wordlists and PII patterns IN SYNC with src/lib/content-filter.js
// (deliberate copy: Deno and the Vite client can't share a module here,
// same policy as the verifyToken copies).
//
// Policy (owner, 2026-07-04): profanity in public community text →
// REJECT the write; contact info (emails / UPI handles / Indian phone
// numbers / 12-digit IDs) → silently REDACT before storing.
// Precision first — strict word boundaries only ("Assam"/"class" can
// never match) and NO clinical/anatomy vocabulary in the list ever
// (this is a nursing app).
// =====================================================================

const LATIN_PROFANITY = [
  // English (incl. the common shorthand spellings)
  'fuck', 'fucker', 'fucking', 'fuk', 'fck', 'fcuk', 'shit', 'bullshit',
  'motherfucker', 'bitch',
  'asshole', 'ass', 'arse', 'jackass', 'dumbass', 'bastard', 'dick',
  'dickhead', 'cunt', 'pussy', 'slut', 'whore', 'wanker', 'prick', 'douche',
  'douchebag', 'retard', 'nigger', 'nigga', 'faggot', 'cock',
  // Hindi / Hinglish (romanized)
  'chutiya', 'chutia', 'chutiye', 'bhosdike', 'bhosdi', 'bhosda', 'bhosadike',
  'madarchod', 'behenchod', 'bahenchod', 'bhenchod', 'benchod', 'bc', 'mc',
  'gandu', 'gaandu', 'gaand', 'gand', 'harami', 'haramkhor', 'haramzada',
  'kamina', 'kamine', 'kaminey', 'saala', 'saale', 'randi', 'raand',
  'chod', 'chodu', 'chutmarike', 'lund', 'lauda', 'laude', 'loda', 'lode',
  'jhant', 'jhaatu', 'tatti',
  // Assamese (romanized)
  'khanki', 'khankir', 'bessya', 'beshya', 'beissya', 'suda', 'sudi',
  'sudibo', 'sudiba', 'chuda', 'chudi',
];

const SCRIPT_PROFANITY = [
  // Devanagari (Hindi)
  'चूतिया', 'चुतिया', 'मादरचोद', 'भोसड़ी', 'भोसड़ीके', 'भोसडीके', 'बहनचोद',
  'बहेनचोद', 'गांड', 'गांडू', 'गंदु', 'रंडी', 'लंड', 'लौड़ा', 'हरामी',
  'कमीना', 'कमीने', 'साला', 'साले', 'चोद', 'चूत',
  // Assamese script (shared with Bengali)
  'খানকি', 'খানকীৰ', 'বেশ্যা', 'চুদ', 'চুদা', 'চুদি', 'মাগী',
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const LATIN_RES = LATIN_PROFANITY.map((w) =>
  new RegExp('\\b' + w.split('').map((ch) => esc(ch) + '+').join('') + '\\b', 'gi'));
const SCRIPT_RES = SCRIPT_PROFANITY.map((w) =>
  new RegExp('(?<!\\p{L})' + esc(w) + '(?!\\p{L})', 'gu'));

const LEET: Record<string, string> = { '4': 'a', '@': 'a', '1': 'i', '!': 'i', '0': 'o', '3': 'e', '5': 's', '$': 's', '7': 't' };

function normalizeForMatch(text: unknown): string {
  let s = String(text == null ? '' : text).toLowerCase();
  s = s.replace(/[4@1!035$7]/g, (ch) => LEET[ch] || ch);
  for (let i = 0; i < 3; i++) s = s.replace(/([a-z])[.\-_*]+(?=[a-z])/g, '$1');
  return s;
}

export function containsProfanity(text: unknown): boolean {
  const raw = String(text == null ? '' : text);
  const norm = normalizeForMatch(raw);
  for (const re of LATIN_RES) {
    re.lastIndex = 0;
    if (re.test(raw)) return true;
    re.lastIndex = 0;
    if (norm !== raw.toLowerCase() && re.test(norm)) return true;
  }
  for (const re of SCRIPT_RES) {
    re.lastIndex = 0;
    if (re.test(raw)) return true;
  }
  return false;
}

// PII masks keep a 2-char hint (same UX as the client).
const hint = (m: string) => m.slice(0, 2) + '••••';
const RE_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const RE_UPI = /\b[\w.-]{2,}@[a-z][a-z0-9]{1,}\b/gi;
const RE_ID12 = /(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g;
const RE_PHONE = /(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d(?:[\s-]?\d){8}(?!\d)/g;

export function redactPII(text: unknown): string {
  let s = String(text == null ? '' : text);
  for (const re of [RE_EMAIL, RE_UPI, RE_ID12, RE_PHONE]) {
    re.lastIndex = 0;
    s = s.replace(re, hint);
  }
  return s;
}
