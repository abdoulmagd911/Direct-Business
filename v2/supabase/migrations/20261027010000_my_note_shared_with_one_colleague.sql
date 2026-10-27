-- G (the Architect's order of 26 Oct): share a note with one named colleague. A note's visibility gains a fourth
-- value, 'person', with the colleague in my.note.shared_with. Only its author and that colleague read it; an admin no
-- more than for a private note (V454). The colleague finds it with their team's notes on My day and is told once in the
-- bell (the note-mention kind, label notify.note_shared). Choosing another visibility stops the sharing; sharing it with
-- someone else tells the new colleague. The doors (my.note_capture, my.note_update) take shared_with; the read rule,
-- My day's team scope and the refusal words learn it. Functions replaced whole are as their newest migration left them
-- but for the lines named. Forward-only (V103).

alter table my.note add column shared_with uuid references core.person (id);
create index note_shared_with on my.note (shared_with);
comment on column my.note.shared_with is 'G: the one colleague a note is shared with (visibility person).';
alter table my.note drop constraint note_visibility_check;
alter table my.note add constraint note_visibility_check check (visibility in ('private', 'team', 'workspace', 'person'));
alter table my.note add constraint note_shared_with_one check ((visibility = 'person') = (shared_with is not null)
                                                               and shared_with is distinct from person_id);

-- Tell the colleague a note was shared with them, once: when it is new to them. The notice carries the note's line, so
-- the bell says which note ("<who> shared a note with you: <title>").
create function my.share_told(p_note uuid, p_was uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n my.note;
begin
  select * into n from my.note where id = p_note;
  if n.shared_with is not null and n.shared_with is distinct from p_was then
    perform notify.push(n.shared_with, 'note_mention', 'my.note', n.id, 'notify.note_shared',
                        pg_catalog.jsonb_build_object('note_id', n.id, 'kind', n.kind, 'title', my.note_line(n)));
  end if;
end
$$;
revoke all on function my.share_told(uuid, uuid) from public;

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
        -- G: shared with one named colleague, that colleague alone reads it (admins as for a private note: never)
        or (n.visibility = 'person' and n.shared_with = p_person and n.deleted_at is null
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
                                -- G: a note shared with the reader by name sits with their team's notes
                                or (n.visibility = 'person' and n.shared_with = p_reader))
          else n.person_id <> p_reader and n.visibility = 'workspace' end
    and my.note_visible(n.id, p_reader)
$$;

create or replace function my.note_fields_check(v jsonb) returns void
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
    if k not in ('title', 'body', 'items', 'visibility', 'shared_with', 'happened_on', 'meeting_partner_id',
                 'meeting_on') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  -- G: the one colleague a note is shared with is another active member of staff
  pid := nullif(v ->> 'shared_with', '')::uuid;
  if pid is not null and (pid = authz.me() or not exists (
       select 1 from core.person p where p.id = pid and p.kind = 'staff' and p.active and p.deleted_at is null)) then
    raise exception using errcode = 'P0001', message = 'note.share_needs_a_colleague';
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
            nullif(v ->> 'shared_with', '')::uuid)
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
  was uuid := n.shared_with;
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
      -- G: a note stops being shared with its colleague as soon as it is no longer shared with one person
      shared_with = case when v ? 'shared_with' then nullif(v ->> 'shared_with', '')::uuid
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

create or replace function my.note_refused(p_constraint text) returns text
language sql immutable set search_path = ''
as $$
  select case p_constraint
    when 'note_kind_check' then 'note.kind_invalid'
    when 'note_title_check' then 'note.title_invalid'
    when 'note_body_check' then 'note.body_too_long'
    when 'note_items_check' then 'note.items_invalid'
    when 'note_visibility_check' then 'note.visibility_invalid'
    when 'note_shared_with_one' then 'note.share_needs_a_colleague'
    when 'note_has_words' then 'note.body_required'
    when 'note_not_after_logged' then 'common.date_in_future'
    when 'note_meeting_only' then 'note.meeting_fields_on_a_meeting'
    when 'note_carried_forward' then 'note.carried_forward'
    when 'reminder_text_check' then 'reminder.text_invalid'
    else 'common.invalid' end
$$;

create or replace function my.note_row(n my.note, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'idea', n.idea, 'capture_kind', my.capture_kind(n), 'title', n.title, 'body', n.body, 'items', n.items, 'visibility', n.visibility, 'shared_with', n.shared_with,
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
