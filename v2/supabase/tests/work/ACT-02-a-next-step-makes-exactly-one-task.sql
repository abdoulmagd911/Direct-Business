-- ACT-02 — an activity's next step makes exactly one task (V401, V406, V151). Logged with a next step, an activity on
-- an organisation makes one task for its author, due on the next step's day, dated the activity's day, linked to the
-- organisation and the activity, in the same request; editing the next step changes that task while it is open and
-- never makes another; "demo set" makes the demo task with the author's manager as helper, who is told; one Undo takes
-- back both; an open next-step task keeps the organisation fresh, a done one no longer does. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-next-step-edit-makes-another-task.sql, the-demo-task-has-no-helper.sql,
--            a-done-next-step-keeps-it-fresh.sql.
select set_config('v2.test_now', now()::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.mgr')::uuid, current_setting('t.am1')::uuid);
update core.person set manager_id = current_setting('t.mgr')::uuid where id = current_setting('t.am1')::uuid;
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Next Step Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.none', api.activity_log(current_setting('t.p')::uuid, 'call', 'answered') ->> 'id', true);
select set_config('t.a', api.activity_log(current_setting('t.p')::uuid, 'visit', 'visit_done', core.riyadh_today() - 2,
  'Made-up visit', 'Made-up: send the rate sheet', core.riyadh_today() + 3)::text, true);
select test.as_owner();
select test.eq((select count(*)::int from work.task where origin = 'next_step'), 1, 'one activity with a next step, one task');
select set_config('t.t', (select next_step_task_id::text from core.note
                          where id = (current_setting('t.a')::jsonb ->> 'id')::uuid), true);
select test.eq((select jsonb_build_object('title', title, 'owner', owner_id, 'partner', partner_id, 'due_on', due_on,
                                          'happened_on', happened_on, 'work_type', work_type)
                from work.task where id = current_setting('t.t')::uuid),
  jsonb_build_object('title', 'Made-up: send the rate sheet', 'owner', current_setting('t.am1')::uuid,
                     'partner', current_setting('t.p')::uuid, 'due_on', core.riyadh_today() + 3,
                     'happened_on', core.riyadh_today() - 2, 'work_type', 'client'),
  'its author''s, on the organisation, due on the next step''s day, dated the activity''s day');
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (current_setting('t.t')::uuid, (current_setting('t.a')::jsonb ->> 'id')::uuid)), 1,
  'in the activity''s own request');
select test.eq((select next_step_task_id from core.note where id = current_setting('t.none')::uuid), null::uuid,
  'an activity without a next step makes none');

-- editing the next step changes that task, never makes another
select test.as_person(current_setting('t.am1')::uuid);
select api.note_edit((current_setting('t.a')::jsonb ->> 'id')::uuid,
  jsonb_build_object('next_step', 'Made-up: send the revised sheet', 'next_step_on', core.riyadh_today() + 5), 1);
select test.as_owner();
select test.eq((select count(*)::int from work.task where origin = 'next_step'), 1, 'an edit makes no second task');
select test.eq((select title || ' ' || due_on from work.task where id = current_setting('t.t')::uuid),
  'Made-up: send the revised sheet ' || (core.riyadh_today() + 5), 'it changes the one it made');

-- an open next-step task keeps the organisation fresh after its day; once done it no longer does (V151)
select set_config('v2.test_now', (now() + interval '25 days')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select test.ok((api.partner(current_setting('t.p')::uuid) ->> 'stale_on')::date > core.riyadh_today(),
  '25 days on, past its day, its open task keeps the organisation fresh');
select api.task_status_set(current_setting('t.t')::uuid, 'done');
select test.ok((api.partner(current_setting('t.p')::uuid) ->> 'stale_on')::date <= core.riyadh_today(),
  'done, it goes stale');
select set_config('v2.test_now', now()::text, true);
select api.note_edit((current_setting('t.a')::jsonb ->> 'id')::uuid,
  jsonb_build_object('next_step', 'Made-up: one more thing'), 2);
select test.as_owner();
select test.eq((select title from work.task where id = current_setting('t.t')::uuid), 'Made-up: send the revised sheet',
  'a done task is left as it was done');
select test.eq((select count(*)::int from work.task where origin = 'next_step'), 1, 'and no other is made');

-- "demo set": the demo task, the manager as helper and told; one Undo takes back both
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.d', api.activity_log(current_setting('t.p')::uuid, 'call', 'demo_set', null, null, null,
  core.riyadh_today() + 4)::text, true);
select test.as_owner();
select set_config('t.dt', (select next_step_task_id::text from core.note
                           where id = (current_setting('t.d')::jsonb ->> 'id')::uuid), true);
select test.eq((select title || ' ' || due_on from work.task where id = current_setting('t.dt')::uuid),
  'Demo ' || (core.riyadh_today() + 4), 'the demo task, on the demo''s day');
select test.eq((select array_agg(person_id) from work.task_helper where task_id = current_setting('t.dt')::uuid
                and deleted_at is null), array[current_setting('t.mgr')::uuid], 'with the author''s manager as helper');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.mgr')::uuid
                and kind = 'helper_added' and entity_id = current_setting('t.dt')::uuid), 1, 'who is told');
select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.d')::jsonb ->> 'request_id'), 'one Undo');
select test.as_owner();
select test.eq((select count(*)::int from work.task where id = current_setting('t.dt')::uuid and deleted_at is null)
               + (select count(*)::int from core.note where id = (current_setting('t.d')::jsonb ->> 'id')::uuid
                  and deleted_at is null), 0, 'takes back the activity and its task');
