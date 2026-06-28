# NurseHolic — Master Plan & Issue Tracker

**Project:** NurseHolic: NORCET Exam Prep PWA
**Stack:** React + Vite + Supabase + Vercel + GitHub
**Domain:** nurseholic.in (primary) · nurseholic.com (redirect)
**Vercel Project:** `norcet-prep`
**Repo Status:** ✅ Private — keep private until public reveal
**Last Updated:** June 24, 2026

---

## How to Read This Document

This document covers everything — live bugs, feature roadmap, content strategy, monetization, legal, and infrastructure. It is divided into five phases in strict execution order.

| Phase | What it covers | When to work on it |
|---|---|---|
| **Phase 1** | Critical bugs | Right now, before anything else |
| **Phase 2** | Updates to existing features | After Phase 1 is fully resolved |
| **Phase 3** | New features | After Phase 1 & 2 are stable |
| **Phase 4** | Content engine & question bank | Runs in parallel with Phase 3 |
| **Phase 5** | Monetization, legal, brand, infra | After Phase 3 is complete |

> Items marked `⚠️ ADVISORY` are guardrails and policy notes — not tasks to build.

---

## Table of Contents

### Phase 1 — Critical Bug Fixes
- [BUG-01 — Back Button Broken](#bug-01--back-button-broken-on-android-ios-and-web)
- [BUG-02 — Glitched Background in Favourites](#bug-02--glitched-background-in-favourites)
- [BUG-03 — Test Starts on Row Card Tap](#bug-03--test-starts-on-row-card-tap-instead-of-start-button)
- [BUG-04 — Admin Panel Logic Broken](#bug-04--admin-panel-logic-broken-across-sections)
- [BUG-05 — Admin Helpfulness Section Broken](#bug-05--admin-helpfulness-section-clumsy-and-incomplete)
- [BUG-06 — Admin User ID Assignment Missing](#bug-06--admin-user-id-assignment-missing-from-profile)

### Phase 2 — Existing Feature Updates
- [FEAT-01 — Update pacing.js with NORCET Data](#feat-01--update-srclibpacingjs-with-verified-norcet-data)
- [FEAT-02 — Merge Study Plan + Rename Exam Date](#feat-02--merge-study-plan-into-sidebar--rename-exam-date-to-study-plan)
- [FEAT-03 — Topic Trend Short-Range Filters](#feat-03--topic-trend-short-range-filters)
- [FEAT-04 — Admin Panel RBAC & Security](#feat-04--admin-panel-role-based-access-control-rbac)
- [FEAT-05 — Sync & Auth Strategy](#feat-05--sync--auth-strategy)

### Phase 3 — New Features
- [NEW-01 — Premium Onboarding Flow](#new-01--premium-onboarding-flow)
- [NEW-02 — Demographic Data Collection in Onboarding](#new-02--demographic--academic-data-collection-in-onboarding)
- [NEW-03 — "Pulse Timer" Per-Question Progress Bar](#new-03--pulse-timer--per-question-animated-progress-bar)
- [NEW-04 — "Three-Wave" Pacing Practice Mode](#new-04--three-wave-pacing-practice-mode)
- [NEW-05 — "Distractor Assassin" Mode](#new-05--distractor-assassin-mode)
- [NEW-06 — "Tie-Breaker" Flash Scenarios](#new-06--tie-breaker-flash-scenarios-micro-learning)
- [NEW-07 — Advanced Post-Test Analytics Engine](#new-07--advanced-post-test-analytics-engine)
- [NEW-08 — Web-to-App CBT Desktop Simulator](#new-08--web-to-app-cbt-desktop-simulator)
- [NEW-09 — Interactive IBQ & VBQ Skill Drills](#new-09--interactive-ibq--vbq-skill-drills)
- [NEW-10 — Bedside Shift Simulator](#new-10--bedside-shift-simulator)
- [NEW-11 — Notification & Engagement System](#new-11--notification--engagement-system-save-for-later)

### Phase 4 — Content Engine & Question Bank
- [CONTENT-01 — AI Generation Pipeline & Prompts](#content-01--ai-generation-pipeline--prompts)
- [CONTENT-02 — Copyright Safety Rules](#content-02--copyright-safety-rules--advisory)
- [CONTENT-03 — Multi-Exam Expansion Strategy](#content-03--multi-exam-expansion-strategy)

### Phase 5 — Monetization, Legal, Brand & Infrastructure
- [BIZ-01 — The Death List: 20 Anti-Patterns](#biz-01--the-death-list-20-anti-patterns-to-avoid)
- [BIZ-02 — Freemium Monetization Model](#biz-02--freemium-monetization-model--implement-last)
- [BIZ-03 — Accuracy Wallet & Hearts System](#biz-03--accuracy-wallet--hearts-system--implement-last)
- [BIZ-04 — Pricing Strategy](#biz-04--pricing-strategy)
- [BIZ-05 — Early Adopter Pricing](#biz-05--early-adopter-pricing-founders-deal)
- [BIZ-06 — MVP Validation Strategy](#biz-06--mvp-validation-strategy)
- [BIZ-07 — Infrastructure Cost Blueprint](#biz-07--infrastructure-cost-blueprint)
- [BIZ-08 — Market Sizing](#biz-08--market-sizing-reference-data)
- [LEGAL-01 — Privacy Policy & T&C Updates](#legal-01--privacy-policy--terms--conditions-updates)
- [LEGAL-02 — Lean Legal Setup](#legal-02--lean-legal-setup-sole-proprietor)
- [LEGAL-03 — Trademark Filing Plan](#legal-03--trademark-filing-plan-for-nurseholic)
- [BRAND-01 — Brand Identity](#brand-01--brand-identity)
- [INFRA-01 — DNS & Infrastructure Config](#infra-01--dns--infrastructure-configuration-verified)
- [INFRA-02 — Git Workflow](#infra-02--git-workflow-solo-founder)
- [INFRA-03 — Domain Strategy](#infra-03--domain-strategy)
- [INFRA-04 — GitHub Repo Leak Prevention](#infra-04--github-repo-leak-prevention)
- [INFRA-05 — PWA Distribution & Growth](#infra-05--pwa-distribution--growth-strategy)

---

## PHASE 1 — Critical Bug Fixes

> These are live issues affecting real users on production. Fix these before touching any new feature.

---

### BUG-01 — Back Button Broken on Android, iOS, and Web

There is something wrong with the working of the back button in the sections inside the settings and sidebar sections. Sometimes when the user enters any section and taps the back button it stays in the same page. Fix this issue completely for the users of android, ios and web.

---

### BUG-02 — Glitched Background in Favourites

In the favourites section when the user adds and taps Mock test, topic test, quick test sections then a glitched background shows up for micro secs. Fix it properly.

---

### BUG-03 — Test Starts on Row Card Tap Instead of Start Button

In topic wise test section, the test should start only when the user taps the start button, not the whole area in the row card. Also in the review due section card, add a start button to it too and keep in mind the test should start only when the user taps the start button, not the whole area in the row card. This even applies to the ones related in the notification section. User should be atleast shown or cautioned before starting a test.

---

### BUG-04 — Admin Panel Logic Broken Across Sections

In the admin panel, check all the working of all sections inside it, some sections UI just works but the logic inside does not work as it was supposed to do and help the admin. What was found was that when tried to upload a content in the FAQ section then it did not work as it was supposed to. Inspect all the sections inside admin panel if their logic is working and functioning properly.

---

### BUG-05 — Admin Helpfulness Section Clumsy and Incomplete

In the admin panel, the helpfulness section UI/UX feels too clumsy and unorganized. It also does not have a clear history button (add caution to it). Or select a bunch of row cards and delete multiple or single row card option.

---

### BUG-06 — Admin User ID Assignment Missing from Profile

There was supposed to be a user id shown in the profile section which the owner can add or delete to make an admin of the app. Fix it and make it premium.

> **Note:** This connects directly to FEAT-04 (RBAC). Fix the UI first, then wire it to the role system in FEAT-04.

---

## PHASE 2 — Existing Feature Updates

> Updates to features that already exist. Build these after all Phase 1 bugs are resolved.

---

### FEAT-01 — Update `src/lib/pacing.js` with Verified NORCET Data

Update `src/lib/pacing.js` with verified NORCET-specific data — replace generic pace constants with **54s ceiling for Prelims** (5 sections × 20 questions × 18 min per section) and **67.5s ceiling for Mains** (4 sections × 40 questions × 45 min per section).

**Add topper target pacing as named constants per topic type:**

| Topic Type | Average Candidate | Topper Target |
|---|---|---|
| GK & Current Affairs | 35–45s | 15–20s |
| Aptitude & Reasoning | 70–90s | 45–60s |
| Fact-Heavy Nursing (Anatomy, Micro, BMW) | 45–50s | 25–30s |
| Conceptual Nursing (Pharma, MSN basics) | 55–65s | 40–45s |
| Priority/Clinical Nursing (Critical Care, Fundamentals) | 65–80s | 50–55s |

**Add as constants:**
- Negative marking: `-1/3` per wrong answer

**Add as comments (not code):**
- Toppers typically attempt only 78–85 out of 100 questions in Prelims due to negative marking risk — they do not attempt all questions
- Sectional lock system: each section locks after 18 minutes forever, so per-section pacing matters more than overall paper pacing

**Add as TODO comments only — do not implement yet:**
- Three-wave topper strategy: Sprint (0–8 min, sure-shot recalls, max 20s/question), Deep Dive (8–15 min, return to skipped clinical/aptitude with 60–80s buffer), Calculated Risk (15–18 min, eliminate 2 of 4 or skip entirely — never guess blindly)
- Topper tie-breaker rule: "If I can only do ONE thing and leave the room, which action keeps the patient alive?"
- Clinical priority frameworks: ADPIE (assess before intervening), ABCs (airway beats everything), Maslow (physiological before psychosocial), Acute vs Chronic (unexpected deterioration over expected symptoms), Least Restrictive first
- PwBD pacing considerations may differ

**Important:** If the new verified numbers reveal that `Results.jsx` or `StatsScreen.jsx` genuinely need updates to display topper benchmarks or Prelims vs Mains distinction correctly, make those changes too — but only if genuinely needed. Do not change anything just for the sake of it. Build must stay green.

---

### FEAT-02 — Merge Study Plan into Sidebar & Rename "Exam Date" to "Study Plan"

Remove the study plan section inside the revision section. The sidebar already has a similar section to it named as exam date. Replace the exam date section with it, everything inside it works the same. If something extra was there in study plan then append it to exam date. Also rename exam date to study plan. Also update every section related to the renaming. The help button contents, etc.

---

### FEAT-03 — Topic Trend Short-Range Filters

The topic trend section inside the stats section needs to add **1 week, 2 week, 3 week, 1 month, 2 month** filter to it just like it already has 3 month, 6 month, 12 months filter. Make it premium class.

---

### FEAT-04 — Admin Panel Role-Based Access Control (RBAC)

Separate UI visibility from backend authorization at all times.

**The Frontend vs. Backend Golden Rule:** Never trust the frontend. Even if the Admin UI is hidden for non-admins, a clever user can inspect code or network requests. Fix with **Supabase Row Level Security (RLS)** — even if an admin button is accidentally rendered, the database must reject any command from a user who does not have `role: 'admin'` in their Supabase `auth` metadata or `public.profiles` table.

**Three-tier Role Hierarchy:**
| Level | Role | Permissions |
|---|---|---|
| 1 | User | Take tests, view content, report bugs |
| 2 | Moderator | Review reported questions, edit rationales, Challenge/Verify content |
| 3 | Admin | Modify user accounts, payment settings, system configuration |

**Implementation inside the single PWA:**
- **Lazy Loading:** Do not bundle Admin Panel code with User Panel code. Use React `lazy` to only load Admin code after the server confirms the user has admin/moderator privileges.
- **Route Protection:** Wrap Admin routes in a `ProtectedRoute` component that checks `user.role` from the database. If not authorized, redirect to dashboard immediately.

**Immediate Next Step:**
1. Go to Supabase Authentication → Users tab
2. Add `role` column to `public.profiles` table (default: `'user'`)
3. Update RLS policies to check for `role` before allowing any `UPDATE` or `DELETE` on the `questions` table

> **Connects to:** BUG-06 — the User ID admin assignment UI wires into this role system.

---

### FEAT-05 — Sync & Auth Strategy

**The "Export/Backup" Hook:** Add a single low-friction **"Save my progress across devices"** button in Settings. When clicked, generate a simple 6-digit code or "Account Key." If the user switches to a different phone or laptop they just type that key in to restore their progress. Prevents progress loss when cache is cleared without requiring full auth.

**When to transition to Supabase Real Auth (Email/Google)** — only trigger when:
- They are about to make a payment (need to securely identify them)
- Users start saying "I tried the app on my tablet but my streak didn't transfer"

**The Architecture Secret:** Add a `user_id` column to all tables now, but keep app logic reading from `localStorage`. When ready to switch, change one line of code to fetch from Supabase instead. Zero migration headache later.

---

## PHASE 3 — New Features

> New features to build after Phase 1 and Phase 2 are fully stable. Listed in logical build order.

---

### NEW-01 — Premium Onboarding Flow

Add a premium-class onboarding flow with the following pages in this priority order:

- **Page 1 — App Pitch:** What an average NORCET aspirant is missing in their prep, how the app helps them improve, and why to use this app — keep it concise and fun, premium UI/UX
- **Page 2 — Library & Question Bank Explainer:** How the library bank works, why users need to download question sets, that they can also create their own custom question sets, and where to find these features inside the app — this is currently unclear to new users, keep it concise and fun, premium UI/UX
- **Last Page:** No skip button
- **All other pages:** Must have a Skip Tour button that is premium-class with an animated micro-interaction, so users who feel bored can exit the onboarding at any point

---

### NEW-02 — Demographic & Academic Data Collection in Onboarding

Update the onboarding flow to be lean and **DPDP Act compliant** — intentionally omit Caste/Category and Disability status to reduce friction. Collect only Gender and Employment Status.

**Why collect this data:**
- Gender → powers the Male-Pool Rank feature (filters mock leaderboard for the 20% male NORCET quota)
- Employment Status → powers the Pacing Engine (a working nurse cannot sit for a 3-hour mock on a Tuesday afternoon)

**3-Screen Onboarding Sequence:**

**Screen 1 — Demographic Alignment:**
> "To customize your leaderboard and target percentiles, please select your Gender."
- Options: Female / Male / Prefer not to say
- Trust copy: *"Why do we ask this? AIIMS applies a strict 80:20 gender quota. We use this data strictly to calibrate your simulated leaderboard ranks so you know exactly where you stand in your respective pool."*

**Screen 2 — Academic Profile:**
> "What is your highest educational qualification?"
- Options: B.Sc. Nursing / Post-Basic / GNM Diploma
- If GNM selected → show reassuring banner: *"Got it! We will unlock our Bedside-to-Theory translation drills to help you convert your clinical experience into high-yield exam marks."*

**Screen 3 — Time Availability / Employment Status:**
> "What does your current preparation schedule look like?"
- Options: Full-Time Aspirant (4+ hours/day) / Working Professional / Hospital Shifts (1–3 hours/day)
- If Working Professional → pop-up: *"We know working 12-hour shifts is exhausting. We are unlocking 'Hands-Free Audio Mode' and '5-Minute Micro-Drills' so you can study efficiently during your commute and hospital breaks."*
- If Full-Time Aspirant → pop-up: *"Great! You have the time to build serious stamina. We are unlocking the 'Desktop CBT Simulator' so you can practice 3-hour marathon tests just like the real exam day."*

**DB Schema:**
```json
{
  "user_id": "usr_908231",
  "gender": "male",
  "qualification": "GNM",
  "employment_status": "working_shift",
  "custom_target_percentile": 98.5
}
```

> **Note:** Default all `custom_target_percentile` values to the Open Merit / UR standard (98.5) regardless of actual category. Training all users to aim for the absolute highest standard ensures they are safe regardless of background.

---

### NEW-03 — "Pulse Timer" — Per-Question Animated Progress Bar

In quick test, topic wise test, mock test sections, add an optional Timer progress bar option just before proceeding the tests. What the timer progress bar will do is for each individual question it takes the average time required to solve a question and start reverse counting in the progress bar, the bar should have a visible colour grading animated feature where the timer starts from dark green when the user starts the question and then slowly it turns to yellow in the middle duration of the time and then slowly turns to red colour when the user has less time then turn to dark red when no time is left. This feature should be premium class. Place this timer progress bar somewhere in the page where it is visible to the user and feels dramatic. If possible add some short dialogues near to the progress bar such it creates an environment of fun, thriller, relief, excitement. Make this feature smartly and strategically. Give an interesting name to the timer progress bar.

---

### NEW-04 — "Three-Wave" Pacing Practice Mode

Instead of just offering a standard 18-minute countdown for 20 questions, build a dedicated **"Pacing Practice"** mode that forces users to adopt the topper strategy.

- **How it works:** The UI forces the user to do the "Sprint" wave first. It flashes questions on the screen with a strict 25-second timer per question. If they don't answer or skip, it auto-advances.
- **The Benefit:** It physically prevents users from getting "stuck" on a hard question for 3 minutes, breaking their bad habits and training them to bank time for the harder questions in the second wave.

---

### NEW-05 — "Distractor Assassin" Mode

Most apps just ask: "What is the right answer?" This feature flips the script to train clinical elimination frameworks (ABCs, Maslow).

- **How it works:** Present a long clinical scenario with four options. Instead of clicking the right answer, the user must click the worst option first to eliminate it, and select why (e.g., "Violates ABCs," "Expected Chronic Finding").
- **The Benefit:** In actual exams, candidates often narrow it down to two options and freeze. Training them to actively hunt and kill the "distractors" builds immense confidence.

---

### NEW-06 — "Tie-Breaker" Flash Scenarios (Micro-Learning)

Capitalize on the short bursts of time users have while commuting or waiting in line.

- **How it works:** A rapid-fire, TikTok-style feed of ultra-short scenarios. But instead of four options, there are only two. Both options are correct nursing interventions, but the user has exactly 10 seconds to swipe right or left on the priority action.
- **The Benefit:** It isolates and drills the hardest part of the exam — choosing between two "right" answers — in a highly engaging, low-friction format.

---

### NEW-07 — Advanced Post-Test Analytics Engine

Check what is already implemented in the results/stats section and only add what is missing. Make everything premium class.

> 📎 **Reference prototype:** See `analytics-prototype.html` (delivered alongside this document) for full UI/UX and interactive logic reference.

**Features to check and add if missing:**

**1. 1/3rd Negative Marking "What-If" Simulator**
Instead of just telling students their score was low, mathematically prove why. Let them drag "Doubtful Guesses" to zero to physically demonstrate how their final estimated rank/percentile increases by exercising restraint.
- Sliders: total questions attempted, doubtful guesses taken
- Live output: final raw score, negative penalty cost, estimated NORCET percentile
- Dynamic status badge: SAFE / BORDER / RISKY
- Topper insight callout: *"Every 1 mark lost to negative penalty drops your ranking by roughly 350+ spots in general-pool competition."*

**2. Confidence-vs-Accuracy (Doubt Mapping) Matrix**
During tests, prompt the user to tag each answer with a confidence level (Sure / Unsure). Post-test, map performance into a four-quadrant grid:
| Quadrant | Confidence | Result | Action |
|---|---|---|---|
| 🟢 Sweet Spot | High | Correct | No action needed |
| 🚨 Fatal Danger Zone | High | Incorrect | Flag and target first — fatal misconceptions, maximum negative penalty |
| 🎲 Lucky Guesses | Low | Correct | Flag for conceptual revision anyway |
| 📖 Clear Knowledge Gaps | Low | Incorrect | Feed into basic subject-wise modules |

**3. Clinical System Leak Radar**
Instead of grouping progress by textbook chapters, map mistakes to clinical systems (Cardiovascular, Respiratory, Endocrine, etc.) with a leak severity indicator. Recommend system-specific revision modules directly from this view.

**4. Lock-Section Stress Training / High-Stress Drill**
Since NORCET features rigid 18-minute section clocks, users frequently panic-guess in the final 2 minutes. Introduce a High-Stress Drill that locks sections sequentially with a subtle visual trigger as the final 90 seconds approach. Builds psychological stamina and prevents emotional guessing.

**5. Strategic Benchmark Comparison Panel**
Show a simple comparison of the user's metrics vs topper targets:
| Metric | Topper Target |
|---|---|
| Total Attempts / 100 | 78–85 Qs |
| Blind Guesses | Zero |
| Clinical Scenario Speed | < 50s per Q |
| Mains Section Accuracy | > 82% |

---

### NEW-08 — Web-to-App CBT Desktop Simulator

**The Problem:** Mobile apps are perfect for quick learning on a hospital shift, but terrible for simulating a full 100-question mock exam. Real NORCET exams are taken on desktop computers in a dedicated CBT hall. Aspirants complain bitterly on the App Store when premium test series cannot be taken on laptops.

**The Solution:**
- **Desktop CBT Environment:** Build a web companion dashboard (`cbt.nurseholic.in`) that perfectly replicates the exact CSS layout, color scheme (marked for review, unattempted, locked sections), and keyboard shortcut behaviors of the actual AIIMS testing centers.
- **App-to-Web Handshake:** The student uses their phone to scan a QR code on their laptop screen to instantly cast their active mock exam to the web browser. Ensures they are physically comfortable with desktop navigation before exam day.

---

### NEW-09 — Interactive IBQ & VBQ Skill Drills

**The Problem:** The modern NORCET exam features Image-Based Questions (IBQs) and Video-Based Questions (VBQs) — ECG monitors, mechanical ventilators, infusion pumps, surgical retractors, tracheostomy suctioning, urinary catheterization. Most apps display a flat, low-resolution photo with an MCQ.

**The Solution:** Build a dedicated **"Instrument Lab"** or **"Clinical Skill Drill"** module:

- **Hotspot Identification:** Instead of MCQ, show an image of an ICU ventilator or central venous catheter line and ask the user to "Tap on the alarm mute button" or "Select the proximal port."
- **Interactive Procedure Sequencing:** Present a scrambled visual timeline of steps for an emergency procedure (e.g., CPR or chest tube insertion). The user must drag and drop the cards into the correct clinical sequence.

---

### NEW-10 — Bedside Shift Simulator

Build a dedicated **"Shift Simulator"** tab — converts 15-page nursing college case studies into 1-minute, highly interactive micro-drills.

**Goal:** Increase DAU by providing a gamified, low-friction practice mode that working GNM nurses can play during 5-minute hospital breaks.

**Entry point:** "Start My Shift (5 Mins)" button on dashboard.

**The Vibe:** Instead of "Question 1 of 5," the header displays a patient tag (e.g., *"Bed 4 - Male 55yrs - Post-CABG"*) to simulate a real hospital handoff. 60-second progress bar per scenario. Completing a shift extends their **"Shift Streak"** 🔥 and earns **"Accuracy Coins."** If a user makes a fatal error (e.g., giving IV Potassium as a bolus), the screen flashes red, the shift ends early, and they are forced to read **"The Autopsy"** (clinical rationale) before trying again.

**Four Modules:**

**Module A — The BMW Sorter (Tinder-Style Swipe / Drag-and-Drop)**
A soiled item image appears (Blood bag, Used syringe with needle, Expired cytotoxic drug). User drags it into the correct 2D colored bin (Yellow / Red / White / Blue). Rationale: MoHFW Indian Guidelines on waste segregation.

**Module B — The Skill Sequence Builder (Drag-and-Drop Reordering)**
5 steps of a clinical procedure presented out of order (Tracheostomy Suctioning, Donning PPE). User drags steps into correct chronological order. Rationale: Infection control and standard nursing care plans.

**Module C — The Crash Cart / Med-Math Crisis (Visual MCQ)**
A patient crisis is described (SVT on monitor, HR 180). User selects from 4 images of drug ampoules (Adenosine, Amiodarone, Atropine, Adrenaline) and selects the correct IV push speed. Rationale: Emergency pharmacology and ACLS guidelines.

**Module D — The ICU Monitor Diagnostic (Audio/Visual Hotspot)**
Shows a looping GIF of an ECG rhythm or a ventilator screen photo. Bonus: play the actual high-pressure or low-volume beep audio. *"Identify the rhythm"* or *"What is the priority nursing action for this alarm?"* Rationale: Advanced Medical-Surgical nursing case studies.

**JSON Schema — Interactive Question Types:**

The database must support a master `question_type` key. Frontend uses switch/if-else:
- `standard_mcq` → render standard text buttons
- `visual_mcq` → render a 2×2 grid of images
- `bmw_sort` → render colored dustbins and draggable item
- `drag_sequence` → render reorderable step cards

**Media in prompt** (e.g., ECG GIF + alarm audio): use `prompt_media` object with `image_url`, `image_alt`, `audio_url` fields.

**Media in options** (e.g., drug ampoule images): set `question_type: "visual_mcq"` and add optional `image_url` to each option object.

**Example — Drag Sequence Question:**
```json
{
  "id": "shift_seq_001",
  "module": "Skill Sequence",
  "patient_tag": "Bed 2 - Isolation Ward",
  "question_type": "drag_sequence",
  "scenario": "You are preparing to enter the room of a patient with confirmed H1N1 Influenza. Drag the PPE items into the correct donning sequence.",
  "items": [
    { "id": "A", "text": "N95 Respirator" },
    { "id": "B", "text": "Gown" },
    { "id": "C", "text": "Gloves" },
    { "id": "D", "text": "Goggles / Face Shield" },
    { "id": "E", "text": "Perform Hand Hygiene" }
  ],
  "correct_sequence": ["E", "B", "A", "D", "C"],
  "detailed_rationale": "According to CDC/WHO guidelines, hand hygiene is always first. Gown next. Mask/respirator next, followed by goggles/face shield. Gloves are always last.",
  "citations": {
    "global_standard": "WHO Guidelines on Infection Prevention and Control (PPE Donning Sequence)."
  }
}
```

**Claude Prompt for Generating Shift Simulator Content:**
```
Act as a strict Clinical Instructor at AIIMS Delhi. Generate JSON question files for the 'Bedside Shift Simulator.'

Task: Generate 5 highly practical, bedside nursing scenarios.
- Do NOT ask direct theoretical questions.
- Put the nurse in the room. Describe the patient's visual presentation, an alarm sound, or a specific task.

Format: Output valid JSON using the schema provided.
Types required: 2 'drag_sequence', 2 'bmw_sort', 1 'visual_crisis'.
Cite standard nursing protocols and Indian MoHFW guidelines where applicable.
```

**Telegram/WhatsApp Launch Drop:**
> *"Tired of memorizing 20-page Nursing Care Plans? 🏥 We just launched the 'Bedside Shift Simulator'. It converts your college case studies into 60-second clinical reflex games. Test your bedside instincts on real ICU ventilator alarms, Crash Cart drugs, and MoHFW BMW management. Try a free 5-minute shift here: [Your PWA Link]"*

---

### NEW-11 — Notification & Engagement System *(Save for Later)*

> Do not implement now. Build after the core feature set is stable.

- **Subscription Expiry Alerts:** Banner or push notification 30 days, 7 days, and 1 day before expiry
- **Weekly/Monthly Activity Digest:** Questions attempted, topics covered, mock tests taken, upcoming spaced reviews due — as push notification or home screen card
- **Exam Date Countdown:** Smart notifications at 60 days, 30 days, 7 days, and 1 day before NORCET with a motivational message and suggested study action for that day
- **Announcements Card:** App updates, new question bank additions, new features, important NORCET news — admin-controlled, pushed from the admin panel
- **Streak Reminder:** Daily push notification if user hasn't opened the app by a certain time — *"Your streak is at risk! Open NurseHolic and study for 10 minutes."*

---

## PHASE 4 — Content Engine & Question Bank

> Runs in parallel with Phase 3. A 9.5/10 app with 50 questions loses retention fast. A 9.5/10 app with 500+ questions becomes a daily habit. Target: 500 elite questions before public launch.

---

### CONTENT-01 — AI Generation Pipeline & Prompts

**The 40/30/30 Content Split Strategy:**
| Type | Share | Description |
|---|---|---|
| Syllabus-Core | 40% | Essential knowledge, high-yield textbook-standard questions |
| PYQ-Relatable | 30% | Modeled on Previous Year Question patterns and difficulty distributions |
| Out-of-the-Box (Clinical Edge) | 30% | Complex multi-concept scenarios requiring application of multiple nursing frameworks |

**System Audit Prompt — Run Before Every Session:**

Before generating any content, paste your current prompt and ask Claude to audit it against these four criteria:
1. **UNIFORMITY** — Does it ensure the JSON schema is always identical for the database?
2. **UNIQUENESS** — Does it actively prevent the AI from repeating clinical patterns?
3. **DEPTH** — Does it enforce ADPIE/ABCs frameworks?
4. **CITATION** — Does it force verifiable clinical citations vs. hallucinated page numbers?

Do not proceed until Claude responds: *"Protocol Installed. Standing by for your first clinical topic."*

**Standard Batch Prompt (5 questions):**
```
Act as a senior clinical instructor for AIIMS NORCET. Generate 5 original clinical MCQs.

Content Mix:
- 2 Syllabus-Core (Essential knowledge)
- 2 PYQ-Relatable (Based on AIIMS exam patterns)
- 1 Out-of-the-Box (A complex, multi-concept clinical scenario)

Constraints:
- Format: Valid JSON matching the established database schema
- Citations: Real-world clinical guideline references (AHA, WHO, MoHFW)
- Explanation: Detailed rationale for why the correct answer is the priority
- Labeling: Include 'question_type' field: 'core', 'pyq_style', or 'clinical_edge'
```

**Scale-Optimized Batch Prompt (10 questions — use for high-volume generation):**
```
Act as a senior clinical instructor for AIIMS NORCET. Generate a batch of 10 original MCQs.

Uniqueness & Anti-Pattern Protocol (STRICT):
- Global Uniqueness: No clinical scenario, patient age, or setting repeated within this batch
- Framework Shuffle: 3x ABCs, 3x ADPIE, 2x Maslow/Safety, 2x Stable/Unstable
- Numerical Randomization: All dosage values must be randomized (e.g., 12.5mg, 45mcg) — use decimals to prevent rote memory
- Distractor Complexity: Every wrong answer MUST be a plausible clinical "next step" — no obviously wrong distractors

Content Mix:
- 4 Syllabus-Core
- 3 PYQ-Relatable
- 2 Out-of-the-Box (Complex Scenario)
- 1 Domain-Specific Bonus (Healthcare GK / Nursing Aptitude)

Format: Valid JSON array of 10 objects matching the database schema.
Validation: Include a 'logic_check' field for every question detailing the priority framework used.
```

**Gold Standard Protocol (install at start of every session):**
- **ANTI-PATTERN:** Always rotate clinical frameworks (ABCs, ADPIE, Maslow), randomize patient age/setting/dosage values, every distractor must be a plausible clinical action
- **OUTPUT:** Always output a valid JSON array. Required fields: `id`, `system`, `framework`, `difficulty`, `question`, `options` (key/text), `correct_key`, `detailed_rationale`, `citations`, `pacing_metrics`
- **CITATIONS:** Cite Saunders Chapter/Topic only — not hypothetical page numbers. Flag all questions derived from Indian National Health Protocols (MoHFW)

**Production JSON Schema:**
```json
{
  "id": "q_unique_id",
  "system": "Cardiovascular",
  "framework": "ADPIE",
  "difficulty": "Hard",
  "question_type": "clinical_edge",
  "question": "...",
  "options": [
    { "key": "A", "text": "..." },
    { "key": "B", "text": "..." },
    { "key": "C", "text": "..." },
    { "key": "D", "text": "..." }
  ],
  "correct_key": "B",
  "detailed_rationale": "...",
  "logic_check": "Applied ADPIE — assessment before intervention. Option B assesses before acting.",
  "citations": {
    "global_standard": "Saunders Comprehensive Review (9th Ed.), Chapter 33: Cardiovascular Disorders.",
    "international_protocol": "AHA/ACC Guidelines for Coronary Artery Revascularization.",
    "national_indian_guideline": "MoHFW Clinical Practice Guidelines for Post-PCI Management."
  },
  "pacing_metrics": {
    "target_time_seconds": 55,
    "pacing_tier": "Priority/Clinical"
  },
  "target_exams": ["NORCET", "ESIC", "JIPMER"]
}
```

**Chunked-Loop Scaling Strategy (for 100+ questions):**
- Do not generate 100 questions in one prompt — the model will lose the Anti-Repeat constraint
- 10 questions per batch is the Goldilocks Zone
- Pipeline: Batch 10 (Clinical Topic X) → review/append to `master_questions.json` → Batch 10 (Clinical Topic Y) → repeat
- Do a "Template Check" on every 3rd batch — if the model repeats a "Patient in ICU" template, force a "Scenario Reset"
- Keep one `master_questions.json` file and append each batch to the array

**Human-in-the-Loop Verification — check each question against:**
- Core Check: does it feel foundational?
- PYQ Check: does it feel like a question from a recent paper?
- Edge Check: does this make you think *"I haven't seen this phrasing before, but it's a great test of clinical judgment"*?

**Implementation Checklist before upload:**
- [ ] Run data sanitization script — every question must have valid `id`, `system`, and `citation`
- [ ] Verify framework distribution across the batch
- [ ] Add "Report Question" button to dev build immediately — even with one user this is the most important feedback field

---

### CONTENT-02 — Copyright Safety Rules *(⚠️ ADVISORY)*

> This is a policy guardrail, not a feature to build. Read before every content generation session.

**HIGH RISK — Never do this:**
- Direct copying of questions, options, or rationales from Saunders, PR Yadav, or Target High
- "Spinning" or light rewording (changing "Mr. Sharma" to "Mr. Gupta") — still legally a Derivative Work
- Feeding copyrighted questions into Claude with "Rewrite this to avoid copyright" — the AI is structurally mimicking the copyrighted expression, still legally dangerous

**SAFE — Always do this:**
- Facts are not copyrighted — no publisher owns the fact that the antidote for Heparin is Protamine Sulfate
- Use book indexes only to identify high-yield topics, then generate completely original scenarios about those topics

**Prompting strategy:**

❌ **DO NOT:**
> *"Here is a question from Target High: [Pasted Question]. Rewrite it so I can use it in my app."*

✅ **DO THIS:**
> *"Act as an expert AIIMS nursing educator. I need to test knowledge on the Parkland Formula for burn fluid resuscitation. Create a completely original, NCLEX-style patient scenario for a 45-year-old male with 30% TBSA burns. Do not copy from any existing textbooks. Generate your own unique patient vitals and distractors. Output in JSON."*

**Citation Strategy:** Citing books in rationales is legal under Fair Dealing (India) provided the citation is only a reference pointer and no text from the book is copied. Example:
> *"The priority action is to assess the airway. (Source: Saunders Comprehensive Review 9th Ed., Chapter 33, Page 412)"*
This is legal because it merely points the user to the textbook for further reading.

---

### CONTENT-03 — Multi-Exam Expansion Strategy

Targeting exams beyond NORCET turns the app into a year-round subscription.

**The Big Three Central Exams (immediate easy wins):**
| Exam | Syllabus Overlap | Notes |
|---|---|---|
| ESIC | ~90% | Huge vacancies, excellent perks |
| RRB Staff Nurse | ~80% | Slightly more GK and basic science than NORCET |
| DSSSB | High | Dream posting for Delhi NCR aspirants |

**State PSC Exams (volume play):** UP (UPPSC), Rajasthan (RPSC), Kerala — massive applicant volume, lower difficulty, more direct one-liner questions.

**Elite Autonomous Institutes (prestige play):**
- NIMHANS (Bengaluru) — heavy Psychiatric and Neurological nursing focus
- JIPMER (Puducherry) & PGIMER (Chandigarh) — AIIMS-level difficulty
- Sell **Specialty Booster Packs** (e.g., "NIMHANS Psych-Booster — ₹49") ahead of specific exam dates

**The Golden Goose — NCLEX-RN & OET (international):** Nurses preparing for USA/UK/Australia. Their purchasing power is drastically higher — easily charge ₹999–₹1,499/month using the same app engine.

**Technical implementation — no new app needed:** Add `target_exams` array to JSON schema (see CONTENT-01). During sign-up: "Which exam is your primary focus?" UI banner changes from "NORCET Pro Mode" to "RRB Staff Nurse Mode" based on selection. User feels the app is 100% custom-tailored to their goal.

---

## PHASE 5 — Monetization, Legal, Brand & Infrastructure

> Work on this phase after Phase 3 is complete. Monetization features are explicitly marked for last.

---

### BIZ-01 — The Death List: 20 Anti-Patterns to Avoid

Build NurseHolic as the "Anti-Competitor." Every item below is a reason users delete nursing prep apps and leave scathing reviews.

**Content Quality:**
| Pain Point | Fix |
|---|---|
| Wrong Answer Key Syndrome | "Correction Bounty" system — reward users for reporting bugs |
| Shallow Rationales ("A is correct") | Mandatory "Rationale Drawers" explaining why all three wrong options are incorrect |
| Outdated Clinical Protocols | Explicit "Citations" tag to prove guidelines are current |
| Repetitive Question Banks | Uniqueness Protocol — rotate systems, patient ages, settings |
| No Real-World Relevance | Bedside Shift Simulator — clinical decisions, not definitions |
| Blurry IBQ Images | Use descriptive text or schematic diagrams if high-res unavailable |
| Robot Tone | Infuse rationales with "Clinical Mentor" voice: *"As a nurse, your first check is..."* |
| Missing Practical Syllabus | Procedural sequencing modules (PPE, BMW) |

**User Experience:**
| Pain Point | Fix |
|---|---|
| Paywall-First Design | Sachet pricing — give high-quality UI/UX free, lock convenience for paid |
| Bloated/Confusing UI | Ruthless minimalism — 80% focus, 20% navigation |
| Ghosting After Purchase | Even a solo *"I'm looking into it"* response saves a refund request |
| Broken Bookmark/Saving | Robust local-first database that syncs bookmarks instantly |
| No Night Mode | Default Dark Mode or easy-access toggle |
| Toxic Leaderboards | League-based rankings (cohorts of 50) not a global list of 50,000 |

**Technical Reliability:**
| Pain Point | Fix |
|---|---|
| App Crashes During Mocks | Local-first storage approach (saving to device) |
| Broken Timers | Custom timer engine mimicking real AIIMS CBT screen exactly |
| No Offline Mode | Service Workers (PWA offline caching) |
| Breaks on Low-End Phones | Responsive design testing — if it breaks on a low-end phone, it's unusable for the target audience |
| No Challenge Mechanism | "Challenge Question" button that emails the specific question ID |
| Aggressive Auto-Renewals | Clear "End of Cycle" notifications, stop auto-renewal prompts after exam |

---

### BIZ-02 — Freemium Monetization Model *(Implement Last)*

> ⚠️ Build only after all Phase 1–3 features are fully built and stable.

**Golden Rule:** Give away core educational value for free. Charge for convenience, speed, and advanced analytics.

| Feature | Free Tier | Premium Unlock |
|---|---|---|
| Night-Shift Audio Pod | See button, get paywall popup | Hands-Free Mode — ₹149/month |
| Ward Slang Translator | 3 free translations/day | Unlimited — upgrade prompt on 4th click |
| CBT Desktop Simulator | Take mocks on mobile only | "Cast to Desktop" via QR code |
| Accuracy Wallet / Hearts | 5 Clinical Lives/day, locked out 12hrs if all lost | Infinite Lives |
| Bedside Shift Simulator | Unlimited General Ward | ICU & Emergency Ward locked |

**Technical Implementation (stay lean):**
- No Stripe or Razorpay Subscriptions yet
- Basic UPI QR code or Razorpay payment link
- Sell "Passes" not subscriptions
- On payment: flip `user.is_premium = true` + attach expiration date

---

### BIZ-03 — Accuracy Wallet & Hearts System *(Implement Last)*

> ⚠️ Subsection of the Freemium Playbook. Implement last.

**In-App Economy:**
| Action | Result |
|---|---|
| Correct Answer | +10 🪙 Accuracy Coins |
| Deliberate Skip (leaving blank) | +3 🪙 Accuracy Coins — rewards strategic discipline |
| Incorrect Guess | Lose 1 ❤️ Clinical Life + -8 🪙 Accuracy Coins |

**Zero Hearts — Penalty Box:** Benched for 4 hours.

**Recovery options:**
1. Wait — 1 Heart regenerates every 2 hours
2. Autopsy Review — answer 3 past mistakes correctly in the Mistake Book
3. Premium Pass — Infinite Lives
4. Viral Rescue — "Need a Heart now? Ask a study partner." → generates WhatsApp referral link → instant 1 Heart on successful share

**Referral Economy:**
- Successful invite (friend creates account) = +1,000 🪙 Accuracy Coins
- In-app store: pay ₹149 OR spend 2,500 coins for a 3-Day Premium Pass
- Psychology: users who can't afford ₹149 will share the app to 3 Telegram groups to earn enough coins for the weekend

**UI/UX during exam:**
- **"Bank It" Button:** Distinct, differently-colored button next to Next/Save: *"🛡️ Skip & Bank (+3 Coins)"*
- **HUD:** Pin ❤️ and 🪙 balance to the top-right of the screen in real-time

**Post-Test "What-If" Simulator:**
Show the alternative reality after every test:
- Actual Raw Score
- Total Negative Penalty Leak (e.g., -6.66 marks from 20 wrong guesses)
- Interactive toggle: *"What if I skipped my weak guesses?"* → animation recalculates score and shows exact rank jump (e.g., 52.33 → 59.00, +3,200 rank positions)

---

### BIZ-04 — Pricing Strategy

**Sachet Pricing Sweet Spot:** ₹99–₹149/month. Do not charge for basic MCQs — Testbook has driven that price to near zero.

**Individual Feature Pricing:**
| Feature | Price | Notes |
|---|---|---|
| CBT Simulator — Exam Season Pass (3 months) | ₹299 | For serious aspirants in final 2 months |
| CBT Simulator — Weekend Warrior Pass (3 days) | ₹49 | Micro-transaction for exam weekend |
| Bedside Shift Simulator ICU & ER (Lifetime) | ₹149 | One-time unlock |
| Night-Shift Audio Pod (monthly) | ₹99/month | Treat like Spotify |
| Accuracy Wallet / Infinite Hearts (30 days) | ₹79 | Price high — push users to "Pay with a Share" |

**Recommended Bundle — "NORCET Pro":**
| Plan | Price | Unlocks |
|---|---|---|
| 1 Month Pro (The Tester) | ₹149 | Audio Pod + CBT Desktop + ICU Modules + Infinite Hearts |
| 3 Month Pro (The Exam Cycle) | ₹349 | Same as above — best value for prep season |

**Freemium Bypass:** *"Can't pay? Invite 3 friends who create an account and get 1 Month Pro for FREE."* (Powered by Accuracy Wallet referral logic.)

---

### BIZ-05 — Early Adopter Pricing (Founder's Deal)

Offer the **"Founder's Deal"** — 75% off + double the duration (effectively 87% off true value) for the first batch of beta testers.

**NORCET Pro Bundles:**
| Plan | Beta Price | True Value | Savings |
|---|---|---|---|
| Beta Tester Pass (2 Months) | ₹39 | ₹298 | 87% OFF |
| Exam Season Pass (6 Months) | ₹89 | ₹698 | 87% OFF |

**Standalone A La Carte:**
| Feature | Beta Price | True Value |
|---|---|---|
| Night-Shift Audio Pod (2 Months) | ₹25 | ₹198 |
| Desktop CBT Simulator (6 Months) | ₹75 | ₹598 |
| Bedside Shift Simulator (Lifetime + 1 Gift Code) | ₹39 | ₹298 |

> The Bedside Shift Simulator "Buy 1, Gift 1" deal gives them lifetime access AND a code to give a study partner lifetime access — incentivizes viral sharing.

---

### BIZ-06 — MVP Validation Strategy

**Honest assessment:** Users will not pay for generic MCQs. They will pay for high-pain solutions (Desktop CBT, Shift Simulator) even if the app is imperfect.

**Strategy A — Founder's Lifetime Deal (Wallet Test):**
> *"I'm building a next-gen NORCET app. It's in beta and has bugs. But if you buy the 'Founder's Pass' today for ₹49, you will get Lifetime Premium Access when we officially launch at ₹149/month."*

If 10 people pay ₹49 → proof that people will pay for the Blue Ocean features.

**Strategy B — Feedback Paywall (Time Test):**
Give 3 days of full Premium free → lock on day 4 → popup: *"Your trial ended! Fill out this 3-minute Google Form about the Bedside Shift Simulator to unlock 7 more days."*

If they won't spend 3 minutes they were never going to pay ₹149. If they do → invaluable product feedback.

**Strategy C — Social Currency (Share Test):**
> *"This feature is Premium. Pay ₹99 to unlock, OR invite 2 friends from your nursing college to get it for free."*

Even if 0% pay ₹99, if 40% invite 2 friends → user base explosion at zero cost.

**The "Painted Door" Experiment:**
Put a visible *"Upgrade to Pro — ₹99/mo"* button in the PWA. When clicked, do not ask for payment — show:
> *"Thanks for the interest! Enter your WhatsApp here and we'll give you 50% off at launch next week."*

**Metric:** If 15 out of 100 users click that button and leave their number → 100% mathematical proof of market demand.

---

### BIZ-07 — Infrastructure Cost Blueprint

Target scale: 0 to 1,000 MAUs.

| Service | Technology | Monthly Cost |
|---|---|---|
| Frontend Hosting | Vercel / Netlify | ₹0 (Free Tier) |
| Backend & DB | Supabase (PostgreSQL) | ₹0 (Free Tier, 50,000 MAU) |
| AI Generation | Claude API (offline batching) | ₹0 (pre-generated, ~₹800 one-time) |
| Audio (TTS) | Web Speech API (local on device) | ₹0 |
| Media Storage | Cloudinary (25GB free) | ₹0 |
| Domain | nurseholic.in (Namecheap) | ~₹66/month (₹800/year) |
| **Total Monthly Burn** | | **~₹66/month** |

**Profit math:** 100 premium users × ₹149/month = ₹14,900/month revenue at ~95% profit margin.

---

### BIZ-08 — Market Sizing (Reference Data)

| Data Point | Figure |
|---|---|
| Registered nursing personnel in India | 42.94 Lakh (4.29M) |
| New nursing graduates per year | ~3.87 Lakh (387,000) |
| NORCET 10 (2026) registrations | ~97,000+ |
| NORCET 10 (2026) appeared | ~92,000+ |
| Exam frequency | Twice per year |
| Conservative serious aspirant pool (per 6-month cycle) | ~100,000 |

**Revenue Scenarios:**
| Scenario | Users | Revenue |
|---|---|---|
| 0.5% market share | 500 paying users × ₹89 | ₹44,500 |
| 1% market share | 1,000 × ₹89 + 500 × ₹39 | ₹1,08,500 (~99% margin) |

**The Verdict:** Solving just one major pain point better than the PDFs they currently read will organically capture 1% of the market through Telegram and WhatsApp word-of-mouth alone.

---

### LEGAL-01 — Privacy Policy & Terms & Conditions Updates

> ⚠️ Have a qualified Indian tech/IP lawyer review final documents before publishing. DPDP Act, 2023 compliance required.

**Privacy Policy — Data Collection Clause (add this):**
> *"To provide accurate, personalized exam simulations and study recommendations, we collect specific demographic and professional information during account creation. This includes your Gender, Educational Qualification (e.g., GNM, B.Sc.), and current Employment Status or study availability."*

**Privacy Policy — Purpose of Data Processing (add this):**
> *"This data is used strictly for internal app personalization. Gender data is used exclusively to calibrate your simulated exam results and generate relative rank lists in accordance with the official AIIMS NORCET guidelines (the 80:20 gender ratio). Employment status is used solely to adapt your study dashboard to recommend appropriately timed practice modules. We do not use this data for discriminatory purposes, nor do we sell this profile data to third-party advertisers."*

**T&C — Educational & AI Disclaimer (add this):**
> *"The content provided in this application, including clinical scenarios, questions, and rationales, is generated using advanced AI systems and reviewed for educational and examination preparation purposes only. It does not constitute professional medical advice, diagnosis, or treatment. While we strive for accuracy, medical protocols change frequently. The App owners shall not be held liable for any clinical decisions made, or exam marks lost, based on the information provided in this app."*

**T&C — Intellectual Property & Fair Dealing Clause (add this):**
> *"This application operates independently and is not affiliated with, endorsed by, or officially connected to AIIMS, the Ministry of Health and Family Welfare, Elsevier (Saunders), CBS Publishers, or any other textbook publisher or government body. Any mention of third-party trademarks, textbook titles, or examination names is done strictly for nominative fair use to map syllabus requirements and provide educational citations."*

**T&C — Anti-Scraping Clause (add this):**
> *"All original clinical scenarios, questions, and rationale structures presented in the app are the intellectual property of [Your App Name]. Users are granted a limited, personal, non-commercial license to use the app. Automated scraping, copying, reproducing, or redistributing the application's question bank to competing platforms, Telegram channels, or other public forums is strictly prohibited and will result in immediate account termination and potential legal action."*

---

### LEGAL-02 — Lean Legal Setup (Sole Proprietor)

| Action | Status | Notes |
|---|---|---|
| Pvt Ltd / LLP Registration | ❌ Not now | Annual compliance, CA fees — not worth it yet |
| Sole Proprietor operation | ✅ Do this | Just PAN + Aadhaar + savings bank account |
| Udyam Certificate (MSME) | Optional later | Free, 10 minutes, gives government-recognized status |
| Razorpay / Cashfree (Individual) | ✅ Do this | ~2% per transaction, deposits to personal bank |
| GST Registration | ❌ Not now | Only required above ₹20 Lakhs/year revenue |
| Company registration | When needed | Revenue > ₹40–50K/month OR Play Store under business name |

**IP Protection:** Copyright is automatic in India — put `© 2026 NurseHolic` at the bottom of the app. Skip trademark registration until ₹10,000+/month. Force users to check a T&C agreement box on account creation.

---

### LEGAL-03 — Trademark Filing Plan for "NurseHolic"

> 📎 Full canonical reference: Journal Entry dated June 24, 2026 (the full document shared during this session).

**Current Status:** Not filing yet. Keeping NurseHolic low-profile under "NORCET-PREP" until real users are acquired.

**Filing Trigger — file Class 41 immediately when any of these happen:**
- [ ] First 100 real users
- [ ] First viral moment / social media mention
- [ ] Before any public launch post or Product Hunt listing
- [ ] Before telling anyone publicly about the NurseHolic name

**Classes and Fees:**
| Class | Covers | File Order | Fee |
|---|---|---|---|
| Class 41 — Education | NurseHolic as an educational service | FIRST | ₹4,500 |
| Class 9 — Software | NurseHolic as a digital product/PWA | Within 30 days after Class 41 | ₹4,500 |
| **Total** | | | **₹9,000** |

**Filing Details:**
- Portal: https://ipindiaonline.gov.in → e-Filing → Trade Marks → TM-A
- Applicant Type: Individual (no company needed — individuals automatically qualify for minimum fee rate)
- Use Status: Proposed to be Used (app does not need to be live to file)
- What to bring: Aadhaar, PAN, mobile number, email, home address, ₹4,500 per class via UPI/Debit/Net Banking

**Class 41 — Goods & Services Description (copy exactly):**
> *"Educational services; providing online examinations and assessments for nursing students; e-learning services for nursing competitive examination preparation; providing practice tests and mock examinations for AIIMS NORCET nursing recruitment examination; online tutorial services for nursing students"*

**Class 9 — Goods & Services Description (copy exactly):**
> *"Mobile application software and progressive web application for nursing examination preparation; downloadable software for educational assessment and practice tests for nursing competitive examinations including AIIMS NORCET"*

**Post-Filing Timeline:**
| Timeline | What Happens |
|---|---|
| Immediately | Application number issued — can legally use ™ symbol on all assets |
| 1–3 months | Examination report issued (may have objections) |
| 30 days after report | Must reply if objected |
| 4 months after acceptance | Published in Trademark Journal |
| 18–36 months total | Full registration certificate — can then use ® symbol |

**Apply ™ immediately after filing to:** domain, app landing page, social handles, GitHub readme, app store listings. Use as: NurseHolic™ / NurseHolic Exam Prep™

**Critical reminders:**
- India = **first-to-file**, not first-to-use
- Government fees are **non-refundable** — file correctly the first time
- Trademark valid 10 years, renewable forever
- Can be transferred to a company later — individual filing now is fine

---

### BRAND-01 — Brand Identity

**App Name:** NurseHolic: NORCET Exam Prep
> Do not use plain "Nurseholic" — differentiates from the Korean YouTube channel of the same name.

**Tagline:** High-Precision Prep for Nursing Officers

**About Section Disclaimer:**
> *"NurseHolic is an independent educational platform for nursing exam preparation. Not affiliated with any YouTube creators or media networks."*

**Color Palette:**
| Role | Color | Hex | Meaning |
|---|---|---|---|
| Primary | Deep Clinical Navy | `#002B5B` | Trust and government authority |
| Accent | Surgical Teal | `#00A896` | Clinical precision |
| Background (Light) | Stark White | `#FFFFFF` | Clean and premium |
| Background (Dark) | Charcoal | `#121212` | Premium tech feel |

**Logo:** Do not fit the full name into an icon. Use a stylized minimalist "NPV" monogram or a single "N" with a "Verse" orbit circle to represent the ecosystem.

**Meta Description:**
> *"NurseHolic: The premium, high-precision prep platform for AIIMS NORCET, ESIC, and RRB Nursing Officers."*

**SEO Rule:** Use "NurseHolic" consistently across all Telegram/WhatsApp groups. Abbreviate to "NPV" in casual conversation only — always reference the full name in writing to strengthen SEO.

---

### INFRA-01 — DNS & Infrastructure Configuration (Verified)

> As of June 24, 2026. Verified via `image_53c35a.png` (CNAME) and `image_53435e.png` (A Record).

| Setting | Value |
|---|---|
| Vercel Project | `norcet-prep` |
| Primary Domain | `nurseholic.in` |
| Secondary Domain | `nurseholic.com` → 308 Permanent Redirect → `www.nurseholic.in` |
| Registrar | Namecheap (Advanced DNS) |
| SSL | Managed by Vercel — Valid ✅ |
| Propagation Status | Pending (as of June 24, 2026) |

**DNS Records:**
| Type | Host | Value |
|---|---|---|
| A Record | `@` | `216.198.79.1` |
| CNAME Record | `www` | `eeb69aa4ea22cc8d.vercel-dns-017.com.` |

**Cleanup completed:** Namecheap parking/redirect records (`parkingpage.namecheap.com` and URL Redirect Record) removed to eliminate conflicts.

---

### INFRA-02 — Git Workflow (Solo Founder)

**Branch Structure:**
| Branch | Purpose | Rule |
|---|---|---|
| `main` | Production | Never touch directly. Only merge from `dev` after testing. |
| `dev` | Staging / Integration lab | All features merged here first. |
| `feature/feature-name` | Individual feature workspace | One branch per feature. |

**Workflow Loop:**
```bash
# 1. Start a new feature
git checkout dev
git checkout -b feature/feature-name

# 2. Work and commit frequently
git add .
git commit -m "feat: describe what you built"

# 3. Merge back to dev for testing
git checkout dev
git merge feature/feature-name

# 4. Push dev to staging, test on Vercel preview
git push origin dev

# 5. When stable, merge dev to main for production
git checkout main
git merge dev
git push origin main
```

**Anti-Bloat Rule:** If a `feature/` branch is taking more than a week, break it into smaller sub-features. Complexity at this stage is a signal to simplify or cut the feature.

---

### INFRA-03 — Domain Strategy

**Current domains:** `nurseholic.in` (primary, live) · `nurseholic.com` (redirect, configured)

**The `.com` Decision:**

Check `nurseholic.com` availability immediately. If available and budget allows — buy it now. It is the cheapest insurance against domain squatting.

> **Real-world warning:** PrepFusion (a GATE prep platform) launched on `prepfusion.in` and their `.com` is now listed as a premium domain at ₹3,00,000+. Do not let this happen to NurseHolic.

**If waiting on the `.com`, buy it when any of these milestones hit:**
- First ₹1,000 in sales → buy as Founder's Reward
- When adding OET/NCLEX-RN modules for global candidates
- When Telegram/WhatsApp links are shared in groups outside India (Middle East, UK)

**Priority rule:** Content over domain. A great domain with 10 questions fails. A mediocre domain with 500 high-yield questions wins.

---

### INFRA-04 — GitHub Repo Leak Prevention

**Status:** ✅ Private — keep private until NurseHolic is publicly revealed.

**Leak points to audit before going public:**
- [ ] Repository name (no "nurseholic" in the name)
- [ ] `README.md` (no NurseHolic mentions)
- [ ] Code comments (no NurseHolic references)
- [ ] `package.json` name and description fields
- [ ] Environment variable names and values
- [ ] Any `nurseholic.in` URL references in code

**Action before making public:** Run a full case-insensitive search across all files for "nurseholic" → replace or remove every reference → then flip visibility to public.

---

### INFRA-05 — PWA Distribution & Growth Strategy

**A2HS (Add to Home Screen) Ritual — show this modal on first open:**
> *"Welcome to NurseHolic! 🏥 To keep your progress synced and study offline during your hospital shifts, please tap the three dots in your browser and select 'Add to Home Screen.' This gives you a permanent, high-speed icon on your phone."*

Once added: address bar disappears, app enters full-screen mode, functionally identical to a native app. They will forget it's a website within 5 minutes.

**PWA vs. Native — the zero friction advantage:**
- **Native App:** User clicks link → Play Store → Install → Download → Launch → Register *(6 steps, lose 50% of users)*
- **PWA:** User clicks link → app opens instantly *(1 step)*

**Telegram Distribution Hack:**
Generate a highly difficult 20-question "Mini Mock Test" and drop in NORCET Telegram/WhatsApp groups:
> *"Hey guys, I built a free 18-minute stress-test mock for NORCET with AI-verified Saunders citations. Let me know if you can score above 15/20. [PWA Link]"*

**Vibe Metrics — watch these before building anything else:**
- Are users creating accounts?
- Are they completing the full 18-minute timer or dropping off halfway?
- Are they returning the next day?

**Play Store Path (future, not now):**
Once 50–100 paying users are acquired, wrap the PWA using Bubblewrap or Capacitor (TWA). Submit to Google Play Store. No rewriting in Java/Kotlin — updating the PWA auto-updates the Play Store app.

---

*End of NurseHolic Master Plan — Last updated June 24, 2026*
