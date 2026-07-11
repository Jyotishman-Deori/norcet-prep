// =====================================================================
// CENTRALIZED STORAGE KEYS  (Pipeline step 2 / A6)
// ---------------------------------------------------------------------
// Every storage-key string used by App.jsx is defined here, in ONE
// place. Call sites import from this file and use KEYS.X or
// KEY_PREFIXES.X — never raw strings.
//
// Why this file exists:
//   Previously 12+ const declarations were sprinkled through App.jsx.
//   A typo in any one of them creates a *new* storage key silently,
//   no error, no warning — the user's data appears to vanish. You
//   only find out when someone reports lost progress.
//
//   This file is also the prereq for PROMPT 1 (cloud sync), which
//   wants to migrate STORAGE_KEY ('norcet:userdata:v1') to a
//   per-profile shape ('userdata:<profileId>'). The forward-compat
//   builder `KEYS.userdata(profileId)` is already wired up here so
//   P1's rename only touches this one file.
//
// CRITICAL — DO NOT CHANGE STRING VALUES:
//   Every string below must remain byte-identical to what's on disk
//   in real users' IndexedDB right now. Changing any of these strings
//   silently destroys existing user progress. Schema versioning (A11,
//   pipeline step 3) will introduce a safe way to migrate keys; until
//   then, ADD only, never RENAME or REMOVE.
// =====================================================================

export const KEYS = {
  // -- Per-device personal state (not synced across devices) --
  USERDATA:      'norcet:userdata:v1',  // main blob: progress, bookmarks, settings
  SESSION:       'norcet:session:v1',   // active profile pointer for this device
  HEALTH:        'norcet:health:v1',    // storage-layer round-trip canary
  THEME:         'norcet:theme:v1',     // 'light' | 'dark' | 'system'
  ONBOARDING:    'norcet:onboarded:v1', // used as prefix: `${ONBOARDING}:${profileId}`
  ADMIN_STATUS:  'norcet:admin:v1',     // { unlocked: bool, ts }

  // -- Session 1/2 additive personal keys (per-device). ADD only. --
  WEEKLY_SUMMARY_DISMISSED: 'norcet:weekly-summary-dismissed:v1', // ISO week str
  QUOTES_SHOWN:  'norcet:quotes-shown:v1',   // JSON array of shown quote indices
  NOTIFICATIONS: 'norcet:notifications:v1',  // JSON array of notification objects
  PUSH_SUB_ID:   'norcet:push-sub-id:v1',    // Vercel KV subscription id (Session 5)
  PUSH_SUB_TOKEN:'norcet:push-sub-token:v1', // C-5 capability token for /api/active
  PENDING_REFERRAL: 'norcet:pending-referral:v1', // {ref,via,ts} captured on arrival, until signup
  PENDING_BATCH: 'norcet:pending-batch:v1',  // batchId captured from ?batch= on arrival, until joined
  // LAUNCH WAITLIST — this device's joined identity {email, code, ts} so
  // revisits land on the status view (device-level: the visitor has no
  // profile yet). The code doubles as the proof-of-ownership the status
  // endpoint requires before revealing an approved claim token.
  WAITLIST_IDENTITY: 'norcet:waitlist-identity:v1',
  SHARE_NUDGE:   'norcet:share-nudge:v1',    // {lastShownAt,lastStreak} results share-nudge gating
  // I18N — active UI language code ('en' | 'hi' | ...). Device-level,
  // IndexedDB (shared:false) is the AUTHORITATIVE record per the offline
  // requirement; LANG_HINT is a localStorage mirror read synchronously at
  // boot so returning non-English users don't flash English first paint.
  LANG:          'norcet:lang:v1',
  LANG_HINT:     'norcet:lang-hint:v1',      // localStorage only, never IDB
  // I18N — set once when the welcome-screen "view in your language?" chip is
  // dismissed or accepted, so it never re-offers. localStorage only.
  LANG_SUGGEST_DISMISSED: 'norcet:lang-suggest-dismissed:v1',

  // -- Shared / cross-device (private blobs, but visible across devices) --
  ANNOUNCEMENT:  'announcement:current',
  // Content quality gate — a single PUBLIC list of question ids the admin has
  // pulled from the served pool (crowdsourced auto-flag, UPGRADE 2 / Layer 3).
  // No PII (ids only); world-readable so every client filters at boot. Writes
  // are admin-only (broker matrix: `qgate:` mirrors `announcement:`).
  QUESTION_GATE: 'qgate:hidden',
  PROFILE_INDEX: 'profile_index',       // legacy: monolithic list — read-only fallback

  // -- Per-id builders --
  profile:       (id)        => `profile:${id}`,
  profileMeta:   (id)        => `profilemeta:${id}`,
  batch:         (id)        => `batch:${id}`,   // Phase-3 batch record (semi-public; no membership)
  feedback:      (id)        => `feedback:${id}`,
  myFeedback:    (profileId) => `myfeedback:${profileId}`,
  // F-F — FAQ entries + community Q&A (shared kv, mirrors feedback()).
  faq:           (id)        => `faq:${id}`,
  faqQuestion:   (faqId, qid)=> `faqq:${faqId}:${qid}`,
  bank:          (id)        => `bank:${id}`,
  // #29 — client error/crash groups (shared, admin-readable). One row per
  // error SIGNATURE so repeated crashes aggregate instead of flooding.
  errlog:        (sig)       => `errlog:${sig}`,
  // ADMIN AUDIT LOG — one append-only row per privileged admin action. The
  // broker stamps the verified actor + server time; admin-only read. Never
  // updated (append-only); admin DELETE allowed for pruning.
  adminlog:      (id)        => `adminlog:${id}`,
  // #28 — per-user engagement summary (shared, admin-readable, ONE key per
  // user so concurrent writes never clobber). Admin UI aggregates only.
  analyticsUser: (id)        => `analytics:user:${id}`,
  // #28 — stable local id for an anonymous guest so their repeat visits
  // aggregate (per device, local only).
  ANALYTICS_LOCAL_ID: 'norcet:analytics-localid:v1',
  // TRENDING — free-tier "trending" engine. One rolling blob per item holds the
  // unique uids that interacted per day: `trend:<kind>:<id>` -> { d: { day: [uid] } }.
  // <kind> ∈ 'game' | 'faq'. World-readable; any logged-in user may SET (broker),
  // DELETE is admin-only. See lib/trending-store.js + lib/trending.js.
  trend:         (kind, id)  => `trend:${kind}:${id}`,

  // -- Forward-compat for PROMPT 1 (cloud sync). Not yet used by any
  //    call site. P1 will switch from KEYS.USERDATA to KEYS.userdata(id)
  //    with a migration path. Defined here so the rename is one place. --
  userdata:      (profileId) => `userdata:${profileId}`,
  // #6 — local-only N-day revision plan (shared:false). Per profile.
  studyPlan:     (profileId) => `studyplan:${profileId}`,
  // AI LEARNING NOTES — local-only (shared:false), per profile. A slim blob of
  // up to 10 bulleted study notes the user copies into an external AI. Never
  // synced to the server; disclosed to the user in the note popup.
  notes:         (profileId) => `notes:v1:${profileId}`,
  // AI Notes feedback row — local-only 'up'/'down' vote on wanting in-app AI chat.
  notesAiVote:   (profileId) => `notesaivote:v1:${profileId}`,
  // Study-companion name (the user's pet name for the note feature) — local, per
  // profile. Drives the popup title + greeting. ADD-only; never wiped by Clear.
  notesName:     (profileId) => `notesname:v1:${profileId}`,
  // "Auto-save on close" preference for the notebook — local, per profile.
  notesAutoSave: (profileId) => `notesautosave:v1:${profileId}`,
  // Show the draggable floating note button? — local, per profile. Default OFF;
  // the fixed top-bar note icon is always available and cannot be disabled.
  notesShowFab:  (profileId) => `notesshowfab:v1:${profileId}`,
  // GLOBAL SEARCH — recent queries (JSON array, newest first, capped at 8).
  // Local-only (shared:false), per profile; powers the Search tab idle state.
  searchRecent:  (profileId) => `searchrecent:v1:${profileId}`,
  // Ask-companion chat transcript — local-only, per profile, capped at the
  // last ~40 turns so reopening the assistant resumes the conversation.
  assistantChat: (profileId) => `asstchat:v1:${profileId}`,
  // Notification opt-in nudge (Home card) — local, per profile:
  // { dismissedAt, dismissCount }. Show/snooze rules live in lib/push-opt-in.js.
  notifNudge:    (profileId) => `notifnudge:v1:${profileId}`,
  // PWA install nudge (Home card) — same state shape/rules, distinct record
  // (lib/install-prompt.js). The installed flag itself is device-level
  // localStorage, not here.
  installNudge:  (profileId) => `installnudge:v1:${profileId}`,
  // Timestamp (ms) of the last CONFIRMED cloud sync for this profile — local,
  // per profile (shared:false). Powers the "Last backed up: X ago" line in
  // Settings → Sync & Backup; stamped whenever the pending-sync queue is empty.
  lastBackup:    (profileId) => `lastbackup:v1:${profileId}`,

  // -- Pipeline step 4 / P1 — Offline write queue (personal storage). --
  //    Tracks which profileIds have been written locally but not yet
  //    confirmed in Supabase. Cleared per-profile once the Supabase
  //    write confirms. Drained on `online` event and at boot.
  PENDING_SYNC:  'norcet:pendingsync:v1',
};

// Prefixes used with safeStorage.list() to scan all keys starting with
// a given pattern. Each prefix here is exactly what the corresponding
// builder above prepends.
export const KEY_PREFIXES = {
  PROFILE_META: 'profilemeta:',
  FEEDBACK:     'feedback:',
  MY_FEEDBACK:  'myfeedback:',
  FAQ:          'faq:',
  FAQ_Q:        'faqq:',
  BANK:         'bank:',
  // P1 — local cache scan prefix. Used by ErrorBoundary's "Reset device
  // data" button to wipe every per-profile cache in one pass.
  USERDATA:     'userdata:',
  // F-A — Study Methods: ids of method cards the user has opened
  // (JSON array; per profile via `${KEYS.STUDY_METHODS_VISITED}${profileId}`).
  STUDY_METHODS_VISITED: 'studymethodsvisited:',
  // F-B — global pull-to-refresh sound on/off (default on).
  SOUND_ENABLED: 'soundenabled:v1',
  // F-C — which welcome-tour rows the user has opened the help popup for
  // (JSON array of help keys; per profile).
  WELCOME_TOUR_VISITED: 'welcometourvisited:',
  // F-D — Learn 'resume where you left off' ({topicId,sub,index,ts}) and a
  // short recently-studied topic list. Both per profile, local only.
  LEARN_RESUME: 'learnresume:',
  LEARN_RECENT: 'learnrecent:',
  // F-E — flagged 'doubts' (map id->record), per profile, local. Plus a
  // throttle timestamp for the 7-day stale-doubt nudge (global).
  DOUBTS: 'doubts:',
  DOUBT_NUDGE_TS: 'doubtnudgets:v1',
  // #18 — question SOLUTION flags ("explanation still unclear"), per profile,
  // local. Map id->record; mirrors DOUBTS but for quiz explanations.
  QDOUBTS: 'qdoubts:',
  // #21 — sidebar gesture toggles (global per device). JSON
  // { close: true, open: false } — open defaults OFF (Android back conflict).
  SIDEBAR_GESTURES: 'sidebargestures:v1',
  // #28/#29 — show the post-test Crib Sheet button on results screens
  // (global per device, default on).
  CRIB_SHEET: 'cribsheet:v1',
  // FAV — Favourites: per-profile local record { enabled, order:[sectionIds] }.
  // Shared mirrors for admin insight live in lib/favorites.js (favsec:/favorder:),
  // following the helpful-votes pattern of module-owned shared prefixes.
  FAVORITES: 'favorites:',
  // #5 — saved Crib Sheets (per profile, local): array of slim sheet
  // snapshots {id,title,subtitle,createdAt,items[]} shown inside Revision.
  CRIBS: 'cribs:',
  // B2 — per-profile, LOCAL (device-only) list of qIds the user was shown but
  // never attempted (not answered, not revealed, not skipped). These are
  // re-surfaced first in future Quick/Topic tests until they're resolved.
  REPEAT_UNATTEMPTED: 'repeatUnattempted:',
  // #29 — client error/crash groups (shared, admin-readable), grouped by
  // signature. Uses the same anon shared-write path as feedback:/favsec:.
  ERRLOG: 'errlog:',
  // #28 — per-user engagement summaries (shared, admin-readable). Aggregated
  // in the admin Engagement view.
  ANALYTICS_USER: 'analytics:user:',
  // ADMIN AUDIT LOG — append-only privileged-action log (admin-only read).
  ADMINLOG: 'adminlog:',
  // TRENDING — interaction counters for the free-tier "trending" engine.
  TREND: 'trend:',
  // AI LEARNING NOTES — local-only bulleted study notes, per profile.
  NOTES: 'notes:',
};
