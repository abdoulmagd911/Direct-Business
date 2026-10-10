-- FMS-01 — the Finance measures (§3.8 "Measures in v1"): finance.revenue sums the counted units created in the period
-- — the company's, an organisation's, or what a person is credited with; finance.margin sums their profit and counts
-- the units whose cost is final, each item saying so; finance.new_client_revenue takes only organisations whose first
-- counted unit falls in the period, unless a typed client-since date is earlier. A sum of nothing is a real 0, measured.
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/new-client-revenue-counts-an-old-client.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager One', 'member')::text, true);
select set_config('t.from', (core.riyadh_today() - 45)::text, true);
select set_config('t.to', (core.riyadh_today() - 35)::text, true);
select set_config('t.d', (core.riyadh_today() - 40)::text, true);
select set_config('t.old', (core.riyadh_today() - 70)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.pa', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up New Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1')))))
  ->> 'id', true);
select set_config('t.pb', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Returning Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1')))))
  ->> 'id', true);
select set_config('t.pc', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Long Standing Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1')))))
  ->> 'id', true);
select api.identifier_add(current_setting('t.pa')::uuid, 'payments_client_id', '81001', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.pb')::uuid, 'payments_client_id', '81002', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.pc')::uuid, 'payments_client_id', '81003', 'made up', 'postpaid');
select test.as_owner();
update partner.side_owner set effective_from = core.riyadh_today() - 90 where person_id = current_setting('t.am1')::uuid;
update partner.partner set client_since = '2020-01-01' where id = current_setting('t.pc')::uuid;

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-41', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 400, 'client_id', '81001'),
  jsonb_build_object('ref', 'TX-42', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 200, 'client_id', '81002'),
  jsonb_build_object('ref', 'TX-43', 'status', 'Fully Paid', 'created_on', current_setting('t.old'), 'total_sar', 50, 'client_id', '81002'),
  jsonb_build_object('ref', 'TX-44', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 70, 'client_id', '81003'),
  jsonb_build_object('ref', 'TX-45', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 30,
                     'customer_name', 'Made Up Traveller'),
  jsonb_build_object('ref', 'TX-46', 'status', 'Pending Payment', 'created_on', current_setting('t.d'), 'total_sar', 999,
                     'client_id', '81001')), now() - interval '1 day');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-41', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 100,
                     'created_at', '2026-01-01T10:00:00Z')), now() - interval '1 day');

select test.as_owner();
select test.eq(measure.finance_revenue(null, 'company', null, current_setting('t.from')::date, current_setting('t.to')::date),
  (700, true, 4)::measure.result, 'the company''s revenue: every counted unit created in the period, an unpaid one left out');
select test.eq(measure.finance_revenue(null, 'partner', current_setting('t.pa')::uuid, current_setting('t.from')::date,
                                       current_setting('t.to')::date),
  (400, true, 1)::measure.result, 'an organisation''s revenue');
select test.eq(measure.finance_revenue(null, 'person', current_setting('t.am1')::uuid, current_setting('t.from')::date,
                                       current_setting('t.to')::date),
  (670, true, 3)::measure.result, 'a person''s: what they are credited with');
select test.eq((select array_agg(i.entity_id order by i.entity_id) from measure.finance_revenue_items(null, 'person',
                  current_setting('t.am1')::uuid, current_setting('t.from')::date, current_setting('t.to')::date) i),
  (select array_agg(id order by id) from finance.invoice where ref in ('TX-41', 'TX-42', 'TX-44')),
  'and the drill-down lists those units');
select test.eq(measure.finance_margin(null, 'company', null, current_setting('t.from')::date, current_setting('t.to')::date),
  (600, true, 1)::measure.result, 'the margin is the profit; n counts the units whose cost is final');
select test.eq((select count(*)::int from measure.finance_margin_items(null, 'company', null, current_setting('t.from')::date,
                  current_setting('t.to')::date) i where i.counted), 1,
  'and each item says whether its cost is final');
select test.eq(measure.finance_new_client_revenue(null, 'company', null, current_setting('t.from')::date,
                                                  current_setting('t.to')::date),
  (400, true, 1)::measure.result,
  'new client revenue: only an organisation whose first unit falls in the period and has no earlier client-since date');
select test.eq(measure.finance_revenue(null, 'company', null, '2020-01-01', '2020-01-31'), (0, true, 0)::measure.result,
  'a sum of nothing is a real 0, measured');
select test.raises($$select measure.finance_revenue(null, 'planet', null, '2026-01-01', '2026-01-31')$$, 'P0001',
  'an unknown scope is refused', 'measure.unknown_scope');
