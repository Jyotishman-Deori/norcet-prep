markdown# Technical Specification & Design Document: "Level Up: RN" Gamification Ecosystem

This document outlines the absolute architecture, game-balancing math, loot drop matrix, and backend mechanics required to overlay a unified gaming ecosystem onto an existing suite of separate nursing study sections.

---

## 1. Core Architecture Overview
Instead of refactoring the core logic of existing games, the gamification system operates as a **unified background state manager**. Individual, standalone gameplay screens remain decoupled but communicate with a centralized database via lifecycle hooks (triggers).

Use code with caution.+----------------------------------------------------------------------------+|                             MAIN NAVIGATION BAR                            ||  [Games]   [Flashcards]   [Mock Exams]   [Study Groups]   🏆 [LEVEL UP]    |+----------------------------------------------------------------------------+│┌──────────────────────────────────────────────────────────────┘▼[ THE LEVEL UP SEPARATE PROFILE HUB ]├── 🔋 Mana / Energy Bar   --> Tracks overall daily study limits (Stamina)├── ❤️ HP Status Tracker   --> Shows current health / active debuffs├── 🎖️ Character Title      --> Dynamic 1–100 Progression Tier System├── 📦 Loot Inventory      --> Unopened Medical Supply Crates└── 💀 Respawn Gate        --> Dynamic lockout mechanism when HP = 0
---

## 2. Global Core Loop Metrics

### 🔋 Mana / Energy Bar (Study Stamina)
*   **Purpose**: Prevents user burnout and drives a high-retention psychological loop (returning to the app twice daily).
*   **Capacity**: Starts at 100 max capacity. Max capacity scales up with specific milestone levels.
*   **Regeneration**: Automatically restores +1 Mana every 10 minutes. Fully restores instantly upon achieving or maintaining a 5-day **Streak Fire**.

### ❤️ HP (Health Points) Bar
*   **Purpose**: Applied strictly to high-stakes, real-time survival simulation sections.
*   **Capacity**: Fixed at 100 HP.
*   **Mechanic**: Negative feedback loop. Mistakes made during timed simulations deal direct damage to the HP bar. Reaching 0 HP triggers an immediate software layout lockout via the **Wipeout Overlay**.

---

## 3. The 1–100 Level Ladder & Prestige Tiers

The 100 levels are mapped into 6 distinct clinical prestige tiers. Progression requirements follow an exponential difficulty curve to keep early advancement rapid and addictive.

### Progression Formula
The backend calculates level thresholds using an exponential scaling formula:
$$\text{XP Required for Next Level} = 100 \times (\text{Current Level})^{1.5}$$

### Tier Blueprint & Titles
*   **Levels 1–10: Tier 1 – The Novice** (Title: `First Responder`)
    *   *Visual Asset*: Clean, minimalist base scrub icon.
*   **Levels 11–25: Tier 2 – The Clinician** (Title: `Triage Initiate`)
    *   *Visual Asset*: Clipboard icon with a silver medical badge.
*   **Levels 26–45: Tier 3 – The Specialist** (Title: `Code Blue Knight`)
    *   *Visual Asset*: Glowing cyan stethoscope graphic.
*   **Levels 46–70: Tier 4 – The Elite Frontliner** (Title: `ICU Avenger`)
    *   *Visual Asset*: Animated defibrillator node emitting subtle electricity particles.
*   **Levels 71–95: Tier 5 – The Commander** (Title: `Vital Signs Overlord`)
    *   *Visual Asset*: Golden injection icon embedded with flame vector graphics.
*   **Levels 96–100: Tier 6 – The Living Legend** (Title: `God-Tier: Registered Nurse`)
    *   *Visual Asset*: Crown composed of interlocking crimson medical crosses.

---

## 4. Complete Economy & Economy Balancing Sheet

The system utilizes strict input/output rules across all 8 separate gaming modules. To prevent cheating or automated script farming, a strict global cap of **3,000 XP per 24 hours** is applied across the database layer.

| Standalone Section | Mana Entry Cost | Base XP (Win) | Penalty on Quit | HP Damage (On Mistake) | Core Gaming / UI Interaction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 🗺️ **Knowledge Map** | Free (0) | +50 per Node | None | 0 HP | **The Gatekeeper**: High-level modules feature an overlay requiring specific level titles to unlock (e.g., *Requires Level 46: ICU Avenger*). |
| 🎯 **Clinical Skill Drill** | 5 Mana | +1.5 XP / Card | -5 Mana | 0 HP | **The Grinding Range**: Answering 5 cards correctly in sequence triggers a **"STEADY HANDS!"** UI banner and a temporary +10% XP multiplier. |
| 👁️ **Spot the Structure** | 10 Mana | +30 XP | -10 Mana | 0 HP | **The Vision Quest**: Finding a target structure in <3 seconds triggers an **"EAGLE EYE!"** speed Critical Hit micro-animation and +10 bonus XP. |
| 🩺 **ICU Monitor** | 15 Mana | +120 XP | -15 Mana | -20 HP | **The Dungeon Run**: Mistakes immediately drain 20 HP from the global top header. Surviving the shift triggers a **Medical Supply Crate Loot Drop**. |
| 🛒 **Crash Cart** | 10 Mana | +80 XP | -10 Mana | -20 HP | **Inventory Puzzle**: Selecting incorrect medication under time constraints triggers a haptic buzz and visual explosion animation, inflicting 20 damage to HP. |
| 🗂️ **The Sorter** | 10 Mana | +60 XP | -10 Mana | 0 HP | **Arcade Mode**: Continuous rapid multi-column patient sorting. Perfect sort rows build a score combo multiplier applied at round termination. |
| 🎯 **Distractor Assassin** | 10 Mana | +40 XP | -10 Mana | 0 HP | **Shooter Mechanic**: Tapping a conceptual distractor option within 5 seconds executes a **"CRITICAL HIT!"** neon pop-up alongside a glass-shattering sound cue. |
| ⚔️ **Tie Breaker** | 20 Mana | +200 XP | -20 Mana | -100 HP (Instant K.O.) | **The Competitive Arena**: High-stakes live PvP. First player to select an incorrect answer suffers an instant 100 HP wipeout. Winner steals 50 XP from loser. |

---

## 5. Loot Box Probability Matrix & Reward Tiers

When a student triggers a **Medical Supply Crate Loot Drop** (earned by hitting 7-day streaks, winning a *Tie Breaker*, or surviving an *ICU Monitor* shift), the backend randomly pulls a payload using the following mathematical odds:

### 🟢 Common Drops (70% Probability)
*   **Item 1 (40% weight)**: `15-Minute Double XP Stim Pack` (Activates instantly on next games).
*   **Item 2 (30% weight)**: `Instant +30 Mana Refill Injection`.

### 🔵 Rare Drops (25% Probability)
*   **Item 1 (15% weight)**: Custom Profile Cosmetic Frame (e.g., *Neon Stethoscope Border*).
*   **Item 2 (10% weight)**: Special Chat Sticker Pack for study groups (*"Code Blue!", "A+ Charting"*).

### 🟣 Epic Drops (5% Probability)
*   **Item 1 (4% weight)**: `Golden Phoenix Token` (Allows a user to instantly bypass a *Respawn Room* lockout once without reading the rationales).
*   **Item 2 (1% weight)**: Real-world incentive code (e.g., Partner discount voucher for external NCLEX study text guides).

---

## 6. Server Cron Jobs & Temporal Rules

*   **Daily Reset (00:00 User Local Time)**: The database flushes the active `Daily Quest Log` and resets the daily **3,000 XP cap** ticker back to zero.
*   **Weekly Reset (Sunday 23:59 UTC)**: Closes the active competitive Leaderboard loop. Top 3 ranked users on the leaderboard are programmatically awarded 2x **Medical Supply Crates** delivered directly to their Level Up profile hub inventory.

---

## 7. UI/UX "Juice" & Micro-Interactions

*   **Universal Top Header Wrapper**: Embedded globally at the root of all standalone gameplay views. Persistently reveals real-time status of `🔋 Mana`, `❤️ HP`, and current `🔥 Streak Count`.
*   **Streak Fires**: Profiles reaching a 5+ day streak display a procedural web animation overlay on their profile image, rendering active neon orange flames on leaderboards.
*   **Loot Box Mechanics (Supply Crates)**: Utilises a 3-tap physical animation wrapper (`Lottie` or `Rive` vectors). Tap 1: Box bounces and rattles. Tap 2: Seams crack emitting golden radial light rays. Tap 3: Inventory payload card pops forward.

---

## 8. The Failure State: Wipeout & Respawn Room

If a user's HP reaches 0 while playing inside *ICU Monitor*, *Crash Cart*, or *Tie Breaker*, the screen triggers an immediate full-screen modal interception.

+-------------------------------------------------------------+|                         DEFEATED!                           ||               Your Clinical HP hit 0 in the ICU             |+-------------------------------------------------------------+|                                                             ||  [!] CURE YOUR DEBUFFS TO RESPAWN:                          ||                                                             ||  Review the 3 pharmacology errors you made to heal your HP.  ||                                                             ||  [ STUDY ERROR 1 ]  --> +33 HP                              ||  [ STUDY ERROR 2 ]  --> +33 HP                              ||  [ STUDY ERROR 3 ]  --> +34 HP                              ||                                                             |+-------------------------------------------------------------+|                 [ REVIVE & RE-ENTER THE MAP ]                |+-------------------------------------------------------------+
### The System Logic
*   **Hard Lockout**: Entry routes to all standard gaming modules are programmatically disabled while `user.current_hp == 0`.
*   **The Educational Loop**: To reset the state machine, the user must click into their active error rationales inside the **Respawn Room**. Each read rationale programmatically heals a chunk of the HP ledger until the user reaches 100 HP, releasing the global lockout flag.

---

## 9. Recommended Engineering Implementation Plan

1.  **State Layer Definition**: Construct a global profile schema containing `userId`, `experience_points`, `current_level`, `current_mana`, `current_hp`, and `streak_days`.
2.  **Lifecycle Interceptors**: Code two baseline system methods:
    *   `canInitiateMatch(cost)`: Executes a boolean evaluation prior to inflating any separate gameplay scene.
    *   `terminateMatchReport(xpEarned, hpDeduction)`: Dispatches runtime execution updates directly to the centralized database upon scene destruction.
3.  **UI Asset Pipeline**: Bundle visual micro-interactions using highly decoupled asset frameworks to prevent main-thread layout thrashing during animation loops.
