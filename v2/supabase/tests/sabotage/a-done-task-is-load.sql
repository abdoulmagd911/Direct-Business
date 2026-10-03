-- Sabotage: a-done-task-is-load
-- Breaks: sql:LOAD-01
-- Expect: done and past work are not load
-- Done and cancelled tasks count as open work.
create or replace function work.team_load(p_people uuid[] default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'view');
  today date := core.riyadh_today();
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'person_id', p.id, 'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
      'open_tasks', w.open_tasks, 'overdue', w.overdue,
      'open_action_items', (select pg_catalog.count(*)::int from work.action_item a join work.task t on t.id = a.task_id
                            where a.owner_id = p.id and a.deleted_at is null and a.done_on is null
                              and t.deleted_at is null and t.closed_at is null and not work.task_is_past(t)),
      'partners_owned', (select pg_catalog.count(distinct m.partner_id)::int from partner.side_owner m
                         join partner.partner x on x.id = m.partner_id
                         where m.person_id = p.id and m.side = 'client' and m.deleted_at is null
                           and m.effective_from <= today and (m.effective_to is null or m.effective_to > today)
                           and x.deleted_at is null and x.archived_at is null and partner.side_on(x.id, 'client')),
      'prospects_assigned', (select pg_catalog.count(distinct m.partner_id)::int from partner.side_owner m
                             join partner.partner x on x.id = m.partner_id
                             where m.person_id = p.id and m.deleted_at is null
                               and m.effective_from <= today and (m.effective_to is null or m.effective_to > today)
                               and x.deleted_at is null and x.archived_at is null and partner.side_on(x.id, m.side)
                               and partner.status_of(x.id, m.side, today) = 'prospect'))
      order by pg_catalog.lower(p.full_name_en))
    from core.person p
    cross join lateral (
      select pg_catalog.count(*)::int as open_tasks,
             (pg_catalog.count(*) filter (where t.due_on < today))::int as overdue
      from work.task t join work.task_status s on s.id = t.status_id
      where t.owner_id = p.id and t.deleted_at is null 
        and not work.task_is_past(t)) w
    where work.person_ok(p.id) and work.sees_department(me, p.department_id)
      and (p_people is null or p.id = any (p_people))), '[]'::jsonb);
end
$$;
