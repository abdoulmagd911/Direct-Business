-- ACH-04 — a manager or admin moves an achievement into an earlier period with a reason, and it carries the "moved"
-- mark (V400); a member may not, and nothing moves forward. An Unknown owner is past work only (V491): a live
-- achievement without an owner is refused by the database; a manager gives backfilled work its owner (Needs an owner),
-- logged and undoable, telling nobody; a member cannot. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-live-achievement-without-an-owner.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Member One', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'MOU', 'title', 'Made-up MoU',
  'happened_on', '2026-09-02')) ->> 'id', true);
select set_config('t.v', api.achievement(current_setting('t.a')::uuid) ->> 'version', true);

select test.raises(format('select api.achievement_move(%L, %L, %L, %s)', current_setting('t.a'), '2026-08-28',
  'Made-up reason', current_setting('t.v')), '42501', 'a member does not move it', 'access.needs_level');
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.achievement_move(%L, %L, null, %s)', current_setting('t.a'), '2026-08-28',
  current_setting('t.v')), 'P0001', 'a move says why', 'common.reason_required');
select test.raises(format('select api.achievement_move(%L, %L, %L, %s)', current_setting('t.a'), '2026-09-20',
  'Made-up reason', current_setting('t.v')), 'P0001', 'only into an earlier period', 'achievement.move_earlier_only');
select test.runs(format('select api.achievement_move(%L, %L, %L, %s)', current_setting('t.a'), '2026-08-28',
  'Signed in August, made up', current_setting('t.v')), 'a manager moves it');
select set_config('t.row', api.achievement(current_setting('t.a')::uuid)::text, true);
select test.eq((current_setting('t.row')::jsonb ->> 'happened_on'), '2026-08-28', 'into August');
select test.eq((current_setting('t.row')::jsonb ->> 'moved')::boolean, true, 'with the moved mark');
select test.eq((current_setting('t.row')::jsonb ->> 'moved_from'), '2026-09-02', 'saying where it was');
select test.eq((current_setting('t.row')::jsonb ->> 'moved_by'), current_setting('t.mgr'), 'who moved it');
select test.eq((current_setting('t.row')::jsonb ->> 'move_reason'), 'Signed in August, made up', 'and why');
select test.eq((api.achievements(jsonb_build_object('month', '2026-08')) ->> 'total')::int, 1, 'August counts it now');
select test.eq((api.achievements(jsonb_build_object('month', '2026-09')) ->> 'total')::int, 0, 'September no longer');

-- an Unknown owner: past work only
select test.as_owner();
select test.raises(format($$update perf.achievement set owner_id = null where id = %L$$, current_setting('t.a')),
  'P0001', 'live work always has an owner (V491)', 'achievement.owner_required');
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.b', (api.backfill_achievements(jsonb_build_object('mode', 'achievements', 'origin', 'backfill',
  'source', jsonb_build_object('kind', 'bd_monthly', 'period', '2026-02', 'last_day', '2026-02-28'),
  'rows', jsonb_build_array(jsonb_build_object('title', 'Made-up February award', 'kind', 'AWARD',
                                               'owner_unknown', true, 'import_key', 'made-up-owner-1'))))
  -> 'ids' ->> 0), true);
select test.eq((api.achievements(jsonb_build_object('needs_owner', true)) ->> 'total')::int, 1,
  'backfilled work may wait for its owner');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.achievements_assign(array[%L]::uuid[], %L)', current_setting('t.b'),
  current_setting('t.am1')), '42501', 'a member does not assign it', 'access.needs_level');
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.as', api.achievements_assign(array[current_setting('t.b')::uuid], current_setting('t.am1')::uuid)::text,
  true);
select test.eq((api.achievement(current_setting('t.b')::uuid) ->> 'owner_id'), current_setting('t.am1'),
  'a manager gives it its owner');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification
                where request_id = (current_setting('t.as')::jsonb ->> 'request_id')::uuid), 0, 'telling nobody (V491)');
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.as')::jsonb ->> 'request_id'), 'one Undo');
select test.eq((api.achievements(jsonb_build_object('needs_owner', true)) ->> 'total')::int, 1, 'and it is Unknown again');
