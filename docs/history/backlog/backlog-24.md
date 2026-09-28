## Round 43 — who owns this client, and finding the ones nobody owns (2026-09-03)

Found by sweeping the **live data** rather than the code, after the owner asked for spotless in
every way, not just code and UI.

**The data finding, for Abdulrahman:** 20 of Direct's 28 live clients have **no account manager**.
Every one of them came from the corporate-client import of 21–23 August — the import created the
client records but nobody was ever assigned to them. That is a business decision (who owns which
client), so nothing was assigned here; a session must never invent an owner any more than it
invents a cost. The 20 also have no funnel, which is *not* a defect — funnels are a
lead-acquisition concept and these arrived as clients.

Two code defects behind it, both fixed:

1. **`rowToApp()` never read `assigned_to` or `account_manager` at all.** The one function that
   turns a database row into the object every screen reads took ownership only from the `raw` JSON
   blob. Measured live: all 88 owned records carry the name in *both* places, so nothing on screen
   was wrong today. The trap is anything that assigns ownership without going through the app — a
   SQL update, or an import exactly like the August one. It writes the column, `raw` stays empty,
   and the app shows "Unassigned" over a name sitting right there in the database. The raw blob
   still wins; the column is now a fallback for a row the app has never saved.
2. **The account-manager filter could not ask for the unowned.** It was built from the names
   actually present, with `.filter(Boolean)`, so the only way to find the 20 was to scroll and spot
   red "Unassigned" tags. It now offers "Unassigned (n)" — built bilingual at source, because
   js/21's translator matches an option's text exactly and "Unassigned (20)" is not the bare word
   its dictionary holds.

Also checked and found clean, so they are not defects: the `is_client` / `raw.isClient` split-brain
CLAUDE.md warns about is guarded by an OR on read (`(r.is_client===true)||base.isClient===true`), so
the one mismatched record reads as a client everywhere and the next save heals it; "Unassigned" is
already in the Arabic dictionary; both clients tables already flag it in red.

Guarded by `scripts/qa/probe-ownership-visible.mjs` (11 checks). Both fixes sabotage-verified
(column fallback → 4 red, `__none__` branch → 1 red), both files restored byte-identical.

## Round 42 — the funnel details card: Arabic that was already written, and a Save that deleted answers (2026-09-03)

Seven funnels are live and 91 leads carry answers, and **not one probe had ever rendered a single
funnel field**. The mock's only funnel was `{key:'default', field_template:[]}` and every seeded
lead had `funnel_id:null`, so the card never matched a lead and never drew. The same shape that hid
defects in rounds 19, 20, 33 and 41: an unseeded fixture is not a passing test, it is no test.

Driving it with a faithful fixture found three things, each confirmed by hand before the fix:

1. **The card and its editor were English-only.** Every funnel carries `name_ar` and every field in
   `field_template` carries `label_ar` — the Arabic was already written, sitting in the data — and
   the card printed `name_en` / `label_en` whatever the language, plus "Yes"/"No". 72 of the 91
   funnelled leads are Website Form — Entities, worked by BD staff in Arabic. Now the Arabic leads
   in Arabic, with the English as a quiet second line in the editor, and a template row with no
   Arabic yet falls back to its English label rather than to a blank.
2. **Pressing Save destroyed answers nobody saw.** The save built a fresh `{}` from the *current*
   template and assigned it over `funnelDetails`, so any stored key the template no longer lists was
   deleted — silently, by someone editing an unrelated field. Measured live the same day: **zero
   leads carry an orphan key right now**, so nothing has been lost yet. But templates get edited
   (past_invoices was built three weeks ago) and the importer writes `funnel_details` straight in.
   The save now starts from what is stored; clearing a box still clears that answer, deliberately.
3. **No guard on the editor.** `window.__editFunnelDetails` was callable by anyone and the Edit
   button was drawn for everyone, including a read-only share link — the same shape the oversight
   session had just fixed in Finance. Guarded at the function, not only the button.

Deliberately **not** changed: a `select:`'s option values stay English. They are stored values, not
labels; translating them would write Arabic into the data and break every filter that reads them —
the rule `probe-option-values-are-data` already holds.

Guarded by `scripts/qa/probe-funnel-details.mjs` (23 checks). All three fixes sabotage-verified
separately (Arabic → 3 red, preserve → 3 red, guard → 2 red), file restored byte-identical each
time. The shared mock's funnel now carries one field of every type the live funnels actually use,
with no lead attached, so the next session has something real to drive without shifting any count
another probe asserts.

# Action items — things deliberately put on hold

## 2026-09-03 (overnight) · Watch cycle 21 — the twelve-commit batch is live, and the 29k question has an answer

**The hand-off completed.** Watch cycles 9–20 went over as one patch series the moment Claude
Code's usage reset, were applied on top of `50eac86`, and are live. Nineteen probes re-run green
**against the merged tree**, including the corrected mock seed the other session landed in its own
round 38 — which matters, because several of these probes read that seed and a silent interaction
would have shown up here.

**FOR THE OWNER — the one invoice with costs waiting, and why it has not been applied.**
The other session flagged that 19 live invoices carry no recorded cost while the expense-capture
tables hold 223 lines, and that exactly one of the 19 has approved expenses waiting. Re-checked
independently against the live database, and the numbers agree: **one invoice, 14 approved expense
lines, 28,998.18 SAR**.

The reason it has not been applied is not a broken pipeline. **That invoice was billed at
26,536.00 SAR and the approved costs against it come to 28,998.18 SAR** — the costs exceed what
the client was charged. The importer refuses to write a cost larger than the invoice total and
says "needs review, not applied" instead. That guardrail is doing exactly its job: applying it
silently would turn a paid invoice into a loss on screen with nobody told.

So the question is a business one, not a technical one: either that booking really did cost more
than it billed, or some of those 14 lines belong to a different invoice. **It needs a person, and
the amounts are real money, so nothing here was changed.** (Numbers only — the client name stays
in the database, rule 7.)

**Flagged, not this lane:** `finance_cogs_expenses` is empty on the live database while the QA mock
seeds rows into it. `js/16` only mentions the table in a comment and never reads it; the tab that
does is `js/45-expenses`, outside the P4 finance lane, so this is recorded for that owner rather
than edited here. It is the same harness-vs-live shape that has produced a real finding four times
this watch — the mock exercising a populated case the live system does not have.

## 2026-09-03 (overnight) · Watch cycle 20 — mutation audit round two: four more guards that were not guarding

Cycle 17 ran this audit over the battery as it stood; everything added since (cycles 13–19) had
never been through it. Eight fresh mutations, each breaking one rule a probe claims to guard, run
against the probes that should catch them, each reverted byte-identically (md5).

**Four were caught** — the sector classifier's profile-first order, the date-less hold-back, the
credit-note status for a negative total, and the mock's unique key.

**Four were not:**

1. **30 February.** `isoDateG`'s calendar-day check, added in cycle 16, was never tested — no
   fixture anywhere contained a date that looks valid and is not. Removing the check changed
   nothing visible. A row now carries `2026-02-30` and must be named and held back.
2. **Two of the three branches of the "nothing happened" message.** Cycle 15 gave that message
   three honest answers — the row is gone, it is already in that state, or the write was genuinely
   refused — and only the middle one was ever exercised. Making the "row is gone" branch blame
   permissions again was invisible. A delete of an invoice number that is not in the table is now
   a check of its own.
3. **The Ledger's unreadable-amount notice.** Silencing it entirely was caught by nothing, because
   after cycle 19 the fixture's only awkward amount ("1,250") parses correctly and no row was left
   flagged. A notice with nothing to report is not a guard. The fixture now carries an amount that
   is not a number in any reading ("n/a").
4. **The harness's own honesty.** If the mock stopped enforcing the live NOT NULLs and CHECK
   constraints, every write-path probe would silently start testing nothing — and no probe would
   notice. There is now a guard on the guard: an ordinary invoice must be **accepted**, and a null
   date, a negative total that is not a credit note, and a duplicate `(invoice_no, line_no)` must
   each be **refused**.

**And that guard was itself wrong on the first attempt** — worth recording, because it is the same
trap twice in one cycle. The rows it posted carried `year`, which the mock refuses outright as a
generated column, so all three were rejected for a reason that had nothing to do with the
constraints and the check passed with the enforcement switched off. The positive control — a valid
row must be accepted — is what makes the three refusals mean anything. **Any check that only ever
asserts "this was refused" passes trivially the moment everything is refused.**

All four re-run red against their mutation and green with it reverted. Twenty-two probes and the
structure check green.

**Environmental, not chased:** `audit-finance-tabs` failed one check when run last in a
back-to-back batch of twenty-two and passes on its own — the same sandbox resource pressure noted
in cycle 17.

## 2026-09-03 (overnight) · Watch cycle 19 — the three parked items, cleared

Three things earlier cycles noticed and deliberately did not change. All three are done, and each
was sabotage-verified.

**1. The same amount read two different ways on one page** (parked in watch cycle 4). Every Ledger
total read `+r.amount_sar||0`. A row whose amount arrives as a formatted string — "1,250.00" —
makes that NaN, and `||0` turns it into a clean **zero**. The Performance tab has sanitised the
same string into 1250 since watch cycle 2, so one page was reading one amount two different ways,
and neither tab said which was right. The Ledger now reads every amount through its own chokepoint
(`txnLive()`), repairs what is repairable, and — like the Overview — **says how many rows carried
an amount it could not read** instead of quietly counting them as nothing. **The probe was
defending the disagreement:** `probe-ledger-attacks` recounted with the same `Number(x)||0` rule
and asserted that the silent zero was correct. Corrected, with the reason written in.

**2. Two rows with the same transaction reference, and nothing said so** (parked in watch cycle 4).
Direct Payments' export has produced repeated references before, and both copies were being
counted. This does **not** deduplicate — picking a winner would be inventing an answer — it marks
each row ("2× same ref") and says once above the table that N references appear on more than one
row and every copy is counted, so the person can check them at the source.

**3. Two people setting the same year's target** (measured in watch cycle 15). It was
last-write-wins with no notice: a number one person typed could be replaced by another's and
neither would ever know. `finSetTargets` now reads the stored row first and, if it has moved since
this screen loaded it, shows the stored numbers and who set them and asks before overwriting. A
warning, not a lock — a lock on one yearly figure would cost more than it saves.

**Found while fixing 3, in this cycle's own new code:** if that courtesy read *failed*, the promise
chain had nowhere to go and `finSetTargets` silently did nothing at all — the exact silent-failure
shape this watch exists to remove, introduced and caught inside one cycle. A failed pre-read now
proceeds to the write, which has its own row-count check.

**Also fixed, in a probe rather than the app:** `probe-finance-arabic-attacks`' direction-isolation
scan looked only at leaf elements, and the shape it hunts does not live in a leaf — a tile renders
`174.6K <span>SAR</span>`, so the leaf with the number has no currency word and the leaf with the
currency word has no number. It found nothing at all, and **its own "this check proved nothing"
guard caught that instead of passing silently** — the guard added in cycle 11 doing its job. It now
examines the smallest element containing both parts, which is the one whose bidi run actually
decides the order: five such amounts, all isolated. No app defect either way.

**Sabotage-verified three times, file-level** (raw amount reads back → 3 red; no duplicate index →
2 red; overwrite a moved target silently → 1 red), each restored byte-identical (md5). Twenty-two
probes and the structure check green.

## 2026-09-03 (overnight) · Watch cycle 18 — five tender invoices were being reported as ordinary B2B

**Attack area: which field decides a sector.** Raised in cycles 2, 3 and 7 and left for a ruling
each time. It is not a business decision — it is a wrong key — so this cycle measured it against
the live database and fixed it.

**Measured, live, 3 Sep** (counts only; no company names in this repo, rule 7):
- 36 client profiles exist; **6 carry the explicit `profile_type = 'tender'`**, and all six have a
  business record.
- **4 of those 6 have invoices — 9 invoices in total belong to tender clients.**
- The rule in force matched the word "tender" against a client's **free-text payment terms**, and
  called only **4 of those 9** a tender.
- **So five real tender invoices were being counted as ordinary B2B.**
- Nothing goes the other way: no client whose payment terms mention a tender has a profile saying
  it is something else. Only 2 of 21 businesses with payment terms mention one at all.

**Fixed:** `finSectorOf()` now prefers `client_profiles.profile_type` when a live profile exists
for that client, and keeps the free-text match **only** as a fallback where no profile exists — so
nothing that used to be classified stops being classified. An archived or closed profile decides
nothing. A new `finSectorBasis()` reports which of the two answered, so the page can say so
instead of mixing them silently. The profile index is loaded in `finLoad()` (a small paged read)
and refreshed by `txnLoad()`, so the sector key is available before anyone opens the Ledger —
previously the profiles were only fetched by the Ledger tab.

**New probe `probe-sector-key-attacks.mjs`** (port 8221, 11 checks) seeds all four combinations —
profile says tender / terms say tender / both / neither — plus an archived profile and a School
Commission line, and proves: the explicit field wins both ways, the fallback still works, an
archived profile decides nothing, the three chips add up to the unfiltered total with nothing lost
or double-counted, and the Tenders chip totals exactly the clients that really are tenders.

**Sabotage-verified twice, file-level:** putting the payment-terms match back in front turns 3
checks red (including the Tenders total); letting archived profiles decide turns 2 red. Restores
byte-identical (md5). Twenty-two probes and the structure check green.

**For the owner — what changes on screen:** the Tenders chip will now include the tender clients
whose payment-terms text never said so. On today's data that moves five invoices out of B2B and
into Tenders. If any of those six clients is *not* really a tender client, the fix is to correct
its profile in Direct Payments — which is the right place for it — rather than to reword its
payment terms.

## 2026-09-03 (overnight) · Watch cycle 17 — a mutation audit of the safety net itself: does each check actually bite?

**Attack area: the probes, not the app.** Cycle 15 found that the cycle-12 probe's "all ten write
paths" check could never have failed. That raised the obvious question: how many other checks in
this battery are decoration? Ten deliberate mutations were made to the lane's own code — each one
breaking a single rule some probe claims to guard — and the probes were run against every one.
Every mutation was reverted byte-identically (md5) before the next.

**Eight of ten were caught immediately**, by the probe you would expect: the standing exclusion no
longer applying, unverified invoices counting as revenue, unreadable amounts poisoning the sums
again, an invoiced-and-overdue transaction hiding again, the targets editor rewriting what you
type, every write path answering "yes", a paged read stopping after one page, and date-less money
being aged as 0–30 days. Those eight guards are real.

**Two were not, and both concern money.**

1. **"Deleted means gone from the totals" was guarded by exactly one probe.** Breaking the filter
   that keeps soft-deleted invoices out of every total was caught by the 5,200-row scale probe —
   and by **none** of the five probes whose subject is closest to it (deleted-invoice, ledger,
   importer, clients, hostile shapes). One probe, and the slowest one in the battery, standing
   between the owner and deleted invoices silently rejoining his revenue. **Worth recording
   honestly:** the first run said "no probe catches this at all"; widening the set before writing
   it down proved that wrong. A finding is not finished until it has been attacked too.
2. **Nothing checked that a Report Builder column holds what its header says.** Relabelling the
   profit column "Revenue" was caught by nothing at all; summing revenue *into* the profit column
   was caught by one probe. The Report Builder is where a manager reads margins.

**Fixed, in the probes:** `probe-hostile-shapes-attacks` gains a soft-deleted 555,555 invoice and
three checks (no tile, no count, no export line carries it), and its Report Builder pass now
verifies the cost and profit columns against the same independent recount and asserts the headers
read Revenue · Cost · Profit in that order. All three previously-blind mutations now go red, and
the whole battery is green with them reverted. The deleted-row rule is now guarded by a probe that
runs in a second rather than only by the one that takes a minute and a half.

**Environmental, not a defect:** `audit-finance-tabs` failed one check when run twenty-first in a
back-to-back batch and passes on its own — resource pressure in the sandbox, classified and not
chased.

**Method worth keeping.** `/tmp/mutations.py` + `/tmp/mutate.py` (a mutation, the probes that
should catch it, an assert that the file is restored byte-identical) is a cheap way to ask a test
suite whether it is doing anything. It found two blind spots in a battery of twenty-one probes
that were all passing.

## 2026-09-03 (overnight) · Watch cycle 16 — one bad date in a file destroyed the whole import, and a negative total did the same

**Attack area: hostile shapes the live SCHEMA permits**, new
`scripts/qa/probe-hostile-shapes-attacks.mjs` (port 8219, 22 checks), plus a correction to
`probe-importer-attacks` that had been asserting something production forbids.

**Harness honesty first, and it paid immediately.** The live table's rules were read from
`information_schema` and `pg_constraint` on the real database this cycle: `invoice_no`,
`client_group` and `invoice_date` are **NOT NULL with no default**; `line_no` is NOT NULL default 1
and the unique key is `(invoice_no, line_no)`; `fin_nonneg_chk` permits a negative total **only**
when `integrity_status = 'credit_note'`; `fin_wallet_le_total_chk`, `fin_quarter_chk`,
`fin_rectype_chk`, `fin_status_chk` and the origin/revenue-way checks bound the rest. The mock
enforced **none** of it. It does now (rejections in PostgREST's own 23502 / 22007 / 22008 / 23514
shapes, on the REST insert path and the commit RPC, atomically). The existing importer probe went
red the moment it was honest.

**Real gap 1 — one unreadable date lost the entire file.** A file row whose date column is blank
or unparseable produced `invoice_date: null`. The database refuses it, and because PostgREST sends
a batch as ONE statement, that single row loses **every** row in the file: the preview promised
"4 new" and the commit reported "0 new". This is the exact shape of the incident the owner already
lived through once (27 intended, 0 written, caused by the generated `year` column). Such rows are
now named and held back like a deleted invoice — "no readable invoice date … the rest of the file
still imports" — so the good rows land and the person can see which line to fix.

**Real gap 2 — a negative total was sent as a "pending" invoice**, which `fin_nonneg_chk` refuses,
losing the whole batch the same way. A negative total *is* a credit note; it is now stored as one,
with nothing outstanding (that constraint forbids a negative `amount_remaining_sar` too).

**Real gap 3 — an impossible date got through the parser.** `isoDateG` accepted day 31 for every
month, so `2026-02-30` became a string that looks like a date and the database rejected the batch.
It now checks the real calendar day.

**Real gap 4 — a whitespace-only client name showed a row of real money with no owner.**
`client_group` is NOT NULL, but `"   "` satisfies that, and only the exact empty string fell back
to the em-dash placeholder. Trimmed now; the link lookup still uses the raw value, since a link may
legitimately be keyed on the name exactly as Direct Payments typed it.

**An earlier probe was asserting the impossible.** `probe-importer-attacks` checked that a
date-less row "landed with a null date and no month/quarter". It cannot land at all in production.
That expectation was written against a mock that accepted anything, and it was defending the very
behaviour that destroyed the batch. Corrected, with the reason written into the probe.

**Held under attack** (no defect): a four-line tax invoice counts as ONE invoice on both counters —
the header strip and the Invoices tile are separate code and both were checked, because sabotaging
one passed while the other was being read; its money is summed once per line and once only; a
ten-year span 2016–2028 scopes correctly and every year appears in the period bar; a future year
holding only an unpaid invoice shows no verified revenue rather than inventing one; zero, 0.005 and
9,876,543.21 all render without NaN or Infinity; an invoice paid entirely from the client wallet
contributes exactly zero revenue; a credit note stays out of the verified total but stays in the
export; a 400-character client name does not break the table; all four Report Builder groupings
agree on one grand total; and the invoice export carries every service line with no bad cell.

**Sabotage-verified four times, file-level**, each red, each restored byte-identical (md5).
Twenty-one probes and the structure check green.

**For the owner, no change made:** today's 46 live invoices are all single-line, single-status, no
wallet, no negatives, no future dates — so none of this is visible yet. It becomes visible with the
653-invoice backfill, where multi-line invoices are the norm.

## 2026-09-03 (overnight) · Watch cycle 15 — two people, two tabs: the app blamed the wrong thing, and one restore had no lock at all

**Attack area: concurrency**, new `scripts/qa/probe-concurrency-attacks.mjs` (port 8217,
17 checks). Two independent browser sessions against one database, every check diffing the whole
table before and after.

**Real gap 1 — the app gave a reason it did not know.** When a delete or restore matched zero
rows, all four paths said the same thing: *"your account was not allowed to."* Zero rows can mean
three different things, and on a team the usual one is the third: a colleague (or your own other
tab) already did it and your screen is out of date. Telling that person it is a permission problem
sends them to ask for rights they already have, and leaves them believing the invoice is still
there. Rule M8 applies to explanations as much as to numbers. A new `finZeroRowMsg()` asks the
database which of the three it actually is — the row is gone, the row is already in that state, or
the write was genuinely refused — says so plainly in both languages, and on a race reloads so the
screen stops showing something that is no longer true.

**Real gap 2 — `finRestore(id)` had no permission check at all**, and `finDel(id)` still used
`canFinEdit()`, the wrapper cycle 12 showed can answer "yes" inside a share view. Cycle 12 guarded
the by-invoice-number pair and missed the by-id pair. Worse, and worth writing down: **the cycle-12
probe claimed to cover "all ten write paths" and did not catch this**, because it called Restore on
a LIVE invoice — where `deleted_at` goes from null to null and the table is unchanged whatever the
guard does. A check that cannot fail is not a check. Pointed at an actually-deleted invoice, a
viewer restored it. Both paths now use `finCanWrite()`.

**Held under attack.** Two admins editing different invoices at the same moment: both writes land,
neither touches the other row. Two admins editing the same invoice in different fields: both
fields survive. Both tabs arming the SAME 25-row import and both pressing Confirm: exactly one copy
of each invoice number ends up in the table, and the second tab is told its import failed and
nothing landed, with the database's own reason. Two tabs setting the same year's target leave one
row, not two.

**Harness honesty, again.** The live table carries `UNIQUE (invoice_no, line_no)`
(`finance_invoices_invoice_line_key`, read from `pg_constraint` on the real database this cycle).
The mock enforced nothing, so two sessions could both insert the same invoice number here and the
harness would call it fine — while production rejects the second write and rolls the whole batch
back. Now mirrored, returning PostgREST's own 23505 shape, on both the REST insert path and the
`fn_commit_finance_import` RPC (atomic: a clash anywhere writes nothing).

**Sabotage-verified twice, file-level:** putting the flat permission message back turns 2 checks
red; dropping the guard from `finRestore` turns 1 red. Restores byte-identical (md5). Twenty-one
probes and the structure check green.

**Measured, not changed:** two tabs setting the same target is last-write-wins with no notice to
the first person. One row, no corruption, and the number is a single deliberate figure someone
types — so this is recorded as known behaviour rather than fixed blind. Say the word if you want
the second person warned that someone changed it while their screen was open.

## 2026-09-03 (overnight) · Watch cycle 14 — the importer driven at scale: no defect found, kept as a guard

**Attack area: the import flow against a large existing table**, new
`scripts/qa/probe-importer-scale-attacks.mjs` (port 8215, 18 checks). A 3,000-row file dropped
onto 5,201 existing invoices and 1,503 expense-capture lines, through the app's **own** ingest
entry point and its **own** Confirm button — nothing poked into state. **No defect found**, so the
probe stays as the permanent guard for the one screen where a wrong count means real money
written or silently not written.

**Held under attack.** The preview reads New 1,000 · Updated 800 · Unchanged 1,177 · Excluded 23,
each one an independent recount, and it arrives in **1.6 seconds** against 5,201 existing
invoices. Confirm inserts exactly 1,000 rows — no duplicate, no excluded-client row, no deleted
row resurrected — while a genuinely changed invoice still updates. Dropping the **same file
again** is a real no-op (New 0 · Updated 0 · Unchanged 2,977) with the index now built over 6,201
rows: cycle 5's idempotency finding holds at fifty times the size. All three invoices deleted in
this app are named in the preview and held back, so cycle 10's guard still finds them in an index
that large. A binary file is still refused in words. And cycle 12's permission guard holds where
it matters most: a 300-row preview armed as an admin, then confirmed after the role drops to
viewer, writes nothing.

**Cycle 13's paging fix, now proved end to end.** The join reads all **1,500** baseline
expense-line transactions from the capture table (it stopped at 1,000 before), and a transaction
whose lines sit past that boundary resolves its cost onto the invoice through the real flow.
**Sabotage-verified twice, file-level:** reverting the two capture reads in `js/65` to plain
unpaged selects turns both of those checks red (the join drops to 1,000 and the cost never
arrives); letting `initState()` index deleted rows again turns three red, including a deleted
invoice being written with 99,999 while still deleted — cycle 10's exact defect, reproduced.
Restores byte-identical (md5). Nineteen probes and the structure check green.

**Worth recording, because it is the same mistake one level up:** the probe's own verification
reads counted 1,000 rows in a 6,201-row table, because they too asked the API for everything and
took what came back. The checker made the error it was written to catch. Every out-of-page count
in this probe pages now.

**Also noticed, working as intended, not changed:** the cost join refuses to apply an approved
cost that exceeds the invoice total ("needs review, not applied") — the first fixture tripped it
with a 1,500 cost on a 1,091 invoice, which is the guardrail doing its job, not a defect.

## 2026-09-03 (overnight) · Watch cycle 13 — past 1,000 rows the Ledger showed the first 1,000 and called it the total

**Attack area: scale**, new `scripts/qa/probe-scale-attacks.mjs` (port 8213, 38 checks) — 5,200
invoices, 5,200 transactions, 1,200 client profiles, 1,500 expense-capture lines, 120 billing
names (12 of them alias twins), through every Finance tab and both exports, with every headline
number recounted independently from the fixture rather than read back off the screen.

**The harness was blind first, and the fix to it is half the finding.** The API returns at most
1,000 rows per request and says so only in a `Content-Range` header. The mock ignored the paging
the client sends (postgrest-js expresses `.range()` as `offset=` + `limit=` query params) and
handed back the whole table in one response — so a read that pages and a read that does not
looked *identical* here, and no probe written since August could ever have told them apart. Worse,
with more than 1,000 rows seeded the mock would have hung any correctly-paging client for ever,
because every page came back as page one. The mock now honours `offset`/`limit` (and a `Range`
header, for a hand-written fetch), applies every `.order()` the client sent instead of only the
first, and enforces the same 1,000-row ceiling Supabase does.

**Real gap — six reads in this lane never paged.** `finLoad()` has paged since August; nothing
else did. The one that matters is `txnLoad()`: past 1,000 transactions the Ledger silently showed
the first 1,000 and computed its confirmed revenue, cost, outstanding and **Overdue count** from
them — in the fixture, 3.4M of confirmed revenue rendered as 628K and 99 overdue transactions
rendered as 18, with nothing on screen admitting a short list. `finance_transactions` grows faster
than invoices (one invoice can carry many), so this was a question of when, not if. `client_profiles`
had the same shape — every transaction past the cut loses its company and profile type and falls
out of the profile filter. So did `finance_client_links`, `finance_targets`, `promo_codes`, and
the two expense-capture tables in `js/65` — where a truncation would drop *recorded costs*, report
the invoices as "an import gap", and leave their profit reading as if the cost were zero (M1/M8).

**Fix:** one shared `finPageAll()` in `js/16`, used by every read in the lane including `finLoad`'s
own loop, with a local fallback in `js/65` so that file still works if the load order changes.
Each paged read also carries a stable tie-break column now.

**Held under attack at 5,200 rows:** Performance, Clients & collections, Ledger and Report Builder
all render in about a second; every tile equals an independent recount; the Top-clients total is
labelled "all 108 clients, top 10 shown" and the twelve alias twins fold onto their base client;
outstanding money splits across the ageing buckets with nothing lost and the date-less money stays
in its own bucket; all four Report Builder groupings agree on the same grand total and keep
profit = revenue − cost; both CSVs carry every row on screen with a BOM; and a standing exclusion
plus a soft-deleted row placed past the fifth page boundary still reach no total.

**Sabotage-verified:** reverting `txnLoad()`'s two reads to plain unpaged selects turns 4 checks
red; restore byte-identical (md5). Nineteen probes and the structure check green afterwards.

**Said plainly, not guarded:** removing the `.order('id')` tie-break from a paged read changes
nothing in this harness, because the mock's sort keeps identical dates in the same order on every
request. A real database need not. An unstable sort across page boundaries can show a row twice
or not at all — the tie-break stays in the code on principle, not because a check would catch its
removal.

**Not changed, deliberately:** `business_merges` in `js/62` asks for `.limit(50)` and gets 50 —
a visible, intended cap on a "last 50 merges" list, not a silent truncation. Left alone.

## 2026-09-02 (overnight) · Watch cycle 12 — a read-only share link could write in Finance; five write paths had no guard of their own

**Attack area: permissions and the share view**, new `scripts/qa/probe-permissions-attacks.mjs`
(port 8211, 34 checks). It drives viewer / team member / BD / operations and a share view, checks
what is OFFERED, then calls **all ten** Finance write paths directly and diffs five database
tables byte for byte.

**Real gap 1 — a share view could write.** `js/52-v76-access-model.js` REPLACES
`window.canFinEdit` with a wrapper that returns `true` outright for an admin — and that wrapper
**dropped the `!window.__isShareView` half** of the original rule in `js/16`. A read-only share
link opened in an admin's session therefore came back as "may edit": the probe merged two
companies and reloaded the page from a share view before the fix. The wrapper governs every page,
so it is **reported, not rewritten** (see the ruling item below); instead every Finance write now
goes through a small local `finCanWrite()` in `js/16` that re-applies the share-view half no
matter which `canFinEdit` is in force, and `js/25`, `js/62` and `js/65` defer to it.

**Real gap 2 — five write paths had no permission check of their own.** `finDelInv` guarded
itself; `finSetOrigin`, `finSetWay`, `finRestoreInv` and `v65Commit` did not (and `finSetTargets`
only got one in cycle 9). Their buttons are hidden for a non-editor, but a stale tab, a role
changed while it was open, or a share view leaves the functions one call away — and `v65Commit`
writes a whole import batch. All now guard with `finCanWrite()`. The probe proves it the way it
actually happens: an **admin builds an import preview and stops**, then the tier changes and
Confirm is pressed — with the guard removed, that batch lands.

**Held:** every tier is offered no targets editor, no Import tab, no Delete/Restore and no
revenue-way/origin editor; reaching Import directly is refused in words; a share view is refused
Finance outright; all ten calls leave every table byte-identical and nothing throws; and an admin
can still set a target and restore an invoice (the guards do not break real work).

**Sabotage-verified twice** (drop the share-view half of `finCanWrite` → 2 red; remove the
`v65Commit` guard → the armed batch lands and 2 checks go red). Restores byte-identical (md5),
structure check and sixteen probes green.

**FOR THE OWNER — a ruling, not a change:** `mayEditPage()` in `js/52` ends with
`return true; // matrix not loaded yet — the old behaviour`. Until the per-person access matrix
arrives, **every signed-in person is treated as an editor of every page**. The database still
refuses the write (and since this watch every editor says "Not saved — the database refused"),
so money is safe; what a viewer gets in that window is buttons that look like they work. Fail
open or fail closed is your call, and it touches every page, so it was not changed here. The
same cycle also corrected `probe-targets-attacks`: simulating a viewer by setting only
`window.__userTier` proves nothing, because the check reads `__userRole` and `__pageAccess` too.

