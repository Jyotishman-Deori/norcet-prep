// =====================================================================
// src/screens/welcome.jsx — first-run welcome / quick-nav
// F-C UPGRADE: tapping a row no longer launches the section directly. It
// first opens a help popup (What it is / How to use it / Why it's here,
// reusing the section's help.json copy) with a prominent "Got it" that THEN
// launches the section, and a subtle back that returns to the tour. Each row
// the user has opened gets a visited checkmark, persisted per profile, so the
// Settings → Welcome Tour replay shows progress.
//
// Contract with App is UNCHANGED: onLaunch(nav) still launches a section (App
// arms cameFromWelcome so Back returns here) and onDismiss() ends the tour.
// Guest re-show / onboarding-seen behaviour is owned by App and untouched.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Brain, Check, ChevronRight, ClipboardList, FileText, GraduationCap, Layers, ListChecks, Shuffle, Timer, Lightbulb, Sparkles, ArrowLeft, X } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import { LIGHT_THEME, DARK_THEME } from '../lib/themes.js';
import { useContent } from '../lib/content.js';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';

function WelcomeScreen({ displayName, onDismiss, onLaunch }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { profile } = useProfile();
  const { data: help } = useContent('help');
  const profileId = (profile && profile.id) || 'guest';
  const storeKey = `${KEYS.WELCOME_TOUR_VISITED}${profileId}`;

  // Each row is a launchable section. `helpKey` maps to its help.json entry so
  // the popup reuses the same accurate What/How/Why the Help button shows.
  const items = [
    { icon: <Shuffle size={18} />,    title: 'Quick test',           desc: 'Fast questions with hints — start a quick round any time.',                color: LIGHT_THEME.sec.quick,    darkColor: DARK_THEME.sec.quick,    nav: { screen: 'quick-setup' },     helpKey: 'Quick practice setup' },
    { icon: <ListChecks size={18} />, title: 'Topic wise test',      desc: 'Focus on one subject at a time.',                                          color: LIGHT_THEME.sec.topic,    darkColor: DARK_THEME.sec.topic,    nav: { screen: 'topic-select' },    helpKey: 'Topic select' },
    { icon: <Timer size={18} />,      title: 'Mock & Advanced Test', desc: 'Exam-realistic — no hints, real countdown, negative marking.',             color: LIGHT_THEME.sec.mock,     darkColor: DARK_THEME.sec.mock,     nav: { screen: 'mock-setup' },      helpKey: 'Mock setup' },
    { icon: <ClipboardList size={18} />, title: 'Previous Year Papers', desc: 'Sit full official AIIMS NORCET papers and track your score on each.',     color: LIGHT_THEME.sec.mock,     darkColor: DARK_THEME.sec.mock,     nav: { screen: 'previous-papers' }, helpKey: 'Previous year papers' },
    { icon: <Brain size={18} />,      title: 'Learn topic wise',     desc: 'Bite-sized concept cards instead of passive video.',                       color: LIGHT_THEME.sec.learn,    darkColor: DARK_THEME.sec.learn,    nav: { screen: 'learn-topics' },    helpKey: 'Learn — topics' },
    { icon: <FileText size={18} />,   title: 'Revision Sheet',       desc: 'Bookmarks digested into one printable page.',                              color: LIGHT_THEME.sec.revision, darkColor: DARK_THEME.sec.revision, nav: { screen: 'revision-sheet' },  helpKey: 'Revision sheet' },
    { icon: <Layers size={18} />,     title: 'Question Bank Library',desc: 'Browse shared banks and import questions.',                                color: LIGHT_THEME.sec.library,  darkColor: DARK_THEME.sec.library,  nav: { screen: 'library' },         helpKey: 'Library' }
  ];

  const [selected, setSelected] = useState(null); // item whose popup is open
  const [visited, setVisited] = useState(() => new Set());

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

  // ---- the per-row help popup (What / How / Why, reusing help.json) ----
  const c = selected ? (help && help[selected.helpKey]) : null;
  const sections = c ? [
    { label: 'What it is', icon: <Lightbulb size={13} />, text: c.what },
    { label: 'How to use it', icon: <ListChecks size={13} />, text: c.how },
    { label: 'Why it\u2019s here', icon: <Sparkles size={13} />, text: c.why },
  ].filter(s => s.text) : [];

  return (
    <div className="anim-fadeup max-w-md mx-auto px-4 pt-8 pb-12">
      <div className="text-center mb-7">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ background: T.primary }}>
          <GraduationCap size={28} color="#FFF" />
        </div>
        <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>Welcome{displayName ? `, ${displayName}` : ''}</div>
        <h1 className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Here's what's inside</h1>
        <div className="text-sm" style={{ color: T.muted }}>Tap any section to see what it does, then jump in. You can reopen this from Settings.</div>
      </div>

      <div className="space-y-2.5 mb-6">
        {items.map((it, i) => {
          const seen = visited.has(it.helpKey);
          return (
            <Card key={i} className="p-3.5 cursor-pointer no-tap-highlight pressable active:scale-[0.99] transition-transform"
                  onClick={() => openRow(it)}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                     style={{ background: (IS_DARK ? it.darkColor : it.color) + '18', color: IS_DARK ? it.darkColor : it.color }}>
                  {it.icon}
                  {seen && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: T.primary }}>
                      <Check size={10} color="#FFF" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-semibold mb-0.5" style={{ color: T.ink }}>{it.title}</div>
                  <div className="text-xs leading-snug" style={{ color: T.muted }}>{it.desc}</div>
                </div>
                <ChevronRight size={16} style={{ color: T.muted }} className="flex-shrink-0" />
              </div>
            </Card>
          );
        })}
      </div>

      <Button onClick={onDismiss} size="lg" className="w-full" icon={<Check size={18} />}>
        Got it
      </Button>

      {/* F-C — per-row help popup. Got it → launch the section; back → tour. */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setSelected(null)}>
          <div className="anim-fadeup w-full sm:max-w-md sm:mx-4 rounded-t-3xl sm:rounded-3xl p-5 pb-7"
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
              {sections.length > 0 ? sections.map(s => (
                <div key={s.label}>
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
              Got it — open {selected.title}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WelcomeScreen;
