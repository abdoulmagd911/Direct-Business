-- TGT-02 — a plan target can be deleted (Landing 15, F-B5-12; D-5 RULED: delete allowed): an admin removes it with
-- a reason — it leaves the list, the reason is kept on the row, and the same category and month can be targeted
-- again — while the achievements already logged against it stay exactly as they are (achievements link to the
-- category + plan/month, never to the target). Only admins delete; no reason, no delete; one Undo brings it back.
-- Every value is made up.
select set_config('v2.test_now', '2026-11-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select set_config('t.problem', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'PROBLEM'), true);
select set_config('t.t1', api.target_save(null, current_setting('t.p26')::uuid,
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2026-09-01', 'target_count', 5)) ->> 'id', true);

select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.target_delete(%L, %L)', current_setting('t.t1'), 'Made-up reason'),
  '42501', 'only an admin deletes a target', 'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.target_delete(%L, null)', current_setting('t.t1')),
  'P0001', 'no reason, no delete', 'common.reason_required');
select test.raises(format('select api.target_delete(%L, %L)', current_setting('t.t1'), '   '),
  'P0001', 'a blank reason is no reason', 'common.reason_required');
select test.raises('select api.target_delete(''00000000-0000-0000-0000-000000000000'', ''Made-up reason'')',
  'P0002', 'no such target', 'common.not_found');

-- two achievements already logged against the target's category and month (Count 0, Achieved 2 — the stranded shape)
select test.as_person(current_setting('t.mgr')::uuid);
select api.achievement_log('{"category": "PROBLEM", "title": "Made-up fix one", "happened_on": "2026-09-10"}');
select api.achievement_log('{"category": "PROBLEM", "title": "Made-up fix two", "happened_on": "2026-09-15"}');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select x ->> 'achieved_count' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t1')), '2', 'two achieved against it before the delete');

select set_config('t.rm', api.target_delete(current_setting('t.t1')::uuid, 'Made-up duplicate')::text, true);
select test.eq((select count(*)::int from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t1')), 0, 'deleted, it leaves the list');
select test.as_owner();
select test.eq((select delete_reason from perf.target where id = current_setting('t.t1')::uuid),
  'Made-up duplicate', 'the reason is kept');
select test.ok((select deleted_at is not null from perf.target where id = current_setting('t.t1')::uuid),
  'and the row is soft-deleted');
select test.eq((select count(*)::int from perf.achievement a where a.category_id = current_setting('t.problem')::uuid
                and a.deleted_at is null), 2, 'the achievements already logged stay');
select test.as_person(current_setting('t.admin')::uuid);

select test.runs(format('select api.undo(%L)', current_setting('t.rm')::jsonb ->> 'request_id'), 'one Undo');
select test.eq((select count(*)::int from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t1')), 1, 'brings the deleted target back');
select test.eq((select x ->> 'achieved_count' from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'id' = current_setting('t.t1')), '2', 'with its achieved count still read');

-- deleted again, the same category and month can be targeted afresh (the one-per-category-month rule only holds
-- live targets — the soft-deleted row does not block a new one)
select api.target_delete(current_setting('t.t1')::uuid, 'Made-up duplicate');
select test.runs(format('select api.target_save(null, %L, %L::jsonb)', current_setting('t.p26'),
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2026-09-01', 'target_count', 3)),
  'the same category and month can be targeted again');
select test.eq((select count(*)::int from jsonb_array_elements(api.targets(current_setting('t.p26')::uuid)) x
                where x ->> 'category_code' = 'PROBLEM'), 1, 'with one live target again');
