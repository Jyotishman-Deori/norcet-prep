// =====================================================================
// src/data/sorter-cases.js — NEW-10 (Module A) "The Sorter".
// Tap-to-sort drills: drop each item into the correct bin. Two high-yield
// NORCET sets to launch — Bio-Medical Waste segregation (BMW Rules 2016
// colour coding) and Isolation Precautions (transmission-based). Items are
// text + emoji (zero asset). Each item carries the rationale shown on review.
// Content is seed; easily extended as the question bank grows.
// =====================================================================
export const SORTER_CASES = [
  {
    id: 'bmw',
    title: 'Bio-Medical Waste',
    instruction: 'Segregate each item into the correct colour bin (BMW Rules 2016).',
    bins: [
      { id: 'yellow', label: 'Yellow', color: '#E0A500', hint: 'Anatomical / soiled / expired meds' },
      { id: 'red',    label: 'Red',    color: '#DC2626', hint: 'Contaminated recyclable plastic' },
      { id: 'white',  label: 'White',  color: '#64748B', hint: 'Sharps (puncture-proof)' },
      { id: 'blue',   label: 'Blue',   color: '#2563EB', hint: 'Glassware & metallic implants' },
    ],
    items: [
      { id: 'i1', text: 'Used needle (sharp)', emoji: '💉', bin: 'white', why: 'Sharps — needles, blades, scalpels — go in the WHITE translucent puncture-proof container.' },
      { id: 'i2', text: 'Blood-soaked dressing', emoji: '🩹', bin: 'yellow', why: 'Soiled/infectious solid waste goes in YELLOW (incineration).' },
      { id: 'i3', text: 'Empty IV set & tubing', emoji: '🧪', bin: 'red', why: 'Contaminated recyclable plastics — IV sets, tubing, catheters, gloves — go in RED.' },
      { id: 'i4', text: 'Broken glass ampoule', emoji: '🍶', bin: 'blue', why: 'Broken/discarded glass, vials and metallic implants go in BLUE.' },
      { id: 'i5', text: 'Placenta / anatomical waste', emoji: '🫀', bin: 'yellow', why: 'Human anatomical waste goes in YELLOW for incineration.' },
      { id: 'i6', text: 'Used examination gloves', emoji: '🧤', bin: 'red', why: 'Contaminated gloves are RED-bin recyclable plastic — a classic trap (not yellow).' },
      { id: 'i7', text: 'Expired tablets', emoji: '💊', bin: 'yellow', why: 'Discarded/expired medicines go in YELLOW.' },
      { id: 'i8', text: 'Scalpel blade', emoji: '🔪', bin: 'white', why: 'Blades are sharps → WHITE puncture-proof container.' },
    ],
  },
  {
    id: 'isolation',
    title: 'Isolation Precautions',
    instruction: 'Place each condition under its transmission-based precaution.',
    bins: [
      { id: 'airborne', label: 'Airborne', color: '#7C3AED', hint: 'N95 + negative-pressure room' },
      { id: 'droplet',  label: 'Droplet',  color: '#0891B2', hint: 'Surgical mask within 1 m' },
      { id: 'contact',  label: 'Contact',  color: '#16A34A', hint: 'Gown + gloves' },
    ],
    items: [
      { id: 'j1', text: 'Pulmonary Tuberculosis', emoji: '🫁', bin: 'airborne', why: 'TB spreads by tiny droplet nuclei → AIRBORNE: N95 + negative-pressure room.' },
      { id: 'j2', text: 'Measles', emoji: '🔴', bin: 'airborne', why: 'Measles (and varicella) are AIRBORNE — among the few that need N95.' },
      { id: 'j3', text: 'Influenza', emoji: '🤧', bin: 'droplet', why: 'Flu spreads by large respiratory droplets → DROPLET: surgical mask within ~1 m.' },
      { id: 'j4', text: 'Meningococcal meningitis', emoji: '🧠', bin: 'droplet', why: 'Neisseria meningitidis is DROPLET precaution (first 24 h of therapy).' },
      { id: 'j5', text: 'C. difficile diarrhoea', emoji: '🦠', bin: 'contact', why: 'C. difficile → CONTACT precautions + soap-and-water hand wash (alcohol gel won’t kill spores).' },
      { id: 'j6', text: 'MRSA wound', emoji: '🩹', bin: 'contact', why: 'MRSA spreads by direct/indirect contact → gown + gloves.' },
      { id: 'j7', text: 'Chickenpox (varicella)', emoji: '💧', bin: 'airborne', why: 'Varicella is AIRBORNE + contact — needs a negative-pressure room.' },
      { id: 'j8', text: 'Scabies', emoji: '🐛', bin: 'contact', why: 'Scabies spreads by skin contact → CONTACT precautions.' },
    ],
  },
];
