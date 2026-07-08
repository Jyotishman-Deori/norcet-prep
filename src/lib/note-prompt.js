// =====================================================================
// src/lib/note-prompt.js — AI Learning Note-Taking: PURE prompt logic.
//
// This module owns everything about the "Universal AI Learning Master
// Prompt" that the note popup's EFFECTIVE path copies to the clipboard:
//   - the canonical Designations / Levels / Strategies content,
//   - the per-strategy master-prompt rule sets + progress trackers,
//   - the Designation x Strategy restrict map (bedside strategies only
//     pair with the two clinical designations),
//   - bullet normalisation (<=10, all characters/symbols preserved),
//   - assembleMasterPrompt() — deterministic string assembly.
//
// It is PURE: no React, no storage, no DOM, no I/O. So it is unit-tested
// directly under Node (note-prompt.test.js) and safe to import anywhere.
//
// No-runtime-AI: nothing here calls a model. It assembles a static text
// template the USER copies into an external AI by hand. See CLAUDE.md.
// =====================================================================

export const MAX_BULLETS = 10;

// Turn-one baseline for every strategy's scorecard: before the first answer
// is graded there is nothing to estimate from, so the estimate is an explicit
// "not yet assessed" instead of an arbitrary number that looks made-up.
export const MASTERY_BASELINE = '0% (Not Yet Assessed)';

// ---------------------------------------------------------------------
// DESIGNATIONS (spec Section 9). Order matters: the 5th (index 4) is the
// recommended "Ultimate Designation" default, and indices 4 & 5 are the two
// CLINICAL designations that unlock the bedside strategies (see strategiesFor).
// ---------------------------------------------------------------------
export const DESIGNATIONS = [
  { id: 'cno',        domain: 'Hospital Operations & Healthcare Economics',
    title: 'Chief Nursing Officer (CNO)' },
  { id: 'legal',      domain: 'Nursing Jurisprudence, Ethics & Law',
    title: 'Legal Nurse Consultant / State Board of Nursing Investigator' },
  { id: 'qi',         domain: 'Quality Improvement (QI) & Evidence-Based Practice (EBP)',
    title: 'Director of Nursing Research & Quality Improvement' },
  { id: 'leadership', domain: 'Leadership, Delegation & Conflict Resolution',
    title: 'Senior Charge Nurse & Leadership Coach' },
  { id: 'residency',  domain: 'The Ultimate Designation (recommended if unsure)',
    title: 'Director of Nursing Excellence & Clinical Residency Coordinator',
    recommended: true, clinical: true },
  { id: 'patho',      domain: 'The Universal Knowledge Mastery (dense, topic-deep)',
    title: 'Chief Pathophysiologist & Clinical Pharmacologist',
    clinical: true },
];

export const DEFAULT_DESIGNATION_INDEX = 4; // "Ultimate Designation" (recommended)

// ---------------------------------------------------------------------
// LEVELS. Intermediate is the recommended default.
// ---------------------------------------------------------------------
export const LEVELS = [
  { id: 'beginner',     label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate', recommended: true },
  { id: 'expert',       label: 'Expert' },
];

export const DEFAULT_LEVEL_ID = 'intermediate';

// ---------------------------------------------------------------------
// STRATEGIES (spec Section 10 + 11). Each carries the picker-facing copy
// (name / subtitle / howItWorks) AND the master-prompt payload (rules[] +
// execution). `bedside: true` marks a strategy written in clinical-scenario
// language that only fits the two clinical designations; the restrict map
// hides it for the other four (spec OD #5 — "restrict the picker").
//
// Every rules[] entry is one numbered rule in the final prompt; multi-line
// entries (the Progress Tracker Scorecard) keep their own "* " sub-bullets.
// The Anti-Sycophancy rule is intentionally repeated per strategy so each
// block reads as a complete, self-contained prompt during review.
// ---------------------------------------------------------------------

const ANTI_SYCOPHANCY =
  "Anti-Sycophancy: CRITICAL: disable politeness and do NOT be a 'yes-man.' " +
  "If my answer has a single clinical or logical gap, mark it WRONG immediately " +
  "and name the gap. Prioritise correctness and patient safety over my feelings.";

export const STRATEGIES = [
  {
    id: 'gatekeeper',
    name: 'The "Gatekeeper"',
    subtitle: 'Adaptive Benchmarking',
    recommended: true,
    bedside: false,
    howItWorks:
      'Breaks the topic into 3 strict phases. Teaches Phase 1, then a high-level ' +
      'application quiz: you must pass to unlock Phase 2.',
    rules: [
      'Structural Pacing: If a LIST of topics is provided, organise it into a logical ' +
        'roadmap and begin at the first item. If a SINGLE topic is provided, break it into ' +
        '3 progressive phases (Science -> Bedside Assessment -> Critical Intervention).',
      'Strict Gatekeeper: Teach me ONLY the very first section/topic right now. Keep it ' +
        'high-density and practical. Do not move forward until I pass your checkpoint.',
      ANTI_SYCOPHANCY,
      'Progress Tracker Scorecard: Maintain a running scorecard at the very TOP of every ' +
        'single response, formatted exactly like this:\n' +
        '   * Current Topic/Phase: [Name]\n' +
        '   * Current Mastery Estimate: [' + MASTERY_BASELINE + ' on your first response; ' +
        'thereafter 0%-100% based on my graded answers]\n' +
        '   * Status: [Locked / Unlocked - X% Mastered]',
    ],
    execution:
      'Display the initial Scorecard (Mastery Estimate = ' + MASTERY_BASELINE + '), then ' +
      'present the first section/topic. End your response with one tough clinical application ' +
      'question to test my understanding. Stop and wait for my response.',
  },
  {
    id: 'blindspots',
    name: 'The "Blind Spots"',
    subtitle: 'Feynman Calibration',
    recommended: false,
    bedside: false,
    howItWorks:
      'You explain the topic in your own words first. The AI grades it against a rubric, ' +
      'computes your exact % understanding, and targets your weak spots.',
    rules: [
      'Elicit First: Before teaching anything, ask me to type out everything I already know ' +
        'about the Target Material in my own words. Do NOT teach until I have answered.',
      'Rubric Grading: Run my explanation through a clear grading rubric. Calculate an exact ' +
        'percentage of understanding and list, specifically, every gap or misconception you found.',
      'Targeted Repair: Then teach ONLY to my weak spots, the gaps you identified, in ' +
        'high-density, practical terms. Do not re-teach what I already demonstrated I know.',
      ANTI_SYCOPHANCY,
      'Progress Tracker Scorecard: Maintain a running scorecard at the very TOP of every ' +
        'response, formatted exactly like this:\n' +
        '   * Target Material: [Name]\n' +
        '   * Understanding Estimate: [' + MASTERY_BASELINE + ' until you have graded my first ' +
        'explanation; thereafter 0%-100%]\n' +
        '   * Biggest Gap Right Now: [the single highest-priority weak spot]',
    ],
    execution:
      'Display the initial Scorecard (Understanding Estimate = ' + MASTERY_BASELINE + '), then ' +
      'ask me to explain the Target Material in my own words. Stop and wait for my response ' +
      'before grading or teaching.',
  },
  {
    id: 'stresstest',
    name: 'The "Stress-Test Simulator"',
    subtitle: 'The Acuity Ladder',
    recommended: false,
    bedside: true,
    howItWorks:
      'Starts with a stable patient. Every turn adds one new complication (a lab, a second ' +
      'diagnosis, a side effect) until you stabilise the patient or make a critical error.',
    rules: [
      'Escalating Scenario: Begin with a single STABLE patient assignment drawn from the Target ' +
        'Material. Each turn, add exactly ONE new complication (a new lab value, a secondary ' +
        'diagnosis, a medication side effect, a vitals change) and ask for my next action.',
      'One Move At A Time: Present one decision point per turn. Wait for my action before you ' +
        'reveal the consequence and introduce the next complication.',
      ANTI_SYCOPHANCY + ' An unsafe intervention ends in a documented negative outcome. Do ' +
        'not soften it or rescue me from it.',
      'Progress Tracker Scorecard: Maintain a running scorecard at the very TOP of every ' +
        'response, formatted exactly like this:\n' +
        '   * Current Acuity Level: [Stable / Guarded / Critical]\n' +
        '   * Active Complications: [running list, stacked in the order they appeared]\n' +
        '   * Outcome Status: [In Progress / Stabilised / Critical Error - reason]',
    ],
    execution:
      'Display the initial Scorecard (Acuity Level = Stable, no complications yet), present ' +
      'the opening stable scenario, then introduce the FIRST complication and ask for my next ' +
      'action. Stop and wait for my response.',
  },
  {
    id: 'traptester',
    name: 'The "Cognitive Dissonance"',
    subtitle: 'The Trap Tester',
    recommended: false,
    bedside: true,
    howItWorks:
      'Rapid-fire scenarios each with one proposed intervention. You judge each as a ' +
      '"life-saver" or a "license-killer", with deliberate look-alike traps mixed in.',
    rules: [
      'Rapid Judgement: Present a short scenario from the Target Material followed by ONE ' +
        'proposed intervention. My only job is to call it a "LIFE-SAVER" or a "LICENSE-KILLER" ' +
        'and justify it in a single line.',
      'Verdict + Rationale: After each call, state whether I was right, give the correct ' +
        'clinical rationale in 1-2 lines, then immediately present the next scenario. Keep the ' +
        'pace fast.',
      'Deliberate Traps: Mix in interventions that look correct but are subtly unsafe (right ' +
        'drug / wrong route, right action / wrong timing) so I cannot pattern-match my way through.',
      ANTI_SYCOPHANCY,
      'Progress Tracker Scorecard: Maintain a running scorecard at the very TOP of every ' +
        'response, formatted exactly like this:\n' +
        '   * Correct Calls: [n]\n' +
        '   * Critical Errors (missed license-killers): [n]\n' +
        '   * Current Streak: [n correct in a row]',
    ],
    execution:
      'Display the initial Scorecard (all counters at 0), then present the first scenario and ' +
      'its single proposed intervention, and ask me to call it a LIFE-SAVER or a LICENSE-KILLER. ' +
      'Stop and wait for my response.',
  },
];

export const DEFAULT_STRATEGY_ID = 'gatekeeper';

// ---------------------------------------------------------------------
// RESTRICT MAP (spec OD #5). Bedside strategies (Stress-Test, Trap Tester)
// only make sense for the two CLINICAL designations (indices 4 & 5). For the
// other four (CNO / Legal / QI / Leadership) the picker offers just the two
// domain-agnostic strategies (Gatekeeper, Blind Spots).
// ---------------------------------------------------------------------
export function isClinicalDesignation(designationIndex) {
  const d = DESIGNATIONS[designationIndex];
  return !!(d && d.clinical);
}

export function strategiesFor(designationIndex) {
  const clinical = isClinicalDesignation(designationIndex);
  return STRATEGIES.filter((s) => clinical || !s.bedside);
}

// Is this (designation, strategy) pair offered by the picker? Used defensively
// by assembleMasterPrompt so a stale bedside selection can never leak into a
// non-clinical designation's prompt.
export function isValidCombo(designationIndex, strategyId) {
  return strategiesFor(designationIndex).some((s) => s.id === strategyId);
}

// ---------------------------------------------------------------------
// BULLET NORMALISATION. Accepts a raw multi-line string OR an array of lines.
// Trims each line, drops blanks, strips a leading bullet marker the user may
// have typed (so we never double-bullet), preserves ALL other characters and
// symbols (Unicode-safe), and caps the result at MAX_BULLETS.
// ---------------------------------------------------------------------
const LEADING_BULLET = /^\s*(?:[•·*\-–—]|\d+[.)])\s+/;

export function normalizeBullets(input) {
  const lines = Array.isArray(input)
    ? input
    : (typeof input === 'string' ? input.split(/\r?\n/) : []);
  const out = [];
  for (const raw of lines) {
    if (typeof raw !== 'string') continue;
    const cleaned = raw.replace(LEADING_BULLET, '').trim();
    if (cleaned) out.push(cleaned);
    if (out.length >= MAX_BULLETS) break;
  }
  return out;
}

// PURE: format the bullets into the Target Material field. A single bullet is
// inlined as one topic; multiple bullets become a dash list (matching the
// "Single Topic OR List of Topics" branch in the strategy rules).
export function formatTargetMaterial(bullets) {
  const b = normalizeBullets(bullets);
  if (b.length === 0) return '[No notes entered yet]';
  if (b.length === 1) return b[0];
  return b.map((t) => `- ${t}`).join('\n');
}

// ---------------------------------------------------------------------
// RESOLVERS — turn a selection (possibly missing/invalid) into a concrete
// designation / level / strategy, falling back to the recommended defaults.
// ---------------------------------------------------------------------
function resolveDesignation(designationIndex) {
  const d = DESIGNATIONS[designationIndex];
  return d || DESIGNATIONS[DEFAULT_DESIGNATION_INDEX];
}
function resolveLevel(levelId) {
  return LEVELS.find((l) => l.id === levelId) ||
         LEVELS.find((l) => l.id === DEFAULT_LEVEL_ID);
}
function resolveStrategy(designationIndex, strategyId) {
  // Defensive: if the chosen strategy isn't valid for this designation
  // (e.g. a bedside strategy on a non-clinical designation), fall back to the
  // always-valid Gatekeeper rather than emit an out-of-domain prompt.
  const valid = isValidCombo(designationIndex, strategyId);
  const id = valid ? strategyId : DEFAULT_STRATEGY_ID;
  return STRATEGIES.find((s) => s.id === id) ||
         STRATEGIES.find((s) => s.id === DEFAULT_STRATEGY_ID);
}

// ---------------------------------------------------------------------
// assembleMasterPrompt — the one public entry point the popup calls.
//   { designationIndex, levelId, strategyId, bullets } -> full prompt string
// Deterministic; safe with partial/omitted selections (uses defaults).
// ---------------------------------------------------------------------
export function assembleMasterPrompt({ designationIndex, levelId, strategyId, bullets } = {}) {
  const designation = resolveDesignation(designationIndex);
  const level = resolveLevel(levelId);
  const strategy = resolveStrategy(designationIndex, strategyId);
  const target = formatTargetMaterial(bullets);

  const rulesBlock = strategy.rules
    .map((rule, i) => `${i + 1}. ${rule}`)
    .join('\n\n');

  // A multi-bullet list sits on its own lines under the label; a single topic
  // stays inline after it.
  const targetLine = target.includes('\n')
    ? `Target Material:\n${target}`
    : `Target Material: ${target}`;

  return [
    `Designation: ${designation.title}`,
    `My Level: ${level.label}`,
    targetLine,
    '',
    'CRITICAL STRATEGY RULES:',
    '',
    rulesBlock,
    '',
    `Execution: ${strategy.execution}`,
  ].join('\n');
}
