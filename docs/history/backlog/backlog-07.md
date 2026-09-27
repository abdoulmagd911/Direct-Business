## Routine fire #174 (2026-09-20 ~12:00 UTC) — a round that found nothing to fix, and one thing to ask

Three areas swept against the real database. **No code changed**, because nothing was wrong. Recorded
so the next session does not spend the same hour.

**Arabic — clean.** The whole app driven in Arabic: one piece of Latin text on any page, and it is a
person's name, which should stay as it is. In the real data only **18 of 108 companies** carry an
Arabic name — and the app does the right thing with the other 90: it shows the English name rather
than a blank or a dash. Same for events (61 of 80 named in Arabic). Every column header, stage,
funnel name, owner and priority on the Leads list reads in Arabic. The company registry has an
Arabic label on all 29 entries.

*A wrong turn worth recording:* my first measurement said all 78 Arabic lead rows had a **blank
company name**, which would have been a serious defect. It was my own selector reading the table's
empty checkbox column. Checked before saying anything — the third time this session that checking
first stopped a false alarm.

**On a phone — clean.** Ten pages driven at 390px against the real data: **no page pushes the screen
sideways**. The wide tables sit inside scrolling wrappers, which is the correct answer, and the
Events list turns into stacked cards. No errors on any page.

**Two pages that look empty and are not.** Generator renders a tidy six-way picker ("What do you
want to create?"). Operations shows a request pipeline of zeros because there are genuinely zero
open requests, with "+ New request" right there. Both correct.

**New question for you — 14 · Should all seven employees be able to *edit* Finance?** Not an alarm,
and nothing is broken: employees are *meant* to reach Finance — it is in the built-in floor of pages
everyone gets. But every one of the seven is set to **Editor** on it, not Viewer, so they can change
and delete money records, not just read them. That may be exactly what you want in a team this size.
If it is not, it is four clicks each in Team & Access. Deletions are recoverable — finance rows are
soft-deleted and Activity & Audit can undo them — which is why this is a question and not a fire.

---

## Routine fire #173 (2026-09-20 ~11:00 UTC) — a green "0% credit used" on the morning screen, computed from nothing

The Today page carries a **Commercial Credit Pool** card. Driven live against the real database it
reads:

> Cap 1.25M · headroom 1.25M — **EXTENDED 0 · RECEIVED (this month) 0 · OUTSTANDING 0 ·
> UTILIZATION 0.0%** — with a green bar, an aging panel (0-30 / 31-60 / 61-90 / 90+) and
> *"None — all paid up"*.

Every one of those figures is counted from the invoices **held inside this app**. That list is
**empty**. The company's real invoices are in the finance ledger — **46 of them** — and this card
does not read it.

**Said precisely, because I got a claim wrong four rounds ago and will not do it again:** the card
is **not showing a wrong number today.** The ledger's outstanding really is 0.00 SAR, so the zeros
happen to be correct. What it cannot do is ever be right on purpose — it would show the same green
0.0% with a million riyals owed to you.

**I have not wired it to the ledger.** What counts as "extended credit" has to be defined against
the finance rules — which invoices count, what a wallet deduction does, which statuses are real —
and that is your definition to give, not mine to invent. This is the money, where a confident wrong
number is worse than none. That is question 13 below.

What `js/93` does is make the card name its source and put the ledger's own figure beside it: quiet
and grey while the two agree, **marked the moment they diverge**. Anyone who may not open Finance is
told the card does not read the ledger and is shown **no amount** — the rule from #141, where the
audit log handed money figures to people without Finance access.

**A mistake of mine, caught by driving and worth recording.** The first version of this layer stored
whatever its first query returned and never asked again. That query goes out before sign-in, the
database answers with an empty list and no error, and the card then reported the ledger as holding
**zero** invoices — while it holds 46. That is exactly the bug fire #71 found in the registry
loader, rebuilt from scratch by me. It now refuses to store an empty or failed answer, and the guard
checks the real count so it cannot come back.

Guarded by `scripts/qa/probe-the-credit-pool-names-its-source.mjs` (9 checks), including that
soft-deleted invoices are not counted and that the no-Finance path shows no money. The brake: **the
card's own figures are still drawn** — this adds a line, it does not replace the card.
Sabotage-verified: unhooking js/93 fails seven checks. 3 gates green, battery 285 entries.

**New question for you — 13 · What counts as "extended credit"?** The pool card wants to show how
much of the 1.25M cap is in use. To compute that from the real ledger I need your rule: which
invoices count as credit extended (unpaid? past due only?), what a wallet deduction does to the
figure, and whether the cap is per calendar month as the setting says. Answer that and the card
becomes real; leave it and it keeps saying plainly that it is not reading the ledger.

---

## Routine fire #172 (2026-09-20 ~10:00 UTC) — "43 Still ahead" when 22 had a date

> **Corrected an hour later by fire #177 — the battery caught me.** The fix below shrank the
> headline to the 22 dated events. That was the wrong half: the tiles underneath ("Have a stand",
> "Go & meet"…) still counted all 43, so they stopped adding up to the headline, and that tile is
> also the **show-everything filter** — it opens a list of 43. Two probes that already existed
> failed within the hour and were right to. The headline now keeps the **whole** count of unfinished
> events and the **label** is what changed: **"Not finished"**, with **"No date yet 21"** beside it.
> The diagnosis in this entry stands; the remedy was replaced.


The Events page opens on what is still ahead and puts a number on it. That number counted every
event that had not ended — and an event with **no start date at all** counts as "not ended", because
there is nothing to compare it to.

The live calendar holds **80 events: 22 with a date in the future, 37 finished, and 21 with no date
whatsoever.** The headline read **43**. One of the 21 carries its own note saying there is no 2026
edition and the next confirmed one is **March 2027** — and it was being counted as coming up.

This is the rule #163 already set for the company's certificates: *something with no date on file is
never counted as due.* The Events page was breaking it on the biggest number on the screen.

It now reads **"22 Still ahead"** and, beside it, **"21 No date yet"**. Nothing is hidden — all 43
are still in the list, because losing 21 real events would be a worse answer than over-counting
them — and the new tile is a real filter: tap it and you get exactly those 21, tap again and it
clears. An event with no date is a job (chase the organiser for dates), not a mistake, and it now
has somewhere to live.

Verified against the real calendar: the headline went from 43 to 22 with the list still showing 43
rows. Guarded by `scripts/qa/probe-undated-events-are-not-counted-as-coming.mjs` (8 checks). Three
brakes, because the cheap way to shrink a headline is to drop records: **the two counts still
account for every live event**, **the undated ones are still listed**, and **the tile is not drawn
at all when every event has a date**, so it can never become a permanent "0". Sabotage-verified:
restoring the old count fails five checks and the tile reads 5 again. 3 gates green, battery 284
entries; both events probes re-run clean.

**Worth saying about the rest of that page:** it is the best-built screen in the app. Undated rows
already said "no date yet" in the date column, statuses distinguish Confirmed / Needs check / Stale
/ No date, and one row records a conflict in the owner's own words — *"Owner file said 4-6 May …
official site says 29 Sep-1 Oct 2026 — kept official; re-verify before booking."* The count was the
one thing out of step with it.

**Also checked and in step, so nobody re-opens #171 wider than it is:** suppliers (23/23), SOPs
(12/12), SLAs (14/14) and events (80/80) all match between the settings copy and their real tables.
Airlines was the only store out of step.

---

## Routine fire #171 (2026-09-20 ~09:15 UTC) — the Airlines list quietly ends three short

There are two stores of airlines, and the page reads the smaller one.

| | |
|---|---|
| The copy inside the settings record | **136 airlines**, 26 with contact people — **this is what the page draws** |
| The `airlines` register (a real table) | **139 airlines**, 30 with contact people, contacts last touched 28 June |

No code in the app ever reads that table. So three airlines are in the company's register and have
never appeared on the screen: **Sereen Air (6Y)**, the legacy **XX** bucket row, and — the one that
matters — **Air Sial (PF)**, which the register itself marks as **operating in Saudi Arabia**. The
register also holds contact people for **four** airlines that the list does not carry.

Nothing said so. The list just ended at 136, and a list that ends early without saying so is worse
than a short list: you cannot tell the difference between "we have no deal with them" and "they are
not in here".

**I have not moved the page onto the register.** Doing that means moving its saves too — editing an
airline currently writes to the copy — and this project already carries "move these into real
tables" as a known structural job. Starting it halfway in a QA round is how things break. That is
question 12 below.

What `js/92` does is make the page admit it: one line giving both numbers, **naming** what is
missing, saying that contact people are missing too, and warning that editing here changes the copy
and not the register. Verified against the real database — it reads *"Showing 136 of 139 airlines.
Not shown here: Air Sial (PF) · … The register also has contact people for 4 airline(s) that this
list does not carry."*

Guarded by `scripts/qa/probe-the-airline-list-admits-it-is-a-copy.mjs` (9 checks). The brake that
matters: **it says nothing when the two agree**, so the day the page moves onto the register the
line disappears by itself instead of becoming decoration — the probe proves that by adding the
missing airlines and watching it go. Sabotage-verified: unhooking js/92 fails six checks. 3 gates
green, battery 283 entries.

**Also checked and clean, recorded so nobody raises it twice:** there are two backup schemas
(`bak_20260725`, `bak_20260805`) holding ten tables of real company data with **RLS switched off and
no policies**. That looks alarming and is not: no API role has any access to those schemas at all
(`anon` and `authenticated` both lack schema USAGE and table SELECT), so they cannot be reached
through the app or its key. The grant is the lock, not RLS.

**New question for you — 12 · Should the Airlines page read the real register?** Today it reads a
copy that is three airlines and four contact lists behind. Moving it across also means its Edit
button writes to the register instead of the copy. Say the word and I will do both together, in one
round, with a probe either side.

---

## Routine fire #170 (2026-09-20 ~08:30 UTC) — the Reports page is one person's private notebook

The Reports page has four tabs and shows what reads as the company's position: **Achievements
logged**, **N / 30 KPIs with data**, **Avg progress to 2026 targets**, and a percentage against each
of your 2026 objectives.

**All of it is saved in the browser it was typed into.** Not the database. Not the "Full backup
(JSON)" in Settings. Nowhere else in the app even refers to it.

Measured with two browsers on the same account against the same live database, rather than read off
the code:

| | |
|---|---|
| Browser A, after one achievement recorded | *1 Achievements logged · 1 This month · 1 / 30 KPIs with data · **3% Avg progress to 2026 targets*** |
| Browser B, same account, same moment | *0 Achievements logged · 0 This month · 0 / 30 KPIs with data · **0%*** |
| Database writes attempted while A saved | **none** |

So: fill in thirty KPIs at the office desktop, and the same page on a laptop reads zero. A colleague
opening Reports sees zero. Clear the browser's data and it is gone, with no copy anywhere. Nothing
on the page said any of this — it just showed confident percentages.

**I have not moved the data, on purpose.** Where the company's KPIs should live is your call, not a
QA round's — and you already run a separate appraisal/KPI system, so quietly copying them into this
database could be exactly the wrong answer. That is question 11 below.

What is fixed is the misleading part. `js/91` puts one plain line above the tabs: these figures are
in this browser only, they are not in the backup, and **Generate Report** is how to take a copy out
before relying on them. A warning with something to do beside it.

Guarded by `scripts/qa/probe-reports-say-they-are-local.mjs` (8 checks, including Arabic with no
English left behind). Two brakes, because a banner is the easiest thing to over-apply: **the page
still works** — four tabs, figures still drawn — and **the line appears only on Reports**, since the
same warning on Leads or Clients would itself be a lie. Sabotage-verified: unhooking js/91 fails
five checks. **New rule M32.** 3 gates green, battery 282 entries.

**New question for you — 11 · Where should the company's KPIs and achievements actually live?**
Three honest options: leave them per-person (fine if they are personal working notes — the new line
now says so); move them into this app's database so the team shares one set; or accept that they
belong in your separate appraisal/KPI system and take the tab out of this app entirely. Tell me
which and I will do it.

---

## Routine fire #169 (2026-09-21 ~21:45 UTC) — two recovery screens missing from the sidebar (and a claim I got wrong)

> **Read this first — I overstated this one, and caught it an hour later.** The original write-up
> below said the two screens had **no button anywhere** and could only be reached by typing the
> address. **That is not true.** Both are reachable by clicking today: **Settings → "Admin &
> history" → Activity & Audit / Archive**. I drove it: two working buttons, both land on the right
> page. The sweep I trusted only looked at the sidebar and top bar — it deliberately ignored
> anything inside a page, so it could never have seen a link that lives on the Settings page. I had
> even written in its own notes that its detection was crude, and then drew a confident conclusion
> from it.
>
> **What is actually true:** the two recovery screens were **missing from the sidebar**, so finding
> them meant already knowing to look inside Settings. `js/90` now puts them one click from the nav
> instead of three clicks deep. That is a genuine improvement to how easily they are found — it is
> **not** the rescue-from-nowhere I described. The rest of the round (the buttons, the Arabic, the
> permission gating, the probe, the two bugs I found in my own layer) stands as written.



Swept every address the app will open, against the real database, signed in as an admin — who may
open everything, so nothing could be hidden by permission. Two pages draw real content and appear
**nowhere in the sidebar**: not on the rail, not inside either collapsed group. (They *are* linked
from inside Settings — see the correction above.)

| | |
|---|---|
| **Activity & Audit** | 41,636 characters of page on the live data. It is the audit trail **and the Undo screen** — the only place a change made in the last 24 hours can be reversed. |
| **Archive** | The only screen that can bring back a deleted company. **Four companies are archived in the live database right now.** |

So finding either one meant already knowing to look inside Settings, under "Admin & history" — the
app's admin index, which is where both have always been linked. Nothing in the sidebar said so.

Both pages are first-class everywhere else — the Team & Access screen offers them by name in both
languages, managers are granted both by default, and the database itself enforces access to the
audit page. **Only the sidebar never heard.** It is built from one list, then thrown away and
rebuilt from three others, and nothing keeps any of them in step with the list of real pages. This
is the same fault that, in the project's own words, *"is how the finance ledger sat
live-but-unreachable for two days."*

`js/90` gives them a button, **inside the collapsed "Reference" group** with the other
non-daily-driver pages — one click to expand. Not on the main rail: that rail is deliberately eight
items and this fix has no business quietly making it ten. The buttons are hidden from anyone who may
not open those pages, re-checked after every render, because a button that bounces you back to Today
is its own small lie.

Two smaller things fixed on the way, both found by **driving** the nav rather than reading it:
my first attempt wrote each label into the icon's slot, so every name came out **twice**
("Activity & AuditActivity & Audit"); and the app's own translation table answers "Activity feed"
for that page while the access screen, the refusal message and the page title all say
"Activity & Audit". The sidebar now says what the access screen says — one page, one name.

Guarded by `scripts/qa/probe-you-can-click-to-the-undo-screens.mjs` (6 checks), including Arabic on
both buttons and the brake that the rail did not get longer. Sabotage-verified: unhooking js/90
fails four checks, and the click test lands back on Today. **New rule M31.** 3 gates green, battery
281 entries. Report: `scripts/qa/diag-pages-with-no-way-in.mjs` re-runs the whole sweep.

---

## Routine fire #168 (2026-09-21 ~21:00 UTC) — a form that took your corrections and threw them away

The thing #167 measured and left. The company's identity is stored **twice**: the registry every
document has read since 2026-08-24, and an older block inside the settings record. **Seven of the
thirteen comparable fields disagree**, including the **VAT registration number** and a **bank IBAN**.

On `/dashboard` sits a card, "🇸🇦 Agency profile — KSA settings", with six boxes — trade name, VAT
number, IBAN, bank, IATA Wakeel — under the line *"Used on every invoice header, ZATCA QR seed, and
BSP payout reconciliation."* Driven live against the real database, here is what it really did:

- it **showed** the registry's values, which are the right ones;
- each box **wrote** to the older block, which nothing reads any more;
- and the next page load **read the registry again and threw the typed value away**.

That sentence stopped being true on 2026-08-24. So somebody who went in to correct the company's
VAT number would watch it accept the change, believe the company's VAT number was now right
everywhere, and have changed nothing at all. Nothing on the screen would say otherwise.

**The card is not deleted — it is made honest.** `js/89` turns it into plain read-only values from
the registry, says where they are kept and that they are not changed here, and gives a button
straight to **Company assets & registry**, shown only to somebody who may open that page (a button
that bounces is its own small lie — the lesson of #165's jump chips). Remove the file and the boxes
come back; `DB.agency` is untouched.

It also **names the three values the registry has no key for** — the IATA Wakeel / agent number, the
Zakat / Tax ID and the bank name — instead of drawing three empty boxes. An empty box reads as
"nobody filled this in"; the truth is "this app has nowhere to keep it", and that is question 8 in
the list at the top of this file.

Guarded by `scripts/qa/probe-the-identity-card-does-not-pretend.mjs` (8 checks). Two brakes, because
simply deleting the card would pass most of them: **the card is still there**, and **the values are
still shown**. Sabotage-verified: unhooking js/89 fails five checks and prints the false sentence
back, word for word. One honest note on the probe itself — the check that the claim is gone first
read `innerText`, which skips the very element the sentence lives in, so it **passed against the
broken copy**; the sabotage run caught that, and it now reads `textContent`. **New rule M30:** a
migration is finished when the old writer is shut, not when the new reader works. 3 gates green,
battery 280 entries; six neighbouring document, registry and renewals probes re-run clean.

---

## Routine fire #167 (2026-09-21 ~20:15 UTC) — the link was handed the filing cabinet, not just the pipeline

Third and last of the share-link rounds. #165 asked what a link holder can **read** off a card;
#166 what they can **take** away. This asks what the page was **given** in the first place — and it
turned out neither of the first two touched it.

`share_view` is the database function a share link calls **with no sign-in**. It returned the
**entire settings record** of the app, and the page copied every key of it into memory. On the live
row that is **35 keys and 86,801 bytes**, of which a link legitimately needs three. The rest:

| | |
|---|---|
| `agency` (25 fields) | the company's **bank IBAN**, its **Amadeus office and PIN**, its **Zakat/Tax ID** |
| `audit` | **799 rows** of who-did-what-when — the same trail #141 kept from colleagues who cannot open Finance |
| `serviceFeePricing` | how Direct prices its own service fee |
| `integrations`, `sops`, `slas`, `vendors` | supplier configuration, 12 SOPs, 14 SLAs, 23 vendors |
| inside `settings` | the finance group map, the finance exclusions, the commercial pool |

None of that is Today, Leads or Clients. It never showed on a screen, which is why three rounds of
looking at screens did not find it — it was in the answer behind the page, readable by anyone who
opened the link and looked at what arrived.

**All four share links are switched off**, so nothing was exposed. Same as #165: that is exactly
when to fix it.

**Fixed in both places, because they fail differently.** The database function now builds an
**allow-list** — keep `meta`, `schemaVersion`, and `settings` trimmed to the funnel list, the funnel
sub-lists and the view presets. **35 keys → 3, 86,801 bytes → 836.** That is the lock that stops the
data leaving at all. The app then allow-lists again on the way in, which survives an older cached
copy of the function and catches a key its author forgets later. Allow-list and not a block-list on
purpose: the failure that matters is the block nobody thought of, and it must be **absent by
default**. The function carries its own undo in a comment — one line puts the old behaviour back.

Guarded by `scripts/qa/probe-a-share-link-is-not-handed-the-settings.mjs` (7 checks), with one
marker per internal block so a failure **names which block leaked**. Sabotage-verified: putting the
old copy back fails two checks and prints all eight — the bank IBAN, the Zakat ID and the Amadeus
PIN among them. Three brakes, because the cheap way to pass is to hand over nothing: the shared
pages still carry rows, Clients still renders, and a signed-in colleague still gets everything.
**New rule M29.** 3 gates green, battery 279 entries; the three earlier share probes re-run clean.

**Also measured, not yet fixed — for the next round.** The company's identity is stored **twice**:
the registry (which every document has read since #160-#162) and an older block inside the settings
record. Seven of the thirteen comparable fields **disagree**, including the VAT number and a bank
IBAN. Driven live: the "Agency profile — KSA settings" card on `/dashboard` shows the **registry**
values — correct — but its six input boxes write to the **older block, which nothing reads**, and
the next page load throws the edit away. Its own subtitle still says *"Used on every invoice header,
ZATCA QR seed, and BSP payout reconciliation"*, which stopped being true on 2026-08-24. So somebody
correcting the VAT number there would believe they had corrected it everywhere and have changed
nothing. Report: `scripts/qa/diag-agency-profile-card.mjs`.

**This also answers question 8 in the list above.** The Zakat / Tax ID is **already in the app** —
it is in that older block, not in the registry. So the question is no longer "send me the number",
it is "is the number in the old block still current?" Same for the IATA Wakeel / agent number, which
the card shows as **blank** although the old block has one.

---

## Routine fire #166 (2026-09-21 ~19:15 UTC) — and it could take a copy away

Same link, one step further. The panel that mints one promises: *"A link opens Today, Leads and
Clients read-only to anyone holding it — no sign-in needed — until it is switched off here. Nothing
can be edited through it."* On Leads and on Clients the holder was also offered:

- the top bar's **Export ▾** menu — CSV / Excel, summary / full details, **always ALL records**;
- and the Leads page's own **"↓ Export this view (CSV)"**, whose file carries **every lead's owner,
  next action and contact details**.

Downloading the pipeline is not editing, so the promise was kept to the letter and broken in
substance. "View-only" does not mean "take a copy of the company's pipeline away with you".

Both are off a shared view now, in `js/79` — the layer that owns that promise — by one stylesheet
rule, which is also why it cannot be missed by a later render. The in-view button got a class so it
can be named rather than matched by its words.

Guarded by `scripts/qa/probe-a-view-only-link-cannot-take-a-copy.mjs` (6 checks), with the same two
brakes as the last round: **the pages still read** (33 leads, 15 clients on screen), and **signed in
both controls are back**. Sabotage-verified: dropping the rule puts both back in front of the guest.
3 gates green, battery 278 entries; four export and share probes re-run clean. **M28 extended** with
what #165 and #166 found, so the next session meets it as a rule rather than as three discoveries.

**Left as a question, deliberately:** the shared Leads and Clients tables still show **OWNER**,
**NEXT ACTION**, **PRIORITY**, **TIER** and **HEALTH** — internal judgements, but arguably part of
"the pipeline" the link promises. That is a call about who these links go to, and it is yours, not
mine. Say the word and those columns come off a shared view in one line each.

---

## Routine fire #165 (2026-09-21 ~18:30 UTC) — a view-only link was handing out the file we keep on a company

M28 said: *before putting anything on a company card, ask who else can open that card.* #164 asked
it of two lines added the same day. This asked it of **everything else on the card** — and the
answer was worse.

A person holding a **view-only share link** could open a company's card and read:

- **the activity log** — our own call notes, each with **"edit · remove"** beside it. The record
  used to find this carried *"call: their finance man is difficult, push the discount"*;
- **comments** — internal discussion about the account;
- **notes** — free text, which **100 of the 108 live companies have**.

None of that is what the link is for. The panel that mints one promises **Today, Leads and
Clients** — the pipeline, not the file we keep on a company. And 11 live records already carry their
activity log inside the blob the share loader copies out wholesale.

**Nothing was exposed when this was found — all four live share links are switched off** — which is
exactly when to fix it rather than after somebody makes the next one.

`js/79` (the layer whose whole job is "the view-only link keeps its own promise") now takes the
three cards off a shared card, hides the suggested-next-step nudge (coaching for our own team, which
reads as nonsense to a guest), **and takes the matching chips out of the jump bar** — a button that
scrolls to nothing is its own small lie. The holder is told once, in words: *"Internal notes,
comments and the activity log are not part of a shared link."* A missing card must never be mistaken
for an empty one.

Guarded by `scripts/qa/probe-a-shared-card-keeps-our-notes-inside.mjs` (8 checks). Two of them are
the brakes: **what the link IS for still works** (the company, its stage, its key facts), and
**signed in, all three cards are back** — a wall, not a deletion. Sabotage-verified: removing the
block fails five checks and prints the call note it should never have shown. 3 gates green, battery
277 entries; six share and card probes re-run clean.

---

## Routine fire #164 (2026-09-21 ~17:45 UTC) — what we say to ourselves, nearly handed to an outsider

Asked of the two lines added earlier today: **who else can open the card they sit on?** A view-only
share link puts Today, Leads and Clients in front of somebody outside the company, and a card opens
from that list. Both lines are notes to ourselves about a third party:

- `js/85` — *"The same person is on another company"*, which **names the other company**;
- `js/86` — *"Confirm this company before reaching out — organisation inferred from the email domain
  only"*, our own unfinished judgement about a business we have not checked.

**Neither appeared — and only by luck.** The share loader copies a record's **whole raw blob** to
the link holder, and fire #151 had just started putting those three fields onto the app's record
object. **One in-app save of any company** would have written them into that blob and handed them
out with it. Measured, not reasoned: with the guards removed in a sandbox, the share view prints
*"Confirm this company before reaching out — Organisation inferred from the email domain only"* to
an outsider.

**Two locks.** `js/02` keeps those fields out of the blob at the source — they are column-owned, the
column always wins on read, so a copy there was only ever noise — and **both layers return early in
a share view**, whatever the data says. Recorded as **M28**, with the part that outlives these two
lines: *before putting anything on a company card, ask who else can open that card.*

Guarded by `scripts/qa/probe-a-share-link-sees-no-internal-notes.mjs` (6 checks). Its fourth seeds
the blob with all three fields — the state one save would create — and its fifth proves a signed-in
colleague still sees everything, so this is a wall and not a deletion. Sabotage-verified: removing
either guard leaks, and the failure line names the other company. 3 gates green, battery 276 entries;
no-phantom-writes, share-view-tidy and the two card probes re-run clean.

---

## Routine fire #163 (2026-09-21 ~17:00 UTC) — four company papers have lapsed, and the CR is next

Chasing the PCI-DSS finding to its source: **what else does the registry say, and who ever sees it?**
Driven live against the Renewals radar, which is a good instrument and tells the truth:

| | |
|---|---|
| ISO 9001:2015 | **EXPIRED** 2025-02-14 |
| DUNS | **EXPIRED** 2025-09-10 |
| Saudization certificate | **EXPIRED** 2026-01-06 |
| PCI DSS (SAQ A 4.0.1) | **EXPIRED** 2026-07-14 |
| Monsha'at certificate | 50 days left |
| **Commercial Registration (CR)** | **85 days left** (2026-12-14) |
| Riyadh Chamber membership | 85 days left |
| Ministry of Tourism licence · IATA accreditation | date not on file |

Four lapsed, and **the CR itself inside three months**. Everything above is correct and already in
the app — but only on **Generator → Company assets & registry**, a page nobody opens unless they
already suspect something. A warning nobody passes is not a warning.

**New layer `js/88`: one line on Today**, and only when there is something to say — a paper already
expired, or expiring within sixty days. Three choices worth keeping:
- **Admins and managers only.** Seven of the eleven live accounts are employees; a lapsed
  Saudization certificate is not their job and putting it on their morning screen is noise.
- **At most three, most urgent first**, then "and N more" and a link to the radar. The radar stays
  the instrument; this is the doorbell.
- **Nothing is invented.** A paper with no expiry date on file is not counted as anything — the
  radar already shows those as "date not on file".

Verified on live data: the line appears for the admin account and reads the three lapsed ones plus
"and 2 more". Guarded by `scripts/qa/probe-todays-renewals-line.mjs` (9 checks). Sabotage-verified:
counting undated papers makes the line appear on a morning when **nothing is due** — which is how a
warning stops being read — and removing the role gate puts it on every employee's screen. 3 gates
green, battery 275 entries; role-nav, page-access and the click-through probe re-run clean.

**For the owner, plainly:** four certificates need renewing, and **the commercial registration
expires on 2026-12-14**. The CR is 85 days out, so it is not on the Today line yet — it appears on
its own when it reaches sixty days. Nothing in the app can renew these; the line only makes sure
nobody finds out by accident.

---

## Routine fire #162 (2026-09-21 ~16:15 UTC) — the report footer was still advertising a lapsed certification

Finished the three literals #161 named, and one of them was not a tidy-up at all.

### ⚠ The monthly report and the PowerPoint deck both claimed PCI-DSS

Fire #139 taught the About one-pager to obey the company registry: a credential the owner's own
instrument records as **expired**, or marks **"not on documents"**, is stripped from the document.
Two places it never reached were the **footer of the monthly report** and the **last slide of the
PowerPoint export** — each one hardcoded string, and that string said:

> … · IATA \<number\> · Amadeus \<office\> · **PCI-DSS** · \<website\> · \<old phone\>

Checked against the live registry the same day: **PCI-DSS expired 2026-07-14 and is marked not for
documents.** So a report printed for a client and a deck attached to a tender both advertised a
certification the company no longer holds — the same claim, in the same words, that #139 had already
removed from the one-pager. The Amadeus office is marked not-for-documents too, and the phone was
the older mobile rather than the licence phone.

Both are built from the registry now and put through the **same filter**, so "may we print this?"
has one answer, in one place, for every document. Measured after the change, the live footer reads
the registry's legal name, the IATA number and the licence phone — **and no PCI-DSS**.

### The rest of the sweep

- The offer's **IATA-wakeel disclosure** — marked in the code "owner-approved, EXACT text, never
  rephrased" — keeps its wording exactly; only the *number* moved into the registry, and the sentence
  is **left out entirely** when the registry has no number. A disclosure you cannot complete is not
  one you may make.
- The **legal entity line** on the one-pager and the deck's title slide now come from the registry
  too.
- `js/`, `index.html`: **no company identifier remains anywhere in the code** — CR, VAT, unified
  number, trade licence, IATA, DUNS, Zakat/Tax ID, Amadeus office/PIN, address, phone. The last one
  was inside a *comment*, quoted as an example, and went with the rest.
- `scripts/qa/phone-numbers-judged.txt` lost its first entry — the company's own published number —
  because check-structure reads that list **both ways** and failed the moment the number left the
  code. The gate written in fire #140 caught the tail of fire #162's own change.

Guarded by `scripts/qa/probe-the-report-footer-obeys-the-registry.mjs` (5 checks), plus a new check
in the #160 probe for the disclosure. Both source checks **name no number**. Sabotage-verified:
putting PCI-DSS and a hardcoded IATA number back fails three checks, and one of them shows both
printing onto a report built while the registry was unreachable. 3 gates green, battery 274 entries;
five document and report probes re-run clean.

---

