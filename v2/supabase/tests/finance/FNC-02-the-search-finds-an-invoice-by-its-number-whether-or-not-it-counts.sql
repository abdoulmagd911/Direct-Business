-- FNC-02 — the search finds an invoice by its number whether or not it counts (Landing 37, Finance F-C, A6). A Draft
-- or Pending invoice recorded here, and an imported row that is not confirmed paid, are found by their number in the
-- Finance search and in the top search's `invoices`, each with its status word and where it came from. A document that
-- is recorded here and imported too is listed once, as the one recorded here. A person with no level on Finance is
-- answered no invoice. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-search-skips-imported-rows.sql,
--           supabase/tests/sabotage/the-search-finds-only-paid-invoices.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.none', test.person('Test No Finance', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.none')::uuid, 'finance', 'none', 'made up: no Finance access');
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Fnc2 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select api.finance_row_add('invoice', jsonb_build_object('ref', 'MADEUP-20261113-01', 'kind', 'transaction',
  'status', 'Draft', 'created_on', current_setting('t.d'), 'total_sar', 100, 'customer_name', 'Made Up New Company'), 'made up');
select api.finance_row_add('invoice', jsonb_build_object('ref', '9903700012', 'kind', 'transaction',
  'status', 'Pending', 'created_on', current_setting('t.d'), 'total_sar', 100, 'customer_name', 'Made Up Alpha'), 'made up');
select api.finance_row_add('invoice', jsonb_build_object('ref', '9903700020', 'kind', 'transaction',
  'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 800, 'customer_name', 'Made Up Alpha'), 'made up');
select set_config('t.b', gen_random_uuid()::text, true);
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values (current_setting('t.b')::uuid, current_setting('t.p')::uuid, 'invoice_export', 'made-up-fc2.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, fully_paid, status_text, created_by)
values (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'invoice', null, '9903700003', current_setting('t.d')::date, 900, 900, false, 'Waiting for Issuing', current_setting('t.head')::uuid),
       -- the same document as the one recorded here above: listed once
       (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', '9903700020', null, current_setting('t.d')::date, 800, 800, true, 'Invoice - Fully Paid', current_setting('t.head')::uuid);
select test.done();
select test.as_person(current_setting('t.head')::uuid);

-- a Draft invoice, by its whole number and by a part of it
select test.eq((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('ref', x ->> 'ref', 'status', x ->> 'status',
                         'pay_state', x ->> 'pay_state', 'source', x ->> 'source'))
                from pg_catalog.jsonb_array_elements(api.finance_search('MADEUP-20261113-01')) x),
               '[{"ref": "MADEUP-20261113-01", "status": "Draft", "pay_state": "draft", "source": "manual"}]'::jsonb,
  'a Draft invoice is found by its number, and says it is a Draft');
select test.eq((select pg_catalog.jsonb_agg(x ->> 'ref') from pg_catalog.jsonb_array_elements(api.finance_search('20261113')) x),
               '["MADEUP-20261113-01"]'::jsonb,
  'a Draft invoice is found by a part of its number');
-- a Pending invoice
select test.eq((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('ref', x ->> 'ref', 'pay_state', x ->> 'pay_state'))
                from pg_catalog.jsonb_array_elements(api.finance_search('9903700012')) x),
               '[{"ref": "9903700012", "pay_state": "pending"}]'::jsonb,
  'a Pending invoice is found by its number');
-- an imported row that is not confirmed paid
select test.eq((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('ref', x ->> 'ref', 'status', x ->> 'status',
                         'pay_state', x ->> 'pay_state', 'source', x ->> 'source', 'partner', x ->> 'partner_id',
                         'name', x ->> 'customer_name', 'total', (x ->> 'total_sar')::numeric))
                from pg_catalog.jsonb_array_elements(api.finance_search('9903700003')) x),
               pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('ref', '9903700003', 'status', 'Waiting for Issuing',
                 'pay_state', 'pending', 'source', 'import', 'partner', current_setting('t.p'),
                 'name', 'Made Up Fnc2 Co', 'total', 900.00)),
  'an imported row that is not paid is found by its number, with its organisation');
-- recorded here and imported: once, as the one recorded here
select test.eq((select pg_catalog.jsonb_agg(x ->> 'source') from pg_catalog.jsonb_array_elements(api.finance_search('9903700020')) x),
               '["manual"]'::jsonb,
  'a document recorded here and imported is listed once');
-- the top search answers the same invoices
select test.eq((select pg_catalog.jsonb_agg(x ->> 'ref') from pg_catalog.jsonb_array_elements(api.search('MADEUP-20261113-01') -> 'invoices') x),
               '["MADEUP-20261113-01"]'::jsonb,
  'the top search finds the Draft invoice by its number');
select test.eq((select pg_catalog.jsonb_agg(x ->> 'ref') from pg_catalog.jsonb_array_elements(api.search('9903700003') -> 'invoices') x),
               '["9903700003"]'::jsonb,
  'the top search finds the imported unpaid row by its number');
-- no level on Finance: no invoice in the top search, and the Finance search refuses
select test.as_person(current_setting('t.none')::uuid);
select test.eq(api.search('MADEUP-20261113-01') -> 'invoices', '[]'::jsonb,
  'a person with no level on Finance is answered no invoice');
select test.raises($$select api.finance_search('MADEUP-20261113-01')$$, '42501',
  'no level on Finance searches no invoice', 'access.needs_level');
