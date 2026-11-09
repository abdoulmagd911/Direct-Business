-- DLG-01 — Delegate, the nudge dismissal, and the task row's new fields (Phase 1, CUJ 5/7).
-- A manager delegates a task to a member with a note: the member becomes the owner
-- and is told, the note is the task's timeline entry, and the delegator follows the
-- task — one request. A member delegates their OWN task the same way (FIX-03 P1b).
-- Refused: no note, to oneself, to someone who cannot see the task, by a member who
-- does not own the task. A closed task is dismissed from the nudge and restored
-- again; the row carries its star, its dismissal and whether an achievement already
-- links to it. Every value is made up.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select set_config('t.blind', test.person('Test Outsider', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_dlg', 'Test Delegate Desk', 'فريق التفويض');
update core.person set team_id = (select id from core.team where code = 'test_dlg')
where id in (current_setting('t.head')::uuid, current_setting('t.am1')::uuid, current_setting('t.am2')::uuid,
             current_setting('t.blind')::uuid);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.blind')::uuid, 'tasks', 'none', 'made up: no tasks'),
       (current_setting('t.blind')::uuid, 'clients', 'none', 'made up: no clients');
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up handover task', 'work_type', 'internal'))
  ->> 'id', true);

-- the head delegates to the second member, with a note
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.d', api.task_delegate(current_setting('t.t')::uuid, current_setting('t.am2')::uuid,
  'Made-up: take this over, the client is waiting')::text, true);
select test.as_owner();
select test.eq((select owner_id from work.task where id = current_setting('t.t')::uuid)::text,
  current_setting('t.am2'), 'the new owner owns the task');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and kind = 'assigned' and entity_id = current_setting('t.t')::uuid
                and request_id = (current_setting('t.d')::jsonb ->> 'request_id')::uuid), 1,
  'the new owner is told, in the same request');
select test.eq((select count(*)::int from notify.follow where person_id = current_setting('t.head')::uuid
                and entity_table = 'work.task' and entity_id = current_setting('t.t')::uuid), 1,
  'the delegator follows the task from then on');
select test.eq((select count(*)::int from work.task_helper where task_id = current_setting('t.t')::uuid
                and person_id = current_setting('t.head')::uuid and deleted_at is null), 1,
  'and is listed in the Helpers list (FIX-40)');
select test.eq((select kind || ': ' || body from core.note
                where id = (current_setting('t.d')::jsonb ->> 'note_id')::uuid),
  'update: Made-up: take this over, the client is waiting', 'the note is the task''s timeline entry');
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id = (current_setting('t.d')::jsonb ->> 'note_id')::uuid), 1, 'one request');

-- refused: no note, to oneself, to someone who cannot see the task, by a member who does not own it
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.task_delegate(%L, %L, %L)', current_setting('t.t'),
  current_setting('t.am1'), ' '), 'P0001', 'a delegation says why', 'task.delegate_note_required');
select test.raises(format('select api.task_delegate(%L, %L, %L)', current_setting('t.t'),
  current_setting('t.head'), 'Made up'), 'P0001', 'never to oneself', 'task.delegate_to_yourself');
select test.raises(format('select api.task_delegate(%L, %L, %L)', current_setting('t.t'),
  current_setting('t.blind'), 'Made up'), 'P0001', 'never to someone who cannot see it',
  'task.delegate_cannot_see');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.task_delegate(%L, %L, %L)', current_setting('t.t'),
  current_setting('t.am2'), 'Made up'), '42501', 'giving work to others needs the capability',
  'access.needs_capability');

-- a member delegates their OWN task (P1b): the new owner is told, the delegator follows it
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t2', api.task_create(jsonb_build_object('title', 'Made-up own handover task',
  'work_type', 'internal')) ->> 'id', true);
select set_config('t.d2', api.task_delegate(current_setting('t.t2')::uuid, current_setting('t.am2')::uuid,
  'Made-up: take this over, I am handing it to you')::text, true);
select test.as_owner();
select test.eq((select owner_id from work.task where id = current_setting('t.t2')::uuid)::text,
  current_setting('t.am2'), 'the new owner owns the member''s task too');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and kind = 'assigned' and entity_id = current_setting('t.t2')::uuid
                and request_id = (current_setting('t.d2')::jsonb ->> 'request_id')::uuid), 1,
  'the new owner is told, in the same request');
select test.eq((select count(*)::int from notify.follow where person_id = current_setting('t.am1')::uuid
                and entity_table = 'work.task' and entity_id = current_setting('t.t2')::uuid), 1,
  'the delegating member follows it from then on');

-- the row carries the star, the dismissal and the achievement link
select test.as_person(current_setting('t.am2')::uuid);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'starred')::boolean, false, 'not starred yet');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'dismissed_from_nudge')::boolean, false,
  'not dismissed yet');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'has_achievement')::boolean, false,
  'no achievement links to it yet');
select api.task_star(current_setting('t.t')::uuid, true);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'starred')::boolean, true, 'the star shows on the row');
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'AWARD',
  'title', 'Made-up delegated work', 'happened_on', '2026-09-21', 'source_task_id', current_setting('t.t')))
  ->> 'id', true);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'has_achievement')::boolean, true,
  'the linked achievement shows on the row');

-- the owner closes the task, dismisses it from the nudge, and restores it again
select api.task_status_set(current_setting('t.t')::uuid, 'done');
select set_config('t.n', api.task_nudge_dismiss(current_setting('t.t')::uuid, true)::text, true);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'dismissed_from_nudge')::boolean, true,
  'dismissed from the nudge');
select test.eq((api.task_nudge_dismiss(current_setting('t.t')::uuid, true) -> 'request_id'), 'null'::jsonb,
  'dismissing it again changes and logs nothing');
select api.task_nudge_dismiss(current_setting('t.t')::uuid, false);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'dismissed_from_nudge')::boolean, false,
  'restored to the nudge');
select test.as_person(current_setting('t.blind')::uuid);
select test.raises(format('select api.task_nudge_dismiss(%L, true)', current_setting('t.t')), 'P0002',
  'someone who cannot see the task dismisses nothing', 'common.not_found');
