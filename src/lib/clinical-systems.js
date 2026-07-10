// =====================================================================
// CLINICAL SYSTEMS  —  pure sub-to-body-system mapping + leak math
// (NEW-07.3 "Clinical System Leak Radar")
// =====================================================================
// No React, no storage. Questions carry a free-text `sub` ("Cardiac",
// "Cardiovascular", "Insulin", …) and a topic id; this module maps each
// question onto a small CLINICAL system taxonomy so mistakes can be
// grouped the way the ward thinks (Cardiovascular, Respiratory, …)
// instead of by textbook chapter.
//
// Mapping strategy (in order):
//   1. keyword match on the normalized sub  (synonym-proof: Cardiac /
//      Cardiovascular / Hypertension all hit 'cardio')
//   2. topic fallback  (obg/peds -> perinatal, mhn -> mental,
//      micro -> infection, nutr -> gi)
//   3. 'other'  (never crashes on imported banks with unknown subs)
// GK and aptitude questions are NOT clinical: they are excluded from the
// leak radar entirely (systemForQuestion still returns 'other' for them
// so callers that want a total mapping get one).
//
// severity = wrongRate * log2(1 + attempts): weighting by volume so a
// 2-attempt 100%-wrong fluke cannot outrank a 40-attempt 55%-wrong leak.
// Systems with fewer than MIN_ATTEMPTS attempts are not reported.
// =====================================================================
import { resolveTopicId } from './topics.js';

export const CLINICAL_SYSTEMS = [
  { id: 'cardio',    label: 'Cardiovascular & Blood',      icon: '🫀' },
  { id: 'resp',      label: 'Respiratory',                 icon: '🫁' },
  { id: 'neuro',     label: 'Neurological',                icon: '🧠' },
  { id: 'endo',      label: 'Endocrine & Metabolic',       icon: '🧪' },
  { id: 'renal',     label: 'Renal, Fluids & Electrolytes', icon: '💧' },
  { id: 'gi',        label: 'GI & Nutrition',              icon: '🍎' },
  { id: 'infection', label: 'Infection & Immunity',        icon: '🦠' },
  { id: 'perinatal', label: 'Maternal & Child',            icon: '🤱' },
  { id: 'mental',    label: 'Mental Health',               icon: '🫶' },
  { id: 'other',     label: 'Other clinical areas',        icon: '🩺' },
];

export const MIN_ATTEMPTS = 3;

// Keyword families, tested against the normalized sub. Order matters:
// first hit wins, so keep the more specific families above 'renal'
// (whose "fluid" would otherwise steal "Fluid Balance" from nowhere).
const KEYWORDS = [
  ['perinatal', /labour|labor|postpartum|antenatal|newborn|neonat|foetal|fetal|pregnan|eclampsia|obstetric|family planning|imnci|breastfeed|growth/],
  ['infection', /infect|sepsis|steril|asepsis|immunis|immuniz|vaccin|antibiotic|gram|tubercul|\bhai\b|precaution|isolation|hand hygiene|communicable/],
  ['cardio',    /cardi|heart|hyperten|anticoagul|\bblood\b|haemorrhage|hemorrhage|shock|ecg|arrhythm/],
  ['resp',      /respir|asthma|copd|pneumon|oxygen|airway|ventilat|trache/],
  ['neuro',     /neuro|nervous|\bcns\b|stroke|seizure|epilep|meningit|glasgow|paralysis/],
  ['endo',      /endocrin|insulin|diabet|thyroid|corticosteroid|hormon|pituitar|adrenal/],
  ['renal',     /renal|kidney|urin|dialysis|fluid|electrolyte|acid-base|acid base|\biv therap/],
  ['gi',        /gastro|\bgi\b|liver|hepat|nutrition|diet|vitamin|malnutrition|\bbmi\b|diarrh|peptic|bowel|stoma/],
  ['mental',    /schizo|psych|\bect\b|depress|anxiet|defence mechanism|defense mechanism|therapeutic communication|bipolar|suicid|mental/],
];

// Topics that are not clinical content at all.
const NON_CLINICAL_TOPICS = { gk: true, apt: true };

const TOPIC_FALLBACK = {
  obg: 'perinatal',
  peds: 'perinatal',
  mhn: 'mental',
  micro: 'infection',
  nutr: 'gi',
};

export function normalizeSub(sub) {
  return String(sub || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function systemForQuestion(q) {
  if (!q) return 'other';
  const sub = normalizeSub(q.sub);
  if (sub && sub !== 'general') {
    for (const [id, re] of KEYWORDS) {
      if (re.test(sub)) return id;
    }
  }
  return TOPIC_FALLBACK[resolveTopicId(q.topic)] || 'other';
}

// history: data.history ({ qId: { attempts: [{ correct, revealed, ... }] } })
// allQuestions: the full question list (seed + custom/imported), used to
// join attempt ids back to a topic/sub.
export function clinicalLeaks(history, allQuestions) {
  const byId = {};
  (Array.isArray(allQuestions) ? allQuestions : []).forEach((q) => { if (q && q.id) byId[q.id] = q; });

  const acc = {}; // systemId -> { attempts, wrong, wrongQIds:Set }
  if (history && typeof history === 'object') {
    for (const [qId, h] of Object.entries(history)) {
      const q = byId[qId];
      if (!q || NON_CLINICAL_TOPICS[resolveTopicId(q.topic)]) continue;
      const attempts = h && Array.isArray(h.attempts) ? h.attempts : [];
      if (attempts.length === 0) continue;
      const sys = systemForQuestion(q);
      const a = acc[sys] || (acc[sys] = { attempts: 0, wrong: 0, wrongQIds: new Set() });
      for (const at of attempts) {
        if (!at || at.revealed) continue;
        a.attempts += 1;
        if (!at.correct) { a.wrong += 1; a.wrongQIds.add(qId); }
      }
    }
  }

  const systems = [];
  for (const meta of CLINICAL_SYSTEMS) {
    const a = acc[meta.id];
    if (!a || a.attempts < MIN_ATTEMPTS) continue;
    const wrongRate = a.wrong / a.attempts;
    systems.push({
      id: meta.id, label: meta.label, icon: meta.icon,
      attempts: a.attempts, wrong: a.wrong,
      wrongRate: Math.round(wrongRate * 100),
      severity: wrongRate * Math.log2(1 + a.attempts),
      wrongQIds: Array.from(a.wrongQIds),
    });
  }
  systems.sort((x, y) => y.severity - x.severity);
  return { systems, hasData: systems.length > 0 };
}

// One headline: the worst leak, only when it is a real leak.
export function leakInsight(leaks) {
  if (!leaks || !leaks.hasData) return null;
  const top = leaks.systems[0];
  if (!top || top.wrongRate < 35) return null;
  return {
    system: top.id,
    text: `${top.label} is your biggest leak right now: ${top.wrongRate}% wrong across ${top.attempts} attempts. Patch this system before adding new topics.`,
  };
}
