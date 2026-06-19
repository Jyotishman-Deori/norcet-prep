// =====================================================================
// src/screens/account-security-card.jsx  (Fix 6 — Account Security)
// A quiet card shown inside Settings → Profile for LOGGED-IN users only.
//  • Recovery question — set ONE TIME. The server refuses changes once set,
//    so afterwards we just show "Recovery question set ✓" (read-only).
//  • Recovery email — optional, add/update any time.
// Both require the user's CURRENT PASSWORD, verified by the same service-role
// auth-secure function (the anon key never touches the locked secrets).
// =====================================================================
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, Lock, Mail, ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from '../ui/primitives.jsx';
import { SECURITY_QUESTIONS } from '../lib/security-questions.js';
import { getRecoveryQuestion, setSecurityQuestion, updateRecoveryEmail } from '../lib/profiles.js';

// A tappable card header + grid-rows collapse body (matches the sidebar section
// folders). Defined at MODULE level (not inside the component) so its identity
// is stable across renders — otherwise its input children would remount and
// lose focus on every keystroke. The chevron rotates on open.
function Msg({ T, m }) {
  if (!m) return null;
  return <div className="text-[11px] mt-2 anim-fadeup" style={{ color: m.ok ? T.success : T.error }}>{m.text}</div>;
}

function CollapseCard({ T, icon: Icon, iconBg, iconColor, title, titleExtra, sub, badge, open, onToggle, children }) {
  return (
    <Card className="mb-3 p-0 overflow-hidden">
      <button onClick={onToggle} aria-expanded={open}
              className="no-tap-highlight w-full flex items-center gap-3 p-4 text-left active:bg-black/5 transition-colors">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          <Icon size={17} style={{ color: iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm" style={{ color: T.ink }}>{title}{titleExtra}</div>
          <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>{sub}</div>
        </div>
        {badge}
        <ChevronRight size={16} className="flex-shrink-0"
                      style={{ color: T.muted,
                               transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
                               transform: open ? 'rotate(90deg)' : 'none' }} />
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}

export default function AccountSecurityCard({ profile }) {
  const { theme: T } = useTheme();
  const displayName = profile && profile.displayName;

  const [loading, setLoading] = useState(true);
  const [existingQuestion, setExistingQuestion] = useState(null); // string if set

  // Security-question form
  const [sq, setSq] = useState(SECURITY_QUESTIONS[0]);
  const [sa, setSa] = useState('');
  const [sqPwd, setSqPwd] = useState('');
  const [sqBusy, setSqBusy] = useState(false);
  const [sqMsg, setSqMsg] = useState(null);

  // Email form
  const [email, setEmail] = useState('');
  const [emPwd, setEmPwd] = useState('');
  const [emBusy, setEmBusy] = useState(false);
  const [emMsg, setEmMsg] = useState(null);

  // Collapsible cards (collapsed by default — keeps the profile page tidy).
  const [qOpen, setQOpen] = useState(false);
  const [eOpen, setEOpen] = useState(false);

  // Soft email-format check (server enforces it too; this warns earlier).
  const emailLooksOff = !!email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await getRecoveryQuestion(displayName);
        if (on) setExistingQuestion(r && r.method === 'question' ? r.question : null);
      } catch (e) { /* couldn't reach server — leave form available */ }
      finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, [displayName]);

  const inputStyle = {
    background: T.surfaceWarm, color: T.ink,
    border: `1.5px solid ${T.border}`,
  };

  const submitSq = async () => {
    setSqMsg(null);
    if (!sa.trim()) { setSqMsg({ ok: false, text: 'Type an answer to your question.' }); return; }
    if (!sqPwd) { setSqMsg({ ok: false, text: 'Enter your current password.' }); return; }
    setSqBusy(true);
    try {
      await setSecurityQuestion(displayName, sqPwd, sq, sa);
      setExistingQuestion(sq);
      setSa(''); setSqPwd('');
      setSqMsg({ ok: true, text: 'Recovery question set ✓' });
    } catch (e) {
      setSqMsg({ ok: false, text: (e && e.message) || 'Could not save. Try again.' });
    } finally { setSqBusy(false); }
  };

  const submitEmail = async () => {
    setEmMsg(null);
    if (!emPwd) { setEmMsg({ ok: false, text: 'Enter your current password.' }); return; }
    setEmBusy(true);
    try {
      await updateRecoveryEmail(displayName, emPwd, email);
      setEmPwd('');
      setEmMsg({ ok: true, text: email.trim() ? 'Email saved ✓' : 'Email cleared ✓' });
    } catch (e) {
      setEmMsg({ ok: false, text: (e && e.message) || 'Could not save. Try again.' });
    } finally { setEmBusy(false); }
  };

  return (
    <>
      <div className="mt-7 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Account security</div>

      {/* Recovery question (collapsible) */}
      <CollapseCard
        T={T}
        icon={ShieldCheck} iconBg={T.primary + '15'} iconColor={T.primary}
        title="Recovery question" sub="Used to reset your password if you forget it"
        open={qOpen} onToggle={() => setQOpen(o => !o)}
        badge={!loading && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full mr-1 flex-shrink-0"
                style={existingQuestion
                  ? { background: T.successSoft, color: T.success }
                  : { background: T.surfaceWarm, color: T.muted }}>
            {existingQuestion ? 'Set ✓' : 'Not set'}
          </span>
        )}>
        {loading ? (
          <div className="text-[11px]" style={{ color: T.muted }}>Checking…</div>
        ) : existingQuestion ? (
          <div className="rounded-xl px-3 py-3 flex items-start gap-2" style={{ background: T.successSoft, border: `1px solid ${T.success}33` }}>
            <Check size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium" style={{ color: T.success }}>Recovery question set ✓</div>
              <div className="text-[11px] mt-0.5" style={{ color: T.inkSoft }}>{existingQuestion}</div>
              <div className="text-[10px] mt-1" style={{ color: T.muted }}>For your security this can't be changed once set.</div>
            </div>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <select value={sq} onChange={e => setSq(e.target.value)}
                      className="w-full appearance-none rounded-xl px-3 py-2.5 text-sm pr-9"
                      style={inputStyle}>
                {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
            </div>
            <input value={sa} onChange={e => setSa(e.target.value)} placeholder="Your answer"
                   autoComplete="off"
                   className="w-full rounded-xl px-3 py-2.5 text-sm mb-2" style={inputStyle} />
            <div className="relative mb-2">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
              <input value={sqPwd} onChange={e => setSqPwd(e.target.value)} type="password"
                     placeholder="Current password" autoComplete="current-password"
                     className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <button onClick={submitSq} disabled={sqBusy}
                    className="no-tap-highlight w-full py-2.5 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                    style={{ background: T.primary, color: '#FFF', opacity: sqBusy ? 0.7 : 1 }}>
              {sqBusy ? 'Saving…' : 'Set recovery question'}
            </button>
            <div className="text-[10px] mt-2" style={{ color: T.muted }}>
              You can only set this once. The answer is checked case-insensitively and ignores extra
              spaces — avoid emojis or unusual symbols you might not retype the same way later.
            </div>
          </>
        )}
        <Msg T={T} m={sqMsg} />
      </CollapseCard>

      {/* Recovery email (collapsible, optional) */}
      <CollapseCard
        T={T}
        icon={Mail} iconBg={T.accent + '15'} iconColor={T.accent}
        title="Recovery email" titleExtra={<span style={{ color: T.muted, fontWeight: 400 }}> · optional</span>}
        sub="Add or update the email linked to your account"
        open={eOpen} onToggle={() => setEOpen(o => !o)}>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email"
               placeholder="you@example.com" autoComplete="email" inputMode="email"
               className="w-full rounded-xl px-3 py-2.5 text-sm mb-2" style={inputStyle} />
        {emailLooksOff && (
          <div className="text-[11px] mb-2" style={{ color: T.error }}>
            This doesn't look like a valid email — double-check before saving.
          </div>
        )}
        <div className="relative mb-2">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
          <input value={emPwd} onChange={e => setEmPwd(e.target.value)} type="password"
                 placeholder="Current password" autoComplete="current-password"
                 className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm" style={inputStyle} />
        </div>
        <button onClick={submitEmail} disabled={emBusy || emailLooksOff}
                className="no-tap-highlight w-full py-2.5 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                style={{ background: T.accent, color: '#FFF', opacity: (emBusy || emailLooksOff) ? 0.7 : 1 }}>
          {emBusy ? 'Saving…' : 'Save email'}
        </button>
        <Msg T={T} m={emMsg} />
      </CollapseCard>
    </>
  );
}
