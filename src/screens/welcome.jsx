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
import { Brain, Check, ChevronRight, FileText, Flag, GraduationCap, Languages, Layers, ListChecks, Dumbbell, Network, Lightbulb, Sparkles, ArrowLeft, ArrowRight, X, Hand, MousePointerClick, Heart, Rocket, Download, Users, Clock, Headphones, Target, PlusCircle, Lock, Bell } from 'lucide-react';
import { useTheme, useProfile, useI18n } from '../lib/app-context.jsx';
import { LOCALES, getLang } from '../lib/i18n.js';
import { Card, Button } from '../ui/primitives.jsx';
import { LIGHT_THEME, DARK_THEME } from '../lib/themes.js';
import { useContent } from '../lib/content.js';
import { safeStorage } from '../lib/safe-storage.js';
import ConfirmDialog from '../ui/confirm-dialog.jsx';
import { KEYS } from '../lib/keys.js';
import {
  GENDER_OPTIONS, QUALIFICATION_OPTIONS, EMPLOYMENT_OPTIONS,
  QUALIFICATION_UNLOCK, EMPLOYMENT_UNLOCK, normalizeDemographics,
  STUDY_WINDOW_OPTIONS, STUDY_WINDOW_UNLOCK,
  sanitizeIkigai, IKIGAI_MAX,
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
  const { t, setLang } = useI18n();
  const { data: help } = useContent('help');

  // I18N — one-time "view in your language?" chip. Suggestion only, never an
  // auto-switch: shown while the UI is English, the device language matches a
  // Tier-1 locale, and the user hasn't dealt with it before. Accepting or
  // dismissing both retire it for good (localStorage flag).
  const [langSuggest, setLangSuggest] = useState(() => {
    try {
      if (getLang() !== 'en') return null;
      if (localStorage.getItem(KEYS.LANG_SUGGEST_DISMISSED)) return null;
      const navCode = String((typeof navigator !== 'undefined' && navigator.language) || '')
        .toLowerCase().split('-')[0];
      // Match on our code OR the BCP-47 primary subtag (Assamese devices
      // report 'as' while our code is 'asm').
      return LOCALES.find(l => l.suggest && navCode &&
        (l.code === navCode || l.bcp47.split('-')[0].toLowerCase() === navCode)) || null;
    } catch (e) { return null; }
  });
  const retireLangSuggest = () => {
    setLangSuggest(null);
    try { localStorage.setItem(KEYS.LANG_SUGGEST_DISMISSED, '1'); } catch (e) {}
  };
  const acceptLangSuggest = () => {
    const code = langSuggest && langSuggest.code;
    retireLangSuggest();
    if (code) Promise.resolve(setLang(code)).catch(() => {});
  };
  const langChip = langSuggest ? (
    <div className="anim-fadeup flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 mb-4"
         style={{ background: T.primary + '10', border: `1px solid ${T.primary}30` }}>
      <Languages size={16} className="flex-shrink-0" style={{ color: T.primary }} />
      <button onClick={acceptLangSuggest} lang={langSuggest.bcp47}
              className="no-tap-highlight flex-1 min-w-0 text-left text-sm font-semibold active:opacity-70 transition-opacity"
              style={{ color: T.primary }}>
        {langSuggest.suggest}
      </button>
      <button onClick={retireLangSuggest} aria-label={t('common.close')}
              className="no-tap-highlight p-1 -m-1 flex-shrink-0">
        <X size={14} style={{ color: T.muted }} />
      </button>
    </div>
  ) : null;
  const profileId = (profile && profile.id) || 'guest';
  const storeKey = `${KEYS.WELCOME_TOUR_VISITED}${profileId}`;
  const demo = normalizeDemographics(demographics);

  // NEW-01/02 — first-run onboarding adds App-Pitch, Library and the three
  // demographic screens before the "what's inside" tour. Replays from Settings
  // skip straight to the tour (no re-collecting data).
  const STEP_ORDER = firstRun
    ? ['pitch', 'library', 'gender', 'qualification', 'employment', 'window', 'ikigai', 'tour', 'tips']
    : ['tour', 'tips'];

  // Each row is a launchable section. `helpKey` maps to its help.json entry so
  // the popup reuses the same accurate What/How/Why the Help button shows.
  // Mirrors the current IA: tests are consolidated under Drill Tests (#11) and
  // the Knowledge Map (#13, the USP) gets a constellation hero treatment.
  const items = [
    { icon: <Network size={18} />,   title: t('welcome.rows.kmap.title'),     desc: t('welcome.rows.kmap.desc'),      color: '#8A6D1F',                darkColor: '#FFD27A',               nav: { screen: 'knowledge-map' },  helpKey: 'Knowledge Map', hero: true },
    { icon: <Dumbbell size={18} />,  title: t('welcome.rows.drill.title'),       desc: t('welcome.rows.drill.desc'),   color: LIGHT_THEME.sec.mock,     darkColor: DARK_THEME.sec.mock,     nav: { screen: 'drill-tests' },    helpKey: 'Drill tests' },
    { icon: <Brain size={18} />,     title: t('welcome.rows.learn.title'),  desc: t('welcome.rows.learn.desc'),                        color: LIGHT_THEME.sec.learn,    darkColor: DARK_THEME.sec.learn,    nav: { screen: 'learn-topics' },   helpKey: 'Learn: topics' },
    { icon: <GraduationCap size={18} />, title: t('welcome.rows.methods.title'), desc: t('welcome.rows.methods.desc'),          color: LIGHT_THEME.primary,      darkColor: DARK_THEME.primary,      nav: { screen: 'study-methods' },  helpKey: 'Study methods' },
    { icon: <FileText size={18} />,  title: t('welcome.rows.revision.title'),    desc: t('welcome.rows.revision.desc'),                               color: LIGHT_THEME.sec.revision, darkColor: DARK_THEME.sec.revision, nav: { screen: 'revision-sheet' }, helpKey: 'Revision sheet' },
    { icon: <Flag size={18} />,      title: t('welcome.rows.doubts.title'),         desc: t('welcome.rows.doubts.desc'),       color: '#B3413A',                darkColor: '#E0726B',               nav: { screen: 'doubts' },         helpKey: 'Doubts' },
    { icon: <Layers size={18} />,    title: t('welcome.rows.library.title'), desc: t('welcome.rows.library.desc'),                             color: LIGHT_THEME.sec.library,  darkColor: DARK_THEME.sec.library,  nav: { screen: 'library' },        helpKey: 'Library' }
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
  // PHIL-08 — the private Ikigai statement (seeded from any saved value).
  const [ikigaiText, setIkigaiText] = useState(demo.ikigai || '');
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
    { label: t('welcome.popup.what'), icon: <Lightbulb size={13} />, text: c.what },
    { label: t('welcome.popup.how'), icon: <ListChecks size={13} />, text: c.how },
    { label: t('welcome.popup.why'), icon: <Sparkles size={13} />, text: c.why },
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
                  style={{ color: T.muted }}><ArrowLeft size={14} /> {t('common.back')}</button>}
      <SkipButton T={T} onClick={() => setLeaveConfirm(true)} label={t('welcome.skipTour')} />
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
      { icon: <Target size={18} />, color: T.error, title: t('welcome.pitch.p1Title'), body: t('welcome.pitch.p1Body') },
      { icon: <Brain size={18} />, color: T.primary, title: t('welcome.pitch.p2Title'), body: t('welcome.pitch.p2Body') },
      { icon: <Sparkles size={18} />, color: T.accent, title: t('welcome.pitch.p3Title'), body: t('welcome.pitch.p3Body') },
    ];
    return (
      <div className="anim-fadeup max-w-md mx-auto px-4 pb-12" style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}>
        {pageHead}
        {langChip}
        {heroIcon(Rocket, T.primary)}
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>{t('welcome.hello')}{displayName ? `, ${displayName}` : ''}</div>
          <h1 className="font-display text-3xl font-semibold mb-1.5" style={{ color: T.ink }}>{t('welcome.pitch.title')}</h1>
          <div className="text-sm" style={{ color: T.muted }}>{t('welcome.pitch.sub')}</div>
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
          <Button onClick={nextStep} size="lg" className="w-full" icon={<ChevronRight size={18} />}>{t('common.next')}</Button>
        </div>
        {/* Layer 1 (guest path) — a quiet passive notice; the recorded checkbox
            consent happens later at account creation. Tapping Terms opens the
            legal screen; Back returns to the tour (cameFromWelcome). */}
        <div className="text-[10.5px] leading-relaxed text-center mt-3 px-2" style={{ color: T.muted }}>
          {t('welcome.consentPre')}{' '}
          <button onClick={() => handleLaunch({ screen: 'legal', doc: 'terms' })}
                  className="no-tap-highlight underline" style={{ color: T.muted }}>
            {t('welcome.consentTerms')}
          </button>.
          {' '}{t('welcome.consentEdu')}
        </div>
      </div>
    );
  }

  // ---- NEW-01 page 2: Library & question-bank explainer ----
  if (step === 'library') {
    const rows = [
      { icon: <Layers size={18} />, color: T.sec.library, title: t('welcome.lib.r1Title'), body: t('welcome.lib.r1Body') },
      { icon: <Download size={18} />, color: T.primary, title: t('welcome.lib.r2Title'), body: t('welcome.lib.r2Body') },
      { icon: <PlusCircle size={18} />, color: T.accent, title: t('welcome.lib.r3Title'), body: t('welcome.lib.r3Body') },
    ];
    return (
      <div className="anim-fadeup max-w-md mx-auto px-4 pb-12" style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}>
        {pageHead}
        {heroIcon(Layers, T.sec.library)}
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>{t('welcome.lib.kicker')}</div>
          <h1 className="font-display text-3xl font-semibold mb-1.5" style={{ color: T.ink }}>{t('welcome.lib.title')}</h1>
          <div className="text-sm" style={{ color: T.muted }}>{t('welcome.lib.sub')}</div>
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
          <Button onClick={nextStep} size="lg" className="w-full" icon={<ChevronRight size={18} />}>{t('common.next')}</Button>
        </div>
      </div>
    );
  }

  // ---- NEW-02 demographic screens (gender / qualification / employment) ----
  // All optional: tapping a choice saves + advances; "Skip this one" advances
  // without saving; "Skip tour" exits (fill it in later in Settings → Profile).
  if (step === 'gender' || step === 'qualification' || step === 'employment' || step === 'window') {
    const cfg = {
      gender: { icon: Users, color: T.primary, kicker: t('welcome.demo.genderKicker'),
        title: t('welcome.demo.genderTitle'),
        trust: t('welcome.demo.genderTrust'),
        field: 'gender', kind: 'gender', options: GENDER_OPTIONS },
      qualification: { icon: GraduationCap, color: T.accent, kicker: t('welcome.demo.qualKicker'),
        title: t('welcome.demo.qualTitle'),
        trust: t('welcome.demo.qualTrust'),
        field: 'qualification', kind: 'qualification', options: QUALIFICATION_OPTIONS },
      employment: { icon: Clock, color: T.sec.revision || T.primary, kicker: t('welcome.demo.empKicker'),
        title: t('welcome.demo.empTitle'),
        trust: t('welcome.demo.empTrust'),
        field: 'employment', kind: 'employment', options: EMPLOYMENT_OPTIONS },
      // Duty Roster — the Day-1 "when do you study?" commitment. Seeds the daily
      // reminder time so the nudge lands in the user's own window.
      window: { icon: Bell, color: T.sec.mock || T.primary, kicker: t('welcome.demo.windowKicker'),
        title: t('welcome.demo.windowTitle'),
        trust: t('welcome.demo.windowTrust'),
        field: 'studyWindow', kind: 'window', options: STUDY_WINDOW_OPTIONS, unlockIcon: Bell },
    }[step];
    const Icon = cfg.icon;
    const UnlockIcon = cfg.unlockIcon || Headphones;
    const current = demo[cfg.field];
    const pick = (id) => {
      if (onSaveDemographics) onSaveDemographics({ [cfg.field]: id });
      const unlock = cfg.kind === 'qualification' ? QUALIFICATION_UNLOCK[id]
                   : cfg.kind === 'employment' ? EMPLOYMENT_UNLOCK[id]
                   : cfg.kind === 'window' ? STUDY_WINDOW_UNLOCK[id] : null;
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
              <UnlockIcon size={18} className="flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />
              <div className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>{pendingUnlock}</div>
            </div>
            <Button onClick={() => { setPendingUnlock(null); nextStep(); }} size="lg" className="w-full" icon={<ChevronRight size={18} />}>{t('common.continue')}</Button>
          </div>
        ) : (
          <button onClick={nextStep}
                  className="no-tap-highlight w-full inline-flex items-center justify-center gap-1 text-[13px] font-medium py-2.5 rounded-xl active:bg-black/5"
                  style={{ color: T.muted }}>
            {current ? t('common.continue') : t('welcome.skipThisOne')} <ArrowRight size={14} />
          </button>
        )}
        <div className="text-[10.5px] text-center mt-2" style={{ color: T.muted }}>
          {t('welcome.demo.privacyNote')}
        </div>
        <div className="text-[10.5px] text-center mt-1" style={{ color: T.muted }}>
          {t('welcome.demo.contentNote')}
        </div>
      </div>
    );
  }

  // ---- PHIL-08: The Ikigai Anchor (private "why"). Captured here, returned to
  // the user at their lowest moments (Code Blue). Sanitised + capped; private. ----
  if (step === 'ikigai') {
    const saveIkigai = () => {
      if (onSaveDemographics) onSaveDemographics({ ikigai: sanitizeIkigai(ikigaiText) });
      nextStep();
    };
    const has = !!ikigaiText.trim();
    // An intentional, theme-independent "moment": a private dark journal panel
    // (navy→plum) that visually separates this from the rest of onboarding.
    const VOW_PANEL = 'radial-gradient(130% 130% at 80% 0%, #2A1B47 0%, #14213D 55%, #0A0E1C 100%)';
    return (
      <div className="anim-fadeup max-w-md mx-auto px-4 pb-12" style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}>
        {pageHead}
        <div className="text-center mb-4 relative">
          <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 -top-6 w-56 h-56 rounded-full pointer-events-none"
               style={{ background: 'radial-gradient(circle, rgba(224,36,94,0.26), transparent 65%)' }} />
          <div className="welcome-float relative inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
               style={{ background: 'linear-gradient(140deg, #E0245E, #9C1A57)', boxShadow: '0 12px 30px rgba(224,36,94,0.5)' }}>
            <Heart size={28} color="#FFF" fill="#FFF" />
          </div>
          <div className="text-[11px] uppercase tracking-[0.22em] mb-1.5 relative" style={{ color: T.muted }}>{t('welcome.ikigai.kicker')}</div>
          <h1 className="font-display text-3xl font-semibold mb-1 relative" style={{ color: T.ink }}>{t('welcome.ikigai.title')}</h1>
          <div className="text-[13px] leading-relaxed relative px-3" style={{ color: T.muted }}>
            {t('welcome.ikigai.bodyPre')} <span style={{ color: T.ink, fontWeight: 600 }}>Ikigai</span>{t('welcome.ikigai.bodyPost')}
          </div>
        </div>

        {/* The private "vow" panel — an intimate, journal-like moment. */}
        <div className="rounded-3xl p-5 mb-3 relative overflow-hidden"
             style={{ background: VOW_PANEL, boxShadow: '0 18px 44px rgba(10,14,28,0.45)' }}>
          <div aria-hidden="true" className="absolute -top-10 -right-8 w-32 h-32 rounded-full pointer-events-none"
               style={{ background: 'radial-gradient(circle, rgba(224,36,94,0.22), transparent 70%)' }} />
          <div className="font-display leading-none mb-0.5" style={{ color: 'rgba(224,36,94,0.85)', fontSize: 40 }}>{'“'}</div>
          <textarea value={ikigaiText} onChange={e => setIkigaiText(e.target.value.slice(0, IKIGAI_MAX))}
                    rows={4} maxLength={IKIGAI_MAX}
                    placeholder={t('welcome.ikigai.placeholder')}
                    className="w-full bg-transparent resize-none outline-none text-[15px] leading-relaxed -mt-2 relative"
                    style={{ color: '#F3EEE3', caretColor: '#E0245E' }} />
          <div className="flex items-center justify-between mt-2 pt-2.5 relative" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="text-[11px] flex items-center gap-1.5" style={{ color: 'rgba(243,238,227,0.62)' }}>
              <Lock size={12} /> {t('welcome.ikigai.private')}
            </div>
            <div className="text-[10px] tabular-nums" style={{ color: ikigaiText.length >= IKIGAI_MAX ? '#FF9A9A' : 'rgba(243,238,227,0.55)' }}>{ikigaiText.length}/{IKIGAI_MAX}</div>
          </div>
        </div>

        <div className="text-[12px] leading-relaxed text-center px-3 mb-4" style={{ color: T.muted }}>
          {t('welcome.ikigai.return')}
        </div>

        <Button onClick={saveIkigai} size="lg" className="w-full" icon={<Heart size={17} fill="#FFF" />}>
          {has ? t('welcome.ikigai.anchor') : t('common.continue')}
        </Button>
        {!has && (
          <button onClick={nextStep}
                  className="no-tap-highlight w-full inline-flex items-center justify-center gap-1 text-[13px] font-medium py-2.5 mt-1 rounded-xl active:bg-black/5"
                  style={{ color: T.muted }}>
            {t('welcome.skipThisOne')} <ArrowRight size={14} />
          </button>
        )}
      </div>
    );
  }

  // ---- Second onboarding page: the gestures + tap-and-hold first-timers miss ----
  if (step === 'tips') {
    const tips = [
      { icon: <MousePointerClick size={20} />, title: t('welcome.tips.t1Title'),
        body: t('welcome.tips.t1Body'),
        color: T.primary },
      { icon: <Hand size={20} style={{ transform: 'scaleX(-1)' }} />, title: t('welcome.tips.t2Title'),
        body: t('welcome.tips.t2Body'),
        color: T.accent },
      { icon: <Heart size={20} fill="#FFF" />, title: t('welcome.tips.t3Title'),
        body: t('welcome.tips.t3Body'),
        color: '#E0245E' },
    ];
    return (
      <div className="anim-fadeup max-w-md mx-auto px-4 pb-12"
           style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}>
        <div className="flex justify-start mb-1">
          <button onClick={() => setStep('tour')}
                  className="no-tap-highlight inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full active:bg-black/5"
                  style={{ color: T.muted }}>
            <ArrowLeft size={14} /> {t('common.back')}
          </button>
        </div>
        <div className="text-center mb-6 relative">
          <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 -top-6 w-48 h-48 rounded-full pointer-events-none"
               style={{ background: `radial-gradient(circle, ${T.primary}1F, transparent 65%)` }} />
          <div className="welcome-float relative inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
               style={{ background: `linear-gradient(140deg, ${T.primary}, ${T.primarySoft || T.primary})`, boxShadow: `0 10px 26px ${T.primary}50` }}>
            <Sparkles size={28} color="#FFF" />
          </div>
          <div className="text-xs uppercase tracking-widest mb-2 relative" style={{ color: T.muted }}>{t('welcome.tips.kicker')}</div>
          <h1 className="font-display text-3xl font-semibold mb-1.5 relative" style={{ color: T.ink }}>{t('welcome.tips.title')}</h1>
          <div className="text-sm relative" style={{ color: T.muted }}>{t('welcome.tips.sub')}</div>
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
            {t('welcome.startStudying')}
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
          {t('welcome.skipTour')}
        </button>
      </div>
      {langChip}
      <div className="text-center mb-6 relative">
        {/* soft radial glow behind the hero icon — product-reveal feel */}
        <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 -top-6 w-48 h-48 rounded-full pointer-events-none"
             style={{ background: `radial-gradient(circle, ${T.primary}1F, transparent 65%)` }} />
        <div className="welcome-float relative inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3"
             style={{ background: `linear-gradient(140deg, ${T.primary}, ${T.primarySoft || T.primary})`, boxShadow: `0 10px 26px ${T.primary}50` }}>
          <GraduationCap size={30} color="#FFF" />
        </div>
        <div className="text-xs uppercase tracking-widest mb-2 relative" style={{ color: T.muted }}>{t('welcome.hello')}{displayName ? `, ${displayName}` : ''}</div>
        <h1 className="font-display text-3xl font-semibold mb-1.5 relative" style={{ color: T.ink }}>{t('welcome.tour.title')}</h1>
        <div className="text-sm relative" style={{ color: T.muted }}>{t('welcome.tour.sub')}</div>
      </div>

      {/* Tour progress — fills as rows are explored. */}
      <div className="flex items-center gap-2.5 mb-4 px-0.5">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
          <div className="h-full rounded-full"
               style={{ width: `${progressPct}%`, background: T.primary,
                        transition: 'width 500ms cubic-bezier(0.22,1,0.36,1)' }} />
        </div>
        <div className="text-[11px] font-medium tabular-nums flex-shrink-0" style={{ color: T.muted }}>
          {t('welcome.tour.explored', { done: exploredCount, total: items.length })}
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
                              style={{ background: 'rgba(255,210,122,0.18)', color: '#FFD27A' }}>{'\u2728'} {t('welcome.gameBadge')}</span>
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
          {t('welcome.gotIt')}
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
              <button onClick={() => setSelected(null)} aria-label={t('common.back')}
                      className="no-tap-highlight -ml-1 p-1 rounded-lg active:scale-95 transition" style={{ color: T.muted }}>
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 text-center">
                <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>{selected.title}</div>
                <div className="text-[11px]" style={{ color: T.muted }}>{t('welcome.popup.sub')}</div>
              </div>
              <button onClick={() => setSelected(null)} aria-label={t('common.close')}
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
              {t('welcome.gotItOpen', { title: selected.title })}
            </Button>
          </div>
        </div>
      )}

      {/* Leave-tour confirmation (issues round) — the device back button (or
          Skip) never exits abruptly; only an explicit choice ends the tour. */}
      <ConfirmDialog open={leaveConfirm}
                     title={t('welcome.leave.title')}
                     body={t('welcome.leave.body')}
                     confirmLabel={t('welcome.leave.leave')} cancelLabel={t('welcome.leave.stay')} tone="primary"
                     onConfirm={() => { setLeaveConfirm(false); onDismiss(); }}
                     onCancel={() => setLeaveConfirm(false)} />
    </div>
  );
}

export default WelcomeScreen;
