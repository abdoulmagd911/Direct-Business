-- FCL-04 — a closed month keeps whose units they were (QA-541; V620). After the close, one of the organisation's
-- invoices is removed and another is matched to a second organisation: the closed month stays the first organisation's
-- in full — both units, their revenue — and the second organisation gains nothing in it. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-closed-month-reads-whose-live.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.m', (pg_catalog.date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);
select set_config('t.d', (current_setting('t.m')::date + 4)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.a', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up First Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.b', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Second Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.a')::uuid, 'payments_client_id', '89001', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.b')::uuid, 'payments_client_id', '89002', 'made up', 'postpaid');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-W1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 400,
                     'client_id', '89001'),
  jsonb_build_object('ref', 'TX-W2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100,
                     'client_id', '89001')),
  now() - interval '2 days');
select api.finance_month_close(current_setting('t.m')::date, 'made up: closed');

-- after the close: TX-W2 removed, TX-W1 now carries the second organisation's client ID
select test.as_owner();
select set_config('t.w1', (select id::text from finance.invoice where ref = 'TX-W1'), true);
select set_config('t.w2', (select id::text from finance.invoice where ref = 'TX-W2'), true);
select set_config('t.v1', (select version::text from finance.invoice where ref = 'TX-W1'), true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_rows_remove('invoice', array[current_setting('t.w2')::uuid], 'made up: cancelled after the close');
select api.finance_row_edit('invoice', current_setting('t.w1')::uuid, '{"client_id": "89002"}',
                            current_setting('t.v1')::int, 'made up: the other company''s ID');

select test.eq((select jsonb_build_object('units', m -> 'units', 'revenue', m -> 'revenue')
                from jsonb_array_elements(api.finance_partner_months(current_setting('t.a')::uuid)) m
                where (m ->> 'month_on')::date = current_setting('t.m')::date),
  '{"units": 2, "revenue": 500}'::jsonb, 'the closed month stays the first organisation''s in full');
select test.eq((select count(*)::int from jsonb_array_elements(api.finance_partner_months(current_setting('t.b')::uuid)) m
                where (m ->> 'month_on')::date = current_setting('t.m')::date),
  0, 'the second organisation gains nothing in the closed month');
