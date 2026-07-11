// =====================================================================
// src/lib/qr-canvas.js — QR + shareable image cards on a raw <canvas>.
//
// Deliberately dependency-free, matching the score card's stance in
// result-cards.jsx (no html2canvas). Reuses the in-repo encodeQR() byte-mode
// encoder. Two painters share one premium look (gradient + double frame +
// serif brand) so the branded QR card, milestone cards and the score card
// read as one family:
//   • drawQrMatrix()       — paint an encodeQR matrix onto any ctx (optional
//                            white rounded backing panel + quiet zone)
//   • paintBrandedQrCard() — the Share-page card: brand, QR, link, social proof
//   • paintMilestoneCard() — a shareable achievement (streak / question count
//                            / great score), with the QR in the corner
// Plus shareOrSavePng(): the shared "native share-sheet, else download" path.
// Painters resolve to a PNG Blob; shareOrSavePng resolves to a status string.
// =====================================================================
import { encodeQR } from './qr.js';

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// ---- low-level canvas helpers ---------------------------------------
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function ellipsize(ctx, text, maxW) {
  let s = String(text == null ? '' : text);
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + '\u2026').width > maxW) s = s.slice(0, -1);
  return s + '\u2026';
}

// Greedy word-wrap into at most `maxLines` lines; the last line is ellipsized
// if the text still overflows. Caller has already set ctx.font.
function wrapLines(ctx, text, maxW, maxLines = 2) {
  const words = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (!cur || ctx.measureText(t).width <= maxW) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(ctx, kept[maxLines - 1] + ' ' + lines.slice(maxLines).join(' '), maxW);
    return kept;
  }
  return lines;
}

// Draw an encodeQR matrix at `modulePx` per module. If opts.centerX is given,
// the panel is centred on that x (x is then ignored). Returns the drawn panel
// rect { x, y, w, h, qrPx } so callers can place captions relative to it, or
// null if the string is unencodable (caller can fall back to text).
export function drawQrMatrix(ctx, text, x, y, modulePx, opts = {}) {
  const {
    dark = '#0B1220', light = '#FFFFFF',
    quiet = 4,            // quiet-zone modules (QR spec minimum is 4)
    panel = true,         // white rounded backing panel
    panelPad = 24,        // px padding from quiet zone to panel edge
    panelRadius = 24,
    panelShadow = false,
    centerX = null,
  } = opts;

  let qr;
  try { qr = encodeQR(text); } catch (e) { return null; }
  const size = qr.size;
  const qrPx = size * modulePx;
  const panelW = qrPx + (quiet * 2 * modulePx) + panelPad * 2;
  const panelH = panelW;
  const drawX = (centerX != null) ? Math.round(centerX - panelW / 2) : x;

  if (panel) {
    if (panelShadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
    }
    roundRect(ctx, drawX, y, panelW, panelH, panelRadius);
    ctx.fillStyle = light;
    ctx.fill();
    if (panelShadow) ctx.restore();
  }
  const originX = drawX + panelPad + quiet * modulePx;
  const originY = y + panelPad + quiet * modulePx;
  ctx.fillStyle = dark;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.dark[r * size + c]) {
        // +0.6 overdraw kills hairline seams between modules at integer px
        ctx.fillRect(originX + c * modulePx, originY + r * modulePx, modulePx + 0.6, modulePx + 0.6);
      }
    }
  }
  return { x: drawX, y, w: panelW, h: panelH, qrPx };
}

// Measure the panel a QR would occupy without drawing it (for corner
// placement). Returns null if the string is unencodable.
export function measureQrPanel(text, modulePx, { quiet = 4, panelPad = 24 } = {}) {
  let qr;
  try { qr = encodeQR(text); } catch (e) { return null; }
  const qrPx = qr.size * modulePx;
  const panelW = qrPx + (quiet * 2 * modulePx) + panelPad * 2;
  return { size: qr.size, qrPx, panelW };
}

// ---- shared premium background (matches the score card) -------------
function paintPosterBackground(ctx, W, H, theme) {
  const T = theme || {};
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, T.primary || '#0F4C4C');
  g.addColorStop(0.55, T.primarySoft || '#1A6868');
  g.addColorStop(1, '#101018');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  let orb = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, Math.max(W, H) * 0.34);
  orb.addColorStop(0, 'rgba(255,255,255,0.16)'); orb.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = orb; ctx.fillRect(0, 0, W, H);
  orb = ctx.createRadialGradient(W * 0.1, H * 0.92, 0, W * 0.1, H * 0.92, Math.max(W, H) * 0.4);
  orb.addColorStop(0, 'rgba(255,255,255,0.10)'); orb.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = orb; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 2;
  for (let xx = -H; xx < W + H; xx += 64) { ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx + H, H); ctx.stroke(); }

  // double inner frame — hairline + soft outer ring
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3;
  roundRect(ctx, 48, 48, W - 96, H - 96, 40); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 10;
  roundRect(ctx, 36, 36, W - 72, H - 72, 48); ctx.stroke();
}

function brandHeader(ctx, cx, theme) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 62px ${SERIF}`;
  ctx.fillText('NurseHolic', cx, 138);
  ctx.font = `500 27px ${SANS}`;
  ctx.fillStyle = 'rgba(255,255,255,0.80)';
  ctx.fillText('Free AIIMS NORCET nursing prep, no ads', cx, 184);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 118, 210); ctx.lineTo(cx + 118, 210); ctx.stroke();
}

// pill of text (rounded translucent chip), centred on cx at baseline y.
function pill(ctx, text, cx, yTop, { font = `600 28px ${SERIF}`, padX = 38, h = 60 } = {}) {
  ctx.font = font;
  const w = Math.min(900, ctx.measureText(text).width + padX * 2);
  roundRect(ctx, cx - w / 2, yTop, w, h, h / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(ellipsize(ctx, text, w - padX * 2), cx, yTop + h - Math.round((h - 28) / 2));
}

// ---- branded QR share card (Share page) -----------------------------
// socialProof: a ready-to-render string (caller decides numeric vs not), or
// null to omit the line entirely.
export function paintBrandedQrCard({ url, displayUrl, socialProof = null, theme = {} } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const S = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no-2d-context')); return; }

      paintPosterBackground(ctx, S, S, theme);
      const cx = S / 2;
      brandHeader(ctx, cx, theme);

      // QR centred on a white panel. modulePx kept compact (10) so even a
      // max-length slug's larger matrix still leaves room for the caption,
      // URL pill and social-proof line below without colliding.
      const rect = drawQrMatrix(ctx, url, 0, 244, 10, {
        centerX: cx, panel: true, panelShadow: true, panelPad: 24, panelRadius: 26,
        dark: '#0B1220',
      });
      const yBelow = rect ? rect.y + rect.h : 720;

      // "scan to start" caption
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `600 33px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText('Scan to start practising, free, no ads', cx, yBelow + 58);

      // URL pill (flow-positioned below the caption)
      const pillTop = yBelow + 88;
      pill(ctx, displayUrl || 'www.nurseholic.in', cx, pillTop);

      // optional social-proof line, below the pill (clamped within the frame)
      if (socialProof) {
        const socialY = Math.min(S - 60, pillTop + 60 + 50);
        ctx.font = `500 27px ${SANS}`;
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.textAlign = 'center';
        ctx.fillText(ellipsize(ctx, socialProof, S - 200), cx, socialY);
      }

      canvas.toBlob(b => { b ? resolve(b) : reject(new Error('toBlob-null')); }, 'image/png', 0.95);
    } catch (e) { reject(e); }
  });
}

// ---- milestone share card -------------------------------------------
// kind: 'questions' | 'streak' | 'score'   value: the number reached.
function milestoneCopy(kind, value) {
  if (kind === 'streak') {
    return { headline: `${value}-day streak`, emoji: '\uD83D\uDD25', sub: 'Showing up every day. Consistency wins NORCET.' };
  }
  if (kind === 'score') {
    return { headline: `${value}% this session`, emoji: '\uD83D\uDCAA', sub: 'Strong run. The reps are paying off.' };
  }
  // questions (default)
  return { headline: `${value} questions answered`, emoji: '\uD83C\uDFAF', sub: 'Putting in the work, one question at a time.' };
}

export function paintMilestoneCard({ kind = 'questions', value = 0, url, displayUrl, theme = {} } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const S = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no-2d-context')); return; }

      paintPosterBackground(ctx, S, S, theme);
      const cx = S / 2;
      brandHeader(ctx, cx, theme);

      const { headline, emoji, sub } = milestoneCopy(kind, value);

      // big emoji medallion
      ctx.textAlign = 'center';
      ctx.font = '160px ' + SANS;
      ctx.fillText(emoji, cx, 470);

      // headline (auto-fit to width)
      ctx.fillStyle = '#FFFFFF';
      let fs = 78;
      ctx.font = `700 ${fs}px ${SERIF}`;
      while (fs > 40 && ctx.measureText(headline).width > S - 200) { fs -= 4; ctx.font = `700 ${fs}px ${SERIF}`; }
      ctx.fillText(headline, cx, 590);

      // sub-line
      ctx.font = `500 32px ${SANS}`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(ellipsize(ctx, sub, S - 220), cx, 652);

      // QR in the bottom-right corner (so the card is also a discovery surface)
      const qrModule = 6;
      const margin = 64;
      const panelPad = 18, quiet = 4;
      const meas = measureQrPanel(url, qrModule, { quiet, panelPad });
      const panelW = meas ? meas.panelW : (29 * qrModule + quiet * 2 * qrModule + panelPad * 2);
      drawQrMatrix(ctx, url, S - margin - panelW, S - margin - panelW, qrModule, {
        panel: true, panelShadow: true, panelPad, panelRadius: 16, dark: '#0B1220',
      });

      // "scan to try" micro-label + URL, bottom-left, balancing the QR
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `600 30px ${SANS}`;
      ctx.fillText('Scan to try it free', 84, S - margin - 46);
      ctx.font = `600 28px ${SERIF}`;
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillText(displayUrl || 'www.nurseholic.in', 84, S - margin - 6);

      canvas.toBlob(b => { b ? resolve(b) : reject(new Error('toBlob-null')); }, 'image/png', 0.95);
    } catch (e) { reject(e); }
  });
}

// ---- Progress Report share card -------------------------------------
// A portrait 4:5 card (1080x1350) built from the buildReportCard() model. It
// does ZERO math: it renders `report.headline`, `report.subjects` and the
// baked-in disclaimer. Width stays 1080 so every centred helper carries over.
function drawStatTile(ctx, s, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; ctx.stroke();
  const cx = x + w / 2;
  ctx.textAlign = 'center';
  if (!s || s.value === null || s.value === undefined) {
    // A thin metric shows its honest "Not enough data yet", NEVER a 0.
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = `500 27px ${SANS}`;
    ctx.fillText(ellipsize(ctx, (s && s.display) || 'Not enough data yet', w - 40), cx, y + 82);
  } else {
    ctx.fillStyle = '#FFFFFF';
    let fs = 66;
    ctx.font = `700 ${fs}px ${SERIF}`;
    while (fs > 32 && ctx.measureText(s.display).width > w - 44) { fs -= 4; ctx.font = `700 ${fs}px ${SERIF}`; }
    ctx.fillText(s.display, cx, y + 86);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.font = `600 20px ${SANS}`;
  ctx.fillText(ellipsize(ctx, ((s && s.label) || '').toUpperCase(), w - 26), cx, y + h - 26);
}

export function paintProgressReportCard({ report, url, displayUrl, theme = {} } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const W = 1080, H = 1350;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no-2d-context')); return; }
      const R = report || {};
      const cx = W / 2;

      paintPosterBackground(ctx, W, H, theme);
      brandHeader(ctx, cx, theme);   // brand 138, tagline 184, hairline 210

      // name + title + generated date
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `600 40px ${SANS}`;
      ctx.fillText(ellipsize(ctx, (R.meta && R.meta.name) || 'NORCET Aspirant', W - 260), cx, 272);
      ctx.font = `700 50px ${SERIF}`;
      ctx.fillText(R.title || 'Progress Card', cx, 328);
      ctx.font = `500 25px ${SANS}`;
      ctx.fillStyle = 'rgba(255,255,255,0.74)';
      const genLine = (R.meta && R.meta.generatedOnDisplay) ? `Generated ${R.meta.generatedOnDisplay}` : 'Your practice so far';
      ctx.fillText(genLine, cx, 366);

      // 2x2 headline grid
      const headline = Array.isArray(R.headline) ? R.headline : [];
      const gx = 90, gw = W - 180, gap = 28;
      const tileW = (gw - gap) / 2, tileH = 150;
      const rowY = [400, 400 + tileH + gap];
      for (let i = 0; i < 4; i++) {
        const col = i % 2, row = i < 2 ? 0 : 1;
        drawStatTile(ctx, headline[i], gx + col * (tileW + gap), rowY[row], tileW, tileH);
      }

      // strongest subjects strip (up to 4)
      const rows = (R.subjects && Array.isArray(R.subjects.rows)) ? R.subjects.rows.slice(0, 4) : [];
      let afterSubjects = 760;
      if (rows.length > 0) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.70)';
        ctx.font = `600 23px ${SANS}`;
        ctx.fillText('STRONGEST SUBJECTS', gx, 792);
        const y0 = 838, step = 48;
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const ry = y0 + i * step;
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(255,255,255,0.94)';
          ctx.font = `500 26px ${SANS}`;
          ctx.fillText(ellipsize(ctx, r.name, 300), gx + 10, ry);
          // track + fill
          const barX = 440, barW = 340, barY = ry - 16, barH = 13;
          roundRect(ctx, barX, barY, barW, barH, barH / 2);
          ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
          const pct = Math.max(0, Math.min(100, r.accuracy || 0));
          if (pct > 0) {
            roundRect(ctx, barX, barY, Math.max(barH, barW * pct / 100), barH, barH / 2);
            ctx.fillStyle = r.color || '#FFFFFF'; ctx.fill();
          }
          ctx.textAlign = 'right';
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `600 25px ${SANS}`;
          ctx.fillText(`${pct}%`, W - gx, ry);
        }
        afterSubjects = y0 + rows.length * step;
      }

      // baked-in disclaimer (the gap the plain share card leaves open), left
      // column so it never collides with the corner QR.
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.66)';
      ctx.font = `500 21px ${SANS}`;
      const discY = Math.max(afterSubjects + 60, 1090);
      const discLines = wrapLines(ctx, R.disclaimerShort || '', 690, 2);
      discLines.forEach((ln, i) => ctx.fillText(ln, gx, discY + i * 30));

      // QR bottom-right (referral, VIA.POSTER); a bonus, never a blocker.
      const qrModule = 5, margin = 64, panelPad = 18, quiet = 4;
      let qrDrawn = false;
      if (url) {
        try {
          const meas = measureQrPanel(url, qrModule, { quiet, panelPad });
          if (meas) {
            const pw = meas.panelW;
            drawQrMatrix(ctx, url, W - margin - pw, H - margin - pw, qrModule, {
              panel: true, panelShadow: true, panelPad, panelRadius: 16, dark: '#0B1220',
            });
            qrDrawn = true;
          }
        } catch (e) { /* QR is optional */ }
      }

      // bottom-left scan label balances the QR
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `600 29px ${SANS}`;
      ctx.fillText(qrDrawn ? 'Scan to try it free' : 'Practise free, no ads', gx, H - margin - 44);
      ctx.font = `600 27px ${SERIF}`;
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillText(displayUrl || 'www.nurseholic.in', gx, H - margin - 6);

      canvas.toBlob(b => { b ? resolve(b) : reject(new Error('toBlob-null')); }, 'image/png', 0.95);
    } catch (e) { reject(e); }
  });
}

// ---- share / save ----------------------------------------------------
// Resolves: 'shared' | 'cancelled' | 'downloaded' | 'error'.
export async function shareOrSavePng(blob, filename, meta = {}) {
  if (!blob) return 'error';
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    const data = { files: [file], title: meta.title || 'NurseHolic', ...(meta.text ? { text: meta.text } : {}) };
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(data)) {
      try { await navigator.share(data); return 'shared'; }
      catch (e) { return 'cancelled'; }   // user dismissed the sheet
    }
  } catch (e) { /* fall through to download */ }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return 'downloaded';
  } catch (e) { return 'error'; }
}
