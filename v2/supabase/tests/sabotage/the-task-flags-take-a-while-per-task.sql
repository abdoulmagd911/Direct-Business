-- Sabotage: the-task-flags-take-a-while-per-task
-- Breaks: sql:SPD-03
-- Expect: every list answers in under 2 s with 150 tasks and 40 organisations
-- Working out when a task was last touched takes a hundredth of a second per task, so a list of 150 takes seconds.
create or replace function work.last_activity_on(p_task uuid) returns date
language plpgsql stable security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_sleep(0.01);
  return (
    select pg_catalog.max(d) from (
      select t.happened_on as d from work.task t where t.id = p_task
      union all select pg_catalog.max(n.happened_on) from core.note n
        where n.entity_table = 'work.task' and n.entity_id = p_task and n.deleted_at is null
      union all select pg_catalog.max(greatest(a.happened_on, a.done_on)) from work.action_item a
        where a.task_id = p_task and a.deleted_at is null
      union all select pg_catalog.max(c.happened_on) from work.task_status_change c
        where c.task_id = p_task and c.deleted_at is null) x);
end
$$;
