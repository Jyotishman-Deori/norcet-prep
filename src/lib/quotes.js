// =====================================================================
// src/lib/quotes.js — Session 2, Feature 5
// Curated motivational quotes (Gita · Mahabharata · Ramayana · Bible ·
// Quran/Hadith) shown on the Home screen, one per visit. getNextQuote()
// cycles the full set without repeats, then reshuffles. Selection state
// (shown indices) persists per-device via safeStorage. Pure + storage only.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS } from './keys.js';

export const QUOTES = [
  // Bhagavad Gita
  { text: "You have the right to perform your actions, but you are not entitled to the fruits of your actions. Never let the fruit of action be your motive, nor let your attachment be to inaction.", source: "Bhagavad Gita 2.47" },
  { text: "For one who has conquered the mind, the mind is the best of friends. But for one who has failed to do so, his very mind will be the greatest enemy.", source: "Bhagavad Gita 6.6" },
  { text: "It is better to live your own destiny imperfectly than to live an imitation of somebody else's life with perfection.", source: "Bhagavad Gita 3.35" },
  { text: "Set thy heart upon thy work but never on its reward. Work done for a reward is much lower than work done in the yoga of wisdom.", source: "Bhagavad Gita" },
  { text: "Man is made by his belief. As he believes, so he is.", source: "Bhagavad Gita 17.3" },
  { text: "Do not yield to unmanliness. It does not befit you. Shake off faint-heartedness and arise.", source: "Bhagavad Gita 2.3" },
  { text: "There is nothing lost or wasted in this life. Every effort you make accumulates.", source: "Bhagavad Gita 2.40" },
  { text: "Let right deeds be thy motive, not the fruit which comes from them. And live in action! Labour! Make thine acts thy piety.", source: "Bhagavad Gita" },
  { text: "Whatever happened, happened for the good. Whatever is happening, is happening for the good. Whatever will happen, will also happen for the good. Do not weep for the past.", source: "Bhagavad Gita" },
  { text: "The wise who control their senses and mind, who have renounced all desires and are free from attachment — they attain liberation through their own effort.", source: "Bhagavad Gita 5.28" },
  { text: "A person can rise through the efforts of their own mind, or draw themselves down. Each is their own best friend or worst enemy.", source: "Bhagavad Gita 6.5" },
  { text: "Arise, slay thy enemies, enjoy a prosperous kingdom. They are already slain by me; be an instrument only.", source: "Bhagavad Gita 11.33" },
  { text: "Fear not. What is not real never was, and never will be. What is real always was, and cannot be destroyed.", source: "Bhagavad Gita 2.16" },
  { text: "He who shirks action does not attain freedom; no one can gain perfection by abstaining from work.", source: "Bhagavad Gita 3.4" },
  { text: "Perform your obligatory duty, because action is indeed better than inaction. Even the maintenance of your body would not be possible by inaction.", source: "Bhagavad Gita 3.8" },
  { text: "Let a man lift himself by his own self alone, and let him not lower himself; for this self alone is the friend of oneself and this self alone is the enemy of oneself.", source: "Bhagavad Gita 6.5" },

  // Mahabharata
  { text: "Even a single moment of time is precious beyond measure — it cannot be recalled once it has slipped away. Protect your hours.", source: "Mahabharata" },
  { text: "Laziness is the enemy of all accomplishment. The idle man sits, waits, and finally vanishes without a trace.", source: "Mahabharata, Vidura Niti" },
  { text: "Knowledge is the greatest wealth. No thief can steal it, no fire can burn it, no king can tax it.", source: "Mahabharata" },
  { text: "The weak can never forgive. Forgiveness is an attribute of the strong.", source: "Mahabharata" },
  { text: "He who has health has hope. He who has hope has everything. Begin today.", source: "Mahabharata" },
  { text: "Fear weakens a man and makes him a slave. Courage builds him into a king.", source: "Mahabharata, Shanti Parva" },
  { text: "A man who does not act according to his duty is no better than an animal who acts only on impulse.", source: "Mahabharata, Anushasana Parva" },
  { text: "Time is the root of all beings. Every creature is born in time and returns to time. Do not waste what time gives you.", source: "Mahabharata" },
  { text: "One who does not set a goal has no direction. One with no direction reaches no destination. Set your aim and walk.", source: "Mahabharata, Udyoga Parva" },
  { text: "Even if you are a minority of one, the truth is still the truth. Do not be silent because it is inconvenient.", source: "Mahabharata" },
  { text: "The foolish man seeks happiness in the distance; the wise man grows it under his feet — today, right now.", source: "Mahabharata" },

  // Ramayana
  { text: "Hesitation in the face of duty is not caution — it is cowardice dressed in careful clothes. Act.", source: "Ramayana" },
  { text: "No work done with devotion is small. Every step taken in faith reaches the destination.", source: "Ramayana" },
  { text: "The lotus grows in mud yet remains untouched by it. Rise above your circumstances and bloom.", source: "Ramayana" },
  { text: "A day spent without effort is a debt you owe your future self — and the interest compounds.", source: "Ramayana, Kishkindha Kanda" },
  { text: "Hanuman's strength came not from his body but from his belief that he could. What do you believe about yourself?", source: "Ramayana, Sundara Kanda" },
  { text: "Even the mightiest ocean is crossed one wave at a time. Do not be afraid of the distance. Begin.", source: "Ramayana" },
  { text: "Speak truth. Do your duty. Fear nothing. These three will carry you through any difficulty.", source: "Ramayana, Ayodhya Kanda" },
  { text: "There is no enemy outside yourself. Your greatest obstacle is the hesitation within your own mind.", source: "Ramayana" },
  { text: "Patience under hardship is not weakness. It is the training ground of the extraordinary.", source: "Ramayana, Aranya Kanda" },

  // Bible
  { text: "Whatever your hand finds to do, do it with all your might, for in the realm of the dead, where you are going, there is neither working nor planning.", source: "Ecclesiastes 9:10" },
  { text: "The soul of a lazy man desires, and has nothing; but the soul of the diligent shall be made rich.", source: "Proverbs 13:4" },
  { text: "Go to the ant, you sluggard; consider her ways and be wise! She has no commander, no overseer — yet she stores her provisions in summer.", source: "Proverbs 6:6–8" },
  { text: "For God has not given us a spirit of fear, but of power and of love and of a sound mind.", source: "2 Timothy 1:7" },
  { text: "I can do all things through Christ who strengthens me.", source: "Philippians 4:13" },
  { text: "The plans of the diligent lead surely to abundance, but everyone who is hasty comes only to poverty.", source: "Proverbs 21:5" },
  { text: "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.", source: "Galatians 6:9" },
  { text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.", source: "Joshua 1:9" },
  { text: "Do not be conformed to this world, but be transformed by the renewing of your mind.", source: "Romans 12:2" },
  { text: "Commit to the Lord whatever you do, and he will establish your plans.", source: "Proverbs 16:3" },
  { text: "A little sleep, a little slumber, a little folding of the hands to rest — and poverty will come on you like a thief.", source: "Proverbs 6:10–11" },
  { text: "Train yourself for godliness; for while bodily training is of some value, godliness is of value in every way.", source: "1 Timothy 4:7–8" },
  { text: "The diligent hand will rule, but laziness ends in forced labor.", source: "Proverbs 12:24" },
  { text: "Ask and it will be given to you; seek and you will find; knock and the door will be opened to you.", source: "Matthew 7:7" },
  { text: "Iron sharpens iron, and one person sharpens another. Surround yourself with those who push you forward.", source: "Proverbs 27:17" },

  // Quran & Hadith
  { text: "Indeed, Allah will not change the condition of a people until they change what is in themselves.", source: "Quran 13:11" },
  { text: "And that there is not for man except that for which he strives.", source: "Quran 53:39" },
  { text: "So verily, with the hardship, there is relief. Verily with the hardship there is relief.", source: "Quran 94:5–6" },
  { text: "Allah does not burden a soul beyond that it can bear.", source: "Quran 2:286" },
  { text: "And whoever strives only strives for the benefit of himself.", source: "Quran 29:6" },
  { text: "Work, for Allah will see your deeds, and so will His Messenger and the believers.", source: "Quran 9:105" },
  { text: "Do not lose hope, nor be sad. You will surely be victorious if you are true believers.", source: "Quran 3:139" },
  { text: "Tie your camel, then put your trust in Allah. Take action first — then trust.", source: "Hadith, Tirmidhi" },
  { text: "Seek knowledge from the cradle to the grave. It is an obligation upon every Muslim.", source: "Hadith, Ibn Majah" },
  { text: "The best among you is the one who brings the most benefit to others.", source: "Hadith, Bukhari" },
  { text: "Make things easy and do not make them difficult. Cheer people up and do not drive them away.", source: "Hadith, Bukhari" },
  { text: "Whoever follows a path in pursuit of knowledge, Allah will make easy for him a path to Paradise.", source: "Hadith, Muslim" },
  { text: "Take advantage of five before five: your youth before your old age, your health before your illness, your wealth before your poverty, your free time before your busyness, and your life before your death.", source: "Hadith, Al-Hakim" },
  { text: "Be in this world as though you were a stranger or a wayfarer. Use every hour.", source: "Hadith, Bukhari" },
];

// Pick the next unseen quote; reset the cycle once every quote has shown.
export async function getNextQuote() {
  let shown = [];
  try {
    const r = await safeStorage.get(KEYS.QUOTES_SHOWN);
    if (r && r.value) shown = JSON.parse(r.value);
  } catch (e) {}

  if (!Array.isArray(shown) || shown.length >= QUOTES.length) shown = [];

  const available = QUOTES.map((_, i) => i).filter(i => !shown.includes(i));
  const pool = available.length ? available : QUOTES.map((_, i) => i);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  shown.push(pick);

  try { await safeStorage.set(KEYS.QUOTES_SHOWN, JSON.stringify(shown)); } catch (e) {}
  return QUOTES[pick];
}

