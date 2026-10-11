-- FCL-03 — a closed month shows its snapshot (QA-536, the Architect's ruling; V620, V610 (4)). After the close, a
-- unit of that month paid late and an edit to a counted unit's total change none of the month's figures: the period's
-- revenue, income by service and the organisation's month read the snapshot, and each later change is listed beside
-- the month as a late change with its riyals. An open month stays live. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-closed-month-shows-live-figures.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.m', (pg_catalog.date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);
select set_config('t.e', ((current_setting('t.m')::date + interval '1 month')::date - 1)::text, true);
select set_config('t.d', (current_setting('t.m')::date + 4)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-S1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000),
  jsonb_build_object('ref', 'TX-S2', 'status', 'Published', 'created_on', current_setting('t.d'), 'total_sar', 300)),
  now() - interval '2 days');
select api.finance_month_close(current_setting('t.m')::date, 'made up: closed');

-- after the close: TX-S2 is paid, TX-S1's total is edited
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-S2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 300)), now() - interval '1 day');
select test.as_owner();
select set_config('t.i', (select id::text from finance.invoice where ref = 'TX-S1'), true);
select set_config('t.v', (select version::text from finance.invoice where ref = 'TX-S1'), true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_row_edit('invoice', current_setting('t.i')::uuid, '{"total_sar": 1200}', current_setting('t.v')::int,
                            'made up: corrected after the close');

select test.eq((api.finance_period(current_setting('t.m')::date, current_setting('t.e')::date) ->> 'revenue')::numeric,
  1000::numeric, 'the closed month''s revenue is its snapshot''s');
select test.eq((select sum((x ->> 'revenue')::numeric) from jsonb_array_elements(
                  api.finance_income_by_service(current_setting('t.m')::date, current_setting('t.e')::date) -> 'rows') x),
  1000::numeric, 'income by service adds up to the same snapshot');
select test.eq((select jsonb_agg(l ->> 'change' order by l ->> 'change')
                from jsonb_array_elements(api.finance_closed_months()) m, jsonb_array_elements(m -> 'late_changes') l
                where (m ->> 'month')::date = current_setting('t.m')::date),
  '["late_paid", "revenue_changed"]'::jsonb, 'each later change is listed beside the month');

-- an open month stays live
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-S3', 'status', 'Fully Paid', 'created_on', core.riyadh_today()::text, 'total_sar', 50)),
  now() - interval '1 hour');
select test.eq((api.finance_period(date_trunc('month', core.riyadh_today())::date, core.riyadh_today()) ->> 'revenue')::numeric,
  50::numeric, 'an open month stays live');
