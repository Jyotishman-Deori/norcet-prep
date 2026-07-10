// =====================================================================
// UI INTERNATIONALIZATION (i18n) — CHROME STRINGS ONLY
// ---------------------------------------------------------------------
// HARD RULE, codified for every future session:
//
//   TRANSLATED:       UI chrome only. Nav labels, buttons, headings,
//                     instructional text, toasts/errors, settings/help
//                     wrapper text. One namespace: ui.json. Nothing else.
//
//   NEVER TRANSLATED: question stems/options, explanations, concept
//                     cards, medical terminology, drug names, dosages,
//                     and anything that mirrors the real exam. NORCET is
//                     conducted in English; study content must match the
//                     exam verbatim, and a mistranslated clinical term is
//                     a patient-safety-grade error. Study content lives
//                     entirely OUTSIDE this system (src/lib/content.js,
//                     public/data/*, src/data/*) and must stay there.
//
//   Also never translated: nav-registry.js `keywords` (the search index
//   matches on them; translating them silently breaks search).
//
// Architecture — no i18n library, ~150 lines, mirrors content.js:
//   • English (src/locales/en.js) is bundled statically and is the
//     source of truth. Other locales are fetched lazily from
//     /locales/<code>/ui.json?v=LOCALE_VERSION, cached in IndexedDB via
//     safeStorage (memory -> IDB -> network) AND kept by the SW's
//     'locale-assets' runtime cache, then MERGED OVER English: a missing
//     key falls back to English, never renders blank.
//   • t(key, vars) is synchronous; {name} placeholders interpolate.
//   • Storage/DOM access is lazy and guarded so plain Node can import
//     this module (tests + render smoke).
//   • No em dashes (—) or "--" in any value, any language (project-wide
//     hard rule, enforced by scripts/check-locales.mjs).
// =====================================================================
import { EN } from '../locales/en.js';
import { KEYS } from './keys.js';

// Bump whenever ANY public/locales/*/ui.json or public/fonts/*.woff2
// changes. Busts the IndexedDB key, the network query, and the font URL
// at once (same contract as CONTENT_VERSION in content.js).
export const LOCALE_VERSION = 2;

// Ordered locale registry — all 16 languages (owner-approved 2026-07-09).
// `font` names a subsetted /fonts/<font>.woff2 built by
// scripts/build-locale-fonts.mjs; Latin-script locales ship no font.
// `bcp47` is what <html lang> gets (note: 'hin-en' itself is not valid
// BCP-47; Hinglish maps to hi-Latn; Assamese 'asm' maps to 'as').
export const LOCALES = [
  // `suggest` is the one-line "view in your language?" chip text shown on the
  // welcome screen BEFORE the language pack is downloaded, so it lives here
  // in the bundle, written in the target language itself.
  { code: 'en',     bcp47: 'en',      name: 'English',   native: 'English',   script: 'latin',      font: null,          tier: 0, suggest: null },
  { code: 'hi',     bcp47: 'hi',      name: 'Hindi',     native: 'हिन्दी',      script: 'devanagari', font: 'devanagari',  tier: 1, suggest: 'हिन्दी में देखें?' },
  { code: 'hin-en', bcp47: 'hi-Latn', name: 'Hinglish',  native: 'Hinglish',  script: 'latin',      font: null,          tier: 1, suggest: 'Hinglish mein dekhein?' },
  { code: 'bn',     bcp47: 'bn',      name: 'Bengali',   native: 'বাংলা',      script: 'bengali',    font: 'bengali',     tier: 1, suggest: 'বাংলায় দেখবেন?' },
  { code: 'ta',     bcp47: 'ta',      name: 'Tamil',     native: 'தமிழ்',      script: 'tamil',      font: 'tamil',       tier: 1, suggest: 'தமிழில் பார்க்கவா?' },
  { code: 'te',     bcp47: 'te',      name: 'Telugu',    native: 'తెలుగు',     script: 'telugu',     font: 'telugu',      tier: 1, suggest: 'తెలుగులో చూస్తారా?' },
  { code: 'mr',     bcp47: 'mr',      name: 'Marathi',   native: 'मराठी',      script: 'devanagari', font: 'devanagari',  tier: 1, suggest: 'मराठीत पाहायचे?' },
  { code: 'ml',     bcp47: 'ml',      name: 'Malayalam', native: 'മലയാളം',    script: 'malayalam',  font: 'malayalam',   tier: 1, suggest: 'മലയാളത്തിൽ കാണണോ?' },
  // ---- Tier 2 ----
  { code: 'pa',     bcp47: 'pa',      name: 'Punjabi',   native: 'ਪੰਜਾਬੀ',     script: 'gurmukhi',   font: 'gurmukhi',    tier: 2, suggest: 'ਪੰਜਾਬੀ ਵਿੱਚ ਵੇਖੋ?' },
  { code: 'gu',     bcp47: 'gu',      name: 'Gujarati',  native: 'ગુજરાતી',    script: 'gujarati',   font: 'gujarati',    tier: 2, suggest: 'ગુજરાતીમાં જુઓ?' },
  { code: 'kn',     bcp47: 'kn',      name: 'Kannada',   native: 'ಕನ್ನಡ',      script: 'kannada',    font: 'kannada',     tier: 2, suggest: 'ಕನ್ನಡದಲ್ಲಿ ನೋಡಿ?' },
  // (Urdu deliberately not shipped: owner dropped it 2026-07-09, so no RTL
  //  layout work is pending. If it ever returns it needs the RTL pass.)
  // ---- Northeast India ----
  { code: 'asm',    bcp47: 'as',      name: 'Assamese',  native: 'অসমীয়া',    script: 'bengali',    font: 'bengali',     tier: 3, suggest: 'অসমীয়াত চাওক?' },
  { code: 'mni',    bcp47: 'mni-Beng', name: 'Manipuri', native: 'মৈতৈলোন্',   script: 'bengali',    font: 'bengali',     tier: 3, suggest: null },
  { code: 'brx',    bcp47: 'brx',     name: 'Bodo',      native: 'बड़ो',       script: 'devanagari', font: 'devanagari',  tier: 3, suggest: null },
  { code: 'lus',    bcp47: 'lus',     name: 'Mizo',      native: 'Mizo ṭawng', script: 'latin',      font: null,          tier: 3, suggest: null },
  { code: 'nag',    bcp47: 'nag',     name: 'Nagamese',  native: 'Nagamese',  script: 'latin',      font: null,          tier: 3, suggest: null },
];

// System/Noto family per script for the CSS fallback chain. Android ships
// Noto Sans <Script>; iOS/Windows ship their own Indic system fonts behind
// the generic sans-serif, so text is never tofu even if our woff2 fails.
const SCRIPT_FALLBACKS = {
  devanagari: "'Noto Sans Devanagari'",
  bengali:    "'Noto Sans Bengali'",
  tamil:      "'Noto Sans Tamil'",
  telugu:     "'Noto Sans Telugu'",
  malayalam:  "'Noto Sans Malayalam'",
  gurmukhi:   "'Noto Sans Gurmukhi'",
  gujarati:   "'Noto Sans Gujarati'",
  kannada:    "'Noto Sans Kannada'",
};

const localeCacheKey = (code) => `locale:${code}:v${LOCALE_VERSION}`;

let _lang = 'en';
let _dict = EN;            // active merged dict (EN overlaid by the locale)
const _dicts = {};         // raw fetched dicts per code (session memory)
const _loadedFonts = new Set();
const _subs = new Set();
const _warned = new Set(); // one console.warn per missing key per session

// ---------------------------------------------------------------------
// Lookup. Synchronous: active dict -> English -> the raw key (visible in
// dev and in the render smoke, so a typo'd key is impossible to miss).
export function t(key, vars) {
  let s = _dict[key];
  if (typeof s !== 'string') s = EN[key];
  if (typeof s !== 'string') {
    if (!_warned.has(key)) {
      _warned.add(key);
      try { console.warn('[i18n] missing key: ' + key); } catch (e) {}
    }
    return key;
  }
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (m, name) =>
      vars[name] === undefined || vars[name] === null ? m : String(vars[name]));
  }
  return s;
}

export function getLang() { return _lang; }

export function getLocale(code) {
  return LOCALES.find(l => l.code === (code || _lang)) || null;
}

// Subscribe to language changes (App.jsx syncs React state through this).
export function onLangChange(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

// ---------------------------------------------------------------------
// Locale dict resolution — memory -> IndexedDB -> network, write-through
// (the exact ensureContent() shape from content.js). Storage is lazy-
// imported so Node can import this module without touching IndexedDB.
async function ensureLocale(code) {
  if (_dicts[code]) return _dicts[code];
  try {
    const { safeStorage } = await import('./safe-storage.js');
    const r = await safeStorage.get(localeCacheKey(code), false);
    if (r && r.value) {
      const parsed = JSON.parse(r.value);
      _dicts[code] = parsed;
      return parsed;
    }
  } catch (e) { /* miss / no IDB -> network */ }
  const res = await fetch(`/locales/${code}/ui.json?v=${LOCALE_VERSION}`);
  if (!res || !res.ok) throw new Error('locale fetch failed: ' + code + ' ' + (res && res.status));
  const text = await res.text();
  const parsed = JSON.parse(text);
  _dicts[code] = parsed;
  try {
    const { safeStorage } = await import('./safe-storage.js');
    await safeStorage.set(localeCacheKey(code), text, false);
  } catch (e) { /* best-effort cache */ }
  return parsed;
}

// Merge a raw locale dict over English, dropping bookkeeping keys (_meta).
function mergeOverEn(raw) {
  const out = { ...EN };
  for (const k in raw) {
    if (k.charCodeAt(0) === 95 /* '_' */) continue;
    if (typeof raw[k] === 'string') out[k] = raw[k];
  }
  return out;
}

// ---------------------------------------------------------------------
// Subsetted-font activation. Best-effort and non-blocking beyond a 3s
// race: font-display swap means late arrival just repaints. Each script
// gets its OWN family name so switching languages never piles conflicting
// glyph sets into one family. The override style tag uses `html .font-*`
// so it outranks the base .font-body/.font-display rules regardless of
// where the font-styles <style> sits in the document.
async function activateFont(loc) {
  if (typeof document === 'undefined') return;
  // Entirely best-effort: a font/DOM hiccup must never block the language
  // switch itself (the fallback chains keep text readable regardless).
  try {
    const el = document.getElementById('i18n-font-override');
    if (!loc || !loc.font) { if (el) el.remove(); return; }
    const family = 'NH ' + loc.script;
    try {
      if (typeof FontFace !== 'undefined' && document.fonts && !_loadedFonts.has(loc.font)) {
        const face = new FontFace(family,
          `url(/fonts/${loc.font}.woff2?v=${LOCALE_VERSION})`, { display: 'swap' });
        document.fonts.add(face);
        await Promise.race([face.load(), new Promise(r => setTimeout(r, 3000))]);
        _loadedFonts.add(loc.font);
      }
    } catch (e) { /* fallback chain covers a failed load */ }
    const noto = SCRIPT_FALLBACKS[loc.script] || '';
    const css =
      `html .font-body { font-family: '${family}', ${noto ? noto + ', ' : ''}'DM Sans', system-ui, sans-serif; }\n` +
      `html .font-display { font-family: '${family}', ${noto ? noto + ', ' : ''}'Fraunces', Georgia, serif; }\n` +
      // Indic matras/conjuncts clip under tight leading; explicit Tailwind
      // leading-* / text-* line-heights on inner elements still win.
      `html .font-body, html .font-display { line-height: 1.6; }`;
    const tag = el || document.createElement('style');
    tag.id = 'i18n-font-override';
    tag.textContent = css;
    if (!el) document.head.appendChild(tag);
  } catch (e) { /* never block setLocale on styling */ }
}

// ---------------------------------------------------------------------
function persist(code) {
  import('./safe-storage.js')
    .then(({ safeStorage }) => safeStorage.set(KEYS.LANG, code, false))
    .catch(() => {});
  try { localStorage.setItem(KEYS.LANG_HINT, code); } catch (e) {}
}

// Switch the active language. Throws only when a NEVER-downloaded locale
// cannot be fetched (offline first selection); state is unchanged then and
// the caller shows a retry affordance. Everything else is best-effort.
export async function setLocale(code) {
  const loc = getLocale(code);
  if (!loc) throw new Error('unknown locale: ' + code);
  _dict = code === 'en' ? EN : mergeOverEn(await ensureLocale(code));
  _lang = code;
  await activateFont(loc);
  persist(code);
  if (typeof document !== 'undefined') {
    try { document.documentElement.lang = loc.bcp47; } catch (e) {}
  }
  _subs.forEach(fn => { try { fn(code); } catch (e) {} });
}

// Boot restore, awaited (with a timeout race) in main.jsx before first
// render. The localStorage hint gives an instant answer; the IndexedDB
// record stays authoritative (covers cleared localStorage). Never throws.
export async function loadI18n() {
  let hint = null;
  try { hint = localStorage.getItem(KEYS.LANG_HINT); } catch (e) {}
  if (hint && hint !== 'en' && getLocale(hint)) {
    try { await setLocale(hint); } catch (e) { /* dict gone; stay English */ }
  }
  try {
    const { safeStorage } = await import('./safe-storage.js');
    const r = await safeStorage.get(KEYS.LANG, false);
    const saved = r && r.value;
    if (saved && saved !== _lang && getLocale(saved)) await setLocale(saved);
  } catch (e) { /* stay on whatever we have */ }
}

// Storage headroom probe for the language page: warn (never block) when
// the device is nearly full, so a user knows the pack may not persist
// offline. ok:true when the API is unavailable.
export async function checkStorageHeadroom() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
      return { ok: true, usageMB: 0, quotaMB: 0 };
    }
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const usageMB = Math.round(usage / 1048576);
    const quotaMB = Math.round(quota / 1048576);
    const low = quota > 0 && (quota - usage < 5 * 1048576 || usage / quota > 0.9);
    return { ok: !low, usageMB, quotaMB };
  } catch (e) {
    return { ok: true, usageMB: 0, quotaMB: 0 };
  }
}

// ---------------------------------------------------------------------
// Test hooks (Node contract tests only).
export function _resetForTest() {
  _lang = 'en';
  _dict = EN;
  for (const k in _dicts) delete _dicts[k];
  _subs.clear();
  _warned.clear();
  _loadedFonts.clear();
}
export function _seedDictForTest(code, dict) { _dicts[code] = dict; }
