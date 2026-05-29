// =====================================================================
// SCHEMA VERSIONING + MIGRATIONS  (Pipeline step 3 / A11)
// ---------------------------------------------------------------------
// Why this file exists:
//   DEFAULT_DATA has grown over time — disabledBanks, revisionLog,
//   feedbackRepliesSeen, preferences.reviewRemindersEnabled,
//   stats.streakGraceAvailable, stats.dailyTarget were all added
//   after launch. Until now the boot block papered over missing
//   fields with a spread-merge from DEFAULT_DATA. That works for
//   ADDING fields but breaks silently when you RENAME, REMOVE, or
//   RESHAPE one: old users get stale fields, new code reads
//   undefined, weird bugs follow.
//
//   This file gives us a forward-only migration runner. To change
//   the data shape:
//     1. Bump CURRENT_SCHEMA_VERSION.
//     2. Append a { from, to, fn } entry to MIGRATIONS describing
//        the transformation.
//     3. Update DEFAULT_DATA's shape in App.jsx so fresh users
//        start at the new version.
//
//   Prerequisite for PROMPT 1 (cloud sync). Once data lives in
//   Supabase too, schema drift between client versions is real and
//   we can't hand-edit a remote blob to test new shapes.
//
// How migrations should be written:
//   - PRESERVE existing user values. Never overwrite a field that's
//     already present. Use safe checks (typeof, Array.isArray, 'in')
//     because `||` clobbers legitimate falsy values (false, 0, '',
//     null when null is the intended "auto" value).
//   - Each migration is pure: input data → new data. No I/O.
//   - Each migration must be idempotent: running it twice on the
//     same input yields the same output.
//   - Don't delete fields here unless no installed build still
//     reads them. PWAs cache aggressively; old code can live for
//     weeks after a deploy.
// =====================================================================

// A10: structured logging for migration failures.
import { log } from './log.js';

// Bump this whenever you add a migration below.
// Fresh DEFAULT_DATA carries this number, so brand-new users skip
// the migration loop entirely.
export const CURRENT_SCHEMA_VERSION = 8;

// Each step takes a data blob at version `from` and returns it at
// version `to`. Ordered. The runner applies any step whose `from`
// matches the blob's current version, then advances.
export const MIGRATIONS = [
  // v1 → v2 — `disabledBanks`: map of bankId → true for banks the
  //           user has paused. Empty {} when none paused.
  {
    from: 1, to: 2,
    fn: (d) => ({
      ...d,
      disabledBanks: (d.disabledBanks && typeof d.disabledBanks === 'object' && !Array.isArray(d.disabledBanks))
        ? d.disabledBanks
        : {},
    }),
  },
  // v2 → v3 — `revisionLog`: per-day snapshot of the revision set
  //           the user opened. Always an array.
  {
    from: 2, to: 3,
    fn: (d) => ({
      ...d,
      revisionLog: Array.isArray(d.revisionLog) ? d.revisionLog : [],
    }),
  },
  // v3 → v4 — `feedbackRepliesSeen`: map of feedbackId → repliedAt
  //           the user has acknowledged.
  {
    from: 3, to: 4,
    fn: (d) => ({
      ...d,
      feedbackRepliesSeen: (d.feedbackRepliesSeen && typeof d.feedbackRepliesSeen === 'object' && !Array.isArray(d.feedbackRepliesSeen))
        ? d.feedbackRepliesSeen
        : {},
    }),
  },
  // v4 → v5 — `preferences.reviewRemindersEnabled`: permanent switch
  //           for the Home revision reminder card. Default: on.
  {
    from: 4, to: 5,
    fn: (d) => {
      const prefs = (d.preferences && typeof d.preferences === 'object' && !Array.isArray(d.preferences))
        ? d.preferences
        : {};
      return {
        ...d,
        preferences: {
          ...prefs,
          reviewRemindersEnabled: (typeof prefs.reviewRemindersEnabled === 'boolean')
            ? prefs.reviewRemindersEnabled
            : true,
        },
      };
    },
  },
  // v5 → v6 — `stats.streakGraceAvailable`: one-day grace token a
  //           user can spend to preserve their streak. Default: on.
  {
    from: 5, to: 6,
    fn: (d) => {
      const stats = (d.stats && typeof d.stats === 'object' && !Array.isArray(d.stats))
        ? d.stats
        : {};
      return {
        ...d,
        stats: {
          ...stats,
          streakGraceAvailable: (typeof stats.streakGraceAvailable === 'boolean')
            ? stats.streakGraceAvailable
            : true,
        },
      };
    },
  },
  // v6 → v7 — `stats.dailyTarget`: user-set questions-per-day goal.
  //           null is meaningful here ("auto-derive from pool/days
  //           left"), so we use `'in'` rather than `??` to detect
  //           whether the field is genuinely missing.
  {
    from: 6, to: 7,
    fn: (d) => {
      const stats = (d.stats && typeof d.stats === 'object' && !Array.isArray(d.stats))
        ? d.stats
        : {};
      return {
        ...d,
        stats: {
          ...stats,
          dailyTarget: ('dailyTarget' in stats) ? stats.dailyTarget : null,
        },
      };
    },
  },
  // v7 → v8 — `stats.lastCompactedTs`: timestamp of the last lazy
  //           compaction pass (P15). null = never compacted; that's
  //           true for every user at v8-rollout time. Set to a real
  //           number by compactData() in src/lib/compact.js once a
  //           compaction actually trims anything. null is meaningful
  //           ("never run yet"), so use `'in'` not `||`.
  {
    from: 7, to: 8,
    fn: (d) => {
      const stats = (d.stats && typeof d.stats === 'object' && !Array.isArray(d.stats))
        ? d.stats
        : {};
      return {
        ...d,
        stats: {
          ...stats,
          lastCompactedTs: ('lastCompactedTs' in stats) ? stats.lastCompactedTs : null,
        },
      };
    },
  },
];

// Walk a data blob forward from its current schemaVersion to
// CURRENT_SCHEMA_VERSION, applying any intervening migrations.
// Idempotent: running it on an already-current blob returns the
// blob unchanged (plus a schemaVersion stamp if it was missing).
//
// Safe failure: if a single migration step throws or returns
// something invalid, we log and stop at the last successful
// version. The boot block's spread-merge from DEFAULT_DATA is a
// second safety net for any field a halted migration would have
// filled in.
export function runMigrations(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  let d = { ...data };
  let v = (typeof d.schemaVersion === 'number' && d.schemaVersion >= 1)
    ? d.schemaVersion
    : 1;
  for (const m of MIGRATIONS) {
    if (m.from !== v) continue;
    try {
      const next = m.fn(d);
      if (next && typeof next === 'object' && !Array.isArray(next)) {
        d = next;
        v = m.to;
      } else {
        // A10: report a halted migration through the structured logger.
        log.warn('migrations.nonObject', { from: m.from, to: m.to, stoppedAt: v });
        break;
      }
    } catch (e) {
      // A10: a throwing migration is higher-signal — report as error.
      log.error('migrations.threw', e);
      break;
    }
  }
  d.schemaVersion = v;
  return d;
}
