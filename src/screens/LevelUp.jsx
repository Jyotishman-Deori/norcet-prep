// =====================================================================
// src/screens/LevelUp.jsx — the Level Up hub.
// Groups the gamified clinical drills + the Knowledge Map under one shared
// progression spine: a level RING (tier accent), prestige title, XP-to-next
// bar, streak fire and coins. Tapping a game routes to its existing screen;
// completing one awards XP via App.handleGameComplete (lib/levelup.js).
// Reads progression from data.levelup, coins from data.economy, streak from
// data.stats — all in the synced blob. [A7] theme via useTheme().
// =====================================================================
import React, { useState, useEffect } from 'react';
import {
  Activity, Badge, Check, ChevronRight, ClipboardList, Coins, Crosshair, Crown, Flame, Gift,
  Droplets, ListOrdered, Network, Recycle, Ruler, Scale, ScanSearch, Siren, Stethoscope, Syringe, Sparkles, Target, Moon, HeartPulse,
} from 'lucide-react';
import { useTheme, useData, useProfile } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import { Tip } from '../ui/tooltip.jsx';
import FavHeart from '../ui/fav-heart.jsx';
import StreakFire, { STREAK_FIRE_MIN } from '../ui/streak-fire.jsx';
import CrateReveal from '../ui/crate-reveal.jsx';
import FramedAvatar from '../ui/framed-avatar.jsx';
import { frameDef, FRAME_IDS } from '../lib/cosmetics.js';
import { todayStr } from '../lib/utils.js';
import { normalizeEconomy } from '../lib/economy.js';
import { progress, tierFor, nextTier, normalizeLevelup, questState, MAX_LEVEL } from '../lib/levelup.js';
import TrendingBadge from '../ui/trending-badge.jsx';
import { recordInteraction, loadTrendStats } from '../lib/trending-store.js';
import { rankTrending } from '../lib/trending.js';

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
  { screen: 'three-am-chart',      label: 'The 3 AM Chart',       sub: 'Chill block puzzle',   icon: Moon,        grad: ['#B45309', '#78350F'] },
  { screen: 'shift-survival',      label: 'Shift Survival',       sub: 'High-stress mode',     icon: HeartPulse,  grad: ['#B91C1C', '#450A0A'] },
  // Clinical simulations — full multi-phase patient scenarios (group: 'sim'
  // renders under its own section header below the drills grid).
  { screen: 'ward-boss',           group: 'sim', label: 'Ward Boss',   sub: 'Stabilise the crashing patient', icon: Siren,    grad: ['#7F1D1D', '#450A0A'] },
  { screen: 'drip-zone',           group: 'sim', label: 'Drip Zone',   sub: 'Titrate into the window',        icon: Droplets, grad: ['#0369A1', '#0C3B5E'] },
  { screen: 'wave-hunter',         group: 'sim', label: 'Wave Hunter', sub: 'Measure the strip',              icon: Ruler,    grad: ['#065F46', '#06281E'] },
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

function LevelUp({ onBack, onNavigate, onClaimQuest, onOpenCrate, onEquipFrame, onBuyFrame }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { profile } = useProfile();
  const [crateOpen, setCrateOpen] = useState(false);
  const profileName = (profile && profile.displayName) || 'You';

  const lu = normalizeLevelup(data && data.levelup);
  const econ = normalizeEconomy(data && data.economy);
  const prog = progress(lu.xp);
  const tier = tierFor(prog.level);
  const next = nextTier(prog.level);
  const TierIcon = TIER_ICONS[tier.icon] || Badge;
  const streak = (data && data.stats && data.stats.streakCurrent) || 0;
  const atMax = prog.level >= MAX_LEVEL;
  const quests = questState(data && data.levelup, todayStr());

  // PERF — warm up the Knowledge Map chunk (the app's biggest lazy screen)
  // while the user browses this hub, its main door. Same import specifier as
  // App's React.lazy → same Vite chunk, fetched once, PWA-cached after.
  useEffect(() => {
    const load = () => { import('./knowledge-map.jsx').catch(() => {}); };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(load, { timeout: 2000 });
      return () => { try { cancelIdleCallback(id); } catch (_) {} };
    }
    const t = setTimeout(load, 800);
    return () => clearTimeout(t);
  }, []);

  // TRENDING — surface which games (incl. the Knowledge Map) are surging across
  // users. Counts come from the shared free-tier counters; scoring is pure.
  const [trendingIds, setTrendingIds] = useState(() => new Set());
  useEffect(() => {
    let alive = true;
    // Games are "completable" (opens→completes is the quality signal); the
    // Knowledge Map has no completion, so it's surge-only (quality neutral).
    const items = [
      ...GAMES.map(g => ({ id: g.screen, completable: true })),
      { id: 'knowledge-map', completable: false },
    ];
    loadTrendStats('game', items.map(i => i.id), 7)
      .then(stats => {
        if (!alive) return;
        const ranked = rankTrending(items, stats, { topN: 2 });
        setTrendingIds(new Set(ranked.filter(r => r.isTrending).map(r => r.id)));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Record this user's interaction (fire-and-forget), then open the screen.
  const open = (screen) => {
    const uid = profile && profile.uid;
    if (uid) recordInteraction('game', screen, uid);
    onNavigate({ screen });
  };

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
                  {streak >= STREAK_FIRE_MIN ? <StreakFire size={14} /> : <Flame size={13} />} {streak} day{streak === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums"
                      style={{ background: 'rgba(255,255,255,0.18)', color: '#FFF' }}>
                  <Coins size={13} /> {econ.coins.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Supply Crate — earned by clearing all 3 daily quests. Tap to open. */}
        {lu.crates > 0 && (
          <button onClick={() => setCrateOpen(true)}
                  className="no-tap-highlight w-full flex items-center gap-3 mb-4 p-4 rounded-2xl active:scale-[0.99] transition"
                  style={{ background: 'linear-gradient(135deg, #D97706, #92400E)', border: 'none', boxShadow: '0 8px 22px rgba(146,64,14,0.4)' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
              <Gift size={22} color="#FFF" />
            </div>
            <div className="min-w-0 flex-1 text-left" style={{ color: '#FFF' }}>
              <div className="font-display text-base font-semibold">{lu.crates} Supply Crate{lu.crates === 1 ? '' : 's'} ready</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Tap to open {'·'} earned from your daily quests</div>
            </div>
            <ChevronRight size={20} color="rgba(255,255,255,0.85)" className="flex-shrink-0" />
          </button>
        )}

        {/* How XP works — one quiet line, no jargon */}
        <div className="flex items-center gap-1.5 text-[12px] mb-4 px-1" style={{ color: T.muted }}>
          <Sparkles size={13} style={{ color: T.primary }} />
          Play any drill below to earn XP and level up. The harder the round, the more you earn.
        </div>

        {/* DAILY QUESTS — 3 a day, reset at local midnight. Bonus XP on claim. */}
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.muted }}>Daily quests</span>
          <span className="flex-1 h-px" style={{ background: T.borderSoft }} />
          <span className="text-[10px]" style={{ color: T.muted }}>resets at midnight</span>
        </div>
        <div className="space-y-2 mb-5">
          {quests.map(q => {
            const accent = q.claimed ? T.muted : q.done ? T.success : T.primary;
            return (
              <Card key={q.id} className="p-3 flex items-center gap-3" style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accent + '18', color: accent }}>
                  {q.claimed ? <Check size={16} /> : q.done ? <Gift size={16} /> : <Target size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-semibold" style={{ color: T.ink }}>{q.label}</div>
                    <div className="text-[11px] font-semibold tabular-nums flex-shrink-0" style={{ color: q.claimed ? T.muted : T.primary }}>+{q.xp} XP</div>
                  </div>
                  <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: T.borderSoft }}>
                    <div className="h-full rounded-full" style={{ width: `${q.pct}%`, background: accent, transition: 'width .5s ease' }} />
                  </div>
                  <div className="text-[10px] mt-1 tabular-nums" style={{ color: T.muted }}>{q.current} / {q.goal}{q.metric === 'xp' ? ' XP' : ' drills'}</div>
                </div>
                {q.done && !q.claimed && (
                  <button onClick={() => onClaimQuest && onClaimQuest(q.id)}
                          className="no-tap-highlight text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition flex-shrink-0"
                          style={{ background: T.success, color: '#FFF', boxShadow: `0 3px 10px ${T.success}55` }}>
                    Claim
                  </button>
                )}
                {q.claimed && (
                  <span className="text-[11px] font-semibold flex-shrink-0 inline-flex items-center gap-1" style={{ color: T.success }}>
                    <Check size={12} /> Claimed
                  </span>
                )}
              </Card>
            );
          })}
        </div>

        {/* KNOWLEDGE MAP — the "world map" of Level Up, featured full-width */}
        <Tip title="Knowledge Map" text="Your whole syllabus as a constellation — topics light up as you discover, practise and master them.">
        <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable press-safe" onClick={() => open('knowledge-map')}
              onContextMenu={(e) => e.preventDefault()}
              style={{ background: 'radial-gradient(120% 160% at 85% 0%, #1B2A4E 0%, #0A0E1C 55%, #070A14 100%)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 6px 18px rgba(7,10,20,0.40)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,210,122,0.14)', border: '1px solid rgba(255,210,122,0.35)' }}>
              <Network size={20} color="#FFD27A" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="font-display text-base font-semibold" style={{ color: '#EAF0FF' }}>Knowledge Map</div>
                {trendingIds.has('knowledge-map') && <TrendingBadge />}
              </div>
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
          {GAMES.filter(g => !g.group).map(g => {
            const Icon = g.icon;
            return (
              <Tip key={g.screen} title={g.label} text={`${g.sub} · earn XP and coins`}>
              <Card className="p-4 cursor-pointer no-tap-highlight pressable press-safe h-full" onClick={() => open(g.screen)}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ background: `linear-gradient(135deg, ${g.grad[0]}, ${g.grad[1]})`, border: 'none', boxShadow: `0 6px 18px ${g.grad[1]}4D` }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                    <Icon size={20} color="#FFF" />
                  </div>
                  <div className="min-w-0 flex-1" style={{ color: '#FFF' }}>
                    <div className="flex items-center gap-1.5">
                      <div className="font-display text-base font-semibold leading-tight">{g.label}</div>
                      {trendingIds.has(g.screen) && <TrendingBadge />}
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>{g.sub}</div>
                  </div>
                  {/* heart + chevron grouped at the right, vertically centred */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <FavHeart favId={g.screen} inline emptyColor="rgba(255,255,255,0.82)" />
                    <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
                  </div>
                </div>
              </Card>
              </Tip>
            );
          })}
        </div>

        {/* CLINICAL SIMULATIONS — full multi-phase patient scenarios (Ward
            Boss and friends). Same card language, own section so the deeper
            sims read as a step up from the quick drills above. */}
        <div className="flex items-center gap-2 mt-6 mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.muted }}>Clinical simulations</span>
          <span className="flex-1 h-px" style={{ background: T.borderSoft }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {GAMES.filter(g => g.group === 'sim').map(g => {
            const Icon = g.icon;
            return (
              <Tip key={g.screen} title={g.label} text={`${g.sub} · earn XP and coins`}>
              <Card className="p-4 cursor-pointer no-tap-highlight pressable press-safe h-full" onClick={() => open(g.screen)}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ background: `linear-gradient(135deg, ${g.grad[0]}, ${g.grad[1]})`, border: 'none', boxShadow: `0 6px 18px ${g.grad[1]}4D` }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                    <Icon size={20} color="#FFF" />
                  </div>
                  <div className="min-w-0 flex-1" style={{ color: '#FFF' }}>
                    <div className="flex items-center gap-1.5">
                      <div className="font-display text-base font-semibold leading-tight">{g.label}</div>
                      {trendingIds.has(g.screen) && <TrendingBadge />}
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>{g.sub}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <FavHeart favId={g.screen} inline emptyColor="rgba(255,255,255,0.82)" />
                    <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
                  </div>
                </div>
              </Card>
              </Tip>
            );
          })}
        </div>

        {/* PROFILE FRAMES — collection + shop. Equip what you own; buy locked
            frames with Coins (or win them free from Supply Crates). */}
        <div className="flex items-center gap-2 mt-6 mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: T.muted }}>Profile frames</span>
          <span className="flex-1 h-px" style={{ background: T.borderSoft }} />
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums" style={{ color: T.muted }}>
            <Coins size={12} /> {econ.coins.toLocaleString()}
          </span>
        </div>
        <Card className="p-4 mb-2" style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}>
          <div className="flex items-center gap-3 mb-4">
            <FramedAvatar initial={profileName} frame={lu.frame} size={52} bg={T.primary + '22'} fg={T.primary} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate" style={{ color: T.ink }}>{profileName}</div>
              <div className="text-[11px]" style={{ color: T.muted }}>
                {frameDef(lu.frame).id === 'none' ? 'No frame equipped' : `${frameDef(lu.frame).name} equipped`}
                {' · '}{lu.cosmetics.length}/{FRAME_IDS.length} unlocked
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['none', ...FRAME_IDS].map(fid => {
              const f = frameDef(fid);
              const owned = fid === 'none' || lu.cosmetics.includes(fid);
              const equipped = lu.frame === fid;
              const price = f.price || 0;
              const afford = econ.coins >= price;
              return (
                <div key={fid} className="rounded-xl p-2.5 flex flex-col items-center text-center"
                     style={{ background: T.surfaceWarm, border: `1.5px solid ${equipped ? T.primary : T.borderSoft}` }}>
                  <FramedAvatar initial={profileName} frame={fid} size={40} bg={T.surface} fg={T.inkSoft} />
                  <div className="text-[11px] font-semibold mt-1.5 truncate w-full" style={{ color: T.ink }}>{f.name}</div>
                  {owned ? (
                    equipped ? (
                      <div className="text-[10px] font-bold mt-1 inline-flex items-center gap-0.5" style={{ color: T.primary }}><Check size={10} /> Equipped</div>
                    ) : (
                      <button onClick={() => onEquipFrame && onEquipFrame(fid)}
                              className="no-tap-highlight text-[10px] font-bold mt-1 px-2.5 py-1 rounded-md active:scale-95 transition"
                              style={{ background: T.primary + '18', color: T.primary }}>Equip</button>
                    )
                  ) : (
                    <button onClick={() => afford && onBuyFrame && onBuyFrame(fid)} disabled={!afford}
                            className="no-tap-highlight text-[10px] font-bold mt-1 px-2 py-1 rounded-md active:scale-95 transition inline-flex items-center gap-0.5 disabled:opacity-50"
                            style={afford ? { background: T.success, color: '#FFF' } : { background: T.surface, color: T.muted, border: `1px solid ${T.border}` }}>
                      <Coins size={10} /> {price.toLocaleString()}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

      </PageContainer>

      {crateOpen && <CrateReveal onOpen={onOpenCrate} onClose={() => setCrateOpen(false)} />}
    </div>
  );
}

export default LevelUp;
