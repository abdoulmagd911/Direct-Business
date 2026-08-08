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

## Start here — the three documents that carry everything

1. **`docs/BACKLOG.md`** — everything parked, why, and what finishing it looks like.
   Read at the start of a session, update at the end.
2. **`docs/DIRECT_MASTER_BRIEF.md`** — the business: strategy, the full sales workflow
   phase by phase, locked decisions, open questions.
3. **`docs/ROLES_AND_ACCESS.md`** — who can do what, read from the live database.

## What this session can and cannot reach

Verified by testing, 2026-08-08 — do not re-litigate, and do not promise what is blocked.

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
| Events hub | https://www.directksab2b.com/events |
| Public company website | https://directksa.com/ar/ |
| Corporate B2B site (**not launched yet**) | https://corporate.directksa.com/en/dashboard |
| Direct Payment — owns all real money | https://payments.directksa.com |
| Vercel project | https://vercel.com/abdoulmagd911s-projects/direct-business |
| Supabase | project `direct-business`, ref `vkxoeeoauexyfpzqufqd` |
| Mobile app | "Direct | دايركت" on Google Play and the App Store |

## How the data actually works

- **Leads and clients are the same table** (`businesses`). `is_client` flags which — and the
  app reads **both** the column and `raw->>'isClient'`, so changing one without the other
  leaves records half-converted. Change both.
- **A lead's screen stage is not its database stage.** `C2S` converts database → screen,
  `S2C` converts back, and `stageToApp` keeps a record's original wording when it maps to
  the same database stage. That is why 740 leads read "New" and 202 read "Prospect" while
  both are database stage `new`. Check real values before changing any stage filter.
- **Seven funnels**, each with its own bilingual field template in `funnels.field_template`,
  and per-lead answers in `businesses.funnel_details`.
- **Invoices here are a mirror, never the source.** Real invoices are minted in Direct
  Payment. This app may hold a draft and push it — nothing more.
- **Individuals are not leads.** Some past invoices are private people; they belong in
  finance reporting as individual bookings, not in the pipeline.

## Open work: docs/BACKLOG.md

Everything deliberately parked lives there — roles, users, ownership, Arabic, the Drive
consolidation, the travel-agencies project, client re-verification. **Read it at the start
of every session and update it at the end.** Abdulrahman asked to be reminded of these; the
file is the reminder, so surface anything relevant rather than waiting to be asked.

**Clients were reset on 2026-08-08** — all 32 went back to leads for re-verification because
the data was four months stale. Nothing deleted: `businesses_snapshot_20260808` (1,035 rows)
and `contacts_snapshot_20260808` (335 rows) hold the full prior state, admin/manager only.

## Read this first: docs/DIRECT_MASTER_BRIEF.md

A 140 KB brief Abdulrahman assembled from months of earlier sessions — the business, the
three-phase vertical strategy, the full sales workflow phase by phase, roles, reports,
locked decisions and open questions. Read the sections you need before proposing anything;
most "new" ideas are already decided in there.

Things it settles that matter constantly:
- **Stages are locked**: `new, contacted, in_discussion, proposal, won, lost, on_hold`,
  enforced by a database check constraint. Old names survive in `stage_legacy`. Any screen
  showing different words (New/Qualifying/Proposing) is the bug, not the data.
- **This app is not a system of record.** Direct Payment (payments.directksa.com) owns all
  money, invoices, ZATCA, refunds and settlement. This app mirrors and coordinates; it may
  hold an invoice *draft* and push it, nothing more. Every real-money button must name the
  system it calls into.
- **Won auto-converts to client** — trigger sets `is_client` and `converted_date`.
- **No cross-company data smuggling**: every email/phone/website/address on a lead must
  attach to the same company by a stable key (CR number > verified root domain > exact
  normalised name > phone prefix). Mismatches get flagged, never silently merged.
- Subagents are banned (credits burned, June 2026). Don't spawn them.
- Abdulrahman's work laptop is locked down — Q drive only, no shell, no installs. His
  primary account is business@directksa.com; a.hassan@directksa.net is his Team-Member view.

## The lead funnels (live, already built)

Six funnels exist and 1,010 of 1,013 leads are assigned to one. Each carries its own field
template in English and Arabic:

| Funnel | Leads | Funnel-specific fields |
|---|---|---|
| Travel Trade | 522 | MoT licence · Licence status · IATA · City/branches · Competitor or partner · Partnership angle · Master registry link |
| Partners & Tenders | 245 | Partner type · Has mobile app · API/partner program · Tender value · Tender deadline · Tender status |
| Website Form — Entities | 78 | How we identified them · Official website/phone/email · Region · City · Form received on · Research status |
| Outreach & Network | 63 | Where we found them · Event · Event date · Booth/meeting · Who knows them · Planned approach |
| Inbound | 60 | Original message · Received on · Service requested · Replied? · Channel |
| Website Form — B2B | 42 | Original form message · Inquiry type · Service requested · Submitted on · Region · City · Original sheet stage · Sheet notes |

**The invoice-mined leads are NOT lost.** Google Drive folder
`1F24YUsinyAAz9ntvNaSgJbTfd-8W3P20` holds ~18 spreadsheets named by customer number
(5466 … 5507). Each is a Direct Payment export for one B2B customer: company name,
business email, business phone, DPIN invoice numbers, dates, amounts, VAT, payment status,
branch and salesman. That is a ready-made source for the invoice funnel — companies that
have already paid Direct, with the amounts. Related staging files sit in folder
`1G2JAtDs9z-m3M4rJncrnKy_NClDvgUou`: CONTACT-FORM-B2B-STAGING.csv,
CONTACT-FORM-CLASSIFIED.csv, CONTACT-FORM-MERGE-PLAN.csv, VENDORS-FROM-CONTACT-FORM.csv,
CALL-SHEET-WEBSITE-FORM-LEADS.xlsx, CALLING-LIST-TOP50.csv. The master registry is
`TravelAgencies_MASTER.xlsx` (693 KB) and live form submissions are in the
"Contacts Submissions" Google Sheet.

### Past Invoices funnel — built 2026-08-08, load unfinished

Funnel `past_invoices` ("Past Invoices" / «فواتير سابقة»), 11 fields, sort_order 7. Two
companies loaded so far as a proven pattern; **14 of the ~18 source files still to do.**

Rules learned from reading the source files — apply them to the rest:

1. **Not every file is a company.** `5468` is ABDULLAH ALHAYAN on a personal Gmail — an
   individual, B2C, not a B2B lead. Judge by the *customer name* (شركة / Co / Ltd / LLC /
   school / institute), not the email.
2. **A company can have a personal email on file.** `5504` is a large contracting group
   whose only contact address is a Gmail. Per the no-cross-company-smuggling rule, do not
   attach it as the company email — set `needs_manual_confirmation` and say why.
3. **Unpaid drafts are the best re-approach reason.** `5504` drafted 30,850 SAR of flights
   and never completed. That is a warmer opening than a cold call.
4. Each file may hold many invoices for one customer — sum them for lifetime billed, count
   them, and take the newest date and DPIN.

Loaded: `inv_5466` Bayswater (10 invoices, ~49,290 SAR, study abroad) and `inv_5504`
Al-Qahtani/Sinopec (1 draft invoice, 30,850 SAR, flights).

Known gaps against what Abdulrahman has described: there is **no funnel for leads mined from
old invoices**, nothing yet distinguishes the new corporate site (corporate.directksa.com)
from the main site forms, and only 483 of 1,013 leads have any funnel-specific data filled in.

## Brand (from the `direct-brand` skill)

Orange `#F06820`, service-table header `#F87020`, cover gradient `#E54525 → #F26721`, gold
`#FBAE16`, ink `#303848`, muted `#6B7480`, hairline `#E6E8EC`, wash `#F6F7F9`, wash-orange
`#FFF3EC`, logo-mark orange `#FF6C00`, slate `#323E49`. English = Proxima Nova Alt,
Arabic = 29LT Zarid Slab. Founded 2016, Riyadh, 200+ specialists. Voice: "Global supplier
power. Saudi service. One partner."

Two mismatches worth knowing: the app uses `#F47A1F` as its orange, not the brand `#F06820`
(the events page does use the brand value); and **the brand says Arabic is always RTL**,
while `applyLang()` hardcodes `document.documentElement.dir='ltr'`.

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
- **The Leads stage filters miss almost every lead.** The chips read
  *New / Qualifying / Proposing / Won / Lost*, but `businesses.stage` holds
  `new, contacted, in_discussion, proposal, won, lost`. Only Won and Lost line up. In the
  live data that is 973 of 1013 leads sitting at stage `new` while the "New" chip counts
  zero. Two vocabularies; `STATUS_TO_STAGE` maps some of it but not the filters. Verified
  in a browser sweep and against the live table. **This is the next thing to fix.**
- `business@directksa.com` is listed as an admin in `access_allowlist` but has no login
  yet. Abdulrahman's other address, `aboelmagd@directksa.com`, is a working admin.
