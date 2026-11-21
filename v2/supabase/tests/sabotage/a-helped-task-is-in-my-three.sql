-- Sabotage: a-helped-task-is-in-my-three
-- Breaks: sql:THREE-01
-- Expect: a task I only help on
-- A task the person only helps on is picked into their three.
create or replace function my.my_three(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  with mine as materialized (
    select t.id, t.number, t.title, t.due_on, t.partner_id, t.project_id, t.status_id, t.starred, d.today,
           case when t.starred then 'important'
                when t.due_on is not null and t.due_on between d.today and d.today + 2 then 'short'
                else 'maintenance' end as grp
    from (select core.riyadh_today() as today) d
    join work.task t on (t.owner_id = p_person or exists (select 1 from work.task_helper h where h.task_id = t.id and h.person_id = p_person and h.deleted_at is null)) and t.deleted_at is null and t.closed_at is null
    join work.task_status st on st.id = t.status_id and st.meaning not in ('done', 'cancelled')
    where not work.task_is_past(t)
  ), imp as materialized (
    select m.id, pg_catalog.row_number() over (order by case m.grp when 'important' then 0 when 'maintenance' then 1 else 2 end,
                                                      m.due_on nulls last, m.number, m.id) as rn
    from mine m
    order by rn limit 3
  ), sh as materialized (
    select m.id, pg_catalog.row_number() over (order by case when m.grp = 'short' then 0 when m.grp = 'important' then 4
                                                           when m.due_on > m.today then 1
                                                           when m.due_on is not null then 2 else 3 end,
                                                      m.due_on nulls last, m.number, m.id) as rn
    from mine m
    where m.id not in (select i.id from imp i)
    order by rn limit 3
  ), mt as materialized (
    select m.id, pg_catalog.row_number() over (order by case m.grp when 'maintenance' then 0 else 1 end,
                                                      m.due_on nulls last, m.number, m.id) as rn
    from mine m
    where m.id not in (select i.id from imp i) and m.id not in (select s.id from sh s)
    order by rn limit 3
  ), shown as (
    select i.id, 'important' as shown_in, i.rn from imp i
    union all select s.id, 'short', s.rn from sh s
    union all select x.id, 'maintenance', x.rn from mt x
  ), picked as (
    select s.shown_in, s.rn, pg_catalog.jsonb_build_object(
             'id', r.id, 'number', r.number, 'title', r.title, 'due_on', r.due_on, 'partner_id', p.id,
             'partner_name', p.trade_name_en, 'client', p.trade_name_en, 'project_id', r.project_id,
             'status_id', r.status_id, 'starred', r.starred,
             'open_action_items', (select pg_catalog.count(*)::int from work.action_item a
                                    where a.task_id = r.id and a.deleted_at is null and a.done_on is null),
             'role', 'owner',
             'group', case when r.due_on < r.today then 'overdue' when r.due_on = r.today then 'today' else 'next' end,
             'carried_over', my.carry_count(p_person, 'work.task', r.id)) as row
    from shown s
    join mine r on r.id = s.id
    left join partner.partner p on p.id = r.partner_id and authz.can_see_as(p_person, 'partner.partner', p.id)
  ), counted as (
    select coalesce(s.shown_in, m.grp) as grp from mine m left join shown s on s.id = m.id
  )
  select pg_catalog.jsonb_build_object(
    'important', coalesce((select pg_catalog.jsonb_agg(k.row order by k.rn) from picked k where k.shown_in = 'important'), '[]'::jsonb),
    'short', coalesce((select pg_catalog.jsonb_agg(k.row order by k.rn) from picked k where k.shown_in = 'short'), '[]'::jsonb),
    'maintenance', coalesce((select pg_catalog.jsonb_agg(k.row order by k.rn) from picked k where k.shown_in = 'maintenance'), '[]'::jsonb),
    'totals', pg_catalog.jsonb_build_object(
      'important', (select pg_catalog.count(*)::int from counted c where c.grp = 'important'),
      'short', (select pg_catalog.count(*)::int from counted c where c.grp = 'short'),
      'maintenance', (select pg_catalog.count(*)::int from counted c where c.grp = 'maintenance')))
$$;
