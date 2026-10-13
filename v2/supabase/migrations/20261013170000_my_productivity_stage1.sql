-- Productivity Stage 1, the data side (the owner's priority; the Architect's contract of 13 Oct 16:30):
--  1. The Today read: api.my_day('me') gives my tasks — owned (the owner is the one assigned) — in three groups by Riyadh
--     day (D20): overdue (due before today), today, next (due in the next 7 days); the ones I help on apart; each row
--     with its client and how often it was carried over; and carried_over: what a wrap-up carried to today.
--  2. Wrap up v2, one door: api.wrap_up(items) — each {kind task|note, id, choice tomorrow|next_week|drop|done} — in one
--     request that one Undo takes back (V128). Tomorrow is the next working day (Sunday to Thursday); next week the first
--     working day of next week (the setting work.week_starts_on); drop cancels a task (its existing Cancelled status) and
--     marks a note done — nothing is deleted; done completes either. Every move is logged in my.carry with where it came
--     from and went to. Only the person's own items, under their own access; a private note stays its author's (V454).
--  3. Capture kinds: idea (a sticky marked as an idea) and reminder (a sticky with its reminder set at capture); private
--     stays the default.
-- Forward-only.

-- ================================================================ an idea is a sticky marked as one
alter table my.note add column idea boolean not null default false;

-- ================================================================ the log of every move (who, what, from, to, when)
create table my.carry (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references core.person (id),
  entity_table text not null check (entity_table in ('work.task', 'my.note')),
  entity_id uuid not null,
  choice text not null check (choice in ('tomorrow', 'next_week', 'drop', 'done')),
  wrapped_on date not null,                         -- the Riyadh day of the wrap-up
  carried_from date,                                -- the day the item stood on: a task's due day, a note's day
  carried_to date,                                  -- where it went: tomorrow or next week; none for drop and done
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint carry_moves_somewhere check ((choice in ('tomorrow', 'next_week')) = (carried_to is not null))
);
create index carry_item on my.carry (entity_table, entity_id, person_id) where deleted_at is null;
create index carry_person_day on my.carry (person_id, carried_to) where deleted_at is null;
alter table my.carry enable row level security;
select audit.track('my.carry'::regclass);
select core.index_foreign_keys('my');

-- A move is its person's alone, as their private notes are (V454).
create function my.carry_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from my.carry c where c.id = p_id and c.person_id = p_person) $$;

-- ================================================================ the days a move lands on
-- The first working day of the week after p_day, by the setting work.week_starts_on (Sunday unless changed); a
-- week starting on a Saturday or a Friday moves on to its first working day (V620, D20).
create function my.next_week_day(p_day date) returns date
language plpgsql stable security definer set search_path = ''
as $$
declare
  ws int := case coalesce(core.setting_at('work.week_starts_on', null, p_day) #>> '{}', 'sunday')
              when 'saturday' then 6 when 'monday' then 1 else 0 end;
  d date := p_day + (7 - ((pg_catalog.date_part('dow', p_day)::int - ws + 7) % 7));
begin
  while pg_catalog.date_part('isodow', d)::int in (5, 6) loop
    d := d + 1;
  end loop;
  return d;
end
$$;

-- How often a person carried an item over (tomorrow or next week).
create function my.carry_count(p_person uuid, p_table text, p_id uuid) returns int
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.count(*)::int from my.carry c
  where c.person_id = p_person and c.entity_table = p_table and c.entity_id = p_id and c.deleted_at is null
    and c.choice in ('tomorrow', 'next_week')
$$;

-- 1. My open tasks — owned (the owner is the one assigned) — by their Riyadh due day: overdue, today, next (the next 7
-- days); the ones I help on apart, in the group helping. Each with its client and how often I carried it over. Past work
-- never shows (V491).
create or replace function my.my_tasks(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', t.id, 'number', t.number, 'title', t.title, 'due_on', t.due_on, 'partner_id', t.partner_id,
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
  left join partner.partner p on p.id = t.partner_id
  where not work.task_is_past(t)
$$;

-- What a wrap-up carried to today and is still open: each with its kind, id and the day it came from.
create function my.carried_over(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'kind', case c.entity_table when 'work.task' then 'task' else 'note' end, 'id', c.entity_id,
           'from', c.carried_from, 'times', my.carry_count(p_person, c.entity_table, c.entity_id))
           order by c.entity_table, c.carried_from, c.entity_id), '[]'::jsonb)
  from (select distinct on (x.entity_table, x.entity_id) x.*
        from my.carry x
        where x.person_id = p_person and x.deleted_at is null
        order by x.entity_table, x.entity_id, x.created_at desc, x.id desc) c
  where c.carried_to = core.riyadh_today()
    and case c.entity_table
          when 'work.task' then exists (select 1 from work.task t where t.id = c.entity_id and t.deleted_at is null
                                          and t.closed_at is null and t.owner_id = p_person)
          else exists (select 1 from my.note n where n.id = c.entity_id and n.deleted_at is null and n.done_at is null
                         and n.person_id = p_person)
        end
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
            from my.note n where my.in_scope(n, scope, me)
            order by 2 desc, 3 desc, 4 limit lim offset off) y), '[]'::jsonb),
    'notes_total', (select pg_catalog.count(*)::int from my.note n where my.in_scope(n, scope, me)),
    'more', exists (select 1 from my.note n where my.in_scope(n, scope, me) offset off + lim),
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
               'text', r.text) order by r.remind_at, r.id)
      from (select * from core.reminder r0
            where r0.person_id = me and r0.deleted_at is null and r0.sent_at is null
            order by r0.remind_at, r0.id limit lim) r), '[]'::jsonb) else '[]'::jsonb end);
end
$$;

-- 2. Wrap up v2: one door for tasks and notes, one request, one Undo (V128).
create function my.wrap_up(p_items jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  today date := core.riyadh_today();
  it jsonb;
  ch text;
  t work.task;
  n my.note;
  dest date;
  out jsonb := '[]'::jsonb;
  req uuid;
begin
  if pg_catalog.jsonb_typeof(p_items) is distinct from 'array' or pg_catalog.jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  req := audit.begin('ui', 'day.wrapped_up', pg_catalog.jsonb_build_object('day', today,
                                                                           'count', pg_catalog.jsonb_array_length(p_items)));
  for it in select x from pg_catalog.jsonb_array_elements(p_items) x loop
    ch := it ->> 'choice';
    if ch is null or ch not in ('tomorrow', 'next_week', 'drop', 'done') then
      raise exception using errcode = 'P0001', message = 'wrap_up.choice_invalid', detail = coalesce(ch, '');
    end if;
    dest := case ch when 'tomorrow' then core.next_working_day(today) when 'next_week' then my.next_week_day(today) end;
    case it ->> 'kind'
      when 'task' then
        -- only my own open task, under my own access
        select * into t from work.task x where x.id = nullif(it ->> 'id', '')::uuid and x.deleted_at is null;
        if t.id is null or work.row_level('work.task', t.id, me) < 'view' then
          raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.task';
        end if;
        if t.owner_id is distinct from me then
          raise exception using errcode = '42501', message = 'wrap_up.not_yours', detail = t.id::text;
        end if;
        t := work.task_editable(t.id);
        if t.closed_at is not null then
          raise exception using errcode = 'P0001', message = 'wrap_up.not_open', detail = t.id::text;
        end if;
        insert into my.carry (person_id, entity_table, entity_id, choice, wrapped_on, carried_from, carried_to, created_by)
        values (me, 'work.task', t.id, ch, today, t.due_on, dest, me);
        if dest is not null then
          update work.task x set due_on = dest, updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
          where x.id = t.id;
        else
          perform work.task_status_set(t.id, case ch when 'done' then 'done' else 'cancelled' end);
        end if;
      when 'note' then
        n := my.note_mine(nullif(it ->> 'id', '')::uuid);
        if n.done_at is not null then
          raise exception using errcode = 'P0001', message = 'wrap_up.not_open', detail = n.id::text;
        end if;
        insert into my.carry (person_id, entity_table, entity_id, choice, wrapped_on, carried_from, carried_to, created_by)
        values (me, 'my.note', n.id, ch, today, coalesce(n.carried_to, n.happened_on), dest, me);
        update my.note x set carried_to = coalesce(dest, x.carried_to),
                             done_at = case when dest is null then core.clock() else x.done_at end,
                             updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
        where x.id = n.id;
      else
        raise exception using errcode = 'P0001', message = 'wrap_up.kind_invalid', detail = coalesce(it ->> 'kind', '');
    end case;
    out := out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('kind', it ->> 'kind', 'id', it ->> 'id',
                                                                             'choice', ch, 'carried_to', dest));
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('day', today, 'items', out, 'request_id', req);
end
$$;

create or replace function my.note_capture(p_kind text, p_values jsonb default null, p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  -- 3. an idea is a sticky marked as one; a reminder is a sticky with its reminder set at capture (Stage 1)
  kind text := case when p_kind in ('idea', 'reminder') then 'sticky' else p_kind end;
  at timestamptz := nullif(v ->> 'remind_at', '')::timestamptz;
  nid uuid;
  req uuid;
  what text;
begin
  if p_kind = 'reminder' and (at is null or at <= core.clock()) then
    raise exception using errcode = 'P0001', message = 'reminder.time_required';
  end if;
  if p_kind <> 'reminder' and v ? 'remind_at' then
    raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = 'remind_at';
  end if;
  v := v - 'remind_at';
  perform my.note_fields_check(v);
  req := audit.begin('ui', 'note.captured', pg_catalog.jsonb_build_object('kind', p_kind));
  perform audit.happened(nullif(v ->> 'happened_on', '')::date);
  begin
    insert into my.note (person_id, kind, idea, title, body, items, visibility, happened_on, meeting_partner_id, meeting_on)
    values (me, kind, p_kind = 'idea', nullif(pg_catalog.btrim(v ->> 'title'), ''), nullif(pg_catalog.btrim(v ->> 'body'), ''),
            my.items_clean(v -> 'items'), coalesce(nullif(v ->> 'visibility', ''), 'private'),
            coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today()),
            nullif(v ->> 'meeting_partner_id', '')::uuid, nullif(v ->> 'meeting_on', '')::date)
    returning id into nid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = my.note_refused(what);
  end;
  perform my.mentions_set(nid, p_mentions);
  if p_kind = 'reminder' then
    insert into core.reminder (person_id, note_id, remind_at, text)
    values (me, nid, at, pg_catalog.left(coalesce(nullif(pg_catalog.btrim(v ->> 'title'), ''), pg_catalog.btrim(v ->> 'body')), 500));
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'request_id', req);
end
$$;

create or replace function my.note_row(n my.note, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'idea', n.idea, 'title', n.title, 'body', n.body, 'items', n.items, 'visibility', n.visibility,
    'happened_on', n.happened_on, 'logged_at', n.logged_at, 'author_id', n.person_id, 'mine', n.person_id = p_reader,
    'meeting_partner', (select pg_catalog.jsonb_build_object('id', p.id, 'number', p.number, 'trade_name_en',
                                  p.trade_name_en, 'trade_name_ar', p.trade_name_ar)
                        from partner.partner p
                        where p.id = n.meeting_partner_id and authz.can_see_as(p_reader, 'partner.partner', p.id)),
    'meeting_on', n.meeting_on, 'finished_at', n.finished_at,
    'carried_to', n.carried_to, 'done_at', n.done_at, 'version', n.version,
    'mentions', coalesce((select pg_catalog.jsonb_agg(m.person_id order by m.created_at, m.person_id)
                          from my.note_mention m where m.note_id = n.id and m.deleted_at is null), '[]'::jsonb),
    'links', my.turned_into(n.id, p_reader))
$$;

create function api.wrap_up(p_items jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select my.wrap_up(p_items) $$;

grant execute on function my.wrap_up(jsonb) to authenticated;
grant execute on function api.wrap_up(jsonb) to authenticated;
