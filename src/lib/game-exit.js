// =====================================================================
// src/lib/game-exit.js — should leaving a game ask first?
//
// Every Level Up game used to discard a run silently on back: the chevron and
// the device/gesture back both went straight to goHome, and coins are only paid
// by onComplete. A half-finished Ward Boss shift or a 4-of-5 Crash Cart round
// vanished with no prompt and no payout.
//
// But guarding EVERY back press would be worse than the bug. Opening a game,
// reading the intro and backing straight out is the single most common thing a
// browsing user does, and making that cost a dialog is exactly the "not
// effortless" feeling we are trying to remove. So the rule is:
//
//   ask ONLY when there is something real to lose.
//
// PURE + framework-free so it can be unit-tested on its own.
// =====================================================================

// `started`  — the run is actually under way (past the intro/setup view).
// `finished` — the run already paid out (onComplete fired); nothing left to lose.
// `earned`   — coins banked so far in this run (0 while nothing has been scored).
// `progress` — optional: rounds/questions completed so far, for games that can be
//              deep into a run while still worth 0 coins (a losing Ward Boss shift).
export function shouldGuardExit({ started = false, finished = false, earned = 0, progress = 0 } = {}) {
  if (finished) return false;
  if (!started) return false;
  const coins = Number.isFinite(earned) ? earned : 0;
  const steps = Number.isFinite(progress) ? progress : 0;
  return coins > 0 || steps > 0;
}

// The one piece of copy, so all 12 games say the same thing. Kept deliberately
// short and non-preachy: this is a 60-second arcade round, not an exam.
export const EXIT_TITLE = 'Leave this round?';

// Body adapts to whether there are coins on the table. No em dashes.
export function exitBody(earned = 0) {
  const coins = Number.isFinite(earned) && earned > 0 ? Math.floor(earned) : 0;
  if (coins > 0) {
    return `You have ${coins} coin${coins === 1 ? '' : 's'} riding on this round. Leaving now ends it and you keep nothing. Finish the round to bank them.`;
  }
  return 'This round is still in progress. Leaving now ends it, and nothing is saved.';
}

export const EXIT_CONFIRM = 'Leave round';
export const EXIT_CANCEL = 'Keep playing';
