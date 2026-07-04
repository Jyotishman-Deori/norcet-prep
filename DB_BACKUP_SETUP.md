# Nightly database backup → private GitHub repo

This is **owner-side disaster recovery**: a once-a-day snapshot of the whole
`kv_shared` table (every user's progress, content, and config) committed to a
private GitHub repo. If the Supabase project were ever deleted, corrupted, or
paused, you'd lose *at most a day* instead of everything.

It's separate from the in-app cloud sync (that's the automatic per-user backup).

The code (`api/backup-db.js`) is already deployed but **inert** until you do the
5-minute setup below. Nothing runs until all three env vars are set.

---

## What it does

- Runs once a day, piggybacked on the existing 2:30 AM reminder cron (Vercel
  Hobby only allows 2 crons and both are used, so we don't add a third).
- Reads all `kv_shared` rows with the Supabase **service-role** key (server-only)
  and commits `snapshots/kv_shared-YYYY-MM-DD.json` to your private repo — one
  openable file per day.
- A backup failure can never break the reminders.
- It does **not** back up `profile_secrets` (password hashes) on purpose — we
  don't keep credentials off-platform. If the whole project were lost, users
  recover their progress by re-registering with the same display name (their
  restored `profile:<id>` blob then loads).

---

## One-time setup (~5 minutes)

### 1. Create the private backup repo
On GitHub → **New repository**:
- Name: `norcet-backups` (anything)
- **Private** ✅
- **Tick "Add a README"** ✅  ← important: this gives the repo a `main` branch,
  which the backup needs to commit into.

### 2. Create a fine-grained access token
GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained
tokens → Generate new token**:
- **Repository access:** Only select repositories → pick `norcet-backups`.
- **Permissions:** Repository permissions → **Contents → Read and write**.
- Set an expiry (e.g. 1 year) and note when to rotate it.
- Generate, then **copy the token** (`github_pat_…`) — you won't see it again.

### 3. Get the Supabase service-role key
Supabase dashboard → your project → **Settings → API** → copy the
**`service_role`** secret (NOT the anon key).

### 4. Add 3 environment variables in Vercel
Vercel → your `norcet-prep` project → **Settings → Environment Variables** →
add each for **Production** (and Preview if you like):

| Name | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from step 3 |
| `BACKUP_GITHUB_TOKEN` | the `github_pat_…` from step 2 |
| `BACKUP_GITHUB_REPO` | `your-username/norcet-backups` |

(`CRON_SECRET` and `SUPABASE_URL`/`VITE_SUPABASE_URL` already exist.)

### 5. Redeploy
Trigger a redeploy (any push to `main`, or Vercel → Deployments → Redeploy) so
the new env vars are picked up.

---

## Test it right now (optional but recommended)

From your machine, replace `<CRON_SECRET>` with the value in Vercel and run:

```
curl -X POST -H "Authorization: Bearer <CRON_SECRET>" https://www.nurseholic.in/api/backup-db
```

Expected: `{"ok":true,"path":"snapshots/kv_shared-YYYY-MM-DD.json","rowCount":…}`
and a new file appears in your `norcet-backups` repo. If you see
`{"ok":false,"reason":"not-configured","missing":[…]}`, an env var is missing.

After this, the backup runs automatically every night.

---

## How to restore (if you ever need to)

1. Open the newest `snapshots/kv_shared-*.json` in the repo — it's
   `{ rows: [{ key, value }, …] }`.
2. Re-insert those rows into a fresh Supabase `kv_shared` table (SQL editor, or a
   small script that upserts each `{key, value}` via the service role).
3. Users' progress reappears the next time they open the app / sign in.

---

## Notes / limits

- At current scale the snapshot is well under GitHub's 1 MB Contents-API comfort
  zone. If it ever grows past ~1 MB, switch the commit to gzip or the Git Data
  API (a small change in `api/backup-db.js`).
- Dated files accumulate (one small file/day). Delete old ones manually if you
  ever want to; nothing depends on keeping them.
- Rotate `BACKUP_GITHUB_TOKEN` before it expires.
