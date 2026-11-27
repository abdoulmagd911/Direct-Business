# Landing 57 — Tasks opens where the work is

27 Nov 2026 · base `f0ede986` (Landing 56) · target `v2/main` · branch `v2/c-landing-57-tasks-defaults` · by pull
request.

Approved by the owner on 27 Nov 2026 ("build Tasks first, then Finance tabs, then Achievements wording, as separate
landings, one at a time"). It answers item 4 of the review of 26 Nov: "Tasks — they do not work or show as I expect."
Tasks files only: nothing in My day, no database change, no change to who may see or do what.

Not in this landing, as asked: whether finishing a task logs an achievement by itself (not decided), and Arabic (not
decided). Nothing here needs either answer.

## What changes

1. **Someone who gives work to others opens Tasks on Team.** That is anyone with "Assign tasks" — a manager, a head,
   the admin account. Their My work was empty or short: the admin account owns no task (V444), and a task left at
   Default goes to the project's owner or the client's account manager (V464). Everyone else still opens on My work.
   The tabs, Team's contents and what each person may see are unchanged.
2. **An empty My work says where the work is.** For someone who gives work it reads "Nothing is yours yet. Your
   team's tasks are under Team.", with an **Open Team** button beside Add task. Everyone else keeps "No tasks yet."
3. **The list shows open tasks; Show done brings the rest back.** Done and cancelled tasks are put away on the list,
   behind one button, **Show done (n)**, which then reads **Hide done**. The choice is in the address (`?done=1`), so
   Back, refresh and saved views keep it. Still shown as before:
   - the count line ("… · 3 done") still counts them;
   - the **board** keeps its Done and Cancelled columns (a card is dragged to Done there);
   - the **calendar** keeps its days;
   - a **Done** or **Cancelled** status filter lists them;
   - **Past work** is unchanged.

   A list whose every task is finished says "Every task here is done or cancelled.", with Show done, never "No tasks
   yet". A task ticked done on the list stays there, saying Done, until the list is left or reloaded — it does not
   vanish under the person's finger (V509, the phone's "tick one off").

4. **Quick add says who a task went to.** A task left at Default that the database gives to someone else now adds a
   second message: "It went to (name) · It is under Team, not in your My work." A task that stays with the person
   adding it says nothing more. Turning a My day note into a task is unchanged.

## Decisions taken (please confirm or overrule)

1. **Team is the opening tab for everyone with "Assign tasks"**, not only the admin account. A manager can still press
   My work, and the address `/tasks?view=my_work` opens it.
2. **Done is put away on the list only.** The board and the calendar keep every task, because the board is where a
   card is dragged to Done.
3. **Arabic words are drafts**, written for this landing (not drawn — please review with the rest of the Arabic):
   «لا مهام لك بعد. مهام فريقك تحت «الفريق».», «كل المهام هنا منجزة أو ملغاة.», «إظهار المنجزة», «إخفاء المنجزة»,
   «افتح «الفريق»», «أُسندت إلى …», «تظهر تحت «الفريق»، لا في «عملي».».

## For My day's builder (not changed here)

From the same review, these are My day's to decide and build: on the admin account My day shows only a note and a
link to Settings (V444); and open tasks with no due day appear in "The rest of today" only when starred.

## Files

- `src/modules/tasks/rules.ts` — `homeScope`, the `home` and `done` filters, `hidesClosed`, `isClosedRow`, `savedQuery`.
- `src/app/(app)/tasks/page.tsx` — the list opens on the person's own tab.
- `src/modules/tasks/screens/TaskListScreen.tsx` — Show done, the all-done line, the empty My work's Open Team.
- `src/modules/tasks/screens/QuickAdd.tsx` — "It went to …".
- `messages/en.json`, `messages/ar.json` — the new words.
- Tests: `tests/unit/tasks/landing-57-tasks-open-where-the-work-is.test.tsx` (15),
  `tests/e2e/landing-57-tasks-open-where-the-work-is.spec.ts`; sabotages `tests/sabotage/landing-57.mjs` (11) and
  `tests/sabotage/landing-57-e2e.mjs` (4). Two older unit tests draw the list with Show done on, since they read the
  done row, and the Landing 34 Quick add test now also expects the one read that names the owner.

## Verification

- The 11 unit sabotages and the 4 browser sabotages: each red with its own words.
- Full checks, 27 Nov: types, lint, format, the 19 repo checks, generated types, registry — green; unit 1,986 passed; database 399 passed; browser 626 passed, 11 skipped (the time-of-day ones), 0 failed; sabotage 897, 0 failures; tree clean.

## Follow-up — the main checks after the merge (27 Nov)

The checks on `v2/main` after the merge (run 1666) were 11 of 13: in two browser sabotage groups one sabotage each
stayed green — `a-link-keeps-its-long-title-at-full-width` (group 4) and `a-link-breaks-no-long-word` (group 5), both
aimed at `tests/e2e/long-titles-fit-the-phone.spec.ts`.

- **The cause.** That test signs in as an admin. Since this landing an admin's Tasks opens on Team, where their own
  made-up tasks are not drawn, so the Tasks part measured nothing. The Partners part had measured nothing for longer:
  its rows are drawn just after the page is ready, and the test looked before they came. With nothing to measure the
  test passed under any sabotage. The pull request's checks run only the sabotages near the files it changes, so this
  showed only on main.
- **The fix (test only, the app is unchanged).** Tasks is opened at `/tasks?view=my_work`, the person's own tasks; the
  test waits for each title to be drawn before measuring it, and a title that never appears now fails the test instead
  of passing it.
- **Checked.** The test passes; both sabotages turn it red again.
