-- Landing 34b (the owner's live check of Landing 34, 20 Nov) — Today's three follows its definition and stands still.
-- What was wrong: the screen picked the three groups out of the Today list (my.my_tasks), and that list only holds
-- tasks due within a week and starred ones. So an own task with no due day was in no group and nowhere on My day;
-- "Short" was "anything due up to two days ahead", which swept in tasks overdue since 2025; and a task whose status
-- said cancelled but whose closed stamp was empty still counted as open.
-- Now the database picks, from ALL the reader's own open tasks (never one they only help on):
--   Important   = starred;
--   Short       = not starred, due today or within the next two days;
--   Maintenance = the rest — overdue, due later, or with no due day.
-- "Open" = not removed, not closed, its status means neither done nor cancelled, not past work (V491).
-- Each group is in one fixed order — due day (no due day last), then number — and holds at most three; `totals`
-- says how many each group has in all. The same person asking twice gets the same answer.
-- 1. my.my_three(person) — the picker. 2. my.my_tasks — as 20261111000000, plus the status rule (nothing cancelled
-- or done shows as current in the Today block either). 3. my.my_day — as 20261113140000, plus the key `three` on Me.
-- No signature or grant change (my.my_three is called by my.my_day only). Forward-only (V103).
create function my.my_three(p_person uuid) returns jsonb
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
    where r.rn <= 3
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
revoke all on function my.my_three(uuid) from public;

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
           'carried_over', my.carry_count(p_person, 'work.task', t.id))
           order by t.owner_id is distinct from p_person, t.due_on, t.number), '[]'::jsonb)
  from (select core.riyadh_today() as today) d
  -- V661 (the Architect, 1 Nov): a starred task is on the Today list whatever its due day, undated included
  join work.task t on t.deleted_at is null and t.closed_at is null
                  and ((t.due_on is not null and t.due_on <= d.today + 7) or t.starred)
                  and (t.owner_id = p_person
                       or exists (select 1 from work.task_helper h
                                  where h.task_id = t.id and h.person_id = p_person and h.deleted_at is null))
  left join partner.partner p on p.id = t.partner_id and authz.can_see_as(p_person, 'partner.partner', p.id)
  -- Landing 34b: a task whose status means done or cancelled is not current, whatever its closed stamp says
  join work.task_status st on st.id = t.status_id and st.meaning not in ('done', 'cancelled')
  where not work.task_is_past(t)
$$;

create or replace function my.my_day(p_scope text default 'me', p_limit int default 7, p_offset int default 0,
                          p_since timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  scope text := coalesce(p_scope, 'me');
  lim int := greatest(1, least(coalesce(p_limit, 7), 200));
  off int := greatest(coalesce(p_offset, 0), 0);
begin
  if scope not in ('me', 'team', 'workspace') then
    raise exception using errcode = 'P0001', message = 'my_day.scope_invalid', detail = scope;
  end if;
  return pg_catalog.jsonb_build_object(
    'scope', scope, 'day', core.riyadh_today(),
    'notes', coalesce((
      select pg_catalog.jsonb_agg(my.note_row(y.n, me) order by y.d desc, y.at desc, y.id)
      from (select n as n, coalesce(n.carried_to, n.happened_on) as d, n.logged_at as at, n.id
            from my.note n where my.in_scope(n, scope, me) and not my.captured_as_reminder(n.id)
            order by 2 desc, 3 desc, 4 limit lim offset off) y), '[]'::jsonb),
    -- deferred: the same notes, a day still ahead — in_scope's own rule (who sees it), with the date flipped
    'deferred', coalesce((
      select pg_catalog.jsonb_agg(my.note_row(y.n, me) order by y.d desc, y.at desc, y.id)
      from (select n as n, coalesce(n.carried_to, n.happened_on) as d, n.logged_at as at, n.id
            from my.note n
            where n.deleted_at is null and n.done_at is null
              and coalesce(n.carried_to, n.happened_on) > core.riyadh_today()
              and not my.captured_as_reminder(n.id)
              and case scope
                    when 'me' then n.person_id = me
                    when 'team' then n.person_id <> me
                                     and ((n.visibility = 'team'
                                           and (my.team_sees(n.person_id, me)
                                                or exists (select 1 from core.person p join core.role r on r.id = p.role_id
                                                           where p.id = me and r.is_admin)))
                                          -- V524: a note shared with the reader by name sits with their team's notes
                                          or (n.visibility = 'person' and me = any(n.shared_with)))
                    else n.person_id <> me and n.visibility = 'workspace' end
              and my.note_visible(n.id, me)
            order by 2 desc, 3 desc, 4 limit lim) y), '[]'::jsonb),
    'notes_total', (select pg_catalog.count(*)::int from my.note n
                    where my.in_scope(n, scope, me) and not my.captured_as_reminder(n.id)),
    'more', exists (select 1 from my.note n
                    where my.in_scope(n, scope, me) and not my.captured_as_reminder(n.id) offset off + lim),
    'since', case when p_since is null then '[]'::jsonb else coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', x.kind, 'count', x.k) order by x.kind)
      from (select case n.visibility when 'team' then 'team_notes' when 'person' then 'shared_notes'
                                     else 'workspace_notes' end as kind,
                   pg_catalog.count(*)::int as k
            from my.note n
            where n.person_id <> me and n.visibility <> 'private' and n.logged_at > p_since
              and (my.in_scope(n, 'team', me) or my.in_scope(n, 'workspace', me))
            group by 1) x), '[]'::jsonb) end,
    -- D3: my open tasks by their Riyadh due day — Overdue, Today, This week (to Saturday) — past work never (V491)
    'tasks', case when scope = 'me' then my.my_tasks(me) else '[]'::jsonb end,
    -- Landing 34b: Today's three, picked by the database from ALL my own open tasks (my.my_three)
    'three', case when scope = 'me' then my.my_three(me) end,
    -- what a wrap-up carried to today (Stage 1)
    'carried_over', case when scope = 'me' then my.carried_over(me) else '[]'::jsonb end,
    'reminders', case when scope = 'me' then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', r.id, 'note_id', r.note_id, 'remind_at', r.remind_at,
               'text', r.text, 'about', (select work.about_of(n.about_table, n.about_id, me) from my.note n where n.id = r.note_id))
               order by r.remind_at, r.id)
      from (select * from core.reminder r0
            where r0.person_id = me and r0.deleted_at is null and r0.sent_at is null
            order by r0.remind_at, r0.id limit lim) r), '[]'::jsonb) else '[]'::jsonb end);
end
$$;
