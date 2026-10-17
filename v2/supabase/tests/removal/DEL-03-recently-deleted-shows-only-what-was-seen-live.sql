-- DEL-03 — QA-576: Recently deleted shows a person only what they could see before it was removed, and says whether
-- they may restore it. A task's helper from another department and a member whose Tasks page is None could never
-- open the task; once it is removed they do not see its title either, while its owner and a colleague who could read
-- it still do. A viewer sees a removed achievement but may not restore it; whoever removed it may. Every value is made up.
-- Sabotages: supabase/tests/sabotage/recently-deleted-trusts-the-owners-shortcut.sql,
--            supabase/tests/sabotage/recently-deleted-offers-restore-to-all.sql.
select set_config('v2.test_now', '2026-10-12 09:00:00+03', true);
select set_config('t.own', test.person('Test Removal Owner', 'member')::text, true);
select set_config('t.mate', test.person('Test Removal Colleague', 'member')::text, true);
select set_config('t.cut', test.person('Test Removal No Tasks', 'member')::text, true);
select set_config('t.far', test.person('Test Removal Far Helper', 'member', 'test_other_dept')::text, true);
select set_config('t.viewer', test.person('Test Removal Viewer', 'viewer')::text, true);
select set_config('t.admin', test.person('Test Removal Admin', 'admin')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
select test.as_owner();
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_rd_a', 'Test Removal A', 'فريق الحذف أ'),
       (test.department('test_other_dept'), 'test_rd_b', 'Test Removal B', 'فريق الحذف ب');
update core.person set team_id = (select id from core.team where code = 'test_rd_a')
where id in (current_setting('t.own')::uuid, current_setting('t.mate')::uuid, current_setting('t.cut')::uuid,
             current_setting('t.viewer')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_rd_b') where id = current_setting('t.far')::uuid;
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.cut')::uuid, 'tasks', 'none', 'made up: no tasks');

-- a task with two helpers who may not open it
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.task', api.task_create(jsonb_build_object('title', 'Made-up hidden task')) ->> 'id', true);
select api.task_helpers_set(current_setting('t.task')::uuid, array[current_setting('t.far')::uuid, current_setting('t.cut')::uuid]);
select test.as_person(current_setting('t.far')::uuid);
select test.raises(format('select api.task(%L)', current_setting('t.task')), 'P0002',
  'the helper from another department cannot open the live task', 'common.not_found');
select test.as_person(current_setting('t.own')::uuid);
select api.tasks_remove(array[current_setting('t.task')::uuid], 'made up: gone');

select test.as_person(current_setting('t.far')::uuid);
select test.ok(position('Made-up hidden task' in api.recently_deleted()::text) = 0,
  'nor does it read the removed task''s title');
select test.as_person(current_setting('t.cut')::uuid);
select test.ok(position('Made-up hidden task' in api.recently_deleted()::text) = 0,
  'nor does a member whose Tasks page is None');
select test.as_person(current_setting('t.mate')::uuid);
select test.eq((select x ->> 'label' from jsonb_array_elements(api.recently_deleted()) x
                where x ->> 'id' = current_setting('t.task')), 'Made-up hidden task',
  'a colleague who could read it still sees it');
select test.as_person(current_setting('t.own')::uuid);
select test.eq((select (x ->> 'can_restore')::boolean from jsonb_array_elements(api.recently_deleted()) x
                where x ->> 'id' = current_setting('t.task')), true, 'and its owner, who may restore it');

-- an achievement: the viewer sees it removed, without Restore
select set_config('t.ach', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up removed award',
  'happened_on', '2026-10-05')) ->> 'id', true);
select api.achievements_remove(array[current_setting('t.ach')::uuid], 'made up: logged twice');
select test.as_person(current_setting('t.viewer')::uuid);
select test.eq((select (x ->> 'can_restore')::boolean from jsonb_array_elements(api.recently_deleted()) x
                where x ->> 'id' = current_setting('t.ach')), false, 'a viewer sees the removed achievement without Restore');
select test.raises(format('select api.restore(%L, %L)', 'achievement', current_setting('t.ach')), '42501',
  'as the door refuses it', 'restore.not_allowed');
select test.as_person(current_setting('t.own')::uuid);
select test.eq((select (x ->> 'can_restore')::boolean from jsonb_array_elements(api.recently_deleted()) x
                where x ->> 'id' = current_setting('t.ach')), true, 'whoever removed it may restore it');
select test.runs(format('select api.restore(%L, %L)', 'achievement', current_setting('t.ach')), 'and does');
