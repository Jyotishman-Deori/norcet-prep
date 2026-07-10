// =====================================================================
// src/lib/quotes.js — Home-screen motivational quotes (Feature 5)
// Curated for SELF-DISCIPLINE and SELF-FOCUS: mastering your own mind,
// consistency, effort, and doing the work that's in your control. Drawn
// entirely from PUBLIC-DOMAIN sources (Stoics, Tao Te Ching, Dhammapada,
// classical philosophers, Poor Richard's Almanack, Walden, Invictus …) so
// there are no licensing concerns. getNextQuote() cycles the full set
// without repeats, then reshuffles; the shown-index state persists per
// device via safeStorage. Pure + storage only.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS } from './keys.js';
import { cpackKey, normalizePack, mergeQuotes } from './content-packs.js';

export const QUOTES = [
  // Marcus Aurelius — Meditations
  { text: "You have power over your mind, not outside events. Realize this, and you will find strength.", source: "Marcus Aurelius, Meditations" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", source: "Marcus Aurelius, Meditations" },
  { text: "Waste no more time arguing what a good person should be. Be one.", source: "Marcus Aurelius, Meditations" },
  { text: "Confine yourself to the present.", source: "Marcus Aurelius, Meditations" },
  { text: "The happiness of your life depends upon the quality of your thoughts.", source: "Marcus Aurelius, Meditations" },
  { text: "Look within. Within is the fountain of good, and it will ever bubble up, if thou wilt ever dig.", source: "Marcus Aurelius, Meditations" },
  { text: "If it is not right, do not do it; if it is not true, do not say it.", source: "Marcus Aurelius, Meditations" },
  { text: "Never let the future disturb you. You will meet it with the same reason which today arms you against the present.", source: "Marcus Aurelius, Meditations" },

  // Seneca
  { text: "It is not that we have a short time to live, but that we waste much of it.", source: "Seneca, On the Shortness of Life" },
  { text: "We suffer more often in imagination than in reality.", source: "Seneca, Letters" },
  { text: "Difficulties strengthen the mind, as labour does the body.", source: "Seneca" },
  { text: "While we wait for life, life passes.", source: "Seneca, Letters" },
  { text: "Most powerful is he who has himself in his own power.", source: "Seneca" },
  { text: "Begin at once to live, and count each separate day as a separate life.", source: "Seneca, Letters" },
  { text: "As long as you live, keep learning how to live.", source: "Seneca" },

  // Epictetus
  { text: "No man is free who is not master of himself.", source: "Epictetus" },
  { text: "First say to yourself what you would be; and then do what you have to do.", source: "Epictetus, Discourses" },
  { text: "Make the best use of what is in your power, and take the rest as it happens.", source: "Epictetus, Enchiridion" },
  { text: "It is not what happens to you, but how you react to it that matters.", source: "Epictetus" },
  { text: "No great thing is created suddenly, any more than a bunch of grapes or a fig.", source: "Epictetus, Discourses" },

  // Lao Tzu — Tao Te Ching
  { text: "A journey of a thousand miles begins with a single step.", source: "Lao Tzu, Tao Te Ching" },
  { text: "Mastering others is strength. Mastering yourself is true power.", source: "Lao Tzu, Tao Te Ching" },
  { text: "When you are content to be simply yourself and don't compare or compete, everyone will respect you.", source: "Lao Tzu, Tao Te Ching" },
  { text: "He who knows that enough is enough will always have enough.", source: "Lao Tzu, Tao Te Ching" },

  // Confucius
  { text: "It does not matter how slowly you go as long as you do not stop.", source: "Confucius" },
  { text: "The man who moves a mountain begins by carrying away small stones.", source: "Confucius" },
  { text: "He who conquers himself is the mightiest warrior.", source: "Confucius" },
  { text: "Our greatest glory is not in never falling, but in rising every time we fall.", source: "Confucius" },

  // Buddha — Dhammapada
  { text: "It is better to conquer yourself than to win a thousand battles.", source: "Buddha, Dhammapada" },
  { text: "No one saves us but ourselves. No one can and no one may. We ourselves must walk the path.", source: "Buddha, Dhammapada" },
  { text: "Drop by drop is the water pot filled; little by little the wise fill themselves with good.", source: "Buddha, Dhammapada" },

  // Aristotle
  { text: "We are what we repeatedly do. Excellence, then, is not an act but a habit.", source: "Aristotle" },
  { text: "Knowing yourself is the beginning of all wisdom.", source: "Aristotle" },

  // Benjamin Franklin — Poor Richard's Almanack
  { text: "Lost time is never found again.", source: "Benjamin Franklin" },
  { text: "Energy and persistence conquer all things.", source: "Benjamin Franklin" },
  { text: "By failing to prepare, you are preparing to fail.", source: "Benjamin Franklin" },
  { text: "Diligence is the mother of good luck.", source: "Benjamin Franklin" },
  { text: "An investment in knowledge pays the best interest.", source: "Benjamin Franklin" },
  { text: "Little strokes fell great oaks.", source: "Benjamin Franklin" },
  { text: "Well done is better than well said.", source: "Benjamin Franklin" },

  // Theodore Roosevelt
  { text: "Believe you can and you're halfway there.", source: "Theodore Roosevelt" },
  { text: "Do what you can, with what you have, where you are.", source: "Theodore Roosevelt" },

  // Ralph Waldo Emerson
  { text: "The only person you are destined to become is the person you decide to be.", source: "Ralph Waldo Emerson" },
  { text: "What lies within us is greater than what lies behind us or before us.", source: "Ralph Waldo Emerson" },
  { text: "Finish each day and be done with it. You have done what you could.", source: "Ralph Waldo Emerson" },

  // Henry David Thoreau
  { text: "Go confidently in the direction of your dreams. Live the life you have imagined.", source: "Henry David Thoreau" },
  { text: "It is not enough to be busy; the question is, what are we busy about?", source: "Henry David Thoreau" },

  // William Ernest Henley — Invictus
  { text: "I am the master of my fate, I am the captain of my soul.", source: "William Ernest Henley, Invictus" },
];

// Admin-authored extra quotes (cpack:quotes), merged OVER the bundled base.
// Loaded lazily on first getNextQuote and refreshed in the background so the
// list keeps growing without a code deploy. The sync-ish API is preserved:
// the first call may still use base only; subsequent calls include the pack.
let _quotes = QUOTES;
let _packLoaded = false;
async function loadQuotePack() {
  if (_packLoaded) return;
  _packLoaded = true;
  try {
    const r = await safeStorage.get(cpackKey('quotes'), true);   // shared read
    let raw = r && r.value ? r.value : null;
    if (raw) { try { await safeStorage.set('cpackcache:quotes', raw, false); } catch (e) {} }
    else {
      const m = await safeStorage.get('cpackcache:quotes', false);
      raw = m && m.value ? m.value : null;
    }
    if (raw) {
      const pack = normalizePack(JSON.parse(raw));
      if (pack && Array.isArray(pack.items) && pack.items.length) _quotes = mergeQuotes(QUOTES, pack.items);
    }
  } catch (e) { /* base only */ }
}

// Pick the next unseen quote; reset the cycle once every quote has shown.
export async function getNextQuote() {
  loadQuotePack();   // fire-and-forget; applies from the next call once resolved
  const list = _quotes;
  let shown = [];
  try {
    const r = await safeStorage.get(KEYS.QUOTES_SHOWN);
    if (r && r.value) shown = JSON.parse(r.value);
  } catch (e) {}

  if (!Array.isArray(shown) || shown.length >= list.length) shown = [];

  const available = list.map((_, i) => i).filter(i => !shown.includes(i));
  const pool = available.length ? available : list.map((_, i) => i);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  shown.push(pick);

  try { await safeStorage.set(KEYS.QUOTES_SHOWN, JSON.stringify(shown)); } catch (e) {}
  return list[pick];
}
