-- QA 2 repro: V620/V500 — a change to a closed month's counted revenue is listed, never folded in silently.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.m', (date_trunc('month', core.riyadh_today()::timestamp) - interval '1 month')::date::text, true);
select set_config('t.d', (current_setting('t.m')::date + 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-Q2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000)),
  now() - interval '3 days');
select api.finance_month_close(current_setting('t.m')::date, 'made up');
select test.as_owner();
select set_config('t.id', (select id from finance.invoice where ref = 'TX-Q2')::text, true);
select set_config('t.v', (select version from finance.invoice where ref = 'TX-Q2')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_row_edit('invoice', current_setting('t.id')::uuid, '{"total_sar": 1200}', current_setting('t.v')::int, 'made up: corrected');
select test.as_owner();
select test.eq((select total_sar from finance.invoice where ref = 'TX-Q2'), 1200.00::numeric, 'the edit took');
select test.ok(exists (select 1 from finance.late_change where month = current_setting('t.m')::date and ref = 'TX-Q2'),
  'the +200 on a closed month is listed as a late change');
