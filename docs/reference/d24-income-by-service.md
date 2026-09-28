# D24 — Income by service (detail)

Owner, 28 Sep 2026, via the oversight (the old "Income by service line" was "a 100% disaster"). The short rule is in
`docs/DECISIONS.md` → D24.

**The rule.** Finance → Overview → "Income by service" puts each invoice LINE under ONE main service, then adds the lines
up — over the invoices that count (paid sales; never wallet top-ups or billing links). Per service: revenue, approved cost,
the flagged estimate (D23) apart, profit and margin (over the revenue whose cost is known or estimated).

**Which service a line goes to — three lists a person keeps on Finance → Rules, never code:**
1. Main services (in the order shown). A service marked "not income" is never counted (Direct Wallet, Techtic).
2. Payments products → service: the default for a product's lines ("Direct Flights" → Flights).
3. Items → service: overrides the product ("Chauffeur Service" → Transportation). The item is the FIRST part of a line's
   name ("Chauffeur Service - 3rd Party Fee"); the item-name list for pass-through / fee keys on the LAST part, which many
   items share ("3rd Party Fee"), so the two lists are separate.

**Cost per service.** An invoice's approved cost is split across its services by each one's share of the invoice's lines.
The estimate is the pass-through lines of that service, only while the invoice has no approved cost.

**Adds up.** An invoice with no item lines, or whose lines do not add up to its revenue, keeps the difference in "Not split
by line", so the table's total always equals Revenue on the tiles.

**Who changes the lists.** Anyone with Full control on Finance (no role — the owner's rule for Finance Rules). Everyone who
sees Finance reads them. A removal asks first in the app's box (D19) and is final; everything is in the change log.

**Where it lives.** `scripts/sql/d24-income-by-service.sql` (+ rollback; the starting lists in
`d24-income-by-service-defaults.sql`, applied only on the oversight's word), js/25 part 1, js/120 (the lists), js/16
(`FIN.svcBy`). Guards: `scripts/qa/phase3` D24-01 and `scripts/qa/probe-d24-income-by-service.mjs`.
