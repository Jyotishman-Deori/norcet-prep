// =====================================================================
// CONTENT GATE  (Pipeline step 38 / A1 session 4 — batch 1b slice 5)
// Shared loading/error placeholder shown while useContent() resolves a
// blob (Reference / Dosage / Learn). [A7] theme via useTheme().
// =====================================================================
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Button } from './primitives.jsx';

// Small shared loading/error placeholder for screens whose content is still
// resolving (or failed). Keeps the gate identical across Reference/Dosage/
// Learn. `onRetry` re-triggers the fetch; shown only on error.
function ContentGate({ loading, error, onRetry, label = 'content' }) {
  const { theme: T } = useTheme();
  return (
    <div className="text-center py-16 anim-fadeup">
      {error ? (
        <>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
               style={{ background: T.surfaceWarm }}>
            <AlertCircle size={24} style={{ color: T.muted }} />
          </div>
          <div className="text-sm font-medium" style={{ color: T.inkSoft }}>Couldn’t load {label}</div>
          <div className="text-xs mt-1 mb-4" style={{ color: T.muted }}>
            Connect to the internet once to download it, then it works offline.
          </div>
          {onRetry && <Button onClick={onRetry} variant="soft" size="sm">Try again</Button>}
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-full mx-auto mb-3 skeleton-pulse"
               style={{ background: T.surfaceWarm }} />
          <div className="text-sm" style={{ color: T.muted }}>Loading {label}…</div>
        </>
      )}
    </div>
  );
}

export { ContentGate };
