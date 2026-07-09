// Post-build for the admin app. Two jobs:
//
// 1) Vite emits the entry as `admin.html` (named after the input), but a static
//    host serves `index.html` at `/`. Rename it so the admin app loads at the
//    site root (admin.nurseholic.in / norcet-admin.vercel.app).
//
// 2) Pin the Vercel project link. `npm run deploy:admin` runs
//    `vercel --cwd dist-admin deploy --prod`, and Vite empties dist-admin on
//    every build — so without this, the deploy has no link and Vercel falls
//    back to git-detecting the repo, which resolves to the STUDENT project
//    (norcet-prep) and silently deploys there. Writing .vercel/project.json
//    here forces every admin deploy to target norcet-admin.
//    (Vercel project/org IDs are NOT secrets — safe to commit.)
import { renameSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

const from = 'dist-admin/admin.html';
const to = 'dist-admin/index.html';
if (existsSync(from)) {
  renameSync(from, to);
  console.log('[post-admin-build] dist-admin/admin.html -> index.html');
} else if (existsSync(to)) {
  console.log('[post-admin-build] dist-admin/index.html already present');
} else {
  console.warn('[post-admin-build] no dist-admin/admin.html found — did the build run?');
}

// Pin the deploy target to the standalone admin project.
const ADMIN_PROJECT = {
  projectId: 'prj_VGc7u1hNPaiZRBjs3WCYxYE4hphL',
  orgId: 'team_TSl6WqpmoaXAXFAaG3KPtLh9',
  projectName: 'norcet-admin',
};
try {
  mkdirSync('dist-admin/.vercel', { recursive: true });
  writeFileSync('dist-admin/.vercel/project.json', JSON.stringify(ADMIN_PROJECT));
  console.log('[post-admin-build] pinned Vercel link -> norcet-admin');
} catch (e) {
  console.warn('[post-admin-build] could not write .vercel/project.json:', e.message);
}

// 3) Anti-clone/anti-sniff security headers for the admin deploy (the student
//    app gets these from the repo-root vercel.json; the admin app deploys
//    from dist-admin, so its config must be generated into the output).
const ADMIN_VERCEL_CONFIG = {
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
};
try {
  writeFileSync('dist-admin/vercel.json', JSON.stringify(ADMIN_VERCEL_CONFIG, null, 2));
  console.log('[post-admin-build] wrote security headers -> dist-admin/vercel.json');
} catch (e) {
  console.warn('[post-admin-build] could not write vercel.json:', e.message);
}
