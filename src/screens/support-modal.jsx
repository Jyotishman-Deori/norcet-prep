// =====================================================================
// src/screens/support-modal.jsx — "buy me a chai" UPI support dialog,
// hosted at the app root (SupportHost) and opened via requestSupport()
// (A1 slice 37). Donate config + buildUpiLink + the inline-SVG QRCode
// renderer + a clipboard fallback all live here; the pure QR ENCODER is
// imported from lib/qr.js. SupportModal gains a useTheme() hook (was a
// bare-T reader). Render site (SupportHost) unchanged.
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { Heart, X, Check } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { registerSupportOpener } from '../ui/primitives.jsx';
import { Card } from '../ui/primitives.jsx';
import { encodeQR } from '../lib/qr.js';

// ---- Donate config (OWNER: set DONATE_UPI_ID to a real VPA before deploy) ----
const DONATE_UPI_ID = 'your-vpa@bank';          // <-- OWNER: set real UPI ID
const DONATE_PAYEE_NAME = 'NORCET Prep';
const DONATE_RAZORPAY_URL = '';                  // optional; '' hides the secondary option

const DONATE_AMOUNTS = [
  { amt: 20, emoji: '\u2615', label: 'Chai' },     // ☕ ₹20
  { amt: 50, emoji: '\uD83C\uDF55', label: 'Snack' }, // 🍕 ₹50
  { amt: 100, emoji: '\uD83C\uDF89', label: 'Treat' }, // 🎉 ₹100
];

function buildUpiLink(amount) {
  const p = [
    'pa=' + encodeURIComponent(DONATE_UPI_ID),
    'pn=' + encodeURIComponent(DONATE_PAYEE_NAME),
    'cu=INR',
  ];
  if (amount) p.push('am=' + encodeURIComponent(String(amount)));
  return 'upi://pay?' + p.join('&');
}

// ---- Inline-SVG QR renderer (encoder lives in lib/qr.js) ----
function QRCode({ value, px = 200 }) {
  const qr = useMemo(() => {
    try { return encodeQR(value); } catch (e) { return null; }
  }, [value]);
  if (!qr) return null;
  const quiet = 4;
  const total = qr.size + quiet * 2;
  const rects = [];
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.dark[r * qr.size + c]) rects.push(<rect key={r + '_' + c} x={c + quiet} y={r + quiet} width={1.02} height={1.02} fill="#000" />);
    }
  }
  return (
    <svg width={px} height={px} viewBox={'0 0 ' + total + ' ' + total}
         shapeRendering="crispEdges" role="img" aria-label="UPI payment QR code"
         style={{ background: '#FFF', borderRadius: 10, display: 'block' }}>
      <rect x={0} y={0} width={total} height={total} fill="#FFF" />
      {rects}
    </svg>
  );
}

// Copy-to-clipboard with a graceful fallback (no helper exists in-app).
async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}


function SupportHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => registerSupportOpener(() => setOpen(true)), []);
  if (!open) return null;
  return <SupportModal onClose={() => setOpen(false)} />;
}

function SupportModal({ onClose }) {
  const { theme: T } = useTheme();
  const [amount, setAmount] = useState(null); // null = let the user choose in their UPI app
  const [thanked, setThanked] = useState(false);
  const [copied, setCopied] = useState(false);
  const dialogRef = useFocusTrap(onClose);

  const upiLink = useMemo(() => buildUpiLink(amount), [amount]);
  const idIsPlaceholder = DONATE_UPI_ID === 'your-vpa@bank' || !DONATE_UPI_ID;

  const onPayUpi = () => {
    // Opens the UPI app on mobile; on desktop most browsers no-op (the QR +
    // copyable ID below cover that case). Either way we show the warm
    // thank-you — it's a thank-you for the intent, not a payment receipt.
    try { window.location.href = upiLink; } catch (e) {}
    setThanked(true);
  };

  const onCopyId = async () => {
    const ok = await copyTextToClipboard(DONATE_UPI_ID);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <Card className="w-full max-w-sm anim-scalein max-h-[88vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
        <div className="p-5" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Support the app">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: T.primary + '15' }}>
                <Heart size={17} style={{ color: T.primary }} />
              </span>
              <div className="font-display text-lg font-semibold truncate" style={{ color: T.ink }}>
                Keep NORCET Prep free {'\u2615'}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close"
                    className="no-tap-highlight p-1.5 -m-1.5 rounded-lg active:bg-black/5 flex-shrink-0">
              <X size={18} style={{ color: T.muted }} />
            </button>
          </div>

          {!thanked ? (
            <>
              <div className="text-sm leading-relaxed mt-1 mb-4" style={{ color: T.inkSoft }}>
                This app is free and ad-free, and it stays that way. If it's helped your prep,
                you can buy me a chai to help cover the server bills. Totally optional {'\u2014'} no pressure,
                and nothing changes if you don't. {'\uD83D\uDC99'}
              </div>

              {/* Suggested amounts — visual only; the UPI app lets you edit. */}
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: T.muted }}>
                Pick a chai (optional)
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {DONATE_AMOUNTS.map(a => {
                  const sel = amount === a.amt;
                  return (
                    <button key={a.amt} onClick={() => setAmount(sel ? null : a.amt)}
                            className="no-tap-highlight pressable rounded-xl py-2.5 text-center transition"
                            aria-pressed={sel}
                            style={{
                              background: sel ? T.primary + '1A' : T.surfaceWarm,
                              border: `1px solid ${sel ? T.primary : T.border}`,
                            }}>
                      <div className="text-lg leading-none mb-0.5">{a.emoji}</div>
                      <div className="text-sm font-semibold" style={{ color: sel ? T.primary : T.ink }}>{'\u20B9'}{a.amt}</div>
                      <div className="text-[10px]" style={{ color: T.muted }}>{a.label}</div>
                    </button>
                  );
                })}
              </div>

              {idIsPlaceholder ? (
                <div className="rounded-xl p-3 mb-3 text-xs leading-relaxed"
                     style={{ background: T.accent + '14', border: `1px solid ${T.accent}40`, color: T.inkSoft }}>
                  Payments aren't set up yet. (Owner: set <span className="font-mono">DONATE_UPI_ID</span> in the code.)
                </div>
              ) : (
                <>
                  {/* Primary action — open the UPI app (mobile). */}
                  <button onClick={onPayUpi}
                          className="no-tap-highlight w-full py-3 rounded-xl text-sm font-semibold active:scale-[0.99] transition mb-3"
                          style={{ background: T.primary, color: '#FFF' }}>
                    Pay via UPI {amount ? '\u00b7 \u20B9' + amount : ''}
                  </button>

                  {/* Universal fallback / desktop path: scan the QR, or copy the ID. */}
                  <div className="rounded-xl p-3 mb-1 flex flex-col items-center"
                       style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
                    <div className="text-[11px] mb-2 text-center" style={{ color: T.muted }}>
                      On a computer? Scan with any UPI app:
                    </div>
                    <QRCode value={upiLink} px={172} />
                    <button onClick={onCopyId}
                            className="no-tap-highlight pressable mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }}>
                      {copied ? <Check size={13} style={{ color: T.success }} /> : null}
                      {copied ? 'Copied!' : 'Copy UPI ID: ' + DONATE_UPI_ID}
                    </button>
                  </div>

                  {DONATE_RAZORPAY_URL ? (
                    <a href={DONATE_RAZORPAY_URL} target="_blank" rel="noopener noreferrer"
                       className="no-tap-highlight block text-center text-xs mt-3 py-1.5 font-medium"
                       style={{ color: T.muted }}>
                      Other ways to support {'\u2192'}
                    </a>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <div className="py-6 text-center">
              <div className="text-4xl mb-3">{'\uD83D\uDC99'}</div>
              <div className="font-display text-lg font-semibold mb-1" style={{ color: T.ink }}>Thank you! {'\uD83D\uDC99'}</div>
              <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
                Your support means a lot {'\u2014'} it genuinely helps keep NORCET Prep free for everyone.
              </div>
              <button onClick={onClose}
                      className="no-tap-highlight w-full mt-5 py-3 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                      style={{ background: T.primary, color: '#FFF' }}>
                Close
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export { SupportHost, SupportModal };
export default SupportHost;
