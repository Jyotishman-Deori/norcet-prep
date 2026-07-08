// =====================================================================
// scripts/smoke/build.mjs — RUNTIME render smoke for the high-traffic screens
// (home, quiz, settings, level-up, learn-topics, knowledge-map — the list
// lives in entry.jsx).
//
// `node scripts/smoke/build.mjs` (from the repo root) bundles the REAL
// screen modules with esbuild (stubbing only app-context and the low-level
// storage module) and server-renders each once via react-dom/server. This
// executes every component body — every hook call, every useMemo factory AND
// its deps array — so use-before-declaration TDZ crashes throw here instead
// of in production. Born from the 2026-07-08 incident: `fogSet` was added to
// the kmapScene memo deps while still declared below the memo; `npm test`
// (build-only compile gate) passed, but every map open crashed live with
// "Cannot access 'qe' before initialization". Build gates can't catch that;
// only rendering can. To cover a new screen: add one entry to SCREENS in
// entry.jsx with props mirroring its App.jsx dispatch site.
// =====================================================================
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const repo = process.cwd();
const { build } = createRequire(join(repo, 'package.json'))('esbuild');
const here = dirname(fileURLToPath(import.meta.url));
const outdir = join(repo, 'node_modules', '.cache');
const outfile = join(outdir, 'kmap-smoke.mjs');
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [join(here, 'entry.jsx')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  nodePaths: [join(repo, 'node_modules')],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const SMOKE_ENV = {};" },
  // Vite substitutes import.meta.env at build time; in this Node bundle it
  // must exist (empty — modules already guard for missing VITE_ values).
  define: { 'import.meta.env': 'SMOKE_ENV' },
  loader: { '.js': 'jsx' },
  logLevel: 'warning',
  plugins: [{
    name: 'smoke-stubs',
    setup(b) {
      b.onResolve({ filter: /app-context\.jsx$/ }, (args) => {
        // the stub itself must not be re-stubbed
        if (args.importer.replace(/\\/g, '/').includes('scripts/smoke')) return undefined;
        return { path: join(here, 'stub-app-context.jsx') };
      });
      b.onResolve({ filter: /^\.\.\/storage$/ }, () => ({ path: join(here, 'stub-storage.js') }));
      b.onResolve({ filter: /^react-dom$/ }, () => ({ path: join(here, 'stub-react-dom.js') }));
      b.onResolve({ filter: /^REAL_REACT_DOM$/ }, () => ({ path: join(repo, 'node_modules', 'react-dom', 'index.js') }));
    },
  }],
});

const run = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
process.exit(run.status === null ? 1 : run.status);
