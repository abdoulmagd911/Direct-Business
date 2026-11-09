-- F188: the status combobox offers near-duplicate spellings of the same state. Both members of every pair are
-- already in status_map with the same maps_to, so the only deterministic choice in the data is the lowest sort:
-- Fully Paid (10), Pending (30), Void (70), Cancelled (90) survive; Fully Paid as receivable (15), Pending
-- Payment (40), Voided (80), Canceled (100) retire. Fully Paid (Audit Required) is NOT a duplicate — it is the
-- only row with audit_required = true, and finance.invoice has no audit column of its own, so merging it would
-- silently drop the audit signal. The combobox is left with 8 options.
-- The retired spellings stop resolving (finance.status_of matches active rows only), so a re-import of an old file
-- carrying one is held, as intended — never silently rewritten.
-- Stored rows are normalised, word and id together, never the word alone: 'Fully Paid as receivable' passes the
-- ledger's paid gate only through its maps_to, so a word-only rewrite would flip its paid state. Scope (O5): only
-- rows that survive TEST cleanup — rows created by a TEST person are left alone for the hard-delete.
-- The F2–F5 totals check (live, before and after this migration) is what proves no paid state flipped.

-- Retire the four spellings: core.list_items excludes inactive rows by default, so the NewInvoice combobox drops to 8.
update finance.status_map set active = false
where key in ('fully_paid_receivable', 'pending_payment', 'voided', 'canceled');

-- Normalise the manual invoices, word and id together.
with mapping(retired_key, retired_word, survivor_key) as (values
  ('fully_paid_receivable', 'Fully Paid as receivable', 'fully_paid'),
  ('pending_payment', 'Pending Payment', 'pending'),
  ('voided', 'Voided', 'void'),
  ('canceled', 'Canceled', 'cancelled'))
update finance.invoice i
set status_raw = s.word, status_id = s.id
from mapping m
join finance.status_map s on s.key = m.survivor_key
where i.deleted_at is null
  and (norm.fold(i.status_raw) = norm.fold(m.retired_word)
       or i.status_id in (select id from finance.status_map where key = m.retired_key))
  and not exists (select 1 from core.person p where p.id = i.created_by and p.is_test);

-- Normalise the imported records, which carry the word only (their fully_paid boolean is stored independently and
-- is untouched by a word rewrite).
with mapping(retired_word, survivor_word) as (values
  ('Fully Paid as receivable', 'Fully Paid'),
  ('Pending Payment', 'Pending'),
  ('Voided', 'Void'),
  ('Canceled', 'Cancelled'))
update work.import_record r
set status_text = m.survivor_word
from mapping m
where r.deleted_at is null
  and norm.fold(r.status_text) = norm.fold(m.retired_word)
  and not exists (select 1 from core.person p where p.id = r.created_by and p.is_test);
