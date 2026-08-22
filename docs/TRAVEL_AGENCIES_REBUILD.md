# Travel Agencies Confirmed Database — the rebuild

Started 2026-08-13 on Abdulrahman's instruction: **do not trust any earlier merge, including
v3.** Re-check everything from the raw sources, verify against official sources, and fix how
the data is stored so it can carry a full project later. Free verification only.

## Where it lives

`data/ta/ta.sqlite` — a single database file created locally by `scripts/ta/init_db.py`
from `scripts/ta/schema.sql`. **Deliberately separate from the app's Supabase**: Abdulrahman
wants the travel-agency database built alone until it is complete, and only then — maybe —
loaded into the app. That decision is his, at the end.

**Storage correction (2026-08-13, this branch):** the database file and every data export
are **not committed to this repo** — the repo is public, and the standing rule is that real
company data never goes in it (`.gitignore` now blocks `data/`). The repo holds only the
code, schema and this plan. Working data lives in the session while building; deliverables
(Excel snapshots) are handed to Abdulrahman in chat / Google Drive. The recovery exports an
earlier session pushed to the `claude/travel-agencies-database-im9o80` branch were zipped
and handed to Abdulrahman on 2026-08-13; the same data also still exists in the Supabase
snapshot tables.

The storage rule that fixes the old problem: **no value without provenance.** Emails, phones,
names, licences and CR numbers are rows, not cells — each carries which source file it came
from, how it was linked to its company, and every verification check run against it. Nothing
is overwritten during merging; losing candidates stay flagged and reversible. The old sheets
jammed multiple phones into one cell and lost track of where values came from — that is what
the child tables (`emails`, `phones`, `email_sources`, `phone_sources`) exist to prevent.

## Raw sources to re-ingest (task 3) — intermediates are NOT trusted

| Source | Where | Why raw |
|---|---|---|
| `MASTER_DB_v1.98_FINAL__Master.csv` (4.1 MB) | Drive `1G2JAtDs9z…` | The fullest raw collection (5,139 rows) before any dedup ran |
| `MASTER_DB_v1.98_FINAL__UNIDENTIFIED_CONTACTS.csv` | same | Contacts nobody linked yet |
| `TAs.csv` (341 KB) | same | Early raw agency list |
| `SAUDI-TRAVEL-TRADE-DATABASE__Saudi_Travel_Trade.csv` (859 KB) | same | MOT licence registry extract (3,400+ licences) |
| Tabby merchant CSVs (`tabby_travel_pages_1_to_20_master…`) | Drive `1pG4Sgp…` | Directory of live Saudi travel e-commerce merchants |
| Direct Payments exports (~18 files `5466…5507.xlsx`) | Drive `1F24YUsi…` | Real paying customers with amounts |
| Ministry of Hajj providers list | haj.gov.sa (reachable) | Official, refreshable from here |
| Contact-form CSVs (`CONTACT-FORM-B2B-STAGING` etc.) | Drive `1G2JAtDs9z…` | Raw form submissions |
| `finance_invoices_snapshot_20260812` | Supabase snapshot table (also in the 2026-08-13 backup zip) | The Aug-12 Direct Payments capture (1,285 invoices) |

The July intermediates (TAS_MASTER v1/v2, TravelAgencies_MASTER, v3) are kept as
cross-checks only — every fact must re-derive from a raw source or it gets re-flagged.

## Free verification stack (task 5) — no paid subscriptions

1. **Company websites** — Saudi e-commerce rules push companies to publish CR/VAT on their
   sites. Crawl the ~600 known domains from here (they are not geo-blocked): harvest CR, VAT,
   licence numbers, emails, phones from the pages, and record website liveness. Free,
   automatable, and it is verification *from the company itself*.
2. **MOT licence list** — already in the raw data (3,400+ licences). One manual refresh
   from data.gov.sa by Abdulrahman when convenient (the portal is geo-blocked for us,
   open from Saudi IPs).
3. **Ministry of Hajj official providers list** — haj.gov.sa is reachable from here; official
   and free.
4. **Wathq trial** — developer.wathq.sa gives **100 free inquiries for 30 days** (all
   services; after that it is 5,000-SAR prepaid, which we are not doing). Spend the 100 on
   the top-priority companies only (live website + valid licence + real email domain),
   using `GET /info/{id}` (basic CR data). Needs Abdulrahman to register once — free.
5. **Manual cockpit for the rest** — a standalone page (not wired into the app) listing each
   pending company with a prefilled link to the free public lookups (mc.gov.sa CR search,
   SBC eauthenticate) and a paste-back field, so the team can clear the residue from Saudi
   IPs a few a day. To be built after the automated passes shrink the queue.

Blocked from this environment (verified 2026-08-13, do not re-test blindly):
`eauthenticate.saudibusiness.gov.sa`, `data.gov.sa` / `open.data.gov.sa` (connection reset —
geo-block), `mt.gov.sa` (WAF 403). Reachable: `haj.gov.sa`, `developer.wathq.sa`,
`api.wathq.sa` (gateway answers; needs key).

## Confirmation standard

An entity is **confirmed** only when an official identifier (CR / unified number / MOT
licence) is matched by at least one official-grade check (`wathq_cr`,
`website_cr_footer` + number format valid, `mot_licence_list`, `hajj_ministry_list`, or a
human `sbc_manual` check). Everything else stays `candidate` or `unverified` — visibly.

## Matching rules (locked, unchanged)

CR number → verified root domain → exact normalised name → phone prefix. Never merge on a
personal email. Disagreements keep both values and flag. Every merge writes a
`merge_decisions` row naming the rule and evidence, so any decision can be audited or undone.

## Status log

- **2026-08-13** — schema created (`scripts/ta/schema.sql`), db initialised, this plan
  written. Source probing done.
- **2026-08-13, second pass — v3 validated and rebuilt as v4 (`scripts/ta/10…50`).**
  Delivered to Abdulrahman in chat as `TravelAgencies_MASTER_v4.xlsx`. Headline:
  **v3's 6,131 rows are really 4,494 companies.**

  What the validation found and fixed:
  1. **The bare-10-digit CR regex was wrong.** 171 of 392 harvested "CR numbers" were
     Unix timestamps (cache-busting values in the HTML), plus `2147483647` and years.
     Replaced with label-anchored extraction (`21_recrawl_strict.py`) that requires an
     explicit CR/VAT/licence label beside the number and keeps the sentence as evidence.
  2. **Every candidate was then judged by an agent panel with an adversarial second
     pass.** Traps correctly rejected: trademark numbers, 800/920 toll-free lines
     published as «الرقم الموحد», IATA codes, e-commerce authentication numbers, SAMA
     and Insurance-Authority licences, and US/UK/Canadian registrations. 52 numbers
     rejected with a written reason, all kept visible in the sheet.
  3. **A cross-company contamination was caught.** Row M00028 is Almosafer, but
     `jawalmosafer.com` (a different company) was attached to it. Its CR would have
     overwritten Almosafer's. Blocked — M00028 keeps CR 1010363465.
  4. **870 rows were involved in duplicates**; v3 appended 1,249 v2-only rows without
     deduping them against the anchor. 310 groups built, the 139 risky ones adjudicated:
     345 records merged, and **31 groups were blocked from merging** — including a
     "JOSOOR TRAVELS AGENCY" whose Arabic legal name is a construction contractor, and
     الماهر الماسي transport vs travel (two sister companies, not branches).
  5. **1,292 rows were people, not companies** — records created by grouping personal
     email addresses (`19meshari@gmail.com`), including 25 grouped under "Gmail",
     "Yahoo" and "Hotmail" as if those were company names. Moved to their own tab.
  6. **17 rows are not travel businesses at all** — Al Rajhi Bank, stc Bank, hospitals,
     L'Azurde, Johnson Controls. Real companies with a staff travel desk: corporate
     client prospects, not competitors. Flagged, not deleted.

  What was filled in:
  - 948 websites visited: 577 live, 279 dead, 70 parked — every row now says which.
  - 119 company names recovered by reading the company's own website (82 rejected as
    SEO sentences, bare domains or a different business that reused the domain).
  - 52 official numbers + 20 VAT numbers harvested from company websites and verified.
  - Every email domain MX-checked: 3,774 of 4,058 addresses can actually receive mail;
    179 rows carry addresses that would bounce, now separated into their own column.
  - 439 fake phone numbers removed from the callable columns (kept visible).
  - 144 regions derived from landline area codes, each stamped as derived.

  Verified end-to-end afterwards: otlaat.com's CR, VAT and licence were all re-confirmed
  present on the live site.

- **2026-08-13, third pass — three untouched sources found on review.** The second pass
  reported complete while three inputs had never been read:
  1. **127 corporate domains existed only inside email addresses** and were never visited
     (the crawl read the Domains column only). 91 are live; 13 publish a labelled CR.
     Counting a company's own mail domain as its website took websites checked from 927
     to **1,115** and working sites from 578 to **728**.
  2. **The site-published emails and phones were harvested and then never used** — 256
     sites' emails and 324 sites' phones sat unread in the crawl output.
  3. **v3's "TAS v2 leftovers" sheet (243 rows) was never processed.** They are not empty
     shells: 175 carry a name, 140 an email. **153 are companies missing from the master
     altogether**; 90 add data to existing records.

  Two more cross-company contaminations were caught in this pass: `hayatour.com`'s
  "commercial registration" was the **web developer's** number in the site credit line
  («صنع بواسطة»), and row M00511 mixes Saudi Central Bank addresses with a travel
  agency's — it needs splitting. A self-audit of the newly added contacts then caught a
  bug in this pipeline's own guard: substring matching treated `najmalmosafer.com` as
  Almosafer's domain because the string contains "almosafer". The rule is now exact
  base-name match or a prefix extension; **29 records are flagged as carrying a domain
  that probably belongs to another company, and nothing was harvested from them.**

  Net effect of the third pass: 4,494 → **4,647 companies**, confirmed 77 → **106**,
  website-published numbers 52 → **81**, VAT 20 → **30**, mobiles 1,703 → **1,837**,
  landlines 1,468 → **1,596**, working emails 988 → **1,046**. Socials are now split one
  network per column. Re-audited afterwards: **zero cross-company contaminations remain.**

  **Still open:** only 106 of 4,647 are confirmed by an official number — the SBC/CR gap
  is unchanged and still needs a Saudi IP (see the verification stack above). 313
  companies are reachable but still unnamed. 821 rows have no working contact at all.
  Next best moves: the Wathq 100-inquiry trial on the highest-priority rows, and one
  MOT-licence refresh from data.gov.sa from the office.
