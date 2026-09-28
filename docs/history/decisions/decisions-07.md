**M101 — a probe that crashes before it boots is not excluded, it is revived: the crash is named,
fixed, and its expectations brought up to the app as it is today — and a test never carries a real
registered identifier, even to assert its absence.** Found 2026-09-25 (fire #260): the six document
Generator probes (scripts/generator-qa/, 316 checks over the price offer, service fees, company
profile, contract, tender and brand) had sat excluded since 2026-09-24 because their route patterns
began with `**host`, which Playwright 1.55 never matches unless the `**` is followed by `/` — so the
app never loaded and each timed out waiting for the sign-in field, and the whole generator went
unguarded for a day of fires. Fixed to `**/host` in 47 places; then 13 checks were red for three
reasons worth keeping: the footer checks expected the old hand-typed footer with the real trade name
and the real unified and licence numbers written into the test (the app draws that footer from the
company_identity registry since fire #185, and the numbers are exactly what fire #162 took out of
js/67 under rule 7 — they are now gone from the tests too, with the absence asserted as "every 7–10
digit run is a seeded value", never by quoting them); the IATA disclosure seeds used a key the live
registry never had (`iata_licence`; the app and the registry say `iata`); and the contract's reset
to template asks first since 2026-08-25, so the probe now answers the box. The footers needed
`unified_number` and `mot_licence` rows seeded, which is what they print — not the CR. Runner:
`scripts/generator-qa/run-all.sh` (the main runner with -d/-l, same retry-alone rule); sabotage-tested
(the legal line dropped from js/67's footer in a copy → the price-offer probe red). Status: ACTIVE.

**M100 — a link the app builds from a stored value goes through one builder (core-01: webHref,
phoneE164, waHref, telHref), never through a copied expression at the call site, and the builder
knows the shapes the data actually holds.** Found 2026-09-25 (fire #259) by counting the live data
and then reading the card it draws: 78 of the 108 live companies store a website with no scheme
("example.com"), and the row's "Website" tag rendered href="example.com" — a RELATIVE link that
opens this app's own address with the domain appended, never the company; 8 contacts store a phone
with no leading 0 or +, and the card rendered wa.me/5xxxxxxxx (no country code) and tel:5xxxxxxxx
(nothing a phone can dial). The same wa.me expression had been copied into three contact lists and
the send-for-review flow, and none of the four knew a bare number — the M38 family again, in links.
Saudi is the builder's default: a leading 0 or a bare 9-digit number becomes +966, 00 becomes +,
a number already carrying + or 966 is kept, a scheme already present is kept. Guard:
`scripts/qa/probe-a-link-built-from-a-stored-value-works.mjs` — records planted by the probe (never
real names or numbers), the card's website link and its six phone shapes read off the screen, the
builder's own table of a dozen inputs, and a source scan that no naive copy remains; sabotage-tested
against a copy whose builder keeps the old behaviour (three checks red). Confirmed on the live app
against the real database: the same card now links https://<domain> and wa.me/966…, nothing
written. Status: ACTIVE.

**M99 — the yes/no question the app asks before a consequential act ("Delete this invoice?",
"Archive this booking?", "Reset all data …?") reads Arabic in Arabic, owned by js/21's dictionary
through one wrapper on pfConfirm, the box every such question goes through.** Found 2026-09-25
(fire #258): the surveys of fires #254–#257 had patterns for labels, hints, hover words, notices,
reports and prompts, and none of them matched askInPage / pfConfirm — twelve questions in the core
files were English only, and read live in Arabic, the Settings reset asked "Reset all data to the
seeded version? …" in English above a Confirm button. These are the words a person reads before
deleting something. Exact texts plus four patterns (a count of invoices, a project name, a
credit-note reference, and a generic "Archive …" fallback), the wrapper put on late once js/57 has
defined the box. Guard: `scripts/qa/probe-a-question-before-the-act-speaks-arabic.mjs` — the reset
and an achievement delete asked and cancelled in both languages, the data on screen shown unchanged
afterwards, and every such literal in the source asked of the page's own v27ConfirmWord();
sabotage-tested (dictionary and wrapper absent → the three Arabic checks red). With this the
dictionary in js/21 owns every class of words a person meets: cell text and headers (M38), labels
and hints (M91), hover and assistive words (M96), notices (M97), reports and prompts (M98), and
questions (M99) — a survey per class, each guarded by its own probe. Status: ACTIVE.

**M98 — a report of what happened ("Could not delete: …", "Backup: …", "Export failed: …") and a
question the app asks in its own box ("Set a passphrase …", "Move to dunning stage?", "Copy the
offer:") are messages like any other: Arabic in Arabic, owned by js/21's dictionary, and a failure
is shown as a failure.** Found 2026-09-25 (fire #257) by surveying the sentences fire #88's probe
cannot see: it reads bare alert('…') literals, and twenty more were not bare — a fixed head with the
detail after it (alert('Could not delete: '+e), alert('Invalid file: '+…), alert('PPTX generation
failed: '+…)) or the app's own question box (v18Ask, pfPrompt). Read live in Arabic, the idle-lock
switch asked "Set a passphrase (privacy screen — NOT auth):" in English. js/21 now holds the heads
and questions (and the four detail sentences the backup screen passes after its head, or the report
would be half a message) and wraps v18Ask, pfPrompt and — put on LATE, after js/63 has replaced
window.alert with its in-page card, so the card draws the Arabic — alert itself. Two things learned
while driving it. bkFail reports through the notice box first and alert() only as its fallback, so a
head must be in whichever dictionary the path actually uses; and it passed its own ⚠ inside the text
with no kind, so the box drew "✓ ⚠ Backup: …" — a failure wearing a success mark — which now uses the
box's error kind. Guard: `scripts/qa/probe-a-report-speaks-arabic.mjs` — the idle-lock question and
a real restore of a snapshot that does not exist (its question answered, its tag refused by the
harness, its fetch empty), both languages, no tick on the failure, and every such head or question
in the source asked of the page's own v27AlertWord(); sabotage-tested (dictionary and wrappers
absent → the three Arabic checks red). Status: ACTIVE.

**M97 — the small notice that pops up after an action is a message like any other: it reads Arabic
in Arabic, and its words are owned by js/21's notice dictionary through one wrapper around the app's
single toast function — no caller writes a notice in English of its own.** Found 2026-09-24 (fire
#256) by surveying every toast() text in the layers: 31 written in English only, in the core files
and js/02 — "Please write what was achieved.", "Idle lock enabled · 5 min", "Backup destination set:
…", "Offer created from …", "Invoice marked paid · …", "Storage full - export a backup!" — and read
live, the achievement form's empty-title notice said "Please write what was achieved." in an Arabic
session. A notice is the last thing a person reads after pressing a button; every other class of
message had been made bilingual (M91 labels and hints, M96 hover words, fire #88's seventeen alert()
sentences) and this one had not. The fix follows M96's shape rather than fire #88's: instead of
rewriting 31 call sites in seven files, js/21 holds TOAST_AR (exact texts), TOAST_HEAD_AR (a fixed
head with a value after it) and two patterns (a value in the middle), and wraps window.toast once at
the moment of showing, so the callers stay as they are and no second copy of a message exists.
Guard: `scripts/qa/probe-a-notice-speaks-arabic.mjs` — two notices driven on screen in both
languages (the achievement form saved with no title; the backup destination, localStorage only),
and every toast('…') literal in the source scanned and asked of the page's own v27ToastWord(), so a
text the dictionary does not know fails the probe (44 texts today); sabotage-tested (dictionary and
wrapper absent → the three Arabic checks red). Status: ACTIVE.

**M96 — a word a person meets on hover (`title`) or a screen reader is handed (`aria-label`) is a
word like any other: it reads Arabic in Arabic, English in English, follows the language flip both
ways, and is owned by js/21's dictionary (TITLE_AR beside PLACEHOLDER_AR) — never set in English
by a layer of its own.** Found 2026-09-24 (fire #254) by reading every such attribute on the live
app in Arabic: 78 rows of the Leads table carried "Open the lead to change stage" and "Lead score
N/100" in English, 82 controls were announced to a screen reader as "Input", the sign-in eye said
"Show password" and never changed to "Hide password" while the password was showing, and the top
bar's menu button said "Open menu" — 25 words in all across seven layers, because js/21 translated
a cell's text and a placeholder after render but never an attribute. Two things about the
mechanism are worth keeping. First, a pass that skips what it already marked is wrong when another
layer rewrites the attribute afterwards: core-06's labeller writes "Open menu" 30 ms after every
render on top of the Arabic, so the pass translates a marked element again whenever its value is
English and keeps the newest English in the mark. Second, a control whose words change on a click
(js/11's eye) cannot be served by a render-time pass at all — it speaks for itself, in the page
language, and sets aria-pressed so the state is announced too. Brand and format names keep their
own, as in every other rule of this family (M38, M91). Guard:
`scripts/qa/probe-every-hover-word-speaks-arabic.mjs` — every title and aria-label on the sign-in
form, top bar, Leads and Clients read in both languages, the eye clicked twice, the flip back
checked for leftovers; sabotage-tested twice (dictionary removed → the three attribute checks red;
the eye's words removed → the eye and the English brake red). Status: ACTIVE.

**M95 — a view-only share address is nobody's to rewrite, and any layer that needs the address
the page opened at reads `window.__bootPath`, never `location.pathname`.** Found 2026-09-24 (fire
#253) by forcing the order js/03 already warned about (its own comment, round 58, and
docs/DEEPLINK-BOOT-RACE.md): js/03 rewrites the address to '/' + current 200 ms after `render` and
`DB` exist, and every later script that reads location.pathname is racing that timer. Two did. js/10
decides from it whether this is a share view at all — held back 1.5 s, the visitor lands at /today
with the sign-in form; js/79 tidies the guest view from it — held back, Finance sits in the sidebar
and the footer names a colleague, which is exactly what probe-share-view-tidy had been reporting red
under a busy machine three times in three days and green alone. And the rewrite threw the token
away even at full speed, so a refresh of a working share view landed on the sign-in form. The
person a shared link is for opens it on a phone, on the road: this was the slow-connection case, not
a corner. Now js/03 never writes the address of a share view (its `IS_SHARE` is read from the boot
address it captured itself), which alone closes the race and keeps the token for a refresh; js/10 and
js/79 read `__bootPath` first as the second line the boot-race note prescribes. Guard:
`scripts/qa/probe-a-share-link-survives-a-slow-boot.mjs` — the losing order is forced (the js/10
response held back, then js/79's) on any machine at 1x; a refresh of the shared page; an Arabic
guest footer; a control with nothing held; and the brake that a signed-in colleague's addresses
still move. Sabotage-tested three ways (guard removed: address and refresh red; guard and belt
removed: the old tree, five red; belt removed alone: green — the belt is documented defence, not a
claim). Status: ACTIVE.

**M94 — the signed-in person is called one thing on a screen: every place that writes their name
asks one helper (`displayName` / `shortName`, js/54) — nickname in the page language, else the
Arabic name in Arabic, else the full name — and no layer writes that name on its own.** Found
2026-09-24 (fire #252) by sampling the sidebar footer on the live app in Arabic: it flipped between
the person's Arabic name and their English legal name three times in five seconds, English 70 % of
the time. Three layers were taking turns — js/50 swapped the footer to the Arabic name after every
render, js/12 wrote the legal name back every 1.2 s and js/20 on every render, each "correcting"
the other. In English the footer read the legal name while the chip beside it read the nickname.
And js/54, whose one job is the nickname, painted a footer class that does not exist
(`.sidebar-foot,.side-foot`; the footer is `.side .foot`) and could never match the chip, which
shows a first word, not the full-name key it swaps on. Ten of the eleven live accounts carry a
nickname in both languages, four of them two words long ("Abu …"), so the chip showed the first word
of a legal name for everyone. The same family as M26 and the two-places-for-one-field bug: several
writers, no owner. Now js/12, js/20 and js/44 write through the helper, js/50 leaves the footer
alone, the chip shows a nickname whole ("Abu Nasser", not "Abu") and otherwise a first word, and the
chip's menu head keeps the official full name and e-mail on purpose, as Team & Access does. Guard:
`scripts/qa/probe-one-person-one-name.mjs` — footer sampled 40 × 100 ms after a render must not
move; footer and chip must agree in both languages, with and without a nickname on file;
sabotage-tested twice (js/12 writing the raw name again → the flicker returns; shortName removed →
the chip falls back to a first word). Status: ACTIVE.

**M93 — every pop-up the app builds of its own takes the keyboard, however small: opening it
moves the focus in, Escape closes it and puts the focus back on what opened it, and a keyboard
close is a close, never a press.** Found 2026-09-24 (fire #251) on the top-bar profile menu (js/44:
Team · Page access · Sign out). Enter opened it — the chip is a button — but the focus stayed on the
chip, Tab walked past the menu into the page, and Escape did nothing: the one pop-up in the app that
ignored the key. It fell between two guards, and that is the lesson: check-structure's overlay rule
reads only files that build a `position:fixed;inset:0` element, and `probe-escape-closes-every-box`
counts only boxes wider than 300 px — a 230 px menu is invisible to both. `probe-round9` pressed
Escape on it and then removed the menu by hand, so the press was never measured (trap #54 in the
loop-log: a cleanup that hides "nothing happened"). The same menu holds Sign out, which is why the
brake matters as much as the key: a close from the keyboard must run no item. Now js/44's
`closeMenu` is the one way out — it removes both listeners the open added (the outside-click one
used to leak whenever the chip itself closed the menu) and sets `aria-expanded` back; opening
focuses the first item, ↑/↓ walk, Escape returns to the chip (capture phase, so js/35's `#modal`
handler never sees it), Tab closes and lets the browser carry on from the chip. Guard:
`scripts/qa/probe-the-profile-menu-takes-the-keyboard.mjs` — red on the unpatched tree, 9/9 after,
sabotage-tested twice (keydown wiring removed; focus never moved in). Status: ACTIVE.

**M92 — a list of people that could not be loaded says so in the list; a list that is simply not
there stays quiet; and "failed" is retried before it is announced.** Found 2026-09-25 (fire
#250) by refusing the roster read (`team_directory`, a 500) on the live app. The lead editor's
"Assigned to" then offered the four names hard-coded a year ago plus "Unassigned" as if they were
the team; the achievement form (M90) offered the same; and nothing on screen said the team list
had not loaded. js/33 ended on the first error reply — `_done`, keep the fallback, say nothing.
The consequence is CLAUDE.md's own warning made real: a lead assigned to a stale name drops out of
its real owner's "Mine" and nothing says why. The quietly-wrong-list family (M27, M74), one level
below the screen: the list itself was wrong and looked fine.
Three answers the roster can give are told apart now. **Failed** — an error reply or a network
failure — is retried by the interval js/33 already had (ten tries), and if it stays failed it is
recorded (`__TEAM_FAIL`) and **every people list puts a disabled first option in the page language:
"⚠ The team list did not load — these names may be out of date."** A notice in the list, not a
name: it cannot be chosen. **Absent** — a "relation does not exist" reply, or 200 with nothing,
which is what the harness answers for a view it does not hold — keeps today's silent fallback, so
the mock and every older probe are untouched; that brake is checked, because a warning that fires
whenever the roster is merely missing would be furniture in every test and noise for nobody.
**Loaded** — rows — clears the record and re-renders, so a roster that fails twice and then answers
loses the warning on its own. One state function, `teamRosterState()` (loaded | failed | loading),
and one option builder, `teamRosterWarnOption()`, live in js/33 beside the roster; core-02's
`#f_assign` and core-10's three member lists (`rptRosterWarn`) prepend it. Found in the same drive
and fixed in the same commit: that dropdown's "— Unassigned —" placeholder was English in Arabic.
Guard: `scripts/qa/probe-a-failed-roster-says-so.mjs` — five runs (refused in both languages,
served, absent, refused twice then served); two sabotages: the failure never recorded (checks 1–4,
7), absent treated as failed (check 6 alone).
*Date: 2026-09-25, js/33-v56-ownership-real-users-own-leads-clients.js, js/core/core-02-leads.js,
js/core/core-10-v29-reports.js. Status: ACTIVE.*

**M91 — every form the app opens is driven in Arabic, not the ones somebody happened to touch; and a
word the dialog pass does not know goes into its list, once, for all forms.** Found 2026-09-25
(fire #249). #243 and #248 each found ONE form that had stayed English inside `#modal`, a round
apart, by accident of where the sweep happened to click. So this round opened every form the app
builds with `openModal` — sixteen, live, in Arabic — through their own functions, and read the
labels. Most were already Arabic: js/21's dialog pass translates a label by its exact text and it
knew those words. What it did not know was the English left: **New project** (the title and
START / END / BUDGET), the service-fee generator (VALIDITY), the **three import previews** (BOOKING
REF, PROVIDER / GDS, PNR, PASSENGER; SUBTOTAL (PRE-VAT), VAT RATE, BUYER VAT, LINE ITEM
DESCRIPTION), the airline editor's GDS label, and the English example hints on the same forms.
Booking, invoice and payment forms need a record and the mirror pages hold none, so nobody can
reach those today.
The fix went where #243 put the Credit Pool's words — js/21's own `V27_AR` and `PLACEHOLDER_AR` —
so one file grew instead of five, and the next unknown word has one place to go. **What is not
translated, on purpose:** brand names, codes and format names. js/21 already states that WhatsApp
keeps its own name and that the provider form's EMD chip stays a code (fire #64); PDF, PPTX and the
example codes (RUH-LHR-RUH, Y / J, a VAT-number pattern) are the same in both languages. A first
version of this round added an Arabic for WhatsApp and one for EMD, and the file's own rules took
both back out — read the file before adding to it.
Also learned, again: a `<label>` grep overstates. The SOP editor is full of literal English labels
in the source and was fully Arabic on screen; the achievement form was not. **Only the live count
is a finding.** And an instrument note for whoever repeats this: close a form the way a person does
(Cancel) — emptying `#modal` between forms destroys its shell and every later form reads as
"could not open" (trap #52).
Verified live in both languages on the real app.
Guard: `scripts/qa/probe-every-form-speaks-arabic.mjs` — opens eight forms in Arabic and English;
two sabotages: the new label words removed (checks 1–4), the new hints removed (check 5 alone).
The six older modal-Arabic probes stayed green.
*Date: 2026-09-25, js/21-v27-arabic-column-header-stat-label-transl.js. Status: ACTIVE. *Addendum 2026-09-24 (fire #255):* the same rule reaches the HINTS inside the boxes on the
editors the sixteen-form sweep did not open. A survey of every placeholder in the layers found 50
set in English with no dictionary entry; read live in Arabic, the airline editor showed 19 of them,
the provider editor 8, the offer editor its passenger example. Half are codes and brand names that
read the same in both languages (A320, RUH-LHR-RUH, Y / J, Amadeus / Duffel, SV-1234567, SA…) and
stay; the 30 words went into PLACEHOLDER_AR — one dictionary, the existing pass, nothing new.
Guard: `scripts/qa/probe-every-hint-speaks-arabic.mjs`, which also learned that a dialog read must
first confirm a NEW dialog opened (an opener that silently does nothing leaves the previous box on
screen, and its hints read as the new form's).*

**M90 — a list of people is the live roster, never a literal; a saved name outlives the roster;
and a form chooses its words where it is built.** Found 2026-09-25 (fire #248), driven live in
Arabic: Reports › Achievements › "＋ تسجيل إنجاز" opened a form titled **"Log achievement"** with
seven of its eight labels in English and English placeholders, and a "Team member" list of **four
hard-coded names plus "Other"** — while the team has eleven accounts and the app has kept a live
roster since js/33 (`teamList`). Seven colleagues could only ever be logged as "Other". The same
literal fed the Achievements filter and the report's "One member" scope. The filter LOOKED partly
Arabic because js/21's option pass re-labels those four names on screen; it never reaches a form
in `#modal`, which is why the form stayed English for a year of Arabic work.
Three halves to the rule. **People come from `teamList()`** — the one roster js/33 loads from
`team_directory` — so a list of colleagues is never a literal again; the old literal stays only as
the fallback for a session where the roster has not loaded. **A name a saved entry still carries
is kept in the list** even when it is no longer on the roster: Reports data is browser-local and
an entry logged under a person who has since left must keep its person, not be silently re-pointed
at the first name in a new list (rule 5 — never destroy real data — applied to a dropdown).
**"Other" keeps its stored value and only its label changes** («أخرى»), so nothing already saved
under it stops matching. And the form's title, labels and placeholders are chosen in core-10 with
the file's own `rptAr`, not left for a word list that cannot see them.
One more thing learned the hard way in the same round: the report's scope options already had
Arabic in js/21 («القسم كاملًا»), and choosing my own wording for the same option put an existing
guard red — **when a word already has an Arabic in the js/21 list, that is the Arabic**.
Verified live: title and all eight labels Arabic, eleven real names in the form and the filter,
«أخرى» last, the English form unchanged.
Guard: `scripts/qa/probe-an-achievement-names-a-real-colleague.mjs` — plants its own roster
(`window.__TEAM`, which js/33 reads first) and one saved entry under a name not on it; three
sabotages: the legacy list back, the legacy-name merge removed, the labels back to English.
`scripts/qa/probe-reports-phone-ar.mjs` stayed green once the wording was aligned.
*Date: 2026-09-25, js/core/core-10-v29-reports.js. Status: ACTIVE.*

**M89 — a filter chip says what it scoped, beside the chip, and says how each row was decided.**
Found 2026-09-24 (fire #246), driven live with the Tenders chip pressed on Finance. The tab-bar
header still read **"46 invoices · data through 2026-08-20"** — it is the LEDGER's extent, and
several probes pin that wording — while three lines down the cost warning read **"5 of 5 invoices
in this period"**. One screen, two counts, for a reader who had just asked for Tenders: the money
tiles followed the chip, no count beside the chip did. M74 again — a number true of what it counts
and false to its reader — on the money page.
And `finSectorBasis()` had no call site. It was written on 3 September "so the page can show it
rather than mixing the two silently", and nothing showed it: under B2B one live invoice sits there
**by default** — its client has no profile and no payment terms — and nobody could see that.
The rule has two halves. **A pressed chip gets one line beside it that says what it scoped**, on
the same rows the tiles are made of (`finPeriodTotals`' rows), so the number can never drift from
the tiles: "5 of 46 paid invoices are Tenders". **And that line says how each row was decided** —
the client's profile, its payment terms (the fallback for a client with no profile), the service
itself (School Commission → Academies), or nothing at all (no profile, no terms → B2B by default)
— so a reader can tell a decided row from a defaulted one. Nothing under "All sectors": the line
answers a question, it is not furniture. **The header is deliberately left as the ledger's own
count** — it is true and several guards depend on it; the fix is the missing line, not a changed
header — and that is checked as a brake, not assumed.
Verified live: Tenders "5 of 46 … decided 5 by the client's profile"; B2B "41 of 46 … 40 by the
client's profile, 1 by default"; the header unchanged under every chip; Arabic right.
Guard: `scripts/qa/probe-a-sector-chip-says-what-it-scoped.mjs` — three sabotages: the line removed,
the basis words dropped, and the header made to follow the chip (which fails the brake alone).
*Date: 2026-09-24, js/16-finance-ledger.js. Status: ACTIVE.*

**M88 — a row laid out as a grid of fixed pixel columns is a phone defect until it has a phone
rule, and the rule lives in a class, never inline.** Found 2026-09-24 (Build lane sweep, the app
driven live at 400px): every audit row on Activity & Audit — and the "Recent changes" card js/63
puts on every company card — was an inline four-column grid (150px, two fractions, the Undo column,
three 12px gaps). At phone width each text column got a few dozen pixels, so both screens printed
one word per line, lines overlapping, unreadable in both languages, on a page whose own probes had
been green for weeks because every one of them measured at desktop width. An inline `style` cannot
carry a media query, so a grid written inline has no way to stack on a phone; a class can. The rule:
a multi-column row is drawn from a class that has a `max-width:640px` rule, and a probe measures it
at 400px as well as 1500px (`probe-audit-rows-read-on-a-phone`). The same sweep found the Today
tile's "last change N days ago" counting refused page visits as changes, directly above a 7-day tile
saying "no record changed" — M76 applied to the one line that had escaped it.
*(Numbered M88 at landing: the Build lane wrote it as M84 on 2026-09-24 01:34; fires #240, #242, #243
and #244 took M84–M87 before the patch could land.)*
*Date: 2026-09-24. Status: ACTIVE.*

**Rule 8 of CLAUDE.md is amended, 2026-09-24, by the owner's word "A".** The task manager, the KPI
actuals per period, the report registration and the appraisal cycle are built inside THIS app and
THIS database (new `js/1xx` layers, new tables with RLS and audit triggers, never new keys in
`app_state`); the other Supabase project (`directksa-performance`) stops being the home of that
work and is at most a one-time read-only source of past data. Full text in CLAUDE.md rule 8; the
owner's record is Drive part 08a and the Cowork note "DECISION 24 Sep — A".
*Date: 2026-09-24. Status: ACTIVE.*

