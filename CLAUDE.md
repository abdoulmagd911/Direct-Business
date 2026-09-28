# Direct Business — working notes for Claude

## Current brief (keep it short; last updated 2026-09-27)

**1 · Who's who.** Abdurahman (the owner, non-technical — plain words) signs in as
**aboelmagd@directksa.com**, his admin account and the one on the team list (**business@ is now the QA test
account**, "QA Account", admin, on the team list — every import, bulk edit or seed run from outside the app is logged as
it, D13; a.hassan@directksa.net is his Team-Member test view). **Ahmed Aboelmagd** (ahmed.aboelmagd@) is a
**different colleague**, not the owner. The Claude account is shared, so "the user" in a session may be the
owner or the oversight chat — never infer who from the account name. (DECISIONS D8.)

**2 · Home page.** The Google Doc named **"00 — START HERE (Direct · All In)"** in the Drive KB folder
`1nfOES1oPdh2y0ShkrPnSN9CnVj1hFtyP` — find it **by name**; its link changes on each update, so none is kept here
(not the older "00 — README · start here" in the same folder).

**3 · Where the rules live.** `docs/DECISIONS.md` — every binding rule, with why and status; check it before
any nontrivial action and add what you learn in the same commit. The highest-stakes ones: M1 money is clean
(no VAT in cost/revenue/profit); cost = approved expenses only, never invented; **real company data is never
committed** (rule 7 below — the repo is public); data enters only through the importer and the Direct
Payments sync. **All data in the app today is test data** (D9): at go-live it is reset to zero and loaded
fresh — but no safety work is ever skipped because of it. Also: `docs/BACKLOG.md` (open work).

**4 · Roles.** Claude Code (this session) **builds**: code, SQL, tests, PRs, and switching a merged change on
live. The owner's **oversight chat reviews** every PR before merge. **P6**: once a flow is approved, it stays
approved — a green full run on an approved kind of change merges without asking again. Every change lands by
PR into `claude/new-session-9fhlp1` (production; Vercel deploys it in ~30 s); database changes are applied
at merge from the merged commit (checksum-checked), after a rolled-back live check.

**5 · Release status** (update this in the same PR at the end of every release):
- Phase 1 (four access levels, one design file) — live. Phase 3, the task manager built inside this app:
  - release 1 tasks + projects (#36) — live; the D7 undo rule and the team list in Team & Access (#38) — live;
  - release 2 achievements + proofs (#40) — live;
  - release 3 KPIs + the danger light (#41), with the objectives/initiatives rule and the proof month lock — live;
  - DirectFont, loaded from Direct's own server, first in the two font lists (#42) — live; the Generator's
    headings in DirectFont (Cairo behind it) in the printed PDFs and the PowerPoint exports, and both
    PowerPoint buttons working again (#44); document body text in DirectFont too, and every download
    tested for real (#45).
  - release 4 the company card (client IDs, discount codes, company files; D10) (#46) — live; on hold until after
    month-end (owner, 26 Sep).
- **Data reset on the owner's order of 26 Sep — done 2026-09-27** (backup stamp 20260927T070142Z in the private bucket
  `golive-backups`; D9). People & teams (D11) and Tasks → Achievements (D12) (#47) — live.
- Owner decisions of 27 Sep: the wipe of world30_finance_invoices / _client_links, master_db_companies and
  company_achievements, and Strategy + Integrity retired — done (backup stamp 20260927T113348Z); the change log on
  every record, managers edit people (logged), business@ as the QA account (D13) (#48) — live. B) speed (D14) (#49) — live.
- E) the money rules — typed exclusions and merges, one "what counts" view (D16) (#50) — live.
- 28 Sep (#53) — live: Finance Rules round 2 (dates in Riyadh time, D20; the freeze recorder js/118); **D1 the money model
  and the invoice import (D21)** — cost empty until approved expenses, top-ups stored, statuses, fill-never-wipe in any
  order, billing links proposed; and **D19** — every delete asks in the app's box, naming the item. Backup stamp
  20260928T050142Z; the live finance table is empty until the oversight imports in the browser (D17).
- Still to come: A) the Finance freeze (the recorder is live; a Chrome extension is suspected), C) the login/reset loop
  (second builder; C-lite, D15, #51 — live 28 Sep, admin-users v6), D2) the expense export cost (the raw Transaction
  Expense / Expense Invoice exports are not recognised yet) / client list / promo codes, D3) manual entry and links by
  hand, the margins pass, E2) the simplify list. Owner ruling 28 Sep (D23): with no approved expense, the pass-through
  lines are a flagged cost ESTIMATE, shown apart from the approved cost.
- Next: issuing numbered reports, the appraisal cycle — and the **final go-live reset**, run only on the owner's
  explicit go (`golive_reset`, scripts/sql/golive-reset.sql).

**6 · Working habits.** Test with the harness (`scripts/qa/`, fake data) **and** against the live database
read-only (see "What this session can and cannot reach"); full battery `scripts/qa/run-battery.sh -j 4`
before any merge; every release's live check includes `LIVE=1 node scripts/qa/probe-real-downloads.mjs` (all
downloads, read-only), `node scripts/qa/probe-live-walk.mjs` (every page, both languages, read-only) and the
self-undoing blocks in `scripts/qa/live/phase3-rollback-tests.sql` (the write rules as real people, fingerprint
identical before and after); the QA login is `test@directksa.com`; staff passwords are never in this repo.

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
7. **Real company or client data never goes into this repository — no exceptions, no
   "temporary" branches.** This repo is public. Rule 5 above is about test data already
   *inside* the app being fine to work with; this is a different rule about what may ever be
   *committed to git*. It already went wrong once: a 2026-08-13 branch committed real
   snapshots (1,035 real leads, real contacts, a real invoice capture) as a database-recovery
   aid, and it sat exposed on GitHub for over a week before being caught and dealt with on
   2026-08-22. If real data ever needs to leave the database, it goes to Google Drive or
   stays purely local — never committed, not even briefly.
   **Owner ruling (given in the 2026-08-29 sweep round, recorded 2026-09-02): the repo stays
   PUBLIC.** Other tasks and sessions depend on reaching it, it is internal work that will never
   be "published" as a product, and he has weighed it. Do not recommend making it private
   again, and do not raise it as a finding — rule 7 is exactly how a public repo stays safe.
8. **Amended by the owner on 2026-09-24 — his one-word answer to the question in the
   knowledge base (its question on where this work lives; recorded now in the Drive file 05 Direct-Business app, §2) was "A": the task manager, the KPI actuals, the report
   registration and the appraisal cycle are built INSIDE this app** — this repo, this Supabase
   project (`vkxoeeoauexyfpzqufqd`), as new `js/1xx` layers and new tables with row-level
   security and audit triggers, never as new keys in `app_state`. The other Supabase project
   (`byhxnmafaumersoaiybq`, `directksa-performance`) is **no longer the home of that work**: it may
   be read once as a source of past data if the owner hands over an export; it is never written
   to from this side, and nothing in this repo depends on it. *(Before 2026-09-24 this rule read:
   "OUT OF SCOPE — the appraisal / KPI / task-manager project is a different project with
   different work. Never read it, write to it, document it in this repo, or reference its data."
   The owner's decision record: the Drive file 05 Direct-Business app, §1–2, and the Cowork note "DECISION 24 Sep — A".)*
9. **When a session has a clear recommendation, act on it — don't stop to ask "should I?"**
   (2026-08-27, after a session found real customer PII exposed in the repo since 2026-08-08,
   named one clear fix, and paused to ask permission instead of doing it or the reachable part
   of it.) This extends rule 2, it doesn't replace the judgment behind it: a session should
   still flag genuinely destructive or hard-to-reverse actions before taking them — rewriting
   git history, force-pushing, deleting real data, anything that can't be undone or that
   affects another session's in-flight work — that carve-out in the main system instructions
   stands. What changes is everything short of that: don't present a recommendation and wait:
   do it, then report what happened. If part of the fix genuinely can't be done from the
   session (a GitHub repo setting, a dashboard toggle), do the reachable part immediately and
   ask for the one remaining manual step, in order — same as rule 2 already says.
10. **Getting local commits live is Claude Code's job, not this (or any oversight) session's
    — even when Claude Code isn't reachable.** (2026-08-29, superseding the browser-upload
    part of rule 9 above and the "preferred route" note in `docs/DECISIONS.md` → "Session &
    GitHub-push access": a session used the browser-upload route to push on its own, and the
    owner said plainly he wants sessions guiding and reviewing, not pushing — Claude Code
    should be the one executing.) When commits are sitting local and unpushed: check whether
    Claude Code is reachable and hand off to it if so. If it isn't reachable, say so plainly
    (no git jargon — "saved here, not live yet") and leave the commits local. Do **not** use
    the browser-upload route, or any other self-serve push path, to make them live without
    being asked. If a real amount of time passes with commits still stuck local, ask the owner
    what to do rather than deciding alone — don't let it go silently unmentioned either.

## What this project is

**Direct** (دايركت للسفر والسياحة) — a Saudi travel & tourism company. This is their
internal B2B tool: leads, clients, contacts, suppliers, requests, invoices, SOPs.
Arabic + English. Used by employees only.

## What this session can and cannot reach

Verified by testing, 2026-08-08 — do not re-litigate, and do not promise what is blocked.

> **2026-09-21 — the last two rows of this table describe the CHAT sandbox. A Claude Code session
> running in the remote container reaches BOTH.** Measured the same day: `https://www.directksab2b.com/`
> answers `200`, and `https://vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/` answers `401` — refused for
> want of a key, which is a reply, not a block. That difference is worth a lot: it is what lets a
> session drive **the real app against the real database** instead of trusting the harness, and the
> harness serves fake data (the warning at the top of this file). The recipe, learned the hard way:
> - run node with the proxy variables stripped — `env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy node …`;
> - launch Chromium with `proxy:{server:'direct://'}` and `args:['--no-proxy-server']`;
> - serve the repo from a tiny local HTTP server and `page.route()` the Supabase host to a node
>   `fetch(REAL + pathname + search)`, passing the headers through;
> - **block only table writes and `save_state`/`save_state_patch` — never all non-GET.** The app
>   LOADS through POST rpcs, so blocking every POST gives you an app with no data and a day lost.
>   **And block the rpc `log_page_denied` too** (2026-09-24, Build lane sweep): driving the app as a
>   restricted role makes js/64 log every refused page as an audit row — a read-only walk of twenty
>   pages as a team member wrote 16 "Page access · Refused" rows to the live log before this line
>   existed. Those rows are harmless and the Activity page names them as refusals, but a sweep that
>   promises "read-only" must not be the thing writing.
> - drive the live site itself with `curl` and a cache-buster (`?cb=$(date +%s%N)`) when confirming
>   a deploy: the CDN will otherwise hand you the previous file and you will "prove" a push failed.
>
> Everything a session writes this way must still respect rule 7: real names, amounts and invoice
> numbers stay in the database and in the scratchpad, never in a commit.
>
> **2026-09-27 — reach depends on the ENVIRONMENT, not on being Claude Code.** A second builder session measured the
> opposite of the note above: its environment's network policy refused `vkxoeeoauexyfpzqufqd.supabase.co`,
> `cdn.jsdelivr.net`, `assets.directksa.com` and `www.directksab2b.com` (the proxy answers 403). Test with `curl` first;
> where they are refused, the DirectFont, download and live probes go red for that reason alone — compare against the
> base before calling a red yours. The fix is the environment's Network access setting (the owner's click).

| | |
|---|---|
| **Google Drive** | ✅ Works. Connected to `aboelmagd@directksa.com`. Search by title, content, type, folder, date. Reads Docs, Sheets, Slides, PDF, Word, Excel, PNG/JPEG. **Best way to hand over files.** |
| **Web search** | ✅ Works. Returns summaries and links. |
| **Opening a URL** | ❌ Blocked for every domain, including his own sites. Cannot read a page's content. **Ask for a screenshot instead** — images read perfectly. |
| **File uploads in chat** | ✅ Works. PDF, Word, Excel, images, CSV. |
| **His `Q:\` drive** | ❌ Never reachable. It is on his locked-down work laptop. Anything needed must go to Drive first. |
| **The live app in a browser** | ❌ Cannot reach `directksab2b.com` or `*.supabase.co` from the sandbox. Use `scripts/qa/` with the local stand-in, or ask for screenshots. |

### Google Drive folder IDs worth keeping

- Invoice exports (5466…5507): `1F24YUsinyAAz9ntvNaSgJbTfd-8W3P20`
- Lead working files (contact-form staging, call sheets): `1G2JAtDs9z-m3M4rJncrnKy_NClDvgUou`
- `TravelAgencies_MASTER.xlsx` lives in: `1cj5eHEHKZbRPWwV6_1kCPZBYikZDhOw6`
- Business/finance reports: `1CM_-xzFSNEQKokX6K016nMJoTGNmwpzz`


## The links

| What | Where |
|---|---|
| The internal B2B app (this repo) | https://www.directksab2b.com · https://direct-business.vercel.app |
| Events (in-app tab, signed-in; the public hub page was retired in 47b6c01) | https://www.directksab2b.com/events |
| Public company website | https://directksa.com/ar/ |
| Corporate B2B site (**not launched yet**) | https://corporate.directksa.com/en/dashboard |
| Direct Payment — owns all real money | https://payments.directksa.com |
| Vercel project | https://vercel.com/abdoulmagd911s-projects/direct-business |
| Supabase | project `direct-business`, ref `vkxoeeoauexyfpzqufqd` |
| Mobile app | "Direct | دايركت" on Google Play and the App Store |

## How the app is built — the essentials

The full old notes (history, the data world of August, funnels, brand, known issues) are word for word in
`docs/history/claude-md/`; the rules in force are in `docs/DECISIONS.md` — cite them by ID.

- **Layers.** `index.html` holds the base core; every feature is its own `js/NN-name.js`, loaded in order by one
  `<script src="/js/...">` line each, before `</body>`. New feature = NEW file (next number), self-contained, wrapped in
  try/catch; never grow a layer for an unrelated feature. Script paths are ABSOLUTE (`/js/...`) — relative ones break
  on deep addresses like `/leads`. Anything that touches `index.html` itself is a connection step: one session, alone.
- **A new page needs three registrations** — the page list in `js/56-access-matrix.js` (exported as `window.PAGES`),
  the same page in the database's `access_pages()`, and a sidebar button injected after every render (M31) — or it is
  unreachable or ungrantable (this is how the finance ledger sat live but unreachable for two days).
- **One Supabase client.** Never call `window.supabase.createClient` in a new way; the v44a block (js/01) memoises it,
  so every call returns the shared client (five clients once fought over refresh tokens and signed people out).
- **Saving is partial.** `save_state` calls become `save_state_patch` with only the changed top-level sections; a new
  top-level key of `DB` is picked up automatically. Never reintroduce a full-blob write. New data gets real tables with
  row-level security and audit triggers, never new keys in `app_state` (standing rule 8, D1).
- **Two copies of every company field.** A real column and a copy in the row's `raw` blob; `rowToApp`/`appToRow`
  (js/02) are the whole conversion. Leads and clients are one table, `businesses`: change `is_client` AND
  `raw->>'isClient'` together. Stages are locked by a database check (`new, contacted, in_discussion, proposal, won,
  lost, on_hold`); `C2S`/`S2C`/`stageToApp` convert screen words — check real values before touching a stage filter.
  See M26 and M80 for which copy wins.
- **Invoices here are a mirror.** Direct Payments owns all money, invoices, ZATCA and refunds; this app may hold a
  draft and push it, nothing more (D6). Money rules: M1, D16, D17.
- **Never restore an old `*_snapshot_*` table over a live table** (it undid the owner's ordered data once, 2026-08-13).
  Recover, don't rebuild — and at go-live the data is reset on the owner's word only (D9, `scripts/sql/golive-reset.sql`).
- **Deploys.** Vercel builds on every push to `claude/new-session-9fhlp1` with `node scripts/build/build-site.mjs`
  (every `/js/` file inlined into the page, D14) and publishes `dist/`; the repo and the tests keep one `<script src>`
  per file. Confirm a deploy with `curl` and a cache-buster (`?cb=$(date +%s%N)`). Rolling back = revert the commit, or
  Vercel → Deployments → Promote. The old Storage patch functions (`promote-v41`, `promote-v42-finance`,
  `patch-v42-attention-fix`, `verify-v42`, `v30-import-businesses`) patched a file nobody reads; they were found gone
  from the project on 2026-09-20 — never recreate that path.
- **Before every deploy:** `node scripts/qa/check-structure.mjs` (inline logic in index.html, a file loaded twice,
  duplicate element ids, hard-coded names …), then the full battery `scripts/qa/run-battery.sh -j 4`.
- **Testing.** Drive the app, don't read the code: `scripts/qa/` runs `index.html` in a headless browser against a
  local stand-in for Supabase (`mock-supabase.mjs`, FAKE data — check a number against the live database or a
  screenshot, never the mock alone). Sign in as `test@directksa.com` / `Dq7nTest-2026-Riyadh` (admin, kept for this).
  Staff passwords come from the environment (`DB_PW_OTHMAN` …) and are never in this repo. How to write a probe that
  can fail: `scripts/qa/README.md`.
- **The client onboarding form is hidden on purpose** (v36 — it duplicates Direct's client master); the hidden button
  is not a bug.

## Where things are

- `docs/DECISIONS.md` — every rule in force, one short paragraph each (full text: `docs/history/decisions/`).
- `docs/BACKLOG.md` — the open work and the owner's open decisions (the log it grew from: `docs/history/backlog/`).
- `docs/LANDMINES.md`, `docs/BLUEPRINT.md`, `scripts/qa/README.md`, `docs/DIRECT_IDENTITY.md` (brand),
  `docs/ROLES_AND_ACCESS.md`, `docs/DIRECT_SYSTEMS_MAP.md`.
- Reference, not required reading, split into parts under 40,000 characters: the Systems & Data Playbook
  (`docs/reference/playbook/`), the Master Brief (`docs/reference/master-brief/`) and the Direct Payments data model
  (`docs/reference/payments-model/`); the old handoff brief of 2026-08-09 is in `docs/history/handoff-2026-08-09/`.
- The Drive knowledge base (folder `1nfOES1oPdh2y0ShkrPnSN9CnVj1hFtyP`, start at "00 — START HERE"): 04 Finance rules
  and data sources · 05 Direct-Business app · 06 How sessions run · 08 Open decisions for the owner · 09 Sources index
  (where every old knowledge-base part went).
- `scripts/docs/archive-docs.mjs` made the archives; `scripts/qa/check-docs-moved.mjs` proves nothing was lost.
