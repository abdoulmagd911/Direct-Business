-- UNI-01 — the unified ledger read answers with a manual row and an imported row present
-- (live failure 6 Nov 2026: Postgres 42601 "each UNION query must have the same number of columns"
-- on /rest/v1/rpc/finance_unified_ledger, so the Finance page ledger could not load at all).
-- The manual branch of the combined UNION was missing amount_sar. Only calling the read
-- with rows present can catch it — schema and grants checks cannot.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
-- a manual row, via the invoice import that writes finance.invoice (the manual store)
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-UNI-1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000)),
  now() - interval '1 day');
-- an imported row, via the new import engine's tables
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Uni Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.b', gen_random_uuid()::text, true);
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values (current_setting('t.b')::uuid, current_setting('t.p')::uuid, 'invoice_export', 'made-up.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, created_by)
values (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', '1163000002', '1163000002', current_setting('t.d')::date, 500, 500, 100, 400, true, current_setting('t.head')::uuid);
select test.done();
-- the read must answer, with one manual and one imported unit
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.u', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select test.eq(jsonb_typeof(current_setting('t.u')::jsonb), 'object', 'the unified read answers an object');
select test.eq((current_setting('t.u')::jsonb -> 'totals' ->> 'units')::int, 2, 'one manual and one imported unit');
select test.eq((current_setting('t.u')::jsonb -> 'totals' ->> 'manual_units')::int, 1, 'one manual unit');
select test.eq((current_setting('t.u')::jsonb -> 'totals' ->> 'import_units')::int, 1, 'one imported unit');
select test.eq((select count(*)::int from jsonb_array_elements(current_setting('t.u')::jsonb -> 'rows') r where r ->> 'source' = 'manual'), 1, 'the manual row is in the rows');
select test.eq((select count(*)::int from jsonb_array_elements(current_setting('t.u')::jsonb -> 'rows') r where r ->> 'source' = 'import'), 1, 'the imported row is in the rows');
