// =====================================================================
// src/data/study-methods.js  (Feature F-A — Study Methods Section)
// The 6 science-backed study methods, in intentional order (1→6): how to
// first approach material → how to make it stick long-term. Pure data; the
// screen (src/screens/study-methods.jsx) renders it. Mentor voice.
//
// `nav` is the deep-link target passed to handleHomeNavigate when the user
// taps "Go to feature" — mapped to the NEAREST EXISTING screen (the prompt's
// tool names like "SQ3R tool" don't exist as separate screens).
// `statKind` selects which real progress signal the list row shows (computed
// in App from data.stats / history — never fabricated).
// =====================================================================

export const STUDY_METHODS = [
  {
    id: 'sq3r',
    n: 1,
    name: 'How to Read a Textbook',
    feature: 'SQ3R reading',
    hook: 'Most students open a textbook and start reading from page one. Their brain has zero context. There is a better way.',
    science: 'The SQ3R method — Survey, Question, Read, Recall, Review — means you technically go through the material four to five times in different ways, and each pass makes the next one stronger.',
    stat: 'Remember more from one read-through than most people do after reading three times.',
    application: 'Before reading a pharmacology chapter, flip through and look at every heading and bold term first. Turn each heading into a question. Then read. Then close the book and answer your questions out loud.',
    nav: { screen: 'learn-topics' },
    goLabel: 'Open Learn topics',
    statKind: 'reading',
  },
  {
    id: 'why',
    n: 2,
    name: 'How to Understand Deeply',
    feature: 'Ask "why is this true?"',
    hook: 'Reading forward feels productive. It is not. Pausing to ask why is where understanding actually happens.',
    science: 'Elaborative interrogation — asking "why is this true?" after each concept — forces your brain to connect new information to what it already knows, which is how real understanding forms.',
    stat: 'Improves understanding by 40% compared to passive reading.',
    application: 'After reading about a drug mechanism, stop and ask: why does this drug work this way? What does it do to the body? If you cannot answer it, you do not understand it yet.',
    nav: { screen: 'learn-topics' },
    goLabel: 'Open Learn topics',
    statKind: 'accuracy',
  },
  {
    id: 'recall',
    n: 3,
    name: 'How to Remember What You Read',
    feature: 'Active recall',
    hook: 'Rereading your notes feels safe. But your brain is not learning — it is just recognising. There is a difference.',
    science: 'Active recall — closing your notes and retrieving everything from memory — forces your brain to actually pull the information back, which strengthens the memory far more than re-reading ever can.',
    stat: 'Retain 80% more than re-reading the same notes three more times.',
    application: 'After studying a nursing procedure or anatomy unit, close everything and write out every point you remember. Then check. Whatever you missed is exactly what needs more attention.',
    nav: { screen: 'quick-setup' },
    goLabel: 'Start a quick test',
    statKind: 'attempted',
  },
  {
    id: 'spaced',
    n: 4,
    name: 'How to Never Forget',
    feature: 'Spaced repetition',
    hook: 'Studying something once and moving on is why you forget it by exam day. Timing your reviews changes everything.',
    science: 'Spaced repetition reviews material at increasing intervals — 24 hours, 3 days, 7 days, 21 days — moving information from short-term to long-term memory before it fades.',
    stat: 'Move 95% of studied material into long-term memory instead of forgetting it by next week.',
    application: 'Every topic you study today gets a review tomorrow, then in 3 days, then in a week. The app handles the scheduling — you just show up for the review when it is due.',
    nav: { screen: 'quiz', mode: 'review-due' },
    goLabel: 'Review what is due',
    statKind: 'due',
  },
  {
    id: 'interleave',
    n: 5,
    name: 'How to Study Smarter, Not Longer',
    feature: 'Interleaving',
    hook: 'Studying one subject for two hours feels efficient. Your test scores say otherwise.',
    science: 'Interleaving — mixing different subjects within a single session — forces your brain to keep switching context, which builds stronger, more flexible recall than studying one block at a time.',
    stat: 'Score up to 76% better on tests compared to studying one subject at a time.',
    application: 'Instead of two hours of anatomy, do 20 minutes of anatomy, then pharmacology, then medical-surgical, then back. In a quick test, leave the topic on "All" so subjects come mixed.',
    nav: { screen: 'quick-setup' },
    goLabel: 'Start a mixed test',
    statKind: 'coverage',
  },
  {
    id: 'testing',
    n: 6,
    name: 'How to Lock It In',
    feature: 'Self-quizzing',
    hook: 'Testing yourself before you feel ready feels uncomfortable. That discomfort is your brain actually learning.',
    science: 'The testing effect (retrieval practice) shows that attempting to recall information — even incorrectly — produces stronger long-term memory than reviewing the same material perfectly five more times.',
    stat: 'Remember it better than if you revised it perfectly five more times.',
    application: 'After every unit, attempt the quiz immediately — even if you just studied it and feel unsure. Getting questions wrong is not failure. It is the most efficient form of learning available to you.',
    nav: { screen: 'quick-setup' },
    goLabel: 'Start a quick test',
    statKind: 'streak',
  },
];
