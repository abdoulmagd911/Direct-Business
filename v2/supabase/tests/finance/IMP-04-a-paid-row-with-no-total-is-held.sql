-- IMP-04 — a paid row needs its total (QA-531; V611, D21). A Fully Paid row with no total is held with the reason
-- no_total and written nowhere, so no unit counts with no revenue; a pending row with no total is written; a newer file
-- with a blank total keeps the stored one. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-paid-row-with-no-total-is-written.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 10)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select test.eq((select jsonb_agg(h ->> 'reason' order by h ->> 'reason') from jsonb_array_elements(api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-N1', 'status', 'Fully Paid', 'created_on', current_setting('t.d')),
  jsonb_build_object('ref', 'TX-N2', 'status', 'Published', 'created_on', current_setting('t.d')),
  jsonb_build_object('ref', 'TX-N3', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300)),
  now() - interval '2 days') -> 'held') h),
  '["no_total"]'::jsonb, 'a paid row with no total is held, with its reason');
select test.as_owner();
select test.eq((select jsonb_agg(ref order by ref) from finance.invoice where ref like 'TX-N%'), '["TX-N2", "TX-N3"]'::jsonb,
  'and written nowhere; a pending row with no total is written');
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-N3', 'status', 'Fully Paid', 'created_on', current_setting('t.d'))), now() - interval '1 day');
select test.as_owner();
select test.eq((select total_sar from finance.invoice where ref = 'TX-N3'), 300.00::numeric,
  'a newer file with a blank total keeps the stored one');
