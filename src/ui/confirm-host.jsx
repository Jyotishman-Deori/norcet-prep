// =====================================================================
// src/ui/confirm-host.jsx  (#7 — app-root confirmation host)
// Mounts ONE ConfirmDialog at the app root and registers an imperative
// opener so any screen can call requestConfirm({...}) without threading
// its own dialog state. Same app-root pattern as FeedbackHost / SupportHost
// (so the dialog's position:fixed centring isn't broken by a transformed
// ancestor). The opts.onConfirm / opts.onCancel callbacks fire, then the
// dialog closes.
// =====================================================================
import React, { useEffect, useState, useCallback } from 'react';
import ConfirmDialog from './confirm-dialog.jsx';
import { registerConfirmOpener } from './primitives.jsx';

export default function ConfirmHost() {
  const [opts, setOpts] = useState(null);

  useEffect(() => {
    registerConfirmOpener((o) => setOpts(o || {}));
    return () => registerConfirmOpener(null);
  }, []);

  const close = useCallback(() => setOpts(null), []);

  if (!opts) return null;

  return (
    <ConfirmDialog
      open
      icon={opts.icon || null}
      title={opts.title}
      body={opts.body}
      confirmLabel={opts.confirmLabel || 'Confirm'}
      cancelLabel={opts.cancelLabel || 'Cancel'}
      tone={opts.tone || 'danger'}
      onConfirm={() => { try { opts.onConfirm && opts.onConfirm(); } finally { close(); } }}
      onCancel={() => { try { opts.onCancel && opts.onCancel(); } finally { close(); } }}
    />
  );
}
