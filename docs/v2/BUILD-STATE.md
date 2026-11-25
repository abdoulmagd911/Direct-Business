# Build state — changes made to the live workspace outside a landing

One entry per change, newest first: what was changed, on which records, why, and how to put it back.
Landings (code and database structure) are in `docs/v2/landings/`; this file is for data corrections on live.

## 2026-11-25 — Finance checks: the 30 TEST standalone invoices of 2026 (37 failing → 0)

**Where:** live database (project `kimadjvaxgiqzjaukuqg`), table `finance.tax_invoice` only. No invoice, expense
line, receipt or partner was touched.

**What these invoices are (checked first, read-only):** refs 9000000131–9000000160 are TEST data. All 30, their
DPIN rows and their 23 expense lines were written in one instant (20 Nov 2026 03:50:48 UTC) by "System", for the
partners "TEST Seed Company 01–30" (DK-P-0054…0083, made in the same instant), with suppliers "TEST Supplier 1–5".
They are the 2026 half of the 60 standalone invoices made by `egm-test/seed-test-dataset-2026-11-19.sql`. No real
import, no real partner, no real person.

**Why the checks failed:** the seed gave every standalone invoice a DPIN whose total was the whole invoice total
(line 795 of the seed). The check `dpin_differs` expects DPIN total = invoice total − approved expenses. For the 7
invoices the seed left without expenses on purpose ("cost not known yet", or not paid) the checks
`expenses_missing` and `dpin_before_ready` say a DPIN must not exist yet: no DPIN amount passes them.

**Change 1 — DPIN total corrected (23 rows; total − approved expenses, read from live, not typed):**

| Invoice ref | Invoice total | Approved expenses | Old DPIN total | New DPIN total |
|---|---|---|---|---|
| 9000000131, 0132, 0134, 0136, 0137, 0139, 0141, 0142, 0143, 0144, 0145 (11) | 6,000 | 3,600 | 6,000 | 2,400 |
| 9000000146, 0147, 0149, 0151, 0152, 0154, 0155, 0156, 0157, 0158, 0159, 0160 (12) | 8,000 | 4,800 | 8,000 | 3,200 |

**Change 2 — DPIN withdrawn (7 rows; put in the bin, not erased — `deleted_at` set, reason written on the row):**

| Invoice ref | Invoice total | Status | Approved expenses | Old DPIN total | New |
|---|---|---|---|---|---|
| 9000000133 | 6,000 | Fully Paid | none | 6,000 | no DPIN |
| 9000000135 | 6,000 | Pending | none | 6,000 | no DPIN |
| 9000000138 | 6,000 | Fully Paid | none | 6,000 | no DPIN |
| 9000000140 | 6,000 | Draft | none | 6,000 | no DPIN |
| 9000000148 | 8,000 | Fully Paid | none | 8,000 | no DPIN |
| 9000000150 | 8,000 | Pending | none | 8,000 | no DPIN |
| 9000000153 | 8,000 | Fully Paid | none | 8,000 | no DPIN |

The workspace has no screen that withdraws a DPIN, so this was done in the database directly; the audit trigger on
the table recorded each row.

**Proof (same count the Finance page's "Needs attention" box uses, `finance.health` → `checks_failed`):**

| | Before | After |
|---|---|---|
| Checks failing, 2026 | 37 | 0 |
| Checks failing, all years | 75 | 38 (all on the 2025 twins, refs 9000000101–0130 — not in this job) |
| Counted units / Revenue / Cost / Profit, all years | 135 / 515,350 / 254,450 / 260,900 | identical |
| Provisional units | 25 | 25 |

A rolled-back trial run was made first; the only thing that moved in the money rows was the DPIN label of the 7.
The live page itself was not opened: it needs a sign-in this session does not hold.

**To put it back:** set `total_sar` back to the invoice total on the 23 rows, and clear `deleted_at` /
`delete_reason` on the 7 rows whose `delete_reason` starts "TEST seed of 20 Nov". The seed file itself still
writes the old values: a fresh run of it would bring the 37 back (and the 2025 half still has its 38).
