-- PST-01 — each side's status, with history (V62, V98): Prospect · Active · At risk · Lost, each change with its
-- effective date; at risk and lost need a reason from their own list; the status on a day is the latest change on or
-- before it; a change is never rewritten; a side's owner and that side's assign capability set it, nobody else; a side
-- that is not on has no status; an organisation with both sides on has two statuses.
-- Sabotage: supabase/tests/sabotage/anyone-sets-a-status.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Relationship Owner', 'member')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.pid', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Status',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select test.as_owner();
select set_config('t.price', (select id::text from partner.side_status_reason where key = 'price'), true);
select set_config('t.lost_price', (select id::text from partner.side_status_reason where key = 'lost_price'), true);

select test.as_person(current_setting('t.am1')::uuid);
select test.eq(api.partner_status_set(current_setting('t.pid')::uuid, 'client', 'active', core.riyadh_today() - 30)
  ->> 'status', 'active', 'the Client side''s owner sets its status');
select test.raises(format('select api.partner_status_set(%L, %L, %L)', current_setting('t.pid'), 'client', 'at_risk'), 'P0001',
  'at risk needs a reason', 'partner.status_reason_required');
select test.raises(format('select api.partner_status_set(%L, %L, %L, null, %L)', current_setting('t.pid'), 'client', 'at_risk',
  current_setting('t.lost_price')), 'P0001', 'a reason from the list of that status', 'partner.reason_not_for_status');
select api.partner_status_set(current_setting('t.pid')::uuid, 'client', 'at_risk', core.riyadh_today() - 5,
  current_setting('t.price')::uuid, 'made up: price talks');
select api.partner_status_set(current_setting('t.pid')::uuid, 'client', 'active', core.riyadh_today() + 10, null,
  'made up: renewal agreed');
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.pid')::uuid, 'client'), 'at_risk',
  'the status today is the latest on or before today');
select test.eq(partner.status_of(current_setting('t.pid')::uuid, 'client', core.riyadh_today() - 10), 'active',
  'and on an earlier day, the one then');
select test.eq(partner.status_of(current_setting('t.pid')::uuid, 'client', core.riyadh_today() + 10), 'active',
  'a dated change waits for its day');
select test.raises(format('update partner.side_status_change set status = %L where partner_id = %L', 'lost',
  current_setting('t.pid')), 'P0001', 'a status change is never rewritten', 'partner.status_never_rewritten');

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.partner_status_set(%L, %L, %L)', current_setting('t.pid'), 'supplier_partner',
  'prospect'), 'P0001', 'a side that is not on has no status', 'partner.side_not_on');
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.partner_status_set(%L, %L, %L)', current_setting('t.pid'), 'client', 'active'),
  '42501', 'a member who does not own the side cannot set its status', 'access.needs_capability');

-- the other side on, owned by someone else: two statuses, each set by its own owner
select test.as_person(current_setting('t.head')::uuid);
select api.partner_side_set(current_setting('t.pid')::uuid, 'supplier_partner',
  jsonb_build_object('type', 'sales_channel', 'owner_id', current_setting('t.am2')));
select test.as_person(current_setting('t.am2')::uuid);
select test.eq(api.partner_status_set(current_setting('t.pid')::uuid, 'supplier_partner', 'prospect') ->> 'status',
  'prospect', 'the Supplier & partner side''s owner sets its status');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.partner_status_set(%L, %L, %L)', current_setting('t.pid'), 'supplier_partner',
  'active'), '42501', 'but not the other side''s owner', 'access.needs_capability');
select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.partner_status_set(current_setting('t.pid')::uuid, 'client', 'lost', null,
  current_setting('t.lost_price')::uuid, 'made up') ->> 'status', 'lost', 'clients.assign sets it too');
select test.eq((select jsonb_object_agg(s ->> 'side', s ->> 'status')
                from jsonb_array_elements(api.partner(current_setting('t.pid')::uuid) -> 'sides') s),
  '{"client": "lost", "supplier_partner": "prospect"}'::jsonb, 'both sides on: two statuses');
select test.eq((select jsonb_array_length(s -> 'status_history')
                from jsonb_array_elements(api.partner(current_setting('t.pid')::uuid) -> 'sides') s
                where s ->> 'side' = 'client'), 4, 'the card shows each side''s whole history');
