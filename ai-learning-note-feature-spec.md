# Nursing Study App — AI Learning Note-Taking Feature Spec

> This document is a raw feature specification intended for implementation by Claude Code. Wording from the original feature brief has been preserved as-is wherever possible. Sections marked **[OPEN DECISION]** indicate points raised during spec discussion that have not yet been finalized and should be resolved before or during implementation.

---

## 1. Feature Overview

A note-taking feature where the user takes notes of important topics or words or questions in a bulletined format. The note taking will have at most 10 bullets for a session. The bulletined content will later be copyable by the user. The user then copies and pastes that into an AI to learn more about the topics.

The core mechanism: a dynamic **Universal AI Learning Master Prompt** is constructed in the backend. When the user copies their notes (via the "Effective" path), they instead copy the Universal AI Learning Master Prompt — with the user's notes and selected options inserted into it.

---

## 2. Platform, Compatibility & Quality Requirements

The feature should be made in the app such that it **does not break the app**. The app is a **PWA** which works for **mobile, tablet, and PC screens**, both for **iOS and Android**. The UI/UX of this feature should be **premium class** — only the best version.

### Technical Flags for Implementer

These are real platform-level constraints that directly affect how "non-breaking," "all screen sizes," and "premium" are implemented. Each one below is not an edge case — it is a first-class build requirement.

**1. Clipboard API behavior differs by platform.**
iOS Safari (and iOS PWAs running in standalone/home-screen mode) restrict the Clipboard API to direct, synchronous user-gesture-triggered calls. Copy actions that happen after an async step — e.g., after a backend call assembles the master prompt — can silently fail on iOS. This directly affects the "Effective" path (Section 7), since prompt assembly happens between the user's tap and the copy action. A tested fallback (e.g., a manual "tap to select all text" fallback if `navigator.clipboard.writeText` fails) must be planned for, not assumed to work the same way it does on desktop Chrome or Android.

**2. No hardware/software back button on iOS.**
The spec's "tap the device's back button to exit" (Section 3) is an Android-native and Android-PWA concept. iOS has no equivalent. On iOS, the valid exit paths are: close button, tap-outside-to-close, and the iOS swipe-back gesture (which PWAs in standalone mode do not reliably support the same way a Safari tab does). The device back button requirement should be understood as Android-specific. iOS must be handled exclusively via close button and tap-outside.

**3. Local storage choice matters for PWA reliability on iOS.**
"Stored directly in the user's device storage or cache" (Section 5) is intentionally broad in the original spec. In PWA contexts, `localStorage`, `IndexedDB`, and the Cache API behave differently — and iOS Safari has historically been more aggressive about evicting PWA storage after periods of inactivity (Apple's 7-day Safari storage eviction behavior for installed PWAs is a known issue). For notes the user expects to persist across sessions, **IndexedDB** is the more durable choice over `localStorage`. However, even IndexedDB is not guaranteed safe from iOS eviction long-term. This risk should be reflected in the "caution to the user" disclosure described in Section 5.

**4. The draggable floating button requires safe-area handling.**
On iOS devices with notches and the Dynamic Island, and on Android devices with gesture navigation bars, a freely draggable overlay button can be dragged into a system UI zone (notch, home indicator, status bar) where it becomes visually broken or unreachable. `env(safe-area-inset-*)` CSS safe-area handling and hard drag-boundary clamping must be implemented — not treated as optional polish. If the button can be dragged off-screen or behind system chrome on any device, it directly violates "does not break the app."

**5. Responsive layout is required across all three screen classes.**
A popup "centrally aligned to the user's device's current screen" must have distinct layout behavior across breakpoints, not one fixed pixel size scaled uniformly:
- **Mobile:** full-screen or near-full-screen modal, bottom-sheet style, with touch-optimized tap targets.
- **Tablet:** centered fixed-width modal (e.g., max ~600px), vertically centered, with backdrop dimming.
- **PC/Desktop:** centered fixed-width modal (e.g., max ~640px), vertically centered, keyboard-accessible, with proper focus trapping.
Applying one uniform size across all three will look unpremium on at least one screen class.

**6. Z-index and overlay stacking must be explicitly managed.**
Since the floating button overlays any screen in the app, its stacking context must be deliberately managed so it never sits beneath existing modals, navigation drawers, bottom sheets, or toast notifications present elsewhere in the app. The feature's own popup must similarly always render above the floating/fixed button. Default stacking order is not sufficient — this needs an explicit z-index strategy as part of the implementation plan.

**7. "Premium class" must be implemented as the following concrete requirements:**
- Smooth open/close transitions on the popup (e.g., scale + fade in, slide-up on mobile).
- Smooth drag motion on the floating button with momentum/snap-to-edge behavior on release.
- Haptic feedback on copy and store confirmation actions on Android (Web Vibration API). Note: iOS Safari/PWA support for the Vibration API is not available — this is Android-only and must be gated accordingly.
- Accessibility: sufficient color contrast ratios, minimum 44×44px tap targets on mobile, ARIA labeling for all interactive elements, focus trapping within the popup modal.
- Visual confirmation animations (not just text label changes) for Store and Copy actions — e.g., button morphs to a checkmark with a brief color flash.
- Design tokens (colors, typography, spacing, border radius, elevation/shadow) must match the existing app's design system and not introduce a visually inconsistent widget.

### [OPEN DECISION] — "Premium class" design token alignment
The above defines premium as a set of concrete requirements. However, matching the app's existing design system requires the implementer to have access to the current app's design tokens (color palette, font stack, spacing scale, border radius values, shadow/elevation system). If these are not already documented, they must be extracted from the codebase before this feature's UI is built, or the popup will look visually disconnected from the rest of the app.

---

## 3. Access Points

The user can access this feature via two options:

1. **Fixed position** in the top bar for every screen in the app.
2. **Floating position** (can be dragged to anywhere) in the app — it will overlay over any of the screens in the app.

When the feature's button is tapped, the popup should appear on the current screen the user is on. The popup should be **centrally aligned** to the user's device's current screen.

The user may exit the popup by:
- Tapping the close button
- Tapping the device's back button *(Android only — see Section 2, Technical Flag #2)*
- Tapping anywhere outside the popup

---

## 4. Note Input

- The user is allowed to write or paste content in bulletined form inside the note-taking feature.
- The note-taking feature should support **all types of characters or symbols** that the user will use.
- Bulleted list format only — **at most 10 bullet points**.

---

## 5. Storage & Privacy

- The user must tap the **'Store'** button to save the contents before exiting or minimizing the popup or the app, then can continue their usual task.
- The contents inside the feature will be documented and stored **directly in the user's device storage or cache**, and **not** in the app's server or database.
- The user must be **cautioned about this earlier** (i.e., before/at point of use — disclose that notes are local-only and not synced to the backend).

### [OPEN DECISION] — Unsaved data loss risk
Since persistence is manual (tied to the 'Store' button) and not autosaved, there is a real risk a user fills out up to 10 bullets, then taps the close button or the device back button without hitting Store, and the work is silently lost. Recommendation discussed: show an exit-confirmation dialog (e.g., "You have unsaved notes, save before leaving?") rather than allowing silent loss. Not yet confirmed as final requirement — flagged for decision.

---

## 6. Bottom Controls — Direct vs. Effective

At the bottom of the popup, two options are given to the user before copying contents from the note-taking feature:

1. **Direct**
2. **Effective**

### Direct
Directly copies whatever is in the contents written by the user, with a visual confirmation **'Done'**.

### Effective
Gives the user another popup/list from where the user is allowed to choose the options for the master prompt (Designation, Level, Strategy — see Section 8). The copied content is inserted into the master prompt, followed by a **'Done'** visual confirmation, after which the user can proceed to the **'Copy'** button.

### Store and Copy buttons
- At the bottom of the popup there should be a **'Store'** button (with **more visual emphasis**) and a **'Copy'** button.
- Both buttons must have **visual confirmation** for the user to assure that the content is really copied or stored.

### [OPEN DECISION] — Relationship between Direct/Effective and the Copy button
There is ambiguity in the spec as written: Direct is described as performing the copy itself ("directly copies... with visual confirmation done"), but a separate standalone Copy button is also described at the bottom with its own visual confirmation. Two possible structures were identified during discussion, and a decision is needed on which one to implement:

- **Structure A:** Direct and Effective act as a *mode toggle* only (they don't copy by themselves). The single bottom Copy button is the only actual copy action in both cases — under Direct mode it copies the raw bullets, under Effective mode it copies the assembled master prompt (enabled only after the nested Designation/Level/Strategy popup flow completes).
- **Structure B:** Direct is a self-contained shortcut that copies immediately on tap (independent of the bottom Copy button). Effective is purely a launcher for the nested selection popup, and the bottom Copy button is only used to finalize the Effective path.

This was not resolved in discussion — implementer should confirm intended behavior before building. Note: see also Section 2, Technical Flag #1 regarding iOS clipboard-write timing, which is especially relevant to Structure B's "copy immediately on tap" behavior on iOS PWA.

---

## 7. Post-Copy Flow

After copying (via Direct or Effective), the user can directly paste the copied content into a new conversation with any AI (Gemini, ChatGPT, Claude) and proceed to learn explicitly about it.

---

## 8. Effective Path — Master Prompt Selection Popup

When "Effective" is selected, the user is given a popup to select from a list for three criteria:

1. **Designation**
2. **My Level**
3. **Strategy**

If a user is confused about which to select for any of the three, they are given a **recommended** option — the master common one for each criterion.

### Designation default
The recommended/default Designation is the "Ultimate Designation" — **Director of Nursing Excellence & Clinical Residency Coordinator** (see option 5 in Section 9).

### [OPEN DECISION] — Defaults for Level and Strategy
A default/recommended option for Designation was specified. Defaults for **My Level** and **Strategy** were not specified in discussion and need to be defined (e.g., which Level is the recommended default; which Strategy is the recommended default).

### [OPEN DECISION] — Designation × Strategy compatibility
Some Strategies (notably "Stress-Test Simulator" and "Cognitive Dissonance / Trap Tester," see Section 10) are written in bedside-clinical language ("patient assignment," "intervention," "life-saver vs license-killer"), which fits naturally with Designations 5 and 6 (Clinical Residency Coordinator, Pathophysiologist) but does not logically fit Designations 1–4 (CNO, Legal Nurse Consultant, Director of Nursing Research & QI, Senior Charge Nurse/Leadership Coach), which are domain-specific (operations, law, QI, leadership).

Two resolution paths were discussed, and a decision is needed on which to implement:

1. **Restrict the picker** — only show Stress-Test Simulator and Trap Tester as Strategy options when Designation 5 or 6 is selected; keep Designations 1–4 paired only with Gatekeeper and Blind Spots (domain-agnostic strategies).
2. **Generalize the strategy language** — rewrite Stress-Test Simulator and Trap Tester so "patient" becomes "case/scenario" and "intervention" becomes "decision," so each Designation can apply its own flavor (e.g., a CNO's escalating scenario is a staffing crisis gaining new constraints each turn; a Legal Nurse Consultant's is a case gaining new evidence). This keeps all Designation × Strategy combinations valid but requires more abstract strategy rule text.

This was not resolved in discussion — implementer should confirm intended behavior before building the picker logic.

---

## 9. Designations List

The designations that will be listed for the user to select from:

1. **Hospital Operations and Healthcare Economics:** Chief Nursing Officer (CNO)
2. **Nursing Jurisprudence, Ethics, and Law:** Legal Nurse Consultant or State Board of Nursing Investigator
3. **Quality Improvement (QI) and Evidence-Based Practice (EBP):** Director of Nursing Research & Quality Improvement
4. **Leadership, Delegation, and Conflict Resolution:** Senior Charge Nurse & Leadership Coach
5. **The Ultimate Designation (common designation for confused users):** Director of Nursing Excellence & Clinical Residency Coordinator
6. **The Universal Knowledge Mastery (for users who are confused and want to know densely about a topic):** Chief Pathophysiologist & Clinical Pharmacologist

---

## 10. Strategies List

The strategies that will be listed for the user to select from:

### 1. The "Gatekeeper" Strategy (Adaptive Benchmarking)
How it works: The AI breaks the topic into 3 strict phases. It teaches Phase 1, then administers a high-level application quiz. The user must score a specific grade to "unlock" Phase 2.

### 2. The "Blind Spots" Strategy (Feynman Calibration)
How it works: The user types out everything they know about the topic in their own words. The AI runs it through a grading rubric, calculates the exact percentage of understanding, and specifically targets weak spots.

### 3. The "Stress-Test Simulator" (The Acuity Ladder)
How it works: The AI starts with a stable patient assignment. With every turn, it adds a new complication (a new lab result, a secondary diagnosis, a medication side effect) until the user either safely stabilizes the patient or makes a critical error.

### 4. The "Cognitive Dissonance" Strategy (The Trap Tester)
How it works: The AI presents a scenario and gives an intervention. The user's job is to determine if that intervention is a "life-saver" or a "license-killer."

---

## 11. Universal AI Learning Master Prompt — Template

The dynamic fields are **Designation**, **My Level**, **Target Material**, and the **Strategy-specific rules / tracker**. Below is the most recent agreed structure (built around the "Gatekeeper" strategy as the working example):

```
Designation: [Selected Designation]
My Level: [Insert: Beginner / Intermediate / Expert]
Target Material: [Insert your Single Topic OR Paste your List of Topics here — populated from the user's bulleted notes]

CRITICAL STRATEGY RULES:

1. Structural Pacing: If a list is provided, organize it into a logical roadmap. If a single topic is provided, break it into 3 progressive phases (Science, Bedside Assessment, Critical Intervention).
2. Strict Gatekeeper: Teach me ONLY the very first section/topic right now. Keep it high-density and practical. Do not move forward until I pass your checkpoint.
3. Anti-Sycophancy: CRITICAL: Disable politeness. Do not be a 'yes-man.' If my answer has a single clinical or logical gap, mark it as WRONG immediately. Focus strictly on patient safety, not my feelings.
4. Progress Tracker Scorecard: You must maintain a running scorecard at the very top of every single response. Format it exactly like this:
   * Current Topic/Phase: [Name]
   * Current Mastery Estimate: [0% - 100% based on my previous answers]
   * Status: [Locked / Unlocked - X% Mastered]

Execution: Display the initial Scorecard, then present the first section/topic. End your response with one tough clinical application question to test my understanding. Stop and wait for my response.
```

### [OPEN DECISION] — Scorecard baseline value
Rule 4 states Mastery Estimate is "based on my previous answers," but on the very first response of a session there are no previous answers yet. Without a defined baseline, the AI may default to an arbitrary number to fill the field, undermining the scorecard's credibility on turn one. Recommendation discussed: define an explicit starting state, e.g., Mastery Estimate begins at "0% (Not Yet Assessed)" until the first checkpoint answer is graded. Not yet written into the canonical template above — needs to be finalized.

### [OPEN DECISION] — Per-strategy template variants
The Progress Tracker Scorecard format above (Phase / Mastery % / Locked-Unlocked) was designed specifically around the "Gatekeeper" strategy's discrete-phase structure. It does not cleanly map onto the other three strategies:

- **Blind Spots** fits reasonably well, since Feynman Calibration already involves percentage-based grading inherent to the strategy itself.
- **Stress-Test Simulator** has no discrete phases to lock/unlock — it's one continuous escalating scenario ending in "Stabilized" or "Critical Error." A different tracker shape (e.g., current acuity level / active complications stacked / outcome status) would fit better than Mastery %.
- **Trap Tester** is rapid-fire binary judgment with no real progression arc. A simple tally (correct calls vs. critical errors, possibly a streak counter) may be more appropriate than a phase-based scorecard.

Decision needed: whether to force one unified scorecard format across all four strategies for UI/consistency, or build a purpose-built tracker per strategy (better functional fit, but the "copy result" preview will visually differ depending on which Strategy is selected). Master prompt text for Strategies 2–4 has not yet been finalized and will need to be drafted once this decision is made.

---

## 12. Feedback Row

In the note-taking popup, **under** the Store and Copy buttons, in a new row: ask the user's interest in whether they want AI chat within this app in the future or not, via a **tappable thumbs-up button** — purely to gather feedback on this.

### [OPEN DECISION] — Single thumbs-up vs. thumbs-up/down
A single thumbs-up only captures positive signal and provides no way to distinguish "didn't notice it" from "actively not interested," limiting what can be learned from it. A thumbs-up/thumbs-down pair was suggested as an alternative if a genuine read on demand (positive vs. negative) is desired. If the intent is purely an opt-in interest counter (not a sentiment gauge), the single thumbs-up as specified is sufficient. Needs confirmation of intent before implementation.

---

## 13. Summary of All Open Decisions Requiring Resolution

1. Exit-confirmation dialog for unsaved notes — include or not.
2. Structure A vs. Structure B for how Direct/Effective relate to the bottom Copy button.
3. Default/recommended option for **My Level**.
4. Default/recommended option for **Strategy**.
5. Designation × Strategy compatibility — restrict picker options vs. generalize strategy language.
6. Define Mastery Estimate baseline value for the first response of a session (scorecard turn one).
7. Decide unified vs. per-strategy Progress Tracker Scorecard format, and draft master prompt rule sets for Strategies 2 ("Blind Spots"), 3 ("Stress-Test Simulator"), and 4 ("Cognitive Dissonance / Trap Tester") to match.
8. Single thumbs-up vs. thumbs-up/thumbs-down for the AI-chat-interest feedback row.
9. Storage mechanism (IndexedDB vs. localStorage) — confirm which to use, and confirm whether iOS PWA storage eviction risk is included in the user-facing caution in Section 5.
10. Design token alignment — confirm that existing app design tokens are documented and accessible to the implementer before UI build begins, so the popup does not look visually disconnected from the rest of the app.
