# My day, productivity Stage 2 — the reminder alert, setting a time, Follow up (Architect's order of 13 Oct)

Design lead to the Architect and Builder B. Phone first (390 px), then 1440, English and Arabic. Words and boards only; no decision numbers assigned here.
Names are made up (rule 7): Sahab Tech, Dune Foods, Waha Foods, Najd Mining, Tala Hotels, Stay Hotels.
Stage 1 shipped as #230 (6ea08a0); this builds on it and changes nothing else.

## A. What Stage 2 adds, and what it replaces

| Piece | Shipped in Stage 1 | Stage 2 |
|---|---|---|
| Reminder time | Reminder shows a raw date-and-time field | **When** chips: **Later today · Tomorrow · Next week · Pick a day**, and always one line saying the result ("Wed 14 Oct · 09:00"); **Pick a day** opens a Day field, a Time field and five time chips (08:00 09:00 12:00 15:00 17:00) |
| Reminder alert | A reminder only waits in Today and in the bell | At its time, an **alert** with **Done** and **Snooze** (Later today / Tomorrow / Next week); the bell gets the same item |
| Follow up | None | **Follow up** on a client and on a task: one entry in the record's existing ⋯ More actions menu; it opens the Capture sheet in Reminder mode, already tied to the record; it becomes a chip on the record and a row in Today |

## B. Boards (`my-day-stage2/`, one PNG each)

| Board | Shows |
|---|---|
| `PhoneReminderAlert` | My day with the alert over it: clock, "Reminder", "Now", the words, **Done** and **Snooze**; Today already lists the reminder rows |
| `PhoneReminderSnooze` | The same with Snooze open: Later today 17:30, Tomorrow 09:00, Next week Sun 18 Oct |
| `PhoneCaptureWhen` | Capture sheet, Reminder: the default, Tomorrow chosen, the result line "Wed 14 Oct · 09:00" under the chips |
| `PhoneCaptureWhenPick` | Capture sheet, Reminder, **Pick a day** open: Day, Time, time chips; the result line under the chips |
| `PhoneClientMenu` | Client record on a phone with the ⋯ menu open: **Follow up** is the first entry (the rest stay as built) |
| `PhoneFollowUp` | The Follow up sheet over the client: record chip, one line (prefilled prompt), When chips, **Only me**, Save |
| `PhoneFollowUpSet` | After Save: the record carries a **Follow up Thu 15 Oct** chip marked Only me; toast "Follow-up set" with Undo |
| `PhoneReminderAlertAr`, `PhoneCaptureWhenAr`, `PhoneFollowUpAr` | Arabic, mirrored |
| `MyDayReminderAlert` | 1440: the alert as a card under the top bar; the bell shows 5 |
| `MyDayCaptureWhen` | 1440: Capture dialog, Reminder, Pick a day open |
| `PartnerFollowUp` | 1440: the client record with the Follow up dialog |

## C. The simplicity gate (V633), for each addition

| Addition | Adds a menu entry, button, field or screen? | Could an existing one serve? | Clear in 5 seconds on a phone? | Removed or merged |
|---|---|---|---|---|
| When chips | No new control: they replace the date-and-time field; Pick a day shows two fields only when chosen | The Stage 1 field served but needed a keyboard on a phone | Yes: one tap for the three usual answers; the result is written out under the chips | The raw date-and-time field is removed |
| Reminder alert | One alert card, the existing toast pattern with two buttons; no screen | The bell serves for later, not for the moment it is due | Yes: the words, Done, Snooze | The bell row and the alert are one item; Snooze uses the same three answers as the chips and the bell's existing Snooze |
| Follow up | One entry in an existing menu, per record type; no button, no screen | Yes: it is the Capture sheet in Reminder mode | Yes: the sheet is the Stage 1 sheet with the record already named | No second sheet; the chip on the record replaces any "next step" field someone might ask for |
Counts: menu entries +1 on a client and +1 on a task; buttons +0; fields +0 (one removed); screens +0.

## D. Words (two words or fewer on a chip or button)
Reminder · Now · Done · Snooze · Later today · Tomorrow · Next week · Pick a day · When · Day · Time · Follow up · Only me · Save · Undo.
The alert and the notification use the same words. **Snooze** is the word everywhere (the bell already uses it).
Times: Riyadh time, 24-hour, Latin digits, Gregorian dates, in Arabic too. **Later today** is three hours on, or 17:30 if that is later than the end of the working day; the result line always shows the real time.
**Tomorrow** and **Next week** are the next working day and the next Sunday; on a Thursday, Tomorrow reads Sunday (the weekend is Friday and Saturday).
Arabic (for the owner to confirm): Reminder تذكير · Now الآن · Done تم · Snooze تأجيل · Later today لاحقًا اليوم · Tomorrow غدًا · Next week الأسبوع القادم · Pick a day اختر يومًا · When متى · Day التاريخ · Time الوقت · Follow up متابعة · Only me أنا فقط.

## E. Behaviour
1. **The alert** shows on any page while the app is open, over the content under the top bar. It has the reminder's words (a tap opens the item), **Done** and **Snooze**. It does not cover the floating +, and it never takes focus from a field being typed in. Done ends the reminder. Snooze moves it and shows the new time in the Today block.
2. **If the app is not open** the reminder waits in the bell and in Today, as in Stage 1. A phone notification outside the app is not drawn and is not promised (see H).
3. **When**: Tomorrow is chosen when the sheet opens (09:00 Riyadh). The result line is always visible. Save is never blocked by the time.
4. **Follow up** is private: it starts on Only me and the chip on the record shows only to its author (V454). It is a reminder tied to the record: the Today row says "Follow up: <name>" with the clock; done there ends it everywhere. The record can hold one open follow-up per person; setting another asks nothing and replaces the first (Undo restores it).
5. **The chip on the record** opens the same sheet to change the time or remove the follow-up.

## F. Phone rules (V630, V229, V228)
One main action per screen (Save on the sheet, Done on the alert). Every target 44 px: the chips, the time chips, the Day and Time fields, Done, Snooze, the menu entries. A tap on a Today row opens it; only the check completes. The + stays clear of the alert and of due dates. Checked at 390, 375, 360, 320.

## G. Acceptance tests (Stage 2)
1. A new Reminder opens with Tomorrow chosen and "Wed 14 Oct · 09:00" shown under the chips; Save needs no further tap.
2. Pick a day shows Day, Time and the five time chips; choosing 15:00 and Thu 15 Oct updates the result line.
3. A reminder at its time shows the alert on My day and on Tasks; Done ends it; Snooze > Tomorrow moves it and Today shows the new day.
4. The alert does not move a field being typed in and does not cover the floating +.
5. The bell lists the same reminder once; marking it Done in either place clears both.
6. On a client and on a task the ⋯ menu has Follow up first; no new button is drawn.
7. The Follow up sheet names the record; Save closes it and the person stays on the record, with the chip "Follow up Thu 15 Oct" and the toast with Undo.
8. A follow-up is not visible to a manager, an admin, My team or Workspace, nor its chip on a record to anyone else (V454).
9. Setting a second follow-up on the same record replaces the first; Undo brings the first back.
10. In Arabic the screens mirror, the chips keep their order right to left, times and dates stay Latin.
11. 390, 375, 360, 320 px: no sideways scroll, 44 px targets.
12. A failed save keeps the sheet and says so; a failed read draws its own failed block.

## H. Open for the Architect
1. **Outside the app.** A reminder that fires while the app is closed needs a phone or browser notification (a data and delivery change). Stage 2 as drawn covers the app open; say if the owner wants notifications outside the app, and I will draw the notification wording (it is the alert's two lines).
2. **Snooze set.** Three answers (Later today, Tomorrow, Next week) match the When chips. If the owner wants "In an hour" or a free time on Snooze, say so; I kept it short.
3. **One follow-up per person per record** is my guess at the smallest rule; several would need a list on the record (a new section), which the gate argues against.
4. **Task records.** The task page is not redrawn; the menu entry and the chip follow the client's. The task board `TaskDetail` should get the chip in its header row in the same place.
5. Arabic words above are mine; Builder C or the owner should confirm Snooze (تأجيل) and Follow up (متابعة).

Stage 3 (the Thursday weekly review) is for Builder E; I will draw it when asked.
