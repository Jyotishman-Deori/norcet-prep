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

  // -- Shared / cross-device (private blobs, but visible across devices) --
  ANNOUNCEMENT:  'announcement:current',
  PROFILE_INDEX: 'profile_index',       // legacy: monolithic list — read-only fallback

  // -- Per-id builders --
  profile:       (id)        => `profile:${id}`,
  profileMeta:   (id)        => `profilemeta:${id}`,
  feedback:      (id)        => `feedback:${id}`,
  myFeedback:    (profileId) => `myfeedback:${profileId}`,
  // F-F — FAQ entries + community Q&A (shared kv, mirrors feedback()).
  faq:           (id)        => `faq:${id}`,
  faqQuestion:   (faqId, qid)=> `faqq:${faqId}:${qid}`,
  bank:          (id)        => `bank:${id}`,
  // #29 — client error/crash groups (shared, admin-readable). One row per
  // error SIGNATURE so repeated crashes aggregate instead of flooding.
  errlog:        (sig)       => `errlog:${sig}`,
  // #28 — per-user engagement summary (shared, admin-readable, ONE key per
  // user so concurrent writes never clobber). Admin UI aggregates only.
  analyticsUser: (id)        => `analytics:user:${id}`,
  // #28 — stable local id for an anonymous guest so their repeat visits
  // aggregate (per device, local only).
  ANALYTICS_LOCAL_ID: 'norcet:analytics-localid:v1',

  // -- Forward-compat for PROMPT 1 (cloud sync). Not yet used by any
  //    call site. P1 will switch from KEYS.USERDATA to KEYS.userdata(id)
  //    with a migration path. Defined here so the rename is one place. --
  userdata:      (profileId) => `userdata:${profileId}`,

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
  // #29 — client error/crash groups (shared, admin-readable), grouped by
  // signature. Uses the same anon shared-write path as feedback:/favsec:.
  ERRLOG: 'errlog:',
  // #28 — per-user engagement summaries (shared, admin-readable). Aggregated
  // in the admin Engagement view.
  ANALYTICS_USER: 'analytics:user:',
};
