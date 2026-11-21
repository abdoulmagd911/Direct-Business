-- Sabotage: a-row-helper-is-planned-on-every-call
-- Breaks: sql:SPD-03
-- Expect: the helpers a list calls per row keep their plans: every one is plpgsql
-- work.last_activity_on is a SQL-language function again: Postgres plans its four lookups afresh for every task.
create or replace function work.last_activity_on(p_task uuid) returns date
language sql stable security definer set search_path = '' as $$
  select pg_catalog.max(d) from (
    select t.happened_on as d from work.task t where t.id = p_task
    union all select pg_catalog.max(n.happened_on) from core.note n
      where n.entity_table = 'work.task' and n.entity_id = p_task and n.deleted_at is null
    union all select pg_catalog.max(greatest(a.happened_on, a.done_on)) from work.action_item a
      where a.task_id = p_task and a.deleted_at is null
    union all select pg_catalog.max(c.happened_on) from work.task_status_change c
      where c.task_id = p_task and c.deleted_at is null) x
$$;
