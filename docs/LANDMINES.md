# Landmines — what can go wrong, what actually happens, and how we recover

> Written 2026-08-12 after an adversarial pass: instead of testing that features work,
> this pass tried to BREAK them — junk files, hostile names, double-clicks, undo paths,
> two tabs at once, Arabic digits, oversized uploads. 21 attack scenarios now run as a
> permanent probe (`scripts/qa/probe-landmines.mjs`). This page is the honest map:
> Part A = attacks that are now proven harmless. Part B = limits that remain, each with
> its recovery. Part C = what genuinely cannot be tested from the QA harness and needs
> one real-world click. Re-read before go-live.

## A · Attacked and proven safe (each is a permanent probe check)

| Attack | What happens now |
|---|---|
| Company named `O'Brien & Sons <b>x</b>` | Shown as plain text everywhere; search works; no injection. |
| Win a lead through the FULL edit form | **Was broken — fixed.** The "Is client" dropdown used to silently undo the Won conversion (half-converted record). Now Won always converts, and the handover opens on this path too. |
| Cancel the "complete the client" handover | Company stays a client; the card shows the orange "Not linked to Direct yet" banner until someone adds the ID. Nothing lost. |
| Won by mistake — change the stage back | **Was a trap — fixed.** It used to leave the company a client forever, silently. Now it asks: OK = back to the pipeline (history and finance links stay, with an activity note), Cancel = stays a client. |
| A stage value that isn't in the list | **Was a trap — fixed.** The save used to write an empty stage. Now the previous stage is kept. |
| Binary junk renamed to `.csv` | Clear "header does not match" message showing what was found. No crash. |
| Header-only / empty CSV | "Ready to import: 0", no confirm button. |
| Excel-mangled headers (semicolons, UPPERCASE) | Rejected with the found header shown, so the fix is obvious. |
| Arabic-numeral amounts (٢٣٠٠٠) | The row is FLAGGED for review — it can never silently enter the ledger as zero. |
| Project row naming a proposal that doesn't exist | Imports, but the preview warns it — the link will say "no proposal" until that proposal exists. |
| 1,000-row CSV | Parses in under a second; preview and confirm behave. |
| Triple-clicking "Confirm import" | Exactly one import happens (the pending batch clears on the first click). Belt-and-braces: the database also has a uniqueness rule on invoice number + line, so even two different computers importing the same file cannot double-count revenue. |
| Uploading an `.exe` as a proposal | Rejected with a clean message before any upload. Oversize (>25MB) likewise. The storage bucket enforces the same limits server-side. |
| Search boxes fed `<script>` / SQL text | Nothing breaks, nothing executes. |
| All new surfaces in Arabic | Import page, drop zone, proposal-file label, handover modal — all Arabic, no leftovers (one missed line found and fixed in this pass). |

## B · Limits that remain — by design, each with its recovery

1. **Two people editing the SAME section of the SAME record at the same moment → last
   save wins.** Different sections are safe (saves are per-section since 08-08); the same
   lead card edited in two tabs is not. *Recovery:* the pasted-conversation work log is
   append-only in practice, so history survives; the losing edit must be re-entered.
   *Go-live habit:* each owner works their own companies. The real fix (row versioning)
   is deliberately parked — revisit only if it actually bites.
2. **Import writes in batches of 50; a database collision fails that one batch.** The
   error is shown. *Recovery:* run the SAME file again — duplicates are skipped, so only
   the missing rows import. Same recovery for a refresh mid-import: nothing is ever
   half-written beyond a batch boundary, and a re-run completes the rest.
3. **A wrong invoice discovered after import.** *Recovery:* open the invoice → Delete
   (soft — it leaves totals but stays recoverable) → import the corrected row. Nothing
   is ever hard-deleted from the ledger by the UI.
4. **Vercel deploy goes bad.** *Recovery:* Vercel → Deployments → Promote the previous
   one (every past deploy is kept), or revert the commit. Rollback is one click.
5. **Supabase is briefly down.** The app shows "could not load"; nothing is lost —
   data lives in the database, not the browser. Wait and reload. (Standing item:
   confirm point-in-time recovery is enabled on the Supabase plan before real data
   goes in — the app is version-controlled, the database's safety net must be too.)
6. **Sign-out or session expiry with an import preview open.** Confirm will fail with
   an error message; sign back in and re-run the file (dedup makes it safe).
7. **Proposal file "Remove" by a non-admin** clears the reference from the proposal but
   may leave the file itself in storage (delete rights are admin/manager). Harmless
   orphan; an admin can purge storage occasionally.

## C · Cannot be tested from the harness — needs one real click each (before go-live)

| What | Why it can't be simulated | The one manual check |
|---|---|---|
| Real proposal upload | The harness mocks storage; the real bucket + its permissions have only been verified as SQL, not exercised | Upload one PDF to any proposal on directksab2b.com; then once more signed in as a non-admin (a.hassan account) |
| Real two-user concurrency | The harness's two tabs share one browser; real latency differs | One afternoon of the team using it together — watch for anyone's edit "disappearing" (that's landmine B1) |
| Direct system URLs | We've never seen the real screens; the links use a guessed pattern held in a setting | When you open a real invoice in Direct, send the address-bar URL — one setting change fixes every link |
| Real phones (iOS Safari) | Harness is Chromium only | Open the app once on your iPhone: sign in, open a lead, open Finance |
| Print/PDF of the branded proposal on a real printer | Harness prints to PDF only | Print one generated proposal once |

## The rule this pass reaffirmed

A green test suite proves the paths someone thought to test. Every landmine round so far
(buttons, lifecycle, this one) found real traps by **assuming a specific person doing a
specific wrong thing** — so before go-live, this file's Part C gets executed for real,
and any new feature gets a "how would a rushed person on a phone break this?" scenario
added to `probe-landmines.mjs`, not just a happy-path check.
