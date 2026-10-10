-- ROW-03 — the hand-entry round (the Finance screens brief F12, V622), scripted as the owner will walk it, on the
-- database's side: a person with Full on Finance types three invoices (one for a customer Finance has never seen) and a
-- three-line transaction, edits an imported expense and removes an imported line; the figures follow each step; then
-- Undo takes every step back, newest first, and the imported invoice is as the file gave it; no month is closed on the
-- way. Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 10)::text, true);
select set_config('t.closed', (select count(*) from finance.month_close)::text, true);

-- an imported transaction with two lines and an approved expense
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-84', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 700,
                     'lines', jsonb_build_array(
                       jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Hotel night', 'total_sar', 500),
                       jsonb_build_object('line_no', 2, 'product', 'Direct Visas', 'name', 'Visa', 'total_sar', 200)))),
  now() - interval '2 days');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-84', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 400,
                     'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '2 days');
select test.as_owner();
select set_config('t.tx', (select id from finance.invoice where ref = 'TX-84')::text, true);
select set_config('t.e', (select id from finance.expense_line where invoice_id = current_setting('t.tx')::uuid)::text, true);
select set_config('t.ve', (select version from finance.expense_line where id = current_setting('t.e')::uuid)::text, true);
select set_config('t.l2', (select id from finance.invoice_line where invoice_id = current_setting('t.tx')::uuid and line_no = 2)::text, true);

select test.as_person(current_setting('t.head')::uuid);
-- three invoices typed by hand; MN-83 is for a walk-in customer no list knows
select set_config('t.r1', api.finance_row_add('invoice', jsonb_build_object('ref', 'MN-81', 'kind', 'transaction',
  'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900,
  'customer_name', 'Made Up Trading Co'), 'made up: typed')::text, true);
select set_config('t.r2', api.finance_row_add('invoice', jsonb_build_object('ref', 'MN-82', 'kind', 'transaction',
  'status', 'Published', 'created_on', current_setting('t.d'), 'total_sar', 400,
  'customer_name', 'Made Up Travel House'), 'made up: typed')::text, true);
select set_config('t.r3', api.finance_row_add('invoice', jsonb_build_object('ref', 'MN-83', 'kind', 'transaction',
  'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 150,
  'customer_name', 'Made-up Walk-in Customer'), 'made up: typed')::text, true);
select set_config('t.i1', current_setting('t.r1')::jsonb ->> 'id', true);
-- a three-line transaction
select set_config('t.r4', api.finance_row_add('invoice_line', jsonb_build_object('invoice_id', current_setting('t.i1'),
  'product', 'Direct Hotels', 'name', 'Made-up hotel, 2 nights', 'total_sar', 600), 'made up')::text, true);
select set_config('t.r5', api.finance_row_add('invoice_line', jsonb_build_object('invoice_id', current_setting('t.i1'),
  'product', 'Direct Visas', 'name', 'Made-up visa', 'total_sar', 200), 'made up')::text, true);
select set_config('t.r6', api.finance_row_add('invoice_line', jsonb_build_object('invoice_id', current_setting('t.i1'),
  'product', 'Direct Transport', 'name', 'Made-up transfer', 'total_sar', 100), 'made up')::text, true);
-- edit the imported expense, remove an imported line
select set_config('t.r7', api.finance_row_edit('expense_line', current_setting('t.e')::uuid, '{"amount_sar": 430}',
  current_setting('t.ve')::int, 'made up: the hotel''s final bill')::text, true);
select set_config('t.r8', api.finance_rows_remove('invoice_line', array[current_setting('t.l2')::uuid],
  'made up: typed twice in Payments')::text, true);

select test.as_owner();
select test.eq((select array_agg(line_no order by line_no) from finance.invoice_line
                where invoice_id = current_setting('t.i1')::uuid and deleted_at is null), array[1, 2, 3],
  'the typed lines are numbered in the order they were typed');
select test.eq((select jsonb_agg(jsonb_build_object('ref', ref, 'counted', counted, 'revenue', revenue, 'cost', cost) order by ref)
                from finance.money_row where ref in ('MN-81', 'MN-82', 'MN-83', 'TX-84')),
  '[{"ref": "MN-81", "counted": true, "revenue": 900.00, "cost": 0},
    {"ref": "MN-82", "counted": false, "revenue": 400.00, "cost": 0},
    {"ref": "MN-83", "counted": true, "revenue": 150.00, "cost": 0},
    {"ref": "TX-84", "counted": true, "revenue": 700.00, "cost": 430.00}]'::jsonb,
  'typed invoices count like imported ones (the published one not), and the edited expense moves the cost');
select test.eq((select partner_id from finance.money_row where ref = 'MN-83'), null::uuid,
  'the walk-in customer is matched to no organisation, never guessed');
select test.eq((select count(*)::int from finance.invoice_line where invoice_id = current_setting('t.tx')::uuid and deleted_at is null),
  1, 'the removed line is gone from the imported invoice');

-- Undo each, newest first
select test.as_person(current_setting('t.head')::uuid);
select api.undo((current_setting('t.r8')::jsonb ->> 'request_id')::uuid);
select api.undo((current_setting('t.r7')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select jsonb_build_object('lines', (select count(*) from finance.invoice_line l
                                                     where l.invoice_id = i.id and l.deleted_at is null),
                                          'cost', (select cost from finance.money_row m where m.ref = i.ref))
                from finance.invoice i where i.ref = 'TX-84'),
  '{"lines": 2, "cost": 400.00}'::jsonb, 'Undo brings the removed line back and takes the expense''s edit back');
select test.as_person(current_setting('t.head')::uuid);
select api.undo((current_setting(r)::jsonb ->> 'request_id')::uuid)
from unnest(array['t.r6', 't.r5', 't.r4', 't.r3', 't.r2', 't.r1']) r;
select test.as_owner();
select test.eq((select count(*)::int from finance.invoice where ref like 'MN-8%' and deleted_at is null), 0,
  'Undo takes every typed invoice back');
select test.eq((select count(*)::int from finance.invoice_line l join finance.invoice i on i.id = l.invoice_id
                where i.ref like 'MN-8%' and l.deleted_at is null), 0, 'and every typed line');
select test.eq((select count(*)::int from finance.money_row where ref like 'MN-8%'), 0, 'and nothing of them is counted');
select test.eq((select src ->> 'amount_sar' = 'person' from finance.expense_line where id = current_setting('t.e')::uuid), false,
  'the expense is the import''s again, so the next file may change it');
select test.eq((select count(*) from finance.month_close)::text, current_setting('t.closed'), 'no month was closed on the way');
