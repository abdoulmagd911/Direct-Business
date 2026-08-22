# BLUEPRINT — Direct Business, the whole project in phases

> **Read `docs/DIRECT_SYSTEMS_PLAYBOOK.md` first** — the four systems and who owns what, how
> to get data out of Direct Payments, the money model, our app's landmines, the owner's
> standing rules, and how not to be wrong. This blueprint is the phase-by-phase map; the
> playbook is the standing background knowledge every phase depends on.
>
> One page per phase. Read top to bottom to know where the project stands, what "done"
> means for each phase, and what is deliberately waiting. This is the map; the detailed
> working log stays in `docs/BACKLOG.md`. Created 2026-08-11 after Abdulrahman's review
> ("make a blueprint, work phase by phase, keep a guideline so Claude doesn't invent scope").
>
> **Status legend:** ✅ done & verified · 🟠 in progress · ⏳ waiting its turn

## Rules of engagement (the guideline — read before doing anything)

1. The product is **four pages — Leads, Clients, Finance, Settings (Team & Access)** —
   plus Proposals, and the connections between them. Everything else waits.
2. **Work one phase at a time.** Finish, verify, screenshot, get the owner's yes/no, deploy,
   then move. Never open a second front because something looks easy.
3. **Do not invent scope.** If it is not in this blueprint or the owner's words, it does not
   get built. New ideas go to BACKLOG as parked items, not into the code.
4. **Every change is verified by driving the app** in the harness (`scripts/qa/`), in English
   AND Arabic, with screenshots looked at — never by reading code alone.
5. **English first, Arabic as the phase's closing gate.** Build and settle content in English;
   the last step of each phase is the Arabic pass (labels, RTL, no leftover English). The app
   is live and bilingual, so Arabic is per-phase, not saved for the end of the project.
6. **Numbers rule:** main views show actual numbers (revenue, cost, profit); percentages and
   counts live inside the detail views. All summary numbers are derived live from raw rows —
   report numbers are never stored by hand.
7. **Schema first for new data.** New information gets a real table/column with RLS before UI
   is built on it. The blob (`app_state`) may not grow new sections. Mocks in `scripts/qa/`
   are updated with every schema change.
8. **Deletion, not hiding**, for retired UI — but only after proving it unreachable.
9. **Never commit passwords or secrets** — the repo is public. Test login lives in CLAUDE.md.
10. Deploys: push to `claude/new-session-9fhlp1` (production, ~30s) and mirror to the dev
    branch. Rollback = revert the commit.

## Phase 0 — Foundations ✅
The repo is the single home (app + docs + QA); Vercel auto-deploys on push; one shared
Supabase client (v44a); partial per-section saves (v45); QA harness with local stand-in,
login test account, and permanent sweeps (consistency, buttons, navigation).
**Done means:** push → live in ~30s; sweeps runnable any time. *All true today.*

## Phase 1 — Leads 🟠 (near done)
List with real stage chips that filter (fixed 08-09), derived last-activity/next-action,
correct conversion math, funnels with per-funnel depth (card leads with funnel-specific
detail), lost-lead learning loop (Lost prompts for the reason, kept & searchable), jump-bar
on long cards.
**Done 2026-08-11:** priority score tuned (came-to-us funnels start warmer, next action
counts, fair base) — no more all-Cold; missing owner on save stamped with the signed-in
person; funnel dropdown fixed to real funnels. **Still open:** real SVG icons (cosmetic);
funnel-specific data filled for only 483 of 1,013 leads (data task, post-reset).
**Done means:** a bd user can add, work, and close a lead start-to-finish with no dead
control and no English leftovers in Arabic.

## Phase 2 — Clients ✅ (data tasks wait for reset) — money strip corrected 2026-08-21
Won auto-converts to client; columns decided (Next review + Tier); client card = the
storage unit: contacts, comments, work log, jump-bar on long cards.
**Waiting on data, not code:** client re-verification (all were reset to leads 08-08);
Drive consolidation. **Communication capture (owner asked, 2026-08-11):** the Log-activity
box is now a paste-in capture (Call/WhatsApp/Email/Meeting/Teams-Zoom-Meet types, big
paste box) — the team pastes the conversation and it joins the company's story. A full
automatic inbox integration is a separate future project, NOT in current scope.
**Correction, 2026-08-21 (owner ruling, see Phase 1 below):** the original "finance strip
(billed/received/outstanding + cost/profit/margin%/credit inside the card)" line above is
now WRONG and was removed from the app — the Clients page shows no money, full stop; that
strip now lives only on the Finance page. Billing accounts are no longer a free-text
Prepaid/Postpaid/Tender chip list — they are the real `client_profiles` table (Phase 1),
shown as identity-only rows (type badge + Direct client ID + payment terms).
**Done means:** one card per real company holding everything the team knows about it, with
no money on it anywhere.

## Phase 1 (retro-numbered) — Company/Client-Profile schema ✅ 2026-08-21
One company (`businesses`, unchanged) can hold several Direct Payments billing profiles —
one Prepaid, one Postpaid, one PER tender, never merged. Real table `client_profiles` (RLS,
append-only-once-closed tender amounts, one-live-profile cap on Prepaid/Postpaid) replaces
the old `billingAccounts` free-text blob. Real Corporate Clients registry imported: 24
profiles / 19 companies, Takamol excluded, kept separate from the synthetic 30-lead training
world on purpose. Full detail: `docs/BACKLOG.md` 2026-08-21, `docs/DIRECT_PAYMENTS_MODEL.md`
Round 11. **Done means:** the Clients page is identity-only and the schema is real, not a
text blob — both verified true. **Still open:** the Finance page's own company-grouped
rebuild (Spec 2) — a separate next phase, not done in this pass.

## Phase 3 — Finance ✅ (Ledger rebuilt on the corrected model, 2026-08-21)
The upgrade of the owner's Executive Dashboard. Two tabs: **Performance** (period bar
year·All/Q1–Q4/H1/H2·month driving everything · KPI cards · income by service families ·
plan-vs-actual with the real 2026 plan · monthly chart) and **Clients & collections**
(credit held · collections & AR aging · top clients, numbers only) — both still read
`finance_invoices`, unchanged. Storage doctrine: raw rows once, everything derived, integrity
flags on the row.
**Phase 2 (2026-08-21):** the **Ledger tab** now reads its own real schema
(`finance_transactions` + `finance_cogs_expenses` + `client_profiles`, staged alongside
`finance_invoices` rather than replacing it) — company is the primary row, every transaction
labelled Prepaid/Postpaid/Tender, KPI strip confirmed-only (has an invoice number, or Expense
Status Ready), pending rows show their estimate tagged "est." and never reach the totals,
Overdue only renders when Direct Payments' own field says so (null ≠ not overdue). Round 13:
the COGs Report itself holds no data — Corporate Expenses > View Assignments is the verified
cost source; the expense-line vocabulary was normalised to be source-agnostic. Full detail:
`docs/DIRECT_PAYMENTS_MODEL.md` Rounds 11–13, `docs/BACKLOG.md` 2026-08-21.
**Done means:** any month/quarter/half/year question answerable in two clicks and every
number traceable to invoices (Performance/Reports); every Ledger row traceable to its company,
profile and confirmed-cost source. *True today; verified by hand-computed sums, EN+AR.*
**Still open:** the real transaction-level import to replace the Ledger's demo seed.

## Phase 4 — Settings / Team & Access ✅
Real users with roles (admin/manager/bd/operations/viewer/team_member), access allowlist,
legacy free-text team editor retired, tiles cleaned.
**Owner decision 2026-08-11:** the `business@directksa.com` login AND linking owners to
real accounts are POSTPONED to Phase 8 — they happen together with the team logins,
right before real data goes in. Do not raise them before then.

## Phase 5 — Proposals 🟠
Paged branded document matching the real tender offers (cover with white logo → contents →
about with verified stats → signature services table `# | Service | الخدمة | Fee` → work
plan → commercial with the real fee model → gradient closing); editor opens short
(advanced sections collapsed); proposals live in a real table (app_offers).
**Done 2026-08-12:** the proposal file library — PDFs upload into the app itself (Storage
bucket `proposals`), shown with 📎 on the proposal and in the list; and the Won handover
("complete the client") now fires on every path to Won. Invoices can arrive from the CSV
import already marked booking/project with their proposal reference.
**Still open:** owner's yes/no on the document; optional past-work page (Ma'aden 2M /
Al-Hilal 1.5M / SFDA 500K / Riyadh Club 1M) as a toggle for tender-type
proposals only.
**Done means:** the team sends a client-ready PDF from the app without touching Word.

## Phase 6 — Schema & data integrity 🟠 (Abdulrahman's review, 2026-08-11)
Real tables with RLS everywhere the app writes: businesses, contacts, finance_invoices
(+origin/proposal_ref/items), finance_client_links (+credit), finance_targets,
app_requests/app_offers/app_projects (dual-write, blob fallback). Security advisor run
2026-08-11: **fixed same day** — 15 snapshot/backup tables locked behind admin/manager-only
access, signed-out execution of the workspace-save function revoked.
**Done 2026-08-11:** bookings, draft invoices and settings moved to real tables
(app_bookings / app_invoices / app_settings) — the blob is now fully mirrored, nothing
the team types lives only in it. **Still open:** minor advisor warnings (function
search_path, team_directory definer view — intentional); ownership → real user ids.
**Testing rule added:** the QA mock is regenerated from the live database whenever live
data changes shape — green sweeps on stale seeds proved nothing (the buttons lesson).
**Done means:** nothing the team types lives only in one shared JSON blob.

## Phase 7 — Arabic pass (closing gate of every phase)
Not a separate late phase: each phase ends with an Arabic sweep of its screens (labels,
RTL, numbers, no leftover English — `probe-ar` pattern). A final full-app Arabic sweep
happens once before go-live.

## Phase 8 — Reset & go-live ⏳ (last)
Wipe the test data to zero (backups exist and are locked) · load real data from Drive
(invoice-funnel files 5466–5507, TravelAgencies_MASTER, contact-form sheets) · create real
team logins **including business@directksa.com (admin)** · link free-text owners to the
real accounts (enables "my leads", per-person targets) · **browser push reminders —
REMIND THE OWNER about this here, he parked it deliberately** · final gate sweep: all
four pages + Proposals, every button, EN+AR, all numbers agreeing.
**Done means:** the team works in it daily and trusts the numbers.
