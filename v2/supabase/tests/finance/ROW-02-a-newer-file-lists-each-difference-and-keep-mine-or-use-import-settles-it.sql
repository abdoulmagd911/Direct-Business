-- ROW-02 — the differences list (V622, the Finance screens brief I.2): where a newer Payments file differs from a field
-- a person set, the import leaves the person's value and lists the difference — invoice fields, a line's field and an
-- expense's field, each with both values and counted per invoice; the line's other fields follow the newer file. Keep
-- mine leaves the person's value; Use import writes the file's and gives the field back to the imports; each is one
-- request that Undo takes back. A value the person kept theirs against is not listed again; a newer value is. A member
-- cannot decide, and a decided difference is not decided twice. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-kept-difference-is-not-listed.sql, use-import-leaves-the-field-the-persons.sql,
-- keep-mine-is-asked-again.sql, a-line-edit-freezes-the-whole-line.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 20)::text, true);

-- the first export
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-61', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500,
                     'branch', 'Made Up North',
                     'lines', jsonb_build_array(
                       jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Hotel night', 'total_sar', 300),
                       jsonb_build_object('line_no', 2, 'product', 'Direct Visas', 'name', 'Visa', 'total_sar', 200)))),
  now() - interval '3 days');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-61', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 250,
                     'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '3 days');
select test.as_owner();
select set_config('t.i', (select id from finance.invoice where ref = 'TX-61')::text, true);
select set_config('t.l1', (select id from finance.invoice_line where invoice_id = current_setting('t.i')::uuid and line_no = 1)::text, true);
select set_config('t.e1', (select id from finance.expense_line where invoice_id = current_setting('t.i')::uuid)::text, true);
select set_config('t.vi', (select version from finance.invoice where id = current_setting('t.i')::uuid)::text, true);
select set_config('t.vl', (select version from finance.invoice_line where id = current_setting('t.l1')::uuid)::text, true);
select set_config('t.ve', (select version from finance.expense_line where id = current_setting('t.e1')::uuid)::text, true);

-- a person corrects the invoice, a line and the expense in the app
select test.as_person(current_setting('t.head')::uuid);
select api.finance_row_edit('invoice', current_setting('t.i')::uuid, '{"total_sar": 520, "branch": "Made Up Edited"}',
  current_setting('t.vi')::int, 'made up: corrected');
select api.finance_row_edit('invoice_line', current_setting('t.l1')::uuid, '{"name": "Hotel nights (2)"}',
  current_setting('t.vl')::int, 'made up: corrected');
select api.finance_row_edit('expense_line', current_setting('t.e1')::uuid, '{"amount_sar": 260}',
  current_setting('t.ve')::int, 'made up: corrected');

-- a newer export: the file's own values again, and line 1's total changed in Payments
select set_config('t.f_inv', jsonb_build_array(
  jsonb_build_object('ref', 'TX-61', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500,
                     'branch', 'Made Up North',
                     'lines', jsonb_build_array(
                       jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Hotel night', 'total_sar', 310),
                       jsonb_build_object('line_no', 2, 'product', 'Direct Visas', 'name', 'Visa', 'total_sar', 200))))::text, true);
select set_config('t.f_exp', jsonb_build_array(
  jsonb_build_object('ref', 'TX-61', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 250,
                     'created_at', '2026-01-01T10:00:00Z'))::text, true);
select api.finance_import('invoices', current_setting('t.f_inv')::jsonb, now() - interval '1 day');
select api.finance_import('expenses', current_setting('t.f_exp')::jsonb, now() - interval '1 day');

select test.eq((select jsonb_agg(jsonb_build_object('t', row_table, 'line', line_no, 'f', field, 'mine', mine, 'file', from_import)
                                 order by row_table, field)
                from api.finance_differences(current_setting('t.i')::uuid)),
  '[{"t": "expense_line", "line": null, "f": "amount_sar", "mine": "260.00", "file": "250.00"},
    {"t": "invoice", "line": null, "f": "branch", "mine": "Made Up Edited", "file": "Made Up North"},
    {"t": "invoice", "line": null, "f": "total_sar", "mine": "520.00", "file": "500.00"},
    {"t": "invoice_line", "line": 1, "f": "name", "mine": "Hotel nights (2)", "file": "Hotel night"}]'::jsonb,
  'each field the newer file differs on is listed with both values: the invoice''s, a line''s and an expense''s');
select test.eq((select differences from api.finance_difference_counts() where invoice_id = current_setting('t.i')::uuid), 4,
  'and counted for the chip');
select test.as_owner();
select test.eq((select jsonb_build_object('name', name, 'total', total_sar) from finance.invoice_line
                where id = current_setting('t.l1')::uuid),
  '{"name": "Hotel nights (2)", "total": 310.00}'::jsonb,
  'the line keeps the name the person set; its other fields follow the newer file');

-- a member cannot decide
select set_config('t.dbranch', (select id from finance.import_difference where field = 'branch')::text, true);
select test.as_person(current_setting('t.mem')::uuid);
select test.raises(format('select api.finance_difference_decide(%L, %L, 1)', current_setting('t.dbranch'), 'keep_mine'),
  '42501', 'a member cannot settle a difference');

-- Keep mine, then Undo
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r_keep', api.finance_difference_decide(
  (select id from api.finance_differences(current_setting('t.i')::uuid) where field = 'branch'), 'keep_mine',
  (select version from api.finance_differences(current_setting('t.i')::uuid) where field = 'branch')) ->> 'request_id', true);
select test.eq((select array_agg(field order by field) from api.finance_differences(current_setting('t.i')::uuid)),
  array['amount_sar', 'name', 'total_sar'], 'Keep mine settles the difference');
select test.as_owner();
select test.eq((select branch from finance.invoice where id = current_setting('t.i')::uuid), 'Made Up Edited',
  'and the person''s value stays');
select set_config('t.vbranch', (select version from finance.import_difference where field = 'branch')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.finance_difference_decide(%L, %L, %s)', current_setting('t.dbranch'), 'use_import',
                          current_setting('t.vbranch')),
  'P0001', 'a decided difference is not decided twice', 'finance.difference_decided');
select api.undo(current_setting('t.r_keep')::uuid);
select test.eq((select count(*)::int from api.finance_differences(current_setting('t.i')::uuid)), 4,
  'Undo lists it again');

-- Use import, then Undo
select set_config('t.r_use', api.finance_difference_decide(
  (select id from api.finance_differences(current_setting('t.i')::uuid) where field = 'total_sar'), 'use_import',
  (select version from api.finance_differences(current_setting('t.i')::uuid) where field = 'total_sar'),
  'made up: the file is right') ->> 'request_id', true);
select test.as_owner();
select test.eq((select jsonb_build_object('total', total_sar, 'person', src ->> 'total_sar' = 'person')
                from finance.invoice where id = current_setting('t.i')::uuid),
  '{"total": 500.00, "person": false}'::jsonb, 'Use import writes the file''s value and gives the field back to the imports');
select test.as_person(current_setting('t.head')::uuid);
select test.eq((select count(*)::int from api.finance_differences(current_setting('t.i')::uuid) where field = 'total_sar'), 0,
  'and the difference is settled');
select api.undo(current_setting('t.r_use')::uuid);
select test.as_owner();
select test.eq((select jsonb_build_object('total', total_sar, 'person', src ->> 'total_sar' = 'person')
                from finance.invoice where id = current_setting('t.i')::uuid),
  '{"total": 520.00, "person": true}'::jsonb, 'Undo puts the person''s value back');

-- Use import on the line, Keep mine on the expense
select test.as_person(current_setting('t.head')::uuid);
select api.finance_difference_decide(
  (select id from api.finance_differences(current_setting('t.i')::uuid) where field = 'name'), 'use_import',
  (select version from api.finance_differences(current_setting('t.i')::uuid) where field = 'name'), 'made up');
select api.finance_difference_decide(
  (select id from api.finance_differences(current_setting('t.i')::uuid) where field = 'amount_sar'), 'keep_mine',
  (select version from api.finance_differences(current_setting('t.i')::uuid) where field = 'amount_sar'));
select test.as_owner();
select test.eq((select name from finance.invoice_line where id = current_setting('t.l1')::uuid), 'Hotel night',
  'a line''s field takes the file''s value');
select test.eq((select amount_sar from finance.expense_line where id = current_setting('t.e1')::uuid), 260.00,
  'an expense keeps the person''s amount');

-- the same file again: a value the person kept theirs against is not asked again; a newer value is
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('expenses', current_setting('t.f_exp')::jsonb, now() - interval '12 hours');
select test.eq((select array_agg(field order by field) from api.finance_differences(current_setting('t.i')::uuid)),
  array['branch', 'total_sar'], 'the kept amount is not listed again for the same value');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-61', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 255,
                     'created_at', '2026-01-01T10:00:00Z')), now());
select test.eq((select from_import from api.finance_differences(current_setting('t.i')::uuid) where field = 'amount_sar'), '255.00',
  'a newer, different value is listed again');
