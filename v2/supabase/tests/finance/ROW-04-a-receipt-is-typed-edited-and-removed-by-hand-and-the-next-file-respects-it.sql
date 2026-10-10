-- ROW-04 — receipts by hand (V622 (3), D21). A person with Full on Finance adds a receipt beside the imported ones and
-- what is owed drops by it; edits an imported receipt's amount, and the next file keeps the person's figure and lists
-- the difference, which Use import settles; removes a receipt with a reason, and Undo brings it back. Own on Finance
-- types no receipt. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-import-overwrites-a-persons-receipt.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Member', 'member')::text, true);
select set_config('t.t', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-9201', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 20)::text, 'total_sar', 500),
  jsonb_build_object('ref', 'SA-9202', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 20)::text, 'total_sar', 300)),
  now() - interval '3 days');
select api.finance_import('receipts', jsonb_build_array(
  jsonb_build_object('ref', 'SA-9201', 'method', 'Bank transfer', 'amount_sar', 200, 'paid_on', (current_setting('t.t')::date - 10)::text,
                     'ref_at_method', 'MADE-UP-R1')), now() - interval '2 days');
select test.as_owner();
select set_config('t.i1', (select id::text from finance.invoice where ref = 'SA-9201'), true);
select set_config('t.i2', (select id::text from finance.invoice where ref = 'SA-9202'), true);
select set_config('t.r1', (select id::text from finance.receipt where invoice_id = current_setting('t.i1')::uuid), true);

-- added by hand: what is owed drops by it; Own types no receipt
select test.as_person(current_setting('t.am')::uuid);
select test.raises(format('select api.finance_row_add(%L, %L, %L)', 'receipt',
  jsonb_build_object('invoice_id', current_setting('t.i2'), 'amount_sar', 100, 'paid_on', current_setting('t.t'))::text, 'made up'),
  '42501', 'Own on Finance types no receipt', 'access.needs_level');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.add', api.finance_row_add('receipt',
  jsonb_build_object('invoice_id', current_setting('t.i2'), 'amount_sar', 100, 'paid_on', (current_setting('t.t')::date - 5)::text,
                     'method', 'Cash'), 'made up: paid at the desk')::text, true);
select test.eq((select (e ->> 'outstanding')::numeric from jsonb_array_elements(api.finance_receivables() -> 'rows') e
                where e ->> 'ref' = 'SA-9202'), 200::numeric, 'a receipt typed by hand: what is owed drops by it');
select test.as_owner();
select test.eq((select jsonb_build_object('source', r.source, 'mine', r.src ->> '_row', 'own_key', r.receipt_key like 'person|%')
                from finance.receipt r where r.id = (current_setting('t.add')::jsonb ->> 'id')::uuid),
  '{"source": "manual", "mine": "person", "own_key": true}'::jsonb, 'the row is the person''s, with a key no file carries');

-- an edited amount is the person's: the next file keeps it and lists the difference
select set_config('t.v1', (select r.version::text from finance.receipt r where r.id = current_setting('t.r1')::uuid), true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_row_edit('receipt', current_setting('t.r1')::uuid, '{"amount_sar": 250}', current_setting('t.v1')::int,
                            'made up: the bank slip says 250');
select test.eq(api.finance_import('receipts', jsonb_build_array(
  jsonb_build_object('ref', 'SA-9201', 'method', 'Bank transfer', 'amount_sar', 220, 'paid_on', (current_setting('t.t')::date - 10)::text,
                     'ref_at_method', 'MADE-UP-R1')), now() - interval '1 hour') -> 'held' -> 0 ->> 'reason',
  'person_edited', 'a later file names the receipt a person edited');
select test.eq((select (e ->> 'outstanding')::numeric from jsonb_array_elements(api.finance_receivables() -> 'rows') e
                where e ->> 'ref' = 'SA-9201'), 250::numeric, 'a later file keeps the person''s amount and lists the difference');
select test.eq((select jsonb_build_object('table', d.row_table, 'field', d.field, 'mine', d.mine, 'import', d.from_import)
                from api.finance_differences(current_setting('t.i1')::uuid) d),
  '{"table": "receipt", "field": "amount_sar", "mine": "250.00", "import": "220.00"}'::jsonb, 'the difference is listed');
select api.finance_difference_decide((select d.id from api.finance_differences(current_setting('t.i1')::uuid) d), 'use_import',
  (select d.version from api.finance_differences(current_setting('t.i1')::uuid) d), 'made up: the file is right');
select test.eq((select (e ->> 'outstanding')::numeric from jsonb_array_elements(api.finance_receivables() -> 'rows') e
                where e ->> 'ref' = 'SA-9201'), 280::numeric, 'Use import takes the file''s figure');

-- removed with a reason; Undo brings it back
select set_config('t.rm', api.finance_rows_remove('receipt', array[(current_setting('t.add')::jsonb ->> 'id')::uuid],
                                                  'made up: typed twice')::text, true);
select test.eq((select (e ->> 'outstanding')::numeric from jsonb_array_elements(api.finance_receivables() -> 'rows') e
                where e ->> 'ref' = 'SA-9202'), 300::numeric, 'a removed receipt no longer counts');
select api.undo((current_setting('t.rm')::jsonb ->> 'request_id')::uuid);
select test.eq((select (e ->> 'outstanding')::numeric from jsonb_array_elements(api.finance_receivables() -> 'rows') e
                where e ->> 'ref' = 'SA-9202'), 200::numeric, 'and Undo brings it back');
