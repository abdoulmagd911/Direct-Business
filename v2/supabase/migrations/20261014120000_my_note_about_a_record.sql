-- A follow-up is a private "Only me" Reminder note about a record (V632 Stage 2; the Architect's ruling of 14 Oct,
-- agreed with the oversight), not a department task:
--  1. A note may say what it is about: a client, a task or an invoice (my.note.about_table / about_id), set at capture
--     from {"about": {"entity": "partner"|"task"|"invoice", "id": …}} — refused when its author cannot see the record.
--  2. Every read of a note shows its record only to a reader who may see it (work.about_of, as for a task), so a note
--     shared with the team reveals no record to a colleague who may not see it (V454). My day's reminders and the due
--     reminders carry it too.
--  3. The task-based follow-up of the first Stage 2 PR goes: api.follow_up and api.follow_ups (and their work.* bodies)
--     are removed — nothing calls them (V633: no unused doors) — with the task columns they wrote and the follow-up keys
--     on My day's task rows.
-- Forward-only.

-- ================================================================ what a note is about
alter table my.note add column about_table text check (about_table in ('partner.partner', 'work.task', 'finance.invoice'));
alter table my.note add column about_id uuid;
alter table my.note add constraint note_about_both check ((about_table is null) = (about_id is null));
create index note_about on my.note (about_table, about_id) where deleted_at is null and about_id is not null;
comment on column my.note.about_table is 'What a note is about (a follow-up, V632 Stage 2): a client, a task or an invoice.';

-- ================================================================ the task-based follow-up goes
drop function api.follow_up(text, uuid, date, uuid, text);
drop function api.follow_ups(text, uuid);
drop function work.follow_up(text, uuid, date, uuid, text);
drop function work.follow_ups(text, uuid);
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

drop index work.task_about;
alter table work.task drop constraint task_about_not_itself;
alter table work.task drop constraint task_about_both;
alter table work.task drop column about_id;
alter table work.task drop column about_table;

-- ================================================================ capture: a note about a record
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
  ab jsonb := v -> 'about';
  ab_table text;
  ab_id uuid;
  req uuid;
  what text;
begin
  if p_kind = 'reminder' and (at is null or at <= core.clock()) then
    raise exception using errcode = 'P0001', message = 'reminder.time_required';
  end if;
  if p_kind <> 'reminder' and v ? 'remind_at' then
    raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = 'remind_at';
  end if;
  v := v - 'remind_at' - 'about';
  -- a follow-up: what the note is about, a record its author may see (V454)
  if ab is not null and ab <> 'null'::jsonb then
    ab_table := case ab ->> 'entity' when 'partner' then 'partner.partner' when 'task' then 'work.task'
                                      when 'invoice' then 'finance.invoice' end;
    if ab_table is null then
      raise exception using errcode = 'P0001', message = 'note.about_invalid', detail = ab ->> 'entity';
    end if;
    ab_id := nullif(ab ->> 'id', '')::uuid;
    if ab_id is null or not authz.can_see_as(me, ab_table, ab_id) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = ab_table;
    end if;
  end if;
  perform my.note_fields_check(v);
  req := audit.begin('ui', 'note.captured', pg_catalog.jsonb_build_object('kind', p_kind));
  perform audit.happened(nullif(v ->> 'happened_on', '')::date);
  begin
    insert into my.note (person_id, kind, idea, title, body, items, visibility, happened_on, meeting_partner_id, meeting_on,
                         about_table, about_id)
    values (me, kind, p_kind = 'idea', nullif(pg_catalog.btrim(v ->> 'title'), ''), nullif(pg_catalog.btrim(v ->> 'body'), ''),
            my.items_clean(v -> 'items'), coalesce(nullif(v ->> 'visibility', ''), 'private'),
            coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today()),
            nullif(v ->> 'meeting_partner_id', '')::uuid, nullif(v ->> 'meeting_on', '')::date, ab_table, ab_id)
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

-- ================================================================ every read shows the record only to who may see it
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
    'about', work.about_of(n.about_table, n.about_id, p_reader),
    'meeting_on', n.meeting_on, 'finished_at', n.finished_at,
    'carried_to', n.carried_to, 'done_at', n.done_at, 'version', n.version,
    'mentions', coalesce((select pg_catalog.jsonb_agg(m.person_id order by m.created_at, m.person_id)
                          from my.note_mention m where m.note_id = n.id and m.deleted_at is null), '[]'::jsonb),
    'links', my.turned_into(n.id, p_reader))
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
               'text', r.text, 'about', (select work.about_of(n.about_table, n.about_id, me) from my.note n where n.id = r.note_id))
               order by r.remind_at, r.id)
      from (select * from core.reminder r0
            where r0.person_id = me and r0.deleted_at is null and r0.sent_at is null
            order by r0.remind_at, r0.id limit lim) r), '[]'::jsonb) else '[]'::jsonb end);
end
$$;

create or replace function core.reminders_due() returns jsonb
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
               'id', r.id, 'note_id', r.note_id, 'text', r.text, 'remind_at', r.remind_at, 'notification_id', n.id,
               'about', (select work.about_of(x.about_table, x.about_id, me) from my.note x where x.id = r.note_id))
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

