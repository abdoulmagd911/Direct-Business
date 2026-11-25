-- Landing 53 — My day per the boards of the design session (Batch 1 English, Batch 2 Arabic).
-- Two things the boards draw that the reads did not carry. Nothing is stored; no signature or grant changes.
--
-- 1. A task finished today keeps its place in Today's three, ticked ("7 of 9 done today").
--    Until now a task left the three the moment it was done and another moved up, so the three could never read
--    as a day's list being worked down. The pick itself is the one of Landing 35 (20261122100000), word for word:
--    the same three rules, the same top-up, the same fixed order. It is only made over a wider set — my own open
--    tasks AND my own tasks done today (Riyadh's day). Finishing a task changes neither its star, its due day nor
--    its number, which are all the order looks at, so a task I tick stays in the very slot it was in; the others
--    do not move. The next day it is gone and the groups fill from the open tasks again. A cancelled task, a
--    removed one, one done on an earlier day, past work and a task I only help on are never there, as before.
--    Each row says `done`. Totals count every own OPEN task once plus the done ones that are shown, so
--    "N more in Tasks" still counts open tasks only.
-- 2. Every task row says its kind: the task's own type from the Settings list (work.task_type) — `type` (the key),
--    `type_en`, `type_ar`; all three null for a task with no type. In Today's three and in the Today list alike.
--
-- my.my_day is untouched: it calls these two. Forward-only (V103).
create or replace function my.my_three(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  with mine as materialized (
    select t.id, t.number, t.title, t.due_on, t.partner_id, t.project_id, t.status_id, t.starred, d.today,
           st.meaning = 'done' as done, ty.key as type_key, ty.name_en as type_en, ty.name_ar as type_ar,
           case when t.starred then 'important'
                when t.due_on is not null and t.due_on between d.today and d.today + 2 then 'short'
                else 'maintenance' end as grp
    from (select core.riyadh_today() as today) d
    join work.task t on t.owner_id = p_person and t.deleted_at is null
    join work.task_status st on st.id = t.status_id
    left join work.task_type ty on ty.id = t.type_id
    where not work.task_is_past(t)
      and ((t.closed_at is null and st.meaning not in ('done', 'cancelled'))
           -- done today: it keeps its place, ticked
           or (st.meaning = 'done' and t.closed_at is not null and core.riyadh_day(t.closed_at) = d.today))
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
             'carried_over', my.carry_count(p_person, 'work.task', r.id),
             'done', r.done, 'type', r.type_key, 'type_en', r.type_en, 'type_ar', r.type_ar) as row
    from shown s
    join mine r on r.id = s.id
    left join partner.partner p on p.id = r.partner_id and authz.can_see_as(p_person, 'partner.partner', p.id)
  ), counted as (
    -- every open task once; a done one only where it is shown
    select coalesce(s.shown_in, m.grp) as grp from mine m left join shown s on s.id = m.id
    where not m.done or s.id is not null
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

-- The Today list: as 20261121090000, plus the task's kind on every row.
create or replace function my.my_tasks(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', t.id, 'number', t.number, 'title', t.title, 'due_on', t.due_on, 'partner_id', p.id,
           'partner_name', p.trade_name_en, 'client', p.trade_name_en, 'project_id', t.project_id, 'status_id', t.status_id,
           'starred', t.starred,
           'open_action_items', (select pg_catalog.count(*)::int from work.action_item a
                                  where a.task_id = t.id and a.deleted_at is null and a.done_on is null),
           'role', case when t.owner_id = p_person then 'owner' else 'helper' end,
           'group', case when t.owner_id is distinct from p_person then 'helping'
                         when t.due_on < d.today then 'overdue' when t.due_on = d.today then 'today' else 'next' end,
           'carried_over', my.carry_count(p_person, 'work.task', t.id),
           'type', ty.key, 'type_en', ty.name_en, 'type_ar', ty.name_ar)
           order by t.owner_id is distinct from p_person, t.due_on, t.number), '[]'::jsonb)
  from (select core.riyadh_today() as today) d
  -- V661 (the Architect, 1 Nov): a starred task is on the Today list whatever its due day, undated included
  join work.task t on t.deleted_at is null and t.closed_at is null
                  and ((t.due_on is not null and t.due_on <= d.today + 7) or t.starred)
                  and (t.owner_id = p_person
                       or exists (select 1 from work.task_helper h
                                  where h.task_id = t.id and h.person_id = p_person and h.deleted_at is null))
  left join partner.partner p on p.id = t.partner_id and authz.can_see_as(p_person, 'partner.partner', p.id)
  left join work.task_type ty on ty.id = t.type_id
  -- Landing 34b: a task whose status means done or cancelled is not current, whatever its closed stamp says
  join work.task_status st on st.id = t.status_id and st.meaning not in ('done', 'cancelled')
  where not work.task_is_past(t)
$$;
