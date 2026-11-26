# Landing 53 — My day per the boards (Batch 1 English, Batch 2 Arabic)

25 Nov 2026 · base `3ac2f45` (Landing 52) · target `v2/main` · one push, by pull request · decision V536.

Built from the coordinator's brief of the design session "Commercial Workspace — My Day & KPI Pace (Session 2)".
The boards themselves could not be opened from the build session (a chat link), so this follows the brief's words
for them. **KPI pace (Batch 3) is not in this landing.**

## In plain words — what changed on My day

1. **The date banner writes the day in full** — "Friday, 13 November 2026", «الجمعة، 13 نوفمبر 2026». Wrap up (white)
   and Capture (orange) as before; on a phone only Wrap up.
2. **Today's Three is three cards side by side** on a wide screen (one card, stacked, on a phone and a tablet):
   Important — "Highest priority", Short — "Under 15 minutes", Maintenance — "Routine tasks". The streak line sits
   beside the heading with a flame: "6-day streak · 7 of 9 done today" (under the title on a phone).
3. **A task you finish today stays where it was, ticked.** Before, it vanished and another moved up, so the three
   never read as a day's list being worked down. The line counts the ticked rows out of the rows drawn. The next day
   the done ones are gone and the groups fill from open tasks again.
4. **Every task row says its kind in a small tag** — the task's own type from the Settings list (Meeting, Call,
   Follow-up, …). A task with no type has no tag.
5. **"The rest of today (N)"** sits right under the three, **grouped by kind**: Meetings, Calls, Follow-ups, Requests,
   Reports, Documents, Site visits, then any other type by name, then Other (tasks with no type go there). A follow-up
   reminder sits with the Follow-ups and says "Only me". Two columns of cards on a wide screen, one card on a phone.
6. **The four boxes** — Do now · Plan it · Quick or hand off · Later — are the same block's other view, one switch
   away ("By kind · By priority"), with their chips and saved views as before. The browser remembers the choice.
7. **Phone:** every task row is the full width and at least 56 px tall.
   Each kind has a small icon beside its name; the Follow-up arrow is mirrored in Arabic.
8. **Arabic** mirrors all of it: «ثلاث مهام اليوم», مهمة · سريعة · روتينية, «سلسلة 6 أيام · 7 من 9 مكتملة اليوم»,
   «بقية اليوم», اجتماعات · مكالمات · متابعات …; digits stay Latin.

Not built, on purpose: no Pomodoro timer, no energy field, no digital-detox feature.

## What Today's three still is (nothing broken)

The pick is the one of Landing 34b / 35, word for word: 3 + 3 + 3 from each person's **own** tasks — Important =
starred, Short = due today or within two days, Maintenance = the rest, a short group topped up — in one fixed order,
the same on every load. The only difference: the pick is made over the person's open tasks **plus their own tasks
done today**. Finishing a task changes neither its star, its due day nor its number, which is all the order reads —
so a ticked task keeps its slot and nobody else moves. `THREE-01` (the Landing 34b/35 promise) is green unchanged in
what it promises; its one "done" fixture is now done on an earlier day. `THREE-02` is the new promise.

**The streak rule is untouched**: a working day counts when three own tasks are done; Friday and Saturday are stepped
over. Only the words changed ("6-day streak"), and the "N of M done today" beside it now counts the rows on screen.

## Where the boards and the app's data differ — and what I did

| The board draws | The app has | Done here |
| --- | --- | --- |
| Kind tags "Approval" and "Admin" | Task types are a Settings list: Follow-up, Meeting, Request, Report, Other (live also has Call, Document, Site visit). No Approval, no Admin. | The tag and the groups use the task's real type. **No type was added and no data was written.** An admin can add "Approval" and "Admin" in Settings; they then appear by themselves (after the board's kinds, by name). |
| A time on meetings and calls (12:30, 15:00) | A task has a due **day**, no time of day. Reminders have a time. | Reminders show their time; tasks show their due day. Times on tasks need a new field — not built. |
| "Quick or hand off" | The box read "Quick or pass to someone" since the Landing 15 fix round. | Back to "Quick or hand off" (V514's own name, and the brief's). Arabic unchanged. |
| Arabic group names مهمة · سريعة · روتينية, heading ثلاث مهام اليوم | المهمة · القصيرة · الصيانة, ثلاثة اليوم | The board's words. For the Arabic builder's check. |
| Full date in the heading | The one date format (short month) | The heading alone is written in full; every date in a row stays short. |

## Database — forward-only

| Migration | What |
| --- | --- |
| `20261126090000_my_day_three_keeps_done_and_names_kinds` | `my.my_three` and `my.my_tasks` replaced: a task done today keeps its place (`done`), every row says its kind (`type`, `type_en`, `type_ar`). No table, no column, no signature, no grant changes; nothing stored. |

`my.my_day` is untouched (it calls the two). `grants.expected` and `database.types.ts` do not change.

## Tests

- SQL: `THREE-02` (new) with two sabotages; `THREE-01` adjusted (its done fixture is done on an earlier day). The
  whole SQL suite on a database built from zero: 390 of 390.
- Unit: `landing-53-my-day-follows-the-boards` (new, 16 cases) with eleven sabotages; four existing My day files
  updated for the new words and the view switch. All 1,919 unit tests green.
- End to end: `landing-53-my-day-boards` (PC 1440 and phone 390: the cards, the kinds, the tick that stays, the
  switch) and `landing-53-arabic.alone` (right to left, PC and phone), with seven sabotages; six existing specs
  updated (the switch to the boxes, the new words, the full date, a "finished" fixture moved to yesterday). The full
  suite ran once on the local stack: 581 passed, 1 failed (the old short-date pattern in `review-1`, updated since
  and green).
- Four older sabotages re-pointed at the lines that moved; the 174 unit-level sabotages this change can touch all
  turn their test red.
- Live, read-only (no write): the new pick, run as a plain query against the live database for the six TEST users,
  names the same tasks in the same order as live shows today — TEST Member, TEST Viewer and TEST Head each 3 + 3 + 3.

## Simplicity gate (V633)

My day's menu is unchanged (no new page, no new menu entry). On the page: one new control (the two-way switch).
In the by-kind view the saved-views bar and the six chips are **not** drawn — fewer controls on first sight than
before; on a phone the Filter button is gone from the default view. They return in the by-priority view.

## For the owner / coordinator to confirm

1. A finished task stays ticked in the three until the day ends (point 3). Say if it should leave instead.
2. Add "Approval" and "Admin" to the task types in Settings, or leave the list as it is.
3. Tasks with a time of day (for meetings and calls) — a later landing if wanted.
