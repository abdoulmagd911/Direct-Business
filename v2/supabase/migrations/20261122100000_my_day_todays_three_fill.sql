-- Landing 35, item 4 (the owner's sweep of 21 Nov): "Today's three is never 3+3+3 … fix the picking so it draws from
-- each person's own open tasks and fills 3+3+3."
-- The rule of Landing 34b stays the first pick of each group — Important = starred; Short = not starred, due today
-- or within the next two days; Maintenance = the rest — and a group that holds fewer than three is now TOPPED UP
-- from the person's other own open tasks, so a person with nine or more open tasks always sees 3 + 3 + 3:
--   Important — starred first; then the rest-group tasks (the longest overdue first), then the short ones;
--   Short     — due today or within two days first; then the next due days ahead, then overdue, then undated
--                 (a starred task left over comes last);
--   Maintenance — the rest-group tasks left, by due day (no due day last), then number; then any other left over.
-- A task is in one group only. Same person, same day, same answer. Still only the person's OWN open tasks: never a
-- task they help on, never a done, cancelled, removed or past one.
-- Totals: every own open task is counted once — a shown task in the group it is shown in, a task not shown in the
-- group its rule names — so "N more in Tasks" stays true.
create or replace function my.my_three(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  with mine as materialized (
    select t.id, t.number, t.title, t.due_on, t.partner_id, t.project_id, t.status_id, t.starred, d.today,
           case when t.starred then 'important'
                when t.due_on is not null and t.due_on between d.today and d.today + 2 then 'short'
                else 'maintenance' end as grp
    from (select core.riyadh_today() as today) d
    join work.task t on t.owner_id = p_person and t.deleted_at is null and t.closed_at is null
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
revoke all on function my.my_three(uuid) from public;
