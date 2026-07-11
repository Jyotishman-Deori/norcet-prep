// =====================================================================
// src/screens/assistant.jsx — "Ask {companion}": the in-app FAQ chat.
//
// A rule-based guide (ZERO runtime AI, hard rule) over the pre-authored
// knowledge base in src/data/assistant-kb.js, matched by lib/assistant.js.
// The bot IS the existing study companion (note-companion identity): same
// user-chosen name, now with a chat surface. Feels alive through a typing
// indicator, staggered bubble pops and mood reactions on the avatar, all
// reduced-motion safe. Every answer carries follow-up chips ("people also
// ask"), an optional deep link into the app, and the HelpfulBulb; a
// thumbs-down or a stumped bot escalates to Report / FAQ community.
//
// KB grows without deploys: cpack:assistant (Content Studio) merges over
// the bundled base at load, offline-mirrored like every other pack.
// =====================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, RotateCcw, Send, Sparkles, MessageCircleQuestion, Flag } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { TopBar, requestFeedback } from '../ui/primitives.jsx';
import HelpfulBulb from '../ui/helpful-bulb.jsx';
import { ASSISTANT_KB, QUICK_STARTS } from '../data/assistant-kb.js';
import { replyFor, notHelpfulReply, kbById } from '../lib/assistant.js';
import { mergeAssistant, normalizePack } from '../lib/content-packs.js';
import { readPack } from '../lib/content.js';
import { loadCompanionName } from '../lib/notes-store.js';
import { sanitizeName } from '../lib/note-companion.js';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { prefersReducedMotion } from '../lib/juice.js';
import { GUEST_ID, isGuestProfile } from '../lib/profiles.js';

const MAX_TURNS = 40;      // persisted transcript cap
const INPUT_MAX = 200;

let msgSeq = 0;
const mid = () => `m${Date.now().toString(36)}${(msgSeq++).toString(36)}`;

// Mood -> avatar reaction class (all registered reduced-motion safe).
const MOOD_CLASS = { happy: 'asst-heart', concerned: 'asst-tilt', warm: 'asst-glow' };

function Avatar({ T, mood, animKey }) {
  return (
    <div key={animKey} className={'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ' + (MOOD_CLASS[mood] || '')}
         style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.primary}B3)`, boxShadow: `0 2px 8px ${T.primary}45` }}>
      <Sparkles size={14} color="#FFF" />
    </div>
  );
}

function AssistantScreen({ onBack, onNavigate }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const profileId = (profile && profile.id) || GUEST_ID;
  const isGuest = !profile || isGuestProfile(profile);
  const userFirst = ((profile && profile.displayName) || '').trim().split(/\s+/)[0] || '';

  const [name, setName] = useState('Nova');
  const [kb, setKb] = useState(ASSISTANT_KB);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const ctxRef = useRef(null);          // last matched entry context (follow-ups)
  const votedRef = useRef(new Set());   // message ids that already got the sorry follow-up
  const endRef = useRef(null);
  const timerRef = useRef(null);
  const reduced = prefersReducedMotion();

  // Companion identity + the admin-growable KB pack + saved transcript.
  useEffect(() => {
    let alive = true;
    loadCompanionName(profileId).then(n => { if (alive && sanitizeName(n)) setName(sanitizeName(n)); }).catch(() => {});
    readPack('assistant')
      .then(raw => {
        const pack = normalizePack(raw);
        if (alive && pack && pack.items.length) setKb(mergeAssistant(ASSISTANT_KB, pack.items));
      })
      .catch(() => {});
    safeStorage.get(KEYS.assistantChat(profileId), false)
      .then(r => {
        if (!alive) return;
        try {
          const arr = r && r.value ? JSON.parse(r.value) : [];
          if (Array.isArray(arr) && arr.length) {
            setMessages(arr);
            const lastAnswer = [...arr].reverse().find(m => m.who === 'bot' && m.entryId);
            if (lastAnswer) {
              const e = kbById(ASSISTANT_KB, lastAnswer.entryId);
              if (e) ctxRef.current = { id: e.id, cat: e.cat, related: e.related || [] };
            }
          }
        } catch (e) {}
        setHydrated(true);
      })
      .catch(() => { if (alive) setHydrated(true); });
    return () => { alive = false; if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // Persist the transcript (local only, capped).
  useEffect(() => {
    if (!hydrated) return;
    try { safeStorage.set(KEYS.assistantChat(profileId), JSON.stringify(messages.slice(-MAX_TURNS)), false); } catch (e) {}
  }, [messages, hydrated, profileId]);

  // Pin the view to the newest turn.
  useEffect(() => {
    if (endRef.current) {
      try { endRef.current.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'end' }); } catch (e) {}
    }
  }, [messages, typing, reduced]);

  const quickChips = useMemo(
    () => QUICK_STARTS.map(id => kbById(kb, id)).filter(Boolean),
    [kb]
  );

  const send = (raw) => {
    const text = String(raw || '').trim().slice(0, INPUT_MAX);
    if (!text || typing) return;
    setInput('');
    setMessages(prev => [...prev, { id: mid(), who: 'user', text }]);
    setTyping(true);
    const delay = reduced ? 120 : 480 + Math.floor(Math.random() * 280);
    timerRef.current = setTimeout(() => {
      const turn = replyFor(kb, text, ctxRef.current, { companionName: name, userName: userFirst });
      if (turn.ctx) ctxRef.current = turn.ctx;
      setMessages(prev => [...prev, { id: mid(), who: 'bot', ...turn }]);
      setTyping(false);
    }, delay);
  };

  // Thumbs-down on an answer -> one concerned follow-up with escape hatches.
  const onBulbVote = (msgId) => (next) => {
    if (next !== 'notHelpful' || votedRef.current.has(msgId)) return;
    votedRef.current.add(msgId);
    setMessages(prev => [...prev, { id: mid(), who: 'bot', ...notHelpfulReply({ companionName: name }) }]);
  };

  const startOver = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTyping(false);
    setMessages([]);
    ctxRef.current = null;
    votedRef.current = new Set();
  };

  const escalateRow = (
    <div className="flex flex-wrap gap-2 mt-2">
      <button onClick={() => requestFeedback({ screen: 'Assistant' })}
              className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold active:scale-95 transition"
              style={{ background: T.accent + '14', color: T.accent, border: `1px solid ${T.accent}40` }}>
        <Flag size={11} /> Report this
      </button>
      <button onClick={() => onNavigate && onNavigate({ screen: 'faq' })}
              className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold active:scale-95 transition"
              style={{ background: T.primary + '12', color: T.primary, border: `1px solid ${T.primary}40` }}>
        <MessageCircleQuestion size={11} /> Ask the community
      </button>
    </div>
  );

  return (
    <div className="anim-fadeup">
      <TopBar title={`Ask ${name}`} onBack={onBack} feedback={{ screen: 'Assistant' }} solid
              right={messages.length > 0 ? (
                <button onClick={startOver} aria-label="Start over"
                        className="no-tap-highlight tbar-btn flex items-center gap-1.5 h-9 px-3 rounded-full flex-shrink-0"
                        style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                  <RotateCcw size={14} style={{ color: T.muted }} />
                  <span className="text-xs font-medium">Start over</span>
                </button>
              ) : null} />

      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-3 pb-40">
        {/* Intro — always at the top of the thread */}
        <div className="asst-pop flex items-start gap-2.5 mb-4">
          <Avatar T={T} mood="warm" animKey="intro" />
          <div className="min-w-0">
            <div className="rounded-2xl rounded-tl-sm px-3.5 py-3 text-sm leading-relaxed inline-block"
                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }}>
              {`Hey${userFirst ? ' ' + userFirst : ''}! I am ${name}, your guide to everything NurseHolic. Tests, streaks, syncing, games, ask me anything about how the app works.`}
              <span className="block mt-1.5 text-[11px]" style={{ color: T.muted }}>
                For medical questions or wrong-answer reports I will point you to the right humans.
              </span>
            </div>
          </div>
        </div>

        {/* Quick starts on a fresh chat */}
        {messages.length === 0 && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 px-1" style={{ color: T.muted }}>
              Popular questions
            </div>
            <div className="flex flex-wrap gap-2">
              {quickChips.map((e, i) => (
                <button key={e.id} onClick={() => send(e.q)}
                        className="asst-pop no-tap-highlight px-3 py-2 rounded-2xl text-[12.5px] font-medium text-left active:scale-95 transition"
                        style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft, animationDelay: `${i * 55}ms` }}>
                  {e.q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* The conversation */}
        <div className="space-y-3">
          {messages.map((m) => m.who === 'user' ? (
            <div key={m.id} className="asst-pop flex justify-end">
              <div className="rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%]"
                   style={{ background: T.primary, color: '#FFF', boxShadow: `0 3px 10px ${T.primary}35` }}>
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="asst-pop flex items-start gap-2.5">
              <Avatar T={T} mood={m.mood} animKey={m.id} />
              <div className="min-w-0 max-w-[85%]">
                <div className="rounded-2xl rounded-tl-sm px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                     style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }}>
                  {m.text}
                </div>

                {/* Deep link into the app */}
                {m.route && (
                  <button onClick={() => onNavigate && onNavigate(m.route)}
                          className="no-tap-highlight mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold active:scale-95 transition"
                          style={{ background: T.primary, color: '#FFF', boxShadow: `0 3px 10px ${T.primary}40` }}>
                    {m.routeLabel || 'Take me there'} <ArrowRight size={13} />
                  </button>
                )}

                {/* Escape hatches when the bot is unsure or the user is unhappy */}
                {m.escalate && escalateRow}

                {/* Follow-up chips */}
                {m.followups && m.followups.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 px-0.5" style={{ color: T.muted }}>
                      {m.kind === 'noMatch' ? 'Closest matches' : 'People also ask'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.followups.map(f => (
                        <button key={f.id} onClick={() => send(f.q)}
                                className="no-tap-highlight px-2.5 py-1.5 rounded-full text-[11.5px] font-medium active:scale-95 transition"
                                style={{ background: T.primary + '0E', color: T.primary, border: `1px solid ${T.primary}30` }}>
                          {f.q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback bulb on real answers */}
                {m.kind === 'answer' && m.entryId && (
                  <div className="mt-2.5">
                    <HelpfulBulb voteId={`assistant:${m.entryId}`} profileId={isGuest ? null : profileId}
                                 compact onVote={onBulbVote(m.id)} />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div className="asst-pop flex items-start gap-2.5">
              <Avatar T={T} mood="neutral" animKey="typing" />
              <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 inline-flex items-center gap-1.5"
                   style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                {[0, 1, 2].map(i => (
                  <span key={i} className="asst-dot w-1.5 h-1.5 rounded-full"
                        style={{ background: T.muted, animationDelay: `${i * 160}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>
        <div ref={endRef} />
      </div>

      {/* Composer — fixed, width-matched to the content column */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md md:max-w-3xl mx-auto md:px-6 lg:px-8 flex items-center gap-2">
          <input value={input} onChange={e => setInput(e.target.value.slice(0, INPUT_MAX))}
                 onKeyDown={e => { if (e.key === 'Enter') send(input); }}
                 placeholder={`Ask ${name} about the app...`}
                 aria-label="Ask a question"
                 className="flex-1 rounded-2xl px-4 py-3 text-sm"
                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
          <button onClick={() => send(input)} disabled={!input.trim() || typing} aria-label="Send"
                  className="no-tap-highlight w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 active:scale-90 transition disabled:opacity-40"
                  style={{ background: T.primary, color: '#FFF', boxShadow: `0 4px 14px ${T.primary}45` }}>
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AssistantScreen;
