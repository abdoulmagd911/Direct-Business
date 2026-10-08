# Build brief · Builders B and A · The Finance screens (P4-4 and P4-5)

From the Design lead, 7 Oct 2026, at the Architect's and the oversight's request. It turns the owner's money rules of 5–7 Oct
(V610–V623, the opening table of `TECH-SPEC.md` §3.6) into what each Finance screen shows. **Builder B** (screens lane) builds
the screens: no schema, no RPC. **Builder A** gives them the views and doors they read and write; section I says what the
screens need from A, in outcomes, so A names the functions. The screens read A's views (P4-2: `money_row`, `invoice_cost`,
`late_change`, `month_close`) and use the doors of P4-1 and P4-1b. The tender view (`tender_use`) comes in the **next**
finance part, once #165 lands; nothing in #186 reads tenders (the Architect's answer on PR #185, 7 Oct). Everything here is
built behind Finance's module switch (V513), and Finance does not open to the team until the hand-entry round of V622 has run.
All figures in this brief are made up (rule 7).

Where this brief and an older line of the plan or of the canvases differ, **V610–V623 win**; section G lists the old lines.

## A · The ten things the screens must show

Each item says where it shows, the exact words, and a made-up example. A word in **bold** is on screen as written.

1. **The month by created date; only a fully paid unit counts; a note on a closed month** (V610, V620).
   - Every month, tile, filter and chart uses the unit's **created** date (V610 (1)). The paid date is a column beside it:
     the Invoices list shows **Created** beside **Paid**, and the paid date feeds "days to pay" only.
   - A unit counts only once its status maps to paid (V610 (2)): **Fully Paid**, **Fully Paid as receivable**, and **Fully
     Paid (Audit Required)**, which counts and is flagged. Draft, published, pending and part-paid never count until fully
     paid. A unit not yet fully paid carries the chip **Pending** on every list — the same word on every board — and is in no
     figure.
   - A closed month shows the chip **Closed 5 Oct** (always with its day), and its figures never change. The finance lead
     (Full on Finance) closes it with **Close month** on the open month's row. The confirm names the month and says "It will
     never change. Later news becomes a dated note." This is the one action here with no Undo, because V620 says a closed
     month is never reopened.
   - **The close rule (V620).** A month is closed by the 5th working day of the next month at the latest; closing earlier is allowed. September is closed on 5 Oct, which sits inside that limit. The chip always shows the day it was closed.
   - Anything that happens after the close adds one dated line under the month, behind a chip **Late changes · 3**, under the
     heading **After close**. The lines are **Paid late** (unit, paid date, +riyals), **Cancelled late** (a paid unit
     cancelled after the close: unit, date, −riyals) and **Late cost** (a cost approved after the close: unit, date, ±riyals).
     The next report lists the same lines under "Added to earlier periods" (V500).
   - The months table is newest first, so this month is the first row (the 30-second rule).
   ```
   Month                          Revenue    Cost     Profit   Provisional
   Oct 2026  Open  [Close month]    410,000  350,000   60,000  of which 31,000
   Sep 2026  Closed 5 Oct         1,020,000  860,000  160,000  of which 24,000
     Late changes · 3  ▸ Paid late +9,400 · Cancelled late −3,100 · Late cost −600
   ```
2. **Profit with the Provisional amount beside it; Final or Provisional on every unit** (V611, V621).
   - Profit counts **every paid unit**. In the same row as each of Revenue, Cost and Profit, the tile says **of which
     Provisional** with the amount and the number of units. It is never a footnote, never behind a toggle, never left out;
     with none it reads "of which Provisional 0".
   - Every unit row and every invoice page carries a chip **Final** (every expense Approved, or every product on it is on the
     no-supplier-cost list, cost 0) or **Provisional** (no approved expense yet, or one still pending). A unit's cost is its
     approved expenses so far, **0** when there are none; never empty, never "—". A single expense row with a blank status in
     the Payments export is issued and counts at its amount (V611 (3)). The flagged estimate of D23 stays apart and never
     enters Cost or Profit.
   - A unit whose cost is above its revenue keeps its negative profit, never clamped to 0, and carries the chip **Loss**
     (V414); the Invoices list has the filter chip **Loss**.
   - A tile that shows a short form (5.73M) prints its exact figure under it (5,730,412 SAR), and the parts of a tile add up
     to the tile; a gap of 1 SAR or more is named, never called rounding (P4-5, OA5).
   - There is no "Sales" figure, no "Margin" and no "profit with estimates" figure (V611, V419).
   ```
   Revenue 1,020,000 SAR      Cost 860,000 SAR          Profit 160,000 SAR
   of which Provisional 310,000 · 31 units   of which 286,000   of which Provisional 24,000 · 31 units
   ```
3. **Two numbers, two columns** (V617). The Payments reference is **Transaction no.** and the DPIN is **Tax invoice no.**
   (a dash until one exists). They are separate in Invoices, Collections, search and Ctrl K, the invoice page's header, the
   New invoice form (two inputs), a client's Finance tab and every export. No screen says "Ref" or "Invoice number".
4. **No wallet balance as money** (V617). Take out of the client's Finance tab (canvas 3e) the Wallet figure and the
   Prepaid wallet block (balance, top-ups, used). Credit limit, used, outstanding and Sent to legal stay. A wallet top-up is
   still a row with its kind chip **Wallet top-up** and its status, and it shows no money figure and is in no total.
   Bookings made outside the corporate system reach Payments only as financial transactions: they count as revenue like any
   paid unit, and nothing counts bookings from Finance rows (V617 (2)) — no Finance screen has a "bookings" figure.
5. **Channel, and who is credited** (V613).
   - Every transaction row that has been tagged shows a chip **Commercial**, **Direct** or **Promo**; an untagged unit shows
     **no channel chip** (nothing is assumed). The list has a filter chip **Channel**, and New invoice and Edit have a Channel
     box. Until the owner answers **Q49**, the channel is set by a person with Full on Finance, not by the account manager.
   - An organisation's unit is credited to its account manager on the created date, whatever its channel.
   - An **individual** (no organisation) is listed under **Individuals** (the group heading is that one word), counted, and
     credited to nobody unless tagged **Commercial**. Choosing Commercial on one opens a single picker **Credit to** (one
     person) before it saves; that writes a one-share credit.
   - The credit rail on the invoice page shows chips only: the person, the channel, the month.
6. **A tender: signed value as sales credit, and what it has consumed** (V614, V619). *The tender view (`tender_use`) is built
   in the next finance part, after #165; the card and the Overview line below are drawn now and their tests are marked
   "after #165".*
   - The **Tender** card on the client's Finance tab shows one line: **TND-26-011** · **Signed value** 1,200,000 · **Consumed**
     312,000 · **Left** 888,000, and a thin bar. Nothing else is written on the card.
   - Its signing is the account manager's **Sales credit** in the signing month; it is never Revenue or Profit. Revenue and
     profit come only from its paid transactions, in the month each was created, and are never added a second time on top of
     the signed value.
   - A tender that is only Applied shows a chip **Applied** and no money. Use above the signed value shows a chip **Over
     signed** with the amount; in the example above nothing is over, so no chip shows.
   - The Overview has one separate line under the tiles, **Tenders signed · 2026** (under a year-to-date period, never "this
     month"), with the count and the **Sales credit** in riyals, apart from Revenue.
7. **The Monthly fee unit** (V616, V623). When a credit client's monthly invoice carries more than the transactions it links,
   the excess is a unit of its own in the monthly invoice's month. It has the kind chip **Monthly fee**, revenue equal to the
   excess, and a Final or Provisional chip like any unit. The monthly invoice itself (kind chip **Monthly invoice**) shows no
   revenue. A shortfall is a failed check ("1,200 less than its transactions"), shown with the chip **Checks failing**, never
   counted. A monthly invoice is linked to its transactions by Payments' own link, else by a person ticking an **amount**
   proposal ("these 4 add up to 73,450"), never by matching names. Matching a transaction to a client goes: client ID, then
   VAT or CR number, then discount code, then contact e-mail; an unknown client ID stops there; an e-mail domain or a name is
   only a suggestion, never a match.
   ```
   INV-B-0203  Monthly invoice   Org Alpha   4 transactions 73,450 · total 76,950
               Monthly fee 3,500 SAR · counted as revenue in Sep 2026
   ```
8. **The line "Commissions paid outside Payments are not included."** (V612), exactly this sentence, in small muted type
   beside the totals on the Overview and under the totals row of Invoices. It is the one explanatory sentence the screens keep,
   because V612 orders it.
9. **Edit, add and remove on imported rows** (V622), for a person with Full on Finance.
   - A row chip says **Imported**, **Typed** or **Imported · edited**.
   - **Edit** on an invoice, a line or an expense sends only the fields that changed; an untouched **Save** changes nothing
     (V426 OA15). A field a person edited becomes theirs and a later import never overwrites it. Instead Invoices gets a
     filter chip **Differs · 2** and the invoice page lists each difference with **Keep mine** and **Use import**.
   - **Remove** asks in the app's box, names the item and says "Hidden, not deleted. A later import will not bring it back."
     It archives (V97) and is restorable from **Recently deleted**.
   - **Add** a row beside imported ones: New invoice, **Add line**, **Add expense**. Its chip is **Typed**.
   - Every change toasts with Undo and is logged.
10. **The hand-entry round** (V622). Before Finance opens, the owner (or QA with made-up copies) types a few invoices, adds,
    edits and removes lines and expenses, and sends every defect back in one list.
    - Screen side: **nothing is drawn on the screens.** While Finance is switched on for admins only (the module switch of
      V513), the Finance menu item shows only to admins; when the switch opens Finance to the team, it shows to everyone with
      the access. No banner, no note, no flag on any Finance page (the spec allows none, and the kit's check refuses one).
    - The round's checklist is in section F, test 12, so the round and the acceptance test are the same walk.

## B · Screen by screen, and the manual work each replaces (V508)

The redrawn boards are in this PR as PNGs under `docs/v2/briefs/finance-screens/` (see G, 3). The manual work named here is the
Design lead's reading of V618 and V622 and the Finance notes; **the oversight confirms the wording when the card is signed.**

| Screen (route) | What a person does there | Manual work it replaces |
|---|---|---|
| Overview (`/finance`, board FinanceOverview) | Reads the month: Revenue, Cost, Profit with Provisional beside; **Not yet invoiced: Ready / Pending**; the months table, this month first; **Needs attention**; income by service | The month-end revenue, cost and profit sheet built by hand from the Payments exports |
| Invoices and the invoice page (FinanceInvoices, FinanceInvoiceDetail) | Finds a unit by either number; sees Final, Provisional or Pending; edits, adds, removes, duplicates | Searching the Payments export by hand, and a side sheet of which invoices are paid and which costs are approved |
| New invoice (`/finance/new`, FinanceNewInvoice) | Types an invoice, its lines and expenses; adds the missing | Corrections and missing invoices kept in a sheet beside the Payments export |
| Collections (FinanceCollections, 9e) | Sees who has not paid and chases | The unpaid-invoices list kept for chasing |
| Sales by code (9f) | Sees sales by discount or campaign code | The discount-code sales sheet |
| A client's Finance tab (PartnerFinance) | Sees that client's figures, credit, invoices and tender | Asking finance for one client's year to date |
| Settings › Finance | Names the products with no supplier cost, services, status words, channels, and the import's column map (export column → field, V622) | Rules kept in someone's head or in the code |

What each screen shows, in short:
- **Overview.**
  - Tiles **Revenue**, **Cost**, **Profit**, each with "of which Provisional" beside it (A2). A short form (5.73M) prints its
    exact figure under it (P4-5, OA5).
  - One line **Not yet invoiced: Ready / Pending** (V424), apart from Revenue.
  - **Needs attention**: a strip of count chips under the tiles: **Checks failing**, **No client**, **Late changes**. Each
    links to its records. Provisional units are never "held back": they count (V611), and their amount is shown beside Profit.
  - The months table is **newest month first**, so this month is the first row (the 30-second rule). A closed month's chip
    reads **Closed 5 Oct** (with its day); the open month's row carries **Close month** for a person with Full on Finance.
  - **Tenders signed · 2026** line (A6, after #165) and the commissions sentence (A8).
  - **Payments · as of** stamp (V500): one stamp per screen, top right of the figures, covering every copied figure on it.
- **Invoices.**
  - Columns **Transaction no.** and **Tax invoice no.**, **Created** beside **Paid**, the kind chip, the channel chip (none if
    untagged) and the chip **Final**, **Provisional** or **Pending**, with the source chip.
  - Filter chips **Provisional**, **Loss** (V414), **Checks failing**, **No client**, **Channel**, **Differs · 2**.
  - **Individuals** as a group; the **Monthly fee** rows; the commissions sentence; the **Payments · as of** stamp.
- **Invoice page.** The header shows both numbers. The Monthly invoice block shows the fee line (A7). The credit rail shows
  chips (A5). **Edit**, **Add line**, **Add expense**, **Remove** and **Duplicate** sit in one place; **Duplicate** is here and
  not on New invoice.
- **New invoice.** Two number inputs, a Channel box, a **Service** on every line, defaulted from the product (V483), and a side
  panel that shows Provisional beside Profit. The kinds offered do not include Credit note (V423, out of v1). Buttons **Save**
  and **Save + new**; the keyboard stays as drawn.
- **Collections.** Two numbers, nothing else changes.
- **Client tab.** No wallet (A4). Its invoice list carries the same columns and chips as Invoices (kind chip, channel chip,
  **Created**, **Paid**, Final, Provisional or Pending). The Tender card (A6, one line) is drawn now and tested after #165.
  Figures follow A2, with the **Payments · as of** stamp.
- **Settings › Finance.** The no-supplier-cost product list, the channel list and the import's column map (export column →
  field, `finance.import_map`), each editable by any person with Full on Finance, logged and undoable (V621, V613, V622).
  Never typed into code.

## C · Words

- On screen: **Revenue · Cost · Profit** (V73), **Provisional · Final · Pending**, **Loss**, **Closed**, **Close month**,
  **Late changes**, **After close**, **Needs attention**, **Transaction no.**, **Tax invoice no.**, **Created**, **Paid**,
  **Channel**, **Sales credit**, **Monthly invoice**, **Monthly fee**, **Imported · Typed**, **Payments · as of**.
- Never on a Finance screen: VAT (V615), "Wallet balance", "Margin" (and no margin %), "Sales" as a **figure label**, B2B,
  B2G, B2C, "Partner", "Ref", "Invoice number". **Sales by code** (the tab) and **Sales credit** (the tender line) stay: they
  name a list and a credit, not a figure.
- Chips and buttons are at most two plain words. Where the Design lead's earlier wording had three, it is now two:
  **Fee on monthly invoice** → **Monthly fee**; **Need a client** → **No client**; **Differs from import** → **Differs**;
  **Save and new** → **Save + new**; **Changed after close** → **After close**; **Cancelled after payment** → **Cancelled
  late**; **Cost approved later** → **Late cost**.
- Labels the screens keep at three words or more, and why: **Not yet invoiced: Ready / Pending** (a line label whose wording is
  fixed by V424, not a chip or button); **Payments · as of** with its date (a stamp whose wording is fixed by V500); **Sales
  by code** (a tab name, kept by the owner's board 9f). Statuses such as Fully Paid (Audit Required) are Payments' own words,
  shown as data in the status column, not our labels. Everything else is two words or fewer.
- No explanatory sentence sits inside a screen. The exceptions are only those the spec allows (an empty state's one line with
  its one action, a failed read in the place of the data, confirm boxes, toasts) and the one line V612 orders (A8).
- **Ready** keeps one meaning on screen: the **Not yet invoiced: Ready / Pending** line (V424). Cost uses Final and Provisional
  (see G, 2).

## D · The phone (390 px first)

The phone boards are in this PR: `PhoneFinance` (overview), `PhoneInvoices` (cards), `PhoneInvoice` (the invoice page, with the **Undo** toast of job 3) and `PhoneChecks` (the **Checks** sheet), drawn at 390 px for a manager, with Finance reached from **More**.

- **Overview.** The tiles stack, one under another, each with "of which Provisional" directly under its figure. The **Needs
  attention** strip becomes a row of count chips. The charts become two short lists. The months table becomes cards: month ·
  revenue · profit · of which Provisional · a **Closed 5 Oct** or **Open** chip, this month first; **Late changes** opens
  inside the month's card, and the open month's card carries **Close month**. The **Payments · as of** stamp stays top right
  of the figures.
- **Invoices and Collections** become cards that **keep** the client name, the two numbers (Transaction no. on the first line,
  Tax invoice no. on the second), the kind chip, the channel chip (if tagged) and Final, Provisional or Pending, with the
  amounts below.
- **Invoice page.** The credit and checks rail becomes a sheet behind one button **Checks**.
- Edit, Add and Remove are in the row's menu. Every target is 44 px. No sideways scroll anywhere.
- New invoice is one column on a phone. The keyboard-first speed of P4-4 is a desktop goal.
- **The three phone jobs (V509) are the same three the tests use** (test 14): **see this month's profit and how much of it is
  Provisional**; **find an invoice by its tax invoice number and open it**; **fix one wrong amount on an imported invoice,
  then undo it**.

## E · The gate card, GC-5 (proposed; the oversight signs it, V508, V532)

The six answers, in the form of GC-3 and GC-4:

1. **Route(s) and spot:** `/finance`, `/finance/invoices`, `/finance/invoices/[number]`, `/finance/new` and the client's
   Finance tab. Finance is already in the manager menus (V507): no new menu item.
2. **Role and frequency:** the finance lead and managers, weekly at the least and daily at month end; the head and admins the
   same. Members reach an invoice only by a link they are given.
3. **The manual work it replaces:** the Payments export spreadsheet searched by hand, the month-end profit sheet, and the
   per-client statement asked from finance (the table in section B names each).
4. **Who sees it, and when:** on for Manager, Head and Admin when the Finance switch is on (V513); hidden from the pilot in
   stage 0. **Not in this PR:** tender consumption (next finance part, after #165) and the matching queue.
5. **Phone:** 390 px first; the three jobs of section D (see this month's profit and its Provisional part; find an invoice by
   its tax invoice number and open it; fix one wrong amount on an imported invoice, then undo it) are its end-to-end test
   (V509), plus the 30-second rule.
6. **Words:** the list in C; every label of at most two plain words (the three kept longer are named there).

**The ten cuts** (what the screens leave out, each one visible on screen): no wallet balance · no VAT · no "Ref" (two number
columns instead) · no banner of any kind · no Credit note kind in New invoice · no explanatory sentence inside a screen (but
the one V612 orders) · no "Sales" figure · no "Partner" · no Provisional unit held back (it counts, its amount beside
Profit) · no margin %.

**The 30-second rule** (owner, 1 Oct): in 30 seconds the owner can say how much profit this month has, how much of it is
Provisional, and which months are closed. A screen that fails this is EDIT.

## F · Acceptance tests (Playwright at 390 × 844 and 1440 × 900; made-up data only)

Each test names an element and the visible result it expects.

Month and profit
1. September is closed on 5 Oct (V620: closed by the 5th working day, never later). A unit created 30 Sep and paid before the close
   simply counts in Sep. A unit created 30 Sep and paid on 7 Oct still counts in Sep, and under Sep's **Late changes · 1** the
   line **Paid late** shows with its paid date and riyals; Sep's own row figures do not change.
2. Click **Close month** on the open month's row: the confirm names the month and says it never changes; afterwards the chip
   reads **Closed 5 Oct** (with the day) and there is no Undo.
3. Profit counts every paid unit and **of which Provisional** sits in the same row, never hidden. Approving the last expense on
   a unit turns its chip Final and moves the figure.
4. A unit with no expense is Provisional at cost 0; one whose products are all on the no-supplier-cost list is Final at 0; one
   with every expense Approved is Final; one with a pending expense is Provisional; a single expense row with a blank status
   counts at its amount.
Numbers, wallet, channel
5. Invoices, Collections, search, Ctrl K, New invoice and every export show **Transaction no.** and **Tax invoice no.** apart.
   Searching either finds the invoice. "Invoice number" and "Ref" appear nowhere.
6. A client's Finance tab shows no wallet balance. "Wallet" appears only as the kind chip **Wallet top-up**, and a top-up row
   has no money figure.
7. An untagged unit shows no channel chip. A person with Full on Finance tags a channel; a person without it cannot. An
   organisation's unit credits its account manager on the created date, whatever its channel. An individual's unit credits
   nobody; tagging it **Commercial** opens **Credit to**, and after saving the picked person's figure moves.
Tender, fee, commissions
8. *(after #165)* The Tender card on the client tab reads one line: signed 1,200,000, **Consumed** 312,000, **Left** 888,000, and
   shows **Sales credit** in the signing month without changing Revenue. An Applied-only tender shows **Applied** and no money.
   Over-use shows **Over signed** with the amount. The Overview line **Tenders signed · 2026** shows the count and the Sales
   credit (also after #165).
9. A monthly invoice 3,500 above its transactions shows a **Monthly fee** unit counted as revenue. One 1,200 below shows
   **Checks failing** and counts nothing. Linking offers an amount proposal, never a name match.
10. The commissions sentence is on the Overview and under the Invoices totals.
Doors and the round
11. Edit one field on an imported row and save: only that field is sent; open Edit and press **Save** untouched: nothing is
    sent and nothing changes (OA15). The chip reads Imported · edited, a re-import lists the difference under **Differs**,
    **Keep mine** and **Use import** work, and the edited field is not overwritten. Remove asks, names the item and
    archives; a re-import does not bring it back. Add puts a Typed row beside the imported ones. Each has Undo.
12. **The hand-entry round**, scripted as the owner will walk it: type 3 made-up invoices (one for an unknown customer), add a
    line, edit an expense, remove a line, undo each, close nothing. A practised person enters a 3-line transaction in under a
    minute. While Finance is on for admins only, the menu item shows to an admin and not to a Member, and no Finance page
    draws a banner.
Phone, words, safety
13. At 390 on every Finance page: no sideways scroll, nothing clipped, every target at least 44 px, Provisional directly under
    its figure. **The same walk runs again with `dir="rtl"`** (Arabic): digits stay Latin, dates Gregorian, the layout is
    logical (the drawer and the primary button on the mirrored side, no clipped text).
14. The three jobs of section D, scripted as a smoke, at 390 px.
15. A failed read is never drawn as 0 or as "nothing earned" (M27, M53). Cost 0 appears only for a unit the view says is
    Provisional or Final at 0.
16. No Finance screen contains VAT, "Wallet balance", "Margin", "Partner", "Ref", a banner, or "Sales" as a figure label;
    **Sales by code** and **Sales credit** are allowed.
17. Sabotages, each seen red: `closed-month-figures-move`, `profit-leaves-provisional-out`, `one-invoice-number-column`,
    `wallet-balance-shown`, `tender-counted-as-revenue`, `individual-credited-without-commercial`, `fee-excess-not-counted`,
    `removed-row-returns-on-import`.
18. The 30-second rule: QA reads the Overview cold and says profit, the Provisional part and the closed months in 30 seconds.
Chips, short forms, the stamp
19. A unit whose cost is above its revenue shows the chip **Loss** on Invoices and its profit is negative, not 0; the filter
    chip **Loss** lists it.
20. A unit not yet fully paid shows the chip **Pending** on Invoices, the client tab and Collections (the same word on each),
    and is in no Revenue, Cost or Profit figure.
21. A tile that prints a short form (5.73M) prints its exact figure under it (5,730,412 SAR); the parts of a tile add up to
    it, and a 1 SAR gap is named.
22. Every Finance screen with figures shows one **Payments · as of** stamp, top right of the figures, with a date; none shows
    two or none.

## G · What the plan and the canvases still say that these rules replace

1. **Plan P4-5 and the spec's old lines:** "an empty cost shows empty, never 0" (OA4) becomes cost 0 and Provisional (V611);
   "Final cost only" on the profit tile becomes every paid unit with Provisional beside it (V611); months by paid date become
   created date (V610); "wallet balance" on the client tab goes (V617); Final "once the DPIN exists" becomes Final once all
   expenses are Approved (V611). The Architect strikes these where the plan keeps them.
2. **One word, two meanings.** "Ready" means "all expenses Approved" in V611 and "status is draft" in V424's Not yet invoiced:
   Ready / Pending. This brief keeps Ready for V424 only and says Final and Provisional for cost. The Architect may prefer to
   rename V424's line; either way one screen must not use both.
3. **The boards are redrawn in this PR** as PNGs under `docs/v2/briefs/finance-screens/`: FinanceOverview (9d),
   FinanceInvoices (9b), FinanceInvoiceDetail (9c), FinanceNewInvoice (9), PartnerFinance (3e) and FinanceCollections (9e, the
   two numbers). 9f (Sales by code) is unchanged. They carry the figures used here (tender TND-26-011: signed 1,200,000,
   consumed 312,000, left 888,000).

## H · Not in this brief, and open

- The import (P4-1b), the views (P4-2) and matching (P4-3) are builder A's. The reports' Finance lines are P6.
- **Tender consumption** (`tender_use`) is built in the next finance part, once #165 lands; nothing in #186 reads tenders.
- **Q47** and **Q49**: until the owner answers Q49, a person with Full on Finance ticks an amount proposal, tags the channel
  and closes a month. A5 changes in one line if the owner answers otherwise.
- **Q51** (where off-system bookings sit in Payments) is finance's to name; they count as revenue like any paid unit (V617 (2)).
- Refunds and credit notes stay out of v1 (V423).
- The Finance menu item shows only to admins while the switch (V513) has Finance on for admins only; nothing is drawn on the
  screens (A10).

## I · What the screens need from builder A (outcomes; A names the functions)

Every item is a read or a door the screens in A and B cannot draw without. Each change is logged and has one Undo, except
closing a month (V620).

1. **Rows you can edit, add and remove** (V622). Edit any field of an imported invoice, line or expense: **an edit sends only
   the fields that changed, and an untouched Save changes nothing** (V426 OA15). A field a person edited becomes theirs, and a
   later import never overwrites it. Add an invoice, line or expense beside imported ones. Remove archives the row (V97), and a
   later import never brings it back. All three need Full on Finance, and a refusal names the level.
2. **The differences list.** A read that lists, per invoice, each field where an import differs from a person's value, with
   both values, and one door per field to **Keep mine** or **Use import** (one request, one Undo). It also gives the count for
   the chip **Differs**.
3. **Month and close.** A door that closes a month (Full on Finance, refused while the month is still running, never
   reopened). A read per closed month that gives the closing day and person, the frozen figures and the late changes: each
   unit **paid late**, **cancelled late** or **late cost**, with its date and riyals.
4. **The period figures with Provisional beside them.** For any period, segment and filter: revenue, cost and profit over
   **every paid unit**, and next to each the Provisional part and the number of Provisional units. Each unit says Final,
   Provisional or Pending, and a unit's cost is its approved expenses so far, 0 when none (V611, V621). The exact figure
   comes with every short form, and each read carries its Payments "as of" day (V500).
5. **Two numbers on every read and export** (V617): the Payments reference and the tax invoice number as separate fields,
   with search matching either. No read the screens use gives a wallet balance as money.
6. **Channel and credit** (V613). A door to set a unit's channel (Full on Finance until Q49 is answered). Choosing Commercial
   on an individual's unit takes the credited person in the same request and writes the one-share credit. A read says who is
   credited, and an organisation's unit credits its account manager on the created date.
7. **Tenders** (V614, V619) — *the next finance part, after #165.* A read per tender: signed value, consumed so far, left, and
   the units above the signed value; the sales credit per month and account manager, kept apart from revenue. Nothing in this
   part reads it.
8. **The monthly invoice** (V616, V623). The monthly-fee unit comes in the same unit read as any other, with its kind; a
   shortfall comes as a failed check. A read gives amount proposals to link a monthly invoice to its transactions, and a door
   to tick one. Client matching goes client ID, VAT or CR, discount code, contact e-mail; an unknown client ID stops there.
9. **Three settings lists** (V621, V613, V622): the products with no supplier cost, the channels, and the import's column map
   (export column → field, `finance.import_map`), each edited by a person with Full on Finance, logged and undoable, never in
   code or a migration.
10. **Empty is not zero.** A read that fails says so. The screens never show 0 for a failed read, and a legitimate 0 cost comes
    only with the unit's Final or Provisional chip.
