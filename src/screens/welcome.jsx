// =====================================================================
// src/screens/welcome.jsx — first-run welcome / quick-nav
// F-C UPGRADE: tapping a row no longer launches the section directly. It
// first opens a help popup (What it is / How to use it / Why it's here,
// reusing the section's help.json copy) with a prominent "Got it" that THEN
// launches the section, and a subtle back that returns to the tour. Each row
// the user has opened gets a visited checkmark, persisted per profile, so the
// Settings → Welcome Tour replay shows progress.
//
// REFRESH (post-#11/#13): rows now mirror the current IA — Drill Tests
// replaces the four separate test rows, Knowledge Map (the app's USP) gets a
// constellation-styled hero row, and Study Methods + My Doubts joined the
// list. Subtle micro-interactions: staggered row entrance, floating header
// icon, visited-check pop, an "explored x/y" progress bar, and a spring-up
// help sheet.
//
// Contract with App is UNCHANGED: onLaunch(nav) still launches a section (App
// arms cameFromWelcome so Back returns here) and onDismiss() ends the tour.
// Guest re-show / onboarding-seen behaviour is owned by App and untouched.
// =====================================================================
import React, { useState, useEffect, useRef } from 'react';
import { Brain, Check, ChevronRight, FileText, Flag, GraduationCap, Layers, ListChecks, Dumbbell, Network, Lightbulb, Sparkles, ArrowLeft, ArrowRight, X, Hand, MousePointerClick, Heart, Rocket, Download, Users, Clock, Headphones, Target, PlusCircle } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import { LIGHT_THEME, DARK_THEME } from '../lib/themes.js';
import { useContent } from '../lib/content.js';
import { safeStorage } from '../lib/safe-storage.js';
import ConfirmDialog from '../ui/confirm-dialog.jsx';
import { KEYS } from '../lib/keys.js';
import {
  GENDER_OPTIONS, QUALIFICATION_OPTIONS, EMPLOYMENT_OPTIONS,
  QUALIFICATION_UNLOCK, EMPLOYMENT_UNLOCK, normalizeDemographics,
} from '../lib/demographics.js';

// NEW-01 — premium, quiet "Skip tour" pill with a micro-interaction (the arrow
// nudges on press). Shown on every onboarding page EXCEPT the final one.
function SkipButton({ T, onClick, label = 'Skip tour' }) {
  return (
    <button onClick={onClick}
            className="no-tap-highlight group inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full active:scale-95 transition"
            style={{ color: T.muted, background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
      {label}
      <ArrowRight size={13} className="transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:translate-x-0.5 group-active:translate-x-1" />
    </button>
  );
}

function WelcomeScreen({ displayName, firstRun = false, demographics, onSaveDemographics, onDismiss, onLaunch }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { profile } = useProfile();
  const { data: help } = useContent('help');
  const profileId = (profile && profile.id) || 'guest';
  const storeKey = `${KEYS.WELCOME_TOUR_VISITED}${profileId}`;
  const demo = normalizeDemographics(demographics);

  // NEW-01/02 — first-run onboarding adds App-Pitch, Library and the three
  // demographic screens before the "what's inside" tour. Replays from Settings
  // skip straight to the tour (no re-collecting data).
  const STEP_ORDER = firstRun
    ? ['pitch', 'library', 'gender', 'qualification', 'employment', 'tour', 'tips']
    : ['tour', 'tips'];

  // Each row is a launchable section. `helpKey` maps to its help.json entry so
  // the popup reuses the same accurate What/How/Why the Help button shows.
  // Mirrors the current IA: tests are consolidated under Drill Tests (#11) and
  // the Knowledge Map (#13, the USP) gets a constellation hero treatment.
  const items = [
    { icon: <Network size={18} />,   title: 'Knowledge Map',     desc: 'Your syllabus as a constellation — practise to light up every star.',      color: '#8A6D1F',                darkColor: '#FFD27A',               nav: { screen: 'knowledge-map' },  helpKey: 'Knowledge Map', hero: true },
    { icon: <Dumbbell size={18} />,  title: 'Drill Tests',       desc: 'All six test modes — quick warm-ups to full exam simulation, one place.',   color: LIGHT_THEME.sec.mock,     darkColor: DARK_THEME.sec.mock,     nav: { screen: 'drill-tests' },    helpKey: 'Drill tests' },
    { icon: <Brain size={18} />,     title: 'Learn topic wise',  desc: 'Bite-sized concept cards instead of passive video.',                        color: LIGHT_THEME.sec.learn,    darkColor: DARK_THEME.sec.learn,    nav: { screen: 'learn-topics' },   helpKey: 'Learn — topics' },
    { icon: <GraduationCap size={18} />, title: 'Study Methods', desc: 'Six science-backed ways to study — and how to use each one here.',          color: LIGHT_THEME.primary,      darkColor: DARK_THEME.primary,      nav: { screen: 'study-methods' },  helpKey: 'Study methods' },
    { icon: <FileText size={18} />,  title: 'Revision Sheet',    desc: 'Bookmarks digested into one printable page.',                               color: LIGHT_THEME.sec.revision, darkColor: DARK_THEME.sec.revision, nav: { screen: 'revision-sheet' }, helpKey: 'Revision sheet' },
    { icon: <Flag size={18} />,      title: 'My Doubts',         desc: 'Flag anything unclear while you learn; clear it all up in one place.',       color: '#B3413A',                darkColor: '#E0726B',               nav: { screen: 'doubts' },         helpKey: 'Doubts' },
    { icon: <Layers size={18} />,    title: 'Question Bank Library', desc: 'Browse shared banks and import questions.',                             color: LIGHT_THEME.sec.library,  darkColor: DARK_THEME.sec.library,  nav: { screen: 'library' },        helpKey: 'Library' }
  ];

  const [selected, setSelected] = useState(null); // item whose popup is open
  const [step, setStep] = useState(STEP_ORDER[0]); // first step of the active flow
  const [visited, setVisited] = useState(() => new Set());
  const nextStep = () => { const i = STEP_ORDER.indexOf(step); if (i >= 0 && i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]); };
  const prevStep = () => { const i = STEP_ORDER.indexOf(step); if (i > 0) setStep(STEP_ORDER[i - 1]); };
  // NEW-02 — the reassuring "we just unlocked X" copy shown after a choice that
  // has one (GNM / employment). Cleared whenever the step changes.
  const [pendingUnlock, setPendingUnlock] = useState(null);
  useEffect(() => { setPendingUnlock(null); }, [step]);
  // Issues round — the DEVICE back button mirrors the tour's own back:
  // App re-arms its history sentinel and dispatches 'norcet:welcome-back';
  // here it closes the open help popup first (one step back), and at the
  // tour root it opens a leave-confirmation instead of exiting abruptly.
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const onBack = () => {
      if (selectedRef.current) { setSelected(null); return; }   // close help popup first
      const i = STEP_ORDER.indexOf(stepRef.current);
      if (i > 0) setStep(STEP_ORDER[i - 1]);                    // step back through the flow
      else setLeaveConfirm(true);                               // at the first page → confirm leave
    };
    window.addEventListener('norcet:welcome-back', onBack);
    return () => window.removeEventListener('norcet:welcome-back', onBack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    safeStorage.get(storeKey, false).then(r => {
      if (!alive) return;
      try { const arr = r && r.value ? JSON.parse(r.value) : []; if (Array.isArray(arr)) setVisited(new Set(arr)); } catch (e) {}
    }).catch(() => {});
    return () => { alive = false; };
  }, [storeKey]);

  const openRow = (it) => {
    setSelected(it);
    setVisited(prev => {
      if (prev.has(it.helpKey)) return prev;
      const next = new Set(prev); next.add(it.helpKey);
      try { safeStorage.set(storeKey, JSON.stringify([...next]), false); } catch (e) {}
      return next;
    });
  };

  const launchSelected = () => { const it = selected; setSelected(null); if (it) handleLaunch(it.nav); };
  const handleLaunch = (nav) => { if (onLaunch) onLaunch(nav); else onDismiss(); };

  // Tour progress — visited rows out of the rows on screen (old persisted keys
  // from the previous tour layout simply don't count).
  const tourKeys = new Set(items.map(i => i.helpKey));
  const exploredCount = [...visited].filter(k => tourKeys.has(k)).length;
  const progressPct = Math.round((exploredCount / items.length) * 100);

  // ---- the per-row help popup (What / How / Why, reusing help.json) ----
  const c = selected ? (help && help[selected.helpKey]) : null;
  const sections = c ? [
    { label: 'What it is', icon: <Lightbulb size={13} />, text: c.what },
    { label: 'How to use it', icon: <ListChecks size={13} />, text: c.how },
    { label: 'Why it\u2019s here', icon: <Sparkles size={13} />, text: c.why },
  ].filter(s => s.text) : [];

  // Shared chrome for the onboarding pages: quiet Back (when not first) + the
  // premium Skip-tour pill (every page except the final one).
  const atFirst = STEP_ORDER.indexOf(step) === 0;
  const pageHead = (
    <div className="flex justify-between items-center mb-1">
      {atFirst
        ? <span />
        : <button onClick={prevStep}
                  className="no-tap-highlight inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full active:bg-black/5"
                  style={{ color: T.muted }}><ArrowLeft size={14} /> Back</button>}
      <SkipButton T={T} onClick={() => setLeaveConfirm(true)} />
    </div>
  );
  const heroIcon = (Icon, color) => (
    <div className="text-center mb-6 relative">
      <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 -top-6 w-48 h-48 rounded-full pointer-events-none"
           style={{ background: `radial-gradient(circle, ${color}26, transparent 65%)` }} />
      <div className="welcome-float relative inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
           style={{ background: `linear-gradient(140deg, ${color}, ${color}B3)`, boxShadow: `0 10px 26px ${color}50` }}>
        <Icon size={28} color="#FFF" />
      </div>
    </div>
  );

  // ---- NEW-01 page 1: App pitch ----
  if (step === 'pitch') {
    const points = [
      { icon: <Target size={18} />, color: T.error, title: 'Most aspirants drown in PDFs', body: 'Endless notes, no idea where they actually stand or what to fix next.' },
      { icon: <Brain size={18} />, color: T.primary, title: 'This app makes prep deliberate', body: 'Spaced revision, weak-area targeting, real exam-style timing and a clear map of your syllabus.' },
      { icon: <Sparkles size={18} />, color: T.accent, title: 'Built to feel like exam day', body: 'Negative marking, sectional pacing and topper benchmarks — so the real CBT feels familiar.' },
    ];
    return (
      <div className="anim-fadeup max-w-md mx-auto px-4 pb-12" style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}>
        {pageHead}
        {heroIcon(Rocket, T.primary)}
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>Welcome{displayName ? `, ${displayName}` : ''}</div>
          <h1 className="font-display text-3xl font-semibold mb-1.5" style={{ color: T.ink }}>Your NORCET edge</h1>
          <div className="text-sm" style={{ color: T.muted }}>Sixty seconds on why this beats another PDF.</div>
        </div>
        <div className="space-y-2.5 mb-6">
          {points.map((p, i) => (
            <div key={p.title} className="welcome-row" style={{ animationDelay: `${i * 70}ms` }}>
              <Card className="p-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}B3)`, boxShadow: `0 6px 16px ${p.color}45`, color: '#FFF' }}>
                    {p.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-semibold mb-1" style={{ color: T.ink }}>{p.title}</div>
                    <div className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>{p.body}</div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
        <div className="welcome-row" style={{ animationDelay: `${points.length * 70 + 60}ms` }}>
          <Button onClick={nextStep} size="lg" className="w-full" icon={<ChevronRight size={18} />}>Next</Button>
        </div>
      </div>
    );
  }

  // ---- NEW-01 page 2: Library & question-bank explainer ----
  if (step === 'library') {
    const rows = [
      { icon: <Layers size={18} />, color: T.sec.library, title: 'The Library holds question banks', body: 'Curated sets of questions grouped by topic and source — the heart of your practice pool.' },
      { icon: <Download size={18} />, color: T.primary, title: 'Download the sets you want', body: 'Add a bank and its questions join your tests, stats and revision — and work offline after.' },
      { icon: <PlusCircle size={18} />, color: T.accent, title: 'Or build your own', body: 'Create custom question sets (Add question / Library) to drill exactly what you need.' },
    ];
    return (
      <div className="anim-fadeup max-w-md mx-auto px-4 pb-12" style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}>
        {pageHead}
        {heroIcon(Layers, T.sec.library)}
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>How questions work</div>
          <h1 className="font-display text-3xl font-semibold mb-1.5" style={{ color: T.ink }}>Start with the Library</h1>
          <div className="text-sm" style={{ color: T.muted }}>Find it in the sidebar menu anytime.</div>
        </div>
        <div className="space-y-2.5 mb-6">
          {rows.map((r, i) => (
            <div key={r.title} className="welcome-row" style={{ animationDelay: `${i * 70}ms` }}>
              <Card className="p-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: `linear-gradient(135deg, ${r.color}, ${r.color}B3)`, boxShadow: `0 6px 16px ${r.color}45`, color: '#FFF' }}>
                    {r.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-semibold mb-1" style={{ color: T.ink }}>{r.title}</div>
                    <div className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>{r.body}</div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
        <div className="welcome-row" style={{ animationDelay: `${rows.length * 70 + 60}ms` }}>
          <Button onClick={nextStep} size="lg" className="w-full" icon={<ChevronRight size={18} />}>Next</Button>
        </div>
      </div>
    );
  }

  // ---- NEW-02 demographic screens (gender / qualification / employment) ----
  // All optional: tapping a choice saves + advances; "Skip this one" advances
  // without saving; "Skip tour" exits (fill it in later in Settings → Profile).
  if (step === 'gender' || step === 'qualification' || step === 'employment') {
    const cfg = {
      gender: { icon: Users, color: T.primary, kicker: 'A quick calibration',
        title: 'Where do you stand?',
        trust: 'AIIMS applies a strict 80:20 gender quota. We use this only to calibrate your simulated leaderboard rank in your pool — never to limit content.',
        field: 'gender', kind: 'gender', options: GENDER_OPTIONS },
      qualification: { icon: GraduationCap, color: T.accent, kicker: 'Your background',
        title: 'Your highest qualification?',
        trust: 'Lets us frame examples for your training — GNM nurses get bedside-to-theory drills.',
        field: 'qualification', kind: 'qualification', options: QUALIFICATION_OPTIONS },
      employment: { icon: Clock, color: T.sec.revision || T.primary, kicker: 'Your schedule',
        title: 'How does prep fit your day?',
        trust: 'We adapt your dashboard — a working nurse can’t sit a 3-hour mock on a Tuesday afternoon.',
        field: 'employment', kind: 'employment', options: EMPLOYMENT_OPTIONS },
    }[step];
    const Icon = cfg.icon;
    const current = demo[cfg.field];
    const pick = (id) => {
      if (onSaveDemographics) onSaveDemographics({ [cfg.field]: id });
      const unlock = cfg.kind === 'qualification' ? QUALIFICATION_UNLOCK[id]
                   : cfg.kind === 'employment' ? EMPLOYMENT_UNLOCK[id] : null;
      if (unlock) setPendingUnlock(unlock);
      else nextStep();
    };
    return (
      <div className="anim-fadeup max-w-md mx-auto px-4 pb-12" style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}>
        {pageHead}
        {heroIcon(Icon, cfg.color)}
        <div className="text-center mb-5">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>{cfg.kicker}</div>
          <h1 className="font-display text-2xl font-semibold mb-1.5" style={{ color: T.ink }}>{cfg.title}</h1>
          <div className="text-[13px] leading-relaxed px-2" style={{ color: T.muted }}>{cfg.trust}</div>
        </div>
        <div className="space-y-2.5 mb-4">
          {cfg.options.map((o, i) => {
            const active = current === o.id;
            return (
              <button key={o.id} onClick={() => pick(o.id)}
                      className="welcome-row no-tap-highlight w-full text-left active:scale-[0.98] transition-transform"
                      style={{ animationDelay: `${i * 60}ms` }}>
                <Card className="p-4" style={active
                  ? { background: cfg.color + '12', border: `1.5px solid ${cfg.color}` }
                  : undefined}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                         style={{ background: active ? cfg.color : cfg.color + '18', color: active ? '#FFF' : cfg.color }}>
                      {active ? <Check size={16} /> : <span className="text-sm font-bold">{o.label[0]}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[15px] font-semibold" style={{ color: T.ink }}>{o.label}</div>
                      {o.sub && <div className="text-[11px]" style={{ color: T.muted }}>{o.sub}</div>}
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>

        {pendingUnlock ? (
          <div className="anim-fadeup">
            <div className="rounded-2xl p-4 mb-3 flex items-start gap-3" style={{ background: cfg.color + '12', border: `1px solid ${cfg.color}33` }}>
              <Headphones size={18} className="flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />
              <div className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>{pendingUnlock}</div>
            </div>
            <Button onClick={() => { setPendingUnlock(null); nextStep(); }} size="lg" className="w-full" icon={<ChevronRight size={18} />}>Continue</Button>
          </div>
        ) : (
          <button onClick={nextStep}
                  className="no-tap-highlight w-full inline-flex items-center justify-center gap-1 text-[13px] font-medium py-2.5 rounded-xl active:bg-black/5"
                  style={{ color: T.muted }}>
            {current ? 'Continue' : 'Skip this one'} <ArrowRight size={14} />
          </button>
        )}
        <div className="text-[10.5px] text-center mt-2" style={{ color: T.muted }}>
          Optional &amp; private · change it anytime in Settings → Profile.
        </div>
      </div>
    );
  }

  // ---- Second onboarding page: the gestures + tap-and-hold first-timers miss ----
  if (step === 'tips') {
    const tips = [
      { icon: <MousePointerClick size={20} />, title: 'Press & hold any card',
        body: 'On the home screen, the menu or in settings, press and hold a card for a moment to peek a quick description of what it does — without opening it.',
        color: T.primary },
      { icon: <Hand size={20} style={{ transform: 'scaleX(-1)' }} />, title: 'Swipe to open the menu',
        body: 'On the home screen, swipe right from anywhere to slide the menu open, and swipe left to close it. Works the same on phone, tablet and iPhone.',
        color: T.accent },
      { icon: <Heart size={20} fill="#FFF" />, title: 'Heart your favourites',
        body: 'Tap the heart on any section — Stats, a drill mode, the leaderboard — to pin it. Your favourites then sit one tap away on the home screen.',
        color: '#E0245E' },
    ];
    return (
      <div className="anim-fadeup max-w-md mx-auto px-4 pb-12"
           style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}>
        <div className="flex justify-start mb-1">
          <button onClick={() => setStep('tour')}
                  className="no-tap-highlight inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full active:bg-black/5"
                  style={{ color: T.muted }}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>
        <div className="text-center mb-6 relative">
          <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 -top-6 w-48 h-48 rounded-full pointer-events-none"
               style={{ background: `radial-gradient(circle, ${T.primary}1F, transparent 65%)` }} />
          <div className="welcome-float relative inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
               style={{ background: `linear-gradient(140deg, ${T.primary}, ${T.primarySoft || T.primary})`, boxShadow: `0 10px 26px ${T.primary}50` }}>
            <Sparkles size={28} color="#FFF" />
          </div>
          <div className="text-xs uppercase tracking-widest mb-2 relative" style={{ color: T.muted }}>Before you start</div>
          <h1 className="font-display text-3xl font-semibold mb-1.5 relative" style={{ color: T.ink }}>Three quick tips</h1>
          <div className="text-sm relative" style={{ color: T.muted }}>Little things that make the app yours.</div>
        </div>
        <div className="space-y-2.5 mb-6">
          {tips.map((t, i) => (
            <div key={t.title} className="welcome-row" style={{ animationDelay: `${i * 70}ms` }}>
              <Card className="p-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}B3)`, boxShadow: `0 6px 16px ${t.color}45`, color: '#FFF' }}>
                    {t.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-semibold mb-1" style={{ color: T.ink }}>{t.title}</div>
                    <div className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>{t.body}</div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
        <div className="welcome-row" style={{ animationDelay: `${tips.length * 70 + 60}ms` }}>
          <Button onClick={onDismiss} size="lg" className="w-full" icon={<Check size={18} />}>
            Start studying
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fadeup max-w-md mx-auto px-4 pb-12"
         style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}>
      {/* skip — always reachable, deliberately quiet (issues round) */}
      <div className="flex justify-end mb-1">
        <button onClick={() => setLeaveConfirm(true)}
                className="no-tap-highlight text-xs font-medium px-3 py-1.5 rounded-full active:bg-black/5"
                style={{ color: T.muted }}>
          Skip tour
        </button>
      </div>
      <div className="text-center mb-6 relative">
        {/* soft radial glow behind the hero icon — product-reveal feel */}
        <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 -top-6 w-48 h-48 rounded-full pointer-events-none"
             style={{ background: `radial-gradient(circle, ${T.primary}1F, transparent 65%)` }} />
        <div className="welcome-float relative inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
             style={{ background: `linear-gradient(140deg, ${T.primary}, ${T.primarySoft || T.primary})`, boxShadow: `0 10px 26px ${T.primary}50` }}>
          <GraduationCap size={30} color="#FFF" />
        </div>
        <div className="text-xs uppercase tracking-widest mb-2 relative" style={{ color: T.muted }}>Welcome{displayName ? `, ${displayName}` : ''}</div>
        <h1 className="font-display text-3xl font-semibold mb-1.5 relative" style={{ color: T.ink }}>Here's what's inside</h1>
        <div className="text-sm relative" style={{ color: T.muted }}>Tap any section to see what it does, then jump in. You can reopen this from Settings.</div>
      </div>

      {/* Tour progress — fills as rows are explored. */}
      <div className="flex items-center gap-2.5 mb-4 px-0.5">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
          <div className="h-full rounded-full"
               style={{ width: `${progressPct}%`, background: T.primary,
                        transition: 'width 500ms cubic-bezier(0.22,1,0.36,1)' }} />
        </div>
        <div className="text-[11px] font-medium tabular-nums flex-shrink-0" style={{ color: T.muted }}>
          {exploredCount}/{items.length} explored
        </div>
      </div>

      <div className="space-y-2.5 mb-6">
        {items.map((it, i) => {
          const seen = visited.has(it.helpKey);
          const tint = IS_DARK ? it.darkColor : it.color;
          return (
            <div key={it.helpKey} className="welcome-row" style={{ animationDelay: `${i * 55}ms` }}>
              <Card className="p-3.5 cursor-pointer no-tap-highlight pressable active:scale-[0.98] transition-transform"
                    onClick={() => openRow(it)}
                    style={it.hero
                      ? { background: 'radial-gradient(120% 170% at 85% 0%, #1B2A4E 0%, #0A0E1C 60%, #070A14 100%)',
                          border: '1px solid rgba(255,255,255,0.12)' }
                      : undefined}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative transition-transform"
                       style={it.hero
                         ? { background: 'rgba(255,210,122,0.14)', border: '1px solid rgba(255,210,122,0.35)', color: '#FFD27A' }
                         : { background: tint + '18', color: tint }}>
                    {it.icon}
                    {seen && (
                      <span className="welcome-pop absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: it.hero ? '#FFD27A' : T.primary }}>
                        <Check size={10} color={it.hero ? '#1a1205' : '#FFF'} />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm font-semibold mb-0.5 flex items-center gap-1.5"
                         style={{ color: it.hero ? '#EAF0FF' : T.ink }}>
                      {it.title}
                      {it.hero && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                              style={{ background: 'rgba(255,210,122,0.18)', color: '#FFD27A' }}>{'\u2728'} Game</span>
                      )}
                    </div>
                    <div className="text-xs leading-snug" style={{ color: it.hero ? 'rgba(234,240,255,0.62)' : T.muted }}>{it.desc}</div>
                  </div>
                  <ChevronRight size={16} style={{ color: it.hero ? 'rgba(234,240,255,0.55)' : T.muted }} className="flex-shrink-0" />
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      <div className="welcome-row" style={{ animationDelay: `${items.length * 55 + 60}ms` }}>
        <Button onClick={() => setStep('tips')} size="lg" className="w-full" icon={<ChevronRight size={18} />}>
          Got it
        </Button>
      </div>

      {/* F-C — per-row help popup. Got it → launch the section; back → tour.
          Springs up from the bottom (kmap-sheet-up) over a fading scrim. */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center kmap-scrim-in"
             style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setSelected(null)}>
          <div className="kmap-sheet-up w-full sm:max-w-md sm:mx-4 rounded-t-3xl sm:rounded-3xl p-5 pb-7"
               style={{ background: T.surface, maxHeight: '85vh', overflowY: 'auto' }}
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <button onClick={() => setSelected(null)} aria-label="Back"
                      className="no-tap-highlight -ml-1 p-1 rounded-lg active:scale-95 transition" style={{ color: T.muted }}>
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 text-center">
                <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>{selected.title}</div>
                <div className="text-[11px]" style={{ color: T.muted }}>A quick look before you jump in</div>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close"
                      className="no-tap-highlight -mr-1 p-1 rounded-lg active:scale-95 transition" style={{ color: T.muted }}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3.5 mb-5">
              {sections.length > 0 ? sections.map((s, i) => (
                <div key={s.label} className="welcome-row" style={{ animationDelay: `${i * 70}ms` }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span style={{ color: T.primary }}>{s.icon}</span>
                    <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>{s.label}</div>
                  </div>
                  <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>{s.text}</div>
                </div>
              )) : (
                <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>{selected.desc}</div>
              )}
            </div>

            <Button onClick={launchSelected} size="lg" className="w-full" icon={<ChevronRight size={18} />}>
              Got it {'\u2014'} open {selected.title}
            </Button>
          </div>
        </div>
      )}

      {/* Leave-tour confirmation (issues round) — the device back button (or
          Skip) never exits abruptly; only an explicit choice ends the tour. */}
      <ConfirmDialog open={leaveConfirm}
                     title="Leave the tour?"
                     body="You can reopen it anytime from Settings → Show welcome tour."
                     confirmLabel="Leave" cancelLabel="Stay" tone="primary"
                     onConfirm={() => { setLeaveConfirm(false); onDismiss(); }}
                     onCancel={() => setLeaveConfirm(false)} />
    </div>
  );
}

export default WelcomeScreen;
