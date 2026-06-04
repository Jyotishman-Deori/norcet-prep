// =====================================================================
// src/lib/qr.js — tiny byte-mode QR encoder (EC level M, versions 1-6).
// Pure, no deps, no React/DOM. Extracted VERBATIM from App.jsx (A1 slice 37).
// Public API: encodeQR(str) -> { size, dark:Uint8Array(size*size, 1=dark) }
// or throws (caller falls back to a copyable UPI ID). All _qr* helpers are
// module-private; only encodeQR is exported.
// =====================================================================

// =====================================================================
// Tiny byte-mode QR encoder, EC level M, versions 1-6 (decode-verified
// against the `qrcode` package + `jsqr` round-trip in dev). Versions 1-6
// cover every realistic upi:// string (cap = 106 bytes at v6); longer
// input throws so the caller falls back to the copyable UPI ID rather
// than ever drawing a broken code. Pure, no deps, no network. Returns
// { size, dark:Uint8Array(size*size, 1=dark) }.
// =====================================================================
const _qrEXP = new Uint8Array(512);
const _qrLOG = new Uint8Array(256);
(function initQrGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) { _qrEXP[i] = x; _qrLOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) _qrEXP[i] = _qrEXP[i - 255];
})();
function _qrMul(a, b) { return (a === 0 || b === 0) ? 0 : _qrEXP[_qrLOG[a] + _qrLOG[b]]; }
function _qrGenPoly(deg) {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) { next[j] ^= poly[j]; next[j + 1] ^= _qrMul(poly[j], _qrEXP[i]); }
    poly = next;
  }
  return poly;
}
function _qrRsEncode(data, ecLen) {
  const gen = _qrGenPoly(ecLen);
  const res = new Array(data.length + ecLen).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) for (let j = 0; j < gen.length; j++) res[i + j] ^= _qrMul(gen[j], coef);
  }
  return res.slice(data.length);
}
// [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] for EC level M, v1-6
const _qrECM = {
  1: [10, 1, 16, 0, 0], 2: [16, 1, 28, 0, 0], 3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0], 5: [24, 2, 43, 0, 0], 6: [16, 4, 27, 0, 0],
};
const _qrALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };
function _qrTotalData(v) { const a = _qrECM[v]; return a[1] * a[2] + a[3] * a[4]; }
function _qrPickVersion(byteLen) {
  for (let v = 1; v <= 6; v++) {
    const need = Math.ceil((4 + 8 + 8 * byteLen) / 8); // 8-bit char count for v1-9
    if (need <= _qrTotalData(v)) return v;
  }
  throw new Error('QR data too long (>v6)');
}
function _qrToBytes(str) {
  if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(str));
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
    else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
  }
  return out;
}
function _qrBitStream(str) {
  const bytes = _qrToBytes(str);
  const v = _qrPickVersion(bytes.length);
  const totalData = _qrTotalData(v);
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);            // byte mode
  push(bytes.length, 8);      // char count (8 bits for v1-9)
  for (const b of bytes) push(b, 8);
  const cap = totalData * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0); // terminator
  while (bits.length % 8 !== 0) bits.push(0);
  const pad = [0xEC, 0x11];
  let pi = 0;
  while (bits.length < cap) { push(pad[pi % 2], 8); pi++; }
  const dataCw = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; dataCw.push(b); }
  const ec = _qrECM[v], ecLen = ec[0];
  const blocks = [];
  let idx = 0;
  for (let i = 0; i < ec[1]; i++) { blocks.push(dataCw.slice(idx, idx + ec[2])); idx += ec[2]; }
  for (let i = 0; i < ec[3]; i++) { blocks.push(dataCw.slice(idx, idx + ec[4])); idx += ec[4]; }
  const ecBlocks = blocks.map(b => _qrRsEncode(b, ecLen));
  const out = [];
  const maxData = Math.max.apply(null, blocks.map(b => b.length));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecLen; i++) for (const eb of ecBlocks) out.push(eb[i]);
  const finalBits = [];
  for (const cw of out) for (let i = 7; i >= 0; i--) finalBits.push((cw >> i) & 1);
  return { version: v, bits: finalBits };
}
function _qrBuildMatrix(version, bits) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const fn = Array.from({ length: size }, () => new Uint8Array(size));
  const set = (r, c, val) => { m[r][c] = val; fn[r][c] = 1; };
  function finder(r, c) {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const inRing = (i >= 0 && i <= 6 && (j === 0 || j === 6)) || (j >= 0 && j <= 6 && (i === 0 || i === 6));
      const inCore = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      set(rr, cc, (inRing || inCore) ? 1 : 0);
    }
  }
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { if (!fn[6][i]) set(6, i, i % 2 === 0 ? 1 : 0); if (!fn[i][6]) set(i, 6, i % 2 === 0 ? 1 : 0); }
  const centers = _qrALIGN[version];
  for (const r of centers) for (const c of centers) {
    if (fn[r][c]) continue;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const ring = Math.max(Math.abs(i), Math.abs(j));
      set(r + i, c + j, (ring === 2 || ring === 0) ? 1 : 0);
    }
  }
  set(size - 8, 8, 1); // dark module
  for (let i = 0; i <= 8; i++) { if (!fn[8][i]) fn[8][i] = 1; if (!fn[i][8]) fn[i][8] = 1; }
  for (let i = 0; i < 8; i++) { fn[8][size - 1 - i] = 1; fn[size - 1 - i][8] = 1; }
  fn[8][8] = 1;
  let bitIdx = 0, up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const row = up ? size - 1 - i : i;
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (fn[row][c]) continue;
        m[row][c] = bitIdx < bits.length ? bits[bitIdx] : 0;
        bitIdx++;
      }
    }
    up = !up;
  }
  return { size, m, fn };
}
const _qrMASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];
function _qrApplyMask(m, fn, maskIdx) {
  const size = m.length;
  const out = m.map(row => Int8Array.from(row));
  const mf = _qrMASKS[maskIdx];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) { if (fn[r][c]) continue; if (mf(r, c)) out[r][c] ^= 1; }
  return out;
}
function _qrBchFormat(data5) {
  let d = data5 << 10;
  const g = 0b10100110111;
  for (let i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= g << (i - 10);
  return ((data5 << 10) | d) ^ 0b101010000010010;
}
function _qrPlaceFormat(out, maskIdx) {
  const size = out.length;
  const bits = _qrBchFormat((0b00 << 3) | maskIdx); // EC level M indicator = 00
  for (let i = 0; i < 15; i++) {
    const mod = (bits >> i) & 1;
    if (i < 6) out[i][8] = mod; else if (i < 8) out[i + 1][8] = mod; else out[size - 15 + i][8] = mod;
    if (i < 8) out[8][size - i - 1] = mod; else if (i < 9) out[8][15 - i - 1 + 1] = mod; else out[8][15 - i - 1] = mod;
  }
  out[size - 8][8] = 1;
}
function _qrPenalty(mat) {
  const size = mat.length; let points = 0;
  for (let row = 0; row < size; row++) {
    let sameCol = 0, sameRow = 0, lastCol = null, lastRow = null;
    for (let col = 0; col < size; col++) {
      const mC = mat[row][col];
      if (mC === lastCol) sameCol++; else { if (sameCol >= 5) points += 3 + (sameCol - 5); lastCol = mC; sameCol = 1; }
      const mR = mat[col][row];
      if (mR === lastRow) sameRow++; else { if (sameRow >= 5) points += 3 + (sameRow - 5); lastRow = mR; sameRow = 1; }
    }
    if (sameCol >= 5) points += 3 + (sameCol - 5);
    if (sameRow >= 5) points += 3 + (sameRow - 5);
  }
  let n2 = 0;
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    const s = mat[r][c] + mat[r][c + 1] + mat[r + 1][c] + mat[r + 1][c + 1];
    if (s === 4 || s === 0) n2++;
  }
  points += n2 * 3;
  let n3 = 0;
  for (let row = 0; row < size; row++) {
    let bc = 0, br = 0;
    for (let col = 0; col < size; col++) {
      bc = ((bc << 1) & 0x7FF) | mat[row][col];
      if (col >= 10 && (bc === 0x5D0 || bc === 0x05D)) n3++;
      br = ((br << 1) & 0x7FF) | mat[col][row];
      if (col >= 10 && (br === 0x5D0 || br === 0x05D)) n3++;
    }
  }
  points += n3 * 40;
  let dark = 0; const total = size * size;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += mat[r][c];
  const k = Math.abs(Math.ceil((dark * 100 / total) / 5) - 10);
  points += k * 10;
  return points;
}
// Returns { size, dark } or throws (caller falls back to copyable UPI ID).
function encodeQR(str) {
  const { version, bits } = _qrBitStream(str);
  const { size, m, fn } = _qrBuildMatrix(version, bits);
  let best = null, bestPen = Infinity;
  for (let maskIdx = 0; maskIdx < 8; maskIdx++) {
    const masked = _qrApplyMask(m, fn, maskIdx);
    _qrPlaceFormat(masked, maskIdx);
    const pen = _qrPenalty(masked);
    if (pen < bestPen) { bestPen = pen; best = masked; }
  }
  const dark = new Uint8Array(size * size);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark[r * size + c] = best[r][c] ? 1 : 0;
  return { size, dark };
}

export { encodeQR };
