-- Sabotage: stale-judged-on-the-logged-day
-- Breaks: sql:TSK-05
-- Expect: an update logged today about an old day does not freshen it
-- A note freshens a task by the day it was logged, not the day it happened (V400).
create or replace function work.last_activity_on(p_task uuid) returns date
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.max(d) from (
    select t.happened_on as d from work.task t where t.id = p_task
    union all select pg_catalog.max(core.riyadh_day(n.logged_at)) from core.note n
      where n.entity_table = 'work.task' and n.entity_id = p_task and n.deleted_at is null
    union all select pg_catalog.max(greatest(a.happened_on, a.done_on)) from work.action_item a
      where a.task_id = p_task and a.deleted_at is null
    union all select pg_catalog.max(c.happened_on) from work.task_status_change c
      where c.task_id = p_task and c.deleted_at is null) x
$$;
