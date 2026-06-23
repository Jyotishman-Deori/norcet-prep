// =====================================================================
// NORCET BENCHMARKS  —  official reference data for "Where you stand"
// =====================================================================
// Pure data, no imports, no storage. Consumed by src/lib/projection.js and
// src/ui/where-you-stand-card.jsx. Nothing here is user-specific.
//
// SCORING MODEL (AIIMS NORCET): +1 per correct answer, −1/3 per wrong answer,
// 0 for blank. Maximum marks on a paper = number of questions. A candidate's
// "marks %" = netScore / questionCount × 100. The qualifying lines below are
// expressed in that same unit, so a practice marks-% can be placed directly
// against them.
//
// EXAM CADENCE: NORCET runs twice a year since 2023 (an April cycle and a
// September cycle). The two-stage Prelims→Mains pattern was introduced at
// NORCET 5 (September 2023); cycles before that were single-stage.
// =====================================================================

// MAINS qualifying cut-offs — the minimum % of marks needed to QUALIFY Stage 2.
// These are OFFICIAL and STABLE across cycles (a fixed qualifying floor, not a
// competition-driven rank line), which is exactly why they make a dependable
// target. Sorted high → low; the card draws one line per entry.
//
// PwBD rows are the same floors with the standard 5% relaxation applied
// (50→45, 45→40, 40→35), now listed explicitly rather than folded into a note.
// NOTE: UR/EWS-PwBD shares 45 with OBC, and OBC-PwBD shares 40 with SC/ST — the
// card renders one line per row, so those pairs overlap on the ladder.
export const MAINS_QUALIFYING = [
  { cat: 'UR / EWS',         pct: 50, hint: 'General & EWS' },
  { cat: 'OBC',              pct: 45, hint: 'OBC-NCL' },
  { cat: 'SC / ST',          pct: 40, hint: 'SC, ST' },
  { cat: 'UR / EWS (PwBD)',  pct: 45, hint: 'General & EWS with disability' },
  { cat: 'OBC (PwBD)',       pct: 40, hint: 'OBC-NCL with disability' },
  { cat: 'SC / ST (PwBD)',   pct: 35, hint: 'SC, ST with disability' },
];

// Retained for the card footnote (it imports this). PwBD lines are now explicit
// above, but this one-liner still summarises the rule for readers.
export const PWBD_NOTE = 'PwBD candidates get a 5% relaxation on their category line (shown above).';

// Largest of the qualifying lines — used to size the "just qualify" framing.
export const TOP_QUALIFYING_PCT = Math.max(...MAINS_QUALIFYING.map(l => l.pct));

// ---------------------------------------------------------------------
// PRELIMS percentile cut-offs — CYCLE-SPECIFIC, released as a PERCENTILE
// (not a marks %). These swing every cycle with the candidate pool, so they
// are reference context only, never a target line.
//
// Figures below are VERIFIED against the official AIIMS normalisation results
// and kept at full 7-decimal precision — that is the official standard and it
// matters for tie-breaker eligibility, so DO NOT round them in the data.
//
// Coverage: NORCET 7–10. The Prelims stage began at NORCET 5 (Sep 2023), and
// these four are the cycles whose percentile figures are verified here.
// (NORCET 5 and 6 also had a Prelims stage — their rows can be appended later
// once their figures are verified.)
//
// Shape: { cycle, date 'YYYY-MM-DD', UR, EWS, OBC, SC, ST }. Newest first.
//
// TODO (context captured, not yet implemented):
//  • PwBD candidates have SEPARATE Prelims percentile cut-offs (example:
//    NORCET 10 UR-PwBD ≈ 45.56). Add later as extra columns (UR_PwBD, EWS_PwBD,
//    …) or behind a PwBD toggle on the card.
//  • The card currently shows 2-decimal percentiles. Add a tap/tooltip that
//    reveals the full 7-decimal figure for aspirants checking tie-breaker
//    eligibility.
// ---------------------------------------------------------------------
export const PRELIMS_PERCENTILE_TREND = [
  { cycle: 'NORCET 10 (Apr 2026)', date: '2026-04-11', UR: 93.5887683, EWS: 78.9831134, OBC: 84.2077239, SC: 81.9605328, ST: 74.4746050 },
  { cycle: 'NORCET 9 (Sep 2025)',  date: '2025-09-14', UR: 90.7161868, EWS: 65.6169852, OBC: 75.9545125, SC: 73.4418098, ST: 66.3210743 },
  { cycle: 'NORCET 8 (Apr 2025)',  date: '2025-04-12', UR: 93.5335077, EWS: 78.2853953, OBC: 83.1213092, SC: 80.1392602, ST: 73.6786438 },
  { cycle: 'NORCET 7 (Sep 2024)',  date: '2024-09-15', UR: 95.8446801, EWS: 77.9002339, OBC: 88.2629033, SC: 85.6454042, ST: 80.5850127 },
];

// Full cycle history for reference (cadence: twice a year since 2023):
//   NORCET 1  — Sep 2020   (single-stage)
//   NORCET 2  — Nov 2021   (single-stage)
//   NORCET 3  — Sep 2022   (single-stage)
//   NORCET 4  — Jun 2023   (single-stage)
//   NORCET 5  — Sep 2023   ← two-stage Prelims→Mains introduced here
//   NORCET 6  — Apr 2024
//   NORCET 7  — Sep 2024
//   NORCET 8  — Apr 2025
//   NORCET 9  — Sep 2025
//   NORCET 10 — Apr 2026
//   NORCET 11 — Sep 2026   (scheduled)

// True once the prelims trend has at least one verified row, so the card can
// show/hide the prelims-context section without code changes.
export const HAS_PRELIMS_DATA = PRELIMS_PERCENTILE_TREND.length > 0;
