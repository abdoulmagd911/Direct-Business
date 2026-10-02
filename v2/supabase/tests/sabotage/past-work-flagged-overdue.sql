-- Sabotage: past-work-flagged-overdue
-- Breaks: sql:PAST-01
-- Expect: past its due day, it is not overdue
-- Past work is flagged overdue (V491 spares it).
create or replace function work.task_flags(t work.task) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'past_work', work.task_is_past(t),
    'needs_owner', t.owner_id is null,
    'overdue', t.due_on < core.riyadh_today() and s.meaning not in ('done', 'cancelled'),
    'stale', not work.task_is_past(t) and s.meaning = 'in_progress'
             and work.last_activity_on(t.id) < core.riyadh_today()
               - coalesce((core.setting_at('work.no_update_days', null, core.riyadh_today()) #>> '{}')::int, 7),
    'blocked', t.blocked_reason is not null,
    'logged_late', t.origin <> 'backfill' and core.logged_late(t.happened_on, t.logged_at),
    'backfilled', t.origin = 'backfill',
    'last_activity_on', work.last_activity_on(t.id))
  from work.task_status s where s.id = t.status_id
$$;
