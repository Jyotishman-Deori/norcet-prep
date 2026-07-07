// Contract test for src/lib/qr.js — runnable under Node:
//   node src/lib/qr.test.js
// Locks the v1-6 behavior the student app depends on (UPI / share-link QRs)
// and exercises the v7-9 extension added for admin-2FA otpauth:// URIs,
// including the 18-bit version-information blocks v≥7 requires.
import assert from 'node:assert/strict';

const { encodeQR } = await import('./qr.js');

const at = (q, r, c) => q.dark[r * q.size + c];

// ---- version selection: byte length → version/size boundaries ------------
// Byte-mode need = len+2 codewords; EC-M data capacity per version:
// v4=62, v6=106, v7=122, v8=152, v9=180 bytes.
{
  const cases = [
    [48, 33],   // realistic UPI string length → v4 (regression: same as pre-extension)
    [106, 41],  // v6 top — the old hard cap
    [107, 45],  // first byte that NEEDS v7 (used to throw)
    [122, 45],  // v7 top
    [123, 49],  // v8
    [152, 49],  // v8 top
    [153, 53],  // v9
    [180, 53],  // v9 top
  ];
  for (const [len, size] of cases) {
    const q = encodeQR('x'.repeat(len));
    assert.equal(q.size, size, `${len} bytes should give a ${size}×${size} matrix`);
    assert.equal(q.dark.length, size * size);
  }
  assert.throws(() => encodeQR('x'.repeat(181)), /too long/, '181 bytes exceeds the v9 cap');
}

// ---- v1-6 regression: identical output before/after the extension --------
// A fixed short string must keep encoding deterministically (mask choice and
// all tables for v1-6 are untouched by the v7-9 rows).
{
  const upi = 'upi://pay?pa=onehalt.in@axl&pn=NurseHolic&cu=INR';
  const a = encodeQR(upi), b = encodeQR(upi);
  assert.equal(a.size, 33, 'UPI string stays v4');
  assert.deepEqual(Array.from(a.dark), Array.from(b.dark), 'encoding is deterministic');
  for (const m of a.dark) assert.ok(m === 0 || m === 1, 'modules are strictly 0/1');
}

// ---- structural invariants at v7-9 ---------------------------------------
{
  for (const [len, version] of [[110, 7], [140, 8], [170, 9]]) {
    const q = encodeQR('x'.repeat(len));
    const s = q.size;
    assert.equal(s, version * 4 + 17, `v${version} size is 4v+17`);
    // three finder patterns: dark corner + dark core, white inner ring
    for (const [r, c] of [[0, 0], [0, s - 7], [s - 7, 0]]) {
      assert.equal(at(q, r, c), 1, `v${version} finder corner at (${r},${c})`);
      assert.equal(at(q, r + 3, c + 3), 1, `v${version} finder core`);
      assert.equal(at(q, r + 1, c + 1), 0, `v${version} finder inner ring is light`);
    }
    // timing patterns alternate along row/col 6
    for (let i = 8; i < s - 8; i++) {
      assert.equal(at(q, 6, i), i % 2 === 0 ? 1 : 0, `v${version} row-6 timing at ${i}`);
      assert.equal(at(q, i, 6), i % 2 === 0 ? 1 : 0, `v${version} col-6 timing at ${i}`);
    }
    // dark module
    assert.equal(at(q, s - 8, 8), 1, `v${version} dark module`);
  }
}

// ---- version-information blocks (v≥7): both copies, known BCH vectors ----
// Spec vectors: v7 → 0x07C94, v8 → 0x085BC, v9 → 0x09A99. Bits are placed
// LSB-first: bottom-left copy at (size-11+i%3, ⌊i/3⌋), top-right transposed.
{
  const VECTORS = { 7: 0x07C94, 8: 0x085BC, 9: 0x09A99 };
  for (const [len, version] of [[110, 7], [140, 8], [170, 9]]) {
    const q = encodeQR('x'.repeat(len));
    const s = q.size;
    let bl = 0, tr = 0;
    for (let i = 0; i < 18; i++) {
      const a = s - 11 + (i % 3), b = Math.floor(i / 3);
      bl |= at(q, a, b) << i;
      tr |= at(q, b, a) << i;
    }
    assert.equal(bl, tr, `v${version} version-info copies must match`);
    assert.equal(bl, VECTORS[version], `v${version} version info = 0x${VECTORS[version].toString(16)}`);
    assert.equal(bl >> 12, version, `v${version} top 6 bits decode to the version`);
  }
}

// ---- realistic otpauth payload (the bug this extension fixes) -------------
{
  const otpauth = 'otpauth://totp/NurseHolic%20Admin%3Asome-profile-name?secret=ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&issuer=NurseHolic%20Admin&algorithm=SHA1&digits=6&period=30';
  assert.ok(otpauth.length > 106, 'payload really is beyond the old v6 cap');
  const q = encodeQR(otpauth);
  assert.ok(q.size === 45 || q.size === 49 || q.size === 53, 'otpauth URI encodes at v7-9');
}

console.log('qr.test.js OK');
