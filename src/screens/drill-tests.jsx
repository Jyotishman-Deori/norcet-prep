// =====================================================================
// src/screens/drill-tests.jsx  (#11 Drill Tests)
// A dedicated destination consolidating the six test modes, laid out as a
// JOURNEY of ascending commitment: casual warm-ups at the top, full
// exam-hall intensity at the bottom. Carries the existing icons + section
// accents forward (same design language) but gives each mode a premium,
// considered card and a clear visual hierarchy:
//
//   Top tier   (side-by-side) — Quick Test, Topic Wise Test  (light)
//   Middle tier(side-by-side) — Mock Test, Dosage Calc       (tinted)
//   Bottom tier(full width)   — Previous Year Papers (PYQ)    (bold)
//                             — Advanced Test (EXAM)           (darkest)
//
// Colour intensity + elevation rise top→bottom. Learn Topic Wise is NOT
// here — it lives on Home only. Each card routes to its existing setup
// screen via onNavigate (handleHomeNavigate). [A7] theme via useTheme().
// =====================================================================
import React from 'react';
import { Shuffle, ListChecks, Timer, Calculator, ClipboardList, Hourglass, ChevronRight } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
// TIP — hold (mobile) / hover (PC) info bubbles per test mode.
import { Tip } from '../ui/tooltip.jsx';

function DrillTests({ onBack, onNavigate }) {
  const { theme: T } = useTheme();
  const go = (screen) => onNavigate({ screen });

  // Staggered page-load reveal — a single orchestrated cascade reads as
  // "considered", per the ascending-journey concept.
  const Reveal = ({ delay = 0, children }) => (
    <div className="anim-fadeup" style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}>
      {children}
    </div>
  );

  // --- Top tier: light, energetic, approachable (white + accent top border) ---
  const TopCard = ({ icon: Icon, color, title, sub, onClick, tip }) => (
    <Tip title={title} text={tip}>
    <Card className="p-4 h-full" onClick={onClick} style={{ borderTop: `3px solid ${color}` }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: color }}>
        <Icon size={18} color="#FFF" />
      </div>
      <div className="font-display text-base font-semibold mb-0.5 flex items-center gap-1" style={{ color: T.ink }}>
        {title}
      </div>
      <div className="text-xs leading-snug" style={{ color: T.muted }}>{sub}</div>
    </Card>
    </Tip>
  );

  // --- Middle tier: tinted background + filled icon — more focused/disciplined ---
  const MidCard = ({ icon: Icon, color, title, sub, onClick, tip }) => (
    <Tip title={title} text={tip}>
    <Card className="p-4 h-full" onClick={onClick}
          style={{ background: color + '12', border: `1px solid ${color}33`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: color }}>
        <Icon size={18} color="#FFF" />
      </div>
      <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>{title}</div>
      <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>{sub}</div>
    </Card>
    </Tip>
  );

  return (
    <div className="anim-fadeup">
      <TopBar title="Drill Tests" onBack={onBack} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">

        <Reveal delay={0}>
          <p className="text-[13px] leading-relaxed mb-4 px-0.5" style={{ color: T.muted }}>
            From a quick warm-up to full exam-hall mode — the further you go, the more it
            counts. Pick your intensity.
          </p>
        </Reveal>

        {/* Top tier */}
        <Reveal delay={40}>
          <div className="grid grid-cols-2 gap-3 mb-3 items-stretch">
            <TopCard icon={Shuffle}    color={T.sec.quick} title="Quick Test"
                     sub="Pick count + topic" onClick={() => go('quick-setup')}
                     tip="A fast warm-up: choose how many questions and (optionally) a topic — instant feedback after every answer." />
            <TopCard icon={ListChecks} color={T.sec.topic} title="Topic Wise"
                     sub="Pick a subject" onClick={() => go('topic-select')}
                     tip="Drill one subject at a time to turn weak areas into strong ones — feeds your topic accuracy stats." />
          </div>
        </Reveal>

        {/* Middle tier */}
        <Reveal delay={90}>
          <div className="grid grid-cols-2 gap-3 mb-3 items-stretch">
            <MidCard icon={Timer}      color={T.sec.mock}  title="Mock Test"
                     sub="Timed simulation" onClick={() => go('mock-setup')}
                     tip="A timed run under exam pressure — fixed clock, no hints, score at the end." />
            <MidCard icon={Calculator} color={T.sec.stats} title="Dosage Calc"
                     sub="Numeric drug-math · type-in" onClick={() => go('dosage')}
                     tip="Type-in dosage calculations with step-by-step working shown after each answer — the NORCET drug-math staple." />
          </div>
        </Reveal>

        {/* Bottom tier — Previous Year Papers (bold, official) */}
        <Reveal delay={150}>
          <Tip title="Previous Year Papers" text="Official AIIMS NORCET papers — sit the full timed simulation, or open Read Mode for calm question-and-answer revision.">
          <Card className="p-4 mb-3" onClick={() => go('previous-papers')}
                style={{ background: T.sec.revision, border: 'none', boxShadow: '0 6px 18px rgba(0,0,0,0.18)' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(255,255,255,0.16)' }}>
                <ClipboardList size={22} color="#FFF" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="font-display text-base font-semibold" style={{ color: '#FFF' }}>
                    Previous Year Papers
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{ background: '#FFF', color: T.sec.revision }}>PYQ</span>
                </div>
                <div className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  Official AIIMS NORCET papers · full mock with negative marking
                </div>
              </div>
              <ChevronRight size={20} style={{ color: 'rgba(255,255,255,0.8)' }} className="flex-shrink-0" />
            </div>
          </Card>
          </Tip>
        </Reveal>

        {/* Bottom tier — Advanced Test (the final boss: darkest + most elevated) */}
        <Reveal delay={210}>
          <Tip title="Advanced Test" text="The full exam-hall experience: countdown clock, negative marking and a question palette to jump around — scores feed your best-net history.">
          <Card className="p-5" onClick={() => go('advanced-setup')}
                style={{
                  background: `linear-gradient(135deg, ${T.sec.advanced} 55%, rgba(0,0,0,0.22))`,
                  border: 'none',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.30)',
                }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(255,255,255,0.14)' }}>
                <Hourglass size={24} color={T.bg} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="font-display text-lg font-semibold" style={{ color: T.bg }}>
                    Advanced Test
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{ background: T.accent, color: '#FFF' }}>Exam</span>
                </div>
                <div className="text-xs leading-snug" style={{ color: T.bg, opacity: 0.72 }}>
                  Negative marking · countdown · question palette
                </div>
              </div>
              <ChevronRight size={22} style={{ color: T.bg, opacity: 0.6 }} className="flex-shrink-0" />
            </div>
            <div className="text-[11px] mt-3 pt-3 leading-relaxed"
                 style={{ color: T.bg, opacity: 0.6, borderTop: `1px solid ${T.bg}22` }}>
              Real exam conditions, start to finish. Reserved for when you're ready to test yourself for real.
            </div>
          </Card>
          </Tip>
        </Reveal>

      </div>
    </div>
  );
}

export default DrillTests;
