-- LEAVE-01 — leaving (V452, V456): marking a person as left hands every open item they hold — open tasks, open
-- projects, open action items, the sides they own today and from a later day — to the named person, sets the day they
-- left and switches them off, in one request with the count on it; the new owner is told of each; what is closed stays;
-- one Undo, an admin's (a sign-in change), puts it all back. Every value is made up.
-- Sabotages: supabase/tests/sabotage/leaving-keeps-the-sides.sql, supabase/tests/sabotage/leaving-drops-a-later-side.sql,
--            supabase/tests/sabotage/a-handed-over-task-tells-nobody.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Leaver', 'member')::text, true);
select set_config('t.am2', test.person('Test Taker', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.head')::uuid, current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);

-- what the leaver holds: an organisation they own since last month, one they own from next week, an open task with an
-- open and a ticked item, a closed task, and a project
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Leaving Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.q', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Later Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am2'))))) ->> 'id', true);
select api.partner_owner_set(current_setting('t.q')::uuid, 'client', current_setting('t.am1')::uuid,
                             core.riyadh_today() + 7, 'made up: takes it over next week');
select test.as_owner();
update partner.side_owner set effective_from = core.riyadh_today() - 30
where partner_id = current_setting('t.p')::uuid and deleted_at is null;
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up open task')) ->> 'id', true);
select set_config('t.i1', api.action_item_add(current_setting('t.t')::uuid,
  jsonb_build_object('text', 'Made-up: open item')) ->> 'id', true);
select set_config('t.i2', api.action_item_add(current_setting('t.t')::uuid,
  jsonb_build_object('text', 'Made-up: ticked item')) ->> 'id', true);
select api.action_item_done(current_setting('t.i2')::uuid, true);
select set_config('t.closed', api.task_create(jsonb_build_object('title', 'Made-up closed task')) ->> 'id', true);
select api.task_status_set(current_setting('t.closed')::uuid, 'done');
select set_config('t.prj', api.project_save(null, jsonb_build_object('name', 'Made-up leaver project',
  'work_type', 'internal')) ->> 'id', true);

-- holding work, nobody leaves without naming who takes it
select test.as_person(current_setting('t.admin')::uuid);
select test.eq(api.person_open_work(current_setting('t.am1')::uuid) - 'heads',
  '{"tasks": 1, "projects": 1, "action_items": 1, "sides": 2, "templates": 0}'::jsonb, 'the dialog reads what they hold');
select test.raises(format('select api.person_leave(%L, %L)', current_setting('t.am1'), 'made up: left'),
  'P0001', 'leaving with open work and nobody named is refused', 'person.open_work');
select set_config('t.r', api.person_leave(current_setting('t.am1')::uuid, 'made up: left the company', null,
  current_setting('t.am2')::uuid)::text, true);
select test.eq(current_setting('t.r')::jsonb -> 'handed_over',
  '{"tasks": 1, "projects": 1, "action_items": 1, "sides": 2, "templates": 0}'::jsonb, 'everything open is handed over');
select set_config('t.req', current_setting('t.r')::jsonb ->> 'request_id', true);

select test.as_owner();
select test.eq((select (left_on, can_sign_in)::text from core.person where id = current_setting('t.am1')::uuid),
  (core.riyadh_today(), false)::text, 'left today and switched off');
select test.eq((select owner_id from work.task where id = current_setting('t.t')::uuid), current_setting('t.am2')::uuid,
  'the open task has its new owner');
select test.eq((select owner_id from work.action_item where id = current_setting('t.i1')::uuid),
  current_setting('t.am2')::uuid, 'and its open item');
select test.eq((select owner_id from work.project where id = current_setting('t.prj')::uuid),
  current_setting('t.am2')::uuid, 'the project too');
select test.eq((select owner_id from work.task where id = current_setting('t.closed')::uuid),
  current_setting('t.am1')::uuid, 'a closed task stays theirs');
select test.eq((select owner_id from work.action_item where id = current_setting('t.i2')::uuid),
  current_setting('t.am1')::uuid, 'and so does a ticked item');
select test.eq((select array_agg(o.person_id::text || ' ' || o.effective_from || ' ' || coalesce(o.effective_to::text, '-')
                                 order by o.effective_from)
                from partner.side_owner o where o.partner_id = current_setting('t.p')::uuid and o.deleted_at is null),
  array[current_setting('t.am1') || ' ' || (core.riyadh_today() - 30) || ' ' || core.riyadh_today(),
        current_setting('t.am2') || ' ' || core.riyadh_today() || ' -'],
  'an organisation owned since last month: theirs until today, the new owner''s from today');
select test.eq((select array_agg(o.person_id::text || ' ' || o.effective_from || ' ' || coalesce(o.effective_to::text, '-')
                                 order by o.effective_from)
                from partner.side_owner o where o.partner_id = current_setting('t.q')::uuid and o.deleted_at is null),
  array[current_setting('t.am2') || ' ' || core.riyadh_today() || ' ' || (core.riyadh_today() + 7),
        current_setting('t.am2') || ' ' || (core.riyadh_today() + 7) || ' -'],
  'one they were to own from next week passes whole');
select test.eq((select array_agg(n.entity_table order by n.entity_table) from notify.notification n
                where n.person_id = current_setting('t.am2')::uuid and n.kind = 'assigned'
                  and n.request_id = current_setting('t.req')::uuid),
  array['partner.partner', 'partner.partner', 'work.action_item', 'work.project', 'work.task'],
  'the new owner is told of each, once per organisation');
select test.eq((select (label_key, label_args ->> 'count')::text from audit.request
                where id = current_setting('t.req')::uuid), ('person.left', '5')::text,
  'one request, with the count on it');
select test.eq((select count(distinct c.row_id)::int from audit.change c
                where c.request_id = current_setting('t.req')::uuid
                  and c.row_id in (current_setting('t.t')::uuid, current_setting('t.i1')::uuid,
                                   current_setting('t.prj')::uuid, current_setting('t.am1')::uuid)),
  4, 'every change in it');

-- one Undo, an admin's, puts it all back
select set_config('t.k', core.auth_ticket_issue('undo', current_setting('t.req'),
                                                current_setting('t.admin')::uuid)::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.undo_ticketed(current_setting('t.req')::uuid, current_setting('t.k')::uuid);
select test.as_owner();
select test.eq((select (left_on, can_sign_in)::text from core.person where id = current_setting('t.am1')::uuid),
  (null::date, true)::text, 'Undo: back, and allowed to sign in');
select test.eq((select array_agg(x order by x) from (
    select owner_id::text as x from work.task where id in (current_setting('t.t')::uuid, current_setting('t.closed')::uuid)
    union all select owner_id::text from work.action_item where id in (current_setting('t.i1')::uuid, current_setting('t.i2')::uuid)
    union all select owner_id::text from work.project where id = current_setting('t.prj')::uuid) s),
  array_fill(current_setting('t.am1'), array[5]), 'their tasks, items and project theirs again');
select test.eq((select array_agg(o.person_id::text || ' ' || o.effective_from || ' ' || coalesce(o.effective_to::text, '-')
                                 order by o.partner_id = current_setting('t.p')::uuid desc, o.effective_from)
                from partner.side_owner o
                where o.partner_id in (current_setting('t.p')::uuid, current_setting('t.q')::uuid) and o.deleted_at is null),
  array[current_setting('t.am1') || ' ' || (core.riyadh_today() - 30) || ' -',
        current_setting('t.am2') || ' ' || core.riyadh_today() || ' ' || (core.riyadh_today() + 7),
        current_setting('t.am1') || ' ' || (core.riyadh_today() + 7) || ' -'],
  'and their organisations, with their dates');
