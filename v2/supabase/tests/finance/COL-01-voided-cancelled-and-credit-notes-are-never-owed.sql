-- COL-01 — collections (§3.6 receivable; V416, V423; P4-2 COL-*). A published invoice is owed; a voided one, a
-- cancelled one and a credit note never are; an invoice owed today and voided by a newer file leaves what is owed, and
-- the total owed is the sum of its rows. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-voided-invoice-is-still-owed.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 20)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-C1', 'status', 'Published', 'created_on', current_setting('t.d'), 'total_sar', 300),
  jsonb_build_object('ref', 'SA-C2', 'status', 'Voided', 'created_on', current_setting('t.d'), 'total_sar', 200),
  jsonb_build_object('ref', 'SA-C3', 'status', 'Cancelled', 'created_on', current_setting('t.d'), 'total_sar', 100),
  jsonb_build_object('ref', 'CN-C4', 'type', 'credit_note', 'status', 'Published', 'created_on', current_setting('t.d'),
                     'total_sar', 50),
  jsonb_build_object('ref', 'SA-C5', 'status', 'Published', 'created_on', current_setting('t.d'), 'total_sar', 70)),
  now() - interval '2 days');
select test.eq((select jsonb_agg(e ->> 'ref' order by e ->> 'ref') from jsonb_array_elements(api.finance_receivables() -> 'rows') e),
  '["SA-C1", "SA-C5"]'::jsonb, 'only the published invoices are owed; voided, cancelled and credit notes never are');

-- a newer file voids SA-C5
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-C5', 'status', 'Void', 'created_on', current_setting('t.d'), 'total_sar', 70)),
  now() - interval '1 day');
select test.eq((select jsonb_agg(e ->> 'ref') from jsonb_array_elements(api.finance_receivables() -> 'rows') e),
  '["SA-C1"]'::jsonb, 'an invoice voided by a newer file leaves what is owed');
select test.eq((api.finance_receivables() ->> 'outstanding')::numeric,
  (select sum((e ->> 'outstanding')::numeric) from jsonb_array_elements(api.finance_receivables() -> 'rows') e),
  'the total owed is the sum of its rows');
