// =====================================================================
// src/ui/use-exit-guard.jsx — "leave this round?" for the Level Up games.
//
// Every game used to bin an in-progress run silently: the TopBar chevron and
// the device/gesture back both went straight to goHome, and coins are ONLY paid
// by onComplete. Half a Ward Boss shift, or 4 of 5 Crash Cart cases, vanished
// with no prompt and no payout.
//
// This wires the two back routes into ONE decision (lib/game-exit.js):
//   • the on-screen arrow  -> requestExit()
//   • device / gesture back -> the shared back-handler registry
//     (lib/back-handler.js), the SAME registry Settings and the Knowledge Map
//     already use. Returning true consumes the press; false lets App navigate.
//
// ⚠ Deliberately NOT a second popstate listener. The quiz once installed its own
// guard above an early `return null` and swallowed the device back button
// forever, because the dialog it wanted to show was never rendered. Here, a run
// that has not started never guards, so a game that early-returns (empty pool)
// still lets back through.
//
// Usage (2 touch points per game):
//   const { requestExit, dialog } = useExitGuard({ started, finished, earned, onLeave: onBack });
//   <TopBar onBack={requestExit} />               ... and ...  {dialog}
// =====================================================================
import React, { useCallback, useState } from 'react';
import { useBackHandler } from '../lib/back-handler.js';
import { shouldGuardExit, exitBody, EXIT_TITLE, EXIT_CONFIRM, EXIT_CANCEL } from '../lib/game-exit.js';
import ConfirmDialog from './confirm-dialog.jsx';

export function useExitGuard({ started = false, finished = false, earned = 0, progress = 0, onLeave }) {
  const [open, setOpen] = useState(false);
  const guard = shouldGuardExit({ started, finished, earned, progress });

  const leave = useCallback(() => {
    setOpen(false);
    if (onLeave) onLeave();
  }, [onLeave]);

  // The on-screen back arrow.
  const requestExit = useCallback(() => {
    if (guard) { setOpen(true); return; }
    leave();
  }, [guard, leave]);

  // The device / gesture back button. We ALWAYS consume it and route it through
  // the same `leave` the on-screen arrow uses, rather than letting App's global
  // handler navigate home behind our back.
  //
  // ⚠ That matters on the RESULTS screen. There is nothing to guard there (the
  // run is over), but leaving still has to go through the game's `finish`, which
  // is the ONLY thing that banks the coins. Returning false here would hand the
  // press to App, which goes straight home and pays the user nothing: the exact
  // bug this round is fixing, just via the hardware button instead of the arrow.
  useBackHandler(useCallback(() => {
    if (open) { setOpen(false); return true; }   // back closes the dialog first
    if (guard) { setOpen(true); return true; }
    leave();
    return true;
  }, [guard, open, leave]));

  const dialog = (
    <ConfirmDialog open={open}
                   title={EXIT_TITLE}
                   body={exitBody(earned)}
                   confirmLabel={EXIT_CONFIRM}
                   cancelLabel={EXIT_CANCEL}
                   tone="danger"
                   onConfirm={leave}
                   onCancel={() => setOpen(false)} />
  );

  return { requestExit, dialog, confirmOpen: open };
}

export default useExitGuard;
