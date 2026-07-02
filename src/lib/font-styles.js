// [A1 slice 42] Shared global stylesheet (fonts + animations + theme-token
// utilities + scrollbars). Extracted VERBATIM from App.jsx so both the App
// root and the now-extracted AuthScreen can mount <style>{fontStyles}</style>
// without duplicating the literal. No logic — a single template-string const.
export const fontStyles = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=DM+Sans:wght@400;500;600;700&display=swap');
.font-display { font-family: 'Fraunces', Georgia, serif; font-feature-settings: 'ss01'; letter-spacing: -0.01em; }
.font-body { font-family: 'DM Sans', system-ui, sans-serif; }
.no-tap-highlight { -webkit-tap-highlight-color: transparent; }
/* IMPORTANT — the \`to\` keyframes end in \`transform: none\` (NOT translateY(0)/
   scale(1)). With fill-mode:both, a retained identity transform makes the
   screen root a CONTAINING BLOCK for position:fixed descendants on
   spec-compliant browsers — fixed modals/top bars then anchor to the page
   instead of the viewport (the "dialog appears at the scroll position" and
   "top bar scrolls away" bugs). \`none\` releases the containing block the
   moment the entrance finishes. */
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.anim-fadeup { animation: fadeUp 0.35s ease-out both; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }
.anim-scalein { animation: scaleIn 0.25s ease-out both; }
/* #15 — Drill Tests premium opening: each mode card flips up around its top
   edge with a slight 3D tilt and settles. Staggered (see drill-tests.jsx) so
   the grid assembles top→bottom in ~500ms. Ends at transform:none. */
@keyframes drillCardIn {
  from { opacity: 0; transform: perspective(720px) rotateX(15deg) translateY(15px) scale(0.97); }
  60%  { opacity: 1; }
  to   { opacity: 1; transform: none; }
}
.drill-card-in { animation: drillCardIn 0.42s cubic-bezier(0.22, 1, 0.36, 1) both; transform-origin: top center; }
/* #23 — pre-test interstitial: the first question scales up from 0.96 as the
   test screen mounts, so launching a test feels like stepping into it. Plays
   once on entry (the root mounts once); question-to-question changes don't
   remount it. Ends at transform:none. */
@keyframes testEnter { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }
.test-enter { animation: testEnter 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
/* Session 0 — branded loading splash: three staggered bouncing dots. */
@keyframes loadingDot {
  0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
  40%           { opacity: 1;   transform: translateY(-4px); }
}
.loading-dot { display: inline-block; animation: loadingDot 1.4s ease-in-out infinite; }
.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }
/* Fix 5 — these MUST settle at transform:none, not translateX(0). With
   animation-fill-mode:both, a final translateX(0) (any non-none transform)
   keeps the element a containing block for position:fixed descendants — which
   re-anchors any modal/dialog rendered inside a slide-animated screen to that
   screen instead of the viewport, throwing its centring off. none rests
   identically but releases the containing block. */
@keyframes slideInRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }
@keyframes slideInLeft { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: none; } }
.anim-slide-next { animation: slideInRight 0.3s cubic-bezier(0.22,1,0.36,1) both; }
.anim-slide-prev { animation: slideInLeft 0.3s cubic-bezier(0.22,1,0.36,1) both; }

/* ── Theme-token utilities (A8) ─────────────────────────────────────────────
   Backed by the --token CSS variables published on :root from the active theme
   (see the themeMode handling in App). Components can use these classNames
   instead of an inline style object reading T.surface / T.ink / etc., so they
   don't allocate a new style object every render. All five themes resolve
   through the same vars, so a single class is correct in every theme. Inline
   styles are still used for genuinely dynamic values (computed colours, widths,
   transforms) and for section-accent tints mixed with alpha at the call site. */
.bg-app          { background-color: var(--bg); }
.bg-surface      { background-color: var(--surface); }
.bg-surface-warm { background-color: var(--surface-warm); }
.bg-primary      { background-color: var(--primary); }
.bg-success-soft { background-color: var(--success-soft); }
.bg-error-soft   { background-color: var(--error-soft); }
.text-ink        { color: var(--ink); }
.text-ink-soft   { color: var(--ink-soft); }
.text-muted      { color: var(--muted); }
.text-primary    { color: var(--primary); }
.text-accent     { color: var(--accent); }
.text-success    { color: var(--success); }
.text-error      { color: var(--error); }
.text-on-primary { color: #FFFFFF; }
.border-app      { border: 1px solid var(--border); }
.border-app-soft { border: 1px solid var(--border-soft); }
.bd-app          { border-color: var(--border); }
.bd-app-soft     { border-color: var(--border-soft); }
/* Common composite: a standard surface card face. Matches the original Card
   primitive exactly (background + hairline border only; no color, so text
   inheritance is unchanged). */
.surface-card    { background-color: var(--surface); border: 1px solid var(--border); }

/* ── Theme transition — smooth crossfade when switching colour themes ───────
   Scoped to properties that change between themes. Deliberately excludes
   transform (would fight the active-press scale) and opacity/animation
   (would slow down existing enter animations and the quiz timer). */
*:not([class*="anim-"]):not([class*="animate-"]) {
  transition-property: background-color, border-color, color, box-shadow;
  transition-duration: 180ms;
  transition-timing-function: ease;
}
/* Override: elements that must stay instant (timer digits, progress fills) */
.no-transition, .no-transition * { transition: none !important; }

/* ── Tap / press feedback — cards feel physically pressed ───────────────────
   Applied via the .pressable class. The scale snaps back on release via the
   short duration; the timing-function gives a springy feel. */
.pressable { transition: transform 120ms cubic-bezier(0.34,1.56,0.64,1) !important; }
.pressable:active { transform: scale(0.975) !important; }

/* ── Skeleton shimmer for loading states ────────────────────────────────────*/
@keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
.skeleton-pulse { animation: skeletonPulse 1.4s ease-in-out infinite; }
/* P10 Phase B — mindmap dependency-edge pulse + bonus-node reveal. */
@keyframes kmapEdgePulse { 0%, 100% { stroke-opacity: 0.35; } 50% { stroke-opacity: 0.95; } }
.kmap-edge-pulse { animation: kmapEdgePulse 1.6s ease-in-out infinite; }
@keyframes kmapBonusReveal { 0% { opacity: 0; transform: scale(0.7); } 60% { opacity: 1; transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
.kmap-bonus-reveal { animation: kmapBonusReveal 0.9s cubic-bezier(0.22,1,0.36,1) both; transform-box: fill-box; transform-origin: center; }
@keyframes kmapBonusPulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.6; } }
.kmap-bonus-pulse { animation: kmapBonusPulse 1.8s ease-in-out infinite; }
/* P11 Feature B (step 31) — animated unlock moments for subject/sub state
   upgrades after a quiz. All hand-built SVG + CSS (NOT react-flow). Each
   element sets transform-box: fill-box so transform-origin: center stays local
   (scale/translate happen around the element, like kmapBonusReveal above). */
@keyframes kmapCelebPop { 0% { opacity: 0; transform: scale(0.55); } 55% { opacity: 1; transform: scale(1.12); } 100% { opacity: 0; transform: scale(1); } }
.kmap-celeb-pop { animation: kmapCelebPop 0.6s ease-out both; transform-box: fill-box; transform-origin: center; }
@keyframes kmapCelebBounce { 0% { transform: scale(1); opacity: 0.9; } 30% { transform: scale(1.2); } 60% { transform: scale(0.96); } 100% { transform: scale(1); opacity: 0; } }
.kmap-celeb-bounce { animation: kmapCelebBounce 0.7s cubic-bezier(0.34,1.56,0.64,1) both; transform-box: fill-box; transform-origin: center; }
@keyframes kmapCelebSatPulse { 0% { opacity: 0; transform: scale(0.9); } 35% { opacity: 0.85; transform: scale(1.15); } 100% { opacity: 0; transform: scale(1.25); } }
.kmap-celeb-satpulse { animation: kmapCelebSatPulse 0.5s ease-out both; transform-box: fill-box; transform-origin: center; }
@keyframes kmapCelebGlow { 0% { opacity: var(--glow-from, 0.4); transform: scale(0.6); } 100% { opacity: 0; transform: scale(1.6); } }
.kmap-celeb-glow { animation: kmapCelebGlow 1.5s ease-out both; transform-box: fill-box; transform-origin: center; }
@keyframes kmapCelebParticle { 0% { opacity: 0.95; transform: translate(0px,0px) scale(1); } 100% { opacity: 0; transform: translate(var(--tx,0px), var(--ty,0px)) scale(0.4); } }
.kmap-celeb-particle { animation-name: kmapCelebParticle; animation-timing-function: cubic-bezier(0.22,1,0.36,1); animation-fill-mode: both; transform-box: fill-box; transform-origin: center; }
@keyframes kmapCelebCheck { 0% { opacity: 0; transform: scale(0); } 60% { opacity: 1; transform: scale(1.25); } 100% { opacity: 1; transform: scale(1); } }
.kmap-celeb-check { animation: kmapCelebCheck 0.45s cubic-bezier(0.34,1.56,0.64,1) both; transform-box: fill-box; transform-origin: center; }
@keyframes kmapCelebSparkle { 0% { opacity: 0; transform: scale(0.4) rotate(-18deg); } 40% { opacity: 1; transform: scale(1.1) rotate(8deg); } 100% { opacity: 0; transform: scale(0.9) rotate(0deg); } }
.kmap-celeb-sparkle { animation: kmapCelebSparkle 0.9s ease-out both; transform-box: fill-box; transform-origin: center; }
/* Belt-and-braces: the component also skips celebrations entirely when reduced
   motion is requested, but neutralise the classes here too. */
@media (prefers-reduced-motion: reduce) {
  .kmap-celeb-pop, .kmap-celeb-bounce, .kmap-celeb-satpulse, .kmap-celeb-glow,
  .kmap-celeb-particle, .kmap-celeb-check, .kmap-celeb-sparkle { animation: none !important; }
}

/* #13 Constellation overhaul — ambient/state animations on the dark star map.
   All keyed on transform-box: fill-box so SVG transforms stay node-local. */
@keyframes kmapPulseSlow { 0%, 100% { opacity: 0.22; transform: scale(1); } 50% { opacity: 0.42; transform: scale(1.12); } }
.kmap-pulse-slow { animation: kmapPulseSlow 3.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes kmapPulseWarm { 0%, 100% { opacity: 0.34; transform: scale(1); } 50% { opacity: 0.58; transform: scale(1.16); } }
.kmap-pulse-warm { animation: kmapPulseWarm 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes kmapRadiance { 0%, 100% { opacity: 0.40; transform: scale(1); } 50% { opacity: 0.72; transform: scale(1.22); } }
.kmap-radiance { animation: kmapRadiance 2.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes kmapSunGlow { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.08); } }
.kmap-sun-glow { animation: kmapSunGlow 4.5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
/* Fog-of-war: locked node adjacent to discovered/familiar territory — a faint
   shimmer that says "you're close". */
@keyframes kmapFogShimmer { 0%, 100% { opacity: 0.12; } 50% { opacity: 0.34; } }
.kmap-fog-shimmer { animation: kmapFogShimmer 2.4s ease-in-out infinite; }
@keyframes kmapFogShimmerStrong { 0%, 100% { opacity: 0.18; } 50% { opacity: 0.5; } }
.kmap-fog-shimmer-strong { animation: kmapFogShimmerStrong 1.7s ease-in-out infinite; }
/* Mastered node atmosphere — a tiny orbiting-particle group rotates slowly. */
@keyframes kmapOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.kmap-orbit { animation: kmapOrbit 9s linear infinite; transform-box: fill-box; transform-origin: center; }
/* Flag-planting reward — "Mastered" floats up from the node and fades. */
@keyframes kmapFloatUp { 0% { opacity: 0; transform: translateY(6px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px); } }
.kmap-float-up { animation: kmapFloatUp 1.4s ease-out both; transform-box: fill-box; transform-origin: center; }

/* Welcome tour (F-C refresh) — subtle micro-interactions. */
@keyframes welcomeFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
.welcome-float { animation: welcomeFloat 3.2s ease-in-out infinite; }
@keyframes welcomePop { 0% { transform: scale(0); } 65% { transform: scale(1.25); } 100% { transform: scale(1); } }
.welcome-pop { animation: welcomePop 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
@keyframes welcomeRow { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
.welcome-row { animation: welcomeRow 0.4s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .welcome-float, .welcome-pop, .welcome-row { animation: none !important; }
}

/* Leaderboard (UX pass) — staggered rows, rising podium, medal shimmer, "you" glow. */
@keyframes lbRow { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
.lb-row { animation: lbRow 0.42s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes lbRise { 0% { opacity: 0; transform: translateY(18px) scale(0.92); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
.lb-rise { animation: lbRise 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
@keyframes lbShimmer { 0% { background-position: -120% 0; } 100% { background-position: 220% 0; } }
.lb-medal-shimmer { background-image: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%); background-size: 220% 100%; animation: lbShimmer 2.6s ease-in-out infinite; }
@keyframes lbYouGlow { 0%, 100% { box-shadow: 0 0 0 0 var(--lb-glow, rgba(0,0,0,0)); } 50% { box-shadow: 0 0 0 3px var(--lb-glow, rgba(0,0,0,0)); } }
.lb-you-glow { animation: lbYouGlow 2.4s ease-in-out infinite; }
@keyframes lbPop { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
.lb-pop { animation: lbPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
@media (prefers-reduced-motion: reduce) {
  .lb-row, .lb-rise, .lb-medal-shimmer, .lb-you-glow, .lb-pop { animation: none !important; }
}
/* First-time cinematic intro text + HUD bottom-sheet spring-up. */
@keyframes kmapIntroText { 0% { opacity: 0; transform: translateY(8px); } 25% { opacity: 1; transform: translateY(0); } 75% { opacity: 1; } 100% { opacity: 0; transform: translateY(-6px); } }
.kmap-intro-text { animation: kmapIntroText 3s ease-in-out both; }
@keyframes kmapSheetUp { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
.kmap-sheet-up { animation: kmapSheetUp 0.34s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes kmapScrimIn { from { opacity: 0; } to { opacity: 1; } }
.kmap-scrim-in { animation: kmapScrimIn 0.25s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .kmap-pulse-slow, .kmap-pulse-warm, .kmap-radiance, .kmap-sun-glow,
  .kmap-fog-shimmer, .kmap-fog-shimmer-strong, .kmap-orbit, .kmap-float-up { animation: none !important; }
  .kmap-sheet-up { animation: none !important; }
}

/* Custom scrollbars — subtle, rounded, and theme-aware. The thumb colour is
   driven by --sb-thumb / --sb-thumb-hover, set on :root from the theme (see the
   themeMode effect in App), so the harsh default white bar never shows in dark
   mode. Inline scrollbarWidth:'none' on horizontal chip rows still overrides
   this and stays hidden. */
* { scrollbar-width: thin; scrollbar-color: var(--sb-thumb, rgba(120,120,120,0.4)) transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--sb-thumb, rgba(120,120,120,0.4)); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background: var(--sb-thumb-hover, rgba(120,120,120,0.6)); background-clip: padding-box; }
::-webkit-scrollbar-corner { background: transparent; }

/* ── Round: #22 Sequential card entrance — apply .seq-item + inline
   animationDelay (index * 110ms, capped). Fade + 16px settle, spring-out. */
@keyframes seqItem { 0% { opacity: 0; transform: translateY(16px) scale(0.97); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
.seq-item { animation: seqItem 0.35s cubic-bezier(0.22,1,0.36,1) both; }

/* ── #23/4 Quiz answer feedback — wrong option shakes (decaying amplitude),
   correct option pulses with a small spring. Applied on lock-in only. */
@keyframes qShake {
  0%, 100% { transform: translateX(0); }
  12% { transform: translateX(-7px); } 25% { transform: translateX(7px); }
  40% { transform: translateX(-5px); } 55% { transform: translateX(5px); }
  70% { transform: translateX(-3px); } 85% { transform: translateX(3px); }
}
.q-shake { animation: qShake 0.45s cubic-bezier(0.36,0.07,0.19,0.97) both; }
@keyframes qPulse { 0% { transform: scale(1); } 45% { transform: scale(1.035); } 100% { transform: scale(1); } }
.q-pulse { animation: qPulse 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }

/* Quiz primary button morph: neutral "Submit" -> graded "Check answer".
   The label crossfades up on each state change; the button gives a single
   spring "pop" the moment it fills into the ready state. Premium, low-key. */
@keyframes qbtnLabelIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
.qbtn-label { animation: qbtnLabelIn 0.26s cubic-bezier(0.34,1.56,0.64,1) both; }
@keyframes qbtnReadyPop { 0% { transform: scale(1); } 42% { transform: scale(1.035); } 100% { transform: scale(1); } }
.qbtn-ready { animation: qbtnReadyPop 0.34s cubic-bezier(0.34,1.56,0.64,1); }

/* ── #23/3 Bookmark / flag micro-interaction — spring pop on set,
   deflate on unset. Applied to the icon button per toggle direction. */
@keyframes bmPop { 0% { transform: scale(1); } 45% { transform: scale(1.3); } 100% { transform: scale(1); } }
.bm-pop { animation: bmPop 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
@keyframes bmDeflate { 0% { transform: scale(1); } 45% { transform: scale(0.8); } 100% { transform: scale(1); } }
.bm-deflate { animation: bmDeflate 0.25s ease-in-out both; }

/* ── #19 Unbookmark — row fade-out + collapse before removal from the list. */
@keyframes rowFadeOut { 0% { opacity: 1; transform: translateX(0); } 100% { opacity: 0; transform: translateX(24px); } }
.row-fade-out { animation: rowFadeOut 0.28s ease-in both; }

/* ── #23/26 Timer heartbeat — final-10s pulse on the quiz countdown chip. */
@keyframes timerBeat { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
.timer-beat { animation: timerBeat 1s ease-in-out infinite; }
.timer-beat-fast { animation: timerBeat 0.5s ease-in-out infinite; }

/* ── #30 Exit confirmation snackbar — slide-up pill + depleting progress line. */
@keyframes exitSnackIn { 0% { opacity: 0; transform: translate(-50%, 60px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
.exit-snack-in { animation: exitSnackIn 0.28s cubic-bezier(0.22,1,0.36,1) both; }
@keyframes exitSnackBar { from { width: 100%; } to { width: 0%; } }
.exit-snack-bar { animation: exitSnackBar 2.5s linear both; }

/* ── #26 Library upload-card shimmer — one diagonal light sweep on entry. */
@keyframes cardShimmer { 0% { transform: translateX(-130%) skewX(-15deg); } 100% { transform: translateX(330%) skewX(-15deg); } }
.card-shimmer { animation: cardShimmer 0.7s ease-in-out 0.35s both; }

/* ── #26 Bank delete card — destructive colour appears on PRESS only. */
.bank-delete-card:active { border-color: var(--error, #C04A2E) !important; }
.bank-delete-card:active svg { color: var(--error, #C04A2E) !important; }
.bank-delete-card:active .font-display { color: var(--error, #C04A2E) !important; }

/* ── #31 Profile sheets — bottom-sheet spring-up (reuses kmap timing, lighter). */
@keyframes sheetUp { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
.sheet-up { animation: sheetUp 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }

/* ── AI Learning Notes — NamingView entrance: staggered warm fade-up for the
   icon, headline, and body copy so the first-run moment feels considered and
   personal, not instant. Each element settles from a small Y offset with a
   spring curve; delays are baked into the class so JSX stays clean.
   transform:none endings avoid the containing-block side-effect (see fadeUp). */
@keyframes namingEnter {
  0%   { opacity: 0; transform: translateY(10px) scale(0.97); }
  100% { opacity: 1; transform: none; }
}
.naming-icon-enter     { animation: namingEnter 0.36s cubic-bezier(0.22,1,0.36,1) 0.04s both; }
.naming-headline-enter { animation: namingEnter 0.36s cubic-bezier(0.22,1,0.36,1) 0.10s both; }
.naming-body-enter     { animation: namingEnter 0.36s cubic-bezier(0.22,1,0.36,1) 0.17s both; }

/* ── AI Learning Notes — Store/Copy "morph to checkmark" confirmation. ─────
   note-pop: a two-phase spring — compress then overshoot — so the morph feels
   physically committed.
   note-confirm-glow: a simultaneous opacity-fade ring that widens outward from
   the button surface, communicating "action landed". Implemented as a
   box-shadow pulse layered in the same keyframe (no extra DOM node needed).
   Both run together via the .note-pop class; the glow is additive and
   invisible on buttons that already have a coloured box-shadow. */
@keyframes notePop {
  0%   { transform: scale(0.92); box-shadow: 0 0 0 0 rgba(255,255,255,0.0); }
  38%  { transform: scale(1.10); box-shadow: 0 0 0 5px rgba(255,255,255,0.18); }
  68%  { transform: scale(0.98); box-shadow: 0 0 0 8px rgba(255,255,255,0.06); }
  100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(255,255,255,0.0); }
}
.note-pop { animation: notePop 0.38s cubic-bezier(0.34,1.56,0.64,1) both; }
/* ── AI Learning Notes FAB — resting pulse ring: a very subtle slow glow that
   draws the eye without being distracting. Suppressed during a drag (JS sets
   dragging class). Removed entirely when reduced-motion is preferred. */
@keyframes noteFabPulse {
  0%, 100% { box-shadow: 0 4px 18px rgba(0,0,0,0.22), 0 0 0 0 rgba(255,255,255,0.0); }
  50%       { box-shadow: 0 6px 22px rgba(0,0,0,0.28), 0 0 0 5px rgba(255,255,255,0.1); }
}
.note-fab-pulse { animation: noteFabPulse 3s ease-in-out infinite; }

/* ── AI Learning Notes — notebook micro-interactions (owner's premium spec). ──
   All spring on cubic-bezier(.34,1.56,.64,1). Each is opted out of below in the
   reduced-motion block; JS-driven motion is additionally gated by prefersReduced.

   note-press: a physical press-scale used on tappable rows/buttons where the
   Tailwind active:scale utility isn't enough (it fires on :active). */
.note-press { transition: transform 140ms cubic-bezier(0.34,1.56,0.64,1); }
.note-press:active { transform: scale(0.96); }
/* Notebook editor — hide the textarea scrollbar (scroll still works) so a
   classic desktop scrollbar can't shrink the wrap width relative to the
   BulletGutter mirror behind it. */
.note-ta-nosb { scrollbar-width: none; }
.note-ta-nosb::-webkit-scrollbar { display: none; }
/* mini-settings panel spring-expand from the top-right, like a menu unfurling. */
@keyframes noteMenuIn {
  0%   { opacity: 0; transform: translateY(-6px) scale(0.94); }
  100% { opacity: 1; transform: none; }
}
.note-menu-in { animation: noteMenuIn 0.24s cubic-bezier(0.34,1.56,0.64,1) both; transform-origin: top right; }
/* feedback row -> casual reply swap: the reply springs in as the survey leaves. */
@keyframes noteReplyIn {
  0%   { opacity: 0; transform: translateY(6px) scale(0.97); }
  100% { opacity: 1; transform: none; }
}
.note-reply-in { animation: noteReplyIn 0.34s cubic-bezier(0.34,1.56,0.64,1) both; }
/* selected-state confirm: a chip/button lands its "selected" fill with a spring. */
@keyframes noteSelectPop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.05); }
  100% { transform: scale(1); }
}
.note-select-pop { animation: noteSelectPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }
/* "Recommended" apply pulse: a single expanding ring the moment defaults apply. */
@keyframes noteRecoPulse {
  0%   { box-shadow: 0 0 0 0 var(--reco-glow, rgba(0,0,0,0.18)); }
  100% { box-shadow: 0 0 0 10px rgba(0,0,0,0); }
}
.note-reco-pulse { animation: noteRecoPulse 0.55s ease-out both; }
/* reverse-counter tick: a tiny spring bump each time the "N left" number changes. */
@keyframes noteCountTick {
  0%   { transform: scale(1); }
  45%  { transform: scale(1.22); }
  100% { transform: scale(1); }
}
.note-count-tick { animation: noteCountTick 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
/* bullet-appear: the gutter dot for a freshly-added line pops into view. */
@keyframes noteBulletIn {
  0%   { opacity: 0; transform: scale(0.2); }
  60%  { opacity: 1; transform: scale(1.25); }
  100% { opacity: 1; transform: scale(1); }
}
.note-bullet-in { animation: noteBulletIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }

/* ── FAV — Favourites strip header heart: a gentle double-beat every 3s. */
@keyframes favBeat {
  0%, 24%, 100% { transform: scale(1); }
  8% { transform: scale(1.22); } 16% { transform: scale(1.06); }
}
.fav-beat { animation: favBeat 3s ease-in-out infinite; transform-origin: center; }

/* ── TIP — hold/hover tooltip: spring scale-in from the arrow side. */
@keyframes tipIn { 0% { opacity: 0; transform: scale(0.82); } 100% { opacity: 1; transform: scale(1); } }
.tip-in { animation: tipIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both; }

/* ── DRAWER — premium row micro-interactions. Rows slide in from the left
   with a stagger every time the menu opens; the chevron nudges toward the
   destination on press; the last-visited row glows once on return. */
@keyframes drawerItemIn { 0% { opacity: 0; transform: translateX(-14px); } 100% { opacity: 1; transform: translateX(0); } }
.drawer-item-in { animation: drawerItemIn 0.3s cubic-bezier(0.22,1,0.36,1) both; }
.drawer-row { transition: transform 0.15s ease, box-shadow 0.15s ease; }
.drawer-row:active { transform: scale(0.975); }
.drawer-row .drawer-chev { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease; }
.drawer-row:active .drawer-chev { transform: translateX(3px); opacity: 1 !important; }
@keyframes drawerGlow {
  0% { box-shadow: 0 0 0 0 var(--row-glow, #888); }
  60% { box-shadow: 0 0 0 5px transparent; }
  100% { box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
}
.drawer-glow { animation: drawerItemIn 0.3s cubic-bezier(0.22,1,0.36,1) both, drawerGlow 1.1s ease-out 0.35s 2; }

/* ── FAV — honeycomb tiles: staggered pop-in, press spring, edit-mode
   jiggle (iOS-style), picked-tile lift, removal shrink-out. */
@keyframes favTileIn { 0% { opacity: 0; transform: scale(0.7) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
.fav-tile-in { animation: favTileIn 0.34s cubic-bezier(0.34,1.56,0.64,1) both; }
.fav-tile { transition: transform 0.16s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
.fav-tile:active { transform: scale(0.94); }
@keyframes favJiggle {
  0% { transform: rotate(-1.4deg); } 50% { transform: rotate(1.4deg); } 100% { transform: rotate(-1.4deg); }
}
.fav-jiggle { animation: favJiggle 0.32s ease-in-out infinite; }
.fav-picked { transform: scale(1.08) !important; z-index: 5; }
@keyframes favTileOut { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.6); } }
.fav-tile-out { animation: favTileOut 0.24s ease-in both; }

/* ── #6 — Home quote swap on pull-to-refresh: the fresh quote slides up
   into place with a soft blur-settle, like a card being dealt. */
@keyframes quoteSwap {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: none; }
}
.quote-swap { animation: quoteSwap 0.4s ease-out both; }

/* ── Sidebar launch — shared-axis forward transition. NavDrawer tags the
   <html> element with .nav-fwd for ~400ms when a row is tapped; the incoming
   screen's entrance becomes a rightward shared-axis slide+fade instead of
   the default fade-up. 280ms, smooth ease-in-out. */
@keyframes sharedAxisIn {
  0% { opacity: 0; transform: translateX(26px); }
  100% { opacity: 1; transform: none; }
}
.nav-fwd .anim-fadeup { animation: sharedAxisIn 0.28s cubic-bezier(0.4, 0, 0.2, 1) both; }

/* ── Premium favourite heart — restrained spring on fill: instant subtle
   compress (~0.85) → settle with a gentle overshoot (~1.08) → rest at 1.
   Unfavourite never bounces: the fill simply fades (CSS transitions on the
   SVG fill/stroke handle that). ~340ms total. */
@keyframes heartSpring {
  0% { transform: scale(1); }
  22% { transform: scale(0.85); }
  64% { transform: scale(1.08); }
  100% { transform: none; }
}
.heart-spring { animation: heartSpring 0.34s cubic-bezier(0.33, 1, 0.68, 1) both; }

/* ── PREMIUM — pricing/plans preview screen. Cards rise into place with a
   staggered spring (delay baked per-index at the call site), and the selected
   plan lands its filled state with a small confirming pop. All spring on
   cubic-bezier(.34,1.56,.64,1); opted out in the reduced-motion block below. */
@keyframes premiumCardIn {
  0%   { opacity: 0; transform: translateY(14px) scale(0.98); }
  100% { opacity: 1; transform: none; }
}
.premium-card-in { animation: premiumCardIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
@keyframes premiumSelectPop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.03); }
  100% { transform: scale(1); }
}
.premium-select-pop { animation: premiumSelectPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }

/* ── press-safe — suppresses the native long-press callout / text selection
   on touch cards (the tap-and-hold visual glitch on home cards). */
.press-safe, .press-safe * {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
/* manipulation = no double-tap-zoom / 300ms delay and, importantly, no native
   long-press magnifier/selection repaint — the GPU-compositing artifact that
   bled into the area above the home cards (issues #1/#2). Long-press still
   reaches our JS Tip handler; only the native gesture chrome is suppressed. */
.press-safe { touch-action: manipulation; }
/* #26 — hide the scrollbar on horizontal chip rows (exam filter) while keeping
   the row scrollable. */
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }

/* ── Dosage answer field — its placeholder must read as a HINT, never as a
   pre-filled value (the old placeholder="0" looked like an entered answer). */
.dosage-input::placeholder {
  font-size: 15px;
  font-weight: 400;
  font-family: inherit;
  opacity: 0.55;
  letter-spacing: 0;
}

/* ── WARD BOSS — flagship clinical-simulation game (ward-boss.jsx). Every
   class below is a decorative motion layer; all are opted out in the
   reduced-motion block. Spring curve = cubic-bezier(.34,1.56,.64,1). */
/* Staggered case-file card entrance in the scenario picker (delay baked per
   index at the call site). Rises + settles with a gentle overshoot. */
@keyframes wbCardIn { 0% { opacity: 0; transform: translateY(16px) scale(0.97); } 100% { opacity: 1; transform: none; } }
.wb-card-in { animation: wbCardIn 0.42s cubic-bezier(0.34,1.56,0.64,1) both; }
/* Patient-handoff brief card spring entrance. */
@keyframes wbBriefIn { 0% { opacity: 0; transform: translateY(22px) scale(0.94); } 100% { opacity: 1; transform: none; } }
.wb-brief-in { animation: wbBriefIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
/* Phase-transition banner sweep — the new phase label slides in from the left
   with an overshoot as the FSM advances. */
@keyframes wbBannerSweep { 0% { opacity: 0; transform: translateX(-18px); } 100% { opacity: 1; transform: none; } }
.wb-banner-sweep { animation: wbBannerSweep 0.44s cubic-bezier(0.34,1.56,0.64,1) both; }
/* Harm/neutral shake — a short horizontal wobble on a wrong tap. */
@keyframes wbShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
.wb-shake { animation: wbShake 0.4s ease-in-out both; }
/* Floating "+15" points chip — rises and fades on a key action. */
@keyframes wbPointFloat { 0% { opacity: 0; transform: translate(-50%, 6px) scale(0.8); } 20% { opacity: 1; transform: translate(-50%, -2px) scale(1.05); } 100% { opacity: 0; transform: translate(-50%, -34px) scale(1); } }
.wb-point-float { animation: wbPointFloat 1.15s cubic-bezier(0.34,1.56,0.64,1) forwards; }
/* Chart entry slide — the log note appears like a line being charted. */
@keyframes wbChartIn { 0% { opacity: 0; transform: translateY(-4px); max-height: 0; } 100% { opacity: 1; transform: none; max-height: 240px; } }
.wb-chart-in { animation: wbChartIn 0.4s ease-out both; }
/* Stability-bar damage flash — the bar pulses red when it takes a hit. */
@keyframes wbDamage { 0% { filter: brightness(1); } 30% { filter: brightness(1.9) saturate(1.4); } 100% { filter: brightness(1); } }
.wb-damage { animation: wbDamage 0.45s ease-out both; }
/* Chaos per-decision countdown bar — CSS shrink, restarted via key remount. */
@keyframes wbShrink { from { width: 100%; } to { width: 0%; } }
/* Soft-alarm banner — a slow amber pulse. */
@keyframes wbPulseSoft { 0%,100% { box-shadow: 0 0 0 1px rgba(245,158,11,0.4); } 50% { box-shadow: 0 0 0 1px rgba(245,158,11,0.8), 0 0 18px 1px rgba(245,158,11,0.35); } }
.wb-pulse-soft { animation: wbPulseSoft 2.2s ease-in-out infinite; }
/* Loud-alarm frame — a faster red pulse around the monitor. */
@keyframes wbPulseLoud { 0%,100% { box-shadow: 0 0 0 1px rgba(239,68,68,0.5), 0 0 0 0 rgba(239,68,68,0); } 50% { box-shadow: 0 0 0 2px rgba(239,68,68,0.95), 0 0 26px 3px rgba(239,68,68,0.5); } }
.wb-pulse-loud { animation: wbPulseLoud 1.1s ease-in-out infinite; }
/* Boss-entry flash — a single red vignette flash on entering the Final Boss. */
@keyframes wbBossFlash { 0% { opacity: 0; } 12% { opacity: 0.9; } 40% { opacity: 0.35; } 100% { opacity: 0; } }
.wb-boss-flash { animation: wbBossFlash 1.1s ease-out forwards; }
/* Boss sustained vignette — a slow ominous breathing red frame. */
@keyframes wbBossBreathe { 0%,100% { opacity: 0.5; } 50% { opacity: 0.9; } }
.wb-boss-breathe { animation: wbBossBreathe 2.4s ease-in-out infinite; }
/* Boss correct step — a heavy satisfying pop on the step counter. */
@keyframes wbStepPop { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 100% { transform: scale(1); } }
.wb-step-pop { animation: wbStepPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
/* Win celebration icon — a gentle triumphant bloom (not over the top). */
@keyframes wbWinBloom { 0% { opacity: 0; transform: scale(0.6); } 55% { transform: scale(1.12); } 100% { opacity: 1; transform: scale(1); } }
.wb-win-bloom { animation: wbWinBloom 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }

/* ── DRIP ZONE — closed-loop IV titration simulator (drip-zone.jsx). Every
   class below is a decorative motion layer; all are opted out in the
   reduced-motion block. Spring curve = cubic-bezier(.34,1.56,.64,1). The 500ms
   sim loop itself stays FUNCTIONAL under reduced motion (numbers still update /
   snap) — only these decorative layers are gated. */
/* Intro drug-teaser chip stagger (delay baked per index at the call site). */
@keyframes dzChipIn { 0% { opacity: 0; transform: translateY(10px) scale(0.9); } 100% { opacity: 1; transform: none; } }
.dz-chip-in { animation: dzChipIn 0.36s cubic-bezier(0.34,1.56,0.64,1) both; }
/* Round card spring entrance as each drug loads. */
@keyframes dzRoundIn { 0% { opacity: 0; transform: translateY(18px) scale(0.96); } 100% { opacity: 1; transform: none; } }
.dz-round-in { animation: dzRoundIn 0.44s cubic-bezier(0.34,1.56,0.64,1) both; }
/* Over-titration alarm — a fast red pulse around the monitor frame (klaxon). */
@keyframes dzAlarmPulse { 0%,100% { box-shadow: 0 0 0 1px rgba(239,68,68,0.55), 0 0 0 0 rgba(239,68,68,0); } 50% { box-shadow: 0 0 0 2px rgba(239,68,68,0.95), 0 0 26px 3px rgba(239,68,68,0.5); } }
.dz-alarm-pulse { animation: dzAlarmPulse 0.9s ease-in-out infinite; }
/* Falling drip inside the pump chamber — a droplet slides down and fades. The
   duration is set inline (faster rate = shorter interval) so the drip visibly
   speeds up with the pump rate. */
@keyframes dzDrip { 0% { opacity: 0; transform: translateY(-4px) scale(0.7); } 15% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0.15; transform: translateY(30px) scale(0.85); } }
.dz-drip { animation: dzDrip 1s linear infinite; }
/* A small ripple in the drip-chamber reservoir each time a drop lands. */
@keyframes dzRipple { 0% { transform: scaleX(0.6); opacity: 0.7; } 100% { transform: scaleX(1.3); opacity: 0; } }
.dz-ripple { animation: dzRipple 1s ease-out infinite; }
/* Pump mL/hr number tick — a tiny spring bump when the rate changes. */
@keyframes dzRateTick { 0% { transform: scale(1); } 42% { transform: scale(1.12); } 100% { transform: scale(1); } }
.dz-rate-tick { animation: dzRateTick 0.34s cubic-bezier(0.34,1.56,0.64,1) both; }
/* Hold-ring pulse — a gentle breathing glow while inside the therapeutic band. */
@keyframes dzHoldPulse { 0%,100% { opacity: 0.85; } 50% { opacity: 1; } }
.dz-hold-pulse { animation: dzHoldPulse 1.4s ease-in-out infinite; }
/* Win bloom — a green radial bloom expands from the monitor on a held win. */
@keyframes dzWinBloom { 0% { opacity: 0; transform: scale(0.4); } 45% { opacity: 0.75; } 100% { opacity: 0; transform: scale(1.8); } }
.dz-win-bloom { animation: dzWinBloom 0.9s cubic-bezier(0.22,1,0.36,1) forwards; }
/* Win-summary icon bloom (reuses the ward-boss feel). */
@keyframes dzResultBloom { 0% { opacity: 0; transform: scale(0.6); } 55% { transform: scale(1.12); } 100% { opacity: 1; transform: scale(1); } }
.dz-result-bloom { animation: dzResultBloom 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }
/* Fail shake — the monitor jolts once when the round is lost to a crisis. */
@keyframes dzFailShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-7px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }
.dz-fail-shake { animation: dzFailShake 0.42s ease-in-out both; }
/* Big vital number soft settle when it crosses into a new tens bucket. */
@keyframes dzVitalTick { 0% { transform: scale(1); } 45% { transform: scale(1.06); } 100% { transform: scale(1); } }
.dz-vital-tick { animation: dzVitalTick 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }

@media (prefers-reduced-motion: reduce) {
  .seq-item, .q-shake, .q-pulse, .bm-pop, .bm-deflate, .row-fade-out,
  .timer-beat, .timer-beat-fast, .exit-snack-in, .exit-snack-bar,
  .card-shimmer, .sheet-up, .fav-beat, .tip-in, .heart-spring,
  .drawer-item-in, .drawer-glow,
  .fav-tile-in, .fav-jiggle, .fav-tile-out, .quote-swap,
  .qbtn-label, .qbtn-ready,
  .drill-card-in, .test-enter, .note-pop, .note-fab-pulse,
  .naming-icon-enter, .naming-headline-enter, .naming-body-enter,
  .note-menu-in, .note-reply-in, .note-select-pop, .note-reco-pulse,
  .note-count-tick, .note-bullet-in,
  .premium-card-in, .premium-select-pop,
  .wb-card-in, .wb-brief-in, .wb-banner-sweep, .wb-shake,
  .wb-point-float, .wb-chart-in, .wb-damage, .wb-pulse-soft, .wb-pulse-loud,
  .wb-boss-flash, .wb-boss-breathe, .wb-step-pop, .wb-win-bloom,
  .dz-chip-in, .dz-round-in, .dz-alarm-pulse, .dz-drip, .dz-ripple,
  .dz-rate-tick, .dz-hold-pulse, .dz-win-bloom,
  .dz-result-bloom, .dz-fail-shake, .dz-vital-tick { animation: none !important; }
  .note-press { transition: none !important; }
  .note-press:active { transform: none !important; }
  .nav-fwd .anim-fadeup { animation: none !important; }
}

/* ── App blur overlay — covers screen when the app loses focus (Session 4) ──
   Prevents shoulder-surfing / screen-recording of question content while the
   app is backgrounded. Lifts instantly on return. */
#app-blur-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 9999;
  backdrop-filter: blur(18px) brightness(0.92);
  -webkit-backdrop-filter: blur(18px) brightness(0.92);
  background: rgba(255,255,255,0.45);
  pointer-events: none;
}
body.app-blurred #app-blur-overlay { display: block; }
`;
