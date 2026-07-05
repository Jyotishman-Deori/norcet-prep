// =====================================================================
// HOME SUPPORT NUDGE  (Pipeline step 38 / A1 session 4 — batch 1b
// slice 9 — extracted from App.jsx)
// The donation/support card shown on Home once the user has answered
// enough questions, unless they've dismissed it. [A7] theme via
// useTheme(); opens the support modal via the requestSupport() channel
// (now in primitives). The dismissal flag + gate constant are
// nudge-private and travel with it.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Heart, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { safeStorage } from '../lib/safe-storage.js';
import { Card } from './primitives.jsx';
import { requestSupport } from './primitives.jsx';

const DONATE_DISMISSED_KEY = 'donatedismissed:v1';
const DONATE_HOME_GATE = 100;                    // questions answered before the Home card shows

// ---- Local dismissal (shared:false; guests included) ----
async function loadDonateDismissed() {
  try {
    const r = await safeStorage.get(DONATE_DISMISSED_KEY, false);
    if (r && r.value != null) return r.value === 'true' || r.value === true || r.value === '1';
  } catch (e) {}
  return false;
}
async function saveDonateDismissed() {
  try { await safeStorage.set(DONATE_DISMISSED_KEY, 'true', false); } catch (e) {}
}

function HomeSupportNudge({ totalAttempted }) {
  const { theme: T } = useTheme();
  const [dismissed, setDismissed] = useState(null); // null = still loading
  useEffect(() => { let on = true; loadDonateDismissed().then(v => { if (on) setDismissed(v); }); return () => { on = false; }; }, []);
  if (dismissed !== false) return null;                 // loading, or already dismissed
  if ((totalAttempted || 0) < DONATE_HOME_GATE) return null;

  const dismiss = (e) => { if (e) e.stopPropagation(); setDismissed(true); saveDonateDismissed(); };

  return (
    <Card className="p-3 mb-4 anim-fadeup cursor-pointer no-tap-highlight pressable"
          onClick={() => requestSupport()}
          ariaLabel="Support the app"
          style={{ background: T.primary + '0E', border: `1px solid ${T.primary}33` }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '1A' }}>
          <Heart size={17} style={{ color: T.primary }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold" style={{ color: T.ink }}>Enjoying NurseHolic? {'\u2615'}</div>
          <div className="text-xs mt-0.5 leading-relaxed" style={{ color: T.inkSoft }}>
            It's free and ad-free. You can buy me a chai to help keep it that way.
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss"
                className="no-tap-highlight p-1 -m-1 rounded-lg active:bg-black/5 flex-shrink-0">
          <X size={16} style={{ color: T.muted }} />
        </button>
      </div>
    </Card>
  );
}

export { HomeSupportNudge };
