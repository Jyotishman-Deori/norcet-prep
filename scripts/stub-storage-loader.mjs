// =====================================================================
// scripts/stub-storage-loader.mjs — an ESM loader hook for the Node tests.
//
// Most src/lib modules are pure and test under plain Node. A few (doubts.js,
// cribs.js, notes.js ...) statically import safe-storage.js, which imports
// src/storage.js, which reads `import.meta.env.VITE_SUPABASE_URL`. That is a
// Vite-only value, so importing any of them under Node throws before a single
// assertion runs, and those modules have therefore never been tested at all.
//
// This hook resolves the storage layer to an in-memory stub, so the PURE logic
// above it (id schemes, toggles, selectors) can be tested. It never touches the
// real storage, so a test can never read or write a user's data.
//
// Usage, at the very top of a test, BEFORE importing the module under test:
//   import { register } from 'node:module';
//   register('../../scripts/stub-storage-loader.mjs', import.meta.url);
//   const { pointId } = await import('./doubts.js');
// =====================================================================

const STUB_URL = 'stub:storage';

// An in-memory stand-in with the same shape as src/storage.js.
const SOURCE = `
const mem = new Map();
export async function get(key)      { return mem.has(key) ? { value: mem.get(key) } : null; }
export async function set(key, val) { mem.set(key, val); return true; }
export async function del(key)      { mem.delete(key); return true; }
export async function list(prefix)  { return [...mem.keys()].filter(k => k.startsWith(prefix || '')); }
export async function keys(prefix)  { return list(prefix); }
export const ready = Promise.resolve(true);
export default { get, set, del, list, keys };
`;

export function resolve(specifier, context, next) {
  // src/lib/safe-storage.js does: import * as kvStorage from '../storage';
  if (specifier === '../storage' || specifier === '../storage.js') {
    return { url: STUB_URL, shortCircuit: true };
  }
  return next(specifier, context);
}

export function load(url, context, next) {
  if (url === STUB_URL) {
    return { format: 'module', shortCircuit: true, source: SOURCE };
  }
  return next(url, context);
}
