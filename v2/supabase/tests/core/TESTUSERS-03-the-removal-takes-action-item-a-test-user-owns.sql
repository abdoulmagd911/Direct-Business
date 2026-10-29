-- TESTUSERS-03 (QA-599, V656) — The removal before go-live does not stop at an action item a TEST user owns: it takes it, and the
-- people, and leaves a real person's own action-item alone. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-test-removal-stops-at-action-item.sql.
select test.department('commercial');
select test.as_owner();
select core.test_users_seed();
select set_config('t.real', test.person('Made-up Real Person', 'manager')::text, true);
select set_config('t.tm', core.test_id('person', 5)::text, true);
select set_config('t.team4', core.test_id('team', 4)::text, true);

select test.as_person(current_setting('t.real')::uuid);
select set_config('t.rtask', api.task_create(jsonb_build_object('title', 'Made-up task of a real person',
  'work_type', 'internal', 'team_id', current_setting('t.team4'))) ->> 'id', true);
select test.as_owner();
insert into work.action_item (task_id, text, owner_id) values (current_setting('t.rtask')::uuid, 'Made-up item of a TEST user', current_setting('t.tm')::uuid);
insert into work.action_item (task_id, text, owner_id) values (current_setting('t.rtask')::uuid, 'Made-up item of a real person', current_setting('t.real')::uuid);
select core.test_users_remove();
select test.eq((select count(*)::int from core.person p where p.id in (select core.test_id('person', k) from generate_series(1, 6) k) and p.deleted_at is null), 0, 'the removal went through: no TEST person is live');
select test.eq((select count(*)::int from work.action_item a where a.owner_id = current_setting('t.tm')::uuid and a.deleted_at is null), 0, 'the TEST user''s action item is removed');
select test.eq((select count(*)::int from work.action_item a where a.owner_id = current_setting('t.real')::uuid and a.deleted_at is null), 1, 'a real person''s action item stays');
