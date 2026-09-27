## Data provenance — how data enters this app

**Data comes from the Direct Payments export registry (`/en/admin/excel-exports`),
captured in-page by whichever session holds the admin browser session — never by asking
the owner to hand-export files.** This was Stage 2 of the Import Engine + Automation Plan
(Aug 20/21) and was already agreed before a session asked the owner to manually export
three files, which is precisely the thing this rule exists to prevent. If the session doing
the work does not have browser access to Direct Payments, it must say so plainly and route
the request to a session that does — never silently fall back to asking the owner to do it
by hand. A genuine capability limit is not neglect: on 2026-08-23, the Transaction Expense
Export (registry id 5800, 70,682 rows, file identified and its direct download link known)
could not be captured because a browser extension blocked the download from firing — that
was stated plainly rather than quietly turned into a request for the owner to export it
himself, which is the correct response under this rule.
*Date: 2026-08-21 (planned), reconfirmed 2026-08-23 after being violated once. Status:
ACTIVE.*

**Never fire Direct Payments' sync export/`?export=1` path, and never request a large page
from Direct Payments — the session lock is global to the whole browser session, not just the
one request.** Verified 2026-08-23: the sync export fetch is accepted by the server and never
returns; while it's in flight, EVERY other request from the same browser session queues
behind it — a separate paginated capture of page 1 hung too, and stayed hung after a full tab
reload, because the server-side job holds the Laravel session lock. That is why a separate
queued "Fast Excel Export" route into `/en/admin/excel-exports` exists — it is the only export
worth evaluating later; the sync URL is never worth retrying or polling. The same lock, not
just the export button, also fires on an ordinary page fetch with `per_page=100` on
`/en/admin/corporate_clients/transactions` and `/en/admin/stats/cog-report` — both stalled the
session the same way; `per_page=10–25` returns instantly on both. Page Direct Payments small;
a captured 219-row batch at `per_page=100` worked but sits on the edge of the same lock, not a
safe pattern to repeat.
*Date: 2026-08-23. Status: ACTIVE.*

**Business data enters through the app's own import path, never by direct SQL.** The
importer (`js/41`, `js/65`, `js/16`) enforces exclusions, dedup and the five-count preview
before anything is written — direct SQL bypasses every one of them, silently. This is the
mechanical cause of the Takamol mistake above: the exclusion guard was correct and live,
and a direct SQL write went around it entirely, invisible to the app until someone happened
to look at the total. If a direct write is genuinely unavoidable, apply the exclusion rules
by hand first and say in the commit why the importer couldn't be used — never write real
finance rows straight into Supabase as a shortcut.
*Date: 2026-08-23. Status: ACTIVE.*

**Real company, client, or invoice data is never committed to this repository — no
exceptions, no "temporary" branches.** This repo is public. It already went wrong once: a
2026-08-13 branch committed real snapshots (1,035 real leads, real contacts, a real invoice
capture) as a database-recovery aid, and it sat exposed on GitHub for over a week before
being caught. If real data ever needs to leave the database, it goes to Google Drive or
stays purely local. **This covers the repo's own docs, not just code and data files** —
found 2026-08-29 that `CLAUDE.md`, this file and `docs/BACKLOG.md` named real clients with
real invoice numbers while the JS seed data had been carefully scrubbed. A rule entry that
needs a real example describes the *shape* ("an EN/AR spelling pair") and points at where the
real value lives (a DB column, a settings map) — it never carries the value itself. **Owner
ruled the same day: the repo stays public** (sessions need it public to fetch), so scrubbing
is the fix, not visibility — all three docs scrubbed 2026-08-29. Old commits still carry what
they carried; a history rewrite is a separate, coordinated job that has not been asked for.
*Date: 2026-08-08 (ruled), violated once 2026-08-13, re-enforced; extended to docs and
"repo stays public" ruled 2026-08-29. Status: ACTIVE.*

**FIN.p — one period state drives every Overview/Clients number; nothing is stored per
period.** `year: 'all'|<year>`, `part: 'all'|Q1..Q4|H1|H2|M:<MonthName>`, `sector:
'all'|tenders|b2b|academies` (26 Aug, `finSectorOf()` — derived at render from the linked
business's `payment_terms` and `service_type`, never a stored column). All three ride the
same `finInPeriod(r)` check, so picking any one of them scopes KPIs, charts, clients,
ledger and CSV exports together — "scope is a page property," not something each tab
re-derives its own way. **27 Aug — `FIN.p.cmp` ('none'|'prev'|'yoy') adds a fourth,
comparison-only axis on top of the same state**, resolved by `finCompPeriodOf()` into a
second `{year,part,sector}` object and summed by `finPeriodTotals()` — it never touches
`FIN.p` itself, so building a comparison can't disturb what's on screen. Needs a concrete
`year` to shift from (`'all'` has no single "previous"); cross-year-boundary periods
resolve correctly (Q1's previous is Q4 of the *prior* year). Any change to the `part`
vocabulary or the sector list must update `finCompPeriodOf()` too, or a comparison for a
newly added period value will silently return null instead of a table.
*Date: 2026-08-11 (period doctrine), 2026-08-26 (sector), 2026-08-27 (Compare-to). Status:
ACTIVE. Written retroactively for the 26/27 Aug entries — see the P4-addendum note below;
should have gone in the same commits as the features themselves.*

**P4-addendum — `js/45-expenses.js`, `js/57-payment-proofs.js`, `js/58-b2c-manual.js` are
owned by NEITHER side of the P4 split.** Found 2026-08-27 while looking at why these three
Finance-nav tabs (Expenses, Payment Proofs, B2C manual) don't share `FIN.p`'s period bar:
Expenses and Payment Proofs each keep their own independent `YYYY-MM` month dropdown
(`EXP.month`, `PRX.month` — a different format than `FIN.p.part`), and B2C manual has no
period control at all. Real inconsistency, left unfixed on purpose: P4 lists these three
files under neither task, so unifying them means picking a shared period representation
neither side gets to decide alone. Whoever picks this up next: read this entry before
touching those three files, and update the ownership list above in the same commit, don't
just fix the symptom and leave the ownership question open again for the next person.
*Date: 2026-08-27. Status: OPEN — CONTESTED (ownership, not the underlying finding).*

**M20 — a table made by hand in the database is reachable from the internet the moment it
exists, and only row-level security stops it; a one-off backup is not exempt.** Found
2026-09-20 (fire #131). Two leftover tables from a 2026-09-09 clean-up —
`app_state_backup_20260909` (a full workspace snapshot) and `app_settings_backup_20260909` —
were the ONLY tables in the public schema with row-level security switched off. Proven, not
assumed: a plain request carrying the publishable key that ships inside the app's own page —
no sign-in, no password — returned both rows, while the same request against `businesses`,
`finance_invoices` and `ksa_events` returned nothing. Every one of their 23 sibling snapshot
tables (`businesses_snapshot_*`, `world30_*`, and the rest) was already set up correctly:
RLS on, no policies, so only the service role and the dashboard can read them. These two were
an oversight at the moment they were created, and nothing in the app, the probes or the docs
ever referred to them. Both now match their siblings; the backups themselves are untouched
and still hold their row. **The rule: any table created outside a migration — a snapshot, a
"just in case" backup, a scratch table — gets `enable row level security` in the same
statement that creates it. And because no probe in this battery can see the live database's
settings, the check that catches this is Supabase's own security advisor
(`get_advisors(security)`, which flagged exactly these two at ERROR level): read it during a
sweep, the same way `scripts/qa/check-structure.mjs` is read before a deploy.** This is not
the public-repo question rule 7 settles and not the accepted in-app exposure of standing rule
5 — both of those are about data behind a login. This was real company data readable by
anyone, with no login at all.
*Date: 2026-09-20. Status: ACTIVE.*

**M21 — a document that proves money lives in a PRIVATE bucket behind a link that expires, never
at a permanent public address.** Found 2026-09-20 (fire #133). `payment-proofs` and `expenses` —
proof of real payments, and real receipts — were marked public AND carried a read policy with no
condition at all (`bucket_id = 'expenses'`). Measured before changing anything: an anonymous list
call carrying only the publishable key that ships inside the app's own page returned HTTP 200 on
both, so a file's address did not even have to be guessed. Nothing real was exposed — every file in
both is a zero-byte placeholder today, and the real documents live in `company-docs`, which was
already private and returned nothing to the same caller. The door was open in front of a feature
about to hold receipts for real money. `js/66-document-generator.js` already had the right pattern
and says so in its own comment: a private bucket read through `createSignedUrl(path, 600)`, a link
that dies in ten minutes. `js/45-expenses.js` and `js/57-payment-proofs.js` now do the same, and
both buckets match `company-docs` (private, `app_role() IS NOT NULL` on read). Verified both ways
afterwards: anonymous list returns 0 entries, and a signed-in employee still lists, signs and
fetches from all three. **The code half is gated — `scripts/qa/check-structure.mjs` refuses
`getPublicUrl` on `payment-proofs`, `expenses` or `company-docs`** — because that one call silently
re-opens the door. Two notes kept deliberately: a signed link is FETCHED, not computed, so a preview
must open its tab inside the click and fill it in afterwards or the browser blocks it; and the
`proposals` bucket is NOT covered — its address is stored inside the offer record and a proposal is
a client-facing document, so that is the owner's call, not a QA fix.
*Date: 2026-09-20. Status: ACTIVE.*

**M22 — a function that runs without a sign-in must never hold a key that bypasses the database's
access rules, unless what it can write is itself bounded.** Found 2026-09-20 (fire #134). The
`manual-confirm` edge function runs with `verify_jwt = false` — deliberate, it is a page opened in
a browser — while holding the service-role key, and its `/save` endpoint patched `businesses` or
`contacts` BY ID with whatever fields the caller sent. Measured with no key at all: the page
answered, `/data` returned three real records including two contacts with a real e-mail and phone,
and a POST to `/save` returned HTTP 200 (it changed nothing only because the test used an id
matching no row). No RLS policy can stop this — the service role bypasses policies — so the bound
is a TRIGGER: `trg_guard_manual_confirm` on both tables refuses any update that stamps
`confirmed_by`/`confirmed_at` on a row that is not still flagged for manual confirmation, which is
that function's exact fingerprint and nothing else's (the app writes those two columns on
`finance_client_links` only — `js/31-v48-team-access-one-simple-page-to-manage-.js` and
`js/41-money-in.js`). Verified both ways in an always-aborting block: unflagged row blocked,
flagged row allowed, ordinary company and contact edits untouched. **The reading half is left
open on purpose and is the owner's decision** — `/data` still serves three records to anyone with
no login; closing it means deleting the function or redeploying it behind a sign-in, and a blind
redeploy would mean reproducing 9 KB of its HTML exactly, with the same risk in the rollback. The
general rule: before trusting `verify_jwt = false`, ask what the function can WRITE with the key it
holds, and bound that — obscurity of the address is not a bound, since the project reference is
printed in the app's own public page.
*Date: 2026-09-20. Status: ACTIVE (write half closed; read half OPEN — awaiting the owner's call).*

**M23 — the battery cannot see the live project, so the live project gets its own check, run by
hand.** Added 2026-09-20 (fire #137) after one sweep found four separate doors open to somebody who
had not signed in — two RLS-off backup tables (M20), two money-document buckets (M21), an
unauthenticated service-role write path (M22), and a 1 MB sign-in-capable copy of the app served
out of Storage that called the whole-blob `save_state`. Every one was found by hand with curl, and
250 green probes said nothing about any of them, because every probe in the battery drives the app
against a mock. `scripts/qa/check-public-surface.mjs` is that search as one command: it reads the
publishable key out of the app's own page — no secret, exactly an outsider's position — then asks
every table in `scripts/qa/public-surface-tables.txt`, the three money-document buckets and the
`app` function whether they hand anything to a caller with no sign-in. Doors open by DECISION are
judged in `scripts/qa/public-surface-judged.txt` with a written reason, gated both ways like
`scripts/qa/reports.txt`. It sits in `scripts/qa/battery-excluded.txt` on purpose: it touches
production and needs network, so it is run during a sweep, not 250-at-a-time. **Its own blind spot,
stated inside the file: the API refuses to list its tables to that key, so the list is a snapshot
and a table added later is not covered — `get_advisors(security)` is the check for that, and the
two together cover what neither does alone.** Proven able to fail rather than assumed: a throwaway
table with row-level security off, created and dropped the same minute, made it exit 1 and name the
table.
**Extended 2026-09-24 (fire #239) — there are now three by-hand live checks, and each answers a
question the mock structurally cannot.** `check-live-matches-repo` asks *is the thing I edited the
thing being served?* `check-public-surface` asks *what does a caller with no sign-in get?* The third,
`scripts/qa/check-live-data-shapes.mjs`, asks *are the broken shapes the app was hardened against
actually PRESENT in the real data?* — the thirteen shapes behind M82 and M83, among them the null
inside an `activities` array that emptied the whole company list, a last-contact that is not a
number, a date nothing can parse, and an invoice whose stored profit does not equal revenue minus
cost (M1). Hardening answers what happens IF; only the live data answers whether. It reads and never
writes, prints the count for every shape **including the zeros** — a list of only the problems cannot
be told apart from a list that failed to look — and exits **2**, not 0, when it cannot reach the
database, because "could not ask" is not the same answer as "clean". Measured the day it was
written: 108 companies, 46 invoices, 80 events, **every one of the thirteen counts zero**, which is
what makes those two fixes preventive rather than firefighting. Proven able to fail: fed six
synthetic malformed records on top of the real read, it named all six and exited 1.
*Date: 2026-09-20, extended 2026-09-24. Status: ACTIVE.*

**M24 — a third party's personal contact detail never goes in the code, even when it is useful.**
Found 2026-09-20 (fire #140). `js/core/core-09-v26.js` carried, as Gulf Air's escalation contact, a
named analyst with their job title and **personal mobile number**, and `js/core/core-10-v29-reports.js`
repeated the number in its ADM-risk line. A real person's direct line, in a **public** repository,
and not the owner's to publish — the same class as the customer PII found here on 2026-08-27, and
not covered by standing rule 7's wording, which talks about company and client data. It is covered
now. Both entries escalate through the airline's own Riyadh sales mailbox instead, which was already
sitting beside the mobile. **What made it findable was that it was the only one:** every other
`escalationContact` in that file is a corporate desk or mailbox — Saudia RUH Sales, flynas, the
KU-RUH desk, Turkish Riyadh marketing — which is the right pattern, and which is why the gate below
can afford to be strict. **`scripts/qa/check-structure.mjs` now requires every Saudi number in `js/`
to be judged in `scripts/qa/phone-numbers-judged.txt` with what it is**, read both ways like the
other judged lists, with the obvious placeholders (`+9665000000NN`, `05000000NN`) exempt. Three
entries survive: the company's own published number, Amadeus Saudi's agency-support desk, and an
example in help text. A named individual belongs on the supplier's record in the `providers` table —
visible to the team, invisible to the public. **Still open and the owner's call: removing it from the
code does not remove it from git history.**
*Date: 2026-09-20. Status: ACTIVE (code clean; history untouched — awaiting the owner's decision).*

**M25 — the audit log is a copy of the records, so it must obey the same access rules they do.**
Found 2026-09-20 (fire #141). `record_history`'s read policy was `using (true)`: any signed-in
account could read every entry, and **137 of them carry a full row snapshot** of a finance record in
`before_row`/`after_row`. The app's page-access model exists precisely so somebody can be given
Leads without Finance — and the audit screen walked straight around it. Money rows now require
`can_see_page('finance')`; non-money rows are untouched. **Proved both ways rather than assumed**, on
the QA account (`test@directksa.com`, created for QA and not a staff login), moved to a
finance-less map and restored exactly: without Finance, `can_see_page` false and **0 money rows**
while the rest of the log still read; with it, the rows come back. The Activity & Audit screen was
then driven in both languages — 353 events, no errors. It changed nothing for anyone today, which is
why it was safe to do now: all eleven live accounts carry finance access.
**Checked in the same pass and found already sound, so nobody re-opens it:** the database function undo_change (SQL, not js/) is
SECURITY DEFINER and builds SQL from the `table_name` and `before_row` it reads out of
`record_history`, which would be an arbitrary-write path if that table could be written to. It
cannot — a crafted insert from a signed-in session is **refused by RLS** ("new row violates
row-level security policy"), 0 rows written, measured. The function is also gated properly on its
own: signed-in with an active account, a 24-hour window, never an "undo" of a create, money
restricted to admin/manager, and a full restore admin-only.
*Date: 2026-09-20. Status: ACTIVE.*

**M26 — a column the app reads back must also be a column the app can clear.**
Found 2026-09-21 (fires #148/#149). The client handover fields — legal name, CR/VAT, entity type,
payment terms, credit limit, contract scope, contract dates — are written to real columns in
`businesses` and most of them were never read back, so a company that received them any way other
than by being typed into this app (a SQL update, the August import) showed a dash on its own card
over the answer: **payment terms on 20 live companies, both contract dates on 19, credit limit on 8,
CR/VAT, legal name and entity type on 1 each**. The fix is a fallback in `rowToApp` (js/02 —
`o.paymentTerms=String(r.payment_terms)`), with the raw blob still winning, exactly like the
`assigned_to` / `tier` / `segment` fallbacks added before it.
**The second half is the rule.** The writer only ever SET those columns (`if(value) row.x=value`),
so once the reader prefers a column, a value you DELETE comes back on the next reload — the column
still holds it. `appToRow` now writes `null` for an emptied field (`row.payment_terms=_col(...)`),
which is safe *because* the reader loads the column first: the only way one of them is empty at save
time is that somebody emptied it. Take one half without the other and it is worse than either — the
probe proves it by removing the reader and watching the writer wipe both contract dates.
The contract dates are the one exception: the form takes free text and a `date` column rejects
anything that is not a date, which would fail the whole row's save, so they are cleared or written
only when they really are a date, and otherwise left exactly as they are.
Guard: `scripts/qa/probe-the-card-shows-what-the-database-holds.mjs`.
*Date: 2026-09-21. Status: ACTIVE.*

**M27 — a read that FAILED must never be drawn as a result that came back empty.**
Found three times in two days (fires #155 and #158), always the same line of code:
`rows = (r && r.data) || []`, which turns an error into an empty list because `r.data` is null on a
failure. What the screen then says is not "we could not reach it" but the most confident sentence it
owns:
- the company card said **"No contacts yet."** about a company with a contact in the database — and
  the app's own "needs attention" rule, which counts a company with no people, named the entire
  pipeline (`v72Notice`, js/72);
- the Finance → Ledger tab said **"No transactions recorded yet — the ledger is empty, not
  filtered"** about a ledger nobody had managed to read, with **Confirmed revenue / cost / profit
  all 0** beside it (`txnLoad`, js/16).
The rule: **remember which read failed, say so in the place that would otherwise speak for it, and
offer a retry. Where the missing thing is money, draw nothing at all rather than zeros** — the
Finance page's own outage card is the standard ("do not read any figure from this page until it
loads"). And keep the honest empty state intact: "none" and "unknown" must look different **in both
directions**, or the fix is just a different lie.
Both places this rule first named are now closed, and each answers differently on purpose — the
judgement is part of the rule:
- **money draws nothing rather than zeros** (the Ledger, fire #158);
- **a calendar the browser already holds is still worth showing**, with a line saying it is a copy
  (Events, fire #159);
- **an identifier is never invented** (the five client-document tabs, fire #160). That one was the
  worst of the three: the fallback literals in the code had drifted a digit from the registry, so a
  failed read did not lose the company's unified and licence numbers — it printed **two numbers that
  are not the company's** onto a quotation or a contract. No value, no line, and `js/87` says so on
  screen before anybody sends it. It also keeps those numbers in the database rather than in a public
  repo (rule 7).
Guards: `scripts/qa/probe-a-failed-load-does-not-say-nobody.mjs`,
`scripts/qa/probe-the-ledger-says-it-could-not-load.mjs`,
`scripts/qa/probe-the-events-list-says-it-is-a-copy.mjs`,
`scripts/qa/probe-a-document-never-invents-the-company.mjs` — the last of which also reads the five
tabs' source, so a fallback literal cannot quietly come back.
*Date: 2026-09-21. Status: ACTIVE.*

**M28 — a note we write to ourselves about a third party must never reach a share link.**
Found 2026-09-21 (fire #164), the same day the two notes were added, by opening a view-only link and
asking what it shows. A share link puts Today, Leads and Clients in front of somebody **outside the
company**, and a company card opens from that list. Two lines on that card are internal judgements:
js/85's "the same person is on another company", which **names the other company**, and js/86's
"confirm this company before reaching out — organisation inferred from the email domain only", which
is our own unfinished assessment of a business we have not checked.
Neither appeared at the time, and only by luck: the share loader (`shareRowToApp`, js/10) copies a
record's **whole raw blob** to the link holder, and fire #151 had just begun putting those fields on
the app's record object — **one in-app save of any company** would have written them into that blob
and handed them out with it.
Two locks, because this is not the kind of thing to be clever about: `stripBridged` (js/02) keeps
those fields out of the blob at the source — they are column-owned, the column always wins on read,
so a copy in the blob was only ever noise — and **both layers return early when
`window.__isShareView` is set**, whatever the data says.
The rule generalises past these two: **before putting anything on a company card, ask who else can
open that card.** A share link is the answer nobody remembers.
**Followed through the same day (fires #165 and #166), and it was worse than the two lines.** A link
holder could read the **activity log** (our call notes, with edit and remove beside each one), the
**comments**, and the **notes** — free text on 100 of the 108 live companies — and could take a
**copy** away: the top bar's Export menu (CSV/Excel, all records) and the Leads page's own
"Export this view", whose file carries every lead's owner, next action and contact details. None of
it is what the link is for; the panel that mints one promises Today, Leads and Clients — the
pipeline, not the file we keep on a company, and not a download of either. All of it now stops at
`js/79`, the layer whose whole job is that promise, with one line telling the holder that internal
material is not shared. Two brakes in the guards, because the cheap way to pass this rule is to hide
everything: **what the link is for still works**, and **a signed-in colleague still sees all of it**.
Nothing was exposed when this was found — all four live links were switched off — which is exactly
when to fix it.
Guards: `scripts/qa/probe-a-share-link-sees-no-internal-notes.mjs`, whose fourth check seeds the blob
with all three fields — the state one save would create — and whose fifth proves a signed-in
colleague still sees everything, so this is a wall and not a deletion;
`scripts/qa/probe-a-shared-card-keeps-our-notes-inside.mjs` (the card's own three internal sections);
`scripts/qa/probe-a-view-only-link-cannot-take-a-copy.mjs` (both export routes).
*Date: 2026-09-21. Status: ACTIVE.*

**M29 — a share link is given only what the link promises, and the allow-list is written twice.**
Found 2026-09-21 (fire #167), finishing the question M28 started: #165 asked what a link holder can
**read**, #166 what they can **take**, and this asks what the page was **handed** in the first
place. `share_view` — the `SECURITY DEFINER` database function a link calls with **no sign-in** —
returned the **whole `app_state` blob**, and js/10 copied every key of it into `DB`. On the live row
that is **35 keys and 86,801 bytes**, of which a link needs three. The rest included the `agency`
block (the company's **bank IBAN**, its **Amadeus office and PIN**, its **Zakat/Tax ID**), the
**799-row `audit` trail** — the same trail #141 kept from colleagues who cannot open Finance — the
**`serviceFeePricing` scheme**, the supplier `integrations`, the SOPs, the SLAs, the 23 vendors, and
the finance group map inside `settings`. None of it is Today, Leads or Clients. All four live links
were switched off when this was found, as in #165 — which is exactly when to fix it.
**Allow-list, never deny-list**, because the failure mode that matters is the key nobody thought of:
a block added to `app_state` next month must be *absent by default*, not leak because it was
forgotten. Kept: `meta`, `schemaVersion`, and `settings` trimmed to `funnels` / `funnelSubs` /
`viewPresets`. Result 35 keys → 3, 86,801 bytes → 836.
**Twice**, in both places, because they fail differently: the **database function** stops the data
leaving at all, which is the only lock that helps against someone reading the network response
rather than the screen; the **app's own allow-list (js/10)** survives an older cached function and
catches a key the function's author forgets. Restoring either alone is a regression.
The function carries its own undo in a comment (replace the built object with `v_blob := v_all;`),
so the change reverses in one line without a migration.
Guard: `scripts/qa/probe-a-share-link-is-not-handed-the-settings.mjs` — one marker per internal
block, so a failure **names which block leaked**; the mock deliberately still answers with the whole
blob, so what is under test is the app refusing it. Three brakes, because the cheap way to pass is
to hand over nothing: the shared pages still carry rows, Clients still renders, and a signed-in
colleague still gets the whole blob.
*Date: 2026-09-21. Status: ACTIVE.*

**M30 — when a value moves to a new home, the old form that edits it must be closed the same day.**
Found 2026-09-21 (fire #168). The company's identity moved to the `company_identity` registry: js/66
hydrates the legacy `AGENCY` block from it (2026-08-24) and #160-#162 pointed every document at it.
What nobody closed was the **form on the other side**. On `/dashboard`, "🇸🇦 Agency profile — KSA
settings" still offered six boxes — trade name, VAT number, IBAN, bank, IATA Wakeel — under
*"Used on every invoice header, ZATCA QR seed, and BSP payout reconciliation."* Driven live: it
**showed** the registry's values (correct — AGENCY is hydrated before it renders), each box **wrote**
to `DB.agency`, the older store nothing reads, and the next page load **re-hydrated from the
registry and threw the typed value away**. Its sentence had been false since 2026-08-24. Somebody
correcting the VAT number there would believe they had corrected it everywhere and have changed
nothing — and the two stores have drifted: **seven of the thirteen comparable fields disagree,
including the VAT registration number and a bank IBAN** (`scripts/qa/diag-agency-profile-card.mjs`,
a live read-only report).
The rule is the mirror of #120-#121's *"a field the app prints but no form can write is a gap"*:
**a form the app offers but that writes nowhere is worse than a gap, because a gap is visible and
this is not.** So a migration is not finished when the new reader works — it is finished when the
old writer is shut, or is made to write to the new home.
Shut, not deleted: js/89 turns the card into read-only values from the registry, says where they are
kept and that they are not changed here, and links to the page that does change them (shown only to
somebody who may open it — a button that bounces is its own small lie, the lesson of #165's jump
chips). `renderDash` still builds its card and `DB.agency` is untouched, so removing js/89 puts the
boxes straight back.
It also **names the three values the registry has no key for** — the IATA Wakeel number, the
Zakat/Tax ID and the bank name — rather than drawing them as empty boxes, because an empty box reads
as "nobody filled it in" when the truth is "this app has nowhere to keep it".
Guard: `scripts/qa/probe-the-identity-card-does-not-pretend.mjs`. Two brakes, because deleting the
card outright would pass most of it: **the card is still there** and **the values are still shown,
and they are the registry's**. The check that the false claim is gone reads `textContent`, not
`innerText` — the sentence lived in a `.ch-sub` that `innerText` skips, so the first version of that
check passed against the broken copy and could not have caught anything.
*Date: 2026-09-21. Status: ACTIVE.*

**M31 — the sidebar is not built from the list of pages; and "nothing opens this" is a claim about
every visible control, not just the chrome.** Found 2026-09-21 (fire #169) by sweeping every
routable address against
the live database as an admin, who may open everything, so nothing was hidden by permission. The
app routes from js/03's list of valid addresses; the sidebar is built from `VIEWS` (core-01), then
**thrown away and rebuilt** by core-08's `v25_2RestructureNav` from three hardcoded lists
(`V25_PRIMARY` / `V25_REFERENCE` / `V25_READONLY`). A page in none of those three has no button, no
matter how correct it is — and adding it to `VIEWS` alone does nothing, which is the trap, because
it looks like the fix. CLAUDE.md already records the cost: *"this is how the finance ledger sat
live-but-unreachable for two days."*
Two pages were missing from the sidebar, and they are the two that undo a mistake: **Activity &
Audit** (41,636 characters of page on live data — the audit trail and the Undo screen, js/63, the
only place a change made in the last 24 hours can be reversed) and **Archive** (js/76, the only
screen that brings a deleted company back — and **four companies are archived in the live
database**). Both are first-class everywhere else: js/56's access matrix offers them by name in both
languages, js/52 grants both to managers, and `activity` is one of the three pages the database
itself enforces.

> **CORRECTION, same day, before this rule had been acted on twice.** The first version of this rule
> said both pages had **no button anywhere** and could only be reached by typing the address. **That
> was wrong**, and the error is worth more than the finding. Both are reachable by clicking today:
> **Settings → "Admin & history" → Activity & Audit / Archive**, two working buttons that land
> correctly (measured). The sweep that "proved" otherwise —
> `scripts/qa/diag-pages-with-no-way-in.mjs` — deliberately examined only the chrome **outside**
> `#view`, so it could never see a link that lives on a page. Its own header even called its
> detection crude, and a strong conclusion was drawn from it anyway.
> **The lesson this rule actually earns: "no button" is a claim about the whole app, and a sweep
> that excludes page bodies cannot make it.** Before saying a page is unreachable, search every
> visible control including the ones inside pages — Settings in particular, which is where this app
> keeps its admin index.
> What survives is smaller and still true: the two recovery screens were **absent from the sidebar**,
> so finding them meant knowing to look inside Settings. js/90 puts them one click from the nav
> instead of three clicks deep. That is a discoverability improvement, not a rescue.
The way to add one is js/18's Finance pattern — **inject the button after the rebuild and re-inject
after every render**, never touch `VIEWS` (that rebuild matches old buttons to views BY INDEX, and
js/52 records what counting positions already cost: *"what hid Finance from an employee and showed
them Projects instead"*).
Two further things this fire settled. **A new nav button must be hidden from anyone who may not open
that page**, re-checked after every render: js/15's gate matches buttons against its own older list
and silently covers nothing added since, so a button that bounces you back to Today is the default
outcome, not an edge case. And **one page gets one name**: `T('activity')` answers "Activity feed", a
second older string that wins in `I18N`, while the access matrix, the refusal message and the page
title all say "Activity & Audit" — the sidebar now says what the matrix says.
Guard: `scripts/qa/probe-you-can-click-to-the-undo-screens.mjs`. The brake is check 5 — **the rail is
not longer**: both live inside the collapsed Reference group, so the fix cannot quietly undo the
6-8 item sidebar the v25 layer exists to produce.
Report: `scripts/qa/diag-pages-with-no-way-in.mjs` re-runs the whole sweep.
*Date: 2026-09-21. Status: ACTIVE.*

**M32 — a screen that shows company numbers must say so when they are one person's private copy.**
Found 2026-09-21 (fire #170). The Reports page has four tabs and presents company-level figures:
"Achievements logged", "N / 30 KPIs with data", "Avg progress to 2026 targets", and a percentage
against each of the company's 2026 objectives. All of it lives in `localStorage` under
`directReportsData_v1` (core-10's `rptLoad`/`rptSave`). **Nothing else in the app touches that key**
— not the database, not Settings' "Full backup (JSON)".
Measured with two browser profiles, the same account, the same live database: after one achievement
was recorded, profile A read *"1 Achievements logged · 1 / 30 KPIs with data · 3% Avg progress to
2026 targets"* and profile B, at the same moment, read **zeros** — with **no database write
attempted**. So thirty KPIs entered on the office desktop are invisible on a laptop, invisible to a
colleague, and erased with the browser's site data. Nothing on the page said so.
This is the mirror of M27 (*"a read that FAILED must never be drawn as a result that came back
empty"*): there the screen dressed a failure as a fact; here it dresses a private note as the
company's position. Same rule underneath — **the screen must not be more confident than the data
it is drawing.**
**Deliberately NOT moved to the database.** Where company KPIs belong is a real decision, and rule 8
already puts a separate appraisal/KPI system out of this project's scope — quietly duplicating them
into this database could be exactly the wrong answer. It is an open question for the owner
(docs/BACKLOG.md), not a fix a QA round should make alone.
What was fixed is the misleading part: js/91 puts one plain line above the tabs saying the figures
are in this browser only, that they are not in the backup, and that **Generate Report** is how to
take a copy out — a warning with something to do beside it.
Guard: `scripts/qa/probe-reports-say-they-are-local.mjs`. Two brakes, because a banner is the
cheapest thing in the world to over-apply: **the page still works** (four tabs, the figures still
drawn) and **it appears only on Reports** — the same line on Leads or Clients would itself be a lie.
*Date: 2026-09-21. Status: ACTIVE.*

