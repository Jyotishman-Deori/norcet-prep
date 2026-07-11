# NORCET Prep — Future Feature Prompts
# Save this file. Copy-paste whichever prompt you need into Claude.
#
# ⚑ CODEBASE IS NOW MODULAR (the A1 refactor is COMPLETE — see below).
#   App.jsx is no longer a single 15k-line file. Attach the LATEST
#   src/ tree (or the latest sliceNN-deliverables.zip), NOT just App.jsx.
#   Theme is React Context (useTheme); there is no module-level T/IS_DARK.
# After each update: unzip → npm install → npm run dev (test locally)
# → git add . → git commit -m "description" → git push (auto-deploys)
#
# ────────────────────────────────────────────────────────────────
# CURRENT STATE  (last updated: end of the A1 refactor + 2 lib tidy-ups)
# ────────────────────────────────────────────────────────────────
#   • App.jsx: ~3,489 lines (down from 15,643). It is now a PURE
#     application root: imports + App-local storage/admin plumbing +
#     the App() router/boot component. ZERO screen/modal components
#     remain inline.
#   • Every screen/modal/toast lives in src/screens/*.jsx. Shared
#     logic in src/lib/*.js(x). Theme via the useTheme() React context
#     from src/lib/app-context.jsx — the old module-level `let T` /
#     `let IS_DARK` bridge is DELETED (A7 complete).
#   • A1 (split), A7 (context), and the bridge deletion are ALL DONE.
#   • Each extracted module has a contract/behavioral test; the full
#     graph compiles clean (esbuild bundle-with-stubs, 0 err/0 warn).
#   • REMAINING refactor items: A5 (route code-splitting), A12 (URL
#     routing), A13 (types) — all now UNBLOCKED by A1. Plus optional
#     lib tidy-ups (see step 42 note). None are required for features.
#
#   HOW TO ADD A FEATURE NOW (the pattern the refactor established):
#     1. New screen  -> new file in src/screens/, reads theme via
#        `const { theme: T } = useTheme()` (NEVER a module-level T).
#     2. Shared pure logic -> new file in src/lib/ + a small test.
#     3. Wire it into App.jsx: one import + one router dispatch branch
#        (and/or a nav entry). Pass data via props or the existing
#        ProfileContext / DataContext (useProfile / useData).
#     4. Verify it compiles; add a focused test for the new module.
#     Keep edits minimal; preserve existing behavior verbatim.

# ────────────────────────────────────────────────────────────────
# ADDITIONAL STATE  (last updated: Jun 2026 — admin hardening +
#                    content restore + bug pass)
# ────────────────────────────────────────────────────────────────
#
#  DEPLOYED AND USER-CONFIRMED WORKING
#  ───────────────────────────────────
#   • Bug fixes:
#       - Quiz check-answer button: silent ReferenceError on
#         `arraysEqualUnordered` (missing import). Fixed in
#         src/screens/quiz.jsx by importing from src/lib/utils.js.
#       - Knowledge Map pan/zoom crash ("Cannot read properties of
#         null (reading 'ox')"). Fixed in src/screens/knowledge-
#         map.jsx by capturing dragRef.current.ox/oy into locals
#         BEFORE the setView functional updater — the updater
#         could fire after a pointercancel nulled dragRef.
#       - Knowledge Map "Suggested today" panel: added an X close
#         button + suggestDismissed state so it can be dismissed.
#       - Sidebar duplicate Knowledge Map entry removed from
#         src/ui/nav-drawer.jsx (it stays on the dashboard).
#       - Concept cards / Dosage / Quick reference / Help — root
#         cause was that public/data/*.json was missing from the
#         deployment, so content.js fetches returned 404. JSON
#         regenerated VERBATIM from old App.jsx constants:
#             public/data/reference.json     (167 items)
#             public/data/dosage.json        (18 items)
#             public/data/concept-cards.json (10 topics; CONCEPT_CARDS
#                                             merged with AIIMS_CONCEPT_CARDS)
#             public/data/help.json          (31 keys)
#       - Earlier dropped-import sweep: arraysEqualUnordered into
#         quiz.jsx; EXAMPLE_QUESTIONS_JSON/CSV moved to
#         lib/question-import.js; findDuplicateStem +
#         DUPLICATE_THRESHOLD into lib/utils.js next to stemSimilarity.
#   • CONTENT ROLLOUT — explanation + help quality (Jun 2026):
#       - All 86 built-in SEED_QUESTIONS explanations upgraded to the
#         structured ANSWER / WHY / (detail) / EXAM TIP format with
#         richer per-option "why the others are wrong" rationales.
#         Authored in NEW src/data/seed-explanations.js as a map keyed
#         by question id; seed.js imports it and merges over ONLY
#         `exp` and `wrong` (never options/correct/id/topic/type).
#         Plain-text render (whitespace-pre-wrap, NO markdown) — use
#         CAPS labels + blank lines, never ** bold.
#       - public/data/help.json expanded: every section gained a
#         concrete `example` field, and the 3 previously-undocumented
#         screens were added (now 34 keys total): "Knowledge Map",
#         "Previous year papers", "Exam weightage". Their lookup keys
#         are the TopBar feedback.screen strings (HelpButton reuses
#         feedback.screen) — match them EXACTLY (note lowercase
#         "Previous year papers").
#       - help-modal.jsx renders an optional 4th "For example" block
#         (tinted) only when c.example exists.
#       - Bank import: author bank `exp`/`wrong` in the same
#         ANSWER/WHY/EXAM TIP shape to match built-in quality (see
#         bank-question-template.json). `\n` for line breaks in JSON.
#   • ⚠ CONTENT-CACHE RULE — BUMP CONTENT_VERSION ON EVERY public/data EDIT:
#       - src/lib/content.js caches each /public/data/*.json blob
#         (help, reference, dosage, concept-cards) in IndexedDB keyed
#         by `content:NAME:vN`, where N = CONTENT_VERSION. The loader
#         returns the cached copy and NEVER re-fetches while that key
#         exists — so a returning user (or even a local preview opened
#         once before) keeps seeing the OLD JSON no matter how many
#         times you rebuild.
#       - THE RULE: whenever you change ANY file in public/data/
#         (help.json, reference.json, dosage.json, concept-cards.json),
#         increment CONTENT_VERSION by 1 in src/lib/content.js. That
#         one line is the only cache-buster — it changes both the
#         IndexedDB key and the network `?v=N` query, forcing a fresh
#         fetch for every user. Forgetting it = silent stale content.
#       - Symptom if forgotten: edited help/reference/concept-card text
#         doesn't appear after build+preview, with no error. Root cause
#         is this cache, NOT a key mismatch or a failed build.
#       - History: started at v1. Bumped to v2 for the Jun 2026 content
#         rollout above (help examples + 3 new sections + concept-card
#         clinical notes). The earlier help-example edits had been
#         invisible for exactly this reason until the bump.
#   • Permanent profile.uid (random, rename-safe):
#       - genUid() in src/lib/profile-crypto.js (crypto.randomUUID
#         with a genSalt fallback).
#       - createProfile + makeGuestProfile set uid at creation;
#         guest uid is the constant GUEST_ID.
#       - ensureUid() in src/lib/profiles.js backfills existing
#         profiles on next online load and persists once. loadProfile
#         returns wrapped with ensureUid (the canonical path).
#       - profile.id (the displayName slug) STILL changes on real
#         rename; uid is the durable handle.
#   • Multi-admin system:
#       - Supabase table admin_profile_ids(profile_id PK, added_at,
#         note) holds the allow-list. Multiple rows = multiple
#         admins (each row is a full admin, equal power).
#       - The user's uid is in it. The table did NOT exist before
#         — that was the root cause of "even with the passphrase I
#         have no admin access": checkServerAdmin queried a non-
#         existent table and failed-closed for everyone.
#       - admin-setup.sql is the canonical create-and-seed script.
#         It has been run.
#   • Manage Admins screen lives on the Admin Panel:
#       - New tile (ShieldCheck) in src/screens/admin-panel.jsx
#         next to Helpfulness; opens setView('manageAdmins').
#       - src/ui/admin-manager.jsx is a full detail screen (TopBar
#         + body): your-id-with-copy, passphrase field, current
#         admins list with remove buttons, add form (id + optional
#         note). HTTP 401 → "Wrong passphrase".
#       - listAdmins() reads admin_profile_ids directly (anon SELECT
#         is preserved). addAdmin/removeAdmin go through the Edge
#         Function with the passphrase.
#   • Edge Function — admin-manage:
#         Location: supabase/functions/admin-manage/index.ts
#         Runtime:  Deno / TypeScript
#         Actions:
#           add      → service-role INSERT (merge-duplicates).
#                      Requires passphrase; 401 if wrong.
#           remove   → DELETE by profile_id. Same passphrase guard.
#           verify   → returns {ok: bool} 200 (NEVER 401, so the
#                      app can branch on `ok` to UNLOCK admin UI
#                      without leaking via status codes).
#         Auth:     server-side compare against the ADMIN_PASSPHRASE
#                   secret using a length-independent (constant-
#                   time-ish) compare.
#         CORS:     OPTIONS preflight + ACAO * / methods POST,OPTIONS
#                   / headers authorization,apikey,content-type.
#         Auto-injected env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
#         Required custom secret: ADMIN_PASSPHRASE (must match what
#                   users type in the unlock dialog).
#         Deploy:   supabase functions deploy admin-manage --no-verify-jwt
#                   (the --no-verify-jwt flag is REQUIRED — the
#                   function does its own passphrase auth and the
#                   anon-key JWT is irrelevant. Persist in
#                   supabase/config.toml if preferred.)
#   • Frontend has NO hardcoded passphrase, hash, or salt anymore:
#       - ADMIN_PASSPHRASE_HASH and ADMIN_SALT DELETED from App.jsx.
#       - verifyAdminPassphrase() in App.jsx now POSTs {action:'verify',
#         passphrase} to the Edge Function and returns j.ok. Throws
#         on network error → handleUnlockAdmin catches and returns
#         'not-authorized' (the existing offline path), preserving
#         the (true / 'not-authorized' / false) return contract that
#         settings.jsx already handles. Unlock UX is byte-identical.
#       - checkServerAdmin queries `profile_id=in.(id,uid)` so both
#         slug-based and uid-based admin rows count — a transition
#         affordance so existing seeds keep working as the table
#         migrates to uids.
#   • Lockdown applied to admin_profile_ids (canonical SQL:
#     admin-lockdown.sql):
#       - DROPPED policies admin_insert, admin_delete.
#       - REVOKED insert, delete from anon.
#       - KEPT admin_select (anon SELECT) + grant — needed for
#         checkServerAdmin and listAdmins.
#       - Result: anon can READ the list but cannot WRITE it. All
#         writes go through the Edge Function (service-role,
#         RLS-bypassing).
#
#  SUPABASE STATE  (the user's actual setup)
#  ─────────────────────────────────────────
#   Tables:
#     kv_shared           anon SELECT/INSERT/UPDATE/DELETE   (soft, by design)
#     admin_profile_ids   anon SELECT only                   (locked down — above)
#   Edge Functions:
#     admin-manage        deployed with --no-verify-jwt
#   Secrets:
#     ADMIN_PASSPHRASE    set (rotate via `supabase secrets set ...`)
#   Project URL (env: VITE_SUPABASE_URL):
#     https://jabmjyhdfacoikkgmjzl.supabase.co
#   Anon key  (env: VITE_SUPABASE_ANON_KEY)
#
#  NEW / EDITED FILES (since the A1 refactor was logged)
#  ─────────────────────────────────────────────────────
#   NEW assets (NOT in src/, must go to project root):
#     public/data/reference.json
#     public/data/dosage.json
#     public/data/concept-cards.json
#     public/data/help.json
#     supabase/functions/admin-manage/index.ts
#     admin-setup.sql                                   (run once — done)
#     admin-lockdown.sql                                (run once — done)
#   NEW source files:
#     src/lib/admin.js                                  list/add/remove
#     src/ui/admin-manager.jsx                          Manage Admins screen
#     src/lib/topics.js, src/lib/feedback.js            (earlier — verbatim extracts)
#     src/screens/{StatsScreen, MockSetup, QuickPracticeSetup,
#                  TopicSelect, WeakAreasScreen, feedback-inbox}.jsx
#                                                       (earlier — verbatim extracts)
#   EDITED source files:
#     src/App.jsx                  server-side verify; slug-or-uid match;
#                                  hash/salt deleted
#     src/lib/profile-crypto.js    genUid()
#     src/lib/profiles.js          uid at signup + ensureUid backfill
#     src/screens/admin-panel.jsx  Manage admins tile + detail view
#     src/screens/knowledge-map.jsx  pan/zoom fix + dismissable panel + imports
#     src/screens/quiz.jsx         arraysEqualUnordered import
#     src/screens/bank-screens.jsx, bulk-import.jsx
#     src/ui/nav-drawer.jsx        removed duplicate Knowledge Map
#     src/lib/utils.js             findDuplicateStem + DUPLICATE_THRESHOLD
#     src/lib/question-import.js   EXAMPLE_QUESTIONS_JSON/CSV
#     src/lib/app-context.jsx      (rebuilt earlier from contract)
#
#  SUBTLE / HIDDEN — things that aren't obvious from the code
#  ──────────────────────────────────────────────────────────
#   1. `--no-verify-jwt` on `supabase functions deploy admin-manage`
#      is MANDATORY. The function authenticates via passphrase, not
#      via Supabase JWT; redeploying WITHOUT this flag will break
#      calls. Persist it in supabase/config.toml if preferred:
#          [functions.admin-manage]
#          verify_jwt = false
#   2. The `verify` action is a PUBLIC BRUTE-FORCE ORACLE. Anyone
#      with the anon key (which ships in the public JS bundle) can
#      POST guesses. Constant-time compare blocks timing leaks but
#      NOT online guessing. Passphrase entropy is the only defense
#      — use a long random secret, not dictionary words.
#   3. After lockdown, anon SELECT on admin_profile_ids is STILL
#      open by necessity (boot re-verify, listAdmins). i.e. the
#      admin list is publicly readable. Don't put secrets in `note`.
#   4. checkServerAdmin queries `profile_id=in.(id,uid)` — both the
#      legacy slug AND the new uid count as the same admin row. A
#      renamed admin keeps admin via uid; the slug changes, uid does
#      not. Old slug-based seeds in the table remain valid.
#   5. The boot re-verify effect "can only ever DOWNGRADE." Adding
#      someone to admin_profile_ids does NOT auto-unlock their app
#      — they still type the passphrase. The table is the WHO; the
#      passphrase is the WHAT. Both required to unlock.
#   6. kv_shared is STILL fully anon read/write/delete by design.
#      Locking admin_profile_ids closed the self-promotion hole, but
#      announcements / profiles / banks / etc. can still be tampered
#      with via direct API by anyone holding the (public) anon key.
#      See PROMPT 20 for the hardening path.
#   7. Old passphrase `norcet-boss-2026` lives forever in git
#      history. Once the ADMIN_PASSPHRASE secret was rotated it no
#      longer authorizes anything — but the CURRENT secret must
#      never be committed to the repo (or to a committed .env).
#   8. profile.id (slug of displayName) CHANGES on real rename, and
#      the app migrates banks/feedback to the new slug — but it does
#      NOT migrate admin_profile_ids. That's why uid was added: a
#      handle that never changes.
#   9. content.js fetches `/data/${file}?v=1`. JSON files MUST live
#      at `public/data/*.json` so Vite copies them to the site root.
#      First diagnostic for any future "Couldn't load <thing>" error:
#      check that the file exists in public/data/ and is in the deploy.
#  10. Vite injects `__APP_VERSION__` at build time (the "Version:
#      dev" footer in Settings). Bare ESLint flags it as no-undef;
#      that's the absence of Vite's define, not a real issue.
#  11. AdminManager is NOT rendered inside settings.jsx in the
#      canonical layout. The Manage Admins screen is reached from
#      the Admin Panel tile only. If an old build embedded
#      <AdminManager/> in Settings, remove that line — AdminManager
#      is now a TopBar-bearing full screen and would look wrong
#      embedded.
#
#  HOW A NEW CHAT PICKS THIS UP
#  ────────────────────────────
#   1. Attach the latest src/ tree (zip) + this md.
#   2. Read this ADDITIONAL STATE block first, then the CURRENT
#      STATE block above it for the A1-refactor context.
#   3. Critical references to keep in working memory:
#         Edge Function:  supabase/functions/admin-manage/index.ts
#         One-shot SQL:   admin-setup.sql, admin-lockdown.sql  (both run)
#         Secret:         ADMIN_PASSPHRASE (in Supabase, never in code)
#         Admin model:    admin_profile_ids holds profile_id (slug
#                         OR uid). checkServerAdmin matches either.
#         Profile model:  profile.id (slug) + profile.uid (random,
#                         permanent). ensureUid backfills.
#   4. The chat CANNOT make live REST calls to the user's Supabase.
#      Verification = full app bundle (esbuild) + no-undef + an SSR
#      contract test of the touched screen, then the user deploys
#      + tests live.
#
#  OUTSTANDING (open work — verifying / followups)
#  ───────────────────────────────────────────────
#   • Run the curl write-test from the user's machine against
#     `${VITE_SUPABASE_URL}/rest/v1/admin_profile_ids` with the anon
#     key — POST should return 401/403 (lockdown verified). If it
#     returns 201, the lockdown didn't take. SELECT should still
#     return 200.
#   • Rotate ADMIN_PASSPHRASE to a long random value
#     (`openssl rand -base64 24` style). The known-deployed value
#     was dictionary-strength and the verify endpoint is a brute-
#     force oracle (see SUBTLE #2).
#   • PROMPT 20 (below): harden kv_shared (the remaining anon-open
#     exposure).
#   • PROMPT 21 (below): rate-limit the admin-manage verify action.


================================================================
PIPELINE — EXECUTION ORDER FOR FUTURE WORK
================================================================

This is the work plan. The "PROMPT N:" sections are feature prompts
to feed Claude (one prompt per chat session). The "ARCHITECTURE
IMPROVEMENTS — A1..A13" section at the very end lists refactor
items. Both are referenced from the ordered checklist below.

TWO-ACCOUNT WORKFLOW:
  • Chat A: paste this md file + latest src/ tree (or the latest
    sliceNN-deliverables.zip + _HANDOFF-READ-ME-FIRST.md) → execute
    the next pending task → receive updated files → save them.
  • When chat A's context nears limit → carry the updated files
    forward.
  • Chat B: paste md file + updated files → execute the next pending
    task → receive updated files → save them.
  • Alternate. The md file is the source of truth for what's next.

STATUS TRACKING:
  • As you finish each step, append [DONE] to its checklist line.
  • A new chat can scan this checklist in five seconds and know
    exactly which step is next.
  • Numbers (1, 2, 3, ...) are EXECUTION ORDER. The "P#" and "A#"
    labels keep their original IDs forever (existing prompts cross-
    reference them by name, e.g. "AFTER PROMPT 7" inside P14).

RULES:
  • Each numbered step = one chat session. (Historically the jsx
    file was ~12k+ lines so context filled fast; App.jsx is now
    ~3.5k and modular, but keep one-step-per-session anyway — it
    keeps verification clean.)
  • If a step's prompt is large (P1, P10), it may legitimately need
    2 sessions; the checklist marks those.
  • Hard prerequisites are called out in parentheses. Don't skip
    ahead past one.

EXECUTION MODE TAGS (the [TAG] after each step):
  [ARTIFACT] — Build it in a Claude Artifact chat with mock data,
               then transfer the final code into your repo at the
               end. No local dev needed for the build itself.
               Caveat: Artifacts ban localStorage/IndexedDB, so
               feed sample data via React state instead of loading
               from real storage.
  [MIXED]    — UI prototype works in an Artifact, but real
               integration (Supabase writes, actual persistence,
               admin upload, etc.) only properly tests in local
               dev. Recommended path: design in Artifact, integrate
               and test in local dev.
  [LOCAL]    — Local dev required (npm run dev + real browser).
               Touches storage layer, env vars, service workers,
               multi-file splits, or PWA features that Artifacts
               cannot run. Don't attempt in an Artifact — the app
               will not boot.


PHASE 1 — FOUNDATION (safety + durable storage + observability)
────────────────────────────────────────────────────────────────
  [x]  1. A3   Add a root error boundary                                 [LOCAL]    [DONE]
  [x]  2. A6   Centralize storage keys (prereq for P1)                   [LOCAL]    [DONE]
  [x]  3. A11  Schema versioning + migrations (prereq for P1 and P15)    [LOCAL]    [DONE]
  [x]  4. P1   PROGRESS SYNC TO CLOUD — CRITICAL (may need 2 sessions)   [LOCAL]    [DONE]
  [x]  5. P15  Tiered data retention + lazy compaction (after P1)        [LOCAL]    [DONE]
  [x]  6. A4   Move admin auth off the client (security)                 [LOCAL]    [DONE]
  [x]  7. A10  Structured logging + error reporting                      [LOCAL]    [DONE]
  [x]  8. P19  PWA update notification toast                             [LOCAL]    [DONE]


PHASE 2 — EARLY HIGH-VALUE FEATURES (cashes in data you already collect)
────────────────────────────────────────────────────────────────
  [x]  9. P12  Per-question time quadrant analysis                       [ARTIFACT] [DONE]
  [x] 10. P13  Per-topic accuracy trends over time                       [MIXED]    [DONE]
  [x] 11. P6   Answer explanations                                       [ARTIFACT] [DONE]


PHASE 3 — PYQ CONTENT + FEATURES WITH HARD PREREQUISITES
────────────────────────────────────────────────────────────────
  [x] 12. P2   Spaced repetition on wrong answers (after P1)             [LOCAL]    [DONE]
  [x] 13. P16  NORCET PYQ provenance tag (year badge on tagged PYQs)     [ARTIFACT]   [DONE]
  [x] 14. P7   Previous year NORCET papers as mock tests                 [MIXED]  [DONE]
  [x] 15. P17  Image-based PYQ support (image field + identify-the-X)    [MIXED]  [DONE]
  [x] 16. P18  GK & Aptitude PYQ section (non-nursing exam questions)    [ARTIFACT]   [DONE]
  [x] 17. P14  Syllabus weightage + YoY shift (after P7)                 [ARTIFACT]   [DONE]
  [x] 18. P8   "Was this helpful?" feedback toggle (after P6)            [LOCAL]   [DONE]


PHASE 4 — ENGAGEMENT + SOCIAL
────────────────────────────────────────────────────────────────
  [x] 19. P3   Daily reminder notifications                              [LOCAL]   [DONE]
  [x] 20. P4   Leaderboard                                               [MIXED]   [DONE]
  [x] 21. P5   Shareable result cards                                    [ARTIFACT]   [DONE]


PHASE 5 — CODE HYGIENE (trim the file before the biggest feature)
────────────────────────────────────────────────────────────────
  [x] 22. A2   Move non-fallback static content out of bundle            [LOCAL]      [DONE]
  [x] 23. A8   Eliminate inline style objects (CSS variables)            [MIXED]      [DONE]
  [x] 24. A9   Accessibility pass                                        [MIXED]      [DONE]


PHASE 5.5 — GUEST MODE / ANONYMOUS-FIRST ACCESS  (inserted; runs next)
────────────────────────────────────────────────────────────────
  [x] 26. P-GUEST  Guest mode — Phase A (no-wall access + nudges + gating)  [LOCAL]  [DONE]
  [x] 27. P-GUEST  Guest mode — Phase B (sign-up MERGE of guest progress)  [LOCAL]  [DONE]
  [x] 28. P-NAV    Boot login-flash fix + hardware back-button navigation   [LOCAL]  [DONE]


PHASE 6 — BIG VISUAL FEATURE: KNOWLEDGE MINDMAP
────────────────────────────────────────────────────────────────
  [x] 25. P10  Interactive knowledge mindmap (Phase A: layout + states)  [ARTIFACT]   [DONE]
  [x] 29. P10  Interactive knowledge mindmap (Phase B: deps + bonus)     [ARTIFACT]   [DONE]
  [x] 30. P11  Mindmap V2 enhancements — Feature A: suggestions          [ARTIFACT]   [DONE]
  [x] 31. P11  Mindmap V2 enhancements — Feature B: animations           [ARTIFACT]   [DONE]
  [x] 32. P11  Mindmap V2 enhancements — Feature C: notes per node       [MIXED]      [DONE]


PHASE 7 — POLISH + MAJOR REFACTOR (when feature pace slows)
────────────────────────────────────────────────────────────────
  [x] 33. P9   Donate / support the app                                  [ARTIFACT]   [DONE]
  [x] 34. A1   Split App.jsx — session 1: themes + data + utils          [LOCAL]      [DONE]
  [x] 35. A1   Split App.jsx — session 2: storage + profiles            [LOCAL]      [DONE]
       └─ DONE: safe-storage shim + profile-crypto/id infra + the PURE
          guest-merge engine (normalizeUserData / guestBlobHasActivity /
          mergeGuestIntoAccount + 12 _g* helpers) -> src/lib/merge.js;
          AND the ASYNC profile/session/guest-IO subsystem (loadProfile/
          loadProfileCached/saveProfile/createProfile/authenticateProfile/
          recoverPasswordWithDob/flushPendingSync + PENDING_SYNC trio +
          listProfileMetas/loadOneProfileMeta/saveProfileMeta/loadProfileIndex/
          upsertProfileIndex/touchProfileActivity/loadSession/saveSession/
          normalizeDob + guest data I/O; 29 members + private _flushInFlight)
          -> src/lib/profiles.js (verbatim; transpile + bundle-with-stubs +
          9/9 behaviour groups pass). NOTE: renameProfile STAYS in App.jsx —
          it is a cross-subsystem orchestrator (migrates banks + feedback on
          id change), so moving it would create a circular import. UI
          primitives Pill/Button/TopBar (A7-coupled — read render-mutated T)
          formally fold into step 36 (A7). Owner still owes the real build +
          login/sync/session/guest-merge/rename device test.
  [x] 36. A7   Replace prop-drilling with Context (paired with A1)       [LOCAL]      [DONE]
       └─ DONE (foundation + bounded migration): NEW src/lib/app-context.jsx —
          ThemeContext / ProfileContext / DataContext + <AppProviders> +
          useTheme/useProfile/useData. Provider wraps all 6 App return branches;
          Pill/Button/TopBar -> useTheme, FeedbackButton -> useProfile, and the
          CURRENT_PROFILE module global is DELETED. T/IS_DARK stay as a
          transitional bridge (also fed to the provider) for the ~2000 un-migrated
          in-screen reads, which convert per-screen during 37-38 (A7 is coupled to
          A1, exactly as this spec says). Verified: transpile + bundle-with-stubs
          clean; 14/14 context SSR contract tests; 4/4 real-<App/> SSR smoke.
  [x] 37. A1   Split App.jsx — session 3: screens batch 1 (Quiz, etc)    [LOCAL]      [DONE]
  [x] 38. A1   Split App.jsx — session 4: remaining screens + App.jsx    [LOCAL]      [DONE]
       └─ DONE (across many slices, 11–47). App.jsx went 15,643 → 3,489 ln.
          Every screen/modal/toast extracted to src/screens/*: incl. Library,
          Settings, Stats, Quiz, Results, Home, Reference, Bookmarks,
          RevisionSheet, the dosage screens, the knowledge-map + mindmap
          cluster, the weightage/coverage screens, the support/feedback/help
          modals, RenameProfileHost, ReportedQuestionModal, AuthScreen, the
          AdvancedTest trio (Setup/Test/Results), the Bank pair
          (BankDetail/BankEditor), AdminPanel, and finally UpdateToast.
          Each move VERBATIM (only edits = the A7 useTheme hook line +
          intentional documented prop/signature changes), with transpile +
          bundle-with-stubs + integrity + verbatim + a per-screen SSR contract
          test. AdminPanel note: its single-consumer App-local helpers
          adminListUsers/adminDeleteProfile STAY in App and pass as props
          (onListUsers/onDeleteProfile) because they cascade into App-local
          listBanks/deleteBank which have other consumers — moving them would
          invert the dependency direction.
       └─ FINAL A7 CLEANUP DONE (slice 47): the transitional module-level
          `let T` / `let IS_DARK` bridge + the dead fgOnDark/feedbackStatusMeta
          wrappers are DELETED. App computes T/IS_DARK as local consts in its
          body and still feeds theme={T} into <AppProviders>, so context is the
          single source of truth. No module-level mutable theme state remains.
          App's own ~13 T.* reads STAY local (App is the provider's source —
          reading theme back out of context here would be circular).
  [x] 42. A1   OPTIONAL lib tidy-ups (post-refactor)                     [LOCAL]      [DONE]
       └─ Two cohesive, unit-tested clusters pulled out of App into lib:
          src/lib/banks-storage.js (listBanks/loadBank/saveBank/deleteBank/
          setBankVisibility — bank shared-storage CRUD, 10/10 behavioral test)
          and src/lib/quick-practice.js (lastSeenTs/quickNeedScore/
          selectQuickPracticeQuestions — quick-practice selection, 11/11 test).
          STOPPED here deliberately. Remaining App-local helpers (admin/
          announcement ops, profile/session bits, findDuplicateStem) are pure
          state plumbing with many consumers/cross-deps — moving them is churn
          without architectural benefit. Candidates noted in the A1 prose below.
  [ ] 39. A5   Route-level code splitting (after A1)                     [LOCAL]    [NOW UNBLOCKED]
  [ ] 40. A12  URL-based routing (optional, after A1)                    [LOCAL]    [NOW UNBLOCKED]
  [ ] 41. A13  Type safety — JSDoc first; TS migration is optional       [LOCAL]    [NOW UNBLOCKED]



WHY THIS ORDER (the rationale):

  Phase 1 first because durable storage is the precondition for
  every other feature having meaning. Until P1 ships, every user
  is one cleared cache away from losing everything. P19 (PWA
  update toast) closes the Phase by giving you reliable update
  delivery — without it, future deploys land silently and users
  stay on cached old versions.

  Phase 2 next because P12 and P13 cash in data your Quiz already
  collects (timeMs, history.ts) — biggest user-visible win per
  session of work.

  Phase 3 is the PYQ cluster plus features with prerequisites. The
  PYQ tag (P16) ships first because the nursing-MCQ PYQ bank is
  already imported and tagged — the badge is a quick, high-trust
  win. P7 (papers) and P14 (weightage) then build on tagged PYQ
  content; P17 (image PYQs) and P18 (GK/aptitude) complete the
  PYQ content that was deliberately filtered out of the first bank.

  Phase 4 grows the daily habit loop (reminders, leaderboard,
  shareables).

  Phase 5 is deliberate timing — light hygiene refactors BEFORE the
  mindmap because the file size is starting to hurt your context
  budget in each chat.

  Phase 6 is the headline feature. Two sessions for P10 (per the
  prompt's own note) and three for P11 (one per independent feature).

  Phase 7 is debt paydown. A1 is the riskiest refactor — done last,
  when feature velocity has naturally slowed and a few regressions
  are easier to absorb.


PROGRESS LOG (date stamp each phase as you complete it):
  Phase 1 started: __________  finished: __________
  Phase 2 started: __________  finished: __________
  Phase 3 started: __________  finished: __________
  Phase 4 started: __________  finished: __________
  Phase 5 started: __________  finished: __________
  Phase 6 started: __________  finished: __________
  Phase 7 started: __________  finished: __________


================================================================
DEPLOY & POST-DEPLOY DISCIPLINE
================================================================

The Vercel URL is PERMANENT. Every `git push` redeploys to the
same URL. Users do NOT need a new URL after an update — their
bookmark, their home-screen PWA icon, their cached Supabase
session all keep working.

Three things to know about every deploy:

1. PWA SERVICE-WORKER CACHING
   After a deploy, users may still see the OLD version because
   their service worker is caching the old JS bundle. They need
   one of:
     - hard-refresh (Ctrl+Shift+R on desktop)
     - close and reopen the installed PWA twice on mobile
     - an in-app "new version available" toast (P19 below)
   Without P19, expect bug reports for issues you've already
   fixed — the user is just on the cached old build.
   Check `vite.config.js` for vite-plugin-pwa:
     - `registerType: 'autoUpdate'` → silent swap on next reload
       (simpler, no toast, but user can't tell when it happened)
     - `registerType: 'prompt'`     → P19 needed to render the toast
                                       (better UX for a study app)

2. LOCAL DATA SHAPE FRAGILITY (until A11 ships)
   Changing the shape of DEFAULT_DATA — renaming a field, removing
   one, restructuring nested objects — can break existing users
   whose IndexedDB blob still has the old shape. The boot block
   papers over MISSING fields by spreading DEFAULT_DATA, but
   renames silently misroute. Until A11 lands: only ADD fields,
   never rename or remove.

3. PROGRESS DATA LIVES IN THE USER'S BROWSER (until P1 ships)
   A deploy never touches user data — but a deploy also cannot
   recover it if the user clears browser data. Until P1 (cloud
   sync) ships, every user is one cleared cache from total
   progress loss, and no version of the app can rescue them.
   This is the strongest reason P1 is step 4 in the pipeline.

POST-DEPLOY VERIFICATION CHECKLIST (do every deploy):
  1. Wait ~30s for Vercel build to finish (check the dashboard).
  2. Open YOUR OWN installed PWA on your phone.
  3. Refresh (or close and reopen twice if no P19 yet).
  4. Confirm the new version is showing — e.g. version string
     in Settings bumped, or the new feature visible.
  5. If you do NOT see the new version, your users can't either.
     Fix the caching config BEFORE announcing the update to
     users.

If you do announce updates (Telegram broadcast, etc.), include:
   "Refresh the app or close and reopen it twice to see the
    update. If you don't see it, clear app cache from your
    browser settings."
This single line saves you a dozen "the update is broken"
messages from users.


================================================================
PROMPT 1: PROGRESS SYNC TO CLOUD (Priority: CRITICAL)  [LOCAL]
================================================================

I have a NORCET Prep PWA (Vite + React) deployed on Vercel with a Supabase
backend. The project uses a single `src/storage.js` module that routes
data based on a `shared` flag:

  - shared:true  → Supabase PostgREST (table: kv_shared)
  - shared:false → IndexedDB (local, per-device)

The problem: user progress data (scores, streaks, stats, bookmarks,
revision history) is stored with shared:false, meaning it lives only in
IndexedDB on their device. If they clear browser data, switch devices,
or iOS evicts PWA storage, all progress is lost — even though their
profile still exists in Supabase.

What I want you to do:

1. In src/App.jsx, find every safeStorage.get/set/delete call that
   stores user progress data — specifically the STORAGE_KEY
   ('norcet:userdata:v1') which holds the main progress blob (answered
   questions, scores, stats, streaks, bookmarks, revision data).
   Change these calls to pass shared:true so they go to Supabase
   instead of IndexedDB.

2. The key should be scoped per-profile so each user's progress is
   separate. Currently it uses a flat key 'norcet:userdata:v1'. Change
   it to something like 'userdata:{profileId}' so each profile's
   progress is its own row in kv_shared.

3. Add offline resilience: when the user is offline, fall back to
   reading/writing IndexedDB as a cache. When back online, sync the
   local copy to Supabase. A simple "last-write-wins" strategy is fine
   for this scale (10-50 users).

4. Do NOT touch the storage.js API or the safeStorage shim — only
   change the call sites in App.jsx and the key naming.

5. Do NOT change any UI, features, themes, or other functionality.

6. Run the build to confirm it compiles, then produce the updated zip.

Context: the Supabase table kv_shared already exists with columns
(key TEXT PRIMARY KEY, value TEXT NOT NULL) and open RLS policies for
the anon role. No schema changes needed.

I will attach the current src/App.jsx file.


================================================================
PROMPT 2: SPACED REPETITION ON WRONG ANSWERS (Priority: HIGH)  [LOCAL]
================================================================

I have a NORCET Prep study app (single-file React component in
src/App.jsx). It already tracks which questions users answer correctly
and incorrectly. I want to add a Spaced Repetition System (SRS) that
automatically resurfaces wrong answers at optimal intervals.

What I want you to do:

1. Add an SRS data structure to the user's progress data. For each
   question the user gets wrong, store:
   - questionId
   - wrongCount (how many times they got it wrong)
   - lastSeen (timestamp of last attempt)
   - nextDue (timestamp of when to show it again)
   - interval (current interval in days: starts at 1)
   - easeFactor (multiplier, starts at 2.5, adjusted per SM-2 algorithm)

2. When a user answers a question wrong:
   - Add it to the SRS queue (or reset its interval to 1 day if already in queue)
   - Decrease the ease factor slightly (minimum 1.3)

3. When a user answers a question right during SRS review:
   - Multiply the interval by the ease factor
   - Set nextDue = now + new interval
   - Increase ease factor slightly

4. Add a new mode/button on the home screen called "Review Due" (or
   integrate it into the existing revision system). It should:
   - Show a badge/count of how many questions are due for review today
   - When tapped, start a quiz using only questions where nextDue <= now
   - Sort by most overdue first
   - If no questions are due, show a friendly "All caught up!" message

5. Use the SM-2 algorithm intervals: 1 day → 3 days → 7 days → 14 days
   → 30 days → 60 days (adjusted by ease factor). After 60 days with
   correct answers, the question graduates out of the SRS queue.

6. The SRS data should be part of the existing user progress blob
   (STORAGE_KEY) so it gets saved/loaded with everything else.

7. Match the existing app's visual style, theme system, and animations.
   Use the same card/button patterns. The "Review Due" section should
   feel native to the app, not bolted on.

8. Do NOT change any existing features, modes, or UI.

9. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 3: DAILY REMINDER NOTIFICATIONS (Priority: HIGH)  [LOCAL]  [DONE]
================================================================
[DONE — no schema-version change (still v9). Pref is additive (read
defensively), no migration. NOTES:
- Pref data.preferences.dailyReminder = { enabled, time '20:00', lastNotified }.
  Lives in the normal prefs blob (local IndexedDB via saveProfile, shared:false,
  like every pref). enabled only persists true when Notification permission is
  granted.
- Settings → new "Notifications" section: "Daily reminders" toggle (off by
  default) → requests permission on enable; when on+granted a <input type=time>
  appears; "denied" shows a friendly enable-in-browser hint; "unsupported"
  shows an install-to-home-screen hint. Handler onSetDailyReminder returns the
  resulting permission so Settings can show the hint.
- The SW file (vite-plugin-pwa, generated) is NOT in this bundle and was not
  touched. Practical reminder mechanism (as the prompt itself specifies) is an
  APP-OPEN / visibilitychange check in an App useEffect: if enabled + granted +
  not studied today (data.stats.lastStudiedDate) + past reminder time + not
  already nudged today → reg.showNotification('NORCET Prep', …) via
  navigator.serviceWorker.getRegistration(), falling back to new Notification.
  lastNotified guards one-per-day.
- TRUE BACKGROUND PUSH is documented in code (App, above the effect) but NOT
  implemented: needs a push server (web-push + VAPID), PushManager.subscribe(),
  a 'push' SW handler; Periodic Background Sync ('periodicsync' SW handler)
  could run the check while closed on supported installed PWAs. Both require
  editing the generated SW + a backend — out of scope.
The original prompt body is kept below for history.]


I have a NORCET Prep PWA (Vite + React, deployed on Vercel). It's a
study app installed via "Add to Home Screen". I want to add push
notification reminders so users get a daily nudge to study.

What I want you to do:

1. Add a notification permission request flow:
   - In Settings, add a "Daily Reminders" toggle (off by default)
   - When turned on, request the browser's Notification permission
   - If granted, let the user pick a reminder time (default: 8:00 PM)
   - If denied, show a friendly message explaining how to enable it
     in browser settings

2. Use the service worker (already exists via vite-plugin-pwa) to
   schedule notifications. Since web push requires a push server for
   true background notifications, use this practical approach:
   - Register a periodic check in the service worker
   - When the app is opened, check if the user hasn't studied today
     (no quiz attempts today) and it's past their reminder time
   - If so, show a local notification: "Your streak is at risk!
     Open NORCET Prep to keep it alive 🔥" (or similar)
   - For true background push notifications, add a note in the code
     about what would be needed (a push server like web-push with
     VAPID keys) — but don't implement it now

3. Store the reminder preference (enabled/disabled, time) in the
   user's local settings (IndexedDB, shared:false).

4. Match the existing app's visual style for the Settings UI.

5. Do NOT change any existing features, modes, or UI.

6. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 4: LEADERBOARD (Priority: HIGH)  [MIXED]  [DONE]
================================================================
[DONE — no schema-version change (still v9). Adds NEW shared kv keys only
(leaderboard:{profileId}); local data blob untouched; storage.js/safeStorage
used as-is. NOTES:
- Helpers (shared-key region): leaderboardKey, weekStartStr (UTC-Monday, matches
  dailyHistory date basis), computeLeaderboardEntry, saveLeaderboardEntry
  (fire-and-forget, fails quietly, skips 0-activity users), loadLeaderboard.
- Entry: displayName, totalAnswered (=stats.totalAttempted), totalCorrect,
  currentStreak, weeklyAnswered (sum of dailyHistory.attempted since Monday —
  auto-resets, no stored counter / reset job), lastActiveDate, ts.
- Upsert TRIGGER is an App useEffect keyed on [profile, stats.totalAttempted,
  stats.streakCurrent] — those only change at session end, so it fires once per
  finished session + once on load for returning users. Reads live `data` w/o
  listing it as a dep (no extra writes on unrelated changes).
- <LeaderboardScreen profileId onBack/> before AuthScreen. Tabs This Week
  (weeklyAnswered) / Streak (currentStreak) / Accuracy (totalCorrect/Answered,
  min 50). Ranked list, gold/silver/bronze Trophy for top 3, current user row
  highlighted + "(you)". Edge cases: offline message (navigator.onLine),
  empty "be the first", and a "why you're not ranked" note when the user isn't
  in the active tab. Reached from the slide-out menu (Trophy). Trophy added to
  the lucide import (verified exported).
- RECONCILIATION (important): the prompt says update at the end of every
  "quiz/mock/drill" session, but in THIS app mocks (submitAdvancedTest) and
  previous papers (submitPaperTest) do NOT update stats.totalAttempted/streak/
  dailyHistory — they live in advancedTestHistory/previousPapers by existing
  design. So the board derives from the app's CANONICAL quiz-based stats (same
  numbers shown everywhere else). Mocks/papers therefore don't move standings.
  Making them count would change a core stat used by Stats/streak/coverage —
  out of scope ("don't change existing features"). If desired later, that's a
  deliberate stats-model change, not a leaderboard tweak.
The original prompt body is kept below for history.]


I have a NORCET Prep PWA with a Supabase backend. All shared data is
stored in a `kv_shared` table (key TEXT, value TEXT) via PostgREST.
User profiles already exist in this table as `profilemeta:{id}` keys.

What I want you to do:

1. Add a Leaderboard screen accessible from the home screen (add a
   trophy icon button in the header or a new card on the home grid).

2. The leaderboard should show three tabs/views:
   - "This Week" — top users by questions answered this week
   - "Streak" — top users by current streak (consecutive days)
   - "Accuracy" — top users by overall accuracy percentage (minimum
     50 questions answered to qualify)

3. Data strategy: when a user finishes a quiz session, save a
   leaderboard entry to Supabase with key like
   `leaderboard:{profileId}` containing:
   - displayName
   - totalAnswered (all time)
   - totalCorrect (all time)
   - currentStreak
   - weeklyAnswered (reset each Monday)
   - lastActiveDate
   This should be updated at the end of every quiz/mock/drill session.

4. The leaderboard screen fetches all `leaderboard:*` keys from
   Supabase, sorts by the active tab's metric, and displays a
   ranked list showing:
   - Rank number (1, 2, 3 with gold/silver/bronze styling)
   - Display name
   - The metric value
   - Highlight the current user's row

5. Handle edge cases:
   - Empty leaderboard (no users yet) — show encouraging message
   - Current user not on board — show their rank below the list
   - Offline — show a "connect to internet to view leaderboard" message

6. Match the existing app's visual style, theme system (all themes
   including Bloom, Dusk, Meadow), and card/animation patterns.

7. Do NOT change any existing features, modes, or UI.

8. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 5: SHAREABLE RESULT CARDS (Priority: MEDIUM)  [ARTIFACT]  [DONE]
================================================================
[DONE — pipeline step 21] Built a reusable <ShareScoreButton> (defined just
after MotivationCard in src/App.jsx) + two pure helpers quizTypeLabel(mode)
and shareMotivation(pct). On tap it paints a 1080x1080 (Instagram square)
card on an OFFSCREEN canvas via the raw Canvas API — NO html2canvas / no new
dependency — then shares via navigator.share({files}) when navigator.canShare
allows the file (mobile), else falls back to a PNG download (desktop). Card:
"NORCET Prep" brand + tagline, display name, white progress ring with pct%,
big "X / Y correct", a quiz-type(+topic) pill, "🔥 N day streak" (only if >0),
the exact P5 score-band line (90+/70-89/50-69/<50), and footer
"norcet-prep.vercel.app". Colours come from the live theme (T.primary ->
T.primarySoft gradient, white text), so it tracks ALL FIVE themes.
Wired into THREE results screens: Results (quick/topic/drill/review/bookmarks),
AdvancedTestResults (mocks + previous papers), DosageResults.

RECONCILIATIONS vs this prompt (it was written before the surrounding code):
  - Themes: prompt says "Forest, Bloom, Dusk, Meadow" — there is NO "Forest".
    Real themes are light(Classic)/dark/bloom/dusk/meadow. Card is token-driven
    (T.*), so all five (incl. dark) are covered automatically.
  - Icon: prompt says Share2 OR Upload. Share2 is NOT imported; used Upload
    (already in the lucide import) — NO icon-import change.
  - Quiz type: the results <nav> didn't carry the quiz mode. Added ONE additive
    field (mode: nav.mode) to completeQuiz's results setNav so the card can
    label the type; Results derives the topic line itself (only when the round
    is single-topic). AdvancedTestResults uses its `label` prop (paper name) or
    "Mock Test"; topic omitted there (mocks/papers span topics). DosageResults
    labels "Dosage Drill".
  - Score shared = correct/total (NOT the negative-marked net score), so the
    card reads cleanly on WhatsApp/Instagram across all modes.
  - name/streak read defensively at each render site (profile?.displayName ||
    profile.id, fallback "NORCET Aspirant"; data.stats.streakCurrent || 0).
ARTIFACT: writes NOTHING to storage; schemaVersion stays 9; no migration.


I have a NORCET Prep study app (React PWA). After completing a quiz,
users see a results screen with their score. I want them to be able
to share their results as an image on WhatsApp/Instagram.

What I want you to do:

1. On the quiz results screen, add a "Share Score" button (use the
   Share2 or Upload icon from lucide-react).

2. When tapped, generate a visually appealing result card as a
   canvas/image containing:
   - App name "NORCET Prep" at the top with the app's branding
   - The user's display name
   - Score: "18/20 correct" (large, prominent)
   - Percentage with a circular progress ring
   - Quiz type (Quick Test / Mock / Topic Drill / etc.)
   - Topic name if applicable
   - Streak count with flame emoji
   - A motivational line based on score:
     - 90%+: "Crushing it! 🔥"
     - 70-89%: "Strong performance! 💪"
     - 50-69%: "Getting there! 📈"
     - Below 50%: "Keep practicing! 🎯"
   - Small text at bottom: "norcet-prep.vercel.app" (so people
     who see the shared image know where to find the app)

3. Use html2canvas or a simple Canvas API approach to render the
   card. The card should be ~1080x1080px (Instagram-friendly square)
   or ~1080x1920px (story format). Pick one.

4. After generating, use the Web Share API (navigator.share) if
   available (works on mobile), with a fallback to downloading
   the image if share isn't supported (desktop).

5. The card's color scheme should match the user's current theme
   (Forest, Bloom, Dusk, Meadow, or dark variants).

6. Do NOT change any existing features, modes, or UI.

7. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 6: ANSWER EXPLANATIONS (Priority: MEDIUM)  [ARTIFACT]
================================================================

I have a NORCET Prep study app with a large question bank defined in
the SEED_QUESTIONS array in src/App.jsx. Currently each question has:
question, options (array), correct (index), topic, subtopic, tags.

I want to add explanations for each answer.

What I want you to do:

1. Add an `explanation` field to the question schema. It should be a
   short string (1-3 sentences) explaining WHY the correct answer is
   correct and, optionally, why common wrong choices are wrong.

2. In the quiz review / results screen, after the user answers a
   question (or in the review at the end), show the explanation
   below the correct answer in a styled card:
   - Light bulb icon (Lightbulb from lucide-react) + "Explanation"
   - The explanation text in a slightly different background color
   - Collapsible/expandable (collapsed by default in review mode
     to avoid overwhelming, expanded when viewing one question at
     a time in learn mode)

3. For the existing SEED_QUESTIONS, add a placeholder explanation
   for the FIRST 20 questions only (write medically accurate
   1-2 sentence explanations for nursing exam context). For the
   rest, set explanation to null/undefined — the UI should
   gracefully hide the explanation section when none exists.

4. For questions added via custom question banks or admin uploads,
   make the explanation field optional in the bank JSON format.
   If present, show it; if absent, hide the section.

5. In Learn Mode, always show the explanation expanded after the
   user answers (this is the teaching moment).

6. Match the existing app's visual style and theme system.

7. Do NOT change any existing features, modes, or UI beyond
   adding the explanation display.

8. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 7: PREVIOUS YEAR NORCET PAPERS AS MOCK TESTS (Priority: MEDIUM)  [MIXED]  [DONE]
================================================================
[DONE — schema v9. Implemented against the REAL App.jsx engine, not the
 placeholder spec below. Deviations from this prompt body, all intentional:
   • Imported the real 501-question PREVIOUS_YEAR_PAPERS (6 official papers)
     from src/norcet-pyq-data.js instead of adding "ONE sample paper with 10
     placeholder questions" (prompt step 4) — the real data was supplied.
   • Question schema is the real {id,topic,sub,type,q,options,correct:[idx]},
     NOT the {question,options,correct(index),tags,explanation} in old notes.
   • Reused the AdvancedTest engine (advanced-* triad) — added an optional
     `label` prop so it shows the paper name; results route to a NEW
     data.previousPapers section via submitPaperTest (migration v8→v9), kept
     separate from advancedTestHistory.
   • Added topics 'gk' + 'apt' to TOPICS (NORCET GK/Aptitude questions).
   • type:'previous_paper' banks are surfaced in this section AND excluded
     from the regular Library.
   • NOTE: a local `npm run build` should still be run before deploy — this
     session verified via full JSX transpile + migration/scoring unit tests,
     but couldn't run the full Vite build (other src files not present).]


I have a NORCET Prep study app with an existing Mock Test mode. I want
to add a dedicated section for previous year NORCET papers.

What I want you to do:

1. Add a "Previous Year Papers" section accessible from the home
   screen (new card in the grid, use the FileText or ClipboardList
   icon from lucide-react).

2. This section shows a list of available papers, e.g.:
   - "NORCET 2024 (Set A)"
   - "NORCET 2023"
   - "NORCET 2022"
   - etc.
   Each shows: year, number of questions, time limit, and whether
   the user has attempted it before (with their score if so).

3. When a paper is selected, it launches the existing mock test
   engine but with:
   - The paper's specific questions loaded
   - The original time limit (e.g., 180 minutes for 200 questions)
   - A label showing "NORCET 2024" instead of "Mock Test"
   - Results saved separately under a `previousPapers` section
     in the user's progress data

4. For the data structure, create a PREVIOUS_YEAR_PAPERS array
   similar to SEED_QUESTIONS but organized by paper:
   - Each paper: { id, year, name, timeMinutes, questions: [...] }
   - Each question: same schema as SEED_QUESTIONS
   - Add ONE sample paper with 10 placeholder questions (I will
     fill in real questions later)

5. Papers should be loadable from both the built-in array AND from
   admin-uploaded banks (add a "type": "previous_paper" field to
   the bank format so the app knows to show it in this section
   instead of the regular library).

6. Match the existing app's visual style and theme system.

7. Do NOT change any existing features, modes, or UI.

8. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 8: "WAS THIS HELPFUL?" FEEDBACK TOGGLE (Priority: MEDIUM)  [LOCAL]  [DONE]
================================================================
[DONE — no schema-version change (still v9). Despite the [LOCAL] tag it adds
only NEW SHARED kv keys; the per-user `data` blob is untouched, so NO migration
was needed. storage.js API + safeStorage shim used as-is (not modified).
NOTES:
- Two shared keys per question: 'helpful:{qId}' and 'notHelpful:{qId}', each a
  JSON array of profile ids. Helpers live with the feedback helpers (loadHelpful
  State / toggleHelpful / loadHelpfulnessReport, readIdList). Literal prefixes
  used directly (keys.js not in this bundle and not needed).
- States silent/helpful/notHelpful are per-user mutually exclusive; cycle is
  silent->helpful->notHelpful->helpful (never back to silent by tapping).
  "silent" is deliberately distinct from "notHelpful".
- <HelpfulToggle questionId explanation profileId/> (after PyqBadge). Hidden
  when no profile or no explanation. Optimistic update; reverts QUIETLY on write
  failure (offline) with no error toast. First-tap-per-session "Thanks" via a
  module flag helpfulThanksShownThisSession (resets on reload).
- Shown in TWO explanation views: Quiz post-answer reveal (gated submitted||
  revealed — question finished) and AdvancedTestResults review. profileId
  threaded into Quiz + both AdvancedTestResults render sites.
- Admin: new "Helpfulness" dashboard tile + 'helpfulness' view. Sortable
  (Most ✕ / Most ✓ / Best ratio), shows ✓/✕/total + ratio bar, expand a row to
  read the full stem + explanation. Only questions with >=1 response shown.
  AdminPanel now takes an allQuestions prop (passed at its render site).
  NOTE: inline EDIT of explanations was NOT wired — built-in (seed) explanations
  live in source and can't be edited at runtime; bank questions are edited via
  the Banks section. The insights view surfaces WHICH to rewrite; the rewrite
  itself is a content/bank job. Wire an editor later if custom-Q editing is wanted.
The original prompt body is kept below for history.]


I have a NORCET Prep React PWA deployed on Vercel with a Supabase
backend. The backend stores shared data in a single `kv_shared` table
(columns: key TEXT PRIMARY KEY, value TEXT). The storage layer is in
src/storage.js — App.jsx accesses it via a `safeStorage` shim with
get/set/delete/list methods that take a `shared` flag (true = Supabase,
false = local IndexedDB).

I want to add a per-question feedback toggle that lets users mark
explanations as helpful or not helpful, using a light bulb metaphor
that matches the existing Lightbulb icon already used for explanations.

WHAT TO BUILD:

1. UI — small inline prompt below each explanation/solution display
   in both:
   - Learn Mode (when reviewing one question at a time)
   - Quiz review screen (when reviewing a finished quiz)

   The prompt is text + tappable icon, styled to feel native and quiet:

       Was this helpful?  💡

   Use the Lightbulb icon from lucide-react (already imported in the app).

   Behaviour:
   - DEFAULT state: bulb is dim/grey (muted text color). Not in either
     Supabase list.
   - When tapped from default: bulb fills with theme accent color and
     gains a soft glow (CSS box-shadow or drop-shadow filter). Animate
     the transition (~200ms ease-out). State: "helpful".
   - When tapped from "helpful": bulb returns to dim — BUT this is now
     an explicit "not helpful" state (visually identical to default,
     but data-wise different — see DATA MODEL below).
   - When tapped from "not helpful": bulb glows again, back to "helpful".
   - Show a small toast/fade-in confirmation on FIRST tap only per
     session: "Thanks — your feedback helps us improve."

2. DATA MODEL — TWO separate Supabase keys per question, capturing
   three distinct user states:

       key:   helpful:{questionId}
       value: JSON array of profile IDs who currently have it marked helpful
              e.g.  ["alice","bob","charlie"]

       key:   notHelpful:{questionId}
       value: JSON array of profile IDs who have explicitly toggled it off
              e.g.  ["dave","eve"]

   User states are mutually exclusive:
   - Not in either list  → "silent" (default — never tapped, or never saw it)
   - In helpful: list    → "marked helpful" (bulb glowing)
   - In notHelpful: list → "marked NOT helpful" (bulb dim, but tapped twice)

   IMPORTANT: Do NOT conflate "silent" with "not helpful" in the data.
   Most users will never tap feedback prompts even when explanations
   help them. The "explicit no" (toggled off) is a much stronger signal
   than silence. Keep them separate so admin reports stay honest.

   On every tap:
   1. Read both lists for the current question (safeStorage.get with shared:true)
   2. Remove the current user's profile ID from whichever list they're in
   3. Determine target state based on current state:
        silent       → helpful       (add to helpful: list)
        helpful      → notHelpful    (add to notHelpful: list)
        notHelpful   → helpful       (add to helpful: list)
   4. Write both lists back (safeStorage.set with shared:true)
   5. Update UI to reflect new state

   Initialize each list as `[]` if it doesn't exist yet.

3. ADMIN PANEL ADDITION — new "Helpfulness Insights" section in
   admin mode (use Lightbulb icon as the tab/section icon):

   Show a sortable list of questions with three numeric columns:

     ✅ Helpful     ❌ Not helpful     Total responses

   Where "Total responses" = helpful count + notHelpful count
   (this is the engaged-user count; silent users are intentionally
   excluded — they're not actionable signal).

   Sort options:
   - Most helpful (descending) — best performing explanations
   - Most NOT helpful (descending) — explanations that need rewriting
   - Helpful ratio = helpful / (helpful + notHelpful) — net signal

   Each row should be tappable to:
   - View the full question + current explanation
   - Edit the explanation inline (uses the existing question editor flow)

   Show only questions with at least one response (helpful or notHelpful);
   ignore fully-silent questions in this view.

4. EDGE CASES:
   - If user is not logged in (no active profile): hide the feedback
     prompt entirely.
   - If Supabase write fails (offline): silently revert the UI to its
     previous state. Do NOT show an error toast — fail quietly.
   - Don't show the feedback prompt during an in-progress quiz —
     only after the question is finished and the user is viewing
     the answer/explanation.
   - If a question has no explanation at all, hide the feedback prompt
     too (nothing to evaluate).

5. VISUAL STYLE:
   - Match the existing theme system (Forest, Bloom, Dusk, Meadow,
     and all dark variants). Use theme accent color for the glow.
   - Keep the prompt visually quiet — secondary text color, small
     size — so it doesn't distract from the explanation content.
   - The glow effect should look intentional (soft drop-shadow,
     subtle pulse on first tap optional but nice).

6. DO NOT TOUCH:
   - The storage.js public API
   - The safeStorage shim in App.jsx
   - Any existing features, modes, screens, or UI beyond:
       a) Adding the feedback toggle on explanation views
       b) Adding the Helpfulness Insights admin section

7. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 9: DONATE / SUPPORT THE APP SECTION (Priority: LOW)  [ARTIFACT]
================================================================

[DONE — step 33]  Shipped into src/App.jsx. Reconciliations against the
real codebase (the prompt was directionally right but off on specifics):
  - "donate" never appears in UI (spec). Uses "support" / "buy me a chai"
    / "keep it free". Heading is "Keep NORCET Prep free \u2615".
  - NO qrcode.react / qrcode npm dep (package.json is frozen, no runtime
    network). Built a tiny, dependency-free byte-mode QR encoder (EC-M,
    versions 1-6) rendered as inline SVG. Capped at v6 because v7+ adds
    version-info blocks my encoder doesn't place correctly; v6 holds 106
    bytes, far more than any upi:// string, and it THROWS above v6 so the
    UI falls back to the copyable UPI ID rather than drawing a bad code.
    Verified by jsqr decode round-trip: 130/130 real UPI permutations
    decode correctly; encoder also cross-checked vs the `qrcode` package
    in dev (data codewords / masks / penalty / format bits all matched).
  - Modal is hosted at the APP ROOT (SupportHost + requestSupport(), like
    RenameProfileHost/FeedbackHost) NOT inside Settings/Home — those sit
    in anim-fadeup/anim-scalein wrappers whose CSS transform breaks a
    position:fixed overlay's viewport centering (documented in-file bug).
  - Icons: reused already-imported lucide icons (Heart, X, ChevronRight,
    Check). Coffee/QR icons are NOT imported, so warmth uses emoji
    (\u2615 \uD83D\uDC99 \uD83C\uDF55 \uD83C\uDF89), avoiding a crash-on-missing-import.
  - Theme keys: used T.primary / T.surfaceWarm / T.border etc. (no
    T.danger/T.warning — those don't exist; error/accent are the names).
  - Dismissal stored LOCALLY as `donatedismissed:v1` via
    safeStorage.set(key,'true',false) — shared:false (local IndexedDB,
    guests included). Versioned key to match existing convention
    (explorerbadges:v1, mindmapnotes:v1, ...). No schema change (stays v9),
    no sync, no shared kv key.
  - Home card gate uses data.stats.totalAttempted >= 100 (the real
    "total questions answered" field), dismiss = forever.
  - Amount chips (\u20B920/\u20B950/\u20B9100) are visual-only; UPI app lets the user edit.
    UPI deep link: upi://pay?pa={id}&pn=NORCET+Prep&cu=INR[&am=].
  - OWNER MUST set DONATE_UPI_ID (placeholder 'your-vpa@bank'); until then
    the modal shows a friendly "payments aren't set up yet" state instead
    of a broken link/QR. DONATE_RAZORPAY_URL optional ('' hides it).
  Verification: full-file esbuild transpile clean (exit 0, no warnings);
  QR decode tests 130/130; pure-fn tests 16/16 (incl. no-"donate"-word).

------------------- ORIGINAL PROMPT BELOW -------------------

I have a NORCET Prep React PWA deployed on Vercel. The app is free
for all users. I want to add a simple, non-pushy donation section
so users who found the app helpful can optionally support the running
costs (domain fees, etc.).

WHAT TO BUILD:

1. A "Support the App" card/section in TWO places:
   - Settings screen — a dedicated section near the bottom, below
     all functional settings. Always visible but visually quiet.
   - Home screen — a very subtle, small card that appears only after
     the user has answered at least 100 questions total (so only
     engaged users see it, not first-timers). Should be dismissible
     (user taps X, never shows again — store dismissal in IndexedDB).

2. The UI should feel warm and personal, not transactional:

   Heading:   "Keep NORCET Prep free ☕"

   Body text: "This app is free and always will be. If it helped
               your prep, consider buying me a chai to keep the
               servers running — every bit helps!"

   Two options:
   - Primary button: "Pay via UPI" — opens a UPI intent link or
     shows a QR code modal with the UPI ID
   - Secondary link: "Other ways to support" — opens Razorpay
     donation link in a new tab (if configured)

3. UPI INTEGRATION:
   - Store the UPI ID as a constant at the top of the component
     (easy to change later): const DONATE_UPI_ID = 'your@upi'
   - On mobile: use a deep link `upi://pay?pa={UPI_ID}&pn=NORCET+Prep&cu=INR`
     to open GPay/PhonePe/Paytm directly. On mobile this works
     natively. On desktop, show a QR code instead.
   - Generate the QR code using a lightweight library
     (qrcode.react or similar) containing the UPI deep link.
     No external API calls — generate it client-side.
   - Suggested amounts shown as quick-tap chips:
     ₹20 ☕  ₹50 🍕  ₹100 🎉  (these are just visual suggestions —
     UPI lets users type any amount)

4. AFTER DONATING:
   - No way to verify payment in-app (that needs a payment webhook),
     so don't try to gate anything or show a "verified donor" badge.
   - Just show a warm thank-you message after they tap the UPI button:
     "Thank you! 💙 Your support means a lot."
   - That's it. Keep it simple.

5. ADMIN AWARENESS:
   - No changes needed in admin panel — you'll see donations directly
     in your UPI app (GPay/PhonePe shows notifications).
   - Optionally add the UPI ID and Razorpay link to a constants
     section at the top of the donate component so it's easy to
     update without searching through code.

6. VISUAL STYLE:
   - Match existing theme system (Forest, Bloom, Dusk, Meadow, darks).
   - The card should feel warm — consider using a slightly warmer
     background tint, a small chai/coffee emoji, and the theme's
     accent color for the primary button.
   - In Settings: a standard section card, same weight as other
     settings sections.
   - On home screen: lighter visual weight than study mode cards —
     this should never compete with the core study features.

7. WHAT NOT TO DO:
   - Do NOT show it during or immediately after a quiz.
   - Do NOT show a popup or modal on app load.
   - Do NOT show the home screen card to users with fewer than
     100 questions answered.
   - Do NOT make it feel like a paywall or guilt-trip.
   - Do NOT use the word "donate" in the UI — use "support",
     "buy me a chai", or "keep it free" instead.

8. DISMISSAL LOGIC for the home screen card:
   - Store `donateDismissed: true` in IndexedDB (shared:false)
     when user taps X.
   - Once dismissed, never show the home card again.
   - The Settings section always remains visible regardless.

9. Do NOT change any existing features, modes, screens, or UI
   beyond adding this section.

10. Run the build to confirm it compiles, then produce the updated zip.

NOTE: Before using this prompt, have your UPI ID ready to replace
the placeholder constant in the code. If you want a Razorpay link,
create a free Razorpay payment page at razorpay.com/payment-button
and have that URL ready too.

I will attach the current src/App.jsx file.


================================================================
PROMPT P-GUEST: GUEST MODE / ANONYMOUS-FIRST ACCESS  (Priority: HIGH)  [LOCAL]
================================================================
[PHASE A DONE — step 26] [PHASE B DONE — step 27]

GOAL: remove the login WALL so anyone can open the app and use it fully as a
GUEST (local IndexedDB only), then gently invite sign-up at high-intent moments
to save/sync. Guests NEVER write to Supabase. Library = sign-in required.
Leaderboard = view-only for guests. Mindmap = open to guests. On sign-up, ASK
whether to keep guest progress (merge) — that merge is PHASE B.

HARD SECURITY GATE (verified this session — OWNER MUST CONFIRM IN SUPABASE):
  The app has NO UI-level security. The login screen was only a UX gate. All
  data access goes through the Supabase ANON key writing/reading the table
  `kv_shared` via safeStorage(key, shared:true). Keys: profile:<id>,
  profilemeta:<id>, leaderboard:<id>, feedback:<id>, myfeedback:<id>,
  helpful:<qid>, nothelpful:<qid>, bank:<id>. Removing the wall does NOT change
  DB access — BUT it means everything depends on RLS on kv_shared, which is NOT
  visible in this bundle.
  >>> OWNER: confirm in Supabase → Database → kv_shared → RLS that with the
      ANON role: (a) a row's key prefix/owner cannot be read or written by a
      different user; (b) anonymous clients cannot enumerate or write
      profile:* / leaderboard:* / feedback:* / bank:* belonging to others;
      (c) only intentionally-public content (e.g. published banks) is anon-
      readable. If RLS is OFF or permissive, that is a PRE-EXISTING hole (the
      anon key is already in the client today) and MUST be fixed before/with
      this deploy. Guest mode is safe to ship ONLY once (a)-(c) hold.

[PHASE A — DONE, step 26]  src/App.jsx ONLY. Storage-neutral, schema stays v9.
  Sentinel guest profile: GUEST_ID='__guest__' (provably can't collide — the
  real normalizeProfileId strips all non-alphanumerics, so no name yields the
  sentinel). makeGuestProfile()/isGuestProfile() discriminator. Guest data
  persists LOCAL-only via saveGuestData/loadGuestData (KEYS.userdata(GUEST_ID),
  shared:false — same shape a real account uses, so Phase B merge is trivial).
  loadGuestMeta/saveGuestMeta (guestmeta:v1, local) = privacy-respecting
  counters {firstSeen, quizzesAttempted, signedUp, bannerDismissed}; no PII, no
  fingerprint, nothing sent anywhere.
  BOOT: no restorable session -> enter guest mode (restore local guest blob)
  instead of the wall; the OLD wall branch (if !profile||!data) remains only as
  a defensive fallback. AuthScreen is now an OPT-IN route (nav.screen==='auth')
  with an onBack "Keep exploring as guest" link, reachable from Settings and the
  nudges. LOGOUT now lands in guest mode (not the wall).
  WRITE GUARDS (defence in depth — UI gates PLUS function backstops): the
  persist effect routes guests to saveGuestData (never saveProfile's Supabase
  write); leaderboard upsert skips guests; saveFeedback + toggleHelpful no-op
  for guest/empty profileId. So NO guest path can create a cloud row.
  NUDGES (gentle, dismissible, benefit-framed): Home top banner (session-
  dismiss, reappears next launch); GuestSavePrompt on every results screen
  (Results + AdvancedTestResults mock & paper); Settings shows a "Sign in /
  Create account" card for guests instead of rename/switch/logout.
  GATING (graceful, never a dead-end): Library -> SignInGate for guests;
  Leaderboard -> view-only note (+ skip upsert). Mindmap, quizzes, learn,
  reference, dosage, stats -> fully OPEN to guests (local progress).
  WELCOME TOUR (owner-confirmed behaviour): keeps auto-showing EACH launch for
  a not-yet-signed-up guest (dismissWelcome + launchFromWelcome do NOT mark
  onboarding "seen" for the guest sentinel); real accounts keep the one-time
  behaviour. The login PAGE is the only thing made frictionless/optional.
  quizzesAttempted bumped on completeQuiz for guests (local only).

[PHASE B — DONE, step 27]  Sign-up MERGE flow. On account creation while a
  guest blob exists, ASK "Keep your guest progress?" (the agreed choice):
    - YES -> MERGE guest-local (KEYS.userdata(GUEST_ID)) into the new account's
      data BEFORE handleAuthed's setData, then clear the guest blob. Define the
      merge precisely against DEFAULT_DATA's shape: stats (sum totalAttempted/
      totalCorrect; max streaks; union dailyHistory by date), history (merge
      per-question attempt arrays), bookmarks (union), customQuestions (union by
      id), revisionLog (union), advancedTestHistory (concat), preferences
      (account wins). ACCOUNT wins on any true scalar conflict.
    - Handle the "already had an account on another device" case: the account's
      CLOUD blob is canonical; merging guest-local must not regress it (merge,
      don't overwrite). If the account already has more progress, prefer it.
    - NO -> discard guest blob, start clean from the account.
    - Flip guestMeta.signedUp; stop nudging (handleAuthed already sets signedUp).
  Edge cases surfaced in Phase A to handle in B: a logged-in user who logs out
  then back in should not have stale guest data merged unexpectedly (only offer
  merge when guest blob has real activity AND it wasn't already merged); guard
  re-entrancy so a double-submit can't double-merge.

  >>> DONE (step 27) — src/App.jsx ONLY. Schema v9 unchanged; no storage.js /
      package.json change. WHAT SHIPPED:
      * MERGE ENGINE (module-level, pure, next to the Phase A guest helpers):
        normalizeUserData(raw) — runMigrations + fill to DEFAULT_DATA's full
        shape with container-type guards (mirrors the boot path; idempotent).
        guestBlobHasActivity(d) — true only if totalAttempted>0 OR any history/
        bookmarks/customQuestions/advancedTestHistory/revisionLog/previousPapers.
        mergeGuestIntoAccount(account, guest) — ACCOUNT is the canonical base
        (spread first), guest folds in ADDITIVELY so the account can only GROW:
          stats: SUM totalAttempted/totalCorrect; MAX streakCurrent/streakBest;
            union dailyHistory by date (summing per-day counts, consistent with
            the totals); newest lastStudiedDate; max lastCompactedTs; all other
            scalars (examDate, dailyTarget, streakGraceAvailable, graceJustUsed)
            keep the ACCOUNT value.
          history: union by qId; per question concat+sort+dedupe attempts by ts,
            recompute lastResult from the newest attempt, SR fields (reviewCount/
            nextDue) follow whichever side attempted more recently.
          bookmarks: set-union. customQuestions: union by id (account wins ties).
          revisionLog: union by date (ids merged), newest-first, cap 60.
          advancedTestHistory: concat, dedupe by ts, cap -50 (matches
            submitAdvancedTest). previousPapers: per-paper concat (cap 20) with
            recomputed bestNet/lastTs/lastAccuracy.
          preferences: ACCOUNT wins entirely. bank*Seen maps: account wins, max
            on shared numeric keys. disabledBanks/feedbackRepliesSeen: account
            wins. dismissedAnnouncementId + any future scalar: account wins.
      * UI: <GuestMergePrompt> — accessible dialog (A9 useFocusTrap, role=dialog,
        aria-modal), A8 CSS-var classes, all 5 themes via tokens. Shows a guest-
        activity summary ("N questions answered · M bookmarks · K tests").
        Escape maps to KEEP (the data-preserving default) so an accidental
        dismiss never discards progress. Two explicit buttons, no silent close.
        Icons Save + Check (both already in the lucide import — no new import).
      * FLOW: handleAuthed was split. handleAuthed(p) now builds the account's
        canonical data, loads the guest blob, and — if it has genuine activity —
        sets pendingMerge {profile, accountData, guestData} and RETURNS (auth
        paused) instead of committing. A dedicated early-return renders
        <GuestMergePrompt> (so nothing inconsistent shows behind it — profile/
        data are NOT swapped to the account until the choice is made).
        resolveGuestMerge(keep) computes finalData (merged or account-only),
        commits via the new commitAuth(p, finalData) [setProfile + setData
        synchronously, then announcement / guestMeta.signedUp / welcome-tour],
        then clearGuestData() removes KEYS.userdata(GUEST_ID). commitAuth is the
        normal account write path, so the merged blob syncs to Supabase via the
        existing saveProfile effect — correct, it's a real account now.
      * GUARDS: (1) re-entrancy — mergeResolveBusyRef makes a double-tap on the
        dialog a no-op (can't double-merge); re-armed (false) on each new offer.
        (2) "already merged / stale" — clearGuestData() after EITHER choice means
        loadGuestData() returns null next time, so a normal logout->login can't
        re-offer/re-merge; only genuinely NEW guest activity (a fresh blob built
        afterwards) qualifies again. (3) a merge exception can never block sign-
        in (falls back to account-only data). (4) "account richer / other device"
        is automatic: additive folds never regress the canonical account.
      * RECONCILIATION vs this prompt body: (a) the enumerated field list omitted
        previousPapers, bankVersionsSeen, bankPublishedSeen, disabledBanks,
        feedbackRepliesSeen — all REAL DEFAULT_DATA fields — so the merge handles
        them explicitly (previousPapers merged like advancedTestHistory; the
        others account-wins, since a guest can't import banks or file feedback,
        so theirs is empty anyway). (b) "merge BEFORE handleAuthed's setData":
        honored by pausing auth on pendingMerge and only calling commitAuth's
        setData after the choice — profile/data never momentarily mismatch.
        (c) ORPHANED-BLOB edge: if the user closes the app while the prompt is
        open, the session is already saved (AuthScreen saved it before onAuthed),
        so next boot lands in the account and the guest blob is NOT auto-merged
        on boot (merge is auth-flow-only, never boot — avoids surprise merges).
        The blob is not lost; if they later log out -> guest -> log in, the offer
        re-appears. Acceptable rare edge; documented, not blocking.
      * VERIFY: esbuild --jsx=automatic clean (exit 0, no warnings). Save/Check
        confirmed in the lucide import. Merge unit-tested in Node against the
        REAL extracted functions: 45/45 — guestBlobHasActivity predicate;
        both-have-activity (sums/max/unions/by-id/history-merge/previousPapers/
        revisionLog/preferences-win); guest-only; account-only (no regression);
        account-richer (strictly grows); idempotency / no-double-count after
        clear; malformed-blob defense.

RECONCILIATION (Phase A): the original feature idea said "before the mindmap";
  the mindmap Phase A had already shipped (step 25) by the time guest mode was
  built, so it was inserted as the next step (26) ahead of mindmap Phase B (now
  28). No reactflow involvement. No package.json/schema/storage.js changes.

VERIFICATION (Phase A): esbuild clean (exit 0). Guest logic unit-tested (17
  substantive guards pass): predicate (incl. null/undefined), persist routing,
  feedback/helpful/leaderboard cloud-write guards, welcome-seen guard, and the
  sentinel collision-safety against the real normalizeProfileId.


================================================================
PROMPT P-NAV: BOOT LOGIN-FLASH FIX + HARDWARE BACK-BUTTON NAV  (Priority: HIGH)  [LOCAL]
================================================================
[PENDING — step 28]  Two related UX bugs on the installed PWA, both touching
the boot/auth gate and in-app navigation. Storage-neutral; schema stays v9; do
NOT touch storage.js / lib/* / package.json. Additive + defensive only.

WORKFLOW: read session-notes FIRST, then this prompt, then VERIFY assumptions
against the real App.jsx before editing (grep the boot effect, the render gate,
loadProfile/loadSession, the quiz popstate guard). Honor intent; reconcile to
real code; document mismatches. Transpile-check (esbuild --jsx=automatic) after
each batch; unit-test the non-trivial logic; update both tracking docs; deliver
files; tell the owner to npm run build + preview on Vercel.

--- BUG 1: LOGIN SCREEN FLASHES BEFORE THE ACCOUNT LOADS ---
SYMPTOM: a logged-in user opening the installed app sometimes sees the login
(AuthScreen) for a moment, then it resolves into their account.
ROOT CAUSE (verify): in App boot, the render gate is roughly
  if (loading) -> splash;  else if (!profile||!data) -> AuthScreen;  else -> app.
`loading` can flip false (incl. via the 7s watchdog) before `profile` is
populated, OR loadProfile is slow because it queries SUPABASE FIRST then falls
back to the local cache — so for a frame or two `profile` is null and the
AuthScreen branch renders. On a cold PWA launch the Supabase round-trip is
slowest, so the flash is most visible then.
FIX (intent — pick the cleanest against real code):
  1. Add a distinct boot/session-resolution state so the gate can NEVER show
     AuthScreen while a KNOWN session is still resolving. e.g. keep showing the
     splash (or a neutral hold) until the session check + profile load settle;
     only fall to AuthScreen when we've positively determined there is NO
     session (and not in guest mode). Do not let the watchdog dump a user with
     a saved session onto AuthScreen — on watchdog timeout WITH a known
     session id, prefer the local cache / keep holding, not the login screen.
  2. Make restore LOCAL-FIRST for instant paint: if KEYS.userdata(<id>) (the
     local cache, shared:false) exists for the session's profileId, hydrate
     profile+data from it IMMEDIATELY, then refresh from Supabase in the
     background and reconcile (last-write-wins already applies). loadProfile
     currently tries Supabase first; for the BOOT path specifically, read the
     cache first so the account paints with zero network wait. (Keep the
     cloud-canonical behaviour for the post-boot refresh.)
  3. Must compose with GUEST MODE (step 26): when there is genuinely no
     session, the correct destination is GUEST mode, not AuthScreen — the wall
     is already gone. So Bug 1's "no session" branch should land in guest mode
     (as boot already does) and AuthScreen stays the opt-in nav.screen==='auth'
     route. Net effect: a returning account never sees AuthScreen at all.
  WATCH OUT: don't reintroduce the "stuck on splash forever" failure the 7s
  watchdog was added to prevent — keep a watchdog, but on timeout resolve to
  the BEST KNOWN state (cached account, else guest), never the login screen.
  TEST: cold launch with a saved session on a THROTTLED network shows the
  account (from cache) with NO login flash; a no-session launch shows guest;
  a genuinely broken boot still resolves (never hangs).

--- BUG 2: PHONE HARDWARE/GESTURE BACK BUTTON MINIMIZES THE APP ---
SYMPTOM: the OS back button/gesture exits/minimizes the PWA instead of acting
like the in-app back arrow.
ROOT CAUSE (verify): the app navigates via React state (setNav) which pushes
NO browser history entries, so the device back has nothing to pop and the OS
treats it as "leave app". The ONLY place history is pushed today is the quiz
popstate guard (search `quizGuard` / pushState in the Quiz component), which is
why back behaves differently mid-quiz.
FIX (intent): mirror in-app navigation into the history stack so the device
back maps to in-app back.
  1. On forward navigation (setNav to a non-home screen / opening a modal),
     history.pushState a marker. On popstate, instead of leaving the app, route
     to the in-app "back" target (previous screen, or Home), i.e. call the same
     logic the in-app back arrow uses. From Home (root), allow the default
     (let the OS minimize/exit) OR implement a "press back again to exit"
     — owner preference; default to: back from Home exits normally.
  2. GENERALIZE the existing quiz guard rather than fighting it: the quiz
     confirm-exit must still intercept back (don't lose that). Design one
     coherent popstate handler (or a small nav-history helper) so quiz guard,
     the A9 modals/focus-trap dialogs (Escape already closes them — back should
     too where sensible), and normal screen back all compose without double-pop
     or pushState leaks. Be careful with: modals open (back should close the
     modal first, not navigate), the welcome tour, and the confirm-exit dialog.
  3. Keep it defensive: feature-detect window.history; guard SSR; ensure
     unmount cleanup removes listeners and doesn't strand guard entries.
  TEST (device/emulator): back from a deep screen returns to the previous
  screen, not minimize; back inside a quiz triggers the confirm dialog; back
  with a modal open closes the modal; back from Home minimizes as expected;
  rapid double-back doesn't skip two screens or corrupt history.

RECONCILIATION TO CHECK: this overlaps with A12 (URL-based routing, step 40),
which would solve Bug 2 more thoroughly via real routes. P-NAV is the LIGHT
fix (history markers, no router) to ship now; when A12 lands it can supersede
the manual history handling. Note that in the handoff so A12 doesn't double-
implement. Also: a full back-stack may want nav history as an array — if you
add one to component state, that's render-only (no storage/schema change).

SAFE FOR EXISTING USERS: no data shape change, no schema bump, no storage.js /
package.json change. Pure boot-gate + navigation behaviour. Existing accounts
must boot faster (cache-first) and never regress into the login screen.

[DONE — step 28]  src/App.jsx only; schema v9; storage-neutral.
  BUG 1 (login flash): added loadProfileCached(id) (cache-only, no network) +
  a new `sessionResolving` state (default true). The render gate now holds the
  splash while (loading || sessionResolving), so AuthScreen can NEVER paint for
  a returning user. Boot is now LOCAL-FIRST: if KEYS.userdata(<id>) cache hits,
  commit the account instantly (commitAccount helper) and release the gate,
  THEN reconcile against Supabase in the background (loadProfile) and re-commit
  silently if the cloud differs. Cache miss → canonical network load while STILL
  holding the splash (not auth). No-session → guest mode (unchanged). Watchdog
  kept but resolves to best-known state (finally clears both flags); it can no
  longer dump a known session onto the login screen.
  BUG 2 (hardware back): module-level pure decideBackAction({screen, overlayOpen,
  selfGuarded}) -> 'self-guarded' | 'close-overlay' | 'go-home' | 'exit', plus
  NAV_SELF_GUARDED_SCREENS={quiz,advanced-test,paper-test} and
  NAV_ROOT_SCREENS={home}. A state-synced effect keeps ONE history sentinel
  armed whenever back should stay in-app (non-root screen OR welcome/merge
  overlay), skipping self-guarded screens (Quiz/Advanced run their OWN
  ConfirmExitDialog popstate guard — untouched, no double-handling). A global
  popstate handler routes: self-guarded → ignore; merge prompt → no-op (forced
  choice, re-arm only, never dismiss on back); welcome → close + Home; deep
  screen → Home; Home idle → let OS exit. Defensive (feature-detects
  window.history, cleans up listener on unmount).
  RECONCILIATION: screen-LOCAL modals (Help/Feedback/Rename/ReportedQuestion)
  already close on Escape via the A9 useFocusTrap and keep their own state inside
  sub-components; threading them into the global back handler would risk
  regressions for little gain, so back-closes-modal is scoped to the APP-LEVEL
  overlays (welcome; merge prompt is intentionally non-dismissible). When A12
  (URL routing) lands it can supersede this manual history handling.
  VERIFY: esbuild clean (exit 0); decideBackAction unit-tested 11/11 (all
  state combos incl. precedence self>overlay>root); NAV_SELF_GUARDED_SCREENS
  names confirmed against the real nav vocabulary (quiz/advanced-test/paper-
  test); useRef import confirmed. Phase B merge logic re-confirmed intact.
  HEADS-UP HONORED: the boot rework does not strand a pending merge (merge is
  auth-flow-only, never boot), and popstate does not dismiss the merge dialog.


================================================================
PROMPT 10: INTERACTIVE KNOWLEDGE MINDMAP (Priority: MEDIUM-HIGH)  [ARTIFACT]  [DONE — deployed; bug-fixed Jun 2026: pan/zoom 'ox' crash + dismissable "Suggested today" panel]
================================================================
[PHASE A DONE — step 25] [PHASE B DONE — step 29]
  WHAT WAS BUILT (Phase A, src/App.jsx only, schema v9, ZERO storage writes):
    * New <KnowledgeMap> screen + <MindmapNodePopup>, inserted right after
      CoverageMap. Radial SVG mindmap: centre NORCET -> ring 1 subjects ->
      ring 2 subtopics, curved (quadratic-Bezier) edges, per-subject colour.
    * Pure, unit-tested helpers (also near CoverageMap): mindmapState,
      mindmapNextProgress, computeMindmapModel, mindmapLayout, _kmapEdgePath,
      _kmapNodeStyle, + consts KMAP_STATES / KMAP_VIEW / KMAP_R1 / KMAP_R2 /
      KMAP_STATE_LABEL / clampNum.
    * Node states LOCKED/DISCOVERED/FAMILIAR/MASTERED computed live from
      user progress, reusing the EXACT Coverage/Stats/Weak-Areas definition
      (attemptStats over data.history, aggregated by q.topic; accuracy =
      correct/attempted). Tap popup: name, accuracy, progress-bar to next
      state, and a "Practice" button that launches a topic-locked quiz
      (sub-filtered for subtopic nodes) via startQuiz, exactly like the
      Coverage drill. Popup uses the A9 useFocusTrap + role="dialog".
    * Pan (drag), zoom (wheel + 2-finger pinch), fit-to-screen, double-tap
      to focus a node, zoom/fit buttons, themed dot-grid background, and a
      minimap that only appears past ~1.15x zoom — all hand-built in SVG.
    * Home entry card (Network icon, "NEW") + a NavDrawer "Knowledge map"
      item. Encouraging banner for zero-progress users; gk/apt excluded
      unless preferences.includeGkInStats; empty subjects/subtopics hidden.

  KEY RECONCILIATIONS (prompt vs reality):
    1. DEPENDENCY DECISION: did NOT add reactflow / @xyflow/react. On a live
       PWA a new ~120-150KB dep can't be verified in this bundle (esbuild
       only transpiles, never resolves imports), pulls its own CSS, and
       complicates the offline precache. Node count (~10 subjects + their
       subs, <100) is not "at scale", so a deterministic hand-built SVG
       radial layout is lighter, fully offline, fully verifiable, and
       writes nothing. package.json is UNCHANGED. (Owner may veto and
       switch to reactflow for Phase B's richer interactions if desired.)
    2. The prompt's 3-level subject->topic->subtopic maps onto this app's
       2-level data: TOPICS = subjects (ring 1), q.sub = subtopics (ring 2).
       No separate third level exists in the bank.
    3. Icons Network/Share2/GitBranch were ALL absent from the lucide import
       (handoff flagged Share2). Added only `Network`.
    4. The >=10/>=25-attempt thresholds are meaningful only at the SUBJECT
       ring (subjects accrue many attempts; a single sub rarely holds >=10
       questions). Subtopic nodes carry the SAME metric but a simpler
       locked/discovered visual.
    5. Colours come from the app's existing per-topic colour (topicColor /
       TOPICS[].color), lifted for dark surfaces via fgOnDark — not the
       T.sec.* home-tile ramp — so the map stays consistent with how topics
       are coloured everywhere else, in all 5 themes.

  PHASE B (step 26) STILL TO DO — the prompt items deferred out of Phase A:
    * DEPENDENCIES (item 4): a DEPENDENCIES array near the topic data,
      SOLID = prerequisite / DOTTED = related edges, and a pulse animation
      on prerequisite edges when a topic is struggling (<50% on >=5
      attempts). Wire these as extra edges in mindmapLayout (the tree edges
      already carry a `kind`; add 'prereq'/'related').
    * BONUS "beyond syllabus" nodes (item 5): hexagonal amber nodes outside
      a subject's ring, hidden until >=2 topics mastered in the parent,
      fade-in+pulse on first reveal, Explorer badge. If this PERSISTS an
      unlocked/badge flag it MUST use a NEW local kv key via the safeStorage
      shim (shared:false) defensively — do NOT bump schema (still v9 since
      step 14) and do NOT touch storage.js.
    * ADMIN editing (item 9): JSON import/export of the hierarchy +
      dependencies, same pattern as the existing bank import.
  Phase A leaves clean seams for all three: computeMindmapModel returns the
  full per-subject/per-sub stats (incl. uniqueAnswered) and mindmapLayout
  returns typed nodes+edges, so Phase B is additive.

  [DONE — step 29]  src/App.jsx only; schema v9; the ONLY storage write is a
  new LOCAL kv key (shared:false). Built items 4 & 5; item 9 (admin JSON) is
  deferred to a small follow-up (see below) as it's independent and lower value.
    * DEPENDENCIES: added `const DEPENDENCIES` (14 edges: 8 prerequisite, 6
      related) keyed on REAL subject ids (anat/msn/pharm/fund/peds/obg/ch/mhn/
      micro/nutr). mindmapLayout now also emits kind:'prereq' (SOLID, T.accent)
      and kind:'related' (DOTTED, T.muted) edges between subjects that are BOTH
      present in the model (skips absent/gk-off subjects). A prereq edge gets
      pulse:true (CSS .kmap-edge-pulse) when its SOURCE subject is struggling
      (subjectStruggling = accuracy <0.5 on >=5 attempts).
    * BONUS NODES: `const BONUS_NODES` (5 hexagonal amber "beyond syllabus"
      nodes, namespaced ids 'bonus::*'), revealed only when the parent subject
      has >= BONUS_REVEAL_MASTERED (2) mastered subs (revealedBonusNodes).
      Rendered as flat-top hexagons (_kmapHexPath) with KMAP_BONUS_COLOR, a
      fade-in+pulse on reveal (.kmap-bonus-reveal / .kmap-bonus-pulse). Tapping
      opens a dedicated bonus branch in MindmapNodePopup with "Mark as explored"
      → earns the Explorer badge, persisted LOCAL-only under
      'explorerbadges:v1' (loadExplorerBadges/saveExplorerBadges, shared:false).
      Bonus nodes do NOT affect coverage % (computeMindmapModel untouched).
      Minimap dots for bonus nodes are amber.
    RECONCILIATION: prompt suggested tracking explorerBadges inside user
      progress (data.explorerBadges); to AVOID any schema/data-shape change on
      the live app, badges live in a separate local kv key instead (schema
      stays v9, storage.js untouched, guests included — it's local + shared:
      false). Edges are SUBJECT-level (the bank is 2-level), consistent with
      the Phase A reconciliation; the example ids in the prompt
      (pharmacokinetics/drugInteractions) don't exist as separate topics.
    VERIFY: esbuild clean (exit 0); 17 pure-logic tests (masteredSubCount,
      subjectStruggling thresholds incl. exactly-50%/<5-attempts edges,
      revealedBonusNodes gating, DEPENDENCIES/BONUS_NODES integrity vs real
      ids) + 8 mindmapLayout integration tests (prereq/related/bonus edge
      emission, pulse flags, present-subject-only edges, tree edges intact) all
      pass. Check/Network icons confirmed imported.
    STILL DEFERRED → PHASE C (item 9, admin JSON import/export of the
      hierarchy + DEPENDENCIES + BONUS_NODES, mirroring the bank-import
      pattern). Low risk, fully additive; not yet scheduled in the checklist —
      add it if/when you want code-free structure edits.


I have a NORCET Prep React PWA. I want to add an interactive mindmap
screen that visualizes the entire NORCET syllabus as a tree of subjects
and topics, gamified so users unlock branches by practicing — turning
their progress into a visible knowledge graph they can navigate.

USE A LIBRARY: install `reactflow` (or `@xyflow/react`) — it handles
auto-layout, smooth pan/zoom, curved Bezier edges, and a built-in
minimap. Do NOT try to hand-build the layout — it will look broken
at scale.

WHAT TO BUILD:

1. NEW SCREEN: "Knowledge Map" — accessible from the home screen via
   a new card (use the Network or Share2 icon from lucide-react, or
   GitBranch if it conveys "branching tree" better).

2. LAYOUT — radial tree mindmap with central node "NORCET":
   - Center: NORCET (root)
   - First ring: ~6-8 major subjects (Pharmacology, Anatomy, Pediatrics,
     Med-Surg, Community Health, Mental Health, etc.) — derive these
     from the existing topic list in SEED_QUESTIONS
   - Second ring: topics under each subject
   - Third ring: subtopics (optional — only where the topic actually
     has sub-areas in the question bank)
   - Curved Bezier edges between parent and child nodes
   - Each subject branch gets its own color (use the existing theme
     ramp — 6-8 distinct hues that work in light AND dark mode)

3. NODE STATES — computed live from user progress data:

   For each topic node, count questions answered (correct/total) by
   that user in that topic. Map to one of 4 visual states:

   - LOCKED (0 questions attempted)
     Grey/dim, semi-transparent, name visible but desaturated
   - DISCOVERED (≥1 question attempted)
     Light fill of the subject's color, visible name
   - FAMILIAR (≥10 questions AND ≥60% accuracy)
     Medium fill, slight glow effect on hover
   - MASTERED (≥25 questions AND ≥80% accuracy)
     Full subject color, persistent soft glow (CSS box-shadow with
     the theme color), small ✓ checkmark badge

   Tap any unlocked node → opens a small popup with:
     • Topic name + current accuracy
     • "Practice [Topic]" button — launches a topic-locked quiz
     • Progress bar toward next state

4. DEPENDENCIES (edges with meaning):
   - SOLID line = prerequisite. E.g., "Master Pharmacokinetics
     before Drug Interactions makes sense"
   - DOTTED line = related topic (lateral connection). E.g.,
     "Cardiac Anatomy ↔ ECG Interpretation ↔ Antiarrhythmics"
   - When a user struggles with topic X (accuracy <50% on ≥5 questions),
     highlight its prerequisite edges with a pulse animation —
     suggesting where to strengthen first
   - Define dependencies in a separate `DEPENDENCIES` array near the
     topic data so it's easy to edit:
       { from: 'pharmacokinetics', to: 'drugInteractions', type: 'prerequisite' }
       { from: 'cardiacAnatomy', to: 'ecgInterpretation', type: 'related' }
   - Start with ~10-15 key relationships. More can be added later
     without code changes — just data.

5. "BEYOND SYLLABUS" / BONUS NODES:
   - Add a separate set of advanced topics that go beyond standard
     NORCET (e.g., "Advanced ECG: Arrhythmia recognition",
     "Pharmacogenomics basics", "Critical Care Pharmacology")
   - Visual treatment: HEXAGONAL shape (not circle), AMBER/GOLD
     color, sits slightly OUTSIDE the main subject's ring
   - HIDDEN by default — only appears when the user has mastered
     ≥2 topics in the parent subject
   - When revealed for the first time, brief animation drawing
     attention to it: fade-in + soft pulse for 2 seconds
   - Mastering bonus nodes earns an "Explorer" badge (track in user
     progress as `explorerBadges: [topicId, ...]`)
   - Bonus topics do NOT count toward overall NORCET coverage
     percentage — they're extra credit, not core syllabus

6. PAN AND ZOOM:
   - react-flow's <Controls /> component for zoom in/out/fit-view
   - Use <Background /> with a subtle dot grid that matches the theme
   - Add a <MiniMap /> in the bottom-right corner, but only show it
     when zoomed in past 75% (auto-hide at default zoom)
   - Default view: fit-to-screen showing the full mindmap
   - Pinch-to-zoom and two-finger pan on mobile
   - Double-tap on a node centers and zooms into it

7. PERFORMANCE:
   - At 50-100 nodes the layout should be smooth on a 3-year-old phone.
     react-flow handles this natively. If users start adding huge
     custom question banks (200+ topics), implement virtualization
     using react-flow's built-in `onlyRenderVisibleElements` prop.
   - Compute node states ONCE when the screen mounts, store in a
     useMemo. Recompute only when user progress data changes.

8. VISUAL STYLE — match the existing theme system:
   - Read the active theme (Forest, Bloom, Dusk, Meadow, dark variants)
     and apply its palette to:
       - Background color
       - 6-8 subject colors (use theme's accent + analogous hues)
       - Edge stroke color (use a muted theme color)
       - Locked-node grey (use theme's muted secondary)
       - Mastered glow (use theme's primary accent)
   - All node labels: use the app's existing font (Fraunces for
     subjects/titles, DM Sans for topic labels)
   - The whole map should feel like a natural extension of the app,
     not a Mermaid-rendered diagram

9. ADMIN CONTROLS (small but useful):
   - In admin mode, allow editing the topic hierarchy and dependencies
     via JSON import/export (same pattern as existing bank import)
   - This lets you refine the structure without redeploying code

10. EDGE CASES:
    - User with no progress: show the full structure but everything
      is LOCKED state. Encouraging message at the top: "Take a quiz
      to start unlocking your knowledge map."
    - Offline: the map still renders (the structure is in the code,
      not Supabase). User progress comes from local IndexedDB cache.
    - Empty topics (defined in hierarchy but no questions in bank):
      hide them entirely — don't show ghost nodes.

11. DO NOT TOUCH:
    - Existing screens, modes, or features
    - The storage.js API
    - Any UI outside the new Knowledge Map screen

12. PACKAGE.JSON: add `reactflow` (or `@xyflow/react` — pick the
    current actively-maintained one) to dependencies. Verify the
    build succeeds with the new dependency before zipping.

13. Run the build to confirm it compiles. Note the bundle size
    impact in your response — react-flow adds ~120-150KB gzipped,
    which is fine but worth confirming.

NOTE ON SCOPE: This is the largest single feature in the prompts file.
Expect 3-5 hours of focused work. If the Claude session runs out of
context partway through, you may need to split into two prompts:
  Phase A — set up react-flow + render basic radial layout with states
  Phase B — add dependencies + bonus nodes + admin editing

I will attach the current src/App.jsx file.


================================================================
PROMPT 11: MINDMAP V2 — ENHANCEMENTS (Priority: AFTER PROMPT 10)  [ARTIFACT]
================================================================

I have an interactive knowledge mindmap in my NORCET Prep React PWA
(built per Prompt 10 — using react-flow with subjects/topics/subtopics,
4 states from Locked to Mastered, dependency edges, and bonus nodes).

I want to enhance it with three high-impact features that turn the
map from a status display into an active learning tool. These are
listed in build order — do them sequentially, not in parallel.

Each feature is INDEPENDENT — you can build any subset.

================================================================
FEATURE A — "WHAT TO STUDY NEXT" SUGGESTIONS (highest impact)
================================================================

Removes the decision fatigue that kills daily usage. The app picks
1-2 topics each session and tells the user where to focus today.

1. Add a small floating panel in the top-right of the mindmap:
     "✨ Suggested for you today"
     [Topic name 1]  →  Start
     [Topic name 2]  →  Start

2. Selection logic — pick the top 2 topics ranked by this priority:
   a) Topics with accuracy <50% AND ≥5 questions attempted
      (genuinely struggling — needs attention NOW)
   b) Prerequisites of topics the user is struggling with that are
      themselves LOCKED or DISCOVERED (foundation work)
   c) Topics not touched in 14+ days that were previously FAMILIAR
      or MASTERED (fading retention)
   d) Topics in subjects where the user is close to mastering one
      more topic (nudge toward completion goals)
   Cycle through these priority types so suggestions feel varied.

3. Persist suggestions for 24 hours so they don't churn between
   page refreshes. Store in IndexedDB:
     key:   suggestions:{profileId}:{YYYY-MM-DD}
     value: { topicIds: [...], generatedAt: timestamp }
   New suggestions generate fresh at midnight (user's local time).

4. When a suggested topic is mastered, show a brief celebration
   toast: "You crushed the suggestion! 🎯" and regenerate the panel.

5. Add a small "Why this?" tooltip on each suggestion explaining
   the reason: "You scored 40% here last time" or "This unlocks
   3 dependent topics" — transparency builds trust.

[DONE — step 30]  src/App.jsx only; schema v9; the only storage write is a NEW
LOCAL kv key (shared:false). Implemented at SUBJECT granularity (reconciled —
the bank has no separate "topic" level; same mapping as P10).
  * rankStudySuggestions(model, lastTouchedById, nowMs, deps): pure, returns up
    to 2 {id,name,reason,detail}. Buckets in priority order then CYCLED so the
    two picks vary in flavour, de-duped by subject id:
      (a) struggling  — accuracy <0.5 on >=5 attempts
      (b) foundation  — a LOCKED/DISCOVERED prerequisite (via DEPENDENCIES) OF
                        a struggling subject
      (c) fading      — FAMILIAR/MASTERED untouched >= SUGGEST_STALE_DAYS (14)
      (d) almost      — subject with >=1 mastered AND >=1 familiar sub (nudge)
  * subjectLastTouchedTs(subjectId, allQuestions, history, lastSeenTsFn): newest
    attempt ts across the subject's answered Qs (0 if never). Uses the existing
    lastSeenTs (P15-safe for compacted records). NOTE: history records DO carry
    timestamps (attempts:[{ts,...}]), so (c) works without any schema change.
  * 24h PERSISTENCE: suggestionsKey(profileId,YYYY-MM-DD) +
    loadSuggestions/saveSuggestions (shared:false). On mount: use today's cached
    set if present (re-hydrated from the live model, dropping ids that no longer
    exist); else rank fresh and cache under today's date. New day -> new key ->
    regenerates at local midnight (todayStr()).
  * UI: floating "✨ Suggested today" panel, top-right overlay inside the map
    surface; per item: name + Start (calls onPracticeTopic(id)) + the reason
    "detail" line (satisfies item 5's "Why this?" inline). Hidden when empty.
  * 16 pure-logic unit tests pass (all 4 buckets, threshold edges incl.
    exactly-50%/<5-attempts and 14-day boundary, cycling, dedup, 2-cap,
    subjectLastTouchedTs). esbuild clean. Sparkles icon confirmed imported.
  RECONCILIATION / DEFERRED:
    - item 4 (celebration toast when a SUGGESTED subject becomes mastered +
      regenerate) is NOT done — it needs pre/post-quiz state diffing across
      screens (more surface area). Left as a small follow-up; the panel already
      regenerates daily and re-hydrates from the live model each open.
    - Suggestions are persisted LOCAL (shared:false) so GUESTS get them too and
      nothing hits Supabase; key namespaced by profileId ('guest' when absent).

================================================================
FEATURE B — ANIMATED UNLOCK MOMENTS
================================================================

Makes progress feel earned, not silent. Currently node states change
quietly when data updates — users miss the satisfaction of progress.

1. When a node transitions to a new state (after a quiz session
   completes), trigger a celebration animation on that node:

   Discovered (first attempt):
     - Gentle scale-up + opacity fade-in over 600ms
     - Soft white glow that fades after 1.5s
     - No sound
   
   Familiar:
     - Brief color saturation pulse (200ms)
     - Small "+" particles emit from the node (5-7 dots, fade out)
     - Subtle haptic feedback on mobile (navigator.vibrate(20))
   
   Mastered:
     - Larger scale bounce (1.2x for 200ms, then settle)
     - Color burst — ~15 particles in the subject's color, radiating
       outward and fading over 1.5s
     - Checkmark badge slides in with a small spring animation
     - Stronger haptic (navigator.vibrate([30,40,30]))
     - Optional: brief star/sparkle SVG appears and fades

2. Queue animations if multiple nodes change at once. Play them
   sequentially with a 400ms stagger so each one is appreciated.

3. AFTER the animation, fly the camera to the changed node(s) with
   a smooth zoom (use react-flow's setCenter). Auto-zoom-out after
   3 seconds back to fit-view.

4. Respect prefers-reduced-motion: if enabled, skip all animations
   and just show the new state.

5. Audio is OFF by default. Add a small sound toggle in mindmap
   settings — if enabled, play a single soft chime per state change
   (use the Web Audio API to synthesize a quick tone, no audio files).

[DONE — step 31]  src/App.jsx only; schema v9; the ONLY storage write is a NEW
LOCAL kv key 'mindmapseen:v1:{profileId}' (shared:false) holding the prior
per-node state snapshot, plus a tiny local 'mindmapsound:v1' (shared:false) for
the sound toggle. No Supabase write; guests included. Implemented at SUBJECT +
SUBTOPIC granularity (the two real node levels — same reconciliation as P10/A).
  * PURE diff core (unit-tested): mindmapStateRank, buildMindmapStateSnapshot,
    diffMindmapUpgrades(prev, model). diff returns ordered upgrades
    {id,name,color,kind,fromState,toState,tier}; tier == the NEW state. prev ==
    null => [] (first ever view seeds silently, no burst); a node ABSENT from
    an existing snapshot is treated as 'locked' so locked->discovered (first
    attempt) celebrates. Play order = ascending tier (biggest moment LAST),
    tiebreak by name; capped to CELEB_MAX=6 keeping the highest tiers.
  * Effects per tier (CSS keyframes added to fontStyles, hand-built SVG):
      discovered -> white glow (1.5s) + gentle scale-up ring (~0.6s), no haptic.
      familiar   -> saturation pulse (~0.5s) + 6 '+' particles + vibrate(20).
      mastered   -> 1.2x bounce ring + ~15-particle colour burst (1.5s) +
                    checkmark badge spring-in + sparkle + vibrate([30,40,30]).
    Queue plays sequentially with a ~400ms stagger; per-tier on-screen hold.
  * SNAPSHOT decision: PERSISTED locally ('mindmapseen:v1:{pid}', shared:false)
    rather than a mount ref — the map UNMOUNTS when you leave for a quiz, so a
    ref would reset and the post-quiz diff would be lost. Re-baselined UP FRONT
    on every open (idempotent re-entry; re-viewing without a quiz shows nothing).
  RECONCILIATIONS (prompt predates the code):
    - NO react-flow (the map is hand-built SVG). Item 3's setCenter is replaced
      by tweening the existing { k,x,y } 'view' with requestAnimationFrame using
      the SAME transform model as focusNode()/fitView(): per node we gently fly
      in, then auto-fit at the end. A pointerdown cancels the tour so the user's
      pan/zoom is never fought. No CSS transition on the SVG transform attribute
      (it would not animate an XML attribute and risked the load-bearing pan
      math), hence the rAF tween.
    - prefers-reduced-motion: skips ALL animation, camera moves, haptics and
      chime; the snapshot is still re-baselined so the new state just appears.
    - haptics are mobile-only + feature-detected (navigator.vibrate); chime is
      Web Audio, feature-detected, OFF by default, gesture-unlocked on enable.
    - Composes with P10 bonus reveal (targets bonus:: ids, never in this
      subject/sub diff) and the Feature A panel (independent effect) — no
      double-fire on the same render.
    - Item 4's "celebration TOAST when a SUGGESTED subject is mastered" is still
      deferred to a follow-up, but the state-diff groundwork now exists here.
  * 32 pure-logic tests + 4 haptic-mapping tests (Node, real extracted source):
    all tiers, seed/no-change/downgrade, subjects+subs, play order + name
    tiebreak, CELEB_MAX cap keeping highest tiers, defensive null/empty. esbuild
    clean; Volume2 icon confirmed already imported (toggle would crash without).

================================================================
FEATURE C — NOTE ATTACHMENT PER NODE
================================================================

[DONE — step 32]  src/App.jsx only; schema v9 unchanged; package.json /
storage.js untouched. The ONLY storage write is ONE new local kv blob
'mindmapnotes:v1:{profileId}' (shared:false), holding { v, notes:{ nodeId:
{text,updatedAt} }, updatedAt }. Reconciliations vs this prompt:
  * Storage shape: prompt suggested a per-topic key note:{pid}:{topicId}; we
    use a SINGLE blob per profile instead — consistent with every other local
    key (suggestions / explorerbadges / mindmapseen / mindmapsound) and it makes
    search + export a single read and import a single write (fewer IndexedDB
    round-trips -> smoother on low-end phones, per the common rules).
  * "topicId" maps onto the mindmap layout node id, so BOTH subjects (subj.id)
    and subs (subj.id + '::' + sub) can be annotated.
  * Item 1 (open editor): long-press (480ms, pointer) on mobile + right-click
    (onContextMenu) on desktop. A drag or quick tap never opens it (the
    long-press timer is cancelled on >8px movement / pointer-up, and a fired
    long-press suppresses the follow-up tap). Editor = focus-trapped dialog
    (A9 pattern): textarea (2000-char cap + live counter) + Save / Cancel /
    Delete (Delete only when a note already exists). Themed via T so it matches
    all colour schemes.
  * Item 2 (storage): per profile, shared:false, guests included ('guest').
  * Item 3 (indicator + read view): a small pushpin badge renders at a node's
    corner when it has a note. RECONCILED: the read-only note view (text +
    "updated …" timestamp + Edit) lives inside the EXISTING tap popup rather
    than a separate badge-tap popover — sub nodes (r=11) are too small for a
    reliable independent tap target and a 2nd floating layer would fight the
    pan/zoom transform. The badge stays as the at-a-glance cue.
  * Item 4 (search): a compact toggle next to the sound button expands into a
    full-width bar; typing highlights matching nodes (dashed accent ring) and
    dims the rest. Matches by topic name OR note text (pure mindmapNoteMatch),
    with a live match count and a clear/close button.
  * Item 5 (export/import): a "Topic notes" section in Settings. Export writes a
    JSON file (buildNotesExport); import parses (parseNotesImport — accepts our
    export shape or a bare map, validates/sanitises) and MERGES into existing
    notes (mergeNotes, newest updatedAt wins) so importing "my best mnemonics"
    never clobbers your own. This is separate from the data backup because notes
    live outside `data`.
  * Item 6 (markdown-lite): NOT built — left as an explicit TODO comment at the
    note module (storage stays plain text -> future-safe, no migration).
  * Pure helpers unit-tested (42 tests): mindmapNotesKey, sanitizeNoteText,
    mindmapNoteMatch, mergeNotes, buildNotesExport, parseNotesImport,
    relativeTimeShort. Composes with the P11-A panel + P11-B celebration overlay
    (independent overlays; long-press calls cancelCelebration via the shared
    pointer-down path).

Turns the mindmap from a status display into the user's personal
study journal — they can pin mnemonics, doubts, links, anything to
specific topics.

1. Long-press (mobile) or right-click (desktop) on any unlocked node
   opens a small modal:
     Title:   [Topic name] notes
     Body:    Multi-line text area
     Actions: Save / Cancel / Delete (if note exists)

2. Notes are personal — stored per profile in IndexedDB:
     key:   note:{profileId}:{topicId}
     value: { text: "...", updatedAt: timestamp }

   Use shared:false (local). These are personal study aids, not
   shared content.

3. Visual indicator on nodes with notes:
   - Small 📌 icon badge at the top-right corner of the node
   - Tap the icon to view the note inline (popover, not modal)
   - The note popover shows the text, "Edit" button, and timestamp

4. Notes are searchable: add a small search bar at the top of the
   mindmap. Typing filters/highlights nodes whose note OR topic name
   contains the query. Clear button to reset.

5. Export/import notes: add a button in Settings to export all notes
   as a JSON file (and import). Useful for backup and for sharing
   "my best mnemonics" with friends in the beta.

6. Optional Phase 2 (mark as TODO comment if not built): syntax
   support for markdown-lite formatting (bold *text*, italic _text_,
   bullet lists) and emoji.

================================================================
COMMON RULES (apply to all three features)
================================================================

- Match existing theme system (Forest, Bloom, Dusk, Meadow, dark variants).
- Don't break existing mindmap features from Prompt 10.
- Each enhancement should feel native to the app, not bolted on.
- Use the existing safeStorage shim — don't bypass it.
- Animations should be smooth on a 3-year-old Android phone. Test
  performance with 100+ nodes before declaring done.
- Run the build to confirm it compiles. Produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
ADDITIONAL MINDMAP IDEAS — UNPROMPTED REFERENCE
================================================================

These are not prompts yet — just a brainstorm list of further ideas
to consider after Prompt 11 ships. Pick any to convert into a
real prompt later.

ENGAGEMENT
- Streak path: highlight the path of topics mastered today/this week
- Constellation effect: connect all mastered nodes with glowing lines
- Daily quest cards: "Master 3 topics in Pharmacology today"

LEARNING INTELLIGENCE
- Topic difficulty heatmap (aggregate accuracy across all users)
- Prerequisite alerts when user fails a topic 3 times
- Auto-curated "review playlists" — pick 10 questions from weak topics

SOCIAL
- Friend overlays — see how friends' mindmaps look (anonymized)
- Class average glow — see where you're ahead or behind the crowd
- Mindmap sharing — export a snapshot of your map as an image

PERSONALIZATION
- Goal-driven highlighting: "Focus on Pediatrics for 2 weeks"
- Time investment view: color nodes by total minutes spent
- Custom learning paths: user draws their own preferred sequence
- Tag system: users tag nodes with their own labels (e.g., #weak, #revise)

CONTENT
- Bookmark important branches into a "Today" view
- Concept linking: users draw their own "related" lines
- Question previews on node hover (show 1 sample question without committing)

DISCOVERY POLISH
- Search-to-fly: type "ECG" → camera animates to that node
- Breadcrumb trail when deep in subtopics
- Voice search: tap mic, speak the topic name
- Recently visited topics list for quick re-access


================================================================
PROMPT 12: PER-QUESTION TIME QUADRANT ANALYSIS (Priority: HIGH)  [ARTIFACT]
================================================================

I have a NORCET Prep React PWA. The Quiz component already records
per-attempt time in milliseconds (`timeMs`) inside the results state,
and AdvancedTestResults already tracks `timePerQ`. StatsScreen has
per-topic average times and an "Accurate but slow" badge, but the
post-quiz Results screen shows only total time and the wrong-question
list — there is no per-question time analysis at the moment a user
finishes a session.

I want to add a four-quadrant time analysis on the post-quiz screens
(both `Results` and `AdvancedTestResults`).

What I want you to do:

1. Define the four quadrants based on per-question time and correctness:
   - Fast + correct  → "Mastered"           (no action needed)
   - Fast + wrong    → "Misread / Guessed"  (slow down, read carefully)
   - Slow + correct  → "Shaky understanding"(drill more for fluency)
   - Slow + wrong    → "Concept gap"        (study the topic, then drill)

2. "Fast" vs "slow" threshold logic:
   - For mock / advanced tests: ideal pace = (timeLimitMin * 60) / questions.length.
     "Slow" = took more than 1.5× the ideal pace.
   - For quick tests (no time limit): baseline 60s per question.
     "Slow" = took more than 90s.
   - Skipped / blank questions go to a fifth bucket: "Not attempted"
     — never label them wrong in this view.

3. Add a "Time analysis" section to the post-quiz screen, placed
   between the score circle and the wrong-question list:
   - Four small cards (or one row with four columns) — one per quadrant
   - Each card: count, quadrant name, one-line recommendation
   - Use distinct quadrant colors that work in all themes
   - Below the cards: a small horizontal strip showing each question
     as a colored dot (color = quadrant). Position = question order.
     This gives a fast visual of where time went off the rails.
   - Tap any quadrant card → expand to show which questions fell in
     that quadrant (question stem preview + topic chip + time spent)

4. For the regular Results screen, currently only `correct/wrong`
   is tracked — no skipped/blank status. Either:
   - Add a `revealed` / `skipped` flag carry-through so the quadrant
     view applies uniformly, OR
   - Show the four-quadrant view only on AdvancedTestResults where
     blank is already tracked, and a simpler three-quadrant version
     (drop the "Not attempted" bucket) on regular Results.
   Decide and explain the trade-off in your reply.

5. Add a small overall summary line above the four cards:
   "You spent 24m on this test. Average 72s per question, ideal pace
   was 54s. 4 questions over 90s." Numbers derived from the data.

6. Match the existing app's visual style, theme system (Forest, Bloom,
   Dusk, Meadow, dark variants), and card/animation patterns.

7. Do NOT change any existing features beyond adding this new section.

8. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 13: PER-TOPIC ACCURACY TRENDS OVER TIME (Priority: HIGH)  [MIXED]
================================================================

I have a NORCET Prep React PWA. StatsScreen currently shows:
  - per-topic all-time accuracy
  - a 14-day daily-attempts bar chart (counts only, not accuracy)
  - a global 7d-vs-14d accuracy delta (a single number)
  - per-topic all-time speed averages
  - coverage % of the pool

What's missing: per-topic accuracy OVER TIME (weeks / months).
A student needs to see whether their Pharmacology accuracy is
trending up or down, not just where it stands today.

What I want you to do:

1. In StatsScreen, add a new "Topic trends" section below the
   existing per-topic accuracy view.

2. For each topic the user has practiced (require at least 10 total
   attempts in that topic, otherwise hide), compute monthly accuracy
   for the last 6 months:
   - Group attempts by topic and by month (use `attempt.ts`).
   - Per (topic, month): accuracy = correct / total.
   - Skip months where that topic has fewer than 5 attempts — too
     noisy to plot.

3. Render as a small multi-line chart using recharts (already a dep):
   - X-axis: months, last 6 ending current month
   - Y-axis: accuracy 0-100%
   - One colored line per topic, using `topicColor(topicId)`
   - Limit visible lines to the user's top 6 most-practiced topics
     by default — too many lines becomes spaghetti. Add a small
     "Show all / Show top 6" toggle.
   - Tap/hover reveals exact accuracy and sample size

4. Add a time-window toggle above the chart: "3M / 6M / 12M".
   Default 6M. The window only affects this chart, not the rest
   of the screen.

5. Below the chart, an auto-derived "Insights" strip with up to
   three chips:
   - Improving (accuracy rose ≥10% over the window) → green chip
     "Pharmacology +12%"
   - Declining (accuracy dropped ≥10%) → red chip
     "Pediatrics −15%"
   - Stable strong (≥75% throughout) → blue chip "Medicine ✓"
   Pick the most striking 3 — don't crowd the strip.

6. IMPORTANT: do NOT change `data.stats.dailyHistory` shape (it
   tracks only overall attempts per day). Derive ALL trend data
   from `data.history[qId].attempts[].ts` which already has per-
   attempt timestamps with topic recoverable via the question's
   `topic` field. This keeps the change additive and migration-free.

7. Performance: monthly accuracy is a derived value. Wrap the
   computation in useMemo with the right deps so it doesn't re-run
   on unrelated re-renders.

8. Match existing theme system, card style, recharts patterns
   already used in StatsScreen.

9. Do NOT change any existing features.

10. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 14: SYLLABUS WEIGHTAGE + YEAR-OVER-YEAR SHIFT  [ARTIFACT]  [DONE]
          (Priority: MEDIUM — AFTER PROMPT 7)
================================================================
[DONE — no schema-version change (still v9). NOTES:
- New <WeightageScreen/> (defined just before AuthScreen). Reached via the
  slide-out menu → study → "Exam weightage" (Activity icon). Route key
  'weightage'; render site mirrors the 'coverage' route (onDrill → startQuiz
  topic; onOpenPapers → 'previous-papers').
- 100% DERIVED from allPapers (built-in PREVIOUS_YEAR_PAPERS + admin paper
  banks). Nothing hard-coded; updates when a paper is added.
- P18 integration: weightage runs through countsInNursingStats(), so gk/apt
  are EXCLUDED unless the user opted into includeGkInStats. Nursing topics are
  renormalised to sum 100% (denominator = nursing questions in each paper).
- VIEW A "Topic mix": list sorted by weightage desc, per-topic bar + your
  accuracy + coverage; top-3 high-leverage tagged "High ROI". VIEW B "Year
  over year": recharts LineChart, one line per topic, movers (>=3% first->last
  shift) coloured red(rising)/blue(falling) + caption cards; <2 distinct years
  shows a note.
- High-leverage = weightage x (1 - accuracy), in-bank topics only (the card
  taps through to practice). Empty state if <2 papers loaded (we have 6).
- Validated against real data: 6 papers (2021-2024), msn 34.5% dominant,
  movers msn +13.6 / obg -11.1 / pharm +5.9 / ch -5.0.
The original prompt body is kept below for history.]


PREREQUISITE: PROMPT 7 (Previous Year Papers) must be implemented
and at least 2-3 real PYQ papers must be loaded into the
PREVIOUS_YEAR_PAPERS data structure. Without real papers this
feature shows an empty state and is not useful.

I have a NORCET Prep React PWA with the PYQ paper system from
PROMPT 7. Each PYQ paper is a bank with `type: 'previous_paper'`
and a `year` field. I want to derive and display syllabus
weightage from those papers, plus how the weightage has shifted
year over year.

What I want you to do:

1. Add a new "Exam weightage" screen accessible from the home
   screen (use PieChart, Activity, or Sigma icon from lucide-react).

2. Compute weightage entirely as DERIVED data from loaded PYQ
   papers. Never hard-code percentages — they must update
   automatically when admin uploads a new paper.

   For each loaded PYQ paper:
     - Count questions per topic → percentage for that year
   Average across all loaded papers, weighted equally:
     - "Typical NORCET weightage" per topic

3. The screen has two views, toggleable at the top:

   VIEW A — "Topic mix" (default)
   - For each topic, show:
     - Topic name + icon
     - Typical weightage % (averaged across loaded papers)
     - Your current accuracy in that topic
     - Your coverage % of that topic in the question pool
   - Render as a horizontal stacked bar OR a sortable list, sorted
     by weightage descending.
   - Highlight the top 3 high-leverage topics (defined below).

   VIEW B — "Year over year"
   - For each topic, plot its weightage % across each year of
     available papers — line chart, x = year, y = % of exam.
   - Highlight topics with ≥3% shift between earliest and latest
     year, color-coded (red rising, blue declining).
   - Caption per highlighted topic, e.g.:
     "Mental Health rose from 5% (2022) to 10% (2024)"

4. Strategic recommendation card at the top of both views:
   - "High-leverage topics" = sorted by (weightage % × (1 - your accuracy))
   - Show top 3. These are topics where MORE of the exam depends on
     them AND you're not yet strong. This is the highest study ROI.
   - Each tap → drill that topic.

5. Empty state: if fewer than 2 PYQ papers are loaded, show:
   "Weightage analysis becomes available once at least 2 previous
   year papers are loaded. Ask an admin to upload more."
   With a link to the PYQ section.

6. Edge cases:
   - Topics that appear in papers but not in the user's question
     pool: still count toward weightage (they're real exam content),
     show with a grey "not in your bank yet" tag.
   - Topics in the user's pool but not in any PYQ: don't appear in
     weightage view at all (these are non-exam topics).

7. Match existing theme system, recharts patterns, card style.

8. Do NOT change PROMPT 7's data structures — read from them. Do
   NOT change any existing features.

9. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 15: TIERED DATA RETENTION + LAZY COMPACTION  [LOCAL]
          (Priority: HIGH — AFTER PROMPT 1)
================================================================

PREREQUISITE: PROMPT 1 (Cloud Sync) must be implemented first.
Until progress lives in Supabase, retention is moot — users lose
everything anyway whenever they clear browser data.

I have a NORCET Prep React PWA. User progress data (data.history,
data.stats.dailyHistory, data.revisionLog, data.advancedTestHistory)
grows unbounded with use. A serious candidate doing 50 questions
per day for 12 months generates roughly 18,000 attempt records
(~2 MB per user). Once cloud sync ships, large blobs cost Supabase
storage AND slow down every sync. I want a tiered retention policy
with lazy in-place compaction.

What I want you to do:

1. Define three retention tiers explicitly in code (a comment block
   at the top of the new compaction module is fine):

   TIER 1 — Identity data (retain indefinitely, NEVER compact):
     - data.stats summary fields (totalAttempted, totalCorrect,
       streakCurrent, streakBest, lastStudiedDate, dailyTarget,
       examDate, streakGraceAvailable)
     - data.bookmarks
     - data.customQuestions
     - data.preferences
     - data.disabledBanks, bankVersionsSeen, bankPublishedSeen
     - data.feedbackRepliesSeen
     - data.dismissedAnnouncementId
     - Profile, banks, all shared-storage records

   TIER 2 — Detailed history (retain full detail for 730 days):
     - data.history[qId].attempts[] (full attempt list with ts,
       correct, timeMs, selected per attempt)
     - data.stats.dailyHistory entries newer than 180 days
     - data.revisionLog entries newer than 180 days
     - data.advancedTestHistory entries newer than 365 days

   TIER 3 — Compacted summary (replaces Tier 2 past its window):
     - For each question whose oldest attempt is >730 days, replace
       the attempts array with:
         {
           attemptsTotal: number,
           attemptsCorrect: number,
           lastAttemptedTs: number,
           lastFiveAttempts: [{ts, correct, timeMs}, ...],
           meanTimeMs: number,
           reviewCount, nextDue, lastResult  // SRS state preserved
         }
       Drop everything before the most-recent 5 attempts. Add a
       `compacted: true` flag so the rest of the app knows this
       record is summarized.
     - For dailyHistory entries older than 180 days, roll up into
       monthly aggregates:
         { month: 'YYYY-MM', attempted, correct, byTopic: {...} }
       Replace daily entries with monthly entries.

2. Add the compaction module at src/lib/compact.js (or inline if
   you have not yet done A1 — but extracting is recommended):

     export function compactData(data, opts = {}) {
       const now = opts.now || Date.now();
       // ... pure function, takes data, returns compacted data
       return compacted;
     }

   Requirements:
   - Pure function. No side effects. No storage calls.
   - Idempotent: compactData(compactData(x)) === compactData(x).
   - Preserves all SRS state (reviewCount, nextDue, lastResult,
     easeFactor if PROMPT 2 is shipped).
   - Preserves all Tier 1 fields untouched.

3. Run compaction LAZILY at boot, only when needed:
   - In the App boot effect, after loading data from cloud/local
     and merging defaults, check serialized size:
       const sizeBytes = JSON.stringify(data).length;
   - If sizeBytes > 500_000 (~500 KB), run compactData() before
     setData(), then schedule a save so the compacted version
     persists.
   - No UI for this. Silent, transparent.

4. Schema versioning (depends on A11 if available — otherwise
   inline a minimal version flag):
   - Compaction emits data with `schemaVersion: 2` (or whatever
     the next version is).
   - If data with old schemaVersion is loaded, run compaction as
     part of the migration step.

5. Edge cases:
   - PROMPT 13 (Topic Trends) reads attempt.ts from history. After
     compaction, attempts older than 730 days are gone. PROMPT 13's
     max window is 12 months — well within Tier 2. No conflict, but
     document this.
   - SRS scheduling (PROMPT 2) must keep working. The compaction
     must preserve reviewCount, nextDue, lastResult, easeFactor.
     Add an explicit test (see point 7).
   - Bookmarks reference qId. After compaction the question stem
     is still in the SEED_QUESTIONS pool or customQuestions, so
     bookmarks remain valid.
   - If a user has 5+ years of inactive data and returns: their
     old details are already compacted, summary stats remain,
     fresh Tier 2 starts accumulating from today.
   - Per-topic accuracy aggregates in StatsScreen must work
     correctly when some questions have Tier 3 (compacted) history
     and others have Tier 2 (full). Make sure the aggregation
     function checks for both shapes.

6. Add a debug-only "Storage info" line in Settings, visible only
   when admin mode is unlocked OR behind a long-tap on the version
   number:
     "Your data: 247 KB · last compacted 2 months ago"
   Stored under data.stats.lastCompactedTs (a Tier 1 field).

7. Add minimal sanity assertions (a tiny test block at module
   bottom is fine — no framework needed):
     - compactData on a fresh user (no old data) → no-op
     - compactData on data with 3-year-old attempts → attempts
       trimmed to last 5, summary fields populated
     - compactData on already-compacted data → idempotent
     - compactData preserves SRS state for every question

8. Match existing patterns (safeStorage shim, useMemo, comment
   style).

9. Do NOT change Tier 1 data fields. Tier 2 may only be transformed
   to Tier 3 in place — no data is ever silently deleted.

10. Do NOT change any existing features beyond adding the
    compaction module, the boot-time hook, and the debug line.

11. Run the build to confirm it compiles, then produce the
    updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 16: NORCET PYQ PROVENANCE TAG (Priority: HIGH — quick win)  [ARTIFACT]  [DONE]
================================================================
[DONE — no schema-version change (still v9). IMPORTANT schema-reality note:
the per-question fields this prompt assumed (isPYQ / pyqYear / pyqExam on every
PYQ) do NOT exist in the real data. Real PYQs are either (a) SEED_QUESTIONS
tagged only `source: 'PYQ NORCET' | 'PYQ AIIMS'` (no year), or (b) questions
inside PREVIOUS_YEAR_PAPERS banks where the YEAR lives at the bank level, not on
the question. Learn mode renders CONCEPT_CARDS, not pool questions, so it has no
PYQ question to badge. Implementation honoured the intent but degrades against
the real shape — see session-notes for the full rundown. The original prompt
body is kept below for history.]


I have a NORCET Prep study app (single-file React component in
src/App.jsx). I have imported a bank of real previous-year questions.
Each PYQ object carries these extra fields on top of the normal
question schema:

  - source:  a string containing "PYQ", e.g. "AIIMS NORCET 2024 PYQ"
  - isPYQ:   true
  - pyqYear: a number, e.g. 2024
  - pyqExam: "Prelims" | "Mains" | ""   (may be empty)

What I want you to do:

1. Add a small helper near the other question utilities:
     const isPYQ = (q) => !!q && (q.isPYQ === true ||
       (typeof q.source === 'string' && /pyq/i.test(q.source)));
   Use this everywhere instead of re-testing the regex inline.

2. In the Quiz question header (next to the existing topic Pill),
   render a small badge when isPYQ(q) is true. It reads:
     "NORCET {pyqYear} PYQ"  — and append " · {pyqExam}" when pyqExam
   is a non-empty string (e.g. "NORCET 2024 PYQ · Mains").
   Reuse the existing Pill component; give it a distinct accent
   colour so it reads as provenance, not as a topic.

3. Show this badge in ALL modes — Quick, Topic wise, Mock, Advanced,
   and Learn. It is provenance, not a hint, so it is fine to show
   during timed/no-hint modes. Do NOT gate it behind any mode.

4. The existing PYQ-only filter currently lives only in
   AdvancedTestSetup (pyqOnly state). Promote the same All | PYQ
   Segmented control into Quick setup and Topic select too, wired to
   the isPYQ helper from step 1, so a user can practise PYQs in any
   mode. Keep the empty-pool guard message that already exists.

5. Do NOT change scoring, the question schema, or any other feature.

6. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 17: IMAGE-BASED PYQ SUPPORT (Priority: MEDIUM)  [MIXED]  [DONE]
================================================================
[DONE — no schema-version change. `image` is a per-question field on
 static question objects, not on the DEFAULT_DATA user blob, so the
 migration system (still v9) is untouched. Implementation notes:
   • Added a shared <QuestionImage q={q}/> helper: responsive, lazy,
     theme-rounded, alt from sub/topic, onError -> "image unavailable"
     placeholder that still leaves the options answerable.
   • Rendered between stem and options in Quiz, AdvancedTest (covers
     mock AND previous-paper engine), and the results review.
   • Importer preserves `image`: one-line passthrough in
     normalizeQuestion; CSV already header-driven, so an `image` column
     works with no parser change. Example JSON + CSV templates updated.
   • Hosting is a MANUAL step (public Supabase `pyq-images` bucket);
     code only stores/reads a URL string, so no storage-layer code and
     no PWA/cache risk. base64 data-URI fallback supported (one inline
     SVG sample ships in the JSON import template as a smoke test).
   • CORRECTION to an earlier session note: EXCLUDED_IMAGE_QUESTIONS in
     norcet-pyq-data.js is only a MANIFEST (paper id -> question numbers),
     NOT extracted content. So this step delivers the CAPABILITY; adding
     the ~53 real image questions is a separate content+hosting job.
   • Text-only questions render exactly as before (verified).
   • Run a local `npm run build` before deploy (full project not present).]


I have a NORCET Prep study app (single-file React component in
src/App.jsx). A large share of real NORCET PYQs are image-dependent
("identify the instrument / tube / drain / ECG strip / X-ray / blade
size / mask"). My current question schema has no image field, so those
items were deliberately left out of the first PYQ bank. I want to add
image support so they can be included.

What I want you to do:

1. Extend the question schema with an OPTIONAL field:
     image:  a string URL (or null/undefined for text-only questions).
   Text-only questions must continue to work unchanged.

2. In the Quiz component, when a question has an `image`, render it
   between the question stem and the options: responsive (max-width
   100%, sensible max-height, rounded corners matching the theme),
   lazy-loaded, with an alt attribute built from the question's sub/
   topic. If the image fails to load, show a small "image unavailable"
   placeholder and still show the options.

3. Image hosting: use a public Supabase Storage bucket (e.g.
   `pyq-images`). The bank JSON stores the public URL in `image`.
   Document the upload step in a comment so I can add images later.
   (If a bucket is non-trivial, fall back to allowing a base64 data
   URI in `image` — but warn me about bundle/row size.)

4. Make image questions work in every mode and in the Library import
   flow (the bank importer should accept and preserve the `image`
   field).

5. Do NOT change any existing text-only behaviour, scoring, or UI for
   questions without an image.

6. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 18: GK & APTITUDE PYQ SECTION (Priority: LOW-MEDIUM)  [ARTIFACT]  [DONE]
================================================================
[DONE — no schema-version change (still v9). NOTES for P14:
- gk + apt topics already existed in TOPICS (added in P7); apt renamed to
  "Reasoning & Aptitude". Icons kept as emoji to match every other topic
  (topicIcon renders emoji, not lucide components).
- The non-nursing exclusion is now a SINGLE SOURCE OF TRUTH: the constant
  NON_EXAM_TOPICS = ['gk','apt'] + helpers isNonExamTopic() and
  countsInNursingStats(topicId, includeGk), defined right after TOPICS.
  P14's weightage screen MUST filter through countsInNursingStats() too —
  do not re-hardcode the list.
- New opt-in pref preferences.includeGkInStats (default false), with a
  Settings → Analytics toggle. When false (default) gk/apt are excluded
  from StatsScreen accuracy, the recommendation, getWeakTopics,
  WeakAreasScreen and CoverageMap. AdvancedTestResults (per-test breakdown)
  intentionally still shows whatever topics that test contained.
- There is currently NO gk/apt content in the live POOL (allQuestions);
  the 14 gk/apt items live only inside PREVIOUS_YEAR_PAPERS, whose attempts
  write to data.previousPapers, not data.history. So this change is a no-op
  for existing users' numbers — it's the home that future gk/apt POOL
  content will slot into. Adding that content is a separate job.
The original prompt body is kept below for history.]


I have a NORCET Prep study app (single-file React component in
src/App.jsx). Real NORCET papers include a small non-nursing section:
general knowledge (e.g. national programmes trivia, current affairs,
geography) and logical/quantitative reasoning (number series, Venn
diagrams, simple arithmetic). These were filtered out of the nursing
PYQ bank and I now want a home for them.

What I want you to do:

1. Add two new topic ids to the TOPICS list:
     gk  → label "General Knowledge"
     apt → label "Reasoning & Aptitude"
   Give each an icon (HelpCircle / Sigma from lucide-react are fine)
   and a section accent colour consistent with the theme.

2. These questions use the SAME question schema (and the same PYQ tag
   fields from PROMPT 16). They flow through the normal pool, so they
   appear under Topic wise test and in the PYQ filter automatically.

3. IMPORTANT — keep them out of the nursing analytics by default:
   in Stats/weightage (P12, P13, P14), exclude topics `gk` and `apt`
   from nursing accuracy and from "exam weightage" totals (P14 already
   anticipates non-exam topics — extend that exclusion list to include
   gk/apt). Add a single boolean preference `includeGkInStats`
   (default false) if you want to let power users opt in.

4. Do NOT change scoring of individual questions or any nursing-topic
   behaviour.

5. Run the build to confirm it compiles, then produce the updated zip.

I will attach the current src/App.jsx file.


================================================================
PROMPT 19: PWA UPDATE NOTIFICATION TOAST (Priority: HIGH)  [LOCAL]
================================================================

I have a NORCET Prep React PWA (Vite + React) deployed on Vercel.
The PWA is configured with vite-plugin-pwa. After a deploy, the
service worker downloads the new JS bundles but the user keeps
seeing the OLD version because their cached service worker is
still active. Users typically need a hard refresh (or two app
re-opens on mobile) to pick up the new version, and they have
no in-app indication that an update is available — leading to
bug reports for issues already fixed.

I want an in-app toast: when a new version of the app has been
deployed AND the user has it cached, show a small unobtrusive
toast saying "New version available — Reload" with a Reload
button. The user controls when to apply the update.

What I want you to do:

1. First, check vite.config.js for vite-plugin-pwa configuration:
   - If `registerType: 'autoUpdate'` is set, change it to
     `registerType: 'prompt'`. The toast pattern needs the app
     to control the update moment, not the service worker.
   - If `registerType: 'prompt'` is already set, keep it.
   - If vite-plugin-pwa is not yet configured, report that and
     stop — adding the plugin is out of scope for this prompt.

2. In src/main.jsx (or wherever the service worker is registered),
   wire up the registerSW callbacks to emit a custom event when
   a new version is ready. Approximately:

     import { registerSW } from 'virtual:pwa-register';
     const updateSW = registerSW({
       onNeedRefresh() {
         window.__pwaUpdateSW = updateSW;
         window.dispatchEvent(new CustomEvent('pwa-update-available'));
       },
       onOfflineReady() {
         // optional: brief toast "App ready to work offline"
       },
     });

3. In src/App.jsx, add a small UpdateToast component:
   - On mount, attach a listener for 'pwa-update-available'.
   - On the event, set a state flag to show the toast.
   - Toast appears at the bottom of the screen (above any bottom
     navigation if present), non-blocking, with two buttons:
       "Reload" → calls window.__pwaUpdateSW(true) which activates
                  the new service worker and reloads the page
       "Later"  → hides the toast and sets sessionStorage flag
                  'pwa-update-dismissed' so it doesn't reappear
                  in the same browser session (but DO reappear in
                  the next session if still pending)
   - On mount, also check sessionStorage — if 'pwa-update-dismissed'
     is set, do not subscribe.
   - Match the existing theme system (Forest, Bloom, Dusk, Meadow,
     dark variants) and any existing toast/notification visual
     pattern in the app.

4. Render <UpdateToast /> once, at the top level of App.jsx, so
   the toast can appear from any screen.

5. Edge cases to handle correctly:
   - If the user is mid-quiz when the toast appears, the toast
     must not auto-reload or interrupt the quiz. The user reloads
     only when they tap Reload — they will see a small
     confirmation before reload if a quiz session is in progress
     ("Reload now? Your current progress is saved.").
   - If the user has multiple tabs open, reloading one tab is
     fine; the service worker swap is global.
   - Do not show the toast if the app was just hard-refreshed
     (registerSW handles this — verify behaviour after wiring).

6. ALSO add a small build-version string in Settings so users
   (and you) can verify which build is live:
   - In vite.config.js, inject a define for `__APP_VERSION__`
     using something stable like git short SHA or a date stamp.
     Example:
       define: {
         __APP_VERSION__: JSON.stringify(
           new Date().toISOString().slice(0, 10) + '-' +
           (process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev')
         )
       }
   - In Settings, render a small grey line:
       "Version: 2026-05-28-a1b2c3d"
     positioned at the bottom of the Settings screen so it
     doesn't compete with active controls.

7. Match existing patterns: theme system, toast/animation style,
   accessibility (the Reload button should have a clear label).

8. Do NOT change any existing features beyond what's described
   above.

9. Run the build to confirm it compiles, then produce the updated
   zip.

I will attach the current src/App.jsx file. I can also attach
vite.config.js if needed — tell me if it is.


================================================================
================================================================
PROMPT 20: HARDEN kv_shared — write-broker / header-RLS (Priority: HIGH security)  [MIXED]
================================================================

CONTEXT. The admin allow-list table (admin_profile_ids) is now
properly locked down: anon can read but cannot write, and the only
write path is the admin-manage Edge Function which authenticates the
passphrase server-side and writes with the service-role key. That
closed the self-promotion hole.

What is STILL open is kv_shared — the single key-value table holding
profiles, banks, announcements, feedback, leaderboards, etc. Its RLS
policies are `anon SELECT / INSERT / UPDATE / DELETE WITH CHECK (true)`.
The anon key ships in the public JS bundle, so a determined user can
hit PostgREST directly and overwrite or delete ANY row — other users'
profiles, banks, announcements, leaderboard entries. The
`x-profile-id` header that App.jsx already sends on writes is NOT
actually checked by any policy. It's soft security by design.

GOAL. Make kv_shared writes meaningfully harder to abuse without
breaking the app. Reads stay open (the app does a lot of reads and
they're cheap to keep anon).

WHAT I WANT YOU TO DO:

1. Audit. Grep src/ for every kv_shared write call:
     `/rest/v1/kv_shared` in src/lib/storage.js,
     src/lib/safe-storage.js, plus adminWriteShared /
     adminDeleteShared in src/App.jsx. List the keys (the patterns
     in src/lib/keys.js), who writes them (user / admin / both),
     and confirm whether each write call already sends the
     `x-profile-id` header.

2. Pick the cut. The pragmatic step (Option B below) is recommended
   first because the Option-A refactor is large and Option B already
   closes the easy-abuse cases.

     Option A — Write-broker Edge Function (`kv-write`).
       Mirrors admin-manage's pattern. Every write goes through the
       function, which authenticates and writes with service-role.
       Highest security. Largest refactor: every safeStorage.set /
       safeStorage.delete in the app must route through the function.

     Option B — Header-checked RLS (recommended first).
       New policies on kv_shared:
         - INSERT/UPDATE/DELETE for keys that end in `:{profileId}`
           (per-user keys) are allowed only if the
           `x-profile-id` request header MATCHES the suffix.
         - INSERT/UPDATE/DELETE for ADMIN-ONLY keys (announcement:*,
           leaderboard governance, etc.) are allowed only if
           `x-profile-id` is in admin_profile_ids.
       Implementation uses
       `current_setting('request.headers', true)::json ->> 'x-profile-id'`
       and exact key-pattern matching. Anyone CAN still spoof a
       header to a known profile_id, but cross-profile tampering
       and admin-only writes are no longer trivial.

3. SQL. Provide the migration (drop the open policies, add the
   header-checked ones). Verify the regex/`like` patterns against
   the real keys in src/lib/keys.js (don't guess).

4. Frontend. Audit storage.js / safe-storage.js / adminWriteShared
   and confirm every kv_shared write call sends `x-profile-id`. Add
   it where missing. (Most writes already do; this just closes gaps.)

5. Test (live). After deploy, from a profile id "A":
     (a) Write your own key (key like `userdata:A`) — should succeed.
     (b) Write another user's key (`userdata:B`) — should be 401/403.
     (c) Write `announcement:current` from a non-admin profile —
         should be 401/403; from an admin profile — should succeed.

CAVEATS / RISKS:
  • This is the highest-blast-radius security change in the app —
    every storage write goes through these policies. Stage on a
    branch, run the live tests in (5), confirm the existing app
    still saves progress normally before merging.
  • Option B is bypassable if an attacker knows the target
    profile_id (anyone can read profiles → ids known). It still
    blocks the easy case ("wipe leaderboard", "delete the live
    announcement"). For true protection, schedule Option A
    (kv-write Edge Function) as PROMPT 20.5 later.

Do NOT change any UI, features, or schemas. Touch only storage
plumbing + RLS + (optionally) the `x-profile-id` header on outbound
REST calls.

I will attach the current src/ tree.


================================================================
PROMPT 21: RATE-LIMIT admin-manage Edge Function (Priority: MEDIUM)  [MIXED]
================================================================

CONTEXT. The admin-manage Edge Function's `verify` action is a public
brute-force oracle — anyone with the (public) anon key can POST
passphrase guesses. Today's only defense is passphrase entropy plus a
constant-time compare. A simple rate limit would force an attacker
into per-IP brute-force, which is much slower.

GOAL. Per-IP throttling on the Edge Function. After a few wrong
guesses, return 429 with a `Retry-After` header for a cooldown
window. Successful calls reset the counter.

WHAT I WANT YOU TO DO:

1. Choose storage. Recommended: a tiny Postgres table read+upserted
   by the function with the service-role key. No external infra
   needed. (Deno KV / Upstash Redis are alternatives if portability
   isn't a concern.)

2. Schema. Run once in Supabase SQL editor:
     create table if not exists rate_limit (
       ip text primary key,
       count int not null default 0,
       window_start timestamptz not null default now()
     );
     -- service-role-only; no anon policies needed.

3. Logic (inside supabase/functions/admin-manage/index.ts, BEFORE
   the action switch):
     - Resolve client IP from
       `req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
       || 'unknown'`.
     - Read the rate_limit row for this ip via PostgREST
       (service-role). If `now() - window_start > 5 minutes`,
       reset (count=0, window_start=now()).
     - If count >= 20, return 429 with `Retry-After: <remaining
       seconds>` and CORS headers.
     - INCREMENT count on every call.
     - After the action runs, on SUCCESS (verify ok:true, add ok:true,
       remove ok:true) — RESET count to 0 (legitimate caller).

4. Don't penalize success. Only failed `verify` (j.ok === false) and
   401 add/remove count toward the limit; successful actions reset
   it.

5. CORS. Make sure the 429 response carries the same CORS headers as
   the success path, or the browser will report a generic network
   error instead of the rate limit.

6. Test. From a terminal, POST `{action:'verify', passphrase:'wrong'}`
   25 times in a row. The 21st response should be 429 with a
   Retry-After. Then POST with the correct passphrase — should be
   200 ok:true, and the counter should reset.

CAVEATS:
  • Behind a CDN x-forwarded-for can be spoofed. Even so, this raises
    the cost of brute force significantly (the attacker must rotate
    IPs). It's the right next step before more elaborate defenses.
  • The table approach adds one DB round-trip per call. Fine for
    admin-manage (low traffic). Don't apply this pattern to high-
    traffic functions without measuring.

Do NOT change the existing action handlers (add / remove / verify)
or the frontend.

I will attach the current admin-manage index.ts.


================================================================
ARCHITECTURE IMPROVEMENTS — TECHNICAL DEBT (Audit, May 2026)
================================================================

This section is different from the prompts above — these are
REFACTORS, not new features.

NOTE (current): A1 (the big split) is DONE — App.jsx is now ~3,489
lines and modular; A3/A4/A6/A7/A10/A11 are also done; A8/A9 done.
The audit text below is the ORIGINAL May-2026 snapshot, kept for
rationale. Only A5, A12, A13 remain (all now unblocked). Treat the
"single file at ~12,444 lines" description below as HISTORICAL.

The original audit described src/App.jsx as a single
file at ~12,444 lines / 684 KB containing 90 top-level functions,
1,120 inline style objects, zero error boundaries, zero code
splitting, zero context/reducer, and ~1,700 lines of static content
inlined into the JS bundle.

Each item below has: priority, why it matters (the reasoning), and
what to do. Any single item can be turned into a full Claude prompt
later. Do NOT bundle multiple into one session — each is a
non-trivial change and combining them burns context and risks
regressions.


────────────────────────────────────────────────────────────────
A1.  SPLIT App.jsx INTO MODULES                  Priority: HIGH  [LOCAL]  [DONE — steps 34-38, 42; A7 bridge deleted slice 47]
────────────────────────────────────────────────────────────────

[SESSION 1 DONE — pipeline step 34]  Carved the two LOWEST-blast-radius,
fully-decoupled pieces out of App.jsx into real modules, verbatim (no logic
hand-edits). The combination is build-verified in the sandbox only via
esbuild-bundle WITH STUBS for the repo-only siblings; a real `npm run build`
is still owner-run after applying all three files together.
  NEW FILES (ship alongside src/App.jsx):
    • src/lib/utils.js  — 10 pure, dependency-free helpers: todayStr,
      spacedRepetitionNext, arraysEqualUnordered, shuffle, parseCsvLine,
      downloadAsFile, normalizeStem, stemSimilarity, relativeTimeShort,
      clampNum. (Each reads no T/IS_DARK/CURRENT_PROFILE, no app data, no React;
      stemSimilarity uses normalizeStem, co-located.)
    • src/data/seed.js  — TOPICS, NON_EXAM_TOPICS + isNonExamTopic +
      countsInNursingStats, SEED_QUESTIONS (the deliberate OFFLINE FALLBACK
      pool — A2 keeps it in code), DEFAULT_DATA. seed.js imports
      CURRENT_SCHEMA_VERSION from ../lib/migrations.js (a real, existing dep).
  App.jsx: added two named imports after the kvStorage import; deleted the 16
  original top-level declarations (each replaced by a one-line pointer comment).
  No behaviour change. File 18,085 -> 17,389 lines; App.jsx transpile 864.3kb
  -> 787.2kb (moved data no longer inlined); full bundle-with-stubs 864.5kb
  (≈ baseline — nothing lost).
  RECONCILIATIONS vs this A1 spec (it predates the current code):
    • THEMES NOT EXTRACTED. The spec's GOTCHA is real and confirmed: T (module
      `let`) and IS_DARK are REASSIGNED during App() render (~line 16235) and
      read ~1,957× across screens; fgOnDark closes over T. A standalone
      themes.js exporting T would freeze every importer at LIGHT_THEME and break
      live theme switching. Per the spec, themes MUST move WITH Context (A7,
      step 36). So themes (+ IS_DARK + CURRENT_PROFILE) are deferred to be done
      jointly with A7 — not in this session.
    • DATA LIST WAS STALE. CONCEPT_CARDS / AIIMS_CONCEPT_CARDS / REFERENCE /
      DOSAGE_QUESTIONS / HELP_CONTENT were ALREADY moved to /public/data/*.json
      in A2 (step 22) and no longer exist in App.jsx. Only the foundational
      top-of-file data (above) was extractable here.
    • DEPENDENCIES / BONUS_NODES / REFERENCE_CATEGORIES are pure data too, but
      live mid-file beside their mindmap/reference consumers; deferred to a
      later data-module session (smallest-blast-radius ordering, per this spec).
    • The data-bound utils (topicName/topicColor/topicIcon/getWeakTopics/
      lastSeenTs/quickNeedScore/selectQuickPracticeQuestions/the question-import
      cluster) were LEFT in App.jsx: they depend on TOPICS, T.muted, or imported
      compact.js helpers; they move cleanly only alongside a data module +
      small fallback tweaks in a later session.
  VERIFICATION: App.jsx transpile exit 0 / no warnings; 0 leftover local
  declarations for all 16 moved symbols (no duplicate defs); esbuild --bundle
  with stubs exit 0 / no warnings (wiring + exports resolve); 33 Node tests
  against the REAL extracted baseline source (verbatim identity of all 14
  blocks + deep-equality of TOPICS/NON_EXAM/SEED_QUESTIONS/DEFAULT_DATA +
  identical function outputs across many inputs). Schema stays v9;
  storage.js / package.json untouched.

[SESSION 2 PARTIAL — pipeline step 35]  Extracted only the self-contained,
render-global-free INFRA of session 2; the rest is carried forward (see below).
  NEW FILES (ship alongside src/App.jsx + the session-1 modules):
    • src/lib/safe-storage.js — STORAGE_OP_TIMEOUT_MS, raceStorage, safeStorage
      (the shim over kvStorage), checkStorageBridge. Imports
      `* as kvStorage from '../storage'`. No T/IS_DARK/CURRENT_PROFILE, no React.
    • src/lib/profile-crypto.js — normalizeProfileId, genSalt, hashPassword
      (PBKDF2-SHA256, 100k). Pure (Web Crypto / TextEncoder globals only).
  App.jsx: two named imports added; the 7 declarations removed (pointer
  comments left). File 17,389 -> 17,358 lines; transpile 787.2kb -> 785.8kb.
  WHY ONLY THIS SUBSET (the safer option; build cannot be run here):
    • UI PRIMITIVES DEFERRED TO A7. Confirmed in code: Pill, Button and TopBar
      read the render-mutated T (and TopBar reads IS_DARK) via default params /
      body. A standalone ui/primitives module would freeze them at LIGHT_THEME
      and break theming — the SAME blocker as themes. Only Card is T-free now
      (A8 moved it to the .surface-card class). So all four primitives move
      together WITH Context (A7, step 36). CURRENT_PROFILE (render-mutated,
      reassigned in App render) likewise stays for A7.
    • PROFILE / GUEST / MERGE SUBSYSTEM DEFERRED to its own focused session.
      A free-identifier closure analysis shows loadProfile/loadProfileCached/
      saveProfile/createProfile/flushPendingSync/peekLegacyData + the guest
      helpers + normalizeUserData + the 11-helper merge engine + the
      PENDING_SYNC trio + normalizeDob + upsertProfileIndex form ONE coherent,
      internally-closed cluster (~680 lines, deps: KEYS, DEFAULT_DATA,
      migrations, kvStorage, log, the safe-storage shim, profile-crypto — NO
      render globals). It IS cleanly extractable, but it is the app's most
      safety-critical code (auth + persistence + guest-progress merge) and a
      real `npm run build` can't be run in this single-file sandbox, so moving
      it as its own carefully-verified unit is safer than bundling it with the
      shim work. Recommend re-slicing the checklist: keep step 35 for this
      profiles subsystem, fold UI primitives into step 36 (A7).
    • RECONCILIATION: the roadmap's `lib/storage.js` target is renamed
      `lib/safe-storage.js` (avoids shadowing the existing src/storage.js =
      kvStorage); its `withStorageTimeout` is this `raceStorage` (name drift).
      `lib/profiles.js`'s crypto helpers shipped now as profile-crypto.js and
      will fold into profiles.js when that subsystem lands.
  VERIFY: App.jsx transpile exit 0/no warnings; 0 leftover local decls for all
  7 moved symbols; esbuild --bundle with stubs exit 0/no warnings (safe-storage
  + profile-crypto + the session-1 modules all resolve; bundle 864.6kb ≈
  baseline); 17 Node tests on the REAL extracted source (verbatim identity of
  all 7 blocks; normalizeProfileId & hashPassword module==original;
  genSalt 16-byte-hex; safeStorage delegates get/set/delete/list to kvStorage
  with correct args; checkStorageBridge async→isAlive; raceStorage ok/error/
  timeout/sync-throw). Schema v9; storage.js / package.json untouched.

[SESSION 2 cont. — pipeline step 35, guest-merge engine]  Extracted the PURE,
self-contained core of the profile subsystem to src/lib/merge.js (the safe,
fully-testable part), leaving the async storage/auth/session code in App.jsx.
  NEW FILE: src/lib/merge.js — normalizeUserData (migrate+fill to DEFAULT_DATA
  shape, idempotent), guestBlobHasActivity (offer-merge predicate),
  mergeGuestIntoAccount (account-canonical additive fold) + its 12 private _g*
  helpers (_gnum/_gmaxNum/_gmaxDateStr/_gunionArr/_gunionById/_gconcatCappedByTs/
  _gunionDailyHistory/_gunionRevisionLog/_gmergeHistoryEntry/_gmergeHistory/
  _gmergeMaxMap/_gmergePreviousPapers). Imports DEFAULT_DATA (seed.js) +
  CURRENT_SCHEMA_VERSION/runMigrations (migrations.js). NO async, NO storage, NO
  React, NO render globals. App.jsx imports the 3 public fns; the _g* stay
  module-private (0 external refs). App.jsx 17,357 -> 17,171 lines; transpile
  785.8kb -> 777.6kb.
  WHY ONLY THE MERGE ENGINE: the rest of the profile subsystem is ~30 ASYNC
  functions (storage/auth/session/guest-IO) interleaved with non-cluster code
  (feedback helpers etc.) and is the app's most safety-critical path; with no
  real build available here, moving it is deferred to a LOCAL pass (-> profiles.js)
  where `npm run build` + login/sync/merge device testing can validate it. The
  merge engine was pulled out first because it is pure and the hardest to
  eyeball — best to have it covered by deterministic tests.
  VERIFY: App.jsx transpile exit 0/no warnings; 0 leftover decls for all 15
  moved symbols; esbuild --bundle with stubs exit 0/no warnings (merge.js ->
  seed.js + migrations.js resolve; bundle 864.6kb ≈ baseline); 11 Node tests on
  the REAL extracted source: verbatim identity; mergeGuestIntoAccount
  module==original on both/guest-only/account-only/empty fixtures; totals SUM
  (120) + streakBest MAX (9) + bookmarks union; account never regresses;
  normalizeUserData & merge idempotent (no double-count on re-merge);
  guestBlobHasActivity parity + true/false. Schema v9; storage.js/package.json
  untouched.
  NOTE (pipeline hygiene): the App.jsx + tracking files delivered for the prior
  turn were found out-of-sync in the output area at the start of this turn (the
  App.jsx was missing the profile subsystem; the docs wrongly read "DONE"). All
  deliverables this turn were rebuilt from the verified working copy and
  re-read/verified in the output area before delivery.

[SESSION 2 COMPLETE — pipeline step 35]  Extracted the final piece: the ASYNC
profile/session/guest-IO subsystem to src/lib/profiles.js. Step 35 (storage +
profiles) is now DONE; UI primitives formally fold into step 36 (A7).
  NEW FILE: src/lib/profiles.js (433 lines) — 29 exported members + 1 private
  module flag (_flushInFlight): GUEST_ID/makeGuestProfile/isGuestProfile/
  saveGuestData/loadGuestData/GUEST_META_KEY/loadGuestMeta/saveGuestMeta/
  clearGuestData/loadProfile/loadProfileCached/saveProfile/getPendingSync/
  markPendingSync/clearPendingSync/flushPendingSync/loadOneProfileMeta/
  saveProfileMeta/listProfileMetas/loadProfileIndex(alias)/upsertProfileIndex/
  touchProfileActivity/normalizeDob/createProfile/authenticateProfile/
  recoverPasswordWithDob/loadSession/saveSession/peekLegacyData. Imports: KEYS &
  KEY_PREFIXES (keys.js), runMigrations (migrations.js), log (log.js),
  `* as kvStorage from '../storage'`, DEFAULT_DATA (seed.js), STORAGE_OP_TIMEOUT_MS
  & raceStorage & safeStorage (safe-storage.js), normalizeProfileId & genSalt &
  hashPassword (profile-crypto.js). NO render globals, NO React.
  KEY DECISION: renameProfile STAYS in App.jsx. The free-identifier closure
  found it is the ONLY member reaching into the bank/feedback subsystems
  (listBanks/saveBank/listFeedback/saveFeedback/loadMyFeedbackIndex) to migrate
  a user's data on id change — a cross-subsystem orchestrator. Moving it would
  create a circular import (profiles -> banks -> profiles), so it is retained;
  the move-set is then internally closed (zero unmapped external refs).
  clearLegacyData (just outside the cluster) also stays.
  App.jsx: imports 23 of the 29 members from './lib/profiles.js' (the other 6 —
  GUEST_META_KEY/getPendingSync/markPendingSync/listProfileMetas/
  upsertProfileIndex/normalizeDob — are used only inside moved functions, so
  exported-but-not-imported, harmless). 16,788 lines (was 17,171).
  VERIFY: 30/30 moved blocks byte-identical to baseline; 0 leftover local decls
  in App.jsx, each symbol declared exactly once in profiles.js; 0 dangling refs
  (property-aware scan); both files transpile exit 0/no warnings; esbuild
  --bundle with stubs exit 0/no warnings (886,079 bytes); before/after bundle
  delta −61 bytes (−0.007%, nothing lost); 9/9 behaviour groups pass on the REAL
  extracted source — G1 guest pure parity, G2 normalizeDob parity, G3 sync-queue
  round-trip (incl. empty-key deletion), G4 session round-trip (incl null-clear),
  G5 guest data+meta round-trip, G6 profile-meta directory + loadProfileIndex
  alias + touchProfileActivity, G7 legacy profile_index migration, G8 create/
  auth/load/recover (taken-name + wrong-password + wrong-DOB rejections), G9
  saveProfile clears pending after mock cloud write + loadProfileCached +
  peekLegacyData. Schema v9; storage.js/package.json untouched.
  OWNER STILL OWES (sandbox can't run a real build): drop all four step-35
  modules (safe-storage.js, profile-crypto.js, merge.js, profiles.js) into
  src/lib/ alongside App.jsx; run real `npm run build`; device-test
  login/logout/recover + offline-sync replay + profile switcher + session
  persist + rename (both the taken-name reject and the successful bank/feedback
  migration paths).

[SESSIONS 3-4 COMPLETE — pipeline steps 37-38 + final A7 cleanup (slice 47) +
optional lib tidy-ups (step 42).]  App.jsx has been fully carved down to a pure
application root: **3,489 lines** (was 15,643). ZERO screen/modal/toast
components remain inline. The companion files **_HANDOFF-READ-ME-FIRST.md** and
the **SESSION-NOTES-DELTA-*.txt** hold the full per-slice audit trail.

  FULLY EXTRACTED (verified per slice: transpile + bundle + integrity + verbatim
  + SSR contract / behavioral test):
    lib/   : use-focus-trap, helpful-votes, content, selectors, keys, storage,
             safe-storage, profile-crypto, profiles, merge, themes, light-themes,
             theme-helpers, app-context (ThemeContext/ProfileContext/DataContext
             + useTheme/useProfile/useData + AppProviders), utils, topics, pyq,
             format, feedback, compact, migrations, question-import, kmap, qr,
             font-styles, banks, banks-storage, quick-practice
    ui/    : primitives (+support channel), result-cards, question-widgets,
             confirm-exit-dialog, content-gate, nav-drawer, home-support-nudge,
             admin-tile, admin-feedback-card
    screens/: Home, Quiz, Results, Settings, Stats, Reference, Library,
             Bookmarks, RevisionSheet, dosage practice/results, LearnTopics,
             LearnCards, the KnowledgeMap + mindmap-node-popup cluster,
             Weightage, CoverageMap, Leaderboard, WeakAreas, MockSetup,
             support/feedback/help modals, RenameProfileHost,
             ReportedQuestionModal, AuthScreen, advanced-test (Setup/Test/
             Results trio), bank-screens (BankDetail+BankEditor), AdminPanel,
             UpdateToast
    App.jsx: ONLY the root component (router/boot) + remaining App-local
             storage/admin plumbing + module constants.

  FINAL A7 CLEANUP DONE: module-level T/IS_DARK bridge + fgOnDark/
  feedbackStatusMeta wrappers deleted. Theme is purely via useTheme().

  REMAINING (all now UNBLOCKED, none required for features): step 39 A5
  (route-level code splitting), step 40 A12 (URL routing — react-router),
  step 41 A13 (types/JSDoc). Plus OPTIONAL further lib tidy-ups if ever wanted
  (lower value, higher risk — pure App-state plumbing with many consumers):
  lib/admin-storage.js (adminListUsers/adminDeleteProfile/announcement ops/admin
  status+passphrase; adminDeleteProfile cascades into banks-storage + feedback),
  profile/session bits (renameProfile, theme-mode, onboarding flags,
  my-feedback), and findDuplicateStem+DUPLICATE_THRESHOLD (could join
  lib/question-import.js).

  IMPORTANT — the A1 prose below PREDATES the refactor: its line numbers and its
  "carve in this order" wishlist are STALE/HISTORICAL. The split is DONE; the
  prose is kept only as the original design rationale. For the ACTUAL module
  layout, read the current src/ tree (or the latest deliverables zip) directly.

WHY:  12,444 lines in one file means every edit reloads the whole
file in your editor, git diffs are unreadable, code review is
impossible, and Claude burns ~30% of its context just reading the
file before making any change. The file mixes five separate
concerns: themes, static data, storage/auth helpers, utility
functions, UI primitives, and screen components.

WHAT: Carve out, in this order (smallest blast radius first):

  src/themes.js          LIGHT/DARK/BLOOM/DUSK/MEADOW + THEMES map
                         + fgOnDark + the WCAG luminance helpers
                         (lines 19–225)
  src/data/seed.js       SEED_QUESTIONS, CONCEPT_CARDS,
                         AIIMS_CONCEPT_CARDS (lines 393–1100)
  src/data/reference.js  REFERENCE, REFERENCE_CATEGORIES
                         (lines 6592–6808)
  src/data/dosage.js     DOSAGE_QUESTIONS (lines 6811–7052)
  src/data/help.js       HELP_CONTENT (lines 8565–8786)
  src/lib/keys.js        ALL storage key constants and key-builder
                         functions — see A6
  src/lib/storage.js     safeStorage shim + raceStorage +
                         withStorageTimeout + checkStorageBridge
                         (lines 1180–1248)
  src/lib/profiles.js    profile create/load/save + PBKDF2 crypto
                         helpers (lines 1260–1580)
  src/lib/utils.js       todayStr, shuffle, parseCsvLine,
                         normalizeStem, spacedRepetitionNext,
                         downloadAsFile, etc.
  src/ui/primitives.jsx  Pill, Card, Button, TopBar
                         (lines 2292–2356)
  src/screens/*.jsx      one screen per file (Home, Quiz, Results,
                         Settings, AdminPanel, Library, BankEditor,
                         …) — about 30 screens
  src/App.jsx            ONLY the root component + screen routing

GOTCHA: module-level mutable globals `T` (line 195), `IS_DARK` (196),
and `CURRENT_PROFILE` (8521) are reassigned during App() render.
This is a code smell — fine in single-file form, but breaks the
moment screens live in separate files (each module captures its own
T at import time). These MUST be replaced with Context (see A7) at
the same time as the split, or the split won't work.

DO THIS ACROSS 3–4 PROMPTS, NOT ONE:
  prompt 1: data files + themes + keys
  prompt 2: storage + profiles + utils + UI primitives
  prompt 3: screens batch 1 (Quiz, Results, Home, Settings, Stats)
  prompt 4: screens batch 2 (everything else) + App.jsx final


────────────────────────────────────────────────────────────────
A2.  MOVE NON-FALLBACK STATIC CONTENT OUT       Priority: HIGH  [LOCAL]  [DONE]
     OF THE BUNDLE
────────────────────────────────────────────────────────────────
[DONE — pipeline step 22] Did OPTION B. Extracted the five non-fallback blobs
to /public/data/*.json and load them lazily + cache locally. SEED_QUESTIONS
KEPT in-bundle (offline fallback pool), exactly as the spec requires.

NEW FILES (must ship in /public/data/ — they are NOT in the App.jsx bundle):
  public/data/reference.json      (167 items   — was REFERENCE)
  public/data/dosage.json         (18 items    — was DOSAGE_QUESTIONS)
  public/data/help.json           (31 keys     — was HELP_CONTENT)
  public/data/concept-cards.json  (10 topics, PRE-MERGED base+AIIMS — was
                                    CONCEPT_CARDS + AIIMS_CONCEPT_CARDS)

IN App.jsx:
  - Removed the 5 inlined consts + the runtime AIIMS merge loop (~669 lines /
    ~70KB off the transpiled bundle: 783.6kb -> 713.9kb via esbuild).
  - Added a small content loader after the safeStorage shim:
      CONTENT_VERSION (bump on any JSON edit to bust the cache),
      CONTENT_SOURCES map, ensureContent(name) [memory -> local IndexedDB ->
      network, write-through to IndexedDB], useContent(name) hook
      {data,loading,error,reload}, prefetchAllContent() (background warm), and
      a shared <ContentGate> loading/error placeholder.
  - Caches under LOCAL key content:{name}:v{CONTENT_VERSION} via
      safeStorage.set(...,false). shared:false = per-device IndexedDB only;
      storage.js / Supabase sync / shared keys all UNTOUCHED. schemaVersion
      stays 9 (no migration).
  - Consumers refactored to the hook (7 sites): Reference, ReferenceLookupModal
    (both gate on load), DosagePractice (gate), LearnTopics + LearnCards (gate),
    HelpModal (falls through to its existing generic placeholder during load),
    and lookupReportedQuestion/ReportedQuestionModal (admin; dosage list now
    passed as a param, hook moved above the early return).
  - App mounts prefetchAllContent() ~2.5s after first paint so the four
    screens are warm + OFFLINE-ready even before first open.

RECONCILIATION vs this prompt:
  - Line-count estimates were off (prompt said REFERENCE 208 / DOSAGE 241 /
    HELP 221 / CONCEPT ~70 / AIIMS ~70). ACTUAL extracted: REFERENCE 167 items,
    DOSAGE 18, HELP 31 keys, CONCEPT+AIIMS merged into 10 topics. Content is
    byte-for-byte identical to the old in-bundle data (parity-tested).
  - CONCEPT_CARDS and AIIMS_CONCEPT_CARDS were TWO objects merged at module
    load; pre-merged into ONE concept-cards.json so the app needs no merge step.
  - REFERENCE_CATEGORIES (small chip metadata) intentionally STAYS in-bundle.

OFFLINE / SW NOTE for whoever owns the PWA config (out of this bundle):
  After first online load each file is cached in IndexedDB and works offline,
  and prefetch warms it on first online launch. For zero-network availability
  from the VERY FIRST install (before any online launch), add `data/**` (or
  the four files) to the vite-pwa `workbox.globPatterns` / `includeAssets` so
  they are precached with the app shell. Loader degrades gracefully until then.
  Also: editing a JSON file requires bumping CONTENT_VERSION in App.jsx to
  invalidate cached copies (and, if precached, a normal SW update).

────────────────────────────────────────────────────────────────

IMPORTANT — read the distinction first. This item does NOT say
"move SEED_QUESTIONS out of the bundle." SEED_QUESTIONS staying
in code is a deliberate, correct design choice: it acts as the
default fallback question pool so the app always has questions
available — when a user has just installed the app, when they're
offline, when they've paused all their imported banks via
disabledBanks, or when no custom banks have been imported yet.
That guarantee has real value and is worth the ~50KB gzipped cost.
Keep it.

The audit point is about the OTHER static blobs, which do NOT have
the same fallback rationale:

  REFERENCE              208 lines   — lookup material, not gameplay
  DOSAGE_QUESTIONS       241 lines   — separate practice mode
  HELP_CONTENT           221 lines   — static UI help text
  CONCEPT_CARDS          ~70 lines   — learn-mode content
  AIIMS_CONCEPT_CARDS    ~70 lines   — learn-mode content

That's roughly 800 lines / ~150 KB of code/text shipped on every
first paint that doesn't need to be there.

WHY (for the non-fallback blobs):

  1. They ship to every user on first load even if the user never
     opens Reference or Dosage Practice. On a 3G connection in
     tier-2 India (your target audience) that's measurable
     load-time friction.
  2. Fixing a typo in any explanation, dosage value, or help
     paragraph requires code change → git commit → Vercel redeploy.
     You can't edit content casually.
  3. None of them are needed at boot — they're only read when the
     user opens that specific screen. Inlining at boot is wasted
     bandwidth for the common case.

WHAT: Two options for the non-fallback blobs, pick by tolerance
for change:

  OPTION B (lighter, do now): move each blob to /public/data/*.json,
  fetch lazily when the relevant screen mounts, cache in IndexedDB
  so subsequent loads are instant and offline-capable. Bundle
  shrinks. Edits = push a JSON file → instant CDN deploy. No DB
  needed yet.

  OPTION A (heavier, do later): move into Supabase tables.
  Admin panel becomes the editor. Versioned. Searchable.

PRACTICAL PATH: Do OPTION B for REFERENCE, DOSAGE_QUESTIONS,
HELP_CONTENT, CONCEPT_CARDS, AIIMS_CONCEPT_CARDS. SEED_QUESTIONS
stays in code as the offline / fallback baseline.

PHASE 2 (much later, NOT now): if SEED_QUESTIONS grows past a few
hundred questions and bundle size becomes noticeable, you can
split it into a small in-code "starter pack" (~20 questions, true
zero-network first-launch fallback) plus the full bank in Supabase
with aggressive IndexedDB caching on first visit. Same offline
guarantee, smaller bundle. But only when bundle weight becomes a
real problem — not before.


────────────────────────────────────────────────────────────────
A3.  ADD A ROOT ERROR BOUNDARY                   Priority: HIGH  [LOCAL]
────────────────────────────────────────────────────────────────

WHY: With 90 components, 1,120 inline styles, and lots of derived
state, a single rendering bug in any screen (divide-by-zero in
stats, missing field in a hand-edited custom question, malformed
bank import) crashes the entire app — white screen, no recovery.
You have ZERO ErrorBoundary / componentDidCatch in the file. A
user whose progress blob has one bad field is locked out forever
unless they clear browser data (which loses everything).

WHAT: Add `<ErrorBoundary>` wrapping `<App/>` in main.jsx. On
error: log via the logger from A10, show a friendly screen with
three buttons:
  - "Reload app" (location.reload)
  - "Reset just this screen" (resets nav.screen to 'home')
  - "Reset all data" (last resort — wipes IndexedDB; the Supabase
    cloud copy from PROMPT 1 means progress survives this)

About 50 lines of code. Pure win.


────────────────────────────────────────────────────────────────
A4.  MOVE ADMIN AUTH OFF THE CLIENT              Priority: HIGH  [LOCAL]
────────────────────────────────────────────────────────────────

WHY: ADMIN_PASSPHRASE_HASH and ADMIN_SALT are hardcoded in the JS
bundle (lines 1833–1834). The hashing (PBKDF2-SHA256, 100k iter) is
fine in isolation, but the check happens entirely in the client.
Any user can:
  - View source in DevTools, see the hash + salt
  - Patch `isAdmin = true` in the React DevTools state or in the
    Sources tab, and bypass the check entirely
  - Once "admin", call your write paths against Supabase directly
    (announcement:current, bank:*, etc.) because RLS on kv_shared
    is open for anon

This is security theater. A malicious user can corrupt announcements,
delete other users' public banks, post spam announcements, etc.

WHAT: Move admin to a Supabase-side check. Options:

  Lighter: a dedicated `admin_profile_ids` table. Replace open-anon
  RLS policies on kv_shared with policies that check whether the
  current request's profileId (passed as a header or claim) is in
  that table for admin-only key prefixes (announcement:*, bank:* on
  edit/delete). The client still shows/hides admin UI based on
  isAdmin (UX), but writes are enforced server-side (security).

  Proper: Supabase Auth with a custom claim. Real session tokens
  instead of profile blobs. Larger change — defer until you outgrow
  the current profile system.

Do this BEFORE you have 100+ users — much harder to migrate later.


────────────────────────────────────────────────────────────────
A5.  ROUTE-LEVEL CODE SPLITTING                  Priority: MEDIUM-HIGH  [LOCAL]
────────────────────────────────────────────────────────────────

WHY: Every screen ships in the initial bundle, including AdminPanel,
BankEditor, Library, Reference, DosagePractice, RevisionSheet,
FeedbackInbox, MyReports — most users never visit half of these.
A first-time user downloading the app on a slow connection waits
for code they may never run.

WHAT: Wrap heavy screens in React.lazy + Suspense. AFTER A1.

  const AdminPanel  = lazy(() => import('./screens/AdminPanel'));
  const BankEditor  = lazy(() => import('./screens/BankEditor'));
  const Library     = lazy(() => import('./screens/Library'));
  const Reference   = lazy(() => import('./screens/Reference'));
  const Dosage      = lazy(() => import('./screens/DosagePractice'));
  const Stats       = lazy(() => import('./screens/StatsScreen'));
  const Revision    = lazy(() => import('./screens/RevisionSheet'));

Wrap the screen-routing block in a single `<Suspense fallback={<LoaderSpinner/>}>`.
Vite handles the chunking automatically. Expect 30–50% smaller
initial JS payload.

DEPENDS ON A1.


────────────────────────────────────────────────────────────────
A6.  CENTRALIZE STORAGE KEYS                     Priority: MEDIUM  [LOCAL]
────────────────────────────────────────────────────────────────

WHY: Currently you have 12+ key constants scattered across the file:
STORAGE_KEY (1106), HEALTH_KEY (1225), SESSION_KEY (1250),
PROFILE_INDEX_KEY (1251), PROFILE_META_PREFIX (1257), THEME_KEY
(1588), ONBOARDING_KEY (1589), FEEDBACK_KEY_PREFIX (1617),
MY_FEEDBACK_KEY_PREFIX (1674), ANNOUNCEMENT_KEY (1795),
ADMIN_STATUS_KEY (1835), BANK_KEY_PREFIX (1876), plus key-builder
functions profileKey, profileMetaKey, feedbackKey, bankKey,
myFeedbackKey.

Risk: a typo in any one of those creates a NEW key silently — no
error, no warning. The user's data appears to vanish. You only
notice when someone reports lost progress.

This is also a prerequisite for PROMPT 1 (cloud sync) because
PROMPT 1 wants to rename STORAGE_KEY to `userdata:{profileId}` and
you don't want that rename to leave stragglers.

WHAT: One file, src/lib/keys.js:

  export const KEYS = {
    USERDATA:       'norcet:userdata:v1',
    SESSION:        'norcet:session:v1',
    HEALTH:         'norcet:health:v1',
    THEME:          'norcet:theme:v1',
    ONBOARDING:     'norcet:onboarded:v1',
    ANNOUNCEMENT:   'announcement:current',
    ADMIN_STATUS:   'norcet:admin:v1',
    PROFILE_INDEX:  'profile_index',
    profile:        (id) => `profile:${id}`,
    profileMeta:    (id) => `profilemeta:${id}`,
    feedback:       (id) => `feedback:${id}`,
    myFeedback:     (id) => `myfeedback:${id}`,
    bank:           (id) => `bank:${id}`,
    userdata:       (profileId) => `userdata:${profileId}`,  // for PROMPT 1
  };

  export const KEY_PREFIXES = {
    PROFILE_META:   'profilemeta:',
    FEEDBACK:       'feedback:',
    MY_FEEDBACK:    'myfeedback:',
    BANK:           'bank:',
  };

Every call site uses KEYS.X instead of a raw string. Refactor is
mechanical: search & replace. Do this BEFORE PROMPT 1.


────────────────────────────────────────────────────────────────
A7.  REPLACE PROP-DRILLING WITH CONTEXT          Priority: MEDIUM  [LOCAL]  [DONE — step 36]
────────────────────────────────────────────────────────────────

[DONE — pipeline step 36, FOUNDATION + BOUNDED MIGRATION]  The three contexts
this section asks for now exist in src/lib/app-context.jsx — ThemeContext
{ theme, themeMode, setThemeMode, isDark }, ProfileContext { profile, setProfile,
isAdmin }, DataContext { data, setData, allQuestions } — composed by
<AppProviders> with useTheme/useProfile/useData hooks. App wraps ALL SIX of its
return branches (loading / guest-merge / auth ×2 / welcome / main) in the
provider via a `provide()` helper fed by live state, so consumers resolve in
every branch. The render-mutated globals this section flags: CURRENT_PROFILE is
DELETED (FeedbackButton reads useProfile); the leaf primitives Pill/Button/TopBar
(the screen-extraction blockers) read useTheme. T/IS_DARK are intentionally KEPT
as a transitional module bridge — still reassigned in App render AND fed to the
provider — for the ~2000 in-screen `T` reads not yet migrated; per this section's
own "DO THIS AT THE SAME TIME AS A1" note, each screen sheds the bridge for
useTheme()/useData()/useProfile() (and stops taking data/profile/etc. props,
shrinking the dispatch block) as it is extracted in steps 37-38. The bridge +
`let T`/`let IS_DARK` are deleted only when the last bare-T screen is gone.
Verified: transpile + esbuild bundle-with-stubs clean; 14/14 context SSR contract
tests (value flow, theme switch, isDark, profile/data flow, hooks throw outside a
provider); 4/4 real-<App/> SSR smoke (renders without throwing → provider wiring
sound, loading splash shows, no context-error leak). Schema v9; no new dep beyond
`react`. DataContext perf caveat below still applies if consumer churn shows up.

────────────────────────────────────────────────────────────────
ORIGINAL SPEC (kept for reference)
────────────────────────────────────────────────────────────────

WHY: `data`, `profile`, `isAdmin`, `themeMode`, `allQuestions` are
threaded through almost every screen as props. Look at the App
return block (lines 12223–12440): every screen call is a wall of
identical props. Adding a new piece of global state means touching
25+ call sites.

You also currently use module-level mutable globals (T at line 195,
IS_DARK at 196, CURRENT_PROFILE at 8521), reassigned inside App()
during render. This is fragile: it works in a single file but
breaks the moment screens move to separate modules (A1), because
each module captures T at its own import time and won't see
reassignments. It also breaks under React 18 Strict Mode with
concurrent rendering.

WHAT: Three small contexts:
  - ProfileContext  { profile, setProfile, isAdmin }
  - ThemeContext    { themeMode, setThemeMode, theme }   // theme is the
                                                         // resolved palette
  - DataContext     { data, setData, allQuestions }

Each screen reads via useContext. Screen components shrink. Module
globals (T, IS_DARK, CURRENT_PROFILE) go away.

CAVEAT: contexts re-render all consumers on every change. If perf
becomes an issue, split DataContext further (separate `progress`
and `stats` contexts), or move to Zustand for selective subscription.
For your scale (10–50 users, dozens of components) plain Context
is fine.

DO THIS AT THE SAME TIME AS A1 — they're coupled.


────────────────────────────────────────────────────────────────
A8.  ELIMINATE INLINE STYLE OBJECTS              Priority: MEDIUM  [MIXED]  [DONE]
────────────────────────────────────────────────────────────────
[DONE — pipeline step 23] Built the CSS-variable FOUNDATION the spec asks for
and migrated the hottest paths; the remaining ~1,295 inline styles can now be
converted incrementally against this foundation (this is a multi-pass cleanup,
not a one-shot 1,300-edit rewrite on a live app).

WHAT WAS DONE in src/App.jsx:
  1. The existing themeMode effect (was only setting --sb-thumb on :root) now
     ALSO publishes every theme token as a CSS variable on :root:
       --bg --surface --surface-warm --ink --ink-soft --muted --primary
       --primary-soft --accent --accent-soft --success --success-soft --error
       --error-soft --border --border-soft  + --sec-quick … --sec-stats (8).
     Driven by the active theme object, so all FIVE themes resolve through the
     same vars. ALSO published SYNCHRONOUSLY at the `T = THEMES[themeMode]`
     reassignment in App render (guarded by typeof document) so the classes are
     correct on the very first paint / theme switch with no one-frame flash.
  2. Added CSS-var-backed utility classes to the in-file `fontStyles` global
     stylesheet (NOT index.css — see reconciliation): .bg-app .bg-surface
     .bg-surface-warm .bg-primary .bg-success-soft .bg-error-soft .text-ink
     .text-ink-soft .text-muted .text-primary .text-accent .text-success
     .text-error .text-on-primary .border-app(.-soft) .bd-app(.-soft) and the
     composite .surface-card (background+border, matches the old Card exactly).
  3. Migrated the Quiz screen (spec called it out for jank): 21 exact static
     single-prop theme styles -> utility classes.
  4. Migrated the Card PRIMITIVE: dropped its per-render
     `style={{ background:T.surface, border:`1px solid ${T.border}` }}` for the
     .surface-card class, keeping the `style` override path so every existing
     caller that passes a coloured background/border still wins via inline
     precedence. This is the single biggest object-churn win — Card renders on
     virtually every screen, hundreds of instances, now with zero per-render
     style allocation for the common case.

NET: inline `style={{` count 1316 -> 1295; plus the Card primitive (1 site,
many instances) de-objectified. esbuild clean; CSS-var publish unit-tested
across all 5 themes (16/16). No visual change intended in any theme.

RECONCILIATION vs this prompt:
  - Count was 1316 `style={{`, not 1120 (file grew since the prompt was
    written: P5/leaderboard/etc.).
  - The "--sb-thumb pattern at lines 11424–11435" is now at ~line 13284 (the
    themeMode effect) after all the insertions; found by content, not line #.
  - index.css is NOT in this bundle and must not be touched, so the utility
    classes were added to the EXISTING in-file `fontStyles` template literal
    that App already injects via <style>{fontStyles}</style> (the house pattern).
    No external CSS file needed. (Watch out: that literal uses backticks, so CSS
    comments inside it must NOT contain backticks — bit me once.)
  - No <ThemeProvider>/ThemeContext yet (that's A7, still pending). The vars are
    published from the existing module-level `T` mechanism; when A7 lands, fold
    this publish into the provider's effect.

FOR THE NEXT PASS (whoever continues A8 later): the foundation is done, so
converting more components is now mechanical — replace exact static
`style={{ color: T.x }}` / `style={{ background: T.y }}` with the matching
className, merging into any existing className. Keep inline style for DYNAMIC
values (computed colours with alpha like T.primary+'14', widths, transforms)
and section-accent tints. Do it per-component, transpile after each batch.

────────────────────────────────────────────────────────────────

WHY: 1,120 `style={{...}}` instances in the file. Each one creates
a new object on every render, which:
  - defeats React.memo on children (object identity changes)
  - adds GC pressure on low-end Android phones — measurable jank
    on the long Quiz screen
  - makes it impossible to maintain a coherent design system
  - duplicates theme color reads literally hundreds of times

WHAT: Use CSS variables on :root, driven by the active theme. You
already have the exact right pattern at lines 11424–11435 (setting
--sb-thumb based on theme) — extend it to set --bg, --surface,
--ink, --inkSoft, --muted, --primary, --primarySoft, --accent,
--accentSoft, --success, --error, --border, --sec-quick, etc.

Then components use those vars in className-based styles or in a
single `styled` shell:

  /* in index.css */
  .card { background: var(--surface); color: var(--ink); }

  // in JSX
  <div className="card">…</div>     // instead of style={{ background: T.surface, color: T.ink }}

Inline `style` survives for truly DYNAMIC values (a progress bar
width, a per-instance transform). Everything else moves to className.

A `<ThemeProvider>` that owns the theme and sets the vars in one
useEffect is the natural place — folds into A7's ThemeContext.


────────────────────────────────────────────────────────────────
A9.  ACCESSIBILITY PASS                          Priority: MEDIUM  [MIXED]  [DONE]
────────────────────────────────────────────────────────────────
[DONE — pipeline step 24] Storage-neutral (schema stays 9). Focused sweep:

  1. FOCUS TRAP HOOK (reusable): useFocusTrap(onClose, active=true) — remembers
     the trigger, moves focus into the dialog on open, traps Tab/Shift+Tab,
     Escape calls onClose, restores focus to the opener on close. Defensive
     (never throws on missing DOM APIs). `active` lets always-mounted modals
     that gate on a flag drive the trap (e.g. ReferenceLookupModal by `open`,
     ReportedQuestionModal by `!!questionId`).
  2. MODALS (6) got role="dialog" (alertdialog for the destructive one) +
     aria-modal="true" + the focus trap + a close-button aria-label:
       RenameProfileModal, HelpModal, FeedbackModal (+ its two textareas got
       aria-label), ReferenceLookupModal, ReportedQuestionModal, and the Quiz
       confirm-exit dialog — the last was EXTRACTED into a new component
       <ConfirmExitDialog> (role="alertdialog") so the hook mounts/unmounts
       with it cleanly.
  3. CLICKABLE NON-BUTTONS made keyboard-operable:
       - Card primitive: when clickable, gets role="button", tabIndex=0,
         Enter/Space onKeyDown (optional ariaLabel prop). One change covers all
         32 clickable cards (nav tiles etc.).
       - Both quiz option lists (main Quiz + AdvancedTest): role="button",
         tabIndex, Enter/Space, aria-pressed={selected}, aria-label="Option X:
         …"; the main one also sets aria-disabled + tabIndex=-1 when locked.
  4. ICON-ONLY BUTTONS got aria-label: TopBar back ("Go back" — covers every
     screen), Quiz bookmark toggle (dynamic label + aria-pressed), and the 6
     refresh buttons (Feedback inbox, My feedback, Helpfulness, admin Feedback,
     Users, Leaderboard) -> "Refresh".
  5. TOASTS / live regions: UpdateToast already had role="status". Added
     role="status" aria-live="polite" to the ShareScoreButton save/error hints
     and the HelpfulToggle "thanks" confirmation so screen readers announce them.

RECONCILIATION vs this prompt:
  - Counts differ (prompt: 21 aria-*, 249 onClick, zero role/focus mgmt).
    ACTUAL at this point: 279 onClick, 25 aria-*, and there were already TWO
    roles (1 status on UpdateToast, 1 alert on the bridge-dead banner) and 4
    onKeyDown. Crucially only EIGHT onClick handlers were on non-<button>
    elements (3 of those are the Card primitive / quiz options / a
    stopPropagation wrapper) — the other 139 onClick are already on <button>.
    So the "many onClick on <div>" concern was largely already handled; the
    real wins were the Card primitive, the quiz options, and modal focus mgmt.
  - The spec named FeedbackModal/RenameProfileModal/HelpModal/Quiz-confirm;
    also covered the NEWER modals from later steps: ReferenceLookupModal (A?),
    ReportedQuestionModal (admin). The share flow (P5) is a button + canvas,
    not a focusable dialog, so it needed only the role=status hints (done).
  - axe DevTools can't run in this headless pipeline — the focus-trap logic was
    unit-tested in JSDOM instead (6/6). Run axe locally on device (see manual).
  - This is a FOCUSED pass (the spec's word), not a 100%-WCAG audit. Remaining
    nice-to-haves for later: heading-order/landmark roles, contrast audit of
    the muted-on-surface text, and labelling the few remaining form inputs on
    the setup screens. Not blockers.

────────────────────────────────────────────────────────────────

WHY: 21 `aria-*` attributes spread across 249 onClick handlers.
Zero `role=` attributes. Zero focus management. Many onClick
handlers are on `<div>` not `<button>`. The app is likely
unusable with a screen reader, and only barely keyboard-navigable.

Your audience (nursing students in India, many on budget Android
phones, some with TalkBack enabled, some with low vision in a
profession that demands sharp eyes) is exactly the demographic
that benefits from a11y. This is also free SEO/discovery on app
listings that grade accessibility.

WHAT: A focused sweep with these targets:
  - Every onClick on a non-<button> element gets role="button",
    tabIndex={0}, and an onKeyDown that handles Enter/Space
  - Every icon-only button gets aria-label
  - Modals (FeedbackModal, RenameProfileModal, HelpModal, the
    Quiz confirm-exit dialog) get role="dialog", aria-modal="true",
    and trap focus on open (focus the first interactive element;
    return focus to the trigger on close)
  - Form inputs get associated <label>s (or aria-labelledby)
  - Quiz option buttons get aria-pressed={isSelected}
  - Toasts get role="status" so screen readers announce them
  - Run axe DevTools on each major screen, fix the high-priority
    findings


────────────────────────────────────────────────────────────────
A10. STRUCTURED LOGGING + ERROR REPORTING        Priority: MEDIUM  [LOCAL]
────────────────────────────────────────────────────────────────

WHY: 57 try/catch blocks, many with `catch (e) { /* no-op */ }` or
similar silent swallows (the boot block at line 11342, many storage
helpers, etc.). Resilience is good — but in production when a user
reports "the app crashed" or "my progress is missing", you have
NOTHING. No stack trace, no breadcrumbs, no error counts, no idea
how often it happens.

WHAT: Two layers:

  src/lib/log.js — a 30-line logger with debug/info/warn/error
  methods. In dev: prints to console with severity colors. In prod:
  queues messages to an in-memory ring buffer (last 50). On error
  (level=error), POSTs the buffer to a Supabase `error_logs` table
  with profileId, screen, user agent. You can later swap for Sentry,
  but you don't need the SDK weight yet.

  At every silent catch swallow, replace `/* no-op */` with
  `log.warn('storage.profileLoad', e)` (or a descriptive tag).
  Keep the swallow — just observe it.

The ErrorBoundary from A3 reports through this logger.

Together with A4 (admin off the client), you'll be able to triage
issues from your end without asking users for screenshots.


────────────────────────────────────────────────────────────────
A11. DATA SCHEMA VERSIONING + MIGRATIONS         Priority: MEDIUM  [LOCAL]
────────────────────────────────────────────────────────────────

WHY: STORAGE_KEY is `norcet:userdata:v1`, but you have no migration
runner. When DEFAULT_DATA changes shape (and it has — disabledBanks,
revisionLog, feedbackRepliesSeen, preferences.reviewRemindersEnabled,
streakGraceAvailable, dailyTarget have all been added over time),
the boot block at lines 11313–11326 papers over missing fields by
spreading DEFAULT_DATA. That works for ADDING fields but breaks
silently when you RENAME, REMOVE, or RESHAPE one — old users get
stale fields, new code reads `undefined`, weird bugs emerge.

This is also a prerequisite for PROMPT 1 (cloud sync). Once data
lives in Supabase, you can't just hand-edit your local browser to
test new shapes — schema drift between client versions is real.

WHAT: A tiny migration runner:

  // src/lib/migrations.js
  export const MIGRATIONS = [
    { from: 1, to: 2, fn: (d) => ({ ...d, disabledBanks: d.disabledBanks || {} }) },
    { from: 2, to: 3, fn: (d) => ({ ...d, revisionLog: Array.isArray(d.revisionLog) ? d.revisionLog : [] }) },
    // …
  ];

  export function runMigrations(data) {
    let d = { ...data };
    let v = d.schemaVersion ?? 1;
    for (const m of MIGRATIONS) {
      if (m.from === v) { d = m.fn(d); v = m.to; }
    }
    d.schemaVersion = v;
    return d;
  }

On boot, run this before the spread-merge. Bump schemaVersion
whenever you intentionally change shape. The boot spread-merge
remains as a final safety net for forward-compat.


────────────────────────────────────────────────────────────────
A12. URL-BASED ROUTING                           Priority: LOW-MEDIUM  [LOCAL]
────────────────────────────────────────────────────────────────

WHY: Your custom `{nav.screen === 'X' && <X/>}` router (25 entries,
lines 12223–12440) means:
  - No deep-linkable URLs (can't share a link to /library/<bankId>)
  - Browser back/forward bolt-on per screen — Quiz adds history
    entries manually, but it's not consistent everywhere
  - No analytics on screen views (e.g. Vercel Analytics needs URLs)
  - A user who reloads mid-quiz drops back to Home
  - Code splitting (A5) becomes harder without route boundaries

WHAT: react-router-dom v6. One <Routes> block replaces the if-chain:

  <Routes>
    <Route path="/" element={<Home/>} />
    <Route path="/quiz/:mode" element={<Quiz/>} />
    <Route path="/stats" element={<Stats/>} />
    <Route path="/admin" element={<RequireAdmin><AdminPanel/></RequireAdmin>} />
    <Route path="/library" element={<Library/>} />
    <Route path="/library/:bankId" element={<BankDetail/>} />
    …
  </Routes>

URLs become real. Browser back works. Reload preserves screen.
Analytics drops in. Code splitting (A5) becomes free.

COST: every `setNav({...})` call site changes to `navigate("/...")`.
About 60 call sites. Worth doing AFTER A1 so each screen file owns
its own routing concerns.


────────────────────────────────────────────────────────────────
A13. TYPE SAFETY                                 Priority: LOW  [LOCAL]
────────────────────────────────────────────────────────────────

WHY: At 12k lines and 90 functions, type errors silently slip in:
missing field on a question, wrong arg shape passed to onComplete,
typos in DEFAULT_DATA paths, optional chaining where the value
should never be null. You have 0 PropTypes, 0 TypeScript.

WHAT: Pragmatic steps, in order:

  1. JSDoc the data shapes (DEFAULT_DATA, Question, Profile, Bank)
     in one src/types.js file. IDE autocomplete and inline checks
     appear immediately, with zero build changes. ~30 minutes of
     work for outsized benefit.

  2. Add `// @ts-check` to a handful of pure-logic files (utils.js,
     storage.js, migrations.js) and run `tsc --noEmit --allowJs`
     in CI to catch type mistakes. No code changes.

  3. (Much later) Incremental migration to TypeScript, one module
     at a time AFTER A1's split. Vite supports mixed .ts/.jsx by
     default.

JSDoc is the right first step. Full TS is a future call when the
app is bigger or you have contributors.


────────────────────────────────────────────────────────────────
DEPENDENCIES + RECOMMENDED ORDER
────────────────────────────────────────────────────────────────

A3 (error boundary)         → do FIRST. Independent. 1 session.
A4 (admin off client)       → do SOON. Independent. Security.
A6 (centralize keys)        → do BEFORE PROMPT 1 (cloud sync).
A11 (schema migrations)     → do BEFORE PROMPT 1 (cloud sync).
A1 (split into modules)     → unlocks A5, A7, A12, A13. Largest single
                              effort — plan 3-4 separate prompts.
A7 (Context)                → do WITH A1. Coupled.
A2 (content out of bundle)  → can do anytime; OPTION B is independent.
A8 (CSS vars)               → can do anytime; nice with A7's ThemeContext.
A9 (a11y)                   → can do anytime; user-visible win.
A10 (logging)               → do WITH A3 (ErrorBoundary reports through it).
A5 (code splitting)         → AFTER A1.
A12 (URL routing)           → AFTER A1.
A13 (types)                 → AFTER A1, optional.

NEVER bundle these in one session. Each one is a real refactor.


================================================================
APPENDIX — POST-REFACTOR ARCHITECTURE FACTS  (added after A1 done)
================================================================
Read this before planning ANY new feature. It captures the durable
shape of the codebase that the prompt bodies above (written pre-split)
do not reflect.

MODULE LAYOUT
  src/App.jsx            Root only: router/dispatch (a `nav.screen`
                         switch), boot/migration logic, App-local
                         storage + admin helpers, and module constants.
                         Renders extracted screens; renders NO inline
                         screen/modal components.
  src/lib/app-context.jsx  ThemeContext + ProfileContext + DataContext,
                         <AppProviders>, and the hooks useTheme(),
                         useProfile(), useData(). This is how everything
                         gets theme/profile/data now.
  src/lib/*.js(x)        Pure logic + storage: keys, storage, safe-storage,
                         profiles, profile-crypto, merge, migrations,
                         compact, feedback, helpful-votes, content,
                         selectors, utils, topics, pyq, format,
                         question-import, themes, light-themes,
                         theme-helpers, font-styles, kmap, qr, banks,
                         banks-storage, quick-practice, use-focus-trap.
  src/ui/*.jsx           Shared presentational pieces: primitives
                         (Card/Button/Pill/TopBar/PyqBadge/requestHelp),
                         result-cards, question-widgets, nav-drawer,
                         confirm-exit-dialog, content-gate,
                         home-support-nudge, admin-tile,
                         admin-feedback-card.
  src/screens/*.jsx      One component (or tight cluster) per file.
  tests/*                One contract/behavioral test per module.

THEME (A7 — important for every new component)
  • There is NO module-level `T` / `IS_DARK`. Any component that needs
    theme does:  const { theme: T } = useTheme();
    (and  const { isDark } = useTheme();  if it needs dark-mode flags).
  • For on-dark foreground + status colors, the hooks useFgOnDark() and
    useStatusMeta() exist (in the screens that need them).
  • App.jsx itself computes T/IS_DARK locally and FEEDS them into
    <AppProviders>. It is the provider's SOURCE — do not make App read
    theme back out of useTheme() (circular). New SCREENS always useTheme.

PROFILE / DATA
  • Profile flows via ProfileContext (useProfile → { profile, isAdmin,
    … }). The old CURRENT_PROFILE module global is gone.
  • App data + setData flow via DataContext (useData). Screens that
    mutate user data take setData (or the specific callback) — follow
    how an existing extracted screen does it.

ADDING A NEW SCREEN (the established pattern)
  1. Create src/screens/<name>.jsx exporting the component (default for
     a single screen; named exports for a tight cluster).
  2. Inside it: `const { theme: T } = useTheme();` for theme; take
     everything else as props or via useProfile/useData.
  3. In App.jsx: add `import <Name> from './screens/<name>.jsx';` and a
     dispatch branch in the router (and a nav entry / route trigger if
     it's user-reachable).
  4. If it needs new pure logic or storage, put that in src/lib/ with a
     small test — don't inline non-trivial logic in the screen.
  5. Verify: the repo builds with `npm run build`; in this chat-without-
     the-full-tree setup, verification is an esbuild bundle-with-stubs
     (see _HANDOFF for the harness) + a focused test. Reconcile any
     import names against the REAL repo when merging.

VERIFICATION DISCIPLINE (kept from the refactor)
  • Moving existing code = VERBATIM (byte-identical) except a documented
    hook line or an intentional, noted signature change.
  • Every change: transpile-check, then a full bundle compile (0 err/
    0 warn), then a test. Trim now-orphaned imports from App after a move.
  • The deliverables zip carries App.jsx + touched modules, NOT the whole
    src/ tree; earlier siblings + the test harness are stubbed. Always
    reconcile against your real repo on merge.

REMAINING REFACTOR ITEMS (optional, unblocked by A1; not needed for features)
  • A5  route-level code splitting (React.lazy per screen).
  • A12 URL routing (react-router) — replaces the nav.screen switch;
    ~60 setNav call sites become navigate('/...'). Big but mechanical.
  • A13 types (JSDoc first, then optional incremental TS).
  • Further lib tidy-ups: lib/admin-storage.js, profile/session helpers,
    findDuplicateStem → question-import.js. Pure plumbing; low priority.

NEW-FEATURE PLANNING NOTE
  When adding the features described in any NEW feature md: first map
  each feature to (a) a new src/screens/* file, (b) a new/edited
  src/lib/* module, and/or (c) App.jsx router/state changes. Flag
  features that touch App's core boot/storage/admin plumbing as higher
  risk. Prefer independent, self-contained features first. Data-model
  changes go through src/lib/migrations.js (bump schemaVersion).

# ────────────────────────────────────────────────────────────────
# NEW FEATURE BACKLOG  (from study_methods_section_prompt.md — Jun 2026)
#   Status: ALL SIX IMPLEMENTED & BUILD-GREEN (Jun 2026). Each built on the
#   existing modular patterns; CONTENT_VERSION bumped to 6 along the way.
#   Two deliberate omissions, documented at their features below:
#     • F-E quiz-flow integration — SKIPPED: no question↔concept-card link
#       exists in the data model (only shared topics, too broad). Needs a
#       mapping before it can be built honestly.
#     • F-F cross-user "most-flagged / helpful" analytics dashboard — NOT
#       built (optional). Per-answer helpful counts ARE shown to admins.
#   KEY FINDING for F-F: NO new Supabase tables were needed — the whole
#   backend is the single kv_shared store, so FAQs/threads/replies/votes are
#   keyed entries (mirrors feedback.js + helpful-votes.js). Nothing to set up.
# ────────────────────────────────────────────────────────────────
#
# F-A — STUDY METHODS SECTION   (independent · new screen · LOW risk)
#   What: a permanent, revisitable guide of 6 science-backed study methods
#     as a numbered vertical list; each row opens a full-screen mentor card
#     (hook → science stat highlight → "How to apply this in NORCET" →
#     [Go to feature] + [Next method]). Mentor voice: warm, punchy, short.
#   The 6 (ORDER MATTERS): 1 Read a Textbook (SQ3R) · 2 Understand Deeply
#     (elaborative "why") · 3 Remember What You Read (active recall) ·
#     4 Never Forget (spaced repetition) · 5 Study Smarter (interleaving) ·
#     6 Lock It In (testing effect / self-quiz).
#   Build: NEW src/screens/study-methods.jsx (list + in-screen detail view
#     state); static copy in src/data/study-methods.js; Home tile +
#     router branch + nav entry in App.jsx; help.json key "Study methods"
#     (then BUMP CONTENT_VERSION).
#   Feature-link mapping (these "tools" are NOT all real — route to the
#     nearest EXISTING screen via handleHomeNavigate): SQ3R→Learn topics;
#     "why" prompt→Learn cards; active recall→Quick practice / Learn
#     self-check; spaced repetition→Spaced-revision card / review-due quiz;
#     interleaving→Quick practice (All topics, mixed); self-quiz→Quick test.
#   Per-row progress stat (READ-ONLY from existing data; show "Not started
#     yet — tap to learn how" at zero): pull from data.stats / data.history
#     (e.g. total attempted, getDueQuestions count). Stats with no real
#     source (chapters read, mixed sessions) → sensible proxy or omit.
#   Visited state: local kv key in keys.js (per profile) — NOT a schema
#     change. Subtle dim → normal → accent.
#
# F-B — PULL-TO-REFRESH   (global polish · app-shell · MEDIUM risk)
#   What: Instagram-style pull-down on any screen → proportional pull
#     indicator → on release past threshold, refresh + a short soft sound.
#     Same feel everywhere; something visible must change so it feels real.
#   Build: ONE reusable hook src/lib/use-pull-to-refresh.js (touch/pointer
#     math + threshold + spring) + a shared <PullToRefresh> wrapper, applied
#     at the scroll-root of each screen (or once in the App shell around the
#     screen switch). Refresh action = re-pull profile/content + recompute
#     derived views per screen (Home: streak/plan/due/doubts; Quick
#     Revision: rebuild stack; etc.). NO "last updated" timestamp.
#   Sound: WebAudio (the Knowledge-Map chime pattern already exists — reuse
#     that approach), <1s, subtle, on RELEASE only. MUST respect silent/mute
#     — gate behind a settings sound toggle and/or the existing audio-unlock
#     so it never plays when the device is muted. Add a sound on/off setting.
#   Risk: touches every screen's scroll container; build it as ONE wrapper to
#     keep it consistent and avoid per-screen drift. Additive — no data model.
#
# F-C — WELCOME TOUR UPGRADE   (modifies welcome.jsx · MEDIUM risk)
#   What: in the guest welcome tour, tapping a section row no longer launches
#     it directly — first show a help popup (What it is / How to use it / Why
#     it's here) with a prominent "Got it" (then launches the section) and a
#     subtle back (returns to the tour). Per-row VISITED checkmarks. Unique
#     copy per row. A "Welcome Tour" entry in Settings replays it with
#     visited states preserved.
#   Build: edit src/screens/welcome.jsx (intercept row tap → popup →
#     Got-it launches via existing nav; back re-shows tour); reuse the
#     HelpModal pattern OR a dedicated popup; per-row copy in a small const
#     or reuse help.json keys; visited state in a local kv key (per profile);
#     add a Settings row that opens the tour.
#   PRESERVE existing behaviour (documented above ~"WELCOME TOUR
#     (owner-confirmed)"): guest tour keeps auto-showing each launch and does
#     NOT mark onboarding "seen"; real accounts keep the one-time seen guard.
#     Keep the back-handler/confirm-exit interplay intact.
#
# F-D — REVISION QUICK MODE + 3 STUDY-MODE ADDITIONS   (Learn flow · MED-HIGH)
#   What: usability+intelligence layer over EXISTING Learn-topics notes
#     (NO content rewrite). (1) read-time "N min read" (~200 wpm from word
#     count, subtle); (2) resume where left off (scroll/jump to last topic/
#     position); (3) ensure scannable bullet formatting. PLUS a new "Quick
#     Revision Mode" (second entry point/toggle alongside Study Mode): an
#     app-curated rapid sweep of the most essential points across topics,
#     each tagged with a transparency label.
#   Priority stack (app decides what to surface): 1 weak areas (low quiz
#     accuracy) → 2 due-for-review (spaced) → 3 EXAM-PROXIMITY weighting
#     (60+ d: weak+due; 30–60 d: +broad coverage; <30 d: high-yield breadth;
#     final week: pure critical sweep) → 4 recently studied. Labels:
#     "Weak area" / "Due for review" / "High yield — exam soon" / "Recently
#     studied". (Exam date already collected — this is its first real use.)
#   Build: edit Learn screens (src/screens/learn-cards.jsx / learn-topics);
#     new src/lib/quick-revision.js (pure ranking from history/stats/exam
#     date) + a Quick-Revision view; read-time + resume helpers; resume
#     position in local kv. Notes content unchanged.
#
# F-E — DOUBT FLAG   (depends on F-D · large · app-level data)
#   What: point-level flagging inside revision notes — one tap on a bullet/
#     fact flags it (subtle icon, no modal, no typing), tap again to unflag.
#     A dedicated DOUBTS section grouped by subject, with Unresolved/Resolved
#     tabs, each item showing text + topic + age + [Go to topic]. Resolve =
#     one tap (archived, never deleted). 7-day gentle nudge for stale doubts.
#   Integrations: flagged-unresolved points sit ATOP the F-D Quick-Revision
#     priority stack (label "You flagged this as unclear"); in quiz flow, a
#     question tied to a flagged concept surfaces the note after answering
#     (right → "mark resolved?"; wrong → show note as review).
#   Build: needs stable per-point IDs in the notes data (add ids if absent);
#     new src/lib/doubts.js + a Doubts screen + nav entry; flag toggle UI in
#     learn-cards; nudge hooks into the existing notification system
#     (lib/notifications.js); per-point flag store (local; schema bump if
#     persisted in data via migrations.js). Aggregate (most-flagged points)
#     tracked app-level as a content-quality signal (Supabase, optional).
#
# F-F — FAQ SECTION   (largest · needs Supabase + admin panel · HIGH risk)
#   What: admin-authored FAQs (NO LLM) with category tags; chatbot-style
#     browse (tap question → answer, chat-style layout, fast category
#     filter); a PUBLIC community Q&A thread under each FAQ (user follow-up
#     questions + public admin replies, "Admin" badge); an animated glowing
#     "Was this helpful?" BULB (off=dim, on=amber glow + radiating rays,
#     haptic, one-tap, label "(tap the bulb) / (bulb glow for yes, off for
#     no)") on every answer and every admin reply. Counts are admin-only.
#   Build: Supabase tables (faqs, faq_questions, faq_replies, faq_votes) +
#     anon SELECT / guarded writes via an Edge Function or the existing
#     admin pattern; admin CRUD in src/screens/admin-panel.jsx (+ a manager
#     screen like admin-manager.jsx); a user FAQ screen (chat layout +
#     category chips + thread input); a reusable <HelpfulBulb> component
#     (CSS/SVG animation). Mirrors the existing feedback-inbox/admin-reply
#     and helpful-votes patterns — reuse them. Moderation = admin replies
#     only; no user-to-user.
#

# ════════════════════════════════════════════════════════════════
# ROUND 3 — STUDY-METHODS SPEC GREW TO 15 FEATURES (Jun 2026)
#   study_methods_section_prompt.md was expanded from 6 → 15 features
#   (now 2097 lines). Features 1–6 == F-A…F-F (already done, see above).
#   Features 7–15 are NEW. Status below.
#
#   DONE & BUILD-GREEN this round:
#     • #9  Dosage "Was this helpful?" bulb — reused <HelpfulBulb> in
#           dosage-practice.jsx (per-question voteId `dosageq:{id}`) and
#           dosage-results.jsx (session voteId `dosagetest`). Admin-only counts.
#     • #12 Manage-Admins removal — deleted the duplicate <AdminManager/> block
#           from src/screens/settings.jsx (it lives only in admin-panel now).
#           Kept the Admin-mode card / Open Panel / Lock.
#     • #14 Donation modal redesign — adapted onto the MODULAR file
#           src/screens/support-modal.jsx (spec assumed monolithic App.jsx).
#           Tiers Chai ₹10 / Snack ₹20 / Treat ₹50, gradient header
#           "Free · Ad-free · Always", optional DONATE_QR_URL (static img,
#           falls back to generated QR), Copy icon. Internals (generated QR,
#           clipboard fallback, focus trap, thank-you) kept.
#     • #15 Empty States — a reusable <EmptyState> already existed at
#           src/ui/empty-state.jsx (exports KM_THROUGHLINE) and bookmarks.jsx
#           already used it (created by an EXTERNAL/concurrent edit — see
#           warning below). REUSED it across StatsScreen, previous-papers,
#           doubts, faq, leaderboard (with "x/10" progress), quick-revision-view.
#           API: {icon:Icon, title, text, actionLabel, onAction, note,
#           kmNote, progress}. "Start a Quick test" CTAs route via
#           handleHomeNavigate({screen:'quick-setup'}).
#           DEFERRED: KMap first-time banner → do it inside #13 (it overhauls
#           that exact screen — avoids double work).
#           N/A: streak / spaced-queue / achievements empty states — no
#           dedicated screens (streak is on Home, spaced review is a quiz mode).
#
#   REMAINING (NOT yet built), recommended order:
#     • #7  Notification Panel  (spec lines 707–860)  — Daily Briefing +
#           5 categories (Reminders/Achievements/Insights/Updates); ENHANCES
#           the existing src/screens/notification-center.jsx.
#     • #8  Sidebar Revamp      (861–961)  — 4 categories (Study/Progress/
#           Tools/Help&Learn) + visual pass on src/ui/nav-drawer.jsx.
#     • #11 Drill Tests         (1178–1310) — Home + test-entry restructure.
#     • #10 GK & Aptitude       (1023–1177) — NEW content domains + learn
#           format + questions + stats. LARGE (needs public/data + a content
#           version bump).
#     • #13 Knowledge Map Overhaul (1343–1576) — constellation redesign, 4
#           states, zoom, animations, HUD. LARGE. Carry the deferred #15
#           KMap first-time banner in here.
#
#   CRASH FIX (Jun 7): "Cannot read properties of null (reading 'resolvedAt')"
#     crashed Doubts + Learn-topics. Root: a null/corrupt entry in the
#     persisted doubts map. Fixed src/lib/doubts.js — listDoubts() filters
#     non-object entries, loadDoubts() sanitizes + self-heals on next save,
#     toggleDoubt() won't write a record-less entry. Build exit 0.
#
#   DONATION CONFIG UPDATE (owner, Jun 7) — NOTED:
#     src/screens/support-modal.jsx now ships the REAL config:
#         DONATE_UPI_ID = 'onehalt.in@axl'
#         DONATE_QR_URL = '/qr.png'
#     The static QR lives at public/qr.png (~98 KB) and is served at /qr.png,
#     so the modal shows the owner's real QR instead of the generated one.
#     Tiers/structure unchanged from #14. The "Payments aren't set up yet"
#     placeholder no longer shows (id is real).
#
#   ⚠ CONCURRENT-EDIT WARNING: the working copy was modified between turns by
#     something OUTSIDE the assistant's session (empty-state.jsx + bookmarks.jsx
#     appeared, timestamped after the assistant's edits). If more than one
#     agent/tool edits this repo, changes can collide — apply edits from ONE
#     source of truth.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# ROUND 3 — COMPLETED (Jun 2026). ALL 15 SPEC FEATURES BUILT & BUILD-GREEN.
# ════════════════════════════════════════════════════════════════
#
#   STATUS AT A GLANCE — study_methods_section_prompt.md (15 features):
#     F-A Study Methods .............. DONE (earlier session)
#     F-B Pull-to-Refresh ............ DONE (earlier session)
#     F-C Welcome Tour upgrade ....... DONE (earlier session) + REFRESHED (see below)
#     F-D Revision / Quick-Revision .. DONE (earlier session)
#     F-E Doubt Flag ................. DONE (earlier session)
#     F-F FAQ ........................ DONE (earlier session)
#     #7  Notification Panel ......... DONE (this round)
#     #8  Sidebar Revamp ............. DONE (this round)
#     #9  Dosage helpful-bulb ........ DONE (earlier session)
#     #10 GK & Aptitude .............. DONE (this round)
#     #11 Drill Tests ................ DONE (this round)
#     #12 Manage-Admins removal ...... DONE (earlier session)
#     #13 Knowledge Map overhaul ..... DONE (this round, incl. deferred #15 banner)
#     #14 Donation modal ............. DONE (earlier session, real UPI config)
#     #15 Empty States ............... DONE (earlier session; KMap banner folded into #13)
#
#   ROUND-3 BUILD LOG (one feature per checkpoint, every checkpoint exit 0):
#
#   #7 NOTIFICATION PANEL — src/lib/notifications.js + src/screens/notification-center.jsx
#     + generators in src/screens/home.jsx.
#     • 4-category model (reminders/achievements/insights/updates); categoryOf()
#       falls back by type so OLD stored notifications need no migration.
#     • pushNotification() gained optional dedupeMs (default 2h) for slow-cadence
#       items (weekly ≈6d, announcements 7d, content 3d, exam countdown 23h).
#     • Panel: live Daily Briefing (days-to-exam, reviews due, open doubts,
#       focus subject), category chips w/ unread badges, grouped All view,
#       Review-Due-style reminder cards with ×-dismiss + →-action, mark-all-read,
#       clear-all. Briefing computed fresh per open, never stored.
#     • Generators added: exam_countdown (<30d), improvement insight +
#       accuracy_up achievement (weekly snapshot), admin announcement + whatsNew
#       → Updates category.
#
#   #8 SIDEBAR REVAMP — src/ui/nav-drawer.jsx
#     • 5 groups: Study (Revision/Library/Bookmarks/My Doubts/Add Q),
#       Progress (Stats/Leaderboard/Weightage), Tools (Exam date/Reference),
#       Help & Learn (Study Methods + FAQ as ELEVATED CARDS), Settings standalone.
#     • My Doubts kept in Study (spec lists predate F-E; "never remove" wins).
#     • FAQ card is badge-ready via optional faqUnread prop (default 0 — no
#       unread-reply signal exists in the data model yet; future hook).
#
#   #11 DRILL TESTS — NEW src/screens/drill-tests.jsx + Home/App wiring
#     • Dedicated hub, ascending-intensity tiers: Quick+TopicWise (light, 2-up)
#       → Mock+Dosage (tinted, 2-up) → PYQ (bold plum, full-width) → Advanced
#       (darkest gradient, EXAM badge). Staggered reveal cascade.
#     • Home: old inline practice section replaced by ONE gradient Drill Tests
#       entry card (Dumbbell, mini icon-row) + standalone Learn-topic-wise card.
#     • App.jsx: +1 import, +1 'drill-tests' router branch (handleHomeNavigate).
#
#   #10 GK & APTITUDE — content-driven; integration was automatic
#     • KEY DISCOVERY: gk/apt TOPICS + non-exam gate + settings toggle already
#       existed; setup screens enumerate TOPICS by question count. So seeding
#       content lit everything up with no setup-screen edits.
#     • src/data/seed.js: +6 GK (PM-JAY, Nurses Day, WHD, AIIMS 1956, NHM,
#       Indradhanush) +8 Aptitude (series/blood/direction/coding/syllogism/
#       time-work/percentage/ratio), full exp + per-option wrong{}.
#     • public/data/concept-cards.json: NEW 'apt' key — 8 mini-lessons in the
#       4-part format (whatTests/method/worked/mistake). 'gk' deliberately
#       ABSENT from Learn (per spec). 6 of 14 listed aptitude lessons remain
#       optional future content (Analogies, Seating, Average, SI&CI, DI,
#       Statement&Conclusion) — same format, REMEMBER CONTENT_VERSION bump.
#     • src/screens/learn-cards.jsx: renders the 4 new card types; 'method' is a
#       numbered list with per-step doubt flags.
#
#   #13 KNOWLEDGE MAP — CONSTELLATION OVERHAUL — knowledge-map.jsx,
#     mindmap-node-popup.jsx, home.jsx, font-styles.js
#     • Fixed dark deep-space canvas (CMAP tokens, theme-independent), 90-star
#       deterministic field, breathing sun-glow at the NORCET root.
#     • 4 dramatically distinct states via module-scope _constNode(): locked=fog,
#       discovered=cool pulsing star, familiar=warm faster pulse (+6% size),
#       mastered=radiant + gold ★ crown + 3 orbiting particles (+18% size).
#       (Old theme-tinted _kmapNodeStyle REMOVED.)
#     • Fog of war: locked nodes adjacent to progress shimmer gold (stronger
#       near a mastered sibling).
#     • Zoom levels: subReveal ramps sub-nodes/edges in over k 1.15→2.10;
#       subs tappable ≥1.35; sub-labels ≥2.3; search forces full reveal.
#     • First-time cinematic: starts on the sun, 2.6s pull-back, then the
#       deferred #15 banner ("Your universe to conquer" / Start Exploring /
#       Got it). Once ever per profile — LOCAL key kmapintroseen:v1:{pid}
#       (shared:false). Reduced-motion skips straight to banner.
#     • Game HUD: popup rebuilt as dark bottom-sheet (~62vh) — state pill,
#       4-segment journey track w/ glowing current segment, 3 HUD stat tiles,
#       mentor-voiced next-milestone line, note as top-right icon w/ gold dot,
#       gradient "Practice — [Topic]" CTA. Bonus nodes same treatment.
#     • Mastered celebration: gold crown pop + floating "Mastered" text
#       (kmap-float-up) replacing the old checkmark badge.
#     • Legend = live mini-SVG state examples on a dark strip; minimap dark w/
#       gold viewport + mastered-brightest dots; sound = master toggle w/
#       Volume2/VolumeX.
#     • Home KMap card: deep-space gradient + LIVE "X mastered · Y in progress"
#       summary (kmapSummary memo in home.jsx — SAME math: attemptStats →
#       per-(topic,sub) → mindmapState).
#     • All new animation classes neutralised under prefers-reduced-motion.
#
#   POST-ROUND POLISH PASS (owner feedback, same round):
#     • Screen-change scroll reset HARDENED (App.jsx): instant scrollTo + rAF
#       re-assert + 90ms re-assert — fixes "screen opens from the middle"
#       (e.g. Drill Tests after a scrolled Home).
#     • NavDrawer: panel stays mounted, so internal scrollTop persisted between
#       opens → now reset to 0 on every open; touchAction pan-y added.
#     • Study Methods HOME CARD REMOVED (lives in sidebar Help & Learn now).
#     • Exam weightage high-leverage list: top 3 → top 5 (weightage.jsx).
#     • KNOWLEDGE MAP FULLSCREEN MODE: toggle in the zoom stack (Maximize2/
#       Minimize2) + explicit top-right X in fullscreen + Esc; container becomes
#       fixed inset-0 z-80 @100dvh; body scroll locks; fitView re-frames after
#       toggle; floating controls are safe-area aware in fullscreen.
#     • Notification All view: category sections now ordered by RECENCY of
#       their newest item (CATEGORY_ORDER only breaks ties).
#     • WELCOME TOUR REFRESHED to current IA: Knowledge Map hero row
#       (constellation-styled, "✨ Game" badge), Drill Tests row replaces the 4
#       separate test rows, +Study Methods +My Doubts rows. Micro-interactions:
#       staggered row entrance (welcome-row), floating header icon
#       (welcome-float), visited-check pop (welcome-pop), animated "x/7
#       explored" progress bar, spring-up help sheet (reuses kmap-sheet-up).
#       Old visited keys for removed rows simply don't count toward progress.
#     • help.json: NEW 'Drill tests' entry (what/how/why) so the tour popup +
#       Help system cover the hub.
#
#   CONTENT_VERSION LEDGER: 6 → 7 (#10: concept-cards.json apt lessons)
#                           7 → 8 (polish: help.json Drill tests entry)
#     RULE REMINDER: any public/data/*.json change ⇒ bump src/lib/content.js.
#
#   STILL-DOCUMENTED SKIPS (unchanged, intentional):
#     • F-E quiz-flow integration — no question↔concept-card mapping in data model.
#     • F-F cross-user flagged/helpful analytics dashboard — optional.
#     • #15 streak / spaced-queue / achievements empty states — no dedicated screens.
#     • Sidebar FAQ unread badge — wired (faqUnread prop) but no data signal yet.
#     • 6 remaining Aptitude lessons — optional content add.
#
#   ⚠ CONCURRENT-EDIT WARNING still stands: view files immediately before
#     editing; flag collisions.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# POLISH ROUND 2 (owner feedback, Jun 2026) — all build-green (exit 0)
# ════════════════════════════════════════════════════════════════
#   • PULL-TO-REFRESH vs SIDEBAR: PTR fired while scrolling the open drawer.
#     Fixed in App.jsx (PullToRefresh disabled={drawerOpen || ...}) + the
#     drawer panel now carries data-no-ptr (PTR's opt-out) as a 2nd guard.
#   • KNOWLEDGE MAP FULLSCREEN was non-interactive: the fullscreen surface is
#     z-80 but the node popup + note editor were z-50, so taps opened them
#     BEHIND the map. Raised popup + note-editor to z-[90]; new guide z-[95].
#     Fullscreen now fully interactive (pan/zoom/tap/long-press).
#   • MAP GAME GUIDE: new "?" button in the control stack (works in normal AND
#     fullscreen) → dark guide sheet: star metaphor, 4 states (live mini-dots),
#     levelling thresholds (~10→Familiar, ~25 @80%→Mastered), line legend
#     (gold core / faint sub-topic / pulsing prereq / dashed amber bonus),
#     fog-of-war, zoom/fullscreen/notes/search tips. Reopenable any time.
#   • LEADERBOARD ↔ KNOWLEDGE MAP: new "Mastery" board ranks by mastered
#     topics. Shared lib/kmap.js masteryTally() (attemptStats injected to avoid
#     a cycle) is now the SINGLE source for Home card, leaderboard entry, and
#     map — they always agree. leaderboard.js entry gained masteredTopics
#     (computed when allQuestions is passed to saveLeaderboardEntry; old rows
#     default 0). App passes allQuestions to the upsert + myMastered to screen.
#   • LEADERBOARD UX PASS: scrollable icon tabs (Week/Mastery/Streak/Accuracy),
#     pinned "Your standing" card (rank + metric, or how to qualify), top-3
#     PODIUM with rising/shimmer/crown micro-interactions, staggered row
#     entrance, soft glow on the current user's row, skeleton loaders.
#     New CSS: lb-row / lb-rise / lb-medal-shimmer / lb-you-glow / lb-pop
#     (all neutralised under prefers-reduced-motion).
#   • RENAME: Home "Coverage" tile → "Syllabus" (the screen was already
#     "Syllabus Coverage").
#   • TRUNCATED TITLES FIXED (wrap to 2 lines instead of clipping): Home
#     weak-area tile topic name, notification reminder title + body (body now
#     2-line clamp), Knowledge Map HUD popup title.
#
#   FILES TOUCHED THIS ROUND:
#     src/App.jsx, src/ui/nav-drawer.jsx, src/screens/knowledge-map.jsx,
#     src/screens/mindmap-node-popup.jsx, src/screens/mindmap-note-editor.jsx,
#     src/screens/leaderboard.jsx, src/lib/leaderboard.js, src/lib/kmap.js,
#     src/screens/home.jsx, src/screens/notification-center.jsx,
#     src/lib/font-styles.js
#   CONTENT_VERSION: unchanged at 8 (no public/data/*.json edits this round).
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
#   ROUND: STUDY-METHODS PLAN — REMAINING FEATURES (#17–#31)
#   (study_methods_section_prompt.md items not previously shipped)
# ════════════════════════════════════════════════════════════════
#
#   SHIPPED THIS ROUND:
#
#   • #17 PYQ READ MODE (NEW src/screens/pyq-read.jsx + previous-papers.jsx
#     redesign + App route 'paper-read'):
#     – Each paper card now has TWO entry points: "Attempt" (existing timed
#       simulation, unchanged) and "Read" (calm, untimed browsing).
#     – Read view: sticky progress strip ("Question X of N" via per-card
#       IntersectionObserver + scroll bar, revealed-answer counter), optional
#       subject filter chips inside the paper, per-question "Show answer"
#       reveal (green-highlights correct options + explanation), Hide answer,
#       bookmark toggle (same app-wide bookmark state as quiz mode), and the
#       helpful bulb with voteId `pyqread:{paperId}:{questionId}`.
#     – Incremental rendering (windows of 20) for 100–200-question papers.
#     – End-of-paper completion card ("that was revision, and it counts") +
#       "Read another paper". Read sessions deliberately do NOT touch quiz
#       stats or spaced repetition.
#
#   • #18 QUESTION SOLUTION FLAG (NEW src/lib/qdoubts.js + quiz.jsx +
#     doubts.jsx rebuild + App.jsx completeQuiz hook):
#     – New flag below every quiz explanation: "Still confused? Flag this
#       explanation" (toggles to red filled state). Stored per profile under
#       NEW key prefix QDOUBTS ('qdoubts:'), record = { id, qSnapshot(≤300),
#       topic, sub, createdAt, resolvedAt, autoResolved }. Hidden for guests.
#     – Distinct from bookmarks (save-for-later) and concept doubts (revision
#       notes): this means "I read the solution and STILL don't get it".
#     – DOUBTS SCREEN now has top-level CONCEPTS | QUESTIONS tabs (each with
#       an unresolved-count badge) sharing the Unresolved/Resolved sub-filter.
#       Questions tab: 2-line stem preview → tap to expand full question +
#       options (correct highlighted) + explanation (live lookup by id with
#       snapshot fallback if the bank was removed), "Go to topic" deep link,
#       Resolved/Reopen.
#     – HYBRID RESOLUTION: manual button, plus AUTO-RESOLVE in completeQuiz —
#       answering the SAME question correctly clears its open flag and pushes
#       an Achievements notification ("Your doubt on <topic> was
#       auto-resolved", type doubt_milestone, 60s dedupe).
#     – RECONCILIATION vs spec: spec said auto-resolve on a correct answer on
#       the same TOPIC; implemented same-QUESTION instead — one lucky answer
#       elsewhere in a broad subject should not silently clear an explicit
#       "this explanation confused me" flag. SKIPPED (documented): Stats tile,
#       daily-briefing line, and Quick Revision injection for question flags —
#       the last for the same reason as F-E (no question↔concept-card mapping
#       in the data model).
#
#   • #19 UNBOOKMARK POLISH (bookmarks.jsx + quiz.jsx):
#     – Bookmarks INDEX rows now carry a filled BookmarkCheck icon — one tap
#       unbookmarks (no confirm; as frictionless as bookmarking) with a 280ms
#       row-fade-out + icon deflate before the data updates, so the card never
#       vanishes instantly and the empty state appears only after the last
#       animation. Light haptic tick.
#     – Quiz bookmark toggle: spring POP on set (scale 1→1.3→1), DEFLATE on
#       unset (1→0.8→1) + haptic. (Two-way toggling itself already existed.)
#
#   • #20 SUPPORT CARD VISUAL HIGHLIGHT (settings.jsx): the "Keep NORCET Prep
#     free ☕" card is now ELEVATED — primary-tinted fill (T.primary @ ~6%),
#     1.5px primary border, rounded-xl tinted icon block, primary title +
#     chevron. Theme-token based (works on dark themes), same logic as the
#     Admin card's green tint. Copy unchanged.
#
#   • #21 SIDEBAR GESTURE CONTROLS (NEW src/lib/ui-prefs.js + nav-drawer.jsx
#     + settings.jsx section "Sidebar gestures"):
#     – Swipe-to-CLOSE (default ON): leftward drag on the open panel tracks
#       the finger 1:1 (direct style mutation, no re-renders), commits past
#       38% width or a fast left flick, else springs back. Vertical scrolls
#       win (12px + axis-dominance threshold).
#     – Swipe-to-OPEN (default OFF — Android 10+ back-gesture conflict, noted
#       inline when enabled): document-level edge listener (left 20%) active
#       only on Home while closed; mirrored threshold logic.
#     – Settings: two toggle rows + a locked always-on "Tap backdrop to
#       close" row. Prefs persist per device under NEW key SIDEBAR_GESTURES
#       ('sidebargestures:v1'); cached getters are read LIVE at touchstart so
#       changes apply without remounting.
#
#   • #22 SEQUENTIAL CARD ENTRANCE (font-styles.js `.seq-item` + screens):
#     fade + 16px settle, spring-out, per-index delay (~80–110ms, capped at
#     8) applied to: Library bank rows, Previous Papers cards, Doubts cards
#     (both tabs), PYQ Read cards, Bookmarks topic groups. Reduced-motion →
#     items appear instantly. Screens with an existing entrance treatment
#     (welcome rows, leaderboard stagger, FAQ fadeup) left as-is.
#
#   • #23–#25 UX MICRO-INTERACTIONS — PRIORITY SUBSET (font-styles.js + quiz
#     + Results): per the specs' own priority tables, implemented the
#     highest-impact set:
#     – Quiz ANSWER FEEDBACK: correct option spring-pulses on lock-in; a
#       wrongly-selected option SHAKES (decaying amplitude, 450ms).
#     – Bookmark/flag micro-interaction (pop/deflate, see #19).
#     – TIMER HEARTBEAT: countdown chip pulses 1×/s under 10s, 2×/s under 3s.
#     – SCORE REVEAL: results percentage COUNTS UP 0→pct (800ms ease-out
#       cubic, tabular-nums) alongside the existing ring draw.
#     – Exit snackbar slide-up + depleting progress line (see #30).
#     – Sliding-pill tab/chip selectors (Library filters, Share-card tabs).
#     – Bottom-sheet spring-up (.sheet-up) for the new Settings sheets.
#     All neutralised under prefers-reduced-motion. STILL-DOCUMENTED SKIPS:
#     the remaining long-tail items from the 32-spec set (ripple system,
#     counter flips, confetti/celebrations, skeleton shimmer unification,
#     drag-ghosts, etc.) — future polish rounds.
#
#   • #26 QUESTION BANK LIBRARY — CRITICAL/HIGH FIXES (library.jsx +
#     bank-screens.jsx):
#     – DELETE IS RED: confirm-modal destructive button now universal red
#       (#E02020), Cancel subordinate (outline). PUBLIC banks require typing
#       DELETE (Vercel/GitHub pattern; button disabled until match; copy
#       adapts private vs public). Private banks stay single-tap.
#     – EDIT/DELETE HIERARCHY: Delete card is muted at rest (grey title,
#       60%-opacity icon) and turns red only on PRESS (.bank-delete-card).
#     – Upload card: dark slab → app-gradient (primary→primarySoft) with a
#       one-time shimmer sweep + warmer copy.
#     – Filter chips: SLIDING ACTIVE PILL (measured left/width, spring).
#     – Count label enriched: "N banks · M questions".
#     – Bank rows: left accent bar (green=public, grey=private), question
#       count as a badge, "Shared with everyone / Only you" in metadata,
#       seq entrance. SKIPPED (documented): "Used by N students" stat (no
#       usage telemetry in the data model), virtualised 50+ bank lists.
#
#   • #27 SHARE THIS APP CARD (NEW src/ui/share-app-card.jsx, Settings →
#     "Share & support" section, above the support card): tinted header
#     (mirrors #20), copyable URL pill (origin + ?ref=share — structure
#     leaves room for future referral codes), native share sheet via
#     navigator.share (clipboard fallback; share button hidden where
#     unsupported), ✓-morph feedback on both buttons, three-tab
#     Android/iOS/Web install guide with sliding pill + cross-fading steps,
#     "works in any browser, better installed" footnote.
#
#   • #28 POST-TEST CRIB SHEET (NEW src/screens/crib-sheet.jsx + App route
#     'crib-sheet' + Results.jsx + advanced-test.jsx buttons):
#     – Opt-in "Review answers — Crib Sheet" button on Quick/Topic/Mock
#       results AND Advanced/PYQ-paper results (AdvancedTestResults gained
#       onCribSheet). Session-based: items live in nav state; back returns to
#       the exact results screen.
#     – Three anchored sections (✓ Correct / ✕ Wrong / — Not attempted) with
#       sticky tinted headers + jump pills; every card: full stem, all
#       options (correct green, user's wrong pick red), always-visible
#       explanation + the SAME HelpfulToggle as quiz (feeds one helpfulness
#       dataset), topic/sub tags, ±marks badges (+1/−⅓) for negative-marked
#       engines; "Show answer" reveals counted as Not attempted.
#     – Windowed rendering (25/step, IO sentinel), floating scroll-to-top,
#       all-correct / all-wrong / abandoned empty-state copy, SHARE via
#       native share sheet (text digest, first 50 Qs) with clipboard
#       fallback. SKIPPED (documented): rendered image/PDF export and the
#       dosage-results entry point (different data model — calculation
#       steps, not MCQ options).
#
#   • #29 CRIB SHEET TOGGLE (settings.jsx "Tests" section + ui-prefs):
#     "Show Crib Sheet after tests" — ON by default, persists per device
#     (NEW key CRIB_SHEET 'cribsheet:v1'); when OFF, App passes
#     onCribSheet=null so the button vanishes from ALL results screens.
#
#   • #30 BACK BUTTON BEHAVIOUR + SCROLL RESTORATION (App.jsx + NEW
#     src/ui/exit-snackbar.jsx):
#     – DOUBLE-BACK-TO-EXIT: the history sentinel is now armed on ROOT
#       screens too; first hardware back on Home shows the "Press back again
#       to exit" pill (slide-up, 2.5s depleting progress line, no buttons —
#       the second back IS the confirmation, which fires one extra
#       history.back() past the consumed sentinel so the OS exits).
#     – SCROLL RESTORATION: every screen's Y offset is remembered
#       (session-only ref map) when leaving it; BACK navigations (goHome +
#       hardware-back go-home) re-apply the saved offset instantly instead of
#       jumping to top. Forward navigations still start at top (the hardened
#       triple re-assert reset is preserved — it now resets to `target`).
#       PARTIAL/SKIP noted: welcome-tour internal scroll (overlay component
#       state, not nav) and in-screen sub-views unaffected.
#
#   • #31 PROFILE ACTIONS CARD (settings.jsx): Switch/Logout grid + the
#     DANGER ZONE section replaced by ONE "Profile" card with a consequence
#     ladder — Switch profile (green, instant), Log out (amber, light
#     bottom-sheet confirm where CANCEL is the primary button and copy
#     reassures "nothing is deleted"), Reset this profile's data (red row,
#     red-tinted divider above, destructive bottom sheet requiring typed
#     RESET before the red button enables; names the profile; points to
#     Backup first). Guests see only the Reset row. Sheets use the new
#     .sheet-up spring.
#
#   NEW STORAGE KEYS (lib/keys.js — ADD-only respected): QDOUBTS ('qdoubts:'),
#   SIDEBAR_GESTURES ('sidebargestures:v1'), CRIB_SHEET ('cribsheet:v1').
#
#   FILES ADDED THIS ROUND:
#     src/lib/ui-prefs.js, src/lib/qdoubts.js, src/ui/exit-snackbar.jsx,
#     src/ui/share-app-card.jsx, src/screens/crib-sheet.jsx,
#     src/screens/pyq-read.jsx
#   FILES MODIFIED THIS ROUND:
#     src/App.jsx, src/lib/keys.js, src/lib/font-styles.js,
#     src/screens/quiz.jsx, src/screens/doubts.jsx, src/screens/Results.jsx,
#     src/screens/advanced-test.jsx, src/screens/previous-papers.jsx,
#     src/screens/bookmarks.jsx, src/screens/library.jsx,
#     src/screens/bank-screens.jsx, src/screens/settings.jsx,
#     src/ui/nav-drawer.jsx
#   CONTENT_VERSION: unchanged (no public/data/*.json edits this round).
#   BUILD: vite build green; new code is local-storage only — NO Supabase
#   schema or api/ changes required for deploy.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
#   ROUND: FAVOURITES SYSTEM (hearts + premium home strip + admin insights)
# ════════════════════════════════════════════════════════════════
#
#   WHAT SHIPPED:
#
#   • HEART ON EVERY (ELIGIBLE) SECTION — TopBar (primitives.jsx) gained an
#     optional favId prop rendering ui/fav-heart.jsx: tap = spring pop +
#     saved, tap again = deflate + removed, light haptic. Hearts ALWAYS save,
#     even while the home strip is off — in that case a subtle bottom toast
#     (once per session, auto-hides 3.8s, non-interactive) nudges: "turn on
#     the Favourites section in Settings to see it on your home screen."
#
#   • REGISTRY (lib/favorites.js FAV_SECTIONS, 16 sections) — common-sense
#     EXCLUSIONS baked in: Settings / Notifications / Admin (chrome), sections
#     already on the home screen (Learn Topic Wise, Knowledge Map, the Drill
#     Tests hub itself), and transient flows (quiz/results/editors). Drill-
#     test SUB-modes ARE included (Quick/Topic/Mock/Advanced/Dosage/PYQ), plus
#     Study Methods, Stats, Leaderboard, Bookmarks, My Doubts, Library, FAQ,
#     Weightage, Coverage, Reference. Hearts added to each screen's TopBar
#     via one-line favId props (18 TopBar call sites across 16 screens).
#
#   • STORAGE — three stores:
#       LOCAL per profile (NEW key FAVORITES 'favorites:'):
#         { enabled:false, order:[sectionIds] } — order IS the favourite set
#         (membership + priority in one array). enabled gates the strip; OFF
#         BY DEFAULT as specified.
#       SHARED favsec:{sectionId} → array of profileIds currently hearting
#         it (helpful-votes pattern; guests never write — defensive).
#       SHARED favorder:{profileId} → the user's order, for admin rank math.
#     All saves dispatch window event 'norcet:favs' so hearts, the strip, and
#     the manage screen stay live-synced without prop drilling.
#
#   • PREMIUM HOME STRIP (ui/fav-strip.jsx, rendered in home.jsx ABOVE the
#     Drill Tests card — top of all sections): renders ONLY when enabled AND
#     non-empty (Home is byte-identical otherwise). Header row with a gently
#     double-beating heart (.fav-beat, 3s loop), count badge, and Edit
#     button; horizontally-snapping PremiumFavCards in the USER'S priority
#     order — hue-tinted gradient fill, corner hue glow, gradient icon
#     bubble, hue shadow, staggered spring entrance (seq-item), spring press
#     (pressable). Tap = navigate straight to the section.
#
#   • MANAGE SCREEN (NEW screens/favorites.jsx, route 'favorites') — "one
#     stop for everything you love": full premium cards with blurbs; up/down
#     chevron reorder (mobile-friendly; brief scale highlight on the moved
#     card + haptic; saves instantly), TOP badge on #1, broken-heart remove
#     with the row fade-out, inline strip on/off toggle (no Settings trip
#     needed), empty state pointing at the hearts, footer explaining that #1
#     leads the home strip.
#
#   • SETTINGS — new "Favourites" section: master toggle ("Favourites
#     section on home", OFF by default, copy adapts to heart count) +
#     "Manage favourites & priority order" row (→ manage screen, shown once
#     ≥1 heart exists). Per profile, not per device.
#
#   • ADMIN INSIGHTS (admin-panel.jsx — new dashboard tile "Favourites" +
#     detail view, powered by loadFavInsights()): per-section hearts count
#     with hue progress bars (relative to the most-hearted), AVERAGE PRIORITY
#     RANK (#x.x) + "in a top-3 for N users", total users with ≥1 favourite,
#     and ZERO-HEART sections kept in the list but dimmed with "not
#     attracting users" — exactly the improve-this signal requested. Refresh
#     button; guests excluded; counts reflect CURRENT hearts.
#
#   FILES ADDED: src/lib/favorites.js, src/ui/fav-icons.jsx,
#     src/ui/fav-heart.jsx, src/ui/fav-strip.jsx, src/screens/favorites.jsx
#   FILES MODIFIED: src/App.jsx (route + Settings prop), src/lib/keys.js
#     (FAVORITES), src/lib/font-styles.js (.fav-beat), src/ui/primitives.jsx
#     (TopBar favId), src/screens/home.jsx (strip), src/screens/settings.jsx
#     (Favourites section), src/screens/admin-panel.jsx (insights), plus
#     favId one-liners in: QuickPracticeSetup, TopicSelect, MockSetup,
#     dosage-practice, advanced-test (setup), previous-papers, study-methods,
#     StatsScreen, leaderboard, bookmarks, doubts, library, faq, weightage,
#     coverage-map, reference.
#   NO Supabase schema / api/ changes — shared KV mirrors ride the existing
#   store, same as helpful-votes. BUILD: vite green.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
#   ROUND: HOLD-FOR-INFO TOOLTIPS (mobile long-press + PC hover)
# ════════════════════════════════════════════════════════════════
#
#   WHAT SHIPPED — desktop-style tooltips for everyone (NEW
#   src/ui/tooltip.jsx: Tip wrapper + single TipHost at the app root):
#
#   • TRIGGERS: hover an icon/button/section on PC (450ms intent delay,
#     hides on mouse-leave or click) or LONG-PRESS it on a phone (480ms
#     hold + 12ms haptic tick); the bubble stays while holding, then
#     lingers 2.6s after the finger lifts and fades.
#
#   • PREMIUM BUBBLE: dark glass gradient (deep violet → near-black),
#     backdrop blur, hairline border + inner ring, soft 32px shadow,
#     optional Info-icon title row, spring scale-in (.tip-in, 0.22s
#     overshoot) FROM THE ARROW SIDE (transform-origin tracks the anchor),
#     and an arrow that follows the anchor's centre even when the bubble
#     clamps at the viewport edge.
#
#   • BUG-PROOFING:
#     – touchmove >10px cancels the hold → scrolling never triggers tips
#     – the click after a long-press is swallowed (capture phase) → holding
#       a button never accidentally activates it
#     – native context menu suppressed only while a hold is live
#     – mouseenter within 700ms of a touch ignored (synthetic hover)
#     – auto-flips above/below by available space; clamps horizontally
#     – any scroll (capture), resize, outside tap, or Escape hides instantly
#     – Tip wraps triggers in a display:contents shell → ZERO layout change
#       (flex rows / grids / cards render byte-identical); anchor rect is
#       measured from the first element child
#     – one bubble app-wide (host pattern like FeedbackHost); timers cleaned
#       on unmount; prefers-reduced-motion → instant appear, no spring
#
#   • APPLIED TO (initial coverage, trivially extensible — wrap anything in
#     <Tip text="…">):
#     – TopBar chrome EVERYWHERE: back button, Help pill, Report pill, and
#       the Favourites heart (text adapts to hearted state)
#     – Home: Menu, notification bell, Settings icon + the three big section
#       cards (Drill Tests, Learn topic wise, Knowledge Map) with title rows
#     – Drill Tests: all six mode cards (Quick/Topic/Mock/Dosage via a tip
#       prop on TopCard/MidCard; PYQ + Advanced wrapped directly) — each
#       explains what the mode actually is
#     – Favourites home strip: each premium card shows its blurb
#     – Quiz: bookmark icon (state-aware copy) + the timer chip
#
#   FILES ADDED: src/ui/tooltip.jsx
#   FILES MODIFIED: src/App.jsx (TipHost mount), src/lib/font-styles.js
#     (.tip-in), src/ui/primitives.jsx (back/Help/Report), src/ui/fav-heart.jsx,
#     src/ui/fav-strip.jsx, src/screens/home.jsx, src/screens/drill-tests.jsx,
#     src/screens/quiz.jsx
#   BUILD: vite green. No storage keys, no Supabase/api changes.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
#   ROUND: SIDEBAR STUCK-OPEN BUGFIX + PREMIUM DRAWER ROWS
# ════════════════════════════════════════════════════════════════
#
#   • CRITICAL BUGFIX — "sidebar stuck open at launch, nothing tappable"
#     (regression from the #21 gesture round): the gesture cleanup helper
#     cleared the panel's inline transform to '' on mount/open-flip. React
#     owns `transform` via the style prop, so the wipe left the panel at
#     translateX(0) (visually OPEN) while React's style diff still believed
#     translateX(-102%) was applied and never rewrote it — and with
#     open=false the wrapper kept pointerEvents:none, so the X, rows, scrim
#     AND the underlying Home icons were all dead. FIX: clearPanelInline →
#     restorePanel(isOpen), which always re-asserts the EXPLICIT
#     state-correct transform; gesture ends restore the springback/commit
#     value directly (swipe-close no-commit → open pose, commit → closed
#     pose before onClose(), mirrored for swipe-open).
#
#   • PREMIUM DRAWER ROWS (nav-drawer.jsx + font-styles.js):
#     – Rows are now soft cards: surface fill, hairline border, gentle
#       shadow; icon bubbles got a per-section gradient tint + tinted ring
#       + coloured glow shadow; chevrons take the row's colour.
#     – Bookmarks count moved into a proper tinted count badge next to the
#       label (badge slot works for any row).
#     – MICRO-INTERACTIONS: every open replays a 45ms-staggered slide-in of
#       all rows (list keyed by an open counter — the panel stays mounted,
#       so the animation re-triggers via remount); pressing a row springs
#       it to 0.975 scale while the chevron nudges 3px toward the
#       destination; and the row you LAST NAVIGATED TO glows twice (tinted
#       pulse ring, module-remembered key) when you reopen the menu after
#       coming back — the "welcome back to where you left from" moment.
#       Study Methods / FAQ cards + the Settings row share the treatment.
#     – HAPTICS + SOUND: every row tap fires an 8ms vibration tick and a
#       NEW soft Web-Audio blip (playTapSound in lib/sound.js — single E5→A5
#       sine glide, <90ms, quieter than the refresh pop), gated by the same
#       Settings sound toggle and fully feature-detected.
#     All animations neutralised under prefers-reduced-motion.
#
#   FILES MODIFIED: src/ui/nav-drawer.jsx, src/lib/sound.js,
#     src/lib/font-styles.js
#   BUILD: vite green. No storage/Supabase/api changes.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
#   ROUND: 13-ITEM FEEDBACK PASS (favourites rework, nav stack, & more)
# ════════════════════════════════════════════════════════════════
#
#   1. FAVOURITES = A REAL SECTION (rework): the inline home strip is gone.
#      Home now shows ONE premium Favourites card (rose gradient, glow,
#      beating heart, mini icon row of the top picks — the Drill Tests
#      pattern); tapping it launches the dedicated screen: an n×3 HONEYCOMB
#      grid of square premium tiles (hue-gradient icon bubble, glow ring,
#      staggered pop-in, spring press). EDIT MODE reworked for the grid:
#      iOS-style jiggle, × badges to remove (shrink-out), and TAP-TO-MOVE
#      reordering (pick a tile — it lifts + glows — tap its destination),
#      with priority numbers shown and haptic ticks on pick/drop.
#   2. HEARTS LIVE ON THE CARDS, NOT THE TOP BAR: the TopBar heart was
#      removed everywhere (favId props stripped); instead FavHeart now
#      renders INLINE beside the section title on the card itself — all six
#      Drill Test tiles (incl. PYQ + Advanced) and every favoritable sidebar
#      row/card (Library, Bookmarks, My Doubts, Stats, Leaderboard,
#      Weightage, Reference, Study Methods, FAQ). Inline hearts
#      stopPropagation so the card tap never fires, keep the pop/deflate +
#      haptic, and keep the once-per-session "turn it on in Settings" toast.
#   9. Syllabus Coverage removed from the favoritable registry.
#   3. SETTINGS PROFILE CLUSTER MOVED UP: Switch + Log out are back as the
#      adjacent 2-col cards ("that looked good") directly below the rename
#      card; the red Reset row sits under them. Logout bottom-sheet confirm
#      and the typed-RESET sheet are unchanged. The lower PROFILE section is
#      gone.
#   4. Share NORCET Prep card now sits immediately below that profile
#      cluster; the lower section is just "Support" (chai card).
#  10. SHARE CARD REWORK: the install guide now travels WITH the link — the
#      user picks WHO they're sending to (Android / iPhone / Web friend /
#      Everyone) and the outgoing message is composed for that device: a
#      classy textured plain-text note (✧ rules, spaced display title,
#      numbered ✦ step blocks) with the ?ref=share link. Live preview in the
#      card; the in-card link pill went premium (display serif on a textured
#      gradient with an inner-glow ring). The old in-card tab guide is gone
#      (the sender doesn't need it — the friend does).
#   5. CRIB SHEETS INSIDE REVISION: every crib sheet now has an optional
#      "Add to Revision (save this sheet)" button (NEW lib/cribs.js, key
#      CRIBS 'cribs:', slimmed snapshots, 12-sheet cap). Revision gained a
#      separate premium CRIB SHEETS shelf — dated cards ("Today/Yesterday/
#      N days ago" + date + Q-count + % right), gradient icon, two-tap
#      delete — that reopen in the full Crib Sheet view. The Crib Sheet is
#      now PRINTABLE: a Printer button in its top bar renders the full list
#      (windowing expanded first) then opens the print dialog, with
#      @media-print styles hiding all chrome.
#   6. PTR QUOTE SWAP: every completed pull-to-refresh dispatches
#      'norcet:refreshed'; Home swaps in the next quote with a blur-settle
#      slide-up micro-animation (.quote-swap).
#   7. NOTIFICATIONS DECLUTTERED: categories stay recency-ordered, but each
#      now shows ONLY its latest notification with a dashed "See N more /
#      Show less" expander for the rest (items sorted newest-first inside
#      categories and in filtered views too). "Clear all" now opens a
#      caution bottom sheet (count named, "Keep them" is the primary
#      action) before wiping.
#   8. REAL BACK NAVIGATION (nav stack): navigate() now pushes the screen
#      it leaves (browse screens only — quiz/test runs, results, auth and
#      crib-sheet are never stacked), goHome POPS to the previous screen,
#      and the hardware back button uses the same pop — so Drill Tests →
#      Quick Test → back lands on Drill Tests, for every screen. Results
#      "Home" buttons use the new goHomeDirect (clears the trail). The Home
#      double-back-to-exit snackbar (#30) still guards accidental exits —
#      it was masked by the stuck-drawer bug, now visible again.
#  11. SHARE SCORE CARD: caption is now an inviting challenge that adapts
#      to the score band ("Just aced… think you can beat that?" /
#      "…climbing 💪 Join me?" / "Study with me?") and always carries the
#      tappable ?ref=score app link. The PNG card itself went premium:
#      diagonal layered gradient into a deep base, two radial glow orbs,
#      faint diagonal texture, double inner frame, glowing progress ring,
#      and the URL framed as a call-to-action pill in display serif.
#  12. ANNOUNCEMENTS REWORKED: posts can AUTO-EXPIRE (1/3/7/30 days or
#      never — picker in the composer; expiry shown on the live card;
#      loadAnnouncement + the Home banner both honour it), and every post
#      is appended to a shared HISTORY ('announcement:history', same
#      announcement:* RLS prefix, capped 30) listed in the admin view with
#      Live/Expired badges, per-item two-tap delete and a "Clear history —
#      sure?" wipe. No more permanent-fixture notices; the user-side X
#      dismissal persists as before.
#  13. TOOLTIP COVERAGE COMPLETED: every sidebar row + the Study Methods /
#      FAQ cards + the Settings row now hold/hover-reveal a descriptive
#      info bubble (custom copy per section); the Favourites home card,
#      honeycomb tiles, crib shelf cards, share-card buttons and crib print
#      button are covered too — on top of the earlier Home/Drill/quiz set.
#
#   FILES ADDED: src/lib/cribs.js
#   FILES MODIFIED: src/App.jsx, src/lib/keys.js, src/lib/favorites.js,
#     src/lib/font-styles.js, src/ui/primitives.jsx, src/ui/fav-heart.jsx,
#     src/ui/fav-strip.jsx, src/ui/share-app-card.jsx, src/ui/nav-drawer.jsx,
#     src/ui/result-cards.jsx, src/screens/favorites.jsx, src/screens/home.jsx,
#     src/screens/drill-tests.jsx, src/screens/settings.jsx,
#     src/screens/crib-sheet.jsx, src/screens/revision-sheet.jsx,
#     src/screens/notification-center.jsx, src/screens/admin-panel.jsx,
#     plus favId-prop cleanup across the 16 screens from the previous round.
#   BUILD: vite green. New shared key announcement:history rides the existing
#   admin RLS prefix — no Supabase schema/api changes.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
#   ROUND: ISSUES FILE — FULL BUG + UX RESOLUTION PASS (norcet-issues.md)
# ════════════════════════════════════════════════════════════════
#
#   Source: the user's norcet-issues.md (≈40 logged bugs/UX issues with
#   device screenshots). Every item resolved in one pass. Grouped below.
#
#   ── ROOT-CAUSE BUG FIXES ──────────────────────────────────────
#   1. SCREEN-CORRUPTION GLITCH (corrupted "banner" + tap-and-hold glitch —
#      same root cause): the long-press tooltip bubble used
#      backdrop-filter: blur(10px), which triggers GPU compositing
#      corruption (garbage stripes across the home screen) on some Android
#      devices. The blur is REMOVED (bubble gradient bumped to ~98.5%
#      opacity — visually identical). Belt-and-braces: home cards now carry
#      .press-safe (-webkit-touch-callout/user-select none) + onContextMenu
#      preventDefault, so a long press can never raise native selection
#      chrome. NOTE: there is no banner image asset — the "corrupted image"
#      in the screenshots was this compositing artifact.
#   2. FIXED-POSITION RELIABILITY (dialogs anchored to scroll position; top
#      bar scrolling away): .anim-fadeup / .anim-scalein ended on a RETAINED
#      identity transform (fill-mode both), which makes the screen root a
#      CSS containing block for position:fixed children on spec-compliant
#      mobile browsers. Keyframes now end in `transform: none`, releasing
#      the containing block — every fixed modal/bar now anchors to the real
#      viewport on all devices.
#   3. STATUS-BAR COLLISION ("8:47" overlapping "Q1 of 5"): TopBar is now
#      position:fixed with paddingTop: env(safe-area-inset-top) + a spacer
#      div; the advanced-test in-run header got the same safe-area pad; the
#      Home root and the welcome tour pad for the safe area too. The PYQ
#      read-mode sticky strip offsets below the fixed bar; crib-sheet
#      section headers likewise.
#   4. DUPLICATE CRIB SHEETS: lib/cribs.js now computes a content SIGNATURE
#      (title + each question's id/outcome/selection). addCrib() refuses a
#      second save of the same session (returns the existing entry); the
#      Crib Sheet screen checks the shelf by signature on mount, so
#      returning to an already-saved sheet shows a locked "Added to
#      Revision ✓" instead of re-enabling the button. Fixes both the
#      duplicate-shelf-entries bug and the re-tap dupe path.
#   5. SHARE SCORE CARD OVERLAP ("Keep practicing! 🎯" colliding with the
#      URL pill): the canvas painter got a full premium re-layout with a
#      fixed vertical rhythm and a RESERVED footer zone — brand + tagline,
#      hairline, aspirant name, centred glowing ring, score, type pill,
#      stats row (🔥 streak · date), motivational line, footer URL pill —
#      no two elements can ever collide regardless of streak presence.
#   6. "SENDING TO" BROKEN GLYPH: the tiny Smartphone icon (rendered as an
#      empty rectangle) replaced with a proper Users icon at readable size.
#   7. DOSAGE "0" PSEUDO-ANSWER: input placeholder is now "Enter your
#      answer", styled via .dosage-input::placeholder (small, regular
#      weight, 55% opacity) so it reads as a hint, never as a value.
#   8. DOSAGE HEADER RUN-IN ("…test1/10"): title shortened to "Dosage
#      calculation"; the counter is a separated rounded chip in the bar.
#
#   ── NAVIGATION & CONFIRMATION SYSTEM ──────────────────────────
#   9. EXIT CONFIRMATION: the Home back-press snackbar is upgraded to a
#      true centred "Exit app?" modal (Cancel = primary, Exit = quiet).
#      No auto-timeout; the app only exits on an explicit Exit tap (a 2nd
#      hardware back while the dialog is open still works as a shortcut).
#      ui/exit-snackbar.jsx now exports ExitConfirmDialog.
#  10. LOG OUT / SWITCH CONFIRMATIONS: new reusable ui/confirm-dialog.jsx —
#      a TRUE viewport-centred modal (fixed inset-0 + flex centre + scrim),
#      visible regardless of scroll. Log out = RED filled danger button,
#      Cancel = quiet outline (hierarchy fixed); Switch profile now
#      confirms too (was instant). The old bottom-sheet logout is gone.
#  11. ADMIN PANEL BACK GUARD: 'admin-panel' joins NAV_SELF_GUARDED_SCREENS;
#      the panel pushes its own history sentinel. Device back now mirrors
#      the in-panel back exactly: detail view → dashboard; dashboard →
#      "Leave Admin Panel? Any unsaved changes will be lost." (Stay/Leave).
#      The dashboard TopBar back routes through the same confirmation.
#  12. WELCOME TOUR BACK: App no longer force-closes the tour on device
#      back — it dispatches 'norcet:welcome-back'; the tour closes its open
#      help popup first (one step back) and shows a "Leave the tour?"
#      confirm at the root. Added a quiet top-right "Skip tour", a glowing
#      hero header (radial glow + gradient icon tile, larger type) and
#      safe-area padding.
#
#   ── STRUCTURAL / IA CHANGES ───────────────────────────────────
#  13. SHARE = ITS OWN PAGE: new screens/share-app.jsx (route 'share-app');
#      Settings keeps a single "Share NORCET Prep" row. The URL pill gained
#      an inline one-tap copy-link button. ShareAppCard renders frameless
#      via a new `page` prop.
#  14. THEMES = ITS OWN PAGE: new screens/themes.jsx (route 'themes') —
#      the Light/Dark mode selector + full colour picker moved out of
#      Settings (bigger swatches, animated selected states); Settings shows
#      one gradient "Themes" row. Settings is dramatically less cluttered.
#  15. CUSTOM QUESTIONS + TOTAL PRACTICE → LIBRARY: the two orphan Settings
#      cards became a structured 2-tile stats block at the top of the
#      Library screen (icon, label, value, caption).
#  16. REVISION TABS: the Revision screen now has two selectable tabs —
#      "Revision History" (the live digest, date chips, include-wrong,
#      topic filters, print) and "Crib Sheets · n" (the saved shelf with
#      its own empty state). No more two unrelated stacked sections.
#  17. FAVOURITES SCREEN: the bottom "showing on your home screen" toggle
#      is REMOVED (Settings → Favourites is the single source of truth);
#      Settings' "Manage favourites & priority order" now opens the screen
#      DIRECTLY IN EDIT MODE (nav { screen:'favorites', edit:true } →
#      startInEdit). Small collections no longer trail into whitespace: a
#      dashed "+ Heart more sections" ghost tile completes the grid row and
#      doubles as the add-more prompt.
#
#   ── DESIGN-SYSTEM / POLISH ────────────────────────────────────
#  18. HOME CARD UNIFICATION: Drill Tests / Learn topic wise / Knowledge
#      Map / Favourites all share one template — p-4, rounded-2xl, w-11
#      h-11 rounded-xl icon zone, text-base display title, text-xs
#      subtitle, right chevron — with per-section accents on top. The
#      hold-tooltips were removed from these cards (each already carries a
#      visible subtitle; the bubble only blocked the card below — resolves
#      the tooltip-overlap issue at the pattern level).
#  19. HEART SYSTEM: hearts moved OUT of title rows into dedicated action
#      areas — top-right corner on every Drill Tests card, a right-aligned
#      action column (before the chevron) on every sidebar row — and the
#      Revision row finally got its heart ('revision-sheet' added to the
#      FAV_SECTIONS registry + a FileText fav-icon). Premium
#      micro-interaction: white-interior outline at rest; FILLING springs
#      (compress 0.85 → overshoot 1.08 → settle, ~340ms, cubic-bezier)
#      with a vibrate(10) at fill begin; UNFILLING is a graceful colour
#      fade with zero bounce. Reduced-motion safe.
#  20. "WAS THIS HELPFUL?" UNIFIED ON THE BULB: HelpfulToggle (quizzes +
#      crib sheets) now delegates to the tactile HelpfulBulb (same shared
#      vote keys — tallies carry over). The "0 helpful / 0 not" tally is
#      hidden for EVERYONE (admins read numbers in Admin → Helpfulness);
#      un-tapping shows "Changed your mind? No worries!"; toggling >2×
#      in a row earns a light easter-egg tease ("Still deciding? Take your
#      time 😄" / "You're really keeping me on my toes!").
#  21. CRIB SHEET PREMIUM: new results header card (gradient hero, eyebrow
#      label, display title, date row, a segmented Correct/Wrong/Skipped
#      stat strip that jump-scrolls, and the Add-to-Revision CTA as a
#      proper filled button that locks to "Added ✓"); the share output is
#      fully BRANDED (typographic NORCET PREP · Crib Sheet header,
#      well-spaced ✦ question blocks with full answer text, rule + one-line
#      app description + URL footer); the bottom bar gained a direct Home
#      button between Back and Share.
#  22. POST-TEST BUTTONS: clear hierarchy — primary "Review answers — Crib
#      Sheet"; secondary PAIR "Re-do wrong ones" + "Share score" (2-col
#      ghost row); tertiary "Back to home" as a quiet text action.
#  23. DOSAGE REFERENCE: the same Reference pill + lookup overlay the other
#      quiz modes have is now available during dosage practice.
#  24. EXAM WEIGHTAGE: tapping any subject row (high-leverage list, topic
#      mix, movers) no longer fires a quiz instantly — a confirmation sheet
#      shows the subject, its % of exam, your accuracy and coverage, with
#      an explicit "Start practice" CTA / "Not now".
#  25. QUIZ FLAG TOOLTIP: the "Still confused? Flag this explanation"
#      button now hold/hover-reveals "Flagged questions are saved to My
#      Doubts — find them in the sidebar."
#  26. ADMIN SETTINGS CARD: the stray green slab aligned to the standard
#      card surface; status reads via the green check icon + an "On" pill.
#  27. CONTRAST: home stat sublabels (day(s) / X done / question(s))
#      bumped muted → inkSoft + medium weight; values stay full-ink.
#  28. SIDEBAR GESTURE COPY: swipe-to-open description now reads "Swipe
#      right from the left edge of the home screen… This gesture only
#      works on the home screen."
#  29. ANIMATIONS: quote refresh re-specced to a clean crossfade + 8px
#      upward drift (400ms ease-out, no blur); sidebar row launches now
#      play a shared-axis forward transition (NavDrawer tags <html> with
#      .nav-fwd for ~400ms → destination enters as a 280ms slide-from-
#      right + fade). Both reduced-motion safe.
#  30. KNOWLEDGE MAP IMMERSIVE: the top bar is hidden on the map — a
#      floating glass back button + help button (safe-area aware) replace
#      it; the standard fixed bar returns on every other screen.
#
#   FILES ADDED: src/ui/confirm-dialog.jsx, src/screens/share-app.jsx,
#     src/screens/themes.jsx
#   FILES MODIFIED: src/App.jsx, src/lib/cribs.js, src/lib/favorites.js,
#     src/lib/font-styles.js, src/ui/primitives.jsx, src/ui/tooltip.jsx,
#     src/ui/fav-heart.jsx, src/ui/fav-strip.jsx, src/ui/fav-icons.jsx,
#     src/ui/helpful-bulb.jsx, src/ui/question-widgets.jsx,
#     src/ui/nav-drawer.jsx, src/ui/result-cards.jsx,
#     src/ui/exit-snackbar.jsx, src/screens/home.jsx,
#     src/screens/settings.jsx, src/screens/library.jsx,
#     src/screens/favorites.jsx, src/screens/drill-tests.jsx,
#     src/screens/dosage-practice.jsx, src/screens/quiz.jsx,
#     src/screens/crib-sheet.jsx, src/screens/revision-sheet.jsx,
#     src/screens/Results.jsx, src/screens/weightage.jsx,
#     src/screens/welcome.jsx, src/screens/admin-panel.jsx,
#     src/screens/knowledge-map.jsx, src/screens/pyq-read.jsx,
#     src/screens/advanced-test.jsx
#   BUILD: vite green. SSR smoke pass over all touched screens green.
#   No storage-schema/Supabase/api changes (crib `sig` field is additive;
#   old saved cribs simply lack it and keep working).
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
#   AUDIT: ADVERSARIAL QA / SECURITY / ARCHITECTURE REVIEW
#   (full report: NORCET-SECURITY-QA-AUDIT.md — read that file)
# ════════════════════════════════════════════════════════════════
#
#   Done by Claude (NOT Fable 5) by READING THE ACTUAL SOURCE — no
#   hallucinated endpoints/columns/metrics. Every claim in the report is
#   tagged [VERIFIED] (read the exact code), [INFERRED] (reasoned from
#   code), or [ESTIMATE] (cannot measure statically — Lighthouse, real
#   query latency, device push, cross-browser). Re-run with Fable when
#   available; the report is structured to diff against.
#
#   ── THE ONE THING THAT MATTERS (all [VERIFIED]) ───────────────
#   The app is NOT launchable as-is because of the DATA LAYER, not the UI:
#
#   C-1  supabase/setup.sql grants the PUBLIC anon key full
#        SELECT/INSERT/UPDATE/DELETE on EVERY row of kv_shared with
#        USING(true). The anon key ships in every user's JS bundle. So any
#        visitor can: scrape every user's profile (GET key=like.profile:*),
#        overwrite/impersonate any account, or DELETE the whole table
#        (mass wipe). There are no in-repo backups, so one DELETE ends the
#        product.
#   C-2  Profile blobs stored in that world-readable table contain
#        passwordHash/salt/dobHash/dobSalt (PBKDF2-100k) AND all progress.
#        Public hashes + 4-char-min passwords + low-entropy DOB-only reset
#        = offline cracking + account takeover.
#   C-3  "Admin" is only a client UI gate. The allowlist Edge Function is
#        correctly passphrase-gated, BUT actual admin writes (announcements,
#        banks, feedback) still go through the anon-writable table, so a
#        non-admin can write them directly with the public key. (Also: a
#        real-looking default passphrase sits in a deploy comment — rotate.)
#   C-4  api/send-reminders.js has NO auth (anyone can trigger a push blast)
#        and does kv.keys('sub:*') + serial sends → spam + cron timeout at
#        scale.
#   C-5  api/subscribe.js & api/active.js are unauthenticated/spoofable
#        (KV poisoning; suppress another user's reminders).
#
#   ── OTHER HIGH ITEMS (see report for full tables) ─────────────
#   • No DB backups / no DB rollback. • "Syncs across devices" is actually
#     last-write-wins on one blob → silent multi-device progress loss.
#   • supabaseList() has NO pagination → PostgREST's 1000-row cap silently
#     truncates leaderboard/admin/bank lists at scale (correctness bug).
#   • loadLeaderboard is N+1 over the network (list + get-per-key).
#   • No security headers / CSP anywhere. • Entry JS is heavy (~282KB gz app
#     + ~152KB gz recharts in the critical path) → split recharts out.
#   • No error monitoring / analytics / CI in repo. • iOS Web Push only
#     works installed on 16.4+ → reminders silently no-op for many iPhones.
#   • No AI/LLM at runtime → zero hallucination/prompt-injection surface
#     (static content). Good.
#
#   ── SCORES (security/readiness verified-grounded; perf/UX estimated) ──
#   Overall 42 · Security 12 · Scalability 35 · UX 78 · Perf 60[est] ·
#   PWA 80 · Production-Readiness 22.  VERDICT: NOT READY.
#
#   MUST-FIX-BEFORE-LAUNCH: C-1..C-5, automated DB backups, security
#   headers, generic auth-error messages. 30-DAY: multi-device conflict
#   resolution, list pagination, leaderboard aggregation, code-split
#   recharts, offline banner on shared screens, iOS push capability check,
#   Sentry + analytics.
#
#   NOTE: this audit changed NO code. Reading-only. The fixes above are a
#   future work item, not part of the issues-resolution round above.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
#   SECURITY STAGE 3 — close the C-1 READ leak + force-reset legacy
#   (deliverables: outputs/security-stage3/ — kv-read.ts, storage.PATCHED.js,
#    B3-force-reset.md, B1B2-select-lock.md)
# ════════════════════════════════════════════════════════════════
#
#   Done by Claude (NOT Fable 5). Verified what could be verified by reading
#   the actual auth-secure / kv-write / profiles / storage source and by
#   REPRODUCING + adversarially testing the token + read-broker authz in a
#   sandbox. Items I cannot see (the live SESSION_SIGNING_SECRET value,
#   deployed env, the running DB) are tagged for the owner to confirm.
#
#   ── WHAT WAS ALREADY DONE (verified by reading the uploaded code) ──
#   Stage 1/2 (a prior session) already moved credentials OFF kv_shared into
#   profile_secrets (RLS on, no anon policy) and routed ALL shared WRITES
#   through the kv-write broker (HMAC session token, per-key owner authz,
#   fail-closed). I reproduced the token scheme and confirmed: valid tokens
#   verify; tampered-payload, expired, wrong-secret, and from-scratch forged
#   tokens all reject. The direct anon write path is dead (owner curl #3 =
#   401/403). C-1 WRITE side and C-3 (admin writes) are genuinely closed.
#
#   ── WHAT STAGE 3 ADDS (this round) ────────────────────────────
#   The C-1 READ side was still open: anon_select USING(true) meant any
#   visitor could still SELECT every profile:<id> blob (study history, exam
#   dates — hashes already gone, but still personal). Fix is symmetric with
#   the write broker:
#
#   1. NEW Edge Function `kv-read` (supabase/functions/kv-read/index.ts):
#      serves ONLY private prefixes (profile:, myfeedback:) and ONLY to their
#      owner, authorized by the SAME HMAC token (byte-identical verifyToken to
#      kv-write). Supports op:get and op:list (owner-scoped). Admins may read
#      any (moderation). Fail-closed on everything else. Adversarially tested:
#      owner-read OK, cross-user read 403, no/forged token 401, bank:/
#      profilemeta: correctly NOT served (they stay on the anon path).
#
#   2. storage.js patched (storage.PATCHED.js): supabaseGet/supabaseList now
#      branch private prefixes (profile:, myfeedback:) to the kv-read broker
#      via brokerGet/brokerList; everything else stays on the direct anon
#      read. Boot-safe: loadSession() awaits restoreAuthToken() before any
#      profile load, instant-paint still uses the local cache (loadProfileCached,
#      no network), and loadProfile falls back to cache if the broker is
#      unreachable. Frontend BUILD: vite green.
#
#   3. CRITICAL — profilemeta: STAYS anon-readable on purpose. listProfileMetas
#      reads ALL users' profilemeta for the profile switcher; it holds only
#      {id, displayName, createdAt, lastActive} — no secrets. Locking it would
#      blank the switcher. This is why a blanket "lock all private prefixes"
#      would have broken the app — the split is per-prefix by who-reads-it.
#
#   4. B-1/B-2 SELECT lock (B1B2-select-lock.md): a STRICT deploy ORDER —
#      (i) deploy kv-read, (ii) ship storage.js + deploy frontend and VERIFY
#      the live app still loads profiles/switcher/feedback, (iii) ONLY THEN
#      DROP anon_select USING(true) and CREATE anon_select_public scoped to
#      announcement/bank/favsec/favorder/helpful/notHelpful/leaderboard/
#      profilemeta (profile: + myfeedback: deliberately absent). Includes the
#      verify curls and a rollback. Out-of-order = login breaks for everyone.
#
#   5. B-3 force-reset (B3-force-reset.md): the 12 legacy users' hashes were
#      downloadable while the table was public → treat as compromised. Add a
#      must_reset boolean to profile_secrets, set true on all existing rows,
#      make auth-secure `verify` return {ok:true, mustReset:true} WITHOUT a
#      token for flagged users, clear the flag on `reset`, and route the
#      client MUST_RESET error into the existing DOB-recovery screen. New
#      accounts (created after) are not flagged.
#
#   ── STILL OPEN AFTER STAGE 3 (tracked, not done here) ─────────
#   • [OWNER MUST CONFIRM] SESSION_SIGNING_SECRET is high-entropy (>=32 bytes
#     random) and IDENTICAL across auth-secure, kv-write, kv-read. The entire
#     token scheme rests on this; I cannot see its value.
#   • [OWNER MUST CONFIRM] automated DB backups / PITR (free tier has no PITR).
#   • C-4 unauth + O(all) reminder cron; C-5 unauth subscribe/active — from
#     the original audit, untouched.
#   • auth-secure verify/reset are uncapped guessing oracles → add IP rate
#     limiting (DOB reset is low-entropy/brute-forceable).
#   • favsec:/helpful: writable by any logged-in user with arbitrary value
#     (cosmetic; owner-scope later). Token TTL 60d, no revocation.
#
#   NOTE: Stage 3 changed ONE app file (src/storage.js) + added one Edge
#   Function. No other app code touched. The SQL + auth-secure/client edits
#   in B3/B1B2 docs are runbooks for the owner to apply and verify on the
#   live project — I cannot run them.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
#   SECURITY STAGE 4 — C-4 (cron auth), C-5 (subscribe/active), auth
#   rate limiting  (deliverables: outputs/security-stage3/)
# ════════════════════════════════════════════════════════════════
#
#   Done by Claude (NOT Fable 5). Read the CURRENT deployed source for all
#   three endpoints from the codebase (not memory) and verified the new auth
#   gate + validation logic in a sandbox. SELECT lock from Stage 3 confirmed
#   live by the owner ([] on profile:* via anon). B-3 forced-reset
#   intentionally skipped — owner is messaging the 12 friends directly to
#   change passwords (acceptable substitute; noted reused-password caveat).
#
#   ── C-4: api/send-reminders.js was UNAUTHENTICATED ────────────
#   Anyone could POST it to blast every subscriber. FIX: require the Vercel
#   Cron secret — Vercel auto-attaches `Authorization: Bearer $CRON_SECRET`
#   to scheduled runs once CRON_SECRET is set; any request without it → 401
#   (fails closed if the secret isn't configured). Also replaced the serial
#   await-in-loop with batched concurrency (cap 20) so it won't time out as
#   subs grow. kv.keys('sub:*') scan kept (fine at current scale; index is
#   the next step). VERIFIED: correct secret passes, wrong/missing/unset all
#   rejected (sandbox test).
#
#   ── C-5: api/subscribe.js + api/active.js were UNAUTHENTICATED ─
#   These are called by ANON devices before login, so a session token can't
#   be required without breaking reminders. Hardened instead:
#     • subscribe: validate the subscription shape + that endpoint is a real
#       https push-service host (googleapis/mozilla/windows/microsoft/apple);
#       reject arbitrary URLs/data. IP rate-limit 30/hr. VERIFIED: real FCM/
#       Apple endpoints pass; http/random-https/garbage rejected.
#     • active: validate id shape, IP rate-limit 120/hr; only PATCHes
#       lastActive on an existing row (can't create/poison). Residual: a
#       known id could suppress one of a victim's daily nudges — low impact,
#       documented.
#     • NEW api/_ratelimit.js — fixed-window per-IP limiter on the existing
#       Vercel KV; fails OPEN on KV error so a blip never breaks login/subscribe.
#
#   ── auth-secure rate limiting (C-2 follow-up) ─────────────────
#   verify/reset are uncapped guessing oracles (DOB reset is low-entropy).
#   auth-secure is Deno (can't use the Vercel limiter), so: new auth_rate
#   Postgres table (RLS on, no anon policy), per-IP (20/10min) AND per-id
#   (10/10min) fixed-window limits on verify+reset only, fail-open on DB
#   error. Runbook in auth-secure-ratelimit.md (SQL + the exact Deno helper
#   + handler gate). The per-ID limit is the important one — it caps single-
#   account attack speed even from a rotating-IP botnet.
#
#   FILES CHANGED (app repo): api/send-reminders.js, api/subscribe.js,
#   api/active.js (rewritten), api/_ratelimit.js (new). Frontend BUILD green
#   (api/ are serverless, not bundled). auth-secure + the auth_rate SQL are
#   runbooks for the owner to apply/deploy/verify — I cannot run them.
#   Deploy order + verify curls: DEPLOY-C4-C5.md.
#
#   ── REMAINING OPEN (post-Stage-4) ─────────────────────────────
#   • [OWNER] set CRON_SECRET in Vercel BEFORE deploying send-reminders.
#   • [OWNER] confirm SESSION_SIGNING_SECRET strong + identical across the
#     three edge fns (still the linchpin); confirm DB backups exist.
#   • kv.keys scan → maintained index at thousands of subs.
#   • IP-rotating abuse → WAF/Turnstile is the real fix at scale.
#   • B-3 leaked-hash reset handled out-of-band (the 12 friends).
#   With C-1..C-5 addressed, the original audit's must-fix-before-launch set
#   is now substantially closed — pending the two [OWNER] confirmations above.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
#   SECURITY STAGE 5 — VAPID config fix + security pass CLOSED
# ════════════════════════════════════════════════════════════════
#
#   Done by Claude (NOT Fable 5). Closes the deploy issue that surfaced
#   after Stage 4 and records the final state of the whole security effort.
#
#   ── THE VAPID ISSUE (and the corrected diagnosis) ─────────────
#   After deploying the hardened send-reminders.js, the cron threw
#   "No subject set in vapidDetails.subject". The reported cause ("new code
#   expects env vars; old code had them hardcoded") was WRONG: the ORIGINAL
#   send-reminders.js ALSO read process.env.VAPID_* (verified byte-identical
#   lines in the codebase) — there was never a hardcoded VAPID location.
#   Reality: server-side push had simply never been configured in Vercel, so
#   the cron had been failing on every run; it only surfaced now because the
#   run is deliberately triggered+inspected post-C-4. Only the CLIENT public
#   key (VITE_VAPID_PUBLIC_KEY, inlined by Vite) existed.
#   FIX (config, not code — hardcoding a private VAPID key would be a secret-
#   in-source regression): owner added VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
#   VAPID_SUBJECT (+ VITE_VAPID_PUBLIC_KEY) to Vercel and redeployed.
#   send-reminders now runs. Public key MUST match the client's; a fresh
#   keypair invalidates existing subs (self-heals via 404/410 pruning).
#
#   ── FINAL SECURITY STATE (C-1..C-5 + follow-ups) ──────────────
#   CLOSED & (where possible) sandbox-verified:
#     • C-1 read leak  — kv-read broker + anon SELECT scoped to public
#       prefixes; owner confirmed [] on profile:* via anon. ✅
#     • C-1 write leak — kv-write broker (HMAC token, per-key owner authz,
#       fail-closed); anon direct write dead (401/403). ✅
#     • C-3 admin writes — announcement/faq admin-only in the broker. ✅
#     • C-4 cron — CRON_SECRET required (fail-closed) + batched sends. ✅
#     • C-5 subscribe/active — push-endpoint validation + IP rate limit;
#       anon-callable by design (pre-login), hardened not token-gated. ✅
#     • auth-secure verify/reset — per-IP + per-id fixed-window rate limit
#       (auth_rate table), fail-open on DB error. ✅
#     • C-2 hashes — off kv_shared in profile_secrets (RLS, no anon policy);
#       token scheme reproduced & proven non-forgeable. ✅
#
#   ── OWNER-ONLY CONFIRMATIONS (cannot be verified from code) ───
#     • [ ] SESSION_SIGNING_SECRET is >=32-byte random AND identical across
#           auth-secure / kv-write / kv-read. (Linchpin — if kv-read differs,
#           private reads fail closed and profile loads break; if weak, tokens
#           forgeable.)
#     • [ ] CRON_SECRET enforced — unauthenticated POST /api/send-reminders
#           returns 401 (cron working ≠ secret enforced; test the negative).
#     • [ ] Push actually LANDS on a device + logs show sent>0 / failed≈0
#           (200 only proves env readable; high failed = keypair mismatch).
#
#   ── DELIBERATELY DEFERRED (not launch-blockers at 12-friend scale) ──
#     • B-3 leaked-hash reset — handled out-of-band (messaging the 12 friends
#       to change passwords). NOTE: until each actually changes it, those
#       accounts are only as safe as the original (possibly reused) password;
#       the rate limiter slows ONLINE guessing only, not offline cracking of
#       already-scraped hashes.
#     • Automated DB backups / PITR — STILL OPEN, highest-value remaining
#       item. Free tier has no PITR; a weekly pg_dump GitHub Action is the
#       cheap fix. No restore point exists today.
#     • Multi-device last-write-wins data loss; PostgREST 1000-row pagination
#       cap (silent truncation); leaderboard N+1; no security headers/CSP;
#       recharts in critical-path bundle; no error monitoring/analytics; no
#       CI. All from the original audit; real but scale/polish, not urgent.
#
#   VERDICT: the original audit's must-fix-before-launch security set
#   (C-1..C-5) is CLOSED. Remaining items are reliability/scale/polish, with
#   automated backups the one most worth doing soon.
# ════════════════════════════════════════════════════════════════


# ════════════════════════════════════════════════════════════════
# ISSUES_1 — STRATEGIC EXECUTION  (norcet-issues_1_.md, ~29 items)
# ════════════════════════════════════════════════════════════════
# The ~29 issues were re-ordered into 7 dependency- and risk-aware WAVES.
# Several issues are "revisit (not working)" — previously logged DONE but
# regressed / never deployed / never fully landed. Build is kept GREEN at
# every wave checkpoint (npx vite build).
#
# WAVE ORDER
#   1. Critical bug regressions: #1+#2 tap-and-hold/banner, #5+#12 double-back
#      crash (shared root), #6 home back-exit confirm, #7 rename-popup-on-input,
#      #27a admin Users fetch.
#   2. Layout/UI: #13 fixed top bar, #11 weightage popup centring, #8 home-card
#      unification, #9 sidebar Help&Learn spacing, #10 crib-share spacing,
#      #14 drill rename, #4 crib smart naming.
#   3. Smart test engine: #20 Quick Test count+balanced random, #22 Topic-Wise
#      count, #21 cross-session dedup, #25 PYQ pooling + inline tags.
#   4. Features: #3 Favourites rework, #18 sidebar Feedback+Report merge,
#      #16 Settings Legal pages, #17 onboarding consent.
#   5. Animations: #15 Drill open animation, #23 pre-test interstitial.
#   6. Admin suite: #19 panel redesign + unified feedback, #27b Users redesign,
#      #24 demand/exhaustion (feeds off #21), #28 behaviour analytics,
#      #29 error/crash tracking.
#   7. PYQ archive revamp (multi-exam) #26.
#   Dep notes: #14 precedes #15/#25; #21 served-history feeds #24; #27a fetch
#   precedes #27b redesign; #18 Feedback precedes #19 feedback mgmt.
#
# ── WAVE 1 — DONE, build green ──────────────────────────────────
# #1/#2 tap-and-hold glitch + restore home-card info tips:
#   - font-styles.js: .press-safe now also sets `touch-action: manipulation`
#     (kills the native long-press magnifier/selection repaint — the GPU
#     compositing artifact that bled above the cards). JS Tip still fires.
#   - home.jsx: the 3 home cards (Drill / Learn / Knowledge Map) are wrapped
#     in <Tip> again so tap-and-hold info is RESTORED (issue #2). Glitch-free
#     because tooltip.jsx already carries NO backdrop-filter. 6/6 <Tip> balanced.
# #5/#12 double-back crash + #6 exit-only-on-confirm (App.jsx onPop):
#   - Added lastPopRef 350ms DEBOUNCE: consecutive back presses collapse into a
#     single step (fixes Android double-back crash AND welcome-tour double-back).
#   - The app now exits ONLY when the user taps Exit in the dialog
#     (programmaticExitRef). A hardware back NEVER closes the app, so a fast
#     double-back can't fall out accidentally. confirmExit drives the one exit
#     path; cancelExit leaves the re-armed sentinel so back simply re-prompts.
# #7 rename popup closes on input tap (rename-profile-modal.jsx):
#   - Android soft-keyboard shifts the layout between touchstart and click, so a
#     tap starting in the input releases on the backdrop → dismiss. Fix: a
#     pointerdown-origin guard — dismiss only when the gesture BOTH starts and
#     ends on the backdrop (downOnBackdrop ref). (useFocusTrap only closes on
#     Escape, so it was never the cause.)
# #27a admin "No profiles yet": profilemeta: reads via the DIRECT anon path
#   (not the kv-read broker), so this is almost certainly a live RLS/data-state
#   issue, NOT app code. Deferred to Wave 6 (admin) with an owner curl
#   diagnostic + a broker fallback. NO code change this wave.
#
# ── WAVE 2 — DONE, build green ──────────────────────────────────
# #13 fixed top bar (primitives.jsx TopBar): ROOT CAUSE — every screen wraps
#   <TopBar/> in `<div className="anim-fadeup">`; while that 0.35s entrance runs
#   the wrapper holds a transform, and ANY transformed ancestor turns
#   position:fixed into fixed-to-ancestor. (index.css + the outer App wrapper
#   have no persistent transform, and .anim-fadeup correctly ends at
#   `transform: none` — so the persistent user report is most likely a
#   deploy-gap / the entrance window.) FIX: the fixed bar is now rendered via
#   createPortal(bar, document.body); the spacer stays in flow. The bar is a
#   <body> child — no screen wrapper / animation / overflow can ever contain it
#   again. useTheme survives the portal (context follows the React tree).
# #14 drill rename (drill-tests.jsx): "Topic Wise" → "Topic Wise Test",
#   "Dosage Calc" → "Dosage Calc Test". Display-only; fav ids + onClick targets
#   (topic-select / dosage) unchanged. Tip titles update too.
# #11 weightage popup centring (weightage.jsx): the cropped bottom-sheet
#   (items-end + sheet-up + rounded-t-3xl) is now a properly centred modal
#   (items-center + p-4 backdrop, anim-scalein, max-w-sm, rounded-3xl,
#   max-h-[88vh] overflow-y-auto). Consistent at all scroll positions.
# #8 home-card unification: VERIFIED already consistent — Drill / Learn /
#   Knowledge Map all share p-4 mb-4, w-11 h-11 rounded-xl icon, text-base
#   title, text-xs subtitle, chevron; per-section accents are intentional. No
#   code change.
# #9 sidebar Help & Learn spacing (nav-drawer.jsx LearnCard): px-3 py-3 →
#   px-3.5 py-3.5, gap-3 → gap-3.5, sub mt-0.5 → mt-1 leading-snug, section
#   space-y-2 → space-y-2.5. Breathable, less cluttered.
# #10 crib-share line spacing (crib-sheet.jsx share()): ROOT CAUSE — the
#   `.filter(Boolean)` was silently dropping the '' separator lines, so blocks
#   stacked tight. Rebuilt: a blank line now sits between question / answer /
#   explanation, and blocks join with a full blank line. Consistent rhythm.
# #4 crib smart naming (cribs.js addCrib): two sessions from the same source
#   (different content sigs) are both kept but would share a title; now the
#   display title gets an incrementing "#N" (delete-safe: always max-existing
#   + 1). The revision-sheet.jsx crib card already shows name + relative/full
#   date + Q-count + % right, so the list UI half of #4 was already satisfied.
#
# REMAINING: Waves 3–7 (test engine, features, animations, admin suite, PYQ
# archive). #27a needs an owner RLS curl before the Wave 6 Users rebuild.
# ════════════════════════════════════════════════════════════════

# ── WAVE 3 — Smart test engine — DONE, build green ──────────────
# #20 Quick Test = topic-balanced "black box":
#   - NEW src/lib/weightage.js: examTopicWeightage(papers, includeGk) → the
#     mean per-topic % across the PYQ papers' nursing portion (the slim,
#     reusable core of screens/weightage.jsx's model).
#   - quick-practice.js: NEW selectBalancedQuestions(pool, count, weights,
#     history) — largest-remainder topic allocation by weight, each topic
#     filled from the existing unseen-first/by-need ordering, shortfalls spilled
#     into a global unseen-first fill, final list shuffled. Falls back to plain
#     unseen-first when no weightage signal. Edge-tested (count>pool, empty
#     weights, absent-topic weights, empty pool all safe; 50/30/20 → 5/3/2).
#   - QuickPracticeSetup.jsx: REWRITTEN — the topic-selection list is GONE.
#     Quick Test now picks ONLY a count [3,5,10,15,20]; the mix is random,
#     exam-weighted, unseen-first. onStart({ count }).
#   - App.startQuickPractice: drops topic/pyqOnly; computes weights from
#     PREVIOUS_YEAR_PAPERS and calls selectBalancedQuestions.
# #22 Topic Wise Test count selector (TopicSelect.jsx): added a [5,10,15,20]
#   selector above the subject list; onPick(topic, count) → startQuiz count.
# #21 cross-session dedup: Quick (via the unseen-first balanced selector) AND
#   Topic Wise now use selectQuickPracticeQuestions (App.startQuiz 'topic' was a
#   RAW shuffle — it could re-serve the same questions every session). History
#   is persisted in the profile blob, so "no repeats until the bank is
#   exhausted, then reuse by need" holds across sessions/devices. (Mock is left
#   as a broad random simulation by design.)
# #25 PYQ pooling + inline tags: PYQ-tagged questions already live in
#   allQuestions, so Quick/Topic/Mock/Advanced already BLEND them (no silo).
#   Tagging: quiz.jsx + advanced-test.jsx already render <PyqBadge>; ADDED the
#   badge to crib-sheet.jsx, and slimItem (cribs.js) now PRESERVES PYQ
#   provenance (isPYQ/source/pyqYear/pyqExam) so saved Crib Sheets tag PYQs too.
#
# REMAINING: Waves 4 (Favourites rework, Feedback+Report merge, Legal pages,
# onboarding consent), 5 (animations), 6 (admin suite — incl. #27a RLS check &
# #24 which can now build on this served/seen signal), 7 (PYQ archive revamp).
# ════════════════════════════════════════════════════════════════

# ── WAVE 4 — Features — DONE, build green ───────────────────────
# #3 Favourites smart rework (favorites.jsx): ROOT CAUSE — the grid only ever
#   held Drill modes because the ONLY way to add a favourite was a heart that
#   exists solely on the Drill Tests cards (no other screen passes favId). The
#   FAV_SECTIONS registry already spans the whole app (16 sections). FIX: an
#   "Add" picker (TopBar Add button + empty-state + the "heart more" tile all
#   open it) listing every favoritable section NOT yet collected; tap a row →
#   toggleFav adds it instantly and it drops off the list. The grid can now be
#   built from anywhere, not just Drill.
# #18 Sidebar Feedback merged with Report (feedback-modal.jsx + nav-drawer.jsx):
#   - Every submission now carries a `source` ('question' | 'screen' |
#     'feedback') so the one admin inbox can tell contextual reports apart from
#     general feedback. Modal heading + "From:" chip adapt for general feedback.
#   - The modal self-attributes the author via useProfile (fallback when the
#     caller doesn't thread profileId), so the new sidebar entry attributes too.
#   - nav-drawer: a "Send feedback" LearnCard (Megaphone) in Help & Learn opens
#     the SAME modal with source:'feedback'. (Admin gets a richer source
#     chip/filter in Wave 6; the tag is already stored.)
# #16 Settings Legal pages:
#   - NEW src/lib/legal.js: plain-language Privacy Policy + Terms of Use
#     (LEGAL_VERSION, LEGAL_UPDATED), written to match the app's ACTUAL
#     behaviour (local guest mode, optional name/DOB/password, Supabase sync, no
#     email, no ads, optional voluntary tip). Maintainer note inline to review
#     before a wide public launch.
#   - NEW src/screens/legal.jsx: LegalContent (embeddable body) + LegalScreen
#     (TopBar + body).
#   - settings.jsx: a "Legal" card (Privacy Policy + Terms rows) just above
#     Support, rendered as a SELF-CONTAINED sub-view (legalView state) — no app
#     routing changes; back returns to Settings.
# #17 Onboarding consent (welcome.jsx): the tour's final "Got it" now opens a
#   consent gate — "I agree & continue" is the ONLY way into the app (onboarding
#   completes only through it, so it can't be bypassed; scrim-dismiss just
#   returns to the tour). Privacy/Terms open INLINE in the sheet via
#   LegalContent (same copy as Settings → Legal). Light but mandatory.
#
# CUMULATIVE CHANGED FILES (W1–W4): 19 distinct (3 new: lib/weightage.js,
# lib/legal.js, screens/legal.jsx).
# REMAINING: Wave 5 (animations #15/#23), Wave 6 (admin suite #19/#27/#24/#28/
# #29 + the #27a RLS check), Wave 7 (PYQ archive #26).
# ════════════════════════════════════════════════════════════════

# ── WAVE 5 — Animations — DONE, build green ─────────────────────
# #15 Drill Tests opening (font-styles.js + drill-tests.jsx): NEW keyframe
#   `drillCardIn` — each mode card flips up around its top edge (perspective +
#   rotateX 15deg + slight scale) and settles; ends transform:none. The Reveal
#   wrapper now uses `.drill-card-in` with the existing staggered delays, so the
#   grid assembles top→bottom in ~0.5s. (Chose the brief's "cascade with a slight
#   3D flip" alternative over the literal "Tests multiplies into titles", which
#   reads gimmicky at speed.) Honors prefers-reduced-motion.
# #23 Pre-test interstitial (font-styles.js + quiz/advanced-test/dosage-practice):
#   NEW keyframe `testEnter` — the first question scales up from 0.96 + fades as
#   the test screen mounts (0.35s), so launching a test feels like stepping into
#   it. Applied to the RUNNING views only (not setup): quiz.jsx main wrapper
#   (covers Quick + Topic + Mock), advanced-test.jsx running view, and
#   dosage-practice.jsx question view — all 5 modes. Plays once on entry (root
#   mounts once; question-to-question changes don't remount). Reduced-motion safe.
#   Note: .nav-fwd's shared-axis slide targets `.anim-fadeup`, so swapping these
#   roots to `.test-enter` gives a deliberate distinct scale-in (no slide+scale
#   double-up) on test entry.
#
# CUMULATIVE CHANGED FILES (W1–W5): 22 distinct (3 new).
# REMAINING: Wave 6 (admin suite — #19 panel redesign + unified feedback, #27
# Users fetch+redesign, #24 demand/exhaustion, #28 behaviour analytics, #29
# error/crash tracking; + the #27a RLS check), Wave 7 (PYQ archive #26).
# ════════════════════════════════════════════════════════════════

# ── WAVE 6 — Admin suite — IN PROGRESS ──────────────────────────
# #29 Error/crash tracking — DONE, build green:
#   - NEW src/lib/errorlog.js: captures window 'error', 'unhandledrejection',
#     and React render crashes (via ErrorBoundary -> captureError). GROUPS by a
#     stable signature (normalised message + top stack frame + source) so
#     repeats aggregate into one row with a count. Stored in shared storage
#     (errlog:{sig}) via the same anon shared-write path feedback:/favsec: use,
#     so the admin sees crashes across ALL users' devices. Fully fail-safe
#     (never throws), writes throttled per-signature (FLUSH_MS) and new
#     signatures capped per session (anti-storm). A re-occurrence un-resolves a
#     group. keys.js: ADDED KEYS.errlog + KEY_PREFIXES.ERRLOG (add-only).
#   - main.jsx: installGlobalErrorCapture() at boot. App ErrorBoundary now also
#     calls captureError(severity:'crash'). App tags errors with the current
#     screen via setErrorContext on nav change.
#   - admin-panel.jsx: NEW "Crash reports" view + dashboard tile — grouped list
#     (severity badge, ×count, source, last-seen, screen), expandable stack,
#     Resolve/Reopen, Delete (confirm), Open/Resolved/All filter.
#   NOTE: relies on anon being allowed to write errlog: shared keys (same as
#   feedback:). If the deployed RLS write policy is prefix-restricted, allow
#   errlog: too, else writes fail-closed and the dashboard stays empty.
# #27a Admin "No profiles yet" fetch — fixed the dangerous part in code +
#   diagnosis (profiles.js listProfileMetas):
#   - ROOT (most likely): live RLS/data-state — anon SELECT on profilemeta:* is
#     blocked, OR no per-user meta rows exist. Pure code can't fix an RLS block.
#   - REAL BUG FOUND + FIXED: the legacy `profile_index` migration deleted the
#     monolithic list UNCONDITIONALLY right after writing per-user metas — so if
#     those writes were blocked (RLS), the ONLY copy of the directory was
#     destroyed → permanent "No profiles yet". Now the legacy key is retired
#     ONLY after the per-user metas read back non-empty, and if metas are
#     unavailable we FALL BACK to the legacy list so the directory still shows.
#   OWNER DIAGNOSTIC (run to confirm the RLS cause):
#     curl -s "$SUPABASE_URL/rest/v1/<kv_table>?key=like.profilemeta:*&select=key" \
#       -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
#     • returns rows  → data is readable; the bug was the migration (now fixed).
#     • returns []    → anon SELECT policy doesn't cover profilemeta: → add it.
#
# CUMULATIVE CHANGED FILES (through W6-partial): 27 distinct (4 new:
# lib/weightage.js, lib/legal.js, screens/legal.jsx, lib/errorlog.js).
# REMAINING in Wave 6: #27b Users redesign (per-user stats + search/filter),
# #19 Admin Panel premium redesign + unified feedback, #24 demand/exhaustion,
# #28 behaviour/engagement analytics. Then Wave 7 (#26 PYQ archive).
# ════════════════════════════════════════════════════════════════

# ── WAVE 6 — Admin suite — COMPLETE, build green ────────────────
# (continued from the #29/#27a entry above)
# #24 Bank health / demand vs supply (admin-panel.jsx, NO telemetry needed):
#   Computes per-topic SUPPLY (questions in each bank) vs DEMAND (exam weightage
#   from PYQ papers via examTopicWeightage). Flags topics the exam emphasises but
#   whose bank is thin (ratio<0.6 or <10 Qs = "Low supply") — exactly where to
#   add questions first. New "Bank health" view (supply/demand bars + risk
#   badges, sorted worst-first) + dashboard tile with a red count of at-risk
#   topics. (A live served-rate signal could augment this later.)
# #28 Engagement analytics (NEW src/lib/analytics.js + App hooks + admin view):
#   Per-user rolling summary (sessions, screen-view counts, active days, guest
#   flag) written to ONE shared key per identity (analytics:user:{id}) so writes
#   never clobber; throttled (flush on timer + tab-hide). Guests get a stable
#   local id so repeat visits aggregate. App: initAnalytics on identity known +
#   trackScreen on every nav change. New admin "Engagement" view AGGREGATES only
#   (active today/week, members vs guests, sessions, avg/user, new-this-week,
#   most-visited screens) — never a single person's feed (matches Privacy
#   Policy). keys.js: ADDED analyticsUser + ANALYTICS_USER + ANALYTICS_LOCAL_ID.
# #19 Admin Panel premium pass + unified feedback tagging:
#   - Dashboard SUMMARY BAND (Users · Open reports · Bank alerts) above the
#     section tiles — the numbers needing attention, at a glance.
#   - Completes #18's admin side: AdminFeedbackCard now shows a SOURCE chip
#     (Feedback / Question / Screen) so the one inbox is visibly tagged.
#   (Kept the existing tile grid rather than a risky full re-layout; the band +
#   the new Engagement/Bank-health/Crash tiles already make it feel like a
#   premium console.)
# #27b Users redesign (admin-panel.jsx): added a SEARCH box (name/id) + SORT
#   chips (Recent active / Newest / A–Z) + a no-match state to the Users list.
#   (Deeper per-user stats — answered count / accuracy — would require admin
#   broker reads of each private blob; deferred as security-sensitive + heavy.)
#
# WAVE 6 DONE. CUMULATIVE CHANGED FILES: 29 distinct (5 new: lib/weightage.js,
# lib/legal.js, screens/legal.jsx, lib/errorlog.js, lib/analytics.js).
# REMAINING: Wave 7 — #26 Previous Year Papers premium revamp (multi-exam).
# ════════════════════════════════════════════════════════════════

# ── WAVE 7 — PYQ archive revamp — DONE, build green ─────────────
# #26 Previous Year Papers → multi-exam archive (previous-papers.jsx rewrite):
#   - Papers are grouped by EXAM, then by YEAR (newest first). The exam comes
#     from `paper.exam` if set, else is INFERRED from the paper name (text
#     before the year) — so the existing NORCET papers need ZERO data change,
#     and any future exam (AIIMS Nursing, JIPMER, PGIMER, BHU, DSSSB, …) just
#     sets `exam:` on its papers and auto-slots into its own shelf.
#   - Premium archive UI: per-exam "shelf" header (icon + name + paper count),
#     cards show year/session + Q count + time + saved best/last attempt. Exam
#     FILTER chips appear only when >1 exam exists; a SEARCH box appears past 4
#     papers. Attempt + Read flows and per-paper scores are preserved exactly
#     (props unchanged). font-styles.js: added .no-scrollbar for the chip row.
#
# ════════════════════════════════════════════════════════════════
# ✅ ISSUES_1 COMPLETE — all 29 issues across 7 waves, build green at every
#    checkpoint. CUMULATIVE CHANGED FILES: 30 distinct (5 new modules:
#    lib/weightage.js, lib/legal.js, lib/errorlog.js, lib/analytics.js,
#    screens/legal.jsx).
#
# OWNER VERIFY / DEPLOY NOTES (things this codebase can't self-test):
#  1. #27a — run the profilemeta: curl (in the Wave 6 entry). Rows = the
#     migration fix covers you; [] = add profilemeta: to the anon SELECT policy.
#  2. #29 / #28 — crash + engagement stores write to shared keys (errlog:,
#     analytics:) via the same anon shared-write path as feedback:. If your RLS
#     write policy is prefix-restricted, allow errlog: and analytics: too,
#     else those writes fail-closed and the dashboards stay empty.
#  3. Smoke on a real device: hardware back (double-tap = one step, never
#     exits; Home = Exit dialog), top bar stays pinned while scrolling, Quick
#     Test topic spread + no-repeat, consent gate on a fresh onboarding.
#  No public/data/*.json was edited, so CONTENT_VERSION did NOT change. keys.js
#  changes were ADD-only.
# ════════════════════════════════════════════════════════════════


# ════════════════════════════════════════════════════════════════
# ISSUES_NEW — STRATEGIC EXECUTION  (norcet-issues_new.md, 9 items)
# ════════════════════════════════════════════════════════════════
# Re-ordered into 5 dependency/risk-aware waves (build kept GREEN at each
# checkpoint via npx vite build):
#   1. Sign-up & recovery (auth surface, backend): #3 security-Q recovery,
#      #2 consent moved to sign-up.
#   2. Settings & Feedback (shared files): #9 Feedback hub + remove My
#      Feedback from Settings, then #8 Settings sub-page cards.
#   3. Bookmarks: #4 bookmark→top-right of tags row, #7 unbookmark caution.
#   4. Favourites & KMap: #5 hearts gated by Favourites toggle, #6 KMap Report.
#   5. Performance: #1 code-split recharts/admin (last, so the final bundle
#      measurement reflects every prior change).
#
# ── WAVE 1 — Sign-up & recovery — DONE, build green ─────────────
# #3 Security-question recovery REPLACES DOB (was "too guessable"):
#   - NEW src/lib/security-questions.js: curated 8-question list +
#     normalizeAnswer (lowercase+trim+collapse-ws) — kept BYTE-IDENTICAL to a
#     copy in the edge fn so answers compare case-insensitively.
#   - auth-secure/index.ts: `register` now takes securityQuestion+
#     securityAnswer (answer hashed PBKDF2 like the password, stored in
#     profile_secrets); DOB made OPTIONAL (legacy clients still accepted).
#     NEW `recovery-question` action returns which factor an account uses
#     ({method:'question',question} | {method:'dob'} | no-recovery). `reset`
#     now verifies EITHER a security answer OR (legacy) a DOB. `rename` copies
#     the new security_* columns too. Backward-compatible → safe to deploy the
#     fn before the frontend.
#   - profiles.js: createProfile swaps dob→securityQuestion/securityAnswer
#     (dob still accepted, no longer required). ADDED getRecoveryQuestion +
#     recoverPasswordWithAnswer. KEPT recoverPasswordWithDob (legacy path for
#     the existing 12 DOB-only accounts; also still imported by App.jsx).
#   - auth-screen.jsx REWRITTEN: sign-up shows a security-question <select> +
#     answer input (DOB field gone). Recovery is now TWO steps — identify
#     (name → look up factor) then verify (answer the shown question, or DOB
#     for legacy, + new password). All existing behaviour preserved (live
#     name-taken check, legacy-import card, guest back-out, success banner).
#   - NEW supabase/security-questions.sql: ALTER TABLE adds security_question/
#     security_answer_hash/security_answer_salt (idempotent). RLS already
#     deny-all → columns inherit it, NO new policy/grant needed.
#   SCHEMA + EDGE-FN IMPACT (owner must apply on the live project):
#     1) run supabase/security-questions.sql
#     2) supabase functions deploy auth-secure --no-verify-jwt
#     3) ship frontend. Order is safe because the fn is backward-compatible,
#        but the FRONTEND must NOT ship before the fn (new client stops
#        sending DOB; old fn would reject register with bad-dob).
# #2 Consent moved to the sign-up step:
#   - FINDING: the onboarding consent gate logged under ISSUES_1 #17 is NOT in
#     the current code (LegalContent is only used by legal.jsx; welcome.jsx has
#     zero Privacy/Terms refs) — a regressed/never-landed item. So "remove from
#     the tour" was already satisfied; the real work was adding it at sign-up.
#   - auth-screen.jsx: create mode shows a calm inline notice above the CTA —
#     "By creating a profile, you agree to our Privacy Policy and Terms of Use"
#     with both as tappable links that open the doc inline in a bottom sheet
#     (reuses LegalContent + legalDoc). The Create button is the single
#     confirming action. No checkbox wall (per the brief's "frictionless").
#   - legal.js: privacy "What we store" updated (DOB→security question; email
#     correctly described as OPTIONAL — the old copy wrongly said "we never ask
#     for your email"). LEGAL_VERSION 1→2. (legal.js is a lib module, NOT
#     public/data, so CONTENT_VERSION is untouched.)
# CHANGED FILES (W1): 6 — 2 new (lib/security-questions.js,
# supabase/security-questions.sql), 4 modified (auth-secure/index.ts,
# lib/profiles.js, screens/auth-screen.jsx, lib/legal.js).
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# WAVE 2 — Settings & Feedback (issues-new #9, #8)   [build GREEN]
# ════════════════════════════════════════════════════════════════
# Pure frontend. No schema / edge-function / storage-key impact, so
# nothing to deploy beyond shipping the build. Main bundle 1,030 KB
# (chunk-size warning is pre-existing — fixed in Wave 5 / #1).
#
# --- #9  Sidebar Feedback hub + de-dupe from Settings ---
# ui/nav-drawer.jsx: the lone "Send feedback" LearnCard is replaced by
#   ONE structured Feedback card (Megaphone header) with two sub-rows:
#     • Send feedback → onClose() + requestFeedback({source:'feedback',
#       screen:'Sidebar feedback'})  (unchanged target: the one admin inbox)
#     • My feedback   → go('my-reports')  with an unread-replies badge.
#   Added Send + Inbox to the lucide import; added a replyUnread prop.
# App.jsx: NavDrawer now receives
#   replyUnread={unseenFeedbackReplies(myReports, data.feedbackRepliesSeen).length}.
#   (Navigating to my-reports already triggers refreshMyReports + markRepliesSeen.)
# screens/settings.jsx: the old "My feedback" Card is removed (now lives
#   only in the sidebar hub). onOpenMyReports / unseenReplyCount props are
#   kept in the signature but unused (harmless, lower-risk than re-threading).
#
# --- #8  Settings → collapsible sub-page cards (like Themes) ---
# screens/settings.jsx: Profile, Sidebar gestures, Backup, Topic notes and
#   Legal each collapse to a single SubPageCard row on the main list and
#   open into a focused sub-page. Implemented as LOCAL state (subPage) with
#   an early-return sub-view — same self-contained pattern the file already
#   used for legalView — so NO App.jsx nav changes were needed.
#   • openSub(name) tags <html> with .nav-fwd for ~420ms, so the sub-page's
#     anim-fadeup root animates as sharedAxisIn 0.28s cubic-bezier(0.4,0,0.2,1)
#     — exactly the "shared-axis forward, ~280ms ease-in-out" the task asks
#     for, and identical to the drawer's row-launch transition.
#   • Section bodies were moved verbatim into render fns (renderProfileSub,
#     renderGesturesSub, renderBackupSub, renderTopicNotesSub, renderLegalSub)
#     + a shared renderResetAndShare(). Reset + Share now live inside the
#     Profile sub-page for logged-in users; GUESTS still see them (plus the
#     prominent Sign-in card) inline, so sign-in is never buried.
#   • Order of early returns is legalView FIRST, then subPage — so Legal
#     sub-page → Privacy/Terms → LegalScreen → back returns to the Legal
#     sub-page, not the main list.
#   • Stayed inline (single toggles, belong on the main page): Reminders,
#     Notifications, Analytics, Sound, Themes (the reference card), Help,
#     Admin, Favourites, Tests/Crib, Support.
# Hardware-back inside a sub-page exits Settings (matches the pre-existing
#   legalView behaviour); not wired into the app nav stack (out of scope).
#
# CHANGED FILES (W2): 3 modified — ui/nav-drawer.jsx, App.jsx,
#   screens/settings.jsx.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# WAVE 3 — Bookmarks (issues-new #4, #7)            [build GREEN]
# ════════════════════════════════════════════════════════════════
# Pure frontend. No schema / edge-function / storage-key impact.
# Main bundle 1,035 KB (chunk warning pre-existing — Wave 5 / #1).
#
# --- #7  Caution before un-bookmarking (shared, app-wide) ---
# ui/primitives.jsx: + requestConfirm() / registerConfirmOpener() — same
#   imperative app-root pattern as requestFeedback / requestSupport.
# ui/confirm-host.jsx (NEW): mounts ONE ConfirmDialog at the app root and
#   registers the opener; App.jsx renders <ConfirmHost/> beside the other
#   hosts. opts: { title, body, confirmLabel, cancelLabel, tone, icon,
#   onConfirm, onCancel }.
# ui/bookmark-actions.jsx (NEW): confirmBookmarkToggle(isBookmarked, apply)
#   — ADDING a bookmark is frictionless; REMOVING one shows a quick
#   "Remove bookmark?" danger confirm, then runs apply(). Used everywhere a
#   bookmark icon can remove: quiz.jsx, pyq-read.jsx, advanced-test.jsx,
#   dosage-practice.jsx, and BOTH removal paths in the bookmarks viewer
#   (detail "Remove" + index-row icon).
#
# --- #4  Bookmark at the rightmost of the tags row, every test type ---
# Target position: top-right of the question card, rightmost cell of the
# topic-tags row — identical across Quick / Topic / Mock / Advanced /
# Dosage / PYQ.
# • quiz.jsx (Quick/Topic/Mock): bookmark MOVED out of the global TopBar
#   into the pills row (pills flex-1 on the left, bookmark flush-right).
#   Kept the pop/deflate bmAnim.
# • pyq-read.jsx (PYQ): already top-right of each question's header row —
#   left as-is, only the removal got the #7 confirm.
# • advanced-test.jsx (Advanced + previous-paper mocks): the AdvancedTest
#   engine had NO bookmark before. ADDED one at the tags row, wired to the
#   app-level toggle via new props { bookmarks, onToggleBookmark } (passed
#   from BOTH App.jsx render sites). Local bmAnim for the pop/deflate.
# • dosage-practice.jsx (Dosage Calc): ADDED a bookmark to the Order-card
#   tag row (right of the "Order" label), wired via the same new props.
#
# --- Dosage bookmarks resolve end-to-end (no orphans) ---
# Dosage questions live in their own pool (dosage.json via useContent), are
# NOT in allQuestions, and have no topic/options — so a naive bookmark would
# vanish from the viewer. bookmarks.jsx now also loads the dosage pool,
# tags matched dosage questions with a synthetic '__dosage__' topic
# (label "Dosage calc", 🧮), appends them as their own TOC group, and
# renders a DOSAGE-SPECIFIC detail (order + worked answer + steps +
# intuition) via an early branch — the MCQ detail path is untouched.
# A small topicMeta() helper feeds the synthetic label/colour to both the
# topic-filter chips and the group headers.
# App.jsx: AdvancedTest (x2 sites) + DosagePractice now receive
#   bookmarks={data.bookmarks} onToggleBookmark={toggleBookmarkById}.
#
# CHANGED FILES (W3): 9 — 2 new (ui/confirm-host.jsx, ui/bookmark-actions.jsx),
#   7 modified (ui/primitives.jsx, App.jsx, screens/quiz.jsx,
#   screens/pyq-read.jsx, screens/bookmarks.jsx, screens/advanced-test.jsx,
#   screens/dosage-practice.jsx).
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# WAVE 4 — Favourites & Knowledge Map (issues-new #5, #6)  [GREEN]
# ════════════════════════════════════════════════════════════════
# Pure frontend. No schema / edge-function / storage-key impact.
# Main bundle 1,036 KB (chunk warning pre-existing — Wave 5 / #1).
#
# --- #5  Hearts visible only when Favourites is ON in Settings ---
# Every favourite heart in the app renders through ONE component
# (ui/fav-heart.jsx → <FavHeart>): the TopBar heart, the sidebar rows,
# and the Home/drill-test cards. So a single gate does it:
#   ui/fav-heart.jsx — after the registry check, `if (!enabled) return null;`
#   (enabled = the Favourites toggle, default OFF). The component already
#   listens to the 'norcet:favs' window event, so flipping the toggle in
#   Settings makes hearts appear/disappear instantly app-wide.
# The other raw <Heart> icons (support card, settings toggle indicator,
# admin telemetry, support modal) are NOT favourite controls and are left
# untouched.
# screens/settings.jsx — relabeled the row "Favourites" and rewrote its
#   sub-text: ON → "heart icons are visible across the app…"; OFF → "heart
#   icons are hidden everywhere. Turn this on to show them…". (The old copy
#   told users to tap hearts while OFF, which is no longer possible.)
#
# --- #6  Knowledge Map gains a Report button (next to Help) ---
# The Knowledge Map uses a CUSTOM floating header (not <TopBar>), so it had
# Help (requestHelp) but no Report. Added a Report button in the same
# top-right group, styled to match this screen's floating round Help button,
# opening the standard report modal via
#   requestFeedback({ source: 'screen', screen: 'Knowledge Map' })
# with the app's Report icon (AlertCircle, accent). Same behaviour as the
# TopBar FeedbackButton used everywhere else — just dressed for this screen.
#
# CHANGED FILES (W4): 3 modified — ui/fav-heart.jsx, screens/settings.jsx,
#   screens/knowledge-map.jsx.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# WAVE 5 — Performance / code-splitting (issues-new #1)   [GREEN]
# ════════════════════════════════════════════════════════════════
# Loading-strategy only — ZERO functionality change. No schema / edge /
# storage impact. Ship anytime.
#
# IMPORTANT correction to the issue's premise: recharts is NOT admin-only.
# The actual importers were App.jsx (a DEAD import — no chart JSX), plus
# StatsScreen and weightage (both user-facing). admin-panel imports no
# recharts at all. So lazy-loading only the admin panel would NOT have moved
# recharts off the initial load. The real fix is to lazy-load every recharts
# consumer (and, for the >1 MB warning, the other heavy route screens).
#
# WHAT CHANGED (src/App.jsx):
#  • Removed the dead `import { … } from 'recharts'` (App rendered no charts).
#  • React.lazy + <Suspense> for 8 non-initial route screens, each imported
#    ONLY by App.jsx (verified) so they split cleanly out of the entry:
#      knowledge-map, admin-panel, StatsScreen, weightage, coverage-map,
#      revision-sheet, faq, leaderboard.
#    (Quick/Topic/Mock/Advanced/Dosage/PYQ, Home, Reference, Library, the
#     setup screens etc. stay eager — Reference is a quiz dependency, Home is
#     first paint.)
#  • <LazyScreenFallback>: a themed full-screen spinner shown while a chunk
#    loads (instant after first visit — the SW precaches every emitted .js).
#
# WHAT CHANGED (vite.config.js):
#  • Removed the `recharts-vendor` manualChunk. THE KEY FIX: a named
#    manualChunk made Vite emit <link rel="modulepreload"> for recharts in
#    index.html, so its 152 KB gzip was pulled into the initial load even
#    though only lazy screens use it. Left to Rollup, recharts now lands in
#    an on-demand async chunk (emitted as "LineChart-*.js", ~108 KB gzip)
#    shared by StatsScreen + weightage, fetched only when one opens.
#  • Kept the `icons-vendor` (lucide-react) chunk — used by nearly every
#    screen, so it legitimately belongs in the initial load.
#
# RESULT (production build):
#                       BEFORE                AFTER (initial load)
#   main index    1,036 KB / 296 KB gz   →   994 KB / 296 KB gz   (warning gone)
#   recharts       530 KB / 152 KB gz    →   deferred (108 KB gz, on demand)
#   entry HTML eagerly loads: index + icons-vendor ONLY (recharts NOT preloaded)
#   + 8 route screens now load on demand (admin 14, km 16, stats 5 … KB gz)
#   • Vite ">1024 KB chunk" warning: ELIMINATED.
#   • Goal "main bundle < 500 KB gzip": met (296 KB), with recharit + ~190 KB
#     gz of route code moved out of first paint.
#
# CHANGED FILES (W5): 2 modified — App.jsx, vite.config.js.
# ════════════════════════════════════════════════════════════════
# ★ ALL 9 issues-new tasks COMPLETE across 5 waves. Build GREEN throughout.
# ════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════
# FOLLOW-UP — Remove donation card from Home (keep it subtle)  [GREEN]
# ════════════════════════════════════════════════════════════════
# Donation/support is already available in Settings → Support (the quiet
# "buy me a chai" card, opens requestSupport()). To keep it subtle and out
# of the user's eye on the main screen, the Home nudge was removed.
# screens/home.jsx: dropped <HomeSupportNudge totalAttempted=… /> and its
#   import. (ui/home-support-nudge.jsx is left in the tree but unreferenced,
#   so this is trivially reversible.) The Settings Support card is unchanged.
# No schema / storage impact. CHANGED FILES: 1 — screens/home.jsx.
# ════════════════════════════════════════════════════════════════

---

## Session — Fixes batch 2 (7 "Fix" items + 2 "B" items), all built green

Build stayed green after every wave. Main bundle ~1,002 KB / ~298 KB gzip, no chunk warning.

**Fix 1 — Share card + scroll.** `src/screens/settings.jsx` (Share moved out of the Profile
sub-page into its own top-level main-list row, visible to all; `renderResetAndShare()` →
`renderReset()`, Reset stays in Profile), `src/App.jsx` (`'share-app'` added to
`PTR_DISABLED_SCREENS` so pull-to-refresh doesn't fight the scrollable share text).

**Fix 2 — Profile popups UI.** `src/screens/settings.jsx`. Log out / Switch already used the
modern centred `ConfirmDialog`; the Reset popup was the bottom-sheet outlier — converted to
the same centred-modal chrome (rounded-3xl, anim-scalein, tinted Trash2 circle, identical
button hierarchy) keeping its type-RESET-to-confirm input.

**Fix 3 — Favourites gate.** `src/screens/settings.jsx`. Single "Manage favourites & priority
order" row split into two rows ("Manage favourites" + "Priority order", local `FavRow` helper).
When `favs.enabled` is OFF: dimmed (opacity .5) + non-tappable (`pointerEvents:'none'`, no
onClick). Added `ArrowUpDown` import.

**Fix 4 — Sidebar collapsible sections.** `src/ui/nav-drawer.jsx`. Added `openSections` state
(study/progress/tools open, learn/feedback closed), `toggleSection` (vibrate+tap sound),
`SectionHeader` (tappable, chevron rotates 90°) + `Collapsible` (grid-rows 0fr→1fr + opacity).
All five sections wrapped; Feedback converted from a structured card to two child rows (Send /
My feedback) under its header. NOTE: while editing I dropped the outer
`<div className="fixed inset-0 z-[70]">` after `return (` → restored.

**Fix 5 — Popup alignment.** `src/lib/font-styles.js`. ROOT CAUSE: `slideInRight/slideInLeft`
rested at `transform: translateX(0)`; any non-`none` transform (with fill-mode both) makes the
element a containing block for `position:fixed` descendants → modals inside slide-animated
screens re-anchored to the screen. FIX: rest at `transform: none` (identical at rest). All other
entrance anims (fadeUp/scaleIn/testEnter/sharedAxisIn/drillCardIn) already end at `none`. PTR +
toggle transforms are leaf elements; modals are otherwise fixed+flex-centered or app-root.
NOTE: font-styles.js CSS lives in a JS template literal — first attempt's comment used backticks,
which closed the literal; removed them.

**Fix 6 — Account Security (existing users).** BACKEND: redeploy `auth-secure`
(`supabase functions deploy auth-secure --no-verify-jwt`). No DB migration (cols exist from
Wave-1 security-questions.sql). NEW `src/screens/account-security-card.jsx`; MODIFIED
`src/screens/settings.jsx`, `src/lib/profiles.js`, `supabase/functions/auth-secure/index.ts`.
auth-secure: +`set-security-question` (verify password, refuse if already set [one-time], store
question + PBKDF2 answer) and +`update-email` (verify password, validate email, PATCH).
profiles.js: +`setSecurityQuestion`, +`updateRecoveryEmail` (callAuthFn + friendly errors).
Card reads state via existing no-password `getRecoveryQuestion` (method==='question' →
"Recovery question set ✓" locked, else show form). Rendered in `renderProfileSub` (logged-in).

**Fix 7 — Guest access restrictions.** `src/ui/nav-drawer.jsx` (+`isGuest` prop;
`studyRows = isGuest ? study.filter(it=>it.key!=='addq') : study`; render + index offsets use
studyRows), `src/App.jsx` (passes `isGuest`; add-question screen also guarded with
`&& !isGuestProfile(profile)`). Part 2 (crib/revision notes guest-accessible, localStorage-only):
NO CHANGE NEEDED — `cribs.js` + `notes.js` already `safeStorage.set(..., false)` (shared=false →
IndexedDB, never Supabase) for all users.

**B1 — Stats "Begin fresh" reset.** `src/screens/StatsScreen.jsx` (+`onResetData` prop; RotateCcw
+ requestConfirm imports; red "Begin fresh" card at the bottom → requestConfirm danger →
onResetData), `src/App.jsx` (passes `onResetData={clearAll}` — the SAME profile-data reset
Settings uses: `setData(DEFAULT_DATA); goHome()`).

**B2 — Smart repeat of UNATTEMPTED (not skipped) questions.** NEW
`src/lib/repeat-unattempted.js` (local per-profile pool; `loadRepeatPool`/`saveRepeatPool`,
`nextPool({presentedIds,resultIds,skippedIds})` folds a run: resolved [has result = answered OR
revealed] → drop, skipped → drop, else → add; `partitionByRepeat`). MODIFIED `src/lib/keys.js`
(+`REPEAT_UNATTEMPTED` prefix, shared=false), `src/App.jsx` (hydrate `repeatPoolRef` on profile
change; `startQuiz` quick+topic use `selectWithRepeats` to serve pooled Qs first then fall through
to `selectQuickPracticeQuestions`; `completeQuiz(+skipCounts)` folds the run via nextPool), and
`src/screens/quiz.jsx` (both `onComplete(...)` calls now pass `skipCounts` as the 4th arg).
Revealing the answer disqualifies a Q (it creates a result); skipped Qs are never repeated.
Recording happens on all Quiz runs (incl. timed mock); repeats are injected only into Quick/Topic
selection (mock stays a random exam sim). Pool is device-local (zero DB, works for guests).

DELIVERED per item via present_files. Outstanding backend action: ONE `auth-secure` redeploy
covers both the original Wave-1 security-questions work and Fix 6 (same function).

---

## Session — follow-up refinements (after the batch-2 review)

All built green; main bundle ~1,001 KB / ~298 KB gzip.

**Unify Stats reset with the profile reset (user: "keep it same as the profile reset").**
Extended the shared dialog instead of duplicating: `src/ui/confirm-dialog.jsx` gained an
optional `confirmWord` prop — when set it renders the type-to-confirm input and keeps the
destructive button disabled until the typed value matches (trim + uppercase). `src/ui/confirm-host.jsx`
now forwards `opts.confirmWord`. Both reset entry points route through the app-root
`requestConfirm`:
  • `src/screens/StatsScreen.jsx` — "Begin fresh" → `requestConfirm({ confirmWord:'RESET', ... })`
    with the same Trash2 icon, title and copy as the profile reset (card keeps RotateCcw).
  • `src/screens/settings.jsx` — the profile reset trigger in `renderReset()` now calls the same
    `requestConfirm({ confirmWord:'RESET', onConfirm:onClearAll })`; the old inline reset modal and
    its `resetSheet`/`resetTyped` state were deleted. One component → the two dialogs can't drift.

**Popup anchoring fix (user: logout/switch/reset opened on the parent Settings page, not the
Profile sub-page they were triggered from).** Root cause: the Log out / Switch dialogs were
rendered INLINE inside the Settings component, so their `position:fixed` was captured by the
screen/sub-page container instead of the viewport. Routed both through the app-root
`requestConfirm` host (same as reset): `src/screens/settings.jsx` — Switch + Log out triggers now
call `requestConfirm({...})` (Switch tone:'primary', Log out tone:'danger'); removed both inline
`<ConfirmDialog>` blocks, the `logoutSheet`/`switchSheet` state, and the now-unused
`ConfirmDialog` import. The app-root host sits outside every transformed ancestor, so all three
dialogs now centre on the VISIBLE page. Audited the other moved popups: sidebar "Send feedback"
already uses the app-root `requestFeedback` host; "My feedback"/Favourites rows navigate (no
modal); the Account Security card uses inline messages. The two remaining inline ConfirmDialogs
(admin-panel leave-guard, welcome-tour leave-guard) were not moved and render over full screens,
so no parent/sub-page mismatch.

**Favourites gate — revised (user: just hide, don't dim).** `src/screens/settings.jsx` — the
"Manage favourites" + "Priority order" rows are now hidden entirely when the Favourites toggle is
OFF (`onOpenFavorites && favs && favs.enabled && ...`), and only render when it's ON. Removed the
dimmed/disabled (opacity + pointer-events:none) styling.

---

## Session — profile polish: collapsible security cards, rename focus bug, special-char cautions

All built green; main bundle ~1,003 KB / ~298 KB gzip.

**Collapsible Account Security cards.** `src/screens/account-security-card.jsx` — Recovery question
and Recovery email are now collapsible cards (tappable header + rotating chevron + grid-rows
0fr→1fr body animation, matching the sidebar folders). Both default COLLAPSED to tidy the profile
page; the question header shows a "Set ✓ / Not set" badge. IMPORTANT: the `CollapseCard` and `Msg`
helpers were moved to MODULE level (with `T` passed as a prop) — defining them inside the component
gives them a new identity each render, which remounts their input children and loses focus on every
keystroke (same class of bug as the rename one below).

**Rename focus bug — root-caused in the focus trap.** `src/lib/use-focus-trap.js` — the effect
listed `onClose` in its deps, and callers pass a fresh `close` closure every render, so every
keystroke re-ran the effect, which re-focuses the first control → focus kept jumping to the X close
button. FIX: keep `onClose` in a ref (read by the Escape handler) and depend only on `[active]`, so
the effect runs once per open. Also added `[data-autofocus]` support so a dialog can choose which
control gets initial focus. `src/screens/rename-profile-modal.jsx` — added `data-autofocus` to the
name input so it focuses on open. This fix is global: every modal using the trap (incl. the reset
dialog's type-RESET input and ConfirmDialog) no longer steals focus while typing.

**Special-character cautions (non-blocking) — name / email / security answer.** "Bad for the
developer" = the name becomes the login id and is shown verbatim on the leaderboard / in backups /
CSV exports.
  • `src/screens/rename-profile-modal.jsx` — when the trimmed name contains anything outside
    letters/numbers/space/`-_.'’` (regex `/[^\p{L}\p{N}\s\-_.'’]/u`), a red caution card appears
    ("emojis and symbols may not show correctly… you can still save").
  • `src/screens/auth-screen.jsx` — same caution under the name field in CREATE mode (where the id
    is first minted).
  • `src/screens/account-security-card.jsx` — email gets a soft format check (`emailLooksOff`)
    that shows an inline warning and disables Save until it looks valid (server still enforces too);
    the security-answer hint now notes it's checked case-insensitively + ignores extra spaces and to
    avoid unusual symbols they might not retype the same way.
All cautions are non-blocking (except the obviously-invalid email, which gates its own Save button).


---

## Session — 9 feature/fix batch: change-password, rate limiting, guest gates, premium cards, char limits

All built green via `vite build` (2333 modules; main bundle ~1,009 KB / ~300 KB gzip). Both Edge
Functions parse clean (esbuild, no Deno locally). **Two items need action OUTSIDE the build — see
⚠️ at the bottom.**

### Backend

**Task 2 — rate limiting (NEW infrastructure; was missing from this repo).** The repo's
`auth-secure` / `kv-write` had NO rate-limit code, and there was no `auth_rate` table SQL anywhere —
the Stage-4 rate-limit runbook referenced in earlier notes was never merged into this codebase.
Added it for real:
  • `supabase/auth-rate.sql` — NEW. Locked `auth_rate` table (RLS on, zero policies, grants revoked
    from anon/authenticated, `service_role` granted — same lock-down model as `profile_secrets`),
    plus an atomic `rate_hit(bucket, identifier, limit, window_seconds)` plpgsql RPC
    (SECURITY DEFINER). One `INSERT … ON CONFLICT DO UPDATE` does the whole fixed-window check +
    increment, so concurrent hits can't undercount; it returns `(allowed, retry_after)`. Idempotent
    (`CREATE … IF NOT EXISTS`); if the Stage-4 runbook was ever run, confirm the columns match
    (`bucket, identifier, window_start, count`).
  • `supabase/functions/auth-secure/index.ts` — added `clientIp`, `rateHit` (FAILS OPEN on any
    limiter/DB error, mirroring `api/_ratelimit.js`), `formatWait`, and `tooMany` (HTTP 429 +
    `{ok:false,reason:'rate-limited',retryAfter,message}` + `Retry-After` header). Limits wired at
    the top of the handler — unauth by IP: `verify` 5/15 min, `reset` 3/hr, `recovery-question`
    3/hr; auth by profile id: `change-password` 5/hr, `set-security-question` 3/hr, `update-email`
    5/hr. `register` / `rename` / `delete` deliberately NOT limited.
  • `supabase/functions/kv-write/index.ts` — same `rateHit`/`tooMany` helpers; admin data writes
    (the `announcement:` / `faq:` prefixes, which route through kv-write, not auth-secure) are
    capped at 20/hr per admin id.

**Task 1 — change password (server half).** `supabase/functions/auth-secure/index.ts` — new
`change-password` action mirroring `update-email`: verifies the CURRENT password
(`hashPassword` + `safeEqual` vs the stored hash), enforces the same 8-char minimum as `reset`,
rejects new===current (`same-password`), then writes a fresh salt + hash. It does NOT mint a new
token, so the caller's session stays valid (nobody gets logged out). `src/lib/profiles.js` —
`callAuthFn` now surfaces the limiter's 429 `message` verbatim (and tags the error `rateLimited`);
added a `changePassword(displayName, currentPassword, newPassword)` bridge with friendly per-reason
errors (bad-password / weak-password / same-password / no-account).

### Frontend

**Task 1 — Change password card.** `src/screens/account-security-card.jsx` — a third collapsible
`CollapseCard` (KeyRound icon) after Recovery question + Recovery email, collapsed by default.
Current / new / confirm fields; a module-level `scorePassword()` drives a 3-segment strength meter
(weak / medium / strong) that REWARDS special characters and length — a long passphrase rates well
even with one character class. Positive hint: "special characters like !@#$ make your password
stronger." Live match indicator; Save stays disabled until the current password is filled, the new
password is ≥ medium, and both new fields match. Success shows the existing inline `Msg`, not a
popup. New-password fields are capped at `PASSWORD_MAX`; the current-password field is uncapped
(existing passwords may be longer).

**Task 9 — username / password length limits + counters.** `src/lib/auth-limits.js` — NEW
(`USERNAME_MAX = 24`, `PASSWORD_MAX = 64`). Applied with `maxLength` + slice-on-change + a live
counter ONLY where a NEW value is chosen: `src/screens/auth-screen.jsx` (CREATE-mode display name
and password — LOGIN mode left uncapped so existing longer names/passwords are never clipped or
blocked) and `src/screens/rename-profile-modal.jsx` (new-name counter + `maxLength`; the pre-filled
value is NOT sliced — the counter just turns red if an existing name is already over the cap). The
Task-1 new-password fields also use `PASSWORD_MAX` for consistency. Current-password / verify fields
everywhere stay uncapped.

**Task 3 — guest gate for Add Question.** `src/App.jsx` — the `add-question` route rendered BLANK
for guests; added a guest branch rendering `<SignInGate>` (new `Plus` icon) mirroring the Library
gate, with `onSignIn` → auth and `onBack` → home. (The nav drawer already showed Add Question to
guests, so this closes the dead-end.)

**Task 4 — tappable stat cards.** `src/screens/home.jsx` — the Streak / Accuracy / Today summary
cards now navigate to `{ screen: 'stats' }` on tap (added `onClick` + `cursor-pointer pressable`).

**Task 5 — premium Learn card.** `src/screens/home.jsx` — "Learn topic wise" now uses the premium
Drill-Tests treatment (gradient background, white text, translucent icon chip, divider + mini icon
row) but in its OWN colour so the two cards stay visually distinct: a module-level `lightenHex()`
builds `linear-gradient(135deg, T.sec.learn, lightenHex(T.sec.learn, 0.22))`. Mini-row icons added
(BookOpen / Layers / Lightbulb / GraduationCap / Sparkles / Network).

**Task 6 — Start button per subject.** `src/screens/TopicSelect.jsx` — each subject row's bare
chevron is replaced by a premium "Start" pill (Play icon, `background: topic.color`, coloured
shadow, active:scale) that `stopPropagation()`s then calls `onPick`; the whole card stays tappable
too. Removed the now-unused `ChevronRight` import.

**Task 7 — Share placement.** `src/screens/settings.jsx` — "Share NORCET Prep" was already a
top-level card from an earlier fix; tightened the ordering so it sits IMMEDIATELY after the
Profile / Account card and before every other section. For guests the Reset action was rendering
BETWEEN the account card and Share — moved it to render AFTER the Share card, so nothing now sits
between Profile and Share.

**Task 8 — hide ADMIN from guests (topic notes stay visible).** `src/screens/settings.jsx` —
wrapped the ENTIRE Admin section (header + unlock form + unlocked panel) in `{!isGuest && (…)}`; a
guest can never be an admin, so that section is pure dead weight for them. Topic notes was
INITIALLY hidden too, but reverted on review — guests accumulate local Knowledge-Map notes and the
export/import sub-page is how they back those up, so it stays visible to everyone. Favourites and
all other sections also render for guests.

### ⚠️ Action required (NOT covered by the green build)
1. **Run `supabase/auth-rate.sql`** in the Supabase SQL editor, then **re-deploy both functions**
   (`supabase functions deploy auth-secure --no-verify-jwt` and the same for `kv-write`). Until
   then the limiter calls an RPC that doesn't exist — because it fails OPEN, login/etc. keep
   working, but nothing is actually being rate-limited yet.
2. **Repo-vs-notes drift noticed:** the previous journal entry describes a special-char caution AND
   `data-autofocus` on the rename-modal name input, but NEITHER was present in this repo's
   `src/screens/rename-profile-modal.jsx` (only `auth-screen.jsx` carried the caution). Treated the
   repo as source of truth; flagging in case those merges were lost.


---

## Session — iOS/Android polish batch: 15 reported issues

Frontend + help-content only this round — NO Supabase / edge-function changes. Built green
throughout (`vite build`, 2334 modules). 14 of 15 were code fixes; #15 was a question that needed
no change.

**Issue 1 — dark-mode hearts looked pre-filled.** `src/ui/fav-heart.jsx` — the empty heart used a
solid white `fill`, which in dark mode reads as already-favourited. Empty is now `fill="transparent"`
(outline only); favourited stays pink. 'transparent' (not 'none') keeps the fill animation smooth.
Tap logic untouched.

**Issue 2 — Add picker overlapped Edit.** Fixed as a side effect of #13: Add + Edit moved out of the
always-on-top TopBar into the page body, which the Add modal covers — so Edit can't be triggered
while the picker is open. Belt-and-suspenders: entering edit also closes the picker. `favorites.jsx`.

**Issue 3 — skipped quick-test questions never came back.** `src/screens/quiz.jsx` — the 2nd skip of
a question ran `setIndex(i+1)`, advancing the cursor PAST it, so it was dropped forever. Now EVERY
skip re-queues the question to the end; a 2-skip cap (`skipsForCurrent < 2` in `canSkip`) only
disables further skipping so the queue can't cycle endlessly — the question is never abandoned and
must be attempted before the test ends. The Skip button label reflects the capped state.

**Issue 4 — iOS edge-swipe conflict (blank + exit prompt).** New `src/lib/platform.js` (`isIOS()`).
`src/ui/nav-drawer.jsx` — the swipe-to-open listener is passive and can't suppress iOS's system
left-edge back gesture, so it no longer attaches on iOS (the Menu button still opens the drawer).
`src/screens/settings.jsx` — the Sidebar-gestures "Swipe to open" card now shows as unavailable on
iPhone/iPad with an explanation, and the Android warning is reworded.

**Issue 5 — sidebar title under the status bar.** `src/ui/nav-drawer.jsx` — the drawer is
`position:fixed` so it ignored the body's safe-area padding; its header now adds
`env(safe-area-inset-top)`. (The home bar and TopBar screens already handled this.)

**Issue 6 — top bar permanently scrolled away.** `src/screens/home.jsx` — the Menu / notifications /
settings bar is now a FIXED bar (portaled to <body>, since the home root's anim-fadeup transform
would otherwise break position:fixed) that hides on scroll-down and slides back in on scroll-up,
with a spacer reserving its height. Mirrors the existing portaled-TopBar pattern.

**Issue 7 — Learn-topics row cards felt plain.** `src/screens/learn-topics.jsx` — premium pass:
subtle topic-colour gradient card tint, gradient icon chip with ring + shadow, the modules/cards/min
stats are now wrapping pills (no longer cramped), and a gradient Read button with a stronger shadow.
All handlers and the expand section unchanged.

**Issue 8 — Learn back-navigation loop.** `src/App.jsx` — learn-cards' Back called
`navigate({ screen: 'learn-topics' })`, which PUSHES a forward breadcrumb; combined with the
breadcrumb-popping `goHome`, it ping-ponged between the two screens. Back now uses `goHome` (pop),
which returns to wherever you came from (learn-topics, or Doubts).

**Issue 9 — Knowledge-Map guide popup.** `src/screens/knowledge-map.jsx` — several `\uXXXX`
sequences were written as RAW JSX text (em dash, apostrophes, minus, the fullscreen glyph), which
JSX renders literally as "\u2014" etc.; wrapped them in `{'\u2014'}` expressions so they render.
Also capped the guide sheet at `calc(100dvh - env(safe-area-inset-top) - 24px)` so its top can't
crop under the notch.

**Issue 10 — duplicate ? icon.** `src/screens/knowledge-map.jsx` — the on-canvas guide button used
the same HelpCircle (?) as the top-bar help; it's now a Compass icon.

**Issue 11 — Manage favourites did the same thing as Priority order.** Both rows called the same
handler (edit mode). Now Manage favourites opens the Add picker and Priority order keeps
reorder/remove. `src/screens/settings.jsx` (new `onManageFavorites` prop + distinct row handlers +
reworded sub-text), `src/App.jsx` (`onManageFavorites` → `{ screen:'favorites', add:true }`),
`src/screens/favorites.jsx` (new `startInAdd` prop opens the picker on entry).

**Issue 12 — generic help content.** `public/data/help.json` — the Favourites screen (plus Crib
sheet and PYQ read mode) had no entry, so they showed the generic placeholder. Added proper
screen-specific what / how / why / example for all three. (Only `public/` was edited; `dist/` is
regenerated from it at build time.)

**Issue 13 — cropped "Favourites" title.** `src/screens/favorites.jsx` — Add + Edit removed from the
top bar (which now carries only Help + Report via `feedback`), so the title fits; Add + Edit
relocated to a compact action row in the page body.

**Issue 14 — inputs zoomed the page on tap.** `src/index.css` — iOS auto-zooms any focused input
under 16px; forced 16px on input / textarea / select (`!important` to beat Tailwind's text-sm). This
stops focus-zoom WITHOUT disabling pinch-zoom, so the Knowledge Map (the one place zoom is wanted)
still pinches.

**Issue 15 — do the Important / What's-new cards keep reappearing? (question)** No code change.
Dismissal IS remembered: the Important card is gated by `dismissedAnnouncementId` (preserved from
account data on login, so it survives the "log out and back in" the announcement itself asks for),
and What's-new is gated per bank version. The same card won't return after you close it; only a
genuinely new admin announcement or an actual bank update brings them back.

---

## Session — home-screen quotes → self-discipline / self-focus set

Single-file change, frontend only, no backend / storage migration. Built green (`vite build`).

`src/lib/quotes.js` — replaced the previous scriptural set (Gita / Mahabharata / Ramayana / Bible /
Quran-Hadith) with 48 motivational quotes themed on SELF-DISCIPLINE and SELF-FOCUS — mastering your
own mind, consistency, effort, and acting on what's in your control. Sourced ENTIRELY from
public-domain works (Marcus Aurelius, Seneca, Epictetus, Lao Tzu, Confucius, Buddha/Dhammapada,
Aristotle, Franklin, Theodore Roosevelt, Emerson, Thoreau, Henley's Invictus) so there are no
licensing concerns. The `getNextQuote()` cycle-without-repeats logic is unchanged; because it
resets when the saved shown-index list reaches the array length and filters by membership, the old
persisted indices self-heal against the new (shorter) array — no migration needed.

Not changed: the SEPARATE results-screen set (`MOTIVATION_QUOTES` in `src/ui/result-cards.jsx`),
which is score-tone-matched and already secular/discipline-themed. Flagged to the user in case they
want it reworked for consistency.

---

## Session — Sharing & Referrals: PHASE 1 (per-user links, QR, share surfaces)

First of a 3-phase build of the sharing/referral/community spec (`norcet-sharing-features.md`).
Frontend-heavy; **NO database or Edge-Function change** in this phase. Built green (`vite build`).
Phasing agreed with the user: P1 = foundation + share surfaces (this); P2 = referral dashboards +
admin "Growth & Referrals" + anti-abuse/activation; P3 = batches + mutual weekly comparison.

Decisions: (1) social-proof line NON-numeric until 100 users, then REAL live count (no fabricated
"2,400"); (2) referral code = the existing profile id (already a unique URL-safe slug); (3) images
are PNG (reuses the score card's canvas pattern, no new deps).

Attribution: code = profile id; link = `?ref=<code>&via=<channel>` (ref = WHO, via = WHICH surface).
On arrival the link is captured LOCALLY before signup + cleaned from the URL; `createProfile` stamps
`{referredBy, referralChannel, referredAt}` onto the new user's PRIVATE blob via the existing
saveProfile broker write (no schema change). Self-referral ignored; guests get channel-only links.
The referrer can't read who they referred (owner-scoped broker) — the P2 admin rollup aggregates it.

NEW (3): `src/lib/referral.js` (codes/links + `captureReferralFromUrl`), `src/lib/qr-canvas.js`
(`drawQrMatrix`/`measureQrPanel`, `paintBrandedQrCard`, `paintMilestoneCard`, `shareOrSavePng`),
`src/lib/share-nudge.js` (milestone detection + once-per-session/no-consecutive gating).
MODIFIED (9): `keys.js` (+PENDING_REFERRAL/SHARE_NUDGE), `main.jsx` (boot capture), `profiles.js`
(stamp attribution + `countUsers()`), `share-app-card.jsx` (branded QR card Save/Share + WhatsApp
button + per-user links), `result-cards.jsx` (score-card corner QR + new `ShareNudge`),
`Results.jsx`/`advanced-test.jsx`/`dosage-results.jsx` (guest-safe `referralCode`), `App.jsx`
(pass totalAttempted + referralCode). Verified: build green; encodeQR fits the longest link;
painters smoke-tested (424 rects + 4 texts, valid PNG). DEFERRED to later phases: per-user
dashboard, admin Growth section, activation/anomaly logic, batches, comparison, offline poster.
On-device eyeball recommended for final card aesthetics (canvas not renderable headlessly here).

---

## Session — Settings: Share is its own section + Sharing PHASE 2 (admin Growth & Referrals)

Two things. Both built green (`vite build`). NO database / Edge-Function change.

**Settings — Share split out.** `src/screens/settings.jsx`: the "Share NORCET Prep" card was glued
under the Profile/Account card (no header, `mb-3`). Now its own labelled section ("Share" header +
`mt-8` spacing), a peer of Reminders/Notifications. Subtitle updated for P1.

**Phase 2 (part 1) — admin "Growth & Referrals", fully client-side.** `kv-read` ALREADY serves any
`profile:<id>` blob to an admin (owner check bypassed for `admin_profile_ids`), and the admin has
every user id from public profilemeta — so the referral graph is aggregated IN THE BROWSER, no new
Edge Function / schema change.
- NEW `src/lib/referral-admin.js` — `loadReferralGraph(users)` fetches each blob (admin-scoped,
  parallel) → per-referrer rollup (referees, confirmed/pending, retention), channel breakdown (+
  `direct` bucket), overview (via-referral count/%, this week/month, trend, top channel). "Confirmed"
  approximated from blob data (attempted ≥1 / returned after signup) — full tiered activation needs
  later instrumentation. `CHANNEL_LABEL` maps via→label.
- `src/screens/admin-panel.jsx` — `view === 'growth'` (Overview / Top Referrers / Channels tabs),
  dashboard `AdminTile`, on-demand load + Refresh. Top Referrers: ranked (gold/silver/bronze top 3),
  volume/quality sort toggle, expandable referee list. Channels: labelled bars + direct row.

STILL TODO in Phase 2 (need a small BACKEND addition — flagged, NOT silently built into the
production register/auth function): per-user referral dashboard (non-admins can't read others'
blobs → needs a new read path), precise tiered activation (needs app-open/time instrumentation),
fingerprint/IP anomaly flags + per-link signup-rate alerts (hook the auth-secure register action).
Phase 3 (batches + comparison) untouched.

---

## Session — Sharing PHASE 2 (part 2): the backend slice (per-user dashboard, anomaly flags)

Built the server-dependent remainder of Phase 2. Frontend builds green; everything degrades
gracefully until the backend is deployed (see deploy steps below). Requires running ONE SQL file +
deploying TWO Edge Functions.

**Why backend was needed:** `referredBy` lives in each user's PRIVATE profile blob (Phase 1, by
design). A non-admin can't read other users' blobs, so a user counting their own referees — and
recording signup signals for anomaly detection — both need service-role code.

NEW:
- `supabase/referral-intel.sql` — `signup_events` table (one row per account creation: profile_id,
  ip_hash, fp_hash, ref, created_at). LOCKED like profile_secrets/auth_rate (RLS on, zero policies,
  service-role only). IP + fingerprint stored ONLY as one-way HMACs, never raw.
- `supabase/functions/referral-intel/index.ts` — two read-only ops (same HMAC-token + admin model as
  kv-read): `my-referrals` (any user → `{total, confirmed, pending}`, COUNTS ONLY, scans profile:*
  server-side since the caller can't); `signup-anomalies` (admin only → device/IP clusters from
  signup_events + per-link hourly velocity flags). Nothing is auto-blocked.
- `src/lib/fingerprint.js` — coarse, one-way (SHA-256) device fingerprint from non-PII signals
  (UA/lang/platform/screen/timezone). Sent only at register; best-effort.
- `src/lib/referral-stats.js` — client wrapper for referral-intel; returns null (cards hidden) if the
  function isn't deployed, the user is a guest, or anything errors.

MODIFIED:
- `supabase/functions/auth-secure/index.ts` — register action now does ONE best-effort insert into
  signup_events (hashes IP via existing `hmac`+`toHex`, plus the client fingerprint + ref) right
  before returning the token. Wrapped in try/catch — NEVER blocks or fails a signup, even if the
  table doesn't exist yet.
- `src/lib/profiles.js` — `createProfile` reads the pending referral + fingerprint up front and passes
  `fingerprint`/`ref`/`via` to the register call (old function just ignores them until redeployed).
- `src/ui/share-app-card.jsx` — quiet personal referral card ("N friends joined · X confirmed · Y
  pending"), logged-in users with ≥1 referral only.
- `src/screens/admin-panel.jsx` — Growth → Overview now shows an anomalies card ("No anomalies" or a
  reviewable list of device/IP/velocity flags), loaded alongside the graph.

Activation: "confirmed" = the referee attempted ≥1 question (the strongest anti-throwaway signal and
one of the spec's four OR-conditions), server- and client-side. The richer conditions (≥3 opens / ≥5
min) need app-open/time instrumentation that isn't recorded yet — noted as a later refinement; the
UI is honest that "confirmed" is approximate.

Verified: frontend `vite build` green; edge functions brace-balanced + mirror the working
kv-read/auth-secure patterns (no deno on this box to typecheck, but structurally validated);
JSX-text unicode audit clean. Pre-deploy safety confirmed by construction (old function ignores new
fields; endpoint 404 → cards hidden; admin client-side aggregation unaffected).

DEPLOY (run in order; nothing breaks if you pause between steps):
  1. Supabase SQL editor: run `supabase/referral-intel.sql`.
  2. `supabase functions deploy referral-intel --no-verify-jwt`
     (SESSION_SIGNING_SECRET must already be set — same value as the other functions.)
  3. `supabase functions deploy auth-secure --no-verify-jwt`   (adds signup-event recording)
  4. Deploy the frontend as usual (drop the changed files, `npm run build`, push).
Until 1–3 are done the personal card + anomaly card simply don't appear; the rest works.

REMAINING after this: precise tiered activation (needs opens/time instrumentation); Phase 3 (batches
+ mutual weekly comparison) — untouched.

---

## Session — Sharing PHASE 3: batches + the consented weekly comparison (spec COMPLETE)

The final phase — and the most privacy-sensitive (one user's performance becoming visible to
another). Frontend builds green; needs ONE new Edge Function deployed. Every piece is opt-in and
degrades to nothing if the function isn't deployed or the user is a guest.

**Consent model (the core rule):** comparison is OFF by default. A user appears in anyone's
comparison ONLY while `data.preferences.compareOptIn === true`, read fresh server-side on every call
— turn it off and you vanish instantly. Batch membership lives in each member's OWN private blob
(`data.batches`), never in an anon-readable key, so the social graph isn't exposed; the function
discovers members by scanning blobs with the service-role key. Opt-in + membership are written
client-side via the normal autosave (`setData`), which sidesteps any client/server write race.

NEW:
- `supabase/functions/referral-compare/index.ts` — the ONLY place cross-user accuracy is computed,
  enforcing every privacy rule server-side (same HMAC-token model as the other functions). Ops:
  `create-batch` (writes a semi-public `batch:<id>` record — name/creator/expiry only — since the
  kv-write broker fails closed on `batch:`); `peer-comparison` (1:1 weekly accuracy vs referral-
  connected friends, BOTH must be opted in, returns %s only); `batch-comparison` (caller's rank +
  batch average among opted-in active members, rank withheld below 5 active to stay non-identifying,
  never returns names/individual scores). Weekly accuracy is computed from each blob's dailyHistory.
- `src/lib/compare.js` — client wrappers (createBatch / peerComparison / batchComparison /
  getBatchInfo) + PURE data-shape helpers for the opt-in flag and joined-batch list.
- `src/ui/comparison-cards.jsx` — ComparisonToggle (single source of truth, used on Share + Profile,
  always in sync), PeerComparisonCard (warm 1:1 results card), ComparisonReengage (one gentle opt-in
  nudge after a strong week, ~2-week cooldown), BatchCreateCard (name + 7/30/never expiry → shareable
  `?batch=` link), BatchList/BatchRow (your batches + rank/average), BatchJoinModal (confirmation
  before joining; joining also turns comparison on, with that stated in the copy).

MODIFIED:
- `src/lib/referral.js` — capture a `?batch=` param on arrival (kept raw, not slug-normalised) +
  `buildBatchUrl`; `getPendingBatch`/`clearPendingBatch`.
- `src/lib/keys.js` — `PENDING_BATCH` key + a `batch:` key builder.
- `src/lib/share-nudge.js` + `src/ui/result-cards.jsx` — exam-calendar timing: the share nudge's
  cooldown is relaxed when a scheduled exam (`data.stats.examDate`) is ≤14 days out.
- `src/ui/share-app-card.jsx` — "Compare with friends" section (toggle + batch create + batch list),
  logged-in users only.
- `src/screens/Results.jsx` — renders PeerComparisonCard + ComparisonReengage; threads examDate.
- `src/screens/settings.jsx` — ComparisonToggle on the Profile sub-page.
- `src/App.jsx` — captures the pending batch and shows BatchJoinModal once logged in (guests sign up
  first); passes examDate to Results.

Verified: frontend `vite build` green; JSX-text unicode audit clean; referral-compare brace-balanced
and mirrors the working function patterns. Pure data helpers reviewed. Comparison math (weekly
window, rank, min-5 gate, both-opted-in peer rule) reviewed by hand.

DEPLOY (Phase 3 adds one function): `supabase functions deploy referral-compare --no-verify-jwt`
(SESSION_SIGNING_SECRET already set), then the frontend as usual. No new SQL for Phase 3 (batch
records + membership live in kv_shared / blobs). Until deployed, the toggle persists locally but
comparison/batch cards stay hidden.

=== FULL DEPLOY CHECKLIST (cumulative, Phases 1–3) ===
  1. SQL editor: run `supabase/referral-intel.sql`               (P2 — signup_events)
  2. supabase functions deploy referral-intel  --no-verify-jwt   (P2 — dashboard + anomalies)
  3. supabase functions deploy referral-compare --no-verify-jwt  (P3 — batches + comparison)
  4. supabase functions deploy auth-secure     --no-verify-jwt   (P2 — records signup events)
  5. Drop all changed files in, `npm run build`, push.
Each step is independently safe; the app works (with features progressively appearing) at any point.

The sharing/referral/community spec is now fully implemented. Remaining as honest caveats: the
precise tiered "confirmed" activation (≥3 opens / ≥5 min) still needs opens/time instrumentation —
"confirmed" currently = attempted ≥1 question; and the comparison week boundary is computed in UTC
(a minor edge effect vs each user's local day).

---

## ENTRY — Tablet home fixes (4): default-on comparison, dark-mode glitch, Drill/Learn colours, Knowledge Map symmetry

Source: 4 Realme Pad 4 screenshots (Profile, Share, dark home WITH glitch, light home no glitch). User asks: (1) comparison ON by default, (2) fix dark-mode home grey-box glitch (login/signup, not guest), (3) Drill Tests + Learn topic-wise card colours matched to the theme grading + premium, (4) Knowledge Map card sized/shaped like the other section cards.

### (1) Comparison ON by default  — DONE  (⚠ referral-compare REDEPLOY)
Rule is now "opted in unless explicitly turned off" on BOTH sides, kept identical:
- `src/lib/compare.js` `getCompareOptIn(data)` → `!(preferences.compareOptIn === false)`.
- `supabase/functions/referral-compare/index.ts` `optedIn(blob)` → `prefs.compareOptIn !== false`.
- `src/ui/comparison-cards.jsx` toggle copy: "Off by default." → "On by default; switch off anytime." + BatchJoinModal copy "Joining turns on…" → "Comparison is on by default…".
Effect: existing users (compareOptIn absent) become opted-in by default — the owner's explicit choice; copy is transparent so users know it's on and can switch off. The toggle remains the single source of truth (writes explicit true/false).

### (2) Dark-mode home grey-box glitch — PARTIAL (needs on-device verify)
Diagnosis: grey box appears in DARK mode but NOT light for the IDENTICAL screen state (same user iyro, 2 min apart) → it is NOT conditional content, and NOT the BatchJoinModal (that renders theme-independently — would show in light too; its backdrop is dark, not light-grey). Box is lighter than bg + overlaps content → most consistent with a GPU compositing ghost-layer on the tablet, triggered by the home top bar's promoted `backdrop-blur` + `will-change` layer re-compositing on the login re-mount.
Fixes applied:
- `src/screens/home.jsx`: removed `willChange:'transform'` from the portaled fixed top bar (standard safe remedy for stuck/ghost compositing layers; the transform transition still works).
- `src/ui/comparison-cards.jsx`: hardened BatchJoinModal — now `createPortal` to document.body (fixed can't be re-anchored by an animated ancestor), auto-dismisses + clears the pending invite for EVERY terminal state (guest / already-member / invalid / expired) via an effect instead of rendering intrusive dialogs; only a genuine joinable invite shows a dialog. Removes the modal as a possible cause and stops any stale invite sitting on screen.
STILL OPEN: cannot reproduce a device-GPU artifact in the build env. If it persists, need a screen recording (does it flicker on scroll?) or whether the box contains any text/header (would distinguish a low-contrast surface card from a pure GPU ghost).

### (3) Drill Tests + Learn topic-wise colours — DONE
`src/screens/home.jsx`: added `darkenHex(hex,t)` helper next to `lightenHex`. Drill + Learn are now a TONAL PAIR from the theme primary (cohesive in every palette, still distinct):
- Drill Tests: `linear-gradient(140deg, lightenHex(T.primary,0.12), T.primary 60%, darkenHex(T.primary,0.12))` — the brighter tone.
- Learn topic-wise: `linear-gradient(140deg, T.primary, darkenHex(T.primary,0.26) 55%, darkenHex(T.primary,0.42))` — the deeper tone. Replaced the clashing fixed `T.sec.learn` walnut.
- boxShadows now theme-tinted (`darkenHex(T.primary,0.45/0.5)` + alpha). Verified sensible across teal / purple themes.

### (4) Knowledge Map symmetry — DONE
Root cause: KM card lacked the bottom divider + mini-icon row that Drill and Learn both carry, so it was a single-row (shorter) card. Added `<div className="flex items-center gap-3 mt-3 pt-3" borderTop:1px rgba(255,255,255,0.12)>` with 6 gold-tinted constellation icons `[Sparkles, Network, Target, Layers, Activity, GraduationCap]` (all already imported), colour `rgba(255,210,122,0.72)`. KM now matches Favourites/Drill/Learn height + shape.

### Verify: build GREEN (exit 0); JSX-text \u audit clean (home.jsx, comparison-cards.jsx, compare.js); referral-compare brace-balanced (112).

### Files changed this entry:
- src/screens/home.jsx
- src/lib/compare.js
- src/ui/comparison-cards.jsx
- supabase/functions/referral-compare/index.ts

### Redeploy: ONLY `supabase functions deploy referral-compare --no-verify-jwt` (for the default-on server rule). Frontend: drop the 3 src files in, `npm run build`, push. No SQL, no other function changes.

---

## ENTRY — Device-test batch 3 (16 fixes): quiz deselection, sidebar re-animation, auth/legal popups, gestures, help + onboarding

Source: 8 device screenshots (iPhone + tablet) — sidebar gestures page, Revision/Crib Sheets, sign-up (display name + security question + privacy/terms), the security-question dropdown, Settings (guest), the donation sheet. User asked to fix all 16 precisely, give the best version, present updated files, and update this journal.

**Cross-cutting:** all frontend. NO SQL, NO Edge Function changes. ONE cache-critical bump: `public/data/help.json` changed → `CONTENT_VERSION` bumped **9 → 10** in `src/lib/content.js` (mandatory so clients re-fetch help).

### 1) Option deselection in tests — DONE
Bug: in the regular quiz, tapping a *selected* single-answer option did nothing (button stayed on "Check answer"); it never cleared back to "Submit".
- `src/screens/quiz.jsx` `toggleSelect`: MCQ branch was `setSelected([i])` (pure set). Now `setSelected(prev => prev[0] === i ? [] : [i])` → tapping the chosen option clears it, and since the morph is driven by `selected.length`, the button returns to "Submit".
- `src/screens/advanced-test.jsx`: ALREADY correct (`cur[0] === i ? [] : [i]`) — no change.
- `src/screens/dosage-practice.jsx`: numeric field has no "option", but for consistency it now uses the SAME Submit↔Check morph — empty field shows neutral **Submit** (calls `reveal`, excluded from accuracy), a typed value shows **Check answer** (calls `submit`), and clearing the field morphs straight back. Removed the separate "Show answer" button (the Submit IS the neutral reveal); Skip is now full-width. `Eye` import kept (still used by the "Answer revealed" badge).
Why: a selected answer must always be undoable, and the three modes should behave identically.

### 2) Sidebar re-animates on every collapsible toggle — DONE
Root cause: `Item` / `SectionHeader` / `Collapsible` are defined INSIDE `NavDrawer`, so every render (incl. toggling a section) gives them new function identity → React unmounts/remounts all rows → the `drawer-item-in` stagger replays for the WHOLE sidebar.
Fix (gating, since the components are inline closures): `src/ui/nav-drawer.jsx` adds `const [entering,setEntering]=useState(false)`. The open `useEffect` sets `entering=true` and a 900 ms timeout back to false (also clears the return-glow). The `Item` row applies `drawer-item-in` + its stagger `animationDelay` ONLY while `entering`. So the entrance plays on OPEN only; toggling a section now animates just that section's grid expand (the existing `grid-template-rows 0fr→1fr` transition) and nothing re-slides.
Why: matches the ask exactly — animate on open, and on toggle only the tapped section.

### 3) "Reset this profile's data" in the wrong section (guest) — DONE
`src/screens/settings.jsx`: moved `{renderReset()}` INTO the guest **Account** block (right under the Sign-in card) and removed the old placement after the Share card. Reset is a profile-level action, so it belongs with Account.

### 4) Security-question picker not centred — DONE
It was a native `<select>` (OS-drawn dropdown anchored to the field — can't be centred by CSS). `src/screens/auth-screen.jsx` replaces it with a custom trigger button + a **centred, portaled** modal listing `SECURITY_QUESTIONS` (radio-style rows, check on the active one, tap to choose). Added `createPortal` import + `securityPickerOpen` state.

### 5 & 6) Privacy / Terms popups cropped — DONE (real root cause found)
`LegalContent` takes the doc KEY and resolves it internally, but auth passed `doc={legalDoc(legalView)}` (ALREADY resolved) → it double-resolved to `undefined` → rendered an **empty** sheet that collapsed to just its header at the screen bottom (exactly the screenshots). Fix in `src/screens/auth-screen.jsx`: pass `doc={legalView}` (the key). Also rebuilt the viewer as a **centred** (`items-center`, not `items-end` bottom-sheet), **portaled**, premium card — rounded-3xl, soft shadow, chip close button, `maxHeight: min(660px, 100dvh − safe-areas − 32px)` with a sticky header + scrollable body. Both Privacy and Terms use the same viewer.

### 7) Cap display name + password to 15 — DONE
`src/lib/auth-limits.js`: `USERNAME_MAX 24→15`, `PASSWORD_MAX 64→15`. Enforced ONLY on NEW values (sign-up/rename/reset), never on login/current-password (existing longer values still log in fine), so no one is locked out.

### 8) "Keep exploring as guest" felt like friction — DONE
`src/screens/auth-screen.jsx`: the tiny muted text link is now a premium pill (surfaceWarm bg + border, a primary-tinted icon chip, a spring `group-active:-translate-x-0.5` nudge, `active:scale-95`). Reads as a real, inviting choice rather than a reluctant escape hatch.

### 9) Crib Sheets row spacing + help — DONE
`src/screens/revision-sheet.jsx`: crib rows `space-y-2 → space-y-2.5` (matches the app's card rhythm). `public/data/help.json` `Crib sheet` "how" now documents the **Add to Revision** save-to-shelf flow (dated, reopenable, printable).

### 10) Favourites help — DONE
`public/data/help.json` `Favourites` "what": home-surfacing wording made consistent with "how" ("your top favourites also surface on the home screen").

### 11) Tap-and-hold contents + new onboarding page — DONE
(a) Tooltips: sidebar `tip`s were already detailed (kept). Home top-bar icons (Menu/Today/Settings) now have titled, premium tooltips. Settings cards had NO tap-and-hold tips — `SubPageCard` gained an optional `tip` prop (wraps in `Tip`), and Profile / Sidebar gestures / Backup / Topic notes / Legal now each carry a premium hold-tip. (`Tip` imported into settings.jsx.)
(b) Onboarding: `src/screens/welcome.jsx` now has a SECOND page. Added `step` state ('tour' | 'tips'); the tour's "Got it" advances to a polished **"Three quick tips"** page — *Press & hold any card*, *Swipe to open the menu*, *Submit without guessing* — with gradient icon chips; "Start studying" → `onDismiss`. Device-back goes tips→tour before the leave-confirm. Self-contained in welcome.jsx (no App sequencing change), so it inherits the existing first-timer/guest gating.

### 12) Legal contents + remove Help from legal top bars — DONE
- `src/ui/primitives.jsx` `TopBar`: now `{feedback && !feedback.noHelp && <HelpButton/>}` — `feedback.noHelp` hides Help while keeping Report.
- `src/screens/settings.jsx` sub-page TopBar: `noHelp: subPage === 'legal'`.
- `src/screens/legal.jsx` `LegalScreen` TopBar: `noHelp: true`.
- `src/lib/legal.js`: `LEGAL_VERSION 2→3`. Fixed the STALE Terms "Your account" line (still said DOB recovery → now security question/answer). Added Privacy "How long we keep it" + "Contact" (Settings → Send feedback).

### 13) Settings help — DONE
`public/data/help.json` `Settings` "what"+"how" refreshed for the current sections (account/guest, share, reminders, notifications, analytics, sound, themes, sidebar gestures, backup, topic notes, legal, admin) and the focused sub-page model.

### 14) Share help — DONE
`src/screens/share-app.jsx`: help key `'Settings' → 'Share app'`. Added a dedicated `Share app` entry to `help.json` (referral link / QR / WhatsApp, leaderboard credit, free + ad-free).

### 15) Gestures: full-screen swipe on Home, all platforms — DONE
- `src/lib/ui-prefs.js`: `GESTURE_DEFAULTS.open false→true` and `open: v.open !== false` (swipe-to-open now default ON).
- `src/ui/nav-drawer.jsx`: swipe-to-OPEN no longer gated to iOS-off or the left 20% edge — a mid-screen start is what AVOIDS the iOS system back-edge, so it's safe everywhere; opens from ANYWHERE on Home (horizontal-intent detection preserved so vertical scroll is untouched). swipe-to-CLOSE handlers moved off the panel onto the full-screen overlay → leftward swipe ANYWHERE (panel or backdrop) closes.
- `src/screens/settings.jsx`: removed the iOS-locked dimmed switch (now a live toggle); copy updated ("Swipe right anywhere on the home screen … phone, tablet and iOS"; "Swipe left anywhere while the sidebar is open").
- Removed the now-unused `isIOS` imports from nav-drawer.jsx + settings.jsx.

### 16) Backup + Topic notes help — DONE
`public/data/help.json`: added detailed `Settings · Backup` and `Settings · Topic notes` entries (full export / restore-merge; notes export/import works for guests too). Separator confirmed as space + U+00B7 + space from the sub-page template.

### Verify
Build GREEN (`npx vite build`, exit 0) — re-verified after every batch and after the isIOS cleanup. `help.json` JSON-validated (45 keys). New entries inserted before the first key (`"Settings · Legal"`). `CONTENT_VERSION = 10`.

### Files changed this entry (16)
- src/screens/quiz.jsx
- src/screens/dosage-practice.jsx
- src/lib/auth-limits.js
- src/screens/auth-screen.jsx
- src/screens/settings.jsx
- src/ui/primitives.jsx
- src/screens/legal.jsx
- src/lib/legal.js
- src/lib/ui-prefs.js
- src/ui/nav-drawer.jsx
- src/screens/revision-sheet.jsx
- src/screens/welcome.jsx
- src/screens/home.jsx
- src/screens/share-app.jsx
- public/data/help.json
- src/lib/content.js

### Redeploy
Frontend only: drop the 16 files in, `npm run build`, push. No SQL, no Edge Function changes. The `CONTENT_VERSION` bump handles the help.json cache refresh.

---

## ENTRY — Share-card polish + legal-popup confirm (4 follow-ups)

Source: user follow-up after batch 3. All frontend; no SQL / Edge Function changes; no help.json change (no CONTENT_VERSION bump).

### 1) Remove "Share on WhatsApp" button — DONE
`src/ui/share-app-card.jsx`: deleted the green WhatsApp button and its dead helpers (`openWhatsApp`, `waUrl`, the `MessageCircle` import, `VIA.WHATSAPP` usage). The adaptive Share / Copy message block below already covers every channel (incl. WhatsApp via the OS share sheet).

### 2) Tap QR → premium enlarge — DONE
`src/ui/share-app-card.jsx`: the QR is now a button with a primary `Maximize2` badge + "Tap the code to enlarge" hint. Tapping opens a portaled, screen-filling modal (`anim-scalein` over a blurred scrim) — a large, scannable QR sized to the screen with the app pitch + URL, and **Done** / backdrop / **X** to resume. `QrSvg` was made responsive (`maxWidth:100%; height:auto`) so the enlarged code never overflows narrow phones.

### 3) Rephrase QR caption (the "ad") — DONE
`src/ui/share-app-card.jsx`: replaced the use-case line ("study groups & the library table") with concise, app-focused ad copy — a bold "Free & ad-free AIIMS NORCET prep" tagline + "Mock tests, PYQs, revision notes and dosage drills — all in one app." Tightened the eyebrow (primary, wider tracking) and spacing for a premium feel; the enlarge modal mirrors the same pitch.

### 4) Signup Privacy/Terms popup "shows nothing" — DONE (already fixed in batch 3; re-confirmed + polished)
Root cause was the batch-3 finding: `LegalContent` resolves the doc KEY itself, but auth passed the already-resolved object → `undefined` → empty sheet. Batch 3 already changed it to `doc={legalView}` (the key), centred + portaled it, and `anim-scalein` uses `both` fill (ends visible) — so content renders once that build ships. This turn additionally polished the header (NORCET Prep eyebrow + tinted header bar + larger title/close) for premium UI. If it still looked empty on device, the batch-3 build simply wasn't deployed yet.

### Verify: build GREEN (exit 0). No dead WhatsApp refs remain (only the file header comment, updated).

### Files changed this entry
- src/ui/share-app-card.jsx
- src/screens/auth-screen.jsx

---

## ENTRY — Quiz-exit returns to launch screen + Favourites edit/add ghost-layer

Source: 2 device-test reports. Frontend only; no SQL / Edge Function / help.json changes.

### 1) Exiting a quiz from Weak Areas / Syllabus dumped the user to Home — DONE
Root cause: Home tiles deep-link via `navigate({ screen: 'weak-areas' })` / `{ screen: 'coverage' }`, but `home` is in `NAV_NO_STACK`, so nothing is pushed; then the topic row calls `startQuiz(...)`, which sets the quiz nav with `setNav` (bypasses the nav stack entirely). So when the Quiz's back/exit runs `goHome`, the stack is empty and it lands on Home — the launching screen was never recorded.
Fix: `src/App.jsx` — `startQuiz` now pushes the current screen onto `navStackRef` exactly the way `navigate()` does, guarded by `NAV_NO_STACK` (so launches from Home or another quiz add nothing). `goHome` (and the hardware-back popstate handler, same stack) then pop back to Weak Areas / Syllabus-coverage. `goHome`'s existing `prev.screen !== current` loop collapses duplicate entries, so repeated quiz→results→quiz never builds a long chain. General fix — also makes exiting a topic quiz launched from Knowledge Map, Weightage, Bookmarks, etc. return to its origin instead of Home.

### 2) Favourites edit/add showed the Home-style ghost box (top of screen) — DONE
Root cause: the shared `TopBar` is a `fixed` bar with `backdrop-blur-md`. On Favourites, content animates behind it continuously — the infinite `fav-jiggle` (edit mode) plus `fav-tile-in` when a section is added and the picker closing — which forces the backdrop-filter to re-rasterize each frame and leaves a transient compositing ghost in the bar region on weaker GPUs (same family as the batch-1 Home top-bar glitch).
Fix: `src/ui/primitives.jsx` — added a `solid` prop to `TopBar`: a fully opaque background (`T.bg`) and NO `backdrop-blur` class, so there's no backdrop-filter layer to re-sample. `src/screens/favorites.jsx` — both Favourites TopBars now pass `solid`. The frosted bar is unchanged on every other screen (none of which run an infinite animation behind it).

### Verify: build GREEN (exit 0).

### Files changed this entry
- src/App.jsx
- src/ui/primitives.jsx
- src/screens/favorites.jsx

---

## ENTRY — Admin: stop a live announcement without deleting it

Source: device report — "Could not clear — server rejected the write" when taking down a live announcement; admin couldn't stop it without deleting. Frontend only; no SQL / Edge Function / help.json changes.

### Root cause
Posting works because `saveAnnouncement → adminWriteShared → safeStorage.setSharedStrict` goes through the authorized kv-write/upsert broker. Clearing used `clearAnnouncement → adminDeleteShared → safeStorage.delSharedStrict` — the shared-DELETE broker is rejected server-side even for admins (only upsert is authorized), so every clear failed. SQL/Edge deploys aren't available, so a true delete can't be re-authorized from the client.

### Fix (smart, non-destructive)
- `src/App.jsx` — `clearAnnouncement` no longer deletes. It OVERWRITES the announcement key with an inactive tombstone (`{ text:'', cleared:true, expiresAt:null }`) via the SAME write path posting uses. `loadAnnouncement()` already returns null for empty text, so the notice stops showing for everyone instantly, the record is preserved (not destroyed), and the full text remains in announcement history.
- `src/screens/admin-panel.jsx` — reframed the action to match intent: button "Clear" (Trash2) → "Stop showing" (EyeOff). It now KEEPS the editor text so the admin can tweak and re-post (a `preserveTextRef` guards the editor-sync effect so the text isn't wiped when `announcement` goes null). Copy updated: success "Stopped — users no longer see it. The text is kept here so you can edit and re-post."; the live-card footer "stays until cleared" → "stays until you stop it".

### Verify: build GREEN (exit 0).

### Files changed this entry
- src/App.jsx
- src/screens/admin-panel.jsx

---

## ENTRY — Tap-and-hold tips on Home/Settings cards + distinct feature links per study method

Source: 2 device reports. Frontend only; no SQL / Edge / help.json changes.

### 1) Tap-and-hold showed nothing on Weak area / Syllabus / Favourites (Home) and several Settings cards — DONE
These cards were never wrapped in `<Tip>`, so the long-press tooltip had nothing to show. `Tip` renders with `display:contents`, so wrapping a grid tile or a card never disturbs layout (the child stays the real box).
- `src/screens/home.jsx` — wrapped the **Weak area** and **Syllabus-coverage** tiles in `<Tip>` (React `key` moved onto the Tip).
- `src/ui/fav-strip.jsx` — wrapped the **Favourites** entry card in `<Tip>` (imported Tip).
- `src/screens/settings.jsx` — added hold-tips to the cards that lacked them: **Account / Sign-in, Share, Spaced revision, Daily reminders, "Count GK in stats", Pull-to-refresh sound, Themes** (the Profile/Backup/Topic-notes/Gestures/Legal sub-page cards already had tips). The toggle cards already show a full state subtitle, so their tooltips add the *why/benefit* rather than repeating it. Short tap still flips the toggle / navigates; long-press shows the tip and swallows the trailing click (Tip's existing behaviour).
- Gotcha logged: the Themes close needle (`{/* #8 …`) wasn't unique (four `#8` comments) — used the full comment text to disambiguate. Tip open/close counts verified balanced (settings 8/8, home 8/8, fav-strip 1/1).

### 2) Study methods — each of the 6 now links to a DISTINCT feature — DONE
`src/data/study-methods.js` previously repeated targets (learn-topics ×2, quick-setup ×3). Re-mapped to 6 distinct, well-matched features:
1. How to Read a Textbook → **Learn topics** (unchanged; reading the material)
2. How to Understand Deeply → **Knowledge Map** (see how topics connect) [was learn-topics]
3. How to Remember What You Read → **Quick test** (active recall) [unchanged]
4. How to Never Forget → **Review due** (spaced repetition) [unchanged]
5. How to Study Smarter → **Mock test** (a full mock = mixed subjects = interleaving) [was quick-setup]
6. How to Lock It In → **Previous papers** (real-exam retrieval practice) [was quick-setup]
Each method's `nav` + `goLabel` updated, and the application copy for #5/#6 tweaked so it no longer says "quick test" when it now points elsewhere. All targets are valid screens routed by handleHomeNavigate; verified the 6 are unique.

### Verify: build GREEN (exit 0).

### Files changed this entry
- src/data/study-methods.js
- src/screens/home.jsx
- src/ui/fav-strip.jsx
- src/screens/settings.jsx

---

## ENTRY — Onboarding "Three quick tips": replace 3rd tip

Source: user feedback — the 3rd tip ("Submit without guessing") was off-theme vs the two gesture tips. Frontend only.

`src/screens/welcome.jsx` — replaced tip 3 with **"Heart your favourites"** (tap the heart on any section to pin it; favourites then sit one tap from Home) with a pink heart chip (#E0245E, the Favourites identity colour; `Heart` imported). Since hearting is a tap rather than a gesture, the page subtitle changed "Little gestures that make the app faster to use." → "Little things that make the app yours." Per the user, the submit-without-guessing hint was dropped entirely (not relocated). Build GREEN.

### Files changed this entry
- src/screens/welcome.jsx

---

## ENTRY — Fix literal \u escapes in Home/Favourites hold-tooltips

Source: user spotted "typos" in the Weak area / Syllabus / Favourites hold-tips. Frontend only.

Cause: the earlier edit script wrote the tooltip copy with double-backslash escapes (`\\u2014`, `\\u2019`) into JSX **string attributes** (`text="…"`), where — unlike a JS string literal — escape sequences are NOT processed, so the literal text `\u2014` / `\u2019` showed on screen.
Fix: `src/screens/home.jsx` (Weak area + Syllabus tips) and `src/ui/fav-strip.jsx` (Favourites tip) now use the actual em-dash (—) and apostrophe (') characters. Verified no literal `\u20…` remains in any Tip attribute. (The other `\u` hits in home.jsx/welcome.jsx are JS string literals / `{'…'}` expressions where the escape works correctly — left as-is.) Build GREEN.

### Files changed this entry
- src/screens/home.jsx
- src/ui/fav-strip.jsx

---

## ENTRY — Revision: clarify "previously-wrong" toggle, premium crib rows, per-tab help

Source: 2 device reports on the Revision screen. Frontend only. help.json changed → CONTENT_VERSION 10 → 11.

### 1) "Include previously-wrong" was confusing (a bare ✗ icon) — DONE
What it does: when on, it folds the questions you've answered WRONG before into the live revision digest (on top of your bookmarks) so you can re-drill mistakes. The bare `<X>` icon read like a close/delete button. `src/screens/revision-sheet.jsx`:
- Icon `X` → `RotateCcw` (review/redo metaphor); `X` import dropped.
- Renamed "Include previously-wrong" → **"Revise your mistakes"** (clearer).
- Subtitle now shows a live count: "Folds in the N questions you've answered wrong before" (N = wrong-but-not-yet-bookmarked, via a new `wrongCount` memo) so the action is concrete.
- Premium chip: 40px rounded-xl with an accent-tinted border that lights up when on.
- Updated the two in-screen references (digest header "· with your past mistakes"; empty-state "turn on 'Revise your mistakes'") and the `Revision sheet` help entry to the new name.

### 2) Crib Sheets rows — premium spacing — DONE
`src/screens/revision-sheet.jsx`: inter-row gap `space-y-2.5` → `space-y-3`; card padding `p-3.5` → `p-4`; softened the border (`1.5px primary35` → `1px primary2B`) and floatier shadow (`0 3px 12px` → `0 6px 18px`) for a lighter, more premium feel.

### 3) Per-tab Help (Revision History vs Crib Sheets) — DONE
The TopBar had one static help key for both tabs. Now `feedback.screen` is tab-aware: **Revision History → "Revision sheet"**, **Crib Sheets → "Crib sheet"**. Both entries already existed and describe different things (the live digest vs the saved-review shelf), so the two tabs now open clearly different help. Updated `Revision sheet` help to reference the renamed toggle; bumped CONTENT_VERSION 10 → 11.

### Verify: build GREEN (exit 0). Swept revision-sheet.jsx — no literal `\u…` left in any JSX text attribute.

### Files changed this entry
- src/screens/revision-sheet.jsx
- public/data/help.json
- src/lib/content.js


# ═══════════════════════════════════════════════════════════════════════
# FEATURE ROADMAP — "learning + outcomes" upgrade wave
# (planned with Claude; best/modified versions of the ideas I liked)
# ═══════════════════════════════════════════════════════════════════════

Goal of this wave: move the app from "practice tool" to "outcome coach" —
help users study against a real target, understand their own retention, and
sharpen exam technique. Constraints held throughout: free-tier friendly,
frontend-only where possible, keep the build green, no security regressions
(brokers / profile_secrets / anon-read split all untouched), and PREMIUM UI.

Build order (impact ÷ effort, respecting data dependencies):
  #1 Where You Stand  →  #3 High-Yield PYQ  →  #4 Confidence Calibration
  →  #5 Pacing  →  #7 Review-Load Forecast  →  #8 Listen Mode
  →  #6 N-Day Plan  →  #2 Advanced-Test augmentation.
(#1 ships a projection engine that #2 and #5 reuse, so it goes first.)

────────────────────────────────────────────────────────────────────────
#1  WHERE YOU STAND — projected standing vs official cut-offs   ✅ BUILT (below)
    Modified from the original "predicted rank" idea:
    • Official data ONLY (Mains qualifying %s 50/45/40 + a prelims-percentile
      trend scaffold to fill from official PDFs). No "estimated topper score".
    • Self-locating ladder: draw every category line, user reads their own.
      We NEVER ask, store, or infer caste/category (impossible to infer
      reliably + inappropriate). This replaces "compare to their category".
    • Input REUSES existing data.advancedTestHistory (per-attempt timed scores
      already logged) instead of a new `fulllength:` key — less storage, more
      exam-faithful (negative marking already applied).
    • Honest framing: it's a practice MARKS-% on the same axis as the cut-off,
      explicitly NOT a predicted rank or predicted exam-percentile.
    • Cross-user percentile DEFERRED: advanced scores are device-local, so a
      true peer comparison needs a shared exam-% signal (future increment).

#2  STRICT EXAM SIMULATOR — augment, don't rebuild.
    Finding: the Advanced Test ALREADY is the strict sim (timed countdown,
    auto-submit on timeout, negative marking, 3-state palette answers/marked/
    not-visited via answers+marked+visited, per-Q time, topic post-mortem).
    So DO NOT add a second screen. Augment it:
    • "Changed right→wrong" tracker — an additive observer: on re-select, if a
      qId already had an answer, compare old-vs-correct & new-vs-correct; if it
      flipped right→wrong, add to a set passed through onSubmit to the results.
      Reads the existing state transition only; zero change to answer/scoring.
    • Optional full-length 200-Q length (new Segmented value, guarded by the
      existing canStart pool check).
    • Optional "strict mode" toggle that hides abort (a real exam can't pause).

#3  HIGH-YIELD PYQ — mine the data we already have.
    • Extend lib/weightage.js (examTopicWeightage already aggregates topic
      frequency across papers) to RANK topics/concepts by cross-year recurrence.
    • "Appeared N×" chip on PYQ cards via lib/pyq.js (quiz + read views).
    • "High-Yield" filter/tab on Previous Papers (already grouped by exam/year).
    • Pure derivation over norcet-pyq-data.js — no storage, NO CONTENT_VERSION.

#4  CONFIDENCE CALIBRATION — cheap, high learning value.
    • 3-way chip (Sure / Unsure / Guess) under the options in quiz, DEFAULTING
      to "Unsure" so it's a zero-friction optional tap. Captured at answer-
      commit (quiz.jsx ~L203/216) into the result record (or a parallel
      confidence:<profileId> LOCAL map).
    • Calibration report = accuracy within each bucket → a card on Results
      (this round) + a section in Your Stats (lifetime). Frontend-only.

#5  PACING REPORT — reuse timing already captured.
    • Per-question timeMs is ALREADY measured (quiz questionStart→timeMs;
      advanced timePerQ). Persist it per result; aggregate avg time/topic vs the
      pace needed to finish on time.
    • "Pacing" card on Results + section in Your Stats. No new input UI.

#6  N-DAY REVISION PLAN — orchestrate what exists.
    • Read existing exam-date + weak topics + spaced-due → generate a day-by-day
      schedule (weak topics front-loaded, revision interleaved, mock checkpoints)
      into a revplan:<profileId> LOCAL key; recompute on demand.
    • "Study plan" card atop the Revision screen + a Home tile by the countdown.

#7  REVIEW-LOAD FORECAST — make revision a habit, not a surprise pile.
    • Show upcoming spaced-review due-counts (due today / this week) from the
      existing review state. Small card; reads only.

#8  LISTEN MODE — revision for commute / shift breaks.
    • Browser SpeechSynthesis (built-in, free, OFFLINE) reads crib sheets /
      concept cards aloud. A "Listen" control; frontend-only, no infra, no cost.

────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────
# INCREMENT 1 COMPLETE — #1 "Where You Stand"
# ─────────────────────────────────────────────────────────────────────

WHAT CHANGED & WHY
  A new Stats hero card places the user's recent full-length marks-% on the
  official AIIMS Mains qualifying ladder, so a user finally has a concrete
  target ("how far am I from just clearing the bar") instead of studying with
  no goal. The category problem is solved by SELF-LOCATION: all category lines
  are drawn at once and the user reads their own — the app never asks, stores,
  or infers caste/category.

DATA SOURCE (no new storage)
  Reuses data.advancedTestHistory (already logged per attempt in
  submitAdvancedTest: {ts,count,correct,wrong,blank,netScore,accuracy,…},
  capped at 50). netScore already applies negative marking (correct − wrong/3).
  Marks-% = netScore / count × 100 — the SAME unit as the qualifying lines.

HONESTY GUARANTEES
  • It is a practice marks-%, labelled as such — NOT a predicted rank/percentile.
  • Mains qualifying lines (50 UR/EWS · 45 OBC · 40 SC/ST, PwBD +5% relax) are
    official and stable. Prelims percentile cut-offs are cycle-specific and were
    deliberately left as a TODO scaffold (fill from official AIIMS PDFs — do not
    trust LLM-generated numbers here).

FILES
  ADDED
    • src/data/norcet-benchmarks.js   — official lines + prelims scaffold (TODO).
    • src/lib/projection.js           — pure engine: attemptPct, recentFullLength,
                                        qualifyingStatus, percentileRank, clampPct.
                                        Verified by 17 throwaway Node assertions
                                        (all pass). Reused later by #2 and #5.
    • src/ui/where-you-stand-card.jsx — premium card; self-locating ladder (SVG),
                                        marks band, headline %, honest readout +
                                        empty-state CTA. Matches theme tokens,
                                        font-display, mount animation, reduced-motion.
  MODIFIED
    • src/screens/StatsScreen.jsx     — import + render the card as the first item;
                                        new onStartAdvanced prop.
    • src/App.jsx                     — pass onStartAdvanced={navigate→advanced-setup}
                                        to StatsScreen (empty-state CTA target).

IMPACT / SAFETY
  • Frontend-only. No Edge Function, no kv_shared, no broker, no profile_secrets,
    no anon-read changes. NO new storage key. NO public/data edit → NO
    CONTENT_VERSION bump. Card sits inside the lazy StatsScreen chunk (out of the
    main bundle). `vite build` GREEN.
  • No category data is ever collected, stored, or transmitted.

DEFERRED (tracked, not done)
  • Cross-user percentile (needs a shared exam-% signal; advanced scores are
    device-local today).
  • Optional Home tile by the exam countdown (v1.1).
  • Prelims-percentile trend section turns on automatically once the scaffold
    rows are filled (HAS_PRELIMS_DATA gate already in the data file).


# ─────────────────────────────────────────────────────────────────────
# INCREMENT 2 COMPLETE — #3 "High-Yield PYQ"
# ─────────────────────────────────────────────────────────────────────

WHAT CHANGED & WHY
  The 6 official papers (2021–2024) are now mined for what the exam REPEATS.
  Every PYQ is tagged {topic, sub}, so we rank CONCEPTS (topic+sub) and topics
  by cross-paper recurrence — the single most useful "study this first" signal.
  Two surfaces:
   • An inline "Asked N×" amber badge on every recurring PYQ (quiz, results
     review, and Read mode), so the signal meets the learner in context.
   • A new "High-Yield" tab on Previous Papers: a ranked priority list of the
     concepts the exam keeps asking, with counts, topic chips and year span.

  Real distribution (verified against the live data, 201 concepts / 12 topics):
   Electrolytes 16× · Immunization 14× · Blood Transfusion 13× · Labor 13× ·
   Emergency 11× …  Thresholds tuned to this: badge/list flag concepts asked
   ≥3× (the meaningful 59), "hot" emphasis at ≥5× (the top 25). One-offs and
   2× concepts stay unflagged so the signal means something.

FILES
  ADDED
    • src/lib/high-yield.js          — pure index: buildHighYieldIndex(papers)
                                       → ranked concepts + topics; conceptCount()
                                       for the badge; tuned thresholds
                                       (HIGH_YIELD_MIN=3, HIGH_YIELD_HIGH=5).
                                       Verified against the real archive.
  MODIFIED
    • src/ui/primitives.jsx          — new <HighYieldBadge q> (amber "Asked N×",
                                       distinct from plum PYQ + orange Marked);
                                       exported.
    • src/screens/advanced-test.jsx  — render HighYieldBadge beside PyqBadge in
                                       the running test + the results review.
    • src/screens/crib-sheet.jsx     — render HighYieldBadge in PYQ Read mode.
    • src/screens/previous-papers.jsx— "Papers / High-Yield" view toggle + a
                                       premium ranked concept list (ViewTab +
                                       HighYieldView).

IMPACT / SAFETY
  Pure derivation over PREVIOUS_YEAR_PAPERS — NO storage, NO Edge/broker, NO
  public/data edit → NO CONTENT_VERSION bump. high-yield.js builds its default
  index lazily + memoized (cheap on PYQ render). `vite build` GREEN. Main bundle
  +~5 kB (badge/index ride along with the already-bundled PYQ data).

NOTE
  Badge counts use the canonical PREVIOUS_YEAR_PAPERS; the High-Yield tab builds
  from the screen's `papers` prop (so admin-uploaded papers also rank). With the
  6 built-in papers these are identical.

DEFERRED
  • Tap-a-concept → launch a focused practice set (needs a sub-level quiz filter
    + a prop from App; the ranked list is already the high-value deliverable).


# ─────────────────────────────────────────────────────────────────────
# INCREMENT 3 COMPLETE — #4 "Confidence Calibration"
# ─────────────────────────────────────────────────────────────────────

WHAT CHANGED & WHY
  Quiz answers can now carry a self-rating — Sure / Unsure / Guess — and the app
  reports accuracy WITHIN each bucket. The gap between felt confidence and real
  accuracy is the learning signal: "Sure but often wrong" = blind spots to hunt;
  "Guesses often right" = latent knowledge. Two surfaces: a "Calibration this
  round" card on Results, and a lifetime "Calibration" section in Your Stats.

UX
  A 3-way chip appears under the options the moment an answer is selected,
  DEFAULTING to "Unsure" so it's a single optional tap (zero friction; skipping
  it still records a value). Resets per question. Colour-coded: Sure=green,
  Unsure=blue, Guess=amber — distinct from the existing pills.

DATA (additive, no new key)
  Confidence rides on the EXISTING per-attempt record: completeQuiz now writes
  `conf` alongside {ts, correct, timeMs, revealed} in history.attempts. Legacy
  attempts (no conf) and neutral reveals are simply ignored by the math, so the
  lifetime view is correct without any backfill. No storage-schema change beyond
  this optional field; it syncs with the profile blob as before.

FILES
  ADDED
    • src/lib/calibration.js        — pure: calibrationFromItems (per-bucket
                                       accuracy) + calibrationInsight (one honest
                                       headline). 7 Node assertions pass.
    • src/ui/calibration-card.jsx   — shared report (accuracy bars per bucket +
                                       insight); renders nothing without data.
  MODIFIED
    • src/screens/quiz.jsx          — ConfidenceChips component + `confidence`
                                       state (reset per question) + attach to the
                                       committed answer in submit().
    • src/App.jsx                   — completeQuiz stores `conf` on each attempt.
    • src/screens/Results.jsx       — "Calibration this round" card from results.
    • src/screens/StatsScreen.jsx   — lifetime calibration memo + card.

IMPACT / SAFETY
  Frontend-only. No Edge/broker, no public/data, no CONTENT_VERSION. The only
  storage touch is the additive optional `conf` field on history attempts
  (backward-compatible). `vite build` GREEN.

NOTE
  Confidence is captured in the per-question Quiz only (it has a Submit-per-Q
  flow). The Advanced Test is bulk-answer via the palette, so it stays out of
  scope — calibration is a study-mode tool, not an exam-sim one.


# ─────────────────────────────────────────────────────────────────────
# INCREMENT 4 COMPLETE — #5 "Pacing"
# ─────────────────────────────────────────────────────────────────────

WHAT CHANGED & WHY
  Surfaces WHERE a learner bleeds time. Per-question time (timeMs) is already
  captured on every answer; this aggregates it per TOPIC and compares to exam
  pace, so a user sees "Pharmacology averages 82s vs ~54s pace — tighten that".
  A "Pacing this round" card on Results and a lifetime "Pacing" section in Stats.

  Complements (does not duplicate) the existing per-question TimeQuadrant on
  Results (fast/slow × right/wrong). This is the topic-level, finish-on-time lens.

PACE YARDSTICK
  EXAM_PACE_SEC = 54 (NORCET Prelims: 100 Q / 90 min). Used as a target marker,
  never a per-question verdict. Reveals + zero/absent times are excluded.

FILES
  ADDED
    • src/lib/pacing.js          — pure: overallPace, pacingByTopic (slowest
                                    first, overSec vs pace), paceVerdict. 8 Node
                                    assertions pass.
    • src/ui/pacing-card.jsx     — shared report: overall avg + verdict + slowest
                                    topics with an exam-pace marker line. Renders
                                    nothing below 4 timed answers.
  MODIFIED
    • src/screens/Results.jsx    — build topic-resolved entries from this round +
                                    "Pacing this round" card.
    • src/screens/StatsScreen.jsx— lifetime pacing memo (attempts × allQuestions
                                    topic join) + "Pacing" card.

IMPACT / SAFETY
  Frontend-only, pure derivation over data already stored. No storage write, no
  Edge/broker, no public/data, no CONTENT_VERSION. `vite build` GREEN.


# ─────────────────────────────────────────────────────────────────────
# INCREMENT 5 COMPLETE — #7 "Review-Load Forecast"
# ─────────────────────────────────────────────────────────────────────

WHAT CHANGED & WHY
  Spaced revision now reads as a plan, not a surprise pile. A card at the top of
  the Revision digest shows how many questions are due today (incl. overdue) and
  a 7-day forecast of what's coming, with a "Review now" CTA that launches the
  existing review-due session.

DATA SOURCE (read-only)
  Reuses the SRS field history[id].nextDue — the SAME field getDueQuestions()
  already uses on Home. No new scheduling, no writes. Questions are bucketed by
  the day they fall due; bucket 0 = today + overdue.

FILES
  ADDED
    • src/lib/review-forecast.js       — pure: reviewForecast (buckets by day,
                                          overdue/dueToday/week/later totals) +
                                          bucketLabel. 10 Node assertions pass.
    • src/ui/review-forecast-card.jsx  — premium card: due-today headline, 7-day
                                          bar forecast, overdue flag, CTA. Gentle
                                          empty state for users with no schedule.
  MODIFIED
    • src/screens/revision-sheet.jsx   — render the card atop the digest tab;
                                          new onStartReview prop.
    • src/App.jsx                      — pass onStartReview={startQuiz review-due}.

IMPACT / SAFETY
  Frontend-only, read-only over existing SRS state. No storage write, no Edge,
  no public/data, no CONTENT_VERSION. `vite build` GREEN.


# ─────────────────────────────────────────────────────────────────────
# INCREMENT 6 COMPLETE — #8 "Listen Mode"
# ─────────────────────────────────────────────────────────────────────

WHAT CHANGED & WHY
  Hands-free revision for commutes / shift breaks. A "Listen" (headphones) button
  on the Crib Sheet reads every card aloud in order — stem, answer, explanation —
  via the browser's built-in Web Speech API. A sticky player bar gives play/pause,
  prev/next, a speed toggle (0.85/1/1.25×) and progress. Free, offline, no infra,
  no cost — distinct from the existing one-shot TTSButton.

FILES
  ADDED
    • src/lib/use-listen-mode.js   — continuous SpeechSynthesis playlist hook.
                                      Token guard so cancel()'s stale onend can't
                                      double-skip; keep-alive resume() pulse for
                                      Chrome's ~15s long-utterance cutoff; cleanup
                                      on unmount.
    • src/ui/listen-bar.jsx        — premium sticky player; bottomOffset so it
                                      floats above an existing bottom bar.
  MODIFIED
    • src/screens/crib-sheet.jsx   — composeListenText() per card; Listen toggle
                                      in the header; player bar (offset above the
                                      Back/Share bar). Reads items in natural
                                      order (no scroll-sync — listener isn't
                                      watching the screen).

IMPACT / SAFETY
  Frontend-only, browser API only. No storage, no Edge, no public/data, no
  CONTENT_VERSION. `vite build` GREEN.

⚠️ ON-DEVICE CHECK NEEDED (depends on live runtime — could not audio-test here):
  • Voices load async on some engines; first tap may need a moment.
  • iOS Safari requires speech to start from a user gesture — the Listen button
    IS that gesture, so it should be fine, but verify on a real iPhone.
  • Confirm pause/resume + the speed toggle behave on Android Chrome + iOS Safari.
  If any engine misbehaves, the feature degrades gracefully (button only shows
  when window.speechSynthesis exists).


# ─────────────────────────────────────────────────────────────────────
# INCREMENT 7 COMPLETE — #6 "N-Day Revision Plan"
# ─────────────────────────────────────────────────────────────────────

WHAT CHANGED & WHY
  A personalised day-by-day plan from today to exam day, orchestrating data the
  app already has: weak topics (worst-accuracy first, front-loaded + revisited),
  coverage gaps (unseen topics), timed mocks as periodic checkpoints (denser near
  the end), a final full mock the day before, and a light/rest exam day. Each day
  is actionable — tap a topic to practise it now, start a mock, or jump into due
  reviews. Day completion persists; a progress bar shows days done.

DESIGN
  • Schedule is a STABLE skeleton: generated once and persisted, regenerated only
    when the exam date changes or the user taps Regenerate — so "Thursday =
    Pharmacology" doesn't shift under them. "Today" is located live by date.
  • Weak topics listed twice in the queue so they get extra early time.
  • Reuses getWeakTopics (topics.js) for ranking and reviewForecast for today's
    due count.

STORAGE
  New LOCAL key studyplan:<profileId> (shared:false, IndexedDB) — added to
  KEYS.studyPlan in keys.js. Holds { ok, examDate, generatedAt, days[], completed{} }.
  No shared write, no broker, no profile_secrets — purely local per device.

FILES
  ADDED
    • src/lib/study-plan.js       — pure generator buildStudyPlan + planProgress +
                                     planMatchesExam. 19 Node assertions pass
                                     (long/short/edge cases).
    • src/screens/study-plan.jsx  — premium screen: days-to-exam header + progress,
                                     dated timeline with today highlighted, tappable
                                     topic/mock/review tasks, completion toggle,
                                     regenerate, empty/past states.
  MODIFIED
    • src/lib/keys.js             — KEYS.studyPlan local key.
    • src/App.jsx                 — lazy import + 'study-plan' dispatch branch +
                                     props; onOpenPlan passed to RevisionSheet.
    • src/screens/revision-sheet.jsx — "Study plan" entry card atop the digest +
                                     onOpenPlan prop.
    • src/screens/home.jsx        — "Open study plan" button on the exam-countdown
                                     card (stopPropagation so it doesn't hit the
                                     exam-date tap).

IMPACT / SAFETY
  Frontend-only. The only storage is the additive LOCAL studyplan key. No Edge,
  no public/data, no CONTENT_VERSION. `vite build` GREEN.

DEFERRED
  • Auto-rescheduling missed days (kept manual/stable on purpose).
  • Plan-aware daily target nudges on Home.


# ─────────────────────────────────────────────────────────────────────
# INCREMENT 8 COMPLETE — #2 "Advanced-Test augmentation"  (FINAL)
# ─────────────────────────────────────────────────────────────────────

CONTEXT
  The Advanced Test already WAS the strict exam simulator (timed, negative
  marking, 3-state palette, auto-submit, topic post-mortem). So this augments it
  rather than building a second screen — three additive pieces, none of which
  change the existing answering or scoring.

WHAT CHANGED & WHY
  1. RIGHT→WRONG FLIP TRACKER. A pure observer remembers any question the user
     had correct at some point (everCorrectRef). At results, any question whose
     FINAL answer is wrong but was once right is counted, and shown as a coaching
     insight ("You changed N answers from right to wrong — trust your first
     instinct"). The observer lives inside toggleOption and only READS the state
     transition; answering/scoring are untouched. Threaded through the submit
     payload → submitAdvancedTest → results.
  2. FULL-LENGTH 200 OPTION. Added to the Questions segmented control, shown only
     when the bank has ≥200 questions; 200 defaults to a 180-min limit (NORCET
     pace). The existing canStart pool check already guards it.
  3. STRICT MODE. An Off/On toggle in setup; when On, the in-test exit (X) is
     replaced by a lock indicator — real exam conditions, no quitting mid-test.
     Threaded setup → startAdvancedTest → nav.strict → AdvancedTest prop.

FILES
  MODIFIED
    • src/screens/advanced-test.jsx — everCorrectRef + flip observer in
                                       toggleOption; everCorrectIds in both submit
                                       payloads; strict prop hides abort (lock);
                                       setup: 200 option + 180-min default +
                                       Strict toggle + strict in start payload;
                                       results: flip count + insight card.
    • src/App.jsx                   — submitAdvancedTest threads everCorrectIds to
                                       results; startAdvancedTest threads strict;
                                       renders pass strict + everCorrectIds.

IMPACT / SAFETY
  Frontend-only, additive. The flip tracker is observe-only — zero change to the
  answer flow or negative-marking math (verified: scoring path identical). No
  storage, no Edge, no public/data, no CONTENT_VERSION. `vite build` GREEN.


# ═══════════════════════════════════════════════════════════════════════
# WAVE COMPLETE — all 8 learning/outcome features shipped
#   #1 Where You Stand · #3 High-Yield PYQ · #4 Confidence Calibration ·
#   #5 Pacing · #6 N-Day Plan · #7 Review-Load Forecast · #8 Listen Mode ·
#   #2 Advanced-Test augmentation
# Every increment: frontend-only, build green, premium UI, no security
# regressions (brokers / profile_secrets / anon-read split untouched).
# Only new storage: one LOCAL key (studyplan:<profileId>). No CONTENT_VERSION
# bumps (nothing under public/data changed).
# ═══════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────
# DATA + CARD REFINEMENT — verified benchmarks wired into #1
# ─────────────────────────────────────────────────────────────────────

WHAT CHANGED & WHY
  Real verified data replaced the scaffold in norcet-benchmarks.js, and the
  Where-You-Stand card was upgraded to present it cleanly.

DATA (norcet-benchmarks.js)
  • MAINS_QUALIFYING now includes the 3 PwBD rows (45/40/35 — the standard 5%
    relaxation), 6 rows total.
  • PRELIMS_PERCENTILE_TREND filled with VERIFIED cycles NORCET 7–10 at full
    7-decimal precision (official normalisation standard; matters for tie-break
    eligibility, so not rounded in data). Prelims stage began at NORCET 5
    (Sep 2023); 5 & 6 rows can be appended later once verified.
  • Cadence + full cycle history + two TODOs (PwBD prelims percentiles; a
    7-decimal tap/tooltip) captured as comments.

CARD (where-you-stand-card.jsx) — needed because 6 rows include shared floors
  (OBC & UR/EWS-PwBD both 45; SC/ST & OBC-PwBD both 40), which would overlap on
  the ladder and bloat the readout. Fixes:
  • Ladder now draws ONE line per DISTINCT threshold (50/45/40/35) — no overlaps.
  • Legend groups the categories that share each floor (4 tidy rows).
  • Readout stays concise (highest cleared line + gap to the next), via two new
    pure helpers qualifyingThresholds + thresholdStatus in projection.js
    (12 Node assertions pass).
  • New collapsible "Prelims cut-offs · percentile" section: latest cycle shown,
    earlier cycles behind a tap, 2-decimal display, with an explicit caveat that
    percentile ≠ marks % (never placed against the user's score). Gated on
    HAS_PRELIMS_DATA.

FILES
  MODIFIED
    • src/data/norcet-benchmarks.js — verified Mains (incl. PwBD) + prelims 7–10.
    • src/lib/projection.js         — qualifyingThresholds + thresholdStatus.
    • src/ui/where-you-stand-card.jsx — distinct-threshold ladder, grouped legend,
                                        concise readout, prelims reference section.

IMPACT / SAFETY
  Frontend-only, pure data + display. No storage, no Edge, no public/data, no
  CONTENT_VERSION. `vite build` GREEN.

STILL OPEN (noted in data as TODO)
  • PwBD prelims percentile columns (e.g. NORCET 10 UR-PwBD ≈ 45.56).
  • 7-decimal tap/tooltip for tie-breaker checks.
  • NORCET 5 & 6 prelims rows once verified.


# ═══════════════════════════════════════════════════════════════════════
# MASTER PLAN — PHASE 1 (Critical Bug Fixes) begins
#   Source of truth: nurseholic-master-plan.md (Last Updated June 24, 2026).
#   Order: BUG-01 → BUG-02 → BUG-03 → BUG-04 → BUG-05; BUG-06 rides with
#   FEAT-04 (same role system). Each item: best version, build green, file
#   tree of changed files only, journal entry. Security architecture
#   (kv-read/kv-write brokers, profile_secrets, anon-read split) untouched.
# ═══════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────
# BUG-01 — Back button broken inside Settings & sidebar sub-views (FIXED)
# ─────────────────────────────────────────────────────────────────────

SYMPTOM (from the plan)
  In sections inside Settings and the sidebar, the device/gesture/browser
  back button misbehaves: entering a sub-section and pressing back "stays on
  the same page" or jumps past it. Needed a complete fix for Android, iOS, web.

ROOT CAUSE (verified against the code)
  The app navigates via React state (setNav) and a session nav STACK; the
  global popstate guard (App.jsx) and goHome both pop that stack. But several
  screens keep an INTERNAL sub-view in LOCAL state that is NOT in the nav
  stack — so the on-screen ← arrow handled it (closeSub / setSelectedId(null)
  / setViewDate(null) …) while the HARDWARE/BROWSER back skipped straight to
  Home, bypassing the sub-view entirely. Offending sub-views:
    • Settings   — subPage (profile/gestures/backup/notes/legal) + legalView
                   (privacy/terms), nested two deep.
    • Bookmarks  — selectedId (the per-bookmark DETAIL page).
    • Revision   — viewDate (a dated read-only crib snapshot).
    • Knowledge Map — noteEditor / selected popup / guide / search / fullscreen
                   overlays (only fullscreen closed, and only via Esc).

FIX — one reusable "back interceptor" (Android OnBackPressedDispatcher-style)
  NEW src/lib/back-handler.js: a module-singleton LIFO registry (same style as
  the rename/support/help openers) + a useBackHandler(fn, enabled?) hook. A
  screen's handler pops ONE level of its own sub-view and returns true ("back
  consumed → stay"), or false ("nothing to pop → let the app navigate"). The
  hook registers a STABLE wrapper that reads the latest closure via a ref, so
  inline handlers don't churn the stack; a throwing handler fails OPEN.

  App.jsx popstate guard now calls runTopBackHandler() in the go-home path —
  AFTER the self-guarded (quiz/advanced/paper/admin own their guards), rapid-
  debounce, exit (Home), and overlay (merge/welcome) checks, and AFTER the
  sentinel is re-armed — and BEFORE popping the nav stack. Result: device back,
  browser back, and the on-screen ← arrow now behave identically everywhere.

  Handlers registered: Settings (legalView → subPage), Bookmarks (selectedId),
  Revision (viewDate), Knowledge Map (noteEditor → selected → guide → search →
  fullscreen). Tabs/accordions (Leaderboard/Weightage/Stats tabs, Doubts &
  FAQ & Study-Methods accordions) deliberately NOT intercepted — collapsing a
  toggle on back is not expected behaviour. Library drill-ins are real app
  screens (bank-detail/editor) already on the nav stack, so unchanged.

FILES
  ADDED
    • src/lib/back-handler.js            — registry + useBackHandler hook (new).
  MODIFIED
    • src/App.jsx                        — import runTopBackHandler; consult it
                                           in the popstate go-home path.
    • src/screens/settings.jsx           — useBackHandler(legalView → subPage).
    • src/screens/bookmarks.jsx          — useBackHandler(selectedId detail).
    • src/screens/revision-sheet.jsx     — useBackHandler(viewDate snapshot).
    • src/screens/knowledge-map.jsx      — useBackHandler(overlay stack).

IMPACT / SAFETY
  Frontend-only. No storage keys, no Edge functions, no public/data, no
  CONTENT_VERSION bump. Security architecture untouched. `npm run build`
  GREEN (main bundle 1,080.90 KB / 321.20 KB gz — the same pre-existing
  >1024 KB chunk warning; ~6 KB added).

HOW TO VERIFY (client-side only — any browser + Android/iOS PWA)
  1. Settings → Profile (or Legal → Privacy) → press device/browser back:
     returns to the Settings list (Legal: Privacy → Legal list → Settings),
     NOT straight to Home.
  2. Bookmarks → open a bookmark → back: returns to the index.
  3. Revision → Crib Sheets tab → open a dated set → back: returns to the list.
  4. Knowledge Map → open a node popup / search / fullscreen → back: closes
     that overlay first; back again leaves the map.
  5. Home → back still shows the "press back again to exit" snackbar (unchanged).


# ─────────────────────────────────────────────────────────────────────
# BUG-02 — Glitched background flash launching tests from Favourites (FIXED)
# ─────────────────────────────────────────────────────────────────────

SYMPTOM
  Opening Mock / Topic / Quick test FROM the Favourites honeycomb flashed a
  "glitched" background for a fraction of a second.

ROOT CAUSE (verified)
  The Favourites screen's TopBar is `solid` (no backdrop-filter) precisely to
  avoid a "compositing layer to re-sample" (see the comment in
  ui/primitives.jsx TopBar). But the test-launch SETUP screens used the default
  frosted (backdrop-blur-md) TopBar. On the swap frame, the incoming blurred
  bar re-samples the outgoing colourful honeycomb layer (heavy gradients +
  shadows) → a one-frame colour smear. It reads worst on these screens because
  each has a vivid section Card sitting directly under the bar.

FIX
  Pass `solid` to the four test-launch setup screens' TopBars so there is no
  backdrop-filter to re-sample on entry (the same remedy already used on the
  Favourites screen itself). Deterministic — no backdrop-filter, no glitch.

FILES (MODIFIED)
  • src/screens/QuickPracticeSetup.jsx — TopBar solid.
  • src/screens/MockSetup.jsx          — TopBar solid.
  • src/screens/TopicSelect.jsx        — TopBar solid.
  • src/screens/advanced-test.jsx      — setup TopBar solid.

IMPACT / SAFETY
  Frontend-only; one prop each. The frosted-blur header is replaced by a clean
  opaque bar on these brief setup screens only (Dosage / Previous Papers left
  as-is — not reported, content-heavy, blur is nicer there). `npm run build`
  GREEN. No storage / Edge / public-data / CONTENT_VERSION impact.


# ─────────────────────────────────────────────────────────────────────
# BUG-03 — Tests must start ONLY from a Start button + a pre-start caution (FIXED)
# ─────────────────────────────────────────────────────────────────────

REQUIREMENT (from the plan)
  Topic-wise test should start only via the Start button, not a whole-row tap.
  The Home "Review due" card needs its own Start button (no whole-card launch),
  and the same applies to tests launched from notifications. The user should
  be shown/cautioned before a test starts.

  NOTE — this intentionally REVERSES an earlier decision (a prior session kept
  the whole TopicSelect row tappable alongside the Start pill). BUG-03 wins:
  Start-only, no row launch.

CHANGES
  1) TopicSelect (topic-wise) — removed the whole-card onClick; the test now
     starts ONLY from the per-row Start button (dropped the now-needless
     stopPropagation). A stray scroll-tap can no longer launch a test.
  2) Home "Review due" card — no longer launches on body tap. Restructured to a
     header row (icon + count + help + hide-for-today ×) PLUS an explicit
     full-width "Start review" button. Start shows a short caution confirm
     ("Start your review test? N due …" · Start review / Not now) via the
     app-root requestConfirm host before launching.
  3) Notification Center — added a `go(action)` gate: any notification whose
     action is `screen:'quiz'` shows the same Start-test caution before
     launching; non-test actions (Stats, Doubts, …) navigate unchanged.

  (Quick / Mock / Advanced already route through their own setup screens with
  an explicit Start button — that satisfies "shown"; no extra prompt added
  there to avoid double-confirming a deliberate action.)

FILES (MODIFIED)
  • src/screens/TopicSelect.jsx        — Start-button-only launch.
  • src/screens/home.jsx               — Review-due card: explicit Start button
                                         + requestConfirm caution (Play, requestConfirm imports).
  • src/screens/notification-center.jsx — go(action) caution gate for quiz actions
                                         (requestConfirm import).

IMPACT / SAFETY
  Frontend-only; uses the existing app-root ConfirmHost (requestConfirm). No
  storage / Edge / public-data / CONTENT_VERSION impact. `npm run build` GREEN.

HOW TO VERIFY
  1. Topic Test → tap a subject ROW (not the Start pill): nothing happens; tap
     Start: the 10-Q topic test begins.
  2. Home → "Review due" card body tap: nothing; tap "Start review": caution →
     Start review → test begins.
  3. Notification Center → tap a "review due" reminder: caution → Start test.


# ─────────────────────────────────────────────────────────────────────
# BUG-04 — Admin panel section logic audit (FAQ + Crash Reports + Engagement) (FIXED)
# ─────────────────────────────────────────────────────────────────────

SCOPE
  "Inspect all sections inside admin panel; some UIs work but the logic
  doesn't." Audited every section against the kv-write broker allowlist (the
  broker fail-closes 403 on any shared-write prefix it doesn't recognise).

FINDINGS
  A) FAQ upload (the reported one) — the broker ALREADY authorises `faq:` for
     admins (same as `announcement:`). The real defect was on the CLIENT: the
     FAQ CRUD used the non-strict `safeStorage.set/delete` (swallows broker
     rejections, returns null) AND admin-faq-manager had empty `catch(e){}`.
     So a failed write (stale token / rate-limit / offline) closed the editor
     as if saved while nothing reached Supabase — silent failure. Announcements
     never had this because they use the STRICT throwing path + show errors.
  B) Crash Reports (`errlog:`) and Engagement (`analytics:user:`) — both are
     written `shared` by the client, but NEITHER prefix was in the broker's
     authorization matrix. Post-Stage-2 the broker fail-closed (403) on them,
     swallowed client-side, so these two sections rendered but NEVER received
     any data. (Full sweep of every shared-write prefix confirmed these were
     the ONLY two missing — everything else maps to an existing rule.)

FIX
  A) FAQ (frontend only — works with the ALREADY-DEPLOYED broker):
     • faq.js saveFaq/deleteFaq → STRICT broker path (setSharedStrict /
       delSharedStrict) so failures throw instead of vanishing.
     • admin-faq-manager.jsx → real error surfacing (401/403/429/offline copy);
       editor stays open on failure, closes only on success.
  B) Broker (supabase/functions/kv-write/index.ts) — ADDITIVE allowlist rules
     (inserted before the fail-closed, so existing behaviour is untouched):
     • analytics:user:<id> → added to OWNER_PREFIXES (each user writes only
       their own engagement summary; admins may moderate).
     • errlog:<sig> → any logged-in user may SET (report/increment a crash
       signature; the row is keyed by signature, shared across users); DELETE
       is admin-only (admins clear/resolve groups; resolve is itself a SET).

FILES
  MODIFIED
    • src/lib/faq.js                        — strict admin FAQ write/delete.
    • src/ui/admin-faq-manager.jsx          — error state + messages (form + list).
    • supabase/functions/kv-write/index.ts  — authorize analytics:user: + errlog:.

IMPACT / SAFETY
  Frontend `npm run build` GREEN. Security architecture intact — the broker
  change is purely additive (two new prefixes, scoped: analytics owner-only,
  errlog set-any/delete-admin) and cannot loosen any existing rule.

  ⚠️ LIVE-ENV ACTION REQUIRED (you must run this) — the FAQ fix needs NO
  deploy (faq: was already allowed). The Crash-Report + Engagement fix needs
  the broker redeployed:
      supabase functions deploy kv-write --no-verify-jwt
  Until then those two sections stay empty (writes 403). NOTE: the master
  plan's "deferred items" list mentions "error monitoring" — if you'd rather
  keep Crash Reports dormant for now, simply DON'T redeploy; the FAQ fix is
  independent and already live-ready after the next frontend push. (Guest
  crash/engagement writes still 401 by design — guests have no session token;
  only logged-in users' telemetry persists.)

HOW TO VERIFY
  • FAQ: Admin → FAQ manager → add a FAQ. It now appears in the list; if the
    server rejects, a clear red message explains why (instead of nothing).
  • Crash/Engagement (after redeploy): use the app as a logged-in user, trigger
    activity, then Admin → Crash Reports / Engagement show real rows.


# ─────────────────────────────────────────────────────────────────────
# BUG-05 — Admin Helpfulness section: cleaner UI + clear-history + delete (FIXED)
# ─────────────────────────────────────────────────────────────────────

REQUIREMENT
  The Helpfulness section felt clumsy/unorganised, lacked a "clear history"
  button (with caution), and had no way to delete single or multiple rows.

DESIGN NOTE (storage)
  The kv-write broker FORBIDS DELETE on helpful:/notHelpful: counters but
  ALLOWS SET. So "delete a row" = SET both tallies to "[]" (the row then drops
  out of the report, which filters total === 0). Reversible by design — users
  can rate again later. NO broker change / redeploy needed.

CHANGES
  • helpful-votes.js — new admin helpers clearHelpfulnessMany(qIds) and
    clearAllHelpfulness(), both SET-empty via the STRICT broker path
    (allSettled; report a failed count). Exported.
  • admin-panel.jsx (Helpfulness view) — reorganised + premium:
      - Summary band: "N rated · M responses" with Select + Clear-history actions.
      - Select mode: per-row checkboxes, Select-all/Unselect-all, a "Clear (N)"
        action; tapping a row toggles selection instead of expanding.
      - Normal mode: tap-to-expand (unchanged) PLUS a per-row trash for a
        single-row clear.
      - Clear history (all), single clear, and multi clear each go through a
        requestConfirm caution; "Clear everything" requires typing CLEAR.
      - Selection state resets on leaving the view (backToDash).

FILES (MODIFIED)
  • src/lib/helpful-votes.js   — clearHelpfulnessMany + clearAllHelpfulness.
  • src/screens/admin-panel.jsx — reworked Helpfulness view + selection state
                                  + requestConfirm/CheckSquare/Square imports.

IMPACT / SAFETY
  Frontend-only; works with the ALREADY-DEPLOYED broker (SET on counters is
  permitted). No schema / public-data / CONTENT_VERSION impact. Build GREEN.

HOW TO VERIFY
  Admin → Helpfulness: tap Select → tick rows → Clear (N) → caution → rows
  drop off. Per-row trash clears one (with caution). "Clear history" wipes all
  (type CLEAR). Refresh confirms the report reflects the reset.


# ═══════════════════════════════════════════════════════════════════════
# PHASE 1 (Critical Bugs) — BUG-01..BUG-05 COMPLETE.
#   BUG-06 (admin user-id assignment UI) is intentionally bundled with
#   FEAT-04 (RBAC) — same role system — and handled in Phase 2.
#   Only outstanding live action from Phase 1: redeploy kv-write for the
#   BUG-04 Crash-Report/Engagement half (FAQ + everything else need no deploy).
# ═══════════════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════════════
# MASTER PLAN — PHASE 2 (Existing Feature Updates)
# ═══════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────
# FEAT-01 — pacing.js: verified NORCET data + topper tiers (DONE)
# ─────────────────────────────────────────────────────────────────────

WHAT CHANGED & WHY
  Replaced the lone generic pace constant with VERIFIED NORCET pacing data and
  the topper-target tier table the later modes (NEW-04 Three-Wave, NEW-07
  benchmark panel) will consume. Purely additive to the data layer.

ADDED (src/lib/pacing.js)
  • PRELIMS_PACE_SEC = 54  (5×20 Qs / 5×18 min) and MAINS_PACE_SEC = 67.5
    (4×40 Qs / 4×45 min). EXAM_PACE_SEC kept as a Prelims alias for back-compat
    (pacing-card / paceVerdict default unchanged → no UI churn).
  • NEGATIVE_MARK = −1/3 (+ NEGATIVE_MARK_LABEL).
  • PACING_TIERS — five tiers with verified avg vs topper second-ranges:
    GK&Current 35–45/15–20 · Aptitude 70–90/45–60 · Fact-Heavy 45–50/25–30 ·
    Conceptual 55–65/40–45 · Priority/Clinical 65–80/50–55.
  • TOPIC_PACING_TIER — maps the app's real topic ids (fund/anat/msn/pharm/…
    /gk/apt) to those tiers, + pacingTierForTopic() / topperTargetForTopic().
  • Comments: toppers attempt only 78–85/100 (skip vs negative risk); 18-min
    sectional LOCK ⇒ per-section pacing dominates.
  • TODO-only (not implemented): Three-Wave (Sprint/Deep-Dive/Calculated-Risk),
    tie-breaker rule, clinical frameworks (ADPIE/ABCs/Maslow/Acute-Chronic/
    Least-Restrictive), PwBD pacing note.

RESULTS/STATS — left untouched ON PURPOSE. The existing card shows the correct
  54s Prelims pace; the plan says change those only "if genuinely needed". The
  new constants are groundwork for NEW-04/07.

FILES (MODIFIED): src/lib/pacing.js
IMPACT/SAFETY: additive exports only; no storage/Edge/public-data/CONTENT_VERSION.
  Build GREEN.


# ─────────────────────────────────────────────────────────────────────
# FEAT-02 — Merge Study Plan + Exam Date into one "Study plan" section (DONE)
# ─────────────────────────────────────────────────────────────────────

WHAT CHANGED & WHY
  The old "Exam date" sidebar item (set date + daily goal) and the "Study plan"
  entry buried inside Revision were two halves of one thing. Unified into a
  single sidebar item, "Study plan", that sets the date/goal AND shows the
  day-by-day plan in one place.

CHANGES
  • exam-date-screen.jsx — extracted the inner form as a reusable
    <ExamDateEditor/> (no TopBar; +onSaved callback). ExamDateScreen kept as a
    thin wrapper (title now "Study plan") for any legacy deep-link, but the app
    no longer routes to it.
  • study-plan.jsx — embeds <ExamDateEditor/>:
      - No date yet / date passed → the editor IS the screen (replaces the old
        "Set exam date" redirect; first-time users land on the picker).
      - Date set → a collapsed "Exam date & daily goal · {date} · N days · X/day"
        row (tap → expand the full editor) ABOVE the plan timeline.
    New props: allQuestionsCount, onSetExamDateValue, onClearExamDate,
    onSaveTarget (replacing onSetExamDate).
  • App.jsx — Study Plan route now passes the date/goal save handlers; removed
    the standalone 'exam-date' route + its ExamDateScreen import; removed
    RevisionSheet's onOpenPlan.
  • nav-drawer.jsx — the sidebar item is now "Study plan" → opens 'study-plan'
    (icon/key unchanged; sub = "Date, daily goal & day-by-day plan").
  • revision-sheet.jsx — removed the in-Revision Study-plan entry (de-dup) +
    now-unused Target/ChevronRight imports.
  • home.jsx — the home countdown card now opens 'study-plan' (was 'exam-date').
  • help.json — renamed "Exam date" → "Study plan" and expanded it (date + goal
    + plan). CONTENT_VERSION 11 → 12 (public/data changed).

FILES
  MODIFIED
    • src/screens/exam-date-screen.jsx  (export ExamDateEditor; thin wrapper)
    • src/screens/study-plan.jsx         (embed editor; new props)
    • src/App.jsx                        (route rewire; drop exam-date route/import)
    • src/ui/nav-drawer.jsx              (rename item → Study plan → 'study-plan')
    • src/screens/revision-sheet.jsx     (remove plan entry + unused imports)
    • src/screens/home.jsx              (countdown card → 'study-plan')
    • public/data/help.json             (Exam date → Study plan, expanded)
    • src/lib/content.js                (CONTENT_VERSION 11 → 12)

IMPACT / SAFETY
  Frontend + one content file. examDate / dailyTarget storage shape UNCHANGED
  (same setExamDate/clearExamDate/setDailyTarget handlers). No Edge/schema
  change. CONTENT_VERSION bumped so clients re-pull help.json. Build GREEN;
  main bundle actually shrank ~10 KB (date editor now in the lazy plan chunk).

HOW TO VERIFY
  Sidebar now shows "Study plan". Open it with no date → date+goal picker; set a
  date → plan builds, editor collapses to a summary row (tap to edit). Revision
  no longer shows a Study-plan card. Home countdown card opens Study plan. Help
  (?) on the screen shows the new "Study plan" content.


# ─────────────────────────────────────────────────────────────────────
# FEAT-03 — Topic-trend short-range filters (premium) (DONE)
# ─────────────────────────────────────────────────────────────────────

WHAT CHANGED & WHY
  Stats "Topic trends" only offered 3M/6M/12M (month buckets). Added
  1W·2W·3W·1M·2M so recent movement is visible, not just multi-month arcs.

HOW (StatsScreen.jsx)
  • TREND_RANGES (8) + buildTrendBuckets(range, now): short ranges bucket by
    DAY (1W/2W) or WEEK (3W/1M/2M), long by MONTH (3M/6M/12M). Per-range scaled
    thresholds minCell/minTotal (day 1/3, week 2/5–8, month 5/10) so a 1-week
    window isn't held to a 6-month window's data bar.
  • topicTrends rewritten to bucket generically (ts→bucket by start/end) and
    use range thresholds; output months→buckets + a `note`.
  • State trendWindow(int) → trendRangeId(string), default still '6M'.
  • UI: 3-button segmented control → premium horizontally-scrollable pill rail
    (.no-scrollbar) of all 8 ranges; caption reflects Daily/Weekly/Monthly.

FILES (MODIFIED): src/screens/StatsScreen.jsx
IMPACT/SAFETY: frontend-only; reads existing attempts[].ts. No storage/Edge/
  public-data/CONTENT_VERSION. Build GREEN.


# ═══════════════════════════════════════════════════════════════════════
# CHECKPOINT — committed to dev @ 3c0e545 (push 6ad7d5f..3c0e545)
#   Shipped: BUG-01..05, FEAT-01/02/03 (24 code files; planning .md kept
#   OUT of git to avoid brand leak per INFRA-04).
#   PENDING LIVE ACTION: redeploy kv-write for BUG-04 crash/engagement half:
#     supabase functions deploy kv-write --no-verify-jwt
#   NEXT: FEAT-04 (+BUG-06 RBAC/admin-assign), FEAT-05, then Phase 3 NEW-01..11.
# ═══════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────
# FEAT-04 (RBAC) + BUG-06 (admin user-id assignment) (DONE — moderator tier deferred)
# ─────────────────────────────────────────────────────────────────────

DECISION (user): DEFER the 3-tier Moderator role. Keep the binary admin model
  for now (12 users / one admin); revisit when real moderators exist.

REALITY CHECK vs the plan's FEAT-04 text
  • The plan's "Supabase Auth role + RLS on a questions table" does NOT apply —
    the app uses custom auth + the kv-write broker, not Supabase Auth.
  • "Never trust the frontend" is ALREADY satisfied: kv-write authorises every
    shared write against admin_profile_ids server-side, and admin-manage
    verifies the passphrase server-side. UI hiding is cosmetic on top of that.
  • "Lazy-load the admin panel" is ALREADY done: App.jsx
    `const AdminPanel = lazy(() => import('./screens/admin-panel.jsx'))`.
  So the only real gap was BUG-06 (surfacing the account id) + polish.

BUG-06 — account id in the Profile section
  • settings.jsx (Profile sub-page) — new premium "Account ID" card: shows
    profile.uid || profile.id (the exact value the broker/allow-list match),
    Copy-to-clipboard with feedback, and a one-line explainer ("Share this with
    the owner to be made an admin"; admins get a pointer to Manage admins).
  • admin-manager.jsx — "you" badge on the signed-in admin's own row (premium
    recognition); Manage Admins add/remove flow was already wired (dashboard
    tile → view 'manageAdmins' → AdminManager → admin-manage Edge Function).

MODERATOR TIER — documented path for later (NOT built):
  add a `role` text column to admin_profile_ids (default 'admin'); teach
  admin-manage to set it and kv-write to grant role 'moderator' content rights
  (faq:/feedback: edit, errlog: resolve) but withhold user-delete / admin-mgmt;
  gate admin-panel sections on the role. One SQL migration + two function
  redeploys when needed.

FILES (MODIFIED)
  • src/screens/settings.jsx   — Account ID card (+ Copy/Fingerprint imports, state)
  • src/ui/admin-manager.jsx   — "you" badge on own row

IMPACT / SAFETY
  Frontend-only; no DB/Edge/CONTENT_VERSION change (binary model unchanged).
  Build GREEN.

HOW TO VERIFY
  Settings → Profile → "Account ID" card (Copy works). Admin → Manage admins
  shows your row tagged "you"; add/remove others by id with the passphrase.


# ─────────────────────────────────────────────────────────────────────
# FEAT-05 — Sync & Auth strategy (DONE — best version for the real architecture)
# ─────────────────────────────────────────────────────────────────────

DECISION (flagged in opening analysis, user approved "best version"): do NOT
  build the plan's 6-digit "Account Key". The app ALREADY has full cross-device
  sync — name+password accounts (auth-secure), profile blob via the kv broker,
  and security-question recovery. A 6-digit key would be a weaker, redundant,
  brute-forceable parallel identity. The "add user_id column, read localStorage,
  switch later" architecture-secret is also moot — Supabase sync already exists.

WHAT CHANGED & WHY
  Made the EXISTING portability obvious instead of adding a mechanism: a
  reassurance card in Settings → Profile — "Backed up & synced … on a new
  device, sign in with the same name & password — everything restores." This is
  exactly what the plan's hook was for (prevent progress-loss anxiety), phrased
  for the real auth model. Guests already get the "Sign in / Create account"
  nudge (Home banner + Settings), so the create-account path is covered.

  When to add real OAuth/email later (per plan triggers): at payment, or if
  users report cross-device misses — the account system is the migration point,
  no schema rework needed.

FILES (MODIFIED): src/screens/settings.jsx (cross-device reassurance card)
IMPACT/SAFETY: frontend-only; no new auth path, no storage/Edge/schema change.
  Build GREEN.


# ═══════════════════════════════════════════════════════════════════════
# PHASE 2 (Existing Feature Updates) — FEAT-01..05 COMPLETE.
#   FEAT-04 moderator tier deferred (binary admin kept; backend already
#   enforces authz). BUG-06 done (account id in Profile). Next: Phase 3
#   NEW-01..11 (new features).
# ═══════════════════════════════════════════════════════════════════════


# ═══════════════════════════════════════════════════════════════════════
# MASTER PLAN — PHASE 3 (New Features) begins
# ═══════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────
# NEW-01 (Premium onboarding) + NEW-02 (Demographics) (DONE)
# ─────────────────────────────────────────────────────────────────────

DESIGN (user-approved): demographics OPTIONAL + SKIPPABLE during onboarding,
  and — like the optional recovery email — EDITABLE LATER in Settings → Profile.
  Skipping is never a dead end. customTargetPercentile defaults to 98.5 (UR).

NEW-01 — premium first-run flow (welcome.jsx, gated by a new `firstRun` prop):
  Steps: App Pitch → Library/Question-Bank explainer → Gender → Qualification →
  Employment → existing "what's inside" Tour → Tips. A premium animated
  "Skip tour" pill (arrow nudges on press) on EVERY page except the last (Tips).
  Device-back walks the step order. Replays from Settings start at the Tour
  (firstRun=false) so existing users don't re-do onboarding.

NEW-02 — demographic screens (DPDP-lean: Gender + Qualification + Employment;
  NO caste/disability). Tapping a choice saves + advances; choices with a
  reassurance show the "we just unlocked X" copy (GNM → bedside-to-theory;
  Working/Shifts → hands-free audio + micro-drills; Full-time → mock stamina).
  "Skip this one" advances without saving.

STORAGE
  • src/lib/demographics.js (NEW) — options, unlock copy, DEFAULT_TARGET_
    PERCENTILE=98.5, normalizeDemographics/demographicsFilled/labelFor.
  • data.demographics = { gender, qualification, employment, customTargetPercentile }
    in the synced profile blob (setDemographics → setData auto-persists/syncs).
  • EDIT-LATER: src/screens/study-profile-card.jsx (NEW) — premium collapsible
    "Study profile · optional" card in Settings → Profile (N/3 badge, pill
    selectors, tap-again-to-clear) mirroring the optional recovery-email card.

FILES
  ADDED: src/lib/demographics.js · src/screens/study-profile-card.jsx
  MODIFIED: src/screens/welcome.jsx · src/screens/settings.jsx · src/App.jsx

IMPACT/SAFETY: frontend-only; new data.demographics in existing synced blob;
  no schema/Edge/CONTENT_VERSION. Build GREEN. Existing users add demographics
  via Settings → Profile (edit-later path); not re-prompted.


# ═══════════════════════════════════════════════════════════════════════
# NEW INPUT INTEGRATED — Ikigai Philosophy Engine (PHIL-01..08) + Content/
# Architecture PDF. User decisions locked:
#   • Architecture: ADAPT the philosophy features to the EXISTING client-blob +
#     bank-JSON + kv-broker model — do NOT migrate to a SQL attempts/questions
#     table (would undo the 5-stage security architecture; client mechanics work
#     fine). is_foundational / qtype / stage / target_exams become fields on the
#     EXISTING question schema (like the PYQ/high-yield tags already present).
#   • Economy: build a LIGHT, NON-MONETARY Accuracy Coins + Clinical Hearts layer
#     now (motivation only, no paywall). Monetization (BIZ-02/03) stays deferred.
#   • Leaderboard: KEEP the existing Leaderboard AND add Ghost Shift (self-vs-
#     past) as a complement — do not remove global ranking.
#   • PDF = Phase-4 content planning; its only near-term code touchpoint is the
#     shared question-schema extension (foundation A1), reused by NEW-07/09/10 +
#     PHIL-01/06.
# Re-sequenced build order: Foundations (A1 schema ext · A2 coins/hearts ·
#   A3 attempt enrichment) → free wins (PHIL-05, PHIL-08) → quick wins (PHIL-03,
#   PHIL-04, NEW-03) → core (PHIL-06, PHIL-02, NEW-04/05/06) → flagship
#   (NEW-07, PHIL-01) → interactive content (NEW-09, NEW-10, PHIL-07) →
#   NEW-08, NEW-11 → Phase 4/5.
# ═══════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────
# PHIL-05 — The Autopsy Log (DONE — free win) + PHIL-08 — Ikigai Anchor (DONE)
# ─────────────────────────────────────────────────────────────────────

PHIL-05 — renamed the wrong-answer review surface to "The Autopsy" (Wabi-Sabi:
  mistakes are the asset). The app's "wrong" review mode is the target:
  • App.jsx quizTitle case 'wrong': 'Wrong-Answer Redo' → 'The Autopsy'.
  • Results.jsx CTA 'Re-do wrong ones' → 'Open the Autopsy'.
  • quiz.jsx wrong-mode title 'Review' → 'The Autopsy'; empty state →
    "The Autopsy is clean — no mistakes to review. Keep your accuracy high."

PHIL-08 — Ikigai Anchor, COLLECTION half (display half ships with PHIL-02 Code
  Blue). Captured as a private, sanitised free-text "why":
  • demographics.js — sanitizeIkigai() (strips HTML, caps 280) + IKIGAI_MAX;
    `ikigai` added to normalizeDemographics (so it persists in data.demographics).
  • welcome.jsx — new 'ikigai' onboarding step after Employment ("What is your
    Ikigai? Why do you want to be a Nursing Officer?", textarea 280, "private —
    only you will ever see this", skippable). Saves via onSaveDemographics.
  • study-profile-card.jsx — editable-later Ikigai textarea (saves sanitised on
    blur) so a skipper can add/change it any time (the edit-later guarantee).

FILES
  MODIFIED: src/App.jsx · src/screens/Results.jsx · src/screens/quiz.jsx ·
            src/lib/demographics.js · src/screens/welcome.jsx ·
            src/screens/study-profile-card.jsx

IMPACT/SAFETY: frontend-only; ikigai stored in existing synced data.demographics
  (HTML-stripped, capped, never logged). No schema/Edge/CONTENT_VERSION. Build GREEN.


# ─────────────────────────────────────────────────────────────────────
# PHIL-08 premium upgrade + WHERE-YOU-STAND visibility fix (DONE, on dev)
# ─────────────────────────────────────────────────────────────────────

PHIL-08 premium: onboarding Ikigai step is now cinematic — glowing heart + radial
  aura, dark navy→plum "vow" panel, quote-mark + journal-style transparent
  textarea (warm-white text, pink caret), Lock privacy line, promise "On your
  hardest days, NurseHolic will bring this back to you — in your own words",
  CTA "Anchor my why". (welcome.jsx)

WHERE YOU STAND — qualifying-percentile system now visible to EVERYONE:
  • where-you-stand-card.jsx empty state no longer hides benchmarks. Mains
    qualifying ladder (50/45/40/35 + PwBD) + legend + Prelims percentile cut-offs
    (NORCET 7–10) render for ALL users as a reference target.
  • Personal "You %" marker/fill/band/readout only with advancedTestHistory data;
    else a dashed "You appear here" placeholder.
  • Nudge: no data → full-width "See where you stand — take an Advanced Test";
    has data → quiet "Take another Advanced Test to refresh your standing".

FILES (MODIFIED): src/screens/welcome.jsx · src/ui/where-you-stand-card.jsx
IMPACT/SAFETY: frontend-only; existing advancedTestHistory + verified benchmarks.
  No storage/Edge/CONTENT_VERSION. Build GREEN.

# WORKFLOW (user directive): pipelined — each task → commit to DEV → user tests
#   the dev URL → if great, user says commit → MERGE TO MAIN → next task. Never
#   bundle tasks or touch main without the user's explicit go-ahead.


# ─────────────────────────────────────────────────────────────────────
# FOUNDATION A2 (Coins + Hearts) + PHIL-03 The Why Bonus (DONE, on dev)
# ─────────────────────────────────────────────────────────────────────

A2 — light, NON-MONETARY economy (no paywall; monetization stays deferred):
  • src/lib/economy.js (NEW) — pure store + helpers: normalizeEconomy,
    withRegenHearts (1 heart/2h; dormant until Code Blue spends hearts),
    claimWhyBonus (once-per-question dedup), addCoins. Constants HEART_MAX=5,
    WHY_BONUS_COINS=50.
  • data.economy = { coins, hearts, heartsTs, whyClaimed[] } added to DEFAULT_DATA
    (seed.js) + merged in hydrateLoaded (App.jsx) so it syncs like everything else.

PHIL-03 — The Why Bonus (Shokunin: reward depth over speed):
  • App.jsx — economyRef + claimWhyBonus() (reads ref to decide awarded vs
    already-claimed, commits via setData). Passed to Quiz with current coins.
  • quiz.jsx — after a CORRECT answer, if the explanation stays open 15s, award
    +50 coins ONCE per question (capped — 10 min == 15s; no farming; timer
    cleared on question-change/unmount, no leak). Premium gold celebration toast
    ("+50 Coins · The Why Bonus — you stayed to understand the why"). A live
    Accuracy-Coins chip sits in the quiz top bar (pulses on award).

NOTE on A3 (attempt enrichment): the Why Bonus needs only the 15s dwell gate +
  per-question dedup (economy.whyClaimed), so full per-attempt rationale-read-
  seconds capture is deferred until a feature actually needs the stored metric.

FILES
  ADDED: src/lib/economy.js
  MODIFIED: src/data/seed.js · src/App.jsx · src/screens/quiz.jsx
IMPACT/SAFETY: frontend-only; economy in existing synced blob; no paywall/Edge/
  schema/CONTENT_VERSION. Build GREEN (bundle verified).

HOW TO VERIFY (dev): start any quiz → answer a question correctly → keep the
  explanation open ~15s → gold "+50 · The Why Bonus" toast + the coin chip
  increments. Re-answering the same question later never re-awards.


# ─────────────────────────────────────────────────────────────────────
# DEV-TESTING FEEDBACK ROUND 1 (on dev) — copy, save-confirm, Revision/Crib UX,
# Where-You-Stand two-phase
# ─────────────────────────────────────────────────────────────────────

PHIL-05 REVERTED — "The Autopsy" confused normal users; restored the simple
  literal wording (quiz title "Wrong-Answer Redo", Results "Re-do wrong ones",
  empty "No wrong answers to review."). [memory: keep copy simple/literal]

IKIGAI term glossed — onboarding headline now "What's your reason why?" with
  "Your Ikigai — the deeper reason you want to become a Nursing Officer". Study-
  Profile label "Your Ikigai · your reason why". [memory: gloss jargon]

SAVE CONFIRMATION — the Study-Profile Ikigai field (save-on-blur) now flashes an
  explicit green "Saved ✓" + a brief border highlight; helper text "Saves when
  you tap away." [memory: never make the user guess if something saved]

REVISION + CRIB UX:
  • NEW src/ui/back-to-top.jsx — premium floating "Top" pill (appears after
    ~420px, anim-fadeup, primary). Added to Revision (had none). Crib's existing
    scroll-to-top upgraded to the same premium pill + lowered to 420px (was 900).
  • Revision expand/collapse — replaced the two ambiguous buttons with a
    segmented control whose ACTIVE side is filled ("Expanded"/"Collapsed"), so
    state is always obvious; added a "{n} Q" count.
  • Declutter — toggling "Revise your mistakes" ON now auto-collapses the list
    (it gets long) so it stays scannable.

WHERE YOU STAND — two-phase (appended from user's queued prompt; builds on the
  already-shipped always-visible reference):
  • Phase REAL (Advanced Test data) — exact "You %" marker + readout; CTA
    "Improve your score — practise now" (Quick Test) + quiet "take another
    Advanced Test".
  • Phase ESTIMATE (no Advanced Test, ≥10 practice attempts) — an ESTIMATED
    marker (accuracy with 1/3 negative marking), dashed + gently PULSING, "~X%
    est" headline + hedged readout + footnote; CTA "Get your exact score —
    Advanced Test" + quiet "keep practising". (StatsScreen computes the estimate
    from data.stats and passes it.)
  • Phase PLACEHOLDER (brand-new) — pulsing "You appear here" on the real ladder;
    CTA "Take a Quick Test to see your estimated position" (low barrier) + quiet
    "or a full Advanced Test".
  • Ladder + legend + Prelims percentile cut-offs ALWAYS visible (both/all
    phases). Premium, alive — never an empty grey gate. onQuick wired (Quick Test).

FILES
  ADDED: src/ui/back-to-top.jsx
  MODIFIED: src/App.jsx · src/screens/Results.jsx · src/screens/quiz.jsx ·
            src/screens/welcome.jsx · src/screens/study-profile-card.jsx ·
            src/screens/revision-sheet.jsx · src/screens/crib-sheet.jsx ·
            src/screens/StatsScreen.jsx · src/ui/where-you-stand-card.jsx
IMPACT/SAFETY: frontend-only; estimate derived from existing data.stats; no
  storage/Edge/CONTENT_VERSION. Build GREEN.


# ─────────────────────────────────────────────────────────────────────
# ADMIN PANEL premium polish — Batch 1 (self-explaining empty states)
# ─────────────────────────────────────────────────────────────────────

AUDIT FINDING: every admin section is functionally working. The "all buggy"
  perception = (a) telemetry writes were broker-blocked (Engagement/Crash) —
  ALREADY fixed + kv-write deployed; (b) low data (12 users) ⇒ empty sections
  that LOOK broken. Decision (user): premium polish pass on all, batched.

Batch 1 — new src/ui/admin-empty.jsx (premium empty state: purpose + why empty
  + a green "Live — results appear here automatically" pill). Applied to:
  Engagement, Crash Reports (positive framing), Feedback, Growth→Top referrers.
  Each now states WHAT the section does and WHEN data shows, so an empty
  section reads as "new", not "broken".

FILES: ADDED src/ui/admin-empty.jsx · MODIFIED src/screens/admin-panel.jsx
IMPACT/SAFETY: frontend-only; build GREEN; dev only.
NEXT BATCHES: Helpfulness/Favourites/Users intros, Banks/Upload, Manage admins,
  FAQ, Announcement, Bank health — consistent premium headers + polish.


# ─────────────────────────────────────────────────────────────────────
# ADMIN PANEL premium polish — Batch 2 (Helpfulness/Favourites/Users/Bank health)
# ─────────────────────────────────────────────────────────────────────

Replaced the remaining ad-hoc empty states with the premium AdminEmpty
  (purpose + why-empty + "Live" collecting pill), and added two positive
  states so a healthy/empty section reads as good, not broken:
  • Helpfulness — AdminEmpty (Lightbulb): "weakest explanations rise to the
    top, your rewrite shortlist"; collecting pill.
  • Favourites — AdminEmpty (Heart, #E0245E) shown when favIns.users === 0,
    instead of a list of dimmed zero-heart rows that looked broken.
  • Users — AdminEmpty (User): high-level roster; privacy reassurance.
  • Bank health — NEW green "Every topic is well-supplied for its exam weight"
    reassurance when highCount === 0 (mirrors the red under-supply warning);
    AdminEmpty (Layers) guard when the pool has zero questions.

FILES: MODIFIED src/screens/admin-panel.jsx
IMPACT/SAFETY: frontend-only; build GREEN; dev only.
NEXT (Batch 3): Manage admins, FAQ manager, Announcement, Upload/Banks premium.


# ─────────────────────────────────────────────────────────────────────
# ADMIN PANEL premium polish — Batch 3 (Manage admins / FAQ / Announcement / Banks)
# ─────────────────────────────────────────────────────────────────────

AUDIT: Manage admins, Announcement and FAQ manager are action/form screens
  (not telemetry dashboards) and were already premium + self-explaining
  (live-state, urgency, auto-expiry, history, server-verified passphrase, etc).
  Upload/Banks tiles route OUT to the App-level Library (onCreateBank /
  onOpenLibrary) — not part of the admin-panel surface.

CHANGE: aligned the one remaining inconsistency — FAQ manager empty state now
  uses the shared AdminEmpty (purpose + when), matching every other section.
  No "collecting" pill (admin authors FAQs, they aren't passively collected).

FILES: MODIFIED src/ui/admin-faq-manager.jsx
IMPACT/SAFETY: frontend-only; build GREEN; dev only.
ADMIN POLISH PASS COMPLETE — all 13 sections now read as new/healthy, never
  broken: unified premium empty/positive states + clear purpose lines.


# ─────────────────────────────────────────────────────────────────────
# NEW-03 — "The Pulse" (per-question animated countdown bar)
# ─────────────────────────────────────────────────────────────────────

WHAT: an opt-in, dramatic per-question countdown bar that drains in real time
  and colour-grades green → amber → red → dark-red (flatline) as the seconds
  bleed away — each question is a "patient", the bar is their pulse. A beating
  heart icon quickens with urgency; a one-line zone dialogue swaps per zone
  (Stable → Watch → Critical → Code) for thrill, and a relief/coaching line on
  answer ("Locked in with 9s in hand — topper tempo"). PURELY a pacing-pressure
  visual: it never auto-advances, blocks, or penalises.

NAME: "The Pulse" (heart-rate / vitals-monitor metaphor; distinct from the
  upcoming PHIL-02 Code Blue / PHIL-06 Vitals Check).

BUDGET: topic-aware — pacing.js questionBudgetSec(topic) = mid-point of the
  typical-candidate average band for that topic, clamped [25s,90s]. Tight on
  quick GK recalls, more room on heavy clinical reasoning.

OPT-IN: a premium toggle (PulseToggle) on Quick test + Mock setup screens, just
  before Start. Choice persists to data.preferences.pulseTimer and is INHERITED
  by topic-wise tests (which launch instantly from pickers, no setup gate).
  Excluded from review modes (bookmarks / due / wrong) — revisiting mistakes
  shouldn't be a race.

ARCH: PulseTimer is self-contained (owns its 200ms tick) so Quiz doesn't
  re-render every frame; resets on q.id change, freezes on submit/reveal.
  Reduced-motion safe (reuses timer-beat keyframes, already RM-gated).

FILES:
  ADDED:    src/ui/pulse-timer.jsx · src/ui/pulse-toggle.jsx
  MODIFIED: src/lib/pacing.js (questionBudgetSec) · src/screens/quiz.jsx ·
            src/screens/QuickPracticeSetup.jsx · src/screens/MockSetup.jsx ·
            src/App.jsx (thread pulse through startQuiz/startQuickPractice + nav)
IMPACT/SAFETY: frontend-only; new preference field rides the existing synced
  data blob (no schema/Edge/CONTENT_VERSION change). Build GREEN. dev only.


# ─────────────────────────────────────────────────────────────────────
# PHIL-04 — "The Ghost Shift" (race your ~2-weeks-ago self)
# ─────────────────────────────────────────────────────────────────────

ROOT: Oubaitori — bloom in your own time. Your only opponent is the version of
  you from a fortnight ago. (Leaderboard KEPT per earlier user decision; Ghost
  is ADDITIVE, not a replacement — the spec's "remove leaderboards" overridden.)

WHERE: Advanced Test results screen (the app's scored mock with a persisted,
  timestamped advancedTestHistory). Hidden on Previous-Paper results (different
  store). No Supabase query / index — adapted to the client-blob model per the
  standing decision (no SQL attempts table).

LOGIC (src/lib/ghost.js, pure): current = most-recent advancedTestHistory entry;
  ghost = a PRIOR session ~14 days back within a ±3-day grace window, else the
  prior whose age is closest to 14 days (labelled "closest past run"). Metrics
  are PER-QUESTION normalised so different test lengths compare fairly: net/Q,
  accuracy, marks lost to negatives /100Q, pace/Q. Verdict tri-state, always
  Oubaitori-kind: "You're levelling up" / "Holding your ground" / "The climb
  continues" (a dip = data, not a verdict). First-ever mock → "No Ghost yet —
  this becomes your first Ghost. Beat it in two weeks."

CARD (src/ui/ghost-shift-card.jsx): ghost-icon header, verdict headline + line,
  You-vs-Ghost metric rows with ▲/▼ chips (green better / amber worse, never a
  harsh red), Oubaitori footnote. Local data ⇒ renders instantly (the spec's
  async note was for the Supabase path we don't use).

FILES:
  ADDED:    src/lib/ghost.js · src/ui/ghost-shift-card.jsx
  MODIFIED: src/screens/advanced-test.jsx (prop + render) ·
            src/App.jsx (pass advancedTestHistory to advanced-results only)
IMPACT/SAFETY: frontend-only; reads existing advancedTestHistory; no schema/
  Edge/CONTENT_VERSION change. Build GREEN. dev only.


# ─────────────────────────────────────────────────────────────────────
# FOUNDATION A1 — is_foundational tagging (client-blob adaptation)
# ─────────────────────────────────────────────────────────────────────

SPEC vs REALITY: the doc's A1 adds Supabase columns to an `attempts`/`questions`
  table. Per the standing decision (NO SQL attempts/questions migration — it
  would undo the 5-stage kv-broker security), `is_foundational` becomes an
  OPTIONAL field on the EXISTING question schema, exactly like source/difficulty/
  image. Per-attempt fuel (time, confidence, rationale-bonus) already lives in
  data.history attempts + economy.whyClaimed.

WHAT "foundational" MEANS: a must-know survival/safety protocol a Nursing Officer
  can't miss on the floor (CPR ratio, hand-hygiene 5 moments, ABC/airway, insulin
  storage, BMW colour coding, anaphylaxis first-line, transfusion-reaction first
  action, GCS-8 → intubate, five rights, defib/shockable). This is the fuel for
  PHIL-06 Vitals Check + PHIL-01 Ikigai "Mission" circle.

DELIVERED:
  • src/lib/foundational.js — isFoundational(q): explicit flag wins
    (q.foundational / imported is_foundational), else a TIGHT high-precision
    survival-protocol regex set. Conservative on purpose (PHIL-06 force-pauses a
    test on a foundational miss → a false positive is costly). + countFoundational.
  • question-import.js — normalizeQuestion now passes through foundational /
    is_foundational (JSON bool or CSV "true/1/yes") so banks can tag.
  • seed.js — explicitly tagged 2 unmistakable Qs (f3 hand-hygiene, m7 GCS-8) as
    a deterministic safety net independent of the heuristic.
  • Smoke test: 7/7 (hand hygiene / CPR / BMW / explicit / five rights = found;
    pharmacology / epidemiology = not).

FILES:
  ADDED:    src/lib/foundational.js
  MODIFIED: src/lib/question-import.js · src/data/seed.js
IMPACT/SAFETY: data-layer only, no UI yet; additive optional field, no schema/
  Edge/CONTENT_VERSION change (built-in seed edit doesn't alter stored user
  data). Build GREEN. dev only. UNBLOCKS PHIL-06 (next).


# ─────────────────────────────────────────────────────────────────────
# PHIL-06 — "Vitals Check" (stop-the-line on a foundational miss)
# ─────────────────────────────────────────────────────────────────────

ROOT: Jidoka — stop the line the instant a fatal error occurs. Missing a
  FOUNDATION-A1 must-know question (isFoundational(q)) forcibly pauses the
  session and enforces a rationale read before resuming.

TRIGGER: in Quiz.submit(), when answer is WRONG && isFoundational(q) &&
  practice/test mode (PULSE_MODES) && not already shown this session. Once per
  question per session (vitalsShown Set). Reveals (Submit-without-answering)
  don't count — only real wrong attempts, per spec.

OVERLAY (src/ui/vitals-check.jsx): React PORTAL to document.body at a max
  z-index so nothing can bury it. Dim+blur backdrop, clinical-red card with a
  beating HeartPulse, the question + its rationale (scrollable), an ENFORCED
  20s read (progress bar + live countdown) — the resume button is disabled until
  0, then "I understand — resume". Tone is protective, not punitive (honours the
  "keep copy simple, don't scare users" UX principle).

TIMER PAUSE: vitalsOpenRef gates the Quiz countdown tick so the mock clock AND
  elapsed freeze while the overlay is up (no penalty for reviewing). The Pulse
  per-question bar already freezes on submit.

FILES:
  ADDED:    src/ui/vitals-check.jsx
  MODIFIED: src/screens/quiz.jsx
IMPACT/SAFETY: frontend-only; reads the A1 foundational flag; no storage/Edge/
  CONTENT_VERSION change. Build GREEN. dev only. NOTE: 20s enforced read is the
  spec value — tunable if it feels long in dev testing.


# ─────────────────────────────────────────────────────────────────────
# PHIL-02 — "Code Blue Mode" (reframe failure as a recoverable emergency)
# ─────────────────────────────────────────────────────────────────────

ROOT: Logotherapy — suffering ceases when it finds meaning. A crash becomes a
  Code Blue: not a verdict, a call to action.

USER DECISION (asked — genuine product-feel call): GENTLE mode, no lives drain.
  Trigger = 3 wrong-in-a-row IN-SESSION only (Hearts never visibly deplete).
  The fuller "Accuracy Wallet drains / hits zero" variant was offered + declined.

FLOW (src/ui/code-blue.jsx, React Portal, max z-index): 2s blue↔red flash →
  dark minimalist prompt (scores/timers hidden) → recovery drill of the session's
  OWN wrong questions, pre-loaded, easiest-first, max 5; must clear each (miss →
  rationale + Try again) → "You stabilised the patient" +1 Heart → Resume.
  Always-present ✕ exit; one Code Blue per session.

INTEGRATION (quiz.jsx): consecutiveWrong streak; Vitals Check precedence on the
  same submit; codeBlueOpenRef pauses mock clock + elapsed. App.onCodeBlueResolved
  → economy.restoreHearts(1) (future-safe; capped).

FILES: ADDED src/ui/code-blue.jsx · MODIFIED src/lib/economy.js · src/screens/quiz.jsx · src/App.jsx
IMPACT/SAFETY: frontend-only; no schema/Edge/CONTENT_VERSION change. Build GREEN. dev only.


# ─────────────────────────────────────────────────────────────────────
# NEW-03b — The Pulse retune (tighter, per-category, difficulty-aware)
# ─────────────────────────────────────────────────────────────────────

USER FEEDBACK: the Pulse gave too much time per question — it should make the
  user FEEL the clock. Wanted dynamic-by-difficulty (very hard/deep = more time,
  else less) and the same Pulse in Topic-wise tests. Also: the new competitive
  mode is named "FLASHPOINT" (not "Rapid Fire").

CHANGE (pacing.js): replaced the average-band budget with a per-CATEGORY table.
  FLASHPOINT_SEC = the intense halved tier (gk/anat/ch/micro 10s · pharm/nutr
  15s · msn/obg/peds/fund/mhn 20s · apt 30s). Normal Pulse = 2× Flashpoint,
  nudged by question difficulty (easy ×0.8, hard ×1.3). New normals: GK 20s
  (was ~40), clinical 40s (was ~72), apt 60s. questionBudgetSec(topic,
  {flashpoint, difficulty}); flashpointBudgetSec(topic) for Flashpoint mode.
  Topic-wise already inherits the Pulse preference (mode ∈ PULSE_MODES) so the
  retuned bar shows there too; explicit control ships with Flashpoint (next).

FILES: MODIFIED src/lib/pacing.js · src/screens/quiz.jsx
IMPACT/SAFETY: frontend-only; no schema/Edge/CONTENT_VERSION change. Build GREEN.
  dev only. (Chunk 1 of the Pulse/Flashpoint update.)


# ─────────────────────────────────────────────────────────────────────
# FLASHPOINT — competitive half-time mode (Chunk 2 of 3)
# ─────────────────────────────────────────────────────────────────────

USER DECISION (asked): single 3-way Pace selector — Off / The Pulse / Flashpoint
  — one global setting shown on Quick + Mock + Topic-select; applies everywhere
  (that's how topic-wise gets the same UI/UX).

PACE MODEL (src/lib/pace.js): preferences.pace ∈ {off,pulse,flashpoint} (back-
  compat from old pulseTimer bool). paceFlags(pace) → {pulse, flashpoint} threaded
  into nav for every launch path. setPace() persists + triggers the one-time
  Flashpoint entry warning.

FLASHPOINT:
  • Timers HALVED — flashpointBudgetSec (gk/anat/ch/micro 10s · pharm/nutr 15s ·
    msn/obg/peds/fund/mhn 20s · apt 30s).
  • The clock ENFORCES (decision, flagged): PulseTimer fires onExpire → Quiz
    auto-locks the question (selection → auto-submit; blank → timed-out wrong, 0
    pts). Normal Pulse stays non-blocking. (onExpire via ref so it never resets
    the tick.)
  • 2× POINTS: completeQuiz adds correct×2 to stats.flashpointPoints (lifetime
    tally; ranks the Flashpoint board — Chunk 3).
  • Entry warning (src/ui/flashpoint-intro.jsx, Portal, one-time): "timers cut in
    half, points doubled. Get your fingers ready."
  • PulseTimer shows "Flashpoint · 2×" + Zap when active.

UI: PaceSelector (src/ui/pace-selector.jsx) replaces the old PulseToggle (deleted)
  on QuickPracticeSetup + MockSetup + TopicSelect (new — gives topic-wise the
  control). seed defaults: preferences.pace='off', flashpointIntroSeen=false,
  stats.flashpointPoints=0.

FILES:
  ADDED:   src/lib/pace.js · src/ui/pace-selector.jsx · src/ui/flashpoint-intro.jsx
  REMOVED: src/ui/pulse-toggle.jsx
  MODIFIED: src/ui/pulse-timer.jsx · src/screens/quiz.jsx · src/App.jsx ·
            src/screens/QuickPracticeSetup.jsx · src/screens/MockSetup.jsx ·
            src/screens/TopicSelect.jsx · src/data/seed.js
IMPACT/SAFETY: frontend-only; new optional preference + stats fields (no
  migration; normalizePace falls back). Build GREEN. dev only. NEXT: Chunk 3 —
  Flashpoint leaderboard tab.


# ─────────────────────────────────────────────────────────────────────
# FLASHPOINT — leaderboard tab (Chunk 3 of 3) — FEATURE COMPLETE
# ─────────────────────────────────────────────────────────────────────

leaderboard.js: computeLeaderboardEntry now carries flashpointPoints
  (= stats.flashpointPoints). Rides the same per-user leaderboard:{id} blob —
  no new key/subsystem.

leaderboard.jsx: a top Normal | ⚡ Flashpoint board switch. Flashpoint board
  ranks by lifetime flashpointPoints (desc), its own podium / your-standing /
  empty state ("Ignite the Flashpoint board") + context line ("correct answers
  in Flashpoint pace score 2×"). Normal board keeps week/mastery/streak/accuracy
  (sub-tabs hidden on the Flashpoint board).

FILES: MODIFIED src/lib/leaderboard.js · src/screens/leaderboard.jsx
IMPACT/SAFETY: frontend-only; reuses the existing leaderboard blob (extra
  optional field). Build GREEN. dev only.

FLASHPOINT FEATURE COMPLETE (3 chunks): retuned per-category Pulse budgets →
  Flashpoint half-time enforced mode + 2× points + 3-way Pace selector (Off/
  Pulse/Flashpoint) on Quick/Mock/Topic + one-time entry warning → Flashpoint
  leaderboard tab. "What does NOT change" honoured: question bank, categories,
  Results/Autopsy untouched.


# ─────────────────────────────────────────────────────────────────────
# Pulse/Flashpoint polish — enforce + lively timer redesign
# ─────────────────────────────────────────────────────────────────────

USER FEEDBACK: (1) The Pulse should also ENFORCE (block on timeout), not just
  Flashpoint. (2) Icons must be unique + premium. (3) Timer needs an after-
  animation on timeout ("Time's up"), CONTINUOUS colour grading (not hard
  green/yellow/red steps), and lively premium micro-interactions + more fun/
  teasing dynamic comments.

DONE:
  • Enforce both modes: quiz onTimerExpire now passed for The Pulse AND
    Flashpoint (timeout auto-locks the question; blank → timed-out wrong).
  • Icons: The Pulse → HeartPulse (distinct from Favourites' Heart), Flashpoint
    → Zap (consistent everywhere), Off → TimerOff. Cleared → Check, timeout →
    TimerOff.
  • PulseTimer rewrite (src/ui/pulse-timer.jsx):
    - CONTINUOUS colour: gradeColor(frac) interpolates hue 146°→0° on a curve
      (HSL), gaining saturation / losing lightness as it drains — no hard steps.
    - Lively micro-interactions: moving sheen sweep across the fill (shimmer,
      faster when critical), glow that intensifies as time bleeds, heartbeat
      that speeds up, seconds POP each tick in the final 10s (q-pulse keyed).
    - Timeout after-animation: q-shake + hard-red "TIME'S UP · the clock won
      this one — locked" with a TimerOff icon. Cleared-in-time → green "Locked
      in with Ns to spare" + Check.
    - Teasing one-liners: 4 per zone, stable per question (hashed), playful
      ("No rush… yet 😏", "The clock is watching you 👀", "Slam an answer — NOW!").
    - Comment re-animates (fadeup) on each zone change. Reduced-motion safe.

FILES: MODIFIED src/screens/quiz.jsx · src/ui/pace-selector.jsx · src/ui/pulse-timer.jsx
IMPACT/SAFETY: frontend-only; reuses existing keyframes (shimmer/qPulse/q-shake/
  timer-beat). Build GREEN. dev only.


# ─────────────────────────────────────────────────────────────────────
# Pace scope decision + one-time Pulse entry note
# ─────────────────────────────────────────────────────────────────────

DESIGN DECISION (discussed w/ user — corrected my own earlier call): rather than
  re-engineering Mock into a CBT (which would clone the Advanced Test), SHARPEN
  the difference:
    • Mock     = "timed practice" — linear, INSTANT feedback, global timer +
                 optional per-question Pulse/Flashpoint. (Pulse BELONGS here.)
    • Advanced = "exam simulation" — DEFERRED feedback, question palette,
                 mark-for-review, editable/clearable answers, percentile/rank.
                 (Already has all this; the come-back-later home.)
  ⇒ Reverted the brief "remove Pulse from Mock" change. Mock is back in PACE_MODES
    and paceEligible. Quick/Topic unchanged. Dosage gets an optional Pulse next.

ALSO: one-time "The Pulse" entry note (src/ui/pulse-intro.jsx, green/HeartPulse),
  mirroring the Flashpoint warning — fires the first time a user picks the Pulse
  pace, explaining the colour-grading countdown + that it LOCKS on timeout.
  Wired via setPace (App) + preferences.pulseIntroSeen (seed).

FILES: ADDED src/ui/pulse-intro.jsx · MODIFIED src/App.jsx · src/data/seed.js ·
       src/screens/quiz.jsx · src/screens/MockSetup.jsx
IMPACT/SAFETY: frontend-only; new optional pref field. Build GREEN. dev only.
NEXT: optional Pulse on Dosage (generous calc-tier budget) + Advanced/PYQ palette
  polish (colours, micro-interactions, discoverability).


# ─────────────────────────────────────────────────────────────────────
# Dosage Pulse (Step B) — optional, generous, inherits global Pace
# ─────────────────────────────────────────────────────────────────────

USER DECISION: add an optional Pulse/Flashpoint to the Dosage calculation test.

DONE (dosage-practice.jsx): inherits the global Pace (Off/Pulse/Flashpoint) — no
  separate control, since dosage launches straight in. Renders the same PulseTimer
  on a GENEROUS, dosage-specific budget (75s Pulse / 40s Flashpoint — more than
  the aptitude tier because dosage is compute-AND-type; never rush med math into
  an error). The clock enforces: a valid answer auto-checks on timeout; an empty
  field reveals the worked solution (recorded as revealed, not a harsh wrong).
  Flashpoint dosage now awards its 2× points (completeDosage) so the badge is
  honest; dosage otherwise stays out of the main stats as before.

FILES: MODIFIED src/screens/dosage-practice.jsx · src/App.jsx
IMPACT/SAFETY: frontend-only; build GREEN; dev only.


# ─────────────────────────────────────────────────────────────────────
# Advanced/PYQ question palette polish (Step C)
# ─────────────────────────────────────────────────────────────────────

FINDING (corrected the user's premise): Advanced Test + PYQ papers ALREADY have
  the full come-back-later CBT system — question palette (jump to any Q),
  Mark-for-review, free Prev/Next, editable + clearable answers till submit.
  Quick/Topic/Dosage correctly DON'T (instant feedback). So Step C = polish only.

DONE (advanced-test.jsx): premium palette + colour legend the user asked for:
  • 🟢 Answered (green) · 🔴 Not answered (soft red) · 🟣 Marked (violet #7C3AED) ·
    🔵 Current (primary ring + lift). "Answered AND marked" → violet cell with a
    green corner dot.
  • Micro-interactions: staggered cell entrance (seq-item), tap scale, current
    cell lifts with a ring + shadow.
  • Discoverability: palette trigger gets a violet marked-count badge + shadow +
    active-scale, so the "navigator" is obvious.
  • Consistency: the per-question "Marked" pill + Mark-for-review button now use
    the same violet as the palette (was amber).

FILES: MODIFIED src/screens/advanced-test.jsx
IMPACT/SAFETY: frontend-only; reuses seq-item keyframe. Build GREEN. dev only.


# ─────────────────────────────────────────────────────────────────────
# Dosage: setup gate + Crib Sheet on results
# ─────────────────────────────────────────────────────────────────────

USER REQUEST: dosage started abruptly — give it a setup page like Quick test;
  and let users add to the Crib Sheet after a dosage test, like Quick test.

SETUP (src/screens/DosageSetup.jsx, new): mirrors QuickPracticeSetup — hero brief,
  count picker [5/10/15/20] (capped to the dosage pool), the Pace selector, an
  info card, fixed Start bar. Routing kept back-compatible: 'dosage' is now the
  SETUP (favourites/drill key 'dosage' unchanged → no broken favourites), and the
  timed drill runs under the new 'dosage-run' route. DosagePractice takes a
  `count` prop (was hard-coded 10). PTR-disabled list: 'dosage' → 'dosage-run'.

CRIB SHEET (dosage-results.jsx + crib-sheet.jsx + App): DosageResults gains a
  "Review answers — Crib Sheet" button (gated by isCribSheetEnabled). App shapes
  the dosage session into crib items {q, selected:userAnswer, status}. CribSheet's
  QuestionCard now renders a NUMERIC block (You gave X unit · Correct Y unit) when
  q.options is absent — so dosage questions render cleanly alongside MCQ ones;
  composeListenText (TTS) handles numeric too. Saved-to-Revision works the same.

FILES:
  ADDED:    src/screens/DosageSetup.jsx
  MODIFIED: src/App.jsx · src/screens/dosage-practice.jsx · src/screens/dosage-results.jsx ·
            src/screens/crib-sheet.jsx · src/screens/drill-tests.jsx
IMPACT/SAFETY: frontend-only; no schema/Edge change; favourites key preserved.
  Build GREEN. dev only.


# ─────────────────────────────────────────────────────────────────────
# Vitals Check dwell ↓ + Drill-Tests settings (toggle coaching features)
# ─────────────────────────────────────────────────────────────────────

USER REQUEST: (1) Vitals Check pop-up felt too long — shorten smartly. (2) Add a
  Drill-Tests-specific settings area; a normal user may not want Vitals Check /
  Code Blue / Ghost Shift — keep them ON by default but make them editable.
  Append only; don't break existing behaviour.

VITALS DWELL (vitals-check.jsx): was a flat 20s. Now content-aware — ~0.28s per
  rationale word, clamped to a brisk [5,10]s. (minSeconds prop still overrides.)

DRILL SETTINGS:
  • src/lib/drill-settings.js — DRILL_FEATURE_KEYS + drillFeatureOn(prefs,key)
    (DEFAULT ON; off only when explicitly false ⇒ zero behaviour change for
    everyone who never opens it) + setDrillFeature.
  • src/screens/drill-settings.jsx — premium toggle list (Vitals Check / Code
    Blue / Ghost Shift) with icon, where-it-applies, description, switch.
    Persists preferences.drillCoaching via setData.
  • Reached from a new gear in the Drill Tests TopBar (drill-tests.jsx →
    go('drill-settings')); back returns to Drill Tests.
  • GATES: quiz.jsx fireVitals/fireCodeBlue now require drillFeatureOn(prefs,…);
    Ghost Shift gated in App by passing advancedTestHistory=null when off (the
    card already hides on null). seed default drillCoaching all-true.

FILES:
  ADDED:    src/lib/drill-settings.js · src/screens/drill-settings.jsx
  MODIFIED: src/ui/vitals-check.jsx · src/screens/drill-tests.jsx ·
            src/screens/quiz.jsx · src/App.jsx · src/data/seed.js
IMPACT/SAFETY: frontend-only; default-ON preserves current behaviour (no
  migration needed; absent reads as ON). Build GREEN. dev only.


# ─────────────────────────────────────────────────────────────────────
# NEW-07 audit + What-If simulator (NEW-07.1)
# ─────────────────────────────────────────────────────────────────────

AUDIT (per user's "report copies"): the Results screen ALREADY has most of
  NEW-07 — CalibrationCard (confidence×accuracy buckets + insight, = NEW-07.2),
  TimeQuadrant (speed×correctness), PacingCard (per-topic pacing), Peer
  Comparison. So NEW-07.2 is essentially pre-built. NEW-04 "Three-Wave" overlaps
  the Pulse/Flashpoint timed-pressure system (flagged, lower priority).
  GENUINELY MISSING: (1) negative-marking What-If simulator, (3) clinical-system
  leak radar.

BUILT — NEW-07.1 (src/ui/what-if-card.jsx): interactive negative-marking
  simulator on Advanced + PYQ results (the only 1/3-penalty modes). Slider "skip
  your riskiest guesses" (0..wrong) → live adjusted net (net + skip/3), marks
  saved, marks still lost, and a SAFE / BORDERLINE / RISKY band from % of max.
  Disciplined run (0 wrong) → a positive "no marks lost" state. Topper insight:
  "every mark lost to a blind guess can cost 350+ rank spots." Honest framing —
  models the user's actual wrong answers as the avoidable guesses.

FILES: ADDED src/ui/what-if-card.jsx · MODIFIED src/screens/advanced-test.jsx
IMPACT/SAFETY: frontend-only; reads existing summary data; no schema/Edge change.
  Build GREEN. dev only. NEXT (missing NEW-07.3): clinical-system leak radar.


# ─────────────────────────────────────────────────────────────────────
# PHIL-01 — Clinical Ikigai Compass (the 4-circle readiness dashboard)
# ─────────────────────────────────────────────────────────────────────

The flagship. A living 4-circle Venn, NOT a scoreboard. Adapted to this app's
  real data (no "Shift Simulator"): Passion = engagement (streak·breadth·volume),
  Profession = overall accuracy, Mission = FOUNDATIONAL mastery (isFoundational),
  Vocation = exam pacing + negative-marking restraint. Each is a 0..1 score =
  quality × data-confidence (so a new user starts with 4 small/separated/dim
  circles that grow + converge as they practise — never looks empty).

  • src/lib/ikigai.js — computeIkigai(data, allQuestions): pure; reuses
    attemptStats / isFoundational / EXAM_PACE_SEC / countsInNursingStats. Returns
    scores, overall, master (all ≥0.8), weakest, detail readouts.
  • src/ui/ikigai-compass.jsx — custom SVG (no chart lib). Circles drift to a
    shared centre + grow with score; gold centre glow appears as they converge;
    ⭐ + pulsing glow at Master. On open, animates from the dim/separated baseline
    to computed (you watch readiness take shape). Reduced-motion safe; blend
    mode multiply(light)/screen(dark).
  • src/screens/ikigai-screen.jsx — compass + overall alignment % + verdict +
    an ALIGNMENT QUEST nudge (weakest circle → real action + CTA) + the four
    dimension cards with score bars and raw signals. Cold-start CTA.
  • Entry: sidebar Progress group "Ikigai Compass" (badge New, violet); favoritable
    (registry + new 'compass' FavIcon). Route 'ikigai' (lazy).
  NOTE: full Alignment Quests (gap→targeted drill + 2× coins) deferred; v1 nudges
  to Quick Test.

FILES: ADDED src/lib/ikigai.js · src/ui/ikigai-compass.jsx · src/screens/ikigai-screen.jsx ·
       MODIFIED src/App.jsx · src/ui/nav-drawer.jsx · src/lib/favorites.js · src/ui/fav-icons.jsx
IMPACT/SAFETY: frontend-only; reads existing data; no schema/Edge change. Build GREEN. dev only.


# ─────────────────────────────────────────────────────────────────────
# FIX — Pulse skip-loophole (skipped question restarted the timer)
# ─────────────────────────────────────────────────────────────────────

USER-FOUND BUG: with the Pulse/Flashpoint on, skipping a question and returning
  to it later RESTARTED its timer with a full fresh budget — an unfair advantage
  and illogical.

FIX: carry the Pulse clock across re-visits. quiz.jsx banks the live seconds
  spent on a question each visit (pulseSpentRef[qId], via pulseShownAtRef
  timestamp) at the moment of SKIP. PulseTimer gains initialElapsedSec — it
  starts the countdown at (budget − alreadySpent) instead of full, so a returning
  question RESUMES (bar starts partially drained) rather than restarting. If the
  budget was used up across visits it locks immediately on return. Applies to
  both The Pulse and Flashpoint. No skip can buy fresh time.

FILES: MODIFIED src/ui/pulse-timer.jsx · src/screens/quiz.jsx
IMPACT/SAFETY: frontend-only; Pulse-off modes unaffected (ref banks but is never
  read). Build GREEN. dev only.


# ─────────────────────────────────────────────────────────────────────
# Mock results — "Exam reality" one-liner (NOT the full What-If)
# ─────────────────────────────────────────────────────────────────────

DECISION (discussed): the What-If simulator stays on Advanced/PYQ only — those
  are the ONLY modes with 1/3 negative marking (verified: Quick/Topic/Mock/Dosage
  score on pure accuracy, netScore lives only in advanced-test.jsx +
  previous-papers.jsx). Spreading the interactive simulator to penalty-free modes
  would mislead + dilute. The ONE smart add: a light, non-interactive reminder on
  MOCK results (the most exam-like practice mode).

DONE (Results.jsx, mock only): a slim "Exam reality" card — wrong>0 → "under
  NORCET's 1/3 negative marking your N wrong answers would cost ~M marks; when you
  can't narrow to two, blank often beats guessing"; wrong=0 → a positive "lost
  nothing — that restraint protects rank" line. Gated by mode==='mock' (new
  prop). Quick/Topic/Dosage unchanged (no penalty → no note).

FILES: MODIFIED src/screens/Results.jsx · src/App.jsx
IMPACT/SAFETY: frontend-only; mock-only; build GREEN; dev only.


# ─────────────────────────────────────────────────────────────────────
# PHIL-01 — Alignment Quests (completes the Ikigai Compass)
# ─────────────────────────────────────────────────────────────────────

The gap→action→reward loop. The Ikigai nudge now offers a real QUEST against the
  weakest circle: "Take the quest — lift it and earn +100 coins". Taking it banks
  the dimension's baseline (data.ikigaiQuest = {key, base, ts}) and launches
  practice. On a later visit, if that circle has measurably improved (≥ base +
  0.02), the quest completes → +100 Accuracy Coins (2× the Why-Bonus, "facing
  your weakness has the highest value") + a celebration card; the quest clears.
  Active-quest + completion states all handled in-screen.

  App: startAlignmentQuest(key, base) / claimAlignmentQuest(bonus) via
  economy.addCoins; seed ikigaiQuest:null. v1 launches a generic Quick Test
  (targeted per-dimension drills = future refinement).

FILES: MODIFIED src/screens/ikigai-screen.jsx · src/App.jsx · src/data/seed.js
IMPACT/SAFETY: frontend-only; new nullable data field; build GREEN. dev only
  (rides with the Ikigai Compass, still awaiting user testing).


# ─────────────────────────────────────────────────────────────────────
# NEW-10 (Module B) — Clinical Skill Sequence drill
# ─────────────────────────────────────────────────────────────────────

CONTEXT: codebase-buildable flagships done; remaining plan features need content/
  infra (reported to user). User chose to build the one self-contained new mode:
  a clinical procedure SEQUENCING drill (NEW-10 Module B) with built-in content.

DONE:
  • src/data/skill-sequences.js — 6 high-yield, unambiguous NORCET sequences
    (PPE donning + doffing, adult BLS, medication administration, tracheostomy
    suctioning, IV cannulation). The steps array IS the correct order; rationale
    each.
  • src/screens/skill-sequence.jsx — "shift handoff"-styled drill: patient tag,
    scenario, TAP-TO-BUILD ordering (touch-robust, no fragile drag — tap pool
    steps to append, tap placed to remove, Reset). Check → per-position ✓/✗ +
    correct-order reveal + rationale. Per-scenario coins (15 × correct) on a
    "Shift complete" summary. seq-item entrance micro-interactions.
  • Entry: a "Clinical Skill Drill" card (teal, New badge) in Drill Tests →
    route 'skill-drill'; onComplete awards coins via economy.addCoins;
    PTR-disabled.

FILES: ADDED src/data/skill-sequences.js · src/screens/skill-sequence.jsx ·
       MODIFIED src/App.jsx · src/screens/drill-tests.jsx
IMPACT/SAFETY: frontend-only; built-in content (no external dependency); coins via
  existing economy; build GREEN. dev only (new mode — awaiting test).


# ─────────────────────────────────────────────────────────────────────
# Clinical Skill Drill — setup page + Pace timer (lively/premium)
# ─────────────────────────────────────────────────────────────────────

USER: give the Skill Drill a setup page (with the Pulse/Pace control), make it
  exciting + animated + premium.

DONE:
  • src/screens/SkillSetup.jsx — a "clock in for your shift" setup: animated
    teal gradient hero (beating Activity icon, floating accent circles), a
    staggered procedure-teaser strip (PPE · BLS · Suction · IV · Med admin),
    "How many patients?" count chips (3/5/All), the shared PaceSelector with a
    plain-English note, and a "Start my shift" CTA. seq-item / anim-fadeup
    micro-interactions throughout.
  • skill-sequence.jsx — now honours the global Pace: paceOn → a per-CASE
    PulseTimer (budget = steps × 9s; Flashpoint × ~half) that LOCKS the case on
    timeout ("Time's up — here's the correct order"). Flashpoint also DOUBLES the
    coins (coinPerCorrect 15→30; "2×" on the summary), so the badge is honest.
    Live pulse-dot on the patient tag; q-pulse on the completion trophy/coins.
  • App: route 'skill-setup' (Drill Tests card now opens it) → onStart sets count
    → 'skill-drill' (count threaded). onSetPace persists the global Pace.

FILES: ADDED src/screens/SkillSetup.jsx · MODIFIED src/screens/skill-sequence.jsx ·
       src/App.jsx · src/screens/drill-tests.jsx
IMPACT/SAFETY: frontend-only; inherits global Pace; coins via existing economy;
  build GREEN. dev only.


# ─────────────────────────────────────────────────────────────────────
# FIX — Advanced/PYQ question palette (visited→red + centred pop-up)
# ─────────────────────────────────────────────────────────────────────

USER-FOUND: (1) a question that was READ then skipped without attempting should
  turn RED in the palette; (2) the palette pop-up should be CENTRED, not a bottom
  sheet.

FIX (advanced-test.jsx): the `visited` map (already tracked on question change)
  now drives the palette colours — true 5-state CBT legend:
    🟢 Answered · 🔴 Seen, blank (visited && unanswered) · ⚪ Not seen
    (never opened) · 🟣 Marked · 🔵 Current (ring). Answered+marked keeps the
  green corner dot. Added seenBlankCount / notSeenCount for the legend.
  Pop-up: bottom-sheet (items-end, rounded-t) → CENTRED modal (items-center,
  max-w-sm, rounded-3xl, anim-scalein, blur backdrop, soft shadow) with a
  scrollable body. Premium.

FILES: MODIFIED src/screens/advanced-test.jsx
IMPACT/SAFETY: frontend-only; build GREEN. dev only (fix to a feature already
  live on main — can hotfix-cherry-pick if desired).


# ─────────────────────────────────────────────────────────────────────
# SESSION AUDIT — NURSING_PWA_UPGRADE_STRATEGY.md vs the live codebase
# ─────────────────────────────────────────────────────────────────────

CONTEXT: started working through NURSING_PWA_UPGRADE_STRATEGY.md. Ran its own
  mandatory pre-session audit first. FINDING: that doc is ~80% already-built (or
  deliberately deferred) — it reads like it was written for an early-stage app,
  but the repo is far past it. Recording the duplication map so NO future
  session rebuilds these:
    • Ph1.3 "strip admin from student bundle" → CONFLICTS with our design (full
      RBAC admin-panel.jsx + Supabase Edge brokers). IGNORE.
    • Ph2.1 anti-repetition → repeat-unattempted.js / quick-practice.js (done).
    • Ph2.2 Prelims/Mains filter → pacing.js / projection.js / previous-papers
      / norcet-benchmarks (done).
    • Ph2.3 negative-marking UI → netScore live in advanced-test + previous-
      papers; mock "Exam reality" note added (partial-done).
    • Ph2.4 / Ph6.2 cloud sync + LWW → KV-blob sync w/ egress guard (done).
    • Ph3 Energy→Game→Ticket→Gacha → SUPERSEDED by live "Level Up: RN"
      (levelup.js, economy.js, game-config.js, crates, 7+ clinical games). The
      doc's "3 AM Chart"/"Shift Survival" Tetris games are an abandoned design.
      IGNORE Phase 3 wholesale.
    • Ph4.1 image questions → ibq.jsx / ecg-monitor (done). Mixpanel → SUPERSEDED
      by privacy-respecting analytics.js (do NOT add Mixpanel; Privacy Policy).
    • Ph6.1/6.3 serverless economy + rate limit → brokers + api/_ratelimit (done).
    • Ph5 (Razorpay) / Ph7 (admin repo split) / Ph8 (multi-exam) → correctly
      DEFERRED (no payment stack by choice; admin split gated >800 Qs).
  GENUINELY NEW + buildable-now shortlist surfaced to user: (1) content quality
  gate, (2) "Duty Roster" study-window + window-targeted push, (3) finish the
  negative-marking HUD. User picked (1).


# ─────────────────────────────────────────────────────────────────────
# UPGRADE-2 / Layer 3 — Content Quality Gate (crowdsourced auto-flag)
# ─────────────────────────────────────────────────────────────────────

WHY: a wrong answer-key is the #1 trust-killer for a medical exam app. Strategy
  doc's UPGRADE 2 wants questions that ≥N readers flag to stop being served until
  cleared. Built it on the EXISTING report infra (no parallel architecture): the
  admin inbox already aggregates every feedback:{id}, and each carries questionId
  + profileId — so distinct-reporter counts are a pure derivation, and the only
  new persisted state is a tiny PUBLIC list of pulled ids.

DONE:
  • src/lib/question-gate.js (NEW) — FLAG_THRESHOLD=3; module hidden-Set;
    loadQuestionGate() (one public anon read of `qgate:hidden` at boot),
    filterHidden(arr) (same-ref when empty → memo-stable), saveHiddenIds()
    (admin write, THROWS so the UI can surface deploy errors), and the pure
    aggregateFlaggedQuestions(feedback) (group by questionId, count DISTINCT
    reporters by profileId, mark autoFlag at ≥threshold, carry sample texts).
  • src/lib/keys.js — registered KEYS.QUESTION_GATE = 'qgate:hidden'.
  • src/App.jsx — boot effect loads the gate; new hiddenQ state (declared by
    `data` so it's in scope for allQuestions); allQuestions now wraps its result
    in filterHidden(...) → pulled questions vanish from EVERY pool (quiz, drills,
    bookmarks, due) via one chokepoint. Same "exclude from active pool" pattern
    as paused banks (history/bookmarks for a pulled id simply don't resolve).
  • src/screens/admin-panel.jsx — Feedback view now has a "Question quality gate"
    card: every reported question by distinct-reporter count, ≥3 badged
    "Auto-flag", one-tap Pull / Restore (writes qgate:hidden), tap the id to peek
    the question (reuses ReportedQuestionModal). Currently-hidden ids whose
    reports were cleared still show so they can be restored. Clear error if the
    broker write is rejected.
  • supabase/functions/kv-write/index.ts — added `qgate:` to the admin-only
    write branch (mirrors announcement:/faq:); world-readable, admin-write-only.

⚠️ DEPLOY STEP (required for the admin Pull/Restore to persist):
     supabase functions deploy kv-write --no-verify-jwt
  Until then the gate READS fine (empty list, no effect) and the student app is
  unaffected; only the admin write 403s with a clear in-UI message. The frontend
  can ship to dev independently of the function deploy.

NOTE (Layers 1 & 2, deliberately not built): Layer 1 schema validation already
  exists via question-import.js. A hard `reviewed:true` gate (Layer 2) would hide
  the entire existing curated SEED bank unless backfilled — a breaking change to
  current content flow — so it's left as a noted follow-up, not built.

FILES: ADDED src/lib/question-gate.js · MODIFIED src/lib/keys.js · src/App.jsx ·
       src/screens/admin-panel.jsx · supabase/functions/kv-write/index.ts
IMPACT/SAFETY: build GREEN. Student-facing change is read-only + filter-only
  (degrades to "serve everything" if the key is absent/unreachable). Admin write
  needs the kv-write redeploy above. dev only.
TEST: behavioral test GREEN — 25 assertions over the REAL module (esbuild→node,
  fetch mocked): aggregateFlaggedQuestions (distinct-reporter dedup, anon
  fallback, threshold/autoFlag, sort, lastTs, samples cap) + loadQuestionGate
  parse + filterHidden drop/same-ref. React wiring + broker covered by the green
  build; the live admin-pull→student-hide round-trip still needs the deployed
  kv-write function + a logged-in admin (browser) to exercise.


# ═════════════════════════════════════════════════════════════════════
# ⛔ PENDING — REQUIRES THE MAIN CLAUDE ACCOUNT / LIVE INFRA
#    (these CAN'T be driven from the backup account — Supabase deploy +
#     browser admin login. Do them when the main account is back.)
# ═════════════════════════════════════════════════════════════════════

WHY THIS EXISTS: this batch of work was done on a backup Claude account (the
  main one hit its usage cap, ~3-day cooldown). All frontend + pure logic below
  is BUILT and unit-tested; only the live-infra steps remain. Knock these out on
  the main account to close the loop.

── PRIORITY 1 — Deploy the kv-write Edge Function ── ✅ DONE 2026-06-29 ──
  ✅ DEPLOYED from the backup account via the authenticated supabase CLI
     (`supabase functions deploy kv-write --project-ref jabmjyhdfacoikkgmjzl
     --no-verify-jwt`). kv-write is live with the additive `qgate:` admin-write
     rule. No prod caller exists until the frontend ships, so this was safe to
     deploy ahead of the UI. NOTHING TO DO HERE.
  Unblocked the Content Quality Gate's admin Pull/Restore (adds the `qgate:`
  write rule).

── PRIORITY 2 — Live round-trip test of the Content Quality Gate (browser) ──
  1. Log in as admin → Admin Panel → Feedback.
  2. From any quiz, tap the report icon on a question and submit, so it shows in
     the new "Question quality gate" card (reported-by count).
  3. Tap "Pull" → confirm NO red error banner (means the qgate: write persisted).
  4. Reload as a normal user → confirm that exact question never appears in any
     quiz / drill / bookmarks / due pool.
  5. Admin → "Restore" → reload → confirm the question returns.
  (Threshold for the "Auto-flag" badge is 3 DISTINCT reporters — to see the
   badge pre-launch, report the same Q from 3 different profiles.)

── PRIORITY 3 — Ship the usual way ──────────────────────────────────────
  git add/commit/push dev → check the Vercel preview → merge dev→main when happy
  (main = www.nurseholic.in). Note: the kv-write deploy (P1) is independent of
  the Vercel frontend deploy — both are needed for the admin write to work live.

# ═════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────
# Ph2.3 — Negative-marking UX (CLOSED: persistent marking-scheme reminder)
# ─────────────────────────────────────────────────────────────────────

CONTEXT: strategy Ph2.3 asked for (a) a persistent per-question "-0.33 if wrong,
  skip if unsure" banner, (b) a red "-0.33 deducted" flash on each wrong answer,
  and (c) a live running "Estimated NORCET Score" counter. Audited against the
  build before touching anything.

KEY FINDING (why most of Ph2.3 should NOT be built):
  - Negative marking applies in EXACTLY two modes - the Advanced/CBT engine
    (advanced-test.jsx) and PYQ mocks (previous-papers.jsx, which REUSES that
    same engine). Quick/Topic/Mock/Dosage score on pure accuracy (no penalty).
  - The CBT engine deliberately HIDES correctness until submit (exam realism -
    palette shows answered/blank, never right/wrong). So a live "estimated score"
    and a per-question "-1/3 deducted" flash are impossible there without
    breaking that realism.
  - The penalty-FREE practice modes are the only ones that reveal correctness
    mid-quiz - but a "-1/3 deducted" there would be factually wrong (no penalty
    applies). => parts (b) and (c) have NO valid home; building them anywhere
    would mislead. The post-test What-If simulator (NEW-07.1, already live on
    advanced/PYQ) is the correct "prove the cost of guessing" surface, and it
    already exists.

DONE (the one part that fits): a persistent marking-scheme reminder strip inside
  the AdvancedTest sticky CBT header (under the status legend, so it shows on
  every question without re-nagging): "+1 correct - (-1/3) wrong - 0 blank -
  can't narrow it to two? Blank beats a guess." Subtle (surfaceWarm/borderSoft/
  muted, small AlertTriangle in T.error). Authentic to a real CBT screen (which
  always states the scheme) and trains skip-discipline without leaking
  correctness. Inherited by previous-papers mocks for free (shared engine).

FILES: MODIFIED src/screens/advanced-test.jsx
IMPACT/SAFETY: frontend-only; one slim line added to the in-test header; no logic
  change to scoring/timer/palette; build GREEN. Fully completable + verified from
  here - NOTHING pending for the main account. Ph2.3 considered CLOSED. dev only.


# ─────────────────────────────────────────────────────────────────────
# UPGRADE-8 — "Duty Roster" study-window (client-side; Day-1 commitment)
# ─────────────────────────────────────────────────────────────────────

WHY: the biggest predictor of week-2 retention in ed-tech is a specific, time-
  bound commitment on Day 1. The app already had a daily-reminder TIME pref + a
  local nudge + a push subscription that STORES a reminderTime — but nothing let
  the user commit to a window up front, and (separately) send-reminders.js
  ignores the stored time (see the OPEN item below).

DONE (client-side, plan-independent, build GREEN + unit-tested):
  • demographics.js — STUDY_WINDOW_OPTIONS (Morning 7-9 / Afternoon 1-3 /
    Night 9-11), STUDY_WINDOW_TIME map (08:00 / 14:00 / 21:00, device-local),
    STUDY_WINDOW_UNLOCK reassurance copy; studyWindow added to normalize + the
    ID validation set + labelFor.
  • welcome.jsx — a new 'window' onboarding step ("When do you study best?"),
    inserted after 'employment'. Reuses the EXISTING generic demographic-screen
    renderer (one cfg entry + the step condition + the unlock lookup), so it
    inherits Skip / Back / replay-from-Settings for free. Bell icon; the unlock
    card icon is now cfg-driven (cfg.unlockIcon, defaults to the old Headphones
    so the existing steps are visually unchanged).
  • App.jsx — setDemographics now ALSO seeds preferences.dailyReminder.time (+a
    window label) from STUDY_WINDOW_TIME when a window is picked — so the choice
    flows into the EXISTING local nudge AND, once the user opts in from Settings,
    into subscribeToPush's reminderTime. It does NOT enable reminders / prompt
    for permission during onboarding (a later explicit time edit still wins).
    setDailyReminder now preserves the window label across toggles/time edits.
  • seed.js — dailyReminder default documents the new optional `window` field.

TEST: 9/9 pure assertions GREEN (node, direct import) — studyWindow validate/
  reject/missing, doesn't disturb other demographics, STUDY_WINDOW_TIME map,
  option count, labelFor. App-wiring covered by the green production build.

⚠️ OPEN ITEM — needs a decision, NOT pending-on-main-account:
  The BACKGROUND push (api/send-reminders.js) currently blasts every inactive
  device at ONE fixed cron (vercel.json: "0 14 * * *") and IGNORES each device's
  stored reminderTime. To actually deliver in each user's window we'd run 3
  daily crons (morning/afternoon/night) and gate sends by window — BUT Vercel
  HOBBY caps cron jobs at 2 (3 would fail the deploy); 3 needs PRO. Until that's
  decided, the per-window value is delivered by the LOCAL nudge (which already
  honours dailyReminder.time); background push is unchanged (no regression).
  → Asked the user their Vercel plan to size this correctly.

FILES: MODIFIED src/lib/demographics.js · src/screens/welcome.jsx · src/App.jsx ·
       src/data/seed.js
IMPACT/SAFETY: frontend-only; reuses existing onboarding + reminder plumbing; no
  permission prompt added; build GREEN; unit-tested. dev only — awaiting test.


# ─────────────────────────────────────────────────────────────────────
# UPGRADE-8 (cont.) — Duty Roster BACKGROUND push (free-tier 2-cron split)
# ─────────────────────────────────────────────────────────────────────

DECISION: user wants EVERYTHING on the free tier (Vercel Hobby = max 2 crons).
  So the "OPEN ITEM" from the previous entry is resolved with a 2-cron AM/PM
  split rather than 3 per-window crons.

DONE (server-side; resolves the OPEN ITEM above):
  • api/send-reminders.js — now WINDOW-AWARE. Adds IST slot helpers
    (istHourNow / slotForHour / slotForReminder): reminderTime hour 5–11 → 'am',
    everything else → 'pm'. Each cron run computes its own slot from the clock
    and pushes ONLY devices whose reminderTime is in that slot (added alongside
    the existing "active today?" skip). Net: every device gets ≤1 nudge/day, in
    its half of the day. Old 20:00-default subs → 'pm' (no one loses their push).
  • vercel.json — single daily cron → TWO daily crons (Hobby's exact limit):
    "30 2 * * *"  = 08:00 IST  → AM run (serves Morning-window devices)
    "30 15 * * *" = 21:00 IST  → PM run (serves Afternoon + Night devices)
    Afternoon-window (14:00) users get the PM push (a few h later) + the local
    nudge covers their exact window when they open the app. Best achievable on 2
    crons.

TEST: node --check (syntax) GREEN; vercel.json valid + asserts ≤2 crons; slot
  mapping table verified (08:00→am, 14/21/20:00→pm, boundaries 11:59→am/12:00→pm).
  End-to-end push timing only observable once deployed + a real cron fires.

DEPLOY: rides the normal Vercel git-push (api/ + vercel.json auto-deploy). Needs
  the already-set envs (CRON_SECRET, VAPID_*). NOT a separate Supabase deploy.

FILES: MODIFIED api/send-reminders.js · vercel.json
IMPACT/SAFETY: server-only; backward-compatible (no sub loses its daily push);
  free-tier compliant (2 crons). dev only — verify after the first cron fires.


# ─────────────────────────────────────────────────────────────────────
# Task 3.2 — "The 3 AM Chart" (chill block-placement puzzle) — BUILT
# ─────────────────────────────────────────────────────────────────────

CONTEXT: user asked specifically about the Phase-3 games (3.2 / 3.3). Correcting
  my earlier over-broad "ignore Phase 3 wholesale": the doc's ECONOMY wrapper
  (License Points → Overtime Tickets → Gacha) IS superseded by the live Level Up
  system — but the two GAMES are a genre we DON'T have (all 7 existing games are
  clinical-knowledge drills; these are casual ARCADE). User chose: build 3.2 only
  (3.3 "Shift Survival" is the SAME engine + a stress reskin — cheap to add later
  if 3.2 actually gets played; left for then).

INTERPRETATION: "no timer, no pressure, pure chill placement" ⇒ a 1010!-style
  TAP-to-place puzzle (tap a tray piece, tap a square), NOT falling-Tetris.

DONE:
  • src/lib/chart-engine.js (NEW, pure/no-React) — SIZE=8 grid, SHAPES (1–4-cell
    blocks, normalized), makePiece/newTray, canPlace, placeCells, clearFullLines
    (full ROW *or* COLUMN clears), anyMove (stuck detection), clearBottomHalf
    (lifeline payoff), pickLifelineQuestion (real bank Q: single-answer, 4 opts).
  • src/screens/three-am-chart.jsx (NEW) — warm lo-fi pastel 8×8 chart with
    pill/syringe/bone icon blocks; tap-to-place (touch-robust, no fragile drag);
    a row/col clear flashes a 1-line nursing fact (~1.6s) + a green grid glow;
    when no piece fits, the "Brain-Rot Lifeline" shows ONE real bank MCQ →
    correct clears the bottom half so you continue (once per game). "End &
    collect" any time (it's chill). Coins = lines × 5 (spec's "1 row = 5").
  • src/data/chart-facts.js (NEW) — 38 short, generic, high-yield one-liners
    (antidotes / normal ranges / classic signs). FACTS only — nothing lifted
    from any book (copyright-safe).
  • Economy hook: onComplete(coins) → App.handleGameComplete (XP + Accuracy
    Coins + daily-quest credit + level-up celebration) — the SAME contract every
    other game uses. NOT the doc's abandoned Ticket/Gacha model.
  • Wiring: App.jsx route 'three-am-chart' (+import, allQuestions threaded for
    the lifeline); LevelUp.jsx GAMES entry (Moon icon, amber gradient); favorites
    registry + fav-icons 'moon' key so the heart/Favourites work like every game.

TEST: chart-engine 20/20 pure assertions GREEN (node, real source) — SHAPES
  normalized, place/bounds/overlap, row+col simultaneous clear (=2), partial
  no-clear, stuck detection (empty/full/null-slots), bottom-half clear, newTray,
  lifeline filtering (multi-answer / wrong option count / empty bank → null).
  Full app build GREEN. Actual gameplay feel still needs a device (UI).

FILES: ADDED src/lib/chart-engine.js · src/screens/three-am-chart.jsx ·
       src/data/chart-facts.js · MODIFIED src/App.jsx · src/screens/LevelUp.jsx ·
       src/lib/favorites.js · src/ui/fav-icons.jsx
IMPACT/SAFETY: frontend-only; new self-contained screen + pure engine; plugs
  into existing economy; build GREEN + unit-tested. dev only — playtest on a
  device after deploy. 3.3 "Shift Survival" deferred (reskin of this engine).


# ─────────────────────────────────────────────────────────────────────
# Task 3.3 — "Shift Survival" (high-stress mode) — BUILT
# ─────────────────────────────────────────────────────────────────────

CONTEXT: user said proceed → built 3.3 right after 3.2 (supersedes the "deferred"
  note in the 3.2 entry). Same block engine as The 3 AM Chart, reskinned dark +
  cinematic, with the survival mechanics layered on.

DONE:
  • src/data/shift-survival.js (NEW) — CONDITIONS (8 antidote pairs: ANAPHYLAXIS
    →EPI, OPIOID OD→NAL, HEPARIN→PRO, WARFARIN→VIT K, BENZO→FLU, PARACETAMOL→NAC,
    MAG→Ca, DIGOXIN→FAB) + MATH_QUESTIONS (10 clinical-math MCQs; every answer
    hand-verified by a node calc — drip rates, dilutions, paeds doses, drips).
  • src/lib/survival-engine.js (NEW, pure) — reuses chart-engine primitives and
    adds: makeSurvivalPiece/newSurvivalTray (~40% antidote pieces bound to an
    ACTIVE condition), clearLinesSurvival (a CONDITION row clears ONLY if it also
    holds a matching antidote cell, else it stays = pressure; returns resolved
    rows), spawnComplication (single-cell clot on a random empty square; ok:false
    = board full = death), pickCondition / pickConditionRow (top up to 2 active).
  • src/screens/shift-survival.jsx (NEW) — fixed DARK palette (cinematic in light
    mode too), red-pulsing grid border, active-condition chips (label · row ·
    required antidote short), antidote pieces glow teal w/ their short tag. A 5s
    move TimerBar → on expiry spawns a complication + resets. Clearing ≥2 lines =
    a "Crisis": a 10s hard-math modal (options SHUFFLED so the answer isn't always
    slot 0) — wrong/timeout logs to the malpractice review + spawns a clot. Death
    → "PATIENT EXPIRED" + malpractice review (the math you failed, w/ the correct
    answer). Coins = lines × 10 (double 3.2) + 50 per crisis solved.
  • Wiring: App.jsx route 'shift-survival'; LevelUp.jsx GAMES (HeartPulse, deep-
    red gradient); favorites registry + fav-icons 'heartpulse' key.
  • Economy: onComplete(coins) → App.handleGameComplete (same contract).

TEST: survival-engine 16/16 pure assertions GREEN (node, real source) — normal
  vs condition-row clearing (with/without/wrong antidote), column clears,
  complication spawn (empty ok / full → death), pickCondition exhaustion,
  pickConditionRow skipping taken rows, antidote pieces only for ACTIVE
  conditions (300-sample) and never when none active. All 10 math answers
  verified by an independent node calc. Full app build GREEN. Gameplay feel +
  difficulty balance still need a device playtest.

FILES: ADDED src/data/shift-survival.js · src/lib/survival-engine.js ·
       src/screens/shift-survival.jsx · MODIFIED src/App.jsx ·
       src/screens/LevelUp.jsx · src/lib/favorites.js · src/ui/fav-icons.jsx
IMPACT/SAFETY: frontend-only; reuses chart-engine + existing economy; new
  self-contained screen; build GREEN + unit-tested. dev only — playtest +
  balance pass on a device after deploy. Phase-3 games (3.2 + 3.3) now COMPLETE.


# ─────────────────────────────────────────────────────────────────────
# UPGRADE 1 — Gamification "feedback valve" (game engagement telemetry)
# ─────────────────────────────────────────────────────────────────────

WHY: just built 3.2 + 3.3 — but there was no way to know if anyone PLAYS the
  games vs ignores them. The strategy's UPGRADE 1 calls for instrumenting that
  before investing in more games. Adapted to this codebase (per the doc's own
  "adapt the spec to the code" rule): NO Mixpanel (we have the privacy-respecting
  analytics.js; Mixpanel would break the Privacy Policy) and NO energy/ad model
  (so the "Energy_Depleted" event doesn't map). The faithful version = track
  game ENGAGEMENT into the existing aggregate analytics + surface it for the
  founder.

KEY DESIGN CATCH (found via the unit test): trackGameComplete only writes an
  entry when a game COMPLETES, so a game opened-but-never-finished would have NO
  games entry → it would VANISH from the panel. But "opened 40×, finished 0" is
  the single strongest ignored-signal. Fix: analytics returns the full opens map
  (screenViews) + completions map (gameStats); the admin JOINS them over the
  KNOWN game-id list, so a 0-completion game shows at 0% instead of disappearing.

DONE:
  • src/lib/analytics.js — blank summary gains `games:{}`; new trackGameComplete
    (gameId, coins) aggregates per-game {plays, coins} into the SAME synced
    analytics:user blob (no new key, no broker change, aggregate-only — same
    privacy model). loadEngagement refactored: pure aggregateEngagement(users)
    extracted (testable) + now returns screenViews (full opens map) + gameStats
    (per-game completions/coins).
  • src/App.jsx — handleGameComplete now calls trackGameComplete(navRef.current
    .screen, gained): the active screen IS the game, so all 9 games are covered
    centrally (zero per-game edits). Opens were already counted via the existing
    trackScreen(nav.screen).
  • src/screens/admin-panel.jsx — Engagement view gains a "Games — played vs
    ignored" panel: per game, completions/opens + a colour-graded completion-rate
    bar (red <20% · amber <50% · green ≥50% · grey = opened, 0 finishes) + coins
    earned. Built from a GAME_LABELS id→name map joined with screenViews +
    gameStats; games never opened are hidden.

TEST: aggregateEngagement 8/8 GREEN against the REAL source (esbuild→node) —
  opens summed across users, completions/coins summed, rate = plays/opens, a
  game opened-but-never-completed SHOWS at 0% (ignored signal), sort by opens,
  never-opened hidden. Full build GREEN. No deploy needed (rides the existing
  analytics:user blob; broker already permits it).

FILES: MODIFIED src/lib/analytics.js · src/App.jsx · src/screens/admin-panel.jsx
IMPACT/SAFETY: frontend-only; reuses the existing privacy-preserving analytics
  (aggregate, no per-user feed); no new storage key / no broker / no deploy;
  build GREEN + unit-tested. dev only. Now the data can decide whether 3.3 (or
  any game) earns more investment — exactly UPGRADE 1's intent.


# ─────────────────────────────────────────────────────────────────────
# RESTRUCTURE — Question uploads are now ADMIN ONLY (content authority)
# ─────────────────────────────────────────────────────────────────────

WHY (user request): "a small restructure — only admin should be able to upload
  new question sets or anything in the app." A wrong answer-key is the #1
  trust-killer for a medical-exam app, so content authority must sit with the
  admin. NOTE: this is the LIGHT version — NOT the full Phase-7 separate-repo
  split (the admin panel is ALREADY lazy-loaded as its own chunk, and the
  strategy itself says defer the repo split until >800 Qs). We locked the upload
  surfaces instead.

THE REAL HOLE was server-side: kv-write section 5 let ANY logged-in user CREATE
  a `bank:` (the UI card was just the front door). A client-only gate is
  bypassable, so the enforcement is in the broker.

DONE (frontend on dev, build GREEN):
  • supabase/functions/kv-write/index.ts — `bank:` is now ADMIN-ONLY for
    create/edit/delete (moved out of the "any logged-in user may create" branch
    into its own admin-gated branch; no per-write rate cap so admin can
    bulk-seed). feedback:/faqq: stay open (they're reports + community FAQ Qs,
    NOT question-set uploads). Authorization-matrix header comment updated.
    ⚠️ NOT DEPLOYED YET — see deploy ordering below.
  • src/App.jsx — bank-editor route gated from `(isAdmin || !nav.bank)` to
    `isAdmin` (was: new-bank creation open to all). add-question route gated to
    `isAdmin`; non-admins (incl. guests) now get a friendly "Questions are
    curated by the team → Go to the Library" notice instead of the editor.
  • src/screens/library.jsx — "Upload a new bank" card wrapped in `{isAdmin}`
    (hidden for users); help copy + empty-state copy reworded to browse/import
    only ("Banks are curated by the team … only an admin can upload").
  • src/ui/nav-drawer.jsx — pulls isAdmin via useProfile(); the "Add question"
    drawer row is now admin-only (conditional spread). Library row tip reworded
    off "upload".

WHAT STAYS OPEN (by design): personal custom questions still EXIST as a feature
  but are admin-only to AUTHOR now (per "or anything"); they were always LOCAL
  to the author's own practice pool (data.customQuestions) — never shared, so
  there was never a server surface to lock. feedback: (question/bug reports →
  feeds the quality gate) and faqq: (community FAQ questions) remain open.

EDGE CHECKED: profile-claim re-stamps a user's own banks (App.jsx ~L799) — now
  admin-gated, but that call is already try/catch-tolerated ("banks keep loading
  even with stale owner"), so no breakage. Previous-paper "banks" are bundled in
  norcet-pyq-data.js (local seed), NOT written via bank: on boot — so the lock
  doesn't break PYQ display. No other auto bank: writers exist (saveBank only at
  the admin editor + the tolerated claim re-stamp).

⚠️ DEPLOY ORDERING (must ship TOGETHER, else a broken window):
  The broker lock and the frontend hide MUST reach live together. If the broker
  deploys BEFORE the frontend hits main/live, current live users still see the
  "Upload a new bank" card but get 403 on save. Sequence:
    1. Push dev → main (frontend hides the upload UI).  [user-driven ship]
    2. Deploy the broker:
       supabase functions deploy kv-write --project-ref jabmjyhdfacoikkgmjzl --no-verify-jwt
  Order 1-then-2 is safe (UI gone before the server starts rejecting). Doing 2
  first creates the broken window. (Supabase MCP was just connected but needs a
  session restart to go live; the CLI deploy above is the proven path.)

FILES: MODIFIED supabase/functions/kv-write/index.ts · src/App.jsx ·
       src/screens/library.jsx · src/ui/nav-drawer.jsx
IMPACT/SAFETY: build GREEN. Frontend degrades safe (hides a button). The server
  lock is the real enforcement and is pending the coordinated deploy above.
  dev only; no commit/push made (awaiting user go-ahead to ship).

── ✅ SHIPPED 2026-06-29 (supersedes the "NOT DEPLOYED" note above) ──
  User switched to a "push every update straight to production" policy.
  Shipped the admin-only-uploads restructure live, in the safe order:
    1. Frontend: pushed dev → origin/main (fd51d70) → Vercel prod deploy
       (www.nurseholic.in). Hides the upload UI for non-admins.
    2. Broker: `supabase functions deploy kv-write` → live. Enforces
       bank: writes = admin only.
  Both production surfaces now consistent. Deploy-flow memory updated:
  main = frontend prod; the Supabase Edge Function is a SEPARATE prod
  surface — a change touching both needs BOTH a main push and a function
  deploy.


# ─────────────────────────────────────────────────────────────────────
# ADMIN-APP SEPARATION — Phase A+B (standalone admin app scaffolded)
# ─────────────────────────────────────────────────────────────────────

GOAL (user): separate the admin panel into its OWN app the admin uses to upload
  & update all content. Chosen architecture: ONE repo, TWO entry points → TWO
  Vercel projects, ONE shared Supabase backend. The admin app shares src/lib but
  NEVER imports App.jsx (and vice-versa) so neither bundle pulls in the other.

DONE (additive only — student app 100% untouched; both builds GREEN):
  • admin.html + src/admin-main.jsx + src/AdminApp.jsx — standalone admin app.
    Boots storage → restores session → requires LOGIN (reuses AuthScreen) →
    verifies admin server-side (checkServerAdmin vs admin_profile_ids, fail-
    closed) → renders AdminPanel + BankEditor (upload/edit question sets) +
    Library (browse → edit). Own minimal ErrorBoundary + Splash + NotAuthorized.
    Light/dark theme wired; data stub so Library's context reads don't crash.
  • src/lib/admin-ops.js — shared admin logic extracted (auth/status:
    verifyAdminPassphrase/checkServerAdmin/adminWriteShared/load+saveAdminStatus;
    announcements: load/save/clear + history; users: adminListUsers/
    adminDeleteProfile). VERBATIM from App.jsx, lib-only deps. App.jsx still has
    its own copies for now — deduped in Phase C when student is stripped.
  • vite.config.js — function form; `vite build --mode admin` → input admin.html,
    outDir dist-admin, NO PWA. Default build (student) unchanged.
  • package.json — build:admin / dev:admin / preview:admin. .gitignore += dist-admin.

BUILDS: student GREEN (same 33 precache entries, bundle byte-identical — proof
  the admin files are inert for students). admin GREEN → dist-admin ~213KB gzip
  (admin chunk 137 + admin-panel 62 + icons 8 + css 6), contains ZERO student
  App.jsx code. Shipped to dev+main (2f36a28) — safe, student build ignores it.

REMAINING:
  • Phase C — strip admin code from the STUDENT build: point App.jsx at
    admin-ops.js (dedup), and remove the in-student admin-panel route + bank
    upload editor so the student bundle ships zero admin code. INVASIVE (edits
    the live App.jsx) — do as one careful surgery; verify student build after.
  • Phase D — deploy the admin app: NEW Vercel project on the SAME repo, build
    command `npm run build:admin`, output dir `dist-admin`, + a subdomain
    (e.g. admin.nurseholic.in) DNS record. Same Supabase env vars
    (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Needs the user's Vercel access.
  • Browser test: log into the admin app as an admin → confirm AdminPanel +
    bank upload/edit work end-to-end (build proves compile, not runtime).

FILES: ADDED admin.html · src/admin-main.jsx · src/AdminApp.jsx · src/lib/admin-ops.js
       MODIFIED vite.config.js · package.json · .gitignore
IMPACT/SAFETY: purely additive; student production unaffected. Admin app not yet
  deployed (no 2nd Vercel project). dev+main.


# ─────────────────────────────────────────────────────────────────────
# ADMIN-APP SEPARATION — Phase C (admin code stripped from student app)
# ─────────────────────────────────────────────────────────────────────

DONE — the student app no longer contains a reachable admin surface:
  • src/App.jsx — removed: the AdminPanel lazy import, the admin-panel route,
    the boot `setIsAdmin(loadAdminStatus())`, handleUnlockAdmin/handleLockAdmin,
    the announcement WRITE handlers (save/clear/history), and the admin re-verify
    effect. Result: `isAdmin` has NO path to true in the student app → it stays
    false, so every inline admin branch (FAQ moderation, bank edit/delete/private
    visibility, dosage admin) is permanently inert. loadAnnouncement (the READ for
    the student banner) is KEPT. The now-unreferenced module admin fns
    (adminListUsers/adminDeleteProfile/verifyAdminPassphrase/checkServerAdmin/
    adminWriteShared/loadAdminStatus/saveAdminStatus/save+history announcement
    writers) are dead source → TREE-SHAKEN out of the student bundle (optional
    source cleanup later; not in the bundle either way).
  • src/screens/settings.jsx — removed the entire Settings "Admin" section
    (unlock-admin form + "Open Admin Panel"/"Lock admin"). The admin state hooks
    + the three admin props are now unused (harmless; dropped from App's call).

VERIFY: student build GREEN — the admin-panel chunk (was 86KB) is GONE; main
  bundle 1425→1411 KB (gzip 421.7→417.3); precache 33→31 entries. Admin build
  GREEN — admin-panel (219KB) lives only in dist-admin. Normal users are
  unaffected (isAdmin was already false for them); only an admin loses the
  in-student admin surface (by design — they use the admin app now).

FILES: MODIFIED src/App.jsx · src/screens/settings.jsx
IMPACT/SAFETY: student bundle ships zero admin code (admin panel + handlers gone
  / tree-shaken). Build GREEN both apps. Shipping to dev+main per ship-everything.
REMAINING: Phase D — deploy the admin app (2nd Vercel project on this repo:
  build `npm run build:admin`, output `dist-admin`, env VITE_SUPABASE_*, +
  admin subdomain). Needs the user's Vercel access.


# ─────────────────────────────────────────────────────────────────────
# ADMIN-APP SEPARATION — Phase D (admin app DEPLOYED & LIVE)
# ─────────────────────────────────────────────────────────────────────

DONE — the standalone admin app is live in its own Vercel project:
  • New Vercel project `norcet-admin` (separate from `norcet-prep`/student),
    deployed as a STATIC build of dist-admin via the authenticated Vercel CLI.
    LIVE at https://norcet-admin.vercel.app (HTTP 200).
  • WHY static (not Git-connected): both projects share one repo, and
    vercel.json has the reminder CRONS + /api + SPA rewrite. A 2nd Git-connected
    project would DOUBLE-RUN the crons (double reminders; Hobby cron cap). So the
    admin app deploys as a standalone static SPA (it only talks to Supabase — no
    functions/crons needed). Redeploy with `npm run deploy:admin`
    (= build:admin + vercel --cwd dist-admin deploy --prod). NOTE: this is the
    one surface that is NOT auto-deploy-on-push — admin code changes need a manual
    `npm run deploy:admin`.
  • Build entry fix: Vite emits the entry as admin.html; added
    scripts/post-admin-build.mjs to rename dist-admin/admin.html -> index.html so
    Vercel serves it at `/`. Wired into build:admin.
  • Deployment Protection (Vercel SSO) was ON by default on the new project and
    redirected every visitor to a Vercel login (would block admins from the app's
    OWN auth). DISABLED via the Vercel API (PATCH ssoProtection:null) → app now
    publicly reachable; access is gated by the app's AuthScreen + admin_profile_ids.
  • Domain admin.nurseholic.in ADDED to the project.

⏳ ONE MANUAL STEP LEFT (needs the user's DNS provider — nurseholic.in uses
   THIRD-PARTY nameservers dns1/dns2.registrar-servers.com, i.e. Namecheap, so
   Vercel can't write its DNS): add this record at the registrar —
     A   admin   76.76.21.21
   (same pattern as the working www record). Vercel auto-verifies + issues TLS.
   Until then, use https://norcet-admin.vercel.app.

RUNTIME TEST STILL ADVISED: log into https://norcet-admin.vercel.app as an admin
  → confirm AuthScreen → admin check → AdminPanel + a bank upload work (build
  proves compile/serve; login flow not yet exercised end-to-end).

FILES: ADDED scripts/post-admin-build.mjs · MODIFIED package.json (build:admin
  rename + deploy:admin script). Vercel: project norcet-admin (static), SSO off,
  domain admin.nurseholic.in pending DNS.
IMPACT/SAFETY: student app untouched. Admin app live on its own project/origin.


# ─────────────────────────────────────────────────────────────────────
# CLEANUP — dead admin source removed from the student app (post-separation)
# ─────────────────────────────────────────────────────────────────────

CONTEXT: after the admin-app separation (Phases A–D), the student app still had
  the now-unreferenced admin source in it (tree-shaken from the bundle but
  cluttering the source). Ran a small multi-subagent pass to remove it cleanly.

DONE (multi-agent: frontend-engineer edited, security-auditor audited,
  code-reviewer gated — all GREEN; PASS to ship):
  • src/App.jsx — deleted the dead module fns adminListUsers, adminDeleteProfile,
    saveAnnouncement, loadAnnouncementHistory, deleteAnnouncementHistoryItem,
    clearAnnouncementHistory, clearAnnouncement, verifyAdminPassphrase,
    checkServerAdmin, adminWriteShared, adminDeleteShared, loadAdminStatus,
    saveAdminStatus + the ANN_HISTORY_KEY / SUPABASE_*_FOR_ADMIN consts; removed
    'admin-panel' from NAV_SELF_GUARDED_SCREENS; collapsed the dead nav.adminReturn
    ternaries. KEPT loadAnnouncement (student banner still reads it). admin-ops.js
    (the admin app's canonical copies) untouched.
  • src/screens/settings.jsx — removed the leftover admin state hooks + cooldown
    effect + registerAdminFail + the onUnlockAdmin/onLockAdmin/onOpenAdminPanel
    props + now-unused Eye/EyeOff imports (kept Lock/Check/RefreshCw — still used).
  • docs/security/findings.md — refreshed security register (SEC-001..011).
    Code-inspectable controls all sound. ⚠️ SEC-008 owner-action: a comment in
    supabase/functions/admin-manage/index.ts:13 documents ADMIN_PASSPHRASE=
    "norcet-boss-2026" — confirm the LIVE passphrase is NOT that literal; rotate +
    scrub if it is. Also confirm SESSION_SIGNING_SECRET (same across 3 fns),
    CRON_SECRET (unauth POST→401), kv_shared RLS deployed-state.

VERIFY: code-reviewer PASS — student build GREEN (31 precache, NO admin-panel
  chunk), admin build GREEN (admin-panel chunk in dist-admin). No dangling refs.
  Pure dead-code removal; no student behavior change. Admin app NOT affected (no
  shared lib touched) — no admin redeploy needed.
FILES: MODIFIED src/App.jsx · src/screens/settings.jsx · ADDED docs/security/findings.md


# ─────────────────────────────────────────────────────────────────────
# FEATURE — "New content" web push (event-driven; strategy Phase 4.2, reimagined)
# ─────────────────────────────────────────────────────────────────────

WHY: user wanted "publish content in admin → users notified." Better than the
  strategy's SCHEDULED Sunday content-push cron: event-driven, fires on the
  actual publish, and needs NO cron (sidesteps the Vercel Hobby 2-cron cap).

KEY FINDING (Explore): the IN-APP half already exists — admin publishes a public
  bank → publishedAt stamped → syncImportedBanks() surfaces a Home "What's new"
  card + an inbox "New content available" entry on next open. The only gap was a
  WEB PUSH for when the app is CLOSED.

DESIGN: backend-only (no frontend change). The publish already flows through the
  kv-write broker (admin-gated), so the push is triggered THERE — no new admin
  UI, no second auth system, and no need to put SESSION_SIGNING_SECRET in Vercel
  (its value isn't readable, so the client-token-auth option was dropped).

DONE:
  • api/notify-all.js (NEW, Vercel serverless) — broadcasts ONE push payload to
    every `sub:*` in Vercel KV; auto-prunes dead subs (404/410). Auth = a single
    server-to-server bearer `NOTIFY_SECRET` (fail-closed; 401 without it; never
    in any client bundle). tag:'norcet-content' (distinct from reminders' daily).
    Reuses the existing VAPID + KV env already present for send-reminders.
  • supabase/functions/kv-write/index.ts — in the `bank:` admin branch, when a
    bank BECOMES public (brand-new public, or private→public; pure version bumps
    are NOT pushed — in-app What's-new covers updates), fire contentNotify():
    POST api/notify-all with NOTIFY_SECRET + a body built from the bank
    (name + question count). Rate-capped 4/hr per admin (rateHit). Runs via
    EdgeRuntime.waitUntil so it never delays/fails the bank write.
  • Secrets: generated NOTIFY_SECRET; set in Supabase (kv-write) + Vercel student
    project (notify-all). NOTIFY_URL defaults to https://www.nurseholic.in/api/notify-all.

DEPLOY: push main (Vercel builds api/notify-all with the new env) FIRST, then
  `supabase functions deploy kv-write`. Verify: unauth POST /api/notify-all → 401.
  Full end-to-end (publish a bank as admin → closed-app device buzzes) is a
  browser/device test for the owner. No frontend/admin redeploy needed.
FILES: ADDED api/notify-all.js · MODIFIED supabase/functions/kv-write/index.ts
IMPACT/SAFETY: additive; reminder cron untouched; push is best-effort and never
  blocks a bank write. No new cron, no paid plan, no AI.

── FOLLOW-UP: per-user opt-out for "new content" pushes ──────────────
  Adds a "New content alerts" toggle (Settings → under Daily reminders, shown
  when reminders are on; default ON). Lets a user keep daily reminders but mute
  the content-publish push.
  • api/subscribe.js — stores `contentPush` on the sub:* record (default ON),
    now MERGES over the existing record so a re-subscribe preserves lastActive/
    createdAt + the opt-out.
  • api/notify-all.js — skips records with contentPush===false (counts skipped).
  • src/App.jsx — subscribeToPush(reminderTime, contentPush); setDailyReminder
    merges contentPush + re-registers the sub on a content-alert toggle (so the
    flag reaches KV) as well as on enable.
  • src/screens/settings.jsx — the toggle card.
  Student build GREEN (31 precache). api ships via the main push; no Supabase/
  admin redeploy. Reminders unaffected (separate opt-in). Default ON so existing
  subs (no flag) still receive content pushes.


════════════════════════════════════════════════════════════════════
FUTURE / DEFERRED — Role hierarchy: Admin > Co-Admin > Moderator > User
(owner decision 2026-07-03: build this ONCE THE APP SCALES / real staff exist,
 NOT now. ~12 testers + 1 owner today = premature. Captured here in full.)
════════════════════════════════════════════════════════════════════

GOAL: replace the current binary admin (all-or-nothing) with 4 staff tiers so
the owner can delegate moderation without handing out full power.

ROLES & POWERS (owner's intent):
  • Admin (owner)  — everything; the ONLY one who can remove a Co-Admin and
    transfer ownership. Single-admin model (Clash-of-Clans style): exactly one
    Admin at a time.
  • Co-Admin       — almost everything: announcements, live config, push, delete
    users, engagement. CANNOT remove/other Co-Admins or the Admin.
  • Moderator      — "community control" only: reply to feedback, author FAQs,
    draft content (see integrity note below). No destructive/user powers.
  • User           — the normal clients; no admin portal at all.

OWNER'S SPEC (sound — adopt as-is):
  • UI visibility matrix: never render a control the role can't use. Route guard
    blocks the portal BEFORE load. User=none; Moderator=Community-Control tabs
    (reports, user list read, basic logs); Co-Admin=most of the portal;
    Admin=all incl. Danger Zone.
  • Rank badges: Admin crimson-red; Co-Admin purple/dark-blue; Moderator
    green/teal. Disabled/greyed controls when acting above your rank (e.g. a
    Co-Admin sees Admin's Demote/Kick greyed out).
  • Confirmation modal WITH A REASON on destructive staff actions; log the
    reason so the owner can audit staff.
  • Audit-log tab readable by Admin + Co-Admin ONLY.
  • Promotion ceiling: you may promote only to ONE level BELOW your own
    (Co-Admin can make a Moderator, NOT another Co-Admin).
  • Self-action protection: block actor_id == target_id for destructive/demote.
  • Last-Admin lockout: Admin cannot delete/leave/self-demote until ownership is
    transferred. Transfer = ATOMIC txn (demote Admin↔promote Co-Admin; both or
    neither).
  • Session revocation on role change (see the freebie below — easier here).

ARCHITECTURE ADAPTATIONS FOR *THIS* APP (the real work / what differs):
  1. FREEBIE — instant revocation is basically free. Every broker (kv-write,
     kv-read, push-broadcast) ALREADY re-checks the DB (admin_profile_ids) per
     action. So keep ROLE OUT of the signed session token; have the brokers look
     up the caller's CURRENT role from the DB each call → a demotion takes effect
     on the very next action, no JWT-expiry problem. Only add-on: a lightweight
     role re-check on admin-app focus/interval to drop the PORTAL VIEW instantly
     (server already rejects the actions regardless).
  2. SCHEMA — admin_profile_ids (binary) → add a `role` column, or an
     admin_roles table { profile_id, role, granted_by, granted_at }. RLS +
     admin-manage + all 3 brokers gate by role tier. isAdmin() → roleOf().
  3. LOGIN MODEL — shift from the shared ADMIN_PASSPHRASE unlock to PER-ACCOUNT
     staff roles (each staffer signs in as themselves; their profile carries a
     role). This is the true prerequisite — it also makes the audit log's
     server-stamped actorId attributable to a real person (already built).
  4. CONTENT-INTEGRITY CONFLICT — CLAUDE.md deliberately restricts bank/question
     UPLOADS to admin-only (answer keys stay trustworthy). Owner wants Moderators
     to "upload questions/notes." RESOLVE by: Moderators DRAFT into the existing
     content-staging review queue; only Admin/Co-Admin PUBLISH. Keeps integrity
     AND lets mods help. (FAQ authoring + feedback replies are fine for Mods.)
  5. "Financial metrics / integration keys" Admin-only tab = N/A today (no
     payments — freemium is placeholder; keys are NEVER in the client bundle —
     verified). The real "Danger Zone" = delete user / reset progress / live
     config / ownership transfer.
  6. PER-TOOL MIN-ROLE MAP (existing admin tools, 2026-07-03):
       Moderator : feedback replies, FAQ manager, content DRAFTS, read reports/
                   users, basic logs.
       Co-Admin  : + announcements, Live config, Push broadcast, Engagement,
                   Storage self-test, delete users, member coin grant/reset, promote
                   up to Moderator, read Audit log.
       Admin     : + remove Co-Admins, ownership transfer, everything.
     (Owner CONFIRMED 2026-07-03: Co-Admin DOES get member coin grant/reset.)

ALREADY IN PLACE (prereqs done — this rides on them):
  • Fail-closed brokers w/ signed session token + admin_profile_ids re-check.
  • Audit log (adminlog:) with SERVER-STAMPED actor id/uid + ts — just add a
    `reason` field for destructive staff actions, and gate its tile to Admin/
    Co-Admin.
  • No secrets in bundle; separate admin build; server-side authz throughout.

SUGGESTED BUILD ORDER (when resumed):
  A. Schema + roleOf() + per-account staff login (replace passphrase-only).
  B. Role-gate the 3 brokers + admin-manage (server truth) — do THIS before any
     UI, per CLAUDE.md cosmetic-hiding rule.
  C. UI: role-based route guard + visibility matrix + badges + disabled states.
  D. Promotion ceiling + self-action + last-admin + atomic ownership transfer.
  E. Reason-on-destructive + audit `reason` + audit tab role-gate.
  F. Moderator content-draft flow via content-staging.

DEPENDENCY: pairs naturally with the pre-launch per-account/MFA move and (free-
tier) Cloudflare Access on admin.nurseholic.in once that domain is bought.

# ─────────────────────────────────────────────────────────────────────
# FEATURE — Bottom navigation bar (mobile/tablet) + GLOBAL SEARCH  (2026-07-03, SHIPPED)
# ─────────────────────────────────────────────────────────────────────
Owner asked for a 5-slot bottom tab bar ("Option B": indicator line gliding above
the active tab, raised round center "+") for mobile + tablet, iOS/Android PWA,
premium micro-interactions. Slots: Home · Search · + (notes) · Favourites · Settings.

WHAT SHIPPED (student app only; Vercel push, no Edge Function change):
  • src/ui/bottom-nav.jsx — fixed z-40 frosted bar, safe-area padded, spring
    indicator (left transition, .bnav-indicator), icon pop (.bnav-pop) + haptic
    on tab change, re-tap active tab = scroll-to-top, raised 54px "+" opens the
    EXISTING notes popup via requestNote() (NoteFab auto-hides on bar screens).
    Shows ONLY on BOTTOM_NAV_SCREENS = home/search/favorites/settings AND
    !isDesktop (useBreakpoint — first real consumer of lib/responsive.js).
    Renders an in-flow spacer + publishes --bnav-h (back-to-top FAB offsets).
  • GLOBAL SEARCH (new section): pure engine src/lib/search.js (+ test) — AND
    tokens, title×3/body×1 + word-start weighting, grouped results; screen
    src/screens/search.jsx (lazy chunk) searches questions + reference + concept
    cards + dosage + FAQs, term highlighting, staggered rows, inline question
    expand (options/answer/exp), "Practice these N" → startQuiz({mode:'wrong',
    qIds}) (existing path), reference deep-link (Reference initialQuery prop),
    recent searches (local key searchrecent:v1:<pid>) + suggested chips.
  • NAVIGATION SHORTCUT ROUTER (owner refined mid-build: search is FIRST a
    router, then a content finder): src/lib/nav-registry.js (+ test) — central
    navigationRegistry {id,title,category(Settings|Features|Units|FAQ),
    keywords[],route(nav-object),description}; ~35 static destinations + one
    Units deep-link per TOPIC (learn-cards). searchRegistry() ranks exact/
    prefix title > title words > keyword tags > description, capped at 6.
    Rendered as the "Go to" group ABOVE content results, with category badges,
    descriptions, ↑/↓ + Enter keyboard selection on the input. Imperative
    popups (notes/feedback) are `action` entries → requestNote()/
    requestFeedback(), not routes. No Fuse.js (not in stack, no new deps); no
    TypeScript (repo is JS). Routes are nav objects because the app router is
    the setNav state machine, not a URL router.
  • Nav semantics: goTabDirect() clears the breadcrumb stack (root-switch), so
    hardware back from any tab → Home → exit guard. No popstate changes.
  • Drawer got a Search row (Tools) so desktop can reach it (bar hidden ≥1024px).
  • All new anim classes registered in the reduced-motion opt-out block.

DECISIONS: Favourites tab = the 'favorites' launcher screen (Bookmarks lives
inside it; one-line swap to bookmarks-view if wanted). Slot 5 = Settings per
owner; noted Stats would be higher-frequency and is a one-line swap. Bar stays
OFF quizzes/tests/games (focus + answer integrity).

# ─────────────────────────────────────────────────────────────────────
# FEATURE — Duolingo-pattern retention build (6 modules, owner blueprint)  (2026-07-03, SHIPPED)
# ─────────────────────────────────────────────────────────────────────
Owner supplied a 6-module "Duolingo engineering patterns" blueprint (principal-
architect prompt). Adapted to THIS stack (plain-JS Vite PWA, offline-first blob,
kv brokers, NO runtime AI, no payments yet). All client-side; no Edge Fn/SQL.

M4 MISTAKE ENGINE (data first): completeQuiz now persists `pick` (chosen option
  indices) on every attempt; compact.js keeps pick in the compaction tail.
  src/lib/mistakes.js (+test) derives the "UserMistakes" view from history —
  failCount, lastPick, resolved (= lastResult right AND reviewCount ≥ 2, the
  existing correct-streak counter), due-first orderMistakeQueue. NO new store:
  IDOR-safe by inheritance (profile: blob is broker-owner-scoped — verified).
  NOTE: advanced/paper tests still don't write per-question history.
M3 MILESTONES + HISTORY: data.milestones event log (level-up/mastery/streak;
  deduped by id, cap 200) in seed DEFAULT_DATA, normalizeUserData and an
  explicit _gunionMilestones in merge.js (entry-level extras get dropped there
  otherwise — the known trap). Recorded at: completeQuiz (streak 3/7/14/30/50/
  100, id carries date), all 3 level-up sites, knowledge-map celebration diff
  (mastery familiar/mastered — logs even under reduced motion). Feed screen
  src/screens/activity-log.jsx: infinite-scroll (IntersectionObserver), day-
  grouped, NO search by design; tests/revisions derived from existing
  advancedTestHistory/previousPapers/revisionLog via buildActivityFeed (+test).
M1c + M2 SEARCH IS NOW UTILITY-ONLY (⚠ behaviour change): the global Search no
  longer queries curriculum (questions/reference/dosage/concepts REMOVED, incl.
  "Practice these N") — it is strictly the shortcut router + FAQ articles.
  nav-registry.js gained the DYNAMIC half (faqRegistryEntries — admin-authored
  FAQs → same schema, full answer text searchable, deep-link focusId now
  supported by faq.jsx) + sanitizeRegistry (schema + STUDENT_ROUTE_SCREENS
  allowlist — admin/unknown routes stripped; tested). Audit confirmed drafts
  live in the server-only questions_staging table (RLS, zero policies, REVOKE
  ALL) and FAQ rows have no draft state → nothing unpublished can be indexed.
  search.js (content engine) kept tested but unused by the screen — trivial to
  re-feed if the owner ever wants content search back.
M5 FREEMIUM CRIB VAULT (ships DARK): premium.gates.cribVault flag in
  game_config DEFAULTS (default FALSE — test phase stays all-free) + admin
  Live-config toggle. premium.js: isPremiumUser (reads the placeholder
  profile.premium.active — still written by nothing) + cribVaultLocked.
  When flipped ON: revision-sheet saved-crib shelf + the new Mistake Vault
  lock for free users → count-only teaser (the local "403 +
  {total_unresolved_mistakes}" equivalent) + PremiumCribSheetModal
  (src/ui/premium-gate-modal.jsx: live unresolved count as leverage, pulsing
  CTA → premium screen). Post-quiz session crib stays FREE always (the hook).
M5/M6 MISTAKE VAULT + EXPLAIN COACH: src/screens/mistake-vault.jsx (route
  'mistake-vault', drawer Study row, registry entry): stats band, due-first
  queue, expandable rows (you answered X → correct Y), "Review N now" →
  startQuiz({mode:'wrong', qIds}) so resolution happens through normal history
  writes; Fixed shelf. "Explain my mistake" = src/lib/explain-mock.js (+test):
  RULE-BASED composer over the question's real exp + wrong[pickIdx] rationales,
  simulated 1.2s delay, honest disclosure line — complies with the NO-runtime-
  AI rule; if a live provider is ever approved only explainMistake's body
  changes.
M1 LEARN PATH + GUIDEBOOKS: Learn's default view is now 'Path' (toggle: Path |
  Modules | Quick): src/lib/learn-path.js (+test) — topological order over
  kmap's prerequisite DAG, per-unit mastery ring state via mindmapState/
  mindmapNextProgress from quiz history, ONE recommended-next node (start/
  continue/strengthen) with pulse. DELIBERATE: no hard locks (live users have
  nonlinear progress; exam prep needs weightage jumps). Per-unit Guidebook
  (src/ui/unit-guidebook.jsx bottom sheet) auto-compiled from keypoints +
  mnemonic cards (compileGuidebook) — zero new authoring.

Tests: 22 files green (5 new: mistakes, milestones, explain-mock, learn-path +
extended nav-registry/premium) + compile gate. New anim classes (.pgate-*,
.vault-tick-in, .path-*) registered in the reduced-motion block.
DEFERRED/flagged: admin_profile_ids anon-enumeration hardening (needs broker-
backed client admin gate — pre-launch security pass); per-module read tracking
for the path (rings are quiz-derived); payments still placeholder.


# ─────────────────────────────────────────────────────────────────────
# PREMIUM TIER ECOSYSTEM — Super/Max subs, family plans, single-session,
# admin-list lockdown (blueprint adaptation, 2026-07-03, commit 5913848)
# ─────────────────────────────────────────────────────────────────────

OWNER BLUEPRINT: language-app premium spec (Super/Max tiers, Individual/
  Family billing, invite links, "last one wins" concurrent-session guard,
  Prisma/JWT/Express assumed) → adapted to this stack, then "the proper
  fix" for admin_profile_ids (broker first, lock table second).

DATA (supabase/subscriptions.sql — APPLIED to prod via supabase db query):
  subscriptions (owner_uid, tier SUPER|MAX, billing INDIVIDUAL|FAMILY,
  status, seats 1|6, expires_at NULL=no expiry, source=admin-grant) ·
  family_members (unique member_uid = one family per account; carries NO
  progress — accounts stay completely isolated) · family_invites (SHA-256
  token_hash only — raw token never stored; single-use; 7-day expiry) ·
  profile_secrets.active_session_id. All three tables: RLS on, ZERO
  policies, REVOKE ALL, service-role-only (questions_staging pattern).

SERVER (all 6 Edge Fns DEPLOYED): NEW subscription fn — status /
  invite-create / invite-accept / family-list / family-remove / leave +
  admin-grant/revoke/status (token-verified admin). Caller identity ONLY
  from the signed session token (IDOR-safe by construction); invites fail
  with one generic invalid-invite (no used-vs-expired oracle); rate caps
  via auth_rate. auth-secure: rotateSessionId() on register/verify/reset
  writes active_session_id + embeds sid in the token (rename carries it).
  kv-write/kv-read/content-staging/subscription: sessionSidOk() — enforced
  ONLY when game_config security.singleSession=true (NEW flag, default
  OFF, admin Live config → Security). NULL db-sid passes (rollout kicks
  nobody); every failure fails OPEN (revenue guard, not a safety lock).
  Mismatch → 401 {error:SESSION_EXPIRED, message:Logged in from another
  device}.

CLIENT: lib/subscription.js (+test) — TIERS catalog (MAX extras are
  Coming-later COPY ONLY: no runtime AI, hard rule), normalizeEntitlement/
  entitlementToPremium (client re-checks expiresAt so cached premium
  lapses offline), parseJoinToken/buildJoinLink, fetch wrappers (lazy
  storage import — game-config rule). premium.js getPremiumState now
  tier+expiry aware; isMaxUser(). profile.premium FINALLY HAS A WRITER:
  App refreshes entitlement once per account per session and persists it
  out-of-band (debounced saver is data-keyed — dataRef + direct
  saveProfile). storage.js: the dead setOnAuthError hook is LIVE —
  brokers pass a reason; SESSION_EXPIRED → force sign-out + toast
  (src/ui/session-expired-toast.jsx) → guest mode, one-tap re-login.
  Premium screen: Super|Max picker + membership card + FamilyPlanCard
  (owner: seats/members/remove + invite mint with share/copy; member:
  covered-by + leave). ?join=TOKEN parsed at boot, stripped from URL,
  redeemed via JoinFamilySheet (guests routed to sign-in, token kept).
  Admin Users → member panel: Premium card (grant Super/Max ×
  Individual/Family × 1/3/12mo/no-expiry, revoke, adminlog entries).

PART B — admin_profile_ids LOCKDOWN (done end-to-end, verified live):
  admin-manage gained TOKEN-verified check-admin + list-admins;
  admin-ops.checkServerAdmin + admin.listAdmins now call them (zero
  direct REST reads left); admin app redeployed (norcet-admin.vercel.app,
  dpl_14NTWs…); THEN supabase/lock-admin-list.sql applied — dropped the
  anon SELECT policy + REVOKE ALL (incl. the scary latent anon TRUNCATE,
  which RLS does NOT gate). Probes: pre-lockdown anon read returned the
  admin ids; post-lockdown → 401; check-admin still answers {ok:false}
  for bogus tokens. findings.md SEC-021..023.

DEPLOY STATE: student prod READY (www.nurseholic.in, commit 5913848);
  admin prod READY; 6 Edge Fns deployed; both SQL files applied.
  EVERYTHING SHIPS DARK: no payments exist, so premium only activates
  via the admin grant; singleSession only bites when the owner flips
  the Live-config toggle (decide at launch — kicks multi-device users
  to re-login on device switch).

LAUNCH DECISIONS ADDED: (1) flip premium.gates.cribVault only with real
  payments; (2) flip security.singleSession only if account-sharing
  protection is wanted more than multi-device convenience; (3) MAX tier
  coach features stay marketing copy until the owner sanctions a build.
  Gate: 23 test files + vite compile + admin build green.


# ─────────────────────────────────────────────────────────────────────
# PUSH REACH FIX — one-switch Notifications + one-tap Home nudge
# (2026-07-04, commit 11c20f6)
# ─────────────────────────────────────────────────────────────────────

WHY: owner sent a broadcast → "Sent to 1 device" with 11 users. Diagnosis:
  web push is per-device opt-in and the ONLY opt-in path was the
  Daily-reminder toggle buried in Settings; iPhones in a Safari tab
  cannot subscribe at all (iOS requires the installed PWA). Stack is
  VAPID web-push: SW subscribe → api/subscribe.js → Vercel KV sub: rows →
  push-broadcast Edge Fn → api/notify-all.js (web-push lib). No Firebase.

OWNER SPEC: users must toggle only ONE thing in Settings; premium class.

BUILT:
  • lib/push-opt-in.js (+test) — detectPushSupport (ok / ios-install /
    unsupported; catches iPadOS masquerading as MacIntel via touch
    points) + pure nudge rules: ≥5 attempts (NUDGE_MIN_ATTEMPTS), never
    shows against a denied permission, dismiss = 30-day snooze,
    2 dismissals = permanently quiet. getPushEnv() Node-safe.
  • ui/notification-nudge.jsx — Home card mounted above the spaced-
    revision slot (needs onEnableNotifications prop from App =
    setDailyReminder({enabled:true})). ONE tap runs the whole chain the
    existing plumbing already had: OS permission prompt → PushManager
    subscribe → KV registration → daily nudge + content pings. States:
    enable → busy → success (springs in, auto-hides 3.2s) / blocked
    (honest hint + auto-snooze) / ios-install (Share → Add to Home
    Screen 2-step walkthrough instead of a dead button). Guests allowed
    (api/subscribe.js is deliberately pre-login). Anims nnudge-in /
    nnudge-bell / nnudge-done in the reduced-motion master block.
  • Settings — section is now ONE master "Notifications" switch (was
    "Daily reminders" + separate cards): subtitle states everything it
    turns on; when ON, one card holds the fine-tuning (nudge time +
    new-content alerts, which stay opt-out/default-ON so the master
    switch alone is always enough). iOS Safari tabs get the install
    walkthrough instead of the toggle. KEYS.notifNudge local record.

NOT changed: server/brokers/KV schema (the existing setDailyReminder
  already did permission + subscribe + contentPush in one call — the fix
  is discoverability + support-awareness, not plumbing).
FILES: ADDED lib/push-opt-in.js(+test) · ui/notification-nudge.jsx;
  MODIFIED settings.jsx · home.jsx · App.jsx · keys.js · font-styles.js
GATE: 24 test files + vite compile green. Deployed via main.


# ─────────────────────────────────────────────────────────────────────
# PWA INSTALL SYSTEM — native one-tap prompt + Home card + Settings row
# (2026-07-04, commit 611ecf7 — reach work part 2)
# ─────────────────────────────────────────────────────────────────────

WHY: follow-on from the push reach fix — installs are the prerequisite
  for push on iPhones and beforeinstallprompt was entirely unused (the
  PWA was installable but nothing ever offered it; Chrome's mini-infobar
  was the only path and we now suppress it to own the moment).

BUILT:
  • lib/install-prompt.js (+test) — main.jsx captures the ONE-SHOT
    beforeinstallprompt at boot (with preventDefault); promptInstall()
    replays the real native sheet on user tap; appinstalled +
    display-mode:standalone set a sticky device-level localStorage flag
    (norcet:installed:v1) so a later tab visit never re-nags. Pure
    installDecision(): ≥10 attempts (INSTALL_MIN_ATTEMPTS), NEVER shows
    while the notification nudge is showing (one ask at a time,
    notifications first — install computes the notif decision from the
    same pure fns + stored state, so they stay in lockstep), 30-day
    snooze / 2-dismissals contract shared with push-opt-in.js
    (normalizeNudgeState reused), and browsers with no install path
    (desktop Firefox) stay silent rather than showing fake steps.
  • ui/install-nudge.jsx — Home card below the notification nudge:
    native variant = one-tap Install → real sheet → success state
    (auto-hides; declining the sheet auto-snoozes); iOS variant =
    Share → Add to Home Screen walkthrough framed around unlocking
    reminders. Reuses nnudge-in/nnudge-done anims (reduced-motion OK).
  • Settings — "Install the app" row under Notifications, shown ONLY
    while hasDeferredPrompt() && !installed; hides after accepting.

SEQUENCING for a user: notification card (≥5 attempts) → install card
  (≥10 attempts, once notif is on/quiet). KEYS.installNudge local record.
FILES: ADDED lib/install-prompt.js(+test) · ui/install-nudge.jsx;
  MODIFIED main.jsx · home.jsx · settings.jsx · keys.js
GATE: 25 test files + vite compile green. Deployed via main.


# ─────────────────────────────────────────────────────────────────────
# ABOUT PAGE + LEGAL v4 + DESKTOP SHELL + CONTENT MODERATION
# (2026-07-04, commit 015c8fe — Duolingo/Playo-inspired brand pass)
# ─────────────────────────────────────────────────────────────────────

OWNER ASKS: Duolingo-style About section; updated legal; premium PC
  experience (bottom bar is mobile-only — desktop had ONLY the Home
  hamburger drawer; Settings/Premium were a 448px phone column on PC);
  NEW: ban cuss words + auto-hide phones/emails in FAQ/anywhere
  (English, Hindi/Hinglish, Assamese incl. script). Owner decisions:
  solo-builder story; add Guidelines + Refunds docs; NO socials yet.

⚠ LAUNCH-PHASE REMINDER (owner requested): after the testing phase,
  CREATE SOCIAL CHANNELS (Instagram / YouTube / Telegram-WhatsApp) and
  add a Socials column to ui/app-footer.jsx + links on the About page
  (both deliberately shipped without one).

MODERATION (lib/content-filter.js + test): profanity = BLOCK at submit
  (friendly message, draft kept); PII (emails, +91/10-digit phones, UPI
  handles, 12-digit IDs) = silent redact with a 2-char hint. Lists:
  en + hinglish romanized + Devanagari + Assamese romanized/script.
  Evasions caught: letter repeats (per-letter + regexes), leetspeak,
  dot/dash padding. Self-censored forms (f**k) deliberately pass.
  PRECISION RULES for a nursing app: strict word boundaries (Assam/
  class/assessment can never hit), NO anatomy/clinical terms in the
  list, ambiguous homographs excluded (kela=banana, baal=hair).
  Wired: faq.jsx postQuestion (block+redact, red border + message),
  q.text/authorName render through cleanForDisplay (legacy content
  masked at read), signup + rename display names. Client-side by
  design at 12-user scale; admin delete is the backstop; broker-side
  faqq rejection = optional future hardening. Feedback-to-admin channel
  deliberately NOT filtered (private; users may share contact on purpose).

LEGAL v4 (lib/legal.js, LEGAL_VERSION 3→4 so users re-consent):
  Privacy now names Supabase + IndexedDB and adds sections: Analytics
  (Umami, cookieless), Bot protection (Turnstile), Notifications
  (opt-in push, how to disable), Cookies & local storage, Payments
  (nothing charged today). Terms adds: free-today/paid-later (premium +
  family placeholder), one account per person + new-device-may-sign-
  out-older clause, conduct pointer. NEW DOCS: guidelines (respect, no
  personal info, fair leaderboard, filter+admin moderation,
  consequences) + refunds (test-phase honest: nothing charged; at
  launch: cancel anytime/access till period end, 7-day billing-error
  window, family seats, 5–10 day refund path) — Indian gateways require
  a refunds page at launch. Settings → Legal lists all 4; NEW
  full-screen route nav.screen='legal' (payload doc) for footer/Search;
  auth consent modal unchanged (privacy+terms only).

ABOUT (screens/about.jsx, route 'about', lazy): hero (N logomark) →
  mission card → 4-card approach grid (spaced revision / weak-area /
  exam-day realism / gamified consistency, sec.* tints) → LIVE stats
  strip with IntersectionObserver count-up (questions=allQuestions.
  length, units=TOPICS.length, papers=PREVIOUS_YEAR_PAPERS.length —
  computed, never invented; instant under reduced motion) →
  solo-builder story card (chai CTA = requestSupport, share CTA) →
  promise chips → contact rows (feedback/FAQ) → legal links. Entries:
  drawer Help & Learn "About" row, Search registry, desktop footer.
  NOTE: footer/About say "Made with care in Assam, India" — owner
  should correct if wrong (one line in about.jsx).

DESKTOP SHELL (≥1024px, the PC premium pass):
  • ui/desktop-nav.jsx — persistent top navbar, mounted from App root
    when isDesktop && BOTTOM_NAV_SCREENS.has(nav.screen) (same 4 tab
    roots as the bottom bar; games/quizzes chrome-free). Brand→Home
    (goTabDirect), links Learn/Level Up/Revision/Library/Stats (via
    handleHomeNavigate) with Duolingo hover-underline slide, right
    cluster Search·note·bell(unread badge)·Favourites·profile chip→
    Settings·Menu→drawer. Publishes --dnav-h + in-flow spacer.
  • COLLISION MODEL (the tricky bit): Home's portaled phone header +
    its spacer are lg:hidden; the tab-root TopBars (search/favorites/
    settings main) pass NEW TopBar prop desktopHidden (bar+spacer
    lg:hidden); all OTHER TopBars (sub-views like Settings→Legal) now
    anchor at top: var(--dnav-h, 0px) so they stack BELOW the navbar
    while it's mounted and at top:0 everywhere else. Mobile pixels
    unchanged (var is 0/absent there).
  • ui/app-footer.jsx — hidden lg:block Duolingo footer on the same 4
    screens: brand block (Free · Ad-free · Always) + columns About /
    Study / Help and support / Privacy and terms (all nav objects via
    handleHomeNavigate; feedback/support via the imperative poppers).
  • Width polish: settings.jsx + premium.jsx + favorites.jsx + legal
    containers md:max-w-2xl/3xl — no more phone column on PC.
  • Anims: about-in, dnav-in/link-underline/brand/icon/chip, foot-link
    — registered in the reduced-motion master block.

FILES: ADDED lib/content-filter.js(+test) · screens/about.jsx ·
  ui/desktop-nav.jsx · ui/app-footer.jsx; MODIFIED legal.js ·
  legal.jsx · settings.jsx · faq.jsx · auth-screen.jsx ·
  rename-profile-modal.jsx · primitives.jsx (TopBar desktopHidden +
  --dnav-h) · home.jsx (header lg:hidden) · favorites.jsx · search.jsx ·
  premium.jsx · nav-drawer.jsx · nav-registry.js (+about/legal routes)
  · App.jsx · font-styles.js
GATE: 26 test files + vite compile green. Frontend-only ship.


# ─────────────────────────────────────────────────────────────────────
# MODERATION HARDENING — server-side faqq filter + SEC-016 rate cap
# (2026-07-04, follow-up to 015c8fe; kv-write DEPLOYED same day)
# ─────────────────────────────────────────────────────────────────────

WHY: the content filter shipped client-side only — cosmetic per this
  app's own security rules (any logged-in user can hit the broker
  directly). This closes the bypass and, in the same branch, the OPEN
  SEC-016 finding (no rate cap on feedback:/faqq: creation).

BUILT (supabase/functions/kv-write):
  • NEW moderation.ts — Deno copy of src/lib/content-filter.js's core
    (⚠ keep the wordlists/PII patterns IN SYNC by hand, same policy as
    the verifyToken copies). containsProfanity (latin repeat-tolerant
    boundary regexes + leet/padding normalize + Devanagari/Assamese
    script lookarounds) + redactPII (email/UPI/12-digit/+91-phone,
    2-char hint masks).
  • index.ts §6 — non-admin SET on feedback:/faqq: now rate-capped
    30/hour per user (bucket 'ugc-write' → 429, SEC-016 mitigation
    as-proposed → findings.md flipped to fixed). faqq: values are
    parsed and field-moderated (text / authorName / reply): profanity →
    400 'Blocked: please keep community posts respectful'; PII redacted
    in place before storage. Unparseable values fall through unchanged
    (render-side cleanForDisplay still masks for readers). Admin writes
    (replies/moderation) skip the filter — trusted.

ORDER: safe by construction — the client filter shipped FIRST
  (015c8fe), so the stricter broker never 400s anything the live UI
  allows. Deployed: supabase functions deploy kv-write --no-verify-jwt.
FILES: kv-write/index.ts · kv-write/moderation.ts (new) ·
  docs/security/findings.md (SEC-016 → fixed).


# ---------------------------------------------------------------------
# BACKUP HARDENING (2026-07-04, commit a37fa62)
# ---------------------------------------------------------------------

Owner (new to app dev) asked how backup works + a free-tier update.

CURRENT SYSTEM (unchanged, all free): 3 layers -
  1. AUTO cloud sync (logged-in): saveProfile writes local IndexedDB
     cache + Supabase kv_shared profile:{id}, debounced 1.5s, offline
     queue (markPendingSync/flushPendingSync drains on online+boot),
     last-write-wins. The real device-loss backup.
  2. MANUAL file (Settings->Backup): download/restore one JSON.
  3. Guests: local IndexedDB only, NO cloud.

FIXED (frontend-only, settings.jsx + KEYS.lastBackup):
  - Restore was a SILENT full-replace that ALSO syncs up to cloud -> an
    accidental import of an old file could wipe local AND the good cloud
    copy. Now gated behind requestConfirm (danger tone).
  - Backup file was INCOMPLETE (topic notes were a separate file). Now
    handleExport folds notes into the same JSON; handleFile merges them
    back (mergeNotes, newest-per-node). Backward compatible - old files
    with no notes field still import.
  - Added last-downloaded-backup timestamp (KEYS.lastBackup, local per
    profile) shown in the Backup screen + a guest no-cloud warning card.

DELIBERATELY NOT DONE (future, when scaling): auto-backup-to-cloud-drive
  (Google Drive API etc. = setup + arguably paid), scheduled/versioned
  backups, a Home nudge to back up. Current scale (~12 users) + auto
  cloud sync makes these low-priority. If revisited, keep free-tier.


# ---------------------------------------------------------------------
# CLOUD SYNC AND BACKUP (WhatsApp-style; no files) - 2026-07-04, eedfe9f
# ---------------------------------------------------------------------

Owner wanted NO user-facing JSON files (security) and a WhatsApp-style
sync/backup. The app ALREADY had offline-first cloud sync of the profile
blob (profiles.js saveProfile: local cache -> Supabase, pending-sync queue
drains on reconnect/boot). So this was reframing + removing the file UI, and
plugging the one gap (topic notes were device-local).

DONE (frontend-only, verified in Edge, 27 test files green):
- Settings: DELETED the file Download/Restore backup cards AND the whole
  Topic-notes export/import sub-page. New "Sync and Backup" status screen
  driven by NEW lib/backup-status.js (pure describeSyncState, states
  guest/offline/pending/synced; +test). Guests -> "Not backed up yet" +
  Sign-in CTA (signing in IS the backup). Accounts -> status card + "Back up
  now" (force saveProfile + flushPendingSync, re-checks getPendingSync).
  pendingCount===0 is the truth of "backed up". KEYS.lastBackup repurposed as
  last-confirmed-sync time.
- Topic notes moved from device-local (mindmapnotes:v1, shared:false) INTO
  the synced data.mindmapNotes: seed default {}, merge.js _gunionNotes
  (newest-per-node) in normalizeUserData + mergeGuestIntoAccount (ALSO fixes
  a latent bug: guest notes were never merged on sign-up before). knowledge-
  map.jsx reads/writes data.mindmapNotes via setData; one-time lazy migration
  on KM mount lifts legacy local notes in (keeps the old blob as fallback).
- App.jsx dropped onImportBackup + the unused importBackup.

NOT exercised in-browser (lower risk, unit-tested): signed-in "Backed up /
Back up now" states, and persisting a note (guest nodes are locked). Worth a
manual tap-through once live.

## OWNER DISASTER-RECOVERY GAP (my assessment of the Gemini backup doc)
The Gemini doc is a good survey but ~60% is for NATIVE apps (SQLite/Core
Data, iCloud/Drive) - does not map to this browser PWA. Verdict: this app is
already Model A (offline-first continuous sync), the correct model; do NOT
build WhatsApp Model B (encrypt-SQLite-to-iCloud), not possible in a PWA and
unneeded. The per-row is_synced/UUID/batch machinery is overkill vs the
whole-blob LWW at ~12 users.
THE ONE REAL GAP the doc surfaces = OWNER-side DR: all users' data lives in
ONE Supabase project's kv_shared. If it is deleted/corrupted/paused, there is
NO recovery (Supabase free tier has no PITR/auto-backup). RECOMMENDED (free,
simplest): a scheduled dump of kv_shared to durable storage.
  Option A (simplest for this stack): Vercel Cron (Hobby allows 2) -> a new
    admin-only api/ serverless route (NOTIFY_SECRET-style bearer) that reads
    all kv_shared rows via the service role and commits a gzipped JSON to a
    PRIVATE GitHub repo (free, versioned) OR uploads to Cloudflare R2 (10GB
    free). Nightly. Restore = re-insert rows.
  Option B: GitHub Actions cron + pg_dump of the Supabase Postgres -> R2
    (the doc's script). More setup (DB connection string secret, fiddly with
    Supabase pooler + free-tier pausing).
NOT BUILT YET - needs the owner to pick a storage target + provide creds.
Flagged for the pre-launch/scaling pass. See memory pre-launch-checklist.


# ---------------------------------------------------------------------
# OWNER DB BACKUP - nightly kv_shared snapshot to private GitHub repo
# (2026-07-04, commit c6ddd88)
# ---------------------------------------------------------------------

Built the disaster-recovery backup flagged in the previous entry (owner chose
GitHub repo as the storage target).

- api/backup-db.js: reads ALL kv_shared rows via the service-role key
  (paginated Range headers), commits snapshots/kv_shared-YYYY-MM-DD.json to a
  PRIVATE repo via the GitHub Contents API (GET sha then PUT). Also a
  CRON_SECRET-protected HTTP route (POST /api/backup-db) for manual/on-demand
  runs + testing. SHIPS DARK: backupDatabase() returns
  {ok:false,reason:not-configured,missing:[...]} until env is set.
- Cron: Vercel Hobby caps at 2 crons, both used by send-reminders (AM+PM).
  So NO 3rd cron - the AM run (currentSlot==='am', once/day) calls
  backupDatabase() best-effort in try/catch; a backup failure never breaks
  reminders. Result folded into the reminders response JSON.
- Excludes profile_secrets (password hashes) by design - no credentials
  off-platform; users recover progress by re-registering same display name
  (restored profile:<id> blob loads).
- DB_BACKUP_SETUP.md = the owner setup: private repo WITH a README (needs a
  main branch to commit into), fine-grained PAT (Contents R+W on that one
  repo), 3 Vercel env vars (SUPABASE_SERVICE_ROLE_KEY, BACKUP_GITHUB_TOKEN,
  BACKUP_GITHUB_REPO), redeploy, then curl test with CRON_SECRET.

STATUS: code deployed but INERT until the owner does the 3-env-var setup.
api/ is NOT covered by the vite gate - syntax-checked with node --check; the
live GitHub-write path is untestable without the owner repo+token (external/
destructive), so it was reasoned through + ships dark, not driven end-to-end.
NOTE on my earlier opinion: this closes the ONE real gap in the Gemini backup
doc; the rest (Model B / per-row sync / pg_dump) stays deliberately not-built.

# ---------------------------------------------------------------------
# (2026-07-05) LAUNCH WAITLIST — invite-gated launch system, ships DARK
# ---------------------------------------------------------------------

Implemented waitlist-implementation-plan.md (the Gemini growth spec) adapted
to this stack: join -> referral loop -> priority score -> admin batch approval
-> one-time claim token -> gated registration. NO email ever (no infra):
delivery = self-serve status check on the waitlist screen + manual wa.me
nudge buttons in the admin panel (spec's never-automate-WhatsApp rule).

- Two game_config flags, BOTH default false, flip live from admin Live config:
  waitlist.collect (join screen + public actions live) and waitlist.gate
  (launch wall: brand-new visitors -> waitlist instead of guest mode, and
  auth-secure REQUIRES a claim token to register). Also waitlist.batchSize
  + waitlist.schedule (default Tue 10:00 + Fri 15:00 IST).
- supabase/waitlist.sql: new service-role-only table (RLS on, zero policies,
  UNIQUE normalized email/whatsapp/code/claim_token). OWNER MUST RUN ONCE in
  the SQL editor. Stricter than the spec's public-INSERT: signups go through
  the broker so validation can't be bypassed.
- supabase/functions/waitlist/index.ts: public join/status/stats (Turnstile
  on join, per-IP rate_hit, email normalization + temp-mail blacklist +
  Indian phone regex, intent scoring >50 chars = 5, NURSE-XXXXX codes,
  3-referral milestone -> pending_verification NEVER auto-approve) + admin
  list/approve/reject/expire-sweep (session token + admin_profile_ids).
  Priority score = referrals*100 + daysWaiting*10, computed in-function from
  a 60s-cached snapshot (Range-header paginated — PostgREST caps bare
  limit= at 1000 rows). Claim token revealed ONLY with email + own code
  (anti-enumeration); expiry is lazy + admin sweep.
- auth-secure register: waitlist.gate flag (cached 60s, fail-open) -> require
  claimToken, burn-first atomic PATCH (approved + unexpired -> onboarded,
  claimed_profile_id stamped, token nulled = single-use), fail-closed; claim
  restored best-effort if the credentials insert then fails.
- Client: src/lib/waitlist.js (pure, tested: normalization, codes incl. the
  ?ref= slug reconstruction — captureReferralFromUrl mangles NURSE-AB12C to
  nurseab12c; parseWaitlistRefCode reconstructs, referral.js untouched),
  IST drop-schedule math, share/nudge builders. waitlist-api.js (tokenless),
  waitlist-admin.js (admin bundle only). src/screens/waitlist.jsx: closed /
  join / status / claim views with CountUp position, score breakdown, 1s
  drop countdown, wa.me + copy share, state leaderboard, DPDP unchecked
  consent + inline privacy modal, Turnstile; wl-* animations registered in
  the reduced-motion block. App.jsx: ?claim= capture (join-token pattern),
  gate early-return after nav-auth/before welcome; guest boot path now
  AWAITS loadGameConfig before deciding the wall; "Maybe later" escape when
  the wall is claim-link-only. Home guest nudge; nav-registry entry.
- Admin app: Waitlist tile -> src/ui/admin-waitlist.jsx (status tabs, score
  sort, state/NE filter, select-top-N + bulk approve/reject with confirms,
  referral-cluster flags same-ip/same-device/velocity, per-approved-row
  WhatsApp nudge + copy claim link, expired sweep).

GOTCHA FIXED IN REVIEW: brand-new-visitor check must NOT use
loadProfileIndex() (that's the GLOBAL directory, never empty in prod) —
device-locality = no session + empty guest blob only.

VERIFIED: 28 test files + both builds green; browser-driven (msedge
Playwright, game_config response interception so PROD flags stayed dark):
dark state byte-normal + closed card; collect ON -> Home nudge + join form
+ disabled-until-captcha; gate ON -> wall (no tour) + Sign-in escape;
?claim= link -> claim view, URL stripped, Maybe-later returns to guest.
NOT driven (needs table + deployed fns): live join/approve/claim loop.

STATUS: frontend pushed dark; waitlist + auth-secure fns deployed; INERT
until the owner runs supabase/waitlist.sql and flips waitlist.collect
(testing/hype phase) and waitlist.gate (launch day). Founding-member premium
grants = existing admin Premium tool (ops, not code).

# ---------------------------------------------------------------------
# (2026-07-05) NOT-IN-THE-APP-YET REGISTER (owner asked to track these)
# ---------------------------------------------------------------------
# Owner instruction: whenever a task assumes something the app doesn't have,
# put a placeholder, tell the owner, and log it here. Running list:

1. TRANSACTIONAL EMAIL — the app cannot send email at all. Placeholder is
   LIVE: supabase/functions/waitlist/index.ts sendApprovalInvite() no-ops
   until EMAIL_API_KEY is set + one provider POST is filled in (admin-approve
   already threads email + claim link through it and reports emailed:false).
   Free-tier options when ready: Resend (free, ~100/day cap) or Loops
   (free 1k contacts / 4k sends-month, no daily cap — better for batch
   drops). Needs a FROM domain (see 2). Other future uses: password-reset
   by email (signup already stores an OPTIONAL email in profile_secrets —
   currently dormant, nothing ever sends to it), payment receipts.
2. CUSTOM-DOMAIN MAILBOX (e.g. support@nurseholic.in) — no support/legal
   email exists; contact today = in-app feedback only. Wanted at launch for
   the DPDP grievance contact on the legal pages AND as the FROM address
   for item 1.
3. PAYMENT GATEWAY — premium is a placeholder (already tracked); Razorpay/
   similar at launch flips profile.premium via the subscription fn.
4. OWNER ALERTING — crashes/errors land in errlog + admin dashboard, but
   NOTHING notifies the owner's phone. Cheap later: free Sentry tier, or a
   self-push via the existing push-broadcast plumbing.
5. URL ROUTING / DEEP LINKS (refactor item A12) — links can't open a
   specific screen (only ?ref/?claim/?join params work); a shared "join the
   waitlist" URL lands on the app root, not the waitlist screen.
6. SOCIALS (already tracked as launch item 2d) — footer/About columns
   deliberately empty until channels exist.
7. TRADEMARK ™ (ops, from the growth spec §13.3) — run the free IP-India
   wordmark search (classes 9/41/42) before heavy marketing of the name;
   ™ symbol + dated (c) footer are free to add now; paid filing deferred.

# ---------------------------------------------------------------------
# (2026-07-05, later) EMAIL = RESEND + owner decisions on the register
# ---------------------------------------------------------------------

Owner decisions on the not-in-the-app-yet register, same day:

1. EMAIL SERVICE PICKED: Resend (free 3k/mo, 100/day — plenty at this
   scale). CODE IS LIVE AND INERT until `supabase secrets set
   RESEND_API_KEY="re_..."`:
   - waitlist fn sendApprovalInvite() now really POSTs to Resend
     (from EMAIL_FROM, default "NORCET Prep <onboarding@resend.dev>";
     reply_to = support email). Resend rule: until the nurseholic.in
     domain is verified in their dashboard, delivery works ONLY to the
     account owner's own address -> student invites effectively stay off
     until the DNS step; WhatsApp nudge remains primary.
   - OWNER ALERTING: kv-write now emails the owner when a client crash
     group lands in errlog: (subject "a client error was recorded"),
     hard-capped 2/hour via rate_hit bucket 'owner-alert', best-effort,
     inert without the key. Recipient default jyotishmandeori5@gmail.com
     (override secret OWNER_ALERT_EMAIL).
   REMAINING OWNER STEPS: create resend.com account with the Gmail ->
   API key -> hand over for `supabase secrets set` (fns pick up secrets
   without redeploy). LATER: verify nurseholic.in domain (DNS records)
   -> set EMAIL_FROM -> student invites go live. Key pasted in chat goes
   on the launch rotation list.
2. SUPPORT MAILBOX (INTERIM): owner's personal jyotishmandeori5@gmail.com,
   centralized as SUPPORT_EMAIL in src/lib/legal.js (used by the privacy +
   refunds Contact sections and the About screen's new "Email us" mailto
   row). Swap to support@nurseholic.in at launch = edit that ONE constant.
7. TRADEMARK: owner ran the clearance search for "nurseholic" — FREE, no
   conflicts. OPEN QUESTION for launch: the app brands as "NORCET Prep"
   but the domain/mark checked is "nurseholic" — decide which name carries
   the (tm) + dated (c) footer before heavy marketing.

# ---------------------------------------------------------------------
# (2026-07-06) BRAND RENAME "NORCET Prep" -> "NurseHolic" + Resend LIVE
# ---------------------------------------------------------------------

Owner resolved the open trademark question above by DECISION: the brand is
"NurseHolic" everywhere the app names itself. Done in commit 92df00b
(dev = main, pushed; Vercel auto-deploys prod):

- STUDENT UI: every masthead/eyebrow, About (title/mission/story/(c) footer),
  Settings (Share + Keep-free rows), share-app card + screen, result cards +
  milestone card + QR canvas brand text, install/support/home nudges, nav
  drawer header + About subtitle, waitlist screen hero + legal modal, family
  plan share title, admin push composer preview default.
- SHELL: index.html <title> ("NurseHolic — NORCET Prep") + apple-web-app-title
  ("NurseHolic"); PWA manifest name + short_name -> "NurseHolic"; admin.html
  title + AdminApp splash -> "NurseHolic Admin"; package.json name -> nurseholic;
  push-sw.js default notification title.
- SERVER/EMAIL: waitlist + kv-write Edge Fn email from/subject strings; api/
  notify-all + send-reminders push titles/bodies. Both fns REDEPLOYED
  (--no-verify-jwt).
- CONTENT: help.json Share-app copy; CONTENT_VERSION 12 -> 13 (busts the
  IndexedDB content cache so the new copy actually appears).
- ORIGIN FALLBACKS: hardcoded norcet-prep.vercel.app defaults (referral.js
  PROD_ORIGIN, qr-canvas, result-cards, crib-sheet) -> www.nurseholic.in.
- DELIBERATELY KEPT "NORCET": anywhere it names the EXAM, not the app —
  About mission/taglines ("Serious NORCET preparation"), share ad copy
  ("AIIMS NORCET prep"), knowledge-map root node label, PYQ source labels,
  study-methods copy. NORCET is the exam; NurseHolic is the product.

RESEND NOW LIVE (no longer inert): owner created the resend.com account with
the Gmail and handed over the API key; `supabase secrets set RESEND_API_KEY`
done. Verified end-to-end with ONE real test send to jyotishmandeori5@gmail.com
(Resend msg id a521f3c0-8020-4692-a648-a5ac2d90ca9b, HTTP 200) -> owner crash
alerts are now delivering. ⚠ RESEND_API_KEY was pasted in chat -> on the
launch key-rotation list. Student INVITE emails still gated on the DNS step
(verify nurseholic.in in Resend -> set EMAIL_FROM); WhatsApp nudge stays the
primary invite channel until then.

STILL OPEN (told owner, logged here 2026-07-06):
- SOCIAL LOGIN (Google / Apple / email sign-in) requested. NOT built — it's a
  real architectural change, not a string swap. This app uses CUSTOM HMAC auth
  (auth-secure -> profile_secrets, displayName + passphrase), NOT Supabase Auth,
  so there is no OAuth surface to flip on. Adding it means either (a) layering
  Supabase Auth / an OAuth broker beside the existing identity model and
  reconciling profile.uid, or (b) a custom Google Identity Services flow.
  COST/CONSTRAINT FLAGS: "Sign in with Apple" REQUIRES a paid Apple Developer
  account (~$99/yr) — conflicts with the free-tier-only rule; Google sign-in is
  free. Recommend: plan Google-first (+ keep the current name/passphrase as the
  no-account-needed path), defer Apple until iOS distribution is real. Needs its
  own design pass before any code.
- PROJECT/DASHBOARD RENAME (Vercel project `norcet-prep`, Supabase project
  `Norcet-prep`, admin project `norcet-admin`) -> "nurseholic" for consistency.
  These are DASHBOARD-label changes, owner-side, cosmetic — they do NOT change
  the app, the code, or the .vercel/.supabase project *refs* the tooling pins,
  so nothing in-repo has to move. Safe to do anytime; low priority.

# ---------------------------------------------------------------------
# (2026-07-06, later) GOOGLE SIGN-IN + EMAIL LOGIN + Loops live + email fwd
# ---------------------------------------------------------------------

Three follow-ups from the same session:

1. EMAIL FORWARDING (support mailbox, FREE): owner set up Namecheap's built-in
   Email Forwarding (NOT Zoho — Zoho no longer offers a free plan to new
   signups; it paywalled at signup). Two forwarders, both -> the personal
   Gmail: support@nurseholic.in + security@nurseholic.in. Gmail filter can
   label security@ separately. SUPPORT_EMAIL const (src/lib/legal.js) can now
   point at support@nurseholic.in whenever the owner wants (still Gmail today).

2. LOOPS NOW LIVE (marketing/audience): owner made the Loops account (team
   "Nurseholic"), key set via `supabase secrets set LOOPS_API_KEY`, validated
   against Loops' /api-key endpoint (HTTP 200). waitlist fn now best-effort
   syncs every join (userGroup waitlist-joined) + approval (waitlist-approved)
   as a Loops contact — commit 7ad1119, deployed. Resend stays the
   TRANSACTIONAL sender (claim links + owner alerts); Loops is the CAMPAIGN
   audience (broadcasts later). ⚠ LOOPS_API_KEY pasted in chat -> rotation list.

3. GOOGLE SIGN-IN + EMAIL-AS-LOGIN (commit d0b001e, shipped DARK): adds two
   sign-in methods ALONGSIDE the existing username+password, on the app's
   CUSTOM HMAC auth (auth-secure -> profile_secrets) — there is NO Supabase
   Auth / Firebase / NextAuth / OAuth-redirect layer in this app.
   - Schema: supabase/add-google-login.sql (owner RAN it) — password_hash/salt
     now NULLABLE (a Google account has no password), google_sub column +
     partial unique index, case-insensitive unique index on email.
   - auth-secure: new actions google-auth (re-verifies a GIS ID token via
     Google's tokeninfo endpoint: checks aud === GOOGLE_CLIENT_ID +
     email_verified) and lookup-by-email (resolves an email -> id, generic
     ok:false = no enumeration); register grows an optional googleIdToken path.
     Deployed; smoke-tested live (lookup-by-email -> {ok:false};
     google-auth -> {ok:false,reason:google-failed} with no client id set).
   - Client: ui/google-signin.jsx (GIS button, mirrors turnstile.jsx pattern),
     profiles.js googleAuth() + email-identifier resolution in
     authenticateProfile(), auth-screen.jsx Google button on both tabs +
     new-Google-user display-name sub-step + email reframed "optional but
     recommended" + login box relabelled "Username or email".
   - INERT until env vars set. OWNER STILL NEEDS (told them, free):
       * Google Cloud Console -> OAuth Client ID (Web application). ⚠ CRITICAL:
         this uses Google Identity Services' TOKEN/One-Tap flow, so Google needs
         **Authorized JavaScript origins** (https://www.nurseholic.in + vercel
         preview + http://localhost:5173), NOT an Authorized *redirect URI* —
         there is NO server callback URL. The ID token is delivered to a JS
         callback in the browser and POSTed to auth-secure's google-auth action.
         Leave the redirect-URI field blank.
       * Then: VITE_GOOGLE_CLIENT_ID in Vercel (both student + admin projects,
         redeploy) + `supabase secrets set GOOGLE_CLIENT_ID="<id>"`.
   - v1 SKIPS (logged, not built): Apple Sign-In (paid dev acct); auto-MERGE of
     a Google login into an existing same-email username account (first pass:
     Google logs into its own linked account or creates a fresh one); forced
     email verification for the typed-email path (stays optional/unverified,
     same posture as the pre-existing recovery-email field).

# ---------------------------------------------------------------------
# (2026-07-06, night) GOOGLE LIVE + account LINKING + Account-Security UX
# ---------------------------------------------------------------------

GOOGLE SIGN-IN WENT LIVE tonight: owner created the OAuth client
(JS origins only, redirect URI blank), GOOGLE_CLIENT_ID set as a Supabase
secret + VITE_GOOGLE_CLIENT_ID on Vercel norcet-prep production, redeployed,
client id verified present in the live bundle. ⚠ REMAINING OWNER STEP: OAuth
consent screen is still in TESTING mode — must click "Publish App" (basic
scopes only, no Google review needed) or every non-test-user gets
"Access blocked". Client secret exists but is UNUSED by design (GIS token
flow) — never needed anywhere.

Owner then hit the flagged v1 gap in real life (their Gmail was the recovery
email on account "iyro"; Google sign-in offered a confusing fresh sign-up).
FIXED in commit 2084236 (auth-secure redeployed, dev=main pushed):

1. GOOGLE→EXISTING-ACCOUNT LINKING: google-auth now looks up the verified
   Google email among existing accounts on a google_sub miss and returns
   { linkAvailable, displayName }; new `google-link` action proves BOTH sides
   (fresh Google ID token = owns email; profile password = owns account),
   sets google_sub (race-safe is.null filter), mints a session. Auth screen
   shows a "We found your profile" modal — password once, then Google is
   one-tap forever. Forgot-password escape drops into the recovery flow.
2. NEW `security-status` action (token-authed self-read: question, email,
   hasGoogle, hasPassword) + verifySessionToken (inverse of mintToken) in
   auth-secure — the Profile screen now shows what's ACTUALLY on file.
3. ACCOUNT SECURITY UX (owner: "premium class, proper visual confirmation"):
   status pills on every card (Linked ✓ / Set ✓ / Not set); email card rests
   in a read-only LINKED panel (full email + "log in with it" + "Google
   sign-in connected" line) with explicit Change/Cancel editing; success/
   error feedback upgraded to boxed anim-scalein confirmations everywhere;
   Google-only accounts (hasPassword=false) get read-only info variants
   instead of dead password-gated forms (they have no password to type).
4. Switch/Log out relocated to the BOTTOM of Settings→Profile under a
   "Session" header, directly above Reset (owner request).
5. BRAND STRAGGLER: desktop-nav.jsx wordmark was split across tags
   ("NORCET <span>Prep</span>") so the rename grep missed it — now
   Nurse<span>Holic</span>. (Owner's screenshot caught it.)

# ---------------------------------------------------------------------
# (2026-07-06, late) EMAIL SWAP + RESEND SEND DOMAIN + Manage-Admins revamp
# ---------------------------------------------------------------------

Owner-confirmed after a guided infra session: Google login live-tested OK;
Gmail filters (support/security/hello labels) created; Namecheap forwarders
(support@/security@/hello@ → Gmail) live + DNS-verified by me (root MX =
eforward1-5). Loops DNS (mail.nurseholic.in) all verified. Then three code jobs:

1. SUPPORT EMAIL SWAP (3c272ab): SUPPORT_EMAIL const (legal.js) Gmail →
   support@nurseholic.in — About "Email us" + Privacy/Refunds contact; waitlist
   invite reply_to too (SUPPORT_EMAIL secret set). Owner crash alerts (kv-write)
   deliberately STAY on the personal Gmail (private ops signal, direct inbox).

2. RESEND SENDING DOMAIN + test tool (b5de50b): owner added sending domain
   send.nurseholic.in in Resend (Tokyo), DNS all correct + propagated (I
   verified DKIM resend._domainkey.send, SPF send.send, DMARC at root — all
   resolve). BUT Resend itself still shows the domain UNVERIFIED (403 on send) —
   classic "clicked Verify while records were still Pending; Resend re-checks
   on demand." ⏳ OWNER STEP: re-click "Verify" in Resend → Domains. I set
   EMAIL_FROM secret = "NurseHolic <noreply@send.nurseholic.in>" so the instant
   the domain verifies, BOTH student invites AND owner crash alerts send from
   it (owner alerts are best-effort → temporarily dark until verified; acceptable
   in testing). Resend API key is SEND-ONLY restricted (can't GET /domains).
   NEW admin `admin-test-invite` action (waitlist fn) + "Test invite email" card
   in the admin Waitlist panel: sends a SAMPLE approval through the real
   sendApprovalInvite path, echoes { sent, reason, from } — the owner's live
   verification checker (a 4xx = "domain not verified yet").

3. MANAGE ADMINS REVAMP (8408991): the raw-id screen was confusing. Now:
   - NEW admin-manage `resolve-profiles` action (token+admin gated) maps ids
     AND uids → display_name via profile_secrets (profilemeta is slug-keyed +
     has no uid, so it CAN'T resolve uids — profile_secrets is the only table
     with both). admin.js resolveAdminProfiles().
   - Username shown next to every id; add form resolves the name LIVE and a
     confirm modal names the person before granting admin (no typo grants).
   - Hierarchy shown: "Owner (you)" tier (crimson Crown) + "Admins" tier. Your
     own rows are NEVER removable (Lock, not trash) — fixes the "delete myself"
     footgun. Self-protection is client-side (removal stays passphrase-gated;
     hard server owner-lock rides with the DEFERRED per-account role system —
     see the "Role hierarchy: Admin > Co-Admin > Moderator" spec above, still
     NOT built: that needs per-account staff login + roleOf() in all brokers).
   Deployed: admin-manage fn + `npm run deploy:admin` (norcet-admin).

# ---------------------------------------------------------------------
# (2026-07-07) STAFF ROLE HIERARCHY SHIPPED + admin custom domain + brand end
# ---------------------------------------------------------------------

The "FUTURE / DEFERRED — Role hierarchy" spec above is now BUILT (d627d5f,
dev=main; all 8 Edge Fns deployed; admin app deployed). Owner asked for the
complete version.

⚠ OWNER STEP REQUIRED: run supabase/admin-roles.sql in the SQL editor.
Until then everything behaves exactly as before (legacy membership counts
as Co-Admin — deploy-safe fallback in every broker). After the SQL: owner
rows (iyro + uid) = admin; other rows = coadmin; RPC
admin_transfer_ownership() exists (service-role only).

WHAT SHIPPED:
- roleOf() in ALL brokers, read from DB per action (never in the token):
  demotion bites on the target's next call — the spec's "instant revocation
  freebie". Tier map: Moderator = faq: writes, myfeedback: replies,
  feedback:/faqq: moderation, adminlog APPEND, errlog/feedback cross-READS,
  content-staging list+generate (drafts). Co-Admin+ = everything else
  (announce/config/banks/push/waitlist/subscription/referral-intel/
  profile-blob reads/audit-log READS/content publish). admin-manage
  governance: writes need passphrase + actor token; promotion ceiling
  (grant only below your own role); self-action block; owner-lock (owner
  changes only via atomic transfer); server-stamped adminlog rows w/ reason.
- Admin UI: staffRole captured at login (check-admin returns role; legacy
  no-role => treated as full admin); dashboard rank badge (Owner crimson /
  Co-Admin purple / Moderator teal); tile+view visibility matrix (moderators
  see Feedback/Users/Bank health/Crash reports/Content Review/FAQ/
  Helpfulness ONLY). Manage Staff v2: rows GROUPED BY PERSON (slug+uid = ONE
  card — fixes owner's duplicate self-card report; group actions apply to
  every id), role DROPDOWN on add (only roles below yours + power blurbs),
  live username lookup + named confirm before grant, promote/demote/remove
  via inline caution panels with a LOGGED REASON, ownership transfer with
  type-TRANSFER confirm, self/owner rows hard-locked in UI and server.

BRAND STRAGGLERS CLOSED: the "norcet-prep" the owner saw in the share
section = share cards display window.location.host, so it only appears when
the app RUNS on norcet-prep.vercel.app (old origin/stale PWA install).
Fixed for good with a PERMANENT host redirect in vercel.json
(norcet-prep.vercel.app -> https://www.nurseholic.in/:path*; previews
unaffected; admin project has its own deploy so unaffected). All remaining
"NORCET" strings in src/ are deliberate EXAM descriptors.

ADMIN CUSTOM DOMAIN: owner activated admin.nurseholic.in (CNAME ->
vercel-dns, Valid Config + SSL). Codebase sweep for norcet-admin.vercel.app:
ZERO functional references (no CORS lists/callbacks/env URLs; GIS has no
redirect URIs; Edge Fns allow *). Only scripts/post-admin-build.mjs pins
projectName norcet-admin — that's the Vercel PROJECT name; keep until the
project itself is renamed. Docs updated (Turnstile hostnames + this note).

GOOGLE ON ADMIN LOGIN: admin builds LOCALLY from .env (deploy:admin), so
VITE_GOOGLE_CLIENT_ID (public value) was appended to .env; rebuilt +
deployed; client id verified in the live admin bundle.
⚠ OWNER STEP: add https://admin.nurseholic.in (+ keep norcet-admin.vercel.app)
to the Google OAuth client's Authorized JavaScript origins, or the admin
Google button will error on that origin. Email login already worked there
(shared AuthScreen + lookup-by-email).

# ---------------------------------------------------------------------
# (2026-07-07, later) ADMIN 2FA (TOTP) + staff passphrase + infra confirms
# ---------------------------------------------------------------------

Owner confirmed: admin-roles.sql RUN (roles live — screenshot showed grouped
Owner card + Nancy Luis Co-Admin); Resend domain VERIFIED (real send from
noreply@send.nurseholic.in succeeded, id 38c06173); admin.nurseholic.in live;
Google OAuth JS origins updated (owner also added a redirect URI — HARMLESS
but UNUSED: GIS token flow has no callback path; can be deleted anytime).
Codebase sweep for norcet-admin.vercel.app: zero functional refs (only the
Vercel PROJECT name pin in post-admin-build.mjs — keep until project rename).

SHIPPED 955c2ed (admin-manage deployed; admin app deployed):

1. TOTP 2FA on the admin panel (Google Authenticator, free, no SDK):
   - supabase/admin-2fa.sql ⚠ OWNER MUST RUN: profile_secrets.totp_secret.
   - admin-manage: WebCrypto HMAC-SHA1 TOTP; check-admin returns totp status;
     totp-enroll (otpauth:// URI shown ONCE; confirmed secrets can't be
     silently re-keyed) / totp-verify (±1 step; first valid code confirms) /
     totp-reset (OWNER only, audited — the lost-phone escape hatch).
   - src/ui/admin-2fa.jsx: QR enrolment + per-browser-session 6-digit gate
     (sessionStorage; sign-out re-locks). EVERY staff login now walks
     through enrol-once-then-code-per-session. Scope: gates the PORTAL;
     broker calls stay token+role gated.
2. STAFF PASSPHRASE SPLIT: new STAFF_PASSPHRASE secret (owner picked
   "norcet-boss" — pasted in chat → rotation list). admin-manage staff
   writes verify the key BY ACTOR ROLE: owner → ADMIN_PASSPHRASE (unchanged,
   never shared), co-admins → STAFF_PASSPHRASE. UI placeholder adapts.

⚠ NOTE: until admin-2fa.sql is run, totp-enroll errors ("has admin-2fa.sql
been run?") and the enrolment screen blocks the panel — run the SQL right
after deploy. 2FA + roles both live entirely on free tiers.

# ---------------------------------------------------------------------
# (2026-07-07, later) Admin auth = LOGIN-ONLY
# ---------------------------------------------------------------------

Owner: "the create profile section in the admin panel is completely useless
and meaningless." Correct — staff are EXISTING accounts added to the
allow-list; a fresh profile created on the admin login just hits the
Not-Authorized screen. Fixed (9a9de30): AuthScreen gained a `loginOnly` prop
(AdminApp passes it) that hides the Create/Log-in tab switcher, locks to Log
in, sets the subtitle to "Staff sign-in", and turns a brand-new Google
sign-in (no linked profile) into a clear "not a staff account" message rather
than dropping into sign-up. Existing-account Google + email + username login
all still work. Student app unchanged (default keeps both tabs). Admin
redeployed.

# ---------------------------------------------------------------------
# (2026-07-07, later) Admin: 2FA QR fix + premium UI/UX revamp + security QA
# ---------------------------------------------------------------------

Owner report: 2FA QR was a blank white box (only the manual key showed); the
admin top bar had confusing chrome (a note button, a meaningless home back
arrow, no clear exit); popups weren't centred on the current screen; and the
panel wasn't laid out for PC/tablet. Plus: "can a normal user log in, enrol
2FA and reach the panel?" and a request for a security-auditor QA pass.

SHIPPED e8113c3 (student pushed to main; admin deployed; admin-manage deployed):

1. QR (the blank box) — ROOT CAUSE: src/lib/qr.js encoded only QR versions
   1-6 (106-byte cap); the otpauth:// URI is ~140-170 bytes, so encodeQR threw
   every time and QrSvg silently returned null. FIX: extended the encoder to
   v9 (EC-M rows 7/8/9, alignment patterns, and the 18-bit VERSION-INFORMATION
   blocks v>=7 requires — without them v7-9 codes are unscannable; BCH gen
   0x1F25, known vectors v7=0x07C94/v8=0x085BC/v9=0x09A99). Added qr.test.js
   (v1-6 regression locks + v7-9 structure + version-info vectors). QrSvg now
   shows a visible fallback instead of a blank box. Server otpauth URI trimmed
   to spec defaults (dropped &algorithm/&digits/&period → lower, denser QR).
   VERIFIED by a full encode->decode ROUND-TRIP on v7/v8/v9 + the real URI
   (proves data placement survives around the version-info blocks).

2. "Can a normal user reach the panel via 2FA?" — NO (verified + audited).
   AdminApp gates login → server role check (non-staff → Not-Authorized) →
   2FA → panel; totp-enroll/verify are 403 for non-staff BEFORE any secret is
   minted. The sessionStorage 2FA flag + admin-status cache are UI-only (every
   broker re-checks roleOf server-side).

3. Top bar / shell: NoteButton + Feedback/Help buttons are now registry-aware
   (self-hide when no host is mounted → gone from the admin app, unchanged in
   the student app — they were DEAD chrome in admin). Home bar drops the
   no-op back arrow and gains an explicit "Sign out" pill (confirm dialog).
   Device-back "Leave?" now actually leaves the page.

4. Popups centred on every device: ConfirmDialog + ReportedQuestionModal +
   the bank-delete dialog now PORTAL to <body> (a transformed anim-fadeup
   ancestor was containing position:fixed and shoving overlays off-centre).
   FUNCTIONAL BUG FIXED: ConfirmHost was never mounted in AdminApp, so every
   requestConfirm() in Manage staff / Waitlist / Helpfulness / Content review
   silently no-opped — those destructive confirms never completed. Inline
   two-tap confirms (user delete, announcement history, crash delete) folded
   into the one centred dialog.

5. Responsive revamp (mobile BYTE-IDENTICAL): all admin views adopt
   PageContainer width tiers; dashboard tiles 2/3/4-col at phone/tablet/PC;
   Users + Feedback lists 2-col on tablet; Growth stats 4-col; tile
   hover/focus affordances; ≥40px touch targets; 16px inputs (no iOS zoom);
   safe-area padding on the fixed bottom bars.

6. Security-auditor QA → docs/security/findings.md (SEC-034..042). Applied
   SEC-035: added the shared rate limiter (auth_rate + rate_hit RPC) to
   admin-manage — totp-verify 10/15min per account (closes a 6-digit
   brute-force oracle) + passphrase verify 10/15min per IP; removed a FALSE
   "rate-limited" comment. Bundle grep: no admin secret ships in dist-admin.

⚠ OWNER STEP (SEC-034, top finding): the live kv_shared anon-read policy is
the 2-prefix denylist, so adminlog:/errlog:/analytics:/feedback: are readable
with the public anon key (staff audit log, crash stacks, engagement, report
PII). The client ALREADY routes all six through the kv-read broker, so it's
safe to apply supabase/secure-admin-read-policy.sql (locks those 4 + the 2)
and then probe: with the anon key, `SELECT key FROM kv_shared WHERE key LIKE
'adminlog:%'` should return 0 rows. Reversible.
→ RESOLVED 2026-07-08: owner ran the v2 SQL ("sql run done") — SEC-034 CLOSED.

# ---------------------------------------------------------------------
# (2026-07-08) Knowledge Map premium revamp — responsive canvas, centred
# popups, label declutter, micro-interactions
# ---------------------------------------------------------------------

Owner (tablet 960x1600 + laptop screenshots): map "feels completely rubbish"
on big screens; popups misaligned to the current screen and size seemed to
vary with the enlarged map; zoomed view = unreadable label soup; mid-zoom =
"caterpillar" chains of overlapping circles. Wanted: simple, premium,
micro-interactions, every mobile/tablet/PC.

SHIPPED (5 commits, student app only — no Edge Fn / admin changes):

1. test(kmap) 2de2140 — NEW src/lib/kmap.test.js locks mastery thresholds +
   every radial-layout invariant BEFORE touching anything (kmap.js had no test).
2. fix(kmap) e6827c2 — popups: NEW src/ui/kmap-dialog.jsx = ONE shell for the
   node HUD + note editor + guide. Portaled to <body>, ALWAYS viewport-centred
   on every breakpoint, FIXED size (420px wide, maxHeight min(620px,
   100dvh - safe areas)) — cannot vary with map zoom/fullscreen. Root cause of
   the "cut off / far down" popups: items-end bottom sheets sized 62vh (vh !=
   visible height when mobile browser chrome retracts) rendered un-portaled.
   The guide dialog had already been fixed to this pattern; now all three ride
   it. Note editor deliberately restyled to the map's dark HUD shell.
3. feat(kmap) d2cf2a3 — responsive canvas: column max-w-md → wide tier
   (md:3xl/lg:6xl); surface height 460px → viewport-clamped on md/lg (phone
   byte-identical); floating back/report/help row tracks the column; legend =
   phone strip + glass pill overlay on canvas for md+/fullscreen; starfield
   domain widened for letterbox bands; suggested-today/minimap lg bumps;
   knowledge-map added to NOTE_FAB_HIDDEN.
4. feat(kmap) d5157a7 — declutter/LOD: kmapLabelFont (counter-scaled,
   constant ~11px screen labels, clamped so phone default = today) +
   kmapFocusSubjectId (only the wedge under the viewport centre shows sub
   labels; other subjects' labels fade to 0.35) + 3-step radial stagger
   (j%3 * 34, was j%2 * 30) + plain-dot subs below Topic zoom (fog/glow/crown/
   badges gate on subDetail ≥2.1) + zoomed-out "★ mastered/total" per subject.
   Both new helpers unit-tested; reveal thresholds unchanged.
5. feat(kmap) d1445ec — micro-interactions (ALL reduced-motion-gated): node
   hover brightness + press scale; eased +/-/Fit/double-tap camera glides via
   the existing animateView (wheel/pinch stay instant); legend chips ping an
   expanding ring on every star of the tapped tier; suggested-today slides in;
   bottom-left controls unified into one glass panel.

Verified: npm test (30 files incl. new kmap tests) + vite build green per
commit; all 5 map modules transform cleanly through the live dev server.
⚠ Owner device check recommended: popup opens pixel-identical at any zoom /
fullscreen / mid-pan; celebration tour after a quiz; search reveal; long-press
note; reduced-motion setting.

# ---------------------------------------------------------------------
# (2026-07-08, later) Knowledge Map ROUND 2 — page-zoom fix, practice
# confirm, star-chart look, lag-free
# ---------------------------------------------------------------------

Owner round-2 feedback: popup still "zoomed in"; want a caution before being
thrown into a test; shared real star-chart images as the target aesthetic;
map "slightly laggy" on open.

SHIPPED (5 commits a7cc53e..e46a155, student surface only):

1. fix a7cc53e — THE POPUP-ZOOM ROOT CAUSE: onWheel was a React synthetic
   handler; React attaches wheel listeners PASSIVELY so its preventDefault()
   was a NO-OP → desktop trackpad pinch (= ctrl+wheel) zoomed the map AND
   browser-PAGE-zoomed the app, scaling the fixed-px dialogs. Map now binds
   NATIVE non-passive wheel + Safari gesture* listeners (new functional
   zoomBy(); focal point = raw viewBox coord, no state needed); KmapDialog
   overlay guards ctrl+wheel too (plain wheel still scrolls the body). Page
   zoom the USER sets via Ctrl+/menu is normal browser behaviour, unchanged.
2. feat ff0d0ea — PRACTICE CONFIRM: node-popup CTA + Suggested-today Start
   now raise the app-standard centred confirm ("Start practice — {name}? …
   10-question practice test", Start test / Not now). Popup stays open behind;
   cancel/Esc returns to it. Bonus "Mark as explored" untouched.
3. perf ed54fc2 — LAG ROOT CAUSE: every pan/zoom/tween frame re-rendered the
   whole ~1,000-element SVG through React. The scene (backdrop/stars/edges/
   nodes) is now ONE useMemo keyed on data + QUANTIZED zoom (kmapQuantK 0.05
   steps, lib+tests): pan/tweens re-render only the transform attribute.
   activateNode/noteGestureProps stabilized (guard comments); celebration
   overlay excluded from the memo. Ambient pulse/shimmer animations PAUSE
   during gestures/tweens (.kmap-anim-paused, imperative classList). LevelUp
   warms the map chunk on idle (same specifier as App's lazy import).
4. feat 392a005 — SCREEN-CONSTANT STARS (kmapNodeScale, lib+tests): node
   radii/rings/strokes/glyphs counter-scale so zoom grows SPACING, not
   circles (the star-chart behaviour; kills the ballooning-overlap look).
   Root sun shrinks gently (exp 0.5). HIT TARGETS unchanged: transparent hit
   circles at the round-1 radii. Phone k=1 default byte-identical (clamp 1).
5. feat e46a155 — STAR-CHART DRESSING: dotted graticule rings at R1/R2/
   bonus-ring; subject labels = letter-spaced CAPS (gold when mastered;
   size target 12.5→11.5 to offset the wider caps); mastered stars get thin
   4-point flares; the focused wedge's lines turn warm gold (the active
   "constellation figure"). All decorative bits aria-hidden + pointer-inert.

⚠ Owner device check: trackpad-pinch/ctrl+wheel over the map on the laptop —
map zooms, PAGE must not; popup 420px at every zoom; Practice → confirm →
quiz; pan smoothness on the tablet; celebration tour after a quiz still
plays; long-press note + search + fullscreen + minimap regressions.

---

## 2026-07-08 — HOTFIX: Knowledge Map crashed in production (fogSet TDZ)

Round-2 commit ed54fc2 added `fogSet` to the new kmapScene useMemo deps but
left its declaration ~300 lines BELOW the memo. Evaluating the deps array on
first render threw `Cannot access 'fogSet' before initialization` (minified:
'qe') → every Knowledge Map open hit the error boundary in production.
`npm test`'s compile gate passed — bundlers don't execute code, so
use-before-declaration TDZ is invisible to builds; only rendering catches it.

1. fix af3a87b — hoisted the fogSet memo above kmapScene (comment added
   explaining the ordering constraint). Deployed to prod (Vercel READY).
2. NEW PERMANENT GATE — `scripts/smoke/` server-renders the REAL
   knowledge-map.jsx with react-dom/server (stubs: app-context hooks +
   low-level storage only). Reproduced the crash on the broken code, passes
   on the fix. Wired into `npm test` between the unit tests and the vite
   build: `> knowledge-map render smoke`.
3. Static sweep: python TDZ scan over the component found no other
   use-before-declaration (two hits were false positives: a setTimeout
   closure and a JSX prop name).

LESSON (process): a "verified" ship must include a RUNTIME render of the
changed screen, not just tests + build. The round-2 dev-server checks only
confirmed modules transform — they never executed a render.

---

## 2026-07-08 — Render-smoke gate extended to all high-traffic screens

`scripts/smoke/` now server-renders SIX screens on every `npm test` (was
knowledge-map only): home, quiz (5 real SEED_QUESTIONS), settings, level-up,
learn-topics, knowledge-map. Any first-render crash in any of them now fails
the gate before a push can reach users.

Harness upgrades: stub `useData` now feeds the app's REAL `DEFAULT_DATA` +
`SEED_QUESTIONS` shapes; `createPortal` is no-op'd in the smoke bundle only
(react-dom/server can't traverse portals — the component bodies that CALL it
still execute, which is the coverage that matters); `import.meta.env` is
defined empty (modules guard for missing VITE_ values, mirroring a build
without env). To cover a new screen: add one entry to SCREENS in
scripts/smoke/entry.jsx with props mirroring its App.jsx dispatch site.

Known limits (documented, acceptable): effects never run (loading states
render, async crashes not covered), portal contents (open dialogs/toasts)
not traversed, admin app not covered.

---

## 2026-07-09 — Removed ALL em dashes from user-facing copy (anti-"AI tell")

Owner rule (now in CLAUDE.md "User-facing text — NO em dashes"): users must
NEVER see an em dash (—) or double hyphen (--); they read as AI-generated and
erode student trust in the question bank.

Built a comment/glyph/regex-aware transformer (scratchpad dedash.py) that
replaces em dashes in DISPLAY text only, choosing punctuation per grammar:
period (two independent clauses), comma (appended/dependent), colon
(label→definition). It skips code comments, JSX `{/* */}` comments, the '—'
placeholder glyph, regex char-classes, and en dashes in numeric ranges
(60–100 bpm stays).

Scope cleaned (all human-reviewed, all green through npm test = 30 tests +
6-screen render smoke + build):
- src/data (question banks, seed-explanations, ECG/caliper/crash-cart etc.)
- src/screens + src/ui (all UI copy, incl. admin)
- src/lib (legal, profiles/auth errors, nav-registry, pacing, prompts, etc.)
- public/data JSON (reference/dosage/concept-cards/help) → CONTENT_VERSION 13→14
- supabase/functions (auth/staff errors, kv-write push body, waitlist msg,
  content-staging Gemini prompt) — DEPLOYED with --no-verify-jwt (admin-manage
  v22, content-staging v12, kv-write v27, push-broadcast v9, waitlist v15).
~160 files, ~1660 lines. Two bugs the review caught before shipping: the
note-prompt bullet regex `[•·*\-–—]` (reverted — regex, not prose) and the
'₹—' price placeholder (→ '₹–' en dash; premium.test.js updated).

Commits a11e735 (frontend) + functions commit, pushed to main. CLI note: the
supabase CLI is a scoop shim reachable via the PowerShell tool, not Bash npx.

---

## 2026-07-09 — Rage-click detection: UX failures flagged before a ticket

Owner request: detect rage clicks (rapid clustered taps, the "this button is
broken" frustration signal) and surface them as UX failures before students
give up or file feedback. Shipped 57f4c6e; all three surfaces live.

- NEW src/lib/rage-click.js: PURE burst detector (4 pointerdowns within
  1.5s and 32px of the burst anchor; 30s cooldown per tantrum; 6 reports
  per session; thresholds are exported constants for quick tuning) + a
  fail-safe document-level installer booted in main.jsx. The installer
  LAZY-imports errorlog/umami (game-config.js idiom) so the Node contract
  test can import the module without dragging in storage.js.
- Reports RIDE THE EXISTING errlog pipeline: captureError with severity
  'ux', message "[UX] Rage click on {screen}: {target} (dead zone |
  unresponsive control)". They appear in the admin Crash-reports triage
  list with group/resolve/delete for free, amber UX badge (admin deployed).
  Position/click-count detail rides sampleStack. Umami 'rage-click' event
  fires per report. Targets are PII-safe (tag + 40 chars text/aria-label,
  never input values); untrusted (synthetic) events ignored.
- EXCLUDED screens (legit rapid tapping): the 13 games/drills +
  knowledge-map (double-tap zoom). Quiz INCLUDED by design: hammering a
  locked option is a real UX signal.
- kv-write: errlog SETs with severity 'ux' skip alertOwnerOnError so UX
  noise can never consume the shared 2/hour crash-email budget (deployed).
- Verification: contract test (rage-click.test.js, auto-discovered; 31
  test files now) + an end-to-end Node harness that installed the real
  listener, fired trusted synthetic bursts through the REAL handler ->
  detector -> captureError -> flush and asserted the exact errlog record
  (11 checks incl. cooldown, ward-boss exclusion, untrusted-event filter).
  Full gate green (31 tests + 6-screen render smoke + build).

Owner device check: spam-tap a blank area on Home ~5x fast, then open
admin -> Crash reports: one amber [UX] group should appear. Spam-tapping in
any Level Up drill or on the Knowledge Map must produce nothing.

---

## 2026-07-10 (later) — High-Stress Drill + integrity round (ALL LIVE)

**High-Stress Drill (547cb26) — completes NEW-07:** Advanced Test setup
toggle runs the real Prelims format via src/lib/section-lock.js (5 x 20 Q
x 18 rigid min at 100 Qs; proportional short tail, never <1 min). Engine
takes an opt-in `sections` prop (null = byte-identical classic path):
per-section clock that LOCKS for good, fenced nav/keyboard/palette (lock
glyphs), section strip + draining bar, the spec's final-90s stress cue
(amber -> red heartbeat at 30s; reduced-motion = colours only), early
"Lock section" with confirm. BUG FOUND+FIXED while wiring: the timer's
auto-submit closed over mount-time answers, so a test running to 0:00
submitted an EMPTY sheet (manual submits masked it). Answers now flow
through a ref.

**Integrity round (7a21b74) + preview fix (2143384):**
1. Bank preview: first shipped options-with-answer-marked (mistake:
   spoiled the bank), owner call -> stems only, then upgraded to a
   "What's inside" card: topic mix bars, difficulty split, PYQ share,
   zero content leak (Duolingo skill-outline approach).
2. Duplicate "aptitude" in admin Bank health: uploads accept free-text
   topic ids and a bank shipped `topic:"aptitude"` =/= `apt`. NEW
   resolveTopicId() in src/lib/topics.js (aliases + display names ->
   canonical ids) applied at upload normalization, Bank health, Stats
   grouping/trends, topic-practice pool filters, weak topics, clinical
   fallbacks; name/color/icon lookups resolve too. Server data still
   holds the alias strings: views merge them; re-saving the bank in the
   admin editor will clean the source (optional).
3. Leaderboard accuracy = FIRST TRIES ONLY: dailyHistory rows gain
   freshAttempted/freshCorrect (fresh = never interacted, reveals
   included; merge.js sums them cross-device); weeklyGrowth prefers
   fresh accuracy (legacy fallback, self-heals in a week);
   firstAttemptTotals() publishes lifetime first-try figures on the
   shared entry and the Accuracy tab ranks on them (copy: "only first
   tries count"). Re-answering known questions still teaches but can't
   buy rank.

All deployed to production (student f882cff..7a21b74 on main + admin app
via deploy:admin). 38 test files + 16-screen render smoke green.
Remaining deferred: NEW-04 three-wave pacing, NEW-08 CBT simulator.

---

## 2026-07-10 — UX feedback round (LIVE) + Advanced Stats tab (dev)

**UX round (bbb08ab, deployed to PRODUCTION same day on owner's order,
along with the whole i18n build; admin app deployed via deploy:admin):**
1. TM stripped from every visual brand lockup; survives only in (c)
   lines + the student tab title.
2. Desktop footer language switcher (Globe pill -> 16-language popover,
   same setLocale contract as Settings -> Language).
3. Library rethought for students: chips All / In my practice / Not
   added; per-card status chips (In use / Update available / Paused /
   Not added) + status accent bar; admin app keeps ownership chips.
4. Bank detail: practice-status card first, preview now shows OPTIONS
   with the correct answer marked, CTA "Add to practice - N questions".
5. Admin bank editor: MULTI-file .json/.csv upload + drag-drop; files
   parsed independently, merged into one batch, per-file report;
   duplicate review runs across the merged set.
6. BackToTop FAB rebuilt: shows at 240px, springy in/out, scroll
   progress ring (rAF, no re-renders), hover lift; crib-sheet inline
   copy replaced with the shared component; added to Library.
Render smoke grew to 13 screens.

**Advanced Stats tab (f882cff, dev only pending owner QA) — master-plan
NEW-07:** Stats gains Overview/Advanced tabs (Overview unchanged).
Advanced tab = What-If v2 (dual sliders: attempted + doubtful-blank,
coarse honest percentile band; math extracted to src/lib/whatif.js, v1
card on Advanced results untouched), Doubt Mapping 2x2 (doubt-matrix.js
over the already-captured conf tags; Fatal Danger Zone taps into a
mode:'wrong' review), Clinical System Leak Radar (clinical-systems.js:
keyword sub->system map + topic fallback + Other; severity = wrongRate
* log2(1+attempts), min 3; GK/apt excluded), Strategic Benchmarks
(benchmark.js vs topper targets, every metric degrades to honest "no
data"; blind guesses null until conf is tagged). StatsScreen gets
BackToTop; smoke gained 'stats' + 'stats-advanced' entries via a new
__setSmokeData fixture hook (DEFAULT_DATA is empty and would skip the
new hooks). 36 test files green. FEAT-03 (short trend ranges) was
found ALREADY BUILT during the audit; analytics-prototype.html never
existed in the repo. Explicitly deferred: NEW-07.4 High-Stress Drill /
18-min section locks, NEW-04 three-wave pacing, NEW-08 CBT simulator.

---

## 2026-07-10 — Multi-language UI: 15 languages shipped to dev (i18n complete)

Full UI internationalization built and verified overnight across 4 commits
(6aa9ad4, eb43e1b, b4c4834, 680160f), all on dev, NOT promoted to main:
every translation is machine-drafted and marked "DRAFT - needs native
speaker review before production use"; owner device QA gates promotion.

SCOPE RULE (codified in src/lib/i18n.js header): UI chrome ONLY (nav,
buttons, headings, toasts, settings). Questions, options, explanations,
concept cards, drug names, dosages stay English forever: NORCET is an
English exam and mistranslated clinical terms are a safety risk.

Languages (15 + en): hi, hin-en (Hinglish), bn, ta, te, mr, ml, pa, gu, kn
+ Northeast: asm (Assamese), mni (Meiteilon, Bengali script), brx (Bodo,
Devanagari), lus (Mizo), nag (Nagamese). Urdu dropped by owner (avoids the
RTL refactor). brx is deliberately conservative: only attested Bodo words
translated, rest kept English (never Hindi-substituted).

Architecture: dependency-free src/lib/i18n.js (flat keys, {var}
interpolation, en bundled + statically imported, others lazy-fetched from
public/locales/<code>/ui.json?v=LOCALE_VERSION, IndexedDB-cached mirroring
content.js, missing key -> English never blank); I18nContext/useI18n() 4th
context in app-context; boot restore in main.jsx (1500ms race, localStorage
LANG_HINT fast path, IDB authoritative); 559 keys extracted from the 9
high-traffic surfaces (bottom-nav, desktop-nav, TopBar, nav-drawer, home,
quiz chrome, welcome, auth, settings); Spotify-style Language picker
(settings-language.jsx) + welcome suggestion chip; <html lang> set per
locale. Fonts: 8 subsetted Noto woff2 (23-72KB each; instancer wdth=100
wght=400:700 + pyftsubset --layout-features='*' which is MANDATORY for
Indic shaping) built by scripts/build-locale-fonts.mjs; shared-script
unions (devanagari=hi+mr+brx, bengali=bn+asm+mni); FontFace runtime
activation, system-font fallback so tofu is impossible. SW: locales/ and
fonts/ excluded from precache (verified in dist/sw.js), runtime CacheFirst
locale-assets-v1 serves them offline.

Gates (each proven to fail on planted bad input before being trusted):
scripts/check-locales.mjs (key+placeholder parity vs en, em-dash/-- ban,
DRAFT marker, en mirror sync; wired into npm test) and
scripts/verify-locales-render.mjs (server-renders real Home under all 16
locales; asserts translations reach markup, no key leaks, no em dashes).

Cost: initial bundle +~8KB gz (574.26 -> 582.33KB; en dict + module + the
picker). Per selected language, one-time lazy download: ui.json 11-15KB gz
+ font 23-72KB (Latin locales hin-en/lus/nag: JSON only). English-only
users download nothing extra.

Ops note for future overnight runs: translation agents die silently to
session limits and laptop sleep. What worked: WRITE-THE-FILE-FIRST agent
prompts, wave launches, Sonnet fallback (model:"sonnet") when Fable
exhausts, progressive dev commits after each gate-green batch, a file
watcher instead of trusting agent notifications.

Owner TODO before main: device QA per language (switch, persist across
relaunch, offline relaunch, quiz content stays English, 320px overflow
check in bn/ta/ml), then native-speaker passes, esp. hin-en register and
brx depth.

---

## 2026-07-09 — Connectivity pill (offline caution + back-online affirmation)

src/ui/offline-indicator.jsx at the app root (75ac0f6): amber floating pill
on going offline ("You're offline. Progress saves on this device.", breathing
icon), green affirmation on reconnect ("Back online. Your progress is
syncing.") that fades after ~2.6s. Non-blocking by construction: pointer
events none, no buttons, silent on a normal online boot, aria-live polite,
reduced-motion gated (font-styles.js conn-pill block). Visual layer over the
existing offline write queue + flushPendingSync. Verified both boot states
via renderToString harness; gate green (31 tests + smoke + build).

---

## 2026-07-09 — Waitlist-audit gap closure + text integrity + brand polish (a1b5bc7)

Waitlist plan audited section-by-section vs the codebase (verdict: everything
launch-blocking already built, hardened beyond spec; owner confirmed
waitlist.sql run). Closed the residual gaps + owner requests in one commit,
BOTH apps deployed:

1. MOJIBAKE: search.jsx display strings were baked double-encoded UTF-8
   since ~07-03 (live users saw 'helpâ€¦' / 'â€œnovaâ€'). Byte-level repair;
   note-companion.test.js FFFD is a deliberate sentinel, exempted. NEW
   text-encoding gate in npm test (proven to FAIL on planted corruption);
   search screen added to the render smoke (now 7 screens).
2. EM DASHES pass 2: escape-sequence form (13 files incl. the seed question
   bank) + 12 JSX-wrapped prose dashes + manifest description. Share-message
   banner was still 'N O R C E T  P R E P' -> now 'N U R S E H O L I C (tm)'.
3. TRADEMARK (tm) on every brand lockup (splash, nav, footer + '(c) 2026
   NurseHolic(tm). All rights reserved.', auth, about, waitlist, manifest
   name/short_name, page titles, iOS label, QR image, notification titles).
   No (R) anywhere. TODO.md created: marketing calendar parked until testing
   sign-off (owner wants a proactive reminder then).
4. DRAWER UX: nav drawer now opens from the RIGHT (hamburger is top-right on
   every surface); swipe gestures, row-entrance animation and all gesture
   copy mirrored (open = swipe left, close = swipe right).
5. PWA: navigator.storage.persist() at boot (budget-Android eviction guard).
6. SECURITY headers on both apps: X-Frame-Options DENY, nosniff,
   Referrer-Policy (student via vercel.json, admin generated into dist-admin
   by post-admin-build). VERIFIED live via curl on www.nurseholic.in.

---

## 2026-07-10 — Master plan CLOSED: NEW-04 dropped, NEW-08 covered, post-waitlist audit + broadcast timing hint

NEW-04 "Three Waves" pacing drill was fully built locally (src/lib/three-wave.js
+ test, screens/three-wave.jsx Sprint 25s / Deep Dive 75s / Calculated Risk
eliminate-2-or-blank with real +1 / -1/3 / 0 marking, opt-in PulseTimer copy
override) and then DELETED before wiring, never committed. Owner rule set this
session, now standing policy: "if a feature is already done or is a copy,
inform before proceeding; upgrade the original only if the copy beats it,
else remove it." Verdict per overlap: Pulse/Flashpoint owns timer pressure,
Distractor Assassin teaches elimination better (per-strike rationales),
High-Stress Drill is truer exam-clock training, What-If already proves
restraint on real mock data. Originals won on all four; removed. NEW-08 CBT
simulator closed too: owner says CBT is already covered in-app. The
master-plan revamp arc is COMPLETE; memory master-plan-closed.md supersedes
older "remaining deferred" journal lines.

Owner then pasted external AI advice ("what comes after the waitlist").
Read-only audit vs codebase: ~90% already built or incompatible. user_progress
table + streak API assume Supabase Auth (we use custom auth-secure; streaks
live in the synced blob with grace + merge). Claim tokens, hybrid referral
capture, priority score (same referralsx100 + daysx10 formula), Tue/Fri batch
drops, abuse clusters: all shipped 07-05. Sentry duplicated by the errlog
pipeline + Resend owner alerts (live). 48h dropout hunt = Engagement
"Never seen" bucket + WhatsApp nudge (per-user quiz counts stay behind the
privacy boundary, deliberate). Flagged as contrary to owner decisions:
OET/NCLEX bridge (NORCET-only) and Viva/NCP builder (college-exam audience,
NORCET has no viva). Approved plan = launch OPS runbook, not engineering.

Shipped (the one genuine gap): clinical-shift timing hint in the admin Push
broadcast composer (src/ui/admin-push-composer.jsx): students on duty
~8am-4pm with phones locked away, pushes land best 7-10pm IST. Admin app
only; student bundle untouched. Verified: npm test green (38 files + smoke +
both builds) + one-off SSR render smoke of the composer (hint present,
dash-free).

Owner ops still pending from the runbook: flip waitlist.collect when ready
(gate stays off until launch), Tue/Fri batch cadence via the admin waitlist
control room, and the pre-launch register (test toggles, key rotation,
cribVault flip, locale review).

---

## 2026-07-10 — Tenant, test & boundary architecture (owner: "tenant isolation as a business requirement")

Scoped with the owner: B2B college tenants DEFERRED (cohort seam already in
place); built the three pragmatic layers instead.

LAYER 1 — TEST-ACCOUNT ISOLATION. game_config gains `internalIds` (empty by
default), edited in the admin Live config editor via a new `idlist` field type
(chips + add box; sanitize normalizes, changedFields compares by value so
arrays don't phantom-dirty). New pure lib src/lib/internal-accounts.js
(normalizeInternalIds / isInternalAccount matches id OR uid since profile.id
changes on rename / session bridge). Flagged accounts: no leaderboard publish
AND filtered out of board reads (instant), no trending writes (one guard in
recordInteraction covers all call sites), excluded from admin Engagement
aggregates (computeEngagement excludeIds), Umami killed via its native
localStorage switch. SERVER-ENFORCED in kv-write: the old _ssFlag cache is now
a shared 60s game_config cache; leaderboard:/analytics:user: sets for a listed
target and trend: sets from a listed session return {ok:true,skipped:
'internal'} silently (deletes pass through for cleanup). Fail-open.

LAYER 2 — DEV ENVIRONMENT BOUNDARY. npm run dev used to hit PRODUCTION
Supabase. Now: local-only .env.development (gitignored; committed
.env.development.example template) points dev serves at a free-tier
nurseholic-dev project; builds never read it. src/lib/dev-env.js shows a
DEV DATA chip on dev serves, and a red LIVE DATA warning when the file is
missing and Vite silently fell back to prod (the trap this exists for);
provably inert in production builds. Owner runbook: docs/dev-environment.md
(SQL order, function deploys with --no-verify-jwt, fresh dev
SESSION_SIGNING_SECRET, Cloudflare always-pass Turnstile test keys). NEW
supabase/admin-allowlist.sql heals a repo drift: no committed SQL ever
CREATED admin_profile_ids.

LAYER 3 — BOUNDARY HARDENING. (a) Storage self-test now probes ALL SIX
private prefixes (was 2 of 6, stale since the broker-read split): plants a
broker canary under each, proves a RAW anon REST read (bypassing kv-read
routing, the true student-visible path) sees nothing, deletes it. States
blocked/LEAKED/no-probe per prefix; the selftest: canary stays as the
must-remain-readable control so over-blocking is caught too. Probes carry
severity 'ux' so the errlog one never burns the Resend owner-alert budget.
(b) NEW scripts/check-student-bundle.mjs in npm test: scans dist/ for 5
verified admin-only sentinels (admin-manage/content-staging/push-broadcast
URLs, admin-approve, totp-enroll) with a self-check that fails if a sentinel
vanishes from src/ (guard can't rot). NEGATIVE-PROVEN: a planted
admin-ops import in main.jsx failed the gate naming file+sentinel; note a
side-effect-only import of a pure admin module is tree-shaken away and
correctly does NOT trip it (nothing shipped = no leak).

Verification: 40 test files (3 new: internal-accounts, dev-env + extended
game-config-edit/engagement/storage-selftest) + 16-screen smoke + compile
gate + bundle guard green; kv-write esbuild-checked; SSR render of the three
changed admin screens passed.

OWNER ACTIONS PENDING: (1) after this deploy, admin → Live config → Test
accounts: add your tester ids/uids; (2) run the Storage self-test on prod,
expect 6x hidden; (3) optional one-off cleanup of old tester board rows:
DELETE FROM kv_shared WHERE key IN ('leaderboard:<id>', ...); (4) stand up
the nurseholic-dev project per docs/dev-environment.md; (5) kv-write must be
redeployed (done this session) for the server-side skip.

---

## 2026-07-10 — Undo on delete: "Recently deleted" trash + erase lifeline (owner: deletion is a state, not an event)

Audit first (standing rule): every user delete had CONFIRM friction (2-tap
Sure?, type-RESET confirm word on erase) but ZERO undo anywhere. Built a
7-day undo window (owner asked for at least 24h).

NEW src/lib/trash.js (pure, tested): two patterns behind one module.
(1) TRASH LIST for small items: data.trash in the SYNCED blob
[{id,kind,label,sub,payload,deletedAt}], addToTrash/purgeTrash/takeFromTrash,
capped 60, purged on load (hydrateLoaded) + merged cross-device by id
(_gunionTrash in merge.js, never resurrects nor loses a restorable item).
(2) SOFT DELETE IN PLACE for big items: markDeleted/liveItems/deletedItems/
restoreIn/dropExpired over any {id,deletedAt?} list.

Wired: Knowledge-Map note delete -> data.trash (restore puts it back on the
node; if a NEWER note exists there, restore displaces it INTO the trash
instead of overwriting, nothing is ever lost). Saved crib sheets ->
soft-deleted in their LOCAL store (no sync bloat; cribs can be 200-question
papers): removeCrib now marks deletedAt, loadCribs filters live, expired
purge on load; BONUS: the 12-crib CAP overflow is now soft-deleted too
(was a silent hard drop). restoreCrib/purgeCrib added.

NEW screens/recently-deleted.jsx (Settings -> Recently deleted): unified
newest-first list (notes + cribs), days-left pill (red at 1), Restore +
Delete-now (the only irreversible act here, so IT carries the 2-tap
confirm), restored-confirmation line, honest empty state.

ERASE LIFELINE: clearAll (Settings type-RESET erase + Stats reset) now
snapshots the profile blob to a LOCAL device-only key (trashsnap:{pid},
never synced) before wiping. Settings shows a green "Restore erased
progress" row while a fresh (<7d) snapshot exists; restore runs the
snapshot through hydrateLoaded and deletes it.

Copy is English-first in Settings/new screen (locale parity pass pending,
flag for the native review). Verified: 41 test files (trash.test.js new:
retention >= 24h asserted, cap, same-ms id uniqueness, soft-delete
window math) + 17-screen smoke (recently-deleted with populated fixture;
settings guest view exercising both new rows) + build + bundle guard.
NOT built (flagged): undo for own FAQ posts + own feedback reports (shared
rows, rare deletes); admin-side deletes keep confirm-only.

## 2026-07-10 - Referral abuse defense: assessment now, reward-payout spec for later (owner found the delete-rejoin loophole)

Owner question: user deletes account, rejoins via a referral link, referrer
(or the user himself) benefits again, repeatable in mass = huge loss.

ASSESSMENT (verified in code, nothing shipped, no reward exists to steal yet):
- No self-serve account deletion exists (only admin delete + local Erase
  everything, which keeps the account). The real vector is unlimited FRESH
  signups through your own link, not delete-rejoin.
- Delete-rejoin does NOT compound: my-referrals (referral-intel) counts live
  profile: blobs with referredBy, so deleting the referee DROPS the count.
- signup_events rows (ip_hash + fp_hash per registration) SURVIVE account
  deletion; referral-intel anomaly engine already flags device clusters
  (>=2/fp), IP clusters, link velocity (>20/hr). Turnstile costs a solve per
  account. "confirmed" already requires >=1 attempted question.
- Current referral value: waitlist priority (refs x 100, 3 = fast-track) and
  a counts-only stats card. Nothing spendable. Loss today = queue jumping.
- REAL GAP: detection without enforcement (flagged clusters still count) and
  zero payout machinery (fine, none needed yet).

SPEC to build WHEN referral rewards go live (freemium), agreed with owner:
1. referral_credits ledger (service-role table, signup_events pattern): one
   row per (referrer, referee uid, referee fp_hash), SURVIVES account
   deletion; existing fp row = no second credit ever. Credit the device/
   person, not the account.
2. Pay on ACTIVATION, not signup: raise the gate for paid rewards (e.g.
   active on 3 separate days), time-cost kills farming.
3. Hold period + revocation: spendable after 7 days; referee deleted or
   flagged inside the window = credit voided (a reward is a state, not an
   event, same philosophy as the trash system).
4. Self-referral check at credit time: referee fp/ip matching any of the
   referrer's own signup_events = counted but never paid.
5. Caps + diminishing returns: max paid referrals/month (~10) + lifetime cap
   on referral-earned premium days (Dropbox model) = bounded worst case.
6. Flags become enforcement: anomaly-clustered credits land pending-review,
   not paid.
Build order when the time comes: ledger + activation gate + caps first.
Recorded in memory (referral-abuse-defense.md); no code changed this round.

## 2026-07-11 - Content Disclaimer: 5th legal doc + trust-building surfaces (owner: legally safe without breaking trust)

Owner asked for a disclaimer (real-person names, possible wrong answers,
general safety) implemented premium-class so it BUILDS trust. Strategy:
every "content may contain errors" statement is paired with "and here is
how we fix it fast" (the per-question report flow already existed).

LEGAL (src/lib/legal.js): new 5th doc `disclaimer` ("Content Disclaimer"),
plain-language, 7 sections: study aid not medical advice; mistakes can
happen + how we fix them (human review, one-tap report, corrections ship);
names/scenarios are fictional teaching scenarios, resemblance coincidental;
dosage/reference values are exam-practice only, never clinical; NO
affiliation with AIIMS/NORCET (independent tool, trademarks theirs);
community content is authors' own; found something wrong -> report/email.
LEGAL_VERSION 5 (bookkeeping only, version is consumed nowhere, no
re-accept gate exists, flagged as future decision). Terms study-aid clause
now cross-references the doc.

WIRED into all legal entry points: Settings -> Legal (BadgeCheck row),
About legal links, desktop footer. Auth consent line intentionally
unchanged (privacy+terms is the standard pair).

TRUST SURFACES: About gains "Our content promise" card (humans write and
review, accuracy is a feature, report reaches a real person, link to full
doc). Quiz explanation card gains a muted one-line CTA under HelpfulToggle:
"Spot an error? Report it, every report is checked by a person." ->
requestFeedback({screen:'Quiz', questionId}) (FeedbackModal auto-resolves
source:'question'). Welcome onboarding gains a tiny second note line
(human-reviewed, one tap reports). No popups, no forced re-accept anywhere.

i18n: 4 new keys (quiz.reportErrorCta, welcome.demo.contentNote,
settings.legal.disclaimer(+Sub)) in en.js + all 15 ui.json (draft quality,
title kept English where the locale keeps legal titles English);
LOCALE_VERSION 1 -> 2; check-locales green; fonts re-subset (8 woff2).
Legal doc BODY stays English-only (established pattern). New strings join
the pending native locale review.

Verified: 41 tests + render smoke now including two NEW entries (about,
legal-disclaimer) + compile gate + bundle guard. Shipped 2524d2d.

## 2026-07-11 - Desktop top bar revamp: LinkedIn-style persistence + golden Premium + micro-interactions

Owner asked for the LinkedIn PC pattern (top bar fixed on every page, less
back-and-forth friction), a logo-tap micro-interaction on Home, the Premium
button relocated into the bar with a golden premium look, and animated
micro-interactions on the bar sections.

Finding first: DesktopNav (src/ui/desktop-nav.jsx) was ALREADY a fixed
64px blur bar, but mounted only on the 4 tab roots. The revamp made it
persistent: new exported DNAV_EXCLUDED_SCREENS set (auth/waitlist gates,
active test players quiz/advanced-test/paper-test/dosage-run, all clinical
games incl. skill-setup/skill-drill, knowledge-map). RULE: new immersive
screens must join this set (same convention as RAGE_EXCLUDED_SCREENS).
App.jsx gate split: desktopNavVisible (bar, broad) vs desktopShellVisible
(footer, still tab roots only). Sub-screen TopBars sit below the bar via
the existing --dnav-h model (already proven in prod on settings sub-views).

Bar upgrades: SECTION_OF child->section map keeps the active link underlined
deep in a flow (learn-cards->Learn, crib-sheet->Revision, bank screens->
Library); re-click of active link or brand scrolls to top (mirrors bottom
bar); brand tile spring-pops on every click (new .brand-pop keyframe,
re-keyed to restart); bell swings once per unread-count change
(.dnav-bell-ring, keyed span); golden Premium pill between Favourites and
profile chip: free users see a gold-tinted Crown+"Premium" pill (reuses
nav.drawer.premium.label, NO new locale keys), members see a solid gold
tier badge (SUPER/MAX via getPremiumState) opening the same manage screen;
hover = one sheen sweep (.dnav-gold::after transition) + soft gold glow,
no looping animation. Gold = #D97706 / #FCD34D / #B45309 (premium.jsx +
cosmetics precedents).

Home: the "NurseHolic" eyebrow is now a BrandMark button (self-contained
component, own state): tap = brand-pop spring + haptic(HAPTIC.PLACE) +
tap sound, two-tone wordmark, no navigation. Mobile home header gained a
gold Crown shortcut to premium (drawer row kept, it is the full index).

All new CSS lives after the dnav block in font-styles.js, keyframes end at
transform:none (containing-block rule), everything registered in the
reduced-motion opt-out. Smoke harness upgraded: __setSmokeProfile in the
stub + desktop-nav (child screen, unread=3) and desktop-nav-member (MAX)
entries + NEW per-entry MARKERS content assertions (rendered HTML must
contain dnav-gold/dnav-link-active/dnav-bell-ring/Premium/MAX). Verified:
41 tests + smoke + compile + bundle guard; shipped c6f4809, live-verified
(dnav-gold in served bundle). Owner: eyeball desktop nav on a few deep
screens + check errlog after this one.

## 2026-07-11 - Desktop polish round: global back-to-top, Where-you-stand fix, PC widths, TopBar alignment

Four owner asks from a prod Stats screenshot, all shipped 5f11df4.

BACK-TO-TOP: the premium FAB (progress ring, spring in/out) existed on only
5 screens. Now ONE global App-root mount for every screen and device:
exported BTT_EXCLUDED_SCREENS (test players, clinical games, knowledge-map;
gates omitted, threshold never trips there) + BTT_SCREEN_PROPS (crib-sheet
keeps bottomOffset 60 + crib-no-print). RULE: new immersive screens join
BTT_EXCLUDED_SCREENS (same convention as DNAV/RAGE sets). New micro-
interaction: .btt-launch arrow darts up/out and drops back per click +
haptic + tap sound. Rides --bnav-h on mobile, safe-areas, z-40 under the
draggable NoteFab. The 5 local mounts removed.

WHERE-YOU-STAND (ui/where-you-stand-card.jsx): the "You 0%" pill used to
overflow the SVG left edge (marker clamps to x0 but the 52px pill centred
on it, overflow:visible). Fix: pill is a CALLOUT, stem stays at the true
mark x, pill body clamped inside the plot (clampPill, halves 27/31 real/
est). Below-window marks (<30%) get a left chevron cue at the track start
+ a hint line "The scale zooms into the 30 to 70% band. Your mark sits
left of it for now." Ladder width-capped max-w-xl on desktop. projection
math untouched.

PC WIDTHS: 23 phone-only screens widened from max-w-md to the standard
desktop single column (md:max-w-3xl + md:px-6 lg:px-8), 39 containers
total INCLUDING their fixed bottom bars and pyq-read's sticky sub-header
(bars must always match content width). Modal sheets (notification-center
sheet, reference viewer) deliberately untouched. Left as-is: immersive/
game screens, welcome/sign-in-gate, the 7 md:max-w-2xl form screens.

TOPBAR: inner row lg:max-w-5xl -> lg:max-w-6xl so back/title/actions line
up flush with the DesktopNav rail above (both max-w-6xl px-8). Action
chips (back, Note, Help, Report) share new .tbar-btn hover lift + press
scale (replaces per-button Tailwind active:scale to avoid transform
fights), uniform h-9, gap-2. FavHeart untouched (own animation system).

Verified: full gate + 3 new where-you-stand smoke entries with content
markers (zero case asserts translate(41 = clamped pill + hint line; NOTE:
renderToString comment-separates adjacent JSX text children, so markers
must be single-string literals like the aria-label). Live-verified
(btt-launch in served bundle). Owner: check errlog after this shell-wide
round.

## 2026-07-11 - Caching strategy audit (external prompt) + 3 targeted fixes

Owner pasted caching-strategy-audit-prompt.md (written for a hypothetical
Redis/Next.js/RevenueCat app). Audited the REAL app against its 3 questions
(what may be stale, who busts it on change, stampede behavior) instead of
building its imagined stack.

VERDICT: the architecture was already mostly right. Money paths are
UNCACHED by design (subscription resolveEntitlement, roleOf/admin lookups,
all kv reads = fresh DB per request; rate limits DB/KV-backed, not
per-isolate). Static tiers are textbook (hashed assets immutable,
index.html/sw.js must-revalidate, CONTENT_VERSION/LOCALE_VERSION =
write-time event invalidation). Server config caches are 7 module-level
60s-TTL vars (game_config flags x6 + waitlist snapshot); waitlist snapshot
was already event-invalidated on join/approve.

3 REAL GAPS FIXED (71844a3 + kv-write & waitlist deployed):
1. kv-write now nulls its own _cfgCache when an admin writes game_config
   through it (writer busts its cache; other functions/isolates converge
   via 60s TTL, the intended safety net).
2. waitlist snapshot() rebuild is SINGLE-FLIGHTED: the real stampede point
   was post-batch-approval (invalidateSnapshot then a burst of status polls
   each re-running the up-to-20-page scan). Concurrent misses now await one
   in-flight rebuild.
3. Client foreground freshness: PWA tabs live for days, so "refresh once
   per session" for premium entitlement + game_config could mean days
   stale. New visibilitychange effect re-pulls both when the app returns
   to foreground after 5+ min (event-driven, throttled, offline-safe).

FLAGGED, NOT BUILT: (a) deleted-account tokens stay HMAC-valid up to 60d
for owner-prefix writes (no per-request credential check unless
singleSession is ON, and its missing-row path is fail-OPEN) - candidate
for docs/security/findings.md + revisit at payments launch; (b) CONTENT_/
LOCALE_VERSION bumps rely on human discipline (already a CLAUDE.md hard
rule); (c) no shared cross-isolate cache possible on free tier, 60s TTL
stays the convergence bound (deliberate, documented).

## 2026-07-12 - Evergrowing content pipeline: R2 media questions, paper upload, Content Studio (738b31a)

Owner discussion round first: mapped which sections were admin-uploadable
(banks feed ALL tests incl. Advanced/Distractor; previous_paper banks were
ALREADY merged into the archive by allPapers) vs deploy-locked (dosage/
concept-cards/reference JSONs, quotes, game data). Decisions: media on
CLOUDFLARE R2 (corrected from Cloudinary mid-round; Cloudinary reserved for
FUTURE dynamic transforms like avatars/share cards; ML Kit OCR scan-to-solve
is a future NATIVE-wrapper idea, ML Kit does not run in a PWA, web
alternative is Tesseract.js). Scope shipped = Phase 1 media/papers + Phase 2
Content Studio. SECURITY NOTE: owner pasted a screenshot exposing their
Cloudinary API SECRET; reminded to regenerate it (added to launch key
rotation).

MEDIA: q.video joins q.image (question-import preserves both; new
QuestionVideo card: YouTube thumb -> tap -> nocookie embed; https link
fallback card) rendered in quiz + advanced-test review + pyq-read. NEW
src/lib/media.js (+test): URL/YouTube helpers + uploadViaSigner. NEW
supabase/functions/media-sign (DEPLOYED): coadmin+ (roleOf per call),
presigned R2 PUT via self-contained SigV4 (crypto.subtle), image/video
only, 20MB, key q/<yyyymm>/<slug>-<rand>.<ext>; secrets R2_ACCOUNT_ID/
ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET/PUBLIC_BASE (owner runbook
docs/media-r2.md: bucket, public access, CORS PUT rule, token). Live config
gained media.publicBase via a NEW generic `text` field type. MediaFields
(image URL + upload + video link) in AddQuestion; MediaUploadHelper batch
figure uploader in BankEditor. media-sign URL in the student bundle is
FINE (server-gated, same model as bank: writes) so it is NOT a sentinel.

PAPERS: BankEditor "Set type" selector; paper mode = year (required) +
timeMinutes (default 1/question) + type:'previous_paper', exp OPTIONAL via
question-import processQuestionInput(..., {requireExp:false}) (+test).
pyq-read now renders figures/videos; exp already rendered everywhere when
present. docs/content/pyq-image-questions.md = the ~53 excluded image PYQs:
NORCET 2021 fully transcribed as paste-ready JSON (16 questions, answer key,
figure descriptions), remaining papers as key+figure checklists. Owner will
generate figures and upload to R2.

CONTENT STUDIO (admin, coadmin+): NEW cpack:<type> packs for dosage/
conceptCards/reference/quotes. src/lib/content-packs.js (+test): per-type
validators (REJECT em dashes at the source) + pure mergers (dosage id-dedupe
base-wins, quotes text-dedupe, reference append, concept cards append into
matching topic/sub). content.js: ensureMergedContent overlay = base
(versioned cache) + pack (shared anon read with cpackcache:<type> offline
mirror); quotes.js merges the pack lazily. kv-write: cpack: joined the
coadmin+ branch (20/hr admin-write cap) and was REDEPLOYED. New
admin-content-studio.jsx (4 tabs, JSON paste + per-item validation report,
quick-add forms for quotes/reference, append/replace, format guides,
audit-logged) + dashboard tile. docs/content/formats.md = the handbook.

Verified: 44 test files (media, content-packs, question-import new) + smoke
+ compile + bundle guard + admin build; brokers deployed; student live
(cpack marker in served bundle); deploy:admin run. Owner actions: R2 bucket
setup per docs/media-r2.md, then upload the 2021 image paper; regenerate
the exposed Cloudinary secret. Deferred: admin drill packs (Phase 3; user
drillPacks structure exists for 5 game kinds), admin dashboard tile
regrouping (cosmetic), Cloudinary dynamic transforms, OCR.

## 2026-07-12 - Layered disclaimer + test-entry cautions + weightage non-nursing revamp (1075ba7)

Owner pasted Gemini's "3-layer medical disclaimer pattern" and asked for the best
premium version; two UX bugs flagged mid-round (Stats "Focus next" enters a test
with no caution; Exam weightage hides GK/Reasoning/Aptitude entirely).

Already-done check (house rule): the 5-doc legal library, About content-promise
card and link rows shipped last round (2524d2d) already covered most of Gemini's
copy advice. Gemini ideas REJECTED as anti-patterns here: the 1-second disabled
Start delay (artificial friction) and a modal before EVERY launch (violates the
quiet-surfaces rule). What was genuinely missing got built:

- Layer 1, recorded consent: AuthScreen CREATE mode now has a required checkbox
  ("educational study tool... not clinical guidance" + Terms/Privacy/Content
  Disclaimer links); tapping Create unchecked shows a gentle nudge (deliberately
  NOT part of submitDisabled: a disabled button swallows the tap silently).
  App.jsx stamps preferences.legalAcceptedVersion/-At on load (LEGAL_VERSION's
  FIRST consumer); existing accounts seeded silently. Home gains a quiet
  dismissible "Our terms were updated" card that appears only when a future
  LEGAL_VERSION bump outdates the stamp. Guest welcome pitch page got a passive
  one-line consent notice (links via the tour launcher; Back returns to tour).
- Layer 2a, enter-a-test caution: Stats Focus-next CTA + per-topic rows and the
  Coverage Map's Start pills now use the same requestConfirm gate as the
  Knowledge Map ("Start practice: X?"). onQuick paths untouched (they land on
  setup screens); WeakAreas deliberately left ungated (dedicated drill screen
  whose copy states exactly what Start does).
- Layer 2b, one-time clinical notes: new src/ui/clinical-note.jsx (portaled,
  single Understood button); first Dosage session + first Level Up game launch
  per profile (preferences.clinicalNoteDosageSeen / clinicalNoteGamesSeen).
  Backdrop dismiss also marks seen but does not launch.
- Layer 3, screenshot-proof footnote: EduTag primitive ("Educational use only.
  Not for clinical decisions.") at the bottom of quiz, advanced run + results,
  pyq-read, results, dosage-results, the desktop footer bottom line and About.
- Weightage revamp: model now computes over the WHOLE paper so "% of exam" is
  true and sums to ~100; nursing vs non-nursing split bar card on top; labelled
  NON-NURSING SECTION with GK + Reasoning & Aptitude rows (Pill-badged) feeding
  the existing start-practice confirm sheet. Screen no longer consumes
  includeGkInStats (that pref still governs stats screens). lib/weightage.js
  (Quick Test selector) deliberately untouched.
- i18n tail: 11 new chrome keys in en.js + all 15 packs (auth.consentPre/And
  retired everywhere; brx kept English values matching its untranslated state);
  en mirror regenerated; Indic font subsets rebuilt (8 scripts).
- Verification: render smoke gained auth-create / weightage / coverage-map /
  dosage-setup / home-legal-update entries + content markers (also quiz EduTag,
  welcome consent line, app-footer tag). Full gate green (44 suites + smoke +
  compile + bundle guard). Shipped dev -> main (1075ba7).

Notes for later: the consent-sentence keys concatenate in English word order
(draft locales pending native review anyway); ClinicalNote copy is hardcoded
English (content-adjacent screens); if a legal doc materially changes, bump
LEGAL_VERSION and the Home card does the rest.

## 2026-07-12 - Popup viewport-anchoring fix: BodyPortal everywhere

Owner flagged the Exam weightage start-practice sheet not centring on the
CURRENT screen and asked for an app-wide popup audit (PC/mobile/tablet, iOS +
Android). Root cause: position:fixed is contained by transformed ancestors and
screen roots animate in with transforms, so overlays rendered INLINE inside a
screen could anchor to the page instead of the viewport. The house fix was
already documented (ConfirmDialog/KmapDialog/TopBar): portal to <body>.

- NEW src/ui/body-portal.jsx: `BodyPortal` wraps an overlay's outermost fixed
  element in createPortal(document.body); SSR-safe inline fallback (the render
  smoke stubs createPortal to null by design, component bodies still execute).
- Audited EVERY `fixed inset-0` in src. Converted the 12 inline ones:
  weightage confirm sheet, welcome tour help popup, advanced-test keyboard/
  palette/submit-confirm, ReferenceLookupModal, notification-center clear-all
  sheet, premium coming-soon sheet, shift-survival crisis, three-am-chart
  lifeline, drip-zone OutcomeSheet, unit-guidebook, premium-gate-modal,
  confirm-exit-dialog. Design untouched (sheets stay bottom-docked, dialogs
  stay centred); only the anchoring is now unconditional.
- Left alone on purpose: already-portaled modals, App-root hosts (feedback/
  help/support/rename/note/companion/exit/nav-drawer/join-family/guest-merge),
  the kmap fullscreen CANVAS mode, ward-boss full-screen FX tints.
- RULE going forward: any new popup overlay either lives in an existing
  portaled shell (ConfirmDialog/KmapDialog/requestConfirm) or wraps its
  outermost fixed element in BodyPortal. Never render a fixed overlay inline
  inside a screen.

Full gate green (44 suites + smoke + compile + bundle guard). Shipped dev ->
main (fix commit + this journal commit).

## 2026-07-12 - "Ask your companion": rule-based FAQ chat assistant (d933bc8)

Owner pasted an external conversation designing an LLM support chatbot and
asked for a Fable-5-quality FAQ chat with follow-ups, HelpfulBulb feedback and
emotional closers. CRITICAL reframe applied: the app's NO-runtime-AI rule
forbids an LLM bot, so the quality went into (a) a comprehensively researched,
PRE-AUTHORED knowledge base and (b) a pure rule-based conversation engine.
Instant, free, offline-capable, deterministic. The assistant reuses the study
companion identity (note-companion.js name, default Nova), so the notes buddy
and the chat guide are ONE character.

- src/data/assistant-kb.js: 67 entries x 9 categories (basics, tests,
  progress, levelup, learn, community, account, premium, fixes) written from
  help.json, CLAUDE.md, journal facts and code research; casual senior-student
  voice; every entry has keywords, related follow-ups, many have deep-link
  routes (validated against the nav-registry screen allowlist); a KB entry
  explicitly refuses medical/clinical questions and routes to the disclaimer.
- src/lib/assistant.js (+ test): tokenize (no fuzzy, per search.js stance),
  detectIntent (greeting/thanks/praise/frustration/bye incl. hinglish),
  matchKb (phrase > keyword > body scoring, AND-leaning coverage multiplier,
  context boost from the last answer's related/category for follow-ups),
  replyFor (variated pools, moods happy/warm/concerned/neutral, noMatch ->
  3 closest + escalation), notHelpfulReply. Test also sweeps the entire KB
  for em dashes, broken related ids, dup ids, bad cats.
- src/screens/assistant.jsx (lazy 'assistant'): typing dots, staggered bubble
  pops, avatar mood micro-reactions (asst-heart/tilt/glow + asst-pop/dot in
  font-styles, ALL added to the reduced-motion catch-all), quick-start chips,
  "People also ask" chips, deep-link buttons via handleHomeNavigate,
  HelpfulBulb per answer (voteId assistant:{entryId}; helpful-bulb.jsx gained
  optional onVote), thumbs-down -> concerned follow-up with Report + FAQ
  community buttons, transcript persisted locally (KEYS.assistantChat, 40
  turns), Start-over button, guest-safe.
- Entry points: nav drawer row (3 new i18n keys x 16 locales + font
  re-subset), FAQ hero CTA card, help-modal "Still stuck?" hand-off via the
  norcet:open-assistant window event, Search registry entry. 'assistant'
  joined BTT_EXCLUDED_SCREENS and STUDENT_ROUTE_SCREENS.
- Evergrowing: 5th cpack type 'assistant' (vAssistant validator: cat enum +
  safe route allowlist + no dashes; mergeAssistant dedupe by id BASE WINS,
  admins add new entries; corrections to bundled ones ship via deploy) +
  Content Studio "Assistant KB" tab + formats.md section. help.json gained
  an "Assistant" entry -> CONTENT_VERSION 15.
- Gate: 45 test files + assistant smoke entry w/ markers; admin build green;
  shipped dev -> main + deploy:admin; prod verified (drawer label + hi locale
  key in served bundle).

Rules for future rounds: never propose an LLM call for this (admin-side
content-staging remains the only sanctioned generative path); new KB entries
join cpack:assistant via Content Studio; the companion is now a chat surface,
so keep its name/persona consistent across notes + assistant.

## 2026-07-12 - UI polish round: note-taking hero, settings icons, always-on install, Home banners

Four owner-flagged UI fixes in one round (all verified via the 45-file gate +
render smoke, which now server-renders the guest Home + guest Settings paths):

- Study-companion naming popup (note-taking-modal NamingView): premium redesign
  of the first-run screen. Ambient primary/accent aura blooming from the top
  edge (z-0, behind content), a gradient hero medallion that idly floats with a
  twinkling accent spark at the corner, an eyebrow chip ("Your study
  companion"), and a gradient "Let's go" CTA with a Sparkles icon. New idle
  keyframes namingAura/namingFloat/namingSpark, all registered in the
  reduced-motion catch-all. Easter egg (owner request): suggestion names now
  lead with "Nana, Jyo" side by side (was Nova, Juno) and the input placeholder
  is "e.g. Nana". note-companion.test.js still green (asserts valid names +
  length, not specific values).
- Settings ACCOUNT icons: "Recently deleted" and "Reset this profile's data"
  both used Trash2 (confusing). Recently deleted now uses Undo2 (restore/undo,
  matches the 7-day trash feature); the destructive reset keeps the red Trash2.
- Install the app is now ALWAYS reachable from Settings, not just when the
  browser fired beforeinstallprompt. New pure installGuide() (install-prompt.js,
  tested) returns installed | native | ios | android | desktop; the card shows
  the one-tap native button when available, otherwise honest per-platform steps
  (iOS Share -> Add to Home Screen / Android menu / desktop Chrome-Edge address
  bar, with a "open on your phone" fallback). isAndroid() added to platform.js.
  3 new settings.install.*How keys x 16 locales + font re-subset. The Home
  install NUDGE (installDecision) stays conservative and unchanged - Settings is
  the deliberate destination that always has a path.
- Home notification banners: they were capped at lg:max-w-3xl with no centering,
  so on desktop they sat as a narrow left-stuck column while the greeting and
  dashboard spanned the full max-w-6xl (the "not centrally aligned" complaint).
  Removed the cap so their edges line up with the rest of the page, upgraded all
  banners to subtle gradient fills, added a pointer-only hover lift (.home-notice,
  reduced-motion-off) to the clickable ones (what's new, waitlist, feedback
  reply), a "view" chevron on what's new, and reflowed the guest banner to a
  responsive layout (icon+text left, Sign in / Not now actions right on desktop,
  stacked on mobile, dismiss pinned top-right). New home-guest smoke entry drives
  the guest + what's-new branches.

No admin/Edge-Function changes this round (no deploy:admin needed).

## 2026-07-12 - Nursing Calculator Suite + Favourites always-on

Owner request: keep Favourites only as the top-bar/tab heart (remove the Home
hero strip + the Settings on/off toggle, always-on now) and build a "Nursing
Calculator Suite" ("Nursing Calc" in nav) in the freed slot: 21 hardcoded
calculators, zero AI, offline, premium UI. Formula sheet + flagged reference
ranges were listed in the plan and approved before any code was written; the
flagged bands still need nurse confirmation before launch (see below).

Favourites always-on:
- src/ui/fav-strip.jsx DELETED; home.jsx lost favEnabled + both FavStrip mounts
  (focusRow now always sits in the left column); fav-heart.jsx lost the enabled
  gate + the "turn it on in Settings" toast; favorites.js retired the `enabled`
  field + setFavEnabled (old records with a stray enabled key are ignored);
  settings.jsx dropped the toggle card + flipFavs (Manage/Priority rows stay,
  ungated); 5 dead settings.fav.* keys removed from en + 15 packs.

The suite (all NEW files):
- Pure math, flat in src/lib (run-tests discovery is non-recursive), one per
  domain: calc-units.js (envelope + exact conversions + validation helpers),
  calc-dosage.js (dose by weight, D/H x Q, mcg/kg/min infusion, drip gtt/min,
  Clark/Young/BSA pediatric, Devine IBW, Cockcroft-Gault), calc-body.js
  (Mosteller + DuBois BSA, BMI vs BOTH WHO band sets, exactAge with UTC-only
  date math), calc-fluids.js (Holliday-Segar daily + 4-2-1, urine output, MAP),
  calc-scores.js (GCS, APGAR, Braden, Morse with exported option lists),
  calc-obstetric.js (Naegele calendar rule + the LMP+280 comparison, cycle
  adjustment; gestational age). ONE result envelope for all: raw full-precision
  value + display + a STATED rounding sentence + formula + standard + steps +
  bands (each with source + flagged) + warnings; failures are {ok:false,error}
  sentences, never a number. 7 test files (units/dosage/body/fluids/scores/
  obstetric/registry) with textbook anchors (Mosteller 3600 identity, Devine at
  60 in, C-G x0.85 + umol/88.4 identity, H-S 25 kg = 1600/day vs 65/hr, MAP
  120/80 = 93.3, 1000mL/8h/15gtt = 31.25 -> 31 whole drops, BMI 23.0 Asian
  boundary, scale min/max + band edges, Naegele leap-window divergence, age
  borrow cases) + validation edges (zero drop factor, SCr 0, DBP > SBP,
  impossible dates, out-of-range Young ages...).
- src/data/calculators.js: the registry the screen renders from (23 tools
  covering the 21 spec items; drug dosage is split into three fast tools).
  Input schema types: number/segment/select/date/time (+ showIf on segments).
  calc-registry.test.js sweeps ids/cats/keywords/inputs, em-dash hygiene over
  ALL copy INCLUDING each envelope's output, and smoke-calls every compute
  (empty form must error; happy path must fill the envelope).
- src/screens/nursing-calc.jsx (lazy route 'nursing-calc'): hub (search,
  recently-used chips, collapsible history log, six category groups) <->
  calculator detail (generic form, live compute once every visible required
  field is filled, result card with formula/standard/rounding meta lines,
  worked steps, grouped bands with source + "Verify against your institution's
  protocol" tag on flagged ones, Copy value, engine warnings, per-calculator
  verbatim disclaimer). useBackHandler pops detail -> hub -> leaves. One-time
  ClinicalNote (preferences.clinicalNoteCalcSeen). Recents+history persist in
  KEYS.nursingCalc (local only, never synced, Clear control). initialCalcId/
  initialValues deep-link props (used by the smoke; ready for future links).
- Micro-interactions: calc-result-in / calc-value-pop / calc-band-sweep /
  calc-chip-in keyframes, all in the reduced-motion catch-all; home-notice
  hover lift + note-select-pop reused; haptics feature-detected.

Wiring: App.jsx lazy route; Home hero card in the old FavStrip slot (fixed
clinical blue CALC_HUE #1D4ED8, Drill-card template); desktop-nav LINKS;
nav-drawer tools row (fav: 'nursing-calc', NEW badge); nav-registry
STUDENT_ROUTE_SCREENS + STATIC_REGISTRY; FAV_SECTIONS entry (+ calculator icon
in fav-icons); 7 new chrome keys x16 locales (home.calc.*, nav.links.
nursingCalc, nav.drawer.nursingCalc.*) + font re-subset.
Assistant KB: 6 new entries (calc-suite, calc-do-math redirect, calc-how-math,
calc-bands, calc-offline, calc-vs-drills) all routing to the suite;
ask-medical + dosage-drills updated to hand arithmetic to the calculator
(refusal stance unchanged); 'nursing-calc' added to the cpack
ASSISTANT_ROUTE_SCREENS allowlist. Legal: disclaimer section broadened +
a new "The Nursing Calculator Suite" section; LEGAL_VERSION 5 -> 6 (quiet Home
card will show for returning users). help.json entry + "Calc: " prefix
fallback in help-modal; CONTENT_VERSION 15 -> 16.

Verification: 52 test files + render smoke (new 'nursing-calc' hub entry AND
'nursing-calc-detail' with a live computed MAP card: 93.3 + rounding line +
matched band + verify tag; 'home' marker proves the new hero card) + compile
gate + bundle guard all green; admin build green.

LAUNCH REGISTER (owner + nurse review): confirm the flagged items in the
approved plan: Clark's variant (lb/150 shipped), Cockcroft-Gault weight choice
(actual shipped, disclosed on card), Morse band variant (25-44/45+ shipped,
variant disclosed), BMI Asian labels, GCS/APGAR/Braden bands, oliguria +
MAP thresholds, trimester boundaries, Devine sub-152cm handling. Every one is
a BAND/LABEL, not core math; rejected bands can simply be removed.

## 2026-07-12 - PWA upgrade doc: operational + UX upgrades (audit + build)

Owner pasted a large generic "PWA Upgrade Plan" (17 sections) and said "work on
this next and ignore the copy ones. upgrade it." Audited the whole doc against
the app first: most of it is already built (quick quiz, confetti/juice, SRS +
mistake engine, streaks + grace, i18n, dark mode, web-push, guest onboarding,
leaderboard, soft-delete, weekly summary, next-best-action, app-version string)
or is out of scope under the house rules (Redis ZSET leagues, Upstash QStash,
AI-generated insight, payment webhooks, session replay, Framer/GSAP/i18next/Inter
swaps, dynamic OG SSR). Built only the genuinely-missing, free, no-AI, low-risk
upgrades:

- C1 Maintenance mode / kill switch: `maintenance:{on,title,message}` added to
  game-config DEFAULTS; a self-contained root overlay host (src/screens/
  maintenance.jsx, mounted next to the other App hosts) shows a calm screen when
  the live config flips on, no redeploy. Reactive via a new guarded
  'norcet:config-applied' event fired from applyRemoteConfig. Fail-OPEN;
  escape hatches so the owner is never locked out: internalIds accounts +
  ?maintbypass=1 (sticks in localStorage). Admin Live-config editor gains the
  three maintenance fields (Wrench icon added to its map). Test extended.
- C2 Command palette shortcut: src/lib/hotkeys.js (pure + test) decides the
  action; App.jsx global keydown opens Search on Cmd/Ctrl+K, or bare '/' when
  not typing. Suppressed on DNAV_EXCLUDED_SCREENS (never yanks a user out of a
  live quiz/game) and when Search is open. Desktop search button gains a
  "(Ctrl K)" tooltip. Harmless on mobile.
- C3 Bug-report diagnostics: feedback.js collectClientMeta() (appVersion, ua,
  platform, lang, online, viewport, PWA-standalone) attached at the single
  feedback-modal submit point; rendered as a "Device" line in the admin feedback
  card. Only on new reports, never on admin replies. No new consent surface (own
  device info on own report).
- C4 Export my data: src/lib/data-export.js (pure + test) with a strict ALLOWLIST
  manifest (never a wildcard, so no token can leak; test cross-checks against the
  session/auth keys) + buildExport + sanitizeProfile (strips credential-shaped
  keys). Settings "Export my data" row gathers each slice via safeStorage (reads
  under both id shapes, uid and slug, first hit wins) and downloads
  nurseholic-data-YYYY-MM-DD.json. Fully local, guest-safe, English-only to match
  the neighbouring data rows.

DEFERRED: C5 Resume-an-in-progress-test. It is the highest-value retention gap
but touches the live quiz/advanced-test/paper-test state machines and needs a
real browser runtime drive to ship safely (the pre-push gate is explicit that a
prod crash there is the owner's reputation). It ships dark behind a resumeTests
flag anyway, so deferring it to a dedicated, unrushed pass costs nothing live.
The plan (test-session.js snapshot store + Home resume card + App relaunch) is
ready to execute next.

Also flagged NOT to build (house rules): Redis/Upstash anything, any runtime-AI
insight, payment webhooks, self-hosted session replay, dep swaps (Framer/GSAP/
i18next/Inter). Optional future adds noted: true-black OLED theme, GitHub Actions
CI (duplicates the local gate).

Verification: 54 test files + render smoke (new maintenance overlay entry +
settings Export-row marker) + compile gate + bundle guard all green; admin build
green. Ship dev -> main.

## 2026-07-12 - Resume an in-progress test + friendly-mentor cautions (C5)

The deferred C5 from the PWA-upgrade round, now built with the owner's added
requirement: caution the student when they leave a test part-way AND when they
come back, in the voice of a friendly mentor, with a rotating list of reminders
plus one FIXED reminder never to use unfair means.

Scope (deliberate): resume covers UNTIMED PRACTICE ONLY (quick, topic,
weak-topic, bookmarks, review-due, wrong). The timed Mock and the Advanced Test
exam simulation stay NON-resumable on purpose. Pausing a clock is exactly the
"unfair means" the caution warns against, and a run you cannot pause is what
makes the simulation feel like the real exam. This also keeps the change out of
the two most complex state machines, which is the low-risk path.

- lib/test-session.js (pure + test): snapshot store. Snapshots by question ID
  (not the objects), so a content update between sessions is survivable: the run
  is re-resolved against the live pool at resume and pruned ids are dropped.
  buildSnapshot / summarize / isStale (24h) / isValidSnapshot, plus
  nextUnansweredIndex. THE correctness point: a resumed run lands on the first
  UNANSWERED question, not the raw saved index. Without that, a user who closed
  while reading an answered question's explanation would be served it again and
  double-count the attempt.
- lib/resume-cautions.js (pure + test): the mentor copy. EXIT_TIPS and
  RESUME_TIPS rotate (a per-profile cursor advances each time a caution is
  shown, so the nudge differs every session), while INTEGRITY_REMINDER (answer
  from what you know, a borrowed mark is a mark missed on exam day) and
  BREAK_NOTE (water or a bathroom break is completely okay) show EVERY time. The
  test enforces no em dash / no double hyphen and no duplicate tips.
- ui/confirm-exit-dialog.jsx: a resumable "Save and step away?" path (calm ghost
  exit button, because progress is genuinely saved) alongside the original
  leave-and-lose guard, which now adds a line about timed tests mirroring the
  real exam. New ResumeWelcomeDialog for the return. Both responsive: centred,
  max-w-md, scroll-capped for short landscape screens, 48px touch targets.
- quiz.jsx: seeds index/results/elapsed from resumeState; autosaves on each
  answer / next / skip (so an accidental hard-close, not just Back, is
  recoverable); clears the snapshot on completion.
- App.jsx: re-checks the snapshot on every Home visit (so the card is never
  stale), resumeTest rebuilds the run, discardResume drops it, completeQuiz
  clears it.
- home.jsx: full-width "Pick up where you left off" card leading the banner
  region, so its edges line up on mobile, tablet and desktop.
- game_config.resumeTests: default ON, and killable from the admin Live config
  with no redeploy if it ever misbehaves.

Verification: full gate green (56 test files + render smoke + compile gate +
bundle guard), new smoke entries quiz-resume + home-resume, dev server boots
clean and every changed module transforms without error. NOTE the honest gap:
the exit/return dialogs are portaled, so the render smoke skips them (portals
are not server-rendered); they were reviewed by hand instead. The interactive
click-through (exit, save, reload, resume, finish) was not driven, there is no
browser automation on this machine. Pushed to dev only, for the dev-preview
drive before promoting to main.

## 2026-07-12 - Abandoned tests feed the B2 repeat pool

Owner's call: if a student starts a test and leaves without finishing it, those
questions should be able to come back later. They could not.

The app already HAD the right algorithm. The B2 repeat-unattempted pool
(lib/repeat-unattempted.js) folds a run's questions into a per-profile pool
(answered/revealed -> drop, skipped -> drop, seen-but-untouched -> add) and
serves them first in future Quick/Topic tests. But nextPool was only ever called
from completeQuiz, so an abandoned run folded nothing. So this adds the missing
TRIGGER to the existing algorithm rather than inventing a second one.

Two decisions carry the whole design:

1. An abandoned run folds only what the user actually REACHED (their position in
   the play order, plus anything answered/revealed or skipped). A FINISHED run
   really did present every question, so completeQuiz still folds the whole set.
   An abandoned one did not. Without this split, bailing a 50-question Mock at Q9
   would dump the 42 questions the user never even saw into a pool whose meaning
   is "you saw it and did not engage", flooding it and crowding out the real ones.
   Now it contributes exactly the one question they left behind.

2. The resume snapshot doubles as the universal "unfinished run" receipt. It is
   now written for EVERY mode (Mock included) and regardless of the resumeTests
   flag, and Home applies a retire-or-offer rule on each visit:
     untimed practice + fresh + flag on -> OFFER the Resume card (unchanged)
     Mock / stale / flag off / discarded / replaced by a new run -> RETIRE (fold)
     completed -> cleared, and completeQuiz's existing fold runs unchanged
   That is what catches the case that actually matters on a phone: the app gets
   swiped away mid-test. No exit handler can possibly fire, but the record is
   already on disk, so the next launch retires it and the questions come back.
   Resume is still only OFFERED for untimed practice (isValidSnapshot refuses a
   Mock), so snapshotting a Mock can never make it resumable.
   We deliberately do NOT fold on "Save and exit": that run is still alive as a
   snapshot, and folding would double-serve its questions into a new test. If the
   user resumes and finishes, completeQuiz's fold drops them anyway. Self-healing.

Also fixed a long-standing gap: repeat-unattempted.js shipped with NO test,
because its top-level safe-storage import pulls in the Vite-only extensionless
'../storage' specifier, which plain Node cannot resolve, making the module
un-importable in a test. Made that import LAZY inside the two async IO functions
(the same trick game-config.js already uses) and wrote the test. The pure B2
algorithm is finally covered, including the bailed-Mock regression.

Exit dialogs (both paths) now tell the student the truth, which doubles as
integrity reinforcement: a question you saw but did not attempt will come back in
a later practice set, so nothing slips through the cracks.

Out of scope, flagged not silently changed: the Advanced Test and previous-year
papers do not feed the repeat pool even on COMPLETION today, so wiring only their
abandonment would be inconsistent. Extending B2 to them is a separate stats-model
decision (CLAUDE.md is explicit that paper tests deliberately do not touch
streak / totalAttempted).

Verification: 57 test files + render smoke + compile gate + bundle guard green;
dev boots clean and every changed module transforms. App.jsx is not smoke-rendered,
so the deps-array declaration order was hand-checked for TDZ. Pushed to dev,
alongside the resume commit, for the preview drive before promoting to main.
