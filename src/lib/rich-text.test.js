// Contract test for src/lib/rich-text.js — runnable under Node:
//   node src/lib/rich-text.test.js
// Pure module (no DOM), so no build stubs needed.
import assert from 'node:assert/strict';
import { renderRich, toPlainText, hasRichMarkup, applyMark, escapeHtml } from './rich-text.js';

const html = (t) => renderRich(t).__html;

// ---- XSS safety: raw HTML is escaped, never executed ----
{
  const h = html('<script>alert(1)</script> & <b>x</b>');
  assert.ok(!/<script>/.test(h), 'script tag must be escaped');
  assert.ok(h.includes('&lt;script&gt;'), 'angle brackets escaped');
  assert.ok(h.includes('&amp;'), 'ampersand escaped');
}

// ---- inline marks ----
assert.ok(html('**bold**').includes('<strong>bold</strong>'));
assert.ok(html('*italic*').includes('<em>italic</em>'));
assert.ok(html('__under__').includes('<u>under</u>'));
assert.ok(html('~~gone~~').includes('<s>gone</s>'));
assert.ok(html('==hot==').includes('<mark class="rich-hl">hot</mark>'));
assert.ok(html('`x=1`').includes('<code class="rich-code">x=1</code>'));

// bold before italic — ** must not be eaten as two * *
{
  const h = html('**bo** and *it*');
  assert.ok(h.includes('<strong>bo</strong>'));
  assert.ok(h.includes('<em>it</em>'));
}

// ---- block elements ----
assert.ok(html('# Title').includes('rich-h1'));
assert.ok(html('## Sub').includes('rich-h2'));
{
  const h = html('- a\n- b');
  assert.ok(h.includes('<ul class="rich-ul">'));
  assert.equal((h.match(/<li>/g) || []).length, 2);
}
{
  const h = html('1. one\n2. two');
  assert.ok(h.includes('<ol class="rich-ol">'));
  assert.equal((h.match(/<li>/g) || []).length, 2);
}
assert.ok(html('> wise words').includes('<blockquote class="rich-quote">'));

// paragraphs + line breaks
{
  const h = html('line one\nline two\n\npara two');
  assert.ok(h.includes('line one<br>line two'), 'single newline -> <br>');
  assert.equal((h.match(/<p class="rich-p">/g) || []).length, 2, 'blank line -> new paragraph');
}

// ---- links: safe schemes render, dangerous ones degrade to text ----
{
  const ok = html('[site](https://nurseholic.in)');
  assert.ok(ok.includes('href="https://nurseholic.in"'));
  assert.ok(ok.includes('rel="noopener noreferrer"'));
}
{
  const bad = html('[x](javascript:alert(1))');
  assert.ok(!/href=/.test(bad), 'javascript: URL must not become a link');
  assert.ok(bad.includes('[x](javascript:alert(1))'.replace('(1)', '(1)')) || bad.includes('javascript:'), 'left as literal text');
}

// ---- unicode / emoji / non-Latin preserved verbatim ----
{
  const s = '**मोटा** 🚑 café ➜ Ω';
  const h = html(s);
  assert.ok(h.includes('<strong>मोटा</strong>'));
  assert.ok(h.includes('🚑'));
  assert.ok(h.includes('café'));
  assert.ok(h.includes('Ω'));
}

// ---- plain text is unchanged in meaning (backward compatible) ----
assert.equal(html('just plain text'), '<p class="rich-p">just plain text</p>');
assert.equal(html(''), '');
assert.equal(html('   '), '');

// ---- toPlainText strips markers, keeps content ----
assert.equal(toPlainText('# Hi\n**bold** and *it*'), 'Hi\nbold and it');
assert.equal(toPlainText('- one\n- two'), '• one\n• two');
assert.equal(toPlainText('see [here](https://x.com)'), 'see here');

// ---- hasRichMarkup ----
assert.equal(hasRichMarkup('plain'), false);
assert.equal(hasRichMarkup('**x**'), true);
assert.equal(hasRichMarkup('# heading'), true);

// ---- escapeHtml also escapes quotes (attribute-safe) ----
assert.equal(escapeHtml('a "b" <c>'), 'a &quot;b&quot; &lt;c&gt;');

// ---- applyMark: wrap around a selection ----
{
  const r = applyMark('hello world', 6, 11, 'bold'); // select "world"
  assert.equal(r.value, 'hello **world**');
  assert.equal(r.value.slice(r.selStart, r.selEnd), 'world');
}
// wrap with no selection inserts a placeholder, caret over it
{
  const r = applyMark('x', 1, 1, 'italic');
  assert.equal(r.value, 'x*italic text*');
  assert.equal(r.value.slice(r.selStart, r.selEnd), 'italic text');
}
// line prefix applies to the touched line
{
  const r = applyMark('todo', 0, 0, 'bullet');
  assert.equal(r.value, '- todo');
}
// line prefix across two lines
{
  const r = applyMark('a\nb', 0, 3, 'quote');
  assert.equal(r.value, '> a\n> b');
}
// link snippet drops the caret onto the URL
{
  const r = applyMark('click', 0, 5, 'link');
  assert.equal(r.value, '[click](https://)');
  assert.equal(r.value.slice(r.selStart, r.selEnd), 'https://');
}

console.log('rich-text.test.js: all passed');
