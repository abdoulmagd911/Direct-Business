-- STR-01 — the streak under "Today's three" (Landing 34): working days in a row on which the person finished at least
-- three of their OWN tasks. Friday and Saturday are stepped over (they neither add nor break); today does not break a
-- streak while it is short of three; a removed task and another person's task do not count; a manager reads the
-- streaks of the people they manage and nobody else's. The clock is fixed (v2.test_now); every value is made up.
-- Sabotages: supabase/tests/sabotage/a-weekend-breaks-the-streak.sql, two-done-tasks-make-a-streak-day.sql,
-- an-unfinished-today-breaks-the-streak.sql, anyone-reads-the-teams-streaks.sql.
select set_config('v2.test_now', '2026-11-18 10:00:00+03', true);  -- a Wednesday
select set_config('t.mgr', test.person('Test Streak Manager', 'manager')::text, true);
select set_config('t.a', test.person('Test Streak Member', 'member')::text, true);
select set_config('t.b', test.person('Test Streak Other', 'member')::text, true);
select set_config('t.c', test.person('Test Streak Weekend', 'member')::text, true);
update core.person set manager_id = current_setting('t.mgr')::uuid where id = current_setting('t.a')::uuid;
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_streak', 'Test Streak Desk', 'فريق الاختبار');
update core.person set team_id = (select id from core.team where code = 'test_streak')
where id in (current_setting('t.mgr')::uuid, current_setting('t.a')::uuid, current_setting('t.b')::uuid,
             current_setting('t.c')::uuid);

-- n tasks of `p_owner`, finished on `p_day` (Riyadh noon)
create function pg_temp.finish(p_owner uuid, p_day date, p_n int) returns void language plpgsql as $$
declare
  v_id uuid;
begin
  for i in 1..p_n loop
    perform test.as_person(p_owner);
    v_id := (api.task_create(jsonb_build_object('title', 'Made-up streak task ' || p_day || ' ' || i,
              'owner_id', p_owner, 'work_type', 'internal')) ->> 'id')::uuid;
    perform api.task_status_set(v_id, 'done');
    perform test.act(p_owner);
    update work.task set closed_at = (p_day::text || ' 12:00:00+03')::timestamptz where id = v_id;
    perform test.done();
  end loop;
end $$;
grant execute on function pg_temp.finish(uuid, date, int) to public;

select test.as_person(current_setting('t.a')::uuid);
select test.eq((api.my_streak() ->> 'days')::int, 0, 'nothing finished: no streak');
select test.eq((api.my_streak() ->> 'target')::int, 3, 'the target is three');

select pg_temp.finish(current_setting('t.a')::uuid, '2026-11-17', 3);  -- Tuesday
select pg_temp.finish(current_setting('t.a')::uuid, '2026-11-16', 4);  -- Monday (more than three is still one day)
select test.as_person(current_setting('t.a')::uuid);
select test.eq((api.my_streak() ->> 'days')::int, 2, 'two days of three: a streak of 2, and today (still at 0) does not break it');
select test.eq(api.my_streak() ->> 'last_counted_on', '2026-11-17', 'the latest counted day is named');
select test.eq((api.my_streak() ->> 'today_counts')::boolean, false, 'today does not count yet');

select pg_temp.finish(current_setting('t.a')::uuid, '2026-11-15', 3);  -- Sunday
select pg_temp.finish(current_setting('t.a')::uuid, '2026-11-12', 3);  -- Thursday, across Friday and Saturday
select pg_temp.finish(current_setting('t.a')::uuid, '2026-11-14', 2);  -- Saturday: not a working day, and short of three
select pg_temp.finish(current_setting('t.a')::uuid, '2026-11-11', 2);  -- Wednesday: two is not three
select pg_temp.finish(current_setting('t.a')::uuid, '2026-11-10', 3);  -- Tuesday: beyond the break
select test.as_person(current_setting('t.a')::uuid);
select test.eq((api.my_streak() ->> 'days')::int, 4, 'Friday and Saturday do not break it, and a day of two ends it');
-- a Saturday with three done adds no day of its own
select pg_temp.finish(current_setting('t.c')::uuid, '2026-11-17', 3);
select pg_temp.finish(current_setting('t.c')::uuid, '2026-11-16', 3);
select pg_temp.finish(current_setting('t.c')::uuid, '2026-11-15', 3);
select pg_temp.finish(current_setting('t.c')::uuid, '2026-11-14', 3);
select test.as_person(current_setting('t.c')::uuid);
select test.eq((api.my_streak() ->> 'days')::int, 3, 'three done on a Saturday add no day to the streak');

select pg_temp.finish(current_setting('t.a')::uuid, '2026-11-18', 2);
select test.as_person(current_setting('t.a')::uuid);
select test.eq((api.my_streak() ->> 'days')::int, 4, 'two done today: the streak waits');
select test.eq((api.my_streak() ->> 'today_done')::int, 2, 'today''s count is told');
select pg_temp.finish(current_setting('t.a')::uuid, '2026-11-18', 1);
select test.as_person(current_setting('t.a')::uuid);
select test.eq((api.my_streak() ->> 'days')::int, 5, 'the third task today adds the day');
select test.eq((api.my_streak() ->> 'today_counts')::boolean, true, 'and today counts');

-- a removed task no longer counts
select test.act(current_setting('t.a')::uuid);
update work.task set deleted_at = core.clock(), deleted_by = current_setting('t.a')::uuid, delete_reason = 'made-up removal'
where id = (select id from work.task where owner_id = current_setting('t.a')::uuid
            and core.riyadh_day(closed_at) = '2026-11-18' order by number limit 1);
select test.done();
select test.as_person(current_setting('t.a')::uuid);
select test.eq((api.my_streak() ->> 'days')::int, 4, 'a removed task is not a finished one');

-- another person's work is not mine
select test.as_person(current_setting('t.b')::uuid);
select test.eq((api.my_streak() ->> 'days')::int, 0, 'someone else''s tasks make no streak of mine');
select test.eq(api.team_streaks(), '[]'::jsonb, 'a person who manages nobody reads no team streaks');

-- the manager reads the streaks of the people they manage, and only theirs
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(jsonb_array_length(api.team_streaks()), 1, 'the manager reads one person: the one they manage');
select test.eq(api.team_streaks() -> 0 ->> 'person_id', current_setting('t.a'), 'it is that person');
select test.eq((api.team_streaks() -> 0 ->> 'days')::int, 4, 'with that person''s streak');

-- on a Friday the streak stands as Thursday left it
select set_config('v2.test_now', '2026-11-20 10:00:00+03', true);  -- a Friday
select test.as_person(current_setting('t.a')::uuid);
select test.eq((api.my_streak() ->> 'days')::int, 0, 'Thursday had nothing: on Friday the streak is over');
select pg_temp.finish(current_setting('t.a')::uuid, '2026-11-19', 3);
select pg_temp.finish(current_setting('t.a')::uuid, '2026-11-18', 1);
select test.as_person(current_setting('t.a')::uuid);
select test.eq((api.my_streak() ->> 'days')::int, 6, 'with Thursday and Wednesday done, Friday reads the six working days before it');
select test.eq((api.my_streak() ->> 'today_counts')::boolean, false, 'a Friday itself never counts');

-- nobody signed in reads nothing
select test.as_auth(gen_random_uuid());
select test.raises('select api.my_streak()', '42501', 'a streak needs a signed-in person');
