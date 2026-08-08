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

There is **no application code in this git repo yet** — this is the first commit.
The live system is entirely inside Supabase.

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

## Known structural issues (context, not a to-do list)

- **Two sources of truth.** Data lives both in the `app_state` JSON blob and in real
  tables like `businesses`. `save_state()` still has a legacy path that can overwrite the
  blob. Likely cause of edits that silently revert.
- **No version control on the app.** Changes are made by find-and-replace scripts against
  the live HTML, with manual backup copies as the only undo. This is the main source of
  the dead ends.
- **Ownership is free text.** `assigned_to` / `account_manager` are plain names, not links
  to real users — so "show me only my leads" can't be built until that's fixed.
- `business@directksa.com` is listed as an admin in `access_allowlist` but has no login
  yet. Abdulrahman's other address, `aboelmagd@directksa.com`, is a working admin.
