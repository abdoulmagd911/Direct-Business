## Watch cycle 47 — going looking for the third harness lie, and finding two

Cycles 45 and 46 each tripped over a query feature scoped narrowly on purpose that then answered
the wrong thing confidently. This cycle went looking rather than waiting, and the pattern turned
out to be the point: **an unimplemented filter was indistinguishable from an implemented one.**

**Fixed at that level, not case by case.** After the operators `mock-supabase` really does apply,
anything left that is *shaped* like a PostgREST operator now stops the request with **501 naming
itself** — on GET and, more importantly, on PATCH, where an ignored filter does not merely show
too many rows, it **writes to every row the filter was meant to exclude**. Proved by hand: `eq`
and `is.null` pass; `gte`, `ilike` and `in.` on a GET all 501 with the operator quoted. Adding an
operator is deliberately cheap — implement it in the loop and it stops reaching the check.

**The third lie was the one its own comment admitted to**, three lines above the code:
*"everything else keeps the old no-op 201,[] stub … Widening this to every table is a bigger,
riskier change some other probe might be unknowingly relying on — not done here."* Every POST and
DELETE to a table the mock does not persist answered `201 []`, which reads exactly like a
successful write that returned no representation.

**And the first attempt to fix that was wrong, in an instructive way.** Making it 501 reddened
four probes — not because they asserted a write had worked, but because **the app logged a failed
request and they check for console errors.** That is the harness punishing the app for the
harness's own gap: in production the write succeeds, and the app is behaving correctly. The lie
is not told to the app, which cannot tell the difference and should not have to; it is told to
whoever reads the probe's output later. So the wire stays `201` and the truth goes to **stderr**,
where the probe's log keeps it, plus a counter any probe can assert on:

    GET /__mock/ignored-writes  →  {"app_settings": 8, …}

**It earned itself on the first run.** The battery reports **8 unpersisted POSTs to
`app_settings`** — the app saving its own settings, going nowhere, silently, for as long as this
harness has existed. That is the table cycle 45's probe had to write to by hand.

**Battery: 82 / 85.** No probe was relying on an ignored *filter* — the two gaps found in 45 and
46 were the ones being depended on. Both remaining reds plus the two new ones are load-only and
green standalone.

### Open for cycle 48

**One red is worth reproducing deliberately rather than filing as a flake.**
`probe-guardrails-both-halves-attacks`: *"under a read-only share view: adding an exclusion …
CHANGED the stored exclusions"*. Green standalone and in four prior batteries — **but that check
could not fail before this arc**: the write it watches went nowhere until cycle 45 made PATCH
honest. It is now genuinely testing something, and under load it says a share view changed the
standing exclusion list. If that is real it is a fail-open on the owner's hardest ruling, on a
read-only surface. Reproduce it with the share view forced, not by waiting for contention.

**Also new and load-only:** `sweep-dialogs-phone` reported a 3,000px dialog whose Save button was
unreachable on a 390×844 screen; standalone the same forced case passes with the footer staying
put. Worth one deliberate look at whether the dialog's layout depends on timing.

**Still out of lane:** js/58 selects the B2C page on `revenue_way` alone; js/41 shares the
`finExclusionCheck` fail-open. `probe-premortem-attacks` check H unchanged (do not raise the
budget).

## Watch cycle 48 — the share-view red was the probe's stopwatch, and the check meant to settle it could not fail

**The suspicion, tested rather than filed.** Cycle 47's battery said *"under a read-only share
view: adding an exclusion … CHANGED the stored exclusions"*. If real, that is a fail-open on the
owner's hardest ruling from a surface that may not edit anything.

**It is the probe's own fixture, and the mechanism is named.** `probe-guardrails-both-halves-attacks`
compares `DB.settings` — the **page's** copy — before and after, and seeds that copy in the page
only. Its setup then waits a flat **2500 ms** for something it could wait on a condition for; its
own comment says what: *"let the merge control's own settings reload finish before anything is
measured against it."* Under load that reload lands later, replaces `DB.settings`, and takes the
page-only fixture with it. The same check reports the dialog **did not open**, so the guard held.
What moved was the fixture, not the list. Measured directly: the seed is stable for 15 s idle and
under four CPU burners, so it does not drift on its own — it is that specific reload.

That probe is not this session's to edit. The one-line fix for whoever owns it: wait for the
reload to have landed, not for 2500 ms.

**The property itself is now measured where it lives** — added to
`probe-exclusion-display-attacks` (8714): under a read-only share view the exclusion dialog does
not open at all, because the guard is on the function. Sabotage (removing `canEdit62` from
`v62AddExclusion`) reddens it.

**And the half of that check that was supposed to be the real proof cannot fail — so it is a
report, and says so.** The intent was to compare the **server's** copy of the list, which is the
guarantee; the page copy is only a rendering. With the guard deliberately removed, the dialog
opens, Save is pressed, and **15 seconds of polling still shows the stored list byte-identical**:
js/35 saves settings on its own diff-and-upsert pass, and that pass is not reachable from a probe
in this state. A check that cannot fail is the thing this whole arc removes, so it prints as a
REPORT with its own limitation named, and the dialog assertion carries the guarantee.

**Cycle 47's counter closed its own finding.** Those 8 unpersisted POSTs to `app_settings` were
the app saving its own settings into nothing; `mock-supabase` persists that upsert now
(`{id:'main', data}`, `onConflict: id`). This battery reports **zero** ignored writes.

**An honest consequence to record:** persisting `app_settings` gives the settings reload a real
server copy to bring back, so the guardrails probe's page-only fixture is now *more* likely to be
replaced under load, not less. Its red is expected to recur until its stopwatch is fixed.

### Open for cycle 49

**Make the stored-list check able to fail.** It needs js/35's settings save reachable from a probe
— either a way to force that pass, or a probe-visible signal that it ran. Until then the strongest
statement about share views and the exclusion list is "the dialog does not open", which is true
but weaker than "the stored list cannot change".

**Environmental, not a defect:** `probe-stress` crashed with `EADDRINUSE` on 8921 — a transient
bind conflict inside a six-way run, green standalone. `check-probe-integrity` gates duplicate port
*declarations*, which this is not.

**Still out of lane:** js/58 selects the B2C page on `revenue_way` alone; js/41 shares the
`finExclusionCheck` fail-open; `probe-premortem-attacks` check H (do not raise the budget).

## Watch cycle 49 — the four numbers that decide who gets chased were rounded off

**A new area at last, and a real defect in it.** Finance's "Collections & ageing" card prints four
buckets — 0-30, 31-60, 61-90, 90+ — through `moneyS()`, which renders anything over a million as
`8.76M` and anything over a thousand as `999.9K`. Measured:

    90+ days   holding 8,755,055 SAR   read as  "8.76M"      a band ten thousand riyals wide
    61-90      holding   999,999 SAR   read as  "1000.0K"    a different million from the one it is

The credit tile eight lines above in the same file carries its exact figure in a `title`
attribute. These carried nothing at all. Two standards on one screen — and the rounded one is the
screen somebody works from when deciding who to call about a late invoice.

**A `title` would not have fixed it.** The owner reads Finance on a phone, where there is no
hover. So the exact figure goes **on the card**, under the short one, which stays as the headline:
four full-length numbers is not an improvement on a 390px screen. `probe-ageing-money-legibility`
(port **8721** — the 8701–8720 block is full; recorded so the next cycle does not rediscover
that) measures it at 390×844 *and* at desktop width.

**Two things caught only because the work was checked, not because it was written carefully.**

1. **The first sabotage silently did not apply, and the probe reported zero failures.** The script
   printed "sabotaged" unconditionally — it never asserted its anchor matched. A guard was one
   step from being recorded as verified while nothing had been broken. This is cycle 44's lesson
   in a new costume: it is not enough to baseline after the fix; **the sabotage itself is a claim
   and must be asserted**, and a sabotage that reddens nothing is far more likely to be a failed
   edit than a robust app.
2. **A different probe caught the markup.** `probe-b2c-manual-attacks` reads the ageing chips with
   `d.children.length === 2` — label and value. A third sibling made every chip it watches
   invisible to it, and a bucket it asserts on came back `null`. The chip's shape is a contract
   another probe depends on, so the exact line went **inside** the value rather than beside it.

**And a rule that came from that same run:** show the exact figure only when the short form is a
different number — compared as numbers, not as strings, so the test is "did rounding lose
anything". "4,000" under "4.0K" is noise.

**Battery: 86 / 86 — every probe that can fail, green.**

### Open for cycle 50

**The same rounding exists elsewhere and was deliberately not swept.** `moneyS()` has 14 callers
in js/16. This cycle fixed the two on the collections card that are acted on — the ageing buckets
and Outstanding. The rest are headline tiles where a glance is the point; each deserves the same
question asked individually ("is this number acted on, or read?") rather than a blanket change.

**Still out of lane:** js/58 selects the B2C page on `revenue_way` alone; js/41 shares the
`finExclusionCheck` fail-open; `probe-premortem-attacks` check H — do not raise the budget.
`probe-guardrails-both-halves-attacks` red is expected to recur until its 2500 ms stopwatch
becomes a condition (cycle 48).

## Watch cycle 50 — the file had already decided; it just said so where a phone cannot hear

**Asking the remaining `moneyS()` callers one at a time turned up a better rule than "which of
these matter", because js/16 has already answered that question.** Several of them carry
`title="…exact…"` on the element — Client credit, the Key-indicators cards, Confirmed
revenue/cost/profit. Somebody looked at each and decided the rounded form was not enough. That
judgement is made; it is simply **delivered through a hover**, and the owner reads Finance on a
phone. On the device he actually uses, "8.76M" is the whole answer and the exact figure he asked
for is unreachable.

**The rule, which needs no per-tile argument:** if a number was judged to need its exact value, it
needs it on a phone too. `probe-hover-only-money` (port **8722**) holds it by **scanning the DOM
for money titles** rather than naming tiles, so a sixth added later is caught without anyone
remembering to update the probe. It found **nine**, not the five predicted from reading the source.

**Three things this cycle got wrong and caught by checking.**

1. **Cycle 49's commit message claimed a refinement the code never had.** Its "compare as numbers,
   not strings" version of the helper was lost when a patch rolled back on a failed assert, leaving
   a string comparison that prints "4,000" under "4.0K". The commit said otherwise. Fixed here, and
   the correction is written into the code comment rather than only into a log nobody re-reads.
2. **The probe's first rule was stricter than the defect.** It demanded an exact line wherever a
   money title existed — but "51.5K" *is* exactly 51,500; the title merely carries `.00` decimals.
   Three "failures" were the probe inventing a defect. It now round-trips the abbreviation the same
   way the app does, so the two cannot drift apart.
3. **Sabotage on the Confirmed tiles reddened nothing, and the first explanation for that was
   wrong.** Written down first as "the tile never renders"; checking rather than believing it showed
   the tile is on screen, and the real reason is duller — its values abbreviate **losslessly** in
   this fixture, so the fix is inert there with or without sabotage. **The edit on those three
   tiles is real but unexercised**, and the probe now says so in a REPORT on every run rather than
   letting a green line imply cover it does not have.

**Battery: 87 / 87 — every probe that can fail, green.**

### Open for cycle 51

**Make the three Confirmed tiles fail-able.** They need a fixture whose confirmed revenue/cost/
profit actually round — the current one lands on 51,500 / 42,600 / 8,900, all exact when
abbreviated. Until then `probe-hover-only-money` proves six of the nine and says which three it
does not.

**Still out of lane:** js/58 selects the B2C page on `revenue_way` alone; js/41 shares the
`finExclusionCheck` fail-open; `probe-premortem-attacks` check H — do not raise the budget.
`probe-guardrails-both-halves-attacks` until its 2500 ms stopwatch becomes a condition.

## Watch cycle 51 — the unproven tiles, proven

**Cycle 50's own probe output named a gap; this closes it.** `probe-hover-only-money` proved six
of the nine money titles it finds and REPORTED the other three — Confirmed revenue / cost /
profit — as **unexercised**: sabotaging the fix on them reddened nothing.

The reason turned out to be one layer below where cycle 50 looked. Those tiles sum
`finance_TRANSACTIONS`, not invoices, and the mock's default rows total **51,500 / 42,600 /
8,900** — every one of them exact when abbreviated, so `finExactUnder` returned nothing for them
with or without the fix. The probe seeds its own transactions with awkward amounts now, and the
proof is the failure: removing `finExactUnder` from the Confirmed revenue tile fails the run **by
name** — *"ledger · shows 7.22M SAR · title says 7,222,221.00 SAR"* — on both viewports.

**The REPORT that named the gap was kept, not deleted.** It stays silent while every tile rounds
and speaks again the moment a fixture stops exercising one. A note that only ever described one
run would have been worth deleting; one that re-detects the condition is worth keeping.

### Open for cycle 52 — two load-only reds with the same shape, and it is not the usual one

Both were green standalone and green in prior batteries, and neither is a timing wobble of the
familiar kind:

    probe-csv-injection       "legitimate negative amount was altered: expected -1500.50, got 6554"
                              "a normal string was altered: expected Normal Client Name, got Test Company 2"
    probe-restore-scope       "before 1500, after delete 1500" — the delete wrote nothing

`Test Company 2` and `6554` are the mock's **default seed**, not that probe's fixture. So under
six-way load a probe appears to have read a world it did not set up. That is worse than the
EADDRINUSE crash cycle 48 saw in `probe-stress`, because it does not crash — **it measures the
wrong fixture and reports the app as broken.** Every conclusion drawn from such a run is wrong in
both directions.

Do not guess the mechanism — cycle 51 deliberately did not. **Instrument it:** have `start()`
stamp each mock instance with a random id and expose it (`/__mock/whoami`), and have the failing
probes print which instance answered them alongside the fixture they expected. One battery with
that in place says whether this is a port collision, a seed that did not take, or something else.
If it is real it invalidates any red from a six-way run until it is fixed, which makes it the most
load-bearing open item this session has.

**Still out of lane:** js/58 selects the B2C page on `revenue_way` alone; js/41 shares the
`finExclusionCheck` fail-open; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks` until its 2500 ms stopwatch becomes a condition.

## Watch cycle 52 — cycle 51's hypothesis was wrong, and the code says so without instrumenting anything

Cycle 51 called the cross-probe-contamination theory "the most load-bearing open item this
session has" and asked cycle 52 to instrument `mock-supabase` — stamp each instance, expose
`/__mock/whoami`, run batteries until it reproduced. **That instrumentation was not built, because
reading the two probes answered the question first.** Building a diagnostic for a hypothesis the
source already refutes is the same waste as raising a poll budget against the wrong diagnosis
(cycles 38–41).

**The evidence, in the probes themselves.**

`probe-csv-injection` calls **`start(PORT)` with no seed at all** — it runs on the default tables
on purpose. So "Test Company 2" and 6554 are not another probe's world leaking in; they are its
*own* world, the one it chose. It then plants hostile rows into `FIN._csvRows` in the page and
reads the export back **positionally**:

    const creditRow = dataLines[HOSTILE.length];

Under load the app repopulates `FIN._csvRows` before the export runs, the planted rows are gone,
and index `HOSTILE.length` lands on an ordinary seeded invoice. That is cycle 37's lesson exactly
— *a fixture written into page state that the app owns and refills* — and the "leak" was a
positional read finding a real row where it expected a planted one.

`start()` also rules the rest out on inspection: the seed is a **full replace** (`TABLES[k] =
seedOverrides[k]`), and `listen()` has carried an `error` handler since 2026-09-03 that prints the
port and **exits 1** on EADDRINUSE. A port collision cannot present as quiet wrong data; it
crashes, exactly as `probe-stress` did in cycle 48.

**So: no evidence of cross-probe contamination, and the two reds have separate, ordinary causes.**
Recorded plainly rather than left as a standing suspicion, because an unexplained load-only red
that stays on the list quietly devalues every red beside it.

**Fixed, in this session's own probe.** `probe-restore-scope-attacks` waited a flat 2500 ms after
each delete/restore, so under load "before 1500, after delete 1500" was the probe reading before
the write landed and calling it an app defect. `drive()` now takes the condition it is actually
waiting for and polls up to 30 s; each of its four calls passes its own. Still fails when it
should: sabotaging `finRestoreInv` to pick the *oldest* deletion batch reddens it with the August
line resurrected and the money out by 95,000.

**Battery: 85 / 87** — both reds known and expected (`probe-expense-report-capture`'s
settings-arrival guard, which fails loudly and says it is a fact about the run rather than the
app; and `probe-premortem-attacks` check H).

### Open for cycle 53

**`probe-csv-injection`'s positional read — out of lane, so a write-up.** Two lines would settle
it: plant the hostile rows and then assert they are still in `FIN._csvRows` immediately before
firing the export (a setup step is a claim — cycle 45), and locate the credit-note row **by its
client_group** rather than by `dataLines[HOSTILE.length]`. Until then it will keep reporting the
app as broken on a busy machine.

**Still out of lane:** js/58 (`revenue_way` alone); js/41 (`finExclusionCheck` fail-open);
`probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks` until its 2500 ms stopwatch becomes a condition.

## Watch cycle 53 — the money-entry screen on a phone: no defect, and two checks of mine that could not have found one

**New ground, and the app passed.** Every riyal in Finance arrives through the importer, and its
preview is the last thing anyone reads before pressing Confirm. Cycle 47 found a dialog whose Save
button was unreachable at 390px; nothing had ever asked the same question of the screen that
actually writes invoices. `probe-import-preview-phone` (port **8723**) drops a real Direct Payments
export that holds four rows back — so the preview is long by design — and checks, at 390×844 and
820×1180, that the counts and reasons render, that the Confirm button passes a real actionability
check, that nothing in the preview overflows without somewhere to scroll, and that the page does
not scroll sideways. **All green on both viewports.** No defect here.

**Three things this cycle wrote that were wrong, each caught before it could be believed.**

1. **The setup called a function that does not exist.** `window.v65Ingest` is not the export;
   `window.v65IngestText(fileName, csvText)` is. The preview came back empty and a read-back
   diagnostic said so immediately, instead of four checks failing against nothing.
2. **The control demanded something the app never promised.** It required every held-back client
   by name; the app *summarises* a rule that catches several rows — "Excluded by rule 4 — 4
   invoices: no readable invoice date" — which is the better choice on a small screen. The probe
   would have reported a design decision as a defect (cycle 50's lesson, again).
3. **The Confirm-button check could not fail, and the first sabotage could not prove it.** It
   compared `getBoundingClientRect()` to the viewport and asked `elementFromPoint` what sat at the
   centre. Clipping `#finImpOut` to `height:120px;overflow:hidden` — which hides the button
   entirely from a person — left it **green**, because a clipped element still reports real
   coordinates and a rect test knows nothing about a clipping ancestor. Replaced, not patched,
   with Playwright's own actionability check (`click({trial:true})` — visible, stable, receives
   events, not covered), which is what a finger is subject to.

   And the clip was not a fair sabotage either: Chromium scrolls `overflow:hidden` boxes
   programmatically, so the button really was reachable. The honest sabotage is the real phone
   failure — a fixed bar covering the lower screen, as a sticky footer would — and that reddens
   the check by name.

**A fourth, smaller one worth recording:** the restore was verified by grepping `z-index:99999`,
which **already existed** in js/16 for the modal overlay. The marker was not unique to the
sabotage, so the check said "still sabotaged" about a clean file. Sabotage markers now carry a
`data-c53-sabotage` attribute, and the restore is confirmed by `git status` as well.

**Battery: 87 / 88.** The single red is `probe-alias-dedupe-attacks`' settings-arrival guard doing
its job — it refuses to measure a world where nothing is excluded and says that is a fact about
the run, not about the app.

### Open for cycle 54

**Still untouched since cycle 36:** notifications/reminders and the Operations board end to end —
both outside this session's lane, so they need either a lane extension or a write-up naming what
to attack.

**Still out of lane:** `probe-csv-injection`'s positional read; js/58 (`revenue_way` alone); js/41
(`finExclusionCheck` fail-open); `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

## Watch cycle 54 — a button that says it opens this invoice, and opens the list of all of them

**Found by enumerating the lane's exports and checking each against the battery.** `pdClientLink`
had **no probe touching it at all**; reading it led to its neighbour `pdInvoiceLink`, the href
behind "Open in Direct ↗" on the invoice card and every ledger row.

    if(r && r.direct_uuid) → https://payments.directksa.com/en/admin/invoices/view/{uuid}
    otherwise             → https://payments.directksa.com/en/admin/invoices
                            .replace('{invoice_no}', …)   ← a template with no placeholder in it

The fallback default contains no `{invoice_no}`, `{dpin}` or `{client_id}`, so every `replace()`
is a no-op and the href is the generic invoice **list**. **Measured against the live database on
2026-09-08: of 46 live invoices, `direct_uuid` is present on ZERO.** The deep-link branch has
never run in production. The button has been opening the list of every invoice, for every invoice,
every time — while saying it opens this one. Somebody following it to check an amount lands on a
list of hundreds and searches by hand, or reads whichever invoice is on top.

**The href was deliberately not invented.** Adding a `?q=` or `/search/` that the real system may
not support would be guessing at another product's behaviour to make a link look right — the one
thing this project never does (M8: never fabricate a number, or here a route, to fill a gap). The
list page is where it really goes; what changes is that the button **says so**: `Find in Direct ↗`
/ `ابحث عنها في دايركت ↗` when there is nothing to deep-link with, and the original label
untouched when there is. A workspace that has configured a template carrying `{invoice_no}` keeps
both its deep link and its original wording — `pdInvoiceLinkIsDeep()` tests the template, not just
the uuid.

`probe-direct-link-honesty` (port **8724**) holds it: the deep-link control, the honest fallback,
the configured-template case, and that the invoice number is on the card beside the link so a
person sent to a list has the thing to search for. Sabotage — restoring the unconditional label,
marked `c54sab` so the marker is unique to it — reddens the run; restore confirmed by marker
count **and** md5.

**Battery: 89 / 89 — every probe that can fail, green.**

### Open for cycle 55

**The enumeration is worth finishing.** This cycle checked twelve exports and stopped at the first
unexamined one that led somewhere. The full list is in the commit; `pdClientLink` itself is still
untouched by any probe — it is *used* only by js/27 (out of lane) but *defined* here, and it has
the same shape of defect available to it: `pdClientLink(undefined)` returns
`…/customers/` with an empty id and no indication.

**Also worth asking now:** `direct_uuid` is null on every live invoice, which means the importer
has never populated it. If Direct Payments' export carries a uuid column that is being dropped on
import, that is a bigger fix than the label — and it would make the deep link real rather than
honest about being absent.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

## Watch cycle 55 — "No proposal with ref X", said about one that exists

**The enumeration finished, and it pointed at the right thing.** Of every `window.*` export in
this session's lane, five had no probe driving them: `finF`, `finQ`, `finRBM`, `finOpenProposal`,
and cycle 54's own `pdInvoiceLinkIsDeep`. `finOpenProposal` is the one with something riding on
it — the jump from an invoice to the proposal that priced it.

    var o=(DB.offers||[]).find(x => (x.ref||'')===ref);
    var m=document.getElementById('finModal'); if(m)m.remove();      ← the card, closed FIRST
    if(o){ … } else toast('No proposal with ref '+ref);              ← stated as fact

`DB.offers` is filled by js/35 from `app_offers`, on **the same lazy schedule as the exclusion
list** that cycles 41–43 were spent on. Before it lands the list is empty, and this answered in the
definite: the proposal does not exist. Same mistake as `finExclusionCheck()`'s null meaning both
"not on the list" and "no list yet" — **except this one says the wrong half out loud, to a person,
as a fact about their own records.** And it removed the card before looking, so the answer arrived
with nowhere to go back to: the invoice being read was gone, and the person was told, wrongly,
that its proposal was missing.

**The discriminator needed no network read.** This button only exists when the invoice carries a
`proposal_ref` — so a proposal was created at some point, and an empty offers list *here* means
"not loaded yet", not "none exist". A workspace with no proposals would have no invoice carrying a
ref to click from. The card now closes only when there is somewhere to go, and the honest "no" for
a genuinely absent ref is untouched — a control holds that, because a fix that silences a true
answer is not a fix.

`probe-proposal-link-honesty` (port **8725**) drives the ordinary-Tuesday version: open Finance on
a slow morning, click an invoice, press "Open proposal" before `app_offers` has arrived. Sabotage
(`c55sab`, a marker unique to it) reddens it; restore confirmed by marker count, md5 and
`git status`.

**And cycle 54's open question is settled, from the source and the live data rather than guessed.**
`direct_uuid` is in js/65's `WRITABLE_INVOICE_FIELDS`, so it would be carried if a file supplied
it — **but nothing supplies it**: no CSV column maps to it, no builder assigns it, and the real
Direct Payments invoice-export signature has no uuid column. Live on 2026-09-08: `direct_uuid` is
present on **0 of 46** `finance_invoices` and **0 of 33** `finance_transactions`. The deep-link
branch fires only if someone writes a uuid in by hand. It is **kept, not deleted** — it is correct,
and the day that export carries an id it starts working — but js/16 now says so where the next
reader will see it, so nobody reads it as "the deep link works".

**Battery: 89 / 90.** The one red is the 120/108 alias-twin label, load-only and open since cycle 38.

### Open for cycle 56

**For the owner, when there is something worth interrupting for:** a real deep link from an invoice
to its record in Direct Payments needs that export to carry a uuid or id column. It does not today,
which is why the button says "Find in Direct" rather than "Open in Direct". Worth one question to
whoever maintains that export — it is a small change there and a large convenience here.

**Still uncovered by any probe:** `finF`, `finQ`, `finRBM` — the ledger's filter, quarter and
report-builder-metric setters. All three are one-line state writes followed by `render()`, so the
risk is lower than `finOpenProposal`'s, but "lower" is not "none" and none of them has ever been
driven.

**Still out of lane:** notifications/reminders; the Operations board; `probe-csv-injection`'s
positional read; js/58; js/41; `probe-premortem-attacks` check H — do not raise the budget;
`probe-guardrails-both-halves-attacks`' 2500 ms stopwatch.

## Watch cycle 56 — the dialog that waited for one of its two lists

**The enumeration's tail closed honestly: two of the three uncovered names are dead code.**
`finQ` is called from nowhere and `FIN.f.quarter` is read by nothing — one occurrence in the whole
tree, its own definition. `finF` is called from nowhere either. They are not "low-risk setters
not worth a probe"; they are unreachable, and a probe for them would guard something no person can
touch. `finRBM` has one caller (the report-builder checkbox) and stays open.

**Then the real one, found by grepping the lane for definite claims.** `v62OpenGrouping` — the
screen that decides which client profiles are grouped under one company, the same family of
decision as cycles 40 and 43 — already knows how to wait for data:

    if(!window.CP||CP.rows==null){ cpLoad(function(){ v62OpenGrouping(); }); return; }

It does that for the **profiles**. Nothing did the equivalent for **DB.businesses**, which fills
the "group them under" dropdown. So the dialog opened onto an empty list, let the person choose
profiles and type a canonical name, and only at Save said *"Choose the company to group them
under"* — an instruction nobody can follow, about a list that was never there.

Refused now, with what is true either way: there is nothing to group under yet, either because the
list has not finished loading or because none is marked as a client. One refusal covers both, which
is why it does not try to tell them apart. `probe-grouping-dialog-readiness` (port **8727**) holds
it; sabotage (`c56sab`) reddens it; restore confirmed by marker count, md5 and `git status`.

**A probe was written this cycle and deleted, and the integrity gate is what noticed.**
`probe-empty-filter-honesty` was built on the premise that a quarter filter matching nothing leaves
the ledger silently empty. Its own control refused to conclude anything — the Ledger tab reads
`finance_transactions`, not the invoices it seeded — and the premise died with `finQ` turning out
to be dead code. It was left in the tree undeclared, and `check-probe-integrity` failed the run
with *"1 probe in neither battery.txt nor battery-excluded.txt — nobody has decided whether these
run"*. Exactly what that gate exists for. Deleted rather than excluded: a probe that never passed
its own control, built on a premise that turned out false, should not sit in the tree looking like
coverage.

**The question it was asking is still good, and is not answered:** when a filter excludes every
row, does the screen say so, or does it read as "you have no invoices"? It needs the right surface —
the invoice-backed views, not the transaction-backed Ledger — and a filter that something actually
reads.

**Battery: 91 / 91 — every probe that can fail, green.**

### Open for cycle 57 — CLOSED, see cycle 57 below

Both items were one defect: the Report Builder's metric checkboxes, reached through `finRBM`.

---

