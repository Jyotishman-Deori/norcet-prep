// =====================================================================
// src/screens/rename-profile-modal.jsx — rename profile dialog (A1 slice 19)
// Extracted from App.jsx. Body byte-identical; only change is the A7 hook line
// (T -> useTheme). Props stay { profile, onRename, onClose } (profile is a prop
// passed by RenameProfileHost). Opened via the rename-channel.
// =====================================================================
import React, { useState } from 'react';
import { AlertCircle, RefreshCw, Save, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { normalizeProfileId } from '../lib/profile-crypto.js';
import { log } from '../lib/log.js';

function RenameProfileModal({ profile, onRename, onClose }) {
  const { theme: T } = useTheme();
  const [value, setValue] = useState(profile.displayName || '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const trimmed = value.trim();
  const newId = normalizeProfileId(trimmed);
  const idCleared = trimmed && !newId;

  const close = () => { if (!busy) onClose(); };
  const dialogRef = useFocusTrap(close);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!trimmed) { setError('Enter a display name'); return; }
    if (!newId) { setError('Name needs at least one letter or number'); return; }
    if (trimmed === profile.displayName) { onClose(); return; }
    setBusy(true);
    try {
      await onRename(trimmed);
      setBusy(false);
      onClose();
    } catch (e) {
      setError(e.message || 'Could not rename');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={close}>
      <Card className="w-full max-w-md anim-scalein"
            onClick={e => e.stopPropagation()}>
        <div className="p-5" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Rename profile">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>Rename profile</div>
            <button onClick={close}
                    aria-label="Close"
                    className="no-tap-highlight p-1.5 -m-1.5 rounded-lg active:bg-black/5"
                    disabled={busy}>
              <X size={18} style={{ color: T.muted }} />
            </button>
          </div>

          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
            New name
          </div>
          <input value={value}
                 onChange={e => setValue(e.target.value)}
                 autoCapitalize="words"
                 autoComplete="off"
                 placeholder="Your name"
                 className="w-full rounded-xl px-3 py-3 mb-3 text-sm"
                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />

          {/* Warning panel — always make clear this IS the new login name.
              The user is renaming for a reason; we don't want copy that
              suggests the rename "doesn't really" change anything. */}
          <Card className="p-3 mb-3"
                style={{ background: T.accent + '12', border: `1px solid ${T.accent}40` }}>
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5"
                           style={{ color: T.accent }} />
              <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                <span className="font-semibold" style={{ color: T.accent }}>You'll log in with this new name from now on.</span>{' '}
                Make sure you remember it — your password and date of birth are unchanged.
              </div>
            </div>
          </Card>

          {idCleared && (
            <div className="text-xs mb-3 px-1" style={{ color: T.error }}>
              Needs at least one letter or number.
            </div>
          )}
          {error && (
            <div className="text-xs mb-3 px-1" style={{ color: T.error }}>{error}</div>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={close} disabled={busy} className="flex-1">Cancel</Button>
            <Button onClick={submit}
                    disabled={busy || !trimmed || !newId || trimmed === profile.displayName}
                    className="flex-1"
                    icon={busy ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default RenameProfileModal;
