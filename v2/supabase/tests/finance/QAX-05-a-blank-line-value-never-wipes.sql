-- QA 2 repro: D21 — a newer file whose line has a blank name/qty/price never wipes the stored values.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (date_trunc('month', core.riyadh_today()::timestamp) - interval '1 month' + interval '3 days')::date::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-51Q', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 200,
    'lines', jsonb_build_array(jsonb_build_object('line_no', 1, 'name', 'Made up hotel', 'qty', 2, 'unit_price', 100,
                                                  'total_sar', 200)))), now() - interval '3 days');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-51Q', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 200,
    'lines', jsonb_build_array(jsonb_build_object('line_no', 1, 'total_sar', 200)))), now() - interval '1 day');
select test.as_owner();
select test.eq((select name || ' x' || qty::text || ' @' || coalesce(unit_price::text, 'null') from finance.invoice_line l
                join finance.invoice i on i.id = l.invoice_id where i.ref = 'TX-51Q' and l.deleted_at is null),
  'Made up hotel x2.000 @100.00', 'the stored line keeps its name, qty and price');
