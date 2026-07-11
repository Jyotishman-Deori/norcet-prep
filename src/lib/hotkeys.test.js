// Contract test for src/lib/hotkeys.js — runnable under Node:
//   node src/lib/hotkeys.test.js
import assert from 'node:assert/strict';
import { isTypingTarget, paletteAction } from './hotkeys.js';

// ---- isTypingTarget ----
assert.equal(isTypingTarget(null), false);
assert.equal(isTypingTarget({ tagName: 'DIV' }), false);
assert.equal(isTypingTarget({ tagName: 'INPUT' }), true);
assert.equal(isTypingTarget({ tagName: 'textarea' }), true, 'case-insensitive');
assert.equal(isTypingTarget({ tagName: 'SELECT' }), true);
assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);

// ---- paletteAction: Cmd/Ctrl+K opens, even while typing ----
assert.equal(paletteAction({ key: 'k', ctrl: true }), 'open');
assert.equal(paletteAction({ key: 'K', meta: true }), 'open', 'capital K (shift not required)');
assert.equal(paletteAction({ key: 'k', meta: true, typing: true }), 'open', 'combo works inside a field');
assert.equal(paletteAction({ key: 'k' }), null, 'k alone does nothing');
assert.equal(paletteAction({ key: 'k', ctrl: true, alt: true }), null, 'ctrl+alt+k is a different chord');
assert.equal(paletteAction({ key: 'k', ctrl: true, shift: true }), null, 'ctrl+shift+k is a different chord');

// ---- paletteAction: bare '/' opens only when not typing and unmodified ----
assert.equal(paletteAction({ key: '/' }), 'open');
assert.equal(paletteAction({ key: '/', typing: true }), null, 'inside a field, / is a literal');
assert.equal(paletteAction({ key: '/', ctrl: true }), null, 'ctrl+/ is not the shortcut');
assert.equal(paletteAction({ key: '/', meta: true }), null);

// ---- misc keys never trigger ----
assert.equal(paletteAction({ key: 'j', ctrl: true }), null);
assert.equal(paletteAction({ key: 'Enter' }), null);
assert.equal(paletteAction({}), null);
assert.equal(paletteAction(null), null, 'nullish-safe');

console.log('hotkeys.test.js: all passed');
