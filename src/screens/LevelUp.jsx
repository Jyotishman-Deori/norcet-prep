// =====================================================================
// src/screens/LevelUp.jsx — the Level Up hub.
// Groups the gamified clinical drills + the Knowledge Map under one shared
// progression spine: a level RING (tier accent), prestige title, XP-to-next
// bar, streak fire and coins. Tapping a game routes to its existing screen;
// completing one awards XP via App.handleGameComplete (lib/levelup.js).
// Reads progression from data.levelup, coins from data.economy, streak from
// data.stats — all in the synced blob. [A7] theme via useTheme().
// =====================================================================
import React from 'react';
import {
  Activity, Badge, ChevronRight, ClipboardList, Coins, Crosshair, Crown, Flame,
  ListOrdered, Network, Recycle, Scale, ScanSearch, Stethoscope, Syringe, Sparkles,
} from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import { Tip } from '../ui/tooltip.jsx';
import { normalizeEconomy } from '../lib/economy.js';
import { progress, tierFor, nextTier, normalizeLevelup, MAX_LEVEL } from '../lib/levelup.js';

const TIER_ICONS = {
  badge: Badge, clipboard: ClipboardList, stethoscope: Stethoscope,
  activity: Activity, flame: Flame, crown: Crown,
};

// The gamified drills that live under Level Up. `screen` matches the nav route
// (and the favourites registry id). Gradients mirror each game's own card.
const GAMES = [
  { screen: 'skill-setup',         label: 'Clinical Skill Drill', sub: 'Order the steps',      icon: ListOrdered, grad: ['#0E7490', '#0B5563'] },
  { screen: 'icu-monitor',         label: 'ICU Monitor',          sub: 'Read the rhythm',      icon: Activity,    grad: ['#065F46', '#06281E'] },
  { screen: 'crash-cart',          label: 'Crash Cart',           sub: 'Pick the right drug',  icon: Syringe,     grad: ['#B91C1C', '#7F1D1D'] },
  { screen: 'sorter',              label: 'The Sorter',           sub: 'Waste & isolation',    icon: Recycle,     grad: ['#15803D', '#0B5132'] },
  { screen: 'ibq',                 label: 'Spot the Structure',   sub: 'Tap it on the diagram',icon: ScanSearch,  grad: ['#0891B2', '#0B4F66'] },
  { screen: 'distractor-assassin', label: 'Distractor Assassin',  sub: 'Eliminate the wrong',  icon: Crosshair,   grad: ['#9F1239', '#6B0F2A'] },
  { screen: 'tie-breaker',         label: 'Tie-Breaker',          sub: 'Which comes first',    icon: Scale,       grad: ['#4338CA', '#312E81'] },
];

// Circular XP ring. Pure SVG (zero-asset), animates the sweep on mount.
function LevelRing({ level, pct, accent, track }) {
  const R = 56, C = 2 * Math.PI * R;
  const offset = C * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div className="relative flex-shrink-0" style={{ width: 144, height: 144 }}>
      <svg width="144" height="144" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={R} fill="none" stroke={track} strokeWidth="11" />
        <circle cx="72" cy="72" r={R} fill="none" stroke={accent} strokeWidth="11" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={offset}
                transform="rotate(-90 72 72)"
                style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,0.61,0.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: accent }}>Level</div>
        <div className="font-display font-semibold leading-none" style={{ color: '#FFF', fontSize: 44 }}>{level}</div>
      </div>
    </div>
  );
}

function LevelUp({ onBack, onNavigate }) {
  const { theme: T } = useTheme();
  const { data } = useData();

  const lu = normalizeLevelup(data && data.levelup);
  const econ = normalizeEconomy(data && data.economy);
  const prog = progress(lu.xp);
  const tier = tierFor(prog.level);
  const next = nextTier(prog.level);
  const TierIcon = TIER_ICONS[tier.icon] || Badge;
  const streak = (data && data.stats && data.stats.streakCurrent) || 0;
  const atMax = prog.level >= MAX_LEVEL;

  return (
    <div className="anim-fadeup">
      <TopBar title="Level Up" onBack={onBack} feedback={{ screen: 'Level Up' }} solid />
      <PageContainer size="app" className="pt-2 pb-24">

        {/* HERO — level ring + tier identity on the tier's accent gradient */}
        <Card className="p-5 mb-4 relative overflow-hidden" style={{
          background: `linear-gradient(140deg, ${tier.accent} 0%, ${tier.accent}D9 45%, rgba(0,0,0,0.55) 130%)`,
          border: 'none', boxShadow: `0 10px 30px ${tier.accent}55`,
        }}>
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
               style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)' }} aria-hidden="true" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            <LevelRing level={prog.level} pct={prog.pct} accent="#FFFFFF" track="rgba(255,255,255,0.22)" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
                  <TierIcon size={15} color="#FFF" />
                </span>
                <span className="text-[11px] uppercase tracking-[0.16em] font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>{tier.title}</span>
              </div>
              <div className="font-display text-xl font-semibold mb-2" style={{ color: '#FFF' }}>{tier.blurb}</div>

              {/* XP to next level */}
              {atMax ? (
                <div className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  Maximum level reached — {prog.xp.toLocaleString()} XP. Legendary.
                </div>
              ) : (
                <>
                  <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.22)' }}>
                    <div className="h-full rounded-full" style={{ width: `${prog.pct}%`, background: '#FFF', transition: 'width 0.9s cubic-bezier(0.22,0.61,0.36,1)' }} />
                  </div>
                  <div className="text-[11.5px] font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {prog.into.toLocaleString()} / {prog.span.toLocaleString()} XP to Level {prog.level + 1}
                    {next && next.id !== tier.id && <span style={{ opacity: 0.8 }}> · next tier: {next.title}</span>}
                  </div>
                </>
              )}

              {/* streak + coins chips */}
              <div className="flex items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: 'rgba(255,255,255,0.18)', color: '#FFF' }}>
                  <Flame size={13} /> {streak} day{streak === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums"
                      style={{ background: 'rgba(255,255,255,0.18)', color: '#FFF' }}>
                  <Coins size={13} /> {econ.coins.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* How XP works — one quiet line, no jargon */}
        <div className="flex items-center gap-1.5 text-[12px] mb-4 px-1" style={{ color: T.muted }}>
          <Sparkles size={13} style={{ color: T.primary }} />
          Play any drill below to earn XP and level up. The harder the round, the more you earn.
        </div>

        {/* KNOWLEDGE MAP — the "world map" of Level Up, featured full-width */}
        <Tip title="Knowledge Map" text="Your whole syllabus as a constellation — topics light up as you discover, practise and master them.">
        <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable press-safe" onClick={() => onNavigate({ screen: 'knowledge-map' })}
              onContextMenu={(e) => e.preventDefault()}
              style={{ background: 'radial-gradient(120% 160% at 85% 0%, #1B2A4E 0%, #0A0E1C 55%, #070A14 100%)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 6px 18px rgba(7,10,20,0.40)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,210,122,0.14)', border: '1px solid rgba(255,210,122,0.35)' }}>
              <Network size={20} color="#FFD27A" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-base font-semibold mb-0.5" style={{ color: '#EAF0FF' }}>Knowledge Map</div>
              <div className="text-xs" style={{ color: 'rgba(234,240,255,0.62)' }}>Your syllabus as a living constellation</div>
            </div>
            <ChevronRight size={20} style={{ color: 'rgba(234,240,255,0.55)' }} className="flex-shrink-0" />
          </div>
        </Card>
        </Tip>

        {/* THE GAMES */}
        <div className="flex items-center gap-2 mt-1 mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.muted }}>Clinical games</span>
          <span className="flex-1 h-px" style={{ background: T.borderSoft }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {GAMES.map(g => {
            const Icon = g.icon;
            return (
              <Tip key={g.screen} title={g.label} text={`${g.sub} · earn XP and coins`}>
              <Card className="p-4 cursor-pointer no-tap-highlight pressable press-safe h-full" onClick={() => onNavigate({ screen: g.screen })}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ background: `linear-gradient(135deg, ${g.grad[0]}, ${g.grad[1]})`, border: 'none', boxShadow: `0 6px 18px ${g.grad[1]}4D` }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                    <Icon size={20} color="#FFF" />
                  </div>
                  <div className="min-w-0 flex-1" style={{ color: '#FFF' }}>
                    <div className="font-display text-base font-semibold leading-tight">{g.label}</div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>{g.sub}</div>
                  </div>
                  <ChevronRight size={18} color="rgba(255,255,255,0.8)" className="flex-shrink-0" />
                </div>
              </Card>
              </Tip>
            );
          })}
        </div>

      </PageContainer>
    </div>
  );
}

export default LevelUp;
