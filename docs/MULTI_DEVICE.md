# Multi-device working model

> **Status check (2026-09-02):** the *idea* below (one loop, one branch, Vercel deploys every
> push) still holds; the *mechanics* below are out of date and should not be followed
> literally. The production branch is `claude/new-session-9fhlp1`, not `main`; the old
> "promote/patch" edge functions that rewrote the app in Supabase Storage must **not** be used
> (see the ⛔ section in `CLAUDE.md`); and since 2026-08-29 **only the Claude Code session
> pushes** — a Cowork/oversight session commits locally and hands off (CLAUDE.md rule 10).
> The "edit on GitHub's website" route described further down is retired for the same reason.

Abdulrahman works from multiple devices — laptop, tablet, phone, sometimes a travel machine. Any Claude session on any device can edit the app safely, provided everyone follows one loop:

```
pull  →  edit  →  push
```

## Why the repo is the boss
No device holds "the real copy." **GitHub holds it.** Each device has a temporary working copy that gets thrown away and re-pulled next time. This is exactly why Git exists — it stops the "one device overwrote the other's work" problem that has been burning credits.

## The three ways to edit

### 1. From a Claude session (any device)
Every Claude task in this project should:
1. **First tool call** — pull the latest `index.html` from the repo via the GitHub API (or `git pull` if git is installed).
2. **Do the edits** — usually one or more `edit_block` calls on `index.html`.
3. **Last tool call** — push the new `index.html` back to `main` via the GitHub API (or `git add . && git commit -m "…" && git push`).

Vercel auto-deploys the moment the push lands. Backup runs after Vercel confirms the deploy.

### 2. From GitHub's website (any device with a browser)
Open the repo → click `index.html` → pencil icon → edit → *Commit changes*. Same effect — Vercel deploys, backup runs.

### 3. From a local git checkout (laptop only, if git is installed)
```
git clone https://github.com/<owner>/<repo>.git
# edit index.html
git add index.html
git commit -m "what changed"
git push
```

## What happens if two sessions touch it simultaneously
GitHub will accept the first push. The second push will be rejected with a "non-fast-forward" error, forcing that session to re-pull, re-apply its change on top of the newer version, and try again. **Nothing gets silently lost.** The second session sees the conflict and stops.

## Tablet / phone / travel-machine tip
Single-session tasks work fine. The Claude session just needs the GitHub Personal Access Token — it's stored once on setup and reused. You do not need git, npm, or any other tool installed on the device.

## What NEVER to do
- **Never** edit `index.html` in the `Q:\Downloads\Claude\Apps and websites\app-live\` folder as if it were the master. That folder is now a rolling working copy — it will be overwritten on the next pull.
- **Never** deploy to Vercel directly by uploading a file. Push to GitHub instead; the deploy will happen automatically.
- **Never** commit the GitHub or Vercel token to the repo. They live in the setup folder on the device, not in the repo.
