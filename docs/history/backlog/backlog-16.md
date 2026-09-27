## Routine fire #62 (2026-09-16 06:12 UTC) — the CLIENT card's own controls and the ARCHIVE page driven live EN+AR+phone: controls clean; the card's "Invoices" key fact was a STORED number, wrong for 22 of the 28 live clients — FIXED (core-02, counted from the ledger)
scratchpad/live-client-card-archive.mjs, real database, read-only (0 save() calls, 0 write requests), EN then AR,
1440 px and 400 px, six client cards opened the way the Clients list opens them (row click → the card).
CLEAN: every card renders its 13 sections with no NaN/undefined and 0 JS errors; the jump bar lists 9 sections
and every button scrolls to a real card; the Direct Payments links carry the client's Direct id (3 links per
card, id present); "Edit client profile" opens the local 22-field form and closes without saving; nothing
scrolls sideways at 400 px. ARCHIVE: header 4 = the 4 archived companies in the database; 0 Restore buttons is
CORRECT — three were merged into another company (undone from Activity & Audit) and one was removed by owner
ruling, none of which may be restored from a button.
THE DEFECT: the "Invoices" row under Key facts printed b.invoices — a number stored on the record at import
time. Checked against the ledger through finance_client_links for all 28 clients: 7 training-world records
(the 2026-08-13 world, ids a13e…) said 1–4 while the ledger holds 0 for them; 15 real clients said 0 while the
ledger holds 1–17 (one holds 17, one 5); only 6 were right. The row now counts the client's live invoices the
same way the finance snapshot card (js/38) does — through the links, via js/16's exclusion chokepoint — and
shows "—" until the ledger has loaded (js/38 already triggers that load and re-renders). Verified live after
the fix: the six cards read 0 where the ledger holds 0; the "10 / 1" still visible on two cards is the Past
Invoices funnel's own "Invoices issued" field (data entered at import), not the key fact.
NOTED FOR THE OWNER (data, not code): the 7 training-world client records (a13e…, "Past Invoices" funnel,
"Invoices issued 10/1/…") reuse the names of real clients whose real invoices sit on the real records; three
such twins were already merged on 2026-08-22/09-02 (they are the Archive's merged rows). The remaining ones are
a candidate for the same merge, by the owner's hand.
Guard: scripts/qa/probe-card-invoice-count.mjs (5 checks — linked client's fact = ledger count, a client with a
stored invoices:9 and nothing in the ledger shows 0, EN and AR, 0 JS errors; SABOTAGE-VERIFIED: 2 FAIL / exit 1
with the core-02 edit stashed; port 9048; in battery.txt). Gates: structure OK, probe-integrity OK,
decisions-wired OK. Neighbours: probe-client-card-ar green; probe-client-card-address green but takes ~253 s
(the same with this fire's edit stashed — pre-existing; within the repo runner's 600 s default, only my
scratchpad slice runner capped it at 170 s — corrected there; not an app defect).

## Routine fire #61 (2026-09-16 04:11 UTC) — the READ-ONLY (viewer) role driven live end to end EN+AR, screen AND database: 0 defects
scratchpad/live-viewer.mjs, real database. The QA account was set to role=viewer with a 4-page "viewer"
matrix (today/leads/clients/finance — the shape Team & Access writes) and RESTORED to admin / page_access
null right after (verified by the returned row). Nobody holds this role today (live: 3 admins, 1 manager,
7 team members) but Team & Access offers it, so it had to hold.
SCREEN (EN and AR): the role chip reads "Read only" / "قراءة فقط"; the read-only badge sits on all four
granted pages in the page language; the nav shows exactly the four; all 11 other addresses bounce to Today;
mayEditPage and canFinEdit say no; every edit entry point tried — new business, stage change, convert to
client, new request, edit request — is refused with a box that names the reason in words ("You can’t change
companies… Your access level is “Read only”" / «لا يمكنك تعديل الشركات… مستوى صلاحيتك «قراءة فقط»») and opens
no editor; 0 write requests left the browser during the whole drive; the finance figures load (46 invoices)
and the summary export still produces its file — the promise "you can open and read everything, and export
reports" holds.
DATABASE (the part a screen can't fake): from the same signed-in session, a no-op update on a business →
0 rows; an insert into activities → 403 "violates row-level security policy"; a no-op update on an invoice →
0 rows; an insert into contacts → 403. The rules hold at the source, not just on screen.
BY DESIGN, not a defect: the "+ New business" button stays visible for a viewer — js/49 deliberately guards
the ACTION (refusal in words) instead of blanket-hiding buttons, which once removed harmless read-only ones.
Guard: the existing scripts/qa/probe-viewer-writes.mjs (battery line 187) re-run green. No code change this
fire; nothing to sabotage-verify.

## Routine fire #60 (2026-09-16 02:11 UTC) — the Leads TABLE (search, funnel filter, Mine, paging) and the lead detail card driven live EN+AR+phone: behaviour honest; the funnel dropdown offered two dead raw-key entries that only clients carry — FIXED (core-02); the lead card's "No activity yet…" was English in Arabic — FIXED (core-02)
scratchpad/live-leads-table.mjs, real database, read-only (0 save() calls, 0 write requests), EN then AR,
1440 px and 400 px, typing into the real search box and changing the real selects.
CLEAN: 78 rows = the 78 leads the default filters match (80 leads, 2 lost hidden by "Hide closed"); typing a
real name fragment narrows to exactly the one matching lead and the box keeps its text; the funnel select
narrows "Website Form — B2B" to 7 = the 9 in the database minus its 2 lost; "Mine" for the QA account (owns
nothing) shows the honest "No results with the current filters — 78 hidden" row in both languages; paging
reads 1–20 of 78; six detail cards render all 12 injected cards with no NaN/undefined and 0 JS errors; Back
returns to the same table; nothing scrolls sideways at 400 px. Arabic column heads, chips, toolbar and card
labels are Arabic (the Latin left is company names and stored form text — data).
1. **Funnel dropdown listed raw import tags as funnels** — "corporate_clients_import_20260821" and "Direct
   Payments import", in both languages, because the list was built from every business including clients,
   whose import-batch SOURCE tag stood in for a funnel. No lead carries them, so choosing one emptied the
   table. Built from leads only now (core-02): the live dropdown reads All / Website Form — B2B / Website
   Form — Entities, exactly the two funnels the 80 leads use.
2. **"No activity yet — click “Log activity” after your first contact."** on the Arabic lead card (and the
   shorter variant on the dashboard view) — the one English sentence on an otherwise Arabic card. Bilingual
   now; EN unchanged.
NOTED, not changed (scope): the Leads table has no sortable column heads while the Clients table sorts on
five — adding sorting is new work, the owner's call.
Guard: scripts/qa/probe-leads-funnel-dropdown.mjs (5 checks — every lead funnel listed, a client-only source
tag NOT listed, EN sentence intact, AR sentence Arabic, 0 JS errors; SABOTAGE-VERIFIED: 2 FAIL / exit 1 with
the core-02 edit stashed; port 9047; in battery.txt). Gates: structure OK, probe-integrity OK,
decisions-wired OK.

## Routine fire #59 (2026-09-16 00:11 UTC) — Reports page (4 tabs, the report generator and its 5 outputs) and the Operations page driven live EN+AR+phone: behaviour and files clean; the Arabic Reports page was English wherever core-10 wrote its own words — FIXED (37 strings); the KPI names themselves stay English pending the owner's wording
scratchpad/live-reports-ops.mjs, real database, read-only (0 save() calls, 0 write requests), EN then AR,
1440 px and 400 px.
CLEAN: all four Reports tabs render in both languages with no NaN/undefined/[object Object] and 0 JS errors;
the report builder produces a preview for monthly and quarterly, both scopes; "Download .html" and "Word
(.doc)" produce real files (48 KB) carrying the report title; "Print / PDF" opens its window; the objectives
expand and collapse; OPERATIONS: the board is honest to the (empty) requests list, shows no money figure (the
21 Aug rule), the "+ New request" form opens with its 11 fields in Arabic and closes without saving; nothing
scrolls sideways at 400 px in either language.
NOT A DEFECT: "PowerPoint (.pptx)" produced no file in my sandbox because the slide engine is fetched from a
CDN the sandbox cannot reach — the app said so in words ("Internet needed once to load the PowerPoint
engine"); on the real site the CDN is reachable.
THE DEFECT (AR): everything the Reports page writes itself was English on the Arabic page — the objective
cards' "Target / Actual / manual / override / INITIATIVES / ACHIEVEMENTS / no KPI / No KPIs linked…", the
built report's heading ("Quarterly Objectives Review · Q3 2026"), its "Commercial Department · Operational
Plan 2026" line, "Generated <date>", "No achievements logged in this period", the gaps lines, the copy-text
heads, the three alerts, the PowerPoint slide labels, the Quarter/Year/Member/Objective form labels and the
English month names. All bilingual now via one rptAr() switch in core-10; Arabic month names added; the
generated document is marked dir="rtl" in Arabic; file names stay English (rptTitleEn) so downloads sort the
same way in both languages. EN output unchanged.
OWNER DECISION, not changed: the 42 KPI names and their 126 focus lines ("Value of commercial agreements and
direct sales closed", "Expand new commercial partnerships"…) are the Operational Plan 2026 wording and have
no Arabic in the code (the 12 objectives DO). One next step: send the Arabic KPI list from the plan (or say
"translate them") and a session will add them the same way the objectives carry theirs.
Guard: scripts/qa/probe-reports-arabic-chrome.mjs (7 checks — EN chrome intact, AR objective-card chrome,
AR report heading with an Arabic month, English file name + dir="rtl" in Arabic, EN file without it, 0 JS
errors; SABOTAGE-VERIFIED: 3 FAIL / exit 1 with the core-10 edit stashed; port 9046; in battery.txt).
probe-reports-phone-ar (the earlier Reports guard) still passes. Gates: structure OK, probe-integrity OK,
decisions-wired OK.

## Routine fire #58 (2026-09-15 22:11 UTC) — Finance's eight tabs and their interactions driven live EN+AR+phone: figures honest to the database, but a plain READ-ONLY visit to Finance was silently REWRITING 13 client-link rows every time — FIXED in js/41
scratchpad/live-finance-tabs.mjs, real database, EN then AR, plus 400 px. Every write request was counted, not
just save(). Independent DB truth first: 46 live invoices, revenue 2,030,764 / cost 1,538,142 / profit 492,623,
every row obeys revenue = total − wallet and profit = revenue − cost, 0 rows with VAT mixed into profit (M1).
CLEAN: all 8 tabs (Performance, Clients & collections, Ledger, Report Builder, Expenses, Payment proofs,
Individual bookings, Import) render in both languages with no NaN/undefined/[object Object] and 0 JS errors;
the Performance figures on screen equal the DB sums; the Clients grand-total row follows the period
(Q1 = DB 541,288 over 2 invoices, Q2 = 541,275 over 20) in EN and AR; the Report Builder's 3 presets render;
400 px never scrolls sideways; every tab label is Arabic on the Arabic page (the Latin left is client names
and stored English reasons — data, not UI).
THE DEFECT (data integrity, invisible on screen): js/16 loads the invoices FIRST and fetches
finance_client_links AFTERWARDS; js/41's automatic linking pass runs 400 ms after every render, saw rows
but an empty link map, and upserted every name-matchable group again — 13 links rewritten on every visit to
Finance by any editor (verified in the database: 13 rows with confirmed_at/updated_at bumped inside my
read-only run; 16 write requests counted, 13 of them to finance_client_links). Beyond the churn, a person's
later correction of one of those links would be silently undone by the name match on the next visit.
FIX (js/41, one guard): the pass waits until FIN.links exists — js/16 sets it only when the links have
actually loaded. Live re-run: 0 writes to finance_client_links (the 3 remaining non-GET calls are the
read-only RPCs my_page_access / team_nicknames).
Guard: scripts/qa/probe-finance-links-race.mjs (mock seeds every group as already linked BY A PERSON and delays
the links response 1.5 s so the race is deterministic; 5 checks — 0 link writes, links loaded, no confirmed_by
overwritten, the pass was live; SABOTAGE-VERIFIED: 2 FAIL / exit 1 with the js/41 edit stashed; port 9045;
in battery.txt). Gates: structure OK, probe-integrity OK, decisions-wired OK.
STILL OPEN (owner's product call, recorded fire #12 — not re-flagged as a defect, but now seen from the user's
side): the Ledger tab reads finance_transactions (33 rows, all soft-deleted 2026-08-22), so it shows "the
ledger is empty, not filtered" — and clicking a client in "Top clients" lands there, on nothing, while the
same client's invoices are counted one tab over. If the ledger should list invoices, that is new scope.

## Routine fire #57 (2026-09-15 20:12 UTC) — the top-bar "Export ▾" menu driven live on all 20 pages × 4 options × EN+AR (160 real downloads read back): four defect families, all FIXED — six pages handed out the JSON backup under a CSV label; Finance "full details" leaked VAT/wallet/discount columns (M1); Arabic "full details" files carried up to 27 raw column keys; empty pages produced headerless blank files
scratchpad/live-export.mjs, real database, read-only (0 save() calls). Every sidebar page (incl. the folded
ones and both SOP/SLA tabs), each of CSV-summary / CSV-full / Excel-summary / Excel-full plus the JSON backup,
in EN then AR; each downloaded file parsed and checked for name, format, row count vs the screen, dirty
cells (undefined / [object Object] / NaN — none anywhere), money columns in Leads/Clients (none — the
2026-09-09 rule holds), Arabic titles, and M1.
1. **Six pages, every labelled CSV/Excel option silently downloaded the 758 KB JSON backup** — Documents
   (Generator), Reports, Settings, Brand, Activity & Audit, Archive — because exportCurrent() has no column
   map for them, the exact fault the owner ruled on for Today on 2026-08-20 ("nothing tabular to export →
   hide the menu, don't invent a CSV"). js/60 (the Today hide) now hides the menu on every page the exporter
   does not know; the 13 pages with real tables keep it. Reversible one-liner.
2. **M1 — Finance "full details" dumped every stored column**: vat_sar, wallet_portion_sar, discount_sar,
   plus direct_uuid, deleted_at, created/updated_at, exclusion_reason, source_batch, line_no… (38 columns).
   The Finance page's OWN export (js/16 finLedgerCSV) has always used an 18-column doctrine without any of
   those; the top-bar "full" now uses that same list (core-05). Summary (11) and full (18) now differ
   honestly. Verified live: 46 rows × 18 columns, no VAT-ish column.
3. **Arabic "full details" titles were raw keys** on Leads (8/42), Clients (7/41), Airlines (27/54),
   Providers (10/37), Proposals (21/51), SLAs (1/5) — js/73's label map stopped at the summary columns.
   72 labels added; live re-run: 0 raw keys on every page (the only Latin left is "GDS" and "Direct").
   Also: the generic "full" export now drops the same internal keys Leads already dropped (_flags, raw,
   ids, sync marks) — Airlines 54→52, Providers 37→36 columns.
4. **An empty page (Bookings, Invoices, Tickets, Operations — all empty live) produced a headerless
   0-byte file**; Finance already said "No rows to export" in words — every page does now (core-05), in
   both languages.
Guard: scripts/qa/probe-export-menu-honest.mjs (7 checks: hidden on 6 pages / shown on 3, the finance
doctrine columns, summary≠full, the empty-page refusal via the js/63 notice card, 0 raw Arabic keys on
Airlines, 0 JS errors; SABOTAGE-VERIFIED: 4 FAIL / exit 1 with the three edits stashed; port 9044; in
battery.txt). Neighbours re-run green: probe-finance-export, probe-export-records, probe-no-vat-display.
Gates: structure OK, probe-integrity OK, decisions-wired OK.
NOTED, not changed: the Events tab's own export (js/10) names its file "…-events-48-rows" and produces the
same 20 columns for summary and full — one honest shape, by design. If the owner wants a real export for
Activity & Audit or Archive (both are tables), that is new scope, not a fix.

## Day-3 full battery verdict (2026-09-15 20:23 UTC, follow-up to fire #56) — ALL 196 probes green at ef5cc82
Every probe named in scripts/qa/battery.txt ran once (196 named, 196 logged, 0 failures, 0 timeouts, 0 missing
files). The run started at 18:13 UTC on HEAD 3e901e4 and had reached 38 green probes when the session's
container was recycled at 18:28 (idle restart — not a probe failure); it was resumed at 19:52 on ef5cc82 and
completed the remaining 158 in four slices, three probes at a time (each probe owns its own port, so parallel
is safe; the integrity gate enforces the uniqueness). Nothing red to re-run. The 38 early probes ran on the
pre-fix js/16 and passed, as expected — none of them covers the /finance-before-sign-in path; the new guard
(probe-finance-deeplink-signin) ran in the resumed part, on the fixed file.
Lesson kept for the runner: a detached background battery dies with the container when the session goes idle;
run it in foreground slices (scratchpad/run-battery-resume.sh, resumable, skips what is already logged).

## Routine fire #56 (2026-09-15 18:13 UTC) — the team_member role driven live end to end (4-page floor, bounces, editor affordances): 0 role defects; but it exposed a bug that hits EVERY role — open the app at the /finance address, sign in, and the ledger stays empty for the rest of the session ("0 invoices · data through —") — FIXED in js/16
scratchpad/live-team-member.mjs + live-tm-finance.mjs, real database. The QA account was temporarily flipped to
team_member with the 4-page grant (leads/today/clients/finance = editor, same as the 7 real team members) and
RESTORED to admin / page_access null immediately after (verified by the returned row). Read-only otherwise
(0 save() calls).
TEAM MEMBER: nav shows exactly Today / Leads / Clients / Finance; every other address (offers, requests, settings,
team, events, activity, reference…) bounces to Today; the four pages render with the editor affordances the grant
promises (New lead, edit, stage change, finance add-row visible; canFinEdit true); chip reads "Team member" in
EN and "عضو فريق" in AR; 0 JS errors; the direct database probe as that user reads 46 invoices (RLS honest).
THE BUG (not the role's — everyone's): typing directksab2b.com/finance into the address bar BEFORE signing in
(a bookmark, a link from a colleague, a reload after the token expired) rendered Finance 600 ms into boot —
before any session existed. Its loader asked the database with no token, got zero rows and no error, cached
that [] as "the ledger", and never asked again after sign-in. Result: "0 invoices · data through —" until a
full reload. My first live team-member run showed exactly that blank and I nearly filed it as a permissions
fault (corrected: the direct-DB probe returned 46 rows for the same user — the app, not the rules).
FIX (js/16 finLoad, in place, 25 lines): if there is no session yet, the loader does NOT cache an empty answer;
it leaves the ledger "not loaded", waits for sign-in (1 s poll, cleared once found), then loads for real and
re-renders Finance if that is the open page. Share-view links (no session by design) are untouched.
Verified live after the fix as the team member: /finance deep link → sign in → 46 invoices, header correct;
full team-member drive re-run: 0 findings.
Guard: scripts/qa/probe-finance-deeplink-signin.mjs (5 checks — rows stay null while signed out at /finance,
rows > 0 after sign-in from that address, header no longer "0 invoices", the normal sign-in-at-"/" path loads
the same count, 0 JS errors; SABOTAGE-VERIFIED: 1 FAIL / exit 1 with the js/16 edit stashed; port 9043; in
battery.txt). Gates: structure OK (75 script files), probe-integrity OK, decisions-wired OK.
Full battery (day-3 regression run, all of battery.txt, started 18:13 UTC at HEAD 3e901e4) is running in the
background — verdict logged in the next fire's entry.

## Routine fire #55 (2026-09-15 16:11 UTC) — Proposals page and Today driven live EN+AR+phone: clean in behaviour; the Arabic proposal editor still carried nine English labels — FIXED (core-04 + core-06); the only live proposal was a blank QA draft with a test PDF — removed through the app's own Delete
scratchpad/live-proposals.mjs, real database, read-only (0 save() calls), EN, AR and AR-phone (400px).
TODAY: renders in both languages, no money figures (owner rule), tiles honest — "overdue invoices 0" checked
against finance_invoices: 0 unpaid, 0 overdue (27 rows carry a due date, all settled); the Arabic page reads
fully Arabic by eye. PROPOSALS: list = data (1), the search narrows by a real ref fragment and keeps its text,
"Mine" honest, the editor opens with 22/53 fields filled and no undefined, closes back to the list; the phone
layout never scrolls sideways. 0 JS errors anywhere.
1. **Arabic proposal editor: nine English labels** (seen by eye): the "↧ Load a corporate client's negotiated
   deal & pricing…" option, the "Agency only: Cost · Commission · Margin" note (+ "freebies cost", "net"), the
   "Fare options — compare 2–3 fares" summary (all core-04, which already had a bilingual helper the note never
   used), and the bundle-templates panel (core-06 v18): "(reusable service bundles)", its hint, "items ·
   freebies", "Option 1", "Apply", the tiered-pricing hint. All bilingual now, in place, EN unchanged.
2. **The only proposal in the live workspace was a blank draft** — DB-334490, no client / subject / value /
   scope, status Draft, owner = the QA account, dated 2026-09-10 (a "live test" day), with a QA file
   "live-check.pdf" attached — exactly the accidental-draft shape the 2026-09-02 "N key" fix exists for, sitting
   as the team's one and only proposal. Removed THROUGH THE APP (its own Delete button + in-page confirm), not
   by SQL; the list now shows its honest empty state in EN and AR. Verified in the database: offers = 0,
   businesses 112 and invoices 46 untouched.
Guard: scripts/qa/probe-proposal-editor-arabic.mjs (5 checks — EN wording intact, 8 English fragments gone from
the AR editor, 8 Arabic ones present; SABOTAGE-VERIFIED: 2 FAIL / exit 1 with both core edits stashed; port
9042; in battery.txt). Gates: structure OK, probe-integrity OK, decisions-wired OK. Live after the fix: AR editor
6/6 Arabic labels present, 0 English.
NOTED FOR THE OWNER, not changed: the `proposals` storage bucket holds 16 objects of which 15 are QA "live-check"
uploads from 2026-08-12..19 — all 0 KB, referenced by nothing, invisible in the app. Harmless; a one-time
bucket tidy in the Supabase dashboard would remove them (storage clean-up is not something a session should do
by SQL).

## Routine fire #54 (2026-09-15 14:12 UTC) — Settings, the Leads "Dashboard" view and the Clients filters driven live EN+AR: Settings and Clients clean; the Leads dashboard contradicted the chips ("Lost 0" under "Lost 2") and listed stages that cannot exist — FIXED in core-02, Arabic bars too
scratchpad/live-settings-dash-clients.mjs, real database, read-only (0 save() calls), EN then AR.
SETTINGS: all 18 cards render, the pool-history and template-token pop-ups open and close, no NaN/undefined,
0 JS errors. CLIENTS filters: the manager dropdown lists exactly the 6 managers in the data + "Unassigned (20)";
picking a manager leaves only that manager's rows (labelled by nickname, as js/54 paints them — my first check
compared the raw full name and misfired, corrected); the tier filter narrows to the data's count; a real-name
search narrows to matching rows and the box keeps its text; "Mine" for the QA account (owns nothing) shows the
honest "No clients match." placeholder (one colspan row — not a phantom client; corrected in the script).
LEADS DASHBOARD (the Table/Dashboard toggle, core-02 drawLeadsDash) — three real defects seen by eye:
1. **"Lost 0" on the board directly under a "Lost 2" chip.** With Hide-closed on (the default) the board's pool
   excluded lost leads, so the Lost tile and the Lost bar were 0 while 2 lost leads exist. Lost (and Won) are
   now counted from the leads the filters match BEFORE Hide-closed removes them; the L1 rule of 2026-09-09
   (a client whose stage says Lost is never a lost lead) still holds and is re-asserted by the guard.
2. **"Negotiation" bar** — a stage the locked database list cannot hold and the chips never show; always 0.
   Gone. **"Client" bar** (Won relabelled) — always 0 for leads because a won lead is a client, counted in the
   "Became client" tile next to it. Gone. The bars now speak exactly the chips' vocabulary.
3. **Arabic page: English bars under Arabic tiles** ("Prospect: 53 leads"). The bar stage words and the "leads"
   unit now follow the page language, using js/21's own Arabic stage words ("مرتقب: 53 عميل محتمل").
Verified live after the fix: EN tiles Total 78 · In pipeline 78 · Became client 28 · Lost 2 (= chip), bars
Prospect 53 / Contacted 25 / Qualified 0 / Proposal 0 / Lost 2; AR tiles and bars fully Arabic, Lost 2 = chip.
Guard: scripts/qa/probe-leads-dash-vocabulary.mjs (8 checks incl. the L1 rule and the Arabic bars; SABOTAGE-
VERIFIED: 4 FAIL / exit 1 with the core-02 edit stashed; port 9041; in battery.txt). probe-leads-dash-tiles
(the 2026-09-09 guard) still passes. Gates: structure OK, probe-integrity OK, decisions-wired OK.
NOTED FOR THE OWNER, not changed (a scope call, not a defect): 9 of the 18 Settings cards are developer
self-checks from the v21–v23 build days — "Performance", "Security & integrity", "Accessibility audit (WCAG 2.1
AA)", "Internationalization", "Developer / test harness", "Print + PDF (sub-pass 2)", "v21 reconcile with
Ahmed's sheets", "v22 — Workflow + go-live", "v23 — Scenario sweep" — English-only on the Arabic page, full of
jargon (rule 1), and one names a colleague. If they are not used day to day, hiding them behind an "Advanced"
fold (a reversible one-line hide) would leave Settings with the 9 cards a non-developer needs. Owner's call.

## Routine fire #53 (2026-09-15 12:13 UTC) — Activity & Audit log and the Events tab driven live EN+AR: data/behaviour clean; three Arabic-page defects seen BY EYE and fixed — the events date range read scrambled, English notes read backwards (js/10), three page names showed as raw keys in the audit log (js/63)
scratchpad/live-activity-events.mjs, real database, read-only (0 save() calls), EN then AR.
ACTIVITY & AUDIT: all 274 record_history rows render (tile 274 = the table's count; Today 5 / 7-day 32 — the 5
are the fire-#43 manager-test page refusals, which carry no before-state, so 0 Undo buttons is correct);
every row names its record; no database column names or camelCase keys leak; all 216 "unknown"-actor rows
carry the fire-#49 explanation; no NaN/undefined; 0 JS errors. (My probe's "tiles disagree" line was an
artifact — HIST is a closure, not a global — corrected in the script.)
EVENTS: the 80 real events load; 48 upcoming / 80 with past; "ours" narrows 48 → 21; a real city fragment
narrows to 25 rows that all contain it and the box keeps its text after re-render; the Edit form opens for
the first event with 16/20 fields filled, no undefined, Cancel present, closed without saving. 0 JS errors.
THREE ARABIC-PAGE DEFECTS, seen on the screenshots:
1. **Event date ranges read scrambled** ("سبتمبر – 16 2026 14"): evDate() forced dir="ltr" on a span that
   holds Arabic month names, so the day numbers were thrown to the wrong ends. js/10: the span now follows
   the page direction — "14 سبتمبر – 16 سبتمبر 2026". English unchanged.
2. **English notes read backwards** in the Arabic table (full stop first, words reordered, "…nly." clipped):
   free text in an RTL cell. js/10: the notes block is unicode-bidi:plaintext, so each note follows its own
   language. (Verified by rendered character positions, not computed `direction`, which stays inherited.)
3. **Three page names as raw keys in the audit log**: a refused visit to the Generator, the Archive or the
   Activity page read "documents" / "archive" / "activity" on BOTH language pages — js/15's PAGES list
   predates those three pages. js/63: named the way the sidebar names them (Generator / المولّد, Archive /
   الأرشيف, Activity & Audit / النشاط والتدقيق).
Guards: scripts/qa/probe-events-arabic-bidi.mjs (6 checks; SABOTAGE-VERIFIED: 3 FAIL / exit 1 with the js/10
edits stashed; port 9040; in battery.txt) and two checks added to probe-history-actor-and-sync-words.mjs
(sabotage: 2 FAIL with the js/63 edit stashed). Gates: structure OK, probe-integrity OK, decisions-wired OK.
Live re-run after the fixes: 0 hard findings, 0 soft notes; the Arabic events screenshot reads correctly by eye.

## Routine fire #52 (2026-09-15 10:11 UTC) — the Generator page driven live EN+AR, desktop+phone: home + all six editors clean; ONE real defect seen by eye and measured — the document preview was cut off on both edges on every ordinary laptop screen (js/82 fixes it)
scratchpad/live-generator.mjs, real database, read-only (0 save() calls): Generator home (document cards + the
saved-documents list from generated_documents), then dgGo into each of the six editors (assets · offer · fees ·
profile · contract · tender), the step chips, the phone preview toggle — EN and AR, at 1440px and 400px. Every
editor renders with its preview column, the address becomes /documents/<tab>, no "coming soon" placeholder, no
blank view, no NaN/undefined, 0 JS errors, no sideways page scroll on the phone. The remaining English labels on
the Arabic page are the "English" document-language button and the DOCUMENT's own section headers, which follow
the document language chosen in the editor, not the app language — by design.
THE DEFECT (seen on the EN and AR screenshots as a clipped "DRAFT — no number yet" ribbon, then measured at four
screen widths): the three classic editors (offer / fees / profile) draw real A4 pages, 794px wide, inside a
centred flex column with overflow-x:auto that is only 866px at 1920, 806 at 1536, **710 at 1440 and 550 at
1280**. A centred flex child wider than its container overflows BOTH sides, and the left overflow is unreachable
by any scroll. Live at 1440px the page ran from x=660 to 1454 in a column ending at 1412 — 42px lost on each
edge, ribbon clipped; at 1280px 122px lost per edge; on a phone far more. It fit at 1920px, which is why it was
never noticed. (My first width measurement said "cut 0" because scrollWidth never counts left overflow — the
ribbon's clipped right edge was the tell that led to the real numbers.)
Fix, js/82: each page is zoomed to fit its wrapper's width (zoom keeps layout in sync, so heights follow),
recomputed on render / resize / the phone preview toggle; in print media (the editors print with
window.print()) the pages are back at 1:1; `align-items: safe center` as the belt so nothing can ever be clipped
on both sides again. Verified live after the fix at 1920/1536/1440/1280: page width == column width everywhere,
ribbon inside the column at every width, the 1440 and 1280 screenshots show the whole cover. Contract and tender
editors were already responsive (page width follows the column) and are untouched.
Guard: scripts/qa/probe-generator-preview-fit.mjs (7 checks at 1280/1440/1920 + print media; SABOTAGE-VERIFIED:
4 FAIL / exit 1 without the js/82 line; port 9039; in battery.txt). Gates: structure OK (75 files),
probe-integrity OK, decisions-wired OK. Full Generator live re-run after the fix: 0 hard findings.

## Routine fire #51 (2026-09-15 08:11 UTC) — reference pages (Airlines · Providers & GDS · SOPs & SLAs) driven live EN+AR: 0 hard defects in the data/rendering; three things seen BY EYE and fixed — detail-card initials sat in the corner (js/80), a logo that fails left an EMPTY avatar (js/80, caught by the new probe), the Arabic SOP page read backwards (js/81)
scratchpad/live-reference.mjs, real database, read-only (0 save() calls): Airlines list → first 3 airline
dashboards → their detail view; Providers & GDS the same; SOPs (first 3 expanded) and SLAs — EN then AR. Every
render: no blank view, no NaN/undefined, 0 JS errors, chrome Arabic on the Arabic pages (the only English chrome
left: the "Providers & GDS" page heading and the term EMD — noted, not changed; the SOP TITLES and bodies are
English reference CONTENT, which a translation would be a feature, not a fix).
1. **Avatar initials in the top-left corner** (every lead, client, airline and provider card, EN+AR). Seen on the
   real client card and the real airline dashboard, then measured: the 62px `.detail-head .ava` box was
   display:block (text rect x/y == box x/y). The base stylesheet centres only `.lead .ava` (list rows); nothing
   centred the detail box. js/80 injects the one centring rule. Live after: text centre == box centre (±1px).
2. **Empty avatar when a logo cannot load** — found by the guard probe for (1), not by eye: core-10 swaps the
   initials for a company-logo <img> for any business with a website and, on error, the <img> removes itself —
   leaving a blank coloured square (text length 0 on the mock's lead and client cards; on the live site it
   happens whenever the logo service has no logo for that domain, or is blocked). js/80 puts the initials and
   colour back the moment the logo fails.
3. **Arabic SOP library read backwards.** The English procedure texts sat in an RTL container, so every
   sentence's full stop jumped to the left end (".Open and read any booking before acting") and arrows flipped;
   the two comparison-box headers ("Saudi common practice baseline" / "Our standard" — built by core-08's
   English rewrite chain, unknown to js/21's Arabic dictionary) and the "Purpose." lead-in were English. js/81:
   `unicode-bidi:plaintext` on SOP paragraphs/commands/box texts in RTL (each paragraph follows its own first
   strong character), Arabic headers ("الممارسة الشائعة في السوق السعودي" / "معيارنا"), lead-in "الغرض." with the
   English sentence after it isolated in a dir="auto" span so it keeps reading left-to-right (the first cut
   without that isolation flipped the sentence again — caught by eye on the screenshot, fixed, re-verified).
Guards: scripts/qa/probe-detail-avatar-centred.mjs (8 checks; sabotage: 7 FAIL / exit 1 without js/80; port
9037) and scripts/qa/probe-sop-arabic-and-bidi.mjs (8 checks incl. "EN page untouched"; sabotage: 4 FAIL /
exit 1 without js/81; port 9038), both in battery.txt. Gates: structure OK (74 files), probe-integrity OK,
decisions-wired OK. Live re-runs after the fixes: reference pages 0 hard findings; avatar measured centred on
the real client card and airline dashboard; Arabic SOP screenshot reads correctly by eye.

