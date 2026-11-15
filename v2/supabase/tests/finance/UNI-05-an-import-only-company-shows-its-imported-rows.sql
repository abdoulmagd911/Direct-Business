-- UNI-05 — a company with only imported rows shows them on its Finance tab (Landing 25, F-A/A1). Before this
-- landing the tab read money_row only, so a company whose money came through the import door showed nothing at
-- all. The tab's read (the unified ledger filtered to the company) must list the imported rows and total them.
-- Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Uni5 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '88005', 'made up', 'postpaid');
-- only imported rows, no manual row at all: one costed (900, cost 300, profit 600), one cost-pending (400, no cost)
select set_config('t.b', gen_random_uuid()::text, true);
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values (current_setting('t.b')::uuid, current_setting('t.p')::uuid, 'invoice_export', 'made-up-5.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, created_by)
values (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', '1163000051', '1163000051', current_setting('t.d')::date, 900, 900, 300, 600, true, current_setting('t.head')::uuid),
       (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', '1163000052', '1163000052', current_setting('t.d')::date, 400, 400, null, null, true, current_setting('t.head')::uuid);
select test.done();
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.tab', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date, current_setting('t.p')::uuid)::text, true);
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'units')::int, 2,
  'the import-only company counts two units');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'revenue')::numeric, 1300.00,
  'the import-only company revenue is 1300');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'cost')::numeric, 300.00,
  'the import-only company cost is 300 — only the costed row');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'profit')::numeric, 600.00,
  'the import-only company profit is 600 — only the costed row');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'without_cost')::int, 1,
  'one row without cost on the import-only company');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'manual_units')::int, 0,
  'no manual units on the import-only company');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'import_units')::int, 2,
  'two imported units on the import-only company');
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'source' = 'import'), 2, 'both imported rows are in the tab list');
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'source' = 'manual'), 0, 'no manual row in the tab list');
-- the cost-pending import row carries no profit of its own, so the tab's profit rule has a row to count
select test.eq((select (r ->> 'profit')::numeric is null from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'transaction_number' = '1163000052'), true,
  'the cost-pending import row has no profit');
