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

**A reconciliation note, flagged rather than silently trusted:** Abdulrahman reported a live
invoice total on 2026-08-22 of **63 corporate invoices, 8,909,774 SAR, dated 18 Mar to
20 Aug** — close to, but not identical to, an earlier figure this doc already carries from
2026-08-20 (§3: 8,791,497 SAR across 28 clients, all 61 parent invoices resolving cleanly).
The likely explanation is simply invoices raised in the two days between those checks, but
that has not been proven line-by-line — whoever reconciles the two totals next should record
the actual invoice-by-invoice diff here, not just assume the gap is new invoices.

---

## 3 · The money model

**The chain:** a client's spending flows **Transaction → (approved) Expenses → consolidated
Tax Invoice (ZATCA)**. One transaction can hold several services; several transactions can be
consolidated into one tax invoice via `consolidated_proforma_id` — the field our own database
uses to remember which transactions became which invoice.

**Revenue and cost — the corrected, current definitions (2026-08-20/21, after two rounds of
real mistakes that were caught and fixed — see §6):**
- **Revenue = the transaction/invoice total** — what the customer actually pays. (An earlier
  draft of this reasoning had said never call this "revenue"; that was wrong and was
  withdrawn.)
- **Cost = the *approved* expense only** — what Direct's own Finance team verified against
  real proof of payment before letting the invoice go out. A cost is never counted from an
  estimate, a pending line, or a line still "Under Review."
- **Profit = Revenue − Cost**, and only ever computed from the two lines above — never from
  an estimate standing in for either one.
- **VAT is never shown, anywhere, at any stage, in any form** — not as its own figure, not as
  a "fee excluding VAT" figure either. This is a hard, repeated owner rule, not a style
  preference.

**The confirmed-cost gate — Expense Status.** Every transaction carries its own
`Expense Status`, which is `Pending` or `Ready` (and goes blank once the transaction has
become an invoice). It only reads `Ready` once **every one of its expense lines that hasn't
been cancelled is Approved** — one line still sitting at Pending or Under Review holds the
*whole* transaction at Pending. Cancelled lines are ignored and never block readiness. Only
`Ready` (or already-`Issued`) transactions may ever contribute to a confirmed revenue/cost/
profit total; a `Pending` transaction shows its cost as an estimate only, clearly marked, and
is excluded from every total. **"Total Submitted Expenses"**, a number Direct Payments itself
shows on an invoice, is *not* cost — it includes lines still Under Review, so using it raw
overstates the real, confirmed cost.

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
- **The deployment trap — read this one twice.** Vercel's *production* branch is
  `claude/new-session-9fhlp1`. Work done on `claude/handoff-docs-2026-08-10-6n5ihq` (or any
  other branch) is **not live** until it is actually merged into production and Abdulrahman
  approves that promotion. As of 2026-08-22, production is genuinely 100+ commits behind —
  confirmed by diffing the branches directly, not assumed. **The quick way to check what's
  actually live:** compare how many `<script src="/js/...">` lines the real site is serving
  against how many the branch you're working on has —
  `curl -s https://www.directksab2b.com/ | grep -c '<script src'` against
  `git show origin/<branch>:index.html | grep -c '<script src'`. A mismatch means the branch
  you're looking at is not what users are actually using. Never assume work is live just
  because it's pushed to a branch.
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
