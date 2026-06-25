// =====================================================================
// src/lib/ecg-audio.js — synthesized bedside-monitor sound (zero asset).
// No .mp3/.wav anywhere — every beep is generated live with the Web Audio
// API. The QRS beep pitch DROPS when SpO₂ falls (exactly like a real pulse
// oximeter), VF gets a rapid urgent alarm, asystole a slow flat tone. All
// scheduling is gated behind a user gesture (the Start button), so it never
// trips the browser autoplay block. Safe no-op if Web Audio is unavailable.
// =====================================================================
export function createMonitorAudio() {
  let ctx = null, timer = null;

  const ensure = () => {
    if (!ctx) {
      const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  };

  // One short, click-free tone (exponential attack + release envelope).
  const beep = (freq, dur, vol, type = 'sine') => {
    const c = ensure(); if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + dur + 0.03);
  };

  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

  const start = (rhythm) => {
    stop();
    if (!ensure()) return;
    if (rhythm.audio === 'flat') {
      // Asystole — slow, somber continuous-style alarm.
      beep(300, 0.55, 0.12);
      timer = setInterval(() => beep(300, 0.55, 0.12), 1100);
    } else if (rhythm.audio === 'vf') {
      // VF — rapid, urgent two-tone klaxon.
      let hi = false;
      timer = setInterval(() => { beep(hi ? 660 : 523, 0.09, 0.14, 'square'); hi = !hi; }, 200);
    } else {
      // Organised rhythm — beep at HR; desaturation lowers the pitch.
      const hr = rhythm.hr || 75;
      const ms = Math.max(280, 60000 / hr);
      const f = (rhythm.spo2 != null && rhythm.spo2 < 92) ? 640 : 880;
      const danger = rhythm.severity === 'critical';
      beep(f, 0.055, danger ? 0.16 : 0.1);
      timer = setInterval(() => beep(f, 0.055, danger ? 0.16 : 0.1), ms);
    }
  };

  const close = () => { stop(); try { ctx && ctx.close(); } catch (e) {} ctx = null; };

  return { start, stop, close };
}
