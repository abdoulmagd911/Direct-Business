-- Sabotage: todays-three-holds-four
-- Breaks: sql:THREE-01
-- Expect: Maintenance is the rest of my own open tasks
-- A group holds four tasks.
create or replace function my.my_three(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select t.*, d.today,
           case when t.starred then 'important'
                when t.due_on is not null and t.due_on between d.today and d.today + 2 then 'short'
                else 'maintenance' end as grp
    from (select core.riyadh_today() as today) d
    join work.task t on t.owner_id = p_person and t.deleted_at is null and t.closed_at is null
    join work.task_status st on st.id = t.status_id and st.meaning not in ('done', 'cancelled')
    where not work.task_is_past(t)
  ), ranked as (
    select m.*, pg_catalog.row_number() over (partition by m.grp order by m.due_on nulls last, m.number, m.id) as rn
    from mine m
  ), picked as (
    select r.grp, r.rn, pg_catalog.jsonb_build_object(
             'id', r.id, 'number', r.number, 'title', r.title, 'due_on', r.due_on, 'partner_id', p.id,
             'partner_name', p.trade_name_en, 'client', p.trade_name_en, 'project_id', r.project_id,
             'status_id', r.status_id, 'starred', r.starred,
             'open_action_items', (select pg_catalog.count(*)::int from work.action_item a
                                    where a.task_id = r.id and a.deleted_at is null and a.done_on is null),
             'role', 'owner',
             'group', case when r.due_on < r.today then 'overdue' when r.due_on = r.today then 'today' else 'next' end,
             'carried_over', my.carry_count(p_person, 'work.task', r.id)) as row
    from ranked r
    left join partner.partner p on p.id = r.partner_id and authz.can_see_as(p_person, 'partner.partner', p.id)
    where r.rn <= 4
  )
  select pg_catalog.jsonb_build_object(
    'important', coalesce((select pg_catalog.jsonb_agg(k.row order by k.rn) from picked k where k.grp = 'important'), '[]'::jsonb),
    'short', coalesce((select pg_catalog.jsonb_agg(k.row order by k.rn) from picked k where k.grp = 'short'), '[]'::jsonb),
    'maintenance', coalesce((select pg_catalog.jsonb_agg(k.row order by k.rn) from picked k where k.grp = 'maintenance'), '[]'::jsonb),
    'totals', pg_catalog.jsonb_build_object(
      'important', (select pg_catalog.count(*)::int from mine m where m.grp = 'important'),
      'short', (select pg_catalog.count(*)::int from mine m where m.grp = 'short'),
      'maintenance', (select pg_catalog.count(*)::int from mine m where m.grp = 'maintenance')))
$$;
