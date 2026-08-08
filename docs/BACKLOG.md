# Action items — things deliberately put on hold

Living list. Every session should read this and update it. Nothing here is forgotten,
it is *parked*, and each item says why and what "done" looks like.

Last reviewed: **2026-08-08**

---

## 1 · Data consolidation across Google Drive — **biggest open job**

The work was done across multiple devices and multiple assistant sessions, so the same
entity appears in several sheets with different details, and dozens of working files were
created that nobody has reconciled.

**Goal:** one record per real entity, carrying every detail found anywhere, with a note of
which files each detail came from.

Known sources, all confirmed present in Drive:

| File | Folder | Size |
|---|---|---|
| `TravelAgencies_MASTER.xlsx` | `1cj5eHEHKZbRPWwV6_1kCPZBYikZDhOw6` | 693 KB |
| `Contacts Submissions` (live Google Sheet) | My Drive | 42 KB |
| `B2B` (Google Sheet, actively edited) | My Drive | 70 KB |
| `CONTACT-FORM-B2B-STAGING.csv` | `1G2JAtDs9z-m3M4rJncrnKy_NClDvgUou` | 81 KB |
| `CONTACT-FORM-CLASSIFIED.csv` | same | 33 KB |
| `CONTACT-FORM-MERGE-PLAN.csv` | same | 13 KB |
| `VENDORS-FROM-CONTACT-FORM.csv` | same | 4 KB |
| `CALL-SHEET-WEBSITE-FORM-LEADS.xlsx` | same | 32 KB |
| `CALLING-LIST-TOP50.csv` | same | 9 KB |
| ~18 invoice exports `5466…5507.xlsx` | `1F24YUsinyAAz9ntvNaSgJbTfd-8W3P20` | 5–23 KB each |

**Matching rule (locked, from the master brief):** join records by CR number first, then
verified root domain, then exact normalised name, then phone country prefix. Never merge on
a personal email. Where two records disagree, keep both values and flag rather than pick.

**Method that works:** read files one at a time and write findings to a scratch table as you
go, rather than trying to hold them all at once. A single session cannot read every file in
one pass.

---

## 2 · Travel agencies project — scattered, needs collecting

Travel agencies are a different kind of lead from a contact-form enquiry. They are
**competitors as well as customers**, so each one needs its own offer and its own service
list — you cannot sell the same bundle to all of them.

What matters per agency: online or offline, whether they have their own app, whether they
resell or need white-label, which services they lack and would buy from Direct, which they
compete on.

`TravelAgencies_MASTER.xlsx` (693 KB) is the anchor file. The Travel Trade funnel already
holds **522 leads** with fields for MoT licence, licence status, IATA, city/branches,
competitor-or-partner and partnership angle — so the structure exists; the data is scattered.

The brief also records a pending restructure: split Travel Trade into subcategories —
TMC, OTA, Retail, Wholesale, Religious, MICE, Inbound, Land tour operator,
Government/Tender — and add a BNPL / Fintech merchant funnel.

---

## 3 · Clients — reset done, re-verification pending

**Done 2026-08-08:** all 32 client records reset to leads. Company names are real; invoice
and detail data was four months stale. Every one is flagged `needs_manual_confirmation`
with the reason on the record.

**Nothing was deleted.** Full copies live in `businesses_snapshot_20260808` (1,035 rows) and
`contacts_snapshot_20260808` (335 rows). To restore one:

```sql
update public.businesses b
   set is_client = s.is_client, converted_date = s.converted_date, stage = s.stage
  from public.businesses_snapshot_20260808 s
 where s.id = b.id and s.legacy_id = '<legacy_id>';
```

**Still to do:** re-check each company against current invoices and promote back to client
only when the data is current.

---

## 4 · Individuals — park, do not delete

Some invoices are for private people, not companies (e.g. invoice file `5468`, a personal
Gmail). They are not B2B leads and should not sit in the pipeline.

But they are not rubbish either: Direct made those bookings as a B2B team, so they belong in
the **finance reporting as "individual bookings"**, not in Leads or Clients.

**Decision needed:** where individual bookings surface on the Finance page and how they are
counted. Until then, do not load them as leads.

---

## 5 · Roles and permissions — on hold by request

Full picture in `docs/ROLES_AND_ACCESS.md`. The one that matters:

> **Switching a user off does not cut their access.** Five tables (`master_db_companies`,
> `app_state_bak`, `generated_documents`, `ksa_events`, `share_links`) are written as "any
> signed-in user" and never check the role, so a deactivated account keeps full access to
> the company registry, the workspace backups, and share-link creation.

Also open: whether `viewer` should see finance; whether `operations` should be able to edit
contacts; enforcing `allowed_pages` in the database or dropping it.

## 6 · Users and logins — on hold by request

- `business@directksa.com` is allow-listed as **admin** with no login yet.
- `aboelmagd@directksa.com` and `a.hassan@directksa.net` have **blank names**, so the app
  shows "aboelmagd" / "a.hassan" in the sidebar and greeting.
- `test@directksa.com` (admin) is the standing QA account — keep.

## 7 · Ownership — blocked on the users work

`assigned_to` and `account_manager` are free text, not links to real users. **0 of 1,015
leads have an owner.** Until this is fixed there is no "my leads", no per-person view, and
no owner-based permissions.

---

## 8 · Arabic — on hold by request

- **135 pieces of UI text** stay English when the app is switched to Arabic (list produced
  by `scripts/qa/sweep-language.mjs`).
- `applyLang()` hardcodes `document.documentElement.dir='ltr'`, so Arabic never lays out
  right-to-left — **and the brand guide says Arabic is always RTL**, so the app is off-brand
  here, not merely inconsistent. Flipping it on a 1.2 MB file needs care.

## 9 · Two people editing the same section

Saves are per-section since 2026-08-08, so different sections are safe. Two people editing
*the same* section at the same moment is still last-write-wins. Real fix: move bookings,
invoices, offers and requests out of the single JSON row into proper tables.

## 10 · Corporate website leads — waiting on launch

`corporate.directksa.com` has not launched. When it does: its form feeds the same funnels,
default Inbound / stage `new`, with a source stamp. Decide whether website-onboarded leads
need an onboarding phase of their own.

## 11 · Stage wording — deferred deliberately

Screen words (`Prospect`, `Qualified`) differ from the locked database words (`new`,
`in_discussion`). Filters and badges now agree, so nothing is broken. Renaming the display
words means touching `LEAD_STAGES`, `LSTAGE_COLOR`, `STAGE_PROB`, `STATUS_TO_STAGE`, `C2S`,
`S2C` and two seed importers together — a miss leaves a stage with no colour. Own pass.

---

## 11b · Two words for one stage — normalise when convenient

Live data carries **740 leads reading "New"** and **202 reading "Prospect"**. Both are
database stage `new`. `stageToApp` keeps a record's original wording when it maps to the
same database stage, so both survive. Both now have a chip, so nothing is hidden — but two
chips meaning the same thing is confusing.

Fix when convenient: set `raw->>'stage'` to one word across those 942 records, then drop the
spare chip. Reversible via `businesses_snapshot_20260808`. Low risk, cosmetic, not urgent.

## 11c · A company can arrive through more than one door

`funnel_id` holds a single funnel, but Bayswater was reached by outreach **and** has invoice
history. On 2026-08-08 the invoice record was merged into the outreach record and the
duplicate archived — the invoice fields now sit in the same `funnel_details`, but the record
shows only one funnel.

Before loading the remaining invoice companies, decide: does a lead need a **list** of
sources rather than one funnel? This affects the whole consolidation job.

## 12 · Small things

- Delete leftover test edge functions **`hi`** and **`gstest`**.
- App orange is `#F47A1F`; the brand is `#F06820`. The events page uses the brand value.
- **Escape does not close modals.**
- "▸ From Direct (read-only)" is a section heading that behaves like a clickable button.
- Finance "Top 10 clients" lists 11 rows; its pager hides behind the "Saved to cloud" toast.
- Confirm point-in-time recovery is on for the Supabase plan — the app is versioned in git,
  the database is not.
- `manual-confirm` runs with no login and can edit any lead or contact. Fine while it is
  unknown, worth an auth check before it is shared around.
