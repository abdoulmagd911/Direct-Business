# Build brief · Builders B and A · The Finance screens (P4-4 and P4-5)

From the Design lead, 7 Oct 2026, at the Architect's and the oversight's request. It turns the owner's money rules of 5–7 Oct
(V610–V623, the opening table of `TECH-SPEC.md` §3.6) into what each Finance screen shows. **Builder B** (screens lane) builds
the screens: no schema, no RPC. **Builder A** gives them the views and doors they read and write; section I says what the
screens need from A, in outcomes, so A names the functions. The screens read A's views (P4-2: `money_row`, `invoice_cost`,
`late_change`, `tender_use`, `month_close`) and use the doors of P4-1 and P4-1b. Everything here is built behind Finance's
module switch (V513), and Finance does not open to the team until the hand-entry round of V622 has run. All figures in this
brief are made up (rule 7).

Where this brief and an older line of the plan or of the canvases differ, **V610–V623 win**; section G lists the old lines.

## A · The ten things the screens must show

Each item says where it shows, the exact words, and a made-up example. A word in **bold** is on screen as written.

1. **The month by created date, and a note on a closed month** (V610, V620).
   - Every month, tile, filter and chart uses the unit's **created** date. The paid date is a column beside it and feeds
     "days to pay" only.
   - A closed month shows a chip **Closed** with its day, and its figures never change. The finance lead (Full on Finance)
     closes it from the month's row. The confirm names the month and says "It will never change. Later news becomes a dated
     note." This is the one action here with no Undo, because V620 says a closed month is never reopened.
   - Anything that happens after the close adds one dated line under the month, behind a chip **Late changes · 3**, with the
     heading **Changed after close**. The lines are **Paid late** (unit, paid date, +riyals), **Cancelled after payment**
     (unit, date, −riyals) and **Cost approved later** (unit, date, ±riyals). The next report lists the same lines under
     "Added to earlier periods" (V500).
   ```
   Month                      Revenue    Cost     Profit   Provisional
   Sep 2026  Closed 7 Oct     1,020,000  860,000  160,000  of which 24,000
     Late changes · 3  ▸ Paid late +9,400 · Cancelled after payment −3,100 · Cost approved later −600
   Oct 2026  (open)             410,000  350,000   60,000  of which 31,000
   ```
2. **Profit with the Provisional amount beside it; Final or Provisional on every unit** (V611, V621).
   - Profit counts **every paid unit**. In the same row as each of Revenue, Cost and Profit, the tile says **of which
     Provisional** with the amount and the number of units. It is never a footnote, never behind a toggle, never left out;
     with none it reads "of which Provisional 0".
   - Every unit row and every invoice page carries a chip **Final** (every expense Approved, or every product on it is on the
     no-supplier-cost list, cost 0) or **Provisional** (no approved expense yet, or one still pending). A unit's cost is its
     approved expenses so far, **0** when there are none; never empty, never "—". The flagged estimate of D23 stays apart and
     never enters Cost or Profit.
   - There is no "Sales" figure and no "profit with estimates" figure (V611, V419).
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
5. **Channel, and who is credited** (V613).
   - Every transaction row has a chip **Commercial**, **Direct** or **Promo**, a filter chip **Channel**, and a Channel box in
     New invoice and Edit. Until the owner answers Q49 the screen follows its recommended answer: an untagged unit reads
     **Direct**, the account manager tags their own bookings Commercial, and a person with Full on Finance may change it.
   - An individual (no organisation) is listed under **Individuals**, counted, and credited to nobody. Choosing **Commercial**
     on one asks "Who is credited?" with one person picker before it saves; that writes a one-share credit.
   - An organisation's unit is credited to its account manager on the created date, as before.
6. **A tender: signed value as sales credit, and "consumed so far"** (V614, V619).
   - A block **Tender** on the tender's client page and in Finance: **Signed value** (made up: 1,200,000 SAR) with the line
     "Sales credit to the account manager in Sep 2026. Not revenue.", then **Consumed so far** 450,000, **Left** 750,000 and a
     thin bar.
   - Revenue and profit come only from its paid transactions, in the month each was created. They are never added a second
     time on top of the signed value.
   - A tender that is only Applied shows a chip **Applied** and no money. Use above the signed value is listed in a warning
     row ("450,000 above the signed value").
   - The Overview has one separate line under the tiles: "Tenders signed this month: 1 · Sales credit 1,200,000 SAR (not in
     Revenue)".
7. **The "fee on monthly invoice" unit** (V616, V623). When a credit client's billing invoice carries more than the
   transactions it links, the excess is a unit of its own in the billing invoice's month. It has a kind chip **Fee on monthly
   invoice**, revenue equal to the excess, and a Final or Provisional chip like any unit. The billing invoice itself still
   shows no revenue. A shortfall is a failed check ("1,200 less than its transactions"), never counted. A billing invoice is
   linked to its transactions by Payments' own link, else by a person ticking an **amount** proposal ("these 4 add up to
   73,450") — never by matching names.
   ```
   INV-B-0203  Billing   Org Alpha   4 transactions 73,450 · total 76,950
               Fee on monthly invoice 3,500 SAR · counted as revenue in Sep 2026
   ```
8. **The line "Commissions paid outside Payments are not included."** (V612), exactly this sentence, in small muted type
   beside the totals on the Overview and under the totals row of Invoices.
9. **Edit, add and remove on imported rows** (V622), for a person with Full on Finance.
   - A row chip says **Imported**, **Typed** or **Imported · edited**.
   - **Edit** on an invoice, a line or an expense. The edited field is the person's, and a later import never overwrites it.
     Instead Invoices gets a filter chip **Differs from import · 2** and the invoice page lists each difference with **Keep
     mine** and **Use import**.
   - **Remove** asks in the app's box, names the item and says "Hidden, not deleted. A later import will not bring it back."
     It archives (V97) and is restorable from Recently deleted.
   - **Add** a row beside imported ones: New invoice, **Add line**, **Add expense**. Its chip is **Typed**.
   - Every change toasts with Undo and is logged.
10. **The hand-entry round** (V622). Before Finance opens, the owner (or QA with made-up copies) types a few invoices, adds,
    edits and removes lines and expenses, and sends every defect back in one list.
    - Screen side: while Finance is on for admins only, a one-line banner on every Finance page says "Hand-entry round: type,
      edit and remove freely. Finance is not open to the team yet." It goes away when the switch opens Finance to the team.
    - The round's checklist is in section F, test 12, so the round and the acceptance test are the same walk.

## B · Screen by screen, and the manual work each replaces (V508)

The canvas boards are the Screens canvas's 9 to 9f and 3e. They were drawn on 28 Sep, before V610–V623: follow this brief where
a board shows the old rule (list in G). The manual work named here is the Design lead's reading of V618 and V622 and the Finance
notes; **the oversight confirms the wording when the card is signed.**

| Screen (route) | What a person does there | Manual work it replaces |
|---|---|---|
| Overview (`/finance`, board 9d) | Reads the month: Revenue, Cost, Profit with Provisional beside; Closed and Late changes; income by service; what is held back | The month-end revenue, cost and profit sheet built by hand from the Payments exports |
| Invoices and the invoice page (9b, 9c) | Finds a unit by either number; sees Final or Provisional; edits, adds, removes | Searching the Payments export by hand, and a side sheet of which invoices are paid and which costs are approved |
| New invoice (`/finance/new`, 9) | Types an invoice, its lines and expenses; adds the missing | Corrections and missing invoices kept in a sheet beside the Payments export |
| Collections (9e) | Sees who has not paid and chases | The unpaid-invoices list kept for chasing |
| Sales by code (9f) | Sees sales by discount or campaign code | The discount-code sales sheet |
| A client's Finance tab (3e) | Sees that client's figures, credit and tenders | Asking finance for one client's year to date |
| Settings › Finance | Names the products with no supplier cost, services, status words, channels | Rules kept in someone's head or in the code |

Changes to the boards, in short:
- **9d Overview.** Tiles get "of which Provisional" beside each; delete the caption "Final cost only". The months table is by
  created date, gains the Closed chip and the Late changes line, and its Cost status column becomes the Provisional amount.
  Add the commissions sentence (A8) and the Sales credit line (A6).
- **9b Invoices.** One "Ref" column becomes **Transaction no.** and **Tax invoice no.**. Add the Channel chip and filter, the
  Final or Provisional chip on every row, Individuals as a group, the Fee on monthly invoice rows, the commissions sentence and
  the row source chip.
- **9c Invoice page.** The header shows both numbers. The Billing and tax invoice block shows the fee line (A7). Credit shows
  the channel rule (A5). Edit, Add line, Add expense, Remove sit in one place.
- **9 New invoice.** Two number inputs, a Channel box, a service on every line (V483), the side panel shows Provisional beside
  Profit. Save and new, Duplicate and the keyboard stay as drawn.
- **9e, 9f.** Two numbers in Collections. Nothing else changes.
- **3e Client tab.** Remove the wallet (A4). Add the Tender block (A6). Figures follow A2.
- **Settings › Finance.** Add the no-supplier-cost product list and the channel list as lists any person with Full on Finance
  edits, logged and undoable (V621, V613). Never typed into code.

## C · Words

- On screen: **Revenue · Cost · Profit** (V73), **Provisional · Final**, **Closed**, **Late changes**, **Changed after close**,
  **Transaction no.**, **Tax invoice no.**, **Channel**, **Sales credit**, **Fee on monthly invoice**, **Imported · Typed**.
- Never on a Finance screen: VAT (V615), "Wallet balance", "Margin", "Sales" as a figure, B2B, B2G, B2C, "Partner".
- Chips and buttons are at most two plain words. Headings and notes may be a sentence.
- **Ready** keeps one meaning on screen: the **Not yet invoiced: Ready / Pending** line (V424). Cost uses Final and Provisional
  (see G, 2).

## D · The phone (390 px first)

- Tiles stack. "Of which Provisional" sits directly under its figure, never on another card.
- The months table, Invoices and Collections become cards below 640 px: Transaction no. on the first line, Tax invoice no. on
  the second, the Final or Provisional chip and the amounts below. Late changes opens inside the month's card.
- Edit, Add and Remove are in the row's menu. Every target is 44 px. No sideways scroll anywhere.
- New invoice is one column on a phone. The keyboard-first speed of P4-4 is a desktop goal.
- The three jobs for V509: **see this month's profit and how much of it is Provisional**; **find an invoice by its tax invoice
  number and open it**; **fix one wrong amount on an imported invoice, then undo it**.

## E · The gate card, GC-5 (proposed; the oversight signs it, V508, V532)

1. **Screen and spot:** Finance (`/finance` and its tabs, `/finance/new`), already in the manager menus (V507); no new menu item.
2. **Role, used weekly:** the finance lead and managers, weekly at the least, daily at month end. Members reach it by link.
3. **What it replaces:** the table in section B.
4. **Default state:** behind its module switch, off for the team until the hand-entry round has run (V622, V513).
5. **Phone:** 390 px first; the three jobs of section D are its e2e (V509).
6. **Words:** the list in C; labels of at most two plain words.

**The ten cuts** (what the screens leave out): VAT anywhere · a wallet balance as money · any estimate inside Cost or Profit ·
a separate "Sales" figure · a billing invoice as revenue · a tender signed value as revenue · a manual "other income" ledger
(V612) · the word "Margin" · one combined invoice number · a closed month that changes.

**The 30-second rule** (owner, 1 Oct): in 30 seconds the owner can say how much profit this month has, how much of it is
Provisional, and which months are closed. A screen that fails this is EDIT.

## F · Acceptance tests (Playwright at 390 × 844 and 1440 × 900; made-up data only)

Month and profit
1. A unit created 30 Sep and paid 2 Oct counts in Sep. With Sep closed it appears under Late changes as **Paid late** with its
   riyals, and Sep's own row does not change.
2. Close month: the confirm names the month and says it never changes; after it the row shows Closed and offers no Undo.
3. Profit counts every paid unit and **of which Provisional** is in the same row, never hidden. Approving the last expense on a
   unit turns it Final and moves the figure.
4. A unit with no expense is Provisional at cost 0; one whose products are all on the no-supplier-cost list is Final at 0; one
   with every expense Approved is Final; one with a pending expense is Provisional.
Numbers, wallet, channel
5. Invoices, Collections, search, Ctrl K, New invoice and every export show **Transaction no.** and **Tax invoice no.** apart.
   Searching either finds the invoice. "Invoice number" appears nowhere.
6. A client's Finance tab shows no wallet balance. "Wallet" appears only as a kind chip, and a top-up row has no money figure.
7. An untagged individual is credited to nobody. Tagging Commercial asks who is credited and the person's figure moves.
   Direct and Promo credit nobody. An organisation's unit credits its account manager on the created date.
Tender, fee, commissions
8. A tender signed at 1,200,000 shows Sales credit in its signing month and does not change Revenue. Two paid transactions
   consume it and **Consumed so far** updates. An Applied-only tender shows no money. Use above the signed value is listed.
9. A billing invoice 3,500 above its transactions shows a **Fee on monthly invoice** unit counted as revenue. One 1,200 below
   shows a failed check and counts nothing. Linking offers an amount proposal, never a name match.
10. The commissions sentence is on the Overview and under the Invoices totals.
Doors and the round
11. Edit a field on an imported row: the chip reads Imported · edited, a re-import lists the difference, **Keep mine** and **Use
    import** work. Remove asks, names the item and archives. A re-import does not bring it back. Add puts a Typed row beside
    the imported ones. Each has Undo.
12. **The hand-entry round**, scripted as the owner will walk it: type 3 made-up invoices (one for an unknown customer), add a
    line, edit an expense, remove a line, undo each, close nothing. A practised person enters a 3-line transaction in under a
    minute. The banner of A10 shows while Finance is admin-only.
Phone, words, safety
13. At 390 on every Finance page: no sideways scroll, nothing clipped, every target at least 44 px, Provisional directly under
    its figure.
14. The three jobs of section D, scripted as a smoke.
15. A failed read is never drawn as 0 or as "nothing earned" (M27, M53). Cost 0 appears only for a unit the view says is
    Provisional or Final at 0.
16. No Finance screen contains VAT, "Wallet balance", "Margin" or "Sales" as a figure.
17. Sabotages, each seen red: `closed-month-figures-move`, `profit-leaves-provisional-out`, `one-invoice-number-column`,
    `wallet-balance-shown`, `tender-counted-as-revenue`, `individual-credited-without-commercial`, `fee-excess-not-counted`,
    `removed-row-returns-on-import`.
18. The 30-second rule: QA reads the Overview cold and says profit, the Provisional part and the closed months in 30 seconds.

## G · What the plan and the canvases still say that these rules replace

1. **Plan P4-5 and the spec's old lines:** "an empty cost shows empty, never 0" (OA4) becomes cost 0 and Provisional (V611);
   "Final cost only" on the profit tile becomes every paid unit with Provisional beside it (V611); months by paid date become
   created date (V610); "wallet balance" on the client tab goes (V617); Final "once the DPIN exists" becomes Final once all
   expenses are Approved (V611). The Architect strikes these where the plan keeps them.
2. **One word, two meanings.** "Ready" means "all expenses Approved" in V611 and "status is draft" in V424's Not yet invoiced:
   Ready / Pending. This brief keeps Ready for V424 only and says Final and Provisional for cost. The Architect may prefer to
   rename V424's line; either way one screen must not use both.
3. **Boards to redraw after this brief merges:** 9d (Final cost only, paid-date months, no commissions line), 9b (one Ref column),
   9c (header numbers), 3e (wallet), 9 (two number inputs). The Design lead redraws them on the Screens canvas once this is
   approved; builder B follows this brief, not the old boards, in the meantime.

## H · Not in this brief, and open

- The import (P4-1b), the views (P4-2) and matching (P4-3) are builder A's. The reports' Finance lines are P6.
- **Q49** (who tags the channel) is open: A5 follows its recommended answer and changes in one line if the owner answers
  otherwise. **Q51** (where off-system bookings sit in Payments) is finance's to name; any exclusion is a typed rule with a
  reason (D16, V617).
- Refunds and credit notes stay out of v1 (V423).
- For the Architect: the banner of A10 needs to know "Finance is on for admins only". If V513's switch cannot say that, the
  banner moves to the first test of the round and this brief drops the line.

## I · What the screens need from builder A (outcomes; A names the functions)

Every item is a read or a door the screens in A and B cannot draw without. Each change is logged and has one Undo, except
closing a month (V620).

1. **Rows you can edit, add and remove** (V622). Edit any field of an imported invoice, line or expense, and the field becomes
   the person's, so a later import never overwrites it. Add an invoice, line or expense beside imported ones. Remove archives
   the row (V97), and a later import never brings it back. All three need Full on Finance, and a refusal names the level.
2. **The differences list.** A read that lists, per invoice, each field where an import differs from a person's value, with
   both values, and one door per field to **Keep mine** or **Use import** (one request, one Undo). It also gives the count for
   the chip **Differs from import**.
3. **Month and close.** A door that closes a month (Full on Finance, refused while the month is still running, never
   reopened). A read per closed month that gives the closing day and person, the frozen figures and the late changes: each
   unit **paid late**, **cancelled after payment** or **cost approved later**, with its date and riyals.
4. **The period figures with Provisional beside them.** For any period, segment and filter: revenue, cost and profit over
   **every paid unit**, and next to each the Provisional part and the number of Provisional units. Each unit says Final or
   Provisional, and a unit's cost is its approved expenses so far, 0 when none (V611, V621).
5. **Two numbers on every read and export** (V617): the Payments reference and the tax invoice number as separate fields,
   with search matching either. No read the screens use gives a wallet balance as money.
6. **Channel and credit** (V613). A door to set a unit's channel. Choosing Commercial on an individual's unit takes the
   credited person in the same request and writes the one-share credit. A read says who is credited, and an organisation's unit
   credits its account manager on the created date.
7. **Tenders** (V614, V619). A read per tender: signed value, consumed so far, left, and the units above the signed value; the
   sales credit per month and account manager, kept apart from revenue.
8. **The monthly invoice** (V616, V623). The fee-on-monthly-invoice unit comes in the same unit read as any other, with its
   kind; a shortfall comes as a failed check. A read gives amount proposals to link a billing invoice to its transactions, and
   a door to tick one.
9. **Two settings lists** (V621, V613): the products with no supplier cost, and the channels, each edited by a person with
   Full on Finance, logged and undoable, never in code or a migration.
10. **Empty is not zero.** A read that fails says so. The screens never show 0 for a failed read, and a legitimate 0 cost comes
    only with the unit's Final or Provisional chip.
