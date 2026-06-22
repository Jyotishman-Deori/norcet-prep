// =====================================================================
// useListenMode  —  hands-free continuous read-aloud over a list of texts
// =====================================================================
// Wraps the Web Speech API into a playlist: speaks texts[index], auto-advances
// on end, and exposes play / pause / stop / next / prev + rate. Free, offline,
// no infra. Distinct from the one-shot TTSButton (single utterance).
//
// Browser-quirk handling:
//  • cancel() fires the previous utterance's `onend` in some engines — a per-
//    utterance token guard ignores those stale callbacks so we never double-skip.
//  • Chrome silently stops long utterances after ~15s — a keep-alive resume()
//    pulse while playing works around it.
// =====================================================================
import { useState, useRef, useCallback, useEffect } from 'react';

export function isSpeechSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis && !!window.SpeechSynthesisUtterance;
}

export function useListenMode(texts) {
  const supported = isSpeechSupported();
  const [active, setActive] = useState(false);   // listen session open
  const [playing, setPlaying] = useState(false); // currently speaking (not paused)
  const [index, setIndex] = useState(0);
  const [rate, setRate] = useState(1);

  const textsRef = useRef(texts);   textsRef.current = texts;
  const rateRef = useRef(rate);     rateRef.current = rate;
  const tokenRef = useRef(0);       // invalidates stale onend callbacks
  const speakRef = useRef(null);

  speakRef.current = (i) => {
    const arr = textsRef.current || [];
    if (!supported || i < 0 || i >= arr.length) { stop(); return; }
    const myToken = ++tokenRef.current;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    const u = new window.SpeechSynthesisUtterance(String(arr[i] || ''));
    u.rate = rateRef.current;
    u.onend = () => {
      if (tokenRef.current !== myToken) return; // stale (cancel / manual skip)
      const nextI = i + 1;
      if (nextI < (textsRef.current || []).length) speakRef.current(nextI);
      else { setPlaying(false); setActive(false); }
    };
    u.onerror = () => { if (tokenRef.current === myToken) setPlaying(false); };
    setIndex(i);
    setActive(true);
    setPlaying(true);
    try { window.speechSynthesis.speak(u); } catch (e) { setPlaying(false); }
  };

  const start = useCallback((i = 0) => { if (supported) speakRef.current(i); }, [supported]);
  const next = useCallback(() => speakRef.current(index + 1), [index]);
  const prev = useCallback(() => speakRef.current(Math.max(0, index - 1)), [index]);

  const pause = useCallback(() => {
    try { window.speechSynthesis.pause(); } catch (e) {}
    setPlaying(false);
  }, []);
  const resume = useCallback(() => {
    try { window.speechSynthesis.resume(); } catch (e) {}
    setPlaying(true);
  }, []);

  function stop() {
    tokenRef.current += 1; // invalidate any pending onend
    try { window.speechSynthesis.cancel(); } catch (e) {}
    setPlaying(false);
    setActive(false);
    setIndex(0);
  }
  const stopCb = useCallback(stop, []);

  const setRateSafe = useCallback((r) => {
    setRate(r);
    rateRef.current = r;
    // apply immediately to the current item if mid-play
    if (active) speakRef.current(index);
  }, [active, index]);

  // Keep-alive: Chrome pauses long utterances after ~15s; nudge resume while playing.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      try {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (e) {}
    }, 10000);
    return () => clearInterval(id);
  }, [playing]);

  // Clean up speech if the component unmounts mid-session.
  useEffect(() => () => { try { window.speechSynthesis.cancel(); } catch (e) {} }, []);

  return {
    supported, active, playing, index, rate,
    count: (texts || []).length,
    start, pause, resume, stop: stopCb, next, prev, setRate: setRateSafe,
  };
}
