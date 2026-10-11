-- FCL-02 — a revenue change after the close is a late change (QA-533; V620, V500). A unit of a closed month whose total
-- a person edits (V622) is listed against that month as revenue_changed, with its riyals and the day of the edit; the
-- frozen figures do not move. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-revenue-change-after-the-close-is-silent.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.m', (pg_catalog.date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-Q2', 'status', 'Fully Paid', 'created_on', (current_setting('t.m')::date + 4)::text,
                     'total_sar', 1000)), now() - interval '1 day');
select api.finance_month_close(current_setting('t.m')::date, 'made up: closed');
select test.as_owner();
select set_config('t.i', (select id::text from finance.invoice where ref = 'TX-Q2'), true);
select set_config('t.v', (select version::text from finance.invoice where ref = 'TX-Q2'), true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_row_edit('invoice', current_setting('t.i')::uuid, '{"total_sar": 1200}', current_setting('t.v')::int,
                            'made up: the slip says 1,200');
select test.eq((select jsonb_agg(jsonb_build_object('ref', l ->> 'ref', 'change', l ->> 'change',
                                                    'revenue', (l ->> 'revenue_change')::numeric,
                                                    'today', (l ->> 'changed_on')::date = core.riyadh_today()))
                from jsonb_array_elements(api.finance_closed_months()) m, jsonb_array_elements(m -> 'late_changes') l
                where (m ->> 'month')::date = current_setting('t.m')::date),
  '[{"ref": "TX-Q2", "change": "revenue_changed", "revenue": 200, "today": true}]'::jsonb,
  'an edit to a closed month''s total is listed as a late revenue change, with its riyals and day');
select test.eq((select (m -> 'frozen' ->> 'revenue')::numeric from jsonb_array_elements(api.finance_closed_months()) m
                where (m ->> 'month')::date = current_setting('t.m')::date), 1000::numeric, 'the frozen figures do not move');
