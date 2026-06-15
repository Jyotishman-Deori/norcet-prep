// =====================================================================
// SHARED RESULT CARDS  (Pipeline step 38 / A1 session 4 — extracted from App.jsx)
// The presentational cards shown on EVERY results surface (Results,
// AdvancedTestResults, DosageResults): GuestSavePrompt / MotivationCard /
// ShareScoreButton / TimeQuadrant, plus their private helpers (the motivation-
// quote picker, the share-card caption, and the time-quadrant classifier).
//
// [A7] GuestSavePrompt / ShareScoreButton / TimeQuadrant read the active theme
// via useTheme(); MotivationCard is theme-free (hardcoded gradients).
// QUADRANT_META moved INSIDE TimeQuadrant (its tone() closures read T).
// =====================================================================
import React, { useState, useRef } from 'react';
import { UserPlus, Flame, Sparkles, Target, Upload, ChevronDown, EyeOff } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Button, Card, Pill } from './primitives.jsx';
import { topicName, topicIcon } from '../lib/topics.js';


// =====================================================================
// MOTIVATION QUOTES — shown on completion screens, picked by TONE so the
// message fits how the user actually did. A triumphant quote on a 20% score
// reads as mockery; a defeatist quote on 95% reads as wrong. The picker takes
// the score percentage and returns a quote whose tone is appropriate.
//
// Tone buckets:
//   victory  — celebrate genuine excellence (≥75%)
//   growth   — encourage steady progress, recognise effort (40–74%)
//   support  — kind, honest, resilience-themed; never mocks or fake-cheers (<40%)
// =====================================================================
const MOTIVATION_QUOTES = {
  victory: [
    { t: 'Success is the sum of small efforts repeated daily.', a: 'Robert Collier' },
    { t: 'Excellence is not an act, but a habit.', a: 'Will Durant' },
    { t: 'Quality is not an act, it is a habit.', a: 'Aristotle' },
    { t: 'The harder you work, the luckier you get.', a: 'Gary Player' },
    { t: 'Discipline is the bridge between goals and accomplishment.', a: 'Jim Rohn' },
    { t: 'Energy and persistence conquer all things.', a: 'Benjamin Franklin' },
    { t: "Today's accomplishments were yesterday's impossibilities.", a: 'Robert H. Schuller' },
    { t: 'The difference between ordinary and extraordinary is that little extra.', a: 'Jimmy Johnson' },
    { t: 'Confidence comes from discipline and training.', a: 'Robert Kiyosaki' },
    { t: 'Make each day your masterpiece.', a: 'John Wooden' },
    { t: 'Action is the foundational key to all success.', a: 'Pablo Picasso' },
    { t: 'Continuous effort is the key to unlocking your potential.', a: 'Winston Churchill' },
    { t: "Be so good they can't ignore you.", a: 'Steve Martin' },
    { t: 'The only way to do great work is to love what you do.', a: 'Steve Jobs' },
    { t: 'You are capable of more than you know.', a: 'Unknown' },
    { t: 'Knowledge is power.', a: 'Francis Bacon' }
  ],
  growth: [
    { t: 'Strive for progress, not perfection.', a: 'Unknown' },
    { t: 'Little by little, one travels far.', a: 'Spanish proverb' },
    { t: 'Small steps every day add up to big results.', a: 'Unknown' },
    { t: 'Slow progress is still progress.', a: 'Unknown' },
    { t: 'A river cuts through rock not by power, but by persistence.', a: 'Jim Watkins' },
    { t: 'The expert in anything was once a beginner.', a: 'Helen Hayes' },
    { t: 'Focus on the step in front of you, not the whole staircase.', a: 'Unknown' },
    { t: 'It does not matter how slowly you go, so long as you do not stop.', a: 'Confucius' },
    { t: 'The man who moves a mountain begins by carrying small stones.', a: 'Confucius' },
    { t: "A year from now you'll wish you had started today.", a: 'Karen Lamb' },
    { t: 'Perseverance is many short races, one after another.', a: 'Walter Elliot' },
    { t: 'The future depends on what you do today.', a: 'Mahatma Gandhi' },
    { t: 'Your future is created by what you do today.', a: 'Robert Kiyosaki' },
    { t: 'Learn as if you were to live forever.', a: 'Mahatma Gandhi' },
    { t: 'Discipline equals freedom.', a: 'Jocko Willink' },
    { t: 'Start where you are. Use what you have. Do what you can.', a: 'Arthur Ashe' },
    { t: 'The journey of a thousand miles begins with one step.', a: 'Lao Tzu' },
    { t: 'Goals turn the invisible into the visible.', a: 'Tony Robbins' },
    { t: 'Keep going. Everything you need will come to you.', a: 'Unknown' },
    { t: 'Do something today your future self will thank you for.', a: 'Unknown' }
  ],
  support: [
    { t: 'Fall seven times, stand up eight.', a: 'Japanese proverb' },
    { t: 'Our greatest glory is in rising every time we fall.', a: 'Confucius' },
    { t: 'Failure is the chance to begin again, more intelligently.', a: 'Henry Ford' },
    { t: "I have not failed. I've just found ways that won't work.", a: 'Thomas Edison' },
    { t: 'The comeback is always stronger than the setback.', a: 'Unknown' },
    { t: 'Difficult roads often lead to beautiful destinations.', a: 'Unknown' },
    { t: 'Tough times never last, but tough people do.', a: 'Robert H. Schuller' },
    { t: "Stars can't shine without darkness.", a: 'Unknown' },
    { t: 'The pain you feel today is the strength you feel tomorrow.', a: 'Unknown' },
    { t: 'Success is not final, failure is not fatal: courage counts.', a: 'Winston Churchill' },
    { t: "Don't let yesterday take up too much of today.", a: 'Will Rogers' },
    { t: "Courage doesn't always roar.", a: 'Mary Anne Radmacher' },
    { t: 'It is never too late to be what you might have been.', a: 'George Eliot' },
    { t: 'With the new day comes new strength and new thoughts.', a: 'Eleanor Roosevelt' },
    { t: 'The darkest hour has only sixty minutes.', a: 'Morris Mandel' },
    { t: 'Every expert was once where you are right now.', a: 'Unknown' },
    { t: "Mistakes are proof that you're trying.", a: 'Unknown' },
    { t: "What didn't work today teaches what will work tomorrow.", a: 'Unknown' }
  ]
};

// Pick a quote whose tone matches the score (0–100). Falls back gracefully
// if a bucket is somehow empty. Remembers the last quote shown (module-level,
// persists across completion screens within a session) and re-rolls so the
// same quote never appears twice in a row.
let _lastQuoteText = null;
function pickQuoteForScore(pct) {
  let bucket;
  if (pct >= 75)      bucket = MOTIVATION_QUOTES.victory;
  else if (pct >= 40) bucket = MOTIVATION_QUOTES.growth;
  else                bucket = MOTIVATION_QUOTES.support;
  if (!bucket || bucket.length === 0) bucket = MOTIVATION_QUOTES.growth;
  let pick = bucket[Math.floor(Math.random() * bucket.length)];
  if (bucket.length > 1) {
    let guard = 0;
    while (pick.t === _lastQuoteText && guard < 8) {
      pick = bucket[Math.floor(Math.random() * bucket.length)];
      guard++;
    }
  }
  _lastQuoteText = pick.t;
  return pick;
}

// =====================================================================
// SEED QUESTIONS  (concise but exam-quality, with "why others wrong")
// =====================================================================
// [A1 step 34] SEED_QUESTIONS (offline fallback pool) moved to ./data/seed.js

// =====================================================================
// CONCEPT CARDS — moved out of bundle (Pipeline step 22 / A2)
// ---------------------------------------------------------------------
// The Learn-mode concept cards (base + the AIIMS additions, MERGED ahead of
// time) now live in /public/data/concept-cards.json and are fetched lazily +
// cached locally the first time a Learn screen opens — useContent('conceptCards').
// Edit that JSON to change Learn content without a code redeploy. (A2 OPTION B.)
// =====================================================================

// =====================================================================
// STORAGE
// =====================================================================

// [A1 step 34] DEFAULT_DATA moved to ./data/seed.js

// Legacy on-device data, from before profiles existed. Reading is handled
// in `peekLegacyData` below — kept around so a one-time migration into the
// first profile created on this device can still find old progress.
//
// Note: `loadUserData` / `saveUserData` were removed in favour of the
// profile-scoped storage. All study data now lives in the profile blob;
// see `loadProfile` / `saveProfile`.

// =====================================================================
// PROFILE SYSTEM
//   - profiles live in SHARED storage so the same login works on any device
//   - the session pointer (who's logged in on THIS device) lives in personal storage
//   - passwords are PBKDF2 (SHA-256, 100k iter) + per-profile random salt; never plaintext
// =====================================================================

// =====================================================================
// SAFE STORAGE — shim over `./storage.js`
//   The artifact host's `window.storage` postMessage bridge is gone. Every
//   storage call now goes through `./storage.js`, which is backed by
//   IndexedDB (via the `idb` library) for device-local data and Supabase for
//   shared data. Same `get / set / delete / list` contract as the original
//   `window.storage`, same return shapes — so the ~40 call sites elsewhere in
//   this file did not need to change. `delete` maps to `kvStorage.del` (the
//   storage module avoids `delete` as a property name for lint reasons).
//
//   The `shared` flag on each call is the boundary between truly device-local
//   data (sessions, theme, onboarding, admin unlock) and data that is visible
//   across users/devices (profiles, banks, feedback, announcements).
// =====================================================================
// [A1 step 35] STORAGE_OP_TIMEOUT_MS moved to ./lib/safe-storage.js

// Generic promise-timeout helper. Races an op against a deadline and reports
// WHY it ended: { ok, value } | { timeout:true } | { error }. Used by the P1
// cloud-sync paths (canonical Supabase writes via kvStorage) where we want an
// explicit success/timeout/error signal that the plain safeStorage wrapper
// flattens away. The op itself decides what it calls (here, kvStorage).
// [A1 step 35] raceStorage moved to ./lib/safe-storage.js

// [A1 step 35] safeStorage shim moved to ./lib/safe-storage.js

// =====================================================================
// EXTERNAL STATIC CONTENT  (Pipeline step 22 / A2)  [LOCAL]
// ---------------------------------------------------------------------
// Five large, non-fallback content blobs (the Reference table, Dosage-drill
// questions, Help text, and the merged Learn concept-cards) used to be
// inlined in this file and shipped on every first paint, even though they
// are only read when the user opens that specific screen. They now live as
// static JSON under /public/data/*.json and are fetched LAZILY the first
// time the relevant screen mounts, then cached in the LOCAL (per-device)
// IndexedDB layer via the existing safeStorage shim (shared:false) so every
// subsequent load — including OFFLINE — is instant and network-free.
//
// SEED_QUESTIONS deliberately STAYS in-bundle: it is the offline fallback
// question pool and must always be available with zero network (A2 spec).
//
// OFFLINE: after the first successful online load of each file the content
// is served from IndexedDB and works fully offline. prefetchAllContent()
// (called once after first paint, see App) warms that cache in the
// background on first online launch, so Reference/Dosage/Help/Learn are
// available offline even before the user opens them. For zero-network
// availability from the very FIRST install, also add `data/**` to the
// vite-pwa precache globs in the (out-of-bundle) PWA config — see the A2
// note in the roadmap. Until then this loader degrades GRACEFULLY: an
// offline + uncached miss shows a friendly "couldn't load — connect once"
// state, never a crash. schemaVersion untouched (no migration); writes only
// a new LOCAL content:* cache key, never storage.js / shared / sync data.

// Bump when you edit any /public/data/*.json so cached copies refresh.

function GuestSavePrompt({ onSignIn }) {
  const { theme: T } = useTheme();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <Card className="p-4 mb-3 anim-fadeup" style={{ background: T.primary + '0E', border: `1px solid ${T.primary}33` }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '1A' }}>
          <UserPlus size={18} style={{ color: T.primary }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold" style={{ color: T.ink }}>Keep this result?</div>
          <div className="text-xs mt-0.5 leading-relaxed" style={{ color: T.inkSoft }}>
            You're a guest — this progress is saved on this device only. Sign in to keep your streak and history safe and synced.
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <Button size="sm" onClick={onSignIn}>Sign in to save</Button>
            <button onClick={() => setDismissed(true)}
                    className="no-tap-highlight text-xs font-medium px-2 py-1.5 rounded-lg active:bg-black/5"
                    style={{ color: T.muted }}>
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}


function MotivationCard({ pct = 50, label = 'session' }) {
  const tier =
    pct >= 75 ? 'victory' :
    pct >= 40 ? 'growth'  :
                'support';

  // Quote picked exactly once per mount, matched to tier — no defeatist quotes
  // on a 95% and no triumphant quotes on a 20%. A ref (not useMemo) guarantees
  // the quote can never re-roll on an incidental re-render.
  const quoteRef = useRef(null);
  if (quoteRef.current === null) quoteRef.current = pickQuoteForScore(pct);
  const quote = quoteRef.current;

  // Tier-specific copy + visuals. Kept warm and honest, never mocking.
  const config = {
    victory: {
      headline: pct >= 90 ? 'Outstanding!' : 'Excellent work!',
      sub: `That was a strong ${label}.`,
      icon: <Sparkles size={20} color="#FFF" />,
      gradient: 'linear-gradient(135deg, #0F4C4C 0%, #1A6868 100%)',
      textColor: '#FFF',
      mutedColor: 'rgba(255,255,255,0.7)'
    },
    growth: {
      headline: pct >= 60 ? 'Good progress.' : 'Nice effort.',
      sub: `Every ${label} sharpens your prep.`,
      icon: <Target size={20} color="#FFF" />,
      gradient: 'linear-gradient(135deg, #1A6868 0%, #3D8585 100%)',
      textColor: '#FFF',
      mutedColor: 'rgba(255,255,255,0.75)'
    },
    support: {
      headline: pct === 0 ? "That was tough." : 'Keep going.',
      sub: `Each ${label} shows you exactly what to focus on next.`,
      icon: <Flame size={20} color="#FFF" />,
      // Warm, earthy — not red/alarming. Supportive, not celebratory.
      gradient: 'linear-gradient(135deg, #7A4A2E 0%, #A56B47 100%)',
      textColor: '#FFF',
      mutedColor: 'rgba(255,255,255,0.78)'
    }
  }[tier];

  return (
    <div className="anim-scalein rounded-2xl p-5 mb-6 text-center"
         style={{ background: config.gradient, color: config.textColor }}>
      <div className="flex justify-center mb-2">
        <div className="w-11 h-11 rounded-full flex items-center justify-center"
             style={{ background: 'rgba(255,255,255,0.15)' }}>
          {config.icon}
        </div>
      </div>
      <div className="font-display text-xl font-semibold mb-1">{config.headline}</div>
      <div className="text-xs mb-3" style={{ color: config.mutedColor }}>{config.sub}</div>
      <div className="font-display text-base leading-snug mb-2">“{quote.t}”</div>
      <div className="text-xs" style={{ color: config.mutedColor }}>— {quote.a}</div>
    </div>
  );
}

// =====================================================================
// SHAREABLE RESULT CARD  (Pipeline step 21 / P5)  [ARTIFACT — no storage]
// ---------------------------------------------------------------------
// A "Share score" button shown on every results screen: the quick/topic/
// drill quiz Results, the mock + previous-paper AdvancedTestResults, and the
// dosage-drill DosageResults. On tap it paints a 1080x1080 Instagram-friendly
// card to an OFFSCREEN <canvas> using the raw Canvas API — deliberately NO
// new dependency (html2canvas avoided to keep the bundle + risk down) — then
// shares it via the Web Share API (navigator.share with a file, works on
// mobile) or falls back to a PNG download (desktop / unsupported).
//
// Purely presentational + ephemeral: it reads only props already present on
// the results screen and writes NOTHING to storage, so schemaVersion stays at
// 9 and there is no migration. Card colours come from the live theme `T`
// (primary -> primarySoft gradient + white text), so it tracks all five
// themes automatically. displayName / streak / topic are read DEFENSIVELY
// (absent -> graceful fallback) so the button is safe to drop onto any
// results surface and safe for existing users.
// =====================================================================


// Score-band motivational line — copy fixed by the P5 spec.
function shareMotivation(pct) {
  if (pct >= 90) return 'Crushing it! \uD83D\uDD25';        // 🔥
  if (pct >= 70) return 'Strong performance! \uD83D\uDCAA'; // 💪
  if (pct >= 50) return 'Getting there! \uD83D\uDCC8';      // 📈
  return 'Keep practicing! \uD83C\uDFAF';                   // 🎯
}


function quadrantOf(outcome, seconds, slowSec) {
  if (outcome === 'na') return 'na';
  const slow = (Number(seconds) || 0) > slowSec;
  if (outcome === 'correct') return slow ? 'shaky' : 'mastered';
  return slow ? 'gap' : 'misread';
}


function ShareScoreButton({ correct, total, quizType, topicName: topicLabel = null,
                            displayName = null, streak = 0, className = '', size = 'lg' }) {
  const { theme: T } = useTheme();
  // status: 'idle' | 'working' | 'downloaded' | 'error'
  const [status, setStatus] = useState('idle');

  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCorrect = Math.max(0, Math.min(safeTotal, Number(correct) || 0));
  const pct = safeTotal > 0 ? Math.round((safeCorrect / safeTotal) * 100) : 0;

  // Paint the 1080x1080 card; resolves with a PNG Blob.
  const paintCard = () => new Promise((resolve, reject) => {
    try {
      const S = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no-2d-context')); return; }

      // rounded-rect path helper
      const rr = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };
      // ellipsize text to fit a pixel width (uses the CURRENT ctx.font)
      const fit = (text, maxW) => {
        let s = String(text == null ? '' : text);
        if (ctx.measureText(s).width <= maxW) return s;
        while (s.length > 1 && ctx.measureText(s + '\u2026').width > maxW) s = s.slice(0, -1);
        return s + '\u2026';
      };

      // --- #11 premium background: diagonal layered gradient with a deep
      // base, two soft radial glow orbs, and faint diagonal texture lines ---
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, T.primary || '#0F4C4C');
      g.addColorStop(0.55, T.primarySoft || '#1A6868');
      g.addColorStop(1, '#101018');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      let orb = ctx.createRadialGradient(S * 0.85, S * 0.12, 0, S * 0.85, S * 0.12, 360);
      orb.addColorStop(0, 'rgba(255,255,255,0.16)');
      orb.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = orb; ctx.fillRect(0, 0, S, S);
      orb = ctx.createRadialGradient(S * 0.1, S * 0.92, 0, S * 0.1, S * 0.92, 420);
      orb.addColorStop(0, 'rgba(255,255,255,0.10)');
      orb.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = orb; ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = 'rgba(255,255,255,0.045)';
      ctx.lineWidth = 2;
      for (let x = -S; x < S * 2; x += 64) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + S, S); ctx.stroke();
      }

      // double inner frame — hairline + soft outer ring
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 3;
      rr(48, 48, S - 96, S - 96, 40);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 10;
      rr(36, 36, S - 72, S - 72, 48);
      ctx.stroke();

      const cx = S / 2;
      ctx.textAlign = 'center';

      // ── PREMIUM POSTER LAYOUT (issues round) ─────────────────────────
      // Fixed vertical rhythm with a RESERVED footer zone, so the
      // motivational line and the URL pill can never collide (the old
      // layout let them overlap when a streak line pushed things down).
      //
      //   140  brand name            (display serif)
      //   188  tagline
      //   268  aspirant name
      //   470  progress ring centre  (r=150)
      //   708  score line
      //   780  quiz-type pill
      //   872  stats line  (streak · date)
      //   936  motivational line
      //  1006  footer URL pill       (own zone, nothing below/above it)

      // --- brand ---
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 64px Georgia, "Times New Roman", serif';
      ctx.fillText('NORCET Prep', cx, 140);
      ctx.font = '500 28px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillText('Free nursing exam preparation', cx, 188);
      // hairline under the brand block
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 110, 214); ctx.lineTo(cx + 110, 214); ctx.stroke();

      // --- display name ---
      const who = (displayName && String(displayName).trim()) || 'NORCET Aspirant';
      ctx.font = '600 38px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(fit(who, S - 240), cx, 272);

      // --- progress ring, prominently centred ---
      const ringCx = cx, ringCy = 470, ringR = 150, ringW = 26;
      ctx.lineWidth = ringW;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.20)';      // track
      ctx.beginPath();
      ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();                                        // progress + glow
      ctx.shadowColor = 'rgba(255,255,255,0.55)';
      ctx.shadowBlur = 26;
      ctx.strokeStyle = '#FFFFFF';
      const startA = -Math.PI / 2;
      ctx.beginPath();
      ctx.arc(ringCx, ringCy, ringR, startA, startA + Math.PI * 2 * (pct / 100));
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#FFFFFF';                         // pct in centre
      ctx.font = '700 110px Georgia, "Times New Roman", serif';
      ctx.fillText(`${pct}%`, ringCx, ringCy + 38);

      // --- score line ---
      ctx.font = '700 58px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${safeCorrect} / ${safeTotal} correct`, cx, 712);

      // --- quiz type (+ topic) pill ---
      let typeText = quizType || 'Practice quiz';
      if (topicLabel) typeText += ` \u00B7 ${topicLabel}`;
      ctx.font = '600 28px system-ui, -apple-system, "Segoe UI", sans-serif';
      const padX = 34, pillH = 62;
      const pillW = Math.min(S - 200, ctx.measureText(typeText).width + padX * 2);
      rr(cx - pillW / 2, 752, pillW, pillH, pillH / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(fit(typeText, pillW - padX * 2), cx, 793);

      // --- structured stats line: streak · date (one clean row) ---
      const dateStr = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      const statsLine = streak > 0 ? `\uD83D\uDD25 ${streak} day streak  \u00B7  ${dateStr}` : dateStr;
      ctx.font = '600 30px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(statsLine, cx, 872);

      // --- motivational line (no emoji collisions — its own row) ---
      ctx.font = '600 36px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(shareMotivation(pct), cx, 936);

      // --- footer url — refined pill, alone in its reserved zone ---
      const urlText = (typeof window !== 'undefined' && window.location && window.location.host) || 'norcet-prep.vercel.app';
      ctx.font = '600 28px Georgia, "Times New Roman", serif';
      const uw = ctx.measureText(urlText).width + 76;
      rr(cx - uw / 2, S - 114, uw, 58, 29);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(urlText, cx, S - 75);

      canvas.toBlob(b => { b ? resolve(b) : reject(new Error('toBlob-null')); }, 'image/png', 0.95);
    } catch (e) { reject(e); }
  });

  const onShare = async () => {
    if (status === 'working') return;
    setStatus('working');

    let blob;
    try { blob = await paintCard(); }
    catch (e) { setStatus('error'); setTimeout(() => setStatus('idle'), 3000); return; }

    const file = new File([blob], 'norcet-result.png', { type: 'image/png' });
    // #11 — inviting caption: a friendly challenge + the tappable app link
    // (share targets auto-link the URL; ?ref=score marks these installs).
    const appUrl = ((typeof window !== 'undefined' && window.location && window.location.origin) || 'https://norcet-prep.vercel.app') + '/?ref=score';
    const inviteLine = pct >= 80
      ? `Just aced a ${quizType || 'practice'} session on NORCET Prep \u2014 ${safeCorrect}/${safeTotal} \uD83D\uDD25 Think you can beat that?`
      : pct >= 50
        ? `Putting in the NORCET reps \u2014 ${safeCorrect}/${safeTotal} this round and climbing \uD83D\uDCAA Join me?`
        : `Every attempt counts \u2014 grinding NORCET prep one session at a time \uD83C\uDFAF Study with me?`;
    const shareData = {
      files: [file],
      title: 'My NORCET Prep result',
      text: `${inviteLine}\nIt's free \u2014 tests, revision notes, PYQs & more: ${appUrl}`
    };

    // Mobile: native share sheet (only if it can share THIS file).
    if (typeof navigator !== 'undefined' && navigator.share &&
        navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setStatus('idle');                 // shared — no toast needed
      } catch (e) {
        setStatus('idle');                 // user cancelled the sheet — quiet
      }
      return;
    }

    // Desktop / unsupported: download the PNG.
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'norcet-result.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setStatus('downloaded'); setTimeout(() => setStatus('idle'), 3500);
    } catch (e) {
      setStatus('error'); setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <div className={className}>
      <Button onClick={onShare} variant={size === 'md' ? 'ghost' : 'soft'} size={size} className="w-full"
              icon={<Upload size={size === 'md' ? 16 : 18} />} disabled={status === 'working'}>
        {status === 'working' ? 'Creating\u2026' : 'Share score'}
      </Button>
      {status === 'downloaded' && (
        <div className="text-xs text-center mt-2 anim-fadeup" role="status" aria-live="polite" style={{ color: T.muted }}>
          Image saved — share it on WhatsApp or Instagram.
        </div>
      )}
      {status === 'error' && (
        <div className="text-xs text-center mt-2 anim-fadeup" role="status" aria-live="polite" style={{ color: T.error }}>
          Couldn’t create the image. Please try again.
        </div>
      )}
    </div>
  );
}

// =====================================================================
// TIME QUADRANT  (Pipeline step 9 / P12) — per-question time × correctness
// ---------------------------------------------------------------------
// Shown on BOTH post-quiz screens (Results + AdvancedTestResults). Pure
// presentational: the caller normalizes its attempts into
//   { qId, q, outcome: 'correct'|'wrong'|'na', seconds }
// and supplies the per-question "slow" threshold (different for a timed
// mock vs an untimed quick round). Reads only data already present in the
// results props — no storage, no schema change, schemaVersion untouched.
//
// Quadrants (attempted questions only):
//   fast + correct → Mastered           fast + wrong → Misread / guessed
//   slow + correct → Shaky understanding slow + wrong → Concept gap
// Not-attempted questions go to a neutral fifth bucket and are NEVER
// labelled wrong in this view.
// =====================================================================

function TimeQuadrant({ items, slowSec, idealSec, totalSec, mode }) {
  const { theme: T } = useTheme();

const QUADRANT_META = {
  mastered: { name: 'Mastered',            rec: 'Solid — no action needed.',           tone: () => T.success },
  misread:  { name: 'Misread / guessed',   rec: 'Fast but wrong — slow down & read.',  tone: () => T.accent  },
  shaky:    { name: 'Shaky understanding', rec: 'Right but slow — drill for fluency.', tone: () => T.primary },
  gap:      { name: 'Concept gap',         rec: 'Slow & wrong — study, then drill.',   tone: () => T.error   },
};


  const [open, setOpen] = useState(null);
  if (!items || items.length === 0) return null;

  const tagged = items.map(it => ({ ...it, quad: quadrantOf(it.outcome, it.seconds, slowSec) }));
  const counts = { mastered: 0, misread: 0, shaky: 0, gap: 0, na: 0 };
  tagged.forEach(t => { counts[t.quad]++; });

  const attempted = tagged.filter(t => t.quad !== 'na');
  const overCount = attempted.filter(t => (Number(t.seconds) || 0) > slowSec).length;
  const n = items.length;
  const avgSec = n > 0 ? Math.round(totalSec / n) : 0;

  const fmtSec = (s) => {
    s = Math.round(Number(s) || 0);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  };
  const toneFor = (k) => (k === 'na' ? T.muted : QUADRANT_META[k].tone());

  return (
    <div className="mb-8">
      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Time analysis</div>

      {/* Overall summary line — numbers derived from the data. */}
      <div className="text-sm leading-relaxed mb-4" style={{ color: T.inkSoft }}>
        You spent <span className="font-semibold" style={{ color: T.ink }}>{fmtSec(totalSec)}</span> on this {mode === 'mock' ? 'test' : 'round'}.{' '}
        Average <span className="font-semibold" style={{ color: T.ink }}>{avgSec}s</span> per question{idealSec
          ? <>, ideal pace was <span className="font-semibold" style={{ color: T.ink }}>{Math.round(idealSec)}s</span></>
          : ' (no time limit — baseline 60s)'}.{' '}
        <span className="font-semibold" style={{ color: overCount > 0 ? T.accent : T.muted }}>{overCount}</span> question{overCount === 1 ? '' : 's'} over {Math.round(slowSec)}s.
      </div>

      {/* Four quadrant cards. Tap a non-empty card to reveal its questions. */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {['mastered', 'misread', 'shaky', 'gap'].map(k => {
          const meta = QUADRANT_META[k];
          const tone = meta.tone();
          const isOpen = open === k;
          const c = counts[k];
          return (
            <Card key={k} onClick={c > 0 ? () => setOpen(isOpen ? null : k) : undefined}
                  className="p-3"
                  style={{ borderLeft: `3px solid ${tone}`, opacity: c === 0 ? 0.5 : 1,
                           boxShadow: isOpen ? `0 4px 16px ${tone}22` : undefined }}>
              <div className="flex items-baseline justify-between">
                <div className="font-display text-2xl font-semibold tabular-nums" style={{ color: tone }}>{c}</div>
                {c > 0 && <ChevronDown size={14} style={{ color: T.muted, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
              </div>
              <div className="text-xs font-semibold mt-0.5 leading-tight" style={{ color: T.ink }}>{meta.name}</div>
              <div className="text-[10px] leading-snug mt-1" style={{ color: T.muted }}>{meta.rec}</div>
            </Card>
          );
        })}
      </div>

      {/* Not-attempted bucket — only when present. */}
      {counts.na > 0 && (
        <Card onClick={() => setOpen(open === 'na' ? null : 'na')} className="p-3 mb-3"
              style={{ borderLeft: `3px solid ${T.muted}`, boxShadow: open === 'na' ? `0 4px 16px ${T.muted}22` : undefined }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <EyeOff size={14} style={{ color: T.muted, flexShrink: 0 }} />
              <span className="text-xs font-semibold" style={{ color: T.ink }}>Not attempted</span>
              <span className="text-xs tabular-nums" style={{ color: T.muted }}>· {counts.na}</span>
            </div>
            <ChevronDown size={14} style={{ color: T.muted, transform: open === 'na' ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </div>
          <div className="text-[10px] mt-1" style={{ color: T.muted }}>
            {mode === 'mock' ? 'Left blank — not scored as wrong here.' : 'Revealed without answering — not scored as wrong here.'}
          </div>
        </Card>
      )}

      {/* Dot strip — one dot per question, in original order. */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        {tagged.map((t, i) => (
          <div key={(t.qId ?? '') + '_' + i} title={`Q${i + 1} · ${fmtSec(t.seconds)}`}
               className="w-2.5 h-2.5 rounded-full"
               style={{ background: toneFor(t.quad), opacity: t.quad === 'na' ? 0.4 : 0.9 }} />
        ))}
      </div>
      <div className="text-[10px] mb-3" style={{ color: T.muted }}>Each dot is one question, in order · colour = quadrant.</div>

      {/* Expanded detail for the tapped quadrant. */}
      {open && (
        <div className="space-y-2 anim-fadeup">
          {tagged.filter(t => t.quad === open).map((t, i) => {
            const q = t.q;
            const tone = toneFor(open);
            return (
              <Card key={(t.qId ?? '') + '_d_' + i} className="p-3" style={{ background: T.surfaceWarm }}>
                <div className="flex items-start gap-2">
                  <div className="text-base flex-shrink-0">{topicIcon(q && q.topic)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm leading-snug" style={{ color: T.ink }}>{(q && q.q) || '—'}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Pill bg={tone + '1A'} color={tone}>{topicName(q && q.topic)}</Pill>
                      <span className="text-[10px] tabular-nums" style={{ color: T.muted }}>{fmtSec(t.seconds)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


export { GuestSavePrompt, MotivationCard, ShareScoreButton, TimeQuadrant };
