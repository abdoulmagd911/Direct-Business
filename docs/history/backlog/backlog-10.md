## Routine fire #133 (2026-09-20 ~11:00 UTC) — a payment proof's address worked for anyone, for ever, with no sign-in

**Fixed, in the app and on the live database, verified both ways.** The two buckets holding
documents for real money — `payment-proofs` (proof a client paid) and `expenses` (receipts) — were
marked **public** *and* carried a read policy with **no condition at all** (`bucket_id = 'expenses'`).
Measured rather than assumed: an anonymous list call, carrying only the publishable key that ships
inside the app's own page, returned **HTTP 200 on both**, so a file's address did not even have to
be guessed.

**Nothing real was exposed** — and that is the honest framing, not a softener. Every file in both
buckets today is a **zero-byte placeholder** (16 in `proposals`, 1 in `payment-proofs`, 2 in
`expenses`, all downloading as 0 bytes), and the 7 MB of real company documents lives in
`company-docs`, which was already private and returned nothing to the same caller. The door was
simply standing open in front of a feature that is about to hold receipts for real money.

**The app already knew the right answer.** `js/66-document-generator.js`, written later, keeps
`company-docs` private and hands out `createSignedUrl(path, 600)` — a link that dies in ten minutes
— and says so in its own comment. `js/45` and `js/57` now do exactly the same, and both buckets
match `company-docs` (private, `app_role() IS NOT NULL` on read).

**Order mattered and was deliberate:** the code changed *before* the buckets did, so there was never
a moment when the app could not open its own files. One subtlety kept in the code: a signed link is
*fetched*, not computed, so `proofPreview` opens its tab inside the click and fills it in when the
link arrives — a browser blocks a window opened from an async callback.

**Verified afterwards, both directions:** the anonymous list now returns **0 entries** on both
buckets, and a signed-in employee can still list, sign and fetch from `payment-proofs`, `expenses`
**and** `company-docs` — HTTP 200 in all three, driven live.

**Gated:** `check-structure` now refuses `getPublicUrl` on any of those three buckets — the half
that could silently come back the moment somebody writes that one call. Sabotage-verified by putting
the public URL back in a copy. New rule **DECISIONS M21**.

**Deliberately NOT touched — for the owner to decide:** the `proposals` bucket is still public. Its
public address is **stored inside the offer record** (`o.fileUrl`), and a proposal is a client-facing
document that may be meant to open from a link. Making it private would break every stored address
and change how proposals are shared, so it is a design decision, not a QA fix. Nothing is at risk
today: all 16 files there are zero-byte placeholders and the workspace holds **0 offers**.

3 gates green (40 ACTIVE rules, 140 citations). Commit 96a66ab, confirmed live.

---

## Routine fire #132 (2026-09-20 ~10:00 UTC) — who can destroy what, and what comes back

Read-only follow-on to #131, and the point of it is the distinction the owner asked for: what is
actually broken versus what only sounds alarming. **Nothing needed changing.**

**Every real-data table names the roles allowed to delete from it** — businesses and contacts
(admin, manager, bd, team_member), activities (+ operations), sops/slas/airlines/providers (their
own lists), finance_invoices and finance_client_links (`can_edit_page('finance')`), app_users
(admin only), share_links (admin only).

**One table is the exception: `ksa_events`.** Its rule is simply `true`, so at the database level any
signed-in account — including a read-only viewer — could delete all **80 real events** (the team's
plan: 25 undecided, 27 attend, 12 stand, 13 mine, 3 skip). The app's own screens gate this, but the
database does not.

**It is recoverable, which is what decides how urgent it is.** `ksa_events` carries its own audit
trigger (`trg_ksa_events_audit` → `log_ksa_events_audit()`) writing **the whole row** into
`ksa_events_audit` on every insert, update and delete — **139 rows there today**, one of them a
recorded delete. So an accidental wipe is undoable from the database:

```sql
insert into ksa_events select * from jsonb_populate_record(null::ksa_events, old_data)
from ksa_events_audit where operation = 'DELETE' and changed_at > '<the moment it happened>';
```

Two honest caveats, recorded rather than acted on: the app's own undo screen reads `record_history`,
which events do not write to, so the recovery above is a database job, not a button; and the audit
table's own policy is `true` as well, so a *deliberate* wipe could take the trail with it. Against
the real threat here — somebody's accident on an internal tool used by eleven known colleagues —
the trail survives, so this stays a recorded note, not a change. **Deliberately not "fixed":**
tightening that policy is exactly the kind of edit that can lock the Events editor out for everyone,
and fire #122 declined the same class of change for the same reason.

Also swept: only businesses, contacts and finance_invoices have a `record_history` trigger, so the
app's undo covers those three and nothing else. Recorded so it is not mistaken for wider coverage.

3 gates green. No code and no database change this round — the one change that was needed was made
in #131.

---

## Routine fire #131 (2026-09-20 ~09:00 UTC) — a full workspace snapshot was readable with no sign-in at all

**Fixed on the live database, verified before and after.** Two leftover tables from a 2026-09-09
clean-up — `app_state_backup_20260909` (a full workspace snapshot) and
`app_settings_backup_20260909` — were the **only** tables in the public schema with row-level
security switched off. Proven rather than assumed: a plain request carrying the publishable key
**that ships inside the app's own page** — no sign-in, no password — returned both rows, while the
same request against `businesses`, `finance_invoices` and `ksa_events` returned nothing at all.

Every one of their **23 sibling snapshot tables** was already set up correctly (RLS on, no policies,
so only the service role and the dashboard can read them). These two were an oversight at the moment
they were created. Supabase's own security advisor flags exactly these two, at ERROR level.

Both now match their siblings. Re-tested with the same unauthenticated request: **0 rows**. The
backups themselves are untouched and still hold their row, and the app's own tables behave exactly
as before. Nothing in the app, the probes or the docs ever referred to either table, so nothing can
break; one statement reverses it if ever needed.

This is **not** the public-repo question standing rule 7 settles, and not the accepted in-app
exposure of standing rule 5 — both of those are about data behind a login. This was real company
data readable by anyone, with no login at all, which is squarely inside the "flag it if it could
destroy real data" carve-out.

**New rule, DECISIONS M20:** any table created outside a migration — a snapshot, a "just in case"
backup, a scratch table — gets `enable row level security` in the same statement that creates it.
And since **no probe in this battery can see the live database's settings**, the check that catches
this is the security advisor: read it during a sweep, the way check-structure is read before a
deploy. 250 green probes could not have found this.

**Also checked, read-only, and clean — the money doctrine end to end:**
- The trigger is still there and still right: `trg_fin_inv_derive` → `finance_derive_fields()`,
  enabled, deriving revenue = total − wallet and profit = revenue − cost, and **never touching VAT**.
- It cannot be side-stepped by a NULL: every money column feeding it is NOT NULL DEFAULT 0.
- All **46 live rows obey it** — 0 breaking revenue, 0 breaking profit, 0 with a cost above revenue,
  and **no row stores VAT at all**.
- The cost-gap wording is honest: "some invoices carry no recorded cost", "profit is a maximum, not
  a final number", "the margin may look higher than it is until their expenses arrive".

**One structural note, verified harmless today.** `cost_sar` is NOT NULL DEFAULT 0, so the column
**cannot express "unknown"** — the app has to read a zero as "not yet known", which is how the 19-gap
flag works. Checked: all 19 are ordinary B2B invoices via the invoice route, none of the routes
(promo code, commission) where a genuine zero cost would be expected. So the flag is correct on
today's data. The day a genuinely zero-cost invoice arrives it will be counted as an unknown gap —
recorded, not churned, because nothing can reach it now.

3 gates green (39 ACTIVE rules, 136 citations). No app code changed, so nothing to verify on the
live site.

---

## Routine fire #130 (2026-09-20 ~07:00 UTC) — cancelled money could have entered cost with every check still green

Two things this round, one a guard and one a fact the owner should have.

**The guard.** The live expense capture holds three statuses: **183 Approved lines, 24 Cancelled and
16 Pending.** js/65 counts Approved only — `status.toLowerCase()!=='approved'` — which is right. But
the probe guarding it only ever proved **Pending** is excluded. Rewrite that allow-list as a
blacklist of "pending" and real **cancelled money (9,408.25 SAR in the live data)** walks into cost,
with the whole battery still green. Not argued — **measured**: the identical sabotage passes with
yesterday's probe and fails with today's. The fixture now carries a Cancelled and an Under Review
line on a transaction that already lands on an invoice whose cost must stay 2000, and the failure
message names what each wrong total would mean (2300 = Pending counted, 2400 = Cancelled, 2600 =
Under Review, 3300 = everything). js/65 is the oversight lane — read and tested, never edited.

**Checked and clean, against the real database, nothing written:**
- **No live invoice's cost includes cancelled or pending money** — 0 of the 40 invoices matched to
  the capture, and 35 of those 40 match the approved-only sum to the halala.
- **Finance does not show an empty month as a computed zero.** The newest invoice is 2026-08-20 and
  today is 2026-09-20, so "this month" is empty — the page opens on **all years** and says
  "46 invoices · data through 2026-08-20". The month list only offers the months the data has.
- **Today's "✓ No overdue invoices" is true** — every one of the 46 live invoices is fully collected
  (outstanding 0.00).
- **The Brand entry in the sidebar is not broken.** An empty-state sweep flagged it because clicking
  it leaves the page where it was; it opens `/brand/` in a new tab, which is a real page served from
  this repo (200, the Direct Brand Hub). Instrument, not defect — recorded so it is not chased again.
- SOPs & SLAs renders 12 SOPs and 14 SLAs as cards rather than table rows; Operations shows "—" per
  column because requests, offers, bookings, invoices and projects all hold **zero rows**.

### ⚠ For the owner — 305,128.81 SAR of approved cost is captured but carried by no invoice

Read out of the database, not guessed. The expense capture (one import batch, 2026-08-25) holds
approved cost that never reached an invoice:

- **276,130.63 SAR against four invoice numbers this app has never imported.** They exist in Direct
  Payments' export and have real cost behind them; `finance_invoices` has no row for them. The
  importer reports this rather than inventing an invoice — correct, and the same invoice-import gap
  first noted on 2026-08-24 (three then, four now).
- **28,998.18 SAR against one live invoice whose cost still reads zero** — one of the 19 honest
  "no cost recorded" gaps that stand for 43.6% of the stated profit. Its single transaction is
  clean by the importer's own rules (blank status = issued, lines present, no malformed amounts), so
  this one looks closable from data **already in the database** — the cost only lands during a
  confirmed import run, and nothing has been imported since 2026-08-25.

Nothing was written. The next import of the transaction-status and expense-line files should close
the 28,998.18; the four missing invoices need their tax invoices imported first.

3 gates green. Commit 3de9986 (probe only — no app change, so nothing to verify on the live site).

---

## Routine fire #129 (2026-09-20 ~05:00 UTC) — a comment about a different box satisfied the gate

Fire #127 named ten files that build a full-screen box of their own and #128 closed all but two.
This round measured those two, live against the real database, in both languages. **Both were losing
the keyboard, and one of them had no keyboard way out at all.**

- **js/16's invoice box** — one invoice's whole money, with the **Delete invoice** button on it.
  Opening it left focus on the page behind (three of six Tab presses walked the page underneath) and
  **the Escape key did nothing whatsoever**. Somebody working without a mouse could open it and not
  leave it.
- **js/77's share panel** — focus landed on the skip link at the top of the page and six of six tabs
  stayed outside.

**The missing Escape should have been caught two days ago, and the reason it was not is the finding
worth keeping.** check-structure's overlay rule (fire #92) reads every layer that builds its own box
for the WORD "Escape", anywhere in the file. js/16 says "Cancel/Escape" in a comment about js/57's
pfPrompt twelve hundred lines above its own box — **a comment about a different box satisfied the
gate.** That is the same shape as #127's command palette, whose comment claimed a focus trap the code
never called. The rule now requires a **real key comparison**, and a box that genuinely must not be
dismissible is judged in writing in `scripts/qa/overlays-without-escape.txt`, which gates both ways:
an unlisted box with no handler fails, and a listed box that has since grown one fails too. js/50's
sign-out banner is the single entry, with its reason.

**A second defect, in the shared trap itself.** core-06 worked out the first and last control once,
at the moment the trap was applied. A box that fills itself in afterwards — the share panel lists its
links when the database answers — then carried a trap pinned to controls that were no longer its
edges. Both edges are now read when Tab is pressed; behaviour is identical for a box whose contents
do not change, which is every box the trap covered before today.

**Guards.** `probe-every-box-takes-the-keyboard` now measures **nineteen boxes a run** (was fifteen)
and requires twelve, so it still cannot pass by finding nothing; `probe-escape-closes-every-box`
drives the real key on the invoice box and asserts the tightened gate and the judged list. Sabotage-
verified against a **copy** (APP_DIR), the repository untouched: js/16's Escape handler removed turns
exactly one check red — the new one; its trap call removed fails the focus check in both languages;
and the gate fails all three ways — handler gone, stale exemption, empty list.

**The overlay list is now closed.** Ten files build their own box; nine take the keyboard and keep
it; the tenth is js/50's sign-out banner, which must not be dismissible and is judged as such.

3 gates green. Commit 3eb0e1b, live on directksab2b.com.

---

## Routine fire #128 (2026-09-20 ~03:00 UTC) — the box that asks "are you sure" could not be answered from the keyboard

Fire #127 left a list: ten files build a full-screen overlay of their own, three had been given the
keyboard, seven had not been reached. This round opened those seven through their own entry points
and measured them. **Four more were losing the keyboard, and one of them matters more than all the
rest put together.**

* **`pfConfirm` (js/57) — the box behind every "are you sure" in the app.** Opening it left focus on
  the page behind and four of six Tab presses stayed there. A person working without a mouse was
  being asked a question whose **Yes and No they could not reach**.
* **`pfPrompt` (js/57)** — took focus but never trapped it; four of six tabs walked out. And once
  the keyboard had wandered out, **Escape stopped working too**, because its Escape was wired on the
  input rather than on the document. One cause, two symptoms — recorded that way rather than as two
  defects, because it is one fix.
* **The permission box (js/49)** — the box that tells somebody they may not do something. Focus
  stayed outside, five of six tabs outside; its single OK button could not be reached.
* **The page-access panel (js/15)** — the screen that decides which pages each person may open.
  Focus stayed outside. Six tabs did stay inside, but only because it holds over two hundred
  controls: the keyboard had simply not arrived yet.

All four fixed the same way, and **the event editor (js/10) was measured and found already correct**
— worth saying, because it is the one with 80 real events behind it.

js/58's confirm box got the same treatment for consistency, with a note in the code that it is a
**fallback that never runs** while js/57 is loaded, so it is kept in step by reading rather than by
testing. That is said out loud rather than left to look like coverage.

`probe-every-box-takes-the-keyboard` now measures fifteen boxes per run — the ones a crawl can click
plus the five that must be opened directly — and requires at least eight, so it cannot pass by
finding nothing. Sabotage-verified twice against a copy: removing js/31's trap and removing js/57's
each turn the same two checks red, naming the box and reporting focus on BODY with four of six tabs
outside, which is exactly what the live measurement said before the fix.

### An instrument fault, caught before it was written up

The first run of the measuring driver reported **every** box as broken. It was not: Escape had not
closed the previous box, so `pfPromptBox` was still on the page and each later case measured **that
leftover** instead of the box it had just opened. The driver now refuses to measure a box that was
already there and says so, and removes each box itself between cases.

## Routine fire #127 (2026-09-20 ~01:00 UTC) — two more boxes that did not take the keyboard

Fire #126 found one overlay ignoring the keyboard and wrote the rule: **a layer that builds its own
full-screen box does not get the shared modal's protections.** This round stopped finding them by
hand. A crawler walks the app the way a person does — click a visible button, see whether a
full-screen box appears — and asks of each one: did the keyboard go in, and does Tab stay there.

It found two more, both on real data:

* **Team & Access (js/31)** — the panel that manages the eleven real staff accounts and what each of
  them may open. Opening it left focus on the button behind, and **every one of six Tab presses
  landed on the Settings page underneath**. In both languages.
* **The command palette (core-06)** — and this one is worth noting for a different reason. The
  comment above the trap has always read *"Focus trap inside modals (#ov + #v19palette +
  #v20confirm)"*. The palette wrapper set the ARIA attributes and stopped there; five of six tabs
  walked the page behind the open palette. **The comment described the intention, not the code.**

Both fixed the way #126 fixed the funnel box: call core-06's own trap, release it on close, put the
keyboard back where it came from. The palette re-focuses its search box afterwards, because the trap
focuses the first control and typing must still land in the search. Re-crawled: every box now takes
the keyboard and keeps it, 0 of 6 tabs outside, in both languages.

`probe-every-box-takes-the-keyboard` (port 9097, 4 checks) is deliberately **not a probe for these
two boxes**. It crawls, so a box written next month is covered without anyone remembering to add it,
and it refuses to pass by finding nothing. It costs about four minutes — the price of a check that
covers what has not been written yet. Sabotage-verified against a copy: removing js/31's call turns
two checks red and the report names the box and the button it was opened from.

### Still open, and recorded rather than fixed

Ten files build an overlay of their own. Three now take the keyboard (js/09, js/31, core-06's
palette). The other seven — js/10, js/15, js/16, js/49, js/50, js/57, js/58, js/77 — were not
reached by the crawl, because their boxes open from places a top-level button crawl does not get to.
They all mention Escape (fire #92's gate sees to that) but none mentions the trap. The crawler will
catch them as soon as a path to them is added to it; until then they are named here so the next
round does not have to rediscover the list.

## Routine fire #126 (2026-09-21 ~23:00 UTC) — typing into the card behind the form

A dimension never checked in this project: **can the app be used without a mouse?** Driven against
the real database with real clicks and real Tab keys — never by calling a function — in both
languages.

**The shared modal is excellent.** Click a company's Edit button and the keyboard moves into the
dialog; fifty-two Tab presses never leave it; Save is reachable. core-06's `v21TrapFocus` has been
doing that since v21 and nothing had ever measured it.

**The funnel-details box did not.** It is js/09's own overlay rather than the shared modal, so the
trap never reached it. Opening it from the card left the keyboard on the **Edit button behind it**,
and ten Tab presses all walked the page underneath — somebody working without a mouse was typing
into the card behind the form, in English and in Arabic. js/09 now calls the same trap by hand,
releases it on close, and puts the keyboard back where it came from, which is the courtesy the
shared modal already did. Re-driven: focus lands in the first field and Tab cycles city → note →
Cancel → Save → city.

`probe-the-keyboard-can-do-it` (port 9096, 9 checks) holds both boxes in both languages.
Sabotage-verified twice against a copy of the app, and the two results say something worth keeping:
removing the trap's own `first.focus()` fails the **funnel** checks and not the modal's, because the
modal's first control is its close button and clicking Edit leaves the keyboard next to it. The trap
earns its keep on the box that has no other way in.

### A check of mine that was wrong

The first version asserted the Tab order "comes back round within twelve tabs". The lead form has
more than twelve controls, so it does not — the check was being clever, not finding a defect. What
matters is that the keyboard never leaves the box however long somebody tabs, and that is now
measured over twelve presses and then another forty.

## Routine fire #125 (2026-09-21 ~21:00 UTC) — the battery caught my own English on an Arabic form

The full battery at the #121 tree came back **239 green, 2 red**, both reproduced alone, both
Arabic — and both caused by the round before. The Website box I added in #121 shipped with the bare
placeholder **"example.com"**, which is English sitting on an Arabic form.
`probe-arabic-lead-form` ("no placeholder in the Arabic form is left in English") and
`probe-arabic-dialogs-complete` ("no dialog is left carrying English that is not a name, an acronym
or a technical value") both said so, on three dialogs: New lead, Edit lead, Edit client.

**The probes were right and my code was wrong** — the decision that matters here, and the same call
as fire #111 made the other way. A bare domain is not a name or an acronym, and every other example
placeholder in that form is written in Arabic (the activity note reads «مثال: تحدّثت مع الأستاذ
ناصر — مهتم، سنرسل العرض الأحد»). The domain itself must stay in Latin, so the Arabic side now
frames it the same way: **«مثال: example.com»**. Both probes are green again.

`probe-a-company-website-can-be-typed` gained an eleventh check for the placeholder, so the thing
that went wrong is now guarded by the probe that owns the field rather than only by the two Arabic
sweeps. Sabotage-verified against a copy of the app: putting the bare placeholder back turns **both**
that probe and `probe-arabic-lead-form` red.

Worth saying plainly: seven rounds of adding fields, and the one defect introduced was caught by the
battery the same day, by a probe written months earlier for a different reason. That is the battery
doing exactly its job.

## Routine fire #124 (2026-09-21 ~20:00 UTC) — looking at what the last seven rounds changed

Every assertion added between #115 and #121 reads a value out of the DOM. A value can be perfectly
correct in a control that has been pushed off the side of the screen. This round is the other half
of the house rule: **look at the screens**, and then make the looking a standing check.

**The visual pass is clean.** Five surfaces, both languages, real data: the lead card, the funnel-
details form (its dropdowns showing "Government tender · on file", "Won · on file"), the lead form
(Website box in place, contact rows with their Role box), the corporate profile (in Arabic: «نوع
الجهة» reading «— غير مسجّل —», every label translated, right-to-left clean) and the airline editor.
No page scrolls sideways, no control is off-screen, no JS errors.

`probe-the-forms-still-fit` (port 9095, 4 checks) makes it standing: all four forms, **two widths**
(1500 and 1024) × two languages. Sabotage-verified against a copy: forcing the contact row to five
200px columns pushes two inputs out of the window **at 1024 and not at 1500** — which is exactly why
it runs at two widths, since the same fault is invisible on a big screen.

### Two instrument faults of my own, and a false alarm that did not get written up

A composite screenshot showed the funnel box stacked on top of the lead form, and an Escape
investigation then said a real Escape key closed **nothing**. Both were my tools:

1. The driver closed a box by **removing `#modal`** from the page. `openModal` sets `innerHTML` on
   that very element and reuses it, so the next form threw. Changed to remove it a different way —
   setting `display:none` — and the next form then opened **invisibly**, because the app never sets
   display back. Two faults in a row on the same node. Press Escape and let the app close its box.
2. The Escape measurement then read `#modal`'s display to decide whether the form had closed. The
   app shows and hides it with the **`show` class on `#ov`**. Reading the wrong element reported
   "0 out of 5 closes" for a form that closes every time.

Measured properly, repeating each case five times: the lead form closes on a real Escape 5/5, and
the funnel box 5/5 at normal timing (4/5 when the key is pressed 300ms after opening, which is
faster than a person can click Edit and change their mind). **No defect — and no finding written up
on the strength of a bad instrument.** Both lessons are in the probe's header and the playbook.

## Routine fire #123 (2026-09-21 ~18:30 UTC) — the sixth one gets judged when it is written

The dropdown defect has now been found five times in this codebase, each by hand, each a round
apart. This round stops the sixth needing a person.

**check-structure now finds every dropdown of the shape** — options from a fixed list, selection
from a record, no empty option — and requires each to carry a written verdict in the new
`scripts/qa/select-lists-judged.txt`. It gates **both ways**, like `reports.txt`: an unjudged
dropdown fails the build, and so does a judged one that no longer matches anything, because a stale
entry is as misleading as a missing one. Verified failing on both branches, then restored. A box
that gets the fix (an empty option plus the stored value as its own option) drops out of the scan by
itself — which is how the set went from 45 to 41 as #115, #116, #119 and #121 landed.

### Correcting what #119 said

Fire #119 recorded that the other 41 "carry the same latent defect". **That is not accurate, and the
classification is the useful part of this round.** Of the 41:

* **13 are filters.** The value compared is a screen filter — the Events vertical and status
  pickers, the Finance period and company pickers, the audit log's three filters, the report's
  member / objective / quarter pickers, the expenses and payment-proof month pickers, the Clients
  owner filter. Nothing is stored, so nothing can be lost; the worst case is a filter starting
  somewhere else.
* **5 edit a stored record and are correct.** The three event boxes (all 80 events hold values the
  boxes offer, and two of those columns are database enums of exactly those values); Team & Access,
  whose list covers all six roles the enum holds — the screen its twin js/56 got wrong in round 30,
  and this one was already right; and the objective's team-member picker, whose list is built from
  the team itself.
* **23 edit record types the workspace holds zero rows of** — bookings, invoices, proposals,
  requests. These do carry the defect, and each is marked NO-ROWS with the instruction to fix it the
  way the lead, funnel, airline and entity boxes were **before that feature is first used**.

### Also closed this round

The `activities` table is read-only in the app by design and the app knows it: an activity that came
from the table shows no edit or delete control, so the lost-edit problem js/72 had to solve for
contacts cannot arise. Verified rather than assumed.

## Routine fire #122 (2026-09-21 ~17:00 UTC) — a check that could not catch the thing it was for

Closing the "printed but not writable" audit, then following it into the Events record.

**The company record is now complete.** Every column of `businesses` that holds real data can be
edited somewhere in the app: website was the last gap and #121 closed it. `prefs`, `airline_deals`,
`contract_scope`, `corp_email_flag` and `channels` hold **zero** rows, and the first two are editable
anyway. `direct_client_id` — the key that links a company to Direct Payments — is editable in the
client-handover form; `tier` and `next_review` in the quick-edit. Recorded so the audit is not run
again.

**The Events record is complete too, and its editor is right.** js/10 defines two event editors and
only the later one runs: driven live, `evOpenModal` offers a control for every column including the
plan (`approach`), its progress (`approach_status`) and the exhibitor list — and the save carries
them. All 80 real events have a plan: undecided 25, attend 27, stand 12, mine 13, skip 3.

**What was wrong was the check.** `probe-events-save-honest` guarded the payload with
`Object.keys(row).every(k => COLS.includes(k))` — every key sent must be a real column. That is a
**subset** check. A save that stopped carrying `approach` entirely would still have passed it, while
the Events page's five tiles went on filtering by that column and an event's move silently never
changed. The probe now fills the form with a plan and a progress that are **not** the defaults and
requires the payload to carry both, with those values. Sabotage-verified against a copy of the app:
removing the two columns from the save fails the new checks — **and leaves the old one green**,
which is the whole point.

### An instrument fault, caught before it was written up

The first measurement said the save did **not** carry the plan. It did. The capture truncated the
request body at 140 characters and `approach` sits past that. Recorded because it is the same class
of mistake as the hidden-element reads in #108 and #114: the tool was wrong, not the app.

### For the owner — one thing to know, nothing to do today

`ksa_event_signups` is the table that holds the login the team creates on an event's website. It is
**empty**, and its access rule is "any signed-in user, all operations" — so when logins do start
being stored there, everyone who can open the app, including a read-only viewer, will be able to
read and delete them. Not touched: changing an access rule on the live database is the kind of
change that can lock people out, and nothing is at risk while the table is empty. Worth a decision
before the first login is saved.

## Routine fire #121 (2026-09-21 ~15:30 UTC) — a company's website could be shown but never typed

The rule written in #120 — *a field the app prints but no form can write is a gap* — applied to the
rest of the company record. One more field fails it, and on a much bigger slice of the data.

**Seventy-eight of the 108 live companies carry a website.** The lead card shows it, the leads list
uses its domain to spot the same company entered twice, and the funnel layer fetches a logo from it.
**No form in the app wrote it.** The only line that ever assigned `website` is a derivation in
core-10 that guesses one from the domain of a contact's e-mail. So a website could not be added,
corrected or removed by anybody.

Fixed: a Website box in the lead form, in the empty half of the Stage row so no layout moves, with
the label written bilingually in place. Save stores what is typed, putting "https://" in front of a
bare domain — the card renders it as a link, and "example.com" on its own resolves against this
app's own address and goes nowhere. Empty stays empty; nothing is invented for a company that has
none.

`probe-a-company-website-can-be-typed` (port 9094, 10 checks) holds all four behaviours in both
languages: what is stored is shown, an untouched Save changes nothing, a bare domain becomes a real
link, emptying the box removes the website, and a company with none is not given one. Sabotage-
verified twice against a copy of the app: 5 checks fail without the input, 1 without the
normalisation.

### Checked and clean — the guessed website does not happen

core-10 derives a website from a contact's e-mail domain for any company without one, and then calls
`save()`. From the contacts table alone, 23 of the 30 companies without a website have a contact on
a corporate domain, so this looked like the app quietly inventing data. **It does not fire.** Driven
against the real database with the database's own rows captured before the app could touch them: 78
had a website and still show it, 30 had none and still show none, **none was invented**, and no
write was attempted. It reads the contacts held *in the company record*, and it runs before js/72
brings the contacts table onto them. Recorded so a later round does not chase it again.

### One probe lesson

The first sabotage run made this probe **throw** instead of fail: the box was gone, the check read
`.value` on a null, and the file stopped at the first assertion with nothing said about the other
nine. A crash still exits non-zero, so the battery would have gone red — but a red that explains
nothing is most of the value lost. The checks are now null-safe.

## Routine fire #120 (2026-09-20 ~13:30 UTC) — the app showed a job title nobody could type

The `contacts` table has a `role` column. Eleven of the 45 live contacts carry one, and the lead
card has always printed it beside the name — read off the real database: "Delegations office ·
Protocol". The edit form's contact rows offered **name, email and phone only**.

So the app displayed a field nobody could write. A wrong title could not be corrected, and the other
34 people could never be given one — on the screen whose whole purpose is knowing who to call. The
column is updatable by an authenticated user, so the gap was in the form, not in the permissions.

**Fixed:** a Role box per contact row, in both languages, and js/72 now sends `role` to the contacts
table alongside name, email and phone for a contact that came from there. Driven live in both
languages before and after; the layout was screenshotted rather than assumed — four boxes fit at
126 / 101 / 126 / 126 px with no sideways scroll, and the Arabic row reads right-to-left correctly.

Two deliberate choices, both recorded because they will look odd later. The grid is widened by an
**inline style** rather than by editing index.html's stylesheet — touching index.html is a
connection step and this did not need to be one. And the placeholder is written **bilingually in
place**, while the other three are still translated after render from js/21's dictionary: inline
cannot fall out of step with a dictionary nobody updated, which is exactly how a label goes English
on an Arabic screen.

`probe-a-contact-can-be-given-a-job-title` (port 9093, 9 checks) holds it: the card prints a title,
the form offers four boxes carrying what is stored, the label reads in the page's language, a title
typed on someone who had none is kept, a person added from scratch gets the same box — and a title
given to someone who came from the contacts table is **sent to that table**, while a person whose
details did not change is not written at all. Sabotage-verified twice against a copy of the app: 6
checks fail without the input, 1 without the write-through.

### A trap worth remembering

The first version of this probe invented a table-sourced contact in the page with a made-up row id.
js/72 only writes back a row it has actually *seen* in the table, so nothing was ever sent and the
check failed for a reason that had nothing to do with the app. The second version seeded the row in
the mock's `contacts` table — and then had to find the company **the bridge attached it to**, since
the app's id for a business is not the database row id. Both corrections are written into the probe.

