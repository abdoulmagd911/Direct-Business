# My day, personal productivity — Stage 1 (owner priority of 13 Oct)

Design lead to the Architect. Phone first (390 px), then 1440, English and Arabic. Words and boards only; no decision numbers are assigned here.
Names are made up (rule 7): the scenario organisations (Waha Foods, Sahab Tech, Najd Mining, Dune Foods, Tala Hotels, Stay Hotels).
This brief replaces the earlier draft on `v2/design-my-day-loop`, which has no PR and should be dropped.

## A. The owner's problem, in his words

He ends each day not knowing what he did, what he did not, and what moved to tomorrow or next week. He has no to-do list or follow-up in front of him,
and nowhere to jot an idea. Everything private must stay private.

## B. The loop Stage 1 builds

1. Morning: open My day, see **Overdue / Today / Next**, and under them one line, **Carried over from yesterday (n)**.
2. During the day: tick a task with one tap; capture a note, idea, checklist or reminder from the floating + in two taps. **Only me** is on.
3. Evening: **Wrap up**. Done is listed (what I did). Each not-done item gets one tap: **Tomorrow, Next week, Drop**. **Tomorrow** is already selected. One **Save**, with Undo.
4. Next morning: the Carried over line shows what moved.

## C. Built today, and what changes (read from v2/main, 13 Oct)

| Piece | Built | Stage 1 change |
|---|---|---|
| Opening view | Tabs Me / My team / Workspace, capture row, then **notes** (open = not done, due on or before today), 7 rows a block | A **Today block** on Me, above the notes: my tasks in Overdue / Today / Next; a check on every row; client chip; due date; "Nothing due today" when empty |
| Capture | Row at the top of Me (Note, Meeting, Checklist; visibility starts Only me); scrolls away on a phone | Phone: the floating **+** opens a bottom sheet with **Note, Idea, Checklist, Reminder**; Reminder asks **When**; **Only me** on; one **Save**. Desktop: the row stays and Ctrl K and the Create menu open the same sheet as a dialog |
| Wrap up | Header button; a dialog; open notes only; Carry over or Done; Turn into | A full-screen page on a phone (a side panel on desktop) with **Done** and **Not done**, tasks and captures together; **Tomorrow / Next week / Drop** per row; one **Save** with Undo |
| Next morning | Nothing | **Carried over from yesterday (n)** line at the top of the Today block |
| Reminders | Made by Turn into; listed on Me with Remove | Made from Capture; a reminder due today is a row in Today (clock icon), and ticking it is done |

## D. Boards (all in `my-day-productivity/`, one PNG each)

| Board | What it shows |
|---|---|
| `PhoneToday` | Me, 390 px: Carried over line (closed), Overdue (red count), Today, Next with "2 more" |
| `PhoneTodayCarried` | Same, with the Carried over line open (three rows, each marked with the day it came from) |
| `PhoneCaptureNote` | Capture sheet over My day: Note selected, Only me on, Save |
| `PhoneCaptureReminder` | Reminder selected: When chips Later today / Tomorrow 09:00 / Next week / Pick a day |
| `PhoneWrapUp` | Wrap up: Done (4), Not done (4) with the three buttons; Tomorrow selected by default; one row on Next week, one on Drop; the live summary above Save |
| `PhoneWrapUpSaved` | After Save: "Wrap up saved" with Undo; Today shows "Nothing due today"; the moved items are under Next |
| `PhoneTodayAr`, `PhoneCaptureNoteAr`, `PhoneWrapUpAr` | The same three screens in Arabic, mirrored |
| `MyDayToday` | 1440: Today block beside the notes and KPI rail, Capture bar with Ctrl K |
| `MyDayCapture` | 1440: Capture as a dialog, Idea selected |
| `MyDayWrapUp` | 1440: Wrap up side panel |
| `MyDayTodayAr` | 1440 in Arabic |

## E. Words (two words or fewer on a chip or button; one word for one idea)
Overdue · Today · Next · Carried over · Done · Not done · Tomorrow · Next week · Drop · Wrap up · Capture · Note · Idea · Checklist · Reminder · When · Only me · Save · Undo.
Use **Drop** everywhere (not Delete, Skip or Dismiss). **Only me** is the one word for private (the built screen says Only me; the old desktop rail says Only you and should follow).
A one-line "Carried over from yesterday (3)" is a sentence, not a chip. Dates: Gregorian, Latin digits, in Arabic too.
**Tomorrow shows the weekday when tomorrow is not a working day:** on a Thursday the button reads **Sunday** (the weekend is Friday and Saturday); the stored choice is still "next working day".
Arabic (for the owner to confirm): Overdue متأخرة · Today اليوم · Next التالية · Carried over مرحَّلة من أمس · Done تم · Not done لم يتم · Tomorrow غدًا · Next week الأسبوع القادم · Drop إسقاط · Wrap up أنهِ يومك · Capture التقاط · Note ملاحظة · Idea فكرة · Checklist قائمة · Reminder تذكير · Only me أنا فقط.

## F. Phone rules (V630, V229, V228)
- One main action per screen: My day has the floating +, the Capture sheet has Save, Wrap up has Save.
- Every target 44 px: the check, the three Wrap up buttons, the When chips, Only me, the sheet's close.
- A tap on a row opens the task and changes nothing; only the separate check completes (V229). Done shows the Undo toast for 5 seconds.
- The floating + keeps clear of a row's due date at the end of the list (the scroll padding is 5 rem at the bottom).
- Sheet closes back to where the person was; Save does not navigate.
- Checked at 390; the same rules hold at 375, 360 and 320.

## G. Privacy (the owner's rule)
- Capture starts on **Only me**; a Reminder and an Idea are private too, always. Sharing is a separate, later choice on the note.
- A private capture is never in My team or Workspace and never on a manager's or an admin's screen (V454).
- Wrap up and Today list **my** things only.

## H. What Builder A must confirm (I read the types, not the database)
- A read for **my open tasks** with due day and client, grouped Overdue / Today / Next (7 days), plus my reminders due today.
- A read for **what I finished today** (needs a done-at stamp on tasks and captures).
- One wrap-up call taking `tomorrow`, `next_week` or `drop` for each open task **and** capture (the finished ones are already done). Today's `note_wrap_up` takes only `carry | done`.
- A carried-from day on a moved item, and **Drop** that never deletes (kept 30 days, restorable). A dropped task becomes Cancelled with the reason "Dropped at wrap up".
- Capture makes a **Reminder** and an **Idea** directly. Idea is a new capture kind (a note with its own icon); if it must wait, the sheet draws Note, Checklist, Reminder.
Where a read does not exist the block draws its own "could not load, Try again", never zero (M27).

## I. Acceptance tests (Stage 1)
1. Me with one overdue task shows Overdue first with its red count, the icon and the word, not colour alone.
2. The check completes one task and shows Undo for 5 seconds; a tap beside the check opens the task and completes nothing.
3. With no task due, Today says "Nothing due today" and Next still lists what is coming.
4. The + sheet saves a Note in two taps; Only me is on by default; Save closes the sheet and the person stays where they were.
5. A Reminder saved for Tomorrow 09:00 appears in Today the next morning, with a clock.
6. Wrap up lists exactly today's finished items under Done and the open ones under Not done.
7. Each Not done row has Tomorrow selected; one tap on Next week or Drop changes only that row; the summary line under the rows updates.
8. Save is one request for the lot; Undo restores every row; a Dropped item is restorable for 30 days and nothing is deleted.
9. The next morning the Carried over line counts what moved and shows each item with the day it came from.
10. A private Idea captured by Omar is not visible to his manager, an admin, My team or Workspace.
11. On a Thursday the Tomorrow button reads Sunday.
12. All screens at 390, 375, 360 and 320 px: no sideways scroll, 44 px targets, the + clear of the due dates.
13. In Arabic the screens mirror, the three Wrap up buttons keep their order right to left, numbers and dates stay Latin.
14. A failed read draws its own failed block with Try again, never an empty one.

## J. Gate card (proposed GC-7, light, the oversight signs under delegation)
- **The owner's own test, on a phone, 30 seconds each:** (a) say what is overdue and tick one; (b) capture an idea and a reminder; (c) wrap up the day and say what moved to tomorrow.
- **Cuts to hold:** no drag, no bulk, no per-row ⋯ menu in Stage 1; no new page; no new boards beyond these thirteen.
- QA 2 clears: docs only, each V-number once, names scenario or fake, the tests above match the boards.

## K. Open for the Architect
1. **The floating + on other pages.** On Tasks, Clients and Pipeline the + is already that page's one add action (V229). Recommendation: the + opens Capture on My day (the first thing the owner sees) and on pages without their own add; on Tasks, Clients and Pipeline it keeps its page action, and Capture is one tap away on My day, in the Create menu, and by Ctrl K on desktop. If the owner wants Capture on every page on a phone, the cleanest answer is a Capture icon in the top bar, not a second +.
2. **The Carried over line is closed by default** (one line); open it to see the items. If the owner would rather see them at once, open by default is a one-word change.
3. **Idea** as a capture kind needs a data change. If it must wait, Stage 1 ships without that tile.
4. **Reminders in Today** are included as rows (clock icon). Say if Today should be tasks only.
5. The Arabic words above are mine; the owner or the Arabic reviewer should confirm Drop (إسقاط) and Wrap up (أنهِ يومك).

Stage 2 (reminders that ping, follow-ups on a record) and Stage 3 (the Thursday weekly review) are not drawn yet, as asked.
