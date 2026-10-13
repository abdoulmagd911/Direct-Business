-- FAS-01 — the "Payments · as of" stamp (the Finance screens brief I.4; V500, V401). Before any file is read there is
-- no day, never today. Each Payments export carries the day it was last read — the newest export time of its imports,
-- in Riyadh — and the stamp is the oldest of those days, so the figures never look fresher than the oldest file behind
-- them. A newer invoices file moves the invoices day only. Anyone who views Finance reads it. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-as-of-day-is-the-newest-file.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Member', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 20)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.finance_payments_as_of(), '{"as_of": null, "files": {}}'::jsonb,
  'no file read yet: no day, never today');

select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-71', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 100)), '2026-01-10T09:00:00Z');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-71', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 40,
                     'created_at', '2026-01-01T10:00:00Z')), '2026-01-05T22:30:00Z');
select test.eq(api.finance_payments_as_of(),
  '{"as_of": "2026-01-06", "files": {"invoices": "2026-01-10", "expenses": "2026-01-06"}}'::jsonb,
  'each file its Riyadh day; the stamp is the oldest of them');

select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-72', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 50)), '2026-01-20T09:00:00Z');
select test.eq(api.finance_payments_as_of() -> 'files' ->> 'invoices', '2026-01-20', 'a newer invoices file moves its own day');
select test.eq(api.finance_payments_as_of() ->> 'as_of', '2026-01-06', 'and the stamp stays at the oldest file');

select test.as_person(current_setting('t.am')::uuid);
select test.eq(api.finance_payments_as_of() ->> 'as_of', '2026-01-06', 'anyone who views Finance reads the stamp');
