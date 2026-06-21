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
import { Brain, Check, ChevronRight, FileText, Flag, GraduationCap, Layers, ListChecks, Dumbbell, Network, Lightbulb, Sparkles, ArrowLeft, X, Hand, MousePointerClick } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import { LIGHT_THEME, DARK_THEME } from '../lib/themes.js';
import { useContent } from '../lib/content.js';
import { safeStorage } from '../lib/safe-storage.js';
import ConfirmDialog from '../ui/confirm-dialog.jsx';
import { KEYS } from '../lib/keys.js';

function WelcomeScreen({ displayName, onDismiss, onLaunch }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { profile } = useProfile();
  const { data: help } = useContent('help');
  const profileId = (profile && profile.id) || 'guest';
  const storeKey = `${KEYS.WELCOME_TOUR_VISITED}${profileId}`;

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
  const [step, setStep] = useState('tour');        // 'tour' | 'tips' (2nd onboarding page)
  const [visited, setVisited] = useState(() => new Set());
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
      if (selectedRef.current) setSelected(null);
      else if (stepRef.current === 'tips') setStep('tour');
      else setLeaveConfirm(true);
    };
    window.addEventListener('norcet:welcome-back', onBack);
    return () => window.removeEventListener('norcet:welcome-back', onBack);
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

  // ---- Second onboarding page: the gestures + tap-and-hold first-timers miss ----
  if (step === 'tips') {
    const tips = [
      { icon: <MousePointerClick size={20} />, title: 'Press & hold any card',
        body: 'On the home screen, the menu or in settings, press and hold a card for a moment to peek a quick description of what it does — without opening it.',
        color: T.primary },
      { icon: <Hand size={20} style={{ transform: 'scaleX(-1)' }} />, title: 'Swipe to open the menu',
        body: 'On the home screen, swipe right from anywhere to slide the menu open, and swipe left to close it. Works the same on phone, tablet and iPhone.',
        color: T.accent },
      { icon: <Sparkles size={20} />, title: 'Submit without guessing',
        body: 'In any test, if you don’t know an answer just tap Submit to see the worked solution. It stays neutral — it never counts for or against your accuracy.',
        color: T.sec.revision },
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
          <div className="text-sm relative" style={{ color: T.muted }}>Little gestures that make the app faster to use.</div>
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
