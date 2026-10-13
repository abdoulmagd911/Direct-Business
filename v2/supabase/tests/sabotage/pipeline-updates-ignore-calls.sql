-- Sabotage: pipeline-updates-ignore-calls
-- Breaks: sql:MSR-02
-- Expect: a logged call counts
-- Weekly pipeline updates count task updates only, never the calls logged (V63).
create or replace function measure.work_pipeline_updates_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                    p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'week'::text, null::uuid, p.id, w.ws,
         (select pg_catalog.count(*) from (
            select 1 from core.note n left join partner.activity_type ty on ty.id = n.activity_type_id
            where n.created_by = p.id and n.deleted_at is null and n.happened_on between w.ws and w.ws + 4
              and n.entity_table = 'work.task' and n.kind <> 'activity'
              and measure.on_record(n.happened_on, n.logged_at, false)
            union all
            select 1 from work.task_status_change c join work.task t on t.id = c.task_id
            where c.created_by = p.id and c.deleted_at is null and t.origin <> 'backfill'
              and c.happened_on between w.ws and w.ws + 4 and measure.on_record(c.happened_on, c.logged_at, false)) u)
         >= coalesce((p_params ->> 'weekly_target')::int,
                     (core.setting_at('work.pipeline_weekly_target', null, w.ws) #>> '{}')::int, 1)
  from core.person p cross join measure.weeks(p_from, p_to) w(ws)
  where p.kind = 'staff' and p.deleted_at is null and core.is_team_member(p.id)
    and coalesce(p_scope_kind, 'company') <> 'partner'
    and measure.in_scope(p_scope_kind, p_scope_id, p.id, p.team_id, p.department_id, null)
    and (p.joined_on is null or p.joined_on <= w.ws + 4) and (p.left_on is null or p.left_on >= w.ws)
  order by w.ws, p.id;
end
$$;
