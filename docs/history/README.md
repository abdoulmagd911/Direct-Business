# docs/history — the old long working docs, kept word for word

On 2026-09-27 the working docs were cut short so a session can read them at start (the oversight's order; each file
under 40,000 characters). Nothing was deleted: the old text moved here, unchanged.

| Folder | What it holds |
|---|---|
| `backlog/` | The old `docs/BACKLOG.md` (1.5 MB, 19,885 lines) in 42 pieces; its README maps dates and fire numbers to pieces. |
| `decisions/` | The old `docs/DECISIONS.md` — the full text of every rule — in 10 pieces; its README maps rule IDs to pieces. |
| `claude-md/` | The old `CLAUDE.md` in 2 pieces. |
| `handoff-2026-08-09/` | The handoff brief of 2026-08-09 (41k) in 2 pieces, split 2026-09-28. |
| `backlog-triage/` | How the short backlog was decided: every item found in the old log, open or closed, with the evidence. |
| `moved.json` | The commit the archives were cut from and each old file's SHA-256. |
| `redactions.json` | The only lines where an archive differs from its old file: real client names and invoice numbers taken out on 2026-09-28 (rule 7), each with the old line's hash and the reason. |

The long references moved to `docs/reference/` (Playbook, Master Brief; on 2026-09-28 the Direct Payments data model),
split the same way.
`scripts/docs/archive-docs.mjs <commit>` rebuilds the archives from a commit; `scripts/qa/check-docs-moved.mjs` (in the
battery) proves the pieces join back to the old files byte for byte, every old line is present, every rule ID and every
carried-over owner quote survived, the size limits hold, and no old knowledge-base part name is left in a working file.

## The audit of the cut (2026-09-27)

Attacked before it was handed over, not only checked:

- **The proof check can fail.** A scratch copy broken seven ways (a changed byte, a deleted line, a reworded owner
  quote, a dropped rule, a 151-line backlog, an oversized DECISIONS, an old knowledge-base name) — each is caught; an
  untouched copy passes. `check-decisions-wired` was broken on purpose too (statuses renamed): it fails, and it now
  refuses to pass if it finds fewer than 80 active rules.
- **The merge with PR #51 (C-lite) was rehearsed** in a throwaway copy: its long-form D15 is caught as a missing rule
  until written in the short form; the archive rebuilt from its commit keeps D15's full text; both checks then pass.
- **Future edits were rehearsed:** a new rule in the short form with a new owner quote passes; one in the old long form
  fails with a message naming it.
- **Every open item was traced:** each of the 197 open or unclear items found in the old log is either in the new
  backlog, in the list sent to the oversight for the Drive file 08, or already in 08.
- **Defects found in the cut and fixed:** `CLAUDE.md` said the page list lives in js/15 (copied from the knowledge
  base) — it lives in `js/56-access-matrix.js` and in the database's `access_pages()`; the quote check paired quote
  marks wrongly around short quotes and was fixed; the short DECISIONS lost four points of meaning in tightening (D3,
  D11, M102, S5), restored.
- **Rule 7:** the new files name no client; the word-for-word archive kept what the old files already held, including
  part of one client's name in M18's story — flagged to the oversight, not silently edited. On the oversight's order
  (2026-09-28) those lines were then taken out, each one listed in `redactions.json` and proven by the check.
