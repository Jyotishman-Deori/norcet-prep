// =====================================================================
// src/screens/help-modal.jsx — context-sensitive "what is this screen?" guide,
// hosted once at the app root (HelpHost) and opened via requestHelp() (A1 slice
// 39). Same root-mount reasoning as Support/Feedback hosts. Help copy loads
// lazily via useContent('help') with a generic fallback. HelpModal gains a
// useTheme() hook (was a bare-T reader). Render site (<HelpHost/>) unchanged.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Lightbulb, ListChecks, Sparkles, HelpCircle, X, Quote } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { useContent } from '../lib/content.js';
import { registerHelpOpener, Card } from '../ui/primitives.jsx';

function HelpHost() {
  const [ctx, setCtx] = useState(null); // null = closed
  useEffect(() => {
    registerHelpOpener((c) => setCtx(c || {}));
    return () => { registerHelpOpener(null); };
  }, []);
  if (!ctx) return null;
  return <HelpModal screen={ctx.screen} onClose={() => setCtx(null)} />;
}

function HelpModal({ screen, onClose }) {
  const { theme: T } = useTheme();
  // A2 — help text loaded lazily from /public/data/help.json. While it loads
  // (or if it fails offline), lookup misses fall through to the generic
  // placeholder below — never a crash. Re-renders to the real copy on load.
  const { data: help } = useContent('help');
  // Lookup order:
  //   1. Exact match (e.g. "Coverage map", "Quiz · quick")
  //   2. Strip the "(empty)" suffix used for empty-state screens
  //   3. Fall back to the generic "Quiz" entry for any Quiz · {mode} we
  //      haven't specifically documented yet
  //   4. Last-resort generic placeholder
  const lookup = (key) => (help || {})[key];
  let c = lookup(screen);
  if (!c && typeof screen === 'string') {
    const noEmpty = screen.replace(/\s*\(empty\)\s*$/, '');
    if (noEmpty !== screen) c = lookup(noEmpty);
    if (!c && noEmpty.startsWith('Quiz · ')) c = lookup('Quiz');
  }
  if (!c) c = {
    title: 'Help',
    what: 'This is one of the app\u2019s sections.',
    how: 'Explore the controls on screen, they\u2019re labelled to guide you.',
    why: 'Everything here is built to help you prepare efficiently.'
  };
  const sections = [
    { label: 'What it is', icon: <Lightbulb size={13} />, text: c.what },
    { label: 'How to use it', icon: <ListChecks size={13} />, text: c.how },
    { label: 'Why it\u2019s here', icon: <Sparkles size={13} />, text: c.why },
    // Optional concrete example — only shown when the section provides one.
    ...(c.example ? [{ label: 'For example', icon: <Quote size={13} />, text: c.example, isExample: true }] : [])
  ];
  const dialogRef = useFocusTrap(onClose);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <Card className="w-full max-w-md anim-scalein max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
        <div className="p-5" ref={dialogRef} role="dialog" aria-modal="true" aria-label={c.title || 'Help'}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '15' }}>
                <HelpCircle size={17} style={{ color: T.primary }} />
              </span>
              <div className="font-display text-lg font-semibold truncate" style={{ color: T.ink }}>{c.title}</div>
            </div>
            <button onClick={onClose} aria-label="Close" className="no-tap-highlight p-1.5 -m-1.5 rounded-lg active:bg-black/5 flex-shrink-0">
              <X size={18} style={{ color: T.muted }} />
            </button>
          </div>
          <div className="text-[11px] mb-4 px-0.5" style={{ color: T.muted }}>A quick guide to this screen</div>

          <div className="space-y-4">
            {sections.map(s => (
              <div key={s.label}
                   style={s.isExample ? { background: T.surfaceWarm, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 12px' } : undefined}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: T.primary }}>{s.icon}</span>
                  <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>{s.label}</div>
                </div>
                <div className="text-sm leading-relaxed" style={{ color: s.isExample ? T.ink : T.inkSoft }}>{s.text}</div>
              </div>
            ))}
          </div>

          <button onClick={onClose}
                  className="no-tap-highlight w-full mt-5 py-3 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                  style={{ background: T.primary, color: '#FFF' }}>
            Got it
          </button>

          {/* Ask-companion hand-off. The host has no router access, so this
              rides the same window-event pattern as norcet:reset-screen. */}
          <button onClick={() => { onClose(); try { window.dispatchEvent(new CustomEvent('norcet:open-assistant')); } catch (e) {} }}
                  className="no-tap-highlight w-full mt-2 py-2.5 rounded-xl text-[12.5px] font-medium active:scale-[0.99] transition inline-flex items-center justify-center gap-1.5"
                  style={{ background: 'transparent', color: T.primary }}>
            <Sparkles size={13} /> Still stuck? Chat with your companion
          </button>
        </div>
      </Card>
    </div>
  );
}

export { HelpHost, HelpModal };
export default HelpHost;
