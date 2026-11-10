-- TGT-01 — a plan's targets (FIX-23, §3.8): an admin adds a target for a category in a month of the plan's year,
-- edits it, and the read counts what it has achieved so far — live dated achievements of the category whose day
-- falls in the month (drafts never count, V68), and their deal-value total (V505). Only admins write; a month
-- outside the plan's year, a category of another plan, a value on a category that carries none, and a second target
-- for the same category and month are all refused. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-target-is-counted-twice.sql (added with the build).
select set_config('v2.test_now', '2026-11-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select set_config('t.problem', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'PROBLEM'), true);
select set_config('t.contract', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'CONTRACT'), true);

select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.target_save(null, %L, %L::jsonb)', current_setting('t.p26'),
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2026-09-01', 'target_count', 5)),
  '42501', 'only an admin writes a target', 'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.target_save(null, %L, %L::jsonb)', current_setting('t.p26'),
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2025-09-01', 'target_count', 5)),
  'P0001', 'a month outside the plan''s year is refused', 'target.invalid');
select test.raises(format('select api.target_save(null, %L, %L::jsonb)', current_setting('t.p26'),
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2026-09-15', 'target_count', 5)),
  'P0001', 'a month is the first of the month', 'target.invalid');
select test.raises(format('select api.target_save(null, %L, %L::jsonb)', current_setting('t.p26'),
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2026-09-01', 'target_count', -1)),
  'P0001', 'a count is never negative', 'target.invalid');
select test.raises(format('select api.target_save(null, %L, %L::jsonb)', current_setting('t.p26'),
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2026-09-01', 'target_count', 5,
                     'target_value', 1000)), 'P0001', 'a value only where the category carries one',
  'achievement.no_deal_value');
select set_config('t.p25', api.plan_open(test.department('commercial'), 2025) ->> 'id', true);
select test.raises(format('select api.target_save(null, %L, %L::jsonb)', current_setting('t.p26'),
  jsonb_build_object('category', (select x ->> 'id' from jsonb_array_elements(
    api.achievement_categories(current_setting('t.p25')::uuid)) x where x ->> 'code' = 'PROBLEM'),
    'month', '2026-09-01', 'target_count', 5)), 'P0001', 'a category of another plan is refused',
  'target.category_invalid');

select set_config('t.t1', api.target_save(null, current_setting('t.p26')::uuid,
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2026-09-01', 'target_count', 5)) ->> 'id', true);
select test.eq((select x ->> 'target_count' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t1')), '5', 'the target is saved');
select test.eq((select x ->> 'achieved_count' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t1')), '0', 'nothing achieved yet');
select test.raises(format('select api.target_save(null, %L, %L::jsonb)', current_setting('t.p26'),
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2026-09-01', 'target_count', 9)),
  '23505', 'one target per category and month', 'target.taken');
select set_config('t.t2', api.target_save(null, current_setting('t.p26')::uuid,
  jsonb_build_object('category', current_setting('t.contract'), 'month', '2026-09-01', 'target_count', 2,
                     'target_value', 1000.00)) ->> 'id', true);
select test.eq((select x ->> 'target_value' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t2')), '1000.00', 'a deal-value target is saved');

select test.as_person(current_setting('t.mgr')::uuid);
select api.achievement_log('{"category": "PROBLEM", "title": "Made-up fix one", "happened_on": "2026-09-10"}');
select api.achievement_log('{"category": "PROBLEM", "title": "Made-up fix two", "happened_on": "2026-09-15"}');
select api.achievement_log('{"category": "PROBLEM", "title": "Made-up fix in October", "happened_on": "2026-10-02"}');
select api.achievement_log('{"category": "PROBLEM", "title": "Made-up fix with no day yet"}');
select set_config('t.a', api.achievement_log('{"category": "CONTRACT", "title": "Made-up contract",
  "happened_on": "2026-09-05", "deal_value": 1000}') ->> 'id', true);
select test.eq((select x ->> 'achieved_count' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t1')), '2',
  'achieved counts the month''s dated achievements only — October and the dateless draft do not count');
select test.eq((select x ->> 'achieved_value' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t2')), '1000.00', 'and sums their deal values');
select test.eq((select x ->> 'achieved_count' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t2')), '1', 'one contract in September');

select test.as_person(current_setting('t.admin')::uuid);
select test.runs(format('select api.target_save(%L, null, %L::jsonb, %s)', current_setting('t.t1'),
  '{"target_count": 8}',
  (select x ->> 'version' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
   where x ->> 'id' = current_setting('t.t1'))), 'the count is edited');
select test.eq((select x ->> 'target_count' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t1')), '8', 'and the edit lands');
select test.eq((select x ->> 'version' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t1')), '2', 'with the version moved on');
select test.raises(format('select api.target_save(%L, null, %L::jsonb, 1)', current_setting('t.t1'),
  '{"target_count": 9}'), 'P0001', 'a stale version is refused', 'common.conflict');
select test.eq(api.plan(current_setting('t.p26')::uuid) ->> 'year', '2026', 'the plan reads back');
select test.eq(api.plan(current_setting('t.p26')::uuid) ->> 'categories', '7', 'with its categories counted');
select test.eq(api.plan('00000000-0000-0000-0000-000000000000'), null::jsonb, 'no such plan reads as nothing');
