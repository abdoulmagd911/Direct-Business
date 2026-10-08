-- Sabotage: a-late-follow-up-counts-as-on-time
-- Breaks: sql:MSR-01
-- Expect: am1's follow-ups
-- An action item ticked after its due day counts as on time.
create or replace function measure.work_action_items_on_time_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                        p_from date, p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'work.action_item'::text, a.id, coalesce(a.owner_id, t.owner_id), a.due_on,
         a.done_on is not null
  from work.action_item a
  join work.task t on t.id = a.task_id
  join work.task_status s on s.id = t.status_id
  where a.deleted_at is null and t.deleted_at is null and s.meaning <> 'cancelled'
    and a.due_on between p_from and least(p_to, core.riyadh_today() - 1)
    and measure.in_scope(p_scope_kind, p_scope_id, coalesce(a.owner_id, t.owner_id), t.team_id, t.department_id,
                         t.partner_id)
  order by a.due_on, a.id;
end
$$;
