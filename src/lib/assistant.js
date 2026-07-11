// =====================================================================
// src/lib/assistant.js — the Ask-companion conversation engine.
//
// PURE, deterministic, zero-AI (hard rule: no runtime model calls). Turns a
// free-text user message into a bot turn by (1) detecting small-talk /
// emotional intents from word lists, (2) scoring the message against the
// pre-authored knowledge base (keyword-weighted, AND-leaning, NO fuzzy per
// the search.js stance), with a context boost from the previously matched
// entry so short follow-ups ("and in mocks?") stay on topic.
//
// All randomness is injected (pick) so Node tests assert exact flows.
// =====================================================================

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'am', 'do', 'does', 'did', 'i', 'my', 'me',
  'to', 'of', 'in', 'on', 'it', 'its', 'for', 'and', 'or', 'be', 'was',
  'this', 'that', 'there', 'with', 'about', 'please', 'tell', 'know',
]);

export function tokenize(q) {
  const out = [];
  const seen = new Set();
  String(q || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).forEach((w) => {
    if (!w || STOPWORDS.has(w) || seen.has(w)) return;
    seen.add(w);
    out.push(w);
  });
  return out;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// ---- intents ---------------------------------------------------------
// Phrase lists checked against the normalized message. Order = priority.
const INTENTS = [
  { type: 'thanks', hits: ['thank', 'thanks', 'thx', 'shukriya', 'dhanyavad', 'dhanyawad', 'ty ', ' ty', 'thankyou'] },
  { type: 'praise', hits: ['awesome', 'amazing', 'love this', 'love it', 'love the app', 'great app', 'nice app', 'well done', 'mast', 'badhiya', 'superb', 'perfect', 'best app'] },
  { type: 'frustration', hits: ['not working', 'doesnt work', 'does not work', 'broken', 'useless', 'waste', 'bekar', 'bakwas', 'kharab', 'hate this', 'angry', 'frustrat', 'fed up', 'annoying', 'worst'] },
  { type: 'greeting', hits: ['hello', 'hey', 'namaste', 'good morning', 'good evening', 'good afternoon', 'hii', 'hlo'] },
  { type: 'bye', hits: ['bye', 'goodbye', 'good night', 'see you', 'gtg', 'going now', 'alvida'] },
];
// 'hi' alone is too short for includes() safety; match it as a whole token.
const GREET_TOKENS = new Set(['hi', 'hey', 'yo', 'hola', 'hlo', 'hii']);

export function detectIntent(text) {
  const n = ' ' + norm(text) + ' ';
  for (const it of INTENTS) {
    if (it.hits.some((h) => n.includes(h.trim().length < h.length ? h : ' ' + h + ' ') || n.includes(h))) {
      return it.type;
    }
  }
  const toks = n.trim().split(' ').filter(Boolean);
  if (toks.length <= 2 && toks.some((t) => GREET_TOKENS.has(t))) return 'greeting';
  return null;
}

// ---- knowledge-base matching ----------------------------------------
// Returns { best, score, confidence: 'high'|'medium'|'low', alternates }.
export function matchKb(kb, query, ctx) {
  const tokens = tokenize(query);
  const phrase = norm(query);
  const scored = [];
  for (const e of kb) {
    let score = 0;
    let matched = 0;
    const qNorm = norm(e.q);
    const kws = e.keywords || [];
    const bodyNorm = norm(e.a);
    // Whole-phrase presence in the canonical question is the strongest signal.
    if (phrase.length >= 8 && qNorm.includes(phrase)) score += 10;
    for (const t of tokens) {
      let hit = 0;
      for (const k of kws) {
        if (k === t) { hit = Math.max(hit, 3); break; }
        if (t.length >= 4 && (k.startsWith(t) || (k.length >= 4 && t.startsWith(k)))) hit = Math.max(hit, 2);
        if (k.includes(' ') && k.includes(t)) hit = Math.max(hit, 2);
      }
      if (qNorm.includes(t)) hit = Math.max(hit, 2.5);
      if (!hit && t.length >= 4 && bodyNorm.includes(t)) hit = 1;
      if (hit) { score += hit; matched++; }
    }
    if (matched === 0) continue;
    // AND-leaning: reward covering most of the message, punish stray one-word
    // overlaps on long messages.
    const coverage = matched / Math.max(1, tokens.length);
    score *= (0.45 + 0.55 * coverage);
    // Follow-up context: the previous answer's related entries and its
    // category get a nudge, so "and for mocks?" lands near the last topic.
    if (ctx) {
      if (ctx.related && ctx.related.indexOf(e.id) !== -1) score += 2;
      else if (ctx.cat && e.cat === ctx.cat && e.id !== ctx.id) score += 0.8;
      if (ctx.id === e.id) score -= 1.5; // prefer moving forward, not repeating
    }
    scored.push({ entry: e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || null;
  const score = best ? best.score : 0;
  const confidence = score >= 6 ? 'high' : score >= 3.2 ? 'medium' : 'low';
  return {
    best: best ? best.entry : null,
    score,
    confidence,
    alternates: scored.slice(best && confidence !== 'low' ? 1 : 0, 4).map((s) => s.entry),
  };
}

// ---- reply composition ----------------------------------------------
const pools = {
  greeting: [
    (c, u) => `Hey${u ? ' ' + u : ''}! ${c} here. Ask me anything about the app: tests, streaks, syncing, you name it.`,
    (c, u) => `Hello${u ? ', ' + u : ''}! What can ${c} clear up for you today?`,
    (c) => `Hi! ${c} at your service. What are we figuring out?`,
  ],
  thanks: [
    () => 'Anytime! That is literally what I am here for. Anything else on your mind?',
    () => 'You are most welcome. Now go crush a few questions!',
    (c, u) => `Happy to help${u ? ', ' + u : ''}! Ping me whenever something feels confusing.`,
  ],
  praise: [
    () => 'Aw, that made my day! I will pass it on to the team. Anything I can help with?',
    () => 'So glad you like it! Tell a study buddy about us, and ask me anything anytime.',
  ],
  frustration: [
    () => 'Ugh, that sounds annoying, and I want it fixed. Tell me what is misbehaving in a line or two, or better, tap Report so the team sees exactly where it happened. What is going on?',
    () => 'Sorry it is being difficult! Describe the problem to me, or use the Report button on the screen where it happens, that reaches a real person fast.',
  ],
  bye: [
    (c) => `Bye for now! ${c} will be right here when you are back. Study well!`,
    () => 'See you! May your streak stay unbroken.',
  ],
  noMatch: [
    () => 'Hmm, I do not have a solid answer for that one yet. Here is what I think comes closest, or ask the community and a human will jump in:',
    () => 'That one stumped me, sorry! Maybe one of these is what you meant, or take it to the FAQ community:',
  ],
  notHelpful: [
    () => 'Ah, sorry that missed the mark. Want to tell the team directly, or ask the community? Both really help me get smarter.',
    () => 'Noted, and sorry about that. A quick report tells the team exactly what to improve, or the community can pick it up.',
  ],
};

function pickFrom(pool, pick, companionName, userName) {
  const i = Math.max(0, Math.min(pool.length - 1, pick(pool.length)));
  return pool[i](companionName, userName);
}

// The main turn function. `ctx` = the previously matched KB entry (or null).
// `pick(n)` -> integer in [0, n) — injected randomness.
export function replyFor(kb, query, ctx, { companionName = 'Nova', userName = '', pick = (n) => Math.floor(Math.random() * n) } = {}) {
  const intent = detectIntent(query);
  const match = matchKb(kb, query, ctx);
  const frustrated = intent === 'frustration';

  // Emotional / small-talk messages win when there is no real question in
  // them (short + no strong KB signal).
  const tokens = tokenize(query);
  if (intent && (match.confidence === 'low' || (tokens.length <= 3 && match.confidence !== 'high'))) {
    const mood = intent === 'thanks' || intent === 'praise' ? 'happy'
      : intent === 'frustration' ? 'concerned' : 'warm';
    return {
      kind: 'chitchat', intent, mood,
      text: pickFrom(pools[intent], pick, companionName, userName),
      followups: intent === 'frustration' ? [] : quickFollowups(kb, ctx),
      escalate: intent === 'frustration',
    };
  }

  if (match.best && match.confidence !== 'low') {
    const e = match.best;
    return {
      kind: 'answer', entryId: e.id, mood: frustrated ? 'concerned' : 'neutral',
      text: e.a,
      route: e.route || null, routeLabel: e.routeLabel || null,
      followups: followupsFor(kb, e),
      ctx: { id: e.id, cat: e.cat, related: e.related || [] },
    };
  }

  return {
    kind: 'noMatch', mood: 'concerned',
    text: pickFrom(pools.noMatch, pick, companionName, userName),
    followups: (match.alternates.length ? match.alternates : sample(kb, 3, pick)).slice(0, 3).map((e) => ({ id: e.id, q: e.q })),
    escalate: true,
  };
}

// The concerned follow-up after a "not helpful" bulb vote.
export function notHelpfulReply({ companionName = 'Nova', pick = (n) => Math.floor(Math.random() * n) } = {}) {
  return {
    kind: 'chitchat', intent: 'notHelpful', mood: 'concerned',
    text: pickFrom(pools.notHelpful, pick, companionName, ''),
    followups: [], escalate: true,
  };
}

export function followupsFor(kb, entry) {
  const ids = entry.related || [];
  const out = [];
  for (const id of ids) {
    const e = kb.find((x) => x.id === id);
    if (e) out.push({ id: e.id, q: e.q });
    if (out.length >= 3) break;
  }
  return out;
}

function quickFollowups(kb, ctx) {
  if (ctx && ctx.related && ctx.related.length) {
    return ctx.related.slice(0, 3)
      .map((id) => kb.find((x) => x.id === id))
      .filter(Boolean)
      .map((e) => ({ id: e.id, q: e.q }));
  }
  return [];
}

function sample(kb, n, pick) {
  const copy = kb.slice();
  const out = [];
  while (copy.length && out.length < n) out.push(copy.splice(pick(copy.length), 1)[0]);
  return out;
}

export function kbById(kb, id) {
  return kb.find((e) => e.id === id) || null;
}
