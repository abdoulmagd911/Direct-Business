## Routine fire #161 (2026-09-21 ~15:15 UTC) — the company one-pager was printing the code's memory, not the registry

Straight on from #160, at the other copy of the same data. The **About Direct Travel** one-pager —
printed for clients, attached to tenders — took **every identifier on it** from literals in
`core-06`'s `AGENCY` constant: CR, unified number, trade licence, DUNS, Zakat/Tax ID, Amadeus office
and PIN, head-office address, phone. And the drift was there too, as it was in #160: rewiring the
page to the registry changed **the postcode in the address** and **the phone number**. The literals
were simply older than the company.

**Every one of those values now comes from `company_identity`,** through a new accessor
`window.dgIdentityValue(key)` beside the credential facts js/66 already publishes. A fact the
registry does not hold **does not appear at all** — no label with a dash after it. The `AGENCY`
constant is now **empty of data**: eight fields, all blank until js/66 fills them at sign-in, which
is what a round in August started when it pulled out an outdated VAT number and an IBAN matching no
company account. What was removed today: the CR, the unified number, the trade licence, the DUNS,
the Zakat/Tax ID, the Amadeus office, PIN and org, the head-office address, the phone, the CEO's
name and the legal English name — **real registered identifiers, out of a public repository**
(rule 7), and one fewer copy to drift.

Also removed: a dead "talking points" card (hidden by v29, everything below its `return` unreachable)
that still carried a hardcoded IATA number — a digit short of the real one. Dead code is not a reason
to keep a real identifier in the repo, and a hidden card is not a reason to keep a wrong number where
someone might un-hide it.

Guarded by `scripts/qa/probe-the-one-pager-asks-the-registry.mjs` (5 checks). The durable one **names
no number at all**: it reads the `AGENCY` line and fails if any long digit string is written back
into it. Sabotage-verified by hardcoding two identifiers into the page again. 3 gates green, battery
273 entries; the document, registry and report probes re-run clean.

**Two things for the owner, both one line each:**
1. **The one-pager no longer shows a Zakat / Tax ID**, because the registry has no key for it. If it
   belongs on that document, add it in **Generator → Company assets & registry** and it appears by
   itself. Nothing was invented to fill the gap.
2. **Three hardcoded identifiers are still in the code** and are the next ones out, named so they are
   not forgotten: the IATA-wakeel sentence in the price-offer terms (`js/67`, EN + AR) and two footer
   lines in `js/core/core-10` (an IATA number, an Amadeus office and a phone). They print correct
   values today; they are the same drift shape.

---

## Routine fire #160 (2026-09-21 ~14:15 UTC) — every client document had two numbers that were not the company's

The second of **M27**'s named gaps, closed — and it turned out to be worse than "a document loses
its identity block".

All five client-document tabs (price offer, service fees, company profile, contract, tender) print a
footer with the company's legal name, its **unified number** and its **tourism-licence number**, all
read from the `company_identity` registry. Each treated a **failed** read as an empty one and filled
the gap from literals written into the code — and **those literals had drifted: each was one digit
short of what the registry holds.**

Measured, not deduced. With the registry reachable the footer printed the registry's values; with
that single request failing, the same footer printed **two different, shorter numbers**. So a
quotation, a contract or a tender built during one bad request went out with a unified number and a
tourism-licence number **that are not the company's**. A missing identifier is a gap somebody
notices. A wrong one is sent.

**Fixed in all five tabs: no value, no line.** The fallbacks are gone, the label goes with the
value (no dangling "unified number:" with nothing after it), and nothing is filled in from memory.
It also moves the company's own registered numbers back where they belong — the database, not a
public repository (**rule 7**). New layer **`js/87`** is the other half of M27: when the registry
did not load, a `.noprint` line at the top of the Documents page tells whoever is building the
document, before they send it. It never blocks the editor — a draft is still worth working on.

Guarded by `scripts/qa/probe-a-document-never-invents-the-company.mjs` (6 checks). One of them reads
the **source** of all five tabs and fails if a fallback literal ever comes back — and it names no
numbers, because the company's identifiers stay in the database. Sabotage-verified: putting one
literal back fails two checks and prints the invented number. 3 gates green, battery 272 entries;
six document and generator probes re-run clean.

**Noted, not touched:** `AGENCY` in `js/core/core-06` still holds a hardcoded copy of the same
identity (CR, unified number, licence, address, phone, legal name). A round in August already pulled
the *wrong* values out of it — the outdated VAT number and an IBAN matching no company account — and
left the rest. It is the same two-sources-of-truth shape that caused today's defect; it is used in
more places than these five tabs, so it is named here rather than changed in passing.

---

## Routine fire #159 (2026-09-21 ~13:15 UTC) — a stale list is fine; a stale list pretending to be fresh is not

The first of the two places **M27** named as known-and-not-yet-fixed, now closed. The Events tab
keeps a copy of the calendar inside the workspace blob, and when its refresh failed it served that
copy without a word. Measured live in fire #156: the page looked **identical** either way, 80 events
both times, because the copy is rewritten on every save and agrees with the table today. Not a lie
yet — it becomes one the moment somebody adds or changes an event anywhere else, and nothing on
screen would ever say which list you are reading.

**The answer here is deliberately not the one the Ledger got.** Money is the case where nothing is
drawn at all; a calendar you already hold is genuinely useful with no connection. So the cached list
still shows — with a line above it saying it is a copy, what failed, and a **Try again**.

`js/10` also gained one small door: `window.__evReload()`. Its `loaded` / `loadAll` live inside the
layer's closure, so nothing outside could ask for a refresh — including the probe, whose first
attempt set a *new global* of the same name and silently did nothing. One hook, used by both the
retry link and the test, beats a probe poking at globals that quietly create themselves.

Guarded by `scripts/qa/probe-the-events-list-says-it-is-a-copy.mjs` (6 checks, both languages). Its
third check is the one that keeps the fix honest: **the notice must not cost you the list** — the
cheap way to pass the others is to replace the page with an error and take away the only copy of the
calendar the browser has. Sabotage-verified. 3 gates green, battery 271 entries; five events probes
and the people bridge re-run clean.

---

## Routine fire #158 (2026-09-21 ~12:30 UTC) — the money screen's most reassuring sentence, said about a ledger nobody read

Two findings, one read-only and one fixed.

### The 19 invoices with no cost are an honest gap — provably

Checked the whole cost chain in the live database, because M1 turns on it:

- **None of the 46 live invoices carries a transaction reference at all.** So the 19 with no cost
  cannot be matched to a captured expense: there is nothing being ignored, and nobody is sitting on
  the missing 214,550 SAR of profit backing. **The app leaving those costs null is correct.**
- **But there is a landmine beside it.** `finance_expense_lines_capture` holds **223 lines from one
  import batch (`dp-import-2026-08-25`), 183 of them Approved, 1,935,461.74 SAR** — and **all 75 of
  its transaction references match nothing live**. The 33 rows in `finance_transactions` are **all
  soft-deleted**. So anyone who later writes "roll the captured expenses into cost" would be rolling
  a previous world's numbers into today's profit. Recorded here before somebody does.

### "The ledger is empty, not filtered" — said after the request failed

The Ledger tab already distinguishes three situations with care, one sentence each. There is a
fourth, and it was wearing the first one's words: `txnLoad` turned an error into `TXN.rows=[]` —
**exactly the shape fixed in js/72 three rounds ago** — so a ledger nobody managed to read announced
itself as *empty, **not** filtered*, with **"Confirmed revenue 0 · Confirmed cost 0 · Confirmed
profit 0"** printed beside it. Three money figures of zero, presented as facts, because a request
did not come back.

The Finance page already knows the right answer — when the *invoices* fail it says "Nothing was
loaded — do not read any figure from this page until it loads" and shows nothing else. The Ledger
tab now meets the same standard: the failure is remembered, the tab says what happened and offers
**Try again**, and **nothing** is drawn rather than zeros — because a zero here is a money figure.
Guarded by `scripts/qa/probe-the-ledger-says-it-could-not-load.mjs` (7 checks, both languages, all
three states: failed, genuinely empty, and with rows). Sabotage-verified: forgetting the failure
again fails 4 checks and check 1 prints the sentence it should not have said.

3 gates green, battery 270 entries; `probe-ledger-attacks` and `probe-finance-says-it-could-not-load`
re-run clean.

---

## Routine fire #157 (2026-09-21 ~11:45 UTC) — is the thing I edited the thing being served?

The question behind months of this project's dead ends, asked properly for once. Every round of this
sweep ends by curling **one** file to confirm a push landed. One file is a sample.

**All 80 checked: every one of the 79 script files `index.html` asks for, and `index.html` itself,
is served by `www.directksab2b.com` and is byte-for-byte (SHA-256) identical to this repository.**
No file missing, none stale, none serving something the repo did not produce.

Made permanent as `scripts/qa/check-live-matches-repo.mjs` — one command, and it separates the three
kinds of trouble because they mean different things: **not served** (a layer that silently does not
exist for anybody using the app), **different** (a deploy still in flight, or something this repo did
not produce), and **missing locally** (the page asks for a file the repo has not got). It reaches
production, so it is excluded from the battery with its reason, beside `check-public-surface`, and
run by hand at the end of a sweep. Proven able to fail by pointing it at a site that does not host
the app: it names all 80.

It also bakes in the lesson that cost time twice today — **the cache-buster is mandatory**, or the
CDN hands back the previous version and the check "proves" a push failed.

---

## Routine fire #156 (2026-09-21 ~11:15 UTC) — corrected the map, and named two more places that go quiet

Docs round while the full battery runs (editing app files mid-run makes its result untrustworthy —
that has happened here before).

### `CLAUDE.md` said this session cannot reach the app or the database. It can.

The last two rows of "What this session can and cannot reach" describe the **chat** sandbox. A
Claude Code session in the remote container reaches both — measured the same day:
`www.directksab2b.com` answers **200**, and the Supabase REST root answers **401**, which is a
refusal for want of a key, not a block. That one line is the difference between trusting the QA
harness — which serves **fake data**, the warning at the top of that file — and driving the real app
against the real database, which is how every defect in fires #148-#155 was found. The recipe is now
written down beside it: strip the proxy variables, launch Chromium with `direct://`, route the
Supabase host to a node `fetch`, **block only table writes and `save_state` — never all non-GET**
(the app *loads* through POST rpcs), and cache-bust the deploy check or the CDN will hand you
yesterday's file and you will "prove" a push failed.

Also added to "How the data actually works": the two-places problem, with the live counts, and the
two rules that now cover it (**M26**, and column-wins for fields only a pipeline writes). Four of
this session's rounds were the same bug wearing different clothes; the next session should meet it
as a paragraph rather than as four days of work.

### Two more places that go quiet when a fetch fails

Same family as #155, found by reading every `r.data || []` in `js/`. **Neither is fixed** — both are
named here with the one-line change each would take, because one is rare and the other is currently
harmless, and inventing a fix for a hypothesis is how this project got its landmines:

- **The four client-document tabs** (`js/67` line ~161, `js/69` ~89, `js/70` ~115, `js/71` ~171) all
  treat a failed `company_identity` load as an **empty registry** (`r.error ? [] : …`). A quotation,
  contract or tender built in that window goes out **missing its legal name, CR and VAT number** —
  a client-facing document with an empty identity block. Rare (it needs the fetch to fail *and* a
  document to be finished in that window), which is why it is recorded rather than patched blind:
  the honest fix is to keep "not loaded" distinct from "loaded and empty" and refuse to build the
  document until it loads.
- **The Events tab** (`js/10` line ~382) keeps whatever is already in `DB.ksaEvents` when its fetch
  fails — which is the copy inside the `app_state` blob — and says nothing. Measured: with the fetch
  failing the page looks **identical**, 80 events either way, because the blob copy is rewritten on
  every save and currently agrees with the table. So it is a silent fallback to a mirror rather than
  a lie today.

**Checked and found careful, so nobody re-opens them:** `js/77` (share links) passes its error to the
panel, `js/58` passes it through, and `js/02`'s archive step forgets **only** the rows the database
confirms — a silent refusal there would otherwise resurrect records.

---

## Routine fire #155 (2026-09-21 ~10:30 UTC) — "No contacts yet" about a company that has one

Asked what the app says when the data does not arrive — by failing one request at a time against
the **real database**. Two of the three answers were good, and the third was a lie with consequences.

**Finance is exemplary.** With the invoice fetch failing, the page says: *"Could not load: simulated
outage. Nothing was loaded — do not read any figure from this page until it loads."* Nothing else on
screen. That is the standard the rest should meet.

**The sign-in gate holds too.** If the companies fail to load, the sign-in card stays up with
"Could not load leads: …" and the app is never entered. (A first reading of this looked like a
serious defect — the app appeared to show its built-in demo pipeline as if it were the real
workspace. It does not: that was rendering *behind* a full-screen blocker because the driver forced
it. Checked before believing it.)

### ⚠ The contacts bridge said the opposite of the truth

`js/72` loads the people from the `contacts` table. On a failed request, `r.data` is null, the rows
become an empty list, and **a refused load became indistinguishable from an empty table**. The
company card then said **"No contacts yet."** about a company with a contact sitting in the
database — *the same six words it uses for one that genuinely has nobody*. Two consequences, both
worse than the wrong line:

1. somebody reads it and **adds the person again**, creating a duplicate on a real company;
2. the app's own **"needs attention"** rule counts a company with no people, so with the load broken
   it names **the entire pipeline** — the one list meant to say what to do next says "all of it".

Unknown is not the same as none. `js/72` now remembers which table failed; the card says *"Could not
load the people on this record — there may well be some. Do not add anyone until this loads."* with
a **Try again** that re-runs the bridge, and `js/09`'s rule drops the people term while the load is
broken. A company that genuinely has nobody still gets the ordinary line — the two states must stop
looking the same **in both directions**. Guarded by
`scripts/qa/probe-a-failed-load-does-not-say-nobody.mjs` (8 checks, both languages, both the broken
and the healthy case). Sabotage-verified: restoring the old line fails 4 checks, and check 3 prints
the second half of the defect — **every company flagged as needing attention**.

### The battery caught a regression from my own change

The full run at the #150 tree came back with **one real red**, reproduced alone: `probe-export-records`
found six **bare camelCase keys** in the Arabic export — `contractStart`, `contractEnd`,
`contractSLA`, `verificationSource`, `needsManualConfirmation`, `confirmationReason`. They are the
fields fires #149 and #151 started bridging onto every record: a column a person can now see is a
column they can now export, and the export had no Arabic word for any of them. Labelled in `js/73`
and re-verified green. Two other probes went red under load and passed alone (`probe-share-view-tidy`,
`probe-the-forms-still-fit`) — the familiar contention, not a finding.

3 gates green, battery 269 entries.

---

## Routine fire #154 (2026-09-21 ~09:45 UTC) — press everything, and be an employee for a while

Two dimensions the standing sweep names and this session had only half covered: **every role**, and
**does anything simply break when pressed**. Both came back clean, and one of them is now guarded.

**Pressed everything, twice.** Eleven pages, every visible button that is not destructive by name,
against the **real database** — 132 presses in English and 132 in Arabic. **Zero page errors, zero
console errors.** A layer that throws inside a click handler leaves no trace on screen: the button
just does nothing and the person presses it again. Seventy-nine script files wrap each other's
`render()`, so this was worth asking bluntly. New guard:
`scripts/qa/probe-no-button-throws.mjs` (4 checks, both languages, ~90 presses each under the
harness). Its first check counts the presses, because the failure mode of a probe like this is
passing while clicking nothing. Sabotage-verified by making one layer throw on click.

**Was an employee for a while.** Drove the app as a `team_member` — the role 7 of the 11 live
accounts hold — against the real database, by rewriting only what the app is told about *itself*.
The access model is correct end to end: the sidebar shows **4 of its 18 entries**, exactly the four
that role may open; Today, Leads (78 rows), Clients (28) and Finance all render in full; Offers and
Settings bounce to Today; there is no Team button; no errors.

**Two measurement lessons, worth more than the results:**
- A first pass reported "the sidebar offers all 18 pages to an employee". It does not — the other
  fourteen are `display:none`, and the reading had not filtered on visibility. `probe-role-nav.mjs`
  records that exact mistake in its own header from 2026-08-21; it was made again here from the
  other direction.
- A second pass reported "an employee cannot open Leads at all". Also false: the simulated access
  matrix used `true` where the live one uses `'editor'`, and the app's filter keeps only `editor`
  and `viewer`, so the fake matrix collapsed to Today alone. **Simulate a role with the shape the
  database actually stores**, or the simulation invents the defect it then reports.

3 gates green, battery 268 entries.

---

## Routine fire #153 (2026-09-21 ~09:00 UTC) — the new surfaces, fed bad data

Fires #148-#151 all did the same thing: take a value the **database** holds and put it on a screen.
Every one of them widened what reaches the page, and none of those values is typed into this app —
they arrive by import and by SQL. So this round asked what those rounds did not: **what happens when
one of them is hostile, enormous, or simply not what the column promises?**

Answer: they hold. `scripts/qa/probe-new-surfaces-hostile-data.mjs` (8 checks) feeds an image tag
with an `onerror`, a script tag, a 5,300-character sentence, a right-to-left override inside a
company name, mark-up inside a CR/VAT number, and a search term made of regex characters — and
checks a **canary** the page sets only if something executed. Nothing executed, nothing was written,
no horizontal scroll at phone width, no error. The sabotage proves it is the escaping doing the
work: with `esc86()` replaced by a pass-through, **the canary fires and two injected nodes appear
in the card**.

Two judgement calls worth recording:
- **Bidi marks are not stripped, on purpose.** U+202E silently reverses everything after it, but a
  bilingual app needs bidi characters for real Arabic. So the check holds the *behaviour* — such a
  record stays findable by the readable part of its name and breaks nothing — rather than banning a
  character the app legitimately needs.
- **The probe was made deterministic before it was trusted.** Its first run went green, its second
  red, on unchanged code: `js/86` injects from a `setTimeout` and a fixed wait had been reporting
  "no mark-up on the page" for a card that simply had not been drawn yet. It now waits for the line
  itself. A probe that changes colour with the machine's mood is worse than no probe.

3 gates green, battery 267 entries.

---

## Routine fire #152 (2026-09-21 ~08:15 UTC) — a sweep that found nothing to fix, and two piles of real work nobody can reach

Read-only round. After three rounds of "the database holds it and no screen shows it", this asked
the question of the whole database rather than one card, and then drove the screens that had not
been driven this session. **No code changed.**

### Verified clean — so nobody re-opens these

- **Row-level security, all 93 tables.** Every one has RLS on. The snapshot and backup tables carry
  **zero policies**, which is the safe end state: with RLS on and no policy, nothing but the service
  role can read them. M20 is fully satisfied; the two tables fixed earlier have not drifted back.
- **`app_state` holds no secrets.** The twelve `integrations` entries every signed-in account can
  read contain only status placeholders — no key, token or password anywhere in the blob.
- **Team & Access**, driven in both languages against the eleven real accounts: fully Arabic apart
  from names and e-mail addresses, and the role picker is sound. It offers three levels, and a person
  whose stored role is one of the three older ones keeps their own option, shown and **disabled**,
  with the value restored after the trim — so nobody can be silently redrawn as an Admin. That was
  the one thing worth checking on that screen and it was already handled.
- **Today** (every zero tile honest; the credit-pool card matches the ledger — remaining is 0.00
  across all 46 invoices), **Events** (past hidden by default, undated sorted last, the counts
  describe what is still ahead), **SOPs & Service Levels** (the SLA grid is live inputs, fully
  Arabic; SOP titles are *data* and correctly left untranslated), **Operations**, **Reports**,
  **Tickets** — whose two-language read-only banner is the owner's own 2026-08-22 correction, not a
  bug. **Settings** renders in full.

### ⚠ Two piles of real work that no screen can reach

Neither is a defect — nothing is broken and nothing is lying. They are **parked work sitting in the
database**, and they are worth naming because nobody would find them by using the app.

| Table | What is in it | State |
|---|---|---|
| `contact_submissions_review` | 58 contact-form submissions, all with an e-mail | **55 unreviewed** — 38 marked *vendor*, 13 *review*, 4 *suspicious*. Only 3 carry an outcome, and all three say "already imported as a lead". **No code in the app reads this table.** |
| `master_db_companies` | 200 travel agencies — 182 with an official licence number, plus VAT, IATA, IBAN, phones and cities | `linked_business_id` is **null on all 200**, and no code reads the table. This is the travel-agencies project already parked in this file. |

**One next step, and it is yours to pick:** the 38 *vendor* submissions are suppliers, not leads —
they belong in `providers`, not in the pipeline, and moving them is a decision about real companies
rather than a code change. Say the word and that batch gets a screen to triage from; until then they
stay exactly where they are. (Real names and addresses stay in the database — rule 7.)

---

## Routine fire #151 (2026-09-21 ~07:30 UTC) — one record was asking not to be called, and nothing said so

The last open question from fire #147, answered by doing it (standing rule 9). Every company row
carries three fields the import and scrub pipeline writes and nobody in this app edits — and none
of the three was ever read:

- **`verification_source` — 81 of the 108 live companies.** Not a code, a sentence: *"Contact-form
  submission, classified with the owner 2026-08-16."* The team has been working those 81 leads
  unable to see that they were already classified with you.
- **`needs_manual_confirmation` — true on one company**, with **`confirmation_reason`** saying why:
  *"Organisation inferred from the email domain only — confirm the company before any outreach."*
  That record looked exactly like every other record. The warning reached nobody, and the outreach
  it asks you to hold off on was one click away.

**And the app already had a place for it.** `js/09`'s "needs attention" filter tests
`needsManualConfirmation` — somebody meant this to work. No record's raw blob has ever held that key
(0 of 108, checked live), so that branch could never fire. Bridging the column makes the filter
start working on its own, and the flagged company now turns up where a person would look.

`js/02` reads the three columns (the column wins outright — the app never edits them, so a stale
copy in a raw blob must never outlive it, per **M26**). New layer **`js/86-where-this-came-from.js`**
adds the visible half: a quiet grey line saying where the record came from, and, when flagged, an
amber line with the reason **above** it, because that is the line that changes what a person does
next. It is read-only by construction — there is no way to clear the flag from a card, because
clearing it is a judgement about a real company. Verified against the live database: 81 bridged, the
warning on exactly one, silent on the 27 with neither.

Guarded by `scripts/qa/probe-a-record-says-where-it-came-from.mjs` — 8 checks, including that a
company with neither shows nothing, that nothing is written, and that the flagged company reaches
the attention filter while an identical unflagged one does not. Sabotage-verified twice. 3 gates
green, battery 266 entries; three neighbours re-run clean.

---

## Routine fire #150 (2026-09-21 ~06:30 UTC) — two buttons on the Sync page emptied it

Drove the Sync page live, in both languages. It is no longer an integration screen — it is a list of
where to go in Direct Payments, plus the three sources the team works in by hand. Two things were
wrong with it.

**Two chips blanked the page.** "Connected" and "Needs attention" are left over from the source grid
that used to be there. Nothing on this page carries a connection status, so both fell through to the
generic row-text filter — which hides a row unless its visible text contains the chip's own word —
and clicking either left **nothing but the table header, with no line saying why**. Both produced the
*same* empty table: two opposite filters agreeing. Same family as fire #104 (Airlines) and #105
(Bookings / Invoices / Tickets), missed by the chip probes because those check pages that have
records and this page has none. There was no filter to put back, so the strip is gone.

**The Arabic side was half English.** The area names were translated and nothing beside them was:
all nine "what lives there" lines, one area name nobody had added, and the page's own heading, which
read "Sync" while every other page's heading is Arabic. The six buttons said «مفتوحة» — "open" as a
*state* — because one dictionary serves the whole app and a ticket status claimed the word first.
Here it is an instruction: «فتح». Company and product names stay as they are.

Fixed in `js/core/core-09-v26.js` (the chips) and `js/21-…-transl.js` (the Arabic), guarded by
`scripts/qa/probe-the-sync-page-says-where-to-go.mjs` — 8 checks. The durable one clicks **every**
button on the page and requires the rows to survive each: it does not care what a future control is
called, only that nothing here can leave a person staring at an empty table. Sabotage-verified twice:
the chips back fails it and prints «"Connected" left 0 rows»; the dictionary lines out fails the
Arabic checks and prints «مفتوحة» back on the buttons. 3 gates green, battery 265 entries. Four chip
and Arabic neighbours re-run clean.

**Checked and clean, so nobody re-opens it:** the twelve `integrations` entries in `app_state` hold
only status placeholders — **no keys, tokens or passwords** anywhere in that blob, which every
signed-in account can read. Worth knowing: `v20TestConnection` still flips a source to "connected"
and logs "Connection test OK" without testing anything, but **no button on any screen calls it any
more**, so it is a dead function rather than a live lie. Left alone rather than quietly rewritten.

---

## Routine fire #149 (2026-09-21 ~05:30 UTC) — twenty clients showed "Payment terms —" over the answer

Fire #148 found one company whose CR/VAT was in the database and not on screen. This asked how far
that went, and counted it in the live table:

| On the company's own Corporate account card | In the database, not on screen |
|---|---|
| Payment terms | **20 companies** |
| Contract start **and** contract end | **19 companies each** |
| Credit limit | 8 |
| Entity type / CR·VAT / legal name | 1 each |

Same cause every time: `appToRow` **writes** these columns and `rowToApp` never **read them back**,
so anything that arrived by SQL or by the August import was invisible. Twenty of the app's 28
clients had a payment term on file and a dash on the card.

### Reading a column back has a trap, and it is half the fix

The writer only ever *set* those columns — it never cleared one. So the moment the reader prefers a
column, **a value you delete in the form comes back on the next reload**, because the column still
holds it. A field you cannot empty is worse than a field that was never shown. `appToRow` now writes
an explicit empty for a field somebody emptied, which is safe *because* the reader loads the column
first. Contract dates are the exception and are treated as one: the form takes free text, a date
column rejects anything that is not a date, and a rejected column fails the whole row's save — so
they are cleared, or written when they really are a date, and otherwise left alone.

Both halves in `js/02-…-shared-c.js`, guarded by
`scripts/qa/probe-the-card-shows-what-the-database-holds.mjs` — 8 checks, including that the raw
blob still wins where both disagree, and that clearing one field does not null its neighbours.
Sabotage-verified twice: taking the reader out fails checks 1 and 7, **and check 7 shows the save
wiping both contract dates** — which is exactly why the two halves belong in one change; putting the
old writer back fails 4 and 5, and check 5 prints the deleted value back on the card. New rule
**M26** in `docs/DECISIONS.md`. 3 gates green, battery 264 entries. probe-no-phantom-writes,
probe-lifecycle5 (67/67) and two others re-run clean.

**Full battery at the #145 tree finished while this ran: 247/247 green, no flaky re-runs.**

---

## Routine fire #148 (2026-09-21 ~04:30 UTC) — you could not find a client by the person you know

Drove the live Clients search. Three things a person would reach for could not find their client,
and one of them was worse than missing:

- **The contact person's name.** You can find a *lead* by the person's name — the Leads search reads
  its contacts. The Clients search did not. People remember the person, not the legal entity.
- **The Direct client ID** — the link key to Direct Payments, carried by 20 clients. Searching one
  returned **two matches and neither was the right company**: those digits happened to sit inside
  other records' phone numbers. A confidently wrong answer is worse than an empty one.
- **The CR / VAT number** — nothing at all.

There was also a **seam**: contacts' e-mail and phone were glued together with nothing between them,
so a search could match across the join of two different values and land on a record containing
neither. The parts are joined with spaces now.

### The CR / VAT miss had a deeper cause, and it was showing on the card

`cr_vat` and `legal_name` are **written** to their own columns and were **never read back**. A
company that received them any way other than by being typed into this app — a SQL update, an
import — showed **"Legal name / CR·VAT —"** on its own card, over a number the database was
holding. **One live company is in exactly that state today.** Same shape as the `assigned_to` /
`tier` / `segment` fallbacks already in that file; raw still wins, the column is only a fallback.

**Fixed** in `js/core/core-02-leads.js` (the haystack) and `js/02-…-shared-c.js` (the two column
fallbacks). Guarded by `scripts/qa/probe-you-can-find-a-client.mjs` — 8 checks, both languages,
including one that a term belonging to nobody still finds nobody, so the fix did not simply match
everything. Sabotage-verified twice against a copy of the app: the old haystack fails checks 1, 2, 3
and 7; removing the two fallbacks fails 3 and 4, and check 4 then prints the defect itself. 3 gates
green, battery now 263 entries. Four neighbouring probes re-run clean.

---

## Routine fire #147 (2026-09-21 ~03:00 UTC) — what the database keeps that no screen ever shows

The mirror of the #120/#121 audit ("a field the app PRINTS but no form can WRITE"). This asks the
other question: **what does the database hold that nothing in the app reads?** Read-only; nothing
changed.

**The Clients chips are correct, and the way one of them is correct is a trap worth knowing.**
"Key accounts: 2" matches the `tier` **column** exactly. "Reviews overdue: 3" matches too — but
**not from the column**:

- `next_review` **column**: set on **0 records**, client or lead. Empty everywhere.
- `raw->>'nextReview'`: set on **7 clients**, of which **3 are in the past** — exactly the 3 the
  chip shows.

**Nothing in `js/` mentions `next_review` at all.** The app keeps that fact in the record's `raw`,
and the column is dead weight. The chip is right; anyone who later writes a database-side report,
export or view against `next_review` will get **nothing** and have no idea why. Same family as the
documented `is_client` vs `raw.isClient` split. Recorded, not "fixed" — dropping a column is
destructive and pointless, and the app is consistent with itself.

**No data is hidden in the empty containers.** `airline_deals`, `prefs`, `pricing` and `channels`
are set on all 108 records and hold **`[]` / `{}` on every one** — a first pass counted them as
"columns with data", which they are not. Checked before writing it down.

### ⚠ One real gap — 81 companies carry provenance no screen shows

**`verification_source` is set on 81 of the 108 live companies**, and it is not a code — it reads:

> *"Contact-form submission, classified with the owner 2026-08-16"*

That is where the record came from **and** the fact that you vetted it. **Nothing in the app reads
it** — not by that name, not by any camelCase alias, not on the card, not in any list. The team is
working those 81 leads without being able to see that they were already classified with you.

This sits inside an ACTIVE rules area (DECISIONS → *Data provenance*), which is why it is raised
rather than filed away. It is **informational rather than harmful**, so I have not built a third new
surface this session on my own judgement: say the word and the line goes on the company card next to
where the lead came from, bilingual, read-only — a small change.

3 gates green. No code changed.

---

