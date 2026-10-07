# v2 — open questions

Questions still open, in plain words, each with one recommended answer that the spec assumes until it is answered.
Every question so far has been answered and now lives in `docs/v2/DECISIONS.md`: the first round's Qn became decision
**V(20+n)** (Q7 → V27; Q1 → V21; Q3 → V23, deferred); from Q32 on, a ruled question takes the next free V number (Q32
→ V126, the starting theme Direct, confirmed by the owner on 29 Sep; Q33 → V73; Q34, Q35 and Q36 → V99; Q41 → V473;
Q42 and Q44 → V492 and V493; Q39 → V520, Q40 → V521, Q43 → V522, Q45 → V523, Q37 → V524, Q38 parked → V525).

## Open — Finance, from the owner's rules of 5 Oct (asked 7 Oct)

Each is one plain question, the recommended answer the spec assumes until it is answered, and what the answer changes.
None holds up the Finance build: the database is built for either answer (V610–V618).

**Q46 — A tender at signing: revenue, or sales credit?** When a tender is signed, does its signed value count as
**revenue and profit** in the signing month, or only as the account manager's **sales credit** (won business)?
*Recommended:* sales credit at signing; revenue and profit come from its paid transactions as they happen.
*Effect:* counted as revenue, the signing month shows the whole value as profit with no cost, and the following months
show the costs with no revenue — losses. Setting `finance.tender_counts_as` (V614).

**Q47 — Closing a month.** Who closes each month, and by when? And when a sale created in a closed month is paid later,
or a paid sale is cancelled after the close, does the closed month change?
*Recommended:* the finance lead closes each month by its 5th working day; a closed month never changes — every later
change (late-paid, cancelled after payment, cost approved later) shows as a dated note on that month and in the next
report's "Added to earlier periods".
*Effect:* reported months stay fixed, and late news is never lost (V500, V610).

**Q48 — Which products never carry a supplier cost?** Many paid invoices have no expense at all, mostly service and
visa fees. Under "cost 0 until approved" they would stay Provisional for ever.
*Recommended:* finance names the products with no supplier cost (service fees and commissions at least; visa only if
finance confirms); those are Final at cost 0, and only bookings that should have a cost stay Provisional.
*Effect:* "Provisional" then means "an expense is really missing", instead of flagging nearly half the invoices (V611).

**Q49 — Who sets the channel on an individual's booking?** Payments has no Commercial / Direct / Promo field.
*Recommended:* the account manager tags their own bookings Commercial (with their name); untagged means Direct; a
person with Full on Finance may change it.
*Effect:* only tagged bookings credit a person (V613).

**Q50 — How the 2026 money enters at go-live.** On 28 Sep the decision was that the team types it in the browser.
*Recommended:* import the Payments exports (invoices and expenses) for go-live; typing stays for corrections and
anything Payments lacks.
*Effect:* the paid 2026 invoices arrive in minutes instead of days of typing, and the typing screens are still tested
on real work (V618).

**Q51 — For finance: where do off-system bookings sit in Payments?** They appear only as financial transactions. Under
which product or kind? If it is "Other Income", no rule may exclude Other Income wholesale, or they vanish from revenue.
*Recommended:* finance names it; any exclusion stays a typed rule with a reason (D16) (V617).

## Answered

**No other question is open.** The owner answered the last round on 1 Oct 2026, night (relayed by the oversight): Q37
manager-only notes → **V524** (the reverse: a note on a record says who can see it — everyone on the record, only me,
or me and the people I name; built after stage 1 opens); Q39 a contact's sides → **V520** (no — every contact shows);
Q40 an MoU's side → **V521** (the side chosen on the achievement; never a new client); Q43 "B2C" → **V522** (banned);
Q45 the report periods → **V523** (monthly). Q41 was answered on 29 Sep (V473).

**Parked — Q38, undo on money** (OLD-038) → **V525**: the owner wants Finance rethought around transactions instead of
invoices in a joint design session; until then the old safe default holds — only admins and managers with Full on
Finance undo a change to money.

**Later, not open:** the Vision board's direction is set (V527: a read-only view over what is recorded, about
November); whose board it is and who sees it wait for its brief — `FUTURE-MODULES.md`, module 10.

No default is pending: the Scout's money rulings V420–V425 were made ACTIVE by the owner on 29 Sep 12:55 (V434), their
numbers and switches now admin settings.
