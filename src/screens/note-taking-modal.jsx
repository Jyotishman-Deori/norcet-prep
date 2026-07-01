// =====================================================================
// src/screens/note-taking-modal.jsx — AI Learning Note-Taking popup.
//
// Hosted once at the app root (NoteHost) and opened via requestNote() from the
// TopBar note button and the draggable floating button (note-fab.jsx). Same
// root-mount reasoning as FeedbackHost/HelpHost: a transformed screen ancestor
// would break position:fixed centering.
//
// The feature has a personal "study companion" identity (note-companion.js):
//   - FIRST open -> the user NAMES it (naming view, <=10 chars, required).
//   - Later opens -> a casual greeting + the popup TITLE is the chosen name.
//   - A GUIDE view (info icon) explains how it helps, techniques, limitations.
//   - The notebook is EDIT-GATED (read-only until Edit) with a Store button and
//     a togglable Auto-save on close. A Clear button is the only wipe path.
//   - Rename later from the title pencil or Settings (password-gated for
//     accounts) via the companion-rename modal.
//
// Copy flow (Structure A): Direct copies raw notes; Effective wraps them in the
// assembled master prompt (built purely client-side — no AI call).
// =====================================================================
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Check, Copy, Save, ChevronLeft, ChevronRight, ThumbsUp, ThumbsDown,
  Info, Sparkles, Pencil, BookOpen, Trash2, Wand2,
} from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { registerNoteOpener } from '../ui/primitives.jsx';
import { requestCompanionRename } from '../ui/companion-rename-channel.js';
import {
  MAX_BULLETS, DESIGNATIONS, LEVELS,
  DEFAULT_DESIGNATION_INDEX, DEFAULT_LEVEL_ID, DEFAULT_STRATEGY_ID,
  strategiesFor, normalizeBullets, assembleMasterPrompt,
} from '../lib/note-prompt.js';
import {
  loadNotes, saveNotes, clearNotes, loadAiInterest, saveAiInterest,
  loadCompanionName, saveCompanionName, loadNotesAutoSave, saveNotesAutoSave,
} from '../lib/notes-store.js';
import {
  NAME_MAX, SUGGESTIONS, sanitizeName, pickSuggestion, greetingFor, GUIDE, personalize,
} from '../lib/note-companion.js';
import { newFeedbackId, saveFeedback } from '../lib/feedback.js';

// --- small helpers ---------------------------------------------------------
const buzz = (ms) => { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
const eqBullets = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isWideScreen = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(min-width: 640px)').matches;

// iOS-safe clipboard: the payload is assembled by the caller BEFORE this runs,
// so writeText fires synchronously inside the user gesture (no async gap that
// iOS Safari/PWA would reject). Falls back to a hidden-textarea execCommand,
// and returns false if BOTH fail so the caller can offer manual copy.
async function copyToClipboard(str) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(str);
      return true;
    }
  } catch (e) { /* fall through to legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, str.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

// =====================================================================
// HOST — registers the open channel and mounts the modal when requested.
// =====================================================================
function NoteHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    registerNoteOpener(() => setOpen(true));
    return () => { registerNoteOpener(null); };
  }, []);
  if (!open) return null;
  return <NoteModal onClose={() => setOpen(false)} />;
}

// =====================================================================
// MODAL
// =====================================================================
function NoteModal({ onClose }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  // Key on the DURABLE uid (rename-safe) so notes/name survive an account
  // rename — profile.id is the displayName slug and changes on rename. Guests
  // have uid === id === GUEST_ID, so their key is unchanged.
  const profileId = (profile && (profile.uid || profile.id)) || 'guest';
  const profileName = (profile && profile.displayName) || null;

  const [text, setText] = useState('');
  const [savedBullets, setSavedBullets] = useState([]);
  const [mode, setMode] = useState('direct');            // 'direct' | 'effective'
  const [view, setView] = useState('loading');           // 'loading'|'naming'|'notes'|'picker'|'guide'
  const [name, setName] = useState('');                  // companion name (title)
  const [greeting, setGreeting] = useState('');          // casual line for returning users
  const [editing, setEditing] = useState(false);         // edit-gate: read-only until true
  const [autoSave, setAutoSave] = useState(false);       // auto-save on close pref
  const [clearing, setClearing] = useState(false);       // clear-confirm overlay
  const [dIdx, setDIdx] = useState(DEFAULT_DESIGNATION_INDEX);
  const [levelId, setLevelId] = useState(DEFAULT_LEVEL_ID);
  const [strategyId, setStrategyId] = useState(DEFAULT_STRATEGY_ID);
  const [effectiveReady, setEffectiveReady] = useState(false);
  const [copyState, setCopyState] = useState('idle');    // 'idle' | 'done'
  const [storeState, setStoreState] = useState('idle');
  const [manualCopy, setManualCopy] = useState('');      // set when clipboard fails
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [notice, setNotice] = useState('');
  const [vote, setVote] = useState(null);                // 'up' | 'down' | null

  const wide = useRef(isWideScreen()).current;
  const reduced = useRef(prefersReduced()).current;
  const noticeTimer = useRef(null);
  const copyTimer = useRef(null);
  const storeTimer = useRef(null);
  const sentVoteRef = useRef(null);   // last value already sent to the owner

  // Load persisted notes + companion name + prefs + vote on open. The first-run
  // path (no name yet) opens the naming view; otherwise notes view + greeting.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [b, nm, as, v] = await Promise.all([
        loadNotes(profileId),
        loadCompanionName(profileId),
        loadNotesAutoSave(profileId),
        loadAiInterest(profileId),
      ]);
      if (!alive) return;
      if (b.length) { setText(b.join('\n')); setSavedBullets(b); }
      setAutoSave(as);
      if (v) { setVote(v); sentVoteRef.current = v; } // seed: don't re-send the stored vote
      if (nm) {
        setName(nm);
        setGreeting(greetingFor(nm));
        setEditing(b.length === 0);   // an empty notebook opens ready to type
        setView('notes');
      } else {
        setView('naming');            // first run — pick a name first
      }
    })();
    return () => { alive = false; };
  }, [profileId]);

  useEffect(() => () => {
    [noticeTimer, copyTimer, storeTimer].forEach((r) => r.current && clearTimeout(r.current));
  }, []);

  const bullets = useMemo(() => normalizeBullets(text), [text]);
  const rawCount = useMemo(
    () => (typeof text === 'string' ? text.split(/\r?\n/).filter((l) => l.trim()).length : 0),
    [text]
  );
  const overCap = rawCount > MAX_BULLETS;
  const dirty = !eqBullets(bullets, savedBullets);
  const strategies = useMemo(() => strategiesFor(dIdx), [dIdx]);
  const canCopy = bullets.length > 0 && (mode === 'direct' || effectiveReady);

  const flash = (msg) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 1800);
  };

  // Cap enforcement: block the Enter that would open an 11th bullet.
  const onTextKeyDown = (e) => {
    if (e.key === 'Enter' && bullets.length >= MAX_BULLETS) {
      e.preventDefault();
      buzz(12);
      flash(`Up to ${MAX_BULLETS} notes per session`);
    }
  };

  // Keep the strategy valid whenever the designation changes (a non-clinical
  // designation must not keep a bedside strategy selected).
  const onDesignationChange = (idx) => {
    setDIdx(idx);
    const stillValid = strategiesFor(idx).some((s) => s.id === strategyId);
    if (!stillValid) setStrategyId(DEFAULT_STRATEGY_ID);
  };

  const enterEffective = () => {
    setMode('effective');
    if (!effectiveReady) setView('picker');   // first time -> configure the prompt
  };

  const confirmPicker = () => {
    setEffectiveReady(true);
    setView('notes');
    buzz(8);
    flash('Options set');
  };

  const buildPayload = () =>
    mode === 'effective'
      ? assembleMasterPrompt({ designationIndex: dIdx, levelId, strategyId, bullets })
      : text.trim();

  const doCopy = async () => {
    if (!canCopy) return;
    const payload = buildPayload();          // assembled synchronously first (iOS)
    const ok = await copyToClipboard(payload);
    if (ok) {
      setManualCopy('');
      setCopyState('done');
      buzz(14);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopyState('idle'), 1500);
    } else {
      setManualCopy(payload);                // reveal a selectable fallback box
      flash('Copy blocked — select the text below');
    }
  };

  const doStore = async () => {
    const clean = await saveNotes(profileId, bullets);
    setSavedBullets(clean);
    setStoreState('done');
    buzz(14);
    if (storeTimer.current) clearTimeout(storeTimer.current);
    storeTimer.current = setTimeout(() => setStoreState('idle'), 1500);
  };

  // First-run naming — persist the chosen name and drop into the notes view.
  const onName = async (chosen) => {
    const saved = await saveCompanionName(profileId, chosen);
    const nm = saved || sanitizeName(chosen);
    if (!nm) return;
    setName(nm);
    setGreeting(greetingFor(nm));
    setEditing(true);           // fresh notebook — ready to type
    setView('notes');
    buzz(10);
  };

  // Rename (title pencil) — opens the shared companion-rename modal (z-115, so
  // it sits above this popup). Password-gated for accounts inside that modal.
  const onRename = () => requestCompanionRename({
    profile,
    currentName: name,
    onRenamed: (nn) => {
      const nm = sanitizeName(nn);
      if (!nm) return;
      setName(nm);
      setGreeting(greetingFor(nm));
    },
  });

  const onToggleAutoSave = () => {
    const next = !autoSave;
    setAutoSave(next);
    buzz(6);
    saveNotesAutoSave(profileId, next);
  };

  const doClear = async () => {
    await clearNotes(profileId);
    setText('');
    setSavedBullets([]);
    setClearing(false);
    setEditing(true);
    buzz(10);
  };

  const castVote = (v) => {
    if (v === vote) return;
    setVote(v);
    buzz(8);
    saveAiInterest(profileId, v);
    // Only emit the shared signal when the vote actually CHANGED from the last
    // value we sent (seeded from the stored vote on open). Keeps re-opens and
    // toggles from appending duplicate rows to the owner's feedback inbox.
    if (v === sentVoteRef.current) return;
    sentVoteRef.current = v;
    // Best-effort shared signal so the owner sees interest — reuses the existing
    // feedback channel (no new backend). Fire-and-forget; never blocks the UI.
    // .catch swallows the async rejection (a sync try/catch would miss it).
    try {
      Promise.resolve(saveFeedback({
        id: newFeedbackId(),
        ts: Date.now(),
        screen: 'AI Learning Notes',
        source: 'notes-ai-interest',
        questionId: null,
        report: `In-app AI chat interest: ${v === 'up' ? 'YES (thumbs up)' : 'NO (thumbs down)'}`,
        fix: null,
        profileId,
        profileName,
      })).catch(() => {});
    } catch (e) {}
  };

  const attemptClose = () => {
    // Naming/guide/loading views have nothing to save — just close.
    if (view === 'naming' || view === 'guide' || view === 'loading') { onClose(); return; }
    if (dirty && bullets.length > 0) {
      if (autoSave) {
        // Silent save on close (fire-and-forget so we don't setState after
        // unmount — the IndexedDB write completes independently of React).
        saveNotes(profileId, bullets);
        onClose();
        return;
      }
      setConfirmingExit(true);
      return;
    }
    onClose();
  };

  const dialogRef = useFocusTrap(attemptClose);
  const pop = (state) => (state === 'done' && !reduced ? ' note-pop' : '');

  // --- shared bits ---------------------------------------------------------
  const enterAnim = reduced ? '' : (wide ? ' anim-scalein' : ' sheet-up');
  const panelRadius = wide ? 'rounded-3xl' : 'rounded-t-3xl';

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4"
         style={{ background: 'rgba(0,0,0,0.55)' }}
         onClick={attemptClose}>
      <div onClick={(e) => e.stopPropagation()}
           ref={dialogRef} role="dialog" aria-modal="true" aria-label={name || 'Study notes'}
           className={`relative w-full sm:max-w-[600px] lg:max-w-[640px] flex flex-col overflow-hidden ${panelRadius}${enterAnim}`}
           style={{
             background: T.surface,
             border: `1px solid ${T.border}`,
             maxHeight: wide ? 'min(88dvh, 720px)' : '92dvh',
             boxShadow: wide
               ? '0 8px 40px rgba(0,0,0,0.24), 0 2px 12px rgba(0,0,0,0.14)'
               : '0 -4px 32px rgba(0,0,0,0.28), 0 -1px 8px rgba(0,0,0,0.12)',
             paddingBottom: 'env(safe-area-inset-bottom, 0px)',
           }}>

        {view === 'loading' && (
          <div className="flex items-center justify-center" style={{ minHeight: 220 }}>
            <div className="w-6 h-6 rounded-full border-2 animate-spin"
                 style={{ borderColor: T.border, borderTopColor: T.primary }} aria-label="Loading" />
          </div>
        )}

        {view === 'naming' && (
          <NamingView T={T} onName={onName} onClose={onClose} />
        )}

        {view === 'guide' && (
          <GuideView T={T} name={name} onBack={() => setView('notes')} />
        )}

        {view === 'picker' && (
          <PickerView
            T={T} dIdx={dIdx} levelId={levelId} strategyId={strategyId}
            strategies={strategies}
            onDesignation={onDesignationChange}
            onLevel={setLevelId} onStrategy={setStrategyId}
            onBack={() => setView('notes')} onConfirm={confirmPicker} />
        )}

        {view === 'notes' && (
          <NotesView
            T={T} name={name} greeting={greeting}
            text={text} setText={setText} onTextKeyDown={onTextKeyDown}
            editing={editing} onEdit={() => setEditing(true)}
            rawCount={rawCount} overCap={overCap}
            mode={mode} setDirect={() => setMode('direct')} enterEffective={enterEffective}
            effectiveReady={effectiveReady}
            designation={DESIGNATIONS[dIdx]} level={LEVELS.find((l) => l.id === levelId)}
            strategy={strategies.find((s) => s.id === strategyId)}
            editOptions={() => setView('picker')}
            canCopy={canCopy} copyState={copyState} storeState={storeState}
            doCopy={doCopy} doStore={doStore} pop={pop}
            manualCopy={manualCopy} dismissManual={() => setManualCopy('')}
            vote={vote} castVote={castVote}
            autoSave={autoSave} onToggleAutoSave={onToggleAutoSave}
            hasStored={savedBullets.length > 0}
            onClearRequest={() => setClearing(true)}
            onRename={onRename} onGuide={() => setView('guide')}
            onClose={attemptClose} />
        )}

        {/* transient in-modal notice (e.g. 10-note cap) */}
        {notice && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 px-3 py-2 rounded-xl text-xs font-medium pointer-events-none"
               style={{ background: T.ink, color: T.surface, boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }}
               role="status">
            {notice}
          </div>
        )}

        {/* unsaved-notes guard — rendered INSIDE the modal so it always sits
            above it (avoids the z-order clash a root ConfirmHost would have). */}
        {confirmingExit && (
          <InModalConfirm
            T={T} reduced={reduced}
            title="Leave without saving?"
            body="Your notes aren't stored yet. Tap Store to keep them on this device."
            cancelLabel="Keep editing" confirmLabel="Discard" tone="danger"
            onCancel={() => setConfirmingExit(false)}
            onConfirm={() => { setConfirmingExit(false); onClose(); }} />
        )}

        {/* clear / start-fresh guard */}
        {clearing && (
          <InModalConfirm
            T={T} reduced={reduced}
            title="Start fresh?"
            body="This clears all notes on this device. Your companion's name stays. This can't be undone."
            cancelLabel="Keep them" confirmLabel="Clear notes" tone="danger"
            onCancel={() => setClearing(false)}
            onConfirm={doClear} />
        )}
      </div>
    </div>
  );
}

// Small inline confirm overlay reused by the exit-guard and clear-guard. Kept
// inside the modal panel so it always sits above it (no z-order clash).
function InModalConfirm({ T, reduced, title, body, cancelLabel, confirmLabel, tone, onCancel, onConfirm }) {
  const confirmBg = tone === 'danger' ? T.error : T.primary;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-5"
         style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
         onClick={onCancel}>
      <div className={"w-full max-w-[320px] rounded-2xl overflow-hidden" + (reduced ? '' : ' note-pop')}
           onClick={(e) => e.stopPropagation()}
           style={{
             background: T.surface,
             border: `1px solid ${T.border}`,
             boxShadow: '0 24px 60px rgba(0,0,0,0.38), 0 4px 18px rgba(0,0,0,0.18)',
           }}>
        {/* top accent stripe for danger tone */}
        {tone === 'danger' && (
          <div style={{ height: 3, background: `linear-gradient(90deg, ${T.error}80, ${T.error}30)` }} aria-hidden="true" />
        )}
        <div className="p-5">
          <div className="font-display text-base font-semibold mb-2" style={{ color: T.ink }}>{title}</div>
          <div className="text-sm leading-relaxed mb-5" style={{ color: T.inkSoft }}>{body}</div>
          <div className="flex gap-2.5">
            <button onClick={onCancel}
                    className="no-tap-highlight flex-1 py-3 rounded-xl text-sm font-medium active:scale-95 transition"
                    style={{ background: T.surfaceWarm, color: T.ink, border: `1px solid ${T.border}` }}>
              {cancelLabel}
            </button>
            <button onClick={onConfirm}
                    className="no-tap-highlight flex-1 py-3 rounded-xl text-sm font-semibold active:scale-95 transition"
                    style={{ background: confirmBg, color: '#FFF', boxShadow: `0 4px 16px ${confirmBg}50` }}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// NAMING VIEW — first-run: give the companion a name (required, <=10 chars).
// =====================================================================
function NamingView({ T, onName, onClose }) {
  const [val, setVal] = useState('');
  const clean = sanitizeName(val);
  const valid = clean.length > 0;
  const reduced = prefersReduced();
  return (
    <>
      {/* top bar — just the close button, right-aligned */}
      <div className="flex items-center justify-end px-4 pt-4 pb-1 flex-shrink-0">
        <button onClick={onClose} aria-label="Close"
                className="no-tap-highlight rounded-xl active:bg-black/8 transition-colors"
                style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} style={{ color: T.muted }} aria-hidden="true" />
        </button>
      </div>

      <div className="px-6 pb-4 overflow-y-auto overscroll-contain flex-1 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* hero icon with a soft layered glow ring */}
        <div className={"w-16 h-16 rounded-2xl flex items-center justify-center mb-5 flex-shrink-0" + (reduced ? '' : ' naming-icon-enter')}
             style={{
               background: `linear-gradient(135deg, ${T.primary}22, ${T.primary}0A)`,
               border: `1.5px solid ${T.primary}28`,
               boxShadow: `0 0 0 6px ${T.primary}0A, 0 4px 18px ${T.primary}18`,
             }}>
          <Sparkles size={28} style={{ color: T.primary }} aria-hidden="true" />
        </div>

        {/* headline */}
        <div className={"font-display text-[1.45rem] font-semibold leading-snug mb-2" + (reduced ? '' : ' naming-headline-enter')}
             style={{ color: T.ink }}>
          First things first — name your study buddy.
        </div>
        <div className={"text-sm leading-relaxed mb-6" + (reduced ? '' : ' naming-body-enter')}
             style={{ color: T.muted }}>
          This little notebook is yours. Give it a name and it&apos;s your partner in crime for the grind.
          Just between us — you can change it anytime.
        </div>

        {/* name field */}
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="companion-name-input"
                 className="text-xs uppercase tracking-wider font-semibold"
                 style={{ color: T.muted }}>Its name</label>
          <span className="text-[10px] tabular-nums"
                style={{ color: Array.from(val).length >= NAME_MAX ? T.primary : T.muted }}>
            {Array.from(val).length}/{NAME_MAX}
          </span>
        </div>
        <input id="companion-name-input"
               value={val}
               onChange={(e) => setVal(e.target.value)}
               data-autofocus
               autoCapitalize="words" autoComplete="off"
               maxLength={NAME_MAX}
               placeholder="e.g. Nova"
               className="w-full rounded-xl px-3.5 py-3 mb-4 text-base font-medium"
               style={{
                 background: T.bg,
                 border: `1.5px solid ${T.border}`,
                 color: T.ink,
                 outline: 'none',
                 transition: 'border-color 160ms, box-shadow 160ms',
               }}
               onFocus={(e) => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.primary}20`; }}
               onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }} />

        {/* suggestion chips */}
        <div className="text-[10px] uppercase tracking-wider font-semibold mb-2.5" style={{ color: T.muted }}>
          Suggestions
        </div>
        <div className="flex flex-wrap gap-2 mb-1.5">
          {SUGGESTIONS.map((s) => {
            const sel = clean === s;
            return (
              <button key={s} onClick={() => setVal(s)}
                      className="no-tap-highlight px-3.5 py-2 rounded-full text-xs font-semibold active:scale-95 transition"
                      style={{
                        background: sel ? T.primary + '1A' : T.surfaceWarm,
                        border: `1.5px solid ${sel ? T.primary : T.border}`,
                        color: sel ? T.primary : T.inkSoft,
                        boxShadow: sel ? `0 2px 8px ${T.primary}25` : 'none',
                      }}
                      aria-pressed={sel}>
                {s}
              </button>
            );
          })}
          <button onClick={() => setVal(pickSuggestion())}
                  className="no-tap-highlight inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold active:scale-95 transition"
                  style={{
                    background: T.accent + '16',
                    border: `1.5px solid ${T.accent}45`,
                    color: T.accent,
                  }}
                  aria-label="Pick a random name suggestion">
            <Wand2 size={12} aria-hidden="true" /> Surprise me
          </button>
        </div>
      </div>

      <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
        <button onClick={() => valid && onName(clean)} disabled={!valid}
                className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: T.primary,
                  color: '#FFF',
                  boxShadow: valid ? `0 4px 20px ${T.primary}50` : 'none',
                  minHeight: 50,
                }}>
          {valid ? `Let's go, ${clean}` : "Let's go"}
        </button>
      </div>
    </>
  );
}

// =====================================================================
// GUIDE VIEW — how it helps, techniques, limitations (note-companion.GUIDE).
// =====================================================================
function GuideView({ T, name, onBack }) {
  return (
    <>
      {/* header: back button + title */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 flex-shrink-0"
           style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
        <button onClick={onBack}
                className="no-tap-highlight flex items-center justify-center rounded-xl active:scale-90 transition flex-shrink-0"
                style={{ width: 44, height: 44, background: T.surfaceWarm, border: `1px solid ${T.border}` }}
                aria-label="Back to notes">
          <ChevronLeft size={18} style={{ color: T.ink }} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[1.05rem] font-semibold leading-tight truncate" style={{ color: T.ink }}>
            Meet {name || 'your companion'}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>How it works &amp; what to know</div>
        </div>
        {/* BookOpen accent — visible reminder this is the guide */}
        <BookOpen size={17} style={{ color: T.primary, opacity: 0.7, flexShrink: 0 }} aria-hidden="true" />
      </div>

      <div className="px-5 pt-4 pb-5 overflow-y-auto overscroll-contain flex-1 min-h-0"
           style={{ WebkitOverflowScrolling: 'touch' }}>
        {GUIDE.map((sec, i) => (
          <div key={i}
               className="mb-4 rounded-xl px-4 py-3.5"
               style={{
                 background: T.surfaceWarm,
                 border: `1px solid ${T.borderSoft}`,
                 borderLeft: `3px solid ${T.primary}60`,
               }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: T.primary }}>
              {personalize(sec.heading, name)}
            </div>
            <div className="text-sm leading-relaxed" style={{ color: T.inkSoft, whiteSpace: 'pre-wrap' }}>
              {personalize(sec.body, name)}
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
        <button onClick={onBack}
                className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                style={{ background: T.primary, color: '#FFF', boxShadow: `0 4px 16px ${T.primary}50`, minHeight: 48 }}>
          <Check size={16} aria-hidden="true" /> Got it
        </button>
      </div>
    </>
  );
}

// =====================================================================
// NOTES VIEW — title(name)+greeting, edit-gated textarea, mode toggle,
// auto-save toggle, feedback row, Edit/Store + Copy footer.
// =====================================================================
function NotesView({
  T, name, greeting, text, setText, onTextKeyDown,
  editing, onEdit, rawCount, overCap,
  mode, setDirect, enterEffective, effectiveReady,
  designation, level, strategy, editOptions,
  canCopy, copyState, storeState, doCopy, doStore, pop,
  manualCopy, dismissManual, vote, castVote,
  autoSave, onToggleAutoSave, hasStored, onClearRequest,
  onRename, onGuide, onClose,
}) {
  const shownCount = Math.min(rawCount, MAX_BULLETS);
  return (
    <>
      {/* header — companion name (title) + greeting; pencil rename, guide, close */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0"
           style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
        {/* left: icon + name + greeting */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${T.primary}22, ${T.primary}0C)`,
                  border: `1px solid ${T.primary}28`,
                }}>
            <Sparkles size={17} style={{ color: T.primary }} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <div className="font-display text-[1.05rem] font-semibold leading-tight truncate"
                   style={{ color: T.ink }} title={name}>
                {name || 'Study Notes'}
              </div>
              {/* pencil: 44×44 effective target via negative margin */}
              <button onClick={onRename} aria-label="Rename your study companion"
                      className="no-tap-highlight flex-shrink-0 flex items-center justify-center rounded-lg active:bg-black/8 transition-colors"
                      style={{ width: 32, height: 32, marginLeft: 1 }}>
                <Pencil size={13} style={{ color: T.muted }} aria-hidden="true" />
              </button>
            </div>
            {greeting && (
              <div className="text-xs leading-tight truncate mt-0.5" style={{ color: T.muted }}>
                {greeting}
              </div>
            )}
          </div>
        </div>
        {/* right: guide + close — each 44×44 */}
        <div className="flex items-center gap-0 flex-shrink-0 ml-1">
          <button onClick={onGuide} aria-label="Open the guide"
                  className="no-tap-highlight flex items-center justify-center rounded-xl active:bg-black/8 transition-colors"
                  style={{ width: 44, height: 44 }}>
            <BookOpen size={17} style={{ color: T.muted }} aria-hidden="true" />
          </button>
          <button onClick={onClose} aria-label="Close notes"
                  className="no-tap-highlight flex items-center justify-center rounded-xl active:bg-black/8 transition-colors"
                  style={{ width: 44, height: 44 }}>
            <X size={18} style={{ color: T.muted }} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* scrollable body */}
      <div className="px-5 overflow-y-auto overscroll-contain flex-1 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* local-only caution (spec Section 5) — left-border accent style */}
        <div className="mb-4 flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs leading-relaxed"
             style={{ background: T.surfaceWarm, color: T.muted, borderLeft: `3px solid ${T.border}` }}
             role="note" aria-label="Storage notice">
          <Info size={13} className="flex-shrink-0 mt-0.5" style={{ color: T.muted }} aria-hidden="true" />
          <span>Saved on <strong style={{ color: T.inkSoft }}>this device only</strong> — never synced. Tap <strong style={{ color: T.inkSoft }}>Store</strong> to keep them; clearing browser storage or long inactivity can remove them.</span>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>
            Your notes &middot; one per line
          </div>
          <div className="text-xs font-semibold px-1.5 py-0.5 rounded-md tabular-nums"
               style={{
                 color: overCap ? T.accent : (shownCount >= MAX_BULLETS - 1 ? T.inkSoft : T.muted),
                 background: overCap ? T.accent + '15' : 'transparent',
               }}
               aria-live="polite" aria-atomic="true"
               aria-label={`${shownCount} of ${MAX_BULLETS} notes`}>
            {shownCount}/{MAX_BULLETS}
          </div>
        </div>

        {/* edit-gated textarea: read-only until the user taps Edit.
            VIEW mode:  muted surface, dashed border, lock-cursor — clearly "not interactive".
            EDIT mode:  white/bg surface, solid border, highlights on focus — clearly active. */}
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onTextKeyDown}
            readOnly={!editing}
            data-autofocus={editing ? true : undefined}
            aria-label="Your study notes, one per line, up to 10"
            aria-readonly={!editing}
            aria-describedby={overCap ? 'notes-overcap-msg' : undefined}
            placeholder={editing
              ? "• Type or paste a topic, word, or question\n• One note per line\n• Up to 10 notes"
              : (text ? '' : 'No notes yet — tap Edit to start.')}
            rows={7}
            className="w-full rounded-xl px-3.5 py-3 text-sm resize-none leading-relaxed"
            style={{
              background: editing ? T.bg : T.surfaceWarm,
              border: editing
                ? `1.5px solid ${overCap ? T.accent : T.border}`
                : `1.5px dashed ${T.border}`,
              color: editing ? T.ink : T.inkSoft,
              whiteSpace: 'pre-wrap',
              outline: 'none',
              cursor: editing ? 'text' : 'default',
              transition: 'background 180ms, border-color 180ms, color 180ms',
            }}
            onFocus={(e) => {
              if (!editing) return;
              e.currentTarget.style.borderColor = overCap ? T.accent : T.primary;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${T.primary}1A`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = overCap ? T.accent : (editing ? T.border : T.border);
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {/* view-mode lock badge — small "tap Edit" nudge bottom-right */}
          {!editing && (
            <div className="absolute bottom-2.5 right-3 flex items-center gap-1 pointer-events-none select-none"
                 aria-hidden="true">
              <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                <rect x="1" y="5" width="8" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M3 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span className="text-[10px] font-medium" style={{ color: T.muted }}>
                {text ? 'read-only' : 'empty'}
              </span>
            </div>
          )}
        </div>
        {overCap && (
          <div id="notes-overcap-msg" className="text-xs mt-1.5 px-1 flex items-center gap-1" style={{ color: T.accent }}>
            <span aria-hidden="true">&#x26A0;</span>
            Only the first {MAX_BULLETS} notes will be used.
          </div>
        )}

        {/* clear / start-fresh — only when editing and there is something stored */}
        {editing && hasStored && (
          <div className="flex justify-end mt-1.5">
            <button onClick={onClearRequest}
                    className="no-tap-highlight inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg active:scale-95 transition"
                    style={{ color: T.error }}
                    aria-label="Clear all notes and start fresh">
              <Trash2 size={12} aria-hidden="true" /> Start fresh
            </button>
          </div>
        )}

        {/* mode toggle (Structure A — Direct/Effective are a mode switch) */}
        <div className="mt-5 flex items-center gap-2 mb-2.5">
          <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Copy as</div>
          <div className="flex-1 h-px" style={{ background: T.borderSoft }} aria-hidden="true" />
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Copy mode">
          <ModeChip T={T} active={mode === 'direct'} onClick={setDirect}
                    title="Direct" subtitle="Notes exactly as written" icon={<Copy size={15} />} />
          <ModeChip T={T} active={mode === 'effective'} onClick={enterEffective}
                    title="Effective" subtitle="Wrapped in an AI study prompt" icon={<Sparkles size={15} />} />
        </div>

        {mode === 'effective' && (
          <button onClick={editOptions}
                  className="no-tap-highlight w-full mt-2.5 flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl active:scale-[0.99] transition"
                  style={{
                    background: effectiveReady ? T.primary + '0E' : T.primary + '09',
                    border: `1.5px solid ${effectiveReady ? T.primary + '50' : T.primary + '28'}`,
                  }}
                  aria-label={effectiveReady ? 'Edit prompt options' : 'Set up prompt options'}>
            <div className="min-w-0 text-left flex-1">
              {effectiveReady && strategy ? (
                <>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: T.success }} aria-hidden="true" />
                    <div className="text-xs font-semibold" style={{ color: T.primary }}>AI study prompt ready</div>
                  </div>
                  <div className="text-xs truncate pl-3" style={{ color: T.inkSoft }}>
                    {designation.title.split('&')[0].trim()} &middot; {level.label} &middot; {strategy.name.replace(/"/g, '')}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs font-semibold mb-0.5" style={{ color: T.primary }}>Set up your AI study prompt</div>
                  <div className="text-xs truncate" style={{ color: T.muted }}>Choose designation, level &amp; strategy</div>
                </>
              )}
            </div>
            <ChevronRight size={16} style={{ color: T.primary, flexShrink: 0 }} aria-hidden="true" />
          </button>
        )}

        {manualCopy && (
          <div className="mt-3 p-3 rounded-xl" style={{ background: T.surfaceWarm, border: `1px dashed ${T.border}` }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-semibold" style={{ color: T.inkSoft }}>Select all, then copy</div>
              <button onClick={dismissManual} className="no-tap-highlight p-1 -m-1 rounded" aria-label="Dismiss">
                <X size={14} style={{ color: T.muted }} />
              </button>
            </div>
            <textarea readOnly value={manualCopy} rows={4}
                      onFocus={(e) => e.target.select()}
                      className="w-full rounded-lg px-2 py-2 text-xs resize-none"
                      style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.ink }} />
          </div>
        )}

        {/* auto-save toggle */}
        <button onClick={onToggleAutoSave} role="switch" aria-checked={autoSave}
                className="no-tap-highlight w-full mt-4 flex items-center justify-between gap-3 px-3.5 py-3.5 rounded-xl active:scale-[0.99] transition"
                style={{
                  background: autoSave ? T.success + '0C' : T.surfaceWarm,
                  border: `1px solid ${autoSave ? T.success + '40' : T.borderSoft}`,
                  transition: 'background 220ms, border-color 220ms',
                }}
                aria-label="Auto-save on close">
          <div className="min-w-0 text-left">
            <div className="text-sm font-medium" style={{ color: T.ink }}>Auto-save on close</div>
            <div className="text-xs mt-0.5 leading-snug" style={{ color: T.muted }}>
              {autoSave ? 'On — notes save automatically when you close' : 'Off — use the Store button to save'}
            </div>
          </div>
          {/* pill track */}
          <div className="w-11 h-6 rounded-full p-0.5 flex-shrink-0 no-transition"
               style={{ background: autoSave ? T.success : T.border, transition: 'background 220ms' }}>
            <div className="w-5 h-5 rounded-full bg-white no-transition"
                 style={{
                   transform: autoSave ? 'translateX(20px)' : 'translateX(0)',
                   transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
                   boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
                 }} />
          </div>
        </button>

        {/* feedback row (spec Section 12) */}
        <div className="mt-4 mb-2 flex items-center justify-between gap-3 px-3.5 py-3.5 rounded-xl"
             style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}
             role="group" aria-label="AI interest survey">
          <div className="text-xs leading-snug flex-1" style={{ color: T.inkSoft }}>
            Would you like to <strong style={{ color: T.ink }}>chat with an AI inside this app</strong> in the future?
          </div>
          <div className="flex items-center gap-2 flex-shrink-0" role="group" aria-label="Vote">
            <VoteButton T={T} active={vote === 'up'} onClick={() => castVote('up')}
                        icon={<ThumbsUp size={16} aria-hidden="true" />} label="Yes, I'd like in-app AI chat" tone="up" />
            <VoteButton T={T} active={vote === 'down'} onClick={() => castVote('down')}
                        icon={<ThumbsDown size={16} aria-hidden="true" />} label="Not interested in in-app AI chat" tone="down" />
          </div>
        </div>
      </div>

      {/* pinned footer — Edit (view mode) or Store (edit mode) + Copy */}
      <div className="flex gap-2.5 px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
        {editing ? (
          <button onClick={doStore}
                  className={"no-tap-highlight flex-[1.35] inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold active:scale-95 transition-transform" + pop(storeState)}
                  style={{
                    background: storeState === 'done' ? T.success : T.primary,
                    color: '#FFF',
                    boxShadow: `0 4px 16px ${(storeState === 'done' ? T.success : T.primary)}55`,
                    minHeight: 48,
                  }}
                  aria-label="Store notes on this device">
            {storeState === 'done' ? <Check size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            {storeState === 'done' ? 'Stored' : 'Store'}
          </button>
        ) : (
          <button onClick={onEdit}
                  className="no-tap-highlight flex-[1.35] inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                  style={{ background: T.primary, color: '#FFF', boxShadow: `0 4px 16px ${T.primary}55`, minHeight: 48 }}
                  aria-label="Edit your notes">
            <Pencil size={16} aria-hidden="true" /> Edit
          </button>
        )}
        <button onClick={doCopy} disabled={!canCopy}
                className={"no-tap-highlight flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold active:scale-95 transition-transform disabled:opacity-35 disabled:cursor-not-allowed" + pop(copyState)}
                style={{
                  background: copyState === 'done' ? T.success : 'transparent',
                  color: copyState === 'done' ? '#FFF' : T.ink,
                  border: `1.5px solid ${copyState === 'done' ? T.success : T.border}`,
                  minHeight: 48,
                }}
                aria-label={mode === 'effective' ? 'Copy the AI study prompt to clipboard' : 'Copy your notes to clipboard'}>
          {copyState === 'done' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copyState === 'done' ? 'Copied' : 'Copy'}
        </button>
      </div>
    </>
  );
}

function ModeChip({ T, active, onClick, title, subtitle, icon }) {
  return (
    <button onClick={onClick} role="radio" aria-checked={active}
            className="no-tap-highlight text-left px-3.5 py-3 rounded-xl active:scale-[0.98] transition"
            style={{
              background: active ? T.primary + '14' : T.bg,
              border: `1.5px solid ${active ? T.primary : T.border}`,
              boxShadow: active ? `inset 0 1px 0 ${T.primary}20` : 'none',
              minHeight: 62,
            }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: active ? T.primary : T.inkSoft }}>
        <span aria-hidden="true">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
        {active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: T.primary }} aria-hidden="true" />
        )}
      </div>
      <div className="text-xs leading-snug" style={{ color: active ? T.inkSoft : T.muted }}>{subtitle}</div>
    </button>
  );
}

function VoteButton({ T, active, onClick, icon, label, tone }) {
  const on = tone === 'up' ? T.success : T.accent;
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={active}
            className="no-tap-highlight flex items-center justify-center rounded-full active:scale-90 transition"
            style={{
              width: 44, height: 44,
              background: active ? on + '22' : T.surface,
              border: `1.5px solid ${active ? on : T.border}`,
              color: active ? on : T.muted,
              boxShadow: active ? `0 2px 8px ${on}30` : 'none',
            }}>
      {icon}
    </button>
  );
}

// =====================================================================
// PICKER VIEW — Designation / My Level / Strategy (spec Sections 8–10).
// =====================================================================
function PickerView({ T, dIdx, levelId, strategyId, strategies, onDesignation, onLevel, onStrategy, onBack, onConfirm }) {
  return (
    <>
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 flex-shrink-0">
        <button onClick={onBack}
                className="no-tap-highlight flex items-center justify-center rounded-xl active:scale-90 transition flex-shrink-0"
                style={{ width: 44, height: 44, background: T.surfaceWarm, border: `1px solid ${T.border}` }}
                aria-label="Back to notes">
          <ChevronLeft size={18} style={{ color: T.ink }} aria-hidden="true" />
        </button>
        <div>
          <div className="font-display text-lg font-semibold leading-tight" style={{ color: T.ink }}>Tune your AI prompt</div>
          <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>Personalise how your notes get framed</div>
        </div>
      </div>

      <div className="px-5 overflow-y-auto overscroll-contain flex-1 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex items-start gap-2 px-3 py-2.5 mb-5 rounded-xl text-xs leading-relaxed"
             style={{ background: T.surfaceWarm, borderLeft: `3px solid ${T.border}` }}
             role="note">
          <Info size={13} className="flex-shrink-0 mt-0.5" style={{ color: T.muted }} aria-hidden="true" />
          <span style={{ color: T.muted }}>
            Not sure? The <strong style={{ color: T.inkSoft }}>Recommended</strong> picks work for almost any topic.
          </span>
        </div>

        <FieldLabel T={T}>Designation</FieldLabel>
        <div className="relative mb-5">
          <select value={dIdx} onChange={(e) => onDesignation(Number(e.target.value))}
                  aria-label="Your designation or role"
                  className="w-full appearance-none rounded-xl px-3.5 py-3 pr-9 text-sm"
                  style={{ background: T.bg, border: `1.5px solid ${T.border}`, color: T.ink, outline: 'none' }}>
            {DESIGNATIONS.map((d, i) => (
              <option key={d.id} value={i}>
                {d.title}{d.recommended ? '  ★ Recommended' : ''}
              </option>
            ))}
          </select>
          <ChevronRight size={16} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none"
                        style={{ color: T.muted }} aria-hidden="true" />
        </div>

        <FieldLabel T={T}>My Level</FieldLabel>
        <div className="grid grid-cols-3 gap-2 mb-5" role="radiogroup" aria-label="Your current level">
          {LEVELS.map((l) => {
            const active = l.id === levelId;
            return (
              <button key={l.id} onClick={() => onLevel(l.id)} role="radio" aria-checked={active}
                      className="no-tap-highlight py-3 rounded-xl text-sm font-medium active:scale-95 transition"
                      style={{
                        background: active ? T.primary + '14' : T.bg,
                        border: `1.5px solid ${active ? T.primary : T.border}`,
                        color: active ? T.primary : T.inkSoft,
                        boxShadow: active ? `inset 0 1px 0 ${T.primary}20` : 'none',
                        minHeight: 44,
                      }}>
                {l.label}{l.recommended ? ' ★' : ''}
              </button>
            );
          })}
        </div>

        <FieldLabel T={T}>Strategy</FieldLabel>
        <div className="flex flex-col gap-2.5 mb-3" role="radiogroup" aria-label="Learning strategy">
          {strategies.map((s) => {
            const active = s.id === strategyId;
            return (
              <button key={s.id} onClick={() => onStrategy(s.id)} role="radio" aria-checked={active}
                      className="no-tap-highlight text-left px-3.5 py-3.5 rounded-xl active:scale-[0.99] transition"
                      style={{
                        background: active ? T.primary + '0E' : T.bg,
                        border: `1.5px solid ${active ? T.primary + '55' : T.border}`,
                        boxShadow: active ? `inset 3px 0 0 ${T.primary}` : 'none',
                      }}>
                <div className="flex items-start gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold" style={{ color: active ? T.primary : T.ink }}>
                      {s.name.replace(/"/g, '')}
                    </span>
                    <span className="text-xs ml-1.5" style={{ color: T.muted }}>&middot; {s.subtitle}</span>
                  </div>
                  {s.recommended && (
                    <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: T.success + '1F', color: T.success }}>
                      Recommended
                    </span>
                  )}
                </div>
                <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>{s.howItWorks}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
        <button onClick={onConfirm}
                className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
                style={{ background: T.primary, color: '#FFF', boxShadow: `0 4px 16px ${T.primary}55`, minHeight: 48 }}
                aria-label="Confirm and use these prompt options">
          <Check size={16} aria-hidden="true" /> Use these options
        </button>
      </div>
    </>
  );
}

function FieldLabel({ T, children }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>
        {children}
      </div>
      <div className="flex-1 h-px" style={{ background: T.borderSoft }} aria-hidden="true" />
    </div>
  );
}

export { NoteHost, NoteModal };
export default NoteHost;
