-- Sabotage: my-day-lists-no-tasks
-- Breaks: sql:LINK-01
-- Expect: my open tasks to Saturday
-- My day shows notes only: a task due today never comes back on it (sweep 12 Oct, D3).
create or replace function my.my_tasks(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select '[]'::jsonb where false union all select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', t.id, 'number', t.number, 'title', t.title, 'due_on', t.due_on, 'partner_id', t.partner_id,
           'partner_name', p.trade_name_en, 'project_id', t.project_id, 'status_id', t.status_id,
           'group', case when t.due_on < d.today then 'overdue' when t.due_on = d.today then 'today' else 'this_week' end)
           order by t.due_on, t.number), '[]'::jsonb)
  from (select core.riyadh_today() as today) d
  join work.task t on t.owner_id = p_person and t.deleted_at is null and t.closed_at is null and t.due_on is not null
                  and t.due_on <= d.today + (6 - extract(dow from d.today))::int
  left join partner.partner p on p.id = t.partner_id
  where false and not work.task_is_past(t)
$$;
