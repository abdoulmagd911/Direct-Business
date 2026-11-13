-- CAT-03 — archiving a category in use moves its removed achievements to the replacement too (C-perf, 13 Nov; QA-97,
-- as core.list_retire): the archive dialog counts them among the uses, and a restore brings one back on the
-- replacement, never on the archived category. 'moved' counts the live ones, 'moved_removed' the removed ones.
-- Every value is made up.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select set_config('t.award', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'AWARD'), true);
select set_config('t.problem', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'PROBLEM'), true);

select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.live', api.achievement_log('{"category": "AWARD", "title": "Made-up live award",
  "happened_on": "2026-09-05"}') ->> 'id', true);
select set_config('t.gone', api.achievement_log('{"category": "AWARD", "title": "Made-up removed award",
  "happened_on": "2026-09-06"}') ->> 'id', true);
select api.achievements_remove(array[current_setting('t.gone')::uuid], 'Made-up reason');

select test.as_person(current_setting('t.admin')::uuid);
select test.eq((api.achievement_category_usage(current_setting('t.award')::uuid) ->> 'total')::int, 2,
  'the dialog counts the live and the removed one');
select set_config('t.r', api.achievement_category_retire(current_setting('t.award')::uuid,
  current_setting('t.problem')::uuid, 'Made-up reason')::text, true);
select test.eq(current_setting('t.r')::jsonb ->> 'moved', '1', 'one live achievement moved');
select test.eq(current_setting('t.r')::jsonb ->> 'moved_removed', '1', 'and the removed one with it');
select test.as_owner();
select test.eq((select c.code from perf.achievement a join perf.achievement_category c on c.id = a.category_id
                where a.id = current_setting('t.gone')::uuid), 'PROBLEM', 'the removed one sits on the replacement');

select test.as_person(current_setting('t.mgr')::uuid);
select api.restore('achievement', current_setting('t.gone')::uuid, 'Made-up reason');
select test.eq(api.achievement(current_setting('t.gone')::uuid) ->> 'category', 'PROBLEM',
  'restored, it comes back on the replacement, not the archived category');
