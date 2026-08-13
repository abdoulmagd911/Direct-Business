# Recovery exports — taken 2026-08-13

**Why this folder exists:** on 2026-08-13 the live `businesses` table was found holding only
30 seeded demo rows (ids `a13e0000-…`), created by a session labelled "world30" at 02:03 UTC.
Investigating the snapshots showed the ~1,015 real leads had already been deleted earlier,
somewhere between 2026-08-10 and 2026-08-12, by a session that did not leave a fresh snapshot.
Nothing is permanently lost — but the good states lived only inside the same database that
kept getting wiped, so they were exported here, out of reach of any future database session.

Every file is the complete contents of one Supabase snapshot table, exported row-by-row and
count-verified, gzip-compressed JSON.

| File | Rows | What it is |
|---|---|---|
| `businesses_snapshot_20260810.json.gz` | 1,035 | **The full real leads database as of Aug 10** — last known-good state |
| `contacts_snapshot_20260810.json.gz` | 335 | Contacts matching that state |
| `finance_invoices_snapshot_20260812.json.gz` | 1,285 | The Direct Payments invoice capture loaded Aug 12 — fullest invoice data ever in the app |
| `fcl_20260812.json.gz` | 16 | finance_client_links from the same capture |
| `biz_20260812.json.gz` | 37 | businesses as an Aug-12 session found them (post-wipe, pre-capture) |
| `biz_20260813.json.gz` | 24 | The "24 real paying customers" state the world30 session replaced |
| `contacts_20260812.json.gz` / `contacts_20260813.json.gz` | 35 / 23 | Contacts for those two states |
| `requests_20260813.json.gz` | 5 | Requests before the world30 wipe |
| `app_state_backup_20260810_premigration.json.gz` | 1 row (~3 MB JSON) | The whole app_state blob (bookings, offers, settings) backed up Aug 10 — the live app_state today is only ~283 KB |

Also created in the database itself (not exported, they are the current live state):
`businesses_seedwipe_20260813`, `contacts_seedwipe_20260813`, `activities_seedwipe_20260813`
— forensic copies of the demo-seeded state found on Aug 13.

**Restore decision is Abdulrahman's** — the recommended restore is
`businesses_snapshot_20260810` + `contacts_snapshot_20260810` back into the live tables
(after snapshotting whatever is live at that moment), keeping the Aug-12 invoice capture.
Do not restore silently; another session may be mid-experiment on the same tables.
