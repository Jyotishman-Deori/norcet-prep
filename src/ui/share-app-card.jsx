// =====================================================================
// src/ui/share-app-card.jsx  (#27 — reworked per #10 feedback; Phase-1 refs)
// The install guide travels WITH the link instead of sitting in the card (the
// sender already knows the app — the FRIEND needs the steps). The user picks
// who they're sending to and the outgoing message is composed for that device.
//
// PHASE 1 (referrals): every surface here now carries the user's PERSONAL
// referral link `?ref=<their id>&via=<surface>` (guests fall back to a
// channel-only link). Added, above the platform selector:
//   • a branded QR card (premium PNG, matching the score card) the user can
//     SAVE or SHARE as an image — for in-person sharing (study groups, library)
//   • a one-tap "Share on WhatsApp" button with a warm, personal message
// =====================================================================
import React, { useEffect, useState } from 'react';
import { Check, Copy, Share2, Smartphone, QrCode, Download, MessageCircle, Users } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { Card } from '../ui/primitives.jsx';
import { Tip } from './tooltip.jsx';
import { ComparisonToggle, BatchCreateCard, BatchList } from './comparison-cards.jsx';
import { encodeQR } from '../lib/qr.js';
import { referralCodeFor, buildReferralUrl, displayAppUrl, VIA } from '../lib/referral.js';
import { paintBrandedQrCard, shareOrSavePng } from '../lib/qr-canvas.js';
import { loadMyReferralStats } from '../lib/referral-stats.js';
import { countUsers } from '../lib/profiles.js';

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

// --- tiny inline QR preview (SVG), same approach as support-modal --------
function QrSvg({ value, px = 132, quiet = 3, fg = '#0B1220' }) {
  let qr = null;
  try { qr = encodeQR(value); } catch (e) { qr = null; }
  if (!qr) {
    return (
      <div style={{ width: px, height: px, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <QrCode size={px * 0.5} />
      </div>
    );
  }
  const dim = qr.size + quiet * 2;
  const rects = [];
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.dark[r * qr.size + c]) {
        rects.push(<rect key={r + '_' + c} x={c + quiet} y={r + quiet} width={1.02} height={1.02} fill={fg} />);
      }
    }
  }
  return (
    <svg width={px} height={px} viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges" role="img" aria-label="App QR code">
      <rect x={0} y={0} width={dim} height={dim} fill="#FFFFFF" />
      {rects}
    </svg>
  );
}

export default function ShareAppCard() {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const code = referralCodeFor(profile);          // null for guests

  const [audience, setAudience] = useState('android');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [imgStatus, setImgStatus] = useState('idle'); // idle|saving|sharing|done|error
  const [userCount, setUserCount] = useState(0);
  const [refStats, setRefStats] = useState(null);      // {total,confirmed,pending} | null

  useEffect(() => { setCanShare(typeof navigator !== 'undefined' && !!navigator.share); }, []);
  useEffect(() => { let on = true; countUsers().then(n => { if (on) setUserCount(n || 0); }); return () => { on = false; }; }, []);
  // Personal referral stats (Phase 2) — only for logged-in users; silently
  // absent for guests or until the referral-intel function is deployed.
  useEffect(() => {
    if (!code) { setRefStats(null); return; }
    let on = true;
    loadMyReferralStats().then(s => { if (on) setRefStats(s); }).catch(() => {});
    return () => { on = false; };
  }, [code]);

  const displayUrl = displayAppUrl();
  const messageUrl = buildReferralUrl(code, VIA.SHARE);
  const qrUrl = buildReferralUrl(code, VIA.QR);
  const waUrl = buildReferralUrl(code, VIA.WHATSAPP);
  const message = buildMessage(audience, messageUrl);

  // Social proof: non-numeric until the user base is meaningful (100+), then
  // the real live count. Never a fabricated number.
  const socialProof = userCount >= 100
    ? `Join ${userCount.toLocaleString()} nursing students already practising`
    : null;

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

  const makeCardBlob = () => paintBrandedQrCard({ url: qrUrl, displayUrl, socialProof, theme: T });

  const saveImage = async () => {
    if (imgStatus === 'saving' || imgStatus === 'sharing') return;
    setImgStatus('saving');
    try {
      const blob = await makeCardBlob();
      const res = await shareOrSavePng(blob, 'norcet-qr.png', {});  // download path
      setImgStatus(res === 'error' ? 'error' : 'done');
    } catch (e) { setImgStatus('error'); }
    setTimeout(() => setImgStatus('idle'), 3200);
  };
  const shareImage = async () => {
    if (imgStatus === 'saving' || imgStatus === 'sharing') return;
    setImgStatus('sharing');
    try {
      const blob = await makeCardBlob();
      const res = await shareOrSavePng(blob, 'norcet-qr.png', {
        title: 'NORCET Prep',
        text: `Free, no-ads AIIMS NORCET prep \u2014 scan or tap: ${qrUrl}`,
      });
      setImgStatus(res === 'error' ? 'error' : 'done');
    } catch (e) { setImgStatus('error'); }
    setTimeout(() => setImgStatus('idle'), 3200);
  };

  const openWhatsApp = () => {
    const text = `I've been using this for NORCET prep \u2014 it's completely free and has no ads: ${waUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { window.location.href = url; }
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
              {code
                ? 'Your personal link \u2014 every install is credited to you'
                : 'Share the app with a friend \u2014 link + setup steps included'}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* ── personal referral acknowledgement (Phase 2; logged-in, has referrals) ── */}
        {refStats && refStats.total > 0 && (
          <div className="rounded-2xl p-3.5 mb-4 flex items-center gap-3"
               style={{ background: T.success + '12', border: `1px solid ${T.success}2E` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.success + '1F', color: T.success }}>
              <Check size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium" style={{ color: T.ink }}>
                {refStats.total} {refStats.total === 1 ? 'friend' : 'friends'} joined using your link
              </div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                {refStats.confirmed} confirmed {'\u00B7'} {refStats.pending} pending
              </div>
            </div>
          </div>
        )}

        {/* ── QR card: in-person sharing (study groups, library, classroom) ── */}
        <div className="rounded-2xl p-4 mb-4 flex flex-col items-center text-center"
             style={{ background: `linear-gradient(140deg, ${T.primary}14 0%, ${T.surface} 55%, ${T.primary}0E 100%)`, border: `1.5px solid ${T.primary}33` }}>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-2 inline-flex items-center gap-1" style={{ color: T.muted }}>
            <QrCode size={11} /> Scan to install
          </div>
          <div className="rounded-xl p-2.5 mb-2" style={{ background: '#FFFFFF', boxShadow: `0 4px 14px ${T.primary}1A` }}>
            <QrSvg value={qrUrl} px={138} />
          </div>
          <div className="text-xs mb-3" style={{ color: T.inkSoft }}>
            Anyone can scan this to start — perfect for study groups &amp; the library table.
          </div>
          <div className="grid grid-cols-2 gap-2 w-full">
            <Tip text="Saves the QR card as an image to your device">
              <button onClick={saveImage} disabled={imgStatus === 'saving' || imgStatus === 'sharing'}
                      className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition w-full"
                      style={{ background: T.primary + '14', color: T.primary, border: `1px solid ${T.primary}40` }}>
                <Download size={13} /> {imgStatus === 'saving' ? 'Saving\u2026' : 'Save image'}
              </button>
            </Tip>
            <Tip text="Opens the share sheet with the QR card as an image">
              <button onClick={shareImage} disabled={imgStatus === 'saving' || imgStatus === 'sharing'}
                      className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition w-full"
                      style={{ background: T.primary, color: '#FFF' }}>
                <Share2 size={13} /> {imgStatus === 'sharing' ? 'Opening\u2026' : 'Share image'}
              </button>
            </Tip>
          </div>
          {imgStatus === 'done' && (
            <div className="text-[11px] mt-2" role="status" aria-live="polite" style={{ color: T.success }}>
              Image ready — share it on WhatsApp or save it to print.
            </div>
          )}
          {imgStatus === 'error' && (
            <div className="text-[11px] mt-2" role="status" aria-live="polite" style={{ color: T.error }}>
              Couldn’t create the image. Please try again.
            </div>
          )}
        </div>

        {/* ── one-tap WhatsApp (the most common real-world channel) ── */}
        <button onClick={openWhatsApp}
                className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold active:scale-95 transition mb-4"
                style={{ background: '#25D366', color: '#FFFFFF', boxShadow: '0 4px 14px rgba(37,211,102,0.30)' }}>
          <MessageCircle size={16} /> Share on WhatsApp
        </button>

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

        {code && (
          <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-2.5 inline-flex items-center gap-1" style={{ color: T.muted }}>
              <Users size={11} /> Compare with friends
            </div>
            <div className="space-y-3">
              <ComparisonToggle />
              <BatchList />
              <BatchCreateCard />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
