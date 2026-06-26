// =====================================================================
// src/screens/drill-tests.jsx  (#11 Drill Tests)
// A dedicated destination consolidating the six test modes, laid out as a
// JOURNEY of ascending commitment: casual warm-ups at the top, full
// exam-hall intensity at the bottom. Carries the existing icons + section
// accents forward (same design language) but gives each mode a premium,
// considered card and a clear visual hierarchy:
//
//   Practice (row of 4)       — Quick, Topic Wise, Mock, Dosage (one uniform
//                               family: crisp white cards, each with its own
//                               accent top-border + round icon)
//   Clinical simulators       — interactive coin drills (gradient tiles, 2-up)
//   Sharp reasoning           — elimination + prioritisation drills (2-up)
//   Exam hall  (side-by-side) — Previous Year Papers (PYQ) · Advanced (EXAM)
//
// Colour intensity + elevation rise top→bottom. Learn Topic Wise is NOT
// here — it lives on Home only. Each card routes to its existing setup
// screen via onNavigate (handleHomeNavigate). [A7] theme via useTheme().
// =====================================================================
import React from 'react';
import { Shuffle, ListChecks, Timer, Calculator, ClipboardList, Hourglass, ChevronRight, SlidersHorizontal, ListOrdered, Activity, Syringe, Recycle, Crosshair, Scale, ScanSearch, Package, Sparkles } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
// TIP — hold (mobile) / hover (PC) info bubbles per test mode.
import { Tip } from '../ui/tooltip.jsx';
// FAV #2 — heart on each test-mode card, beside the title.
import FavHeart from '../ui/fav-heart.jsx';

// Premium micro-interactions for the "Coming soon" placeholder: a slow sheen
// sweeps across the card and the icon gently breathes, signalling "alive, just
// not here yet" without shouting. Honours prefers-reduced-motion.
const DRILL_CSS = `
@keyframes drillSoonSheen { 0% { transform: translateX(-140%) } 55%,100% { transform: translateX(140%) } }
@keyframes drillSoonBreathe { 0%,100% { transform: scale(1); opacity: .82 } 50% { transform: scale(1.09); opacity: 1 } }
.drill-soon-sheen { position:absolute; inset:0; pointer-events:none;
  background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.30) 50%, transparent 62%);
  transform: translateX(-140%); animation: drillSoonSheen 3.4s ease-in-out infinite; }
.drill-soon-icon { animation: drillSoonBreathe 2.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .drill-soon-sheen, .drill-soon-icon { animation: none; }
}
`;

function DrillTests({ onBack, onNavigate }) {
  const { theme: T } = useTheme();
  const go = (screen) => onNavigate({ screen });

  // #15 — premium opening: a single orchestrated cascade where each card flips
  // up with a slight 3D tilt and settles, top→bottom, reinforcing the
  // ascending-journey concept. (The literal "Tests multiplies into titles"
  // idea reads as gimmicky at speed; the staggered tilt-in is the cleaner,
  // premium alternative the brief allowed.)
  const Reveal = ({ delay = 0, className = '', children }) => (
    <div className={`drill-card-in ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );

  // Lightweight section label so the (now longer) hub reads as grouped tiers
  // rather than one flat list — without disturbing the ascending journey.
  const SectionLabel = ({ children, delay = 0 }) => (
    <Reveal delay={delay}>
      <div className="flex items-center gap-2 mt-5 mb-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.muted }}>{children}</span>
        <span className="flex-1 h-px" style={{ background: T.borderSoft }} />
      </div>
    </Reveal>
  );

  // --- Practice card: one uniform family for all four core test modes. A crisp
  // surface card with the mode's accent as a top-border + round icon, so the
  // row reads as four equal, premium options (no more "two look disabled").
  // FAV (issues round) — hearts live in a dedicated TOP-RIGHT action area on
  // every card (never inline with the title), so all hearts across the screen
  // align on the same horizontal line.
  const TopCard = ({ icon: Icon, color, title, sub, onClick, tip, fav = null }) => (
    <Tip title={title} text={tip}>
    <Card className="p-4 h-full relative" onClick={onClick} style={{ borderTop: `3px solid ${color}` }}>
      {fav && <span className="absolute top-2 right-2"><FavHeart favId={fav} inline /></span>}
      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: color }}>
        <Icon size={18} color="#FFF" />
      </div>
      <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>
        {title}
      </div>
      <div className="text-xs leading-snug" style={{ color: T.muted }}>{sub}</div>
    </Card>
    </Tip>
  );

  return (
    <div className="anim-fadeup">
      <style>{DRILL_CSS}</style>
      <TopBar title="Drill Tests" onBack={onBack}
              right={
                <button onClick={() => go('drill-settings')} aria-label="Drill Tests settings"
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5">
                  <SlidersHorizontal size={18} style={{ color: T.muted }} />
                </button>
              } />
      <PageContainer size="app" className="pt-2 pb-24">

        <Reveal delay={0}>
          <p className="text-[13px] leading-relaxed mb-4 px-0.5" style={{ color: T.muted }}>
            From a quick warm-up to full exam-hall mode — the further you go, the more it
            counts. Pick your intensity.
          </p>
        </Reveal>

        <SectionLabel delay={20}>Practice</SectionLabel>

        {/* Practice modes — 2×2 on mobile, a single 4-up row on desktop. */}
        <Reveal delay={40}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 items-stretch">
            <TopCard icon={Shuffle}    color={T.sec.quick} title="Quick Test"
                     sub="Pick count + topic" onClick={() => go('quick-setup')} fav="quick-setup"
                     tip="A fast warm-up: choose how many questions and (optionally) a topic — instant feedback after every answer." />
            <TopCard icon={ListChecks} color={T.sec.topic} title="Topic Wise Test"
                     sub="Pick a subject" onClick={() => go('topic-select')} fav="topic-select"
                     tip="Drill one subject at a time to turn weak areas into strong ones — feeds your topic accuracy stats." />
            <TopCard icon={Timer}      color={T.sec.mock}  title="Mock Test"
                     sub="Timed simulation" onClick={() => go('mock-setup')} fav="mock-setup"
                     tip="A timed run under exam pressure — fixed clock, no hints, score at the end." />
            <TopCard icon={Calculator} color={T.sec.stats} title="Dosage Calc Test"
                     sub="Pick count + pace" onClick={() => go('dosage')} fav="dosage"
                     tip="Type-in dosage calculations with step-by-step working shown after each answer — the NORCET drug-math staple." />
          </div>
        </Reveal>

        <SectionLabel delay={110}>Clinical simulators</SectionLabel>

        <div className="md:grid md:grid-cols-2 md:gap-x-3 md:items-start">

        {/* Clinical Skill Drill — interactive procedure sequencing (NEW) */}
        <Reveal delay={120}>
          <Tip title="Clinical Skill Drill" text="Tap clinical procedure steps into the correct order — PPE donning, BLS, tracheostomy suctioning and more — with the rationale after each.">
          <Card className="p-4 mb-3 relative" onClick={() => go('skill-setup')}
                style={{ background: '#0E7490', border: 'none', boxShadow: '0 6px 18px rgba(0,0,0,0.16)' }}>
            <span className="absolute top-2 right-2 z-10"><FavHeart favId="skill-setup" inline /></span>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(255,255,255,0.16)' }}>
                <ListOrdered size={22} color="#FFF" />
              </div>
              <div className="min-w-0 flex-1" style={{ color: '#FFF' }}>
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-semibold">Clinical Skill Drill</div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }}>New</span>
                </div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Order the steps · earn coins</div>
              </div>
              <ChevronRight size={20} color="rgba(255,255,255,0.8)" />
            </div>
          </Card>
          </Tip>
        </Reveal>

        {/* ICU Monitor — read the rhythm (NEW, zero-asset animated ECG) */}
        <Reveal delay={135}>
          <Tip title="ICU Monitor" text="A live bedside monitor: read the scrolling ECG and vitals, then name the rhythm — NSR, AF, VT, VF, asystole and more, with the first clinical action after each.">
          <Card className="p-4 mb-3 relative overflow-hidden" onClick={() => go('icu-monitor')}
                style={{ background: '#06100E', border: '1px solid #0F2A24', boxShadow: '0 6px 18px rgba(0,0,0,0.22)' }}>
            <span className="absolute top-2 right-2 z-10"><FavHeart favId="icu-monitor" inline /></span>
            {/* faint phosphor pulse line in the backdrop */}
            <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.16 }}>
              <path d="M0 20 L60 20 L66 8 L72 32 L78 20 L200 20" fill="none" stroke="#46F08A" strokeWidth="2" />
            </svg>
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(70,240,138,0.14)' }}>
                <Activity size={22} color="#46F08A" />
              </div>
              <div className="min-w-0 flex-1" style={{ color: '#E6FFF6' }}>
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-semibold">ICU Monitor</div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(70,240,138,0.18)', color: '#46F08A' }}>New</span>
                </div>
                <div className="text-xs" style={{ color: '#7FA89C' }}>Read the rhythm · earn coins</div>
              </div>
              <ChevronRight size={20} color="rgba(127,168,156,0.8)" />
            </div>
          </Card>
          </Tip>
        </Reveal>

        {/* Crash Cart — emergency-drug drill (NEW) */}
        <Reveal delay={142}>
          <Tip title="Crash Cart" text="A patient is crashing — read the vignette and grab the right emergency drug & dose off the trolley (ACLS, anaphylaxis, hyperkalaemia, eclampsia and more), with the why after each.">
          <Card className="p-4 mb-3 relative overflow-hidden" onClick={() => go('crash-cart')}
                style={{ background: 'linear-gradient(135deg, #B91C1C, #7F1D1D)', border: 'none', boxShadow: '0 6px 18px rgba(127,29,29,0.3)' }}>
            <span className="absolute top-2 right-2 z-10"><FavHeart favId="crash-cart" inline /></span>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <Syringe size={22} color="#FFF" />
              </div>
              <div className="min-w-0 flex-1" style={{ color: '#FFF' }}>
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-semibold">Crash Cart</div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }}>New</span>
                </div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Pick the right drug · earn coins</div>
              </div>
              <ChevronRight size={20} color="rgba(255,255,255,0.8)" />
            </div>
          </Card>
          </Tip>
        </Reveal>

        {/* The Sorter — tap-to-sort drill (NEW) */}
        <Reveal delay={148}>
          <Tip title="The Sorter" text="Tap each item into the correct bin — bio-medical waste colour coding and isolation precautions, with the rationale for every miss.">
          <Card className="p-4 mb-3 relative overflow-hidden" onClick={() => go('sorter')}
                style={{ background: 'linear-gradient(135deg, #15803D, #0B5132)', border: 'none', boxShadow: '0 6px 18px rgba(11,81,50,0.3)' }}>
            <span className="absolute top-2 right-2 z-10"><FavHeart favId="sorter" inline /></span>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <Recycle size={22} color="#FFF" />
              </div>
              <div className="min-w-0 flex-1" style={{ color: '#FFF' }}>
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-semibold">The Sorter</div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }}>New</span>
                </div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Waste & isolation · earn coins</div>
              </div>
              <ChevronRight size={20} color="rgba(255,255,255,0.8)" />
            </div>
          </Card>
          </Tip>
        </Reveal>

        {/* IBQ — tap-the-structure on data-driven diagrams (NEW) */}
        <Reveal delay={146}>
          <Tip title="Spot the Structure" text="Image-based questions: tap the right part on a diagram — ECG waves, heart-sound areas, abdominal regions — the picture fills in as you find each one.">
          <Card className="p-4 mb-3 relative overflow-hidden" onClick={() => go('ibq')}
                style={{ background: 'linear-gradient(135deg, #0891B2, #0B4F66)', border: 'none', boxShadow: '0 6px 18px rgba(11,79,102,0.3)' }}>
            <span className="absolute top-2 right-2 z-10"><FavHeart favId="ibq" inline /></span>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <ScanSearch size={22} color="#FFF" />
              </div>
              <div className="min-w-0 flex-1" style={{ color: '#FFF' }}>
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-semibold">Spot the Structure</div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }}>New</span>
                </div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Tap it on the diagram · earn coins</div>
              </div>
              <ChevronRight size={20} color="rgba(255,255,255,0.8)" />
            </div>
          </Card>
          </Tip>
        </Reveal>

        {/* Coming soon — keeps the clinical grid symmetric (6 cards = 3 rows of
            2) and signals more simulators are on the way. Non-interactive,
            premium animated placeholder (sheen sweep + breathing icon). A real
            slot for the next drill we ship here. */}
        <Reveal delay={150}>
          <Tip title="More on the way" text="New clinical simulators are in the works — this slot is reserved for the next one we ship.">
          <div className="p-4 mb-3 relative overflow-hidden rounded-2xl"
               style={{ background: T.surfaceWarm, border: `1.5px dashed ${T.border}` }}
               aria-label="More clinical simulators coming soon">
            <span className="drill-soon-sheen" aria-hidden="true" />
            <div className="relative flex items-center gap-3">
              <div className="drill-soon-icon w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: T.primary + '14', color: T.primary }}>
                <Sparkles size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-semibold" style={{ color: T.inkSoft }}>More coming soon</div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: T.primary + '14', color: T.primary }}>Soon</span>
                </div>
                <div className="text-xs" style={{ color: T.muted }}>New simulators in the works</div>
              </div>
            </div>
          </div>
          </Tip>
        </Reveal>

        </div>{/* /clinical simulators grid */}

        <SectionLabel delay={150}>Sharp reasoning</SectionLabel>

        <div className="md:grid md:grid-cols-2 md:gap-x-3 md:items-start">

        {/* Distractor Assassin — eliminate-the-wrong reasoning drill (NEW) */}
        <Reveal delay={154}>
          <Tip title="Distractor Assassin" text="Flip the MCQ: instead of the right answer, hunt down the WRONG options one by one — without striking the correct one. Each kill reveals why that option is wrong. Trains elimination, the core exam skill.">
          <Card className="p-4 mb-3 relative overflow-hidden" onClick={() => go('distractor-assassin')}
                style={{ background: 'linear-gradient(135deg, #9F1239, #6B0F2A)', border: 'none', boxShadow: '0 6px 18px rgba(107,15,42,0.3)' }}>
            <span className="absolute top-2 right-2 z-10"><FavHeart favId="distractor-assassin" inline /></span>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <Crosshair size={22} color="#FFF" />
              </div>
              <div className="min-w-0 flex-1" style={{ color: '#FFF' }}>
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-semibold">Distractor Assassin</div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }}>New</span>
                </div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Eliminate the wrong · earn coins</div>
              </div>
              <ChevronRight size={20} color="rgba(255,255,255,0.8)" />
            </div>
          </Card>
          </Tip>
        </Reveal>

        {/* Tie-Breaker — priority reasoning drill (NEW) */}
        <Reveal delay={160}>
          <Tip title="Tie-Breaker" text="Both options are right — pick the one that comes FIRST. Trains the prioritisation frameworks examiners love: ABC, Maslow, safety-first, acute-over-chronic.">
          <Card className="p-4 mb-3 relative overflow-hidden" onClick={() => go('tie-breaker')}
                style={{ background: 'linear-gradient(135deg, #4338CA, #312E81)', border: 'none', boxShadow: '0 6px 18px rgba(49,46,129,0.3)' }}>
            <span className="absolute top-2 right-2 z-10"><FavHeart favId="tie-breaker" inline /></span>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <Scale size={22} color="#FFF" />
              </div>
              <div className="min-w-0 flex-1" style={{ color: '#FFF' }}>
                <div className="flex items-center gap-2">
                  <div className="font-display text-base font-semibold">Tie-Breaker</div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }}>New</span>
                </div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Which comes first · earn coins</div>
              </div>
              <ChevronRight size={20} color="rgba(255,255,255,0.8)" />
            </div>
          </Card>
          </Tip>
        </Reveal>

        </div>{/* /sharp reasoning grid */}

        <SectionLabel delay={166}>Exam hall</SectionLabel>

        {/* items-stretch so PYQ and Advanced match height side-by-side (tablet+) */}
        <div className="md:grid md:grid-cols-2 md:gap-x-3 md:items-stretch">

        {/* Bottom tier — Previous Year Papers (bold, official) */}
        <Reveal delay={170}>
          <Tip title="Previous Year Papers" text="Official AIIMS NORCET papers — sit the full timed simulation, or open Read Mode for calm question-and-answer revision.">
          <Card className="p-4 mb-3 relative h-full" onClick={() => go('previous-papers')}
                style={{ background: T.sec.revision, border: 'none', boxShadow: '0 6px 18px rgba(0,0,0,0.18)' }}>
            <span className="absolute top-2 right-2"><FavHeart favId="previous-papers" inline /></span>
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
            {/* tablet/desktop supporting line — balances the height against the
                Advanced Test card beside it (mobile is unchanged). */}
            <div className="text-[11px] mt-3 pt-3 leading-relaxed hidden md:block"
                 style={{ color: 'rgba(255,255,255,0.7)', borderTop: '1px solid rgba(255,255,255,0.18)' }}>
              Sit the full timed paper, or open Read Mode for calm question-and-answer revision.
            </div>
          </Card>
          </Tip>
        </Reveal>

        {/* Bottom tier — Advanced Test (the final boss: darkest + most elevated) */}
        <Reveal delay={210}>
          <Tip title="Advanced Test" text="The full exam-hall experience: countdown clock, negative marking and a question palette to jump around — scores feed your best-net history.">
          <Card className="p-5 relative h-full" onClick={() => go('advanced-setup')}
                style={{
                  background: `linear-gradient(135deg, ${T.sec.advanced} 55%, rgba(0,0,0,0.22))`,
                  border: 'none',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.30)',
                }}>
            <span className="absolute top-2 right-2"><FavHeart favId="advanced-setup" inline /></span>
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

        </div>{/* /exam hall grid */}

        {/* Drill Packs — import/manage extra content for the interactive drills */}
        <Reveal delay={230}>
          <button onClick={() => go('drill-packs')}
                  className="no-tap-highlight w-full flex items-center gap-2.5 mt-5 px-3 py-2.5 rounded-xl active:scale-[0.99] transition"
                  style={{ background: T.surfaceWarm, border: `1px dashed ${T.border}` }}>
            <Package size={15} style={{ color: T.muted }} />
            <span className="text-[12.5px] font-medium" style={{ color: T.inkSoft }}>Drill Packs — import &amp; manage extra content</span>
            <ChevronRight size={16} style={{ color: T.muted }} className="ml-auto" />
          </button>
        </Reveal>

      </PageContainer>
    </div>
  );
}

export default DrillTests;
