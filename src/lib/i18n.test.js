// Contract test for src/lib/i18n.js — runnable under plain Node:
//   node src/lib/i18n.test.js
// The module lazy-imports storage and guards all document/fetch access,
// so importing and driving it here never touches IndexedDB or the DOM.
import assert from 'node:assert/strict';
import {
  t, getLang, getLocale, setLocale, onLangChange, LOCALES, LOCALE_VERSION,
  checkStorageHeadroom, _resetForTest, _seedDictForTest,
} from './i18n.js';
import { EN } from '../locales/en.js';

// ---- registry shape ----
{
  assert.ok(Array.isArray(LOCALES) && LOCALES.length >= 8, '8 Tier-0/1 locales registered');
  const codes = LOCALES.map(l => l.code);
  assert.equal(new Set(codes).size, codes.length, 'locale codes unique');
  assert.equal(LOCALES[0].code, 'en', 'English first');
  for (const l of LOCALES) {
    assert.ok(l.bcp47 && !l.bcp47.includes('hin'), `bcp47 valid-ish for ${l.code}`);
    assert.ok(l.name && l.native && l.script, `display fields present for ${l.code}`);
    if (l.script !== 'latin') assert.ok(l.font, `non-Latin ${l.code} names a font`);
    if (l.script === 'latin') assert.equal(l.font, null, `Latin ${l.code} ships no font`);
  }
  const hinglish = LOCALES.find(l => l.code === 'hin-en');
  assert.equal(hinglish.bcp47, 'hi-Latn', 'Hinglish maps to hi-Latn for <html lang>');
  assert.equal(typeof LOCALE_VERSION, 'number');
}

// ---- English dictionary hygiene ----
{
  for (const [k, v] of Object.entries(EN)) {
    assert.equal(typeof v, 'string', `EN[${k}] is a string`);
    assert.ok(!v.includes('—'), `no em dash in EN[${k}]`);
    assert.ok(!v.includes('--'), `no double hyphen in EN[${k}]`);
    assert.ok(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/.test(k), `key shape ok: ${k}`);
  }
}

// ---- t(): lookup, fallback, interpolation ----
{
  _resetForTest();
  assert.equal(getLang(), 'en', 'default language is en');
  assert.equal(t('nav.tabs.home'), 'Home', 'en lookup');
  assert.equal(t('no.such.key'), 'no.such.key', 'missing key returns the raw key');
  _seedDictForTest('hi', {
    _meta: { status: 'DRAFT' },
    'nav.tabs.home': 'होम',
    'test.greet': 'नमस्ते {name}, {name} ji',
  });
  await setLocale('hi');
  assert.equal(getLang(), 'hi');
  assert.equal(t('nav.tabs.home'), 'होम', 'hi value wins after switch');
  assert.equal(t('nav.tabs.settings'), 'Settings', 'missing hi key falls back to English');
  assert.equal(t('_meta'), '_meta', 'bookkeeping keys are not lookupable strings');
  assert.equal(t('test.greet', { name: 'Asha' }), 'नमस्ते Asha, Asha ji', 'repeated var interpolates');
  assert.equal(t('test.greet', {}), 'नमस्ते {name}, {name} ji', 'missing var left literal');
  assert.equal(t('test.greet', { name: 0 }), 'नमस्ते 0, 0 ji', 'falsy-but-present var interpolates');
  await setLocale('en');
  assert.equal(t('nav.tabs.home'), 'Home', 'switching back restores English');
}

// ---- setLocale(): unknown code throws, state unchanged ----
{
  _resetForTest();
  await assert.rejects(() => setLocale('xx'), /unknown locale/);
  assert.equal(getLang(), 'en', 'failed switch leaves language unchanged');
}

// ---- setLocale(): fetch failure leaves state unchanged ----
{
  _resetForTest();
  const hadFetch = 'fetch' in globalThis;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  try {
    await assert.rejects(() => setLocale('ta'), /locale fetch failed/);
    assert.equal(getLang(), 'en', 'failed download leaves English active');
    assert.equal(t('nav.tabs.home'), 'Home');
  } finally {
    if (hadFetch) globalThis.fetch = realFetch; else delete globalThis.fetch;
  }
}

// ---- onLangChange(): notify + unsubscribe ----
{
  _resetForTest();
  _seedDictForTest('bn', { 'nav.tabs.home': 'হোম' });
  const seen = [];
  const off = onLangChange(code => seen.push(code));
  await setLocale('bn');
  assert.deepEqual(seen, ['bn'], 'subscriber notified with the new code');
  off();
  await setLocale('en');
  assert.deepEqual(seen, ['bn'], 'unsubscribed listener not called again');
}

// ---- checkStorageHeadroom(): never blocks where API is absent ----
{
  const r = await checkStorageHeadroom();
  assert.equal(r.ok, true, 'no navigator.storage in Node -> ok:true (never block)');
}

_resetForTest();
console.log('i18n.test.js: all assertions passed');
