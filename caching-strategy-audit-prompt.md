# Caching Strategy Audit & Fix — Prompt for Claude Code

> Standalone task. Not part of the main waitlist/app implementation plan — paste this separately, in its own session or as its own follow-up task, against the existing Vercel + Supabase nursing PWA codebase.

## Why this matters (read before touching any code)

Caching usually gets added reactively: the app feels slow, a cache layer (Redis, an edge cache, an in-memory store, a `Cache-Control` header) gets bolted on, things speed up, and everyone moves on. The problem shows up months later — a customer whose plan/status just changed still sees old permissions, a price shown to a customer doesn't match what they were actually charged, or a team's inventory numbers don't match what's live on the site. These look like unrelated bugs, but they share one root cause: **speed was added without anyone deciding what the system is allowed to get wrong, and for how long.**

There are three questions that should be answered *before* any caching layer is trusted, and almost never are:

1. **What data is allowed to be stale, and for how long?** Some data (e.g., a static address or an old blog post) costs nothing if it's minutes behind. Some data (pricing, permissions, account/subscription status, inventory, access-token validity) costs real money or trust for every second it's wrong — stale pricing overcharges or undercharges on every transaction in the window, stale permissions mean a deactivated user still has access, stale inventory means selling something that can't be delivered. None of this shows up in error monitoring — it shows up as support tickets, refunds, and lost trust.
2. **Who or what clears the cache the instant the underlying data changes?** If the honest answer is "nobody decided" or "it just expires after N minutes," then every piece of that cached data is wrong for the entire length of that timer, on every single request, and nobody chose that tradeoff on purpose. The fix is **event-driven invalidation** — the cache clears automatically the moment the source data changes, instead of waiting on a timer.
3. **What happens when the cache expires and many requests hit the same key at the same instant?** This is a **cache stampede**: the cache that exists to protect the database ends up sending a flood of simultaneous requests straight to it instead. It's very hard to catch in normal testing (which can't easily simulate thousands of concurrent requests hitting one just-expired key) and reliably shows up during the highest-traffic moments — a launch, a viral spike, a feature going live — which is exactly when it's most damaging.

The companies that avoid this aren't the ones with the best engineers — they're the ones where someone made these three decisions on purpose instead of by accident. Caching is a business decision about how wrong the data is allowed to be, for how long, before it costs money or trust.

---

## Task for Claude Code

Audit this codebase for every place caching exists or is implied, then bring it in line with the framework above.

### 1. Inventory every cache in the app

Search the codebase for any of the following and list what you find:
- Redis / Upstash usage
- Vercel Edge / CDN caching (`Cache-Control`, `stale-while-revalidate`, `revalidate` options in Next.js `fetch`/ISR, etc.)
- In-memory caches (module-level variables, `Map`/object caches inside serverless functions)
- Client-side caches (React state used as a cache, `localStorage`/`sessionStorage` — note: browser storage isn't available in some environments, but check for it in the actual deployed app code)
- Any Supabase query result being reused across requests instead of fetched fresh

For each one found, record: **what data it holds**, **how it expires (timer, event, never)**, and **what happens on a cache miss**.

### 2. Classify every cached (or cache-worthy) data type into a staleness table

Produce a table like this, filled in for what actually exists in this app — flag anything currently implemented in a way that contradicts its correct tier:

| Data type | Correct staleness tolerance | Currently cached? | How it currently invalidates | Fix needed? |
|---|---|---|---|---|
| Static content (landing page copy, college names, etc.) | Cache indefinitely / long TTL | | | |
| Study content / question banks (rarely changes) | Cache for hours, TTL is fine | | | |
| `account_tier` (free / premium / founding_member) | **Never stale** | | | |
| Payment/subscription state (RevenueCat/Stripe webhook result) | **Never stale** | | | |
| Waitlist `status` / one-time access token validity | **Never stale** | | | |
| Waitlist `priority_score` / queue position shown to the user | Stale for a few seconds is tolerable, but must not be minutes old right before a batch drop | | | |
| Referral counts feeding the auto-approval trigger | **Never stale** — a stale count can wrongly approve or wrongly withhold a batch unlock | | | |
| Bug bounty / `bug_months_earned` / `premium_expires_at` | **Never stale** | | | |
| Inventory-equivalent data (seat count for a batch release, if surfaced live) | **Never stale** | | | |

Add rows for anything else cache-relevant you find that isn't listed above.

### 3. Fix anything relying on a timer where it should be event-driven

For every "Never stale" row currently backed by a TTL/timer instead of an event:
- Replace it with **event-driven invalidation**: the moment the source row changes in Supabase (a payment webhook fires, an admin approves a batch, a referral trigger runs — see the main plan's §4.4/§5.9 triggers), immediately invalidate or update the specific cache key affected — don't wait for it to expire naturally.
- Prefer doing this via Supabase database triggers/webhooks or by having the write path (the API route or webhook handler that changes the data) explicitly bust the relevant cache key as part of the same request, rather than a separate timer-based job.
- If a genuine TTL is kept for performance reasons on "never stale" data, it must be paired with immediate invalidation on write — the TTL should only be a safety net, never the primary mechanism.

### 4. Add cache-stampede protection wherever many users can hit the same key at once

This app has several natural stampede points — check and protect each one:
- The referral-verification endpoint (`/api/waitlist`) when a viral link gets shared and many signups land in the same seconds
- The "check my status" / priority-score lookup, especially right before a Tuesday/Friday batch cutoff when many users check simultaneously
- Any endpoint read at the exact moment a batch is approved or a payment webhook fires

For these, implement one or more of:
- **Request coalescing / single-flight locking** — only one in-flight request per cache key actually hits the database; concurrent requests for the same key wait on that result instead of firing their own query.
- **Stale-while-revalidate with a lock** — serve the last-known-good value immediately while one request refreshes it in the background, instead of every request blocking on a fresh fetch.
- **Jittered expirations** — avoid many keys expiring at exactly the same second by adding small random offsets to TTLs, so refreshes spread out instead of all firing at once.

### 5. Deliverable

Provide:
- The filled-in staleness table from step 2, with every "Fix needed?" column resolved to Yes/No plus a one-line reason.
- A short list of the specific code changes made (file + what changed) for each fix.
- Confirmation that the identified stampede-risk endpoints now have protection, with a one-line description of which technique was used for each.

Do not introduce a new caching layer purely for performance if none is needed — the goal here is correctness of what already exists (or is planned), not adding caching for its own sake.
