# Travel Agencies Confirmed Database — the rebuild

Started 2026-08-13 on Abdulrahman's instruction: **do not trust any earlier merge, including
v3.** Re-check everything from the raw sources, verify against official sources, and fix how
the data is stored so it can carry a full project later. Free verification only.

## Where it lives

`data/ta/ta.sqlite` — a single database file in this repo, created by
`scripts/ta/init_db.py` from `scripts/ta/schema.sql`. **Deliberately separate from the app's
Supabase**: Abdulrahman wants the travel-agency database built alone until it is complete,
and only then loaded into the app. The repo is also the safest place we have — this week
proved that live Supabase tables can be wiped by parallel sessions (see
`data/recovery/README.md`).

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
| `data/recovery/finance_invoices_snapshot_20260812.json.gz` | this repo | The Aug-12 Direct Payments capture (1,285 invoices) |

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
  written. Source probing done. Next: ingest raw sources (task 3).
