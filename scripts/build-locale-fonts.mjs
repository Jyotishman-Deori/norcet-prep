// =====================================================================
// scripts/build-locale-fonts.mjs — subsetted Indic UI fonts (I18N).
//
// For each non-Latin SCRIPT used by a shipped locale, this builds one
// public/fonts/<script>.woff2 containing ONLY the glyphs the UI strings
// of that script's languages actually use (plus ASCII, digits and common
// punctuation), keeping each file in the ~20-80KB range instead of the
// 200-600KB full Noto files. lib/i18n.js loads them lazily via FontFace
// when a language is activated; system Noto fonts are the fallback, so a
// missing/failed file can never produce tofu.
//
// RE-RUN THIS SCRIPT whenever any public/locales/*/ui.json changes:
//   node scripts/build-locale-fonts.mjs
// New translated glyphs that aren't in the subset silently fall back to
// the system font (ugly mix, not broken) — regenerating fixes it.
//
// Requirements: Python 3 with `pip install fonttools brotli` (pyftsubset
// runs as `python -m fontTools.subset`). --layout-features='*' is
// MANDATORY: Indic shaping (conjuncts, reph, matra reordering) lives in
// GSUB/GPOS and default feature pruning silently breaks rendering in
// ways a non-reader won't notice.
//
// Sources: Google Fonts' variable Noto TTFs, cached in scripts/.font-src/
// (gitignored). Before subsetting, varLib.instancer pins wdth=100 and
// clamps wght to 400:700 — dropping the unused width-axis deltas halves
// the file while keeping REAL variable bold for headings (unpinned
// variable Devanagari subset: 152KB; instanced: ~60KB).
// =====================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'scripts', '.font-src');
const outDir = join(root, 'public', 'fonts');
mkdirSync(srcDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl';
// script id → { locales that use it, variable-font source }
const SCRIPTS = {
  // Shared-script unions: Assamese + Manipuri(Bengali script) ride in
  // bengali.woff2; Bodo rides in devanagari.woff2. Their glyphs join the
  // subset automatically once their ui.json exists.
  devanagari: { locales: ['hi', 'mr', 'brx'],   file: 'NotoSansDevanagari[wdth,wght].ttf', url: `${GF}/notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf` },
  bengali:    { locales: ['bn', 'asm', 'mni'],  file: 'NotoSansBengali[wdth,wght].ttf',    url: `${GF}/notosansbengali/NotoSansBengali%5Bwdth%2Cwght%5D.ttf` },
  tamil:      { locales: ['ta'],                file: 'NotoSansTamil[wdth,wght].ttf',      url: `${GF}/notosanstamil/NotoSansTamil%5Bwdth%2Cwght%5D.ttf` },
  telugu:     { locales: ['te'],                file: 'NotoSansTelugu[wdth,wght].ttf',     url: `${GF}/notosanstelugu/NotoSansTelugu%5Bwdth%2Cwght%5D.ttf` },
  malayalam:  { locales: ['ml'],                file: 'NotoSansMalayalam[wdth,wght].ttf',  url: `${GF}/notosansmalayalam/NotoSansMalayalam%5Bwdth%2Cwght%5D.ttf` },
  gurmukhi:   { locales: ['pa'],                file: 'NotoSansGurmukhi[wdth,wght].ttf',   url: `${GF}/notosansgurmukhi/NotoSansGurmukhi%5Bwdth%2Cwght%5D.ttf` },
  gujarati:   { locales: ['gu'],                file: 'NotoSansGujarati[wdth,wght].ttf',   url: `${GF}/notosansgujarati/NotoSansGujarati%5Bwdth%2Cwght%5D.ttf` },
  kannada:    { locales: ['kn'],                file: 'NotoSansKannada[wdth,wght].ttf',    url: `${GF}/notosanskannada/NotoSansKannada%5Bwdth%2Cwght%5D.ttf` },
};

// Always-included repertoire: ASCII (mixed English words/numbers inside
// translated strings), curly quotes, ellipsis, en dash (ranges), rupee,
// middot, danda/double-danda and zero-width joiners used by Indic text.
const BASE_CHARS = (() => {
  let s = '';
  for (let c = 0x20; c <= 0x7e; c++) s += String.fromCharCode(c);
  return s + '‘’“”…–₹·।॥‌‍×';
})();

function localeValues(code) {
  const p = join(root, 'public', 'locales', code, 'ui.json');
  if (!existsSync(p)) return null;
  const dict = JSON.parse(readFileSync(p, 'utf8'));
  return Object.entries(dict).filter(([k]) => !k.startsWith('_')).map(([, v]) => String(v)).join('');
}

async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 0) return;
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// Preflight: python + fontTools + brotli.
{
  const probe = spawnSync('python', ['-c', 'import fontTools, brotli'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    console.error('Python with fonttools + brotli is required:\n  pip install fonttools brotli');
    process.exit(1);
  }
}

let failed = 0;
for (const [script, cfg] of Object.entries(SCRIPTS)) {
  const texts = cfg.locales.map(localeValues).filter(Boolean);
  if (texts.length === 0) {
    console.log(`skip ${script}: no locale files present yet (${cfg.locales.join(', ')})`);
    continue;
  }
  const chars = Array.from(new Set(Array.from(BASE_CHARS + texts.join('')))).join('');
  const glyphFile = join(srcDir, `glyphs-${script}.txt`);
  writeFileSync(glyphFile, chars, 'utf8');

  const src = join(srcDir, cfg.file);
  try { await download(cfg.url, src); }
  catch (e) { console.error(`FAIL ${script}: ${e.message}`); failed++; continue; }

  // Pin the width axis, clamp weight to the range the UI actually uses.
  // Not every Noto has a wdth axis — fall back to wght-only pinning.
  const instanced = join(srcDir, `instanced-${script}.ttf`);
  let inst = spawnSync('python', [
    '-m', 'fontTools.varLib.instancer', src, 'wdth=100', 'wght=400:700',
    '-o', instanced,
  ], { encoding: 'utf8' });
  if (inst.status !== 0) {
    inst = spawnSync('python', [
      '-m', 'fontTools.varLib.instancer', src, 'wght=400:700',
      '-o', instanced,
    ], { encoding: 'utf8' });
  }
  if (inst.status !== 0) {
    console.error(`FAIL ${script}: instancer exited ${inst.status}\n${inst.stderr}`);
    failed++;
    continue;
  }

  const out = join(outDir, `${script}.woff2`);
  const r = spawnSync('python', [
    '-m', 'fontTools.subset', instanced,
    `--text-file=${glyphFile}`,
    '--layout-features=*',          // Indic shaping tables — never prune
    '--flavor=woff2',
    '--desubroutinize',
    '--no-hinting',
    `--output-file=${out}`,
  ], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`FAIL ${script}: pyftsubset exited ${r.status}\n${r.stderr}`);
    failed++;
    continue;
  }
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`ok   ${script}.woff2  ${kb} KB  (${chars.length} chars, locales: ${cfg.locales.join('+')})`);
  if (kb > 90) console.warn(`     WARNING: ${script}.woff2 is above the 80KB target`);
}
if (failed) process.exit(1);
console.log('font subsetting complete → public/fonts/');
