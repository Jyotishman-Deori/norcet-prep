// =====================================================================
// src/screens/about.jsx — the ABOUT page (route 'about', lazy-loaded).
//
// Duolingo-inspired single scroll: hero → mission → how-we-teach grid →
// live "by the numbers" strip → the honest solo-builder story → contact
// row → legal links. Every number is COMPUTED from live data (questions,
// topics, papers) — nothing is a marketing lie. Copy reuses the app's
// existing voice (welcome tour pitch, "Free · Ad-free · Always").
//
// Micro-interactions: staggered section entrances (about-in) and a
// count-up on the stats (skipped under prefers-reduced-motion — values
// render instantly). All classes registered in the reduced-motion block.
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import {
  HeartHandshake, Target, RotateCcw, Timer, Gamepad2, MessageCircle,
  Share2, Coffee, ChevronRight, ShieldCheck, Sparkles, Mail,
} from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, TopBar, requestFeedback, requestSupport } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import { prefersReducedMotion } from '../lib/juice.js';
import { SUPPORT_EMAIL } from '../lib/legal.js';
import { TOPICS } from '../data/seed.js';
import { PREVIOUS_YEAR_PAPERS } from '../norcet-pyq-data.js';

// Count-up that starts when the element scrolls into view. Reduced motion
// (or no IntersectionObserver) → the final value renders immediately.
function CountUp({ to, duration = 1100 }) {
  const reduced = prefersReducedMotion();
  const [val, setVal] = useState(reduced ? to : 0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    if (reduced || started.current) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVal(to); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some(e => e.isIntersecting) || started.current) return;
      started.current = true;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
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

function AboutScreen({ onBack, onNavigate }) {
  const { theme: T } = useTheme();
  const { allQuestions } = useData();
  const reduced = prefersReducedMotion();
  const stag = (i) => (!reduced ? { className: 'about-in', style: { animationDelay: `${Math.min(i, 6) * 90}ms` } } : {});

  const questionCount = (allQuestions && allQuestions.length) || 0;
  const topicCount = (TOPICS && TOPICS.length) || 0;
  const paperCount = (PREVIOUS_YEAR_PAPERS && PREVIOUS_YEAR_PAPERS.length) || 0;

  const APPROACH = [
    { Icon: RotateCcw, tone: T.sec ? T.sec.revision : T.primary, title: 'Spaced revision',
      body: 'Questions come back exactly when you’re about to forget them, the single biggest lever for long-term memory.' },
    { Icon: Target, tone: T.sec ? T.sec.stats : T.accent, title: 'Weak-area targeting',
      body: 'Every answer maps your syllabus. The app always knows your weakest unit, and sends you there next.' },
    { Icon: Timer, tone: T.sec ? T.sec.mock : T.error, title: 'Exam-day realism',
      body: 'Negative marking, sectional pacing and topper benchmarks, so the real CBT feels familiar, not frightening.' },
    { Icon: Gamepad2, tone: T.sec ? T.sec.learn : T.success, title: 'Consistency that sticks',
      body: 'Streaks, XP, clinical drills and a Knowledge Map that lights up as you master units. Showing up daily stops being a chore.' },
  ];

  const goLegal = (doc) => onNavigate && onNavigate({ screen: 'legal', doc });

  return (
    <div className="anim-fadeup">
      <TopBar title="About" onBack={onBack} feedback={{ screen: 'About' }} />
      <PageContainer size="content" className="pb-28 pt-2">

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <div {...stag(0)}>
          <div className="text-center pt-6 pb-8">
            <div className="mx-auto mb-4 w-16 h-16 rounded-3xl flex items-center justify-center font-display text-2xl font-bold"
                 style={{ background: T.primary, color: '#FFF', boxShadow: `0 10px 30px ${T.primary}45` }}>
              N
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight" style={{ color: T.ink }}>
              NurseHolic
            </h1>
            <p className="text-sm md:text-base mt-2 leading-relaxed max-w-md mx-auto" style={{ color: T.inkSoft }}>
              Serious NORCET preparation: free, ad-free, and built to feel like exam day.
            </p>
          </div>
        </div>

        {/* ── Mission ───────────────────────────────────────────────── */}
        <div {...stag(1)}>
          <Card className="p-5 md:p-6 mb-4" style={{ background: `linear-gradient(150deg, ${T.primary}0E, transparent 65%)` }}>
            <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: T.primary }}>Our mission</div>
            <div className="font-display text-lg md:text-xl font-semibold leading-snug mb-2" style={{ color: T.ink }}>
              Make deliberate practice free for every nursing aspirant.
            </div>
            <div className="text-[13.5px] leading-relaxed" style={{ color: T.inkSoft }}>
              Most aspirants drown in PDFs, endless notes, no idea where they actually stand or
              what to fix next. NurseHolic replaces that with deliberate practice: real exam-style
              questions, a clear map of your syllabus, and revision that arrives exactly when your
              memory needs it.
            </div>
          </Card>
        </div>

        {/* ── How we teach ──────────────────────────────────────────── */}
        <div {...stag(2)}>
          <div className="text-[11px] font-bold uppercase tracking-widest px-1 mt-6 mb-3" style={{ color: T.muted }}>
            How the app teaches
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {APPROACH.map((a, i) => (
            <div key={a.title} {...stag(3 + i * 0.5)}>
              <Card className="p-4 h-full">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                     style={{ background: (a.tone || T.primary) + '1A' }}>
                  <a.Icon size={19} style={{ color: a.tone || T.primary }} />
                </div>
                <div className="font-display text-[15px] font-semibold mb-1" style={{ color: T.ink }}>{a.title}</div>
                <div className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>{a.body}</div>
              </Card>
            </div>
          ))}
        </div>

        {/* ── By the numbers (live, computed — never invented) ─────── */}
        <div {...stag(4)}>
          <Card className="p-5 mb-6">
            <div className="grid grid-cols-3 text-center divide-x" style={{ borderColor: T.borderSoft }}>
              {[
                { n: questionCount, label: 'practice questions' },
                { n: topicCount, label: 'syllabus units' },
                { n: paperCount, label: 'real NORCET papers' },
              ].map((s) => (
                <div key={s.label} className="px-2">
                  <div className="font-display text-2xl md:text-3xl font-bold" style={{ color: T.primary }}>
                    <CountUp to={s.n} />
                  </div>
                  <div className="text-[11px] mt-1 leading-snug" style={{ color: T.muted }}>{s.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── The builder's story (owner-approved solo framing) ─────── */}
        <div {...stag(5)}>
          <Card className="p-5 md:p-6 mb-6" style={{ border: `1px solid ${T.accent}30` }}>
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                   style={{ background: T.accent + '1A' }}>
                <HeartHandshake size={20} style={{ color: T.accent }} />
              </div>
              <div className="min-w-0">
                <div className="font-display text-[16px] font-semibold mb-1.5" style={{ color: T.ink }}>
                  Built by one person, for all of you
                </div>
                <div className="text-[13.5px] leading-relaxed whitespace-pre-line" style={{ color: T.inkSoft }}>
                  NurseHolic isn’t a company, it’s one developer who watched nursing aspirants
                  pay for coaching they couldn’t afford and decided the tools, at least, should be
                  free. Every question, drill and feature here exists because someone preparing for
                  NORCET asked for it.
                  {'\n\n'}
                  The app is free and ad-free, and it stays that way. If it helps you, the kindest
                  things you can do are share it with a batchmate. Or buy me a chai.
                </div>
                <div className="flex flex-wrap gap-2 mt-3.5">
                  <button onClick={() => requestSupport()}
                          className="no-tap-highlight inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-bold active:scale-95 transition-transform"
                          style={{ background: T.accent, color: '#FFF' }}>
                    <Coffee size={14} /> Buy me a chai
                  </button>
                  <button onClick={() => onNavigate && onNavigate({ screen: 'share-app' })}
                          className="no-tap-highlight inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-bold active:scale-95 transition-transform"
                          style={{ background: T.accent + '1A', color: T.accent }}>
                    <Share2 size={14} /> Share the app
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Promises ──────────────────────────────────────────────── */}
        <div {...stag(6)}>
          <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
            {['Free forever', 'Ad-free', 'No data selling', 'Works offline'].map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold"
                    style={{ background: T.success + '14', color: T.success, border: `1px solid ${T.success}30` }}>
                <ShieldCheck size={12} /> {p}
              </span>
            ))}
          </div>
        </div>

        {/* ── Contact & more ───────────────────────────────────────── */}
        <div {...stag(7)}>
          <Card className="p-0 overflow-hidden mb-4">
            {[
              { Icon: MessageCircle, label: 'Send feedback', sub: 'Reach the developer directly. Every message is read', act: () => requestFeedback({ screen: 'About' }) },
              { Icon: Mail, label: 'Email us', sub: SUPPORT_EMAIL, act: () => { try { window.location.href = `mailto:${SUPPORT_EMAIL}`; } catch (e) {} } },
              { Icon: Sparkles, label: 'FAQ & help', sub: 'Answers to common questions, ask your own', act: () => onNavigate && onNavigate({ screen: 'faq' }) },
            ].map(({ Icon, label, sub, act }, i) => (
              <button key={label} onClick={act}
                      className="no-tap-highlight w-full flex items-center gap-3 px-4 py-4 text-left active:bg-black/5 transition"
                      style={i > 0 ? { borderTop: `1px solid ${T.borderSoft}` } : undefined}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '15' }}>
                  <Icon size={17} style={{ color: T.primary }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: T.ink }}>{label}</div>
                  <div className="text-xs mt-0.5" style={{ color: T.muted }}>{sub}</div>
                </div>
                <ChevronRight size={18} style={{ color: T.muted }} />
              </button>
            ))}
          </Card>

          {/* Legal links */}
          <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap text-[11.5px] pb-2">
            {[
              ['privacy', 'Privacy'], ['terms', 'Terms'],
              ['guidelines', 'Community Guidelines'], ['refunds', 'Cancellation & Refunds'],
            ].map(([doc, label]) => (
              <button key={doc} onClick={() => goLegal(doc)}
                      className="no-tap-highlight font-medium hover:underline" style={{ color: T.muted }}>
                {label}
              </button>
            ))}
          </div>
          <div className="text-center text-[11px]" style={{ color: T.muted }}>
            © 2026 NurseHolic · Made with care in Assam, India
          </div>
        </div>
      </PageContainer>
    </div>
  );
}

export default AboutScreen;
