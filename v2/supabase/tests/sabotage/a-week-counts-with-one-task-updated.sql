-- Sabotage: a-week-counts-with-one-task-updated
-- Breaks: sql:MSR-02
-- Expect: weekly updates: week A
-- A week counts when any one task in progress had an update, not every one (V42).
create or replace function measure.work_weekly_updates_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                  p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'week'::text, null::uuid, x.owner_id, x.ws, pg_catalog.bool_or(x.updated)
  from (
    select t.owner_id, w.ws, measure.task_updated(t.id, w.ws, w.ws + 4) as updated
    from work.task t cross join measure.weeks(p_from, p_to) w(ws)
    where t.deleted_at is null and t.owner_id is not null and t.happened_on <= w.ws + 4
      and measure.in_scope(p_scope_kind, p_scope_id, t.owner_id, t.team_id, t.department_id, t.partner_id)
      and measure.task_meaning_on(t.id, w.ws + 4) = 'in_progress'
  ) x
  group by x.owner_id, x.ws
  order by x.ws, x.owner_id;
end
$$;
