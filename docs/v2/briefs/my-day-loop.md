# My day loop — the owner's daily and weekly rhythm (phone first)

Owner priority of 13 Oct. Design lead to Architect. Words only, no new boards: Builder B has the wire sketches below.
Decision numbers are not assigned here; the Architect assigns them. Names in examples are made up (rule 7).

## Why

The owner ends each day not knowing what he did, what he did not, or what moved to tomorrow or next week. The loop that fixes it:
open on **Today**, tick or move in one tap, **Capture** anything in two taps, **Wrap up** at the end, see **Carried over** in the morning,
**Review the week** on the last working day, and **Follow up** with reminders.

## A. Built today (read from v2/main) and what is missing

| Piece | Built | Missing for the loop |
|---|---|---|
| Opening view | Tabs Me / My team / Workspace, then the capture row, then **notes** (open = not done and due on or before today), 7 rows a block | No Today / Overdue / Next. No tasks on the page (the task blocks were left to P5-7). No one-tap done or move on a row |
| Capture | A row at the top of Me: kind (Note, Meeting, Checklist), visibility (starts **Only me**), text, Enter. `/` jumps to it | Scrolls away on a phone. Kinds do not include Reminder (a reminder is only made by *Turn into*). No Idea |
| Wrap up | Header button, a dialog, the open **notes** only, each **Carry over** (next working day, the default) or **Done**, or Turn into | Tasks are not in it. No Tomorrow / Next week / Drop. No "what I did today" list. No result line. The dialog rows are wide-screen rows |
| Next morning | Nothing | A **Carried over** block saying what moved and from which day |
| Weekly review | Nothing | The same screen for the week |
| Follow-ups | A reminder made by *Turn into*, shown on Me with **Remove**, sent by the five-minute job | Making one in one step, choosing when, snooze, and a follow-up on a client or a task |

## B. Design

### B1. Me opens on three blocks (phone and desktop)
Order: **Overdue** (only when there is one; first, warning colour with an icon and the word), **Today**, **Next** (the next seven days).
A row is one thing: a task I own, a note or checklist item that is due, or a reminder. Each row has:
- on the left the separate **check** (44 px, always shows its mark; V229): Done, then an Undo toast of 5 seconds;
- the title, then one muted line (due day, client or project if any);
- on the right a **⋯** button (44 px) with **Tomorrow**, **Next week**, **Pick a day**, **Open**. Moving also shows the Undo toast.
A tap on the row opens it and changes nothing.
On a phone the Team and Workspace tabs go under **More** (the V229 pattern); Me stays first and is the default.
Empty state: "Nothing due. Capture something or enjoy the quiet." One line, no banner.

### B2. Capture is always there
- Phone: one floating **+** on My day and Tasks (the same + as Quick add; one add action per screen, V229). It opens a bottom sheet:
  a text field already focused, four chips **Note · Checklist · Reminder · Idea**, a **Private** chip (starts on; a note is private until shared, V454), **Save**.
- Reminder adds three chips under the text: **Later today · Tomorrow · Pick a day** (default Tomorrow 9:00, Riyadh time).
- Save closes the sheet and shows "Saved to Today" with Undo. Checklist and Meeting open the note to add points, as now.
- Desktop keeps the row at the top, with the Reminder kind and the same chips added; `/` still jumps to it.

### B3. Wrap up (the end of day)
Button in the header on desktop; on a phone a full-width **Wrap up** bar at the bottom of Me from 4 pm (and always under ⋯ in the header). It opens a full-screen page, not a dialog.
1. **Done today · 6** — a collapsed list of everything finished today (read only). This is the answer to "what did I do".
2. **Not done · 4** — each row: title, then three equal 44 px buttons **Tomorrow · Next week · Drop**.
   Tapping one applies at once; the row collapses to "Moved to Tomorrow" with a small Undo. A row left alone is carried to **Tomorrow** when he taps Finish — nothing is ever lost silently.
3. **Finish** — closes the day and shows the result: "6 done · 3 to Tomorrow · 1 next week · 1 dropped". One line; it is saved as the day's record.
- **Tomorrow** shows the real day when tomorrow is not a working day: on a Thursday the button reads **Sunday** (the weekend is Friday and Saturday).
- **Drop** never deletes. The item goes to a **Dropped** list (kept 30 days, restorable) and the Undo toast shows. A task dropped becomes Cancelled with the reason "Dropped at wrap up".
- Turn into (meeting, task) stays on a note's own page; it is removed from the wrap-up rows to keep one tap per item.

### B4. Next morning
At the top of Today, before its own rows: **Carried over · 4** with a "from Tue" chip on each row (the day it came from). It shows until he has dealt with the row or the day ends; a row carried three times gets the chip **Carried 3 times** (Stage 2 uses it).

### B5. Weekly review (Stage 2)
The same page as Wrap up with the scope **Week**: **Done this week** grouped by day, **Not done** with **Next week · Next month · Drop**, **Reminders next week**, **Dropped** with Restore. Offered as a card on Wrap up on the last working day (Thursday); also under More. The result line is saved as the week's record.

### B6. Follow-ups
- Stage 1: the Reminder kind in Capture (B2), and the existing Remove stays.
- Stage 2: **Follow up** button on a task and on a client record: chips **Tomorrow · In 3 days · Next week · Pick a day**, an optional line. When due it is a row in Today with **Done** and **Snooze** (Tomorrow / Next week). The notification still goes out.

## C. Words (two words or fewer, one word for one idea)
Overdue · Today · Next · Carried over · Done · Tomorrow · Next week · Drop · Wrap up · Finish · Capture · Note · Checklist · Reminder · Idea · Private · Follow up · Snooze · Restore.
Use "Drop" everywhere (not Delete, Skip, Dismiss). Use "Done" (not Complete). Dates Gregorian, Latin digits, also in Arabic.

## D. Phone
390, 375, 360 and 320: no sideways scroll, every target 44 px, the floating + never covers a row's ⋯ (keep 5 rem clear at the right and 4 rem below, as on Finance). One main action per screen: Me has the +, Wrap up has Finish.
Arabic: mirrored; the three wrap-up buttons keep their order reading right to left.

## E. Smallest Stage 1 (the owner can use it daily)
1. Me: Overdue / Today / Next with the check and the ⋯ move on every row (B1).
2. Capture: the floating + sheet with Note, Checklist, Reminder (B2); Idea waits.
3. Wrap up page with Done today, Not done with Tomorrow / Next week / Drop, Finish and its result line (B3).
4. Carried over block next morning (B4).
Not in Stage 1: the weekly review, the Idea kind, follow-ups from records, snooze, the Carried 3 times chip.

## F. What Builder A must confirm (I only read the types, not the database)
- `my_day` also returns **my open tasks** with their due day, and **what I finished today** (needs a done-at stamp on notes and tasks).
- A wrap-up call that takes `tomorrow | next_week | drop | done` for notes **and** tasks and writes **one summary row** per person per day (done, moved, dropped counts). Today's `note_wrap_up` only takes `carry | done`.
- A carried-from day on a moved item, and a Dropped state kept 30 days.
- A reminder can be made directly by Capture (today only through *Turn into*).
Where a read does not exist, the block draws its own "could not load, Try again", never zero (M27).

## G. Acceptance tests (Stage 1)
1. Me with an overdue task shows Overdue first, with the icon and word, not colour alone.
2. The check completes one row, shows Undo for 5 seconds; tapping beside the check opens the row and completes nothing.
3. ⋯ → Tomorrow moves the row out of Today; Undo brings it back; on a Thursday the option reads Sunday.
4. The + sheet saves a private Note in two taps; the Private chip is on by default.
5. A Reminder with Tomorrow 9:00 appears in Next, and in Today the next morning.
6. Wrap up lists exactly today's done items under Done today, and the open ones under Not done.
7. One tap on Next week applies at once and shows Undo; untouched rows go to Tomorrow on Finish.
8. Drop removes nothing from the database; it is restorable for 30 days; a dropped task is Cancelled.
9. The next morning shows Carried over with the "from" day on each row.
10. All of it at 390, 375, 360 and 320: no sideways scroll, targets 44 px, the + clear of the ⋯.
11. In Arabic, the three buttons and the dates read correctly; amounts and numbers stay Latin.
12. A failed read draws its own failed block, never an empty one.

## H. Open for the Architect
1. **Untouched rows at Finish go to Tomorrow** (matches today's default). Confirm.
2. **Drop on a task = Cancelled** with a reason. Confirm, or ask for a separate Dropped status.
3. **Team and Workspace under More on a phone.** Confirm (it follows V229).
4. **Wrap up bar from 4 pm** is a guess; the owner can say another hour.
