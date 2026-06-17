// =====================================================================
// src/lib/legal.js — plain-language Privacy Policy + Terms of Use.
//
// Single source of truth for the legal copy, so Settings → Legal (#16) and
// the onboarding consent step (#17) render the SAME text. Each document is a
// list of { h, body } sections; `body` may contain blank lines.
//
// NOTE FOR THE MAINTAINER: this is written to match how the app actually
// behaves (local guest mode, optional name/DOB/password, Supabase sync, no
// email, no ads, no payment beyond the optional voluntary tip). Review it
// against your final hosting/region before a wider public launch; bump
// LEGAL_VERSION whenever the wording materially changes so returning users are
// re-prompted to accept.
// =====================================================================

export const LEGAL_VERSION = 1;       // bump on material wording changes
export const LEGAL_UPDATED = 'June 2026';

export const LEGAL = {
  privacy: {
    title: 'Privacy Policy',
    updated: LEGAL_UPDATED,
    intro: 'This app helps you prepare for nursing entrance exams. We keep data collection to the minimum needed to save your progress. Here is exactly what that means.',
    sections: [
      {
        h: 'What we store',
        body: 'Your study data — answers, scores, streaks, bookmarks, saved revision/crib sheets, favourites and app settings. If you create an account, we also store the display name, date of birth and password you choose. We never ask for your email or phone number.',
      },
      {
        h: 'Guest mode',
        body: 'If you use the app without signing in, your progress is saved only on this device and is not sent to our servers. Clearing your browser data or uninstalling removes it.',
      },
      {
        h: 'Accounts and sync',
        body: 'When you sign in, your study data is synced to our hosting provider so you can pick up on another device. Your password is stored in protected form and is never shown to anyone, including the app admin.',
      },
      {
        h: 'How your data is used',
        body: 'Only to run the app: to show your progress, power features like spaced review and the leaderboard, and to let the admin improve content (for example, spotting questions many people find confusing). We show aggregated, app-wide usage to the admin — not a feed of any one person\u2019s activity.',
      },
      {
        h: 'What we never do',
        body: 'We do not sell your data. We do not show ads. We do not share your information with advertisers or use it to track you across other apps or websites.',
      },
      {
        h: 'Content you add',
        body: 'If you upload a question bank or post a question in the community FAQ, other users of the app may see it. Don\u2019t upload anything confidential or copyrighted that you don\u2019t have the right to share.',
      },
      {
        h: 'Your choices',
        body: 'You can rename your profile, clear all your local data, or ask the admin to delete your account and the data tied to it. Deleting your account removes your profile, your synced study data and any feedback you submitted.',
      },
      {
        h: 'Children and students',
        body: 'The app is intended for exam aspirants. If you are below the age of majority in your country, please use it with a parent or guardian\u2019s awareness.',
      },
      {
        h: 'Changes',
        body: 'If this policy changes in a meaningful way, we\u2019ll update the date above and ask you to review it again the next time you open the app.',
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: LEGAL_UPDATED,
    intro: 'By using this app you agree to these terms. They\u2019re short and in plain language.',
    sections: [
      {
        h: 'The app is a study aid',
        body: 'Questions, explanations, dosage drills and reference values are provided to help you practise. They may contain errors and are not a substitute for your official syllabus, textbooks or professional/clinical judgement. Always verify anything you\u2019ll rely on in practice against an authoritative source.',
      },
      {
        h: 'No guarantee of results',
        body: 'We can\u2019t promise a particular exam outcome. Your results depend on your own preparation.',
      },
      {
        h: 'Acceptable use',
        body: 'Use the app for your personal exam preparation. Don\u2019t try to break, overload or abuse it, scrape its content at scale, or upload unlawful, offensive or copyrighted material you don\u2019t own.',
      },
      {
        h: 'Your account',
        body: 'Keep your login details safe — you\u2019re responsible for activity under your profile. Because there\u2019s no email recovery, your date of birth is used to help recover a forgotten password, so remember it.',
      },
      {
        h: 'Content and contributions',
        body: 'You keep ownership of question banks or posts you add, but you grant other users permission to view and use them within the app. The admin may remove content that breaks these terms.',
      },
      {
        h: 'Voluntary support',
        body: 'The app is free. Any \u201Csupport the app\u201D / tip is entirely optional, processed by a third-party service under their own terms, and gives no extra features.',
      },
      {
        h: 'Availability',
        body: 'We offer the app \u201Cas is\u201D and may change, pause or discontinue features. We\u2019ll try to preserve your data, but please keep your own backups of anything important.',
      },
      {
        h: 'Changes',
        body: 'We may update these terms; continued use after an update means you accept the new version.',
      },
    ],
  },
};

export const legalDoc = (key) => LEGAL[key] || null;
