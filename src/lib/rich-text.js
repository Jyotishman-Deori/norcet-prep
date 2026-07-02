// =====================================================================
// src/lib/rich-text.js — a tiny, SAFE, dependency-free rich-text system for
// ADMIN-authored content (FAQ answers, FAQ replies, announcements). Lets the
// admin format like a magazine — headings, bold/italic/underline, highlight,
// lists, quotes, links — while the reader gets clean, styled output.
//
// SECURITY: renderRich() ESCAPES the raw text first, then layers on ONLY our own
// controlled tags. User/admin input can never inject markup or scripts. Links
// are scheme-whitelisted (http/https/mailto/relative only) — a `javascript:` URL
// falls back to plain text. So the output of renderRich() is safe to feed to
// dangerouslySetInnerHTML.
//
// FORMAT: a curated Markdown subset (NOT arbitrary fonts) — deliberate, because
// a fixed type scale is what looks magazine-premium rather than clumsy:
//   # H1   ## H2   ### H3          (headings / "font sizes")
//   **bold**  *italic*  __underline__  ~~strike~~  ==highlight==  `code`
//   - bullet   1. numbered          (lists)
//   > quote                          (blockquote)
//   [label](https://…)               (link)
// Plain text with none of these renders exactly as before (backward compatible).
// Every character — emoji, Devanagari, symbols — is preserved (only & < > are
// escaped for safety; nothing is stripped).
//
// This module is pure (no React, no I/O) and unit-tested.
// =====================================================================

const AMP = /&/g, LT = /</g, GT = />/g, QUOT = /"/g;
export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(AMP, '&amp;').replace(LT, '&lt;').replace(GT, '&gt;').replace(QUOT, '&quot;');
}

// Only allow safe link schemes; everything else degrades to plain text.
function safeHref(rawUrl) {
  const u = String(rawUrl || '').trim();
  if (!u) return null;
  if (/^(https?:|mailto:)/i.test(u)) return u;   // absolute web / email
  if (/^\/[^/]/.test(u) || u === '/') return u;   // in-app relative path
  return null;                                    // javascript:, data:, etc. -> reject
}

// Inline spans, applied to ALREADY-ESCAPED text (so markers survive but markup
// can't be injected). Order matters: multi-char delimiters before single-char.
function inline(escaped) {
  let s = escaped;
  // links: [label](url) — label keeps its own inline formatting after this pass
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const href = safeHref(url);
    if (!href) return m; // leave the literal text if the URL isn't allowed
    return `<a class="rich-a" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');   // **bold**
  s = s.replace(/__(?=\S)([\s\S]*?\S)__/g, '<u>$1</u>');                 // __underline__
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>');                 // ~~strike~~
  s = s.replace(/==(?=\S)([\s\S]*?\S)==/g, '<mark class="rich-hl">$1</mark>'); // ==highlight==
  s = s.replace(/`(?=\S)([\s\S]*?\S)`/g, '<code class="rich-code">$1</code>'); // `code`
  // *italic* last, and only when not part of a ** that survived (it won't, done above)
  s = s.replace(/\*(?=\S)([\s\S]*?\S)\*/g, '<em>$1</em>');
  return s;
}

const H = /^(#{1,3})\s+(.*)$/;
const UL = /^[-*]\s+(.*)$/;
const OL = /^(\d+)\.\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;

// renderRich(text) -> { __html } ready for dangerouslySetInnerHTML.
export function renderRich(text) {
  const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  if (!src.trim()) return { __html: '' };
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  const para = []; // buffer of inline-rendered lines for the current paragraph

  const flushPara = () => {
    if (para.length) { out.push(`<p class="rich-p">${para.join('<br>')}</p>`); para.length = 0; }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { flushPara(); i++; continue; }

    let m;
    if ((m = line.match(H))) {
      flushPara();
      const lvl = m[1].length;
      out.push(`<div class="rich-h rich-h${lvl}">${inline(escapeHtml(m[2]))}</div>`);
      i++; continue;
    }
    if (UL.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && UL.test(lines[i])) { items.push(`<li>${inline(escapeHtml(lines[i].match(UL)[1]))}</li>`); i++; }
      out.push(`<ul class="rich-ul">${items.join('')}</ul>`);
      continue;
    }
    if (OL.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && OL.test(lines[i])) { items.push(`<li>${inline(escapeHtml(lines[i].match(OL)[2]))}</li>`); i++; }
      out.push(`<ol class="rich-ol">${items.join('')}</ol>`);
      continue;
    }
    if (QUOTE.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && QUOTE.test(lines[i])) { items.push(inline(escapeHtml(lines[i].match(QUOTE)[1]))); i++; }
      out.push(`<blockquote class="rich-quote">${items.join('<br>')}</blockquote>`);
      continue;
    }
    // ordinary text line -> accumulate into a paragraph
    para.push(inline(escapeHtml(line)));
    i++;
  }
  flushPara();
  return { __html: out.join('') };
}

// toPlainText(text) -> markers stripped, for notification bodies, previews and
// truncation (where styled HTML isn't wanted). Preserves all real characters.
export function toPlainText(text) {
  let s = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  s = s.replace(/^\s{0,3}(#{1,3})\s+/gm, '');       // heading hashes
  s = s.replace(/^\s{0,3}>\s?/gm, '');              // quote markers
  s = s.replace(/^\s{0,3}[-*]\s+/gm, '• ');         // bullets -> a real bullet glyph
  s = s.replace(/^\s{0,3}\d+\.\s+/gm, '');          // numbered markers
  s = s.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1');  // links -> label
  s = s.replace(/(\*\*|__|~~|==|`)(?=\S)([\s\S]*?\S)\1/g, '$2'); // paired inline marks
  s = s.replace(/\*(?=\S)([\s\S]*?\S)\*/g, '$1');   // italic
  return s.trim();
}

// hasRichMarkup(text) -> true if the text uses any formatting (for previews/badges).
export function hasRichMarkup(text) {
  const s = String(text == null ? '' : text);
  return /(^|\n)\s{0,3}(#{1,3}\s|[-*]\s|\d+\.\s|>\s)/.test(s) ||
         /\*\*[\s\S]*?\*\*|__[\s\S]*?__|~~[\s\S]*?~~|==[\s\S]*?==|`[\s\S]*?`|\*[\s\S]*?\*|\[[^\]]+\]\([^)\s]+\)/.test(s);
}

// The toolbar's formatting actions. Wrap types surround the selection; line
// types prefix each selected line. Returns the new value + the selection to
// restore, so the editor stays WYSIWYG-ish without a contentEditable.
export const RICH_MARKS = {
  bold:      { kind: 'wrap', mark: '**',  placeholder: 'bold text' },
  italic:    { kind: 'wrap', mark: '*',   placeholder: 'italic text' },
  underline: { kind: 'wrap', mark: '__',  placeholder: 'underlined' },
  strike:    { kind: 'wrap', mark: '~~',  placeholder: 'struck out' },
  highlight: { kind: 'wrap', mark: '==',  placeholder: 'highlight' },
  code:      { kind: 'wrap', mark: '`',   placeholder: 'code' },
  h1:        { kind: 'line', prefix: '# ',  placeholder: 'Heading' },
  h2:        { kind: 'line', prefix: '## ', placeholder: 'Subheading' },
  quote:     { kind: 'line', prefix: '> ',  placeholder: 'Quote' },
  bullet:    { kind: 'line', prefix: '- ',  placeholder: 'List item' },
  number:    { kind: 'line', prefix: '1. ', placeholder: 'List item' },
  link:      { kind: 'link', placeholder: 'link text' },
};

// applyMark(value, selStart, selEnd, type) -> { value, selStart, selEnd }.
// Pure string surgery so it's fully testable with no DOM.
export function applyMark(value, selStart, selEnd, type) {
  const v = String(value == null ? '' : value);
  const a = Math.max(0, Math.min(selStart | 0, v.length));
  const b = Math.max(a, Math.min(selEnd | 0, v.length));
  const spec = RICH_MARKS[type];
  if (!spec) return { value: v, selStart: a, selEnd: b };
  const selected = v.slice(a, b);

  if (spec.kind === 'wrap') {
    const inner = selected || spec.placeholder;
    const wrapped = `${spec.mark}${inner}${spec.mark}`;
    const value2 = v.slice(0, a) + wrapped + v.slice(b);
    const innerStart = a + spec.mark.length;
    return { value: value2, selStart: innerStart, selEnd: innerStart + inner.length };
  }

  if (spec.kind === 'link') {
    const label = selected || spec.placeholder;
    const snippet = `[${label}](https://)`;
    const value2 = v.slice(0, a) + snippet + v.slice(b);
    // put the caret inside the (…) so the admin types the URL next
    const urlPos = a + `[${label}](`.length;
    return { value: value2, selStart: urlPos, selEnd: urlPos + 'https://'.length };
  }

  // line prefix: apply to the start of every line the selection touches
  const lineStart = v.lastIndexOf('\n', a - 1) + 1;
  let lineEnd = v.indexOf('\n', b); if (lineEnd === -1) lineEnd = v.length;
  const block = v.slice(lineStart, lineEnd);
  const prefixed = block.split('\n').map(ln => (ln.startsWith(spec.prefix) ? ln : spec.prefix + (ln || spec.placeholder))).join('\n');
  const value2 = v.slice(0, lineStart) + prefixed + v.slice(lineEnd);
  return { value: value2, selStart: lineStart, selEnd: lineStart + prefixed.length };
}
