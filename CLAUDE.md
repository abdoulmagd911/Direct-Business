# Direct Business — working notes for Claude

## Standing rules (set by Abdulrahman, 2026-08-08)

1. **Abdulrahman is not a developer.** No jargon. Explain things the way you'd explain
   them to a smart colleague who doesn't write code. If a technical term is unavoidable,
   define it in the same sentence.
2. **Do the work, don't hand over homework.** Default to making the change yourself and
   reporting what happened. Only ask him to do something manually when it genuinely
   cannot be done from here (dashboard toggles, downloads, approvals) — and then give
   exactly one step at a time, in order.
3. **One clear next step.** Not a menu of six options. Recommend the best one and say why.
4. **Separate "actually broken" from "theoretically risky."** He has limited time and has
   already hit many dead ends. Lead with what is costing him progress today.
5. **This is an internal tool.** It will only ever be used by Direct employees. The data
   currently in it is test data that he is still filtering and cleaning. Do not raise
   public-exposure, data-leak, or "anyone on the internet could…" alarms — he has
   considered it and accepted it. Flag security only if it would break the app, lock the
   team out, or destroy real data.
6. **He has been building this for months and hit repeated dead ends.** Bias toward
   reducing his workload and making things reversible, not toward best-practice purity.

## What this project is

**Direct** (دايركت للسفر والسياحة) — a Saudi travel & tourism company. This is their
internal B2B tool: leads, clients, contacts, suppliers, requests, invoices, SOPs.
Arabic + English. Used by employees only.

## Where everything actually lives

This repo is now the consolidated home: `index.html` (the app), `events/index.html`
(KSA Events Hub), `vercel.json`, `docs/`, `scripts/`. The `index.html` here was verified
byte-for-byte identical (SHA-256) to what directksab2b.com was serving on 2026-08-08.

**Deploys are automatic as of 2026-08-08.** The Vercel project `direct-business` (team
`abdoulmagd911s-projects`, domains `directksab2b.com` + `direct-business.vercel.app`) is now
connected to this repo. Push → Vercel builds → live in ~30s. Verified working: commit
`39dafaa` deployed itself and `directksab2b.com` was confirmed byte-identical to `index.html`.
Production branch is currently **`claude/new-session-9fhlp1`** (the repo had no `main` when
Vercel connected). Rolling back = revert the commit, or Vercel → Deployments → Promote.

### ⛔ Do NOT run the old deploy scripts

These edge functions patch `site/v37/index.html` in Supabase Storage by find-and-replace:
`promote-v41`, `promote-v42-finance`, `patch-v42-attention-fix`, `verify-v42`.

**That path is now dead.** The website is served from this repo, not from Storage. Running any
of them changes a file nobody reads, produces no visible effect, and looks exactly like a
mysterious failure — this is the pattern that caused months of dead ends. To change the app,
edit `index.html` here and push. The functions should be deleted from the Supabase dashboard
when convenient; they are kept only as history.

`v30-import-businesses` is the same shape (one-shot importer) and should not be re-run either.

The other two GitHub repos are kept untouched as reference, not deleted:
- `abdoulmagd911/direct` (private) — 1 commit, 2026-08-08. Its `index.html` is identical to
  the one now in this repo.
- `abdoulmagd911/ksa-events-hub` (public) — 2 commits, 2026-07-27. Its page is now in `events/`.

**Supabase project:** `direct-business` — ref `vkxoeeoauexyfpzqufqd` (eu-central-1)
(A second project, `directksa-performance` / `byhxnmafaumersoaiybq`, also exists.)

- **The app itself** is one ~1.1 MB single-file HTML page stored in the `site` storage
  bucket at `v37/index.html`. Not a normal codebase — one giant file, no build step.
  Roughly 16 historical copies sit beside it (`v32/` … `v41/`, plus dated backups).
- **Edge functions** (12) are a mix of real features (`app`, `admin-users`,
  `manual-confirm`, `ksa-events-hub`) and one-shot deploy scripts that patch the live
  HTML by find-and-replace (`promote-v41`, `promote-v42-finance`,
  `patch-v42-attention-fix`, `verify-v42`, `v30-import-businesses`). The `gs` function is
  an unrelated personal habit tracker.
- **Data** is in Postgres tables: `businesses` (leads *and* clients — `is_client` flags
  which), `contacts`, `activities`, `requests`, `offers`, `finance_invoices`,
  `master_db_companies`, `airlines`, `providers`, `sops`, `slas`, `ksa_events`, `funnels`.
- **Logins/roles:** `auth.users` → `app_users` (role + `active`). Roles are
  `admin, manager, bd, operations, viewer, team_member`. `access_allowlist` decides who
  gets auto-approved on signup. `app_role()` is the function every access rule calls.

## Testing

Always verify UI work by actually driving the app, not by reading the code. `scripts/qa/`
runs `index.html` in a headless browser against a local stand-in for Supabase. Sign in as
**`test@directksa.com`** / `Dq7nTest-2026-Riyadh` (admin, created 2026-08-08 and kept
deliberately for this). Screenshot the pages and look at them — several real defects on
Today and Leads were invisible in the code and obvious on screen.

## Rules for editing index.html

- **Never call `window.supabase.createClient` again in a new layer.** The app had five
  clients, which fought over refresh-token rotation and silently signed people out. A
  `v44a` block near the Supabase `<script src>` memoises `createClient`, so every call now
  returns the same client. Just call it and you get the shared one.
- **New pages need a nav entry.** Adding a `current==='x'` render branch is not enough —
  `buildNav()` builds from `VIEWS`, and the v25.2 layer rebuilds it again. The `v44b` block
  at the end of the file shows the safe pattern: inject the button and re-inject after
  every `render()`. This is how the finance ledger sat live-but-unreachable for two days.
- Layers are appended at the end of the file as self-contained `<script>` blocks wrapped in
  `try/catch`. Follow that pattern; don't restructure the middle of the file.
- **Saving is partial now.** The `v45` block turns each `save_state` call into a
  `save_state_patch` call carrying only the top-level sections whose contents changed since
  the tab loaded, so two people working on different sections no longer overwrite each
  other. If you add a new top-level key to `DB`, it is picked up automatically. Don't
  reintroduce a full-blob write.

## Known structural issues (context, not a to-do list)

- **One JSON row still holds most entities.** `businesses` is a real table (safe, saved
  row by row). Bookings, invoices, offers, requests, projects and settings all still live
  in the single `app_state` row. Since 2026-08-08 saves are per-section, so different
  people editing different sections is safe — but two people editing the *same* section at
  the same moment still ends in last-write-wins. Moving those into real tables is the fix.
- **No version control on the app.** Changes are made by find-and-replace scripts against
  the live HTML, with manual backup copies as the only undo. This is the main source of
  the dead ends.
- **Ownership is free text.** `assigned_to` / `account_manager` are plain names, not links
  to real users — so "show me only my leads" can't be built until that's fixed.
- `business@directksa.com` is listed as an admin in `access_allowlist` but has no login
  yet. Abdulrahman's other address, `aboelmagd@directksa.com`, is a working admin.
