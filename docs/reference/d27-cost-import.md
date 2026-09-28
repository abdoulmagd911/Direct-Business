# D27 — Cost comes from the raw Payments cost exports

ACTIVE · 2026-09-28 · second builder · PR #58 · guard `scripts/qa/probe-cost-import.mjs`, phase3 COST-01…11.

- **What reads them.** `js/121-cost-import.js` reads the three raw Direct Payments exports on Finance → Import, exactly as
  Payments downloads them (Excel or CSV): the Transaction Expense Export, the Expense Invoice Export and the Revenue Report.
  Big files are read in slices (CSV 1 MB at a time, Excel in a background worker), so the tab never freezes.
- **What is cost.** `fn_cost_import` (`scripts/sql/cost-import.sql`) sets a money row's cost to the sum of its APPROVED expense
  lines. Pending, Under Review, Cancelled and Rejected never count. With no approved line the cost stays empty (D21).
- **Held, never stored.** A reference with no money row is held and listed on screen; nothing is stored for it and no invoice
  row is made.
- **Any order.** A newer export (its Payments export time, from the file name) wins; an older one only fills blanks; a blank
  never wipes; the same file twice changes nothing. Lines inside a newer file's dates that it no longer lists drop out.
  An invoice imported after its expense lines takes its cost from them at once.
- **The estimate.** The Revenue Report's Total Expense Amount (submitted expenses) is a flagged estimate beside the cost,
  ranked before D23's pass-through lines (`money_rows.est_cost_source`); its revenue and VAT columns are never read.
- **Left alone.** A hand-entered row, a commission, a reference with several money rows, and a cost someone else wrote.
