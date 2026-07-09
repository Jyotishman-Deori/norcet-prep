// =====================================================================
// src/screens/mindmap-node-popup.jsx — knowledge-map node HUD (A1 slice 33)
// #13 game HUD over the dark constellation map (the map stays partly visible
// behind). Header with state badge, a 4-segment progress JOURNEY track, a
// clean HUD stats row, a mentor-voiced next-milestone challenge, a top-right
// note icon, and a big "Practice — [Topic]" CTA. Mechanics/props unchanged.
// Map-revamp: the bottom sheet became a CENTRED fixed-size KmapDialog
// (portaled, dvh-clamped) — same shell on every device, never cut off.
// =====================================================================
import React from 'react';
import { Brain, Check, Edit3, X, StickyNote } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFgOnDark } from '../lib/theme-helpers.js';
import { requestConfirm } from '../ui/primitives.jsx';
import KmapDialog from '../ui/kmap-dialog.jsx';
import { topicIcon, topicName } from '../lib/topics.js';
import { relativeTimeShort } from '../lib/utils.js';
import { KMAP_BONUS_COLOR, KMAP_STATE_LABEL, KMAP_STATES, mindmapStateRank } from '../lib/kmap.js';

// Dark HUD palette (mirrors the map's CMAP).
const HUD = {
  surface: '#121A2E',
  border: 'rgba(255,255,255,0.14)',
  text: '#EAF0FF',
  muted: 'rgba(234,240,255,0.58)',
  faint: 'rgba(234,240,255,0.32)',
  gold: '#FFD27A',
  cool: '#7FB4FF',
};

// State tone for badge + journey dots. Familiar takes the subject's own colour.
function stateTone(state, color) {
  switch (state) {
    case 'mastered':   return { bg: 'rgba(255,210,122,0.18)', fg: HUD.gold, dot: HUD.gold };
    case 'familiar':   return { bg: color + '33', fg: color, dot: color };
    case 'discovered': return { bg: 'rgba(127,180,255,0.18)', fg: HUD.cool, dot: HUD.cool };
    default:           return { bg: 'rgba(255,255,255,0.06)', fg: HUD.faint, dot: 'rgba(255,255,255,0.3)' };
  }
}

// Mentor-voiced next-milestone line (encouraging, forward-looking).
function mentorChallenge(state, attempted, accuracy, name) {
  const a = Number(attempted) || 0;
  const acc = Number(accuracy) || 0;
  if (state === 'mastered') return 'Mastered. This territory is yours, planted flag and all.';
  if (state === 'familiar') {
    const need = Math.max(0, 25 - a);
    return acc >= 0.80
      ? `${need} more strong attempt${need === 1 ? '' : 's'} and Mastered is yours. You're so close.`
      : 'Push your accuracy past 80% and Mastered comes into reach. Keep at it.';
  }
  if (state === 'discovered') {
    const need = Math.max(0, 10 - a);
    return acc >= 0.60
      ? `${need} more at 60%+ and Familiar is yours. You're close.`
      : 'Lift your accuracy past 60% and Familiar opens up. You\u2019ve got this.';
  }
  return `Answer one question to light up ${name} on your map.`;
}

function MindmapNodePopup({ node, onClose, onPracticeTopic, onPracticeSub, explorerEarned = false, onExplore, note = null, onEditNote = null }) {
  const { theme: T } = useTheme();
  const fgOnDark = useFgOnDark();

  // Centred fixed-size shell (portal + focus trap live in KmapDialog).
  const Sheet = ({ children, label }) => (
    <KmapDialog label={label} onClose={onClose}>{children}</KmapDialog>
  );

  // ---- Bonus "beyond syllabus" node ----------------------------------
  if (node.kind === 'bonus') {
    const b = node.data;
    const markExplored = () => { if (onExplore) onExplore(b.id); onClose(); };
    return (
      <Sheet label={`${b.name}: bonus topic`}>
        <div className="px-5 py-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span style={{ fontSize: 24, color: KMAP_BONUS_COLOR }}>{explorerEarned ? '\u2605' : '\u2727'}</span>
              <div className="min-w-0">
                <div className="font-display text-xl font-semibold leading-tight" style={{ color: HUD.text }}>{b.name}</div>
                <div className="text-xs mt-0.5" style={{ color: KMAP_BONUS_COLOR }}>Beyond syllabus {'\u00b7'} bonus star</div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close"
                    className="no-tap-highlight p-2 -m-1 rounded-full active:bg-white/10" style={{ color: HUD.muted }}>
              <X size={18} />
            </button>
          </div>
          <div className="text-sm leading-relaxed mb-4" style={{ color: HUD.muted }}>
            Extra-credit material beyond the core NORCET syllabus. It doesn\u2019t count toward your coverage, it\u2019s here to stretch you once you\u2019ve mastered the basics.
          </div>
          {explorerEarned ? (
            <div className="text-sm font-medium flex items-center gap-1.5 px-3 py-3 rounded-xl"
                 style={{ background: KMAP_BONUS_COLOR + '1A', color: KMAP_BONUS_COLOR }}>
              <Check size={16} /> Explorer badge earned
            </div>
          ) : (
            <button onClick={markExplored}
                    className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 font-semibold rounded-2xl px-5 py-4 text-base active:scale-95"
                    style={{ background: KMAP_BONUS_COLOR, color: '#1a1205' }}>
              Mark as explored
            </button>
          )}
        </div>
      </Sheet>
    );
  }

  // ---- Topic / subtopic node -----------------------------------------
  const isSub = node.kind === 'sub';
  const d = node.data;
  const color = isSub ? node.color : d.color;
  const name = isSub ? d.sub : d.name;
  const state = d.state;
  const accPct = d.attempted > 0 ? Math.round(d.accuracy * 100) : null;
  const tone = stateTone(state, fgOnDark(color));
  const rank = mindmapStateRank(state);

  const ptName = name.length > 22 ? name.slice(0, 21) + '\u2026' : name;
  // Owner spec: never throw the user straight into a test — confirm first.
  // The app-root ConfirmDialog portals AFTER this open KmapDialog, so it
  // stacks on top; Esc/cancel returns to this intact popup. The
  // "10-question" copy mirrors count:10 in App.jsx's startQuiz wiring.
  const practice = () => {
    requestConfirm({
      icon: <Brain size={20} style={{ color: T.primary }} />,
      title: `Start practice: ${ptName}?`,
      body: `This begins a 10-question practice test on ${name}. Your answers count toward this star's progress.`,
      confirmLabel: 'Start test', cancelLabel: 'Not now', tone: 'primary',
      onConfirm: () => {
        if (isSub) { if (onPracticeSub) onPracticeSub(node.parent, d.sub); }
        else if (onPracticeTopic) onPracticeTopic(node.id);
        onClose();
      },
    });
  };

  return (
    <Sheet label={`${name} details`}>
      <div className="px-5 py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {!isSub && <span style={{ fontSize: 26 }}>{topicIcon(node.id)}</span>}
            <div className="min-w-0">
              <div className="font-display text-xl font-semibold leading-tight" style={{ color: HUD.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{name}</div>
              <div className="text-xs mt-0.5 truncate" style={{ color: HUD.muted }}>
                {isSub ? topicName(node.parent) : 'Subject'}
                <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: tone.bg, color: tone.fg }}>
                  {state === 'mastered' && <span>{'\u2605'}</span>}{KMAP_STATE_LABEL[state]}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEditNote && (
              <button onClick={onEditNote} aria-label={note && note.text ? 'Edit note' : 'Add a note'}
                      title={note && note.text ? 'Edit note' : 'Add a note'}
                      className="no-tap-highlight p-2 rounded-full active:bg-white/10 relative"
                      style={{ color: note && note.text ? HUD.gold : HUD.muted }}>
                <StickyNote size={17} />
                {note && note.text && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: HUD.gold }} />}
              </button>
            )}
            <button onClick={onClose} aria-label="Close"
                    className="no-tap-highlight p-2 rounded-full active:bg-white/10" style={{ color: HUD.muted }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress journey track — Locked → Discovered → Familiar → Mastered */}
        <div className="flex gap-1.5 mb-1.5">
          {KMAP_STATES.map((st, i) => {
            const done = i <= rank;
            const cur = i === rank;
            const t = stateTone(st, fgOnDark(color));
            return (
              <div key={st} className="flex-1 rounded-full"
                   style={{ height: cur ? 6 : 4, alignSelf: 'center',
                            background: done ? t.dot : 'rgba(255,255,255,0.10)',
                            boxShadow: cur ? `0 0 8px ${t.dot}` : 'none',
                            transition: 'all 200ms ease' }} />
            );
          })}
        </div>
        <div className="flex gap-1.5 mb-4">
          {KMAP_STATES.map((st, i) => (
            <div key={st} className="flex-1 text-center text-[9px] font-medium uppercase tracking-wide"
                 style={{ color: i === rank ? stateTone(st, fgOnDark(color)).fg : HUD.faint }}>
              {KMAP_STATE_LABEL[st]}
            </div>
          ))}
        </div>

        {/* HUD stats row */}
        <div className="flex items-stretch gap-3 mb-4">
          <div className="rounded-2xl px-4 py-3 flex-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="font-display text-3xl font-semibold leading-none tabular-nums"
                 style={{ color: accPct == null ? HUD.faint : tone.fg }}>
              {accPct == null ? '—' : `${accPct}%`}
            </div>
            <div className="text-[10px] mt-1 uppercase tracking-wide" style={{ color: HUD.muted }}>Accuracy</div>
          </div>
          <div className="rounded-2xl px-4 py-3 flex-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="font-display text-3xl font-semibold leading-none tabular-nums" style={{ color: HUD.text }}>
              {d.attempted}
            </div>
            <div className="text-[10px] mt-1 uppercase tracking-wide" style={{ color: HUD.muted }}>Attempts</div>
          </div>
          <div className="rounded-2xl px-4 py-3 flex-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="font-display text-3xl font-semibold leading-none tabular-nums" style={{ color: HUD.text }}>
              {d.uniqueAnswered}<span className="text-base" style={{ color: HUD.faint }}>/{d.total}</span>
            </div>
            <div className="text-[10px] mt-1 uppercase tracking-wide" style={{ color: HUD.muted }}>Seen</div>
          </div>
        </div>

        {/* Mentor challenge */}
        <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: tone.bg, border: `1px solid ${tone.fg}33` }}>
          <div className="text-sm leading-relaxed" style={{ color: HUD.text }}>
            {mentorChallenge(state, d.attempted, d.accuracy, name)}
          </div>
        </div>

        {/* Existing note (read-only preview; edit via the top-right icon) */}
        {note && note.text && (
          <div className="rounded-2xl p-3 mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${HUD.border}` }}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-semibold flex items-center gap-1" style={{ color: HUD.muted }}>
                <span aria-hidden="true">{'\uD83D\uDCCC'}</span> Your note
              </span>
              {onEditNote && (
                <button onClick={onEditNote}
                        className="no-tap-highlight text-[11px] font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md active:scale-95"
                        style={{ color: HUD.gold }}>
                  <Edit3 size={12} /> Edit
                </button>
              )}
            </div>
            <div className="text-sm whitespace-pre-wrap break-words" style={{ color: HUD.text }}>{note.text}</div>
            {note.updatedAt ? (
              <div className="text-[10px] mt-1.5" style={{ color: HUD.faint }}>Updated {relativeTimeShort(note.updatedAt)}</div>
            ) : null}
          </div>
        )}

        {/* Primary CTA — "enter the level" */}
        <button onClick={practice}
                className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 font-semibold rounded-2xl px-5 py-4 text-base active:scale-[0.98] transition"
                style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.primarySoft})`, color: '#fff', boxShadow: `0 8px 22px ${T.primary}55` }}>
          <Brain size={18} /> Practice: {ptName}
        </button>
      </div>
    </Sheet>
  );
}

export default MindmapNodePopup;
