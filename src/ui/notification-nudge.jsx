// =====================================================================
// src/ui/notification-nudge.jsx — the one-tap notification opt-in card.
//
// Fixes the "1 subscribed out of 11 users" reach problem: the only opt-in
// used to hide behind the Daily-reminder toggle in Settings. This card
// surfaces it on Home at the right moment — after the user has answered a
// few questions — and enables EVERYTHING in one tap (permission prompt +
// push registration + daily nudge + new-content pings, via App's
// setDailyReminder). All show/snooze rules are pure + tested in
// lib/push-opt-in.js; this file only renders the decision.
//
// States: enable (one tap) · busy · done (auto-hides) · blocked (permission
// denied — honest hint, then quiet) · ios-install (Safari-tab iPhones can't
// subscribe until the app is on the home screen — show the 2 steps instead
// of a dead button). Dismiss = 30-day snooze; two dismissals = never again.
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Check, X, Share, SquarePlus, Loader2 } from 'lucide-react';
import { useTheme, useProfile, useData } from '../lib/app-context.jsx';
import { Card } from './primitives.jsx';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { haptic } from '../lib/juice.js';
import {
  getPushEnv, detectPushSupport, normalizeNudgeState, recordNudgeDismiss, nudgeDecision,
} from '../lib/push-opt-in.js';

export default function NotificationNudge({ onEnable, reminderTime = '20:00' }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const { data } = useData();
  const [decision, setDecision] = useState(null); // null=checking, {show,variant}
  const [phase, setPhase] = useState('idle');     // idle | busy | done | blocked
  const nudgeRef = useRef({ dismissedAt: null, dismissCount: 0 });
  const pid = profile && profile.id;

  // One local read on mount → a pure, tested decision. No network, no polling.
  useEffect(() => {
    if (!pid || !data) return;
    let cancelled = false;
    (async () => {
      let stored = null;
      try {
        const r = await safeStorage.get(KEYS.notifNudge(pid));
        stored = r && r.value != null ? r.value : null;
      } catch (e) { /* unreadable = never dismissed */ }
      if (cancelled) return;
      nudgeRef.current = normalizeNudgeState(stored);
      const pref = (data.preferences && data.preferences.dailyReminder) || {};
      setDecision(nudgeDecision({
        support: detectPushSupport(getPushEnv()),
        permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
        notificationsOn: pref.enabled === true,
        attempted: (data.stats && data.stats.totalAttempted) || 0,
        nudge: nudgeRef.current,
      }));
    })();
    return () => { cancelled = true; };
  }, [pid, data]);

  const persistDismiss = () => {
    nudgeRef.current = recordNudgeDismiss(nudgeRef.current);
    try { safeStorage.set(KEYS.notifNudge(pid), JSON.stringify(nudgeRef.current)); } catch (e) {}
  };

  const dismiss = () => { persistDismiss(); setDecision({ show: false }); };

  const enable = async () => {
    if (phase !== 'idle' || !onEnable) return;
    haptic(8);
    setPhase('busy');
    try {
      const perm = await onEnable(); // App's setDailyReminder({enabled:true}) → permission
      if (perm === 'granted') {
        haptic([10, 40, 18]);
        setPhase('done');
        // Success is its own reward — linger briefly, then leave the Home clean.
        setTimeout(() => setDecision({ show: false }), 3200);
      } else {
        setPhase('blocked');
        persistDismiss(); // don't re-nag someone who just said no to the browser
      }
    } catch (e) { setPhase('blocked'); persistDismiss(); }
  };

  if (!decision || !decision.show || !pid) return null;
  const ios = decision.variant === 'ios-install';

  return (
    <div className="mb-4 nnudge-in">
      <Card className="p-4 relative overflow-hidden"
            style={{ border: `1px solid ${T.accent}3D`,
                     background: `linear-gradient(140deg, ${T.accent}12, transparent 60%)` }}>
        {phase !== 'done' && (
          <button onClick={dismiss} aria-label="Not now"
                  className="no-tap-highlight absolute right-2.5 top-2.5 p-1.5 rounded-full"
                  style={{ color: T.muted }}>
            <X size={15} />
          </button>
        )}

        {phase === 'done' ? (
          /* ---- success ---- */
          <div className="flex items-center gap-3 nnudge-done">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: T.success }}>
              <Check size={20} color="#FFF" strokeWidth={3} />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[15px] font-semibold" style={{ color: T.ink }}>
                You're set! 🔔
              </div>
              <div className="text-[12.5px] mt-0.5 leading-snug" style={{ color: T.inkSoft }}>
                A daily nudge at {reminderTime} + a ping when new questions drop. Fine-tune it
                anytime in Settings.
              </div>
            </div>
          </div>
        ) : ios ? (
          /* ---- iOS Safari tab: install first ---- */
          <div className="flex items-start gap-3 pr-6">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent + '1F' }}>
              <Bell size={19} style={{ color: T.accent }} className="nnudge-bell" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[15px] font-semibold leading-snug" style={{ color: T.ink }}>
                Get study reminders on your iPhone
              </div>
              <div className="text-[12.5px] mt-1 leading-relaxed" style={{ color: T.inkSoft }}>
                iPhones only allow reminders from installed apps. Two steps, ten seconds:
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-[12.5px]" style={{ color: T.inkSoft }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: T.accent + '22', color: T.accent }}>1</span>
                  Tap <Share size={13} style={{ color: T.accent }} aria-label="Share" /> <b>Share</b> in Safari's toolbar
                </div>
                <div className="flex items-center gap-2 text-[12.5px]" style={{ color: T.inkSoft }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: T.accent + '22', color: T.accent }}>2</span>
                  Choose <SquarePlus size={13} style={{ color: T.accent }} aria-label="Add" /> <b>Add to Home Screen</b>, then open the app
                </div>
              </div>
              <button onClick={dismiss}
                      className="no-tap-highlight mt-3 px-3.5 py-1.5 rounded-lg text-[12px] font-bold active:scale-95 transition-transform"
                      style={{ background: T.accent + '1F', color: T.accent }}>
                Got it
              </button>
            </div>
          </div>
        ) : (
          /* ---- one-tap enable ---- */
          <div className="flex items-start gap-3 pr-6">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent + '1F' }}>
              <BellRing size={19} style={{ color: T.accent }} className="nnudge-bell" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[15px] font-semibold leading-snug" style={{ color: T.ink }}>
                Never lose your streak
              </div>
              <div className="text-[12.5px] mt-1 leading-relaxed" style={{ color: T.inkSoft }}>
                One tap: a gentle daily study nudge + a ping when new questions drop.
                No spam — you control it in Settings.
              </div>
              {phase === 'blocked' && (
                <div className="text-[12px] mt-2 leading-snug" style={{ color: T.error || '#DC2626' }}>
                  Notifications are blocked for this site — allow them in your browser
                  settings, then flip the switch in Settings → Notifications.
                </div>
              )}
              {phase !== 'blocked' && (
                <button onClick={enable} disabled={phase === 'busy'}
                        className="no-tap-highlight mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-bold active:scale-95 transition-transform"
                        style={{ background: T.primary, color: '#FFF',
                                 boxShadow: `0 4px 14px ${T.primary}40`,
                                 opacity: phase === 'busy' ? 0.75 : 1 }}>
                  {phase === 'busy' ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                  {phase === 'busy' ? 'Turning on…' : 'Turn on notifications'}
                </button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
