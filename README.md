# Direct Business — B2B Travel Operations App

The internal tool for **Direct** (دايركت للسفر والسياحة). Used by Direct employees only.

Live at **[directksab2b.com](https://www.directksab2b.com/)**.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | The whole app — one self-contained file, ~1.1 MB. |
| `events/index.html` | KSA Events Hub — the Saudi trade-show / conference calendar. Its own small page (~28 KB). |
| `vercel.json` | Routing. `/` serves the app, `/events` serves the events hub. |
| `docs/MULTI_DEVICE.md` | How Claude sessions on different devices co-operate on this repo. |
| `scripts/backup.ps1` | Windows script that snapshots each live deploy to a local backup folder. |
| `CLAUDE.md` | Working notes and standing rules for Claude sessions. |

Both pages talk to the same Supabase project (`vkxoeeoauexyfpzqufqd`) using the **publishable**
key only — no secret keys are stored in this repo.

## ⚠️ Deploys are NOT automatic yet

**Pushing to this repo does not currently update the website.** The Vercel project
`direct-business` is not connected to any GitHub repo — every deploy so far has been a manual
upload. That connection has not been made yet.

To turn it on (one time, needs Abdulrahman's login):

> Vercel → project **direct-business** → **Settings → Git → Connect Git Repository** →
> pick `abdoulmagd911/Direct-Business`

Once connected, the loop below becomes true. Until then, treat this repo as the safe
source of truth and deploy by hand.

## How deploys will work (after the connection above)

1. A change lands on the main branch.
2. Vercel sees the push and builds automatically.
3. `directksab2b.com` updates within about 30 seconds.
4. To roll back: Vercel → *Deployments* → *Promote to Production* on any older green build,
   or revert the commit here.

## Where the older history lives

Git history in this repo starts on 2026-08-08. Everything built before that was never in
version control — it lives in two places, and both are worth keeping:

- **Supabase Storage, `site` bucket** — roughly 16 saved copies of the app going back to
  2026-06-18 (`v32/` … `v41/`, plus dated backup folders).
- **Vercel deployment history** — 20 builds going back to 2026-06-20, each still promotable.

Note that `site/v37/index.html` in Supabase Storage is a **larger, different build** that
contains a finance-ledger feature which is *not* in the live site. It has not been merged here.
