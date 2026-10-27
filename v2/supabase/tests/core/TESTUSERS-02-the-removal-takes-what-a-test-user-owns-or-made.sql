-- TESTUSERS-02 (QA-599, V656) — The removal before go-live also takes an extra task a TEST user made, a note one wrote,
-- and the helper links they hold; a real person's own task, note and person stay, and only the TEST helper link on
-- the real task goes. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-test-removal-takes-only-the-seeded-rows.sql.
select test.department('commercial');
select test.as_owner();
select core.test_users_seed();
select set_config('t.real', test.person('Made-up Real Person')::text, true);
select set_config('t.tm', core.test_id('person', 5)::text, true);
select set_config('t.team4', core.test_id('team', 4)::text, true);

-- a TEST user makes an extra task and writes a note; a real person makes a task with a TEST helper and writes a note
select test.as_person(current_setting('t.tm')::uuid);
select set_config('t.extra', api.task_create(jsonb_build_object('title', 'Made-up extra task by a TEST user',
  'work_type', 'internal', 'team_id', current_setting('t.team4'))) ->> 'id', true);
select test.as_owner();
insert into my.note (person_id, kind, title, body, visibility)
  values (current_setting('t.tm')::uuid, 'sticky', 'TEST extra note', 'Made up.', 'private');
select test.as_person(current_setting('t.real')::uuid);
select set_config('t.rtask', api.task_create(jsonb_build_object('title', 'Made-up task of a real person',
  'work_type', 'internal', 'team_id', current_setting('t.team4'),
  'helper_ids', jsonb_build_array(current_setting('t.tm')))) ->> 'id', true);
select test.as_owner();
insert into my.note (person_id, kind, title, body, visibility)
  values (current_setting('t.real')::uuid, 'sticky', 'Made-up note of a real person', 'Made up.', 'private');

select test.eq((select count(*)::int from work.task_helper h where h.task_id = current_setting('t.rtask')::uuid
                  and h.deleted_at is null), 1, 'the TEST helper is on the real task');
select core.test_users_remove();
select test.eq((select count(*)::int from work.task t where t.id = current_setting('t.extra')::uuid and t.deleted_at is null), 0,
  'the extra task a TEST user made is removed');
select test.eq((select count(*)::int from my.note n where n.person_id in (select core.test_id('person', k) from generate_series(1, 6) k)
                  and n.deleted_at is null), 0, 'every note a TEST user wrote is removed');
select test.eq((select count(*)::int from work.task_helper h where h.person_id in (select core.test_id('person', k) from generate_series(1, 6) k)
                  and h.deleted_at is null), 0, 'no helper link of a TEST user is live');
select test.eq((select count(*)::int from work.task t where t.id = current_setting('t.rtask')::uuid and t.deleted_at is null), 1,
  'a real person''s task stays');
select test.eq((select count(*)::int from my.note n where n.person_id = current_setting('t.real')::uuid and n.deleted_at is null), 1,
  'a real person''s note stays');
select test.eq((select p.deleted_at is null from core.person p where p.id = current_setting('t.real')::uuid), true,
  'a real person is untouched');
