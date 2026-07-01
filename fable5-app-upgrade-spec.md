# Nursing App — Fable 5 Upgrade & Improvement Spec

> This document is written specifically for Claude Fable 5 in Claude Code. Read the entire document before doing anything. Do not start any implementation until you have read every section, understood every dependency, and listed back to the user what you plan to do and in what order. The app is a PWA running on iOS, Android, and PC across all screen shapes and sizes — mobile, tablet, and desktop. Nothing in this spec should break existing functionality. Every change is additive or an upgrade unless explicitly stated otherwise. Micro animations are a mandatory requirement on every interactive element throughout the entire app.

---

## 0. Pre-Implementation Protocol (Mandatory)

Before writing a single line of code:

1. Read this entire document.
2. Read the existing codebase structure — understand the current routing, state management, storage layer, component architecture, and admin panel connection.
3. Identify every file that will be touched by each section below.
4. List all potential breaking points.
5. Report back to the user with your full implementation plan, file-by-file, section by section, before proceeding.
6. Only begin after the user confirms the plan.

Do not combine multiple sections into a single session. Work one section at a time. Confirm completion and test results with the user before moving to the next section.

---

## 1. Platform & Quality Baseline (Non-Negotiable)

Every single piece of work in this document must conform to these requirements without exception:

**PWA:** The app is a PWA. Every feature must work correctly in standalone/installed mode on iOS Safari, Android Chrome, and desktop browsers. No assumptions about native APIs — test every browser API for availability before using it.

**Responsive:** Every UI element must work flawlessly across all screen sizes — small phones (360px wide), large phones, tablets in portrait and landscape, and desktop. No fixed pixel widths on containers. No overflow. No clipped elements on any viewport.

**Micro animations:** Every interactive element in the app must have a micro animation. This is not optional polish — it is a core requirement. Buttons must animate on tap/click. Modals must animate open and close. Cards must animate on appear. List items must animate in. State changes (correct/wrong answer, coin earned, streak updated) must have a dedicated animation. Use CSS transitions and keyframes as the primary method. Use the Web Animations API where CSS alone is insufficient. All animations must respect `prefers-reduced-motion` — wrap every animation in a check and fall back to instant transitions for users who have this enabled.

**iOS safe areas:** Every screen and overlay must account for `env(safe-area-inset-*)`. No content behind notches, Dynamic Island, or home indicators.

**Performance:** No animation or new feature should cause layout shift or janky scroll. Use `will-change` deliberately and sparingly. Prefer `transform` and `opacity` for animations — never animate `top`, `left`, `width`, or `height` directly.

**No breaking changes:** Run existing tests before and after every section. If tests fail, fix them before moving forward. Never leave the app in a broken state between sessions.

---

## 2. Referral ID System

### What needs to be built

Every user must have a unique, permanent referral ID generated at account creation. This referral ID is the user's identity in the referral system — it never changes, never expires, and is tied to their account for the lifetime of the app.

### Referral ID specification

- Format: alphanumeric, 8 characters, uppercase. Example: `NRS4X7KQ`. Prefix with a short app-specific identifier if needed for branding (e.g., `NRS-4X7KQ`).
- Generated at: first account creation / first app open (whichever comes first in the current auth flow).
- Stored in: user's account record in the backend/admin panel database, not only local storage.
- Unique constraint: enforce uniqueness at the database level — collision check must happen server-side before the ID is committed.
- Never regenerated: once assigned, the referral ID is permanent. If a user reinstalls the app, their referral ID must be restored from their account, not regenerated.

### Referral flow

1. User A shares their referral ID or link.
2. User B installs the app and enters User A's referral ID during onboarding OR clicks a deep link that pre-fills it.
3. User B's account creation records User A's referral ID as the referrer.
4. Coins/points are awarded to both User A and User B only after User B completes a qualifying action (minimum: completes one full mock exam — see Section 5 for what constitutes a completed attempt).
5. Admin panel must show: referral ID, who referred whom, date of referral, qualifying action status (pending/completed), and coins awarded.

### Fraud prevention

- One referral reward per referred user — a user cannot be referred twice.
- A user cannot refer themselves (block referrer ID = own ID).
- Minimum qualifying action before coins are awarded — do not award on signup alone.
- Rate limiting: if a single referral ID generates more than 10 referrals in 24 hours, flag it in the admin panel for manual review. Do not auto-ban — flag only.
- Device fingerprint logging on referral signup — store for admin review, not for blocking.

### Deep link specification

- Referral links must be deep links that open the app directly to an onboarding or referral-credit confirmation screen.
- Use the existing deep link infrastructure if present. If not present, implement using Firebase Dynamic Links or a custom URL scheme registered in the PWA manifest.
- On link open: pre-fill the referral ID field, show a "You were referred by [User A's display name]" confirmation message with a micro animation, and proceed to account creation.
- If the app is not installed: deep link must fall back to the app's landing/install page with the referral ID preserved in the URL as a query parameter, so it can be captured after install.

### Admin panel additions

- Add a Referrals section to the admin panel.
- Show a table: User, Referral ID, Total Referrals Made, Pending Referrals, Completed Referrals, Total Coins Awarded via Referrals.
- Allow the admin to manually mark a referral as valid or invalid.
- Allow the admin to adjust coin awards for referrals without a code deploy.

---

## 3. State-of-the-Art Question System

> This is the most critical section of this document. The question system is the core product. Read it completely before touching any question-related code. The user has an existing question system design — review it fully before making any changes. All improvements must be additive and must not corrupt existing question data or user progress data.

### 3A. Incomplete Attempt Rule (Abandoned Sessions)

**Rule:** If a user opens a test (quick, mock, or advanced) and exits without completing it, that attempt is null. It is as if the attempt never happened.

**Definition of null:**
- The attempt is not counted in the user's attempt history.
- The attempt is not counted toward any streak.
- The questions attempted in that session are not marked as "seen" or "attempted" in the user's question history.
- No coins, points, or rewards are awarded.
- No performance data from that session is recorded.
- The session is silently discarded.

**Definition of a completed attempt:**
- The user submits the exam (taps the final submit button and confirms submission).
- OR the exam timer reaches zero and the system auto-submits.
- Any other exit path — back button, app close, tab close, session timeout without timer expiry — is an abandoned attempt and must be treated as null.

**Implementation requirements:**
- Track attempt state in a session-scoped variable, not persisted storage, until the moment of confirmed submission.
- On submission confirmation: atomically write all attempt data to persistent storage and the backend in a single transaction. If the write fails, retry — do not partially commit.
- On any non-submission exit: clear the session-scoped variable. Write nothing to persistent storage.
- The "Are you sure you want to exit?" confirmation dialog must be present on all exit paths during an active exam — back button (Android), browser navigation, tab close (beforeunload event on desktop), and explicit exit button. The dialog must clearly state "Your progress will not be saved."
- On iOS PWA standalone mode: the beforeunload event is not reliably fired. Implement a visibility change listener (`document.addEventListener('visibilitychange')`) as the iOS-compatible exit detection method. When visibility changes to hidden during an active exam, save the session state temporarily to flag it as abandoned when the app next opens — then discard it on next open.

### 3B. Question Repetition System

**Core principle:** A user should not see the same question again until they have seen a sufficient portion of the question bank, and when they do see it again, the timing should be based on their performance on that question, not random selection.

**Per-user question history tracking:**
Every user must have a question history record that stores for each question they have ever seen:
- Question ID
- Times seen
- Times answered correctly
- Times answered incorrectly
- Last seen timestamp
- Mastery level (computed — see below)
- Next scheduled appearance timestamp (computed — see below)

**Mastery levels:**
- `unseen` — user has never seen this question
- `learning` — seen 1–2 times, less than 70% correct rate
- `reviewing` — seen 3+ times, 70–89% correct rate
- `mastered` — seen 3+ times, 90%+ correct rate
- `flagged` — user has manually flagged this question for review

**Question selection algorithm for mocks:**
1. Prioritize `unseen` questions first — a user should always be progressing through new material.
2. Mix in `learning` questions at a ratio configurable by the admin panel (default: 70% unseen, 20% learning, 10% reviewing).
3. Never include `mastered` questions unless the user explicitly requests a full review mode.
4. Never repeat a question in the same session.
5. Within each category, selection is random — do not always show the same question first.

**Spaced repetition scheduling:**
When a question is answered:
- Answered correctly → next appearance scheduled at: current time + interval based on mastery level (learning: 3 days, reviewing: 7 days, mastered: 30 days).
- Answered incorrectly → next appearance scheduled at: current time + 1 day, mastery level stepped back by one level (mastered → reviewing, reviewing → learning).
- The specific intervals above are defaults. All intervals must be configurable from the admin panel without a code deploy.

**Admin panel additions for question repetition:**
- View per-user question mastery distribution (how many questions at each mastery level).
- Global view: which questions have the highest incorrect rate across all users — surfaces poorly worded or genuinely hard questions for content review.
- Ability to reset a user's question history for a specific topic (for support purposes).

### 3C. Question Set Upload and Tracking System

**Admin panel — question upload flow:**

The admin (solo founder) uploads new question sets. The upload system must be:
- Bulk upload via structured format (JSON or CSV — define the exact schema below and implement a validator that rejects malformed uploads before they touch the database).
- Tagged at upload time with: topic, subtopic, exam type (NEET-PG / NCLEX / State Board / General), difficulty level (1–5), source/reference, and creation date.
- Each question assigned a permanent unique Question ID at upload — never reused even if the question is deleted.
- Questions can be soft-deleted (hidden from users) but never hard-deleted — preserves user history integrity.
- Version history: if a question's text or options are edited, the previous version is archived. User history records reference the question ID, so edits do not corrupt historical accuracy data.

**Question schema (define and enforce this exactly):**
```json
{
  "question_id": "string — system generated, permanent",
  "version": "integer — increments on edit",
  "topic": "string",
  "subtopic": "string",
  "exam_type": ["NEET-PG", "NCLEX", "State Board", "General"],
  "difficulty": "integer 1–5",
  "question_text": "string — supports markdown",
  "options": [
    { "id": "A", "text": "string" },
    { "id": "B", "text": "string" },
    { "id": "C", "text": "string" },
    { "id": "D", "text": "string" }
  ],
  "correct_option": "A | B | C | D",
  "explanation": "string — shown after answer, supports markdown",
  "reference": "string — textbook/source",
  "created_at": "ISO timestamp",
  "last_edited_at": "ISO timestamp",
  "is_active": "boolean",
  "report_count": "integer — auto-incremented when users flag this question"
}
```

**Question set grouping:**
- Questions are grouped into named sets (e.g., "Cardiovascular System — Advanced Set 3").
- A question can belong to multiple sets.
- Sets are versioned — uploading a new set does not replace the old set; it is additive.
- Admin panel shows: set name, question count, date uploaded, which exam types it covers, average difficulty, and usage count (how many times questions from this set have been served to users).

**Question report system (user-facing):**
- Every question must have a "Report this question" option accessible during and after the exam.
- Report categories: "Wrong answer marked correct," "Question is unclear," "Outdated information," "Typo or formatting error," "Other."
- Reports go directly to the admin panel — increment the question's `report_count` and create a report record with the user ID, timestamp, and category.
- Admin panel shows all reported questions sorted by report count. Questions with 3+ reports are auto-flagged for review with a visual indicator.
- Admin can resolve a report (dismiss or fix the question) — resolved reports are archived, not deleted.

**Question availability for mocks:**
- When building a mock exam, the system selects from the pool of active questions matching the exam type and topic filters.
- If insufficient unseen questions are available for a user, the system fills with the user's oldest `learning` questions — never shows a question the user mastered in the last 30 days unless no other option exists.
- Admin panel must show a "question pool health" indicator per exam type — how many unseen questions the average user has remaining. Alert the admin when any exam type's unseen pool drops below a threshold (configurable, default: 50 questions per active user).

---

## 4. Freemium, Coin System & Subscription Architecture

### Coin economy rules (implement exactly as specified)

**Earning coins:**
- Complete a quick mock (null attempts do not count): 5 coins
- Complete a full mock exam: 15 coins
- Complete an advanced mock: 25 coins
- Daily login streak (consecutive days): Day 1–6: 2 coins/day, Day 7+: 5 coins/day, streak broken: reset to Day 1 rate
- Watch a rewarded ad: 3 coins (AdMob rewarded ad unit — only award coins after ad_rewarded callback fires, never before)
- Successful referral (referred user completes first full mock): 20 coins to referrer, 10 coins to referred user
- First-time topic completion (all questions in a topic seen at least once): 10 coins

**Spending coins:**
- Unlock one advanced mock retake: 10 coins
- Unlock detailed performance analytics for one session: 5 coins
- Unlock one revision strategy (if paywalled): 8 coins
- Unlock leaderboard visibility for one week: 5 coins

**Coin economy constraints:**
- All earn and spend values above must be configurable from the admin panel without a code deploy. Store them as a config document in the database, not hardcoded.
- Display current coin balance persistently in the app header/navigation — update in real time on earn/spend with a micro animation (coin count increments visually, not jumps).
- Coin transaction history must be stored per user — every earn and spend event with timestamp, type, and amount. Accessible to the user in their profile and to the admin for support.

### Subscription tiers (Indian market)

**Free:**
- Quick mocks: unlimited
- Full mocks: 3 per week
- Advanced mocks: 1 per week
- Revision cards: basic set only
- Note-taking feature: included (retention hook)
- Gamification: visible but locked features gated by coins

**Freemium (coin/ad unlocked):**
- Additional mock attempts beyond free tier
- Detailed analytics for individual sessions
- Leaderboard visibility

**Subscription — ₹99/month or ₹799/year:**
- Unlimited mocks of all types
- Full revision strategy library
- Complete gamification system
- Weak area dashboard
- Priority support
- Ad-free experience
- Coin earnings doubled

**Payment:** Razorpay only. Implement Razorpay subscription billing for recurring plans. One-time coin purchases (if added later) also via Razorpay. No Stripe as primary — Razorpay handles UPI, cards, net banking, and EMI natively for India.

**Refund policy:** 7-day refund policy. State clearly on the subscription purchase screen before payment. Handle refund requests through admin panel — flag user account, process via Razorpay dashboard.

---

## 5. Premium Onboarding Flow

### Onboarding principles
Premium onboarding for a nursing study app is not animations and marketing slides. It is a focused 4-step setup that personalizes the app to the user before they see the home screen. Every step must have a micro animation on enter and exit.

**Step 1 — Exam selection:**
Which exam are you preparing for? (NEET-PG / NCLEX / State Board — list specific state boards / General Nursing)
Single select. Large tappable cards, not a dropdown.

**Step 2 — Exam date:**
When is your exam? Date picker. Show "X days remaining" updating live as they pick the date. If they don't know yet, allow "I'll set this later" — but nudge them to set it (this is the most important personalization data point).

**Step 3 — Current level:**
Where are you right now? (Just started / Mid-preparation / Final revision)
This sets the initial difficulty weighting for mock question selection.

**Step 4 — Referral entry (optional):**
"Were you referred by a friend? Enter their referral code." Pre-filled if opened via deep link. Clearly optional — do not gate progression on this step.

After step 4: animate into a personalized home screen that shows their exam countdown, their current question pool status, and their first recommended action — not a generic dashboard. The first recommended action should be "Take your first quick mock to establish your baseline."

**Referral ID display in profile:**
User must be able to see and copy their own referral ID from their profile screen at any time. One-tap copy with visual confirmation. One-tap share button that opens the native share sheet (Web Share API) with a pre-written message: "I'm using [App Name] to prepare for my nursing exam. Join me using my referral code [REFERRAL-ID] and we both get bonus coins! [deep link]"

---

## 6. Premium Class UI/UX Upgrades (Whole App)

### Micro animations — mandatory everywhere

This section defines the animation standard for the entire app. Every component listed must have these animations implemented. This is not a "nice to have."

**Buttons (all buttons in the app):**
- Tap/click: scale down to 0.96 on press, spring back to 1.0 on release. Duration: 100ms press, 200ms release. Easing: cubic-bezier(0.34, 1.56, 0.64, 1) (spring curve).
- Success state: brief color flash + scale to 1.05 then settle. Duration: 300ms total.
- Loading state: subtle pulse animation on the button background.

**Cards (mock cards, question cards, revision cards):**
- On appear: fade in + translate up 8px to 0px. Duration: 250ms. Stagger by 50ms if multiple cards appear simultaneously.
- On tap/hover: slight elevation increase (box-shadow deepens) + scale to 1.02. Duration: 150ms.

**Modals and popups:**
- Open: scale from 0.95 to 1.0 + fade in. Duration: 200ms. Easing: cubic-bezier(0.34, 1.56, 0.64, 1).
- Close: scale from 1.0 to 0.95 + fade out. Duration: 150ms.
- Backdrop: fade in to 0.5 opacity on open, fade out on close.

**List items:**
- On appear: staggered fade in + translate up 6px to 0px. 40ms stagger between items. Duration: 200ms each.

**Score/coin counter:**
- On increment: number ticks up visually (not jumps). Brief scale pulse on the counter element.
- Coin earn event: a coin icon animates from the earn source to the coin counter in the header (flying coin animation).

**Correct/wrong answer feedback:**
- Correct: green flash on the selected option + checkmark icon appears with a scale-in animation. Haptic feedback on Android (short vibration via Vibration API — check availability before calling, iOS will silently ignore).
- Wrong: red flash + shake animation on the selected option (translate -4px to +4px, 3 cycles, 300ms total). Correct answer highlighted simultaneously in green.

**Streak counter:**
- On streak increment: flame icon pulses + number increments with a bounce. Confetti burst if streak milestone is hit (7 days, 30 days, 100 days).

**Progress bars:**
- All progress bars animate to their target value on appear — never static. Duration: 600ms. Easing: ease-out.

**Page/screen transitions:**
- Forward navigation: new screen slides in from the right, previous screen slides out to the left. Duration: 300ms.
- Back navigation: reverse.
- Tab switches: cross-fade. Duration: 200ms.
- All transitions must use CSS transforms, not position changes.

### Score sharing card
Every completed mock must generate a shareable score card. Specifications:
- Generated as a canvas image in-app — no server rendering required.
- Design: app branding, user's score, exam type, date, weak areas highlighted, a motivational one-liner.
- One-tap share via Web Share API (navigator.share) — opens native share sheet on both iOS and Android.
- If Web Share API is not available (desktop without support): show a "Download image" fallback.
- The share card image must look premium — not a screenshot. Design it with the same design tokens as the app.

### Design token enforcement
Before implementing any UI change, extract the existing app's design tokens:
- Color palette (primary, secondary, success, error, warning, neutral scale)
- Typography (font family, size scale, weight scale, line height)
- Spacing scale
- Border radius values
- Elevation/shadow system
- Animation duration and easing values (add these if not already documented)

Document these in a `design-tokens.js` or `design-tokens.css` file if not already present. Every new component must use tokens, not hardcoded values.

---

## 7. Admin Panel Upgrades

The admin panel must be upgraded to support all new systems added in this document without requiring the solo founder to touch the database directly for routine operations.

**New admin panel sections required:**

**Referral Management:** Full referral table with search, filter by status, manual override capability, and fraud flag review queue.

**Question Bank Management:** Upload interface with schema validation, question set management, report review queue, question pool health dashboard, and per-question analytics (seen count, correct rate, report count, version history).

**Coin Economy Config:** Live editable config for all coin earn/spend values. Changes take effect immediately without deploy.

**Spaced Repetition Config:** Live editable config for all mastery intervals and mock question selection ratios.

**User Analytics:** Per-user view showing: exam target, exam date, days remaining, question pool status, mastery distribution, mock history (completed only — null attempts not shown), subscription status, coin balance, referral history.

**Question Pool Health Alert:** Dashboard widget showing unseen question pool size per exam type. Red/amber/green indicator. Email alert to admin when any pool drops below threshold.

---

## 8. Summary of All Systems Being Added or Upgraded

1. Referral ID generation, storage, display, sharing, and fraud prevention.
2. Deep linking for referral flow.
3. Abandoned/null attempt detection and enforcement across all exam types.
4. Per-user question history tracking and mastery level system.
5. Spaced repetition scheduling for question repetition.
6. Question selection algorithm for mock generation.
7. Question schema enforcement, bulk upload, soft-delete, and version history.
8. Question report system (user-facing flag + admin review queue).
9. Question pool health monitoring in admin panel.
10. Coin economy implementation with all earn/spend events, transaction history, and live config.
11. Razorpay subscription billing integration.
12. Premium onboarding flow (4 steps + personalized home screen).
13. Micro animations on every interactive element across the entire app.
14. Score sharing card generation and Web Share API integration.
15. Design token documentation and enforcement.
16. Admin panel upgrades for all of the above.

---

## 9. Implementation Order (Mandatory Sequence)

Work in this order. Do not skip ahead. Confirm with the user after each section before starting the next.

1. **Design tokens** — extract and document before touching any UI.
2. **Null attempt rule** — implement first because it affects data integrity of everything else.
3. **Question history tracking + mastery system** — foundational for question selection.
4. **Question selection algorithm** — depends on question history being in place.
5. **Question schema + admin upload system** — depends on schema being finalized.
6. **Question report system** — additive, no dependencies.
7. **Referral ID system** — self-contained, implement fully including admin panel section.
8. **Coin economy** — depends on null attempt rule being in place (coins only awarded on valid completions).
9. **Razorpay subscription** — depends on coin economy being in place.
10. **Onboarding flow** — depends on referral ID system being in place.
11. **Micro animations** — apply across the whole app as a dedicated pass after functional work is complete.
12. **Score sharing card** — additive, implement after animations pass.
13. **Admin panel upgrades** — implement alongside each system above, not as a final batch.

---

## 10. Testing Requirements

After each section:
- Run all existing tests. Zero regressions allowed.
- Test on: iOS Safari PWA (standalone mode), Android Chrome PWA (standalone mode), desktop Chrome, desktop Safari.
- Test on: small phone viewport (360px), large phone viewport (430px), tablet portrait (768px), tablet landscape (1024px), desktop (1280px+).
- Test the micro animations on all viewports — verify `prefers-reduced-motion` fallback works.
- Test all coin earn paths — verify no coins awarded on null attempts.
- Test referral fraud prevention — attempt self-referral, duplicate referral, immediate coin claim before qualifying action.
- Test question system — verify no question repeats within a session, verify spaced repetition scheduling is correct, verify mastery level transitions are correct.
