// =====================================================================
// src/lib/sound.js  (Feature F-B — pull-to-refresh sound)
// A tiny synthesized "pull-to-refresh" pop via the Web Audio API — no asset
// files. Subtle, <0.4s, played at the moment of release. Gated by a user
// preference (default ON) and fully feature-detected; any failure is silent.
//
// Web limitation, stated honestly: there is NO web API to read a phone's
// hardware mute switch, so true silent-switch respect isn't possible in a
// PWA. The user-facing toggle (Settings) is how users mute it; WebAudio also
// follows the device MEDIA volume. Always called from a user gesture (the
// release) so the audio context is allowed to produce sound.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS } from './keys.js';

let _ctx = null;
let _soundEnabled = true; // cached; hydrated by loadSoundEnabled()

export async function loadSoundEnabled() {
  try {
    const r = await safeStorage.get(KEYS.SOUND_ENABLED, false);
    if (r && r.value != null) _soundEnabled = !(r.value === 'false' || r.value === false || r.value === '0');
  } catch (e) {}
  return _soundEnabled;
}
export function isSoundEnabled() { return _soundEnabled; }
export async function setSoundEnabled(on) {
  _soundEnabled = !!on;
  try { await safeStorage.set(KEYS.SOUND_ENABLED, on ? 'true' : 'false', false); } catch (e) {}
}

function getCtx() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  if (!_ctx) { try { _ctx = new AC(); } catch (e) { return null; } }
  if (_ctx.state === 'suspended' && _ctx.resume) { try { _ctx.resume(); } catch (e) {} }
  return _ctx;
}

// A soft two-note rising pop (C5 → G5). Call on release only.
export function playRefreshSound() {
  if (!_soundEnabled) return;
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const note = (freq, t0, dur, peak) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + t0);
      g.gain.setValueAtTime(0.0001, now + t0);
      g.gain.exponentialRampToValueAtTime(peak, now + t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(now + t0); osc.stop(now + t0 + dur + 0.02);
    };
    note(523.25, 0, 0.18, 0.085);    // C5
    note(783.99, 0.07, 0.22, 0.075); // G5
  } catch (e) {}
}

// DRAWER — a single soft "tick" (one short sine blip, <90ms) for nav-drawer
// row taps. Deliberately quieter + shorter than the refresh pop so rapid
// navigation never gets noisy. Same gate (Settings → sound toggle), same
// feature detection, always called from a tap (user gesture).
export function playTapSound() {
  if (!_soundEnabled) return;
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now);            // E5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.05); // glide to A5
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
    osc.connect(g); g.connect(c.destination);
    osc.start(now); osc.stop(now + 0.1);
  } catch (e) {}
}
