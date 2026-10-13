# Build brief · Builder B (and Builder A for the doors) · The Pipeline screens (P5-9)

From the Design lead, 11 Oct 2026, at the Architect's request. It turns the Pipeline decisions (V80, V99, V457, V472, V481, V503, V603) and the phone rule of V630 into what the two Pipeline boards show, on a desktop and on a phone. **Builder B** (screens lane) builds the screens after the Finance screens: no schema, no RPC. **Builder A** gives them the data and doors (P5-8); section I says what the screens need from A, in outcomes. Everything here is built behind the Pipeline module's switch (V513). All names and figures in this brief are made up (rule 7): the organisations are the scenario names (Dune Foods, Waha Foods, Sadu Tech, Tala Hotels, Stay Hotels, Sahab Tech, Najd Mining) and plainly fake ones (Test Entity A to D for the government entities, Test Org A and B).

Where this brief and an older line of the plan or the canvases differ, **V99, V481, V503, V603 and V630 win**; section G lists the old lines. The boards of this brief are in `docs/v2/briefs/pipeline-screens/`.

## A · The ten things the screens must show

A word in **bold** is on screen as written.

1. **One page, two boards.** **Tenders** and **Partnerships** are the two tabs of the Pipeline page (V80). Each board has a Board and a List view; the lists carry the same stages and chips (their layout is not redrawn here). The Partnerships board has a **Side** filter, client or supplier & partner, because one board serves both (OLD-WRK-066).
2. **Tender columns, on locked meanings (V80, V481, V503).** **Identified · Preparing · Submitted · Clarification · Awarded · Signed**, in that order. **Clarification** is optional: its column is drawn with a dashed edge and the chip **Optional**, and a card may skip it. **Lost** and **Cancelled** are not columns: they sit in a strip under the board, with each card's reason. Each column header shows its count and, on a wide screen, its value.
3. **Partnership columns, on locked meanings (V99, V457).** **Contacted · Demo · Proposal · Signed · Onboarded · Handed to Product**. **Proposal** is optional (dashed, **Optional**). **Handed to Product** is the locked stage for an integration and needs the Direct ticket before a card can enter it. **Lost** sits in a strip. The names are editable settings; the meanings are locked, and the boards draw the seed names.
4. **A skipped optional stage is never recorded.** Moving a card from Demo straight to Signed leaves Proposal unrecorded. Moving past a required stage records each stage passed, on the same date (spec §3.7a). The board shows nothing extra for this; the card's history shows what was recorded.
5. **A move carries its date (V400).** A move is one request with **Happened on**: today by default, any past date, never a future one. A past date raises no notices. What a move needs, by stage: **Submitted** records the submission date; **Awarded** needs **Awarded value** and the date; **Signed** records the signing date and logs the **Contract signed** achievement itself, with one Undo for both (V503, V603); **Lost** and **Cancelled** need a **Reason** from the list; **Handed to Product** needs the ticket number.
6. **Drag on a wide screen, a sheet on a phone.** On a wide screen a card is dragged to a column; dropping it opens a small panel for the date and whatever the stage needs (board `PipelineMove`), and nothing is saved until **Move** is pressed. On a phone there is no drag: the card's menu has **Move to**, which opens the same fields in a sheet (section D).
7. **A backward move asks first.** Moving a Signed or Onboarded card back asks "Move Sahab Tech back to Demo?", needs a **Reason**, keeps the signing in the history, and never changes the organisation's status by itself (OLD-034, OLD-WRK-069). The dialog is the only sentence the board adds, and a confirm dialog may carry one.
8. **Onboarded turns the side on.** A card reaching **Onboarded** switches the organisation's side on if it was off and sets that side **Active** from that date, in the same request, with one Undo that reverts all of it (V99). The toast reads **Dune Foods is Active** with **Undo**.
9. **Every new card has a Source (V99).** **New tender** and **New opportunity** require a **Source** from the admin list; the form names it as **Required** and refuses to save without it. An opportunity card also shows its Direct ticket number when it has one, and the organisation's company size as a small chip when set (V472).
10. **Who may move what (V507, V510, §5).** Pipeline shows for the Business Development and Business Solutions teams and managers up. A person with Own on Pipeline moves their own cards; another person's card does not move and the refusal names the level (WRK-076). A viewer sees the board read-only: no drag handle, no **Move to**, no + (WRK-077).

## B · Screen by screen, and the manual work each replaces (V508)

| Screen | What it shows | The manual work it replaces |
|---|---|---|
| `PipelineTenders` (desktop) | Six columns on the tender meanings, the Optional column, the Lost and Cancelled strip, the filter chips **Owner · Due · Client · Source**, **New tender** | The tender status kept by the team in a sheet and in chat messages, asked by hand before each meeting (the oversight names the sheet) |
| `PipelineMove` (desktop) | A card dropped on **Awarded**: the drop column outlined, and the small panel with **Awarded value**, **Happened on**, **Cancel** and **Move** (nothing is saved until **Move**) | Telling the team by message that a tender moved |
| `PipelinePartnerships` (desktop) | Six columns on the partnership meanings, the Optional column, the Lost strip, the chips **Owner · Side · Type · Source**, **New opportunity** | The prospect list kept in a sheet and the Direct tickets chased by hand |
| `PhonePipeline` | The two-tab switch, three stage pills and **More**, **Filter**, the cards of one stage, the floating + | The same, from a phone in a meeting |
| `PhonePipelinePartners` | The same for Partnerships (Demo shown) | The same |
| `PhonePipelineFilter` | **Filter** open in place: search, **Owner · Due · Client · Source**, **Clear all**; the button shows how many are on | The same |
| `PhonePipelineMove` | The **Move to** sheet: the stages, **Awarded value**, **Happened on**, **Move** | Telling the team by message that a tender moved |
| `PhonePipelineBack` | The backward-move dialog with its **Reason** and **Move back** | The old habit of dragging a card back and losing the history |

The Partner card's **Related** tab lists a partner's tenders and opportunities (V95); the tender record page and the opportunity detail are the record template and are not redrawn here.

## C · Words

On screen, as written: **Pipeline · Tenders · Partnerships · Board · List · New tender · New opportunity · Filter · More · Move · Move to · Move back · Reason · Happened on · Awarded value · Source · Required · Optional · Lost · Cancelled · Clear all · Undo**, and the stage names above. Chips and buttons are at most two plain words. The seed name of the tender stage in V481 is "Clarification / negotiation"; the boards draw **Clarification** so that it stays within two words, and section H asks the Architect to confirm. Never on a Pipeline screen: "Prospect", "Meeting" (the old partnership stage names), "Leads", "Won" as a stage (a tender is Awarded, then Signed), "Margin", a raw key. The names of people and organisations are links to their pages (every record is an entity link).

## D · The phone (390 px first; V630, V229, V230)

The Tasks and Clients phone screens (#204, #205) are the pattern; the two kit pieces they use, `PhoneFilter` and the `more` flag on `Tabs`, are reused.

- **One main action:** the floating **+** (**New tender** on Tenders, **New opportunity** on Partnerships). The header's New button is not drawn below 640 px. Nothing else sits beside it.
- **Two tabs:** **Tenders** and **Partnerships**. They are only two, so there is no More at that level.
- **Stage pills:** the first three stages with their counts, then **More**, which holds the rest and is lit while a stage under it is open. One stage's cards show at a time; this replaces the columns.
- **One Filter button** shows how many filters are on and opens them below it, in place: the search, **Owner · Due · Client · Source**, **Clear all**.
- **A card:** the tender number and title (two lines at most), the government entity with its logo, the value, the date and the owner. A tap anywhere on the card opens the record. The card's **⋯** menu (44 px) holds **Move to** and **Open**; nothing completes or moves by a tap on the card.
- **Move to** is a sheet from the bottom: the stages (the current one marked **Now**, the optional one marked **Optional**, **Lost** and **Cancelled** marked **Reason**), then the stage's own fields and one **Move** button. A backward move opens the dialog of A7 instead.
- Every target is 44 px. No sideways scroll on the page. There is no drag, no bulk bar and no board of columns on a phone.
- **The three phone jobs (V509), the same three the tests use:** **see which tenders are in Submitted and open one**; **move a card to the next stage with its date**; **add a new opportunity with a Source**.

## E · The gate card, GC-6 (proposed; the oversight signs it, V508, V532)

The six answers, in the form of GC-3, GC-4 and GC-5:

1. **Route and spot:** `/pipeline` (the Tenders board and the Partnerships board, their list views), the tender record and the opportunity detail. Pipeline is already in the menu for the teams that have it (V507, V510): no new menu item.
2. **Role and frequency:** Business Development and Business Solutions members, daily; managers, weekly at the least; the head and admins the same.
3. **The manual work it replaces:** the tender status sheet and the prospect sheet, and the messages that say a card moved (section B).
4. **Who sees it, and when:** on for the two teams and managers up when the Pipeline switch is on (V513); hidden from the pilot in stage 0. **Not in this PR:** the Leads inbox (V99), the Commercial overview funnels (P5-10).
5. **Phone:** 390 px first; the three jobs of section D are its end-to-end test (V509), plus the 30-second rule.
6. **Words:** the list in C; every label at most two plain words (the stage name Clarification is the one to confirm, H1).

**The ten cuts** (what the screens leave out, each visible on screen): no Leads module · no "Prospect" or "Meeting" stage names · no drag on a phone · no bulk bar on a phone · no second action beside the + · no banner or explanatory sentence on a board (the one confirm dialog of A7 aside) · no card without a Source · no stage skipped on the record when it was optional · no future date on a move · no status changed silently by a backward move.

**The 30-second rule:** in 30 seconds a Business Development member can say how many tenders are in each stage, which one is due soonest, and move one card forward with its date. A screen that fails this is EDIT.

## F · Acceptance tests (Playwright at 390 × 844 and 1440 × 900; made-up data only)

1. **Two boards.** `/pipeline` opens on Tenders with the tabs **Tenders** and **Partnerships**; each tab lists the stages of A2 and A3 in order, each header with its count.
2. **Optional column.** **Clarification** (and **Proposal**) is drawn dashed with the chip **Optional**; the Lost and Cancelled cards are in the strip, not in a column.
3. **Drag with a date.** At 1440, dragging TND-26-014 from Submitted to Awarded opens the panel; **Move** is refused until **Awarded value** is filled; with 1,850,000 and today's date the card sits in Awarded and its history shows the date.
4. **Skip is not recorded.** At 1440, a partnership dragged Demo → Signed shows no Proposal entry in its history; Contacted → Signed records Demo on the same date and no Proposal.
5. **Past, not future.** A move dated last week is kept as that date and raises no notice; a move dated tomorrow is refused with its reason in words.
6. **Signed logs its achievement.** Moving a tender into Signed adds one Contract signed achievement dated at the signing day, and one **Undo** removes both.
7. **Lost needs a reason.** Moving a card to Lost or Cancelled without a **Reason** is refused; with one it enters the strip.
8. **Backward asks first.** Dragging a Signed card back to Demo opens the dialog; **Move back** is refused without a **Reason**; afterwards the signing is still in the history and the organisation's status did not change.
9. **Onboarded turns the side on.** Moving a card for an organisation whose Client side is off to **Onboarded** shows the toast **Dune Foods is Active** with **Undo**; **Undo** puts the side and the card back.
10. **Source is required.** **New tender** and **New opportunity** cannot be saved without a **Source**; the form shows **Required**.
11. **Handed to Product.** A card cannot enter **Handed to Product** without a ticket number; with one it can.
12. **Others' cards.** As a member with Own on Pipeline, dragging another person's card is refused and the refusal names the level; as a viewer there is no drag handle, no **Move to** and no +.
13. **Phone: one action.** At 390 on `/pipeline`, the only add control is the floating +; the header's New button is not in the page; the tab row shows **Tenders** and **Partnerships**.
14. **Phone: stages.** The three stage pills and **More** are drawn; opening a stage under **More** lights **More**; one stage's cards show at a time.
15. **Phone: Filter.** The **Filter** button shows the count of filters on and opens the search and chips in place; **Clear all** returns the count to none.
16. **Phone: Move to.** The card's **⋯** menu opens **Move to**; choosing Awarded asks for **Awarded value** and **Happened on** and moves the card; a tap on the card itself opens the record and moves nothing.
17. **Phone: reach.** On every Pipeline screen at 390 (and at 375 and 360 for QA's walk): no sideways scroll (`scrollWidth ≤ 390`), nothing clipped, every target at least 44 px.
18. **Arabic run.** Tests 1, 13 and 16 also run with `dir="rtl"`: Latin digits, Gregorian dates, the columns and the sheet mirrored, the + on the mirrored side.
19. **The three phone jobs** run end to end at 390 as one test: open a Submitted tender; move a card with its date; add an opportunity with a Source.

## G · What the plan and the canvases still say that these rules replace

1. The old board **PipelineTenders** (canvas 10): four columns with **Awarded / Lost** together, no **Clarification** and no **Signed**. Replaced by A2 and the board in this PR.
2. The old board **PipelinePartnerships** (canvas 10b): the stages **Prospect · Meeting · Proposal · Signed**. V99 replaces them with **Contacted · Demo · Proposal (optional) · Signed · Onboarded**, and V457 adds **Handed to Product**.
3. P5-9's end-to-end line "award it and log Contract signed" is replaced by V503 and V603: Awarded records the awarded value only; Signed logs the achievement.
4. The old boards' made-up organisations (several real-looking entity and company names) are replaced by the scenario and plainly fake names above (rule 7).
5. The phone's old "board of columns scrolled sideways" idea: replaced by D (one stage at a time).

## H · Not in this brief, and open

1. **The tender stage's seed name** is "Clarification / negotiation" (V481), three words. The boards draw **Clarification**. The Architect confirms the shorter seed name, or the two-word rule gets an exception, as for the Finance labels.
2. **The list views, the tender record page and the opportunity detail** follow the record template (V95) and are not redrawn here; the list views carry the stage chips of A2 and A3.
3. **The Commercial overview funnels** are P5-10, not this PR.
4. **The Leads inbox** is not in v1 (V99, V472); the owner decides after go-live.
5. **Whether a member with Own may move their own Signed card backward** (A7) is assumed yes, with the reason, until the oversight says otherwise.

## I · What the screens need from builder A (outcomes; A names the functions)

1. **Stages per kind**, each with its locked meaning, editable name, the optional flag and its order, so a column is drawn from data (P5-8).
2. **The cards of a board** for a person: each with its number, title, the organisation (a link), value, date, owner, source, and for an opportunity its ticket number and company size; filtered by owner, due, client, source, side and type; with the count and the value per stage.
3. **A move door** that takes the card, the target stage, **Happened on**, and the stage's own fields; that records the stages passed and not the optional stage skipped; that refuses a future date, a missing Awarded value, a missing Reason and a missing ticket, each with a key the screen says in words; that logs Contract signed at Signed (V603); and that returns one Undo for the whole request.
4. **The Onboarded effect** in the same request: side on, status Active from that date, one Undo for all of it (V99).
5. **A backward move** flagged to the screen, so it asks first, refused without a Reason, history kept and the status untouched (OLD-034).
6. **The Source list, the lost reasons and the ticket check** as settings the forms read.
7. **A refusal that names the level** when a person with Own moves someone else's card, and read-only for a viewer, from the server as well as the screen (WRK-076, WRK-077).
8. **Bulk assign** on the list view: one request, one Undo, each new owner told once (V472, V456). It is not offered on a phone.
