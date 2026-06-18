// =====================================================================
// SECURITY QUESTIONS  (issues_new #3 — replaces DOB password recovery)
// ---------------------------------------------------------------------
// A small curated list of personal recovery questions, in the spirit of
// what early Facebook offered. During sign-up the user picks ONE of these
// and types an answer; the answer is hashed server-side (auth-secure) and
// stored in profile_secrets alongside the password — never in the public
// blob. During recovery the chosen question is shown back and the answer
// is verified (case-insensitively) before a reset is allowed.
//
// WHY a fixed list (not free-text questions): a curated set keeps the
// sign-up step a single tap + one short answer (calm, lightweight), and
// guarantees the recovery screen can show the EXACT question text back to
// the user from the same source of truth.
//
// IMPORTANT — normalization parity:
//   normalizeAnswer() below MUST stay byte-identical to the server-side
//   normalization in supabase/functions/auth-secure/index.ts. Both lower-
//   case, trim, and collapse internal whitespace so that "Rex ", "rex" and
//   "REX" all match. The client uses it only for light validation; the
//   authoritative hash + compare happens server-side.
// =====================================================================

export const SECURITY_QUESTIONS = [
  "What is your pet's name?",
  "What is your favourite hobby?",
  "What was the name of your first school?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What is your favourite teacher's name?",
  "What was your childhood nickname?",
  "What is the name of your best friend from school?",
];

// Lowercase + trim + collapse internal whitespace. Keep IN SYNC with the
// server. Returns '' for nullish input.
export function normalizeAnswer(answer) {
  if (answer == null) return '';
  return String(answer).trim().replace(/\s+/g, ' ').toLowerCase();
}

// Is this question text one of the curated options? (Defensive — used so a
// stale/edited question on an old account is still rendered, but new picks
// are constrained to the list in the UI.)
export function isKnownQuestion(q) {
  return typeof q === 'string' && SECURITY_QUESTIONS.includes(q);
}
