-- FND-09 — two distinct real documents that share one number both count (the finding-9 check, Landing 32).
-- The L18 guard collapses a document that came through both doors into one row (UNI-03). It must never
-- collapse two different documents that only share a number: (a) the same number at two different
-- organisations; (b) at one organisation, a transaction and a standalone invoice with the same number, both
-- imported; (c) at one organisation, a transaction recorded by hand and an imported standalone invoice with
-- the same number. Each is two documents: the Ledger and the Overview count two, and agree. Every value is
-- made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p1', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Shared Number One',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.p2', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Shared Number Two',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p1')::uuid, 'payments_client_id', '84091', 'made up', 'postpaid');
-- (c) the manual transaction, numbered FND-9C (consolidated, so it is a transaction unit)
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'FND-9C', 'client_id', '84091', 'status', 'Fully Paid', 'created_on', current_setting('t.d'),
                     'total_sar', 1000, 'consolidation_status', 'Consolidation complete')),
  now() - interval '1 day');
select set_config('t.b1', gen_random_uuid()::text, true);
select set_config('t.b2', gen_random_uuid()::text, true);
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values (current_setting('t.b1')::uuid, current_setting('t.p1')::uuid, 'invoice_export', 'made-up-9a.csv', current_setting('t.head')::uuid),
       (current_setting('t.b2')::uuid, current_setting('t.p2')::uuid, 'invoice_export', 'made-up-9b.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, created_by)
values
  -- (a) one invoice number at two organisations
  (current_setting('t.p1')::uuid, current_setting('t.b1')::uuid, 'invoice', null, 'FND-9A', current_setting('t.d')::date, 100, 100, 10, 90, true, current_setting('t.head')::uuid),
  (current_setting('t.p2')::uuid, current_setting('t.b2')::uuid, 'invoice', null, 'FND-9A', current_setting('t.d')::date, 200, 200, 20, 180, true, current_setting('t.head')::uuid),
  -- (b) at one organisation: a transaction and a standalone invoice sharing the number FND-9B
  (current_setting('t.p2')::uuid, current_setting('t.b2')::uuid, 'transaction', 'FND-9B', 'FND-9B-INV', current_setting('t.d')::date, 400, 400, 40, 360, true, current_setting('t.head')::uuid),
  (current_setting('t.p2')::uuid, current_setting('t.b2')::uuid, 'invoice', null, 'FND-9B', current_setting('t.d')::date, 800, 800, 80, 720, true, current_setting('t.head')::uuid),
  -- (c) an imported standalone invoice sharing the manual transaction's number FND-9C
  (current_setting('t.p1')::uuid, current_setting('t.b1')::uuid, 'invoice', null, 'FND-9C', current_setting('t.d')::date, 2000, 2000, 200, 1800, true, current_setting('t.head')::uuid);
select test.done();

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.ov', api.finance_period('2026-01-01'::date, '2026-12-31'::date)::text, true);
select set_config('t.ul', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
-- six documents: 100 + 200 + 400 + 800 + 1000 + 2000 = 4500
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'units')::int, 6, 'the Ledger counts all six documents');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'revenue')::numeric, 4500.00, 'the Ledger revenue is every document, once each');
select test.eq((current_setting('t.ov')::jsonb ->> 'units')::int, 6, 'the Overview counts all six documents');
select test.eq((current_setting('t.ov')::jsonb ->> 'revenue')::numeric, 4500.00, 'the Overview revenue is every document, once each');
select test.eq((select (api.finance_income_by_service('2026-01-01'::date, '2026-12-31'::date) ->> 'revenue')::numeric),
  4500.00, 'By service agrees');
-- each shared number is listed twice in the Ledger, never once
select test.eq((select count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'rows') r
                where coalesce(r ->> 'transaction_number', r ->> 'invoice_number') = 'FND-9A'), 2,
  '(a) the same number at two organisations is two rows');
select test.eq((select count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'rows') r
                where coalesce(r ->> 'transaction_number', r ->> 'invoice_number') = 'FND-9B'), 2,
  '(b) a transaction and a standalone invoice sharing a number are two rows');
select test.eq((select count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'rows') r
                where coalesce(r ->> 'transaction_number', r ->> 'invoice_number') = 'FND-9C'), 2,
  '(c) a manual transaction and an imported standalone invoice sharing a number are two rows');
