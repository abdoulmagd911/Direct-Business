## Data world (rebuilt 2026-08-13 — the 30-lead training world)

> ⚠️ **NEVER restore old businesses/finance snapshots over the live tables.** On
> 2026-08-13 a concurrent session did exactly that and undid the owner's ordered world;
> it was re-applied. The exact current world is copied in `world30_*` tables for pure-SQL
> recovery; every older world stays in its `*_snapshot_*` tables. Recover, don't rebuild.

Owner-ordered rebuild: the previous data was wiped (kept in `*_snapshot_20260813` tables)
and replaced with **30 leads, each a different scenario**, every one owned by a real team
member, spread across all 7 funnels and all 7 stages. **10 are converted clients** with
full finance: 28 ledger rows covering paid invoices, pending transactions (tax invoice
later), commissions (held at supplier wallet), a credit note, project-origin invoices
under a proposal ref, and an aging story (4 overdue invoices, 216,115 SAR outstanding).
Services deliberately include Insurance, Intl driving permit, Translation, eSIM, Umrah,
Study abroad, MICE. Every finance group is linked to its client (`finance_client_links`,
`confirmed_by='auto-match'`) — linking is now automatic (js/42-v66), never manual.
The promo-code registry (`promo_codes`, 200 codes as of 2026-09-22) remains as revenue way #4.
**Verification services (Takamol / Techtic Support) are accounted for in another system
and must NEVER appear in this app** — the importer skips them (like wallet top-ups) and
the legacy CSV import flags them; do not reintroduce them anywhere.
**Real company data lives in the database only — never commit names, amounts or invoice
numbers to this public repo.** QA fixtures stay synthetic.
`finance_invoices.revenue_way` records how revenue arrived: invoice / transaction /
commission / promo_code. VAT is stored (`vat_sar`) but never displayed — owner rule.
A database trigger (`finance_derive_fields`) enforces the doctrine on every insert:
revenue = total − wallet, profit = revenue − cost (the whole taxable amount), and
month/quarter derive from the invoice date.

## Rules for editing the app (SPLIT INTO FILES on 2026-08-12)

**The app is no longer one file.** `index.html` holds the base core; the 37 feature
layers now live in **`js/NN-name.js`**, loaded in numeric order by `<script src="/js/...">`
lines before `</body>`. Behavior is identical (each file was a self-contained script
block already); what changed is that parallel work is now safe when sessions touch
DIFFERENT files.

- **New feature = NEW file.** Create `js/NN-short-name.js` (next number), self-contained,
  wrapped in try/catch, and add its `<script src="/js/NN-short-name.js"></script>` line at
  the end of index.html before the v-final blocks. Never grow an existing layer for an
  unrelated feature.
- **Parallel sessions rule (owner works this way):** two sessions may run at the same time
  ONLY if they work in different files. Anything touching `index.html` itself (the core,
  nav wiring, a new script line) is a "connection step" — do it in ONE session, alone.
  Build-standalone-first, connect-alone-last.
- Script src paths must be ABSOLUTE (`/js/...`) — relative paths break on deep-address
  reloads like `/leads`.
- The QA mock (`scripts/qa/`) serves `js/` files exactly like Vercel does; all probes run
  against the split app unchanged.

## Before every deploy

Run `node scripts/qa/check-structure.mjs`. It fails loudly on the patterns that caused the
repeated duplication bugs: inline `<script>` logic in index.html, the same js file loaded
twice, two layers creating the same element id, hidden-option trimming, hard-coded names,
`window.DB` guards. A doc rule did not stop the second occurrence; this check does.

## Rules for editing index.html

- **Never call `window.supabase.createClient` again in a new layer.** The app had five
  clients, which fought over refresh-token rotation and silently signed people out. A
  `v44a` block near the Supabase `<script src>` memoises `createClient`, so every call now
  returns the same client. Just call it and you get the shared one.
- **New pages need a nav entry.** Adding a `current==='x'` render branch is not enough —
  `buildNav()` builds from `VIEWS`, and the v25.2 layer rebuilds it again. The `v44b` block
  at the end of the file shows the safe pattern: inject the button and re-inject after
  every `render()`. This is how the finance ledger sat live-but-unreachable for two days.
- Layers are appended at the end of the file as self-contained `<script>` blocks wrapped in
  `try/catch`. Follow that pattern; don't restructure the middle of the file.
- **Saving is partial now.** The `v45` block turns each `save_state` call into a
  `save_state_patch` call carrying only the top-level sections whose contents changed since
  the tab loaded, so two people working on different sections no longer overwrite each
  other. If you add a new top-level key to `DB`, it is picked up automatically. Don't
  reintroduce a full-blob write.
- **The lead/client-detail cards are built by injection layers, not the base render.** The
  detail page is enhanced after render by a stack of `try/catch` blocks at the end of the
  file, each wrapping `renderLeadDetail`/`render` and injecting one card with a `setTimeout`
  and a `view.querySelector('.vNN-…')` guard so it renders exactly once. The current stack:
  `v33` service-fit map (leads **and** clients), `v34` Direct-link banner (clients only),
  `v35` suggested-next-step nudge (active leads only), `v36` "profile managed in Direct" note
  (clients only). If you add another, copy that pattern and gate on `b.isClient` correctly.
- **The client onboarding form is deliberately collapsed (v36).** The full local onboarding
  editor (`v22OpenClientOnboarding`) duplicates Direct's client master (CR/VAT/IBAN, pricing
  scheme, credit line, documents) — the duplication trap. `v36` **hides** the loud
  "🏛 KSA onboarding" button and shows a "managed in Direct ↗" note instead. This is a
  reversible hide, **not** a delete: the function is untouched and still reachable via the
  note's quiet "local form" link and the "Edit client profile (full form)" button. Don't
  "fix" the hidden button — it's intentional.

## Known structural issues (context, not a to-do list)

- **One JSON row still holds most entities.** `businesses` is a real table (safe, saved
  row by row). Bookings, invoices, offers, requests, projects and settings all still live
  in the single `app_state` row. Since 2026-08-08 saves are per-section, so different
  people editing different sections is safe — but two people editing the *same* section at
  the same moment still ends in last-write-wins. Moving those into real tables is the fix.
- **No version control on the app.** Changes are made by find-and-replace scripts against
  the live HTML, with manual backup copies as the only undo. This is the main source of
  the dead ends.
- **Ownership is free text — but "show me only my leads" WORKS, and was measured on 2026-09-20
  (fire #144).** `assigned_to` / `account_manager` are still plain names rather than links to real
  users, and the second half of this note used to say that made "my leads" impossible. It is built
  and it is correct: "Mine" compares the signed-in person's display name to the ownership field
  (js/33), and **every one of the 7 ownership values in the live data matches an active account's
  full name exactly** — checked row by row. Driven against the real database by answering only
  "what is this person called" differently: told the account belongs to the person who owns the
  most, Leads → Mine showed **70**, which is exactly their lead count (their 71st record is a
  client, and the Leads list shows leads only); told it is the QA account, which owns nothing,
  Mine showed **none** and said so — "No results with the current filters — 108 record(s) hidden.
  Show all". **And it is sturdier than a string match**, which is worth
  knowing before anyone "fixes" it: `ownerCanon` / `sameOwner` (js/43) map a person's full name,
  their Arabic name, their nickname, their e-mail prefix and — when it is unique in the team —
  their first name, all onto one canonical identity, so a record assigned to any of those still
  counts as theirs. `probe-crm-attacks` guards that. **What is still fragile:** a spelling that is
  none of those. Assignments made in the app come from a dropdown fed by the real roster (js/33 via
  `team_directory`), so drift cannot start there — but an IMPORT that writes an unfamiliar variant
  would silently drop that record out of its owner's "Mine" with nothing on screen to say so.
- ~~**The Leads stage filters miss almost every lead.**~~ **FIXED 2026-08-09.** Two
  separate problems were resolved. (1) The chip vocabulary was expanded to match the real
  data — chips now read All / New / Prospect / Contacted / Qualified / Proposal / Won / Lost
  (the app converts DB `new`→screen `Prospect`/`New`, `in_discussion`→`Qualified`, etc. via
  `C2S`/`stageToApp`), and the counts are computed from the live records. (2) The chips were
  *also* a no-op: clicking one highlighted it but filtered nothing, because the handler hid
  `.lead` card elements while the Leads list renders as a **table**. They now drive the real
  pipeline (`leadFilter.stage` + `drawLeads()` → `matchLead`), the counts reflect leads only,
  and the active chip + the "All stages" dropdown stay in sync. Verified in the harness (each
  chip filters to exactly its stage; badge count == rows shown; EN+AR clean).
- ~~`business@directksa.com` has no login yet~~ — **closed 2026-08-13**: both of
  Abdulrahman's addresses (`business@directksa.com`, `aboelmagd@directksa.com`) are active
  admins in `app_users` (re-checked against the live table 2026-09-02); his Team-Member view
  is `a.hassan@directksa.net` (`team_member`).
