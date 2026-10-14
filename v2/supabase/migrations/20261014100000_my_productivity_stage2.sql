-- Productivity Stage 2, the data side (V632; the Architect's order of 13 Oct 20:00):
--  1. Reminders that alert at their time. A Reminder note keeps its time in core.reminder.remind_at (Stage 1); the job
--     that tells its person now runs every minute, not every five. api.reminders_due() is what the screen reads: my
--     reminders whose time has come and that I have not dismissed, and when my next one falls, so the screen wakes once
--     then (one timer per reminder, not polling). Dismiss is the existing mark-read; Later is api.reminder_move, which
--     sets the reminder again for a time still to come. The bell's Realtime subscription is given what it needs: a read
--     rule on notify.notification (a person reads only their own rows) and the table in the Realtime publication.
--  2. Follow-ups on a record. A follow-up is a task of the existing type Follow-up, so it shows in its assignee's Today
--     block with nothing new; it now says what it is about (a client, a task or an invoice). api.follow_up makes one in
--     one request; api.follow_ups lists the open ones on a record.
-- Privacy (V454): a follow-up is refused on a record its maker or its assignee cannot see, so no one learns of a record
-- through one; a reminder is its person's alone, admins included. Riyadh time (D20). Forward-only.

-- ================================================================ what a follow-up is about
alter table work.task add column about_table text check (about_table in ('partner.partner', 'work.task', 'finance.invoice'));
alter table work.task add column about_id uuid;
alter table work.task add constraint task_about_both check ((about_table is null) = (about_id is null));
alter table work.task add constraint task_about_not_itself check (about_table is distinct from 'work.task' or about_id <> id);
create index task_about on work.task (about_table, about_id) where deleted_at is null and about_id is not null;
comment on column work.task.about_table is 'What a follow-up is about (V632 Stage 2): a client, a task or an invoice.';

-- The record a follow-up is about, as the reader may see it: its entity key, id and label — or null when the reader
-- cannot see it (V454: nothing about a record leaks through a follow-up).
create function work.about_of(p_table text, p_id uuid, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when p_table is null or not authz.can_see_as(p_reader, p_table, p_id) then null
    else pg_catalog.jsonb_build_object(
      'entity', case p_table when 'partner.partner' then 'partner' when 'work.task' then 'task' else 'invoice' end,
      'id', p_id,
      'label', case p_table
        when 'partner.partner' then (select p.trade_name_en from partner.partner p where p.id = p_id)
        when 'work.task' then (select t.number || ' · ' || t.title from work.task t where t.id = p_id)
        else (select i.ref from finance.invoice i where i.id = p_id) end) end
$$;

-- ================================================================ make a follow-up on a record
-- A task of type Follow-up, due on the day given, for the assignee (me unless named), about the record. A client's
-- follow-up is that client's work; a task's follow-up carries the task's client or project; an invoice's is internal.
-- Its title is the record's label unless one is given. One request; Undo takes it back (V128).
create function work.follow_up(p_entity text, p_id uuid, p_due_on date, p_assignee uuid default null,
                               p_title text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'own');
  tbl text := case p_entity when 'partner' then 'partner.partner' when 'task' then 'work.task'
                            when 'invoice' then 'finance.invoice' end;
  who uuid := coalesce(p_assignee, me);
  about jsonb;
  pid uuid;
  prj uuid;
  v jsonb;
  res jsonb;
begin
  if tbl is null then
    raise exception using errcode = 'P0001', message = 'follow_up.entity_invalid', detail = p_entity;
  end if;
  if p_id is null or not authz.can_see_as(me, tbl, p_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = tbl;
  end if;
  if p_due_on is null then
    raise exception using errcode = 'P0001', message = 'follow_up.due_required';
  end if;
  if p_due_on < core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'follow_up.due_passed';
  end if;
  if who <> me and not authz.can_see_as(who, tbl, p_id) then
    raise exception using errcode = 'P0001', message = 'follow_up.assignee_cannot_see';
  end if;
  about := work.about_of(tbl, p_id, me);
  if tbl = 'partner.partner' then
    pid := p_id;
  elsif tbl = 'work.task' then
    select t.partner_id, t.project_id into pid, prj from work.task t where t.id = p_id;
  end if;
  v := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
         'title', pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_title), ''), about ->> 'label'), 300),
         'type', 'follow_up', 'due_on', p_due_on, 'owner_id', who, 'partner_id', pid, 'project_id', prj,
         'work_type', case when pid is null and prj is null then 'internal' else 'client' end));
  perform audit.begin('ui', 'task.follow_up_set', pg_catalog.jsonb_build_object('entity', p_entity));
  res := work.task_create(v);
  update work.task set about_table = tbl, about_id = p_id where id = (res ->> 'id')::uuid;
  perform audit.end();
  return res || pg_catalog.jsonb_build_object('about', about);
end
$$;
comment on function work.follow_up(text, uuid, date, uuid, text) is
  'A follow-up on a client, task or invoice (V632 Stage 2): a Follow-up task for its assignee, refused when either cannot see the record.';

-- The open follow-ups on one record, those the reader may see, by due day.
create function work.follow_ups(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  tbl text := case p_entity when 'partner' then 'partner.partner' when 'task' then 'work.task'
                            when 'invoice' then 'finance.invoice' end;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if tbl is null then
    raise exception using errcode = 'P0001', message = 'follow_up.entity_invalid', detail = p_entity;
  end if;
  if p_id is null or not authz.can_see_as(me, tbl, p_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = tbl;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', t.id, 'number', t.number, 'title', t.title, 'due_on', t.due_on, 'owner_id', t.owner_id,
             'owner_name_en', p.full_name_en, 'owner_name_ar', p.full_name_ar) order by t.due_on, t.number)
    from work.task t
    left join core.person p on p.id = t.owner_id
    where t.about_table = tbl and t.about_id = p_id and t.deleted_at is null and t.closed_at is null
      and work.row_level('work.task', t.id, me) >= 'view'), '[]'::jsonb);
end
$$;

-- ================================================================ reminders at their time
-- What the screen reads: my reminders whose time has come and whose alert I have not dismissed (nor snoozed until a
-- time still to come), and when my next reminder falls — the screen sets one timer for it. Mine alone (V454).
create function core.reminders_due() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return pg_catalog.jsonb_build_object(
    'due', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', r.id, 'note_id', r.note_id, 'text', r.text, 'remind_at', r.remind_at, 'notification_id', n.id)
               order by r.remind_at, r.id)
      from core.reminder r
      -- its alert still open: not dismissed, not snoozed past now (an earlier alert put away by Later never counts)
      join lateral (select x.id from notify.notification x
                    where x.person_id = me and x.entity_table = 'core.reminder' and x.entity_id = r.id
                      and x.read_at is null and (x.snoozed_until is null or x.snoozed_until <= core.clock())
                    order by x.created_at desc, x.id limit 1) n on true
      where r.person_id = me and r.deleted_at is null and r.sent_at is not null), '[]'::jsonb),
    'next_at', (select pg_catalog.min(r.remind_at) from core.reminder r
                where r.person_id = me and r.deleted_at is null and r.sent_at is null));
end
$$;

-- Later: my reminder set again for a time still to come — the job tells me then, and the alert I had is put away.
-- One request; Undo takes it back (V128). Someone else's reminder is not found (V454).
create function core.reminder_move(p_id uuid, p_at timestamptz) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  r core.reminder;
  req uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into r from core.reminder x where x.id = p_id and x.person_id = me and x.deleted_at is null for update;
  if r.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_at is null then
    raise exception using errcode = 'P0001', message = 'reminder.time_required';
  end if;
  if p_at <= core.clock() then
    raise exception using errcode = 'P0001', message = 'reminder.time_passed';
  end if;
  req := audit.begin('ui', 'reminder.moved', pg_catalog.jsonb_build_object('from', r.remind_at, 'to', p_at));
  update core.reminder set remind_at = p_at, sent_at = null where id = r.id;
  update notify.notification set read_at = core.clock()
  where person_id = me and entity_table = 'core.reminder' and entity_id = r.id and read_at is null;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', r.id, 'remind_at', p_at, 'request_id', req);
end
$$;

-- The job runs every minute, so a reminder is told within a minute of its time (V455's job, now at Stage 2's pace).
do $$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    perform cron.schedule('notify-send-reminders', '* * * * *', 'select notify.send_reminders()');
  end if;
end $$;

-- ================================================================ the bell, live (Realtime on my own notifications)
-- Realtime delivers a row to a signed-in person only when they may read it: a read rule, own rows only, and the table
-- in the publication where the stack has one (Supabase; not plain Postgres). Writes stay through the doors alone.
grant select on notify.notification to authenticated;
create policy notification_own on notify.notification for select to authenticated
  using (person_id = (select authz.me()));
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_catalog.pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'notify' and tablename = 'notification') then
    alter publication supabase_realtime add table notify.notification;
  end if;
end $$;

-- ================================================================ the Today block shows what a follow-up is about
create or replace function my.my_tasks(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', t.id, 'number', t.number, 'title', t.title, 'due_on', t.due_on, 'partner_id', t.partner_id,
           'partner_name', p.trade_name_en, 'client', p.trade_name_en, 'project_id', t.project_id, 'status_id', t.status_id,
           'role', case when t.owner_id = p_person then 'owner' else 'helper' end,
           'group', case when t.owner_id is distinct from p_person then 'helping'
                         when t.due_on < d.today then 'overdue' when t.due_on = d.today then 'today' else 'next' end,
           'carried_over', my.carry_count(p_person, 'work.task', t.id),
           'follow_up', t.about_id is not null, 'about', work.about_of(t.about_table, t.about_id, p_person))
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

-- ================================================================ the doors
create function api.follow_up(p_entity text, p_id uuid, p_due_on date, p_assignee uuid default null,
                              p_title text default null) returns jsonb
language sql security invoker set search_path = ''
as $$ select work.follow_up(p_entity, p_id, p_due_on, p_assignee, p_title) $$;
create function api.follow_ups(p_entity text, p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.follow_ups(p_entity, p_id) $$;
create function api.reminders_due() returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.reminders_due() $$;
create function api.reminder_move(p_id uuid, p_at timestamptz) returns jsonb
language sql security invoker set search_path = '' as $$ select core.reminder_move(p_id, p_at) $$;

grant execute on function work.follow_up(text, uuid, date, uuid, text), work.follow_ups(text, uuid),
  core.reminders_due(), core.reminder_move(uuid, timestamptz) to authenticated;
grant execute on function api.follow_up(text, uuid, date, uuid, text), api.follow_ups(text, uuid),
  api.reminders_due(), api.reminder_move(uuid, timestamptz) to authenticated;
