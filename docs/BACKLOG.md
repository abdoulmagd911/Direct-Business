# Backlog — open work only

One line per item, most urgent first within each section. Rebuilt 2026-09-27 from the whole 1.5 MB log, each item checked against everything that came after it. The old log is word for word in `docs/history/backlog/` (its README maps dates and fire numbers to pieces); every item found in it, open or closed, with the evidence, is in `docs/history/backlog-triage/` (see `docs/history/README.md`).
When something here is done, delete its line in the same commit; put the story in the commit message, not here.

## The owner's open decisions

They live in one list only — the Drive file *08 Open decisions for the owner* (knowledge base, folder `1nfOES1oPdh2y0ShkrPnSN9CnVj1hFtyP`) — and are not copied here. An item below marked *(08)* waits on an answer there.

## Now — the release queue (CLAUDE.md §5)

- **D · The rest of the Direct Payments exports** — the invoice export is in (D21, #53, 28 Sep). What is left of D — the transactions and corporate-expenses exports, large Excel files, the Payments invoice id — the main builder to confirm and list here.
- **D · Which payments-file column is the invoice number** — the importer reads Invoice Reference, not Invoice Number; confirm in the mapping before real data (08).
- **D · Capture the Payments invoice id and use the client ID** — Open in Direct can only open the whole list; the client-to-Payments jump searches by phone or name; an empty id silently builds a dead link.
- **D · Large Excel files are read whole into memory** — CSV streams in chunks, XLSX does not; the big Payments exports may fail.
- **A · The Finance freeze the owner saw** — never reproduced (a 30–45 s CSV export freeze in August too). Since #53 a local freeze recorder (js/118) names the page and the pause when a tab stalls — read it after the next freeze. Lead: the Expenses tab draws Finance twice (~0.8 s).
- **C · The sign-in / reset loop** — C-lite (no email sender needed; also brings the admin-users function to 10 characters) is PR #51. The rest — per-person reset/invite buttons, branded emails, a custom mail sender (branch login-c) — waits on the company mail settings (08).
- **E · The simplify list** — the builders never received it, and PR #50 (money rules) was also labelled E; the oversight to confirm what E means.
- **Two people saving one company** — the later save still silently replaces the other's note and next action; js/104 only warns afterwards (M77). Preventing it means a merge in the core save path (08).
- **Final go-live reset** — `golive_reset` (`scripts/sql/golive-reset.sql`) only on the owner's go, on the day (D9); then a full gate sweep, every page in both languages.

## Next — planned features

- **Numbered reports** — issue a monthly/quarterly/yearly report with a number and a locked month; the table exists, no screen issues one.
- **The appraisal cycle** — the last step of the project → task → achievement → KPI chain; not built (D1).
- **Tasks, still missing** — the project page (projects list but cannot be opened), subtasks, helpers, task files, archiving a task, a per-team view of the monthly report.
- **KPI definitions editable on screen** — today only by SQL; five of the 30 KPIs are drafts that need the owner's wording (08).
- **Remove a proof file from the screen** — the database supports it; a wrong upload stays visible.
- **Own work on Leads and Clients** — not choosable in the grid yet; the Clients screen still treats Own work as View although the database allows own-company edits.
- **Promo codes on their own page** — taken off Finance by the owner; first clean the 200-code register (165 marked both active and expired, two impossible percentages) (08).
- **A list of invoices per service** — tapping a service in income-by-service opens the whole Ledger with a note.
- **Offer Studio round trip** — report sent/accepted back to the offer; one-click accepted offer to booking.
- **Activity & Audit** — no filter or search (a long scroll on a phone); no export there or on Archive (08).
- **Parked ideas from Direct's own changelog** — an invoice timeline strip; the payment proof on the invoice; needs-my-action queues with timers on Leads; the supply date into generated documents.
- **Remove patch layers made obsolete** — the August code-lightening plan never ran; over a hundred script files load. Ties in with speed (D14) and E.

## Safety and hygiene

- **Real client names still in public files (rule 7)** — one client's short name on screen (js/core/core-08-v25.js ~lines 567, 1619) and in comments (js/41, js/57, js/62, js/70, core-06); client names with counts in docs/HANDOFF_2026-08-09.md and docs/DIRECT_PAYMENTS_MODEL.md; the archived old DECISIONS text. Scrub the working files; old history is the owner's call (08).
- **Seven real client names on the About-Direct one-pager** — fine only if they are published references (08).
- **Delete the test functions `hi` and `gstest`** — gstest holds the master database key and writes a file on every no-sign-in request; may need one dashboard click.
- **The public-surface check misses every Phase 3 table** — `run-live-checks.sh` tests a fixed list; tasks, KPIs, teams, money rules and the rest are not on it, so a new open table would pass.
- **The live-versus-repository check always reports a difference** — since D14 the served page carries its scripts inline; compare with the built `dist/` page instead.
- **Supabase settings (08)** — leaked-password protection is off; point-in-time recovery never confirmed (only manual backups known); session length for staying signed in; the advisor flags pg_net in the public schema.
- **manual-confirm `/data`** serves flagged records with no sign-in (08); **event-site logins** would be readable by every signed-in account, password column included — empty today (08, E1).
- **Proposals storage is public by link** and holds about 15 empty test PDFs (08).
- **A view-only share link still shows five internal columns** — owner, next action, priority, tier, health (08).
- **The company registry table** — re-check its live access rule for switched-off accounts; the other four such tables are closed.
- **Leftovers after the reset (08)** — old snapshot/world30 backup tables (real older data); 19 empty placeholder files; five old `app_*` section tables Today still loads; a 1999 test row in `finance_targets`.
- **Unused columns and tables** — `allowed_pages` (the admin-users function still writes it); `finance_reconciliation_gaps`; the `next_review` column (the value lives in the record's blob, so anything built on the column finds nothing).

## Finance — smaller fixes

- The top-bar finance export ignores the client filter, and its code comment claims otherwise.
- The Expenses form offers deleted or excluded transaction numbers (it reads the raw invoice list).
- Individual bookings: the page picks its rows by one field though its header names two; they count as B2B on the sector chips (08); no export button (08).
- One period design (08) — the Report Builder ignores the period bar and sector chip; Expenses and Payment Proofs keep their own month box.
- Which Finance sector a company holding both a tender and an ordinary client ID gets (08).
- The Transactions search does not fold Arabic spellings or digits like every other search box.
- The Ledger reads a table with no live rows until D; an invoice's detail box can no longer be opened from any button.
- Finance refusals speak in two voices (the general permission box vs Finance's own message).
- The importer blames the file for any error while drawing the preview; the import headline counts only the latest drop though an earlier file still feeds the cost join (08).
- Today's money chips count the empty in-app store, not the ledger; the Credit Pool needs a definition of extended credit (08), and its cap line is hidden by a style rule.
- Awaiting the owner (08): the Plan-vs-actual and Monthly revenue blocks; a Ready-to-invoice line on Overview; which wins when an invoice's month contradicts its date; where individual booking cost comes from; the corporate-card cost sheet; a filtered COGs report link.
- Keep the Expenses tab (built, never used) or keep cost only in Direct Payments and remove it (08); the Finance role floors — transactions, receipts and cost lines stay admin/manager/operations, deletes and merges admin/manager — lift or keep (08).
- Clients & collections counts companies with paid invoices (15 then) against Clients' records (28) — reword once D brings real rows.

## Screens and words

- **Arabic wording owed by the owner (08)** — tender statuses, the 30 KPI titles and focus lines, initiatives, five funnel dropdown lists, 15 supplier types, SOP texts, event names, service levels, airline names.
- **Airlines, Suppliers and SOPs read a copy in the settings record** (Airlines 136 vs the register's 139) — moving them also moves where edits save (08).
- **Company registry** — confirm the Zakat/Tax ID, IATA Wakeel number and bank name, then move them in; 22 of 29 entries have no expiry date; the Arabic branch list misses one location; DUNS still printed while expired (08).
- The refusal message always names Leads, Clients and Finance, whatever the person's grid holds.
- Twenty dropdowns on requests, proposals, bookings and invoices can overwrite a stored value (pick-the-first-option) — fix before those are first used.
- The command palette (Ctrl+K) offers old pages but not Clients, Finance, Reports or Tasks.
- Ticket issued/voided/refunded statuses are never supplied — they would have to arrive from Payments as a field.
- A lead imported under an unknown owner spelling silently leaves that person's Mine — matters at the go-live import.
- The proposal pricing dropdown silently replaces an existing client link (08).
- The event status field mixes certainty with a missing date — split it.
- Dead `v20TestConnection` marks a source connected without testing — remove.
- The brand colour file is not read by the Proposal Studio page or the old quotation code.
- The Refresh proposal templates button only rewrites a few coded colours (08).
- About 28 always-running timers, six at one second or faster — battery on phones.
- Small words: the Arabic greeting before 5 am disagrees with the English; client-profile audit rows lack the company name; the import Done line keeps the language it was built in; share-link guests see the sync badge.
- Owner choices on screens (08): list filters remembered across a reload; export columns nobody fills; the hidden lead dashboard; the Brand link for the team; a.hassan@ on the team list; the renewals card's order; names auto-split and no home teams.
- Owner choices on the pipeline (08): Negotiation as a real stage; one funnel per company vs several sources; splitting Travel Trade and a BNPL/fintech funnel; screen stage words vs database words; the three duplicate suppliers.
- Never walked: tablet widths (560–900 px); the booking, invoice and payment forms in Arabic (they need records).

## Data and go-live

- **Go-live lead data (08)** — Drive lead lists never consolidated; the remaining invoice-mined files never loaded; data enters only through the importer (D17).
- The travel agencies database lives outside the app — verify and decide whether it loads (08); a seeded tender client with no database record was dropped — re-enter only if confirmed (08).
- WhatsApp exports need re-exporting without media; Drive call recordings could attach to company cards (08).
- Browser push reminders — parked by the owner, to be raised again at go-live (08).
- Leads from corporate.directksa.com once it launches — same funnels; decide on an onboarding step.
- Unclear leftovers (see the triage): Drive brand source files never opened; the Leads/Clients icon and card-layout polish, probably covered by D4.
- Old review lists never closed with the owner (08): the content-audit wording, the paged branded proposal, the brand palette against the email signature, the B2B landing page fixes, a partner code at signup, the corporate-versus-individual expenses filter.

## Test suite

- About 100 probes wait fixed seconds instead of a condition (one waits 22 s) — convert to waiting for what each needs.
- About 47 staff-login tests run only where staff passwords exist — plan: a test account per role, then automatic runs.
- Expense-capture check H fails only under load (the second file's cost update never applies) — may be a real fault.
- attack-day and attack-wave3 run on an old seed with no transaction tables, so their Ledger steps never run.
- The export-injection test finds its row by position; the Leads toggles are printed, never asserted; the paged-read tie-break is unchecked; the button sweep misses the Clients Edit buttons.
- Never attacked as an area: notifications and reminders. About 82 findings of the September eight-area sweep were never verified (the list is not in the repo).

## Watch — act only if it recurs

- Probes that go red only when many run at once — read each as a race, never ignore it; the phone-dialog Save once out of reach under load; the readiness message never yet seen in a real starved run.
- Vercel once skipped building a push for twenty minutes — re-push and check Deployments.
- The Import tab rejecting a correct file (the M12 wiring race) — capture the console if it is seen again.
- Today once showed an empty company list although the data had arrived.
- Nobody sets next actions yet, so the follow-up queue on Today stays empty — a team habit, not a fault.
- The shared workspace row (`app_state`) is most of each sign-in download — the known structural issue.
- The database advisor's performance notices (multiple permissive policies) were never reviewed.
