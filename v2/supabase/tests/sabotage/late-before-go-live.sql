-- Sabotage: late-before-go-live
-- Breaks: sql:DATE-02
-- Expect: before go-live nothing is late
-- Logged late is judged before go-live too.
create or replace function work.task_flags(t work.task) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'past_work', work.task_is_past(t),
    'needs_owner', t.owner_id is null,
    'overdue', not work.task_is_past(t) and t.due_on < core.riyadh_today() and s.meaning not in ('done', 'cancelled'),
    'stale', not work.task_is_past(t) and s.meaning = 'in_progress'
             and work.last_activity_on(t.id) < core.riyadh_today()
               - coalesce((core.setting_at('work.no_update_days', null, core.riyadh_today()) #>> '{}')::int, 7),
    'blocked', t.blocked_reason is not null,
    'logged_late', t.origin <> 'backfill' and core.riyadh_day(t.logged_at) - t.happened_on > 14,
    'backfilled', t.origin = 'backfill',
    'last_activity_on', work.last_activity_on(t.id))
  from work.task_status s where s.id = t.status_id
$$;
