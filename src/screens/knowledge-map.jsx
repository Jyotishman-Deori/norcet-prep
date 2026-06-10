// =====================================================================
// src/screens/knowledge-map.jsx — interactive "knowledge map" / mindmap screen
// (A1 slice 34). The heavy one: model build, ring layout (via lib/kmap), pan/
// zoom SVG, state-upgrade celebrations (haptics + WebAudio chime), "study next"
// suggestions, explorer badges, and the node-detail popup (slice 33) + note
// editor (slice 23) as children.
// Extracted from App.jsx VERBATIM except: KnowledgeMap signature
//   ({ data, allQuestions, profileId, ... }) -> ({ onPracticeTopic, onPracticeSub, onBack })
//   with data/allQuestions<-useData, profileId<-useProfile, +useTheme/useFgOnDark;
// and a local `lastSeenTs` (pure attemptStats wrapper) so the module is self-
// contained. All KnowledgeMap-private helpers (suggestions/persistence/
// celebration/_kmapNodeStyle) moved with it; shared model imported from lib/kmap.
// =====================================================================
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Search, Sparkles, X, Plus, LayoutGrid, Maximize2, Minimize2 } from 'lucide-react';
import { useTheme, useData, useProfile } from '../lib/app-context.jsx';
import { useFgOnDark } from '../lib/theme-helpers.js';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { safeStorage } from '../lib/safe-storage.js';
import { attemptStats } from '../lib/compact.js';
import { clampNum, todayStr } from '../lib/utils.js';
import { topicIcon } from '../lib/topics.js';
import { loadMindmapNotes, saveMindmapNotes, mindmapNoteMatch, sanitizeNoteText } from '../lib/notes.js';
import { TOPICS, countsInNursingStats } from '../data/seed.js';
import {
  KMAP_STATES, KMAP_VIEW, KMAP_STATE_LABEL, KMAP_BONUS_COLOR,
  mindmapState, mindmapStateRank, mindmapLayout, _kmapHexPath, DEPENDENCIES,
} from '../lib/kmap.js';
import { TopBar } from '../ui/primitives.jsx';
import MindmapNodePopup from './mindmap-node-popup.jsx';
import MindmapNoteEditor from './mindmap-note-editor.jsx';

// Local pure wrapper (kept here so the module is self-contained; mirrors App's).
function lastSeenTs(h) { return attemptStats(h).lastTs; }

// Build the mindmap data model from the SAME inputs the Coverage map uses.
// Pure + side-effect free so it can be unit-tested and memoised.
//   allQuestions : active pool (SEED + enabled imported banks) — the prop
//                  already passed to Stats / Coverage.
//   history      : data.history  (qId -> attempt record)
//   includeGk    : preferences.includeGkInStats
// Returns { subjects:[{ id,name,color,total,attempted,correct,uniqueAnswered,
//   accuracy,state, subs:[{ sub,total,attempted,correct,uniqueAnswered,
//   accuracy,state }] }], totalAttempted }
function computeMindmapModel(allQuestions, history, includeGk) {
  const qs = Array.isArray(allQuestions) ? allQuestions : [];
  const hist = history || {};

  // Per-topic + per-(topic,sub) aggregation — identical shape to CoverageMap.
  const byTopic = {};            // topicId -> { attempted, correct, uniqueAnswered:Set }
  const bySub = {};              // topicId -> subName -> { attempted, correct, uniqueAnswered:Set }
  const totalPerTopic = {};      // topicId -> question count in pool
  const subsPerTopic = {};       // topicId -> Map(subName -> total count)

  qs.forEach(q => {
    if (!q || !q.topic) return;
    totalPerTopic[q.topic] = (totalPerTopic[q.topic] || 0) + 1;
    const subName = (q.sub && String(q.sub).trim()) || 'General';
    if (!subsPerTopic[q.topic]) subsPerTopic[q.topic] = new Map();
    subsPerTopic[q.topic].set(subName, (subsPerTopic[q.topic].get(subName) || 0) + 1);
  });

  Object.entries(hist).forEach(([qId, h]) => {
    const q = qs.find(x => x.id === qId);
    if (!q || !h || !q.topic) return;
    // P15 — attemptStats normalises Tier 2 / Tier 3 (compacted) records.
    const s = attemptStats(h);
    if (!s || s.total === 0) return;
    if (!byTopic[q.topic]) byTopic[q.topic] = { attempted: 0, correct: 0, uniqueAnswered: new Set() };
    byTopic[q.topic].attempted += s.total;
    byTopic[q.topic].correct += s.correct;
    byTopic[q.topic].uniqueAnswered.add(qId);
    const subName = (q.sub && String(q.sub).trim()) || 'General';
    if (!bySub[q.topic]) bySub[q.topic] = {};
    if (!bySub[q.topic][subName]) bySub[q.topic][subName] = { attempted: 0, correct: 0, uniqueAnswered: new Set() };
    bySub[q.topic][subName].attempted += s.total;
    bySub[q.topic][subName].correct += s.correct;
    bySub[q.topic][subName].uniqueAnswered.add(qId);
  });

  let totalAttempted = 0;
  const subjects = TOPICS
    // Hide empty subjects + keep gk/apt out unless opted in (edge case 10 + P18).
    .filter(t => (totalPerTopic[t.id] || 0) > 0 && countsInNursingStats(t.id, includeGk))
    .map(t => {
      const agg = byTopic[t.id] || { attempted: 0, correct: 0, uniqueAnswered: new Set() };
      const accuracy = agg.attempted > 0 ? agg.correct / agg.attempted : 0;
      totalAttempted += agg.attempted;

      // Subtopics that actually have questions (edge case 10 hides ghosts).
      const subMap = subsPerTopic[t.id] || new Map();
      const subs = Array.from(subMap.entries())
        .map(([subName, total]) => {
          const sAgg = (bySub[t.id] && bySub[t.id][subName]) || { attempted: 0, correct: 0, uniqueAnswered: new Set() };
          const sAcc = sAgg.attempted > 0 ? sAgg.correct / sAgg.attempted : 0;
          return {
            sub: subName,
            total,
            attempted: sAgg.attempted,
            correct: sAgg.correct,
            uniqueAnswered: sAgg.uniqueAnswered.size,
            accuracy: sAcc,
            state: mindmapState(sAgg.attempted, sAcc)
          };
        })
        // Stable, readable order: most-practised first, then alphabetical.
        .sort((a, b) => (b.attempted - a.attempted) || a.sub.localeCompare(b.sub));

      return {
        id: t.id,
        name: t.name,
        color: t.color || '#94a3b8', // [FIX] was T.muted, but computeMindmapModel is module-scope (no theme in scope) — neutral gray fallback (matches topics.js)
        total: totalPerTopic[t.id] || 0,
        attempted: agg.attempted,
        correct: agg.correct,
        uniqueAnswered: agg.uniqueAnswered.size,
        accuracy,
        state: mindmapState(agg.attempted, accuracy),
        subs
      };
    });

  return { subjects, totalAttempted };
}

// =====================================================================
// MINDMAP PHASE B (Pipeline step 29 / P10 Phase B)  [ARTIFACT]
// ---------------------------------------------------------------------
// Additive layer over the Phase A seams: dependency edges between subjects,
// bonus "beyond syllabus" nodes, and the small bit of local-only persistence
// the Explorer badge needs. All data-driven and editable here without code
// changes elsewhere. Reads progress; the ONLY storage write is a NEW local kv
// key (shared:false) for earned Explorer badges — schema stays v9, storage.js
// untouched.
// =====================================================================

// SOLID = prerequisite (master `from` before `to` makes sense);
// DOTTED = related (lateral link). `from`/`to` are real TOPICS ids. Edit
// freely — purely data. Kept conservative (subject-level) since the bank's
// hierarchy is 2-level (subject -> sub), matching the Phase A reconciliation.


// ---- Explorer badges: local-only persistence (shared:false). No schema bump.
const EXPLORER_BADGES_KEY = 'explorerbadges:v1';
async function loadExplorerBadges() {
  try {
    const r = await safeStorage.get(EXPLORER_BADGES_KEY, false);
    if (r && r.value) { const a = JSON.parse(r.value); if (Array.isArray(a)) return a; }
  } catch (e) {}
  return [];
}
async function saveExplorerBadges(ids) {
  try { await safeStorage.set(EXPLORER_BADGES_KEY, JSON.stringify(ids || []), false); } catch (e) {}
}

// =====================================================================
// MINDMAP V2 — FEATURE A: "What to study next" suggestions
//   (Pipeline step 30 / P11 Feature A)  [ARTIFACT]
// ---------------------------------------------------------------------
// Pure ranking over the SUBJECT model (same granularity as the rest of the
// mindmap — reconciled from the prompt's "topics", which don't exist as a
// separate level in this bank). Picks up to 2 subjects by a prioritised,
// CYCLED set of reasons so daily suggestions feel varied. Persisted 24h in a
// LOCAL kv key (shared:false) keyed by profileId + date; regenerates at local
// midnight. No schema change, no Supabase write, guests included.
// ---------------------------------------------------------------------

// Reason codes (also drive the "Why this?" copy).
//   struggling   (a) accuracy <50% on >=5 attempts — needs attention now
//   foundation   (b) a LOCKED/DISCOVERED prerequisite OF a struggling subject
//   fading       (c) FAMILIAR/MASTERED but untouched 14+ days — fading retention
//   almost       (d) close to mastering one more sub — nudge to completion
const SUGGEST_REASON = {
  struggling: 'struggling',
  foundation: 'foundation',
  fading: 'fading',
  almost: 'almost'
};
const SUGGEST_STALE_DAYS = 14;

// Per-subject "last touched" = newest attempt across that subject's answered
// questions. Returns 0 (epoch) if never answered. `lastSeenTsFn` is injected
// so this stays pure + unit-testable (defaults to the real lastSeenTs).
function subjectLastTouchedTs(subjectId, allQuestions, history, lastSeenTsFn) {
  const fn = lastSeenTsFn || lastSeenTs;
  const hist = history || {};
  let max = 0;
  (allQuestions || []).forEach(q => {
    if (!q || q.topic !== subjectId) return;
    const h = hist[q.id];
    if (!h) return;
    const ts = fn(h) || 0;
    if (ts > max) max = ts;
  });
  return max;
}

// Build the candidate list with reasons, in priority order, then CYCLE the
// reason types so the final 1-2 aren't all the same flavour. Pure: takes the
// computed model + a per-subject lastTouched map + now(ms). Returns an array of
// { id, name, reason, detail } (detail = human "why this").
function rankStudySuggestions(model, lastTouchedById, nowMs, deps) {
  const subjects = (model && model.subjects) || [];
  const byId = {};
  subjects.forEach(s => { byId[s.id] = s; });
  const DEPS = deps || DEPENDENCIES;
  const now = nowMs || Date.now();
  const seen = new Set();
  const buckets = { struggling: [], foundation: [], fading: [], almost: [] };

  // (a) struggling
  subjects.forEach(s => {
    if (s.attempted >= 5 && s.accuracy < 0.5) {
      buckets.struggling.push({
        id: s.id, name: s.name, reason: SUGGEST_REASON.struggling,
        detail: `You scored ${Math.round(s.accuracy * 100)}% here — worth another pass`
      });
    }
  });

  // (b) foundation: prerequisites OF struggling subjects that are themselves
  //     LOCKED or DISCOVERED (build the base first).
  const strugglingIds = new Set(buckets.struggling.map(x => x.id));
  DEPS.forEach(d => {
    if (d.type !== 'prerequisite') return;
    if (!strugglingIds.has(d.to)) return;          // only prereqs of a struggling subject
    const pre = byId[d.from];
    if (!pre) return;
    if (pre.state === 'locked' || pre.state === 'discovered') {
      const target = byId[d.to];
      buckets.foundation.push({
        id: pre.id, name: pre.name, reason: SUGGEST_REASON.foundation,
        detail: `Strengthens a weak spot in ${target ? target.name : 'a dependent topic'}`
      });
    }
  });

  // (c) fading: FAMILIAR/MASTERED untouched 14+ days.
  subjects.forEach(s => {
    if (s.state !== 'familiar' && s.state !== 'mastered') return;
    const last = (lastTouchedById && lastTouchedById[s.id]) || 0;
    if (!last) return;
    const days = (now - last) / 86400000;
    if (days >= SUGGEST_STALE_DAYS) {
      buckets.fading.push({
        id: s.id, name: s.name, reason: SUGGEST_REASON.fading,
        detail: `Not practised in ${Math.floor(days)} days — keep it fresh`
      });
    }
  });

  // (d) almost: a subject with >=1 mastered sub and exactly one sub one step
  //     from mastered (familiar) — nudge to finish.
  subjects.forEach(s => {
    const subs = s.subs || [];
    const familiar = subs.filter(x => x.state === 'familiar').length;
    const mastered = subs.filter(x => x.state === 'mastered').length;
    if (mastered >= 1 && familiar >= 1) {
      buckets.almost.push({
        id: s.id, name: s.name, reason: SUGGEST_REASON.almost,
        detail: `One more strong session could master another ${s.name} area`
      });
    }
  });

  // CYCLE the reason types (a,b,c,d,a,b,...) so suggestions vary, de-duping by
  // subject id (first reason wins).
  const order = ['struggling', 'foundation', 'fading', 'almost'];
  const out = [];
  let added = true;
  while (added && out.length < 2) {
    added = false;
    for (const k of order) {
      const item = buckets[k].shift();
      if (!item) continue;
      added = true;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
      if (out.length >= 2) break;
    }
  }
  return out;
}

// ---- 24h local persistence (shared:false). Regenerates at local midnight.
function suggestionsKey(profileId, dateStr) {
  return `suggestions:${profileId || 'guest'}:${dateStr}`;
}
async function loadSuggestions(profileId, dateStr) {
  try {
    const r = await safeStorage.get(suggestionsKey(profileId, dateStr), false);
    if (r && r.value) { const v = JSON.parse(r.value); if (v && Array.isArray(v.items)) return v; }
  } catch (e) {}
  return null;
}
async function saveSuggestions(profileId, dateStr, items) {
  try {
    await safeStorage.set(suggestionsKey(profileId, dateStr),
      JSON.stringify({ items, generatedAt: Date.now() }), false);
  } catch (e) {}
}

// =====================================================================
// MINDMAP V2 — FEATURE B: animated unlock moments
//   (Pipeline step 31 / P11 Feature B)  [ARTIFACT]
// ---------------------------------------------------------------------
// Celebrates node STATE TRANSITIONS when the Knowledge Map is shown after a
// quiz. The pure diff core lives here (unit-tested); the imperative playback
// (stagger queue + camera fly + haptics + optional chime) lives in
// KnowledgeMap. No schema change: the ONLY storage write is a NEW local kv key
// 'mindmapseen:v1:{profileId}' (shared:false) holding the prior per-node state
// snapshot we diff against. Reconciliations vs the prompt:
//   * The map is HAND-BUILT SVG (not react-flow): instead of setCenter we reuse
//     the SAME pan/zoom transform model as focusNode()/fitView() and tween the
//     existing { k,x,y } 'view' with requestAnimationFrame for a smooth fly.
//   * All glow/particles/checkmark are hand-built SVG + CSS keyframes (added to
//     fontStyles), echoing the existing kmapBonusReveal style.
//   * Haptics are mobile-only + feature-detected; prefers-reduced-motion skips
//     all animation, camera moves, haptics and chime (the snapshot is still
//     re-baselined, so the new state simply shows with no fanfare).
//   * Composes with the P10 bonus reveal (which targets bonus:: ids, never in
//     this subject/sub diff) and the Feature A panel (independent effect).
// =====================================================================


// Flatten the model to a { nodeId -> state } snapshot for EVERY subject and
// subtopic node. The ids are identical to those mindmapLayout emits
// (subject id; '<subjectId>::<sub>'), so a changed id maps straight back to a
// positioned node. Pure.
function buildMindmapStateSnapshot(model) {
  const snap = {};
  ((model && model.subjects) || []).forEach(s => {
    snap[s.id] = s.state;
    (s.subs || []).forEach(sub => { snap[s.id + '::' + sub.sub] = sub.state; });
  });
  return snap;
}

const CELEB_MAX = 6;                                   // cap concurrent celebrations (keep it smooth on low-end phones)
const CELEB_TIERS = ['discovered', 'familiar', 'mastered'];   // states we celebrate an upgrade INTO

// Diff the prior snapshot against the live model; return the ordered list of
// UPGRADES to celebrate. `prev == null` means "no snapshot yet" (first ever
// view) -> return [] so we do NOT burst-animate pre-existing progress; the
// caller seeds the snapshot instead. When a snapshot exists, an absent node is
// treated as 'locked' (rank 0) so a brand-new first attempt (locked ->
// discovered) correctly counts. Pure + unit-tested.
//   Returns [{ id, name, color, kind, fromState, toState, tier }] in PLAY
//   ORDER (ascending tier, so the biggest moment lands LAST), capped to
//   CELEB_MAX (keeping the highest tiers when over the cap).
function diffMindmapUpgrades(prev, model) {
  if (prev == null) return [];
  const subjects = (model && model.subjects) || [];
  const ups = [];
  const consider = (id, name, color, kind, toState) => {
    const fromState = Object.prototype.hasOwnProperty.call(prev, id) ? prev[id] : 'locked';
    if (mindmapStateRank(toState) > mindmapStateRank(fromState) && CELEB_TIERS.indexOf(toState) !== -1) {
      ups.push({ id, name, color, kind, fromState, toState, tier: toState });
    }
  };
  subjects.forEach(s => {
    consider(s.id, s.name, s.color, 'subject', s.state);
    (s.subs || []).forEach(sub => consider(s.id + '::' + sub.sub, sub.sub, s.color, 'sub', sub.state));
  });
  let capped = ups;
  if (ups.length > CELEB_MAX) {
    capped = ups.slice().sort((a, b) =>
      (mindmapStateRank(b.toState) - mindmapStateRank(a.toState)) || a.name.localeCompare(b.name)
    ).slice(0, CELEB_MAX);
  }
  return capped.sort((a, b) =>
    (mindmapStateRank(a.toState) - mindmapStateRank(b.toState)) || a.name.localeCompare(b.name)
  );
}

// ---- Prior-state snapshot persistence (shared:false). Robust across the map's
// remounts (it unmounts when you leave for a quiz, so a ref would reset).
// Namespaced by profile like the Feature A suggestions ('guest' when signed
// out). No schema bump, no Supabase write.
function mindmapSeenKey(profileId) { return 'mindmapseen:v1:' + (profileId || 'guest'); }
async function loadMindmapSeen(profileId) {
  try {
    const r = await safeStorage.get(mindmapSeenKey(profileId), false);
    if (r && r.value) { const v = JSON.parse(r.value); if (v && v.states && typeof v.states === 'object') return v.states; }
  } catch (e) {}
  return null;
}
async function saveMindmapSeen(profileId, states) {
  try { await safeStorage.set(mindmapSeenKey(profileId), JSON.stringify({ states: states || {}, ts: Date.now() }), false); } catch (e) {}
}

// On-screen hold per tier (ms) before advancing the queue; a CELEB_STAGGER_MS
// gap is added between each (prompt point 2). Mastered lingers a touch longer.
const CELEB_HOLD_MS = { discovered: 760, familiar: 760, mastered: 1160 };
const CELEB_STAGGER_MS = 400;

// Haptics — mobile-only + feature-detected; a no-op (and harmless) on desktop.
function celebrateHaptic(tier) {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (tier === 'mastered') navigator.vibrate([30, 40, 30]);
    else if (tier === 'familiar') navigator.vibrate(20);
    // 'discovered' is deliberately silent (prompt: no sound, no haptic).
  } catch (e) {}
}

// prefers-reduced-motion — guarded for non-DOM / test envs.
function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { return false; }
}

// Optional soft chime per state change (Feature B item 5) — synthesized with
// the Web Audio API (no asset files). OFF by default; the toggle is persisted
// locally (shared:false). Fully feature-detected + guarded; any failure is
// silent. A single shared AudioContext is lazily created on first (user-gesture
// driven) enable so later chimes are allowed to sound.
const MINDMAP_SOUND_KEY = 'mindmapsound:v1';
async function loadMindmapSound() {
  try { const r = await safeStorage.get(MINDMAP_SOUND_KEY, false); if (r && r.value != null) return r.value === 'true' || r.value === true || r.value === '1'; } catch (e) {}
  return false;
}
async function saveMindmapSound(on) { try { await safeStorage.set(MINDMAP_SOUND_KEY, on ? 'true' : 'false', false); } catch (e) {} }
let _kmapAudioCtx = null;
function playCelebChime(tier) {
  try {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    if (!_kmapAudioCtx) _kmapAudioCtx = new AC();
    const ctx = _kmapAudioCtx;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    const now = ctx.currentTime;
    const freq = tier === 'mastered' ? 880 : tier === 'familiar' ? 660 : 523;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.4);
  } catch (e) {}
}

// =====================================================================
// MINDMAP V2 — FEATURE C: per-node study notes
//   (Pipeline step 32 / P11 Feature C)  [MIXED]
// ---------------------------------------------------------------------
// Lets the user pin a free-text note (mnemonic, doubt, link) to any
// unlocked subject or sub node, search the map by note/topic text, and
// export/import all notes as JSON (from Settings). No schema change: notes
// live in ONE new local kv blob 'mindmapnotes:v1:{profileId}'
// (shared:false). Reconciliations vs the prompt:
//   * The prompt suggested a per-topic key note:{pid}:{topicId}. We use a
//     SINGLE blob per profile instead — consistent with every other local
//     key here (suggestions / explorerbadges / mindmapseen), and it makes
//     search + export a single read and import a single write (fewer
//     IndexedDB round-trips, smoother on low-end phones with 100+ nodes).
//   * "topicId" maps onto the mindmap layout node id, so BOTH subjects
//     (subj.id) and subs (subj.id + '::' + sub) can be annotated.
//   * The read-only note view (text + timestamp + Edit) lives inside the
//     EXISTING tap popup rather than a separate badge-tap popover: sub
//     nodes (r=11) are too small for a reliable independent tap target and
//     a 2nd floating layer would fight the pan/zoom transform. The pushpin
//     badge stays as the at-a-glance indicator.
//   * Long-press (mobile) + right-click (desktop) open the note editor; a
//     drag or a quick tap never does (long-press is cancelled on move).
// =====================================================================
// [A1 slice 12] mindmap note subsystem (NOTE_MAX_LEN, sanitizeNoteText,
// loadMindmapNotes, saveMindmapNotes, mindmapNoteMatch, mergeNotes,
// buildNotesExport, parseNotesImport) moved to ./lib/notes.js (imported above).
// MINDMAP_NOTES_VERSION + mindmapNotesKey are now module-internal to notes.js.

// Compact "updated …" label for the note view. `now` injectable for tests.
// [A1 step 34] relativeTimeShort moved to ./lib/utils.js

// TODO (P11 Feature C — Phase 2, not built): markdown-lite rendering for notes
// (*bold*, _italic_, "- " bullet lists) + emoji. Notes are stored and displayed
// as plain text for now (whitespace preserved via whitespace-pre-wrap). A future
// pass can add a tiny, sanitised inline-formatter at the note-VIEW layer only —
// storage stays plain text, so no migration and no schema change.

// ---- Pure layout maths (radial). Unit-tested separately. -----------------



// [A1 step 34] clampNum moved to ./lib/utils.js

// =====================================================================
// #13 Constellation overhaul — pure visual helpers (dark "star map").
// The map interior is intentionally dark regardless of app theme, so these
// tokens are fixed (not theme-derived). The four states are dramatically
// different: locked = fog, discovered = cool star, familiar = warm star,
// mastered = radiant gold-crowned star.
// =====================================================================
const CMAP = {
  bg: '#0A0E1C',            // deep navy near-black
  bgEdge: '#070A14',        // darker vignette edge
  star: '#FFFFFF',          // starfield dots
  panel: 'rgba(18,24,42,0.94)',
  panelSolid: '#121A2E',
  border: 'rgba(255,255,255,0.14)',
  text: '#EAF0FF',
  muted: 'rgba(234,240,255,0.58)',
  edge: 'rgba(150,180,255,0.22)',
  edgeRoot: 'rgba(255,210,120,0.40)',
  sun: '#FFD27A',           // warm sun glow around NORCET center
};
// Per-state constellation styling. `base` is the subject identity colour.
function _constNode(state, base) {
  switch (state) {
    case 'mastered':
      return { core: base, ring: '#FFE6A6', label: '#FFFFFF', labelOpacity: 1,
               glow: base, glowClass: 'kmap-radiance', glowR: 2.25, glowOpacity: 0.55,
               rScale: 1.18, crown: true, orbit: true };
    case 'familiar':
      return { core: base, ring: base, label: '#F3F6FF', labelOpacity: 1,
               glow: base, glowClass: 'kmap-pulse-warm', glowR: 1.85, glowOpacity: 0.42,
               rScale: 1.06, crown: false, orbit: false };
    case 'discovered':
      return { core: '#26365C', ring: '#93C2FF', label: '#D6E6FF', labelOpacity: 0.95,
               glow: '#7FB4FF', glowClass: 'kmap-pulse-slow', glowR: 1.7, glowOpacity: 0.34,
               rScale: 0.96, crown: false, orbit: false };
    default: // locked — fog of war
      return { core: 'rgba(255,255,255,0.045)', ring: 'rgba(255,255,255,0.16)',
               label: 'rgba(234,240,255,0.30)', labelOpacity: 1,
               glow: null, glowClass: null, glowR: 0, glowOpacity: 0,
               rScale: 0.84, crown: false, orbit: false };
  }
}
// Deterministic star field (logical coords) — generated once, stable across renders.
const CMAP_STARS = (() => {
  const out = []; let seed = 1337;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 90; i++) {
    out.push({ x: rnd() * KMAP_VIEW, y: rnd() * KMAP_VIEW, r: 0.6 + rnd() * 1.6, o: 0.18 + rnd() * 0.5 });
  }
  return out;
})();
const kmapIntroSeenKey = (pid) => 'kmapintroseen:v1:' + (pid || 'guest');

// ---- The screen ----------------------------------------------------------
function KnowledgeMap({ onPracticeTopic, onPracticeSub, onBack }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { data, allQuestions } = useData();
  const profileId = useProfile().profileId;
  const fgOnDark = useFgOnDark();
  // #13 — per-state visuals now come from the module-scope _constNode()
  // (constellation language); the old theme-tinted _kmapNodeStyle was removed.
  const includeGk = !!(data && data.preferences && data.preferences.includeGkInStats === true);

  // Compute states ONCE per progress change (prompt point 7).
  const model = useMemo(
    () => computeMindmapModel(allQuestions, data && data.history, includeGk),
    [allQuestions, data && data.history, includeGk]
  );
  const layout = useMemo(() => mindmapLayout(model), [model]);

  // Pan / zoom — transform applied to an inner <g>; viewBox already fits the
  // whole map, so the default {k:1,x:0,y:0} IS fit-to-screen.
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const svgRef = useRef(null);
  const pointers = useRef(new Map());     // pointerId -> {x,y} (client coords)
  const dragRef = useRef(null);           // { startX, startY, ox, oy } for single-finger pan
  const pinchRef = useRef(null);          // { dist, k } for two-finger zoom
  const lastTapRef = useRef({ t: 0, id: null });

  const [selected, setSelected] = useState(null);   // node payload for popup
  // #13 follow-up — fullscreen mode for the map (user request). The container
  // becomes a fixed overlay; the SVG + gestures adapt automatically because
  // they measure getBoundingClientRect. Body scroll locks while active.
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [fullscreen]);
  // Re-fit the camera right after the surface changes size so the galaxy is
  // framed for the new dimensions.
  const toggleFullscreen = () => {
    setFullscreen(f => !f);
    setTimeout(() => { try { fitView(); } catch (_) {} }, 60);
  };
  // #13 — first-time cinematic intro: 'reveal' while the camera pulls back,
  // 'banner' to show the one-time welcome, null afterwards. Plays once ever.
  const [intro, setIntro] = useState(null);
  const introRan = useRef(false);

  // Phase B — earned Explorer badges (local-only, shared:false). Loaded once;
  // mutated via earnExplorer below. Never written to Supabase.
  const [explorerBadges, setExplorerBadges] = useState([]);
  useEffect(() => { let alive = true; loadExplorerBadges().then(b => { if (alive) setExplorerBadges(b); }); return () => { alive = false; }; }, []);
  const earnExplorer = useCallback((bonusId) => {
    setExplorerBadges(prev => {
      if (!bonusId || prev.indexOf(bonusId) !== -1) return prev;
      const next = [...prev, bonusId];
      saveExplorerBadges(next);
      return next;
    });
  }, []);

  // P11 Feature A — "What to study next". Compute once per progress change,
  // but PERSIST the chosen suggestions for the day (24h) so they don't churn on
  // every refresh. On mount: if today's cached set exists, use it; else rank
  // fresh from the current model and cache it under today's date.
  const [suggestions, setSuggestions] = useState([]);
  const [suggestDismissed, setSuggestDismissed] = useState(false);  // user closed the "Suggested today" panel
  useEffect(() => {
    let alive = true;
    const today = todayStr();
    const lastTouched = {};
    (model.subjects || []).forEach(s => {
      lastTouched[s.id] = subjectLastTouchedTs(s.id, allQuestions, data && data.history);
    });
    (async () => {
      const cached = await loadSuggestions(profileId, today);
      if (!alive) return;
      if (cached && Array.isArray(cached.items)) {
        // Re-hydrate names/details from the live model in case a cached id is
        // now empty/hidden; drop any that no longer exist.
        const byId = {};
        (model.subjects || []).forEach(s => { byId[s.id] = s; });
        const live = cached.items.filter(it => byId[it.id]);
        if (live.length > 0) { setSuggestions(live); return; }
      }
      const ranked = rankStudySuggestions(model, lastTouched, Date.now());
      setSuggestions(ranked);
      if (ranked.length > 0) saveSuggestions(profileId, today, ranked);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, profileId]);

  // ---- P11 Feature B — animated unlock moments -----------------------------
  // `celebrating` = the single node whose celebration is currently on-screen
  // (positioned + tiered); the queue is played sequentially below.
  const [celebrating, setCelebrating] = useState(null);   // { id,x,y,r,color,tier,name } | null
  const [soundOn, setSoundOn] = useState(false);           // Feature B item 5 (off by default)
  const soundOnRef = useRef(false);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  useEffect(() => { let alive = true; loadMindmapSound().then(v => { if (alive) setSoundOn(v); }); return () => { alive = false; }; }, []);

  // ---- P11 Feature C — per-node study notes --------------------------------
  // notes: { nodeId: { text, updatedAt } }, loaded once (local, shared:false).
  const [notes, setNotes] = useState({});
  const [noteEditor, setNoteEditor] = useState(null);   // node payload being edited | null
  const [query, setQuery] = useState('');               // search text
  const [searchOpen, setSearchOpen] = useState(false);  // search bar expanded?
  useEffect(() => {
    let alive = true;
    loadMindmapNotes(profileId).then(n => { if (alive) setNotes(n || {}); });
    return () => { alive = false; };
  }, [profileId]);

  const noteTextFor = useCallback((id) => (notes[id] && typeof notes[id].text === 'string') ? notes[id].text : '', [notes]);

  // Save / delete a note for a node id; mirrors the badge + popup instantly and
  // persists the whole blob (shared:false — guests included, never synced).
  const saveNote = useCallback((id, text) => {
    const clean = sanitizeNoteText(text);
    setNotes(prev => {
      const next = { ...prev };
      if (!clean) { delete next[id]; }
      else { next[id] = { text: clean, updatedAt: Date.now() }; }
      saveMindmapNotes(profileId, next);
      return next;
    });
  }, [profileId]);
  const deleteNote = useCallback((id) => {
    setNotes(prev => { const next = { ...prev }; delete next[id]; saveMindmapNotes(profileId, next); return next; });
  }, [profileId]);

  // Long-press (mobile) / right-click (desktop) -> open the note editor. A drag
  // or a quick tap must NOT trigger it, so we arm a timer on pointer-down and
  // cancel it on movement / pointer-up; `fired` suppresses the follow-up tap.
  const NOTE_LONGPRESS_MS = 480;
  const lpRef = useRef({ timer: 0, id: null, sx: 0, sy: 0, fired: false });
  const clearLongPress = useCallback(() => {
    if (lpRef.current.timer) { clearTimeout(lpRef.current.timer); lpRef.current.timer = 0; }
  }, []);
  const openNoteEditor = useCallback((node) => { clearLongPress(); setSelected(null); setNoteEditor(node); }, [clearLongPress]);
  const startLongPress = useCallback((node, e) => {
    if (e && e.button === 2) return;   // right-click is handled by onContextMenu
    clearLongPress();
    lpRef.current = { timer: 0, id: node.id, sx: (e && e.clientX) || 0, sy: (e && e.clientY) || 0, fired: false };
    lpRef.current.timer = setTimeout(() => {
      lpRef.current.fired = true; lpRef.current.timer = 0;
      try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15); } catch (_) {}
      openNoteEditor(node);
    }, NOTE_LONGPRESS_MS);
  }, [clearLongPress, openNoteEditor]);
  // Props spread onto each annotatable node <g>. onContextMenu = desktop path.
  const noteGestureProps = (node) => ({
    onContextMenu: (e) => { e.preventDefault(); openNoteEditor(node); },
    onPointerDown: (e) => startLongPress(node, e),
    onPointerUp: clearLongPress,
    onPointerLeave: clearLongPress
  });

  // search: the set of node ids matching the active query (name OR note text).
  const queryActive = query.trim().length > 0;
  const matchSet = useMemo(() => {
    if (!queryActive) return null;
    const set = new Set();
    layout.nodes.forEach(n => {
      if (n.kind === 'root') return;
      const nm = n.kind === 'sub' ? (n.data && n.data.sub) : (n.data && n.data.name);
      const nt = (notes[n.id] && notes[n.id].text) || '';
      if (mindmapNoteMatch(query, nm, nt)) set.add(n.id);
    });
    return set;
  }, [query, queryActive, layout, notes]);

  const celebTimers = useRef([]);            // pending setTimeout ids (cleared on unmount / user takeover)
  const camRaf = useRef(0);                  // active requestAnimationFrame id for the camera fly
  const viewRef = useRef(view);              // live mirror so the rAF tween reads the current view without stale closures
  useEffect(() => { viewRef.current = view; }, [view]);

  // id -> positioned layout node, so an upgraded id resolves straight to x/y.
  const nodeById = useMemo(() => {
    const m = {}; layout.nodes.forEach(n => { m[n.id] = n; }); return m;
  }, [layout]);
  const nodeRadiusFor = (kind) => kind === 'subject' ? 34 : kind === 'sub' ? 11 : 16;

  // Cancel any in-flight camera fly (used when the user grabs the map).
  const cancelCameraFly = useCallback(() => {
    if (camRaf.current && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(camRaf.current);
    camRaf.current = 0;
  }, []);
  // Smoothly tween the existing { k,x,y } 'view' to a target (the react-flow
  // setCenter replacement — same transform model as focusNode/fitView). Falls
  // back to an instant set when rAF is unavailable (e.g. tests).
  const animateView = useCallback((target, ms) => {
    cancelCameraFly();
    if (typeof requestAnimationFrame !== 'function') { setView(target); return; }
    const nowFn = (typeof performance !== 'undefined' && performance.now) ? () => performance.now() : () => Date.now();
    const start = nowFn();
    const from = viewRef.current;
    const dur = ms || 480;
    const ease = (t) => 1 - Math.pow(1 - t, 3);   // easeOutCubic
    const step = () => {
      const t = Math.min(1, (nowFn() - start) / dur);
      const e = ease(t);
      setView({
        k: from.k + (target.k - from.k) * e,
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e
      });
      camRaf.current = t < 1 ? requestAnimationFrame(step) : 0;
    };
    camRaf.current = requestAnimationFrame(step);
  }, [cancelCameraFly]);

  // Stop the celebration tour cleanly (timers + any fly), leaving the new state
  // shown. Called on unmount and when the user takes over the map.
  const cancelCelebration = useCallback(() => {
    celebTimers.current.forEach(id => clearTimeout(id));
    celebTimers.current = [];
    cancelCameraFly();
    setCelebrating(null);
  }, [cancelCameraFly]);

  const Z_MIN = 0.55, Z_MAX = 4;

  // Convert a pointer event to logical viewBox coords (accounts for the
  // rendered size + the current transform). Defensive for non-DOM envs.
  const toLogical = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg || !svg.getBoundingClientRect) return { x: KMAP_VIEW / 2, y: KMAP_VIEW / 2 };
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return { x: KMAP_VIEW / 2, y: KMAP_VIEW / 2 };
    // viewBox is square KMAP_VIEW; SVG keeps aspect (xMidYMid meet).
    const scale = Math.min(r.width, r.height) / KMAP_VIEW;
    const padX = (r.width - KMAP_VIEW * scale) / 2;
    const padY = (r.height - KMAP_VIEW * scale) / 2;
    const vx = (clientX - r.left - padX) / scale;     // into viewBox space
    const vy = (clientY - r.top - padY) / scale;
    // undo the pan/zoom transform: logical = (v - x)/k
    return { x: (vx - view.x) / view.k, y: (vy - view.y) / view.k };
  }, [view]);

  // Zoom keeping the focal viewBox-point fixed on screen.
  const zoomAt = useCallback((nextK, focalVx, focalVy) => {
    setView(v => {
      const k = clampNum(nextK, Z_MIN, Z_MAX);
      const fx = focalVx == null ? KMAP_VIEW / 2 : focalVx;
      const fy = focalVy == null ? KMAP_VIEW / 2 : focalVy;
      const x = fx - ((fx - v.x) / v.k) * k;
      const y = fy - ((fy - v.y) / v.k) * k;
      return { k, x, y };
    });
  }, []);

  const fitView = useCallback(() => setView({ k: 1, x: 0, y: 0 }), []);

  // Centre + zoom onto a node (double-tap / double-click).
  const focusNode = useCallback((node) => {
    if (!node) return;
    const k = 1.9;
    setView({ k, x: KMAP_VIEW / 2 - node.x * k, y: KMAP_VIEW / 2 - node.y * k });
  }, []);

  // Targets reusing the focusNode/fitView transform model (no react-flow).
  const focusTargetFor = (node) => { const k = 1.9; return { k, x: KMAP_VIEW / 2 - node.x * k, y: KMAP_VIEW / 2 - node.y * k }; };
  const FIT_TARGET = { k: 1, x: 0, y: 0 };

  // P11 Feature B — on mount, diff the live model against the persisted prior
  // snapshot to find nodes that JUST upgraded (i.e. since the last time the map
  // was open — which, after a quiz, captures that quiz's gains), then play a
  // staggered celebration tour. Seeds silently on first ever view; re-baselines
  // the snapshot UP FRONT every open, so re-viewing without a quiz shows
  // nothing and re-entry is idempotent. Runs ONCE per mount.
  useEffect(() => {
    let alive = true;
    const reduced = prefersReducedMotion();
    (async () => {
      const prev = await loadMindmapSeen(profileId);
      if (!alive) return;
      const snapshot = buildMindmapStateSnapshot(model);
      const upgrades = diffMindmapUpgrades(prev, model);
      saveMindmapSeen(profileId, snapshot);            // re-baseline immediately (idempotent re-entry)
      if (reduced || upgrades.length === 0) return;    // reduced motion / nothing changed -> just show new state
      // Resolve each upgrade to a positioned node (drop any not in the layout).
      const queue = upgrades
        .map(u => { const n = nodeById[u.id]; return n ? { id: u.id, name: u.name, color: u.color, tier: u.tier, x: n.x, y: n.y, r: nodeRadiusFor(u.kind) } : null; })
        .filter(Boolean);
      if (queue.length === 0) return;
      let i = 0;
      const playNext = () => {
        if (!alive) return;
        if (i >= queue.length) {
          const t = setTimeout(() => { if (alive) animateView(FIT_TARGET, 620); }, 520);
          celebTimers.current.push(t);
          return;
        }
        const item = queue[i++];
        setCelebrating(item);
        animateView(focusTargetFor(item), 460);        // gently fly to the changed node (smooth)
        celebrateHaptic(item.tier);                    // mobile-only + feature-detected
        if (soundOnRef.current) playCelebChime(item.tier);
        const hold = CELEB_HOLD_MS[item.tier] || 800;
        const t = setTimeout(() => {
          if (!alive) return;
          setCelebrating(null);
          const t2 = setTimeout(playNext, CELEB_STAGGER_MS);   // ~400ms stagger between nodes
          celebTimers.current.push(t2);
        }, hold);
        celebTimers.current.push(t);
      };
      playNext();
    })();
    return () => { alive = false; celebTimers.current.forEach(id => clearTimeout(id)); celebTimers.current = []; cancelCameraFly(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- pointer plumbing (pan + pinch) ---
  const onPointerDown = (e) => {
    cancelCelebration();   // user takes over -> stop the celebration tour + camera fly, keep the shown state
    try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (_) {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      dragRef.current = { startX: e.clientX, startY: e.clientY, ox: view.x, oy: view.y, moved: false };
    } else if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      pinchRef.current = { dist, k: view.k };
      dragRef.current = null;
    }
  };
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinchRef.current) {
      const pts = Array.from(pointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const midClient = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const focal = toLogical(midClient.x, midClient.y);
      const focalVx = focal.x * view.k + view.x;     // back to viewBox space
      const focalVy = focal.y * view.k + view.y;
      zoomAt(pinchRef.current.k * (dist / pinchRef.current.dist), focalVx, focalVy);
    } else if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
      if (Math.abs(dx) + Math.abs(dy) > 8) clearLongPress();   // a real drag cancels the pending long-press
      const svg = svgRef.current;
      const r = svg && svg.getBoundingClientRect ? svg.getBoundingClientRect() : null;
      const scale = r && r.width ? Math.min(r.width, r.height) / KMAP_VIEW : 1;
      // Capture origin BEFORE setView: the functional updater can run after a
      // pointerup/pointercancel has reset dragRef.current to null (common on
      // touch during a pan->pinch handoff), which previously threw
      // "Cannot read properties of null (reading 'ox')".
      const ox = dragRef.current.ox, oy = dragRef.current.oy;
      setView(v => ({ ...v, x: ox + dx / scale, y: oy + dy / scale }));
    }
  };
  const endPointer = (e) => {
    clearLongPress();
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size === 0) dragRef.current = null;
  };
  const onWheel = (e) => {
    e.preventDefault();
    const focal = toLogical(e.clientX, e.clientY);
    const focalVx = focal.x * view.k + view.x;
    const focalVy = focal.y * view.k + view.y;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(view.k * factor, focalVx, focalVy);
  };

  // Node activation — single tap opens popup; double tap centres+zooms.
  const activateNode = (node) => {
    if (lpRef.current.fired) { lpRef.current.fired = false; return; }   // long-press already opened the note editor
    if (dragRef.current && dragRef.current.moved) return;   // ignore taps that were drags
    const now = Date.now();
    if (lastTapRef.current.id === node.id && now - lastTapRef.current.t < 320) {
      lastTapRef.current = { t: 0, id: null };
      focusNode(node);
      return;
    }
    lastTapRef.current = { t: now, id: node.id };
    setSelected(node);
  };

  const minimapVisible = view.k > 1.15;

  // #13 — progressive reveal by zoom. Galaxy: subjects only. Solar: sub-topics
  // fade in. Topic: everything crisp. Sub-nodes + their tree edges share one
  // opacity ramp so the map never feels like a dense web when zoomed out.
  const subReveal = Math.max(0, Math.min(1, (view.k - 1.15) / 0.95));   // 0 at k≤1.15 → 1 at k≥2.10
  const subsInteractive = view.k >= 1.35;

  // #13 — fog of war. Locked nodes adjacent to discovered/familiar territory
  // get a subtle shimmer that pulls the eye toward what's unlockable next.
  const fogSet = useMemo(() => {
    const m = new Map();   // id -> 'soft' | 'strong'
    const byId = {}; (model.subjects || []).forEach(s => { byId[s.id] = s; });
    (model.subjects || []).forEach(subj => {
      const started = mindmapStateRank(subj.state) >= 1;   // discovered+
      const masteredSib = (subj.subs || []).some(x => x.state === 'mastered');
      (subj.subs || []).forEach(sub => {
        if (sub.state === 'locked' && started) m.set(`${subj.id}::${sub.sub}`, masteredSib ? 'strong' : 'soft');
      });
    });
    DEPENDENCIES.forEach(dep => {
      const a = byId[dep.from], b = byId[dep.to];
      if (!a || !b) return;
      if (a.state === 'locked' && mindmapStateRank(b.state) >= 1 && !m.has(a.id)) m.set(a.id, 'soft');
      if (b.state === 'locked' && mindmapStateRank(a.state) >= 1 && !m.has(b.id)) m.set(b.id, 'soft');
    });
    return m;
  }, [model]);

  // #13 — first-time cinematic reveal. Start zoomed in on the NORCET sun, then
  // pull back to the full galaxy over ~2.6s and show the one-time welcome.
  useEffect(() => {
    if (introRan.current) return;
    introRan.current = true;
    let alive = true;
    const timers = [];
    (async () => {
      let seen = false;
      try { const r = await safeStorage.get(kmapIntroSeenKey(profileId), false); seen = !!(r && r.value); } catch (_) {}
      if (!alive || seen) return;
      try { safeStorage.set(kmapIntroSeenKey(profileId), '1', false); } catch (_) {}
      const reduced = prefersReducedMotion();
      const cx = KMAP_VIEW / 2;
      if (reduced || typeof requestAnimationFrame !== 'function') {
        setIntro('banner');
        timers.push(setTimeout(() => { if (alive) setIntro(null); }, 6000));
        return;
      }
      setIntro('reveal');
      setView({ k: 2.7, x: cx - cx * 2.7, y: cx - cx * 2.7 });   // centred on the sun
      timers.push(setTimeout(() => { if (alive) animateView(FIT_TARGET, 2600); }, 70));
      timers.push(setTimeout(() => { if (alive) setIntro('banner'); }, 2750));
    })();
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [profileId, animateView]);

  return (
    <div className="anim-fadeup">
      <TopBar title="Knowledge Map" onBack={onBack} feedback={{ screen: 'Knowledge Map' }} />

      <div className="max-w-md mx-auto px-4 pt-3 pb-24">
        {/* Encouraging banner for users with no progress (edge case 10),
            re-voiced for the constellation metaphor. */}
        {model.totalAttempted === 0 && (
          <div className="rounded-2xl px-4 py-3 mb-3 text-sm anim-fadeup"
               style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}`, color: T.ink }}>
            <span className="font-display font-semibold">Take a quiz to light your first star.</span>
            <div className="text-xs mt-1" style={{ color: T.muted }}>
              Every topic starts dark. Answer questions and watch your constellation come to life.
            </div>
          </div>
        )}

        {/* Legend — tiny live examples of each state in the new constellation
            language, on a dark strip so the glows read the same as the map. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2 px-3 py-2 rounded-xl text-[11px]"
             style={{ background: CMAP.panelSolid, border: `1px solid ${CMAP.border}`, color: CMAP.muted }}>
          {KMAP_STATES.map(s => {
            const cs = _constNode(s, CMAP.sun);
            return (
              <span key={s} className="inline-flex items-center gap-1.5">
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: 'block', flexShrink: 0 }}>
                  {cs.glow && <circle cx="9" cy="9" r={7.5} fill={cs.glow} opacity={cs.glowOpacity} />}
                  <circle cx="9" cy="9" r={4.6 * cs.rScale} fill={cs.core} stroke={cs.ring} strokeWidth={1.3} />
                  {cs.crown && <text x="9" y="6.2" textAnchor="middle" fontSize="6" fill="#FFE6A6">{'\u2605'}</text>}
                </svg>
                <span style={{ color: s === 'locked' ? CMAP.muted : CMAP.text }}>{KMAP_STATE_LABEL[s]}</span>
              </span>
            );
          })}
        </div>

        {/* The map surface — a dark "constellation" canvas. In fullscreen mode
            it becomes a fixed overlay filling the viewport (Esc or the button
            exits); all floating controls live inside, so they come along. */}
        <div className={fullscreen
               ? 'fixed inset-0 z-[80]'
               : 'relative rounded-2xl overflow-hidden'}
             style={{ height: fullscreen ? '100dvh' : 460, touchAction: 'none',
                      background: CMAP.bg,
                      border: fullscreen ? 'none' : `1px solid ${CMAP.border}` }}>
          {/* P11 Feature A — "Suggested for you today" floating panel (top-right
              overlay), restyled to the dark game aesthetic. */}
          {suggestions.length > 0 && !suggestDismissed && !intro && (
            <div className="absolute right-2 z-10 rounded-xl anim-fadeup"
                 style={{ top: fullscreen ? 'calc(env(safe-area-inset-top, 0px) + 52px)' : 8,
                          width: 200, background: CMAP.panel, border: `1px solid ${CMAP.border}`,
                          boxShadow: '0 6px 20px rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}>
              <div className="px-3 pt-2.5 pb-1.5 text-[11px] font-semibold flex items-center justify-between"
                   style={{ color: CMAP.text }}>
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} style={{ color: CMAP.sun }} /> Suggested today
                </span>
                <button onClick={() => setSuggestDismissed(true)}
                        className="no-tap-highlight p-0.5 -m-0.5 rounded active:bg-white/10"
                        aria-label="Dismiss suggestions">
                  <X size={14} style={{ color: CMAP.muted }} />
                </button>
              </div>
              <div className="px-2 pb-2 space-y-1.5">
                {suggestions.map(sug => (
                  <div key={sug.id} className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold truncate" style={{ color: CMAP.text }}>{sug.name}</span>
                      <button onClick={() => onPracticeTopic && onPracticeTopic(sug.id)}
                              className="no-tap-highlight text-[11px] font-semibold px-2 py-1 rounded-md flex-shrink-0 active:scale-95"
                              style={{ background: T.primary, color: '#fff' }}
                              aria-label={`Start a ${sug.name} quiz`}>
                        Start
                      </button>
                    </div>
                    <div className="text-[10px] mt-0.5 leading-snug" style={{ color: CMAP.muted }}>{sug.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <svg ref={svgRef} viewBox={`0 0 ${KMAP_VIEW} ${KMAP_VIEW}`} width="100%" height="100%"
               role="group" aria-label="Knowledge map of NORCET subjects and topics"
               style={{ display: 'block', cursor: 'grab', background: CMAP.bg }}
               onPointerDown={onPointerDown} onPointerMove={onPointerMove}
               onPointerUp={endPointer} onPointerCancel={endPointer} onPointerLeave={endPointer}
               onWheel={onWheel}>
            <defs>
              <radialGradient id="kmapSpace" cx="50%" cy="50%" r="62%">
                <stop offset="0%" stopColor="#141C32" />
                <stop offset="60%" stopColor={CMAP.bg} />
                <stop offset="100%" stopColor={CMAP.bgEdge} />
              </radialGradient>
              <radialGradient id="kmapSun" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={CMAP.sun} stopOpacity="0.55" />
                <stop offset="45%" stopColor={CMAP.sun} stopOpacity="0.18" />
                <stop offset="100%" stopColor={CMAP.sun} stopOpacity="0" />
              </radialGradient>
            </defs>
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {/* deep-space backdrop + static star field (panned with content) */}
              <rect x={-KMAP_VIEW} y={-KMAP_VIEW} width={KMAP_VIEW * 3} height={KMAP_VIEW * 3} fill="url(#kmapSpace)" />
              {CMAP_STARS.map((st, i) => (
                <circle key={`star${i}`} cx={st.x} cy={st.y} r={st.r} fill={CMAP.star} opacity={st.o} />
              ))}
              {/* ambient sun glow radiating from the NORCET centre */}
              <circle cx={KMAP_VIEW / 2} cy={KMAP_VIEW / 2} r={300} fill="url(#kmapSun)" className="kmap-sun-glow" />

              {/* edges first so nodes sit on top */}
              {layout.edges.map((ed, i) => {
                // Phase B edge styling by kind.
                if (ed.kind === 'prereq') {
                  return (
                    <path key={ed.id || `e${i}`} d={ed.d} fill="none"
                          stroke={T.accent} strokeWidth={2} strokeLinecap="round"
                          strokeOpacity={ed.pulse ? undefined : 0.55}
                          className={ed.pulse ? 'kmap-edge-pulse' : undefined} />
                  );
                }
                if (ed.kind === 'related') {
                  return (
                    <path key={ed.id || `e${i}`} d={ed.d} fill="none"
                          stroke={CMAP.muted} strokeWidth={1.4} strokeLinecap="round"
                          strokeOpacity={0.4} strokeDasharray="2 7" />
                  );
                }
                if (ed.kind === 'bonus') {
                  return (
                    <path key={ed.id || `e${i}`} d={ed.d} fill="none"
                          stroke={KMAP_BONUS_COLOR} strokeWidth={1.6} strokeLinecap="round"
                          strokeOpacity={0.55 * (0.3 + 0.7 * subReveal)} strokeDasharray="1 6" />
                  );
                }
                // tree edge: root→subject stays bright; subject→sub fades in with zoom.
                const isRoot = ed.from === '__root__';
                return (
                  <path key={ed.id || `e${i}`} d={ed.d} fill="none"
                        stroke={isRoot ? CMAP.edgeRoot : CMAP.edge}
                        strokeWidth={isRoot ? 2 : 1.1}
                        strokeOpacity={isRoot ? 0.7 : 0.55 * subReveal}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-opacity 220ms ease' }} />
                );
              })}

              {/* nodes */}
              {layout.nodes.map(node => {
                if (node.kind === 'root') {
                  return (
                    <g key={node.id}>
                      <circle cx={node.x} cy={node.y} r={120} fill="url(#kmapSun)" className="kmap-sun-glow" />
                      <circle cx={node.x} cy={node.y} r={46} fill={T.primary} />
                      <circle cx={node.x} cy={node.y} r={46} fill="none" stroke={CMAP.sun} strokeOpacity={0.6} strokeWidth={2.5} />
                      <text x={node.x} y={node.y + 5} textAnchor="middle" className="font-display"
                            fontSize={20} fontWeight={700} fill="#FFFFFF">NORCET</text>
                    </g>
                  );
                }
                if (node.kind === 'bonus') {
                  // Phase B — hexagonal amber "beyond syllabus" node. Fades in
                  // + pulses on first reveal (CSS). Earned-Explorer state shows
                  // a filled hex; otherwise an outlined hex invites exploration.
                  const b = node.data;
                  const earned = explorerBadges.indexOf(b.id) !== -1;
                  const r = 16;
                  const hex = _kmapHexPath(node.x, node.y, r);
                  const lx = node.x + Math.cos(node.angle) * (r + 5);
                  const ly = node.y + Math.sin(node.angle) * (r + 5);
                  const anchor = Math.cos(node.angle) > 0.3 ? 'start' : Math.cos(node.angle) < -0.3 ? 'end' : 'middle';
                  return (
                    <g key={node.id} className="kmap-bonus-reveal"
                       style={{ cursor: 'pointer', opacity: 0.3 + 0.7 * subReveal, pointerEvents: subsInteractive ? 'auto' : 'none' }}
                       onClick={() => activateNode(node)}
                       role="button" tabIndex={0}
                       aria-label={`Bonus: ${b.name}${earned ? ', Explorer badge earned' : ''}`}
                       onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(node); } }}>
                      <path d={hex} fill={KMAP_BONUS_COLOR} opacity={0.18} className="kmap-bonus-pulse" />
                      <path d={hex} fill={earned ? KMAP_BONUS_COLOR : KMAP_BONUS_COLOR + '33'}
                            stroke={KMAP_BONUS_COLOR} strokeWidth={2} />
                      <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize={15}>{earned ? '\u2605' : '\u2727'}</text>
                      <text x={lx} y={ly + 4} textAnchor={anchor} className="font-body"
                            fontSize={11} fontWeight={600} fill={CMAP.muted}>
                        {b.name}
                      </text>
                    </g>
                  );
                }
                if (node.kind === 'subject') {
                  const s = node.data;
                  const cs = _constNode(s.state, s.color);
                  const r = 34 * cs.rScale;
                  const lx = node.x + Math.cos(node.angle) * (r + 4);
                  const ly = node.y + Math.sin(node.angle) * (r + 4);
                  const anchor = Math.cos(node.angle) > 0.3 ? 'start' : Math.cos(node.angle) < -0.3 ? 'end' : 'middle';
                  const noted = !!(notes[node.id] && notes[node.id].text);
                  const dimmed = matchSet && !matchSet.has(node.id);
                  const hit = matchSet && matchSet.has(node.id);
                  const fog = fogSet.get(node.id);
                  return (
                    <g key={node.id} style={{ cursor: 'pointer', opacity: dimmed ? 0.18 : 1, transition: 'opacity 160ms ease' }}
                       onClick={() => activateNode(node)}
                       {...noteGestureProps(node)}
                       role="button" tabIndex={0}
                       aria-label={`${s.name}: ${KMAP_STATE_LABEL[s.state]}, ${Math.round(s.accuracy * 100)}% accuracy${noted ? ', has a note' : ''}`}
                       onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(node); } }}>
                      {/* fog-of-war shimmer ring for locked-but-adjacent subjects */}
                      {fog && (
                        <circle cx={node.x} cy={node.y} r={r + 7} fill="none" stroke={CMAP.sun}
                                strokeWidth={2} className={fog === 'strong' ? 'kmap-fog-shimmer-strong' : 'kmap-fog-shimmer'} />
                      )}
                      {hit && (
                        <circle cx={node.x} cy={node.y} r={r + 8} fill="none" stroke={T.accent} strokeWidth={3} strokeDasharray="4 4" opacity={0.95} />
                      )}
                      {/* state glow (radiance / pulse) behind the core */}
                      {cs.glow && (
                        <circle cx={node.x} cy={node.y} r={r * cs.glowR} fill={cs.glow}
                                opacity={cs.glowOpacity} className={cs.glowClass} />
                      )}
                      {/* mastered atmosphere — tiny orbiting particles */}
                      {cs.orbit && (
                        <g className="kmap-orbit">
                          {[0, 1, 2].map(k => {
                            const a = (k / 3) * Math.PI * 2;
                            return <circle key={k} cx={node.x + Math.cos(a) * (r + 10)} cy={node.y + Math.sin(a) * (r + 10)} r={2.4} fill="#FFE6A6" opacity={0.9} />;
                          })}
                        </g>
                      )}
                      <circle cx={node.x} cy={node.y} r={r} fill={cs.core} stroke={cs.ring}
                              strokeWidth={s.state === 'mastered' ? 3 : 2} />
                      <text x={node.x} y={node.y + 6} textAnchor="middle" fontSize={20}
                            opacity={s.state === 'locked' ? 0.45 : 1}>{topicIcon(s.id)}</text>
                      {/* mastered crown */}
                      {cs.crown && (
                        <text x={node.x} y={node.y - r + 4} textAnchor="middle" fontSize={16} fill="#FFE6A6">{'\u2605'}</text>
                      )}
                      {noted && (
                        <g aria-hidden="true">
                          <circle cx={node.x - r + 6} cy={node.y - r + 6} r={9} fill={CMAP.panelSolid} stroke={CMAP.border} strokeWidth={1.5} />
                          <text x={node.x - r + 6} y={node.y - r + 10} textAnchor="middle" fontSize={11}>{'\uD83D\uDCCC'}</text>
                        </g>
                      )}
                      <text x={lx} y={ly + 4} textAnchor={anchor} className="font-display"
                            fontSize={13} fontWeight={s.state === 'locked' ? 500 : 600}
                            fill={cs.label} opacity={cs.labelOpacity}>
                        {s.name}
                      </text>
                    </g>
                  );
                }
                // sub node — constellation star, revealed progressively by zoom.
                const s = node.data;
                const cs = _constNode(s.state, node.color);
                const r = 11 * cs.rScale;
                const lx = node.x + Math.cos(node.angle) * (r + 3);
                const ly = node.y + Math.sin(node.angle) * (r + 3);
                const anchor = Math.cos(node.angle) > 0.2 ? 'start' : Math.cos(node.angle) < -0.2 ? 'end' : 'middle';
                const subNoted = !!(notes[node.id] && notes[node.id].text);
                const subDimmed = matchSet && !matchSet.has(node.id);
                const subHit = matchSet && matchSet.has(node.id);
                const fog = fogSet.get(node.id);
                // Search forces full reveal so matches are always findable.
                const reveal = matchSet ? 1 : subReveal;
                const labelOn = matchSet ? true : view.k >= 2.3;   // labels only at Topic zoom
                return (
                  <g key={node.id}
                     style={{ cursor: 'pointer', opacity: (subDimmed ? 0.18 : 1) * reveal,
                              pointerEvents: (subsInteractive || matchSet) ? 'auto' : 'none',
                              transition: 'opacity 200ms ease' }}
                     onClick={() => activateNode(node)}
                     {...noteGestureProps(node)}
                     role="button" tabIndex={0}
                     aria-label={`${s.sub}: ${s.attempted > 0 ? `${Math.round(s.accuracy * 100)}% accuracy` : 'not started'}${subNoted ? ', has a note' : ''}`}
                     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(node); } }}>
                    {fog && (
                      <circle cx={node.x} cy={node.y} r={r + 4} fill="none" stroke={CMAP.sun}
                              strokeWidth={1.5} className={fog === 'strong' ? 'kmap-fog-shimmer-strong' : 'kmap-fog-shimmer'} />
                    )}
                    {subHit && (
                      <circle cx={node.x} cy={node.y} r={r + 5} fill="none" stroke={T.accent} strokeWidth={2.5} strokeDasharray="3 3" opacity={0.95} />
                    )}
                    {cs.glow && (
                      <circle cx={node.x} cy={node.y} r={r * cs.glowR} fill={cs.glow}
                              opacity={cs.glowOpacity} className={cs.glowClass} />
                    )}
                    <circle cx={node.x} cy={node.y} r={r} fill={cs.core} stroke={cs.ring} strokeWidth={1.6} />
                    {cs.crown && (
                      <text x={node.x} y={node.y - r + 1} textAnchor="middle" fontSize={9} fill="#FFE6A6">{'\u2605'}</text>
                    )}
                    {subNoted && (
                      <g aria-hidden="true">
                        <circle cx={node.x + r - 1} cy={node.y - r + 1} r={6} fill={CMAP.panelSolid} stroke={CMAP.border} strokeWidth={1.2} />
                        <text x={node.x + r - 1} y={node.y - r + 4} textAnchor="middle" fontSize={8}>{'\uD83D\uDCCC'}</text>
                      </g>
                    )}
                    {labelOn && (
                      <text x={lx} y={ly + 3} textAnchor={anchor} className="font-body"
                            fontSize={9.5} fill={cs.label} opacity={cs.labelOpacity}>
                        {s.sub.length > 22 ? s.sub.slice(0, 21) + '\u2026' : s.sub}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* P11 Feature B — celebration overlay for the node currently
                  upgrading. Sits inside the transformed <g> so it stays glued
                  to its node as the camera flies. Pointer-inert + aria-hidden;
                  all effects are CSS keyframes (kmap-celeb-*). */}
              {celebrating && (() => {
                const c = celebrating;
                const isMaster = c.tier === 'mastered';
                const isFam = c.tier === 'familiar';
                const pcount = isMaster ? 15 : isFam ? 6 : 0;
                const parts = [];
                for (let i = 0; i < pcount; i++) {
                  const ang = (i / pcount) * Math.PI * 2 + (isFam ? 0.35 : 0);
                  const dist = isMaster ? 34 + (i % 3) * 9 : 22 + (i % 2) * 7;
                  parts.push({ tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist, delay: (i % 5) * 22 });
                }
                const pdur = isMaster ? 1500 : 900;
                return (
                  <g key={`celeb-${c.id}`} aria-hidden="true" style={{ pointerEvents: 'none' }}>
                    {/* soft glow — whiter + larger for first-discovery */}
                    <circle cx={c.x} cy={c.y} r={c.r * 2.1}
                            fill={c.tier === 'discovered' ? '#FFFFFF' : c.color}
                            className="kmap-celeb-glow"
                            style={{ '--glow-from': c.tier === 'discovered' ? 0.5 : 0.3 }} />
                    {/* ring: scale-up (discovered) / saturation pulse (familiar) / bounce (mastered) */}
                    <circle cx={c.x} cy={c.y} r={c.r} fill="none" stroke={c.color}
                            strokeWidth={isMaster ? 4 : 3}
                            className={isMaster ? 'kmap-celeb-bounce' : isFam ? 'kmap-celeb-satpulse' : 'kmap-celeb-pop'} />
                    {/* particles: '+' dots (familiar) / colour burst (mastered) */}
                    {parts.map((p, i) => (
                      isFam ? (
                        <text key={i} x={c.x} y={c.y + 3} textAnchor="middle" fontSize={11} fontWeight={700}
                              fill={c.color} className="kmap-celeb-particle"
                              style={{ '--tx': p.tx + 'px', '--ty': p.ty + 'px', animationDuration: pdur + 'ms', animationDelay: p.delay + 'ms' }}>+</text>
                      ) : (
                        <circle key={i} cx={c.x} cy={c.y} r={3} fill={c.color} className="kmap-celeb-particle"
                                style={{ '--tx': p.tx + 'px', '--ty': p.ty + 'px', animationDuration: pdur + 'ms', animationDelay: p.delay + 'ms' }} />
                      )
                    ))}
                    {/* mastered — flag-planting: gold crown pops in + "Mastered"
                        floats up from the node and fades (spec moment 4–5). */}
                    {isMaster && (
                      <g className="kmap-celeb-check">
                        <text x={c.x} y={c.y - c.r - 2} textAnchor="middle" fontSize={18} fill="#FFE6A6">{'\u2605'}</text>
                      </g>
                    )}
                    {isMaster && (
                      <text x={c.x} y={c.y - c.r - 16} textAnchor="middle" className="font-display kmap-float-up"
                            fontSize={13} fontWeight={700} fill="#FFE6A6"
                            style={{ animationDelay: '500ms' }}>
                        Mastered
                      </text>
                    )}
                    {isMaster && (
                      <text x={c.x - c.r} y={c.y - c.r} textAnchor="middle" fontSize={15}
                            className="kmap-celeb-sparkle" fill={c.color}>{'\u2728'}</text>
                    )}
                  </g>
                );
              })()}
            </g>
          </svg>

          {/* #13 follow-up — explicit exit affordance while in fullscreen. */}
          {fullscreen && (
            <button onClick={toggleFullscreen} aria-label="Exit fullscreen"
                    className="no-tap-highlight absolute right-2 z-20 w-9 h-9 rounded-xl flex items-center justify-center active:scale-95"
                    style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
                             background: CMAP.panel, border: `1px solid ${CMAP.border}`, color: CMAP.text, backdropFilter: 'blur(6px)' }}>
              <X size={17} />
            </button>
          )}

          {/* #13 — master sound toggle (was Feature B). Off by default; toggles
              all game sounds. Icon reflects state; a chime confirms enabling and
              unlocks the AudioContext for later state-change chimes. Animations
              still play silently when off; device silent mode is respected. */}
          <button onClick={() => { const n = !soundOn; setSoundOn(n); saveMindmapSound(n); if (n) playCelebChime('familiar'); }}
                  aria-label={soundOn ? 'Game sound: on' : 'Game sound: off'} aria-pressed={soundOn}
                  className="no-tap-highlight absolute left-2 z-10 w-9 h-9 rounded-xl flex items-center justify-center active:scale-95"
                  style={{ top: fullscreen ? 'calc(env(safe-area-inset-top, 0px) + 8px)' : 8,
                           background: CMAP.panel, border: `1px solid ${CMAP.border}`, color: soundOn ? CMAP.sun : CMAP.muted, backdropFilter: 'blur(6px)' }}>
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* P11 Feature C — search. A compact toggle next to the sound button
              expands into a full-width bar that highlights matching nodes (by
              topic name OR note text) and dims the rest. */}
          {!searchOpen && (
            <button onClick={() => setSearchOpen(true)} aria-label="Search the map"
                    className="no-tap-highlight absolute left-12 z-10 w-9 h-9 rounded-xl flex items-center justify-center active:scale-95"
                    style={{ top: fullscreen ? 'calc(env(safe-area-inset-top, 0px) + 8px)' : 8,
                             background: CMAP.panel, border: `1px solid ${CMAP.border}`, color: queryActive ? CMAP.sun : CMAP.muted, backdropFilter: 'blur(6px)' }}>
              <Search size={16} />
            </button>
          )}
          {searchOpen && (
            <div className="absolute left-2 right-2 z-20 rounded-xl flex items-center gap-2 px-2.5 anim-fadeup"
                 style={{ top: fullscreen ? 'calc(env(safe-area-inset-top, 0px) + 8px)' : 8,
                          height: 38, background: CMAP.panel, border: `1px solid ${CMAP.border}`, boxShadow: '0 6px 20px rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}>
              <Search size={15} style={{ color: CMAP.muted, flexShrink: 0 }} />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                     placeholder={'Search topics & notes\u2026'}
                     aria-label="Search topics and notes"
                     className="flex-1 bg-transparent outline-none text-sm min-w-0"
                     style={{ color: CMAP.text }} />
              {queryActive && (
                <span className="text-[11px] font-medium flex-shrink-0" style={{ color: CMAP.muted }}>
                  {matchSet ? matchSet.size : 0} match{(matchSet && matchSet.size === 1) ? '' : 'es'}
                </span>
              )}
              <button onClick={() => { setQuery(''); setSearchOpen(false); }} aria-label="Close search"
                      className="no-tap-highlight p-1 rounded-full active:scale-90 flex-shrink-0" style={{ color: CMAP.muted }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Zoom controls (replacing react-flow <Controls/>) + fullscreen */}
          <div className="absolute left-3 flex flex-col gap-1.5"
               style={{ bottom: fullscreen ? 'calc(env(safe-area-inset-bottom, 0px) + 12px)' : 12 }}>
            {[
              { lbl: fullscreen ? 'Exit fullscreen' : 'Fullscreen', sign: fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />, fn: toggleFullscreen },
              { lbl: 'Zoom in', sign: <Plus size={16} />, fn: () => zoomAt(view.k * 1.25) },
              { lbl: 'Zoom out', sign: <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 700 }}>{'\u2212'}</span>, fn: () => zoomAt(view.k / 1.25) },
              { lbl: 'Fit to screen', sign: <LayoutGrid size={15} />, fn: fitView }
            ].map(b => (
              <button key={b.lbl} onClick={b.fn} aria-label={b.lbl} title={b.lbl}
                      className="no-tap-highlight w-9 h-9 rounded-xl flex items-center justify-center active:scale-95"
                      style={{ background: CMAP.panel, border: `1px solid ${CMAP.border}`, color: b.fn === toggleFullscreen && fullscreen ? CMAP.sun : CMAP.text, backdropFilter: 'blur(6px)' }}>
                {b.sign}
              </button>
            ))}
          </div>

          {/* Minimap — dark, with bright dots; mastered nodes glow brightest. */}
          {minimapVisible && (
            <div className="absolute bottom-3 right-3 rounded-lg overflow-hidden"
                 style={{ width: 96, height: 96, background: CMAP.bgEdge, border: `1px solid ${CMAP.border}` }}
                 aria-hidden="true">
              <svg viewBox={`0 0 ${KMAP_VIEW} ${KMAP_VIEW}`} width="100%" height="100%">
                {layout.nodes.filter(n => n.kind !== 'sub').map(n => {
                  const isRoot = n.kind === 'root';
                  const isBonus = n.kind === 'bonus';
                  const mastered = !isRoot && !isBonus && n.data && n.data.state === 'mastered';
                  const fill = isRoot ? CMAP.sun : isBonus ? KMAP_BONUS_COLOR : (n.data ? n.data.color : CMAP.muted);
                  const op = isRoot ? 1 : mastered ? 1 : (n.data && mindmapStateRank(n.data.state) >= 1 ? 0.8 : 0.32);
                  return <circle key={n.id} cx={n.x} cy={n.y} r={isRoot ? 42 : mastered ? 34 : 26} fill={fill} opacity={op} />;
                })}
                <rect x={-view.x / view.k} y={-view.y / view.k}
                      width={KMAP_VIEW / view.k} height={KMAP_VIEW / view.k}
                      fill="none" stroke={CMAP.sun} strokeWidth={10} />
              </svg>
            </div>
          )}

          {/* #13 — first-time cinematic welcome (deferred #15 banner). Shows once
              ever, after the camera pulls back to the galaxy. Dismissible. */}
          {intro === 'banner' && (
            <div className="absolute inset-0 z-30 flex items-end justify-center p-4 kmap-scrim-in"
                 style={{ background: 'radial-gradient(ellipse at center, rgba(10,14,28,0.35), rgba(7,10,20,0.78))' }}
                 onClick={() => setIntro(null)}>
              <div className="w-full max-w-xs rounded-2xl p-5 mb-4 text-center kmap-sheet-up"
                   style={{ background: CMAP.panel, border: `1px solid ${CMAP.border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
                   onClick={(e) => e.stopPropagation()}>
                <div className="text-2xl mb-1">{'\u2728'}</div>
                <div className="font-display text-xl font-semibold mb-1" style={{ color: CMAP.text }}>
                  Your universe to conquer
                </div>
                <div className="text-[13px] leading-relaxed mb-4" style={{ color: CMAP.muted }}>
                  Every topic is a star. Practise to light them up — from a first faint
                  discovery to a fully mastered, crowned constellation.
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIntro(null)}
                          className="no-tap-highlight flex-1 py-2.5 rounded-xl text-sm font-medium active:scale-95"
                          style={{ background: 'rgba(255,255,255,0.08)', color: CMAP.text, border: `1px solid ${CMAP.border}` }}>
                    Got it
                  </button>
                  <button onClick={() => setIntro(null)}
                          className="no-tap-highlight flex-1 py-2.5 rounded-xl text-sm font-semibold active:scale-95"
                          style={{ background: T.primary, color: '#fff' }}>
                    Start Exploring
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-[11px] mt-2 text-center" style={{ color: T.muted }}>
          Drag to pan {'\u00b7'} pinch or scroll to zoom {'\u00b7'} tap a star for details {'\u00b7'} double-tap to focus
        </div>
      </div>

      {/* Tap popup — a focus-trapped dialog (A9 pattern). */}
      {selected && (
        <MindmapNodePopup node={selected}
                          onClose={() => setSelected(null)}
                          onPracticeTopic={onPracticeTopic}
                          onPracticeSub={onPracticeSub}
                          explorerEarned={selected.kind === 'bonus' && explorerBadges.indexOf(selected.id) !== -1}
                          onExplore={earnExplorer}
                          note={selected.kind !== 'bonus' ? notes[selected.id] : null}
                          onEditNote={selected.kind !== 'bonus' ? (() => openNoteEditor(selected)) : null} />
      )}

      {/* P11 Feature C — note editor (long-press / right-click, or "Edit note"
          from the tap popup). Saves to the local notes blob (shared:false). */}
      {noteEditor && (
        <MindmapNoteEditor node={noteEditor}
                           initialText={noteTextFor(noteEditor.id)}
                           onSave={(text) => { saveNote(noteEditor.id, text); setNoteEditor(null); }}
                           onDelete={() => { deleteNote(noteEditor.id); setNoteEditor(null); }}
                           onClose={() => setNoteEditor(null)} />
      )}
    </div>
  );
}

export default KnowledgeMap;
