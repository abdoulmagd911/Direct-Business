-- FCL-05 — a closed month keeps its segment (QA-546; V620, as QA-541). After the close, the organisation's Client type
-- changes from corporate to government: the closed month's unit stays corporate — on its money row, in the revenue by
-- segment and in commercial revenue limited to corporate clients — while the open month's unit moves with the type.
-- Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-closed-month-reads-the-segment-live.sql,
-- a-closed-month-commercial-part-reads-the-segment-live.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.m', (pg_catalog.date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);
select set_config('t.d', (current_setting('t.m')::date + 4)::text, true);
select set_config('t.now', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Changing Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '88001', 'made up', 'postpaid');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-Y1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 400,
                     'client_id', '88001'),
  jsonb_build_object('ref', 'TX-Y2', 'status', 'Fully Paid', 'created_on', current_setting('t.now'), 'total_sar', 100,
                     'client_id', '88001')),
  now() - interval '2 days');
select api.finance_month_close(current_setting('t.m')::date, 'made up: closed');

-- after the close the organisation becomes a government client
select api.partner_side_set(current_setting('t.p')::uuid, 'client', '{"type": "government"}', 'made up: reclassified');

select test.as_owner();
select test.eq((select jsonb_object_agg(r.ref, r.segment) from finance.money_row r where r.ref in ('TX-Y1', 'TX-Y2')),
  '{"TX-Y1": "corporate", "TX-Y2": "government"}'::jsonb,
  'the closed month''s unit keeps the segment it was closed with; the open month''s moves with the type');
do $$ begin
  perform test.eq((measure.finance_revenue('{"segment": "corporate"}', 'company', null,
                                           current_setting('t.m')::date, current_setting('t.now')::date)).value,
    400::numeric, 'the revenue of corporate clients keeps the closed month''s unit');
exception when others then
  perform test.eq(sqlerrm, '', 'the revenue of corporate clients keeps the closed month''s unit');
end $$;
do $$ begin
  perform test.eq((measure.finance_revenue('{"segment": "government"}', 'company', null,
                                           current_setting('t.m')::date, current_setting('t.now')::date)).value,
    100::numeric, 'the revenue of government clients holds only the open month''s unit');
exception when others then
  perform test.eq(sqlerrm, '', 'the revenue of government clients holds only the open month''s unit');
end $$;

-- commercial revenue limited to corporate clients counts the closed month's unit by its kept segment
insert into core.setting (key, department_id, value, valid_from, reason)
values ('finance.revenue_definition', null,
        '{"basis": "revenue", "services": [], "client_types": ["corporate"], "commissions": true}',
        current_setting('t.m')::date - 3, 'made up: corporate clients only');
do $$ begin
  perform test.eq((measure.finance_commercial_revenue(null, 'company', null,
                                                      current_setting('t.m')::date, current_setting('t.now')::date)).value,
    400::numeric, 'commercial revenue for corporate clients keeps the closed month''s unit and drops the open one');
exception when others then
  perform test.eq(sqlerrm, '', 'commercial revenue for corporate clients keeps the closed month''s unit and drops the open one');
end $$;
