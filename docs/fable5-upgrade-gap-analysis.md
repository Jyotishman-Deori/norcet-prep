# Fable-5 Upgrade Spec — Gap Analysis vs. What's Already Built

> Deliverable required by `fable5-app-upgrade-spec.md` §0 (report back before any implementation).
> Method: two read-only codebase audits (referrals + economy; question system + onboarding),
> cross-checked against the spec section by section. **No spec implementation has been started.**
> Status legend: ✅ BUILT · 🟡 PARTIAL · 🆕 NEW · ⛔ NOT VIABLE AS WRITTEN · 🧭 OWNER DECISION

## Executive summary

Like the earlier PWA-upgrade doc, this spec is best treated as an **idea bank, not a checklist**:
roughly **60–70% of it already exists** in some form. The genuinely new, high-value work is:
referral **rewards** (attribution already works), a **coin spend layer + transaction ledger**,
**admin config UIs** on top of the already-built live-config mechanism, **schema tags + report
categories** for questions, and an **onboarding extension** (exam date + level + referral steps).
Three items are not viable as written (AdMob, Firebase Dynamic Links, and the spec's relational
DB assumptions), and two (Razorpay subscriptions, freemium gating) are business decisions that
collide with the current free-tier/free-to-run posture and need an explicit owner GO.

⚠ **Pre-launch reverts confirmed live** (independent of this spec): XP test curve
`reqScale: 0.2` (`src/lib/game-config.js:26`) and the one-time **+100,000 coin grant**
(`src/App.jsx:2895–2915`). Both carry inline REVERT-FOR-LAUNCH comments.

---

## §2 Referral ID System — 🟡 PARTIAL (~40% built)

**Already built** (`src/lib/referral.js`, `referral-admin.js`, `referral-stats.js`):
- `?ref=` / `?via=` capture at boot → stored locally → stamped onto the new profile at signup
  as `referredBy` / `referralChannel` / `referredAt` (`src/lib/profiles.js:533–558`).
  Self-referral already blocked (referrer id == own id is dropped).
- Share integration: `navigator.share` with a prewritten message embedding the user's referral
  URL (`src/ui/share-app-card.jsx`) — the spec §5 "one-tap share" already exists.
- Admin **Growth** dashboard: totals, weekly trend, channels, top-referrers with
  confirmed/pending + retention, and signup **anomaly flags** via the existing Edge Function
  (`loadSignupAnomalies`). Fingerprint/IP are already logged **one-way hashed** in
  `signup_events` — privacy-safer than the spec's raw "device fingerprint logging".
- A "qualifying action" *heuristic* exists for reporting only (`isConfirmed()`:
  ≥1 attempt or a 60s return visit) — explicitly marked as an approximation.

**Gaps (the real §2 work):**
1. **Rewards**: no coins are paid for referrals at all. Needs: payout on qualifying action
   (spec: referred user completes first full mock), once per referred user, both sides credited.
   Depends on the coin ledger (§4) so awards are auditable/idempotent.
2. **Distinct referral code**: today the "code" is the profile slug (`referralCodeFor` =
   `profile.id`). Works, but it changes on rename and leaks the username. A `NRS-XXXX` code
   derived from the durable `uid` (server-checked unique at registration) matches the spec.
3. **Rate-limit flag** (>10 referrals/24h → admin review flag): extend the existing anomaly
   surface; flag-only per spec.
4. **Admin actions**: mark referral valid/invalid + adjust coin awards (Growth dashboard is
   read-only today).

**⛔ Deep links as written**: Firebase Dynamic Links was **shut down (Aug 2025)** — do not use.
The PWA's plain `https://www.nurseholic.in/?ref=CODE` URL **already survives install** (captured
at first open, persisted until signup) — this IS the correct PWA deep-link mechanism. Only
addition worth making: a small "You were referred by {name}" confirmation moment in onboarding.

## §3A Null / Abandoned Attempts — ✅ BUILT (~90%)

Verified in code: **nothing is persisted until submission** on every test type.
- Quiz: results accumulate in component state; `completeQuiz` (`src/App.jsx:2501–2657`) writes
  history/stats **only when the run finishes**; the exit dialog says "won't be saved" and the
  abandon path writes nothing.
- Advanced/paper tests: single write at manual submit or timer auto-submit
  (`submitAdvancedTest` / `submitPaperTest`); abort persists nothing. Previous papers already
  deliberately excluded from streak/totalAttempted (CLAUDE.md stats-model decision).

**Remaining polish (small):** no `beforeunload` guard on desktop tab-close and no
`visibilitychange` abandonment flag for iOS standalone (spec §3A requirement). Both are
additive listeners during an active test. Everything else in §3A is done.

## §3B Repetition / Mastery — 🟡 PARTIAL (~65% built, different but working model)

**Already built:**
- Per-question history `history[qId] = { attempts, reviewCount, nextDue, lastResult }` with SR
  scheduling `[1,3,7,14,30,60]` days, wrong → 1 day + reset (`src/lib/utils.js:21–25`).
- Unseen-first selection + need-score ordering (overdue +30, last-wrong +50, staleness decay)
  in `src/lib/quick-practice.js`; weightage-balanced allocation; per-session repeat-avoidance;
  presented-but-unattempted pool resurfacing (`repeat-unattempted.js`).
- "Review due · N" home card (`getDueQuestions`) + 7-day forecast (`review-forecast.js`).
- Topic-level mastery tiers already exist (`kmap.js`: discovered/familiar/mastered).

**Gaps:** per-question mastery *labels* (spec's unseen/learning/reviewing/mastered — derivable
from existing fields, no data migration needed), admin-configurable intervals + selection
ratios (wire into the **existing** `game_config` live-config row — the mechanism is built),
and admin views (mastery distribution, highest-incorrect questions, per-topic history reset).

**Recommendation:** do NOT replace the working SR model with the spec's tables — **derive** the
spec's mastery labels from `reviewCount`/accuracy and expose the intervals via `game_config`.
Zero risk to existing user history; full spec compliance in behavior.

## §3C Question Schema / Upload / Reports — 🟡 PARTIAL (~55% built)

**Already built:** JSON+CSV upload with validation (`question-import.js`), bank versioning +
per-user version sync that preserves history (stable ids `bankq-{bankId}-{n}`), public/private
visibility with `publishedAt`, report flow → admin inbox with reply statuses, per-question
reporter aggregation with **threshold-3 auto-flag** + admin "pull from tests" quality gate
(`question-gate.js`, `qgate:hidden`) enforced server-side.

**Gaps:** report **categories** (currently free text — add the spec's 5 categories to the
report modal), richer tagging at upload (subtopic, difficulty already optional; exam-type is
moot — see §5 note), per-question analytics view (seen count / correct rate — computable from
aggregated report + served data at this scale), question **text version archive** on edit, and
soft-delete for banks (individual questions already soft-hide via qgate; bank delete is hard).
"Pool health" partially exists as the admin **Bank health / demand** view — extend, don't build new.

## §4 Coins / Freemium / Subscription — 🟡 economy PARTIAL (~50%), 🧭 monetization = owner decision

**Already built:** coins + hearts (`economy.js`), XP/levels with **daily anti-grind cap**,
daily quests, supply crates, cosmetic frame shop (the one existing spend path), weekly XP for
the Games board — and the exact "**config without redeploy**" mechanism the spec demands:
`game_config` row in `kv_shared`, deep-merged over defaults at boot (`game-config.js`).

**Gaps (buildable, no business dependency):**
1. **Earn events** per spec (mock completions, streak days, topic completion) — must hook the
   *completed-attempt* paths only (§3A already guarantees null attempts can't earn).
2. **Spend paths** (retake unlock, per-session analytics, leaderboard visibility) — none exist.
3. **Transaction ledger** per user (every earn/spend with ts/type/amount) — none exists; also
   the prerequisite for referral rewards and any future monetization audit.
4. **Global header coin balance** with animated ticks — today coins show only in LevelUp + Quiz.
5. Wire `economy.js` constants (WHY_BONUS etc.) into `game_config`.

**🧭 Owner decisions required before any §4 monetization work:**
- **Razorpay subscriptions**: real business setup (KYC, billing, refunds, webhooks via a new
  Edge Function). Collides with the standing **free-tier / free-to-run** constraint until you
  explicitly change it. Freemium quotas (3 full mocks/week etc.) are also product decisions —
  and honest enforcement needs server-side checks, not client hiding.
- **⛔ AdMob rewarded ads**: AdMob is a native SDK — it **cannot run in a PWA**. The web
  alternative would be a web ad network (quality/UX cost) — recommend dropping rewarded ads
  or deferring until there's a wrapped native build.

## §5 Premium Onboarding — 🟡 PARTIAL (~50% built)

**Already built:** a full welcome tour (`welcome.jsx`): pitch → library → gender/qualification/
schedule/rhythm calibration → ikigai ("reason why") → section tour → gesture tips, all
skippable; the **exam-countdown home card** with daily pace targets already exists
(`home.jsx:952+`), and an exam-date editor screen exists (`exam-date-screen.jsx`) — it's just
not part of onboarding.

**Gaps:** wire an **exam-date step** into the tour (reuse `ExamDateEditor` + live "X days
remaining"), a **current-level step** (seed difficulty weighting), and a **referral-code step**
(pre-filled from the pending referral + "You were referred by {name}"). Personalized landing
("first recommended action") is a small home addition.

**🧭 Spec conflict:** the spec's Step 1 "exam selection (NEET-PG / NCLEX / State Board)" —
this app is **NORCET-specific** by identity and content. Recommend dropping multi-exam
selection (or reducing it to a NORCET tier/target question) unless you intend a content pivot.

## §6 Micro-animations / Share Card / Design Tokens — 🟡 PARTIAL (~70% built)

- **Animations:** a large, house-styled system already exists (spring
  `cubic-bezier(.34,1.56,.64,1)`, `.pressable` press-scale, staggered entrances, celebration
  systems, comprehensive `prefers-reduced-motion` opt-outs). The spec's "every interactive
  element" is an **audit-and-fill pass**, not a rebuild. The notebook rework (in flight) already
  applies the spec §6 standard.
- **Score share card:** partially exists — result/crib share images + `navigator.share` file
  sharing are present (`result-cards.jsx`, `qr-canvas.js`); needs verification against the
  spec's design bar and a download fallback check.
- **Design tokens:** colors are tokenized (5 themes → CSS vars + A8 utility classes). Missing:
  documented **spacing/radius/shadow/duration** scales — a small `design-tokens` doc/file task,
  worth doing first exactly as the spec orders.

## §7 Admin Panel — 🟡 PARTIAL

Exists: banks, feedback+quality gate, users, growth/referrals (read-only), helpfulness, bank
health, crash reports, manage admins, FAQ, announcements, AI content staging.
New per spec: **live config editor UI** (for `game_config` + new SR/coin values — mechanism
exists, UI doesn't), referral management **actions**, per-user mastery/question-pool views,
pool-health thresholds + alert. (Email alerts need a sender service — free-tier constraint;
recommend an in-panel indicator + existing push instead.)

---

## Not viable / must-correct list (spec assumptions vs reality)

| Spec assumption | Reality | Correction |
|---|---|---|
| Firebase Dynamic Links | Shut down Aug 2025 | Plain URL params — already built and working |
| AdMob rewarded ads | Native SDK; app is a PWA | Drop or defer to a native wrap; don't block §4 on it |
| Relational DB (FKs, unique constraints, "database-level") | App data = JSON blobs in `kv_shared` + broker | Same behaviors via kv patterns (uid-keyed rows, broker-enforced writes, config rows) |
| Raw device fingerprinting | Already one-way hashed in `signup_events` | Keep hashed (privacy-correct); don't store raw |
| Razorpay + email alerts + ads | Free-tier / free-to-run standing constraint | Explicit owner GO required before monetization work |
| Multi-exam selection (NCLEX etc.) | App is NORCET-specific | Owner decision; recommend drop/reframe |

## Corrected phased order (one section per session, per spec §0/§9)

0. **Pre-launch reverts** (independent, 5 min): `reqScale` → 1, delete the 100k grant block.
1. **Design tokens doc** (small) — spec's own step 1.
2. **§3A completion** (small): `beforeunload` + iOS `visibilitychange` abandonment guards.
3. **Mastery labels + live SR config** (§3B): derive labels, wire intervals/ratios into `game_config`, admin views.
4. **Report categories + question tagging + per-question analytics** (§3C).
5. **Coin ledger + earn events + spend paths + header balance** (§4, non-monetization half).
6. **Referral codes + rewards + admin actions** (§2) — depends on 5.
7. **Onboarding extension** (§5): exam-date, level, referral steps + personalized landing.
8. **Animation audit pass + share-card verification** (§6).
9. **Admin config UIs consolidated** (§7) — built alongside 3–6, finished here.
10. **🧭 Monetization** (Razorpay/freemium/ads) — only after explicit owner GO on the business decisions above.

*Each phase ships with contract tests + the vite compile gate, per house rules. Frontend-first,
server-second ordering for any coupled broker changes (CLAUDE.md deploy rule).*
