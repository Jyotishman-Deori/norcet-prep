// =====================================================================
// src/lib/legal.js — plain-language legal documents (single source of truth).
//
// Five documents: Privacy Policy, Terms of Use, Community Guidelines,
// Cancellation & Refunds, and the Content Disclaimer. Settings → Legal, the
// footer, and the onboarding consent step all render the SAME text from here.
// Each document is a list of { h, body } sections; `body` may contain blank
// lines.
//
// NOTE FOR THE MAINTAINER: this is written to match how the app actually
// behaves (local guest mode via IndexedDB, Supabase sync, Umami cookieless
// analytics, Cloudflare Turnstile at sign-in, opt-in web push, free during
// the test phase with premium plans announced but not charged). Review
// against your final hosting/region before wider public launch; bump
// LEGAL_VERSION whenever the wording materially changes so returning users
// are re-prompted to accept.
// =====================================================================

export const LEGAL_VERSION = 7;       // v7 (July 2026): Content Disclaimer covers the self-generated Progress Card and share images (not certificates, not transcripts, not results, not verified, no rank/percentile); v6 covered the Nursing Calculator Suite (formula tool, reference ranges need local verification, results stay on device); v5 added the Content Disclaimer doc; v4 named Supabase/Umami/Turnstile, added notifications + payments wording, new Community Guidelines + Cancellation & Refunds docs
export const LEGAL_UPDATED = 'July 2026';   // last reviewed

// Support contact — the public-facing address (About "Email us", Privacy +
// Refunds contact sections all read this one constant). Now the custom-domain
// mailbox: support@nurseholic.in is a live Namecheap forwarder → the owner's
// inbox (set up 2026-07-06). Swap here if it ever moves to a real mailbox.
export const SUPPORT_EMAIL = 'support@nurseholic.in';

export const LEGAL = {
  privacy: {
    title: 'Privacy Policy',
    updated: LEGAL_UPDATED,
    intro: 'This app helps you prepare for nursing entrance exams. We keep data collection to the minimum needed to save your progress. Here is exactly what that means.',
    sections: [
      {
        h: 'What we store',
        body: 'Your study data: answers, scores, streaks, bookmarks, saved revision/crib sheets, favourites and app settings. If you create an account, we also store the display name and password you choose, plus a security question and answer you pick so you can recover your password if you forget it. You can optionally add an email; we never require it and never ask for a phone number.',
      },
      {
        h: 'Guest mode',
        body: 'If you use the app without signing in, your progress is saved only on this device (in your browser’s local storage, called IndexedDB) and is not sent to our servers. Clearing your browser data or uninstalling removes it.',
      },
      {
        h: 'Accounts and sync',
        body: 'When you sign in, your study data is synced to our database provider (Supabase) so you can pick up on another device. Your password is stored in protected (hashed) form and is never shown to anyone, including the app admin.',
      },
      {
        h: 'How your data is used',
        body: 'Only to run the app: to show your progress, power features like spaced review and the leaderboard, and to let the admin improve content (for example, spotting questions many people find confusing). We show aggregated, app-wide usage to the admin, not a feed of any one person’s activity.',
      },
      {
        h: 'Analytics',
        body: 'We use Umami, a privacy-friendly analytics service, to count page views and feature usage in aggregate. It is cookieless and does not build a profile of you or follow you to other websites.',
      },
      {
        h: 'Bot protection',
        body: 'Sign-in and sign-up are protected by Cloudflare Turnstile, a privacy-friendly “are you human?” check. When you log in, Turnstile may process technical signals from your browser (handled by Cloudflare under their privacy policy) to tell people apart from bots. We never see or store those signals.',
      },
      {
        h: 'Notifications',
        body: 'Study reminders and new-content alerts are strictly opt-in. If you turn them on, your browser creates a push subscription (a technical address for your device, not your phone number or email) which we store to deliver messages. You can switch notifications off anytime in Settings or in your browser/phone settings, and the subscription is discarded when it stops working.',
      },
      {
        h: 'Cookies and local storage',
        body: 'We don’t use advertising or tracking cookies. The app keeps your progress and preferences in your browser’s local storage so it works offline; our analytics is cookieless.',
      },
      {
        h: 'Payments',
        body: 'Nothing in the app charges money today. If paid plans launch, payments will be processed by a payment provider under their own terms. We will never see or store your card or banking details. See the Cancellation & Refunds policy for how paid plans will work.',
      },
      {
        h: 'What we never do',
        body: 'We do not sell your data. We do not show ads. We do not share your information with advertisers or use it to track you across other apps or websites.',
      },
      {
        h: 'Content you add',
        body: 'If you post a question in the community FAQ, other users of the app may see it along with your display name. To protect you, personal contact details (like phone numbers or emails) in public posts are automatically hidden. Don’t post anything confidential or copyrighted that you don’t have the right to share.',
      },
      {
        h: 'Your choices',
        body: 'You can rename your profile, turn notifications on or off, clear all your local data, or ask the admin to delete your account and the data tied to it. Deleting your account removes your profile, your synced study data and any feedback you submitted.',
      },
      {
        h: 'Children and students',
        body: 'The app is intended for exam aspirants. If you are below the age of majority in your country, please use it with a parent or guardian’s awareness.',
      },
      {
        h: 'How long we keep it',
        body: 'Synced study data is kept while your account is active. If you delete your account, your profile and the data tied to it are removed; local guest data lives only on your device until you clear it.',
      },
      {
        h: 'Contact',
        body: `Questions about your data or a deletion request? Use Settings → Send feedback to reach the developer directly, or email ${SUPPORT_EMAIL}.`,
      },
      {
        h: 'Changes',
        body: 'If this policy changes in a meaningful way, we’ll update the date above and ask you to review it again the next time you open the app.',
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: LEGAL_UPDATED,
    intro: 'By using this app you agree to these terms. They’re short and in plain language.',
    sections: [
      {
        h: 'The app is a study aid',
        body: 'Questions, explanations, dosage drills and reference values are provided to help you practise. They may contain errors and are not a substitute for your official syllabus, textbooks or professional/clinical judgement. Always verify anything you’ll rely on in practice against an authoritative source. See the Content Disclaimer under Legal for full details.',
      },
      {
        h: 'No guarantee of results',
        body: 'We can’t promise a particular exam outcome. Your results depend on your own preparation.',
      },
      {
        h: 'Acceptable use',
        body: 'Use the app for your personal exam preparation. Don’t try to break, overload or abuse it, scrape its content at scale, or upload unlawful, offensive or copyrighted material you don’t own. Community spaces follow the Community Guidelines (see Legal).',
      },
      {
        h: 'Your account',
        body: 'Your account is personal, one account per person. Keep your login details safe; you’re responsible for activity under your profile. Password recovery uses the security question and answer you choose at sign-up (there is no email-based reset), so pick an answer only you would know and remember it. To protect accounts, signing in on a new device may sign out older devices.',
      },
      {
        h: 'Free today, paid plans later',
        body: 'During the current test phase every feature is free. Paid plans (individual and family) are previewed in the app and may launch later; if they do, prices will be shown clearly before you pay, some features may become premium-only, and the Cancellation & Refunds policy will apply. A family plan links separate accounts to one subscription. It never shares your progress or password with anyone.',
      },
      {
        h: 'Content and contributions',
        body: 'You keep ownership of posts you add, but you grant other users permission to view and use them within the app. The admin may remove content that breaks these terms or the Community Guidelines.',
      },
      {
        h: 'Voluntary support',
        body: 'Any “support the app” / tip is entirely optional, processed by a third-party service under their own terms, and gives no extra features.',
      },
      {
        h: 'Availability',
        body: 'We offer the app “as is” and may change, pause or discontinue features. We’ll try to preserve your data, but please keep your own backups of anything important.',
      },
      {
        h: 'Changes',
        body: 'We may update these terms; continued use after an update means you accept the new version.',
      },
    ],
  },
  guidelines: {
    title: 'Community Guidelines',
    updated: LEGAL_UPDATED,
    intro: 'The FAQ threads, doubts and leaderboard are shared spaces for nursing aspirants. A few simple rules keep them useful for everyone.',
    sections: [
      {
        h: 'Be respectful',
        body: 'No insults, abuse, slurs or harassment, in any language. An automatic filter blocks abusive words in English, Hindi/Hinglish and Assamese in public posts and display names, and the admin moderates everything on top of that.',
      },
      {
        h: 'Keep personal information out',
        body: 'For your own safety, don’t share phone numbers, emails, payment handles or ID numbers in public posts, yours or anyone else’s. The app automatically hides contact details it detects, but treat that as a seatbelt, not an invitation.',
      },
      {
        h: 'Stay on topic',
        body: 'Community threads are for study doubts and app questions. No spam, advertising, self-promotion or off-topic chains.',
      },
      {
        h: 'Play the leaderboard fair',
        body: 'Scores, streaks and XP should reflect real practice. Don’t use scripts, multiple accounts or other tricks to inflate standings, it spoils the comparison for everyone and can lead to removal.',
      },
      {
        h: 'Academic honesty',
        body: 'Don’t post live exam content or anything you’re not allowed to share. Questions you contribute should be your own work or material you have the right to use.',
      },
      {
        h: 'What happens on a breach',
        body: 'Content that breaks these rules may be removed without notice. Repeated or serious breaches can lead to your account being removed. If you see something that shouldn’t be here, use Settings → Send feedback to flag it.',
      },
    ],
  },
  refunds: {
    title: 'Cancellation & Refunds',
    updated: LEGAL_UPDATED,
    intro: 'Right now the app is in a free test phase. Nothing charges money, so there is nothing to cancel or refund. This policy explains how paid plans will work when they launch, so there are no surprises.',
    sections: [
      {
        h: 'Today: everything is free',
        body: 'During the test phase every feature is unlocked at no cost. The plans and prices you may see on the Premium page are a preview only; no payment is collected.',
      },
      {
        h: 'When paid plans launch',
        body: 'Subscriptions (monthly or yearly, individual or family) will renew automatically until cancelled. The price, billing period and what’s included will be shown clearly before you pay.',
      },
      {
        h: 'Cancelling',
        body: 'You’ll be able to cancel anytime from inside the app. Cancelling stops future renewals; your premium features stay active until the end of the period you already paid for. Your study data is never taken away, free accounts keep everything they’ve learned.',
      },
      {
        h: 'Refunds',
        body: 'If something went wrong, a duplicate charge, a billing error, or the app failed to deliver what you paid for, contact us within 7 days of the charge via Settings → Send feedback and we’ll make it right, including a refund where appropriate. Refunds for simple change-of-mind after extended use may not be possible; we’ll always tell you clearly either way.',
      },
      {
        h: 'Family plans',
        body: 'A family plan covers up to six separate accounts under one subscription. If the plan owner cancels or a member is removed, that member simply returns to the free tier, their account and progress remain untouched.',
      },
      {
        h: 'How refunds are paid',
        body: 'Approved refunds go back to the original payment method through the payment provider, typically within 5–10 business days depending on your bank.',
      },
      {
        h: 'Contact',
        body: `For any billing question use Settings → Send feedback or email ${SUPPORT_EMAIL}. Include the date and amount of the charge so we can find it quickly.`,
      },
    ],
  },
  disclaimer: {
    title: 'Content Disclaimer',
    updated: LEGAL_UPDATED,
    intro: 'We want you to trust what you study here. This page says plainly what our content is, what it is not, and what we do when something is wrong.',
    sections: [
      {
        h: 'A study aid, not medical advice',
        body: 'Everything in the app, questions, explanations, dosage drills, reference values and study guides, exists to help you prepare for an exam. It is not medical advice and it is not a clinical resource. It never replaces your official syllabus, your textbooks, your teachers or your own clinical judgement. Before you rely on anything in real practice, verify it against an authoritative, current source.',
      },
      {
        h: 'Mistakes can happen, and how we fix them',
        body: 'Our content is written and reviewed by humans, across thousands of questions and explanations. We work hard to keep it accurate, but an occasional error can still slip through, a dated guideline, a typo in an option, a debatable answer key.\n\nThat is why every question carries a one-tap report. When you flag something, a person reads it, checks it against reliable references, and ships a correction if you were right. Your reports are a big part of why the bank keeps getting better.',
      },
      {
        h: 'Names and scenarios are illustrative',
        body: 'Patients, nurses, doctors, wards and hospitals that appear in questions are fictional teaching scenarios, invented to make a concept concrete. Any resemblance to a real person, living or dead, is coincidental and unintended. Where a real institution, examination body or public figure is mentioned, it is only in a factual, syllabus-related context.',
      },
      {
        h: 'Dosage and reference values are for practice only',
        body: 'Drug doses, drip rates, lab ranges and other numbers in drills and calculators are exam-practice and reference values. Never use them alone to make a real clinical decision. In practice, always follow your institution’s protocols, the prescriber’s orders and current official references.',
      },
      {
        h: 'The Nursing Calculator Suite',
        body: 'The calculators run fixed, published formulas (for example Cockcroft-Gault, Mosteller, Holliday-Segar, Naegele) entirely on your device, and every result names the formula, the standard and the rounding rule it used. No artificial intelligence is involved in any calculation.\n\nA calculator result is a reference number, not a prescription and not an order. Interpretation ranges shown alongside results (such as BMI classes or risk bands) are labelled with their source, and cutoffs can differ between institutions, so always verify them against your institution’s protocol before acting on them. A calculation is only as good as the values you type in, so double-check your inputs. Your recent calculations are stored on your device only and are never uploaded.',
      },
      {
        h: 'No affiliation with exam bodies',
        body: 'Exam names such as NORCET or AIIMS are used only to describe what the content prepares you for. This app is an independent study tool. It is not affiliated with, endorsed by or connected to AIIMS, any examination authority or any government body. All trademarks belong to their respective owners.',
      },
      {
        h: 'Progress cards and share images',
        body: 'The app can generate a progress card from the practice you have done inside it, saved as an image or a PDF. These are self-generated summaries of your own activity, produced on your own device. They are not certificates, not transcripts, not results and not proof of any qualification. They carry no rank, score or percentile from any examination, and nobody verifies them, so no institution or employer should treat them as evidence of anything. The figures come only from what you did in this app, mainly quiz practice, with mock tests and previous-year papers listed on their own. They do not measure study time away from the app, and they cannot predict how you will do in a real exam. Please do not present them as an official record.',
      },
      {
        h: 'Community content',
        body: 'Posts in the FAQ and other community spaces are written by fellow aspirants and reflect their authors’ own views, not ours. Treat community answers the same way you would a classmate’s notes: helpful, but worth verifying.',
      },
      {
        h: 'Found something wrong?',
        body: `Tell us. Use the report button on any question, or Settings → Send feedback, or email ${SUPPORT_EMAIL}. Every report is read by a person, and real errors get fixed.`,
      },
    ],
  },
};

export const legalDoc = (key) => LEGAL[key] || null;
