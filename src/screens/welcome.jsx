// =====================================================================
// src/screens/welcome.jsx — first-run welcome / quick-nav (A1 slice 20)
// Extracted from App.jsx (now unblocked by slice 20's palette lib). Body
// byte-identical; only change is the A7 hook line (T + IS_DARK -> useTheme).
// Reads BOTH base palettes (light+dark swatch per nav tile) from ../lib/themes.js.
// Props stay { displayName, onDismiss, onLaunch }.
// =====================================================================
import React from 'react';
import { Brain, Check, ChevronRight, ClipboardList, FileText, GraduationCap, Layers, ListChecks, Shuffle, Timer } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import { LIGHT_THEME, DARK_THEME } from '../lib/themes.js';

function WelcomeScreen({ displayName, onDismiss, onLaunch }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  // Each row is now a launchable shortcut. Tapping the card closes the
  // welcome screen and navigates straight to that mode — so the tour
  // doubles as a quick-start menu for first-time users.
  const items = [
    { icon: <Shuffle size={18} />,    title: 'Quick test',           desc: 'Fast questions with hints — start a quick round any time.',                color: LIGHT_THEME.sec.quick,    darkColor: DARK_THEME.sec.quick,    nav: { screen: 'quick-setup' } },
    { icon: <ListChecks size={18} />, title: 'Topic wise test',      desc: 'Focus on one subject at a time.',                                          color: LIGHT_THEME.sec.topic,    darkColor: DARK_THEME.sec.topic,    nav: { screen: 'topic-select' } },
    { icon: <Timer size={18} />,      title: 'Mock & Advanced Test', desc: 'Exam-realistic — no hints, real countdown, negative marking.',             color: LIGHT_THEME.sec.mock,     darkColor: DARK_THEME.sec.mock,     nav: { screen: 'mock-setup' } },
    { icon: <ClipboardList size={18} />, title: 'Previous Year Papers', desc: 'Sit full official AIIMS NORCET papers and track your score on each.',     color: LIGHT_THEME.sec.mock,     darkColor: DARK_THEME.sec.mock,     nav: { screen: 'previous-papers' } },
    { icon: <Brain size={18} />,      title: 'Learn topic wise',     desc: 'Bite-sized concept cards instead of passive video.',                       color: LIGHT_THEME.sec.learn,    darkColor: DARK_THEME.sec.learn,    nav: { screen: 'learn-topics' } },
    { icon: <FileText size={18} />,   title: 'Revision Sheet',       desc: 'Bookmarks digested into one printable page.',                              color: LIGHT_THEME.sec.revision, darkColor: DARK_THEME.sec.revision, nav: { screen: 'revision-sheet' } },
    { icon: <Layers size={18} />,     title: 'Question Bank Library',desc: 'Browse shared banks and import questions.',                                color: LIGHT_THEME.sec.library,  darkColor: DARK_THEME.sec.library,  nav: { screen: 'library' } }
  ];

  const handleTap = (nav) => {
    if (onLaunch) onLaunch(nav);
    else onDismiss();
  };

  return (
    <div className="anim-fadeup max-w-md mx-auto px-4 pt-8 pb-12">
      <div className="text-center mb-7">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
             style={{ background: T.primary }}>
          <GraduationCap size={28} color="#FFF" />
        </div>
        <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>Welcome{displayName ? `, ${displayName}` : ''}</div>
        <h1 className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Here's what's inside</h1>
        <div className="text-sm" style={{ color: T.muted }}>Tap any section to jump straight in. You can reopen this from Settings.</div>
      </div>

      <div className="space-y-2.5 mb-6">
        {items.map((it, i) => (
          <Card key={i} className="p-3.5 cursor-pointer no-tap-highlight pressable active:scale-[0.99] transition-transform"
                onClick={() => handleTap(it.nav)}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: (IS_DARK ? it.darkColor : it.color) + '18', color: IS_DARK ? it.darkColor : it.color }}>
                {it.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-semibold mb-0.5" style={{ color: T.ink }}>{it.title}</div>
                <div className="text-xs leading-snug" style={{ color: T.muted }}>{it.desc}</div>
              </div>
              <ChevronRight size={16} style={{ color: T.muted }} className="flex-shrink-0" />
            </div>
          </Card>
        ))}
      </div>

      <Button onClick={onDismiss} size="lg" className="w-full" icon={<Check size={18} />}>
        Got it
      </Button>
    </div>
  );
}

export default WelcomeScreen;
