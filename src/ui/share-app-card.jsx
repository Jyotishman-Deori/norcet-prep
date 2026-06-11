// =====================================================================
// src/ui/share-app-card.jsx  (#27 — reworked per #10 feedback)
// The install guide now travels WITH the link instead of sitting in the
// card (the sender already knows the app — the FRIEND needs the steps).
// The user picks who they're sending to — Android / iOS / Web friend, or
// All — and the outgoing message is composed for that platform: a classy,
// textured plain-text note with the link and the exact "add to home
// screen" steps for THAT device. The in-card link pill got the premium
// treatment (display serif, gradient texture, glow ring).
// =====================================================================
import React, { useEffect, useState } from 'react';
import { Check, Copy, Share2, Smartphone } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from '../ui/primitives.jsx';
import { Tip } from './tooltip.jsx';

const AUDIENCES = [
  { id: 'android', label: 'Android friend' },
  { id: 'ios', label: 'iPhone friend' },
  { id: 'web', label: 'Web / laptop' },
  { id: 'all', label: 'Everyone' },
];

const STEPS = {
  android: ['Open the link in Chrome', 'Tap the \u22ee menu (top right)', 'Tap "Add to Home screen" \u2192 confirm', 'It now opens as a full app \u2014 fast, full-screen, works offline'],
  ios: ['Open the link in Safari (must be Safari)', 'Tap the Share icon at the bottom', 'Scroll \u2192 "Add to Home Screen" \u2192 Add', 'It now opens as a full app on your iPhone'],
  web: ['Open the link in any browser', 'Bookmark it \u2014 your progress syncs automatically', 'On a phone later? Add it to your home screen for the full app feel'],
};

function buildMessage(audience, shareUrl) {
  const head = [
    '\u2727\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2727',
    '   N O R C E T   P R E P',
    '\u2727\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2727',
    '',
    "I've been preparing for AIIMS NORCET with this \u2014 it's completely free, no ads: tests, revision notes, PYQs, dosage drills and more.",
    '',
    `\u27a4 ${shareUrl}`,
    '',
  ];
  const block = (title, steps) => [
    `\u2726 ${title}`,
    ...steps.map((st, i) => `  ${i + 1}. ${st}`),
    '',
  ];
  let body = [];
  if (audience === 'all') {
    body = [
      ...block('On Android', STEPS.android),
      ...block('On iPhone', STEPS.ios),
      ...block('On a laptop', STEPS.web),
    ];
  } else {
    const title = audience === 'web' ? 'Using it' : 'Set it up (takes 20 seconds)';
    body = block(title, STEPS[audience]);
  }
  return [...head, ...body, 'See you on the leaderboard \uD83C\uDF93'].join('\n');
}

export default function ShareAppCard() {
  const { theme: T } = useTheme();
  const [audience, setAudience] = useState('android');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => { setCanShare(typeof navigator !== 'undefined' && !!navigator.share); }, []);

  const baseUrl = (typeof window !== 'undefined' && window.location && window.location.origin) || 'https://norcetprep.app';
  const shareUrl = `${baseUrl}/?ref=share`;
  const displayUrl = baseUrl.replace(/^https?:\/\//, '');
  const message = buildMessage(audience, shareUrl);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {}
  };
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'NORCET Prep', text: message });
        setShared(true);
        setTimeout(() => setShared(false), 1800);
        return;
      }
    } catch (e) { /* cancelled / unsupported */ }
    copy();
  };

  return (
    <Card className="mb-3 overflow-hidden p-0">
      <div className="p-4" style={{ background: T.primary + '12', borderBottom: `1px solid ${T.primary}25` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary }}>
            <Share2 size={18} color="#FFF" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium" style={{ color: T.primary }}>Share NORCET Prep</div>
            <div className="text-xs mt-0.5" style={{ color: T.muted }}>
              The message carries the link AND the setup steps for your friend's device
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* premium link pill — display serif over a textured gradient */}
        <div className="relative flex items-center justify-center mb-4 px-4 py-3.5 rounded-2xl overflow-hidden"
             style={{
               background: `linear-gradient(140deg, ${T.primary}1A 0%, ${T.surface} 45%, ${T.primary}10 100%)`,
               border: `1.5px solid ${T.primary}45`,
               boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 3px 12px ${T.primary}1F`,
             }}>
          <div className="absolute inset-0 pointer-events-none opacity-50" aria-hidden="true"
               style={{ background: `repeating-linear-gradient(125deg, transparent 0 9px, ${T.primary}08 9px 10px)` }} />
          <span className="font-display text-base font-semibold tracking-wide relative" style={{ color: T.primary }}>
            {displayUrl}
          </span>
        </div>

        {/* who's it for? — message adapts to the friend's device */}
        <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 inline-flex items-center gap-1" style={{ color: T.muted }}>
          <Smartphone size={10} /> Sending to
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {AUDIENCES.map(a => {
            const on = audience === a.id;
            return (
              <button key={a.id} onClick={() => setAudience(a.id)}
                      className="no-tap-highlight py-2 rounded-xl text-[12px] font-semibold transition-colors active:scale-95"
                      style={{
                        background: on ? T.primary : T.surfaceWarm,
                        color: on ? '#FFF' : T.inkSoft,
                        border: `1px solid ${on ? T.primary : T.border}`,
                      }}>
                {a.label}
              </button>
            );
          })}
        </div>

        {/* live preview of the outgoing message */}
        <div className="rounded-xl px-3 py-2.5 mb-3 max-h-36 overflow-y-auto"
             style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
          <pre className="text-[10.5px] leading-relaxed whitespace-pre-wrap m-0"
               style={{ color: T.inkSoft, fontFamily: 'inherit' }}>{message}</pre>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {canShare && (
            <Tip text="Opens your phone's share sheet with the full message">
            <button onClick={share}
                    className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition"
                    style={{ background: shared ? T.success : T.primary, color: '#FFF' }}>
              <Share2 size={13} /> {shared ? '\u2713 Sent to share!' : 'Share message'}
            </button>
            </Tip>
          )}
          <Tip text="Copies the whole message — paste it into any chat">
          <button onClick={copy}
                  className={"no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition" + (canShare ? '' : ' col-span-2')}
                  style={{ background: copied ? T.success + '18' : T.primary + '14', color: copied ? T.success : T.primary, border: `1px solid ${copied ? T.success + '50' : T.primary + '40'}` }}>
            <Copy size={13} /> {copied ? '\u2713 Copied!' : 'Copy message'}
          </button>
          </Tip>
        </div>
      </div>
    </Card>
  );
}
