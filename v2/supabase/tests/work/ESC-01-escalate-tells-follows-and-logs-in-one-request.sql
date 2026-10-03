-- ESC-01 — Escalate (V401): on a task or an organisation, whoever may add to it escalates to someone else who can
-- work here and see it; the person is told ('escalated'), follows the record from then on, and the escalation is the
-- timeline's note — one request. Refused: no note, to oneself, to someone who cannot see the record, by a viewer, on a
-- record of another kind. Every value is made up.
-- Sabotages: supabase/tests/sabotage/an-escalation-follows-nobody.sql, an-escalation-to-someone-blind.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.blind', test.person('Test Outsider', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.head')::uuid, current_setting('t.am1')::uuid, current_setting('t.viewer')::uuid,
             current_setting('t.blind')::uuid);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.blind')::uuid, 'tasks', 'none', 'made up: no tasks'),
       (current_setting('t.blind')::uuid, 'clients', 'none', 'made up: no clients');

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up stuck task', 'work_type', 'internal'))
  ->> 'id', true);
select set_config('t.e', api.escalate('task', current_setting('t.t')::uuid, current_setting('t.head')::uuid,
  'Made-up: the supplier stopped answering')::text, true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.head')::uuid
                and kind = 'escalated' and entity_id = current_setting('t.t')::uuid
                and request_id = (current_setting('t.e')::jsonb ->> 'request_id')::uuid), 1, 'the person is told');
select test.eq((select count(*)::int from notify.follow where person_id = current_setting('t.head')::uuid
                and entity_table = 'work.task' and entity_id = current_setting('t.t')::uuid), 1, 'and follows it');
select test.eq((select kind || ': ' || body from core.note where id = (current_setting('t.e')::jsonb ->> 'note_id')::uuid),
  'escalation: Made-up: the supplier stopped answering', 'the escalation is on its timeline');
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id = (current_setting('t.e')::jsonb ->> 'note_id')::uuid), 1, 'one request');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Escalation Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select test.runs(format('select api.escalate(%L, %L, %L, %L)', 'partner', current_setting('t.p'), current_setting('t.am1'),
  'Made-up: they asked for the head'), 'an organisation is escalated too');

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.escalate(%L, %L, %L, %L)', 'task', current_setting('t.t'), current_setting('t.head'),
  ' '), 'P0001', 'an escalation says why', 'escalation.note_required');
select test.raises(format('select api.escalate(%L, %L, %L, %L)', 'task', current_setting('t.t'), current_setting('t.am1'),
  'Made up'), 'P0001', 'never to oneself', 'escalation.to_yourself');
select test.raises(format('select api.escalate(%L, %L, %L, %L)', 'task', current_setting('t.t'), current_setting('t.blind'),
  'Made up'), 'P0001', 'never to someone who cannot see it', 'escalation.cannot_see');
select set_config('t.prj', api.project_save(null, jsonb_build_object('name', 'Made-up project', 'work_type', 'internal'))
  ->> 'id', true);
select test.raises(format('select api.escalate(%L, %L, %L, %L)', 'project', current_setting('t.prj'),
  current_setting('t.head'), 'Made up'), 'P0001', 'a task or an organisation only', 'escalation.not_here');
select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.escalate(%L, %L, %L, %L)', 'task', current_setting('t.t'), current_setting('t.head'),
  'Made up'), '42501', 'a viewer escalates nothing', 'access.needs_level');
