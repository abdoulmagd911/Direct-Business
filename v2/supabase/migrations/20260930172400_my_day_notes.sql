-- P3-13 · My day notes, the data (V433; TECH-SPEC §3.3a). A person's own captures — sticky, meeting, checklist —
-- private by default; Turn into a logged meeting or call, or a reminder, each one request with the two-way link and the
-- mentions carried over; Finish meeting; Wrap up today (convert, carry over, done); the Me · My team · Workspace scopes;
-- reminders sent by a five-minute job (V455). A private note is read by its author alone, admins included (V454).
-- V183–V188. Every function the Data API reaches is a security-invoker wrapper (V124). Forward-only (V103).

create schema my;   -- a person's own captures on My day (V433)
comment on schema my is 'A person''s own captures on My day (V433): notes, what they were turned into, their mentions.';
grant usage on schema my to authenticated;

-- ================================================================ a record type whose own rule alone decides (V454, V183)
-- "Admins see everything" (V143) has one exception: a private My day note is its author's alone. A record type marked
-- rule_only is seen exactly as its own visible rule says — no admin shortcut, no owners, no page level — so every
-- reader that already asks authz.can_see_as (history, the Activity page, Follow, notifications, search) keeps it hidden.
alter table core.entity add column rule_only boolean not null default false,
  add constraint entity_rule_only_has_rule check (not rule_only or visible is not null);
comment on column core.entity.rule_only is
  'Its own visible rule alone decides who sees a record: admins and owners included (V454, V183).';

-- authz.can_see_as as P3-6d wrote it, a rule_only record type asked first and alone.
create or replace function authz.can_see_as(p_person uuid, p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
  ok boolean;
begin
  select * into e from core.entity where table_name = p_table and active;
  if e.id is null or p_person is null then
    return false;
  end if;
  if e.rule_only then
    execute pg_catalog.format('select %s($1, $2)', pg_catalog.to_regprocedure(e.visible || '(uuid, uuid)')::regproc)
      into ok using p_id, p_person;
    return coalesce(ok, false);
  end if;
  if exists (select 1 from core.person p join core.role r on r.id = p.role_id
             where p.id = p_person and r.is_admin and p.active and p.can_sign_in and p.deleted_at is null) then
    return true;
  end if;
  if e.visible is not null then
    execute pg_catalog.format('select %s($1, $2)', pg_catalog.to_regprocedure(e.visible || '(uuid, uuid)')::regproc)
      into ok using p_id, p_person;
    if coalesce(ok, false) then
      return true;
    end if;
  end if;
  if p_person = any (core.owners_of(p_table, p_id)) then
    return true;
  end if;
  return not e.private and (e.page_key is not null or e.level is not null)
         and e.page_key is distinct from 'settings.profile'
         and authz.record_level(p_person, p_table, p_id) >= 'view';
end
$$;

-- ================================================================ the next working day (OLD-WRK-022)
-- The weekend is Friday and Saturday: the working day after a Thursday, a Friday or a Saturday is the Sunday.
create function core.next_working_day(p_day date) returns date
language sql immutable parallel safe set search_path = ''
as $$
  select p_day + case pg_catalog.date_part('isodow', p_day)::int when 4 then 3 when 5 then 2 else 1 end
$$;
grant execute on function core.next_working_day(date) to authenticated;

-- ================================================================ a note's rows (V433)
-- A checklist's rows, or a meeting's points: each its words, whether it is done, and optionally who owns it and by
-- when — the owner and the day Finish meeting gives an action item once tasks exist (P5-1).
create function my.items_ok(p jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p) = 'array' and pg_catalog.jsonb_array_length(p) <= 200
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(p) i
      where pg_catalog.jsonb_typeof(i) <> 'object'
         or exists (select 1 from pg_catalog.jsonb_object_keys(i) k where k not in ('text', 'done', 'owner_id', 'due_on'))
         or pg_catalog.jsonb_typeof(i -> 'text') is distinct from 'string'
         or pg_catalog.btrim(i ->> 'text') = '' or pg_catalog.length(i ->> 'text') > 500
         or pg_catalog.jsonb_typeof(coalesce(i -> 'done', 'false'::jsonb)) <> 'boolean'
         or (i ->> 'owner_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or (i ->> 'due_on') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
$$;

-- ================================================================ the tables (§3.3a)
create table my.note (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references core.person (id),                  -- the author
  kind text not null check (kind in ('sticky', 'meeting', 'checklist')),
  title text check (title is null or (pg_catalog.btrim(title) <> '' and pg_catalog.length(title) <= 200)),
  body text check (body is null or pg_catalog.length(body) <= 20000),
  items jsonb not null default '[]'::jsonb check (my.items_ok(items)),
  visibility text not null default 'private' check (visibility in ('private', 'team', 'workspace')),
  happened_on date not null default core.riyadh_today(),
  logged_at timestamptz not null default core.clock(),
  meeting_partner_id uuid references partner.partner (id),
  meeting_on date,
  finished_at timestamptz,                                               -- Finish meeting
  carried_to date,                                                       -- Wrap up today: carried over
  done_at timestamptz,                                                   -- Wrap up today: done
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint note_has_words check (pg_catalog.btrim(coalesce(title, '')) <> '' or pg_catalog.btrim(coalesce(body, '')) <> ''
                                   or pg_catalog.jsonb_array_length(items) > 0),
  constraint note_not_after_logged check (happened_on <= core.riyadh_day(logged_at)),
  constraint note_meeting_only check (kind = 'meeting'
                                      or (meeting_partner_id is null and meeting_on is null and finished_at is null)),
  constraint note_carried_forward check (carried_to is null or carried_to > happened_on)
);
create index note_mine on my.note (person_id, happened_on desc) where deleted_at is null and done_at is null;
create index note_shared on my.note (visibility, logged_at desc) where deleted_at is null and visibility <> 'private';
comment on table my.note is
  'A capture on My day (V433): sticky, meeting or checklist; private by default — its author''s alone, admins included (V454).';

-- The two-way link: the note "turned into" the record, the record "from note". It shows while both ends are live —
-- removing either record hides it and never removes the other, and Undo of the removal brings it back (V184); Undo of
-- the conversion removes the link with the record it made.
create table my.note_link (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references my.note (id),
  entity_table text not null,
  entity_id uuid not null,
  kind text not null default 'turned_into' check (kind in ('turned_into')),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,   -- Undo of a conversion
  unique (entity_table, entity_id)                                       -- a record comes from one note at most
);
create trigger entity_ref before insert or update of entity_table, entity_id on my.note_link
  for each row execute function core.entity_ref_guard();
comment on table my.note_link is 'What a note was turned into (V433); made_at and made_by are its created_at and created_by.';

-- Who a shared note @mentions: each is told once ('note_mention'). A private note mentions nobody (OLD-WRK-017/019).
create table my.note_mention (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references my.note (id),
  person_id uuid not null references core.person (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  unique (note_id, person_id)
);
comment on table my.note_mention is 'Who a shared My day note mentions (V433): each told once.';

-- A reminder: one 'reminder' notification to its person at its time, sent by the five-minute job (V455), once.
create table core.reminder (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references core.person (id),
  note_id uuid references my.note (id),
  remind_at timestamptz not null,
  text text not null check (pg_catalog.btrim(text) <> '' and pg_catalog.length(text) <= 500),
  sent_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create index reminder_due on core.reminder (remind_at) where sent_at is null and deleted_at is null;
comment on table core.reminder is 'A reminder to one person at its time (V433, V455): sent once by the five-minute job; its person''s alone.';

do $$
declare
  t text;
begin
  foreach t in array array['my.note', 'my.note_link', 'my.note_mention', 'core.reminder'] loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('my');
select core.index_foreign_keys('core');

-- ================================================================ who sees a note (V454, V143)
-- Private: its author. Team: its author, anyone whose home team is the author's, who helps that team or leads it, and
-- admins. Workspace: every active member of staff. A removed note: its author alone.
create function my.team_sees(p_author uuid, p_reader uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from core.person a join core.team t on t.id = a.team_id
    where a.id = p_author
      and (t.lead_person_id = p_reader
           or exists (select 1 from core.person r where r.id = p_reader and r.team_id = t.id)
           or exists (select 1 from core.person_team_assist x
                      where x.person_id = p_reader and x.team_id = t.id and x.deleted_at is null)))
$$;
create function my.note_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select n.person_id = p_person
        or (n.visibility <> 'private' and n.deleted_at is null
            and exists (select 1 from core.person p
                        where p.id = p_person and p.kind = 'staff' and p.active and p.deleted_at is null)
            and (n.visibility = 'workspace'
                 or my.team_sees(n.person_id, p_person)
                 or exists (select 1 from core.person p join core.role r on r.id = p.role_id
                            where p.id = p_person and r.is_admin)))
    from my.note n where n.id = p_id), false)
$$;
create function my.note_link_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select my.note_visible(l.note_id, p_person) from my.note_link l where l.id = p_id), false) $$;
create function my.note_mention_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select my.note_visible(m.note_id, p_person) from my.note_mention m where m.id = p_id), false) $$;
create function core.reminder_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select r.person_id = p_person from core.reminder r where r.id = p_id), false) $$;

-- Whether a record is live (not removed): the far end of a link.
create function core.record_live(p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  t regclass := pg_catalog.to_regclass(p_table);
  ok boolean;
begin
  if t is null then
    return false;
  end if;
  execute pg_catalog.format('select t.deleted_at is null from %s t where t.id = $1', t) into ok using p_id;
  return coalesce(ok, false);
end
$$;

-- ================================================================ reading a note
-- A note's words as one text: its title, its body, then its rows — what a logged call or meeting and a reminder carry.
create function my.note_text(n my.note) returns text
language sql stable set search_path = ''
as $$
  select pg_catalog.left(pg_catalog.concat_ws(E'\n', n.title, n.body,
    (select pg_catalog.string_agg('- ' || (i ->> 'text'), E'\n' order by o)
     from pg_catalog.jsonb_array_elements(n.items) with ordinality x(i, o))), 20000)
$$;

-- What a note was turned into, for one reader: the live records they may see, each as its chip reads it — an activity
-- with its organisation and type, a reminder with its time.
create function my.turned_into(p_note uuid, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'entity', case l.entity_table when 'core.note' then 'activity' when 'core.reminder' then 'reminder'
                                         else e.key end,
           'id', l.entity_id, 'made_at', l.created_at, 'made_by', l.created_by,
           'partner_id', a.entity_id, 'partner_name_en', p.trade_name_en, 'partner_name_ar', p.trade_name_ar,
           'type', t.key, 'type_en', t.name_en, 'type_ar', t.name_ar, 'happened_on', a.happened_on,
           'remind_at', r.remind_at, 'sent_at', r.sent_at) order by l.created_at, l.id), '[]'::jsonb)
  from my.note_link l
  join core.entity e on e.table_name = l.entity_table
  left join core.note a on l.entity_table = 'core.note' and a.id = l.entity_id
  left join partner.partner p on a.entity_table = 'partner.partner' and p.id = a.entity_id
  left join partner.activity_type t on t.id = a.activity_type_id
  left join core.reminder r on l.entity_table = 'core.reminder' and r.id = l.entity_id
  where l.note_id = p_note and l.deleted_at is null and core.record_live(l.entity_table, l.entity_id)
    and authz.can_see_as(p_reader, l.entity_table, l.entity_id)
$$;

-- The note a record came from, for one reader — null for one who may not see it, while both are live (V454: a record
-- made from a private note hides its "from note" chip from anyone who cannot see the note).
create function my.from_note(p_table text, p_id uuid, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'author_id', n.person_id,
                                       'made_at', l.created_at)
  from my.note_link l join my.note n on n.id = l.note_id
  where l.entity_table = p_table and l.entity_id = p_id and l.deleted_at is null and n.deleted_at is null
    and core.record_live(p_table, p_id)
    and my.note_visible(n.id, p_reader)
$$;

create function my.note_row(n my.note, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body, 'items', n.items, 'visibility', n.visibility,
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

-- ================================================================ checks every door shares
create function my.note_refused(p_constraint text) returns text
language sql immutable set search_path = ''
as $$
  select case p_constraint
    when 'note_kind_check' then 'note.kind_invalid'
    when 'note_title_check' then 'note.title_invalid'
    when 'note_body_check' then 'note.body_too_long'
    when 'note_items_check' then 'note.items_invalid'
    when 'note_visibility_check' then 'note.visibility_invalid'
    when 'note_has_words' then 'note.body_required'
    when 'note_not_after_logged' then 'common.date_in_future'
    when 'note_meeting_only' then 'note.meeting_fields_on_a_meeting'
    when 'note_carried_forward' then 'note.carried_forward'
    when 'reminder_text_check' then 'reminder.text_invalid'
    else 'common.invalid' end
$$;

-- A note's rows as saved: the words trimmed, done false unless said, an owner who can work here, a real day.
create function my.items_clean(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  i jsonb;
  who uuid;
  out jsonb := '[]'::jsonb;
begin
  if p is null or pg_catalog.jsonb_typeof(p) = 'null' then
    return out;
  end if;
  if not my.items_ok(p) then
    raise exception using errcode = 'P0001', message = 'note.items_invalid';
  end if;
  for i in select x from pg_catalog.jsonb_array_elements(p) x loop
    who := nullif(i ->> 'owner_id', '')::uuid;
    if who is not null and not core.person_available(who) then
      raise exception using errcode = 'P0001', message = 'person.unavailable', detail = who::text;
    end if;
    out := out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'text', pg_catalog.btrim(i ->> 'text'), 'done', coalesce((i ->> 'done')::boolean, false), 'owner_id', who,
      'due_on', (i ->> 'due_on')::date));
  end loop;
  return out;
end
$$;

-- Only its author changes a note; to anyone who cannot see it, it does not exist.
create function my.note_mine(p_id uuid) returns my.note
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  n my.note;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into n from my.note where id = p_id and deleted_at is null;
  if n.id is null or not my.note_visible(p_id, me) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if n.person_id <> me then
    raise exception using errcode = '42501', message = 'note.not_yours';
  end if;
  return n;
end
$$;

-- The fields a capture or an edit may set.
create function my.note_fields_check(v jsonb) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  k text;
  pid uuid;
begin
  if pg_catalog.jsonb_typeof(v) <> 'object' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('title', 'body', 'items', 'visibility', 'happened_on', 'meeting_partner_id', 'meeting_on') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  pid := nullif(v ->> 'meeting_partner_id', '')::uuid;
  if pid is not null and not authz.can_see_as(authz.me(), 'partner.partner', pid) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
end
$$;

-- A note's mentions become exactly `p_people` (null: left as they are): the ones dropped are removed, each new one —
-- who must be able to work here and to see the note — is told once. A private note mentions nobody.
create function my.mentions_set(p_note uuid, p_people uuid[]) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n my.note;
  who uuid;
  k int := 0;
begin
  if p_people is null then
    return 0;
  end if;
  select * into n from my.note where id = p_note;
  update my.note_mention set deleted_at = core.clock(), deleted_by = authz.me()
  where note_id = p_note and deleted_at is null and not (person_id = any (p_people));
  foreach who in array p_people loop
    continue when who is null or who = n.person_id;
    if exists (select 1 from my.note_mention m where m.note_id = p_note and m.person_id = who and m.deleted_at is null) then
      continue;
    end if;
    if n.visibility = 'private' then
      raise exception using errcode = 'P0001', message = 'note.private_mentions_nobody';
    end if;
    if not exists (select 1 from core.person p where p.id = who and p.kind = 'staff' and p.active and p.deleted_at is null) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = who::text;
    end if;
    if not core.person_available(who) then
      raise exception using errcode = 'P0001', message = 'person.unavailable', detail = who::text;
    end if;
    if not my.note_visible(p_note, who) then
      raise exception using errcode = 'P0001', message = 'note.mention_cannot_see', detail = who::text;
    end if;
    insert into my.note_mention (note_id, person_id) values (p_note, who)
    on conflict (note_id, person_id) do update set deleted_at = null, deleted_by = null, delete_reason = null;
    perform notify.push(who, 'note_mention', 'my.note', p_note, 'notify.note_mention',
                        pg_catalog.jsonb_build_object('note_id', p_note, 'kind', n.kind));
    k := k + 1;
  end loop;
  return k;
end
$$;

-- After an edit, everyone still mentioned can still see the note: made private, or shared more narrowly, while someone
-- is mentioned who would lose it — refused.
create function my.mentions_check(p_note uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  who uuid;
begin
  select m.person_id into who from my.note_mention m join my.note n on n.id = m.note_id
  where m.note_id = p_note and m.deleted_at is null and (n.visibility = 'private' or not my.note_visible(p_note, m.person_id))
  limit 1;
  if who is not null then
    raise exception using errcode = 'P0001', message = 'note.mention_cannot_see', detail = who::text;
  end if;
end
$$;

-- ================================================================ Capture, edit, remove (§3.3a)
create function my.note_capture(p_kind text, p_values jsonb default null, p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  nid uuid;
  req uuid;
  what text;
begin
  perform my.note_fields_check(v);
  req := audit.begin('ui', 'note.captured', pg_catalog.jsonb_build_object('kind', p_kind));
  perform audit.happened(nullif(v ->> 'happened_on', '')::date);
  begin
    insert into my.note (person_id, kind, title, body, items, visibility, happened_on, meeting_partner_id, meeting_on)
    values (me, p_kind, nullif(pg_catalog.btrim(v ->> 'title'), ''), nullif(pg_catalog.btrim(v ->> 'body'), ''),
            my.items_clean(v -> 'items'), coalesce(nullif(v ->> 'visibility', ''), 'private'),
            coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today()),
            nullif(v ->> 'meeting_partner_id', '')::uuid, nullif(v ->> 'meeting_on', '')::date)
    returning id into nid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = my.note_refused(what);
  end;
  perform my.mentions_set(nid, p_mentions);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'request_id', req);
end
$$;

-- Only its author edits a note: its words, rows, who sees it, its day, its meeting; its mentions become `p_mentions`.
create function my.note_update(p_id uuid, p_values jsonb, p_version int, p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n my.note := my.note_mine(p_id);
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
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req,
                                       'version', (select x.version from my.note x where x.id = p_id));
end
$$;

-- Its author removes a note; what it was turned into stays (its link hides), and Undo brings the note back.
create function my.my_notes_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  i uuid;
  req uuid;
  k int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  foreach i in array p_ids loop
    perform my.note_mine(i);
  end loop;
  req := audit.begin('ui', 'note.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update my.note set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- ================================================================ Turn into (§3.3a)
-- Inside an open request: the new record through its own door, the link, the mentions carried over. A logged meeting or
-- call and a reminder now; a task and an action item arrive with P5-1, an achievement with P5-4 (note.turn_into_not_yet).
create function my.turn_into_inner(n my.note, p_kind text, p_values jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  v jsonb := coalesce(p_values, '{}'::jsonb);
  pid uuid;
  carried uuid[];
  left_out uuid[];
  a jsonb;
  rid uuid;
  at timestamptz;
  words text;
  what text;
  t text := coalesce(nullif(v ->> 'type', ''), case when n.kind = 'meeting' then 'meeting' else 'call' end);
begin
  if p_kind = 'activity' then
    if t not in ('call', 'meeting') then
      raise exception using errcode = 'P0001', message = 'note.turn_into_type_invalid', detail = t;
    end if;
    pid := coalesce(nullif(v ->> 'partner_id', '')::uuid, n.meeting_partner_id);
    if pid is null then
      raise exception using errcode = 'P0001', message = 'note.turn_into_needs_partner';
    end if;
    select pg_catalog.array_agg(m.person_id order by m.created_at, m.person_id)
             filter (where authz.can_see_as(m.person_id, 'partner.partner', pid) and core.person_available(m.person_id)),
           pg_catalog.array_agg(m.person_id order by m.created_at, m.person_id)
             filter (where not (authz.can_see_as(m.person_id, 'partner.partner', pid) and core.person_available(m.person_id)))
      into carried, left_out
    from my.note_mention m where m.note_id = n.id and m.deleted_at is null;
    a := partner.activity_log(pid, t, nullif(v ->> 'outcome', ''),
                              coalesce(nullif(v ->> 'happened_on', '')::date,
                                       case when t = 'meeting' then n.meeting_on end, n.happened_on),
                              coalesce(nullif(pg_catalog.btrim(v ->> 'body'), ''), my.note_text(n)),
                              nullif(v ->> 'next_step', ''), nullif(v ->> 'next_step_on', '')::date, carried);
    insert into my.note_link (note_id, entity_table, entity_id) values (n.id, 'core.note', (a ->> 'id')::uuid);
    return a || pg_catalog.jsonb_build_object('entity', 'activity', 'type', t, 'partner_id', pid,
                                              'mentions_left_out', coalesce(pg_catalog.to_jsonb(left_out), '[]'::jsonb));
  elsif p_kind = 'reminder' then
    at := nullif(v ->> 'remind_at', '')::timestamptz;
    if at is null then
      raise exception using errcode = 'P0001', message = 'reminder.time_required';
    end if;
    if at <= core.clock() then
      raise exception using errcode = 'P0001', message = 'reminder.time_passed';
    end if;
    words := coalesce(nullif(pg_catalog.btrim(v ->> 'text'), ''), pg_catalog.left(pg_catalog.btrim(my.note_text(n)), 500));
    begin
      insert into core.reminder (person_id, note_id, remind_at, text) values (me, n.id, at, words) returning id into rid;
    exception when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = my.note_refused(what);
    end;
    insert into my.note_link (note_id, entity_table, entity_id) values (n.id, 'core.reminder', rid);
    return pg_catalog.jsonb_build_object('id', rid, 'entity', 'reminder', 'remind_at', at);
  elsif p_kind in ('task', 'action_item', 'achievement') then
    raise exception using errcode = 'P0001', message = 'note.turn_into_not_yet', detail = p_kind;
  end if;
  raise exception using errcode = 'P0001', message = 'note.turn_into_invalid', detail = p_kind;
end
$$;

-- One request: the record, the link and the mentions; one Undo reverts them all. Logged under the made record's own
-- words (a logged call reads as one), so nobody learns of a note they may not see.
create function my.note_turn_into(p_note uuid, p_kind text, p_values jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n my.note := my.note_mine(p_note);
  req uuid;
  r jsonb;
begin
  req := audit.begin('ui', case when p_kind = 'activity' then 'partner.activity_logged' else 'reminder.set' end,
                     pg_catalog.jsonb_build_object('kind', p_kind));
  r := my.turn_into_inner(n, p_kind, p_values);
  perform audit.end();
  return r || pg_catalog.jsonb_build_object('note_id', p_note, 'request_id', req);
end
$$;

-- Finish meeting: the meeting is logged on its organisation (type meeting, held unless said), carrying the note's points
-- and mentions, and the note is marked finished — one request. Its points become action items once tasks exist (P5-1).
create function my.note_finish_meeting(p_note uuid, p_values jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n my.note := my.note_mine(p_note);
  v jsonb := coalesce(p_values, '{}'::jsonb);
  req uuid;
  a jsonb;
begin
  if n.kind <> 'meeting' then
    raise exception using errcode = 'P0001', message = 'note.not_a_meeting';
  end if;
  if n.finished_at is not null then
    raise exception using errcode = 'P0001', message = 'note.meeting_finished';
  end if;
  if coalesce(nullif(v ->> 'partner_id', '')::uuid, n.meeting_partner_id) is null then
    raise exception using errcode = 'P0001', message = 'note.meeting_needs_partner';
  end if;
  req := audit.begin('ui', 'partner.activity_logged', pg_catalog.jsonb_build_object('type', 'meeting'));
  a := my.turn_into_inner(n, 'activity', v || pg_catalog.jsonb_build_object('type', 'meeting',
                                                                            'outcome', coalesce(v ->> 'outcome', 'meeting_held')));
  update my.note set finished_at = core.clock() where id = p_note;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_note, 'activity_id', a ->> 'id', 'partner_id', a ->> 'partner_id',
    'points', pg_catalog.jsonb_array_length(n.items), 'mentions_left_out', a -> 'mentions_left_out', 'request_id', req);
end
$$;

-- ================================================================ Wrap up today (§3.3a)
-- The day's open captures (not done, and due on or before the day): each converted (then done), carried over to the next
-- working day — keeping the day it happened — or done. Nothing is deleted; one request.
create function my.note_wrap_up(p_day date, p_choices jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  day date := coalesce(p_day, core.riyadh_today());
  s jsonb;
  n my.note;
  req uuid;
  out jsonb := '[]'::jsonb;
  r jsonb;
begin
  if day > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'common.date_in_future';
  end if;
  if pg_catalog.jsonb_typeof(p_choices) is distinct from 'array' or pg_catalog.jsonb_array_length(p_choices) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  req := audit.begin('ui', 'note.wrapped_up',
                     pg_catalog.jsonb_build_object('day', day, 'count', pg_catalog.jsonb_array_length(p_choices)));
  for s in select x from pg_catalog.jsonb_array_elements(p_choices) x loop
    n := my.note_mine(nullif(s ->> 'note', '')::uuid);
    if n.done_at is not null or coalesce(n.carried_to, n.happened_on) > day then
      raise exception using errcode = 'P0001', message = 'note.not_open', detail = n.id::text;
    end if;
    case s ->> 'choice'
      when 'carry' then
        update my.note set carried_to = core.next_working_day(day) where id = n.id;
        r := pg_catalog.jsonb_build_object('note', n.id, 'choice', 'carry', 'carried_to', core.next_working_day(day));
      when 'done' then
        update my.note set done_at = core.clock() where id = n.id;
        r := pg_catalog.jsonb_build_object('note', n.id, 'choice', 'done');
      when 'turn_into' then
        r := my.turn_into_inner(n, s ->> 'kind', s -> 'values');
        update my.note set done_at = core.clock() where id = n.id;
        r := pg_catalog.jsonb_build_object('note', n.id, 'choice', 'turn_into', 'made', r);
      else
        raise exception using errcode = 'P0001', message = 'note.wrap_up_choice_invalid', detail = s ->> 'choice';
    end case;
    out := out || pg_catalog.jsonb_build_array(r);
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('day', day, 'choices', out, 'request_id', req);
end
$$;

-- ================================================================ reminders (V455)
-- Its person removes a reminder before it is sent; the note it came from stays.
create function core.reminders_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  req uuid;
  k int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if exists (select 1 from pg_catalog.unnest(p_ids) i(id)
             left join core.reminder r on r.id = i.id and r.deleted_at is null and r.person_id = me
             where r.id is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'reminder.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update core.reminder set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- The five-minute job: every reminder due by now and not yet sent tells its person once, then is marked sent — a run
-- missed or late sends it on the next run, and never twice.
create function notify.send_reminders() returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r core.reminder;
  k int := 0;
begin
  if not exists (select 1 from core.reminder x
                 where x.remind_at <= core.clock() and x.sent_at is null and x.deleted_at is null) then
    return 0;
  end if;
  perform audit.begin('job', 'reminder.sent');
  for r in select * from core.reminder x
           where x.remind_at <= core.clock() and x.sent_at is null and x.deleted_at is null
           order by x.remind_at, x.id for update skip locked loop
    perform notify.push(r.person_id, 'reminder', 'core.reminder', r.id, 'notify.reminder',
                        pg_catalog.jsonb_build_object('reminder_id', r.id, 'note_id', r.note_id, 'text', r.text,
                                                      'remind_at', r.remind_at));
    update core.reminder set sent_at = core.clock() where id = r.id;
    k := k + 1;
  end loop;
  perform audit.end();
  return k;
end
$$;
comment on function notify.send_reminders() is 'The reminder job (V455): every five minutes, each due reminder told once.';

-- Scheduled where pg_cron exists (the Supabase project and stack; not plain Postgres).
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('notify-send-reminders', '*/5 * * * *', 'select notify.send_reminders()');
  end if;
end $$;

-- ================================================================ the notices
alter table notify.notification drop constraint notification_kind_check;
alter table notify.notification add constraint notification_kind_check check (kind in (
  'assigned', 'helper_added', 'mentioned', 'changed_by_other', 'followed_change', 'decision_needed', 'report_issued',
  'report_for_review', 'appraisal_step', 'import_done', 'alert_contract_expiring', 'alert_kpi_behind',
  'alert_invoice_unpaid', 'alert_kpi_checkin', 'escalated', 'alert_quiet_client', 'alert_project_no_update',
  'alert_activity_stale', 'alert_file_review', 'reminder', 'note_mention'));

-- ================================================================ My day (§3.3a)
-- The scopes: Me (my open captures — not done, due today or before — and my reminders to come), My team (what my team
-- shares) and Workspace (what everyone shares), newest first, a page of rows with whether there is more.
create function my.in_scope(n my.note, p_scope text, p_reader uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select n.deleted_at is null and n.done_at is null and coalesce(n.carried_to, n.happened_on) <= core.riyadh_today()
    and case p_scope
          when 'me' then n.person_id = p_reader
          when 'team' then n.person_id <> p_reader and n.visibility = 'team' and my.team_sees(n.person_id, p_reader)
          else n.person_id <> p_reader and n.visibility = 'workspace' end
    and my.note_visible(n.id, p_reader)
$$;

create function my.my_day(p_scope text default 'me', p_limit int default 7, p_offset int default 0,
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
    'reminders', case when scope = 'me' then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', r.id, 'note_id', r.note_id, 'remind_at', r.remind_at,
               'text', r.text) order by r.remind_at, r.id)
      from (select * from core.reminder r0
            where r0.person_id = me and r0.deleted_at is null and r0.sent_at is null
            order by r0.remind_at, r0.id limit lim) r), '[]'::jsonb) else '[]'::jsonb end);
end
$$;

-- One note, for whoever may see it.
create function my.note_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  n my.note;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into n from my.note where id = p_id;
  if n.id is null or not my.note_visible(p_id, me) or (n.deleted_at is not null and n.person_id <> me) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return my.note_row(n, me);
end
$$;

-- The "from note" chip of any record the reader may see: the note, or null.
create function my.from_note_of(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
begin
  return my.from_note(e.table_name, p_id, authz.me());
end
$$;

-- core.notes as P3-8b-3 wrote it, each entry with the note it came from — for a reader who may see that note (V454).
create or replace function core.notes(p_entity text, p_id uuid, p_kinds text[] default null, p_limit int default 50,
                                      p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  me uuid := authz.me();
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'body', n.body, 'happened_on', n.happened_on, 'logged_at', n.logged_at,
      'logged_late', core.logged_late(n.happened_on, n.logged_at),
      'type', t.key, 'type_en', t.name_en, 'type_ar', t.name_ar,
      'outcome', o.key, 'outcome_en', o.name_en, 'outcome_ar', o.name_ar, 'meaning', o.meaning,
      'next_step', n.next_step, 'next_step_on', n.next_step_on, 'next_step_task_id', n.next_step_task_id,
      'author_id', n.created_by, 'edited_at', n.edited_at, 'version', n.version, 'mine', n.created_by = me,
      'mentions', coalesce((select pg_catalog.jsonb_agg(m.person_id order by m.created_at, m.person_id)
                            from core.mention m where m.note_id = n.id and m.deleted_at is null), '[]'::jsonb),
      'from_note', my.from_note('core.note', n.id, me))
      order by n.happened_on desc, n.logged_at desc, n.id)
    from (select * from core.note x
          where x.entity_table = e.table_name and x.entity_id = p_id and x.deleted_at is null
            and (p_kinds is null or x.kind = any (p_kinds))
          order by x.happened_on desc, x.logged_at desc, x.id
          limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(coalesce(p_offset, 0), 0)) n
    left join partner.activity_type t on t.id = n.activity_type_id
    left join partner.activity_outcome o on o.id = n.outcome_id), '[]'::jsonb);
end
$$;

-- core.search as P3-8b-1 wrote it, plus the notes the reader may see — never another's private note (V454).
create or replace function core.search(p_q text, p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  q text := norm.fold(p_q);
  lim int := greatest(1, least(coalesce(p_limit, 10), 50));
  stop text[] := partner.stop_words();
  sees_client boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if q is null or pg_catalog.length(q) < 2 then
    return pg_catalog.jsonb_build_object('partners', '[]'::jsonb, 'people', '[]'::jsonb, 'notes', '[]'::jsonb);
  end if;
  sees_client := authz.level_of(me, 'clients') >= 'view';
  return pg_catalog.jsonb_build_object(
    'partners', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', y.id, 'number', y.number,
               'trade_name_en', y.trade_name_en, 'trade_name_ar', y.trade_name_ar, 'matched_by', y.matched_by)
               order by y.rank, pg_catalog.lower(y.trade_name_en))
      from (select * from (select distinct on (p.id) p.id, p.number, p.trade_name_en, p.trade_name_ar, m.matched_by, m.rank
            from partner.partner p
            join (select i.partner_id, i.kind as matched_by, 0 as rank from partner.identifier i
                  where i.deleted_at is null and (sees_client or i.kind not in ('payments_client_id', 'discount_code'))
                    and i.value_key in (norm.key('payments_client_id', p_q), norm.key('vat', p_q), norm.key('email', p_q),
                                        norm.key('phone', p_q), norm.key('discount_code', p_q), norm.key('name', p_q, stop))
                  union all
                  select p2.id, 'name', 1 from partner.partner p2
                  where norm.fold(p2.trade_name_en) like '%' || q || '%' or norm.fold(p2.trade_name_ar) like '%' || q || '%'
                     or norm.fold(p2.official_name_en) like '%' || q || '%' or norm.fold(p2.official_name_ar) like '%' || q || '%'
                  union all
                  select p3.id, 'number', 0 from partner.partner p3 where norm.fold(p3.number) = q) m on m.partner_id = p.id
            where p.deleted_at is null and p.archived_at is null and partner.level_of(me, p.id) >= 'view'
            order by p.id, m.rank) x
            order by x.rank, pg_catalog.lower(x.trade_name_en) limit lim) y), '[]'::jsonb),
    'people', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', p.id, 'full_name_en', p.full_name_en,
               'full_name_ar', p.full_name_ar, 'job_title_en', p.job_title_en) order by pg_catalog.lower(p.full_name_en))
      from (select * from core.person p0
            where p0.kind = 'staff' and p0.active and p0.deleted_at is null
              and (norm.fold(p0.full_name_en) like '%' || q || '%' or norm.fold(p0.full_name_ar) like '%' || q || '%'
                   or norm.fold(p0.nickname_en) like '%' || q || '%' or norm.fold(p0.nickname_ar) like '%' || q || '%')
            order by pg_catalog.lower(p0.full_name_en) limit lim) p), '[]'::jsonb),
    'notes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title,
               'author_id', n.person_id, 'happened_on', n.happened_on) order by n.logged_at desc, n.id)
      from (select * from my.note n0
            where n0.deleted_at is null
              and (norm.fold(n0.title) like '%' || q || '%' or norm.fold(n0.body) like '%' || q || '%')
              and my.note_visible(n0.id, me)
            order by n0.logged_at desc, n0.id limit lim) n), '[]'::jsonb));
end
$$;

-- ================================================================ grants and the doors (V124)
grant execute on function my.note_capture(text, jsonb, uuid[]), my.note_update(uuid, jsonb, int, uuid[]),
  my.my_notes_remove(uuid[], text), my.note_turn_into(uuid, text, jsonb), my.note_finish_meeting(uuid, jsonb),
  my.note_wrap_up(date, jsonb), my.my_day(text, int, int, timestamptz), my.note_get(uuid), my.from_note_of(text, uuid),
  core.reminders_remove(uuid[], text)
  to authenticated;

create function api.note_capture(p_kind text, p_values jsonb default null, p_mentions uuid[] default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select my.note_capture(p_kind, p_values, p_mentions) $$;
create function api.note_update(p_id uuid, p_values jsonb, p_version int, p_mentions uuid[] default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select my.note_update(p_id, p_values, p_version, p_mentions) $$;
create function api.my_notes_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select my.my_notes_remove(p_ids, p_reason) $$;
create function api.note_turn_into(p_note uuid, p_kind text, p_values jsonb default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select my.note_turn_into(p_note, p_kind, p_values) $$;
create function api.note_finish_meeting(p_note uuid, p_values jsonb default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select my.note_finish_meeting(p_note, p_values) $$;
create function api.note_wrap_up(p_day date, p_choices jsonb) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select my.note_wrap_up(p_day, p_choices) $$;
create function api.my_day(p_scope text default 'me', p_limit int default 7, p_offset int default 0,
                           p_since timestamptz default null) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select my.my_day(p_scope, p_limit, p_offset, p_since) $$;
create function api.my_note(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select my.note_get(p_id) $$;
create function api.from_note(p_entity text, p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select my.from_note_of(p_entity, p_id) $$;
create function api.reminders_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.reminders_remove(p_ids, p_reason) $$;

grant execute on function api.note_capture(text, jsonb, uuid[]), api.note_update(uuid, jsonb, int, uuid[]),
  api.my_notes_remove(uuid[], text), api.note_turn_into(uuid, text, jsonb), api.note_finish_meeting(uuid, jsonb),
  api.note_wrap_up(date, jsonb), api.my_day(text, int, int, timestamptz), api.my_note(uuid), api.from_note(text, uuid),
  api.reminders_remove(uuid[], text)
  to authenticated;
