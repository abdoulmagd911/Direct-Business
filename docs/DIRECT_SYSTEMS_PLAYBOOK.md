# Direct — Systems & Data Playbook

> **Read this before touching anything.** This is the one file a new session should read
> first, so nobody has to rediscover the system from scratch again. Written 2026-08-22 at
> Abdulrahman's direction, mirrored on his Google Drive as "Direct — Systems & Data
> Playbook (living document)" — **this repo copy is the authoritative one.**
>
> **This is a living document, not a snapshot.** The standing rule: any new finding about
> how Direct's systems work, or about our own app's traps, gets added to this file **in the
> same commit** that discovers it. Don't park it in chat and forget it — write it here.
>
> Written in plain language on purpose — Abdulrahman is not a developer and may read this
> himself. Where a technical word can't be avoided, it's explained the first time it's used.

---

## 1 · The four systems, and who owns what

Direct runs three real production systems already, plus this app as a fourth, thinner layer.

| # | System | What it owns | Our app's relationship to it |
|---|---|---|---|
| 1 | **Direct Payments** ("Direct Desk," `payments.directksa.com`) | **All real money.** Every client, every transaction, every tax invoice, every expense, VAT, ZATCA, refunds, settlements. | We **reflect** it, read-only, by the Direct client ID. We may hold a **draft** of an invoice and push it to Direct Payments — nothing more. We never invent or edit a real invoice ourselves. |
| 2 | **Direct Corporate — B2B Admin Panel** (`corporate.directksa.com`, **not launched yet**) | The self-service portal where a client company's own staff will raise travel requests, which flow into approvals and then into Direct Payments. | Not connected to our app today. Test data only lives there. |
| 3 | **Executive CRM Dashboard** | Leadership's view of contracts, tenders and projects — markup, receivable, collection dates. | Not connected to our app. Separate reporting tool for directors. |
| 4 | **Direct Business (this app)** | The **leads lifecycle** (nobody else has this) and the **reporting/workflow layer** the team and Abdulrahman use day to day. | Owns leads and clients as *records*; reflects the *money* from Direct Payments rather than re-typing it. |

**The one rule the whole thing hangs on:** before a lead is Won, the company is fully ours
to manage. After Won, the money facts live in Direct Payments — our app keeps the
relationship and the reporting, and only ever *reflects* their numbers, never re-types them.
The link between "this company in our app" and "this client in Direct Payments" is the
**Direct client ID** (a plain number, e.g. 95, 93, 92).

**What our app must never duplicate:** the client master, invoices/tax numbers, expenses and
their approval, per-item pricing, transactions, corporate-user management, or the
request→policy→approval booking workflow. Re-typing any of that is the "duplication trap"
that caused real drift and confusion before this rule was set.

---

## 2 · How to get data out of Direct Payments

Direct Payments has no export API we can call programmatically — getting real numbers out
of it means working with the actual admin pages a signed-in human sees. Abdulrahman found
the following on 2026-08-22, working directly in a logged-in browser tab; it has not yet
been independently re-tested inside this app's own tooling, so treat it as his direct,
first-hand finding rather than something this session has proven for itself. Living-document
rule applies: whoever next re-tests or extends this should update this section, in the same
commit, with what they found.

**What works:** read the page after it has actually finished loading — Direct Payments
draws its tables asynchronously (the numbers arrive a moment after the page itself), so a
tool that reads the page immediately can come back with an empty or half-drawn table and
report "0 rows" when the real answer is "wait longer." Give the page time to finish its
table draw, then read what's rendered on screen.

**What does NOT work, and should not be retried without a new reason to believe it will:**
- The "download the export as a file" button — the download endpoint redirects (HTTP 302)
  to a different host, so an automated fetch gets back an opaque, unreadable redirect
  response instead of a file. Scripted downloads produce nothing usable.
- Calling `/api/admin/excel-exports` directly (hoping for a clean JSON/data response) —
  it returns the same HTML shell the whole single-page app loads from, not the data, even
  when the request claims to want JSON.
- Fetching any `directksa.com` page from this app's own sandbox tooling (`WebFetch`) — every
  domain in that family is blocked from here, same as every other external site (see
  CLAUDE.md's "what this session can and cannot reach" table). A screenshot, or Abdulrahman
  reading the live screen himself, is the only way in from this side.

**The sync export/`?export=1` path is not slow, it is a session-wide stall — never poll or
retry it.** Tested 2026-08-23: the fetch is accepted by the server and simply never returns.
While it's in flight, EVERY other request from the same browser session queues behind it —
a separate paginated DOM capture of page 1 hung too, and stayed hung even after a full tab
reload, because the server-side job holds the Laravel session lock for the whole session, not
just that one request. This is exactly why "Fast Excel Export" exists as a separate queued
route into `/en/admin/excel-exports` — it is the only export path worth evaluating later.
DOM pagination (reading the rendered table, page by page) stays the working capture mechanism
for everything else. The same lock also fires on an ordinary page fetch with `per_page=100` —
confirmed on both `/en/admin/corporate_clients/transactions` and `/en/admin/stats/cog-report`,
both stalled the session the same way the export did; `per_page=10–25` on either returns
instantly. **Page every Direct Payments capture small (10–25 rows), not 100** — a 219-row
expense-report capture at `per_page=100` completed but sits on the edge of the same lock and
should not be treated as a safe pattern to repeat.

**Useful admin URLs** (`https://payments.directksa.com/en/admin/...` unless noted) —
confirmed to exist and to be readable this way:
- `corporate_clients/transactions` — Corporate Transactions list (150 rows as of 2026-08-21)
- `corporate_clients/invoices` — Corporate Invoices list (63 rows as of 2026-08-21)
- `stats/cog-report` — the COGs Report (see §3 — confirmed genuinely empty)
- `excel-exports` — the registry of every export ever run, with row counts (see below)

Abdulrahman also reported (2026-08-22, not yet independently confirmed by this session) a
further URL family worth checking next time someone needs Direct Payments data:
`corporate_clients`, `expenses?of_corporate_client=true`, `stats/expense-report`, and
`invoices?type=invoice`. He also reported that every Direct Payments page embeds a "Ziggy"
object (a Laravel framework feature that lists every named route the whole application has)
with roughly 478 routes in it — useful for discovering a URL nobody has documented yet
without guessing at one. One genuine piece of independently-confirmed evidence for this: on
2026-08-12 a direct fetch of a Direct Payments login page did return real HTML containing a
`Ziggy` route object — so the mechanism is real, even though nobody has yet counted its
routes from inside this app's own tooling.

**The export catalogue — eleven types, not a guess.** `excel-exports` lists every export
ever run with its row count. As last read (2026-08-21): Invoice Export 544,541 rows (66 runs,
the workhorse — any bulk import of this must stream/chunk, never assume a small file) ·
Revenue Report Export 72,875 · **Transaction Expense Export 70,682 — the real cost source,
not yet column-verified** · Expense Export 70,679 · Expense Invoice Export 52,445 · GMV
Transaction Breakdown 20,889 · Corporate Client Dashboard Invoices Export 44 · Corporate
Clients Export 43 · Promo Code Invoice Export 27 · Expense GMV Export 13 · **COG Report
Export — genuinely 0 rows, both times it has ever been run.** That last one matters: it's
confirmed empty on two independent checks (the export registry here, and the live report
page itself returning nothing for every filter tried — see §3), so "the COGs Report will
eventually have data" is not a safe assumption to build on.

**Reconciliation note, resolved 2026-08-22 — closed, do not re-open without new evidence.**
An earlier version of this section flagged an unproven gap between two invoice totals
(8,791,497 SAR / 28 clients from 2026-08-20 vs 8,909,774 SAR / 63 invoices from 22 Aug) and
asked for a line-by-line check rather than assuming it was just newer invoices. Abdulrahman
did that check directly. A separate small gap turned up along the way — **7,389.40 SAR** —
and traced to a specific, now-understood mistake: **it came from mixing transaction
references into a tax-invoice total.** Refs `1163752886` (74,820.85) and `1163705932`
(33,887.99) are **VOID transactions**, not invoices at all; refs `1163732931` (36,067.00) and
`1163737524` (375.00) are live transactions still at "Published - Pending Payment" — **none
of the four is a tax invoice.** Once excluded correctly, the gap is not real. This is the
same class of mistake as §3's "query trap c" (expenses keying on the transaction number, not
the invoice number) — reading a transaction reference where an invoice reference was needed.

---

## 3 · The money model

> **Corrected 2026-08-22.** Abdulrahman re-verified the whole chain directly against the
> live Direct Payments system and found the version of this section written the day before
> was wrong in an important way (see "query trap c" below for the exact mistake that caused
> it). This replaces that version in full — it is not a patch on top of it. It also updates
> `docs/DIRECT_PAYMENTS_MODEL.md`'s Round 5–14 revenue/cost reasoning, which that file's own
> paper trail leaves in place as history; treat what's written here as the current truth.

**The chain — four steps, each one gates the next. Nothing can skip ahead.**

1. **Create a TRANSACTION.** The system automatically creates two ITEMS per service on it:
   "`<Service>` - Service Fee" (taxable at 15% — this is Direct's own charge) and
   "`<Service>` - 3rd Party Fee" (no VAT — a pass-through cost). **These two items are only
   structure and VAT treatment. They are not the real cost** — that's the mistake the old
   version of this section made.
2. **Register the actual expenses** on that transaction. Direct Payments auto-creates expense
   slots by type (Airline Fees, Hotel Cost, Embassy Expenses, Provider Price, Institution Fee,
   Submission, Insurance, Activity Cost, Appointment, Miscellaneous, e-Sim Cost). A slot starts
   **Pending with no amount at all**; a staff member fills in the real amount, the merchant,
   and the card used, then submits it.
3. **Finance approves each expense line**: Pending → Under Review → Approved (or Cancelled).
   Once every non-cancelled line on the transaction is Approved, the transaction's
   **Expense Status flips to Ready**.
4. **Issue the tax invoice.** An employee selects one Ready transaction, or several, and
   issues them together. The row flips from "Need to issue" to "Issued `<invoice number>`".

**Proof this is really gated, not just described that way:** of 100 sampled corporate
transactions, 54 still read "Need to issue" — split exactly 37 Pending + 17 Ready — and the
other 46 are Issued with Expense Status now blank. **Not one was ever Issued while still
Pending.**

**Proof of consolidation (several transactions becoming one invoice) — read straight off a
real client's own Transactions table:** Directorate of Public Security had 8 separate
transactions all marked "Issued 1163754021": 757.15 + 257.00 + 1,149.00 + 8,800.00 +
7,324.35 + 18,050.00 + 13,400.00 + 25,840.50 = **75,578.00 SAR — matching invoice 1163754021
(DPIN-331650) exactly.** Sidra Travel: 2,250 + 2,050 = 4,300, matching invoice 1163703046.
The largest consolidation seen anywhere so far is 8 transactions into 1 invoice.

**THE COST RULE — put this one in bold, it is the whole correction:**
**Cost = the sum of the Approved expense lines on the transactions behind the invoice.
Nothing else.** The item split from step 1 is a VAT split, not a cost split — the two can
agree by coincidence, or be wildly apart, and there's no way to tell which without actually
reading the approved expenses. Two real, contradicting transactions prove this:
- `1163736022` — charged 120,091.89, its "3rd Party Fee" item reads 120,090.74, and the real
  approved expenses also total 120,090.74. Item and cost happen to agree here.
- `1163688585` — charged 2,250.00, its "3rd Party Fee" item reads only 50.00, but the real
  approved expenses total 2,200.00 — **44 times higher than the item.** Reading the item as
  cost on this transaction would have been badly wrong.

Also still true from earlier work: **"Total Submitted Expenses"** (a number Direct Payments
shows on an invoice) is *not* cost either — it counts lines still Under Review, not only
Approved ones, so it can overstate real confirmed cost.

**VAT is never shown, anywhere, at any stage, in any form** — not as its own figure, not as a
"fee excluding VAT" figure either. This is a hard, repeated owner rule, not a style
preference, and nothing in this correction changes it.

**Verified profit, worked by hand on 5 real invoices across 4 clients:**

| Invoice | Revenue | Cost | Profit | Margin |
|---|---|---|---|---|
| 1163703046 | 4,300.00 | 4,108.80 | 191.20 | 4.4% |
| 1163757148 | 8,983.00 | 8,379.12 | 603.88 | 6.7% |
| 1163713895 | 24,800.00 | 23,686.08 | 1,113.92 | 4.5% |
| 1163759273 | 42,685.00 | 42,354.00 | 331.00 | 0.8% |
| 1163736330 | 423,347.00 | 333,537.53 | 89,809.47 | 21.2% |

Inside invoice 1163757148, one of the transactions behind it is actually a **loss**: tx
`1163756896` charged 846.00 but its approved cost was 871.26 — a **−25.26 loss**, invisible
because the invoice's overall total nets it away against the other transactions bundled into
it. **Line-level margin must always be shown somewhere** — an invoice-level number alone can
hide a real loss underneath it.

**The split-pair pattern — why per-invoice margin alone can actively mislead:** one client,
Altadin Alarabiyya Alsaudiyya, opened two transactions in the same minute on 19 Aug:
`1163760881` (Direct Visa, 5,600.00, with a matching 5,600.00 approved expense — margin
**zero**) became invoice `1163762432`; `1163760880` (Direct Support, 2,944.00, with its
expenses **Cancelled** — margin the **full 2,944.00**) became the very next invoice,
`1163762433`. The same pattern repeats at `1163760836`/`1163760832`. **The cost sat on one
invoice and the revenue on the other.** This is exactly why profit must be able to roll up
to client × period, not be trusted at the single-invoice level alone.

**Query traps — each of these has already cost real hours, don't repeat them:**
- **(a)** `/en/admin/expenses` defaults to `of_corporate_client=false` — that's the **B2C**
  list. Corporate expenses are invisible on that page unless you add
  `?of_corporate_client=true`.
- **(b)** That same page also only lists **Fully Paid** invoices. Transaction `1163745460`
  is Ready with a real approved cost, but its status is "Void Receivables," so it never shows
  up there at all. The complete register is
  `/en/admin/stats/expense-report?of_corporate_client=true` (216 corporate expense lines;
  241,948 SAR overall across corporate + individual).
- **(c) THE MISTAKE THAT CAUSED THE EARLIER WRONG VERSION OF THIS SECTION:** expenses key on
  the **transaction number**, never the tax-invoice number. Searching an invoice number like
  `1163703046` finds nothing; searching the transaction number `1163688585` finds the real
  record. Reading invoice numbers where transaction numbers were needed made the whole chain
  look backwards.
- **(d)** `/en/admin/proformas` is **not a real page** — proformas, invoices and credit notes
  all live together under `/en/admin/invoices`. Corporate transactions live at
  `/en/admin/corporate_clients/transactions` — columns RECEIPT REF. | PRODUCT | AMOUNT (SAR) |
  INVOICE ISSUING | CREATED AT | EXPENSE STATUS (153 rows, confirmed 2026-08-23). This is the
  source of record for the transaction-level Expense Status gate (Pending/Ready, blank once
  Issued) that our app's cost-capture importer needs — NOT the expense-report page, which only
  carries the per-line status. **Unverified:** whether RECEIPT REF. here is literally the same
  value as INVOICE # on the expense-report page — same number space (e.g. 1163764791 vs
  1163597647), not yet proven on a matched pair. Treat any join between the two as a claim to
  test, not an assumed fact — see `js/65-universal-importer.js`'s `expense_gate_capture`.
- **(e)** Until its tax invoice is issued, a transaction is stored as an invoice record of
  type "Invoice - B2B" with status "Void Receivables" — that status is normal and expected
  for an un-issued transaction, not an error state.
- **(f)** **DPIN belongs to the client, not the invoice** — it's a per-client tax number, and
  more than one invoice can carry the same one (DPIN-334213 appears on two different
  invoices). 24 of the 63 real corporate invoices carry no DPIN at all — that's normal, not
  a data gap.
- **(g)** URL parameters that actually work: `of_corporate_client` and `page`; `per_page`
  caps at 100 no matter what's asked for. `invoice_no_or_ref_no` only works on
  `/en/admin/expenses`, and only together with `of_corporate_client=true`. On
  `/en/admin/stats/expense-report` the on-screen filter boxes ignore URL parameters entirely
  — they have to be set by hand on that page.
- **(h)** **B2C is a shorter chain** than corporate — there is no separate proforma step; the
  invoice number *is* the transaction number, and expenses hang directly off it.

**Three different views of "one invoice" — know which is which:**
- **Admin detail** (`/en/admin/invoices/view/{id}`) — the full line grid, VAT per line, and
  payment receipts. This is the real data source.
- **View Tax Invoice** (`/en/invoice/{a different uuid}`) — the bilingual ZATCA/Fatoora
  document itself, with Print and PDF buttons.
- **Preview / "Order Receipt"** (`/en/invoice/{the SAME id as the admin detail}`) — collapses
  everything to **one line with no split at all. Never use this as a data source** — it looks
  like a real invoice but throws away the exact detail the cost rule depends on.
- The Preview and the Admin detail share the same uuid; the Tax Invoice document has its own,
  different one.

**Two smaller notes, worth keeping in mind:** "Other Income" is already a real product type
(appeared on 6 of the 100 sampled transactions), so a commission that arrives *with* a real
transaction already fits this chain — nothing special needed for it. Direct Payments also has
an "Add COG" action per transaction on the client page, but `/en/admin/stats/cog-report` is
currently empty for every corporate client — same finding `docs/DIRECT_PAYMENTS_MODEL.md`
already carries in detail, just reconfirmed here.

**Verified live totals, 22 Aug 2026:** 44 corporate clients, 150 corporate transactions, 63
corporate tax invoices totalling **8,909,774.25 SAR** — 22 Settled, 36 Issued-Waiting for
Settlement, 2 Waiting for Issuing, 2 Overdue, 1 Partially Settled.

**Revenue rules, confirmed by Abdulrahman 2026-08-22:**
- **Only a confirmed, Fully Paid tax invoice counts as revenue.** Not "Issued," not
  "Waiting for Settlement" — Fully Paid / Settled.
- **VOID is excluded from every total, everywhere, always.** A void transaction or invoice
  is not a zero, not a cancellation to net against something else — it simply never enters
  any total.
- **A gap between "work done" and "invoiced" is normal, not a bug, and must be shown, not
  hidden.** Direct waits for the client's money to actually arrive before issuing the tax
  invoice — so any transaction that already has expenses registered on it is **"recorded and
  tracked"** even while it sits short of Issued. This is the "Not yet invoiced" state, and it
  has two distinct flavours that must be split apart, never blended into one number:
  - **Ready** — expenses are Approved, the transaction is just waiting on the client's money.
  - **Pending** — expenses are still waiting on Finance's own approval.

  **Live measurement, 22 Aug 2026:** 54 such transactions, **1,133,517.20 SAR** —
  **17 Ready (317,115.18 SAR)** and **37 Pending (816,402.02 SAR)**. This is the "Not yet
  invoiced" section of the Finance page: one number split exactly these two ways, never
  shown as a single blended figure.

**Overdue is mirrored, never computed by us.** Direct Payments' own Corporate Expenses screen
already shows a live countdown and a breached/overdue flag once a deadline passes. Our app
must import that flag as-is; it must never invent its own "N days since created" rule, because
an invented threshold will disagree with what the same person sees on the same invoice inside
Direct Payments itself — exactly the kind of mismatch that destroys trust in a report.

**Neither Corporate Transactions nor Corporate Invoices carries a client name or ID on the
row itself** — the client is only ever a *filter* on those screens, not a column. This means
any future import of those two files cannot match rows to a client by name or ID the way
today's invoice importer does; it must instead reconcile through the Corporate Clients
registry (which does have real client IDs, one per client company, 1–96 as last checked).
**Design rule for any future importer built against a file with no client column at all: say
so loudly in the preview** — "this file carries no client column; exclusions could not be
checked for its N rows" — never silently report "0 excluded," because a true zero and an
inapplicable check must never look identical on screen.

**The company/profile model.** One real-world company can carry several "profiles" in Direct
Payments, and which kind decides the shape:
- **Prepaid** — one profile total for the company (a wallet).
- **Postpaid** — one profile total for the company (a credit line and term).
- **Tender — one profile *per tender*, never one per company.** A tender carries a fixed
  amount once issued, and that amount can never be added to or adjusted afterwards — the only
  way to give that client more is to open a brand-new tender. One company can hold several
  tenders over time, each staying its own separate profile, all grouped under the same
  company. **Two tender profiles for the same company must never be auto-merged into one**,
  even if every other matching signal (tax number, domain, name) lines up — that's the one
  deliberate exception to our own linking rules.
- `direct_client_id` is the permanent, unchanging key per profile; `company_id` is what
  groups several profiles under one company. Grouping is not the same thing as merging.

**Money never appears on the Clients page — full stop.** Abdulrahman's own ruling: the
Clients page is company *identity* only (name, agreement, documents, which profiles exist and
their type) — no revenue, cost, profit, deal value, wallet or outstanding figure of any kind.
All money lives on the Finance page, grouped by company with each profile's type clearly
labelled on every row and every export.

**Two things that must never appear anywhere in this app, at any layer:** Takamol/Techtic
Support (a verification service accounted for in a different system entirely) and wallet
top-ups. Not as a client, not as a row, not in a dropdown, count, filter, or export. These
must be excluded at **import time**, so the excluded row never enters our data at all — never
filtered out cosmetically while still sitting in the table underneath.

Full round-by-round detail, including every correction and retraction along the way, lives in
`docs/DIRECT_PAYMENTS_MODEL.md` — this section is the settled summary, that file is the
paper trail of how we got here (worth reading before assuming the *first* explanation you
find in it is still current; several early rounds were later corrected).

---

## 4 · Our app's landmines

Practical rules that exist because breaking them has already caused real, confusing damage.

- **A new feature is a new file.** Create `js/NN-short-name.js` (the next number), not a
  patch to an existing file for something unrelated to what that file already does. This is
  what lets two people work on the app at the same time without fighting over the same file.
- **Script tags are always absolute paths** — `/js/whatever.js`, never a relative path.
  A relative path silently breaks the moment someone reloads the app on a deep link like
  `/leads` instead of the homepage.
- **Never call `window.supabase.createClient` again in a new file.** The app used to have
  five separate connections to the database fighting each other and silently signing people
  out. There is one shared connection now (`v44a`, near the top of the file) — just use it.
- **A new page needs an explicit nav entry**, not just a render branch — the navigation bar
  is rebuilt from a list (`VIEWS`) by more than one layer, and a page with no nav entry sits
  live but genuinely unreachable by anyone clicking around (this actually happened to the
  finance ledger for two days before it was caught).
- **`render()` reruns constantly**, driven by several unrelated timers — anything injected
  onto a page after the fact must be able to redraw itself every time, not assume it only
  ever runs once.
- **Run `node scripts/qa/check-structure.mjs` before every deploy.** It catches the exact
  mistakes that have caused real duplication bugs before: logic typed directly into
  `index.html` instead of a `js/` file, the same file loaded twice, two files creating an
  element with the same id, and a few other repeat offenders.
- **The deployment trap — read this one twice.** `claude/new-session-9fhlp1` is the *only*
  branch as of the 2026-08-22 branch cleanup — Vercel's production branch, GitHub's default
  branch, and the one branch anyone should ever push to. Before the cleanup this was a real,
  repeated trap: work sat pushed to a *different* branch, genuinely live nowhere, for over a
  week (100+ commits behind) before anyone noticed. **Never create a second long-lived
  branch** — that's exactly how the trap comes back. Push straight to
  `claude/new-session-9fhlp1`. **The quick way to check what's actually live, if this rule is
  ever suspected to have slipped again:** compare how many `<script src="/js/...">` lines the
  real site is serving against how many the branch has —
  `curl -s https://www.directksab2b.com/ | grep -c '<script src'` against
  `git show origin/claude/new-session-9fhlp1:index.html | grep -c '<script src'`. A mismatch
  means something didn't actually reach the branch that matters.
- **Testing a role without a real password.** Two ways, neither requiring a real staff
  password: (1) `MOCK_ROLE=<role> node scripts/qa/probe-....mjs` drives the QA mock as any
  role for UI-level checks (what a person can see/click); (2) for real database-permission
  checks, `scripts/qa/rls-matrix.sql` runs entirely inside one `BEGIN...ROLLBACK` block,
  temporarily role-flipping a real existing account to test as it, then rolling every change
  back — it never creates a new account and never leaves a change behind.

---

## 5 · The owner's standing rules

Abdulrahman's own rules for how this app is allowed to behave, distilled from repeated,
explicit instructions across many sessions:

1. **Money only ever appears on the Finance page.** Not on Clients, not on Leads, not
   scattered into summary cards elsewhere — one place, so there is one place to trust.
2. **Verify before declaring anything done.** Drive the actual app in the QA harness — click
   it, read the screen, read the screenshot — never declare a fix "verified" from reading the
   code alone. See §6 for why this rule exists.
3. **Nobody — not an admin, not the AI, not a script — creates an account or sets someone
   else's password for them.** People choose their own passwords. (This is the rule the
   2026-08-22 password-recovery work exists to enforce: the old flow let an admin/manager
   type and see a new temporary password for someone else; the new flow only ever emails that
   person their own reset link.)
4. **Delete means archive, never a real delete.** Nothing the UI removes is gone — it is
   moved out of view, recoverable, because a real accidental delete cannot be a two-minute
   mistake to fix.
5. **Every undo path stays real.** If an action can be reversed, the reverse action must
   actually work end to end, not just exist as a button.
6. **Every meaningful change is logged to `record_history`** — who did it, what changed,
   when — so "who did this" is never a guess. The Activity & Audit page reads directly from
   this table.
7. **Password resets happen only via an admin-triggered emailed link — never a manager, never
   anyone typing a password on someone else's behalf.** Resetting someone's password is
   effectively becoming that person for a moment, so the ability to trigger it is restricted
   to the smallest group that needs it.
8. **Real company or client data — names, amounts, invoice numbers, contacts, anything that
   identifies a real person or company — never goes into this repository, in any file, in any
   commit, ever.** Not as a "temporary" export, not as a backup, not even on a throwaway
   branch. This repo is public. **This is not a theoretical risk — it already happened once:**
   a 2026-08-13 branch committed real snapshots (1,035 real leads, real contacts, a real
   invoice capture) meant only as a database recovery aid, and it sat exposed on GitHub for
   over a week before being found and dealt with on 2026-08-22 during a branch cleanup. If
   real data ever needs to leave the database for a backup or recovery reason, it goes to
   Google Drive or is kept purely local — never committed, not even for an hour.
9. **End every reply to Abdulrahman with a short, clearly-labelled SIT REP**: what changed,
   what is pending, what needs him. He must never have to read working notes to know where
   things stand.
10. **Short answers.** Few words, few details. Long write-ups belong in the repo or the
    project docs, never in chat.
11. **Never send files directly.** Store them in the repo, Google Drive, or Supabase instead.
12. **Address him as Abdulrahman.** The `full_name` stored for his account has at times read
    "Ahmed Abo Elmagd" — that is wrong, and it is not just a typo: Ahmed Abo El Magd is a
    different, real employee. Never assume the stored name is right without checking; use
    "Abdulrahman" in conversation regardless of what a record says.
13. **OUT OF SCOPE — the appraisal / KPI / task-manager project** (Supabase ref
    `byhxnmafaumersoaiybq`, project `directksa-performance`) **is a different project with
    different work.** Never read it, write to it, document it in this repo, or reference its
    data. If a task seems to require it, stop and ask. (`docs/APPRAISAL_TOOL.md`, a survey of
    that other project, was removed from this repo on 2026-08-22 for exactly this reason —
    it held named staff appraisal scores that belong to that project, not this one.)

---

## 6 · How to not be wrong

The pattern behind the real mistakes this project has actually made, and the discipline that
now exists specifically because of each one:

- **Verify by behaviour, never by filename or by reading the code alone.** The QA harness
  serves fake data by design — a page can look completely correct in the mock and be broken
  or empty against real Supabase rows. More than one session lost real time to exactly this
  gap; the standing fix is to check the harness AND a real screenshot or real database read
  before calling anything verified.
- **A check with a blind spot is worse than no check**, because it creates false confidence.
  The Arabic-translation sweep script was built to catch untranslated English text — but its
  own design meant it structurally could not see certain gaps (a compound element mixing a
  dynamic value with static text; a pagination bar rendered a particular way). It reported
  "all clear" while a real gap sat in plain sight on screen. The fix was not just patching the
  one gap found by hand — it was rebuilding the scanner so that class of gap can't hide again.
- **When a test reports zero, ask whether it could actually see anything at all before
  trusting the zero.** The COGs Report returning "0 rows" for every filter combination tried
  looked at first like a filter-syntax problem — until it was checked from a second,
  completely independent angle (the export-run registry, which also showed 0 rows on both of
  its two actual runs). Two independent zeroes is real evidence of "empty." One zero alone is
  not — it might just mean the check couldn't see anything.
- **Reconcile every important number against a second, independent source before trusting
  it.** The two close-but-different invoice totals in §2 above (8,791,497 vs 8,909,774) are
  flagged rather than silently accepted for exactly this reason — a plausible explanation is
  not the same thing as a proven one.
- **A file in the wrong shape can silently import as nothing, and that must never look like
  success.** The invoice importer's column-mapping logic fails closed on a shape it doesn't
  recognise — it refuses the whole file with a clear message rather than guessing at columns
  and silently importing garbage or nothing. Any new import path must follow the same rule:
  an unrecognised shape is a loud refusal, never a quiet no-op that looks like it worked.
- **A real, would-have-shipped bug found by actually driving the flow end to end, not by
  reading the code:** the 2026-08-22 password-recovery work found that clicking a real
  password-reset email link would, most of the time, silently sign the person in without ever
  letting them choose a new password — a race between two pieces of code that reading either
  one in isolation would not have revealed. It only surfaced because the recovery flow was
  driven start to finish in the test harness, not reviewed as a diff.

---

## 7 · Key identifiers

| What | Value |
|---|---|
| Supabase project | `direct-business`, ref `vkxoeeoauexyfpzqufqd` (eu-central-1) |
| GitHub repo | `abdoulmagd911/Direct-Business` |
| Production branch (what Vercel actually serves) | `claude/new-session-9fhlp1` — see §4's deployment trap |
| Vercel project | `direct-business`, team `abdoulmagd911s-projects` |
| Live domains | `directksab2b.com` · `direct-business.vercel.app` |
| Core data tables | `businesses` (leads *and* clients — `is_client` flags which), `contacts`, `activities`, `requests`, `offers`, `finance_invoices`, `finance_transactions`, `client_profiles`, `master_db_companies`, `record_history`, `app_users`, `access_allowlist` |
| Reconciliation helper | `finance_reconciliation_gaps` (a database view; currently 0 rows — nothing outstanding as of the last check) |

---

*Add to this file the moment you find something new — same commit, not a follow-up.*
