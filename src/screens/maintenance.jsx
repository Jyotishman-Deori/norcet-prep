// =====================================================================
// src/screens/maintenance.jsx — maintenance / kill switch (doc 6.2).
//
// MaintenanceHost is mounted once at the app root (next to FeedbackHost etc.).
// It watches the live game_config `maintenance` block and, when `on` is true,
// drops a full-screen overlay over the app so users see a calm "we are down for
// a bit" screen instead of a broken build. Toggled from the admin Live config
// editor with NO redeploy (kv_shared row, ~60s cache).
//
// Fail-OPEN: config defaults keep it off, so a config outage never bricks the
// app. Escape hatches so the OWNER is never locked out of the live site:
//   • ?maintbypass=1 in the URL (persisted in localStorage), and
//   • any internalIds (tester) account.
//
// Self-contained: reads theme + getConfig() + isInternalSession() only. No
// profile/data context needed, so it works before login too. English fallback
// copy is hardcoded (like the ErrorBoundary); the admin-set title/message win.
// =====================================================================
import React, { useEffect, useState } from 'react';
import { RotateCcw, Stethoscope } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { getConfig } from '../lib/game-config.js';
import { isInternalSession } from '../lib/internal-accounts.js';

const BYPASS_KEY = 'nh:maintbypass';

// True when this device should see through the gate (owner / tester escape
// hatch). Reading ?maintbypass=1 once STICKS it, so a reload still bypasses.
function maintenanceBypassed() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('maintbypass') === '1') localStorage.setItem(BYPASS_KEY, '1');
    if (localStorage.getItem(BYPASS_KEY) === '1') return true;
  } catch (e) { /* private-mode / no storage */ }
  try { return isInternalSession(); } catch (e) { return false; }
}

// The maintenance block to show, or null. Read synchronously so first paint is
// already correct (no flash) and so a server render reflects the current config.
function evaluateMaintenance() {
  const m = (getConfig() && getConfig().maintenance) || null;
  return m && m.on && !maintenanceBypassed() ? m : null;
}

export function MaintenanceHost() {
  const { theme: T } = useTheme();
  // `active` holds the maintenance block when the gate should show, else null.
  const [active, setActive] = useState(evaluateMaintenance);

  useEffect(() => {
    const reeval = () => setActive(evaluateMaintenance());
    // applyRemoteConfig fires this whenever the live config is (re)loaded.
    window.addEventListener('norcet:config-applied', reeval);
    // Belt and braces: re-check when the tab regains focus.
    document.addEventListener('visibilitychange', reeval);
    return () => {
      window.removeEventListener('norcet:config-applied', reeval);
      document.removeEventListener('visibilitychange', reeval);
    };
  }, []);

  if (!active) return null;

  const title = (active.title || '').trim() || 'Down for a quick tune-up';
  const message = (active.message || '').trim()
    || 'NurseHolic is briefly offline for maintenance. Your progress is safe on your device and in the cloud. Please check back in a few minutes.';

  return (
    <div role="alertdialog" aria-modal="true" aria-label="Maintenance"
         className="fixed inset-0 z-[2000] flex items-center justify-center p-6"
         style={{ background: T.bg }}>
      <div className="w-full text-center" style={{ maxWidth: 420 }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
             style={{
               background: `linear-gradient(135deg, ${T.primary}22, ${T.primary}0C)`,
               border: `1.5px solid ${T.primary}30`,
             }}>
          <Stethoscope size={30} style={{ color: T.primary }} aria-hidden="true" />
        </div>
        <div className="font-display text-2xl font-semibold mb-2.5" style={{ color: T.ink }}>
          {title}
        </div>
        <div className="text-sm leading-relaxed mb-7" style={{ color: T.inkSoft }}>
          {message}
        </div>
        <button onClick={() => { try { window.location.reload(); } catch (e) {} }}
                className="no-tap-highlight inline-flex items-center justify-center gap-2 px-6 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                style={{ background: T.primary, color: '#FFF', minHeight: 48, boxShadow: `0 4px 16px ${T.primary}45` }}>
          <RotateCcw size={16} aria-hidden="true" /> Try again
        </button>
        <div className="text-[11px] mt-6" style={{ color: T.muted }}>NurseHolic</div>
      </div>
    </div>
  );
}

export default MaintenanceHost;
