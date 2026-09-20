# Edge functions — why some of them are in this repository now

Supabase edge functions are **not** deployed from this repository. They are deployed straight to the
project (`vkxoeeoauexyfpzqufqd`), which means a change to one is invisible to anybody reading the
repo — and an invisible change that later behaves oddly is exactly the pattern that cost this
project months (see the "⛔ Do NOT run the old deploy scripts" section of CLAUDE.md).

So from 2026-09-20: **when a session changes an edge function, the deployed source is committed
here in the same commit.** A file in this folder is a copy of what is live, not a thing that gets
deployed from here. If you change one, deploy it AND update the copy.

Only functions that have actually been changed are here. The rest are listed below so the shape of
the whole set is visible without a dashboard.

| function | needs a login? | what it is |
|---|---|---|
| `app` | no | **Changed 2026-09-20 (fire #136).** Used to serve a 1 MB copy of the app out of Storage — old enough to call `save_state` (whole-blob write) instead of `save_state_patch`, so a colleague with an old bookmark could sign in and overwrite everyone's work. Now a 302 to the real site. Source in this folder. |
| `manual-confirm` | no | The flagged-records page. Holds the service-role key. Its write path was bounded on 2026-09-20 by a database trigger (`trg_guard_manual_confirm`) rather than by changing the function — see DECISIONS M22. Its read path is still open and is the owner's call. |
| `admin-users` | **yes** | The only function requiring a token. Creates and manages team accounts. |
| `ksa-events-hub` | no | A 302 to the in-app Events tab; the public events page was retired in 47b6c01. |
| `hi` | no | A three-line "hello html" test page. On the backlog to delete. |
| `gs` | no | The owner's personal habit tracker. Touches only its own `gs_*` tables — none of this app's — and those tables no longer exist, so it cannot write anything. |
| `gstest` | no | A test that writes one fixed file into the `app` storage bucket with the service-role key on every request. Harmless in blast radius, but it is the shape DECISIONS M22 warns about. On the backlog to delete. |

The five one-shot deploy/import scripts CLAUDE.md warns about — `promote-v41`, `promote-v42-finance`,
`patch-v42-attention-fix`, `verify-v42`, `v30-import-businesses` — **are no longer deployed**
(checked 2026-09-20). That warning can be read as history now.
