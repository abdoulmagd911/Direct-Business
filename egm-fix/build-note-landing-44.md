# Landing 44 — the Activity "What" filter shows only the chosen kind inside an entry

23 Nov 2026 · base `a48afae6` (Landing 43) · target `v2/main` · one push.

## Why

Rocky's live check of Activity → What → Comment: the list narrowed (1,686 entries to 119), but the top entry read
"Organisation added", by System, 20 Nov 06:50, filling its card edge to edge. A read-only look at the live log found
the cause. The seed import of 20 Nov was written as one single entry: 1,384 changes across 28 kinds of record, 8 of
them comments. The filter picks entries that hold at least one change of the chosen kind, which is right, so this one
was picked. But the screen then drew every change in it and named it after its first one. One giant entry at the top
made the whole filter look as if it did nothing.

## The change

- `ActivityScreen.tsx`: a new helper `onlyWhat` keeps, inside each listed entry, only the changes of the chosen kind,
  and drops an entry left with none. It applies only to the "Changes" view when a What choice is made; with no choice
  nothing changes. "Show earlier" still counts the pages as read, so the hidden changes never make it ask again.
- No database change, no migration, no wording change.
- Tests only: the Landing 33 phone board-drag test is steadied. The drag re-checks the drop column after a short
  pause before letting go, and waits for the card to land in its new column before checking its status.

## Tests

- Unit (new, 7): a mixed entry keeps only its comment changes; a comment-only entry is unchanged; an entry with none
  is dropped; an empty choice keeps everything; keys are read with spaces; the input is not changed.
- Browser (new): as Admin, an organisation and a comment are made, and a seed-shaped entry (an organisation and a
  comment written together by the system) is planted. Under Comment: the choice is in the address, the new
  organisation is gone, every entry reads Comment, and no entry is named "Organisation added"; still so after a
  reload; the full list returns without the choice.
- Sabotage, all red as they must be: the entry shows every change (unit); the screen forgets to narrow (browser); the
  choice is not written to the address (browser). The earlier plant "the read ignores What" was removed: the screen
  now narrows what it is given too, so that plant could no longer fail a test, and a proof that cannot fail is not
  kept.

## Verification (local, clean build)

- Types, lint, format, the 19 house checks: green. Types and registry match the database.
- Unit 1,821 passed; database 381 passed; full browser suite 605 passed (10 skipped, as before).
- Sabotage: 811 unit/check/lint plants, 0 failures; every edit-plant still finds its text (1,393 checked, 0 stale);
  the two new browser plants red; the Landing 33 drag plant red.
- The steadied board-drag test passed 10 of 10 repeats.

## Live check after deploy

Activity → What → Comment: the 20 Nov System entry reads as its comment changes, not "Organisation added".
