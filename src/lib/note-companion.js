// =====================================================================
// src/lib/note-companion.js — "study companion" identity for the note popup.
//
// PURE logic only (no React, storage, DOM, or I/O), so it is unit-tested
// directly under Node and safe to import anywhere. It owns:
//   - the name rules (<=10 chars) + sanitisation,
//   - the first-run name SUGGESTIONS + a random picker,
//   - greetingFor(name): a rotating casual greeting for later opens,
//   - the authored GUIDE content shown in the popup's guide view.
//
// The name gives the feature a "best friend / partner in crime" feel; storage
// of the chosen name lives in notes-store.js (local, per profile).
// =====================================================================

// The user's chosen name must not exceed 10 characters (product rule).
export const NAME_MAX = 10;

// Friendly, short first-run suggestions — a mix of buddy-ish and study vibes.
export const SUGGESTIONS = ['Nova', 'Sage', 'Buddy', 'Echo', 'Pixel', 'Riz', 'Juno', 'Ace'];

// Trim, drop control characters, collapse inner whitespace, and cap at
// NAME_MAX. Returns '' for anything unusable (empty / non-string / all-blank),
// which the caller treats as "not a valid name yet". Unicode/emoji preserved.
export function sanitizeName(s) {
  if (typeof s !== 'string') return '';
  const cleaned = Array.from(s)
    .filter((ch) => { const c = ch.codePointAt(0); return c >= 0x20 && c !== 0x7f; })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  // Cap by code points (not UTF-16 units) so a 10-emoji name isn't cut mid-pair.
  return Array.from(cleaned).slice(0, NAME_MAX).join('');
}

// Is this a usable name? (non-empty after sanitising, within the cap)
export function isValidName(s) {
  const n = sanitizeName(s);
  const len = Array.from(n).length;
  return len > 0 && len <= NAME_MAX;
}

// Pick a random suggestion. `rnd` is injectable for deterministic tests.
export function pickSuggestion(rnd = Math.random) {
  return SUGGESTIONS[Math.floor(rnd() * SUGGESTIONS.length)] || SUGGESTIONS[0];
}

// Rotating casual greeting for a returning user, keyed to their companion name.
// `rnd` injectable for tests. Always returns a string containing the name.
const GREETINGS = [
  (n) => `${n} reporting for duty 🫡`,
  (n) => `Back at it, partner? ${n}'s ready.`,
  (n) => `${n} here — what are we cracking today?`,
  (n) => `Good to see you. ${n}'s got your back.`,
  (n) => `Let's make it count — ${n} standing by.`,
  (n) => `${n} at your service. Drop your notes.`,
  (n) => `Round two? ${n}'s all ears.`,
  (n) => `${n} missed you. Let's learn something.`,
];

export function greetingFor(name, rnd = Math.random) {
  const n = sanitizeName(name) || 'Buddy';
  const pick = GREETINGS[Math.floor(rnd() * GREETINGS.length)] || GREETINGS[0];
  return pick(n);
}

// Authored guide content (spec: "how it will help, techniques, limitations").
// Plain text, rendered in the popup's guide view. `{name}` is substituted by
// the caller so the copy stays personal. No markdown.
export const GUIDE = [
  {
    heading: 'What this is',
    body: 'A quick scratchpad for the important stuff — up to 10 short notes (a topic, a word, a question) while you study. {name} keeps them safe on this device so you can come back to them.',
  },
  {
    heading: 'How it helps',
    body: 'When you are ready to go deeper, copy your notes and paste them into any AI chat (Gemini, ChatGPT, Claude). Instead of a plain list, {name} can wrap them into a focused study-coach prompt so the AI teaches you actively — not just summarises.',
  },
  {
    heading: 'Two ways to copy',
    body: 'DIRECT copies your notes exactly as written. EFFECTIVE wraps them in a tailored learning prompt — you pick a Designation (the expert persona), your Level, and a Strategy, and {name} builds the rest.',
  },
  {
    heading: 'The techniques (Strategies)',
    body: 'Gatekeeper: locked phases you unlock by passing checkpoints. Blind Spots: you explain first, it grades and targets your gaps. Stress-Test: an escalating patient scenario. Trap Tester: rapid "life-saver or license-killer?" calls. Not sure? The Recommended picks fit almost any topic.',
  },
  {
    heading: 'Good to know (limitations)',
    body: 'Notes live only on THIS device and browser cache — they are not synced to any server, and clearing your browser storage (or long inactivity) can remove them, so keep anything vital elsewhere too. There is a Clear button when you want a fresh start. {name} prepares a prompt for an external AI — it is not itself a chatbot, and nothing you write ever leaves your device until you copy and paste it yourself. Max 10 notes at a time.',
  },
];

// Substitute the companion name into a guide body/heading string.
export function personalize(text, name) {
  const n = sanitizeName(name) || 'your companion';
  return String(text == null ? '' : text).split('{name}').join(n);
}
