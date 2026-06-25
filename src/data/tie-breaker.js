// =====================================================================
// src/data/tie-breaker.js — NEW-06 "Tie-Breaker".
// The hardest NORCET trap: TWO options are both reasonable — pick the one that
// comes FIRST. Each pair trains an explicit prioritisation framework (ABC,
// Maslow, Safety-first, Acute-over-chronic, Assess-before-act). Seed content;
// complements the single-best-answer bank rather than duplicating it.
//   answer: 'a' | 'b' (the priority); principle: framework that decides it.
// =====================================================================
export const TIE_BREAKERS = [
  {
    id: 't1', principle: 'ABC',
    scenario: 'A post-operative patient is becoming restless. You can only do one thing first.',
    a: 'Check the airway & breathing',
    b: 'Assess the surgical wound for bleeding',
    answer: 'a',
    why: 'Airway and breathing (A & B) always outrank circulation/wound checks. Restlessness is an early sign of hypoxia — clear the airway and assess breathing before anything else.',
  },
  {
    id: 't2', principle: 'ABC',
    scenario: 'A burns victim arrives with singed nasal hair and a soot-stained mouth, plus extensive arm burns.',
    a: 'Dress and cool the arm burns',
    b: 'Secure and assess the airway',
    answer: 'b',
    why: 'Singed nasal hair = inhalation injury → the airway can swell shut within minutes. Airway beats the wound every time (ABC). Cooling the burns comes after the airway is safe.',
  },
  {
    id: 't3', principle: 'Circulation',
    scenario: 'During a dressing change the wound starts spurting bright red blood and the patient also complains of pain.',
    a: 'Apply firm direct pressure to the bleed',
    b: 'Administer the prescribed analgesia',
    answer: 'a',
    why: 'Active haemorrhage is a circulation (C) emergency — control it with direct pressure first. Pain relief, though important, is never prioritised over stopping a significant bleed.',
  },
  {
    id: 't4', principle: 'Maslow',
    scenario: 'You are planning care for two needs in the same patient.',
    a: 'Reposition the breathless patient upright to ease breathing',
    b: 'Sit and address the patient’s anxiety about surgery',
    answer: 'a',
    why: 'Maslow: physiological needs (oxygenation) sit below psychosocial needs (anxiety). Relieve the breathlessness first, then attend to the emotional need.',
  },
  {
    id: 't5', principle: 'Safety first',
    scenario: 'A confused, high fall-risk patient is climbing over the bed rails while another patient wants a blanket.',
    a: 'Fetch the second patient a blanket',
    b: 'Make the climbing patient safe (lower bed, call for help)',
    answer: 'b',
    why: 'Immediate physical safety / injury prevention outranks a comfort request. An unattended fall risk can cause serious harm in seconds.',
  },
  {
    id: 't6', principle: 'Acute over chronic',
    scenario: 'Two patients need review on your round.',
    a: 'A patient with new-onset confusion and a falling SpO₂',
    b: 'A patient with long-standing, stable immobility',
    answer: 'a',
    why: 'Acute, changing, unstable problems are seen before chronic, stable ones. New confusion + dropping oxygen signals deterioration that needs immediate attention.',
  },
  {
    id: 't7', principle: 'Assess before act',
    scenario: 'A patient reports sudden chest pain in the ward.',
    a: 'Give a PRN GTN tablet straight away',
    b: 'Take vital signs & a 12-lead ECG first',
    answer: 'b',
    why: 'Assessment precedes intervention. You need vitals and an ECG to know what you are treating (and whether GTN is even safe — it can crash the BP in an inferior MI).',
  },
  {
    id: 't8', principle: 'Unstable first',
    scenario: 'Post-transfusion, you must respond to two events at once.',
    a: 'A patient with new fever, rigors and low back pain mid-transfusion',
    b: 'A patient asking for help to the toilet',
    answer: 'a',
    why: 'A possible acute haemolytic reaction is life-threatening — stop the transfusion and act immediately. The unstable, deteriorating patient is always seen first.',
  },
  {
    id: 't9', principle: 'Do then delegate',
    scenario: 'You find a patient unresponsive and not breathing normally.',
    a: 'Start chest compressions / call for the arrest team',
    b: 'Leave to find the doctor and explain',
    answer: 'a',
    why: 'In an arrest, begin CPR and trigger the emergency call simultaneously — never abandon the patient to go fetch someone. Act first, delegate the call.',
  },
  {
    id: 't10', principle: 'Airway in trauma',
    scenario: 'An unconscious patient is lying supine and beginning to gurgle.',
    a: 'Reposition / suction to protect the airway',
    b: 'Document the GCS in the notes',
    answer: 'a',
    why: 'A gurgling, unprotected airway in an unconscious patient is an emergency — position and suction now. Documentation, while required, never precedes a threatened airway.',
  },
];
