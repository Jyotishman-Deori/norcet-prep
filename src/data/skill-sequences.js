// =====================================================================
// src/data/skill-sequences.js — NEW-10 (Module B) built-in content for the
// Clinical Skill Sequence drill. Each scenario's `steps` array IS the correct
// chronological order; the drill shuffles them for display and checks the
// learner's order against this. High-yield, unambiguous NORCET sequences only.
// =====================================================================
export const SKILL_SEQUENCES = [
  {
    id: 'ppe-don',
    patientTag: 'Bed 2 · Isolation Ward',
    scenario: 'You are entering the room of a patient with confirmed H1N1 influenza. Put the PPE donning steps in the correct order.',
    steps: [
      { id: 's1', text: 'Perform hand hygiene' },
      { id: 's2', text: 'Put on the gown' },
      { id: 's3', text: 'Put on the N95 respirator' },
      { id: 's4', text: 'Put on goggles / face shield' },
      { id: 's5', text: 'Put on gloves' },
    ],
    rationale: 'WHO/CDC donning order: hand hygiene first, then gown, then respirator/mask, then eye protection, and gloves LAST (so they stay clean and cover the gown cuffs).',
  },
  {
    id: 'ppe-doff',
    patientTag: 'Bed 2 · Isolation Ward',
    scenario: 'You are leaving the isolation room. Put the PPE removal (doffing) steps in the correct order.',
    steps: [
      { id: 's1', text: 'Remove gloves' },
      { id: 's2', text: 'Remove goggles / face shield' },
      { id: 's3', text: 'Remove the gown' },
      { id: 's4', text: 'Leave the room, then remove the N95 respirator' },
      { id: 's5', text: 'Perform hand hygiene' },
    ],
    rationale: 'The most contaminated items come off first: gloves, then goggles, then gown. The respirator is removed AFTER leaving the room (it protected you from airborne spread inside). Hand hygiene is always the final step.',
  },
  {
    id: 'bls-adult',
    patientTag: 'Corridor · Adult collapsed',
    scenario: 'An adult has suddenly collapsed in front of you. Put the Basic Life Support steps in the correct order.',
    steps: [
      { id: 's1', text: 'Check the scene is safe' },
      { id: 's2', text: 'Check responsiveness (tap & shout)' },
      { id: 's3', text: 'Activate the emergency response / call for help' },
      { id: 's4', text: 'Check breathing and carotid pulse (≤10s)' },
      { id: 's5', text: 'Start chest compressions (30:2)' },
    ],
    rationale: 'BLS sequence: ensure scene safety, check responsiveness, call for help/defibrillator, then assess pulse & breathing for no more than 10 seconds — if absent, begin high-quality chest compressions immediately (C-A-B).',
  },
  {
    id: 'med-admin',
    patientTag: 'Bed 7 · Med round',
    scenario: 'You are about to give an oral medication. Put the safe administration steps in the correct order.',
    steps: [
      { id: 's1', text: 'Verify the medication order' },
      { id: 's2', text: 'Check the "rights" (patient, drug, dose, route, time)' },
      { id: 's3', text: 'Perform hand hygiene' },
      { id: 's4', text: 'Identify the patient with two identifiers' },
      { id: 's5', text: 'Administer the medication' },
      { id: 's6', text: 'Document immediately after giving' },
    ],
    rationale: 'Confirm the order and the rights before going to the bedside, perform hand hygiene, positively identify the patient with two identifiers, administer, then document right after (never before giving, never long after).',
  },
  {
    id: 'trach-suction',
    patientTag: 'ICU · Bed 4 · Tracheostomy',
    scenario: 'A patient with a tracheostomy needs suctioning. Put the key steps in the correct order.',
    steps: [
      { id: 's1', text: 'Perform hand hygiene and don sterile gloves' },
      { id: 's2', text: 'Pre-oxygenate the patient (100% O₂)' },
      { id: 's3', text: 'Insert the catheter WITHOUT applying suction' },
      { id: 's4', text: 'Apply intermittent suction while withdrawing (≤10s)' },
      { id: 's5', text: 'Re-oxygenate and allow the patient to recover' },
    ],
    rationale: 'Hand hygiene + sterile technique, pre-oxygenate, insert without suction (suctioning on the way in damages mucosa and removes O₂), apply intermittent suction on withdrawal for ≤10 seconds, then re-oxygenate.',
  },
  {
    id: 'iv-cannula',
    patientTag: 'Day ward · IV access',
    scenario: 'You are inserting a peripheral IV cannula. Put the steps in the correct order.',
    steps: [
      { id: 's1', text: 'Apply the tourniquet and select a vein' },
      { id: 's2', text: 'Perform hand hygiene and clean the site' },
      { id: 's3', text: 'Insert the cannula at 15–30°' },
      { id: 's4', text: 'Release the tourniquet' },
      { id: 's5', text: 'Secure the cannula and flush' },
    ],
    rationale: 'Apply tourniquet to find a vein, decontaminate hands and the site (asepsis), insert at a shallow angle until flashback, RELEASE the tourniquet before connecting (to prevent blowing the vein / spillage), then secure and flush to confirm patency.',
  },
];
