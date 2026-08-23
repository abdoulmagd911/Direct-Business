# Decisions in force — the one file to check before acting

This is not a diary. It is a short, ruthlessly pruned list of **rules currently binding**
on this project. Narrative — how something was found, the investigation, the false starts —
stays in the Cowork project docs and in `BACKLOG.md`. This file holds only what a session
must check *before* touching money display, permissions, or data provenance, and it must
stay short enough that checking it is actually cheap.

Built 2026-08-23 after this project repeated a mistake (asking the owner to hand-export
files) that was already written down, in a doc this project itself authored, because the
knowledge existed but nothing forced a check against it at the moment of acting. See
`BACKLOG.md`'s 2026-08-23 entries for the full story.

## How this file works

- **Every rule below is either `ACTIVE`, `OPEN — CONTESTED`, or `SUPERSEDED-BY: <rule>`.**
  A superseded rule is *edited in place*, not left standing with a correction appended
  underneath — that pattern (32+ point-in-time docs, several silently contradicting each
  other) is exactly what made prior knowledge unfindable. When something is unlearned,
  rewrite the entry.
- **Whoever learns the thing writes it, in the same commit as the change that taught it.**
  Not a later cleanup pass.
- **Any action that touches money display, permissions, or data provenance requires
  reading this file first.** Not "should" — a session that skips it and turns out to have
  been wrong doesn't get to say it wasn't told. A session that genuinely cannot check
  something (a capability limit, not neglect) must say so plainly instead of silently
  guessing or silently asking a human to route around it.
- **Keep this file short.** If it needs a rule that isn't here, add it; if two rules can
  merge, merge them. A rule list nobody can hold in their head stops being a rule list.

---

## Money & finance display

**Finance uses exactly three money words: Revenue, Cost, Profit. VAT is never shown or
mentioned — anywhere, at any stage, in any view or report.** Restated positively 2026-08-23,
owner verbatim: "as agreed, we don't need to mention any VAT. We just need to mention three
things: cost, profit, revenue." Not just "no VAT" — no fourth money concept either. Ruled on
VAT twice before in writing; a later session asked a third time and was told, again, no.
`vat_sar` is a legitimate stored column (used internally) — the rule is about what renders
on screen or in an export, never about the column existing.
*Date: 2026-08-08 (ruled), reconfirmed 2026-08-22, restated positively 2026-08-23. Status:
ACTIVE.*

**Cost = approved expenses only.** `finance_expenses` rows are the real cost behind a
service — the hotel bought, the visa paid for. They are record-only: nothing in that table
may ever be substituted into an invoice's `cost_sar`/`profit_sar` automatically (see
`js/45-expenses.js`'s own header comment). Until real per-invoice cost data is imported
from Direct Payments, `cost_sar=0` on an invoice is an honest gap, not something to
compute a number for.
*Date: 2026-08-16 (expenses model built), reconfirmed 2026-08-22 (BACKLOG entry: cost "must
come from approved expenses... not a VAT computation"). Status: ACTIVE.*

**SUPERSEDED — the invoice item split (Service Fee / 3rd Party Fee) is a VAT split, never
real cost.** An earlier round of this project treated the 3rd-Party-Fee line as the real
cost figure; re-verified live against Direct Payments and found wrong — that line is a VAT
split, not a cost. Do not resurrect "cost = the non-taxable pass-through line" as a rule; it
is the same mistake under a different name. Real cost comes only from the rule above.
*Date corrected: 2026-08-22, commit `a454709` ("Correct the money-model chain"). Status:
SUPERSEDED-BY: "Cost = approved expenses only", above.*

**Takamol and Techtic Support never appear anywhere — not in Finance, not in Clients, not
in any export or report.** They are SVP/QVP verification revenue from a different system,
not BD income. Owner ruling 2026-08-23, verbatim: **"No takamol what so ever."** Any row
matching takamol/techtic on `client_group` or `customer_raw_name` is excluded from every
total. If a future import re-introduces them, that is a BUG, not new data.

Full history, since this was contested for a few hours before the ruling settled it —
proof the mechanism catches exactly what it's for: exactly ten Takamol invoices
(`1163619023, 1163632114, 1163643155, 1163642810, 1163669282, 1163676553, 1163703086,
1163708455, 1163744152, 1163744151`) entered `finance_invoices` live, summing
**6,724,291.12** of a displayed total of 8,755,055.41 — independently re-verified against
the database, exact match. A `Takamol for Business Services` client record was created and
the ten linked to it 2026-08-22 — the opposite of exclusion. Two readings were open (full
exclusion vs. partial genuine-client revenue) until the owner ruled outright for exclusion.
Resolution, independently re-verified against the database: all ten soft-deleted
(`deleted_at` set), `integrity_status='excluded'`, `exclusion_reason` recorded on every row;
the wrongly-created client archived; its `finance_client_link` deleted. Live Finance total
after: **2,030,764.29** (46 invoices) — within 1.8% of an independent non-Takamol workbook
figure, a decent cross-check that the right ten came out.

**Root cause, confirmed, worth recording precisely.** The exclusion list
(`js/62-finance-guardrails.js` `finExclusionCheck()`) was seeded correctly on 2026-08-21 —
client ID 7, match names "Takamol for Business Services" / "Techtic Support" — and IS
correctly wired into all three of this app's own import paths (`js/41-money-in.js:110`,
`js/65-universal-importer.js:275`, `js/16-finance-ledger.js:822`, confirmed by reading all
three, not assumed). The guard was right, wired, and live, and it never fired: the ten rows
were written straight into `finance_invoices` with direct SQL, going around the app's
importer entirely — confirmed directly by the person who ran it, not inferred. No
client-side import-time check can ever defend against a write that never goes through the
client. Fixed 2026-08-23 with a second, independent line of defense:
`js/16-finance-ledger.js`'s `live()` — the one chokepoint every Finance total/export reads
through — now re-checks every row against the same exclusion list on every call, not once
at load. That mattered in practice: a first version that filtered only inside the load
callback passed on a manual reload but silently let the row through on the real first
render, because `finance_invoices` can finish loading before `DB.settings.financeExclusions`
does — `live()` re-evaluates on every call, so it can't lose that race. Caught and fixed by
`scripts/qa/probe-finance-invariants.mjs` before shipping, not after.
*Date: 2026-08-23. Status: ACTIVE.*

**A standing exclusion is not satisfied by loading the data and labelling it.** If a rule
says a party is excluded, its rows do not enter the table at all — full stop. The Takamol
mistake above was exactly this: a client record was created, its invoices linked, and
100% attribution reported as a success, while a written rule said exclude. The number
looked better precisely because the rule was broken. "We loaded it and can explain why
later" is not compliance with an exclusion rule.
*Date: 2026-08-23. Status: ACTIVE.*

**Wallet top-ups are never revenue.** Skipped by the importer the same way verification
services are.
*Status: ACTIVE.*

**Never sum `finance_invoices` (`FIN.rows`) and `finance_transactions` (`TXN.rows`) in one
total.** They are two parallel datasets covering overlapping but not identical money — the
Ledger tab reads transactions, Overview/Clients/Reports read invoices. Summing both double
counts.
*Status: ACTIVE.*

**VOID is excluded from every total, everywhere, always.**
*Date: 2026-08-22. Status: ACTIVE.*

**Only confirmed, fully-paid tax invoices count as revenue.** A transaction with expenses
registered is "recorded and tracked" until its tax invoice is issued — work-done-but-not-
yet-invoiced is normal and must show as its own Ready-vs-Pending split, never be folded into
revenue early and never be hidden.
*Date: 2026-08-22. Status: ACTIVE.*

**Never fabricate a number to fill a data gap — leave it null and say why.** Proven twice:
the promo-code registry showed 27,304,067 SAR that was never real (114/134 codes flagged
active-and-expired simultaneously, 131/134 with a discount not matching their own stated
percentage, all seeded in one batch the day before real finance data landed) — the fix was
to turn the card off, not fabricate a cleaner number. And separately: client-level cost
totals from the Direct Payments workbooks don't reconcile to per-invoice amounts closely
enough to spread across invoices (1.8% gap) — spreading them anyway would have put wrong
numbers on individual invoices. Left both as an honest, stated gap instead.
*Date: 2026-08-22/23. Status: ACTIVE.*

## User-facing text

**Help text may state a RULE the user could otherwise violate. It may not explain our
architecture.** A heading like "Payment proofs — the audit file cabinet" or "Individual
bookings — the fifth revenue pattern" is this project's internal spec vocabulary leaking
onto a real employee's screen — nobody on the team can name the other four revenue
patterns, and it teaches nothing. Cut it. But two sentences under Expenses and Payment
proofs state real rules — "these amounts never change an invoice's cost or profit," "wallet
top-ups are never counted as revenue" — and are the only thing at the point of use stopping
someone from assuming an expense moved a number it shouldn't, or that a wallet top-up counts
as income. **If removing a sentence would let someone make a money mistake, rewrite it
shorter — do not delete it.**
*Date: 2026-08-23. Status: ACTIVE.*

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
stays purely local.
*Date: 2026-08-08 (ruled), violated once 2026-08-13, re-enforced. Status: ACTIVE.*

## Code patterns that keep re-biting

**A Supabase `.update()`/`.insert()` without `.select()` returns success with no error even
when Row-Level Security silently refused the write.** Always chain `.select()` and check
`r.data.length` before telling the user something was saved/deleted/restored. Bit
`finDel`/`finRestoreInv`/`finDel`/`finRestore`/`expSave`/`expDel` in a single session before
being made a standing rule.
*Date: 2026-08-22. Status: ACTIVE.*

**`is_client` is two flags, not one.** The `businesses.is_client` column and
`raw->>'isClient'` must both change together — the app reads both, so changing one without
the other leaves a record half-converted.
*Status: ACTIVE.*

**Every CSV/spreadsheet export must pass values through `csvGuard()` before writing.**
RFC-4180 quoting is not protection against formula injection — Excel strips CSV quoting on
open and still evaluates a cell starting with `=`, `+`, `@`, tab, CR, or a non-numeric
leading `-`. Proven exploitable, not theoretical.
*Date: 2026-08-22, commit `fab1849`. Status: ACTIVE.*

**A hardcoded password-length minimum must equal the Supabase project's own Auth policy
minimum exactly, via one shared constant (`MIN_PW`), never a separate literal per screen.**
Two screens each hardcoded `<8` while the real policy was 10; the form silently accepted an
8-char password, the server-side update then failed, and the person was never told — this
locked the owner out of his own Super Admin account.
*Date: 2026-08-23, commit `f029899`. Status: ACTIVE.*

**QA probes: interaction-correctness checks click during load; content-correctness checks
wait for settle. Do not conflate them.** A probe that only waits for settle will never
catch a freeze that happens mid-load (this is exactly how a real 45+ second Finance-tab
freeze reached the owner without any probe in this project's history catching it first). A
probe that measures content immediately after a click, without waiting for settle, produces
false "renders EMPTY" results on tabs still mid-load. Use the right one for what's being
tested, not one rule for both.
*Date: 2026-08-22. Status: ACTIVE.*
