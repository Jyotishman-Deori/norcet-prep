// =====================================================================
// scripts/verify-locales-render.mjs — server-render the real Home screen
// under EVERY shipped locale (scripts/smoke/locales-entry.jsx does the
// work; this bundles it with the same esbuild+stubs recipe as the render
// smoke). Run after adding or editing any public/locales/*/ui.json:
//   node scripts/verify-locales-render.mjs
// Asserts per locale: translated strings reach the markup, no raw
// dot-namespaced key leaks, no em dash in output.
// =====================================================================
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const repo = process.cwd();
const { build } = createRequire(join(repo, 'package.json'))('esbuild');
const here = join(dirname(fileURLToPath(import.meta.url)), 'smoke');
const outdir = join(repo, 'node_modules', '.cache');
const outfile = join(outdir, 'locales-render.mjs');
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [join(here, 'locales-entry.jsx')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  nodePaths: [join(repo, 'node_modules')],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const SMOKE_ENV = {};" },
  define: { 'import.meta.env': 'SMOKE_ENV' },
  loader: { '.js': 'jsx' },
  logLevel: 'warning',
  plugins: [{
    name: 'smoke-stubs',
    setup(b) {
      b.onResolve({ filter: /app-context\.jsx$/ }, (args) => {
        if (args.importer.replace(/\\/g, '/').includes('scripts/smoke')) return undefined;
        return { path: join(here, 'stub-app-context.jsx') };
      });
      b.onResolve({ filter: /^\.\.\/storage$/ }, () => ({ path: join(here, 'stub-storage.js') }));
      b.onResolve({ filter: /^react-dom$/ }, () => ({ path: join(here, 'stub-react-dom.js') }));
      b.onResolve({ filter: /^REAL_REACT_DOM$/ }, () => ({ path: join(repo, 'node_modules', 'react-dom', 'index.js') }));
    },
  }],
});

const run = spawnSync(process.execPath, [outfile], { stdio: 'inherit', cwd: repo });
process.exit(run.status === null ? 1 : run.status);
