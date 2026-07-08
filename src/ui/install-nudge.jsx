// =====================================================================
// src/ui/install-nudge.jsx — the "get the full app" install card (Home).
//
// Companion to notification-nudge.jsx and deliberately subordinate to it:
// installDecision() returns show:false whenever the notification card is
// on screen (one ask at a time; notifications go first). Rules are pure +
// tested in lib/install-prompt.js; this file renders the decision.
//
//   • 'native' (Android / desktop Chrome+Edge): one tap replays the
//     captured beforeinstallprompt — the REAL install sheet, no steps.
//   • 'ios': Safari has no install event — show the two-step walkthrough
//     (and say why it's worth it: reminders only work installed).
// Dismiss = 30-day snooze, twice = never again (same contract as the
// notification card). Visuals reuse the nnudge-* animation family, which
// is already registered in the reduced-motion block.
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { Download, Check, X, Share, SquarePlus, Loader2, Smartphone } from 'lucide-react';
import { useTheme, useProfile, useData } from '../lib/app-context.jsx';
import { Card } from './primitives.jsx';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { haptic } from '../lib/juice.js';
import {
  getPushEnv, detectPushSupport, normalizeNudgeState, recordNudgeDismiss, nudgeDecision,
} from '../lib/push-opt-in.js';
import {
  installDecision, isInstalledDevice, hasDeferredPrompt, promptInstall,
} from '../lib/install-prompt.js';

export default function InstallNudge() {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const { data } = useData();
  const [decision, setDecision] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | busy | done
  const stateRef = useRef({ dismissedAt: null, dismissCount: 0 });
  const pid = profile && profile.id;

  useEffect(() => {
    if (!pid || !data) return;
    let cancelled = false;
    (async () => {
      let installStored = null;
      let notifStored = null;
      try {
        const r = await safeStorage.get(KEYS.installNudge(pid));
        installStored = r && r.value != null ? r.value : null;
      } catch (e) { /* never dismissed */ }
      try {
        const r = await safeStorage.get(KEYS.notifNudge(pid));
        notifStored = r && r.value != null ? r.value : null;
      } catch (e) { /* never dismissed */ }
      if (cancelled) return;
      stateRef.current = normalizeNudgeState(installStored);
      const env = getPushEnv();
      const pref = (data.preferences && data.preferences.dailyReminder) || {};
      const attempted = (data.stats && data.stats.totalAttempted) || 0;
      // Same pure decision the notification card makes for itself — the two
      // components stay in lockstep because the inputs are identical.
      const notif = nudgeDecision({
        support: detectPushSupport(env),
        permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
        notificationsOn: pref.enabled === true,
        attempted,
        nudge: notifStored,
      });
      setDecision(installDecision({
        installed: isInstalledDevice(env.standalone),
        isIOS: env.isIOS,
        hasPrompt: hasDeferredPrompt(),
        attempted,
        notifShowing: notif.show,
        install: stateRef.current,
      }));
    })();
    return () => { cancelled = true; };
  }, [pid, data]);

  const persistDismiss = () => {
    stateRef.current = recordNudgeDismiss(stateRef.current);
    try { safeStorage.set(KEYS.installNudge(pid), JSON.stringify(stateRef.current)); } catch (e) {}
  };
  const dismiss = () => { persistDismiss(); setDecision({ show: false }); };

  const install = async () => {
    if (phase !== 'idle') return;
    haptic(8);
    setPhase('busy');
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      haptic([10, 40, 18]);
      setPhase('done');
      setTimeout(() => setDecision({ show: false }), 3200);
    } else {
      // Declined the native sheet (or it was unavailable) — snooze quietly.
      persistDismiss();
      setDecision({ show: false });
    }
  };

  if (!decision || !decision.show || !pid) return null;
  const ios = decision.variant === 'ios';

  return (
    <div className="mb-4 nnudge-in">
      <Card className="p-4 relative overflow-hidden"
            style={{ border: `1px solid ${T.primary}33`,
                     background: `linear-gradient(140deg, ${T.primary}10, transparent 60%)` }}>
        {phase !== 'done' && (
          <button onClick={dismiss} aria-label="Not now"
                  className="no-tap-highlight absolute right-2.5 top-2.5 p-1.5 rounded-full"
                  style={{ color: T.muted }}>
            <X size={15} />
          </button>
        )}

        {phase === 'done' ? (
          <div className="flex items-center gap-3 nnudge-done">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: T.success }}>
              <Check size={20} color="#FFF" strokeWidth={3} />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[15px] font-semibold" style={{ color: T.ink }}>
                Installing… 📲
              </div>
              <div className="text-[12.5px] mt-0.5 leading-snug" style={{ color: T.inkSoft }}>
                NurseHolic is landing on your home screen, open it from there for the
                full-screen, offline-ready app.
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 pr-6">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: T.primary + '1A' }}>
              <Smartphone size={19} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[15px] font-semibold leading-snug" style={{ color: T.ink }}>
                Make it a real app
              </div>
              <div className="text-[12.5px] mt-1 leading-relaxed" style={{ color: T.inkSoft }}>
                {ios
                  ? 'Full screen, works offline, one tap from your home screen, and study reminders only work from the installed app.'
                  : 'Full screen, works offline, opens in one tap from your home screen. No app store, no download size.'}
              </div>
              {ios ? (
                <>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-2 text-[12.5px]" style={{ color: T.inkSoft }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ background: T.primary + '1F', color: T.primary }}>1</span>
                      Tap <Share size={13} style={{ color: T.primary }} aria-label="Share" /> <b>Share</b> in Safari's toolbar
                    </div>
                    <div className="flex items-center gap-2 text-[12.5px]" style={{ color: T.inkSoft }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ background: T.primary + '1F', color: T.primary }}>2</span>
                      Choose <SquarePlus size={13} style={{ color: T.primary }} aria-label="Add" /> <b>Add to Home Screen</b>
                    </div>
                  </div>
                  <button onClick={dismiss}
                          className="no-tap-highlight mt-3 px-3.5 py-1.5 rounded-lg text-[12px] font-bold active:scale-95 transition-transform"
                          style={{ background: T.primary + '1A', color: T.primary }}>
                    Got it
                  </button>
                </>
              ) : (
                <button onClick={install} disabled={phase === 'busy'}
                        className="no-tap-highlight mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-bold active:scale-95 transition-transform"
                        style={{ background: T.primary, color: '#FFF',
                                 boxShadow: `0 4px 14px ${T.primary}40`,
                                 opacity: phase === 'busy' ? 0.75 : 1 }}>
                  {phase === 'busy' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {phase === 'busy' ? 'Opening…' : 'Install app'}
                </button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
