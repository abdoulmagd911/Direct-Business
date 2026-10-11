-- QA 2 repro (local only, never committed): V620 — a closed month is never reopened. Undo of the close must not open it.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.m', (date_trunc('month', core.riyadh_today()::timestamp) - interval '1 month')::date::text, true);
select set_config('t.d', (current_setting('t.m')::date + 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-Q1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 700)),
  now() - interval '3 days');
select api.finance_month_close(current_setting('t.m')::date, 'made up');
select test.as_owner();
select set_config('t.rq', (select id from audit.request where label_key = 'finance.month_closed' order by at desc limit 1)::text, true);
select test.as_person(current_setting('t.head')::uuid);
do $$ begin perform api.undo(current_setting('t.rq')::uuid); exception when others then null; end $$;
select test.as_owner();
select test.eq((select count(*)::int from finance.month_close where month = current_setting('t.m')::date and deleted_at is null), 1,
  'after Undo of the close the month is still closed (V620: never reopened)');
