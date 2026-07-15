// =====================================================================
// scripts/fix-learn-structure.mjs — ONE-OFF structural repair (dev-time only).
// Run once, then this file is history. Kept in the repo as the record of what
// was changed and why.
//
// FIX 1 — the aptitude title collision (a LIVE bug).
//   All 8 aptitude modules shipped the SAME 4 card titles ("What this tests",
//   "Step-by-step method", "Worked example", "Common mistake to avoid"). Doubt
//   ids are pointId(topic, cardTitle) = `${topic}::${title}` with NO module in
//   the key (src/lib/doubts.js:18), so flagging "Worked example" inside Number
//   Series flagged it inside ALL EIGHT modules at once. The same collision made
//   quick-revision's findCardByTitle() return the FIRST match, so a Quick card
//   promising "Percentage" actually served the Number Series one.
//   Titles are now prefixed with their module, which is the only way to make
//   them unique. This DOES orphan any existing flag on those four titles, and
//   that is accepted: such a flag was already broken (it pointed at 8 cards).
//   Card BODIES are preserved byte-for-byte.
//
// FIX 2 — the aptitude Guidebook was always empty.
//   compileGuidebook() (src/lib/learn-path.js:141) derives the guidebook by
//   harvesting ONLY `keypoints` and `mnemonic` cards. Aptitude had neither, so
//   compileGuidebook('apt') returned null and the sheet read "No summary content
//   for this unit yet" while the button was still offered. It is also why
//   Aptitude vanished from Quick Revision inside 30 days of the exam
//   (ESSENTIAL_TYPES = keypoints|concept|mnemonic). Each module now gets a real
//   keypoints + mnemonic card.
//
// FIX 3 — obg shipped two near-duplicate modules, "Labour Stages" and "Stages of
//   Labour", teaching the same thing. Merged into one, keeping BOTH modules'
//   cards and every card title intact (so no student loses a flag).
// =====================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(root, 'public', 'data', 'concept-cards.json');
const cc = JSON.parse(readFileSync(TARGET, 'utf8'));

// ---------- FIX 1 + 2: aptitude ----------
// Per-module guidebook cards. Keyed by the module's `sub`.
const APT_EXTRA = {
  'Number Series': {
    keypoints: {
      title: 'Number Series: the six patterns to test',
      body: [
        'Constant difference: +7, +7, +7 (arithmetic)',
        'Constant ratio: ×2, ×2 (geometric)',
        'Difference of the differences is constant (second order)',
        'Alternating: two series woven together, check every other term',
        'Squares/cubes with an offset: 4, 9, 16 → n² ; 2, 9, 28 → n³+1',
        'Prime numbers, or n² minus n, when nothing else fits',
      ],
    },
    mnemonic: {
      title: 'Number Series: DR SAP',
      body: 'When a series will not crack, run DR SAP in order:\n\nDifference (subtract neighbours)\nRatio (divide neighbours)\nSecond difference (differences of the differences)\nAlternate (split into two series)\nPowers (squares, cubes, plus or minus a constant)\n\nMost NORCET series fall out at D or R. Only go deeper if both fail.',
    },
  },
  'Blood Relations': {
    keypoints: {
      title: 'Blood Relations: the rules that decide the answer',
      body: [
        'Draw it. Never solve a relation puzzle in your head',
        'Male on the left, female on the right, same generation on one line',
        '"Only son of" and "only daughter of" are the strongest clues, use them first',
        'Maternal = mother\'s side, paternal = father\'s side',
        'A "brother in law" can be your sister\'s husband OR your spouse\'s brother, check both',
        'The last relation named in the sentence is usually the one being asked about',
      ],
    },
    mnemonic: {
      title: 'Blood Relations: draw, do not read',
      body: 'Symbols to use every time:\n\n+ for male, − for female\n= for a married couple (horizontal line)\n| for parent to child (vertical line)\nA line across for siblings\n\nRead the sentence backwards, from the person being asked about to the speaker. The answer appears on the diagram, not in the words.',
    },
  },
  'Direction Sense': {
    keypoints: {
      title: 'Direction Sense: what examiners hide',
      body: [
        'Always start facing NORTH unless told otherwise',
        'A right turn is clockwise, a left turn is anticlockwise. Turning "to his right" depends on which way he faces',
        'Shadow at sunrise falls WEST, at sunset it falls EAST',
        'Final displacement is a straight line, use Pythagoras, not the total distance walked',
        'Count the net movement on each axis, north minus south, east minus west',
      ],
    },
    mnemonic: {
      title: 'Direction Sense: NEWS clockwise',
      body: 'North → East → South → West, clockwise. Say it out loud once and draw the cross on your paper before you read the question.\n\nRight turn = next one clockwise.\nLeft turn = previous one anticlockwise.\n\nTwo left turns or two right turns always leave you facing the opposite way.',
    },
  },
  'Coding & Decoding': {
    keypoints: {
      title: 'Coding and Decoding: the four codes that appear',
      body: [
        'Letter shift: each letter moves forward or back a fixed number (+1, −2)',
        'Reverse alphabet: A↔Z, B↔Y. Position of a letter plus its mirror always makes 27',
        'Positional: A=1 to Z=26, the code is a number',
        'Jumbled: the letters are the same, only the order changed',
        'Always write the alphabet with its numbers on the margin before you start',
      ],
    },
    mnemonic: {
      title: 'Coding and Decoding: EJOTY',
      body: 'Memorise five anchors and you can place any letter instantly:\n\nE = 5, J = 10, O = 15, T = 20, Y = 25\n\nNeed R? It is just after O(15), so R = 18. Need W? Just after T(20), so W = 23.\n\nFor the reverse alphabet: letter position + mirror position = 27.',
    },
  },
  'Syllogisms': {
    keypoints: {
      title: 'Syllogisms: rules that settle most questions',
      body: [
        'Draw Venn circles. Never reason in words',
        'Two negative premises can never give a valid conclusion',
        'Two particular premises ("some") can never give a valid conclusion',
        'If either premise is negative, the conclusion must be negative',
        '"Some A are B" always also means "Some B are A"',
        '"All A are B" does NOT mean "All B are A". This is the classic trap',
      ],
    },
    mnemonic: {
      title: 'Syllogisms: the possibility test',
      body: 'A conclusion is only true if it holds in EVERY possible diagram, not just the one you drew first.\n\nSo: draw the diagram that makes the conclusion FALSE. If you can draw even one, the conclusion "does not follow".\n\nIf you cannot draw one, it follows.\n\nThat single habit answers most "either or" options correctly.',
    },
  },
  'Time and Work': {
    keypoints: {
      title: 'Time and Work: the numbers to set up',
      body: [
        'Work done in one day = 1 ÷ (days taken). This is the rate',
        'Rates ADD when people work together: 1/A + 1/B',
        'Together they take AB ÷ (A + B) days. Learn this shortcut',
        'Efficiency is inversely proportional to time taken',
        'If a pipe empties the tank, its rate is NEGATIVE, subtract it',
        'Take the LCM of the days as the total work, it kills all fractions',
      ],
    },
    mnemonic: {
      title: 'Time and Work: use LCM as the tank',
      body: 'A does it in 12 days, B in 18. Do NOT add fractions.\n\nLet the total work = LCM(12, 18) = 36 units.\nA does 36÷12 = 3 units a day.\nB does 36÷18 = 2 units a day.\nTogether 5 units a day → 36÷5 = 7.2 days.\n\nWhole numbers all the way. This is faster and far less error prone than 1/12 + 1/18.',
    },
  },
  'Percentage': {
    keypoints: {
      title: 'Percentage: conversions worth memorising',
      body: [
        '1/2 = 50%, 1/3 = 33.33%, 1/4 = 25%, 1/5 = 20%',
        '1/6 = 16.67%, 1/8 = 12.5%, 1/16 = 6.25%',
        'A rise of x% then a fall of x% does NOT return you to the start, you end lower',
        'Net change of two successive changes: a + b + (ab ÷ 100), keep the signs',
        'Increase from A to B = (B − A) ÷ A × 100. Always divide by the ORIGINAL',
      ],
    },
    mnemonic: {
      title: 'Percentage: divide by the original',
      body: 'The single most common mistake is dividing by the wrong number.\n\nPercentage CHANGE always divides by the OLD value.\nPercentage OF always multiplies the base.\n\n"20 is what percent more than 16?" → (20 − 16) ÷ 16 = 25%, not ÷ 20.\n\nSay "change over original" once before every percentage question.',
    },
  },
  'Ratio and Proportion': {
    keypoints: {
      title: 'Ratio and Proportion: the setup that never fails',
      body: [
        'A ratio has no units, it is a comparison. Keep both quantities in the SAME unit first',
        'a : b = c : d means a×d = b×c (cross multiply)',
        'To divide 600 in 2 : 3, total parts = 5, one part = 120, so 240 and 360',
        'Direct proportion: one goes up, the other goes up (multiply)',
        'Inverse proportion: one goes up, the other goes down (more workers, fewer days)',
        'A ratio can be scaled: 2 : 3 is the same as 20 : 30',
      ],
    },
    mnemonic: {
      title: 'Ratio and Proportion: count the parts',
      body: 'Almost every ratio question is solved the same way:\n\n1. Add the ratio numbers to get TOTAL PARTS.\n2. Divide the total quantity by total parts to get ONE PART.\n3. Multiply one part by each share.\n\nRatio 3 : 4 : 5 of 1200 → 12 parts → one part = 100 → 300, 400, 500.\n\nIf you can find "one part", the question is already answered.',
    },
  },
};

const apt = cc.apt || [];
let renamed = 0;
let added = 0;
for (const mod of apt) {
  // FIX 1 — make every card title unique by prefixing its module.
  for (const card of mod.cards) {
    const map = {
      'What this tests': `${mod.sub}: what this tests`,
      'Step-by-step method': `${mod.sub}: step by step method`,
      'Worked example': `${mod.sub}: worked example`,
      'Common mistake to avoid': `${mod.sub}: common mistake`,
    };
    if (map[card.title]) { card.title = map[card.title]; renamed++; }
  }
  // FIX 2 — give the module the two card types the Guidebook actually harvests.
  const extra = APT_EXTRA[mod.sub];
  if (extra) {
    if (!mod.cards.some(c => c.type === 'keypoints')) {
      mod.cards.push({ type: 'keypoints', title: extra.keypoints.title, body: extra.keypoints.body });
      added++;
    }
    if (!mod.cards.some(c => c.type === 'mnemonic')) {
      mod.cards.push({ type: 'mnemonic', title: extra.mnemonic.title, body: extra.mnemonic.body });
      added++;
    }
  }
}
console.log(`apt: renamed ${renamed} colliding titles, added ${added} guidebook cards`);

// ---------- FIX 3: merge the duplicated obg module ----------
const obg = cc.obg || [];
const keep = obg.find(m => m.sub === 'Labour Stages');
const dupe = obg.find(m => m.sub === 'Stages of Labour');
if (keep && dupe) {
  keep.cards.push(...dupe.cards);          // every card title survives, so no flag is orphaned
  cc.obg = obg.filter(m => m !== dupe);
  console.log(`obg: merged "Stages of Labour" into "Labour Stages" -> ${keep.cards.length} cards, all titles preserved`);
}

writeFileSync(TARGET, JSON.stringify(cc, null, 2) + '\n', 'utf8');
console.log('concept-cards.json rewritten');
