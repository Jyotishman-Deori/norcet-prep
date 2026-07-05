// =====================================================================
// src/screens/waitlist.jsx — the LAUNCH WAITLIST (route 'waitlist', lazy).
//
// One screen, four views:
//   closed  — flags off: friendly "not open yet" card (route stays linkable)
//   join    — email + WhatsApp + state + college + the golden intent question
//             + referral code + DPDP consent + Turnstile
//   status  — position CountUp, priority-score breakdown, share/copy/WhatsApp,
//             state leaderboard, live countdown to the next batch drop; an
//             APPROVED row shows the claim card here (this screen IS the
//             delivery channel — there is no email infra)
//   claim   — arrived via a ?claim=<uuid> link: celebration + "Claim your
//             seat" straight into account creation
//
// Renders in two modes:
//   gateMode  — the pre-auth launch wall (App.jsx early-return): brand hero,
//               "Sign in" escape, inline legal modal (no app chrome behind it)
//   route     — normal in-app full-screen route with TopBar (guests browsing)
//
// Micro-interactions: staggered wl-in reveal, wl-bloom join celebration,
// wl-ring approved glow, wl-tick position bump, copy-✓ feedback, 1s drop
// countdown — all registered in the reduced-motion block (font-styles.js).
// =====================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Ticket, Users, Share2, Copy, Check, MessageCircle, GraduationCap,
  Sparkles, RefreshCw, LogIn, Mail, Phone, MapPin, School, AlertCircle,
  Clock, Trophy, PartyPopper, ChevronRight, X, ShieldCheck,
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import { prefersReducedMotion, haptic, HAPTIC } from '../lib/juice.js';
import TurnstileWidget, { isTurnstileEnabled } from '../ui/turnstile.jsx';
import { getConfig } from '../lib/game-config.js';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { getPendingReferral, clearPendingReferral } from '../lib/referral.js';
import {
  INDIAN_STATES, isValidState, stateLabel,
  normalizeWaitlistEmail, isValidEmail, isTempMail, normalizeWhatsapp,
  parseWaitlistRefCode, INTENT_MAX,
  nextBatchDrop, countdownParts, formatIstTime,
  buildWaitlistShareUrl, buildWaitlistShareMessage, buildWaUrl,
  STATUS_LABELS,
} from '../lib/waitlist.js';
import { waitlistJoin, waitlistStatus, waitlistStats } from '../lib/waitlist-api.js';
import { LegalContent } from './legal.jsx';
import { legalDoc } from '../lib/legal.js';

// ---- device identity (this device's joined row) ----------------------
async function loadIdentity() {
  try {
    const r = await safeStorage.get(KEYS.WAITLIST_IDENTITY, false);
    const j = (r && r.value) ? JSON.parse(r.value) : null;
    return (j && typeof j.email === 'string' && j.email) ? j : null;
  } catch (e) { return null; }
}
async function saveIdentity(rec) {
  try { await safeStorage.set(KEYS.WAITLIST_IDENTITY, JSON.stringify(rec), false); } catch (e) {}
}
async function clearIdentity() {
  try { await safeStorage.delete(KEYS.WAITLIST_IDENTITY, false); } catch (e) {}
}

// Count-up that starts when scrolled into view (copied from about.jsx — the
// deliberate-copy convention; screens stay self-contained). Reduced motion →
// final value renders immediately.
function CountUp({ to, duration = 1000 }) {
  const reduced = prefersReducedMotion();
  const [val, setVal] = useState(reduced ? to : 0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    if (reduced) { setVal(to); return; }
    if (started.current) { setVal(to); return; }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVal(to); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some(e => e.isIntersecting) || started.current) return;
      started.current = true;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(to * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration, reduced]);
  return <span ref={ref} className="tabular-nums">{val.toLocaleString()}</span>;
}

// Live countdown to `to` (epoch ms). 1s tick; under reduced motion it still
// updates (it's information, not decoration) but without the tick animation.
// When the target passes, it rolls to the next drop from the live schedule.
function DropCountdown({ to, compact = false }) {
  const { theme: T } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = (typeof to === 'number' && to > now)
    ? to
    : nextBatchDrop(now, getConfig().waitlist && getConfig().waitlist.schedule);
  const p = countdownParts(target - now);
  const seg = (n, unit) => (
    <span key={unit} className="inline-flex items-baseline gap-0.5">
      <span className="tabular-nums font-semibold" style={{ color: T.ink }}>{String(n).padStart(2, '0')}</span>
      <span className="text-[10px]" style={{ color: T.muted }}>{unit}</span>
    </span>
  );
  return (
    <span className={`inline-flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`} role="timer">
      {p.days > 0 && seg(p.days, 'd')}
      {seg(p.hours, 'h')}{seg(p.minutes, 'm')}{seg(p.seconds, 's')}
    </span>
  );
}

// `onLater` (optional, gateMode only) — escape hatch when the wall was raised
// by a ?claim= link alone (gate flag off): lets a guest with progress get back
// to the app; the token stays captured for a later signup.
function WaitlistScreen({ gateMode = false, claimToken = null, onBack, onSignIn, onClaim, onLater }) {
  const { theme: T } = useTheme();
  const reduced = prefersReducedMotion();
  const stag = (i) => (!reduced ? { className: 'wl-in', style: { animationDelay: `${Math.min(i, 7) * 80}ms` } } : {});

  const wl = getConfig().waitlist || {};
  const open = wl.collect === true || wl.gate === true;

  // view: 'loading' | 'closed' | 'join' | 'status' | 'claim'
  const [view, setView] = useState('loading');
  const [identity, setIdentity] = useState(null);   // {email, code, ts}
  const [status, setStatus] = useState(null);       // status-action response
  const [stats, setStats] = useState(null);         // stats-action response
  const [joinResult, setJoinResult] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // join form state
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [stateId, setStateId] = useState('');
  const [college, setCollege] = useState('');
  const [intentAnswer, setIntentAnswer] = useState('');
  const [refCode, setRefCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState(null);
  const [working, setWorking] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const turnstileRef = useRef(null);
  const [legalView, setLegalView] = useState(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const prevPosition = useRef(null);
  const [positionTicked, setPositionTicked] = useState(false);

  useEffect(() => { setCanShare(typeof navigator !== 'undefined' && !!navigator.share); }, []);

  const resetCaptcha = () => {
    try { turnstileRef.current && turnstileRef.current.reset(); } catch (e) {}
    setCaptchaToken(null);
  };

  const fetchStatus = async (id) => {
    const who = id || identity;
    if (!who) return null;
    const s = await waitlistStatus(who.email, who.code || undefined);
    if (s && s.ok) {
      // position tick micro-interaction when the number changes on refresh
      if (typeof s.position === 'number' && prevPosition.current != null && s.position !== prevPosition.current) {
        setPositionTicked(true);
        setTimeout(() => setPositionTicked(false), 450);
      }
      if (typeof s.position === 'number') prevPosition.current = s.position;
      setStatus(s);
    }
    return s;
  };

  // Boot: claim link wins; then stored identity → status; else join form.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (claimToken) { if (alive) setView('claim'); return; }
      if (!open) { if (alive) setView('closed'); return; }
      const id = await loadIdentity();
      if (!alive) return;
      if (id) {
        setIdentity(id);
        setView('status');
        fetchStatus(id);
      } else {
        // pre-fill the referral code captured from a shared ?ref= link
        try {
          const pending = await getPendingReferral();
          const code = pending && pending.ref ? parseWaitlistRefCode(pending.ref) : null;
          if (alive && code) setRefCode(code);
        } catch (e) {}
        if (alive) setView('join');
      }
      waitlistStats().then(s => { if (alive && s && s.ok) setStats(s); });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captchaRequired = isTurnstileEnabled();

  const handleJoin = async () => {
    setError(null);
    const normEmail = normalizeWaitlistEmail(email);
    if (!isValidEmail(normEmail)) { setError("That email doesn't look right — check for typos."); return; }
    if (isTempMail(normEmail)) { setError('Please use your real email — temporary inboxes are not eligible for an invite.'); return; }
    const phone = normalizeWhatsapp(whatsapp);
    if (!phone) { setError('Enter a valid 10-digit Indian WhatsApp number.'); return; }
    if (!isValidState(stateId)) { setError('Pick your state.'); return; }
    if (!consent) { setError('Please tick the consent box so we can contact you about your spot.'); return; }
    setWorking(true);
    const res = await waitlistJoin({
      email: normEmail,
      whatsapp: phone,
      state: stateId,
      college: college || undefined,
      intentAnswer: intentAnswer || undefined,
      ref: refCode || undefined,
      captchaToken: captchaToken || undefined,
    });
    setWorking(false);
    if (res && res.ok) {
      const rec = { email: normEmail, code: res.code, ts: Date.now() };
      setIdentity(rec);
      setJoinResult(res);
      await saveIdentity(rec);
      try { await clearPendingReferral(); } catch (e) {}
      haptic(HAPTIC.COMBO);
      prevPosition.current = typeof res.position === 'number' ? res.position : null;
      setView('status');
      fetchStatus(rec);
      waitlistStats().then(s => { if (s && s.ok) setStats(s); });
      return;
    }
    resetCaptcha();
    const reason = res && res.reason;
    if (reason === 'exists') {
      // Already registered — switch this device to their status view.
      const rec = { email: normEmail, code: null, ts: Date.now() };
      setIdentity(rec);
      await saveIdentity(rec);
      setView('status');
      fetchStatus(rec);
      return;
    }
    haptic(HAPTIC.INVALID);
    setError(
      reason === 'captcha' ? "Please complete the 'I'm human' check and try again." :
      reason === 'phone-exists' ? 'That WhatsApp number is already on the waitlist.' :
      reason === 'invalid-email' ? "That email doesn't look right — check for typos." :
      reason === 'temp-mail' ? 'Please use your real email — temporary inboxes are not eligible for an invite.' :
      reason === 'invalid-phone' ? 'Enter a valid 10-digit Indian WhatsApp number.' :
      reason === 'invalid-state' ? 'Pick your state.' :
      reason === 'rate-limited' ? 'Too many tries from your network — please wait a while and try again.' :
      reason === 'disabled' ? 'The waitlist is not accepting signups right now.' :
      'Could not reach the server. Check your connection and try again.'
    );
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await Promise.all([
      fetchStatus(),
      waitlistStats().then(s => { if (s && s.ok) setStats(s); }),
    ]);
    setRefreshing(false);
  };

  const myCode = (identity && identity.code) || null;
  const shareUrl = myCode ? buildWaitlistShareUrl(myCode) : null;
  const shareMessage = myCode ? buildWaitlistShareMessage({ code: myCode, url: shareUrl }) : '';

  const handleCopy = async () => {
    if (!shareMessage) return;
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      haptic(HAPTIC.PLACE);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {}
  };
  const handleNativeShare = async () => {
    try { await navigator.share({ title: 'NurseHolic — early access', text: shareMessage }); }
    catch (e) { /* user cancelled */ }
  };

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };
  const labelCls = 'block text-[11px] font-bold uppercase tracking-widest mb-1.5';

  // ---------------------------------------------------------------- views
  const brandHero = (
    <div className="text-center pt-8 pb-6" {...stag(0)}>
      <div className="mx-auto mb-4 w-16 h-16 rounded-3xl flex items-center justify-center"
           style={{ background: T.primary, boxShadow: `0 10px 30px ${T.primary}45` }}>
        <GraduationCap size={30} color="#FFF" />
      </div>
      <h1 className="font-display text-3xl font-semibold leading-tight" style={{ color: T.ink }}>NurseHolic</h1>
      <p className="text-sm mt-2 leading-relaxed max-w-sm mx-auto" style={{ color: T.inkSoft }}>
        {view === 'claim'
          ? 'Your founding-member seat is waiting.'
          : 'We open seats in small batches so every student gets a fast, stable app. Join the line — bring your batchmates to move up.'}
      </p>
    </div>
  );

  const renderClosed = () => (
    <div {...stag(1)}>
      <Card className="p-6 text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: T.primary + '1A' }}>
          <Ticket size={22} style={{ color: T.primary }} />
        </div>
        <div className="font-display text-lg font-semibold mb-1" style={{ color: T.ink }}>The waitlist isn't open yet</div>
        <div className="text-[13.5px] leading-relaxed" style={{ color: T.inkSoft }}>
          Early-access signups haven't started. Keep studying — everything in the app is open right now.
        </div>
      </Card>
    </div>
  );

  const renderJoin = () => (
    <>
      {/* social proof strip */}
      {stats && stats.ok && stats.totalWaiting > 0 && (
        <div {...stag(1)}>
          <div className="flex items-center justify-center gap-2 mb-4 text-[12.5px]" style={{ color: T.inkSoft }}>
            <Users size={14} style={{ color: T.primary }} />
            <span><b className="tabular-nums" style={{ color: T.ink }}>{stats.totalWaiting.toLocaleString()}</b> students in line · next batch in{' '}
              <DropCountdown to={stats.nextDropAt} compact /></span>
          </div>
        </div>
      )}

      <div {...stag(2)}>
        <Card className="p-5 mb-4">
          <div className="space-y-4">
            <div>
              <label className={labelCls} style={{ color: T.muted }} htmlFor="wl-email">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
                <input id="wl-email" type="email" inputMode="email" autoCapitalize="none" autoComplete="email"
                       className="w-full rounded-xl pl-10 pr-4 py-3 text-sm" style={inputStyle}
                       placeholder="you@example.com"
                       value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls} style={{ color: T.muted }} htmlFor="wl-phone">WhatsApp number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
                <input id="wl-phone" type="tel" inputMode="tel" autoComplete="tel"
                       className="w-full rounded-xl pl-10 pr-4 py-3 text-sm" style={inputStyle}
                       placeholder="10-digit mobile number"
                       value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
              </div>
              <div className="text-[11.5px] mt-1" style={{ color: T.muted }}>
                Your invite arrives on WhatsApp — we never share your number.
              </div>
            </div>
            <div>
              <label className={labelCls} style={{ color: T.muted }} htmlFor="wl-state">State</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
                <select id="wl-state" value={stateId} onChange={e => setStateId(e.target.value)}
                        className="w-full rounded-xl pl-10 pr-4 py-3 text-sm appearance-none"
                        style={{ ...inputStyle, color: stateId ? T.ink : T.muted }}>
                  <option value="" disabled>Pick your state</option>
                  {INDIAN_STATES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls} style={{ color: T.muted }} htmlFor="wl-college">College <span className="normal-case font-medium">(optional)</span></label>
              <div className="relative">
                <School size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
                <input id="wl-college" type="text" maxLength={120}
                       className="w-full rounded-xl pl-10 pr-4 py-3 text-sm" style={inputStyle}
                       placeholder="e.g. RCON Guwahati"
                       value={college} onChange={e => setCollege(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls} style={{ color: T.muted }} htmlFor="wl-intent">How are you preparing for NORCET right now?</label>
              <textarea id="wl-intent" rows={3} maxLength={INTENT_MAX}
                        className="w-full rounded-xl px-4 py-3 text-sm resize-none" style={inputStyle}
                        placeholder="Books, PDFs, coaching, another app… the real picture helps us seat serious aspirants first."
                        value={intentAnswer} onChange={e => setIntentAnswer(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={{ color: T.muted }} htmlFor="wl-ref">Referral code <span className="normal-case font-medium">(optional)</span></label>
              <div className="relative">
                <Ticket size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
                <input id="wl-ref" type="text" autoCapitalize="characters" maxLength={12}
                       className="w-full rounded-xl pl-10 pr-4 py-3 text-sm font-mono tracking-wider" style={inputStyle}
                       placeholder="NURSE-XXXXX"
                       value={refCode} onChange={e => setRefCode(e.target.value.toUpperCase())} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div {...stag(3)}>
        {/* DPDP consent — deliberately UNCHECKED by default */}
        <label className="flex items-start gap-3 px-1 mb-4 cursor-pointer select-none">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                 className="mt-0.5 w-4 h-4 rounded" style={{ accentColor: T.primary }} />
          <span className="text-[12.5px] leading-relaxed" style={{ color: T.inkSoft }}>
            I agree to the{' '}
            <button type="button" className="underline font-medium" style={{ color: T.primary }}
                    onClick={(e) => { e.preventDefault(); setLegalView('privacy'); }}>
              Privacy Policy
            </button>{' '}
            and consent to receiving waitlist updates and my invite on Email/WhatsApp.
          </span>
        </label>

        {captchaRequired && (
          <div className="flex justify-center mb-4">
            <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} action="waitlist" />
          </div>
        )}

        {error && (
          <Card className="p-3 mb-4 flex items-start gap-2.5"
                style={{ background: T.errorSoft || (T.error + '14'), border: `1px solid ${T.error}40` }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: T.error }} />
            <div className="text-[13px] leading-snug" style={{ color: T.ink }} role="alert">{error}</div>
          </Card>
        )}

        <Button variant="primary" size="lg" className="w-full"
                disabled={working || (captchaRequired && !captchaToken)}
                onClick={handleJoin}
                icon={working ? <RefreshCw size={18} className="animate-spin" /> : <Ticket size={18} />}>
          {working ? 'Reserving your spot…' : 'Join the waitlist'}
        </Button>
        <div className="text-center text-[11.5px] mt-3" style={{ color: T.muted }}>
          Free forever core · no spam, ever · one signup per student
        </div>
      </div>
    </>
  );

  const approved = status && status.ok && status.status === 'approved' && status.claimToken;
  const effectiveStatus = status && status.ok ? status.status : null;

  const renderStatus = () => (
    <>
      {/* hero: position or state banner */}
      <div {...stag(1)}>
        <Card className={`p-5 mb-4 text-center ${joinResult && !reduced ? 'wl-bloom' : ''}`}
              style={{ background: `linear-gradient(150deg, ${T.primary}12, transparent 70%)` }}>
          {effectiveStatus === 'waiting' || effectiveStatus == null ? (
            <>
              <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: T.primary }}>
                {joinResult ? "You're in line 🎉" : 'Your spot'}
              </div>
              <div className={`font-display text-4xl font-bold ${positionTicked ? 'wl-tick' : ''}`} style={{ color: T.ink }}>
                #{typeof (status && status.position) === 'number'
                    ? <CountUp to={status.position} />
                    : (joinResult && typeof joinResult.position === 'number' ? <CountUp to={joinResult.position} /> : '—')}
              </div>
              <div className="text-[12.5px] mt-1" style={{ color: T.inkSoft }}>
                of {((status && status.totalWaiting) || (joinResult && joinResult.totalWaiting) || 0).toLocaleString()} students waiting
              </div>
              <div className="flex items-center justify-center gap-2 mt-3 text-[12.5px]" style={{ color: T.inkSoft }}>
                <Clock size={14} style={{ color: T.primary }} />
                <span>Next batch drops in <DropCountdown to={status ? status.nextDropAt : (joinResult && joinResult.nextDropAt)} compact /></span>
              </div>
            </>
          ) : effectiveStatus === 'pending_verification' ? (
            <>
              <div className="mx-auto mb-2 w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: T.accent + '1A' }}>
                <ShieldCheck size={20} style={{ color: T.accent }} />
              </div>
              <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>Your group is being fast-tracked</div>
              <div className="text-[13px] leading-relaxed mt-1" style={{ color: T.inkSoft }}>
                Your referral group hit 3 signups — it's in the review queue for the next batch.
              </div>
            </>
          ) : effectiveStatus === 'onboarded' ? (
            <>
              <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>You're already in ✅</div>
              <div className="text-[13px] mt-1" style={{ color: T.inkSoft }}>This spot was claimed. Sign in to your account to study.</div>
              {onSignIn && (
                <Button variant="primary" size="md" className="mt-3" icon={<LogIn size={16} />} onClick={onSignIn}>Sign in</Button>
              )}
            </>
          ) : effectiveStatus === 'expired' ? (
            <>
              <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>Your seat expired</div>
              <div className="text-[13px] leading-relaxed mt-1" style={{ color: T.inkSoft }}>
                The 48-hour claim window passed, so the seat went to the next student. You're back in line — share your code to move up for the next drop.
              </div>
            </>
          ) : effectiveStatus === 'rejected' ? (
            <>
              <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>{STATUS_LABELS.rejected}</div>
              <div className="text-[13px] mt-1" style={{ color: T.inkSoft }}>This signup didn't pass review. If that seems wrong, reach out on our socials.</div>
            </>
          ) : (
            <div className="py-2 flex justify-center"><RefreshCw size={18} className="animate-spin" style={{ color: T.muted }} /></div>
          )}
        </Card>
      </div>

      {/* APPROVED → the claim card (this screen is the delivery channel) */}
      {approved && (
        <div {...stag(2)}>
          <Card className={`p-5 mb-4 text-center ${!reduced ? 'wl-bloom wl-ring' : ''}`}
                style={{ background: T.success + '14', border: `1px solid ${T.success}50`, '--wl-ring': `${T.success}55` }}>
            <div className="mx-auto mb-2 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: T.success + '22' }}>
              <PartyPopper size={22} style={{ color: T.success }} />
            </div>
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>Your seat is unlocked! 🎉</div>
            <div className="text-[13px] leading-relaxed mt-1 mb-3" style={{ color: T.inkSoft }}>
              Create your account now — your seat is held until{' '}
              <b style={{ color: T.ink }}>{formatIstTime(status.claimExpiresAt) || 'the 48-hour window closes'}</b>, then it goes to the next student.
            </div>
            <Button variant="primary" size="lg" className="w-full" icon={<Sparkles size={18} />}
                    onClick={() => onClaim && onClaim(status.claimToken)}>
              Claim your seat
            </Button>
          </Card>
        </div>
      )}

      {/* priority score breakdown */}
      {status && status.ok && status.score && (effectiveStatus === 'waiting' || effectiveStatus === 'pending_verification') && (
        <div {...stag(3)}>
          <Card className="p-4 mb-4">
            <div className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: T.muted }}>Your queue priority</div>
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2" style={{ color: T.inkSoft }}>
                  <Users size={14} style={{ color: T.primary }} /> Classmates joined ({status.referrals || 0} × 100)
                </span>
                <b className="tabular-nums" style={{ color: T.ink }}>+{(status.score.referralPts || 0).toLocaleString()}</b>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2" style={{ color: T.inkSoft }}>
                  <Clock size={14} style={{ color: T.accent }} /> Patience (days × 10)
                </span>
                <b className="tabular-nums" style={{ color: T.ink }}>+{(status.score.waitPts || 0).toLocaleString()}</b>
              </div>
              <div className="h-px my-1" style={{ background: T.borderSoft || T.border }} />
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: T.ink }}>Priority score</span>
                <b className="tabular-nums font-display text-base" style={{ color: T.primary }}>{(status.score.total || 0).toLocaleString()}</b>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* share block — the growth engine */}
      {myCode && effectiveStatus !== 'onboarded' && effectiveStatus !== 'rejected' && (
        <div {...stag(4)}>
          <Card className="p-4 mb-4">
            <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: T.muted }}>Skip the line with your batch</div>
            <div className="text-[13px] leading-relaxed mb-3" style={{ color: T.inkSoft }}>
              Every classmate who joins with your code = <b style={{ color: T.ink }}>+100 points</b>. When 3 join, your whole group is fast-tracked for the next batch.
            </div>
            <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-3"
                 style={{ background: T.surfaceWarm, border: `1px dashed ${T.border}` }}>
              <span className="font-mono font-bold tracking-widest text-base" style={{ color: T.primary }}>{myCode}</span>
              <button type="button" onClick={handleCopy} aria-label="Copy invite message"
                      className="no-tap-highlight inline-flex items-center gap-1.5 text-[12.5px] font-medium px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform"
                      style={{ color: copied ? T.success : T.primary, background: (copied ? T.success : T.primary) + '14' }}>
                {copied ? <Check size={14} className={reduced ? '' : 'wl-tick'} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <a href={buildWaUrl(null, shareMessage)} target="_blank" rel="noopener noreferrer"
                 className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
                 style={{ background: '#25D366', color: '#FFF' }}>
                <MessageCircle size={17} /> Share to your class WhatsApp group
              </a>
              {canShare && (
                <Button variant="soft" size="md" className="w-full" icon={<Share2 size={16} />} onClick={handleNativeShare}>
                  Share another way
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* state-vs-state board */}
      {stats && stats.ok && Array.isArray(stats.byState) && stats.byState.length > 0 && (
        <div {...stag(5)}>
          <Card className="p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={14} style={{ color: T.accent }} />
              <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.muted }}>States in line</div>
            </div>
            <div className="space-y-1.5">
              {stats.byState.map((row, i) => (
                <div key={row.state} className="flex items-center justify-between text-[13px] rounded-lg px-2.5 py-1.5"
                     style={identity && status && status.ok && row.state === status.state ? { background: T.primary + '10' } : undefined}>
                  <span style={{ color: T.inkSoft }}>
                    <span className="inline-block w-5 tabular-nums font-semibold" style={{ color: i < 3 ? T.accent : T.muted }}>{i + 1}</span>
                    {stateLabel(row.state)}
                  </span>
                  <b className="tabular-nums" style={{ color: T.ink }}>{Number(row.count || 0).toLocaleString()}</b>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div {...stag(6)}>
        <div className="flex items-center justify-center gap-4 pb-2">
          <button type="button" onClick={handleRefresh}
                  className="no-tap-highlight inline-flex items-center gap-1.5 text-[12.5px] font-medium py-2"
                  style={{ color: T.primary }}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh status
          </button>
          <span style={{ color: T.border }}>·</span>
          <button type="button"
                  onClick={async () => { await clearIdentity(); setIdentity(null); setStatus(null); setJoinResult(null); prevPosition.current = null; setView('join'); }}
                  className="no-tap-highlight text-[12.5px] font-medium py-2" style={{ color: T.muted }}>
            Not you?
          </button>
        </div>
      </div>
    </>
  );

  const renderClaim = () => (
    <div {...stag(1)}>
      <Card className={`p-6 text-center ${!reduced ? 'wl-bloom wl-ring' : ''}`}
            style={{ background: T.success + '12', border: `1px solid ${T.success}50`, '--wl-ring': `${T.success}55` }}>
        <div className="mx-auto mb-3 w-14 h-14 rounded-3xl flex items-center justify-center" style={{ background: T.success + '22' }}>
          <PartyPopper size={26} style={{ color: T.success }} />
        </div>
        <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>You're invited! 🎉</div>
        <div className="text-[13.5px] leading-relaxed mb-4 max-w-sm mx-auto" style={{ color: T.inkSoft }}>
          This is a founding-member invite link. Create your account now — invite links are single-use and expire 48 hours after your seat opens.
        </div>
        <Button variant="primary" size="lg" className="w-full" icon={<Sparkles size={18} />}
                onClick={() => onClaim && onClaim(claimToken)}>
          Claim your seat
        </Button>
        {onSignIn && (
          <button type="button" onClick={onSignIn} className="no-tap-highlight mt-3 text-[12.5px] font-medium" style={{ color: T.muted }}>
            Already have an account? <span style={{ color: T.primary }}>Sign in</span>
          </button>
        )}
        {onLater && (
          <button type="button" onClick={onLater} className="no-tap-highlight block mx-auto mt-2 text-[12.5px] font-medium py-1" style={{ color: T.muted }}>
            Maybe later — keep exploring
          </button>
        )}
      </Card>
    </div>
  );

  const body = (
    <>
      {view === 'loading' && (
        <div className="py-16 flex justify-center"><RefreshCw size={20} className="animate-spin" style={{ color: T.muted }} /></div>
      )}
      {view === 'closed' && renderClosed()}
      {view === 'join' && renderJoin()}
      {view === 'status' && renderStatus()}
      {view === 'claim' && renderClaim()}
    </>
  );

  // Inline legal viewer (portaled) — same pattern as auth-screen.jsx: the gate
  // wall renders BEFORE the app tree, so the normal legal route isn't reachable.
  const legalModal = legalView && typeof document !== 'undefined' && createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.55)' }}
         onClick={() => setLegalView(null)}>
      <div className="w-full max-w-md max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
           style={{ background: T.surface, border: `1px solid ${T.border}` }}
           onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${T.borderSoft || T.border}` }}>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: T.primary }}>NurseHolic</div>
            <div className="font-display text-lg font-semibold leading-tight" style={{ color: T.ink }}>
              {(legalDoc(legalView) || {}).title || 'Legal'}
            </div>
          </div>
          <button type="button" onClick={() => setLegalView(null)} aria-label="Close"
                  className="no-tap-highlight p-1.5 rounded-lg" style={{ color: T.muted }}>
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-6 pt-4 overflow-y-auto">
          <LegalContent doc={legalView} />
        </div>
      </div>
    </div>,
    document.body
  );

  // ---------------------------------------------------------------- shells
  if (gateMode) {
    // Pre-auth launch wall: no app chrome behind it, so it carries its own
    // brand hero + a Sign-in escape for existing accounts.
    return (
      <div className="min-h-screen" style={{ background: T.bg, color: T.ink }}>
        <div className="max-w-md mx-auto px-4 pb-12">
          {onSignIn && view !== 'claim' && (
            <div className="flex justify-end pt-4" {...stag(0)}>
              <button type="button" onClick={onSignIn}
                      className="no-tap-highlight inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-2 rounded-full active:scale-95 transition-transform"
                      style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.ink }}>
                <LogIn size={14} style={{ color: T.primary }} /> Sign in
              </button>
            </div>
          )}
          {brandHero}
          {body}
        </div>
        {legalModal}
      </div>
    );
  }

  return (
    <div className="anim-fadeup">
      <TopBar title="Early access" onBack={onBack} feedback={{ screen: 'Waitlist' }} />
      <PageContainer size="content" className="pb-28 pt-2">
        <div className="max-w-md mx-auto">
          {view !== 'closed' && brandHero}
          {body}
        </div>
      </PageContainer>
      {legalModal}
    </div>
  );
}

export default WaitlistScreen;
