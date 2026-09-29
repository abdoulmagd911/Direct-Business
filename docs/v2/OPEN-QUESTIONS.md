# v2 — open questions

Questions still open, in plain words, each with one recommended answer that the spec assumes until it is answered.
Every question so far has been answered and now lives in `docs/v2/DECISIONS.md`: the first round's Qn became decision
**V(20+n)** (Q7 → V27; Q1 → V21; Q3 → V23, deferred); from Q32 on, a ruled question takes the next free V number
(Q32 → V126, the starting theme Direct, confirmed by the owner on 29 Sep; Q33 → V73; Q34, Q35 and Q36 → V99).

**Open — from the Scout's old-app comparison (29 Sep, `SCENARIOS-OLD.csv`):**

**Q37 — Manager-only notes** (OLD-022). The old app had notes on a task that only managers, admins and the department head
could read. *Recommended:* **no** — keep notes simple (one note, visible like its record; private My day notes stay
author-only, V454). Not blocking: a note kind can be added later.

**Q38 — May a record owner's Undo reach money?** (OLD-038). ACC-112 lets a record's owner undo others' changes within 24
hours; the old app kept Undo on invoices to admins and managers. *Recommended:* **no** — an invoice's changes are undone
only by admins and managers with Full on Finance (D7 as the old app applied it). Not blocking: one predicate in
`audit.undo_allowed`.

**Q39 — Does a contact's side hide it?** (OLD-WRK-106). A contact belongs to one or both sides (V98). *Recommended:*
**no** — every contact shows on the organisation whatever side the reader may see; the side only sorts them. Not
blocking.

**Q40 — Which side does an MoU set to Prospect?** (OLD-PRF-030, V461). *Recommended:* the side chosen on the achievement —
the Client side for a client MoU, the Supplier & partner side for a partner MoU — never a new client (C4). Not blocking.

**Q41 — A status column in the KPI sheet export?** (OLD-PRF-135). *Recommended:* **yes**, the pace band's word (V449), as
the strategy team's sheet has one. Not blocking: a column in P6-2c.

The spec assumes each recommendation until the owner or the oversight rules.

No default is pending: the Scout's money rulings V420–V425 were made ACTIVE by the owner on 29 Sep 12:55 (V434), their
numbers and switches now admin settings.
