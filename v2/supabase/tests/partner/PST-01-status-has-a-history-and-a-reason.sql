-- PST-01 — status with history (V62, V134): Prospect · Active · At risk · Lost, each change with its effective date;
-- at risk and lost need a reason from their own list; the status on a day is the latest change on or before it; a
-- change is never rewritten; the account manager and partners.assign set it, nobody else.
-- Sabotage: supabase/tests/sabotage/anyone-sets-a-status.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.pid', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Status',
  'account_manager_id', current_setting('t.am1'))) ->> 'id', true);
select test.as_owner();
select set_config('t.price', (select id::text from partner.status_reason where key = 'price'), true);
select set_config('t.lost_price', (select id::text from partner.status_reason where key = 'lost_price'), true);

select test.as_person(current_setting('t.am1')::uuid);
select test.eq(api.partner_status_set(current_setting('t.pid')::uuid, 'active', core.riyadh_today() - 30) ->> 'status', 'active',
  'the account manager sets the status');
select test.raises(format('select api.partner_status_set(%L, %L)', current_setting('t.pid'), 'at_risk'), 'P0001',
  'at risk needs a reason', 'partner.status_reason_required');
select test.raises(format('select api.partner_status_set(%L, %L, null, %L)', current_setting('t.pid'), 'at_risk',
  current_setting('t.lost_price')), 'P0001', 'a reason from the list of that status', 'partner.reason_not_for_status');
select api.partner_status_set(current_setting('t.pid')::uuid, 'at_risk', core.riyadh_today() - 5, current_setting('t.price')::uuid,
  'made up: price talks');
select api.partner_status_set(current_setting('t.pid')::uuid, 'active', core.riyadh_today() + 10, null, 'made up: renewal agreed');
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.pid')::uuid), 'at_risk', 'the status today is the latest on or before today');
select test.eq(partner.status_of(current_setting('t.pid')::uuid, core.riyadh_today() - 10), 'active', 'and on an earlier day, the one then');
select test.eq(partner.status_of(current_setting('t.pid')::uuid, core.riyadh_today() + 10), 'active', 'a dated change waits for its day');
select test.raises(format('update partner.status_change set status = %L where partner_id = %L', 'lost', current_setting('t.pid')),
  'P0001', 'a status change is never rewritten', 'partner.status_never_rewritten');

select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.partner_status_set(%L, %L)', current_setting('t.pid'), 'active'), '42501',
  'a member who does not own the partner cannot set its status', 'access.needs_capability');
select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.partner_status_set(current_setting('t.pid')::uuid, 'lost', null,
  current_setting('t.lost_price')::uuid, 'made up') ->> 'status', 'lost', 'partners.assign sets it too');
select test.eq(jsonb_array_length(api.partner(current_setting('t.pid')::uuid) -> 'status_history'), 4,
  'the card shows the whole history');
