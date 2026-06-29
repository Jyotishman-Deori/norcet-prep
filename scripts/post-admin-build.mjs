// Post-build for the admin app: Vite emits the entry as `admin.html` (named
// after the input), but a static host serves `index.html` at `/`. Rename it so
// the admin app loads at the site root (admin.nurseholic.in / *.vercel.app).
import { renameSync, existsSync } from 'node:fs';

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
