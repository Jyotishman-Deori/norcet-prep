# Git Workflow — Dev & Main Branch Guide

---

## ONE-TIME SETUP
> Run once, never again

```powershell
git checkout -b dev
git push -u origin dev
```

---

## CHECK WHERE YOU ARE
> Run anytime you're unsure

```powershell
git branch
```

- `* dev` = you're on dev ✅
- `* main` = switch to dev first ⚠️

---

## SWITCH BRANCHES

```powershell
# Go to dev
git checkout dev

# Go to main
git checkout main
```

---

## DAILY WORK ON DEV
> Your normal coding workflow

```powershell
git checkout dev
npm run build
git add .
git commit -m "describe what you changed"
git push
```

---

## RELEASE TO USERS
> Only when you're satisfied

```powershell
git checkout main
git merge dev
git push
git checkout dev
```

---

## HOTFIX DIRECTLY TO MAIN
> Critical bug only

```powershell
git checkout main
git add .
git commit -m "hotfix: describe the fix"
git push

# Sync dev so it doesn't fall behind
git checkout dev
git merge main
git push
```

---

## GOLDEN RULES

- Always be on `dev` when coding
- Only touch `main` when releasing or hotfixing
- Always run `npm run build` before committing — never push a broken build
- After every main update, switch back to `dev` immediately

---

## HOW THE TWO BRANCHES WORK

| | `dev` | `main` |
|---|---|---|
| Purpose | Your playground + friend testing | What users see |
| Vercel URL | `norcet-prep-git-dev-xxx.vercel.app` | `norcet-prep.vercel.app` |
| Who sees it | You + trusted friends | All users |
| How often you push | Every work session | Only on release |

---

## LATER (when going public)

Add your dev Vercel URL to Supabase's allowed URLs list so auth email redirects work on the dev deployment.

> Supabase → Authentication → URL Configuration → add dev URL
