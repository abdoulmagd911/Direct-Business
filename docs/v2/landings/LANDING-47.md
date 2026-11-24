# Landing 47 — the small fix round: the board takes a dropped card, "@" lists people at once, Hand over proven

24 Nov 2026 · base `f158ee80` (Landing 46) · target `v2/main` · one push.

## Why

Three things were to be checked by doing them, as a person does, on a PC and on a phone, and fixed where broken:
dragging a task card, the list of people under "@", and the Hand over dialog for a task's Responsible.

## What was found

1. **Dragging a card on the board — broken in one common case.** A column is only as tall as its cards; an empty one
   is a few lines tall. A card picked up lower down in a long column and carried straight across passed _under_ the
   short column's box and was not taken: no mark, no move. The Landing 33 tests never saw it — they aim at the top of
   the column, and their "phone" is a mouse at phone width. With a real finger (touch events) the grip did pick the
   card up; the drop failed for the same reason. Second, the board's sideways scroll near its edge moved 14 px per
   screen frame, so a 120 Hz phone scrolled twice as fast as a 60 Hz one and a column flew past the finger.
2. **"@" — a bare "@" showed nothing.** The list waited for two letters after the "@". Typing "@" and seeing nothing
   reads as broken. Also found: after a person was picked, the words typed next were searched as if they were still
   the name, so a "No match" box sat under the comment until 40 characters had been typed.
3. **Hand over — works.** As the task's Responsible (a team member, and a manager), on a PC and on a phone with taps,
   both doors — the button beside Responsible and the ⋯ menu — open the dialog; sent from a phone the task changes
   hands and the history holds the reason. Nothing to fix. The ⋯ menu door and the phone had no test; now they do.

## The change

- `board-drag.ts`: a column takes a card anywhere in its **lane** — level with the column and inside the board,
  on its own box or above or below it (`laneAt`). Not in the gap between two columns, not outside the board. The
  sideways scroll goes **by the clock** (`edgeScroll`): the same distance in a second on any screen, about a third of
  the full speed at the strip's inner side and the full speed (what it was on a 60 Hz screen) at the board's edge.
- `TaskBoard.tsx`: while a card is carried every column is drawn the board's full height, so the short column under
  the card is seen marked — on a phone scrolled down a long column its own box is off the top of the screen. Let go,
  and the columns are their own height again. Nothing changes on the board at rest.
- `CommentExtras.tsx`, `Comments.tsx`: a bare "@" lists the record's own people at once — the people the record
  already offers for "Ask someone": on a task the team list, on a My day note only the colleagues who can see the
  note — by name, never the writer, 50 at most (the list scrolls). One letter keeps the names with a part that starts
  with it. Two letters and more go to the app's search, as before. "@ 5" offers nobody. An "@Name" already picked is a
  finished mention: the words after it open no list.
- No migration, no database change, no wording change, no new setting. The enrichment script, Finance and the
  test-data run are untouched.

## Not in this landing

- **Putting cards in an order of one's own by dragging** (re-ordering inside a column or in the list) was never
  specified or built: a drag changes a card's status column (Landing 33, B5); the order inside a column follows Sort.
  Doing it would need a place in the database to keep each task's position, and a decision on whose order it is.
- A long-standing unsteady check, seen once in the full local run and reproduced on the untouched Landing 46 code
  (4 of 12 runs there): the accessibility colour check of the bell panel reads its "Assigned" and "Mentions" tabs at
  4.49 against the 4.5 limit while the tab pill is still gliding. It passes on a repeat. Not touched here.

## Tests

- Unit (new, 23): the lane (on the box, below it, the gap, outside the board, a column half off the board); the
  scroll (the same distance at 60 Hz and 120 Hz, nothing outside the strips, towards the edge, slower inside, a long
  pause never jumps); the bare "@" (at once, by name, never the writer, one letter, Arabic, two letters left to the
  search, a space, nobody to offer, the limit); a finished mention opens no list, a second "@" does.
- Browser (new, 3 tests): the board with a mouse on a PC and with a real finger on a phone, each dropping a card
  below a short column; "@" on a task comment on a PC and on a phone (taps, 44 px rows) and on a My day note; Hand
  over as a member and as a manager who is the Responsible, on a PC and on a phone, from both doors. The carried
  card's column is measured too: drawn down to where the card is held, and its own height again once let go.
- Sabotage (new, 18), each red with its own message: 8 unit, 10 browser — the lane cut back to the column's box, the
  lane reaching outside the board, the scroll by the frame, one speed in the strip, a card below a short column not
  taken, a short column staying short while a card is carried, the grip ignoring a finger; a bare "@" listing nobody,
  offering the writer, one letter narrowing nothing, a finished mention searched again, the list waiting for two
  letters, the comment box handing it no people, the words after a pick searched again; no Hand over button, the
  button opening nothing, the menu opening nothing, a manager who is the Responsible not offered it.

## Verification (local, clean build, clean database)

- Types, lint, format, 19 of 19 house checks: green. Registry in step; generated types match the migrations (with
  the CLI version CI uses, 2.118.0).
- Unit 1,844 passed (1,821 + 23 new). Database, built from zero: 381 passed, 0 failed (no migration here).
- Full browser suite on a reset database and a clean build: 608 passed, 10 skipped (the same ten as Landing 46;
  605 + 3 new), 0 failed. The new tests and the Landing 33 and 35 board tests, three times each: 36 of 36.
- Sabotage: the whole check/lint/unit sweep — 819 plants, 0 failures — and, after the last board change, the 143 it
  could touch again, 0 failures. Browser: the 10 new plants, and the 13 older ones that plant into the changed files
  or guard the board, the comments and Hand over (Landing 33's seven, Landing 35's board, the comment thread's
  five): 23 of 23 red. The rest of the browser plants run in CI on the push, as on every landing.

## Live check after deploy

1. Tasks → Board, with at least one empty column: pick a card up from low in a long column (a phone: by its grip)
   and carry it straight across to the empty column — the column is marked and the card moves.
2. A task → Discussion: type "@" — people are listed at once; pick one, type on — no box appears under the comment.
3. A task you are Responsible for: Hand over beside Responsible, and ⋯ → Hand over — the dialog opens.
