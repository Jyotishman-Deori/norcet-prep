// =====================================================================
// src/lib/demographics.js  (NEW-02 — onboarding demographics)
// Lean, DPDP-compliant profile data: Gender + Qualification + Employment ONLY.
// Caste/Category and Disability status are intentionally NOT collected.
//
//   data.demographics = {
//     gender:        'female' | 'male' | 'na' | null,
//     qualification: 'bsc' | 'pbbsc' | 'gnm' | null,
//     employment:    'fulltime' | 'working' | 'shifts' | null,
//     customTargetPercentile: number   // defaults to 98.5 (UR / Open-Merit)
//   }
//
// Why we collect each (shown to the user as trust copy):
//   • Gender → calibrates the simulated leaderboard for the AIIMS 80:20 quota
//     (the Male-Pool Rank feature). NEVER used to gate content.
//   • Qualification → unlocks the right framing (GNM gets bedside-to-theory).
//   • Employment → adapts pacing (a working nurse can't sit a 3-hour mock on a
//     Tuesday afternoon).
//
// All OPTIONAL and editable any time in Settings → Profile (skipping onboarding
// is never a dead end). Stored in the synced profile blob — no new table.
// =====================================================================

// Default everyone to the Open-Merit / UR standard regardless of background, so
// every user trains toward the highest bar and is safe whatever their category.
export const DEFAULT_TARGET_PERCENTILE = 98.5;

export const GENDER_OPTIONS = [
  { id: 'female', label: 'Female' },
  { id: 'male',   label: 'Male' },
  { id: 'na',     label: 'Prefer not to say' },
];

export const QUALIFICATION_OPTIONS = [
  { id: 'bsc',   label: 'B.Sc. Nursing' },
  { id: 'pbbsc', label: 'Post-Basic B.Sc.' },
  { id: 'gnm',   label: 'GNM Diploma' },
];

export const EMPLOYMENT_OPTIONS = [
  { id: 'fulltime', label: 'Full-Time Aspirant', sub: '4+ hours/day' },
  { id: 'working',  label: 'Working Professional', sub: 'Day job + prep' },
  { id: 'shifts',   label: 'Hospital Shifts', sub: '1–3 hours/day' },
];

// Reassuring "we just unlocked X for you" copy after a selection (onboarding).
export const QUALIFICATION_UNLOCK = {
  gnm: 'Got it! We’ll surface Bedside-to-Theory translation drills so your clinical experience converts into high-yield exam marks.',
};
export const EMPLOYMENT_UNLOCK = {
  working: 'We know juggling a job and prep is exhausting. We’re leaning on Hands-Free Audio Mode and 5-minute micro-drills so you can study on commutes and breaks.',
  shifts:  'Long shifts are brutal. We’ll prioritise Hands-Free Audio Mode and 5-minute micro-drills so you can study in the gaps.',
  fulltime:'Great — you’ve got time to build stamina. We’ll surface full-length mock simulations so you’re ready for exam-day marathons.',
};

const ID_SETS = {
  gender: new Set(GENDER_OPTIONS.map(o => o.id)),
  qualification: new Set(QUALIFICATION_OPTIONS.map(o => o.id)),
  employment: new Set(EMPLOYMENT_OPTIONS.map(o => o.id)),
};

// PHIL-08 — the Ikigai statement is private free text. Strip all HTML tags
// (never render user markup) and cap at 280 chars before it ever touches state
// or storage. Never log this field anywhere.
export const IKIGAI_MAX = 280;
export function sanitizeIkigai(s) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '').slice(0, IKIGAI_MAX);
}

// Shape/validate a stored demographics blob (tolerates missing/old data).
export function normalizeDemographics(d) {
  const out = { gender: null, qualification: null, employment: null, ikigai: '', customTargetPercentile: DEFAULT_TARGET_PERCENTILE };
  if (d && typeof d === 'object') {
    if (ID_SETS.gender.has(d.gender)) out.gender = d.gender;
    if (ID_SETS.qualification.has(d.qualification)) out.qualification = d.qualification;
    if (ID_SETS.employment.has(d.employment)) out.employment = d.employment;
    if (typeof d.ikigai === 'string') out.ikigai = sanitizeIkigai(d.ikigai);
    if (typeof d.customTargetPercentile === 'number' && d.customTargetPercentile > 0 && d.customTargetPercentile <= 100) {
      out.customTargetPercentile = d.customTargetPercentile;
    }
  }
  return out;
}

export const labelFor = (kind, id) => {
  const list = kind === 'gender' ? GENDER_OPTIONS : kind === 'qualification' ? QUALIFICATION_OPTIONS : EMPLOYMENT_OPTIONS;
  const hit = list.find(o => o.id === id);
  return hit ? hit.label : null;
};

// How many of the three fields are filled (for a "2/3 complete" style badge).
export function demographicsFilled(d) {
  const n = normalizeDemographics(d);
  return ['gender', 'qualification', 'employment'].filter(k => n[k]).length;
}
