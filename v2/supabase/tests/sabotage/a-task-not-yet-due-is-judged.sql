-- Sabotage: a-task-not-yet-due-is-judged
-- Breaks: sql:MSR-01
-- Expect: a task not yet due is not judged
-- A task whose due day has not come yet already counts against its owner.
create or replace function measure.work_tasks_on_time_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                 p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'work.task'::text, t.id, t.owner_id, t.due_on,
         coalesce(d.happened_on <= t.due_on and measure.on_record(d.happened_on, d.logged_at, t.origin = 'backfill'),
                  false)
  from work.task t
  join work.task_status s on s.id = t.status_id
  left join lateral (
    select c.happened_on, c.logged_at from work.task_status_change c join work.task_status cs on cs.id = c.to_status_id
    where c.task_id = t.id and c.deleted_at is null and cs.meaning = 'done'
    order by c.happened_on desc, c.logged_at desc limit 1) d on s.meaning = 'done'
  where t.deleted_at is null and s.meaning <> 'cancelled'
    and t.due_on between p_from and p_to
    and measure.in_scope(p_scope_kind, p_scope_id, t.owner_id, t.team_id, t.department_id, t.partner_id)
  order by t.due_on, t.id;
end
$$;
