-- PROS-01 — light prospecting (V63, V136, V98): a side's assign capability gives many organisations that side's owner
-- and a priority in one action — one request, one Undo; a side with no status becomes a Prospect; the old owner's time
-- ends the day the new one starts; an organisation without that side on is refused, and nothing changes; a member
-- without clients.assign cannot.
-- Sabotage: supabase/tests/sabotage/bulk-assign-leaves-no-prospect.sql.
select set_config('t.manager', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select set_config('t.high', (select id::text from work.priority where key = 'high'), true);

select test.as_person(current_setting('t.manager')::uuid);
select set_config('t.p1', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up One',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am2'))))) ->> 'id', true);
select set_config('t.p2', api.partner_create('{"trade_name_en": "Made Up Two", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.p3', api.partner_create('{"trade_name_en": "Made Up Three", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select api.partner_status_set(current_setting('t.p3')::uuid, 'client', 'active');
select set_config('t.p4', api.partner_create('{"trade_name_en": "Made Up Four", "sides": [{"side": "supplier_partner", "type": "supplier"}]}') ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.partner_bulk_assign(%L, %L, %L, %L)', array[current_setting('t.p1')], 'client',
  current_setting('t.am1'), current_setting('t.high')), '42501', 'a member without clients.assign cannot assign',
  'access.needs_capability');

select test.as_person(current_setting('t.manager')::uuid);
select test.raises(format('select api.partner_bulk_assign(%L, %L, %L, %L)', array[current_setting('t.p1'),
  current_setting('t.p4')], 'client', current_setting('t.am1'), current_setting('t.high')), 'P0001',
  'an organisation without the Client side on is refused', 'partner.side_not_on');
select test.as_owner();
select test.eq((select count(*)::int from partner.partner where priority_id is not null), 0, 'and nothing changes');
select test.as_person(current_setting('t.manager')::uuid);
select set_config('t.r', api.partner_bulk_assign(array[current_setting('t.p1'), current_setting('t.p2'),
  current_setting('t.p3')]::uuid[], 'client', current_setting('t.am1')::uuid, current_setting('t.high')::uuid,
  'made up: new territory') ->> 'request_id', true);
select test.as_owner();
select test.eq((select count(*)::int from partner.partner where priority_id = current_setting('t.high')::uuid), 3,
  'three organisations get the priority');
select test.eq((select count(*)::int from partner.partner p where current_setting('t.am1')::uuid in (select partner.owners(p.id))),
  3, 'and the owner');
select test.eq(partner.status_of(current_setting('t.p2')::uuid, 'client'), 'prospect', 'a side with no status becomes a Prospect');
select test.eq(partner.status_of(current_setting('t.p3')::uuid, 'client'), 'active', 'one with a status keeps it');
select test.eq((select count(*)::int from partner.side_owner where partner_id = current_setting('t.p1')::uuid
                and person_id = current_setting('t.am2')::uuid and deleted_at is null), 0,
  'the old owner''s row, from today, is replaced by the new one');
select test.eq((select count(*)::int from audit.request where id = current_setting('t.r')::uuid), 1, 'all in one request');

select test.as_person(current_setting('t.manager')::uuid);
select api.undo(current_setting('t.r')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from partner.partner where priority_id is not null), 0, 'one Undo reverts the priorities');
select test.eq(partner.status_of(current_setting('t.p2')::uuid, 'client'), null::text, 'the statuses');
select test.eq((select array_agg(x) from partner.owners(current_setting('t.p1')::uuid) x),
  array[current_setting('t.am2')::uuid], 'and the owners');
