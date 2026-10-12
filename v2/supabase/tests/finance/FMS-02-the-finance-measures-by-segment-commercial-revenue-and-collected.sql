-- FMS-02 — the Finance measures by segment, finance.commercial_revenue and finance.collected (§3.8; V4, V98, V501).
-- Each measure takes a segment (a Client type) and counts only that type's organisations. Commercial revenue follows
-- finance.revenue_definition as of each unit's month: by default every unit, a commission invoice included (V501); with
-- commissions off the commission leaves; named services keep only those lines; named client types keep only those
-- organisations; the margin basis sums profit. Collected sums the receipts by the day paid, by scope and segment.
-- Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-segment-is-ignored.sql, supabase/tests/sabotage/a-commission-counts-whatever-the-definition.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 40)::text, true);
select set_config('t.from', (core.riyadh_today() - 45)::text, true);
select set_config('t.to', (core.riyadh_today() - 35)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.corp', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Corporate Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select set_config('t.gov', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Authority',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select api.identifier_add(current_setting('t.corp')::uuid, 'payments_client_id', '82001', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.gov')::uuid, 'payments_client_id', '82002', 'made up', 'postpaid');
select test.as_owner();
update partner.side_owner set effective_from = core.riyadh_today() - 90 where person_id = current_setting('t.am')::uuid;

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-51', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000,
                     'client_id', '82001', 'lines', jsonb_build_array(
                       jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Hotel nights', 'total_sar', 600),
                       jsonb_build_object('line_no', 2, 'product', 'Direct Flights', 'name', 'Tickets', 'total_sar', 400))),
  jsonb_build_object('ref', 'TX-52', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500,
                     'client_id', '82002', 'lines', jsonb_build_array(
                       jsonb_build_object('line_no', 1, 'product', 'Direct Flights', 'name', 'Tickets', 'total_sar', 500))),
  jsonb_build_object('ref', 'TX-53', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 200,
                     'client_id', '82001', 'lines', jsonb_build_array(
                       jsonb_build_object('line_no', 1, 'name', 'Booking commission', 'total_sar', 200)))),
  now() - interval '2 days');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-51', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 300,
                     'created_at', current_setting('t.d') || 'T10:00')), now() - interval '2 days');
select api.finance_import('receipts', jsonb_build_array(
  jsonb_build_object('ref', 'TX-51', 'method', 'Bank', 'amount_sar', 300, 'paid_on', current_setting('t.d'),
                     'ref_at_method', 'MADE-UP-R1'),
  jsonb_build_object('ref', 'TX-52', 'method', 'Bank', 'amount_sar', 200, 'paid_on', current_setting('t.d'),
                     'ref_at_method', 'MADE-UP-R2')), now() - interval '1 day');

select test.as_owner();
-- by segment
select test.eq(measure.finance_revenue('{"segment": "corporate"}', 'company', null, current_setting('t.from')::date,
                                       current_setting('t.to')::date),
  (1200, true, 2)::measure.result, 'the revenue of corporate clients only');
select test.eq(measure.finance_revenue('{"segment": "government"}', 'person', current_setting('t.am')::uuid,
                                       current_setting('t.from')::date, current_setting('t.to')::date),
  (500, true, 1)::measure.result, 'a person''s revenue from government clients only');
select test.eq(measure.finance_revenue(null, 'company', null, current_setting('t.from')::date, current_setting('t.to')::date),
  (1700, true, 3)::measure.result, 'no segment: every unit');

-- commercial revenue under its definition
select test.eq(measure.finance_commercial_revenue(null, 'company', null, current_setting('t.from')::date,
                                                  current_setting('t.to')::date),
  (1700, true, 3)::measure.result, 'by default commercial revenue is the revenue, the commission included (V501)');
insert into core.setting (key, department_id, value, valid_from, reason)
values ('finance.revenue_definition', null,
        '{"basis": "revenue", "services": [], "client_types": [], "commissions": false}',
        date_trunc('month', current_setting('t.d')::date)::date - 4, 'made up: commissions out');
select test.eq(measure.finance_commercial_revenue(null, 'company', null, current_setting('t.from')::date,
                                                  current_setting('t.to')::date),
  (1500, true, 2)::measure.result, 'with commissions off, the commission invoice leaves');
-- a setting row never changes; a later one takes over from its day
insert into core.setting (key, department_id, value, valid_from, reason)
values ('finance.revenue_definition', null,
        '{"basis": "revenue", "services": ["hotels"], "client_types": [], "commissions": true}',
        date_trunc('month', current_setting('t.d')::date)::date - 3, 'made up: hotels only');
select test.eq((measure.finance_commercial_revenue(null, 'company', null, current_setting('t.from')::date,
                                                   current_setting('t.to')::date)).value,
  600::numeric, 'with one service named, only its lines count');
insert into core.setting (key, department_id, value, valid_from, reason)
values ('finance.revenue_definition', null,
        '{"basis": "revenue", "services": [], "client_types": ["government"], "commissions": true}',
        date_trunc('month', current_setting('t.d')::date)::date - 2, 'made up: government only');
select test.eq((measure.finance_commercial_revenue(null, 'company', null, current_setting('t.from')::date,
                                                   current_setting('t.to')::date)).value,
  500::numeric, 'with one client type named, only those organisations count');
insert into core.setting (key, department_id, value, valid_from, reason)
values ('finance.revenue_definition', null,
        '{"basis": "margin", "services": [], "client_types": [], "commissions": true}',
        date_trunc('month', current_setting('t.d')::date)::date - 1, 'made up: the margin');
select test.eq((measure.finance_commercial_revenue(null, 'company', null, current_setting('t.from')::date,
                                                   current_setting('t.to')::date)).value,
  1400::numeric, 'on the margin basis, the profit counts');

-- collected
select test.eq(measure.finance_collected(null, 'company', null, current_setting('t.from')::date,
                                         current_setting('t.to')::date),
  (500, true, 2)::measure.result, 'collected: the receipts paid in the period');
select test.eq(measure.finance_collected('{"segment": "government"}', 'person', current_setting('t.am')::uuid,
                                         current_setting('t.from')::date, current_setting('t.to')::date),
  (200, true, 1)::measure.result, 'a person''s collections from government clients');
