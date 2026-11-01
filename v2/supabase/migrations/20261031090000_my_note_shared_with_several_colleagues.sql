-- V524 (the Architect's order of 31 Oct): a note is shared with several named colleagues, not one (G, #342, shared
-- one). my.note.shared_with becomes a list of people; each of them, and only they, read the note (admins no more than
-- for a private note, V454), find it with their team's notes on My day and are told once in the bell when they are
-- added. The doors take shared_with as a list (one id alone is still read as a list of one). Choosing another visibility
-- stops the sharing. Functions replaced whole are as their newest migration left them but for the lines named.
-- Forward-only (V103).

alter table my.note drop constraint note_shared_with_one;
drop index my.note_shared_with;
alter table my.note drop constraint note_shared_with_fkey;
alter table my.note alter column shared_with type uuid[]
  using case when shared_with is null then null else array[shared_with] end;
create index note_shared_with on my.note using gin (shared_with);
comment on column my.note.shared_with is 'V524: the colleagues a note is shared with (visibility person).';
alter table my.note add constraint note_shared_with_one check (
  (visibility = 'person') = (coalesce(pg_catalog.cardinality(shared_with), 0) > 0)
  and not (person_id = any(coalesce(shared_with, '{}'))));

-- The list a door was given: an id or a list of ids, each once, in the order given; none is no list.
create function my.share_people(p jsonb) returns uuid[]
language plpgsql immutable set search_path = ''
as $$
declare
  out uuid[] := '{}';
  x jsonb;
  id uuid;
begin
  if p is null or p = 'null'::jsonb or p = '""'::jsonb then
    return null;
  end if;
  if pg_catalog.jsonb_typeof(p) = 'string' then
    p := pg_catalog.jsonb_build_array(p);
  end if;
  if pg_catalog.jsonb_typeof(p) <> 'array' then
    raise exception using errcode = 'P0001', message = 'note.share_needs_a_colleague';
  end if;
  for x in select e from pg_catalog.jsonb_array_elements(p) e loop
    if pg_catalog.jsonb_typeof(x) <> 'string' then
      raise exception using errcode = 'P0001', message = 'note.share_needs_a_colleague';
    end if;
    id := (x #>> '{}')::uuid;
    if not id = any(out) then
      out := out || id;
    end if;
  end loop;
  return nullif(out, '{}');
exception when invalid_text_representation then
  raise exception using errcode = 'P0001', message = 'note.share_needs_a_colleague';
end
$$;
revoke all on function my.share_people(jsonb) from public;

-- Tell each colleague a note was shared with, once: when they are new to its list.
create or replace function my.share_told(p_note uuid, p_was uuid[]) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n my.note;
  who uuid;
begin
  select * into n from my.note where id = p_note;
  for who in select x.id from pg_catalog.unnest(coalesce(n.shared_with, '{}')) with ordinality x(id, i)
             where not x.id = any(coalesce(p_was, '{}')) order by x.i loop
    perform notify.push(who, 'note_mention', 'my.note', n.id, 'notify.note_shared',
                        pg_catalog.jsonb_build_object('note_id', n.id, 'kind', n.kind, 'title', my.note_line(n)));
  end loop;
end
$$;
drop function my.share_told(uuid, uuid);
revoke all on function my.share_told(uuid, uuid[]) from public;

create or replace function my.note_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select n.person_id = p_person
        or (n.visibility in ('team', 'workspace') and n.deleted_at is null
            and exists (select 1 from core.person p
                        where p.id = p_person and p.kind = 'staff' and p.active and p.deleted_at is null)
            and (n.visibility = 'workspace'
                 or my.team_sees(n.person_id, p_person)
                 or exists (select 1 from core.person p join core.role r on r.id = p.role_id
                            where p.id = p_person and r.is_admin)))
        -- V524: shared with named colleagues, those colleagues alone read it (admins as for a private note: never)
        or (n.visibility = 'person' and p_person = any(n.shared_with) and n.deleted_at is null
            and exists (select 1 from core.person p
                        where p.id = p_person and p.kind = 'staff' and p.active and p.deleted_at is null))
    from my.note n where n.id = p_id), false)
$$;

create or replace function my.in_scope(n my.note, p_scope text, p_reader uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select n.deleted_at is null and n.done_at is null and coalesce(n.carried_to, n.happened_on) <= core.riyadh_today()
    and case p_scope
          when 'me' then n.person_id = p_reader
          when 'team' then n.person_id <> p_reader
                           and ((n.visibility = 'team'
                                 and (my.team_sees(n.person_id, p_reader)
                                      or exists (select 1 from core.person p join core.role r on r.id = p.role_id
                                                 where p.id = p_reader and r.is_admin)))
                                -- V524: a note shared with the reader by name sits with their team's notes
                                or (n.visibility = 'person' and p_reader = any(n.shared_with)))
          else n.person_id <> p_reader and n.visibility = 'workspace' end
    and my.note_visible(n.id, p_reader)
$$;

create or replace function my.note_fields_check(v jsonb) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  k text;
  pid uuid;
  them uuid[];
begin
  if pg_catalog.jsonb_typeof(v) <> 'object' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('title', 'body', 'items', 'visibility', 'shared_with', 'happened_on', 'meeting_partner_id',
                 'meeting_on') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  -- V524: each colleague a note is shared with is another active member of staff
  if v ? 'shared_with' then
    them := my.share_people(v -> 'shared_with');
    if exists (select 1 from pg_catalog.unnest(them) x(id)
               where x.id = authz.me() or not exists (
                 select 1 from core.person p where p.id = x.id and p.kind = 'staff' and p.active and p.deleted_at is null))
    then
      raise exception using errcode = 'P0001', message = 'note.share_needs_a_colleague';
    end if;
  end if;
  pid := nullif(v ->> 'meeting_partner_id', '')::uuid;
  if pid is not null and not authz.can_see_as(authz.me(), 'partner.partner', pid) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
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
                         about_table, about_id, shared_with)
    values (me, kind, p_kind = 'idea', nullif(pg_catalog.btrim(v ->> 'title'), ''), nullif(pg_catalog.btrim(v ->> 'body'), ''),
            my.items_clean(v -> 'items'), coalesce(nullif(v ->> 'visibility', ''), 'private'),
            coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today()),
            nullif(v ->> 'meeting_partner_id', '')::uuid, nullif(v ->> 'meeting_on', '')::date, ab_table, ab_id,
            my.share_people(v -> 'shared_with'))
    returning id into nid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = my.note_refused(what);
  end;
  perform my.mentions_set(nid, p_mentions);
  perform my.share_told(nid, null);
  if p_kind = 'reminder' then
    insert into core.reminder (person_id, note_id, remind_at, text)
    values (me, nid, at, pg_catalog.left(coalesce(nullif(pg_catalog.btrim(v ->> 'title'), ''), pg_catalog.btrim(v ->> 'body')), 500));
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'request_id', req);
end
$$;

create or replace function my.note_update(p_id uuid, p_values jsonb, p_version int, p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n my.note := my.note_mine(p_id);
  was uuid[] := n.shared_with;
  v jsonb := coalesce(p_values, '{}'::jsonb);
  req uuid;
  what text;
begin
  perform my.note_fields_check(v);
  perform core.check_version('my.note', p_id, p_version,
                             array(select pg_catalog.jsonb_object_keys(v) union select 'mentions' where p_mentions is not null));
  req := audit.begin('ui', 'note.updated', pg_catalog.jsonb_build_object('kind', n.kind));
  begin
    update my.note set
      title = case when v ? 'title' then nullif(pg_catalog.btrim(v ->> 'title'), '') else title end,
      body = case when v ? 'body' then nullif(pg_catalog.btrim(v ->> 'body'), '') else body end,
      items = case when v ? 'items' then my.items_clean(v -> 'items') else items end,
      visibility = case when v ? 'visibility' then coalesce(nullif(v ->> 'visibility', ''), 'private') else visibility end,
      -- V524: a note stops being shared with its colleagues as soon as it is no longer shared with named people
      shared_with = case when v ? 'shared_with' then my.share_people(v -> 'shared_with')
                         when v ? 'visibility' and coalesce(v ->> 'visibility', '') <> 'person' then null
                         else shared_with end,
      happened_on = case when v ? 'happened_on' then coalesce(nullif(v ->> 'happened_on', '')::date, happened_on)
                         else happened_on end,
      meeting_partner_id = case when v ? 'meeting_partner_id' then nullif(v ->> 'meeting_partner_id', '')::uuid
                                else meeting_partner_id end,
      meeting_on = case when v ? 'meeting_on' then nullif(v ->> 'meeting_on', '')::date else meeting_on end
    where id = p_id;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = my.note_refused(what);
  end;
  perform my.mentions_set(p_id, p_mentions);
  perform my.mentions_check(p_id);
  perform my.share_told(p_id, was);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req,
                                       'version', (select x.version from my.note x where x.id = p_id));
end
$$;

create or replace function my.note_row(n my.note, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'idea', n.idea, 'capture_kind', my.capture_kind(n), 'title', n.title, 'body', n.body, 'items', n.items, 'visibility', n.visibility, 'shared_with', coalesce(pg_catalog.to_jsonb(n.shared_with), '[]'::jsonb),
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
    'links', my.turned_into(n.id, p_reader),
    'task_items', (select pg_catalog.jsonb_build_object(
                     'done', pg_catalog.count(*) filter (where ai.done_on is not null), 'total', pg_catalog.count(*))
                   from my.note_link l
                   join work.action_item ai on ai.id = l.entity_id and ai.deleted_at is null
                   where l.note_id = n.id and l.entity_table = 'work.action_item' and l.deleted_at is null
                     and authz.can_see_as(p_reader, 'work.task', ai.task_id)
                   having pg_catalog.count(*) > 0))
$$;
