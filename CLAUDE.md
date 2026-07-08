# NORCET Prep — Project Context for Claude Code

A gamified study/practice PWA for the NORCET nursing exam. Live at **www.nurseholic.in**.
Small scale (~10–50 users). One repo ships **two apps**: the student app and a
standalone admin app that share `src/lib` but never import each other's roots.

When you change code: keep edits **minimal** and **preserve existing behavior verbatim**
unless a change is explicitly requested. This is a live production app with real users.

---

## Stack

- **Frontend:** React + JSX, built with **Vite**. It's a **PWA** (Workbox precache).
- **Backend:** **Supabase** — PostgREST (REST over Postgres) + Edge Functions (Deno/TS).
- **Local storage:** IndexedDB.
- **Hosting / deploy:** **Vercel**, auto-deploys on push to `main` (= production).
- **Tests:** per-module contract/behavioral tests run under **Node**, plus a full-graph
  **esbuild** bundle-with-stubs as the compile gate (target: 0 errors / 0 warnings).
  Every new `src/lib` module ships with a focused test.
- **Local loop:** `npm install` → `npm run dev` to test → `git add . && commit && push`.

---

## Repository layout

```
src/
  App.jsx              # PURE application root: router/boot only. NO screens inline.
  screens/*.jsx        # every screen, modal, and toast
  lib/*.js(x)          # shared pure logic (each has a test)
  data/*.js            # seed content & explanations
  ui/*.jsx             # shared UI (nav-drawer, icons, etc.)
  admin-main.jsx       # admin app entry  ─┐
  AdminApp.jsx         # admin app root    ─┴─ standalone admin app
public/data/*.json     # content: reference, dosage, concept-cards, help
supabase/functions/    # Edge Functions (kv-write broker, admin-manage)
admin.html             # admin app HTML entry → builds to dist-admin
```

**Adding a feature (the established pattern):**
1. New screen → new file in `src/screens/`, read theme via `const { theme: T } = useTheme()`.
2. Shared pure logic → new file in `src/lib/` **+ a small test**.
3. Wire into `App.jsx`: one import + one router-dispatch branch (and/or a nav entry).
   Pass data via props or existing contexts (`useProfile` / `useData`).
4. Confirm it compiles (esbuild) and add a focused test for the new module.

---

## State & context model

- **Theme:** `const { theme: T } = useTheme()` from `src/lib/app-context.jsx`.
  There is **no module-level `T` / `IS_DARK`** — that bridge was deleted. Never reintroduce it.
- **Profile:** `useProfile()` (ProfileContext). **Data:** `useData()` (DataContext).
- **Profile identity:**
  - `profile.uid` — the **durable** handle (`genUid()`, `crypto.randomUUID` w/ fallback).
    Rename-safe; backfilled by `ensureUid()` on load.
  - `profile.id` — a **displayName slug** that **changes on rename**. Don't use it as a key.
  - `GUEST_ID` — the constant uid for guest profiles.

---

## Storage architecture (read before touching persistence)

`src/lib/storage.js` routes every read/write by a `shared` flag. **Don't change the
`storage.js` API or the `safeStorage` shim** — only call sites.

- `shared: true`  → **Supabase** PostgREST, table `kv_shared` (`key TEXT PK, value TEXT`).
- `shared: false` → **IndexedDB** (local, per-device).

User progress (answered questions, scores, stats, streaks, bookmarks, revision) is keyed
**per profile** (e.g. `userdata:{profileId}`). Online writes go to Supabase with an
IndexedDB cache for offline; reconciliation is **last-write-wins** (fine at this scale).

### ⚠ CONTENT-CACHE RULE — the #1 silent-bug source
`src/lib/content.js` caches each `public/data/*.json` blob in IndexedDB under
`content:NAME:vN`, where `N = CONTENT_VERSION`, and **never re-fetches while that key
exists**. So:

> **Whenever you edit ANY file in `public/data/` (help, reference, dosage, concept-cards),
> increment `CONTENT_VERSION` by 1 in `src/lib/content.js`.**

That one line busts both the IndexedDB key and the `?v=N` network query. **Forgetting it =
edited content silently never appears, with no error.** If "my JSON edit didn't show up,"
this cache is the cause — not a build failure.

---

## Gamification model

- **Leaderboard** (`src/lib/leaderboard.js`, `shared: true`, key `leaderboard:{profileId}`):
  tabs **This Week** (weekly answered) / **Streak** / **Accuracy**. Week boundary is
  **UTC-Monday** (`weekStartStr`, matches `dailyHistory`). `saveLeaderboardEntry` is
  fire-and-forget, skips 0-activity users, and fires **once per session end**. The shared
  read **never returns names or individual scores** beyond the comparison card.
- **Economy / XP** (`src/lib/economy.js`, pure store: `normalizeEconomy` + helpers):
  game completion → `handleGameComplete` (XP + accuracy). `LevelUp.jsx` is the games hub;
  clinical mini-games feed it.
- **Mastery celebrations** are **tiered** (discovered → familiar → mastered), play in
  ascending tier order, capped at `CELEB_MAX`. Snapshots persist locally per profile.
- **Streaks:** `stats.streakCurrent`. **Previous-year-paper tests deliberately do NOT
  update `streak` / `totalAttempted`** — changing that is a stats-model decision, not a
  leaderboard tweak. Don't "fix" it casually.

**Rule of thumb:** XP/streak/leaderboard math lives in pure `src/lib` functions, separate
from UI and from storage. Server/shared state is the source of truth, not the client view.

---

## User-facing text — NO em dashes (hard rule)

- **Never** use an em dash (—) or a double hyphen (`--`) in any user-visible copy:
  JSX/TSX text, display strings, `public/data/*.json` content, notification/reminder
  messages, tooltips, toasts, placeholders. Em dashes read as "AI-generated" and erode
  student trust in the question bank.
- Use a **period** (two independent clauses), a **comma** (appended/dependent clause),
  or a **colon** (label → definition) — whichever the sentence actually calls for. Don't
  blind-swap to commas; that creates comma splices that look *more* AI-authored.
- **Scope is display copy ONLY.** Do NOT touch code operators (`--i`), CLI flags
  (`--no-verify-jwt`), CSS vars (`--dnav-h`), regex, or comments. En dashes (–) in
  numeric ranges ("60–100 bpm", "3–5 min") are correct typography — leave them.
- The `'—'` glyph used as an empty-value placeholder in tables (e.g. `loading ? '—' : n`)
  is a UI symbol, not prose — leave it, or swap for a period/blank if restyling.

## Content authoring conventions

- **Explanation format** (built-in and imported banks): plain text rendered with
  `whitespace: pre-wrap` — **no markdown**. Use `ANSWER` / `WHY` / `(detail)` / `EXAM TIP`
  with **CAPS labels + blank lines**, never `**bold**`. Per-option "why the others are
  wrong" rationales. In JSON, `\n` for line breaks.
- Seed explanations live in `src/data/seed-explanations.js`, keyed by question id, and are
  merged over **only** `exp` and `wrong` (never `options` / `correct` / `id` / `topic` / `type`).
- **Accessibility/feel:** respect `prefers-reduced-motion` everywhere (skip all animation,
  camera moves, haptics, chimes — just show the new state). Haptics are mobile-only and
  feature-detected (`navigator.vibrate`). Audio is **off by default**, synthesized via Web
  Audio (no audio files), and gesture-unlocked on enable.

---

## Security & admin (treat as production security boundary)

- **Admin allow-list:** Supabase table `admin_profile_ids` (`profile_id` PK). Multiple rows
  = multiple equal admins. Verification is **server-side and fail-closed** (`checkServerAdmin`).
- **The student bundle ships ZERO admin code.** `isAdmin` has no path to `true` in the
  student app; the admin app is a separate build (`dist-admin`). Don't reintroduce an admin
  surface into the student app.
- **Server-side enforcement is the real lock:** the `kv-write` Edge Function broker rejects
  non-admin `bank:` writes. Frontend hiding of admin UI is **cosmetic only** — never rely on
  it for security.
- **Secrets never live in the repo.** `ADMIN_PASSPHRASE` is a Supabase secret; Supabase URL
  and anon key come from env vars **`VITE_SUPABASE_URL`** / **`VITE_SUPABASE_ANON_KEY`**.
  Never hardcode keys, the project ref, or the passphrase in source or a committed `.env`.
- Edge Functions are deployed with **`--no-verify-jwt`** (redeploying without it breaks
  client calls). Persist the flag in `supabase/config.toml`.
- **Security findings register:** `docs/security/findings.md` (maintained by the
  security-auditor agent).

---

## Deploy flow (two separate production surfaces)

1. **Frontend:** push to `main` → Vercel deploys prod (www.nurseholic.in). Current policy is
   "push every update straight to production."
2. **Edge Functions:** a **separate** prod surface — `supabase functions deploy <name>`.
   A change touching both needs **both** a `main` push **and** a function deploy.

⚠ **Coupled changes ship in safe order.** When a frontend change and a stricter broker
change go together, ship the **frontend first** (so the UI is gone before the server starts
rejecting), then deploy the broker. Doing it in reverse opens a "broken window" where live
users hit 403s on a still-visible button.

### ⚠ Pre-push verification gate (MANDATORY — a crash in prod = owner's reputation)

A production crash shipped on 2026-07-08 (fogSet TDZ: tests + build green, every
Knowledge Map open crashed live). "It compiles" is NOT verification. Before ANY push
to `main` that touches `src/`:

1. `npm test` must pass — it now includes a **render smoke** (`scripts/smoke/`) that
   server-renders the real Knowledge Map screen; first-render crashes fail the gate.
2. Any changed **screen** must be **rendered at runtime** before pushing: drive it in
   `npm run dev`, or clone the `scripts/smoke` harness for that screen (stub only
   `app-context` hooks + `src/storage`). A memoized component's **deps array is
   executed code** — every name in it must be declared above it.
3. For risky/large changes, verify on the dev-branch Vercel preview
   (`norcet-prep-git-dev-*.vercel.app`) **before** promoting `dev` → `main`.
4. After every production push, check the **admin panel error log** (`errlog:`) for
   new entries instead of waiting for the owner to report a broken screen.

---

## Agent workflow (this project's sub-agents)

`.claude/agents/` defines: `backend-engineer` (data, study engine, Supabase contracts),
`game-mechanics-engineer` (XP/streak/leaderboard logic as pure functions),
`frontend-engineer` (screens & gamification UI), `code-reviewer` (read-only diff + test
gate), and `security-auditor` (holistic audit → `docs/security/findings.md`). Reward logic
stays out of UI components; the server is authoritative for scores, XP, and streaks.

---

## Open refactor items (don't re-suggest finished work)

The big modularization (A1 split, A7 theme-context, bridge deletion) and the admin-app
separation (Phases A–C) are **done**. Still open: **A5** route code-splitting, **A12** URL
routing, **A13** types, and **Phase D** (deploy the admin app as a 2nd Vercel project on the
same repo — `npm run build:admin`, output `dist-admin`, same Supabase env vars, admin
subdomain). None are prerequisites for shipping features.


## Hard constraint — NO runtime AI
This app must remain free to run. NEVER add an LLM/AI API call (Anthropic,
OpenAI, etc.) to the shipped app, and never add an API key or paid service.
"AI-flavored" features (explanations, doubt-solving, recommendations) are
implemented with pre-authored static content, rules, or precomputed data —
never a live model call. If a task seems to need an API, stop and flag it
instead of adding one.

**The one sanctioned exception:** the **admin-only** `content-staging` Edge Function has a
`generate` action that calls Gemini to *draft* questions into the review queue. It is
deliberate and owner-approved: it runs **server-side** (key is a Supabase secret, never in any
bundle), is triggered only by an authenticated **admin**, every draft is **human-reviewed**
before it can reach a student, and Google billing stays **OFF** (over-limit → HTTP 429, never a
bill). The **student bundle stays 100% AI-free.** Do NOT remove this as a "fix," and do NOT use
it as precedent to add any AI call to the student app. See `CONTENT_PIPELINE.md`.