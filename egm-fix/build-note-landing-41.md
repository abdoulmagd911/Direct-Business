# Landing 41 — the period's achievements on Finance, as a list apart from the money

23 Nov 2026 · base `bc10cfc7` (Landing 40, CI #1624 all green) · target `v2/main` · one push.

The owner, 22 Nov: "achievements show on Finance as a separate, non-money list".

## What a person sees

On the Finance page, under "Is it counted?", a new card: **Achievements in this period · Not money — counted in no
total**. It lists the achievements whose day falls in the period on screen, newest first: the number, the title (it
opens the achievement's own record), the category, the organisation, the owner and the day. A period with none says
"No achievements in this period."; more than fifty says how many are shown.

- **No amount is drawn**, and none is read: an achievement's value is not revenue (FIX-06 / D29).
- **No figure changes.** The revenue, cost and profit figures, the ledger and "Is it counted?" count exactly what they
  counted before; the list is its own read beside them.
- **Who sees what** is the Achievements page's own rule: a person sees here the achievements they would see there
  (their team's, a manager's team, an admin's all). Someone with no access to Achievements sees an empty list. An
  organisation is named only to a reader who may open it.

## What changed underneath

- One forward-only migration (`20261123110000_finance_achievements_of_the_period.sql`): the read
  `api.finance_achievements(from, to)`. Every existing function is untouched; no data is changed. Two new grants (the
  read and its door, to signed-in people).
- One new card on the Finance page, in the page's own read queue: it waits its turn like the ledger, and loads,
  fails (with Try again) and reads again on its own.

## Not in this landing

- The partner's Finance tab is unchanged; an organisation's achievements are already listed on its record's Related
  tab (Landing 35).
- Test tasks for the TEST users on live: not done from the builder's side (no write access to live; a migration is
  the wrong tool for test data).

## Tests

- Database: `FAC-01` — the period's own, newest first, no amount, the money reads the same before and after, a
  removed one is not listed, another team sees none. Three database sabotages.
- Unit: the card — rows, the link, no amount even if an answer carried one, empty, loading, failed, Arabic.
- Browser: `landing-41-finance-achievements.spec.ts` — logged in a month, listed for that month and not another; the
  revenue figure is the same before and after.
- Sabotage: six new plants (`tests/sabotage/landing-41.mjs`).

## Verification

On the builder's machine on 23 Nov, local stack, made-up data only:

- types, lint, formatting: clean; the 19 house checks: green; generated types and the registry agree with the database
- database tests: 381 passed (1 new: FAC-01); unit tests: 1,814 passed (12 new)
- the full browser suite: 604 passed, 10 skipped
- sabotage: database 588, unit / check / lint 810 — every one turned its target red
- browser sabotage: the two new plants and the four Landing 35 reflection plants, each red as it must be
- every edit-plant in `tests/sabotage` finds its text exactly once (1,390 checked)

Two things were corrected on the way. A Landing 35 browser test held that Finance shows no achievement, and said it
would be rewritten the day that changed: it now holds the new ruling (listed in its own card, with no amount, and
nowhere else on the page). And the new browser test first checked "not listed in another month" while the card was
still loading, so its sabotage did not bite; it now waits for the card's answer.

Live: the migration applies in the production job. The browser check is the owner's side: on Finance, the card
"Achievements in this period" lists the period's achievements with no amount, and the figures above are unchanged.
