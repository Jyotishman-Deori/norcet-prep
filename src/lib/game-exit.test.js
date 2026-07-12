// =====================================================================
// src/lib/game-exit.test.js — the "leave this round?" decision.
// Run: node src/lib/game-exit.test.js
// =====================================================================
import assert from 'node:assert/strict';
import { shouldGuardExit, exitBody, EXIT_TITLE, EXIT_CONFIRM, EXIT_CANCEL } from './game-exit.js';

// ---- the core rule: ask ONLY when there is something to lose ----
{
  // Nothing started: leaving is free. This is the browsing user who opens a game,
  // reads the intro and backs straight out. Nagging them is the "not effortless"
  // feeling we are removing, so it must NOT guard.
  assert.equal(shouldGuardExit({ started: false, earned: 0, progress: 0 }), false);
  assert.equal(shouldGuardExit({ started: false, earned: 500, progress: 9 }), false,
    'not started beats everything: nothing is on the table yet');

  // Started but nothing done yet: still free to leave (round 1, no answer given).
  assert.equal(shouldGuardExit({ started: true, earned: 0, progress: 0 }), false);

  // Started WITH coins on the table: ask.
  assert.equal(shouldGuardExit({ started: true, earned: 15, progress: 0 }), true);

  // Started with PROGRESS but no coins: still ask. This is the losing run, the
  // one where every answer was wrong. It is worth 0 coins but it is still several
  // minutes of the user's life, and binning it silently is exactly the bug.
  assert.equal(shouldGuardExit({ started: true, earned: 0, progress: 3 }), true);

  // Finished (already paid out) trumps everything: there is nothing left to lose.
  assert.equal(shouldGuardExit({ started: true, finished: true, earned: 900, progress: 12 }), false,
    'a paid-out run never guards, or the user would be trapped on the results screen');
}

// ---- garbage in never throws, and never guards spuriously ----
{
  assert.equal(shouldGuardExit(), false, 'no args at all');
  assert.equal(shouldGuardExit({}), false);
  assert.equal(shouldGuardExit({ started: true, earned: NaN, progress: NaN }), false,
    'NaN is not "something to lose"');
  assert.equal(shouldGuardExit({ started: true, earned: undefined, progress: undefined }), false);
  // Non-finite is treated as "no stake", the same rule the award engines use for
  // garbage (see levelup.completeGame / economy.addCoins). Unreachable in practice:
  // a real run always guards on `progress` anyway, which is a plain counter.
  assert.equal(shouldGuardExit({ started: true, earned: Infinity, progress: 0 }), false);
  assert.equal(shouldGuardExit({ started: true, earned: Infinity, progress: 2 }), true,
    'a real run still guards on progress, whatever the coin count says');
  assert.equal(shouldGuardExit({ started: true, earned: -50, progress: 0 }), false,
    'a negative balance is not something to lose');
  assert.equal(typeof shouldGuardExit({ started: true, earned: 1 }), 'boolean', 'always a boolean');
}

// ---- the copy ----
{
  // No em dashes and no double hyphens anywhere in user-facing copy (house rule).
  const strings = [EXIT_TITLE, EXIT_CONFIRM, EXIT_CANCEL, exitBody(0), exitBody(1), exitBody(250)];
  for (const s of strings) {
    assert.ok(typeof s === 'string' && s.length > 0, 'copy is a non-empty string');
    assert.ok(!s.includes('—'), `no em dash in: ${s}`);
    assert.ok(!s.includes('--'), `no double hyphen in: ${s}`);
  }

  // The body names the actual stake, so the confirm is never a generic scare.
  assert.ok(exitBody(250).includes('250'), 'the coin count is named');
  assert.ok(exitBody(1).includes('1 coin') && !exitBody(1).includes('1 coins'), 'singular reads correctly');
  assert.ok(exitBody(2).includes('2 coins'), 'plural reads correctly');

  // With nothing earned it must NOT claim coins are at stake (that would be a lie:
  // this is the losing-run case, guarded on progress alone).
  assert.ok(!exitBody(0).includes('coin'), 'a 0-coin round never mentions coins');
  assert.ok(exitBody(0).length > 0);

  // Garbage never leaks into the copy.
  assert.ok(!exitBody(NaN).includes('NaN'));
  assert.ok(!exitBody(undefined).includes('undefined'));
  assert.ok(!exitBody(-5).includes('-5'));
}

console.log('game-exit.test.js: all assertions passed');
