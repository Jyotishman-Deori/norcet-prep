// Smoke-test stub for src/storage.js (kvStorage) — inert async KV.
export async function get() { return null; }
export async function set() {}
export async function del() {}
export async function list() { return []; }
export async function isAlive() { return true; }
export function getEgressStats() { return {}; }
export function setAuthToken() {}
export function getAuthToken() { return null; }
export function setOnAuthError() {}
export async function setSharedStrict() {}
export async function delSharedStrict() {}
