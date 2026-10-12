-- ROW-01 — every imported row can be edited, added to and removed in the app (V622 (3)): by a person with Full on
-- Finance, each change one request that Undo takes back. A field a person edited stays theirs — a newer import leaves it
-- and lists the difference for them; a line or an expense a person removed is never brought back; a line added by hand
-- stays when a newer file does not have it; an invoice added by hand is never touched. A member cannot. Every value is
-- made up. Sabotages: supabase/tests/sabotage/an-import-overwrites-a-persons-edit.sql,
-- an-import-brings-back-a-removed-expense.sql, an-import-drops-a-line-added-by-hand.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 20)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-51', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500,
                     'lines', jsonb_build_array(
                       jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Hotel night', 'total_sar', 300),
                       jsonb_build_object('line_no', 2, 'product', 'Direct Visas', 'name', 'Visa', 'total_sar', 200)))),
  now() - interval '3 days');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-51', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 250, 'created_at', '2026-01-01T10:00:00Z'),
  jsonb_build_object('ref', 'TX-51', 'expense_type', 'Visa', 'status', 'Approved', 'amount_sar', 90, 'created_at', '2026-01-01T11:00:00Z')),
  now() - interval '3 days');
select test.as_owner();
select set_config('t.i', (select id from finance.invoice where ref = 'TX-51')::text, true);
select set_config('t.v', (select version from finance.invoice where ref = 'TX-51')::text, true);
select set_config('t.l2', (select id from finance.invoice_line where invoice_id = current_setting('t.i')::uuid and line_no = 2)::text, true);
select set_config('t.e2', (select id from finance.expense_line where expense_type = 'Visa')::text, true);

-- a member cannot
select test.as_person(current_setting('t.mem')::uuid);
select test.raises(format('select api.finance_row_edit(%L, %L, %L, %s)', 'invoice', current_setting('t.i'),
                          '{"total_sar": 1}', current_setting('t.v')), '42501', 'a member cannot edit an imported row');

-- each change is one request that Undo takes back
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r_tmp', api.finance_row_edit('invoice', current_setting('t.i')::uuid, '{"branch": "Made Up Branch"}',
  current_setting('t.v')::int, 'made up') ->> 'request_id', true);
select set_config('t.r_tmp2', api.finance_row_add('invoice_line', jsonb_build_object('invoice_id', current_setting('t.i'),
  'name', 'Made-up extra', 'total_sar', 5), 'made up') ->> 'request_id', true);
select api.undo(current_setting('t.r_tmp2')::uuid);
select api.undo(current_setting('t.r_tmp')::uuid);
select test.as_owner();
select test.eq((select branch from finance.invoice where ref = 'TX-51'), null::text, 'Undo takes an edit back');
select test.eq((select count(*)::int from finance.invoice_line where name = 'Made-up extra' and deleted_at is null), 0,
  'and a line added by hand');
select set_config('t.v', (select version from finance.invoice where ref = 'TX-51')::text, true);

-- edit, add, remove
select test.as_person(current_setting('t.head')::uuid);
select api.finance_row_edit('invoice', current_setting('t.i')::uuid,
  '{"total_sar": 520, "status": "Fully Paid (Audit Required)"}', current_setting('t.v')::int, 'made up: corrected');
select test.raises(format('select api.finance_row_edit(%L, %L, %L, %s)', 'invoice', current_setting('t.i'),
                          '{"status": "Paid out"}', current_setting('t.v')::int + 1), 'P0001',
  'an unknown status word is refused, never guessed', 'finance.status_unknown');
select api.finance_row_add('invoice_line', jsonb_build_object('invoice_id', current_setting('t.i'),
  'name', 'Made-up transfer', 'product', 'Direct Transport', 'total_sar', 20), 'made up: missing line');
select api.finance_rows_remove('invoice_line', array[current_setting('t.l2')::uuid], 'made up: duplicated line');
select api.finance_rows_remove('expense_line', array[current_setting('t.e2')::uuid], 'made up: wrong expense');
select api.finance_row_add('invoice', jsonb_build_object('ref', 'MN-52', 'kind', 'standalone', 'status', 'Fully Paid',
  'created_on', current_setting('t.d'), 'total_sar', 75), 'made up: off-system booking');

-- a newer export of the same rows
select set_config('t.r', api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-51', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500,
                     'lines', jsonb_build_array(
                       jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Hotel night', 'total_sar', 300),
                       jsonb_build_object('line_no', 2, 'product', 'Direct Visas', 'name', 'Visa', 'total_sar', 200))),
  jsonb_build_object('ref', 'MN-52', 'status', 'Draft', 'created_on', current_setting('t.d'), 'total_sar', 1)), now())::text, true);
select set_config('t.x', api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-51', 'expense_type', 'Visa', 'status', 'Approved', 'amount_sar', 90, 'created_at', '2026-01-01T11:00:00Z')),
  now())::text, true);
select test.eq((select jsonb_agg(jsonb_build_object(h ->> 'reason', h ->> 'detail') order by h ->> 'reason', h ->> 'detail')
                from jsonb_array_elements(current_setting('t.r')::jsonb -> 'held') h),
  '[{"manual_row": "typed by a person; the import never changes it"}, {"person_edited": "status_id, status_raw, total_sar"},
    {"removed_row": "line 2"}]'::jsonb,
  'the newer file lists what it left alone: the edited fields, the removed line, the invoice added by hand');
select test.eq((select h ->> 'reason' from jsonb_array_elements(current_setting('t.x')::jsonb -> 'held') h), 'removed_row',
  'and the removed expense');

select test.as_owner();
select test.eq((select jsonb_build_object('total', total_sar, 'status', status_raw) from finance.invoice where ref = 'TX-51'),
  '{"total": 520.00, "status": "Fully Paid (Audit Required)"}'::jsonb, 'the edited fields stay the person''s');
select test.eq((select array_agg(name order by line_no) from finance.invoice_line
                where invoice_id = current_setting('t.i')::uuid and deleted_at is null),
  array['Hotel night', 'Made-up transfer'], 'the removed line stays removed; the line added by hand stays');
select test.eq((select count(*)::int from finance.expense_line where invoice_id = current_setting('t.i')::uuid and deleted_at is null),
  1, 'the removed expense is not brought back');
select test.eq((select jsonb_build_object('total', total_sar, 'source', source) from finance.invoice where ref = 'MN-52'),
  '{"total": 75.00, "source": "manual"}'::jsonb, 'the invoice added by hand is as typed');
