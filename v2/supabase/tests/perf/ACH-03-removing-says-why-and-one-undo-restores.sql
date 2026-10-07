-- ACH-03 — removing an achievement always says why (the brief; §3.8): refused without a reason; with one it leaves
-- the list, the reason kept on the row; one Undo restores it with its evidence untouched. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-achievement-removed-without-a-reason.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Member One', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'COST', 'title', 'Made-up saving',
  'happened_on', '2026-08-30'), jsonb_build_array(jsonb_build_object('system', 'ticket', 'value', 'MADE-UP-55')))
  ->> 'id', true);

select test.raises(format('select api.achievements_remove(array[%L]::uuid[], null)', current_setting('t.a')),
  'P0001', 'no reason, no removal', 'common.reason_required');
select test.raises(format('select api.achievements_remove(array[%L]::uuid[], %L)', current_setting('t.a'), '   '),
  'P0001', 'a blank reason is no reason', 'common.reason_required');
select set_config('t.rm', api.achievements_remove(array[current_setting('t.a')::uuid], 'Made-up duplicate')::text, true);
select test.eq((api.achievements() ->> 'total')::int, 0, 'removed, it leaves the list');
select test.raises(format('select api.achievement(%L)', current_setting('t.a')), 'P0002', 'and its page',
  'common.not_found');
select test.as_owner();
select test.eq((select delete_reason from perf.achievement where id = current_setting('t.a')::uuid), 'Made-up duplicate',
  'the reason is kept');

select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.rm')::jsonb ->> 'request_id'), 'one Undo');
select test.eq((api.achievements() ->> 'total')::int, 1, 'brings it back');
select test.eq(jsonb_array_length(api.achievement(current_setting('t.a')::uuid) -> 'refs'), 1, 'with its evidence');
