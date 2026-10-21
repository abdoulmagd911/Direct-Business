-- ACT-03 — V645: Log activity asks who it was with. With someone inside Direct (a team or a system from the Settings
-- list) it needs no organisation and may carry a ticket reference; its next step becomes a task on My day as today, an
-- internal one. It is seen by its author, the people it names and an admin — never by a colleague who may open the
-- author's page, nor by the author's manager — and by the author's team only when the author shares it with them. The
-- screen lists them through api.activities_inside, since a named colleague may not open the author's page.
-- An organisation's activity is as before, and may carry a ticket reference too. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-activity-inside-direct-reaches-every-colleague.sql.
select set_config('v2.test_now', current_date || ' 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_inside_a', 'Test Inside A', 'فريق الداخل أ'),
       (test.department('commercial'), 'test_inside_b', 'Test Inside B', 'فريق الداخل ب');
select set_config('t.mgr', test.person('Test Inside Manager', 'manager')::text, true);
select set_config('t.author', test.person('Test Inside Author', 'member')::text, true);
select set_config('t.mate', test.person('Test Inside Teammate', 'member')::text, true);
select set_config('t.named', test.person('Test Inside Named', 'member')::text, true);
select set_config('t.outsider', test.person('Test Inside Outsider', 'member')::text, true);
select set_config('t.admin', test.person('Test Inside Admin', 'admin')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_inside_a')
where id in (current_setting('t.author')::uuid, current_setting('t.mate')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_inside_b')
where id in (current_setting('t.named')::uuid, current_setting('t.outsider')::uuid, current_setting('t.mgr')::uuid);
update core.person set manager_id = current_setting('t.mgr')::uuid where id = current_setting('t.author')::uuid;

-- with whom: an organisation or someone inside Direct, exactly one
select test.as_person(current_setting('t.author')::uuid);
select test.raises('select api.activity_log(null, ''call'')', 'P0001', 'with nobody: refused', 'activity.with_whom_required');
select test.raises('select api.activity_log(null, ''call'', p_internal => ''nobody_here'')', 'P0002',
  'with a team not on the list: refused', 'activity.unknown_internal_party');

-- a WhatsApp with the developers, a ticket, a named colleague and a next step — no organisation
select set_config('t.a', api.activity_log(null, 'whatsapp', null, null, 'Made-up the booking page shows the wrong fare',
  'Made-up check the fix is live', current_date + 2, array[current_setting('t.named')::uuid],
  'https://tickets.example/T-0001', 'developers')::text, true);
select set_config('t.n', current_setting('t.a')::jsonb ->> 'id', true);
select test.as_owner();
select test.eq((select jsonb_build_object('on', n.entity_table, 'org', n.entity_table = 'partner.partner',
                                          'ticket', n.ticket_ref, 'party', p.key)
                from core.note n join partner.internal_party p on p.id = n.internal_party_id
                where n.id = current_setting('t.n')::uuid),
  jsonb_build_object('on', 'core.person', 'org', false, 'ticket', 'https://tickets.example/T-0001', 'party', 'developers'),
  'it is logged with the developers and its ticket, on no organisation');
select test.eq((select jsonb_build_object('work_type', t.work_type, 'partner', t.partner_id, 'owner', t.owner_id)
                from core.note n join work.task t on t.id = n.next_step_task_id where n.id = current_setting('t.n')::uuid),
  jsonb_build_object('work_type', 'internal', 'partner', null, 'owner', current_setting('t.author')),
  'its next step is an internal task for its author, on My day as today');

-- who sees it
select test.as_person(current_setting('t.author')::uuid);
select test.eq((select x ->> 'internal_party' from jsonb_array_elements(api.activities_inside()) x
                where x ->> 'id' = current_setting('t.n')), 'developers', 'its author sees it, with whom it was');
select test.as_person(current_setting('t.named')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(api.activities_inside()) x
                where x ->> 'id' = current_setting('t.n')), 1, 'the person it names sees it');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(api.activities_inside()) x
                where x ->> 'id' = current_setting('t.n')), 1, 'an admin sees it, as shared');
select test.as_person(current_setting('t.outsider')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(api.activities_inside()) x
                where x ->> 'id' = current_setting('t.n')), 0, 'an outsider does not see it');
select test.as_owner();
select test.eq(jsonb_build_object(
    'outsider', authz.can_see_as(current_setting('t.outsider')::uuid, 'core.note', current_setting('t.n')::uuid),
    'manager', authz.can_see_as(current_setting('t.mgr')::uuid, 'core.note', current_setting('t.n')::uuid),
    'mate', authz.can_see_as(current_setting('t.mate')::uuid, 'core.note', current_setting('t.n')::uuid)),
  jsonb_build_object('outsider', false, 'manager', false, 'mate', false),
  'nor does the author''s manager, nor the team while it is not shared');

-- shared with the author's team
select test.as_person(current_setting('t.author')::uuid);
select set_config('t.s', api.activity_log(null, 'email', null, null, 'Made-up shift handover', p_internal => 'operations',
  p_share_team => true) ->> 'id', true);
select test.as_person(current_setting('t.mate')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(api.activities_inside()) x
                where x ->> 'id' in (current_setting('t.s'), current_setting('t.n'))), 1,
  'a teammate sees the one shared with the team, not the other');
select test.as_person(current_setting('t.outsider')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(api.activities_inside()) x
                where x ->> 'id' = current_setting('t.s')), 0, 'and another team still does not');

-- an organisation's activity is as before; it may carry a ticket, not a team share
select test.as_person(current_setting('t.author')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Ticket Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.author'))))) ->> 'id', true);
select set_config('t.o', api.activity_log(current_setting('t.p')::uuid, 'ticket', p_ticket_ref => 'TCK-T-0042') ->> 'id', true);
select test.eq((select x ->> 'ticket_ref' from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) x
                where x ->> 'id' = current_setting('t.o')), 'TCK-T-0042', 'an organisation''s activity carries a ticket too');
select test.raises(format('select api.activity_log(%L, ''call'', p_share_team => true)', current_setting('t.p')), 'P0001',
  'an organisation''s activity is not shared with a team', 'activity.share_team_internal_only');
select test.raises(format('select api.activity_log(%L, ''call'', p_internal => ''support'')', current_setting('t.p')), 'P0001',
  'nor both an organisation and a team inside Direct', 'activity.with_whom_required');
