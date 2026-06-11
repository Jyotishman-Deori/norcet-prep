// =====================================================================
// src/ui/share-app-card.jsx  (#27 — "Share NORCET Prep" card, Settings)
// One-tap word-of-mouth sharing + a three-tab install guide (Android / iOS /
// Web). Uses the native OS share sheet via navigator.share where supported;
// falls back to clipboard copy. The shared URL carries `?ref=share` so
// in-app-share installs are distinguishable later (the parameter structure
// also leaves room for per-user referral codes — empty for now by design).
// Visual treatment mirrors the elevated support card (#20): primary-tinted
// header so both Feedback-section cards read as intentionally special.
// =====================================================================
import React, { useEffect, useState } from 'react';
import { Check, Copy, Share2, Smartphone } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from '../ui/primitives.jsx';

const TABS = [
  { id: 'android', label: 'Android' },
  { id: 'ios', label: 'iOS' },
  { id: 'web', label: 'Web' },
];

const STEPS = {
  android: [
    'Open the link in Chrome for Android',
    'Tap the three-dot menu (⋮) at the top right',
    'Tap "Add to Home screen" and confirm',
    'NORCET Prep appears on your home screen — opens as a full app, no browser bar',
  ],
  ios: [
    'Open the link in Safari — must be Safari, not Chrome',
    'Tap the Share icon at the bottom of the screen',
    'Scroll and tap "Add to Home Screen"',
    'Tap Add — NORCET Prep is now a full-screen app on your iPhone',
  ],
  web: [
    'Open the link in any browser — works as a full website',
    'Bookmark it for quick access — all your progress syncs automatically',
    'For the best experience, follow the Android or iOS steps to install it as a home screen app',
  ],
};

export default function ShareAppCard() {
  const { theme: T } = useTheme();
  const [tab, setTab] = useState('android'); // most of the user base
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  const baseUrl = (typeof window !== 'undefined' && window.location && window.location.origin) || 'https://norcetprep.app';
  const shareUrl = `${baseUrl}/?ref=share`;
  const displayUrl = baseUrl.replace(/^https?:\/\//, '');
  const shareText = `I've been using NORCET Prep to study for AIIMS NORCET — it's free and really good. Open it in Chrome (Android) or Safari (iOS) and add it to your home screen for the best experience: ${shareUrl}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {}
  };
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'NORCET Prep', text: shareText });
        setShared(true);
        setTimeout(() => setShared(false), 1800);
        return;
      }
    } catch (e) { /* user cancelled / unsupported — fall through */ }
    copy();
  };

  const tabIdx = TABS.findIndex(t => t.id === tab);

  return (
    <Card className="mb-3 overflow-hidden p-0">
      {/* tinted header — same elevation language as the support card */}
      <div className="p-4" style={{ background: T.primary + '12', borderBottom: `1px solid ${T.primary}25` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary }}>
            <Share2 size={18} color="#FFF" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium" style={{ color: T.primary }}>Share NORCET Prep</div>
            <div className="text-xs mt-0.5" style={{ color: T.muted }}>
              Help a fellow nurse crack NORCET — send them the link
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* shareable URL pill */}
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
             style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
          <span className="font-mono text-xs flex-1 truncate" style={{ color: T.inkSoft }}>{displayUrl}</span>
          <button onClick={copy} aria-label="Copy link"
                  className="no-tap-highlight p-1.5 -mr-1 rounded-lg active:bg-black/5">
            {copied ? <Check size={14} style={{ color: T.success }} /> : <Copy size={14} style={{ color: T.muted }} />}
          </button>
        </div>

        {/* action buttons */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {canShare && (
            <button onClick={share}
                    className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition"
                    style={{ background: shared ? T.success : T.primary, color: '#FFF' }}>
              <Share2 size={13} /> {shared ? '✓ Link ready!' : 'Share link'}
            </button>
          )}
          <button onClick={copy}
                  className={"no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition" + (canShare ? '' : ' col-span-2')}
                  style={{ background: copied ? T.success + '18' : T.primary + '14', color: copied ? T.success : T.primary, border: `1px solid ${copied ? T.success + '50' : T.primary + '40'}` }}>
            <Copy size={13} /> {copied ? '✓ Copied!' : 'Copy link'}
          </button>
        </div>

        {/* divider */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 border-t" style={{ borderColor: T.borderSoft }} />
          <span className="text-[10px] uppercase tracking-wider font-semibold inline-flex items-center gap-1" style={{ color: T.muted }}>
            <Smartphone size={10} /> Install as app
          </span>
          <div className="flex-1 border-t" style={{ borderColor: T.borderSoft }} />
        </div>

        {/* sliding-pill tabs — equal widths, so the pill is a simple
            translateX with spring overshoot */}
        <div className="relative flex p-1 rounded-2xl mb-3" style={{ background: T.surfaceWarm }}>
          <div className="absolute top-1 bottom-1 rounded-xl pointer-events-none"
               style={{
                 left: 4, width: 'calc((100% - 8px) / 3)',
                 transform: `translateX(${tabIdx * 100}%)`,
                 background: T.surface,
                 boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                 transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)',
               }} aria-hidden="true" />
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className="no-tap-highlight relative flex-1 py-1.5 rounded-xl text-[12px] font-semibold"
                    style={{ color: tab === t.id ? T.primary : T.muted, transition: 'color 0.25s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* steps — keyed on tab so the cross-fade re-runs per switch */}
        <ol key={tab} className="anim-fadeup space-y-1.5 mb-3 pl-1">
          {STEPS[tab].map((s, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed" style={{ color: T.inkSoft }}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[9px] font-bold"
                    style={{ background: T.primary + '15', color: T.primary }}>{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        <div className="text-[11px] leading-relaxed pl-2.5 py-1.5" style={{ color: T.muted, borderLeft: `2.5px solid ${T.primary}50` }}>
          Works in any browser — but installing as a home screen app gives you faster loading, full screen, and offline access.
        </div>
      </div>
    </Card>
  );
}
