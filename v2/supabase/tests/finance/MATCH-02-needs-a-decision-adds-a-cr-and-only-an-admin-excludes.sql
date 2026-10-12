-- MATCH-02 — two choices in Needs a decision (§3.5; V458). "This is client X" adds a tax number as a CR when the person
-- says so, and the customer's rows then match by it; "Exclude" is refused to a manager and taken by an admin, whose
-- rule takes the customer's rows out of the figures at once. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-manager-excludes-from-needs-a-decision.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.d', (core.riyadh_today() - 6)::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.x', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Registered Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-J1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 60,
                     'tax_no', '1010000012'),
  jsonb_build_object('ref', 'TX-J2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 40,
                     'client_id', '93001')),
  now() - interval '1 day');

select api.match_decide('tax_no:1010000012', 'partner', current_setting('t.x')::uuid, 'made up: their CR',
                        '{"tax_kind": "cr"}');
select test.as_owner();
select test.eq((select jsonb_build_object('kind', d.kind, 'held_by_x', d.partner_id = current_setting('t.x')::uuid)
                from partner.identifier d where d.value_key = '1010000012' and d.deleted_at is null),
  '{"kind": "cr", "held_by_x": true}'::jsonb, 'the tax number is added as a CR when the person says so');
select test.eq((select d.state from finance.invoice i cross join lateral finance.match_detail(i.id) d where i.ref = 'TX-J1'),
  'matched', 'and the row matches by it');

select test.as_person(current_setting('t.mgr')::uuid);
select test.raises($$select api.match_decide('client_id:93001', 'exclude', null, 'made up: a test account')$$,
  '42501', 'a manager cannot exclude from Needs a decision');
select test.as_person(current_setting('t.admin')::uuid);
select api.match_decide('client_id:93001', 'exclude', null, 'made up: a test account');
select test.as_owner();
select test.eq((select jsonb_build_object('counted', r.counted, 'by', r.excluded_by) from finance.money_row r where r.ref = 'TX-J2'),
  '{"counted": false, "by": "client_id"}'::jsonb, 'an admin''s exclusion takes the row out of the figures at once');
