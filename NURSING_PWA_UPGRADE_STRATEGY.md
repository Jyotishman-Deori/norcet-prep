# NURSING STUDY PWA — UPGRADE & MODIFICATION MASTER STRATEGY
> Paste this entire file into your Claude Code workspace as the session-opening context brief before any coding session.

---

## ⚠️ HOW TO USE THIS FILE IN CLAUDE CODE

1. Open your Claude Code terminal session
2. Paste the full content of this file first, then paste your relevant Gemini research context
3. Tell Claude Code: *"Read this strategy doc first. Now execute Phase [X], Task [Y]."*
4. Never paste everything at once — work one task block at a time
5. After each task is done, mark it `[DONE]` in your local copy

---

## 🔍 MANDATORY PRE-SESSION AUDIT — RUN THIS BEFORE EVERY TASK

> This step is non-negotiable. Before writing a single line of code from any phase in this document, Claude Code must scan the existing repository and compare it against what this strategy file describes. The goal is to never rebuild something that already exists, never duplicate an architecture that is already wired, and never create a parallel version of a feature that just needs to be improved.

### The Audit Prompt — Paste This First in Every Claude Code Session

```
Before we work on anything, do a full repository audit against the strategy doc I just pasted.

Scan every file in this project — components, utilities, API routes, database schemas, JSON files, service workers, config files — and answer these specific questions:

1. SCHEMA: Does a question JSON schema already exist? If yes, show me its current fields and compare them to the target schema in the strategy doc. List what fields are missing, what fields are different, and what fields already match. Do not recreate the schema — tell me what to add to the existing one.

2. QUIZ ENGINE: Is there already a quiz rendering component? An anti-repetition filter? A localStorage history tracker? An exam stage filter? For each one that exists, describe what it currently does. For each one that is missing, flag it for build.

3. GAMIFICATION: Is there any energy/license points logic already in the codebase? Any ticket wallet? Any game component file, even a placeholder? List what exists, what is half-built, and what is completely absent.

4. SUPABASE: Is there an existing Supabase client config? Any existing table migrations or schema files? Any existing sync utility functions? Show me what tables already exist and their current columns.

5. PAYMENTS: Is there any Razorpay integration already present, even partial? Any pass expiry logic? Any premium flag checks?

6. ANALYTICS: Is Mixpanel or any other analytics SDK already initialized anywhere in the codebase?

7. PUSH NOTIFICATIONS: Is there a service worker file? Is web push already configured?

8. SECURITY: Is there any existing serverless function in /api/? Any Zod validation? Any rate limiting config?

9. ADMIN: Is there any admin route, admin component, or admin logic still present in this bundle?

10. COPYWRITING: Are there any hardcoded UI strings that conflict with the copywriting playbook in the strategy doc — for example using "Wrong answer" instead of "Not quite", "Upgrade" instead of "Go full Officer mode", or "Watch an ad" instead of "Watch a 30-second case study clip"? List every conflicting string with its file location and line number.

For every item above:
- If it EXISTS and is COMPLETE → mark it ✅ Done. Skip it entirely from the build queue.
- If it EXISTS but is INCOMPLETE or BROKEN → mark it 🔧 Needs upgrade. Show me what is there and what specifically needs to change in the existing code.
- If it is COMPLETELY ABSENT → mark it 🔴 Missing. Add it to the build queue.

Output this as a clean audit report before we touch anything.
```

### How to Act on the Audit Report

After Claude Code returns the audit report, apply these rules strictly:

**For anything marked ✅ Done:** Do not touch it. Do not refactor it for style. Do not rebuild it because the new version would be cleaner. Working code that already does the job is the most valuable thing in the project. Leave it alone.

**For anything marked 🔧 Needs upgrade:** Do not rebuild from scratch. Open the existing file and make the minimum targeted change that closes the gap. Preserve the existing logic structure wherever possible — the goal is a surgical edit, not a rewrite.

**For anything marked 🔴 Missing:** Build it fresh following the spec in the relevant Phase and Task block in this document.

**If two things conflict** — for example, the existing energy system uses a different field name than what the strategy doc specifies — always adapt the strategy doc spec to match the existing field name, not the other way around. Migrating existing data is always more expensive than adjusting a spec.

---

## BLUEPRINT UPGRADES — WHERE THE PLAN CAN BE SHARPER
> These are not criticisms of the vision. They are specific places where the existing plan has gaps, redundancies, or missed opportunities — with exact replacements for each one. Feed this section to Claude Code at the start of any architecture decision.

---

### UPGRADE 1 — The Gamification Loop Needs a Feedback Valve

**What the current plan does:** Builds the full Energy → Game → Ticket → Gacha Wheel loop as a fixed architecture.

**What's missing:** There is no mechanism to know if users are actually engaging with the games or ignoring them entirely and just doing quizzes. Without this, you could spend 3 weeks building Game B "Shift Survival" and discover zero users ever opened it.

**The upgrade — Add a Shadow Analytics Flag before building each game:**
Before building any game beyond the placeholder, instrument the quiz engine with a single Mixpanel event:
```javascript
mixpanel.track("Energy_Depleted", { method_chosen: "watched_ad" | "bought_pass" | "abandoned_session" });
```
If "abandoned_session" is the dominant outcome when energy runs out, users are not motivated enough by the game reward to watch an ad — meaning the games need to come sooner in the session flow, not later. Build the Mixpanel event first, run it for one week with real users, then decide which game to build based on what the data says they want to play for.

---

### UPGRADE 2 — The 2,500 Question Target Has No Quality Gate

**What the current plan does:** Sets a numerical target of 2,500 questions across 8 weeks using the Gemini → Claude browser pipeline.

**What's missing:** Volume without accuracy in a medical exam app is worse than a small, curated bank. One wrong drug dosage, one incorrect priority intervention — and a nursing student memorizes the wrong answer for their actual AIIMS exam. That destroys trust permanently.

**The upgrade — Add a 3-layer quality gate to the content pipeline:**

Layer 1 (Schema): `validate-bank.js` already catches structural errors. Keep this.

Layer 2 (Clinical Accuracy Flag): Add a field `"reviewed": false` to every generated question. Only questions where `"reviewed": true` appear in the live app. Mark it true yourself after manually reading the rationale and verifying the correct_index makes clinical sense. This takes 30 seconds per question and costs nothing.

Layer 3 (Crowdsourced Correction): The existing "Flag Question" button idea is correct. Upgrade it slightly — when 3 or more different users flag the same question ID, automatically move that question to a `"flagged_for_review"` bucket in your Supabase table and stop serving it until you've manually cleared it. This makes your users your QA team without you having to check reports manually every day.

Updated schema fields to add:
```json
{
  "reviewed": true,
  "flag_count": 0
}
```

---

### UPGRADE 3 — The ₹11 Day Pass Is Underdeployed

**What the current plan does:** Triggers the ₹11 pass only on the "License Suspended" screen as a third option below the ad-watch and Pro Pass CTA.

**What's missing:** The ₹11 pass is your single most powerful conversion tool because it breaks the psychological barrier of "I've never paid this app anything." But it's buried at the worst possible moment — when the user is already frustrated about being locked out. Frustrated users close apps, they don't buy things.

**The upgrade — Deploy the ₹11 pass at a moment of peak positive emotion instead:**

Trigger it immediately after a user hits a personal best score or completes a particularly hard clinical scenario correctly. The screen should read:

> "You just cleared a Stage-2 Mains case. That's the hard stuff. Keep this momentum going — ₹11 unlocks the full ward for 24 hours."

A user who just succeeded is in a dopamine state and far more likely to spend than a user who just failed. Change the trigger from frustration → triumph and your ₹11 conversion rate will be meaningfully higher.

Also add it as a soft prompt on the 7th consecutive day of app usage — not as a popup, but as a small persistent banner: *"7 days in. Serious candidates go unlimited. ₹11 for today."*

---

### UPGRADE 4 — The Refund Guarantee Needs a Verification Shortcut

**What the current plan does:** Promises a 100% refund if the student cracks AIIMS NORCET, with verification via official provisional allocation letter + 60% question bank completion.

**What's missing:** The verification process as described requires you to manually check documents and cross-reference your Supabase data. At 500 users that's manageable. At 5,000 users during a peak exam cycle, this becomes a support nightmare that consumes days of your time and creates fraud vectors.

**The upgrade — Build the verification into the app itself, automatically:**

When a user claims a refund, the app should:

1. Prompt them to upload a photo of their AIIMS provisional letter inside the PWA (stored to Supabase Storage under their user_id — never public).
2. Auto-check their `solved_history` count against the master question bank total and calculate completion percentage server-side.
3. If completion ≥ 60% AND a document is uploaded: flip their refund status to `"pending_manual_review"` in Supabase and send you an email alert. You review the document once, approve it, and Razorpay's refund API handles the money.

This caps your manual workload at one 2-minute document check per claimant — no spreadsheets, no cross-referencing, no fraud window.

---

### UPGRADE 5 — The Security Architecture Has the Right Ideas in the Wrong Order

**What the current plan does:** Plans SHA-256 hashes, Base64 cipher bundles, vector timestamps, staging/production split, and JWT serverless middleware all before launch.

**What's missing:** A clear sequence that separates "must have before any real user touches this" from "must have before any real money touches this." Without this, the risk is spending time building maximum-security infrastructure before there is anything valuable to protect.

**The upgrade — Split security into two hard tiers:**

**Tier 1 — Ship Blockers (Must exist before public launch):**
- Supabase RLS: `auth.uid() = user_id` on all tables. Non-negotiable. Takes 10 minutes.
- Input sanitization via Zod on any text field. Non-negotiable.
- No admin code in the student bundle. Non-negotiable.

**Tier 2 — Revenue Blockers (Must exist before the first ₹1 is collected):**
- JWT-validated serverless middleware for all balance writes.
- Last-Write-Wins timestamp sync for cross-device conflict resolution.
- Edge rate limiting on all `/api/v1/` endpoints.
- SHA-256 backup file signing.
- Base64 bundle encryption via the Admin Panel FastDeployer.
- Staging → Production promotion flow.

Everything in Tier 2 can be built in the 2-3 weeks between "app is live with free users" and "Razorpay is integrated." This sequence means security overhead never outpaces the actual value being protected.

---

### UPGRADE 6 — The Admin Panel Build Trigger Is Vague

**What the current plan does:** Says "build the Admin Panel when JSON editing becomes painful." This is a feeling, not a milestone.

**The upgrade — Set an exact, objective trigger:**

Build the separate Admin Panel repository the moment `norcet_master.json` exceeds **800 questions** or you are making more than **3 manual JSON edits per week** — whichever comes first. Below that threshold, the JSON file on your laptop is faster and safer than a second deployment. Above it, the risk of a copy-paste error corrupting production data becomes statistically real.

Add this to the weekly checklist:
```
[ ] Question count check: if > 800, start Phase 7 this sprint
```

---

### UPGRADE 7 — The Multi-Exam Expansion Misses Its Biggest Lever

**What the current plan does:** Expands to ESIC, RRB, DSSSB, SGPGI, CHO by adding `target_exams` filter tags to existing questions and treating them as roughly equal additions.

**What's missing:** The single highest-leverage expansion is state-level CHO (Community Health Officer) exams — specifically NHM MP, NHM UP, and NHM Rajasthan. These three states alone run exams with combined applicant pools of 3-5 Lakh candidates per cycle, most of whom have no dedicated, gamified mobile prep tool. The existing apps targeting them (Mission High, some regional coaching institutes) are static PDFs or dry question lists with no engagement layer. Your gamification moat is strongest here, not against the NNL/Testbook giants in the NORCET space where the competition is already entrenched.

**The upgrade — Treat CHO as a parallel first-class exam from Phase 8, not an afterthought:**

When building the exam selector UI, give CHO its own dedicated dashboard card with state sub-filters (MP / UP / Rajasthan / Maharashtra). CHO content leans heavily on National Health Mission schemes, immunization schedules, and reproductive health — all of which can be generated via the same Gemini → Claude pipeline. The Hostel Squad Pass and state pride leaderboards are even more effective for CHO aspirants because their competition is explicitly regional, not national.

---

### UPGRADE 8 — The Onboarding Flow Has No Commitment Device

**What the current plan does:** Drops users into the dashboard after sign-up with an exam selector and a quiz.

**What's missing:** The single biggest predictor of Day-7 retention in ed-tech apps is whether the user made a specific, time-bound commitment on Day 1. Apps that prompt a daily goal on Day 1 consistently see 2-3x higher Week-2 retention than those that don't. The current onboarding collects exam preference but nothing about when they plan to study — meaning push notifications go out at a fixed 9 PM regardless of whether that's when the user is free.

**The upgrade — Add a 60-second "Duty Roster" commitment screen during onboarding:**

After exam selection, show one screen:

> "When do you want to clock in each day?"
> [Morning — 7 to 9 AM] [Afternoon — 1 to 3 PM] [Night Shift — 9 to 11 PM]

Store their selection as `preferred_study_window` in Supabase. Use it to time push notifications to their chosen window. A student who said "Night Shift" and gets a notification at 9:07 PM feels like the app knows them. A student who said "Morning" and gets a 9 PM ping will turn off notifications by Day 3.

One extra onboarding screen. One extra Supabase field. Disproportionately large retention impact.

---

## PHASE OVERVIEW (Ordered by Priority)

```
Phase 1 → Foundation Audit & Schema Lock          [DO THIS WEEK]
Phase 2 → Core Quiz Engine Hardening              [Week 2]
Phase 3 → Gamification Economy Layer              [Week 3-4]
Phase 4 → Content Factory Pipeline                [Ongoing]
Phase 5 → Monetization & Payment Stack            [Week 5-6]
Phase 6 → Security & Backend Hardening            [Week 7-8]
Phase 7 → Admin Panel Separation                  [Week 9+]
Phase 8 → Multi-Exam Expansion                    [Post-launch]
```

---

## PHASE 1 — FOUNDATION AUDIT & SCHEMA LOCK
**Goal:** Lock the database schema so no future migration is needed. Fix what's broken before building more.

### Task 1.1 — Audit Current State
Paste this into Claude Code:
```
Scan this entire PWA repository and give me:
1. A list of every file that exists
2. What the current question data structure looks like (show me the JSON schema)
3. Any admin forms or routes currently inside the student bundle
4. What is currently stored in localStorage vs Supabase
```

### Task 1.2 — Lock the Master Question Schema
The schema below is final. Every question in the database must follow this structure exactly.

```json
{
  "id": "norcet_mains_fon_001",
  "exam_stage": "Mains",
  "target_exams": ["NORCET", "ESIC", "RRB"],
  "subject_category": "Fundamentals of Nursing",
  "topic": "Blood Transfusion Reaction Protocol",
  "scenario": "...",
  "question": "...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct_index": 2,
  "has_image": false,
  "image_url": null,
  "rationale": "...",
  "norcet_tip": "...",
  "is_premium": false
}
```

Paste into Claude Code:
```
Create a validate-bank.js script in /scripts/ that reads our master question JSON file and:
1. Checks every question has all required fields (id, exam_stage, target_exams, subject_category, topic, scenario, question, options array of 4, correct_index 0-3, rationale, norcet_tip, is_premium)
2. Catches any duplicate id values
3. Verifies correct_index is always 0, 1, 2, or 3
4. Outputs a clean pass/fail report with specific line numbers for any errors
```

### Task 1.3 — Strip Admin Code from Student Bundle
Paste into Claude Code:
```
Scan this repository for any admin routes, admin forms, deletion logic, database write forms, or conditional checks for user.role === 'admin'. Remove them entirely from the student PWA bundle. Make the routing system strictly student-facing.
```

**Deliverable:** Clean student bundle + working validate-bank.js + locked schema file

---

## PHASE 2 — CORE QUIZ ENGINE HARDENING
**Goal:** Make the quiz experience bulletproof before adding any gamification on top.

### Task 2.1 — Anti-Repetition Filter (LocalStorage)
Paste into Claude Code:
```
Create a utility script at /src/utils/quizFilter.js that:
1. Reads our static master JSON question bank
2. Pulls the solved question ID array from browser localStorage key 'norcet_solved_history'
3. Filters out solved IDs using (!solvedIDs.includes(question.id))
4. Returns a randomly shuffled pool of unseen questions
5. When a user answers correctly, appends the question ID to localStorage
```

### Task 2.2 — Exam Stage Filter
Paste into Claude Code:
```
Update our quiz loading logic so that:
1. The user can select exam mode: 'Prelims' (80% nursing + 20% non-nursing) or 'Mains' (clinical case scenarios)
2. The filter reads the exam_stage field from our JSON and serves the correct pool
3. The user's selected mode is stored in localStorage as 'active_exam_stage'
```

### Task 2.3 — The 1/3 Negative Marking UI Warning
Paste into Claude Code:
```
On every quiz question screen, add a persistent small banner at the top that reads:
"⚠️ -0.33 for wrong answer. Skip if unsure."
When a user selects a wrong answer, flash a red alert showing "-0.33 marks deducted" before revealing the rationale.
Track a running "Estimated NORCET Score" counter on the quiz screen that decrements by 0.33 for wrong answers and increments by 1 for correct answers.
```

### Task 2.4 — Cloud Sync Setup (Supabase)
Paste into Claude Code:
```
Create a Supabase migration for a table named 'user_progress' with these exact fields:
- user_id (UUID, Primary Key, references auth.users)
- solved_history (JSONB, default empty array)
- economy_state (JSONB, default {TicketBalance: 0, EnergyTokens: 3})
- updated_at (TIMESTAMPTZ, default now())

Enable Row Level Security with policy: auth.uid() = user_id (users can only read/write their own row)

Then write an auto-sync utility function that:
- Updates this table whenever a quiz ends (async background call, non-blocking)
- On login to a new device, pulls solved_history and economy_state from Supabase and writes to localStorage
- Attaches a UTC timestamp to every sync payload for conflict resolution
```

**Deliverable:** Fully working quiz engine with anti-repetition, exam filters, negative marking UI, cross-device sync

---

## PHASE 3 — GAMIFICATION ECONOMY LAYER
**Goal:** Wire the Energy → Game → Ticket → Reward loop. Build in order: Energy first, then Games, then Tickets, then Store.

### Task 3.1 — License Points (Energy System)
Paste into Claude Code:
```
Implement the 'Clinical License' energy system:
1. Every user starts with 3 License Points stored in economy_state.EnergyTokens in Supabase
2. Every wrong answer on a quiz deducts 1 License Point
3. When License Points hit 0, show a 'License Suspended' screen — block further quiz access
4. On the suspension screen, show two options:
   - "Watch Ad to Reinstate" (placeholder button for now — log 'AD_WATCHED' to console)
   - "Get NORCET Pro Pass" (link to pricing page)
5. Watching the ad (placeholder) adds +1 License Point
6. License Points regenerate by 1 every 4 hours via a timestamp check on app boot
```

### Task 3.2 — Game A: "The 3 AM Chart" (Tetris-Style)
Paste into Claude Code:
```
Build a simple block-placement puzzle game called 'The 3 AM Chart':
- 8x8 grid styled like a patient chart/EHR spreadsheet
- Pastel warm color scheme, lo-fi visual vibe
- Block shapes made of 2-4 cells, rendered using medical icons (pill, syringe, bone)
- No timer, no pressure — pure chill placement
- When a row is completed, clear it with a neon burst animation and a 1.5-second flash banner showing a random nursing fact pulled from a static facts array (e.g., "Acetaminophen = Liver Toxicity Risk!")
- When the board fills up: show a single easy MCQ (the 'Brain-Rot Lifeline'). Correct answer clears half the board.
- Game over callback: awards Overtime Tickets based on rows cleared (1 row = 5 tickets). Write tickets to economy_state via our sync utility.
```

### Task 3.3 — Game B: "Shift Survival" (High-Stakes Mode)
Paste into Claude Code:
```
Build a high-stress block-placement game called 'Shift Survival':
- Same 8x8 grid but dark cinematic aesthetic with red pulsing borders
- Active 5-second timer between moves — if no piece placed, a 'complication block' auto-spawns
- Some rows are tagged with a condition label (e.g., 'ANAPHYLAXIS', 'OPIOID OD'). These rows ONLY clear when a matching antidote block (pulled from a static antidote map) is placed on them.
- On major combo clears: freeze the board and show a hard clinical math question with a 10-second countdown
- Game over: show 'Patient Expired' screen with a cold malpractice review listing which questions the user failed
- Awards more Overtime Tickets than Game A (higher difficulty = higher payout: 1 row = 10 tickets)
```

### Task 3.4 — Ticket Store (Shift Survival Kit / Gacha Box)
Paste into Claude Code:
```
Build a 'Shift Survival Kit' redemption screen:
- Users spend 50 Overtime Tickets to spin an animated prize wheel
- Wheel has 6 possible reward slots with weighted probabilities:
  - 40% chance: "Black Coffee" — unlocks a specific PDF cheat sheet (link to a Google Drive hosted PDF)
  - 25% chance: "Shift Change" — grants +3 License Points
  - 20% chance: "Extended Shift" — unlocks premium questions for 2 hours (sets a timed premium flag in economy_state)
  - 10% chance: "Surgical Grade" — shows a ₹500 stethoscope discount code (static placeholder for now)
  - 4% chance: "Double Shift" — awards 100 bonus Overtime Tickets
  - 1% chance: "Chief Nurse" — grants 7-day full Pro Pass (sets premium expiry timestamp +7 days)
- Ticket deduction must happen server-side (Vercel serverless function) to prevent manipulation
- Show neon particle burst animation on reveal
```

**Deliverable:** Full gamification loop working end-to-end

---

## PHASE 4 — CONTENT FACTORY PIPELINE
**Goal:** Generate and deploy 2,500 questions using the Gemini + Claude browser workflow without touching paid APIs.

### The Browser Assembly Line (No Code Needed — Process Description)

```
Step 1 [GEMINI TAB]: 
Prompt: "Act as a medical researcher for AIIMS NORCET. Pull 10 memory-based Stage-2 Mains clinical scenario questions on [TOPIC]. 
Include correct answers and the clinical reasoning. Plain text only, no formatting."

Step 2 [CLAUDE TAB]:
Prompt: "Here are 10 raw NORCET questions from Gemini: [PASTE]. 
Validate clinical accuracy, create 3 challenging wrong-option distractors for each, 
write a rationale paragraph, write a norcet_tip for negative marking strategy, 
and output a clean JSON array matching this schema exactly: [PASTE SCHEMA FROM 1.2]"

Step 3 [VALIDATE]:
Run: node ./scripts/validate-bank.js
Fix any schema errors flagged.

Step 4 [ADMIN DEPLOY — for now]:
Append the verified JSON array to /src/data/norcet_master.json manually.
```

### Content Sprint Targets

| Week | Questions to Add | Subject Focus |
|------|-----------------|---------------|
| Week 1 | 300 | Fundamentals of Nursing (FoN) |
| Week 2 | 300 | Medical-Surgical |
| Week 3 | 300 | OBG / Midwifery |
| Week 4 | 300 | Pediatrics + CHN |
| Week 5 | 300 | Non-Nursing: Aptitude + Reasoning |
| Week 6 | 200 | Non-Nursing: Current Affairs + GK |
| Week 7 | 500 | Stage-2 Mains Clinical Scenarios (all subjects) |
| Week 8 | 300 | ESIC / RRB specific aptitude questions |
| **TOTAL** | **2,500** | **Launch-ready** |

### Task 4.1 — Image-Based Questions (Zero Cost)
Paste into Claude Code:
```
For any question in our JSON where has_image is true, update the quiz renderer to:
1. Fetch and display the image from the image_url field (pointing to Wikimedia Commons or CDC public image library)
2. Add an image loading skeleton placeholder while it fetches
3. If the image fails to load, show the question text-only with a note "Image unavailable"
```

### Task 4.2 — Weekly Content Push Notification
Paste into Claude Code:
```
Set up a Web Push Notification via the PWA service worker.
Every Sunday at 8 PM IST, send users a push notification:
"⚡ 50 New NORCET Stage-2 Scenarios just dropped! Your rivals are already grinding."
```

### Ongoing Update Cadence
- **Every Sunday night:** Run 5x Gemini → Claude browser cycles → append 50 questions → validate → deploy
- **Within 48hrs of any live exam:** Scrape memory recalls from Telegram/YouTube → format → deploy as "24-Hour Flash Recall Paper" banner on dashboard
- **Monthly:** Add 300-500 new clinical scenarios to stay ahead of top users' consumption rate

---

## PHASE 5 — MONETIZATION & PAYMENT STACK
**Goal:** Collect real money. Do not start this phase until you have 100 active users.

### Task 5.1 — Razorpay Orders API Integration
Paste into Claude Code:
```
Integrate Razorpay web checkout for one-time Fixed-Term Validity Passes.
Do NOT use Razorpay subscription plans.
Use the Razorpay Orders API for single clean transactions.

Create three pass types:
1. Crash Pass: ₹299, 45 days validity
2. Officer Pass: ₹499, 180 days validity  
3. Platinum Pass: ₹799, 365 days validity

On successful payment:
- Call our Vercel serverless function /api/v1/payments/verify
- The serverless function verifies the Razorpay payment signature server-side
- Writes expiry_timestamp (current_time + validity_days) to the user's Supabase row
- Returns success to the PWA

On app boot:
- Check if current UTC timestamp < expiry_timestamp
- If yes: grant ad-free premium access, unlock full question bank, activate 2x ticket multiplier
- If expired: gracefully fall back to free tier without any charge
```

### Task 5.2 — ₹11 Shift Pass (Impulse Buy Gate)
Paste into Claude Code:
```
When a user's License Points hit 0 (License Suspended screen):
Add a third option below the ad-watch and Pro Pass CTA:
"⚡ Quick Fix: ₹11 for 24 hours unlimited access"
This triggers a minimal Razorpay checkout for ₹11.
On payment: set a 24-hour expiry premium flag in Supabase.
```

### Task 5.3 — Hostel Squad Pass
Paste into Claude Code:
```
Create a 'Hostel Squad Pass' for ₹999 one-time.
On purchase:
- Generate 3 unique 8-character alphanumeric activation codes
- Store them in a Supabase 'activation_codes' table linked to the purchaser's user_id
- Display all 3 codes to the buyer with a share button (copies to clipboard for WhatsApp)
On code redemption by another user:
- Mark the code as used in the database
- Grant that user a 180-day Officer Pass equivalent
```

### Task 5.4 — Web Ad Integration (Rewarded Video)
Paste into Claude Code:
```
Implement web rewarded video ads using Google AdSense for Games (H5 Games Ads) API.
Ad triggers:
1. When License Suspended screen appears: "Watch Ad to get +1 License Point"
2. When a game ends and score was close to a high score: "Watch Ad to Revive and Continue"
3. When energy runs low (1 point left): proactive prompt "Watch Ad for +1 free point"
On ad completion callback: increment EnergyTokens by 1 via our serverless endpoint (not client-side).
```

---

## PHASE 6 — SECURITY & BACKEND HARDENING
**Goal:** Prevent cheating. Protect revenue. Fix the three industrial-grade gaps.

### Task 6.1 — Serverless Economy Middleware (Stops Balance Manipulation)
Paste into Claude Code:
```
Write a secure Vercel serverless function at /api/v1/economy/reward-claim.
It must:
1. Accept: user's Supabase JWT + raw game score + game_type string
2. Validate the JWT server-side using Supabase admin client
3. Apply sanity limits: max score per session = 500 tickets (prevents fake scores)
4. Use the Supabase service-role key (from environment variables, never exposed to client) to update the user's ticket balance
5. Return the new verified balance to the PWA
NEVER allow the client browser to write directly to ticket or premium fields.
```

### Task 6.2 — Last-Write-Wins Sync (Prevents Cross-Device Data Loss)
Paste into Claude Code:
```
Refactor the Supabase sync utility.
Every sync payload must include a client_timestamp (UTC milliseconds).
Before writing to Supabase, the serverless function compares client_timestamp against the database's updated_at field.
If client_timestamp > updated_at: commit the update.
If client_timestamp < updated_at: reject the write, return the newer cloud state to the client.
This prevents a device with stale data from overwriting a newer progress state.
```

### Task 6.3 — Edge Rate Limiting (Prevents Bot Flooding)
Paste into Claude Code:
```
Configure rate limiting on all our API endpoints.
If a unique IP sends more than 5 requests per minute to any /api/v1/ endpoint, return HTTP 429 Too Many Requests.
On the frontend: after any API call, disable the triggering button for 5 seconds (debounce).
Log rate limit hits to our analytics event tracker.
```

### Task 6.4 — Input Sanitization (XSS Prevention)
Paste into Claude Code:
```
Any component that allows user text input (custom test set names, profile names, flag/report form) must:
1. Run all input strings through a Zod schema validator before any processing
2. Strip all HTML tags and script content from input
3. Write user-generated content to IndexedDB only, never to the core norcet_master.json
```

---

## PHASE 7 — ADMIN PANEL SEPARATION
**Goal:** Build a private content management system completely isolated from the student app.
**Do not start this until you are deploying content weekly and JSON editing is becoming painful.**

### Task 7.1 — Create Separate Admin Repository
```
1. Create a new, completely separate Vercel project (not the same repo as the student PWA)
2. Name it something non-obvious: e.g., 'internal-vault-8492.vercel.app'
3. Add robots.txt to block all search engine indexing
4. Protect with Google OAuth — only your email can log in
5. Connect to the same Supabase database as the student app
6. Enable Supabase Row Level Security: only is_admin: true users can write to the questions table
```

### Task 7.2 — FastDeployer Component (Paste-to-Cloud Pipeline)
Paste into Claude Code in the ADMIN repo:
```
Create a dashboard component at src/components/FastDeployer.jsx.
Build a UI with:
- A dropdown to select exam bundle category
- A large textarea to paste raw JSON arrays
- A SCRAMBLE & DEPLOY BUNDLE button

On click:
1. Parse and validate the JSON (check all required schema fields)
2. Encrypt using Base64 with our local secret key
3. Upload encrypted .dat file to Supabase Storage 'bundles' bucket with upsert: true
4. Update version.json to increment the version number for that bundle
5. Show neon-green success confirmation
```

### Task 7.3 — Staging → Production Promotion Flow
Paste into Claude Code in the ADMIN repo:
```
Add a two-stage deployment system:
1. 'Deploy to Staging' button: uploads bundle to /staging/ bucket path
2. 'Staging Preview' tab: renders questions from /staging/ in a mock quiz UI so I can click-test them
3. 'Promote to Production' button: only appears if staging preview was opened. Moves bundle from /staging/ to /production/ and updates version.json
Never allow direct production deployment without passing through staging preview.
```

### Task 7.4 — version.json (Bandwidth-Saving Version Control)
Paste into Claude Code in the student PWA:
```
Create a version check system:
On every app boot, the PWA first downloads version.json (1KB file) from Supabase Storage.
It compares each bundle's version string against the locally cached version stored in IndexedDB.
Only download a full .dat bundle if the version string has changed.
This prevents downloading 400KB question files on every app open, saving egress bandwidth.
```

---

## PHASE 8 — MULTI-EXAM EXPANSION
**Goal:** Double market size with minimal engineering effort by adding exam filter tags.
**Do not start this until NORCET content is complete and the app has real users.**

### Task 8.1 — Exam Selector Dashboard UI
Paste into Claude Code:
```
Add an exam selection card to the top of the student dashboard.
Options: NORCET | ESIC | RRB | DSSSB | SGPGI | CHO
Store the selected exam as 'active_target_exam' in localStorage.
All quiz filters, game content pools, and Daily Capsule pulls must read this value and filter questions using the target_exams array field in our JSON schema.
```

### Task 8.2 — DSSSB Bilingual Matching Game
Only after core games are live. Paste into Claude Code:
```
Build a card-matching mini-game called 'Language Shifter':
- 12 face-down cards on screen (6 pairs)
- Each pair: English nursing term + Hindi description of the same condition
- Flip two cards: if they match, they clear with a green flash
- If wrong: cards flip back after 1 second
- Completing the board in under 60 seconds awards a 'Bilingual Medical Officer' badge on the leaderboard profile
```

### Task 8.3 — All-Exam Officer Pass Pricing
Paste into Claude Code:
```
Add a fourth pricing tier visible only on the exam selector screen:
'All-India Officer Pass' — ₹699 for 365 days
Unlocks all exam categories: NORCET + ESIC + RRB + CHO under one payment.
Display it with a banner: "Preparing for multiple exams? Pay once, unlock everything."
```

---

## ONGOING MAINTENANCE CHECKLIST

Run these checks every week without exception:

```
[ ] node ./scripts/validate-bank.js  (no schema errors)
[ ] Check Supabase dashboard: storage usage < 400MB
[ ] Check Vercel dashboard: function invocations < 80,000/mo
[ ] Push 50 new questions (Sunday night sprint)
[ ] Review flagged questions from user error reports
[ ] Check if any exam notification dropped → trigger Flash Pass campaign
```

---

## THE AD-FREE FEEL PRINCIPLE — HOW TO RUN REWARDED ADS WITHOUT FEELING LIKE AN AD APP

> This is a UX and product design mandate, not just a copywriting note. Every engineering decision, every UI placement, every trigger moment for rewarded ads must be filtered through one question: **does this feel like the app interrupting the student, or the student choosing to do something?** The entire design goal is to make rewarded ads feel like a feature the student reaches for — not a gate the app puts in front of them.

---

### THE CORE DISTINCTION

There are two kinds of ad experiences in mobile apps:

**Type A — Ads that happen TO the user.** Banner ads sitting in the UI at all times. Interstitial ads that auto-play between screens. Pre-roll ads before content loads. These are what make an app feel like an ad app. They create ambient visual noise even when the user is not interacting with them. They signal: *"We need your attention for our monetization, not for your studying."* These must not exist anywhere in this app — not on the quiz screen, not on the dashboard, not between questions, not as a strip at the bottom of any page. Zero. None.

**Type B — Ads that the user summons.** A specific moment arises. The user wants something — more energy, a revive, a reward. The app offers a voluntary 30-second exchange. The user chooses to watch. The ad plays in full screen, ends, and the reward is delivered immediately. The app returns to exactly where it was. These feel like a power-up the student activated, not an interruption they endured.

This app runs exclusively Type B. The engineering, UI, and copy must all enforce this without exception.

---

### THE 5 DESIGN RULES FOR AD-FREE FEEL

**Rule 1 — No passive ad surfaces anywhere in the UI.**
There must be zero banner ads, zero sticky ad strips, zero ad widgets embedded in any screen the user sees during normal app use. The dashboard, quiz screens, game canvas, leaderboard, profile, and ticket store must all be visually clean. A user who never runs out of energy and never needs a revive should be able to use this app for weeks without ever seeing an ad placement. That experience — of a clean, focused, premium-feeling study tool — is what makes them eventually pay for the Officer Pass.

Paste into Claude Code:
```
Audit every screen in the app for any persistent ad containers, banner slots, sticky footers, 
or ad SDK initialization that renders any visual element outside of an explicit user-triggered 
rewarded ad flow. Remove all of them. The only ad surface in this entire app is a full-screen 
rewarded video that plays when the user taps a specific voluntary CTA button. Nothing else.
```

**Rule 2 — The ad is always framed as the user's choice, never the app's demand.**
The UI copy and the button placement must always make the ad feel optional and empowering, not mandatory and extractive. There must always be at least one alternative to watching the ad — either waiting for natural energy regeneration, buying a pass, or simply closing the prompt and stopping for now. A user who feels trapped into watching an ad will uninstall. A user who *chose* to watch one because it was genuinely the fastest path forward will watch it again tomorrow.

The trigger screen should never feel like a wall. It should feel like a menu of options where the ad is the most convenient one.

**Rule 3 — The ad must be contextually placed, never random.**
The rewarded ad prompt only appears at these exact three moments and nowhere else:

- **Moment A — License Suspended:** The user hit 0 energy after wrong answers. This is the highest-intent moment — they were actively studying and want to continue. The ad offer is maximally relevant here.
- **Moment B — Game Revive:** The user's game session ended with a score close to their personal best. The loss-aversion instinct makes the revive offer feel genuinely valuable.
- **Moment C — Proactive Boost:** When the user has exactly 1 License Point remaining, a subtle non-blocking banner appears at the bottom of the quiz screen offering a free top-up. This is the only moment an ad prompt appears without the user having explicitly failed — and even here it must be dismissible with one tap, no confirmation dialog.

No other trigger points. No "hey, want bonus tickets? Watch an ad!" prompts mid-session. No ad offers between questions. No ad prompts on app open.

**Rule 4 — The ad experience must be technically seamless.**
The moment the user taps the ad CTA, the ad must begin loading immediately with a skeleton/spinner screen. It must play full-screen with no surrounding app UI visible. When it ends, the reward must be delivered instantly with a satisfying animation — the License Point counter ticks up, the game revives with a visual effect — before returning the user to exactly where they were. The transition back into the app must be under 1 second. Any lag, any loading delay after the ad ends, any confusion about whether the reward was actually granted — these break the illusion of seamlessness and make the ad feel like a bad experience.

Paste into Claude Code:
```
For the rewarded ad integration using Google AdSense for Games (H5 Games Ads):
1. Pre-load the ad in the background as soon as the user opens the app, so it is ready 
   instantly when triggered. Do not wait until the user taps the button to start loading.
2. The ad must play in a full-screen overlay — no app chrome visible during playback.
3. On ad completion callback: trigger the reward animation first, deliver the reward to 
   Supabase via serverless endpoint second, return to previous screen third.
4. If the ad fails to load or the SDK is unavailable: silently hide the ad CTA entirely 
   and show only the alternative options (wait / buy pass). Never show a broken ad button 
   or an error message referencing ads.
```

**Rule 5 — Premium users must never see any trace of the ad system.**
The moment a user has an active Officer Pass, Crash Pass, Platinum Pass, or any paid tier, every single ad-related UI element must disappear from the entire app — the ad CTA buttons, the "Watch to revive" prompts, the energy warning banners that mention ads. Their experience should be structurally identical to the free experience except unlimited energy and full question bank access. They should not see a greyed-out ad button, not see a "you have premium, no ads needed" label, not see any reminder that the ad system exists. It simply does not exist for them.

Paste into Claude Code:
```
Create a single utility function isPremiumActive() that checks the user's pass expiry 
timestamp from Supabase against the current UTC time.

Every component that renders any ad-related UI must call isPremiumActive() on mount.
If it returns true: render nothing in place of the ad CTA. No placeholder, no label, 
no empty space. The component simply does not render.
If it returns false: render the ad CTA as normal.

This must be applied to every ad trigger point: the License Suspended screen, 
the Game Over revive prompt, and the proactive 1-point banner.
```

---

### WHAT THIS FEELS LIKE TO THE USER

A free user opening this app for the first time sees a clean, focused study interface. No banners. No ads anywhere visible. They study, play, earn tickets. If they run out of energy, a screen appears giving them options — one of which is a free 30-second video. They choose it, it plays cleanly, they're back in their quiz in 3 seconds. They feel like they gamed the system for free energy. They come back tomorrow.

A paid user opening this app sees the exact same clean interface. No ads, no remnants of the ad system, no "you have premium" badge reminding them they're paying to avoid something. Just a fast, uninterrupted study tool. They feel like they bought something genuinely good, not just bought their way out of something annoying.

Neither user ever thinks of this as "an app with ads." The free user thinks of it as "an app where I can get free stuff by watching a quick clip." The paid user thinks of it as "a clean study tool." Both perceptions are correct. Both perceptions are valuable. The architecture makes both possible simultaneously.

---

### AD AUDIT QUESTION TO ADD TO THE PRE-SESSION AUDIT

Add this as Question 11 in the Mandatory Pre-Session Audit prompt:

```
11. ADS: Are there any passive ad surfaces in the codebase — banner containers, sticky 
ad strips, ad SDK calls that render on page load, or any visual ad element that appears 
without a user tapping a specific CTA button? List every file and line number where any 
ad-related render logic exists. Flag anything that is not inside an explicit user-triggered 
rewarded ad flow component as a violation of the ad-free feel principle.
```

---

## 🚨 PRE-LAUNCH SECURITY & LEGAL CHECKLIST — RUN BEFORE GOING PUBLIC

> Run this checklist exactly once, at the point when the app is feature-complete and you are about to share it with real users beyond your test group. Not before — you will waste time hardening things that are still changing. Not after — you will have shipped naked. This is the right moment: production-ready, pre-public.
>
> Items already handled elsewhere in this strategy doc are marked as such and do not need to be repeated here. Only items not covered elsewhere are given full prompts.

---

### ITEM 1 — Privacy Policy & Legal Compliance ⚠️ NOT IN FILE — DO THIS
**What it is:** The moment you collect any user data — email address, study progress, device info, payment details — you are legally operating under GDPR (European users), CCPA (California users), and India's DPDP Act 2023 (Indian users). None of these require you to have Indian users specifically to apply. Any user from a covered jurisdiction triggers the obligation.

**What you need before launch:**

First, generate a privacy policy. Paste this into Claude Code:
```
Generate a privacy policy for a Progressive Web App called [YOUR APP NAME] that:
- Collects email addresses and passwords via Supabase Auth
- Stores study progress, quiz history, and ticket balances in Supabase
- Processes payments via Razorpay (name, email, payment amount)
- Uses Google AdSense for Games to serve rewarded video ads to free users
- Uses Mixpanel for anonymous product analytics
- Is targeted at users in India but accessible globally
- Does not sell user data to third parties
- Allows users to request deletion of their account and data

Format it as plain HTML I can host at /privacy on my Vercel deployment.
Include sections for: data collected, how it is used, third-party services, 
data retention, user rights, contact information, and last updated date.
```

Second, add a privacy policy link in the app footer and on the sign-up screen. It must be visible before a user creates an account.

Third, add a data deletion flow. Paste into Claude Code:
```
Add a 'Delete My Account' option inside the user profile settings screen.
When tapped:
1. Show a confirmation dialog: "This will permanently delete your account, 
   study history, and ticket balance. This cannot be undone."
2. On confirm: call a Vercel serverless function that deletes the user's row 
   from user_progress, removes their Supabase Auth account, and logs the 
   deletion event with a timestamp for compliance records.
3. Sign the user out and redirect to the landing page.
```

---

### ITEM 2 — Row Level Security ✅ ALREADY IN FILE
Covered in Phase 2 Task 2.4 and Phase 6 Tier 1. Supabase RLS policy `auth.uid() = user_id` is already specified. No action needed here — just confirm it is enabled before launch via the Supabase dashboard under Authentication → Policies.

---

### ITEM 3 — Auth Failure Path Testing ⚠️ NOT IN FILE — DO THIS
**What it is:** AI-generated auth code handles the happy path (correct credentials, new email, working network) and silently breaks on every edge case. These edge cases are what real users hit on day one.

Before launch, manually test every one of these scenarios and confirm the app handles each with a clean user-facing message:

```
Auth failure test matrix — run every one of these manually before going public:

[ ] Wrong password entered 5 times in a row → does the app lock the account or just keep showing "wrong password"?
[ ] Password reset requested for an email that does not exist in the database → does it say "email sent" (correct — never confirm if an email exists) or does it say "user not found" (wrong — leaks data)?
[ ] Password reset link clicked a second time after already being used → does it show a clean "link expired" message or crash?
[ ] Sign up attempted with an email that already has an account → does it say "account already exists" (wrong — leaks data) or "if this email is new, check your inbox" (correct)?
[ ] Sign up with no internet connection → does it hang forever or show a timeout message?
[ ] Session token expired mid-session (simulate by changing system clock) → does the app gracefully re-prompt login or crash silently?
[ ] Login on a new device while already logged in elsewhere → does the old session get invalidated or do both stay active?
```

Paste into Claude Code to fix any failures found:
```
Review all auth-related components and API routes in this app.
Ensure that:
1. No error message ever reveals whether a specific email exists in the database.
   "User not found" and "wrong password" must both say the same generic thing: 
   "Incorrect email or password."
2. Password reset always shows "If this email is registered, you'll receive a link shortly" 
   regardless of whether the email exists.
3. All auth errors are caught and shown as user-friendly messages. 
   No raw Supabase error objects or stack traces must ever reach the UI.
4. Session expiry is handled gracefully — redirect to login with message 
   "Your session ended. Log back in to continue your shift."
```

---

### ITEM 4 — Security Headers ⚠️ NOT IN FILE — DO THIS
**What it is:** Security headers are HTTP response headers that tell the browser how to behave — blocking clickjacking, preventing MIME sniffing, controlling what external resources can load. Without them, your app is missing a basic layer of browser-level protection that takes 5 minutes to add.

Paste into Claude Code:
```
Review this app as a security specialist. Add a strong security header configuration 
to our Vercel deployment.

Create or update vercel.json to include these response headers on all routes:
- Content-Security-Policy: restrict script sources to self and our known CDNs only
- X-Frame-Options: DENY (prevents clickjacking)
- X-Content-Type-Options: nosniff (prevents MIME sniffing)
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: disable camera, microphone, geolocation (we don't use any of these)
- Strict-Transport-Security: max-age=31536000; includeSubDomains (forces HTTPS)

After adding these, verify no existing app functionality breaks by testing the 
quiz screen, payment flow, and ad playback.
```

---

### ITEM 5 — OWASP Vulnerability Audit ⚠️ NOT IN FILE — DO THIS
**What it is:** OWASP (Open Worldwide Application Security Project) is the industry standard checklist for web app vulnerabilities. It covers SQL injection, XSS, broken authentication, insecure direct object references, and more. AI-generated code commonly fails several of these without the developer noticing.

Paste into Claude Code:
```
Review this entire app against the OWASP Top 10 web application security risks.
For each risk, tell me:
1. Whether this app is currently vulnerable
2. What specific code or configuration is the vulnerability
3. The exact fix

Pay particular attention to:
- A01 Broken Access Control: can a logged-in user access another user's data by 
  changing an ID in a request?
- A03 Injection: is any user input ever passed unsanitized into a database query, 
  even indirectly?
- A05 Security Misconfiguration: are there any Supabase tables, storage buckets, 
  or API routes with overly permissive access settings?
- A07 Identification and Authentication Failures: are session tokens stored securely? 
  Is there account lockout after repeated failed logins?
- A09 Security Logging and Monitoring Failures: are security-relevant events 
  (failed logins, rate limit hits, payment failures) being logged somewhere?
```

---

### ITEM 6 — Server-Side Validation on All Inputs ✅ PARTIALLY IN FILE
Game score validation and Zod sanitization on user text inputs are covered in Phase 6 Tasks 6.1 and 6.4. However those only cover game economy endpoints and custom text fields.

The gap: every API route that accepts any input from the client — including quiz completion reports, exam stage selections, pass redemption codes, and refund claims — needs server-side validation, not just client-side checks.

Paste into Claude Code:
```
Audit every serverless function in /api/ and every Supabase RPC call made from 
the frontend.

For each one, confirm:
1. The input is validated on the server using Zod schema checks before any 
   database operation runs.
2. The server does not trust any value sent from the client — not user_id, 
   not score, not exam_stage, not pass_type, not ticket amounts.
3. If validation fails, the function returns a 400 with a generic error message 
   and logs the full validation error server-side only.

Add missing Zod validation to any endpoint that does not have it.
```

---

### ITEM 7 — Credential & .env Leak Check ⚠️ NOT IN FILE — DO THIS
**What it is:** AI code generators routinely place API keys, Supabase service role keys, and Razorpay secrets in the wrong place — inside frontend files, hardcoded in component logic, or accidentally logged to the console. If any secret key is in a file that gets bundled into the client, it is already compromised the moment anyone opens DevTools.

Paste into Claude Code:
```
Check this entire codebase for credential and sensitive data leaks. Look for:

1. Any Supabase service role key, Razorpay secret key, or other private API key 
   that appears anywhere outside of a server-side file or .env file.
   These must ONLY exist in Vercel environment variables or server-only files.
   They must never appear in any file inside /src/, /components/, /pages/ 
   (except /pages/api/), or /public/.

2. Any console.log(), console.error(), or similar calls that output a full 
   error object, a user's email, a JWT token, or any payment data.
   Replace these with generic log messages server-side and remove them 
   entirely from client-side code.

3. Any API response that returns more fields than the client needs.
   For example: if a user profile fetch returns the full database row including 
   internal flags like is_admin or flag_count, strip those before sending.
   Return only what the UI actually displays.

4. Confirm that the public Supabase anon key (which IS safe to expose) 
   is the only Supabase credential present in any client-side file.
   The service role key must be server-side only, always.

List every violation found with file path and line number.
```

---

### ITEM 8 — API Keys Out of the Frontend ✅ PARTIALLY IN FILE
Phase 6 Task 6.1 already mandates that the Supabase service-role key must be a server-side environment variable. However this principle must extend to every third-party key in the app.

Before launch, confirm each key is in the correct location:

| Key | Safe in Frontend? | Where It Must Live |
|---|---|---|
| Supabase anon key | ✅ Yes | Client-side, in .env as NEXT_PUBLIC_ |
| Supabase service role key | ❌ Never | Vercel env var, server-side only |
| Razorpay Key ID | ✅ Yes | Client-side (used to init checkout) |
| Razorpay Key Secret | ❌ Never | Vercel env var, server-side only |
| AdSense / AdInMo publisher ID | ✅ Yes | Client-side (public by design) |
| Mixpanel project token | ✅ Yes | Client-side (public by design) |

Paste into Claude Code:
```
Confirm that every environment variable in this project that contains the word 
SECRET, KEY, SERVICE, or PRIVATE is prefixed without NEXT_PUBLIC_ and is 
therefore inaccessible to the client bundle. List any violations.
```

---

### ITEM 9 — Rate Limiting ✅ ALREADY IN FILE
Covered in Phase 6 Task 6.3. Edge rate limiting at 5 requests/minute per IP on all `/api/v1/` endpoints is already specified. No action needed — just confirm it is active before launch and test it manually by hitting an endpoint 6 times in rapid succession and verifying a 429 response.

---

### ITEM 10 — CAPTCHA on Public Forms + CORS Lock ⚠️ NOT IN FILE — DO THIS
**What it is:** Any form that is publicly accessible without login — sign-up, sign-in, password reset, contact/report forms — is a bot target. Without CAPTCHA, automated scripts can flood your sign-up endpoint and exhaust your Supabase free tier in hours. CORS misconfiguration allows other websites to make requests to your API as if they were your app.

Paste into Claude Code:
```
1. Add Cloudflare Turnstile (free CAPTCHA) to the sign-up and password reset forms.
   Turnstile is invisible to real users who pass the browser integrity check — 
   it only challenges suspected bots. Integration steps:
   a. Create a free Cloudflare Turnstile widget at dash.cloudflare.com
   b. Add the site key to the sign-up and password reset form components
   c. On form submit, send the Turnstile token to our serverless function
   d. The serverless function verifies the token with Cloudflare's API before 
      processing the sign-up or reset request
   e. Reject any request where the Turnstile token is missing or invalid

2. Lock CORS on all /api/ serverless functions to only accept requests 
   originating from our production domain. 
   Add this to every serverless function response:
   Access-Control-Allow-Origin: https://[YOUR-PRODUCTION-DOMAIN].vercel.app
   Reject requests from any other origin with a 403.
```

---

### ITEM 11 — Error Messages That Don't Leak Internals ⚠️ NOT IN FILE — DO THIS
**What it is:** Detailed error messages are a gift to attackers. "SELECT * FROM users WHERE email = 'x' failed" tells someone exactly what your database structure looks like. Raw stack traces reveal file paths, library versions, and internal logic. Every error the user sees must be a generic, human-friendly message. Every full error detail must be logged server-side only.

Paste into Claude Code:
```
Audit all error handling across this app — client components, serverless functions, 
and Supabase query calls.

Apply these rules everywhere:

1. User-facing error messages must never contain: SQL fragments, table names, 
   column names, file paths, library names, stack traces, HTTP status codes, 
   or Supabase/Postgres error codes.

2. Every catch block in a serverless function must follow this pattern:
   - Log the full error object to server-side console (Vercel logs) for debugging
   - Return a generic JSON response to the client: { "error": "Something went wrong. 
     Please try again." }
   - Return the appropriate HTTP status code (400 for bad input, 401 for auth, 
     500 for server errors) but never include the internal error detail in the body.

3. Client-side catch blocks must display one of these fixed strings depending on context:
   - Network errors: "Connection issue. Check your internet and try again."
   - Auth errors: "Incorrect email or password."
   - Payment errors: "Payment could not be processed. Please try again or contact support."
   - Everything else: "Something went wrong. Please try again."

4. Confirm that no error boundary or global error handler in the React tree 
   renders raw error.message or error.stack to the screen.
```

---

### PRE-LAUNCH SECURITY CHECKLIST — QUICK STATUS TABLE

Use this as the final sign-off before making the app link public:

| # | Check | Status | Where Covered |
|---|---|---|---|
| 1 | Privacy policy live at /privacy | ☐ | This section — Item 1 |
| 2 | Data deletion flow working | ☐ | This section — Item 1 |
| 3 | Supabase RLS enabled and tested | ☐ | Phase 2 Task 2.4 + Phase 6 Tier 1 |
| 4 | Auth failure paths manually tested | ☐ | This section — Item 3 |
| 5 | Security headers in vercel.json | ☐ | This section — Item 4 |
| 6 | OWASP audit run and fixes applied | ☐ | This section — Item 5 |
| 7 | Server-side validation on all API routes | ☐ | Phase 6 Task 6.4 + Item 6 |
| 8 | No secrets in frontend bundle | ☐ | This section — Item 7 |
| 9 | Service role key server-side only | ☐ | Phase 6 Task 6.1 + Item 8 |
| 10 | Rate limiting live and tested | ☐ | Phase 6 Task 6.3 |
| 11 | Cloudflare Turnstile on sign-up | ☐ | This section — Item 10 |
| 12 | CORS locked to production domain | ☐ | This section — Item 10 |
| 13 | Error messages show no internals | ☐ | This section — Item 11 |
| 14 | No credential leaks in codebase | ☐ | This section — Item 7 |

All 14 boxes checked = cleared for public launch.

---

## CONTEXT-LOADING ORDER FOR CLAUDE CODE SESSIONS

When starting a new Claude Code session, paste in this order:

1. This strategy doc (NURSING_PWA_UPGRADE_STRATEGY.md)
2. The current file structure output: `find . -type f -name "*.js" -o -name "*.jsx" -o -name "*.json" | head -50`
3. The specific task block from the phase you're working on
4. Any Gemini research context relevant to that task only

Keeping sessions focused to one task block prevents context overflow and reduces hallucinations in the generated code.

---

---

## COPYWRITING PLAYBOOK — WHAT A TOP MARKETER WOULD SAY
> Every word in your UI is a micro-decision. The wrong word creates resistance. The right word creates momentum. This section is your cheat sheet for every screen, button, notification, and error state in the app.

The core principle: **never sell, never pressure, never remind them they're being monetized.** Instead, make every interaction feel like the app is on their side, rooting for them, speaking their language.

---

### THE GOLDEN RULE OF APP COPY

**Don't talk about the app. Talk about the student's situation.**

Bad copy is about features. Good copy is about feelings. Great copy is about the exact fear or desire the student has at 11 PM the night before a mock test.

---

### SECTION 1 — ENERGY / LICENSE POINTS SYSTEM

The energy system is your most dangerous UX moment. Done wrong, it feels like a paywall trap. Done right, it feels like a caring senior nurse pulling you aside.

| ❌ Never Say This | ✅ Say This Instead | Why It Works |
|---|---|---|
| "You've run out of attempts." | "Your brain needs a breather. Even AIIMS nurses take a 5-minute break." | Frames the limit as care, not punishment |
| "License Suspended. Buy more." | "Your License is paused. One quick step to reinstate it." | "Paused" feels temporary. "Suspended" feels permanent and scary |
| "Watch an ad to continue." | "Watch a 30-second case study clip to get back in." | Reframes the ad as educational content, not an interruption |
| "You have 1 attempt left." | "⚠️ 1 License Point remaining — skip if unsure." | Coaches them, doesn't threaten them |
| "Energy refilled!" | "✅ License reinstated. You're back on duty." | Keeps the clinical metaphor alive, makes them feel like a professional |
| "Buy the Pro Pass to get unlimited attempts." | "NORCET Officers don't get second chances in the ward. They study until it's automatic. Go unlimited." | Connects the paywall to their actual life goal |

---

### SECTION 2 — ONBOARDING & FIRST LAUNCH

The first 60 seconds decide whether they come back tomorrow. Do not welcome them to your app. Welcome them to their goal.

| ❌ Never Say This | ✅ Say This Instead | Why It Works |
|---|---|---|
| "Welcome to NursePrep!" | "Day 1. The seat is yours to take." | Immediately frames them as a future AIIMS officer, not an app user |
| "Please select your exam." | "Which notification are you hunting right now?" | "Hunting" matches their psychological state — they're hungry for a government seat |
| "Set up your profile." | "Let's build your officer profile." | The word "officer" does the emotional work before they've answered a single question |
| "Start learning!" | "Clock in for your first shift." | Stays in the clinical metaphor. Feels like beginning something real. |
| "Tutorial: How to use the app." | "Here's how the ward works." | They're a nurse in training, not an app tutorial victim |
| "Complete your account setup." | "One step before your first case." | Urgency without aggression — there's a case waiting |

---

### SECTION 3 — QUIZ & QUESTION SCREENS

The quiz screen is where they're most stressed. Your copy must reduce cognitive load, not add to it.

| ❌ Never Say This | ✅ Say This Instead | Why It Works |
|---|---|---|
| "Wrong answer." | "Not quite — here's what the examiner wants you to think." | Turns failure into insider knowledge |
| "Correct!" | "✅ Correct. That's the NORCET way." | Reinforces that they're learning exam logic, not just trivia |
| "Explanation:" | "Why this, not the others:" | More conversational. Makes the rationale feel like a senior explaining, not a textbook |
| "Skip question." | "Save for review." | Removes the guilt of skipping. They're being strategic, not giving up. |
| "Time's up!" | "Shift ended. Let's see how you held up." | Stays in tone. Makes even failure feel narratively interesting. |
| "You scored 14/20." | "14 correct. In a 200-mark NORCET paper, that pace puts you at 70 marks — close, not there yet." | Contextualizes their raw score against the actual exam. Instantly meaningful. |
| "Review your mistakes." | "Study your near-misses. This is where ranks are decided." | "Near-misses" is psychologically accurate and more motivating than "mistakes" |

---

### SECTION 4 — NEGATIVE MARKING WARNINGS

This is uniquely high-stakes for Indian competitive exams. The copy must build strategy, not fear.

| ❌ Never Say This | ✅ Say This Instead | Why It Works |
|---|---|---|
| "Warning: -0.33 for wrong answers." | "NORCET Rule: A confident wrong answer costs more than a skip." | Teaches exam strategy in plain language |
| "Are you sure?" | "Is this a 'I know this' or an 'I think this'? Only attempt if you know." | Gives them a mental framework for decision-making under pressure |
| "-0.33 marks deducted." | "−0.33. The examiner got you. Learn why below." | Personifies the exam. Turns it into a game they're determined to beat. |
| "Don't guess." | "Guess only when you can eliminate 2 options. Otherwise, skip and protect your rank." | Actionable strategy instead of a warning |

---

### SECTION 5 — GAMIFICATION & TICKET STORE

The store is where you're most at risk of feeling like a casino. The language must make rewards feel earned, not bought.

| ❌ Never Say This | ✅ Say This Instead | Why It Works |
|---|---|---|
| "Spin the wheel!" | "Open your Shift Survival Kit." | "Kit" implies it's a tool, not a gambling mechanism |
| "You won a prize!" | "Your shift paid off. Here's what the ward left you." | Connects the reward to the effort they actually put in |
| "Buy tickets." | "Tickets are earned in the ward, not sold." | Pre-emptively closes the "is this a money grab?" question |
| "Redeem now." | "Claim your shift bonus." | "Shift bonus" sounds like something they deserve for working hard |
| "Not enough tickets." | "You need 12 more Overtime Hours. One more game shift will cover it." | Tells them exactly what to do instead of just blocking them |
| "Mystery reward!" | "Blind drop. Could be a cheat sheet. Could be better." | Lean into the mystery with confidence instead of manufactured hype |

---

### SECTION 6 — PRICING & UPGRADE SCREENS

This is the hardest copy to get right. Indian students are allergic to being sold to. The language must make buying feel like a logical, even obvious decision — not a transaction.

| ❌ Never Say This | ✅ Say This Instead | Why It Works |
|---|---|---|
| "Upgrade to Premium." | "Go full Officer mode." | No one wants to "upgrade." Everyone wants to be an officer. |
| "Subscribe now." | "Lock in your seat." | "Lock in" creates urgency without screaming "BUY NOW" |
| "₹499/month" | "₹83 per month. Less than a college photocopy bundle." | Shrinks the number and anchors it to something familiar and cheap |
| "Unlock all features." | "Stop hitting walls mid-shift." | Describes the frustration being solved, not the features being unlocked |
| "Limited time offer!" | "NORCET notifications don't wait. Neither should your prep." | Creates real urgency tied to their exam calendar, not fake scarcity |
| "Free trial." | "Try the full ward for free today." | "Full ward" sounds like they're getting everything, not a watered-down demo |
| "Cancel anytime." | Not needed — you're using one-time passes, not subscriptions. | Never say "cancel" in any context. It plants a doubt. |
| "Most popular plan." | "The one most Officers-in-training choose." | Makes social proof sound aspirational, not generic |
| "Get started." | "Report for duty." | On-brand, zero corporate vibe |

---

### SECTION 7 — PUSH NOTIFICATIONS

Push notifications are either the feature that keeps daily active users alive or the reason they turn off notifications entirely. The line between the two is tone.

**The rule: never remind them to study. Remind them of the competition, the stakes, or something exciting that dropped.**

| ❌ Never Send This | ✅ Send This Instead | Why It Works |
|---|---|---|
| "Don't forget to study today!" | "12 nursing aspirants from your state just completed a full shift. Your daily capsule is waiting." | Peer pressure, not nagging |
| "You haven't used the app in 2 days." | "Your patient flatlined. The ward needs you back." | In-universe language makes absence feel narratively relevant |
| "New questions added!" | "⚡ 50 new Mains scenarios dropped. Toppers are already on it." | Competitive framing creates FOMO without being aggressive |
| "Time to practice!" | "9 PM. Night Shift Raid starts in 10 minutes. Your college is down 2 ranks." | Specific, time-bound, social — the three ingredients of a notification that gets tapped |
| "Your streak is at risk!" | "One answer tonight keeps your Gold Stethoscope alive." | Stakes something they've already earned, not something abstract |
| "Check out our new feature." | "The ward just got a new wing. Take a look before the others do." | Mystery + exclusivity instead of a boring feature announcement |
| "Complete your daily quiz." | "🩺 Dr. Mehta left a case on your desk. Needs a priority call before 11 PM." | Narrative framing makes a quiz feel like an actual task |

---

### SECTION 8 — ERROR STATES & EMPTY STATES

Most apps treat errors as technical events. Your app should treat them as ward incidents.

| ❌ Never Say This | ✅ Say This Instead | Why It Works |
|---|---|---|
| "Error loading questions." | "The ward's network is down. Checking connection..." | In-universe, calm, not alarming |
| "No questions available in this category." | "This wing is still being built. Try Med-Surg or FoN for now." | Explains the gap without making the app feel broken |
| "Connection failed." | "Can't reach the server. Your offline questions are still available — carry on." | Reassures them that offline still works. Removes frustration. |
| "Loading..." | "Pulling your next case..." | Every loading state is an opportunity to stay in character |
| "You've completed all questions!" | "You've cleared the entire ward. New scenarios drop Sunday. You've earned a rest." | Celebrates a real achievement instead of just informing them |
| "Session expired. Please log in again." | "Your session timed out — standard security protocol. Log back in to continue your shift." | Frames a boring UX event as a professional procedure |

---

### SECTION 9 — SOCIAL / LEADERBOARD COPY

Leaderboards can feel shaming or motivating. The difference is entirely in the framing.

| ❌ Never Say This | ✅ Say This Instead | Why It Works |
|---|---|---|
| "You're ranked #47." | "You're 47th in India right now. Top 10 is 312 questions away." | Tells them exactly what the gap is. Makes the goal feel closeable. |
| "Your college is losing." | "Your college is 2 shifts behind this week. One player can change that." | Frames it as an opportunity, not a failure |
| "Top scorer this week:" | "This week's Night Shift Champion:" | More evocative, stays in the ward metaphor |
| "Share your score." | "Show your ward what you scored." | "Ward" = their peer group. Sharing becomes a social statement, not a flex. |
| "Invite friends." | "Build your hostel study squad." | Specific to their actual social context. "Friends" is vague. "Hostel squad" is real. |

---

### MASTER COPY PRINCIPLES — QUICK REFERENCE

1. **Speak to the seat, not the app.** Every line should remind them — subtly — that there's an AIIMS nursing officer seat waiting. The app is just the path to it.

2. **Replace "buy" with "unlock," "earn," "claim," or "activate."** Buying feels transactional. The others feel like achievement.

3. **Replace "you failed" with "the examiner got you this time."** Externalizes failure slightly, keeps motivation intact.

4. **Replace "features" with "what the ward gives you."** Features are what apps have. The ward gives them tools.

5. **Never use the word "subscription."** Use "pass," "status," "access," or "duty clearance."

6. **Replace "limited time" with a real deadline tied to their exam.** "NORCET Stage-1 is 60 days away" is more powerful than any artificial countdown timer.

7. **Keep every notification under 12 words.** If they have to read it, they'll dismiss it.

8. **When in doubt, write it as a senior nurse talking to a junior.** Not a salesperson. Not an app. A senior colleague who wants them to pass.

---

*Strategy version: 1.1 | Copywriting section added June 2026*
