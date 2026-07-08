// =====================================================================
// scripts/smoke/build.mjs — RUNTIME render smoke for the Knowledge Map.
//
// `node scripts/smoke/build.mjs` (from the repo root) bundles the REAL
// src/screens/knowledge-map.jsx with esbuild (stubbing only app-context and
// the low-level storage module) and server-renders it once via
// react-dom/server. This executes the whole component body — every hook
// call, every useMemo factory AND its deps array — so use-before-declaration
// TDZ crashes throw here instead of in production. Born from the 2026-07-08
// incident: `fogSet` was added to the kmapScene memo deps while still
// declared below the memo; `npm test` (build-only compile gate) passed, but
// every map open crashed live with "Cannot access 'qe' before
// initialization". Build gates can't catch that; only rendering can.
// =====================================================================
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const repo = process.cwd();
const { build } = createRequire(join(repo, 'package.json'))('esbuild');
const here = dirname(fileURLToPath(import.meta.url));
const screen = resolve(repo, 'src/screens/knowledge-map.jsx');
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
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  loader: { '.js': 'jsx' },
  logLevel: 'warning',
  plugins: [{
    name: 'smoke-stubs',
    setup(b) {
      b.onResolve({ filter: /^KMAP_SCREEN$/ }, () => ({ path: screen }));
      b.onResolve({ filter: /app-context\.jsx$/ }, (args) => {
        // the stub itself must not be re-stubbed
        if (args.importer.replace(/\\/g, '/').includes('scripts/smoke')) return undefined;
        return { path: join(here, 'stub-app-context.jsx') };
      });
      b.onResolve({ filter: /^\.\.\/storage$/ }, () => ({ path: join(here, 'stub-storage.js') }));
    },
  }],
});

const run = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
process.exit(run.status === null ? 1 : run.status);
