# Direct Business — working notes for Claude

> **2026-08-11 — `docs/BLUEPRINT.md` is the map.** The whole project in phases, one page
> per phase, with the rules of engagement (don't invent scope; verify EN+AR in the harness;
> Arabic pass closes each phase; schema-first for new data). Read it FIRST, then the handoff.
>
> **2026-08-10 — READ `docs/HANDOFF_2026-08-10.md` FIRST.** It is the single fresh-start briefing:
> current live state, everything shipped, the design correction, the landmines, and open loops.
> Then read this file and `docs/DIRECT_IDENTITY.md`. (`docs/HANDOFF_2026-08-09.md` is the detailed
> chronological log.)
>
> Quick current state: data is **assumption/test data** — **4 leads / 6 clients** (Direct IDs
> 101–106), 12 finance service-lines, 3 proposals; real data is in backups (`*_prewipe_20260810`).
> The app has been **re-skinned to Direct's real product UI** (cream `#FBF5F0` + `#ff6b00`).
> **Critical:** the QA harness serves FAKE data — verify UI against real Supabase rows or a
> screenshot, never the mock alone (that gap wasted a sub-session).

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

## Start here — the documents that carry everything

1. **`docs/BACKLOG.md`** — everything parked, why, and what finishing it looks like.
   Read at the start of a session, update at the end.
2. **`docs/DIRECT_MASTER_BRIEF.md`** — the business: strategy, the full sales workflow
   phase by phase, locked decisions, open questions.
3. **`docs/ROLES_AND_ACCESS.md`** — who can do what, read from the live database.
4. **`docs/DIRECT_SYSTEMS_MAP.md`** — Direct's three real systems (Direct Payments hub, the
   corporate B2B booking portal, the Executive CRM) vs. our app, the B2B money model
   (service → transaction → tax invoice; service fee = income), the link key (Direct client
   ID), and each system's design language. Read before touching Clients or Finance.

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

**Re-verification, batch 1 — 2026-08-09.** Moved the 6 companies Direct has actually invoiced
back to clients (`is_client=true` + `raw.isClient='true'` + `stage='won'` + `converted_date`):
Booking and Ticket Agency, Directorate of
Public Security, Maaal, الوسائل الوقائية للسلامة, المطاحن الأولى. So the app now has 6 active
clients again. Backup before the change: `businesses_snapshot_20260809_clientmove` (1,035 rows).
Undo = copy `is_client/stage/converted_date/raw` back from that snapshot by id. The other ~27
pre-reset "clients" stayed leads on purpose — they're duplicates (Ma'aden ×2, Riyadh Chamber ×3,
Booking &/and, Abdel Hadi ×2), study-abroad schools (Kaplan, ELC Chester, New College), or have
no invoice to prove the relationship. Big-name leads (SAMA, NEOM, Alshaya, alfanar, Kemya/SABIC,
Savvy Games, Webook) are **not** clients in the data (no invoices, never flagged) — do not move
them without Abdulrahman confirming. 68 leads still carry a `total_sar` amount with no matched
invoice — a soft signal, not proof; a possible next batch to review with him.

**Re-verification, batch 2 — 2026-08-09.** Moved **39** more companies from the `Old Customers`
+ `Invoice history` import (his Direct-Payments customer/invoice export) that carry real billing
(`total_sar>0`) → clients. Backup: `businesses_snapshot_20260809_clientmove2` (1,035 rows). Now
**969 leads / 45 clients** live. The remaining ~29 leads-with-an-amount are tender values or deal
estimates (tenders, suppliers like Amadeus/Booking.com, individuals) — left as leads on purpose.
The corporate-portal `Companies.html` export he shared is **test data** (that portal isn't
launched); the real client master is still only in Direct Payments. See `docs/HANDOFF_2026-08-09.md`.

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

**Full identity is now consolidated in `docs/DIRECT_IDENTITY.md`** (built 2026-08-10 from a
Drive sweep of the official 2026 profile + logo kit + real proposals). Read it before any
Direct-branded design. The old `#F47A1F` app-orange mismatch is **fixed** — the app now uses the
brand `#F06820` (97×). Note `#fc8004` is the *Direct Payments* admin theme, not the company
brand. (Historical: the brand said Arabic is always RTL while an early `applyLang()` hardcoded
`dir='ltr'`; the app has since been flipped to RTL in Arabic.)

## Testing

Always verify UI work by actually driving the app, not by reading the code. `scripts/qa/`
runs `index.html` in a headless browser against a local stand-in for Supabase. Sign in as
**`test@directksa.com`** / `Dq7nTest-2026-Riyadh` (admin, created 2026-08-08 and kept
deliberately for this). Screenshot the pages and look at them — several real defects on
Today and Leads were invisible in the code and obvious on screen.

**The team's real passwords are never in this repository.** It is public, and since
2026-08-13 the eleven accounts are the staff's actual working logins. `scripts/qa/emp-rig.mjs`
reads each one from the environment (`DB_PW_OTHMAN`, `DB_PW_RAAD`, …) and throws a clear error
if it is missing. Ask Abdulrahman for the list; keep it in a local file that is never
committed. Do not paste a password into a probe, a doc, or a commit message.


## Data world (rebuilt 2026-08-13 — the 30-lead training world)

> ⚠️ **NEVER restore old businesses/finance snapshots over the live tables.** On
> 2026-08-13 a concurrent session did exactly that and undid the owner's ordered world;
> it was re-applied. The exact current world is copied in `world30_*` tables for pure-SQL
> recovery; every older world stays in its `*_snapshot_*` tables. Recover, don't rebuild.

Owner-ordered rebuild: the previous data was wiped (kept in `*_snapshot_20260813` tables)
and replaced with **30 leads, each a different scenario**, every one owned by a real team
member, spread across all 7 funnels and all 7 stages. **10 are converted clients** with
full finance: 28 ledger rows covering paid invoices, pending transactions (tax invoice
later), commissions (held at supplier wallet), a credit note, project-origin invoices
under a proposal ref, and an aging story (4 overdue invoices, 216,115 SAR outstanding).
Services deliberately include Insurance, Intl driving permit, Translation, eSIM, Umrah,
Study abroad, MICE. Every finance group is linked to its client (`finance_client_links`,
`confirmed_by='auto-match'`) — linking is now automatic (js/42-v66), never manual.
The promo-code registry (`promo_codes`, 198 codes) remains as revenue way #4.
**Verification services (Takamol / Techtic Support) are accounted for in another system
and must NEVER appear in this app** — the importer skips them (like wallet top-ups) and
the legacy CSV import flags them; do not reintroduce them anywhere.
**Real company data lives in the database only — never commit names, amounts or invoice
numbers to this public repo.** QA fixtures stay synthetic.
`finance_invoices.revenue_way` records how revenue arrived: invoice / transaction /
commission / promo_code. VAT is stored (`vat_sar`) but never displayed — owner rule.
A database trigger (`finance_derive_fields`) enforces the doctrine on every insert:
revenue = total − wallet, profit = revenue − cost (the whole taxable amount), and
month/quarter derive from the invoice date.

## Rules for editing the app (SPLIT INTO FILES on 2026-08-12)

**The app is no longer one file.** `index.html` holds the base core; the 37 feature
layers now live in **`js/NN-name.js`**, loaded in numeric order by `<script src="/js/...">`
lines before `</body>`. Behavior is identical (each file was a self-contained script
block already); what changed is that parallel work is now safe when sessions touch
DIFFERENT files.

- **New feature = NEW file.** Create `js/NN-short-name.js` (next number), self-contained,
  wrapped in try/catch, and add its `<script src="/js/NN-short-name.js"></script>` line at
  the end of index.html before the v-final blocks. Never grow an existing layer for an
  unrelated feature.
- **Parallel sessions rule (owner works this way):** two sessions may run at the same time
  ONLY if they work in different files. Anything touching `index.html` itself (the core,
  nav wiring, a new script line) is a "connection step" — do it in ONE session, alone.
  Build-standalone-first, connect-alone-last.
- Script src paths must be ABSOLUTE (`/js/...`) — relative paths break on deep-address
  reloads like `/leads`.
- The QA mock (`scripts/qa/`) serves `js/` files exactly like Vercel does; all probes run
  against the split app unchanged.

## Before every deploy

Run `node scripts/qa/check-structure.mjs`. It fails loudly on the patterns that caused the
repeated duplication bugs: inline `<script>` logic in index.html, the same js file loaded
twice, two layers creating the same element id, hidden-option trimming, hard-coded names,
`window.DB` guards. A doc rule did not stop the second occurrence; this check does.

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
- **The lead/client-detail cards are built by injection layers, not the base render.** The
  detail page is enhanced after render by a stack of `try/catch` blocks at the end of the
  file, each wrapping `renderLeadDetail`/`render` and injecting one card with a `setTimeout`
  and a `view.querySelector('.vNN-…')` guard so it renders exactly once. The current stack:
  `v33` service-fit map (leads **and** clients), `v34` Direct-link banner (clients only),
  `v35` suggested-next-step nudge (active leads only), `v36` "profile managed in Direct" note
  (clients only). If you add another, copy that pattern and gate on `b.isClient` correctly.
- **The client onboarding form is deliberately collapsed (v36).** The full local onboarding
  editor (`v22OpenClientOnboarding`) duplicates Direct's client master (CR/VAT/IBAN, pricing
  scheme, credit line, documents) — the duplication trap. `v36` **hides** the loud
  "🏛 KSA onboarding" button and shows a "managed in Direct ↗" note instead. This is a
  reversible hide, **not** a delete: the function is untouched and still reachable via the
  note's quiet "local form" link and the "Edit client profile (full form)" button. Don't
  "fix" the hidden button — it's intentional.

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
- ~~**The Leads stage filters miss almost every lead.**~~ **FIXED 2026-08-09.** Two
  separate problems were resolved. (1) The chip vocabulary was expanded to match the real
  data — chips now read All / New / Prospect / Contacted / Qualified / Proposal / Won / Lost
  (the app converts DB `new`→screen `Prospect`/`New`, `in_discussion`→`Qualified`, etc. via
  `C2S`/`stageToApp`), and the counts are computed from the live records. (2) The chips were
  *also* a no-op: clicking one highlighted it but filtered nothing, because the handler hid
  `.lead` card elements while the Leads list renders as a **table**. They now drive the real
  pipeline (`leadFilter.stage` + `drawLeads()` → `matchLead`), the counts reflect leads only,
  and the active chip + the "All stages" dropdown stay in sync. Verified in the harness (each
  chip filters to exactly its stage; badge count == rows shown; EN+AR clean).
- `business@directksa.com` is listed as an admin in `access_allowlist` but has no login
  yet. Abdulrahman's other address, `aboelmagd@directksa.com`, is a working admin.
