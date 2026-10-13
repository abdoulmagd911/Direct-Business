-- IMP-05 — a blank never wipes a line (QA-530; D21). A newer file that sends a line with only its total changes the
-- total and keeps the line's name, quantity and unit price; a new line still takes the defaults. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-blank-line-value-wipes-the-stored-one.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 10)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-L1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 200,
    'lines', jsonb_build_array(jsonb_build_object('line_no', 1, 'name', 'Made up hotel', 'qty', 2, 'unit_price', 100,
                                                  'total_sar', 200)))), now() - interval '2 days');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-L1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 180,
    'lines', jsonb_build_array(jsonb_build_object('line_no', 1, 'total_sar', 180),
                               jsonb_build_object('line_no', 2, 'total_sar', 0)))), now() - interval '1 day');
select test.as_owner();
select test.eq((select jsonb_agg(jsonb_build_object('no', x.line_no, 'name', x.name, 'qty', x.qty, 'price', x.unit_price,
                                                    'total', x.total_sar) order by x.line_no)
                from finance.invoice_line x join finance.invoice i on i.id = x.invoice_id
                where i.ref = 'TX-L1' and x.deleted_at is null),
  '[{"no": 1, "name": "Made up hotel", "qty": 2, "price": 100, "total": 180},
    {"no": 2, "name": "—", "qty": 1, "price": null, "total": 0}]'::jsonb,
  'a newer file with only a total keeps the line''s name, quantity and price; a new line takes the defaults');
