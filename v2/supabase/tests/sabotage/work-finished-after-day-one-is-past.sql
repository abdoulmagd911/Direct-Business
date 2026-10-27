-- Sabotage: work-finished-after-day-one-is-past
-- Breaks: sql:PAST-03
-- Expect: a task of that day finished after day one stays live
-- QA-597: any closed task dated before day one is past work, however late it was finished.
create or replace function work.task_is_past(t work.task) returns boolean
language sql stable security definer set search_path = ''
as $$
  select t.origin = 'backfill'
      or (work.is_past(t.happened_on) and (t.closed_at is not null or t.owner_id is null))
$$;
