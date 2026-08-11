# Action items — things deliberately put on hold

Living list. Every session should read this and update it. Nothing here is forgotten,
it is *parked*, and each item says why and what "done" looks like.

Last reviewed: **2026-08-10**

## 0 · THE GO-LIVE PLAN (owner-directed, 2026-08-10) — read before anything else

Abdulrahman's direction: **the product is four pages — Leads, Clients, Finance,
Settings (Team & Access)** — plus whatever connects them. Rebuild/polish them one
at a time to the corporate-admin product design, keep them connected (a change on
one reflects on the others), bulletproof each, get his screenshot yes/no, THEN move
on. Everything else (Events, Airlines, SOPs, Reference pages) waits. Current data is
assumption/test data for exercising scenarios; it will be reset to zero before real
data goes in. Mix Direct's own way (client-centered: onboarding, policies,
travelers, dedicated advisor — see the B2B Feedback sheet + Enterprise Brief in
Drive) with how the leaders (Egencia/Navan/TravelPerk-class) keep one job per
screen with zero noise.

Order of work (per page: polish visuals → verify EN+AR in the harness → screenshot
for approval → deploy → delete the old layers that page no longer needs):
1. **Leads** — list is healthy after the 08-10 fixes; remaining: real SVG icons,
   priority-score tuning (new leads all read Cold), detail-card layout pass.
2. **Clients** — column decision MADE (owner said "you decide", 2026-08-10):
   kept Next review (drives the review reminders) + Tier; dropped the always-empty
   Area and Channels columns from the list (the fields stay on the edit form).
   Remaining: detail card shares the Leads header work.
3. **Finance** — DONE 08-10: numbers verified, chart on product palette
   (orange/ink), Top-clients counts distinct invoices, rows drill to client.
   SERVICE COVERAGE (owner, 08-10): catalogue extended to Direct's FULL official
   service list (Study abroad, Furnished apartments, Translation, Intl driving
   permit, VIP meet & assist, Event halls, Shipping, Chauffeur — all with Arabic);
   service-fit map gained Study abroad (core) + VIP/Translation/Shipping/Halls;
   proven end-to-end with test invoice DP-2006 (Falcon Events: Packages + Study
   abroad + Transport, 47K, linked). Undo: DELETE FROM finance_invoices WHERE
   invoice_no='DP-2006'. Finance tables are data-driven — any billed service
   appears automatically.
   SERVICE FAMILIES + REPORT STORAGE (owner, 08-10, after the Drive report sweep):
   income-by-service now rolls up into FAMILIES (Air/Stay/Ground/Visas&docs/Religious/
   Packages&tours/Corporate&events/Education/Support&extras — SVC_GROUPS, EN+AR),
   brief by default, each expandable to its exact services; paginator excluded from
   this rollup. finance_invoices gained branch / salesman / project_tag / discount_sar
   (nullable) so the real Payments exports import losslessly. THE STORAGE DOCTRINE
   (from Q1Q2_2026_B2B_Audit + DirectVisa promo report + the owner's card sheet):
   store RAW rows once (one row per transaction/line, paid-status + integrity flags on
   the row), derive every summary live from them, never store report numbers by hand;
   quality/integrity findings get recorded per issue like the audit's Methodology
   sheet. Report Builder + income card already follow this.
   LOST-LEAD LEARNING LOOP (owner, 08-10): moving a record to Lost now PROMPTS for
   the reason (bilingual), stores it in lost_reason + logs a Lost activity, and the
   record card shows "Why we lost it" in red; lost leads stay findable under the
   Lost chip. LIVE TEST DATA now: 11 clients / 7 leads / 15 invoices / 4.59M SAR
   incl. tender-in-proposal (Riyadh Chamber), supplier-partner (Amadeus), lost
   agency with comeback note (Elite Holidays), partial payment with 40K outstanding
   (Benchmark) — undo via source_batch='lifecycle rehearsal' + legacy_id lc_*.
   NOTE: the QA mocks mirror only part of this richer live set — next session may
   re-sync scripts/qa/mock-seed.mjs if screen-accurate counts matter.
   BILLING ACCOUNTS (owner explained, 08-10): one real company can be registered
   in Direct Payments as 2-3 'companies' (Prepaid / Postpaid / Tender) because the
   payment system cannot change an invoice type per account. NOT duplicates. Model:
   ONE card per real company + raw.billingAccounts=[{id,mode}] listed as chips on
   the Linked-to-Direct strip; finance_client_links already rolls all its groups up
   to the one company. MDD resolved live as the first example (IDs 1 Prepaid + 2
   Postpaid, flag cleared with an explanatory activity). When linking finance,
   map EVERY billing account's invoice group to the same company card.
   FINDING (worker-path UI test): a lead created via "+ New business" gets NO
   default owner in the harness (assignedTo empty) — check on live login whether
   meName() resolves at creation time; if not, default owner to creator.
4. **Settings/Team & Access** — DONE 08-10: emoji stripped, legacy free-text
   team editor retired, all top cards anchored below the single page heading.
DONE 08-10: the blob→tables MIGRATION — app_requests/app_offers/app_projects
created + seeded (4/3/1), RLS mirrors app_state; app layer v59 reads the tables
on load and dual-writes row-by-row after each save (blob keeps its copy =
rollback is deleting the layer; backup app_state_backup_20260810_premigration).
Same-section concurrent edits are now safe per RECORD on these three sections.
Still in the deletion round: the DELETION round — remove patch layers
the cleaned pages no longer need (verify each deletion with scripts/qa/
sweep-consistency.mjs + drive screenshots before deploy) — then migrate
requests/offers/projects out of the app_state blob into real tables, then the
full go-live gate sweep (all four pages, EN+AR, every button, all numbers).
Then: **code lightening by deletion** — after each page is rebuilt, delete the
patch layers it made obsolete (never delete first). Finally: move requests/offers/
projects out of the app_state blob into real tables (ends last-write-wins).

### Shipped 2026-08-11 — Finance round 2 (10b25ac): plan-vs-actual · credit · items · CSV · numbers-first
Owner feedback on round 1 (phone screenshots): main views must show ACTUAL NUMBERS —
cost, profit, total revenue — not percentages, and no invoice-count column; the
percentages belong INSIDE each client. Nothing thrown away, view changed. Done: Top
clients = Client/Revenue/Cost/Profit; income-by-service dropped Margin%+Inv; client
card strip gained Cost/Profit/Margin%/Credit held. Rule to keep: MAIN VIEW = numbers,
DETAIL VIEW = percentages & counts.
Coverage check of the exec dashboard's OTHER tabs (Finance 26 / B2B / Tenders,
screenshots taken): Remaining Credit → built (finance_client_links.credit_balance_sar,
KPI card 'Client credit (held)', test: Takamol 250K + MDD 60K = 310K); uncollected
money → already covered (Outstanding KPI + Collections & AR aging); plan-vs-actual
(متوقع/مؤكد/فعلي) → built (finance_targets table seeded with the REAL 2026 plan:
13.2M expected / 11.3M confirmed; strip with attainment bar; pro-rated for part
periods with label; admin Set-targets button); B2B deals list & Tenders table → the
app's Leads/funnels + proposals ARE the upgrade of those (not duplicated); Excel →
CSV export of the filtered ledger (UTF-8 BOM for Arabic).
Invoice items (owner: each invoice has different items): finance_invoices.items jsonb
({d,q,u} per item under a service line), shown in the invoice card; DP-2006 seeded.
Mobile: monthly chart wrapped in its own scroll — page no longer scrolls sideways
(verified at 390px).
All harness-verified (probe-finance.mjs covers periods math, plan strip, credit card,
clean tables, CSV rows, items, proposal jump, client-card percentages); sweeps green.

### Shipped 2026-08-11 — Finance: periods, invoice origin, executive-dashboard design (193a3a3)
Owner: finance is stored/read monthly, quarterly, half-yearly, annually; the Finance page
is an UPGRADE of his real "Direct-B2B-Executive-Dashboard.html" (Drive, lead-files folder
— orange header, KPI cards with status chips فعلي/مؤكد/متوقع + colored top borders,
orange section accents, dark-slate tables with % pills, quarter chips, Excel export);
each invoice is either a normal BOOKING or part of a full PROJECT with a real proposal —
strategic & quality teams request the proposal behind an invoice.
Shipped: (1) period bar on Finance Overview (year · All/Q1–Q4/H1/H2 · month) driving
KPIs, income-by-service, collections, monthly chart, top clients — all derived live,
hand-verified (All 3.12M / Q1 2.23M / Q3 886.0K / H1=Q1 2.23M / Aug 516.0K exact);
(2) finance_invoices.origin + proposal_ref (migration invoice_origin_and_proposal_ref),
ledger origin filter + project/ref chips, invoice modal shows Origin/Proposal with an
Open-proposal jump to the Proposals page; test data tagged (Rawabi→DB-500101 project,
Falcon DP-2006→DB-500102 project, Bright→booking w/ price-offer DB-500103);
(3) design pass to the executive-dashboard language (finh accent headings + period
sublabels, KPI top borders, dark table headers, margin pills, dark totals row).
Landmine hit & fixed: injected code called the _lh helper before its var line → ledger
rendered blank (silent catch in the v42 wrapper) — moved helper to top of rLedger.
Mocks updated (scratchpad + scripts/qa) with origin/proposal_ref.
LATER (recorded, not done): the exec dashboard's B2B/Tenders deal-tracking tabs and
plan-vs-actual (متوقع/مؤكد targets vs actuals) are NOT in the app yet — candidate next
phase: a "targets" table (year, service, target_sar) to light up expected-vs-actual on
the same period bar; Excel export per period from the Report Builder.

### Shipped 2026-08-11 — proposals learned from the real thing (live, commit 7b618ba)
Read Direct's actual tender offer from Drive ("techincal offer final 1.pdf", the
Human Rights Commission agreement, folder 1pG4Sgp8Jo7zUqNz5DuMFDkW6X18XBcqR). Its real
skeleton: About Direct → work plan → numbered scope of services (each with process
steps) → 4-phase timeline → past work (Ma'aden 2M / Al-Hilal 1.5M / SFDA 500K /
Takamol 4M / Riyadh Club 1M) → team → quantities table without prices; the separate
FINANCIAL offer prices the same table and defines every payment as
**contracted service fee + cost of the requested service** (رسوم الخدمة التعاقدية +
تكلفة الخدمة المطلوبة) on a monthly schedule.
Applied to the app, kept SIMPLE per the owner:
- Generate-branded-proposal now renders the Scope box as the signature numbered
  services table (# / Service · الخدمة, brand-orange #F87020 header) — one line in
  the Scope box = one row. Single-paragraph scopes still render as prose.
- New "How we start · كيف نبدأ" 4-step strip from the real work plan (sign → needs
  analysis + dedicated advisor 1–2 days → free digital platform 1–3 weeks → ongoing
  24/7 service).
- The money note now states the real fee model verbatim, EN+AR.
- Verified in the harness by capturing the print popup: 6 rows, 4 steps, EN+AR fee
  model, 0 page errors; consistency sweep 8/8.
OWNER FEEDBACK (08-11): the first version looked like a summary card, not the real
proposal — "our proposals have a front page, a last page, the proposal in between,
and a logo"; also: don't confuse PROFILE (who Direct is — brochure, no client) with
PROPOSAL (for one client: cover → contents → about → plan → scope → commercial →
closing) with PRICE OFFER (the small quotation — the app's quote print covers that).
REBUILT same day (commit 57eef58): the generated proposal is now a true paged A4
document — gradient cover with the WHITE logo (derived from the app's real logo
asset via CSS filter; aspect-stretch flex bug found and fixed), contents page
(يشمل هذا العرض الآتي), about page with stat band (numbers verified against
"Direct Profile En"), signature services table page (# / Service · الخدمة /
Fee · الرسوم — "Service | 25" syntax fills the fee; technical proposals point to
the separate financial offer), work-plan + commercial page, gradient closing page
with contacts. RTL in Arabic. Print = exactly 6 A4 pages (verified headlessly).
Brand orange in the document corrected to #F06820 per the direct-brand skill.
STILL OPEN in this phase: owner screenshot yes/no on the paged document; optional
past-work page (Ma'aden 2M / Al-Hilal 1.5M / SFDA 500K / Takamol 4M / Riyadh Club
1M) as an opt-in for tender-type proposals; embed licensed brand fonts is NOT
possible in the public repo — document uses font-family references with fallbacks.

### Shipped 2026-08-10 (continued) — declutter round
- Nav: 16 flat items → 8 working pages + collapsed **Reference** group (auto-opens
  on its pages) + the existing From-Direct group. EN+AR.
- **Offer Builder → Proposals** everywhere users see it (nav, title, Team & Access).
- Today hero de-jargoned (Tickets due soon / Being chased / Low-profit offers /
  'Nothing urgent right now'); AR keys updated. ⌘K and ? chips hidden.
- Emoji stripped from the four pages' chrome at SOURCE (record-header CTAs, HQ/Map
  line, Finance strip heading, Link-finance button, Chain of command, all Settings
  tiles, Team & Access heading). 'Create offer' button now reads **Create proposal**.
- Settings: legacy free-text "Team (lead owners)" editor retired — owners come from
  real users via Team & Access (v56).


### Shipped 2026-08-10 — four screenshot-verified defects fixed (live)
- **Finance "Income by service line" told a false story** — it showed the service fee as
  the *entire* gross billed and 100% margin on every row, contradicting the Profit tile
  above it. Fee now = revenue − cost (Flights 43.0K / 7%, all-services 68.5K = the Profit
  tile exactly).
- **The record detail header painted buttons over the company name.** Injected button
  groups (Create offer / New booking, HQ / Maps) crushed the flexible name column to 0px.
  The row now wraps and the name column keeps a real minimum width (`v58` style block).
- **The Operations kanban collapsed into 150px columns with cards spilling across them.**
  Cause: the v26 "KPI grid" heuristic (any div with 4+ numbers becomes a stat grid) was
  stamping the board, its columns and its cards. The board, tables and timelines are now
  excluded — and the same guard stops the v26.3 Insights drawer from hiding the Leads
  table as an "aggregate block".
- **The Leads list ignored its own data** — every row showed "—" for Last activity and
  Next action. `rowToApp` now derives `lastContact` from the newest logged activity and
  maps `created_at`/`converted_date`; the Next-action cell falls back to the follow-up
  date; the conversion rate is now won ÷ all leads (was won ÷ decided = a meaningless
  100%). Strip verified: 10 new this month · 4 in pipeline · 60% · 9 days.

### Shipped 2026-08-09 (live)
- **Declutter of Leads / Clients / Finance** — removed the dead "Open in Direct" columns,
  scoped the "Has app" filter to Leads, removed the empty "Active" client chip, fixed the
  "At risk" client chip (was matching nothing), and fixed the Export dropdown so its items
  return to English when the app is switched back from Arabic.
- **Client health** badge (Good / Watch / At risk / New), **lead Priority** column
  (Hot/Warm/Cool/Cold, sortable), and a **leads Conversion strip** (new this month, in
  pipeline, conversion %, avg time to win).
- **Leads stage chips now actually filter** the table (they used to highlight but do nothing),
  with truthful leads-only counts. This closes the "next thing to fix" that was in the
  known-issues list.

---

## 1 · Data consolidation across Google Drive — **biggest open job**

The work was done across multiple devices and multiple assistant sessions, so the same
entity appears in several sheets with different details, and dozens of working files were
created that nobody has reconciled.

**Goal:** one record per real entity, carrying every detail found anywhere, with a note of
which files each detail came from.

Known sources, all confirmed present in Drive:

| File | Folder | Size |
|---|---|---|
| `TravelAgencies_MASTER.xlsx` | `1cj5eHEHKZbRPWwV6_1kCPZBYikZDhOw6` | 693 KB |
| `Contacts Submissions` (live Google Sheet) | My Drive | 42 KB |
| `B2B` (Google Sheet, actively edited) | My Drive | 70 KB |
| `CONTACT-FORM-B2B-STAGING.csv` | `1G2JAtDs9z-m3M4rJncrnKy_NClDvgUou` | 81 KB |
| `CONTACT-FORM-CLASSIFIED.csv` | same | 33 KB |
| `CONTACT-FORM-MERGE-PLAN.csv` | same | 13 KB |
| `VENDORS-FROM-CONTACT-FORM.csv` | same | 4 KB |
| `CALL-SHEET-WEBSITE-FORM-LEADS.xlsx` | same | 32 KB |
| `CALLING-LIST-TOP50.csv` | same | 9 KB |
| ~18 invoice exports `5466…5507.xlsx` | `1F24YUsinyAAz9ntvNaSgJbTfd-8W3P20` | 5–23 KB each |

**Matching rule (locked, from the master brief):** join records by CR number first, then
verified root domain, then exact normalised name, then phone country prefix. Never merge on
a personal email. Where two records disagree, keep both values and flag rather than pick.

**Method that works:** read files one at a time and write findings to a scratch table as you
go, rather than trying to hold them all at once. A single session cannot read every file in
one pass.

---

## 2 · Travel agencies project — scattered, needs collecting

Travel agencies are a different kind of lead from a contact-form enquiry. They are
**competitors as well as customers**, so each one needs its own offer and its own service
list — you cannot sell the same bundle to all of them.

What matters per agency: online or offline, whether they have their own app, whether they
resell or need white-label, which services they lack and would buy from Direct, which they
compete on.

`TravelAgencies_MASTER.xlsx` (693 KB) is the anchor file. The Travel Trade funnel already
holds **522 leads** with fields for MoT licence, licence status, IATA, city/branches,
competitor-or-partner and partnership angle — so the structure exists; the data is scattered.

The brief also records a pending restructure: split Travel Trade into subcategories —
TMC, OTA, Retail, Wholesale, Religious, MICE, Inbound, Land tour operator,
Government/Tender — and add a BNPL / Fintech merchant funnel.

---

## 3 · Clients — reset done, re-verification pending

**Done 2026-08-08:** all 32 client records reset to leads. Company names are real; invoice
and detail data was four months stale. Every one is flagged `needs_manual_confirmation`
with the reason on the record.

**Nothing was deleted.** Full copies live in `businesses_snapshot_20260808` (1,035 rows) and
`contacts_snapshot_20260808` (335 rows). To restore one:

```sql
update public.businesses b
   set is_client = s.is_client, converted_date = s.converted_date, stage = s.stage
  from public.businesses_snapshot_20260808 s
 where s.id = b.id and s.legacy_id = '<legacy_id>';
```

**Still to do:** re-check each company against current invoices and promote back to client
only when the data is current.

---

## 4 · Individuals — park, do not delete

Some invoices are for private people, not companies (e.g. invoice file `5468`, a personal
Gmail). They are not B2B leads and should not sit in the pipeline.

But they are not rubbish either: Direct made those bookings as a B2B team, so they belong in
the **finance reporting as "individual bookings"**, not in Leads or Clients.

**Decision needed:** where individual bookings surface on the Finance page and how they are
counted. Until then, do not load them as leads.

---

## 5 · Roles and permissions — on hold by request

Full picture in `docs/ROLES_AND_ACCESS.md`. The one that matters:

> **Switching a user off does not cut their access.** Five tables (`master_db_companies`,
> `app_state_bak`, `generated_documents`, `ksa_events`, `share_links`) are written as "any
> signed-in user" and never check the role, so a deactivated account keeps full access to
> the company registry, the workspace backups, and share-link creation.

Also open: whether `viewer` should see finance; whether `operations` should be able to edit
contacts; enforcing `allowed_pages` in the database or dropping it.

## 6 · Users and logins — on hold by request

- `business@directksa.com` is allow-listed as **admin** with no login yet.
- `aboelmagd@directksa.com` and `a.hassan@directksa.net` have **blank names**, so the app
  shows "aboelmagd" / "a.hassan" in the sidebar and greeting.
- `test@directksa.com` (admin) is the standing QA account — keep.

## 7 · Ownership — blocked on the users work

`assigned_to` and `account_manager` are free text, not links to real users. **0 of 1,015
leads have an owner.** Until this is fixed there is no "my leads", no per-person view, and
no owner-based permissions.

---

## 8 · Arabic — on hold by request

- **135 pieces of UI text** stay English when the app is switched to Arabic (list produced
  by `scripts/qa/sweep-language.mjs`).
- `applyLang()` hardcodes `document.documentElement.dir='ltr'`, so Arabic never lays out
  right-to-left — **and the brand guide says Arabic is always RTL**, so the app is off-brand
  here, not merely inconsistent. Flipping it on a 1.2 MB file needs care.

## 9 · Two people editing the same section

Saves are per-section since 2026-08-08, so different sections are safe. Two people editing
*the same* section at the same moment is still last-write-wins. Real fix: move bookings,
invoices, offers and requests out of the single JSON row into proper tables.

## 10 · Corporate website leads — waiting on launch

`corporate.directksa.com` has not launched. When it does: its form feeds the same funnels,
default Inbound / stage `new`, with a source stamp. Decide whether website-onboarded leads
need an onboarding phase of their own.

## 11 · Stage wording — deferred deliberately

Screen words (`Prospect`, `Qualified`) differ from the locked database words (`new`,
`in_discussion`). Filters and badges now agree, so nothing is broken. Renaming the display
words means touching `LEAD_STAGES`, `LSTAGE_COLOR`, `STAGE_PROB`, `STATUS_TO_STAGE`, `C2S`,
`S2C` and two seed importers together — a miss leaves a stage with no colour. Own pass.

---

## 11b · Two words for one stage — normalise when convenient

Live data carries **740 leads reading "New"** and **202 reading "Prospect"**. Both are
database stage `new`. `stageToApp` keeps a record's original wording when it maps to the
same database stage, so both survive. Both now have a chip, so nothing is hidden — but two
chips meaning the same thing is confusing.

Fix when convenient: set `raw->>'stage'` to one word across those 942 records, then drop the
spare chip. Reversible via `businesses_snapshot_20260808`. Low risk, cosmetic, not urgent.

## 11c · A company can arrive through more than one door

`funnel_id` holds a single funnel, but Bayswater was reached by outreach **and** has invoice
history. On 2026-08-08 the invoice record was merged into the outreach record and the
duplicate archived — the invoice fields now sit in the same `funnel_details`, but the record
shows only one funnel.

Before loading the remaining invoice companies, decide: does a lead need a **list** of
sources rather than one funnel? This affects the whole consolidation job.

## 1b · ⚠️ The invoice-mining work has been started twice, and duplicated itself

Found 2026-08-08 by a full-database duplicate sweep. **Eleven records carry
`source = 'Invoice history'`, in two clusters that overlap:**

| Earlier attempt (Outreach & Network funnel) | Later attempt (Past Invoices funnel) |
|---|---|
| `b_bta` Booking & Ticket Agency | `inv_aug06_bta` Booking and Ticket Agency |
| `b_maaden` Maaden — Saudi Arabian Mining | `inv_aug06_maaden` Ma'aden — Saudi Arabian Mining Co. |
| `b_qahtani` Abdel Hadi Al-Qahtani & Sons | `inv_aug06_qahtani` + `inv_5504` |
| `b_kayan`, `b_maaal`, `b_takamol`, `b_ultimates` | |

A session on **2026-08-06** loaded invoice leads without checking what was already there, and
on **2026-08-08** this session did the same again. Bayswater duplicated the same way and has
been merged.

**Do not load the remaining 14 invoice files until a matching step exists.** Loading them
blind would produce a third layer of duplicates.

**And do not merge on name similarity.** `b_imp_95` "Al Qahtanitravelbureau" and `b_wf_47`
"Al-Qahtani Pipe Coating Industries" share a family name and are **different companies**.
The locked rule stands: CR number, then verified root domain, then exact normalised name,
then phone prefix. All duplicate candidates are flagged with
`needs_manual_confirmation` and a reason naming the other records, so they surface on the
Needs Attention list rather than being merged silently.

Other flagged pairs: `b_imp_133`/`b_imp_60` (Alnoorwings / Al Noor Wings) and
`b_imp_244`/`b_imp_245` (Elite Holidays / Eliteholidays).

**Database integrity is otherwise clean** — 0 orphaned contacts, 0 orphaned activities,
0 broken funnel links, 0 duplicate ids, 0 nameless records.

## 11d · Page-by-page content audit — **DONE 2026-08-08 → `docs/CONTENT_AUDIT.md`**

The full audit is written up in **`docs/CONTENT_AUDIT.md`**. All 15 pages were driven with
`scripts/qa/` in English **and** Arabic, signed in as the QA admin, and every heading, column,
button and helper sentence was captured from the live screen with a keep / reword / remove
call. Nothing was changed — it is a review list for Abdulrahman, because most items are
business-wording calls (per the "do not delete copy unilaterally" rule).

Confirmed live, with root causes found:

- **The Tickets filter tabs are objectively broken** — `Push to sourced`,
  `Mark for void in sourceed`, `Request refund → Direct Paymented`. They should be
  `Issued / Voided / Refunded` (Arabic already shows these correctly). Cause: two run-time
  relabelers (`v21RelabelVerbs` + a second "plain-English" pass) find-and-replace button text
  on **fragments** after every render, so `Issued`→`Push to source`+`d`, etc. This is the
  `CLAUDE.md` "layered find-replace" pattern, and it re-mangles any wording fix unless the
  relabelers are made whole-word / retired. **This is the #1 fix.**
- `Open in Direct` column is a dash on every row on Leads **and** Clients (dead column).
- `Has app` is a filter ("show only companies with an app"), mislabelled and over-injected —
  it even appears on SOPs and Operations where it means nothing.
- `▸ From Direct (read-only)` is a **working** collapsible nav group (Bookings/Invoices/
  Tickets live inside it) — it just looks like a dead label.
- Finance "Top 10 clients" really does show 11 rows; the "Saved to cloud" toast sits on the pager.
- Doubled/garbled headings: `AR aging — AR aging buckets` (Invoices),
  `Objective progress avg of each objective's KPI progress` (Reports); empty `Today · <date>` card.
- **Arabic** is a half-translation with a left-to-right layout (page headings, most column
  headers, and the whole Events + Finance pages stay English; `dir` is hard-coded `ltr`).
  This is backlog item 8 and the audit's Part C expands it.

Audit ends with a suggested order of work: bug-fixes first (§20 relabeler, dead columns,
broken headings — all safe to do on Abdulrahman's OK), then the de-jargon / consolidation
items that need his wording calls, then the Arabic pass.

## 12 · Small things

- Delete leftover test edge functions **`hi`** and **`gstest`**.
- App orange is `#F47A1F`; the brand is `#F06820`. The events page uses the brand value.
- **Escape does not close modals.**
- "▸ From Direct (read-only)" is a section heading that behaves like a clickable button.
- Finance "Top 10 clients" lists 11 rows; its pager hides behind the "Saved to cloud" toast.
- Confirm point-in-time recovery is on for the Supabase plan — the app is versioned in git,
  the database is not.
- `manual-confirm` runs with no login and can edit any lead or contact. Fine while it is
  unknown, worth an auth check before it is shared around.
