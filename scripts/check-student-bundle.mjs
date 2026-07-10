// =====================================================================
// scripts/check-student-bundle.mjs — student-bundle boundary guard.
//
// The student app must ship ZERO admin code (CLAUDE.md security section), but
// the only thing enforcing that today is tree-shaking from the separate
// main.jsx entry graph: one careless import from a student screen would
// silently pull an admin module into production. This gate makes that loud.
//
// It scans the student build output (dist/**/*.js, produced by the compile
// gate right before this runs) for string literals that exist ONLY in
// admin-side modules and survive minification (Edge-Function URLs + action
// names — minifiers never rename string contents).
//
// Phase A self-check: every sentinel must still appear somewhere under src/.
// If an action string gets renamed, the guard FAILS telling you to update the
// list, so it can never rot into a vacuous pass.
// Phase B scan: any sentinel found in dist/ fails the build, naming the file.
//
// Deliberately NOT sentinels (they live in the student graph legitimately):
//   referral-intel (share-app-card -> referral-stats), waitlist (student
//   waitlist-api uses the same URL), adminlog (storage.js prefix list).
// =====================================================================
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const SENTINELS = [
  'functions/v1/admin-manage',    // src/lib/admin.js + admin-ops.js (admin auth/governance)
  'functions/v1/content-staging', // src/lib/content-staging.js (AI drafting pipeline)
  'functions/v1/push-broadcast',  // src/ui/admin-push-composer.jsx
  'admin-approve',                // src/lib/waitlist-admin.js action literal
  'totp-enroll',                  // src/ui/admin-2fa.jsx / lib/admin.js action literal
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ---- Phase A: sentinels must still exist in src/ (guard can't go stale) ----
const srcFiles = walk(join(root, 'src')).filter(f => /\.(js|jsx|ts|tsx)$/.test(f));
const srcBlob = srcFiles.map(f => readFileSync(f, 'utf8')).join('\n');
const stale = SENTINELS.filter(s => !srcBlob.includes(s));
if (stale.length) {
  console.error('check-student-bundle: STALE SENTINELS (no longer found anywhere in src/):');
  for (const s of stale) console.error(`  - "${s}"`);
  console.error('An admin action/URL was renamed. Update SENTINELS in scripts/check-student-bundle.mjs.');
  process.exit(1);
}

// ---- Phase B: scan the student build output ----
const dist = join(root, 'dist');
if (!existsSync(dist)) {
  console.error('check-student-bundle: dist/ not found. Run the vite build first (npm test does).');
  process.exit(1);
}
const bundles = walk(dist).filter(f => f.endsWith('.js'));
let hits = 0;
for (const f of bundles) {
  const text = readFileSync(f, 'utf8');
  for (const s of SENTINELS) {
    if (text.includes(s)) {
      hits++;
      console.error(`check-student-bundle: ADMIN CODE IN STUDENT BUNDLE: "${s}" found in ${f.slice(root.length + 1)}`);
    }
  }
}
if (hits) {
  console.error('\nAn admin-only module leaked into the student build. Find the import that pulled it into the main.jsx graph and remove it.');
  process.exit(1);
}
console.log(`check-student-bundle: OK — ${bundles.length} bundle file(s) scanned, ${SENTINELS.length} sentinels absent.`);
