// =====================================================================
// src/lib/themes.js — base theme palettes (A1 slice 20)
// Extracted VERBATIM from App.jsx (the `// THEME` block). Pure colour-token
// objects, no deps. Consumed by App (the THEMES map, the T/IS_DARK bridge,
// the theme-mode setters, the hex guard) and by screens that need BOTH
// palettes at once (e.g. WelcomeScreen's light+dark nav swatches).
// =====================================================================

export const LIGHT_THEME = {
  bg: '#FBF7ED',
  surface: '#FFFFFF',
  surfaceWarm: '#F5EFDF',
  ink: '#1A2B23',
  inkSoft: '#3A4A40',
  muted: '#7A7263',
  primary: '#0F4C4C',
  primarySoft: '#1A6868',
  accent: '#D45A3F',
  accentSoft: '#E68B72',
  success: '#2D7A4F',
  successSoft: '#E7F3EB',
  error: '#C04A2E',
  errorSoft: '#FBE8DF',
  border: '#E8DFC9',
  borderSoft: '#F0E8D2',
  // Section accents — muted, earthy, harmonious with primary/accent
  sec: {
    quick:    '#0F4C4C',  // forest teal
    topic:    '#C6553D',  // muted terracotta
    mock:     '#2D7A4F',  // forest green
    advanced: '#1A2B23',  // ink
    learn:    '#7A4A2E',  // walnut
    revision: '#5A3A6A',  // dusty plum
    library:  '#3A5A2E',  // sage
    stats:    '#3D5A7A'   // dusty blue
  }
};

export const DARK_THEME = {
  // Warm-charcoal neutrals with clear, perceptible elevation steps so cards
  // visibly lift off the background instead of blending into it.
  bg: '#15130F',          // deep warm near-black (was a muddy brown)
  surface: '#211D17',     // raised card — clearly separated from bg
  surfaceWarm: '#2B2620', // second elevation step / warm panel
  // Text: crisp warm-white primary, clearly-stepped secondary + tertiary.
  ink: '#F3EEE3',         // ~13:1 on bg — sharp without pure-white glare
  inkSoft: '#CFC8B7',     // secondary headings/labels (~9:1)
  muted: '#A69E8C',       // tertiary text — lifted to stay readable (~6:1)
  // Brand: primary is deep enough that the hard-coded white button/icon text
  // reads on it, while still vivid as a foreground accent on dark.
  primary: '#1F8A7C',
  primarySoft: '#34A695',
  accent: '#DD6450',
  accentSoft: '#B84A33',
  success: '#46AE72',
  successSoft: '#14271B',  // dark green tint for success backgrounds
  error: '#E0664C',
  errorSoft: '#30150F',    // dark red tint for error backgrounds
  border: '#3A332B',       // visible but subtle hairline
  borderSoft: '#2A251F',   // faint divider
  // Section accents — medium tones tuned to work BOTH as solid fills with
  // white icons (home tiles) AND as readable foreground on dark surfaces.
  // `advanced` stays light on purpose: its featured card draws dark text on it.
  sec: {
    quick:    '#258B7E',  // deep teal
    topic:    '#CF5B42',  // terracotta
    mock:     '#34965E',  // forest green
    advanced: '#DBD4C4',  // warm light (featured card uses dark text)
    learn:    '#A66E45',  // walnut
    revision: '#8E6FA4',  // dusty plum
    library:  '#5F8A4C',  // sage
    stats:    '#4E78A8'   // dusty blue
  }
};
