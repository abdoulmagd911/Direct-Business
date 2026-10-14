-- A reminder, and so a follow-up, is one item, not two (the oversight's production walk of 14 Oct, finding 1; V632
-- Stage 2, V282). A Reminder is captured as a note that carries a reminder (Stage 1, #238): until now My day listed
-- that note among My notes as a plain Note ("Happened on …", no time) as well as under Reminders, so one Follow up
-- looked like two. From here:
--   1. My day's notes leave out a note that carries a reminder; it shows once, as its reminder, with its time and what
--      it is about. The note itself is unchanged and still opens on its own page.
--   2. api.my_follow_ups(entity, id): the reader's own open follow-ups on one record — a reminder still to come, or
--      told and not yet dismissed — for the record page to show (finding 4). Only the reader's own (V454): nobody else's
--      follow-ups, admins included, and nothing on a record the reader cannot see.
--   3. My day's task rows name their client only to a reader who may see it (finding 5: the row's client chip now opens
--      the client, so it must never name or link one the reader cannot open; V454).

-- ================================================================ a note that carries a reminder
create function my.has_reminder(p_note uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from core.reminder r where r.note_id = p_note and r.deleted_at is null) $$;
comment on function my.has_reminder(uuid) is
  'Whether a note carries a reminder: such a note is listed once, as its reminder, and not again among My notes.';

-- ================================================================ My day: a reminder once
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
            from my.note n where my.in_scope(n, scope, me) and not my.has_reminder(n.id)
            order by 2 desc, 3 desc, 4 limit lim offset off) y), '[]'::jsonb),
    'notes_total', (select pg_catalog.count(*)::int from my.note n
                    where my.in_scope(n, scope, me) and not my.has_reminder(n.id)),
    'more', exists (select 1 from my.note n
                    where my.in_scope(n, scope, me) and not my.has_reminder(n.id) offset off + lim),
    'since', case when p_since is null then '[]'::jsonb else coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', x.kind, 'count', x.k) order by x.kind)
      from (select case n.visibility when 'team' then 'team_notes' else 'workspace_notes' end as kind,
                   pg_catalog.count(*)::int as k
            from my.note n
            where n.person_id <> me and n.visibility <> 'private' and n.logged_at > p_since
              and (my.in_scope(n, 'team', me) or my.in_scope(n, 'workspace', me))
            group by 1) x), '[]'::jsonb) end,
    -- D3: my open tasks by their Riyadh due day — Overdue, Today, This week (to Saturday) — past work never (V491)
    'tasks', case when scope = 'me' then my.my_tasks(me) else '[]'::jsonb end,
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

-- ================================================================ My day's task rows: a client only if the reader may see it
create or replace function my.my_tasks(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', t.id, 'number', t.number, 'title', t.title, 'due_on', t.due_on, 'partner_id', p.id,
           'partner_name', p.trade_name_en, 'client', p.trade_name_en, 'project_id', t.project_id, 'status_id', t.status_id,
           'role', case when t.owner_id = p_person then 'owner' else 'helper' end,
           'group', case when t.owner_id is distinct from p_person then 'helping'
                         when t.due_on < d.today then 'overdue' when t.due_on = d.today then 'today' else 'next' end,
           'carried_over', my.carry_count(p_person, 'work.task', t.id))
           order by t.owner_id is distinct from p_person, t.due_on, t.number), '[]'::jsonb)
  from (select core.riyadh_today() as today) d
  join work.task t on t.deleted_at is null and t.closed_at is null and t.due_on is not null
                  and t.due_on <= d.today + 7
                  and (t.owner_id = p_person
                       or exists (select 1 from work.task_helper h
                                  where h.task_id = t.id and h.person_id = p_person and h.deleted_at is null))
  left join partner.partner p on p.id = t.partner_id and authz.can_see_as(p_person, 'partner.partner', p.id)
  where not work.task_is_past(t)
$$;

-- ================================================================ my follow-ups on a record
create function my.my_follow_ups(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  tbl text := case p_entity when 'partner' then 'partner.partner' when 'task' then 'work.task'
                            when 'invoice' then 'finance.invoice' end;
begin
  if tbl is null then
    raise exception using errcode = 'P0001', message = 'note.about_invalid', detail = p_entity;
  end if;
  if p_id is null or not authz.can_see_as(me, tbl, p_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = tbl;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', r.id, 'note_id', r.note_id, 'remind_at', r.remind_at, 'text', r.text,
             'told', r.sent_at is not null) order by r.remind_at, r.id)
    from my.note n
    join core.reminder r on r.note_id = n.id and r.deleted_at is null and r.person_id = me
    where n.person_id = me and n.deleted_at is null and n.about_table = tbl and n.about_id = p_id
      -- open: still to come, or told and its alert not yet dismissed (as core.reminders_due reads it)
      and (r.sent_at is null or exists (select 1 from notify.notification x
                                        where x.person_id = me and x.entity_table = 'core.reminder'
                                          and x.entity_id = r.id and x.read_at is null))), '[]'::jsonb);
end
$$;
comment on function my.my_follow_ups(text, uuid) is
  'The reader''s own open follow-ups on one record (V632 Stage 2): private to their author (V454), refused on a record the reader cannot see.';
create function api.my_follow_ups(p_entity text, p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select my.my_follow_ups(p_entity, p_id) $$;

grant execute on function my.my_follow_ups(text, uuid) to authenticated;
grant execute on function api.my_follow_ups(text, uuid) to authenticated;
