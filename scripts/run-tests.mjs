// =====================================================================
// scripts/run-tests.mjs — the project's `npm test` gate.
//
// 1. Runs every pure contract test under src/lib (*.test.js) with Node.
// 2. Runs the full-graph Vite production build as the compile gate
//    (target: 0 errors). This is the concrete stand-in for the
//    "esbuild bundle-with-stubs" gate described in CLAUDE.md.
//
// Wired to the Stop hook (.claude/hooks/test-gate.py) so changes can't be
// finished while a test or the build is broken. Auto-discovers test files,
// so new src/lib/*.test.js modules are picked up with no edit here.
// =====================================================================
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libDir = join(root, 'src', 'lib');

const tests = readdirSync(libDir).filter((f) => f.endsWith('.test.js')).sort();
let failed = 0;
for (const t of tests) {
  const r = spawnSync(process.execPath, [join(libDir, t)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
if (failed) {
  console.error(`\n${failed} test file(s) failed.`);
  process.exit(1);
}

// Runtime render smoke (scripts/smoke) — server-renders the real Knowledge
// Map screen, catching first-render crashes (e.g. TDZ in memo deps) that the
// compile gate can't see. See scripts/smoke/build.mjs for the incident note.
console.log('\n> knowledge-map render smoke');
const smoke = spawnSync(process.execPath, [join(root, 'scripts', 'smoke', 'build.mjs')], { stdio: 'inherit', cwd: root });
if (smoke.status !== 0) process.exit(1);

console.log('\n> vite build (compile gate)');
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const build = spawnSync(process.execPath, [viteBin, 'build'], { stdio: 'inherit', cwd: root });
if (build.status !== 0) process.exit(1);

console.log(`\nAll ${tests.length} test file(s) + render smoke + compile gate passed.`);
