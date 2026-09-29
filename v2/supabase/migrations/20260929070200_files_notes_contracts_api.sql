-- v2 partners, part 2 — the doors (P3-8b): notes, mentions and Log call; files (register, upload, finish, list,
-- download under their live name, remove), logos and avatars; contracts with their terms and the contract-expiring
-- alert; a merge now also moves notes, files and contracts. TECH-SPEC §3.3, §3.4; V53, V55, V56, V61, V63, D10;
-- V138–V141. Every function the Data API reaches is a security-invoker wrapper (V124). Forward-only (V103).

-- ================================================================ owners (V127)
-- A note is owned by its author and by the owners of its record; a contract and its terms by the partner's owners.
create function core.note_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select n.created_by from core.note n where n.id = p_id
  union
  select o from core.note n cross join lateral pg_catalog.unnest(core.owners_of(n.entity_table, n.entity_id)) o
  where n.id = p_id
$$;
create function partner.contract_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners_via('partner.contract', p_id) $$;
create function partner.contract_term_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select partner.owners(c.partner_id) from partner.contract_term t join partner.contract c on c.id = t.contract_id
  where t.id = p_id
$$;

-- "Told once" (§3.3): a person pushed a notification by the request (mentioned, assigned …) is not also told that the
-- same request changed a record they own or follow. Otherwise notify.fan_out as P3-6b wrote it.
create or replace function notify.fan_out(p_request uuid) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  q audit.request;
  n int;
begin
  select * into q from audit.request where id = p_request;
  if q.id is null or q.kind not in ('ui', 'undo') then
    return 0;
  end if;
  insert into notify.notification (person_id, kind, entity_table, entity_id, request_id, actor_id, label_key, label_args)
  select distinct on (x.person_id) x.person_id, x.kind, x.table_name, x.row_id, q.id, q.actor_id, q.label_key,
         q.label_args
  from (
    select o.person_id, 'changed_by_other' as kind, c.table_name, c.row_id, c.id, 0 as pri
    from audit.change c cross join lateral pg_catalog.unnest(core.owners_of(c.table_name, c.row_id)) o(person_id)
    where c.request_id = q.id
    union all
    select f.person_id, 'followed_change', c.table_name, c.row_id, c.id, 1
    from audit.change c join notify.follow f on f.entity_table = c.table_name and f.entity_id = c.row_id
    where c.request_id = q.id
  ) x
  where x.person_id <> q.actor_id and notify.may_notify(x.person_id, x.kind)
    and not exists (select 1 from notify.notification m where m.request_id = q.id and m.person_id = x.person_id)
  order by x.person_id, x.pri, x.id;
  get diagnostics n = row_count;
  return n;
end
$$;

-- ================================================================ who may add to a record
-- The signed-in person may add notes and files to a record: an admin, or Full on its record type's page; Own on it
-- (or a record type with no page) and one of the record's owners.
create function core.may_write(p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity;
  lv core.level;
begin
  select * into e from core.entity where table_name = p_table and active;
  if me is null or e.id is null then
    return false;
  end if;
  lv := case when e.page_key is null then 'own'::core.level else authz.level_of(me, e.page_key) end;
  return authz.is_admin() or lv = 'full' or (lv >= 'own' and me = any (core.owners_of(p_table, p_id)));
end
$$;

-- ================================================================ notes and mentions (§3.4, V138)
-- Each person @mentioned is told once (notify.push 'mentioned', linked to the record) — and may be mentioned only when
-- they can see the record.
create function core.mentions_add(p_note uuid, p_people uuid[]) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n core.note;
  who uuid;
  k int := 0;
begin
  select * into n from core.note where id = p_note;
  foreach who in array coalesce(p_people, '{}') loop
    if exists (select 1 from core.mention m where m.note_id = p_note and m.person_id = who) then
      continue;
    end if;
    if not exists (select 1 from core.person p where p.id = who and p.kind = 'staff' and p.active and p.deleted_at is null) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = who::text;
    end if;
    if not core.may_see(who, n.entity_table, n.entity_id) then
      raise exception using errcode = 'P0001', message = 'note.mention_cannot_see',
        detail = (select p.full_name_en from core.person p where p.id = who);
    end if;
    insert into core.mention (note_id, person_id) values (p_note, who);
    perform notify.push(who, 'mentioned', n.entity_table, n.entity_id, 'notify.mentioned',
                        pg_catalog.jsonb_build_object('note_id', p_note, 'kind', n.kind));
    k := k + 1;
  end loop;
  return k;
end
$$;

-- A comment, update, meeting note or feedback on any record the person may add to. Calls go through Log call.
create function core.note_add(p_entity text, p_id uuid, p_kind text, p_body text, p_occurred_on date default null,
                              p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  nid uuid;
  req uuid;
begin
  if not core.may_write(e.table_name, p_id) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  if p_kind is null or p_kind not in ('comment', 'update', 'meeting', 'feedback') then
    raise exception using errcode = 'P0001', message = 'note.kind_invalid', detail = p_kind;
  end if;
  if p_occurred_on > core.riyadh_today() and p_kind = 'feedback' then
    raise exception using errcode = 'P0001', message = 'note.date_in_future';
  end if;
  req := audit.begin('ui', 'note.added', pg_catalog.jsonb_build_object('kind', p_kind), null);
  begin
    insert into core.note (entity_table, entity_id, kind, body, occurred_on)
    values (e.table_name, p_id, p_kind, pg_catalog.btrim(p_body),
            coalesce(p_occurred_on, case when p_kind = 'feedback' then core.riyadh_today() end))
    returning id into nid;
  exception when check_violation then
    raise exception using errcode = 'P0001',
      message = case when p_kind = 'meeting' and p_occurred_on is null then 'note.date_required' else 'note.body_required' end;
  end;
  perform core.mentions_add(nid, p_mentions);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'version', 1, 'request_id', req);
end
$$;

-- Only its author edits a note (marked edited); new mentions are told, removed ones dropped.
create function core.note_edit(p_id uuid, p_body text, p_version int, p_mentions uuid[] default null,
                               p_occurred_on date default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  n core.note;
  v jsonb;
  req uuid;
begin
  select * into n from core.note where id = p_id and deleted_at is null;
  if me is null or n.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if n.created_by <> me then
    raise exception using errcode = '42501', message = 'note.not_yours';
  end if;
  v := pg_catalog.jsonb_build_object('body', pg_catalog.btrim(p_body), 'occurred_on', coalesce(p_occurred_on, n.occurred_on));
  perform core.check_version('core.note', p_id, p_version,
    (select pg_catalog.array_agg(k) from pg_catalog.jsonb_object_keys(v) k where (pg_catalog.to_jsonb(n) -> k) is distinct from (v -> k)));
  req := audit.begin('ui', 'note.edited', pg_catalog.jsonb_build_object('kind', n.kind), null);
  begin
    perform audit.write_fields('core.note', p_id, v || pg_catalog.jsonb_build_object('edited_at', pg_catalog.now()));
  exception when check_violation then
    raise exception using errcode = 'P0001', message = 'note.body_required';
  end;
  if p_mentions is not null then
    delete from core.mention where note_id = p_id and not (person_id = any (p_mentions));
    perform core.mentions_add(p_id, p_mentions);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from core.note x where x.id = p_id),
                                       'request_id', req);
end
$$;

-- Its author removes a note; so do admins and those with Full on its record's page. One request, one Undo.
create function core.notes_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  n record;
  req uuid;
  k int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  for n in select i.id, x.id as found, x.created_by, e.page_key
           from pg_catalog.unnest(p_ids) i(id)
           left join core.note x on x.id = i.id and x.deleted_at is null
           left join core.entity e on e.table_name = x.entity_table loop
    if n.found is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not (n.created_by = me or authz.is_admin() or (n.page_key is not null and authz.level_of(me, n.page_key) = 'full')) then
      raise exception using errcode = '42501', message = 'note.not_yours';
    end if;
  end loop;
  req := audit.begin('ui', 'note.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update core.note set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- A record's timeline, newest first, for anyone who may see the record.
create function core.notes(p_entity text, p_id uuid, p_kinds text[] default null, p_before timestamptz default null,
                           p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  me uuid := authz.me();
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'body', n.body, 'occurred_on', n.occurred_on, 'outcome', o.key,
      'outcome_en', o.name_en, 'outcome_ar', o.name_ar, 'author_id', n.created_by, 'created_at', n.created_at,
      'edited_at', n.edited_at, 'version', n.version, 'mine', n.created_by = me,
      'mentions', coalesce((select pg_catalog.jsonb_agg(m.person_id order by m.created_at, m.person_id)
                            from core.mention m where m.note_id = n.id), '[]'::jsonb))
      order by n.created_at desc, n.id)
    from (select * from core.note x
          where x.entity_table = e.table_name and x.entity_id = p_id and x.deleted_at is null
            and (p_kinds is null or x.kind = any (p_kinds)) and (p_before is null or x.created_at < p_before)
          order by x.created_at desc, x.id limit greatest(1, least(coalesce(p_limit, 50), 200))) n
    left join partner.call_outcome o on o.id = n.outcome_id), '[]'::jsonb);
end
$$;

-- Log call (V63): one click on a partner — the outcome from the settings list, an optional line — no task needed.
-- "Meeting set" tells the screen to offer a prefilled task.
create function partner.log_call(p_partner uuid, p_outcome text, p_note text default null, p_occurred_on date default null,
                                 p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record('partner', p_partner);
  o partner.call_outcome;
  nid uuid;
  req uuid;
begin
  if (select p.archived_at from partner.partner p where p.id = p_partner) is not null then
    raise exception using errcode = 'P0001', message = 'partner.archived';
  end if;
  if not core.may_write(e.table_name, p_partner) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  select * into o from partner.call_outcome x where x.key = p_outcome and x.active;
  if o.id is null then
    raise exception using errcode = 'P0002', message = 'partner.unknown_outcome', detail = p_outcome;
  end if;
  if p_occurred_on > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'note.date_in_future';
  end if;
  req := audit.begin('ui', 'partner.call_logged', pg_catalog.jsonb_build_object('outcome', o.key), null);
  insert into core.note (entity_table, entity_id, kind, body, occurred_on, outcome_id)
  values ('partner.partner', p_partner, 'call', nullif(pg_catalog.btrim(p_note), ''),
          coalesce(p_occurred_on, core.riyadh_today()), o.id)
  returning id into nid;
  perform core.mentions_add(nid, p_mentions);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'request_id', req, 'outcome', o.key, 'counts_as_demo', o.counts_as_demo,
                                       'offer_task', o.key = 'meeting_set');
end
$$;

-- ================================================================ file names, live (V55, V139)
-- A name's extension: lower case, letters and digits, '' when none.
create function core.file_ext(p_name text) returns text
language sql immutable parallel safe set search_path = ''
as $$ select coalesce(pg_catalog.lower((pg_catalog.regexp_match(p_name, '\.([A-Za-z0-9]{1,10})$'))[1]), '') $$;

-- Each record type a file can belong to gives its tokens through <table>_file_tokens(id, locale); later steps add
-- theirs (an invoice's {number} and {amount} — P4).
create function partner.partner_file_tokens(p_id uuid, p_locale text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'partner', case when p_locale = 'ar' then coalesce(p.trade_name_ar, p.trade_name_en) else p.trade_name_en end,
    'partner official', case when p_locale = 'ar'
                             then coalesce(p.official_name_ar, p.official_name_en, p.trade_name_ar, p.trade_name_en)
                             else coalesce(p.official_name_en, p.trade_name_en) end,
    'number', p.number,
    'record', case when p_locale = 'ar' then coalesce(p.trade_name_ar, p.trade_name_en) else p.trade_name_en end)
  from partner.partner p where p.id = p_id
$$;

create function partner.contract_file_tokens(p_id uuid, p_locale text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select partner.partner_file_tokens(c.partner_id, p_locale) || pg_catalog.jsonb_build_object(
    'title', c.title, 'record', c.title,
    'start', pg_catalog.to_char(c.start_on, 'YYYY-MM-DD'),
    'end', coalesce(pg_catalog.to_char(c.end_on, 'YYYY-MM-DD'), case when p_locale = 'ar' then 'مفتوح' else 'open-ended' end))
  from partner.contract c where c.id = p_id
$$;

create function core.person_file_tokens(p_id uuid, p_locale text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('person', x.name, 'record', x.name)
  from (select case when p_locale = 'ar'
                    then coalesce(pr.display_name_ar, p.nickname_ar, p.full_name_ar, pr.display_name_en, p.nickname_en, p.full_name_en)
                    else coalesce(pr.display_name_en, p.nickname_en, p.full_name_en) end as name
        from core.person p left join core.person_profile pr on pr.person_id = p.id where p.id = p_id) x
$$;

-- The name a file is shown and downloaded under, now (V55): its kind's pattern in the locale, each token from the
-- records it is linked to ({date} is the upload day, {original} its original name, {kind} its kind); a token with no
-- value is dropped with its separator; characters a file system refuses become '-'; its extension kept.
create function core.file_display_name(p_file uuid, p_locale text default 'en') returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  f core.file;
  k core.file_kind;
  ext text;
  tok jsonb;
  t jsonb;
  l record;
  fn regprocedure;
  m text[];
  nm text := '';
begin
  select * into f from core.file where id = p_file;
  if f.id is null then
    return null;
  end if;
  select * into k from core.file_kind where id = f.kind_id;
  ext := core.file_ext(f.original_name);
  tok := pg_catalog.jsonb_build_object(
    'date', pg_catalog.to_char((f.created_at at time zone 'Asia/Riyadh')::date, 'YYYY-MM-DD'),
    'original', case when ext = '' then f.original_name
                     else pg_catalog.left(f.original_name, pg_catalog.length(f.original_name) - pg_catalog.length(ext) - 1) end,
    'kind', case when p_locale = 'ar' then k.name_ar else k.name_en end);
  for l in select x.entity_table, x.entity_id from core.file_link x
           where x.file_id = f.id and x.deleted_at is null order by x.created_at, x.id loop
    fn := pg_catalog.to_regprocedure(l.entity_table || '_file_tokens(uuid, text)');
    if fn is not null then
      execute pg_catalog.format('select %s($1, $2)', fn::regproc) into t using l.entity_id, p_locale;
      tok := tok || coalesce(t, '{}');
    end if;
  end loop;
  for m in select pg_catalog.regexp_matches(case when p_locale = 'ar' then k.name_pattern_ar else k.name_pattern_en end,
                                            '\{[a-z ]+\}|[^{]+|\{', 'g') loop
    if m[1] ~ '^\{[a-z ]+\}$' then
      nm := nm || coalesce(tok ->> pg_catalog.substr(m[1], 2, pg_catalog.length(m[1]) - 2), '');
    else
      nm := nm || m[1];
    end if;
  end loop;
  nm := pg_catalog.regexp_replace(nm, '[\\/:*?"<>|[:cntrl:]]', '-', 'g');
  nm := pg_catalog.regexp_replace(nm, '\s+', ' ', 'g');
  nm := pg_catalog.regexp_replace(nm, '(\s*·\s*)+', ' · ', 'g');
  nm := pg_catalog.btrim(nm, ' ·');
  if nm = '' then
    nm := tok ->> 'original';
  end if;
  return pg_catalog.left(nm, 150) || case when ext <> '' then '.' || ext else '' end;
end
$$;

-- ================================================================ files: register, finish, list, download, remove
-- Registers a pending file linked to a record and answers where the browser uploads it (§3.4). A logo is a partner's
-- (Full on Partners), an avatar the person's own; anything else needs to be allowed to add to the record. Size cap and
-- types: the settings files.max_mb and files.allowed_types; pictures at most 2 MB, logos PNG or SVG (V53).
create function core.file_begin(p_entity text, p_id uuid, p_kind text, p_purpose text, p_original_name text,
                                p_size bigint, p_mime text, p_sensitivity text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity;
  k core.file_kind;
  nm text := pg_catalog.btrim(p_original_name);
  b text;
  cap bigint;
  types jsonb;
  fid uuid := pg_catalog.gen_random_uuid();
  pth text;
  sens text;
  req uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  e := core.can_see_record(p_entity, p_id);
  if p_purpose is null or p_purpose not in ('evidence', 'contract', 'agreement', 'attachment', 'iban_letter', 'render',
                                            'logo', 'avatar', 'tender') then
    raise exception using errcode = 'P0001', message = 'file.unknown_purpose', detail = p_purpose;
  end if;
  if p_purpose = 'avatar' then
    if e.table_name <> 'core.person' or p_id <> me then
      raise exception using errcode = '42501', message = 'file.avatar_is_your_own';
    end if;
  elsif p_purpose = 'logo' then
    if e.table_name <> 'partner.partner' then
      raise exception using errcode = 'P0001', message = 'file.logo_is_a_partners';
    end if;
    perform partner.writable(p_id);
  elsif not core.may_write(e.table_name, p_id) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  select * into k from core.file_kind x where x.key = p_kind and x.active;
  if k.id is null then
    raise exception using errcode = 'P0002', message = 'file.unknown_kind', detail = p_kind;
  end if;
  if nm is null or nm = '' or pg_catalog.length(nm) > 255 or nm ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'file.name_invalid';
  end if;
  nm := pg_catalog.regexp_replace(nm, '[\\/]', '-', 'g');
  b := case when p_purpose in ('logo', 'avatar') then 'images' else 'files' end;
  cap := case when b = 'images' then 2097152
              else coalesce((core.setting_at('files.max_mb', null, core.riyadh_today()) #>> '{}')::bigint, 20) * 1048576 end;
  if p_size is null or p_size <= 0 or p_size > cap then
    raise exception using errcode = 'P0001', message = 'file.too_large', detail = (cap / 1048576)::text;
  end if;
  types := case p_purpose when 'logo' then '["image/png", "image/svg+xml"]'::jsonb
                          when 'avatar' then '["image/png", "image/jpeg", "image/webp"]'::jsonb
                          else core.setting_at('files.allowed_types', null, core.riyadh_today()) end;
  if not coalesce(types ? pg_catalog.lower(p_mime), false) then
    raise exception using errcode = 'P0001', message = 'file.type_not_allowed', detail = p_mime;
  end if;
  sens := case when p_purpose = 'iban_letter' then 'restricted' else coalesce(p_sensitivity, k.sensitivity) end;
  if sens not in ('normal', 'restricted') then
    raise exception using errcode = 'P0001', message = 'file.sensitivity_invalid', detail = sens;
  end if;
  pth := pg_catalog.to_char(core.riyadh_today(), 'YYYY/MM') || '/' || fid
         || case when core.file_ext(nm) <> '' then '.' || core.file_ext(nm) else '' end;
  req := audit.begin('ui', 'file.added', pg_catalog.jsonb_build_object('kind', k.key, 'purpose', p_purpose), null);
  insert into core.file (id, bucket, path, original_name, kind_id, mime, size_bytes, sensitivity)
  values (fid, b, pth, nm, k.id, pg_catalog.lower(p_mime), p_size, sens);
  insert into core.file_link (file_id, entity_table, entity_id, purpose) values (fid, e.table_name, p_id, p_purpose);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', fid, 'bucket', b, 'path', pth, 'request_id', req);
end
$$;

-- The uploader marks the file stored once Storage holds it, with its checksum. A logo becomes its partner's logo, an
-- avatar its owner's picture.
create function core.file_finish(p_id uuid, p_sha256 text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  f core.file;
  l core.file_link;
  req uuid;
begin
  select * into f from core.file where id = p_id and deleted_at is null;
  if me is null or f.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if f.created_by <> me then
    raise exception using errcode = '42501', message = 'file.not_yours';
  end if;
  if f.status = 'stored' then
    raise exception using errcode = 'P0001', message = 'file.already_stored';
  end if;
  if p_sha256 is null or pg_catalog.lower(p_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'file.checksum_invalid';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = f.bucket and o.name = f.path) then
    raise exception using errcode = 'P0001', message = 'file.not_uploaded';
  end if;
  req := audit.begin('ui', 'file.stored', null, null);
  update core.file set status = 'stored', sha256 = pg_catalog.lower(p_sha256), stored_at = pg_catalog.now() where id = p_id;
  for l in select * from core.file_link x where x.file_id = p_id and x.deleted_at is null and x.purpose in ('logo', 'avatar') loop
    if l.purpose = 'logo' then
      update partner.partner set logo_file_id = p_id where id = l.entity_id;
    elsif exists (select 1 from core.person_profile pr where pr.person_id = l.entity_id) then
      update core.person_profile set avatar_file_id = p_id where person_id = l.entity_id;
    else
      insert into core.person_profile (person_id, avatar_file_id) values (l.entity_id, p_id);
    end if;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req,
    'display_name_en', core.file_display_name(p_id, 'en'), 'display_name_ar', core.file_display_name(p_id, 'ar'));
end
$$;

-- A record's files, for anyone who may see the record — each only where the file itself is visible (restricted
-- files to files.restricted; a pending one to its uploader). The original name shows while
-- core.file_keep_original_name is on.
create function core.files(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  keep boolean := coalesce((core.setting_at('core.file_keep_original_name', null, core.riyadh_today()) #>> '{}')::boolean, true);
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', f.id, 'link_id', l.id, 'kind', k.key, 'kind_en', k.name_en, 'kind_ar', k.name_ar, 'purpose', l.purpose,
      'display_name_en', core.file_display_name(f.id, 'en'), 'display_name_ar', core.file_display_name(f.id, 'ar'),
      'original_name', case when keep then f.original_name end, 'mime', f.mime, 'size_bytes', f.size_bytes,
      'sensitivity', f.sensitivity, 'status', f.status, 'added_by', f.created_by, 'added_at', f.created_at,
      'version', f.version) order by f.created_at desc, f.id)
    from core.file_link l join core.file f on f.id = l.file_id join core.file_kind k on k.id = f.kind_id
    where l.entity_table = e.table_name and l.entity_id = p_id and l.deleted_at is null and f.deleted_at is null
      and authz.file_visible(f.id)), '[]'::jsonb);
end
$$;

-- What the browser needs to download a file (§3.4): where it is and the name to save it under — its display name in
-- the reader's language while core.file_download_display_name is on, else its original name. The browser then asks
-- Storage for a signed URL (600 s for documents, 24 h for pictures) with that name; Storage's own rule checks again.
create function core.file_download(p_id uuid, p_locale text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  f core.file;
  loc text;
begin
  select * into f from core.file where id = p_id and deleted_at is null;
  if me is null or f.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not authz.file_visible(p_id) then
    raise exception using errcode = '42501', message = 'file.cannot_see';
  end if;
  if f.status <> 'stored' then
    raise exception using errcode = 'P0001', message = 'file.not_stored';
  end if;
  loc := coalesce(p_locale, (select pr.locale from core.person_profile pr where pr.person_id = me), 'en');
  return pg_catalog.jsonb_build_object('bucket', f.bucket, 'path', f.path, 'mime', f.mime,
    'download_name', case when coalesce((core.setting_at('core.file_download_display_name', null, core.riyadh_today()) #>> '{}')::boolean, true)
                          then core.file_display_name(f.id, loc) else f.original_name end,
    'expires_in', case when f.bucket = 'images' then 86400 else 600 end);
end
$$;

-- Removes files (and their links): their uploader, an admin, or Full on the page of a record they belong to. A logo
-- or picture removed leaves its partner or person without one. One request, one Undo.
create function core.files_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  f record;
  req uuid;
  k int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  for f in select i.id, x.id as found, x.created_by from pg_catalog.unnest(p_ids) i(id)
           left join core.file x on x.id = i.id and x.deleted_at is null loop
    if f.found is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not (f.created_by = me or authz.is_admin()
            or exists (select 1 from core.file_link l join core.entity e on e.table_name = l.entity_table
                       where l.file_id = f.id and l.deleted_at is null and e.page_key is not null
                         and authz.level_of(me, e.page_key) = 'full')) then
      raise exception using errcode = '42501', message = 'file.not_yours';
    end if;
  end loop;
  req := audit.begin('ui', 'file.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update partner.partner set logo_file_id = null where logo_file_id = any (p_ids);
  update core.person_profile set avatar_file_id = null where avatar_file_id = any (p_ids);
  update core.file_link set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason
  where file_id = any (p_ids) and deleted_at is null;
  update core.file set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- ================================================================ contracts (V56, V140)
-- A contract's status on a day, computed, never stored: Not started, Active, Expires in N days (from
-- partner.contract_expiring_from_days before its end, its last day included), Expired.
create function partner.contract_state(p_start date, p_end date, p_on date default null) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'status', case when p_start > x.d then 'not_started'
                   when p_end < x.d then 'expired'
                   when p_end - x.d <= coalesce((core.setting_at('partner.contract_expiring_from_days', null, x.d) #>> '{}')::int, 30)
                     then 'expiring'
                   else 'active' end,
    'days_left', p_end - x.d)
  from (select coalesce(p_on, core.riyadh_today()) as d) x
$$;

-- Add or change a contract, with its terms in the same request (V56): values kind, title, start_on, end_on,
-- reminders_on, reminder_days, notes, and terms [{term, before, after}] — terms left out are removed. Full on
-- Partners; an archived partner is read-only.
create function partner.contract_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null,
                                      p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_partner);
  me uuid := authz.me();
  v jsonb := coalesce(p_values, '{}') - 'terms';
  c partner.contract;
  k text;
  cid uuid;
  req uuid;
  t jsonb;
  tm partner.term;
  cur partner.contract_term;
  keep uuid[] := '{}';
  what text;
begin
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('kind', 'title', 'start_on', 'end_on', 'reminders_on', 'reminder_days', 'notes') then
      raise exception using errcode = 'P0001', message = 'contract.unknown_field', detail = k;
    end if;
  end loop;
  if p_values ? 'terms' and pg_catalog.jsonb_typeof(p_values -> 'terms') <> 'array' then
    raise exception using errcode = 'P0001', message = 'contract.terms_list_expected';
  end if;
  if p_id is not null then
    select * into c from partner.contract x where x.id = p_id and x.partner_id = p_partner and x.deleted_at is null;
    if c.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    perform core.check_version('partner.contract', p_id, p_version,
      (select pg_catalog.array_agg(x) from pg_catalog.jsonb_object_keys(v) x where (pg_catalog.to_jsonb(c) -> x) is distinct from (v -> x)));
  end if;
  req := audit.begin('ui', 'contract.saved', pg_catalog.jsonb_build_object('partner', p.number), p_reason);
  begin
    if p_id is null then
      insert into partner.contract (partner_id, kind, title, start_on, end_on, reminders_on, reminder_days, notes)
      select p_partner, coalesce(x.kind, 'contract'), pg_catalog.btrim(x.title), x.start_on, x.end_on,
             coalesce(x.reminders_on, true), x.reminder_days, x.notes
      from pg_catalog.jsonb_populate_record(null::partner.contract, v) x
      returning id into cid;
    else
      perform audit.write_fields('partner.contract', p_id, v);
      cid := p_id;
    end if;
    if p_values ? 'terms' then
      for t in select * from pg_catalog.jsonb_array_elements(p_values -> 'terms') loop
        select * into tm from partner.term x where x.key = t ->> 'term' and x.active;
        if tm.id is null then
          raise exception using errcode = 'P0002', message = 'contract.unknown_term', detail = t ->> 'term';
        end if;
        keep := keep || tm.id;
        select * into cur from partner.contract_term x where x.contract_id = cid and x.term_id = tm.id and x.deleted_at is null;
        if cur.id is null then
          insert into partner.contract_term (contract_id, term_id, value_before, value_after)
          values (cid, tm.id, (t ->> 'before')::numeric, (t ->> 'after')::numeric);
        else
          perform audit.write_fields('partner.contract_term', cur.id,
            pg_catalog.jsonb_build_object('value_before', t -> 'before', 'value_after', t -> 'after'));
        end if;
      end loop;
      update partner.contract_term set deleted_at = pg_catalog.now(), deleted_by = me,
                                       delete_reason = coalesce(p_reason, 'term removed')
      where contract_id = cid and deleted_at is null and not (term_id = any (keep));
    end if;
  exception
    when not_null_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'contract.invalid', detail = what;
    when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = 'contract.invalid', detail = what;
    when data_exception then
      raise exception using errcode = 'P0001', message = 'contract.invalid', detail = sqlerrm;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'version', (select x.version from partner.contract x where x.id = cid),
                                       'request_id', req);
end
$$;

create function partner.contracts_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'full');
  req uuid;
  k int;
begin
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if exists (select 1 from pg_catalog.unnest(p_ids) i(id) where not exists (
               select 1 from partner.contract c join partner.partner p on p.id = c.partner_id
               where c.id = i.id and c.deleted_at is null and p.archived_at is null)) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'contract.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update partner.contract set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- A partner's contracts for the card and the evidence picker (View on Partners): status, reminder days in force,
-- terms before → after (and whether each is logged as an achievement), and the documents the reader may see.
create function partner.contracts(p_partner uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'view');
  days jsonb := core.setting_at('partner.contract_reminder_days', null, core.riyadh_today());
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'title', c.title, 'start_on', c.start_on, 'end_on', c.end_on,
      'reminders_on', c.reminders_on, 'reminder_days', c.reminder_days,
      'reminder_days_in_force', case when c.reminders_on and c.end_on is not null
                                     then coalesce(pg_catalog.to_jsonb(c.reminder_days), days) else '[]'::jsonb end,
      'renewal_task_id', c.renewal_task_id, 'notes', c.notes, 'version', c.version,
      'terms', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', t.id, 'term', tm.key, 'name_en', tm.name_en, 'name_ar', tm.name_ar, 'unit', tm.unit,
          'before', t.value_before, 'after', t.value_after, 'achievement_id', t.achievement_id,
          'logged', t.achievement_id is not null, 'version', t.version) order by tm.sort, tm.key)
        from partner.contract_term t join partner.term tm on tm.id = t.term_id
        where t.contract_id = c.id and t.deleted_at is null), '[]'::jsonb),
      'files', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', f.id, 'purpose', l.purpose, 'display_name_en', core.file_display_name(f.id, 'en'),
          'display_name_ar', core.file_display_name(f.id, 'ar'), 'mime', f.mime, 'size_bytes', f.size_bytes,
          'sensitivity', f.sensitivity) order by f.created_at, f.id)
        from core.file_link l join core.file f on f.id = l.file_id
        where l.entity_table = 'partner.contract' and l.entity_id = c.id and l.deleted_at is null
          and f.deleted_at is null and authz.file_visible(f.id)), '[]'::jsonb))
      || partner.contract_state(c.start_on, c.end_on)
      order by c.start_on desc, c.id)
    from partner.contract c where c.partner_id = p_partner and c.deleted_at is null), '[]'::jsonb);
end
$$;

-- The contract-expiring alert (V56, §3.3): on each reminder day before a contract's end (its own days, else the
-- setting; none when its reminders are off), the partner's account manager, the followers of the partner or the
-- contract and — when partner.contract_notify says so — the head of the account manager's department (the commercial
-- manager). The alerts job makes it once per person, contract and reminder day.
create function notify.alert_contract_expiring() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  with s as (
    select coalesce(core.setting_at('partner.contract_notify', null, core.riyadh_today()), '{}'::jsonb) as who,
           (select pg_catalog.array_agg(x::int) from pg_catalog.jsonb_array_elements_text(
              core.setting_at('partner.contract_reminder_days', null, core.riyadh_today())) x) as days
  ), c as (
    select k.id, k.partner_id, k.title, k.end_on, k.end_on - core.riyadh_today() as days_left, p.number, p.trade_name_en,
           p.trade_name_ar
    from partner.contract k join partner.partner p on p.id = k.partner_id
    where k.deleted_at is null and k.reminders_on and k.end_on is not null and p.deleted_at is null
      and p.archived_at is null
      and (k.end_on - core.riyadh_today()) = any (coalesce(k.reminder_days, (select s.days from s)))
  ), who as (
    select c.id as contract_id, o.person_id from c cross join lateral partner.owners(c.partner_id) o(person_id)
    where coalesce(((select s.who from s) ->> 'account_manager')::boolean, true)
    union
    select c.id, f.person_id from c join notify.follow f
      on (f.entity_table = 'partner.partner' and f.entity_id = c.partner_id)
      or (f.entity_table = 'partner.contract' and f.entity_id = c.id)
    where coalesce(((select s.who from s) ->> 'followers')::boolean, true)
    union
    select c.id, d.head_person_id from c cross join lateral partner.owners(c.partner_id) o(person_id)
      join core.person pe on pe.id = o.person_id join core.department d on d.id = pe.department_id
    where coalesce(((select s.who from s) ->> 'commercial_manager')::boolean, false) and d.head_person_id is not null
  )
  select w.person_id, 'contract_expiring:' || c.id || ':' || c.days_left, 'partner.contract', c.id,
         'alert.contract_expiring',
         pg_catalog.jsonb_build_object('partner_id', c.partner_id, 'number', c.number, 'partner_en', c.trade_name_en,
                                       'partner_ar', c.trade_name_ar, 'title', c.title, 'days', c.days_left,
                                       'end_on', c.end_on)
  from who w join c on c.id = w.contract_id
$$;

-- ================================================================ the partner card and list, merge (V136, V141)
-- partner.partner_get as P3-8a wrote it, plus the last feedback date and the tab counts.
create or replace function partner.partner_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'view');
  p partner.partner;
begin
  select * into p from partner.partner where id = p_id and deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return pg_catalog.to_jsonb(p) - array['deleted_at', 'deleted_by', 'delete_reason'] || pg_catalog.jsonb_build_object(
    'status', partner.status_of(p.id),
    'status_history', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', s.id, 'status', s.status, 'effective_on', s.effective_on, 'reason_id', s.reason_id, 'note', s.note,
        'set_by', s.created_by, 'set_at', s.created_at) order by s.effective_on desc, s.created_at desc)
      from partner.status_change s where s.partner_id = p.id and s.deleted_at is null), '[]'::jsonb),
    'last_feedback_on', (select pg_catalog.max(n.occurred_on) from core.note n
                         where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.kind = 'feedback'
                           and n.deleted_at is null),
    'roles', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', r.id, 'role', ro.key, 'subkind', r.subkind, 'fields', r.field_values, 'since', r.since, 'until', r.until,
        'version', r.version) order by ro.sort)
      from partner.partner_role r join partner.role ro on ro.id = r.role_id
      where r.partner_id = p.id and r.deleted_at is null), '[]'::jsonb),
    'identifiers', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'subkind', i.subkind, 'value', i.value_raw, 'valid_from', i.valid_from,
        'valid_to', i.valid_to, 'source', i.source, 'reason', i.reason, 'added_by', i.created_by, 'added_at', i.created_at)
        order by i.kind, i.created_at)
      from partner.identifier i where i.partner_id = p.id and i.deleted_at is null), '[]'::jsonb),
    'account_managers', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', m.id, 'person_id', m.person_id, 'from', m.effective_from, 'to', m.effective_to, 'reason', m.reason)
        order by m.effective_from desc)
      from partner.account_manager m where m.partner_id = p.id and m.deleted_at is null), '[]'::jsonb),
    'owner_id', (select x from partner.owners(p.id) x limit 1),
    'contacts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) - array['deleted_at', 'deleted_by',
        'delete_reason', 'created_by', 'updated_by'] order by c.is_primary desc, c.name_en)
      from partner.contact c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb),
    'credit_limits', case when authz.level_of(me, 'finance') >= 'view' then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', c.id, 'amount_sar', c.amount_sar, 'prepaid_only', c.amount_sar = 0, 'effective_from', c.effective_from,
          'approved_by', c.approved_by, 'reason', c.reason) order by c.effective_from desc)
        from partner.credit_limit c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb) end,
    'counts', pg_catalog.jsonb_build_object(
      'contracts', (select pg_catalog.count(*) from partner.contract c where c.partner_id = p.id and c.deleted_at is null),
      'files', (select pg_catalog.count(*) from core.file_link l join core.file f on f.id = l.file_id
                where l.entity_table = 'partner.partner' and l.entity_id = p.id and l.deleted_at is null
                  and f.deleted_at is null and l.purpose <> 'logo' and authz.file_visible(f.id)),
      'notes', (select pg_catalog.count(*) from core.note n
                where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.deleted_at is null)));
end
$$;

-- partner.partners_list as P3-8a wrote it, plus each row's computed flags (for its one status chip): contract_expiring
-- when a live contract is in its expiring days. Collection due, Sent to legal and Tender open join with their steps.
create or replace function partner.partners_list(p_filters jsonb default '{}', p_limit int default 100, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'view');
  f jsonb := coalesce(p_filters, '{}');
  q text := norm.fold(f ->> 'q');
  today date := core.riyadh_today();
  soon int := coalesce((core.setting_at('partner.contract_expiring_from_days', null, core.riyadh_today()) #>> '{}')::int, 30);
begin
  return (
    with base as (
      select p.*, partner.status_of(p.id) as status,
             (select m.person_id from partner.account_manager m where m.partner_id = p.id and m.deleted_at is null
                and m.effective_from <= today and (m.effective_to is null or m.effective_to > today)
              limit 1) as owner_id,
             (select pg_catalog.array_agg(ro.key order by ro.sort) from partner.partner_role r join partner.role ro on ro.id = r.role_id
              where r.partner_id = p.id and r.deleted_at is null) as roles,
             exists (select 1 from partner.contract k where k.partner_id = p.id and k.deleted_at is null
                       and k.start_on <= today and k.end_on >= today and k.end_on - today <= soon) as contract_expiring
      from partner.partner p
      where p.deleted_at is null and (coalesce((f ->> 'include_archived')::boolean, false) or p.archived_at is null)
    ), hit as (
      select b.* from base b
      left join partner.segment s on s.id = b.segment_id
      where (q is null or norm.fold(b.trade_name_en) like '%' || q || '%' or norm.fold(b.trade_name_ar) like '%' || q || '%'
             or norm.fold(b.number) like '%' || q || '%')
        and (f -> 'roles' is null or b.roles && (select pg_catalog.array_agg(x) from pg_catalog.jsonb_array_elements_text(f -> 'roles') x))
        and (f -> 'segments' is null or s.key in (select x from pg_catalog.jsonb_array_elements_text(f -> 'segments') x))
        and (f -> 'owners' is null or b.owner_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'owners') x))
        and (f -> 'statuses' is null or coalesce(b.status, 'none') in (select x from pg_catalog.jsonb_array_elements_text(f -> 'statuses') x))
        and (f ->> 'key_partner' is null or b.key_partner = (f ->> 'key_partner')::boolean)
    )
    select pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*) from hit),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', h.id, 'number', h.number, 'trade_name_en', h.trade_name_en, 'trade_name_ar', h.trade_name_ar,
          'roles', coalesce(pg_catalog.to_jsonb(h.roles), '[]'), 'segment_id', h.segment_id, 'status', h.status,
          'owner_id', h.owner_id, 'priority_id', h.priority_id, 'key_partner', h.key_partner,
          'logo_file_id', h.logo_file_id, 'archived', h.archived_at is not null, 'version', h.version,
          'flags', case when h.contract_expiring then '["contract_expiring"]'::jsonb else '[]'::jsonb end)
          order by pg_catalog.lower(h.trade_name_en), h.id)
        from (select * from hit order by pg_catalog.lower(hit.trade_name_en), hit.id
              limit greatest(1, least(coalesce(p_limit, 100), 500)) offset greatest(coalesce(p_offset, 0), 0)) h), '[]'::jsonb)));
end
$$;

-- partner.partner_merge as P3-8a wrote it (V136), now also moving the merged partner's notes, files and contracts to
-- the kept one; its logo too when the kept one has none. Still one request, so one Undo.
create or replace function partner.partner_merge(p_kept uuid, p_merged uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  kept partner.partner := partner.writable(p_kept);
  gone partner.partner := partner.writable(p_merged);
  me uuid := authz.require_capability('partners.merge');
  why text := core.access_reason(p_reason);
  i partner.identifier;
  req uuid;
begin
  if p_kept = p_merged then
    raise exception using errcode = 'P0001', message = 'partner.merge_itself';
  end if;
  req := audit.begin('ui', 'partner.merged', pg_catalog.jsonb_build_object('kept', kept.number, 'merged', gone.number), why);
  insert into partner.merge (kept_id, merged_id, reason, request_id) values (p_kept, p_merged, why, req);
  for i in select * from partner.identifier x where x.partner_id = p_merged and x.deleted_at is null order by x.created_at loop
    update partner.identifier set deleted_at = pg_catalog.now(), deleted_by = me,
                                  delete_reason = 'merged into ' || kept.number
    where id = i.id;
    if not exists (select 1 from partner.identifier x where x.partner_id = p_kept and x.kind = i.kind
                   and x.value_key = i.value_key and x.deleted_at is null) then
      insert into partner.identifier (partner_id, kind, subkind, value_raw, value_key, norm_version, reason, source,
                                      valid_from, valid_to, note)
      values (p_kept, i.kind, case when i.kind = 'name' then 'alias' else i.subkind end, i.value_raw, i.value_key,
              i.norm_version, why, 'merge', i.valid_from, i.valid_to, i.note);
    end if;
  end loop;
  insert into partner.partner_role (partner_id, role_id, subkind, field_values, since, until)
  select p_kept, r.role_id, r.subkind, r.field_values, r.since, r.until from partner.partner_role r
  where r.partner_id = p_merged and r.deleted_at is null
    and not exists (select 1 from partner.partner_role x where x.partner_id = p_kept and x.role_id = r.role_id
                    and x.deleted_at is null);
  update partner.contact set partner_id = p_kept, is_primary = false where partner_id = p_merged and deleted_at is null;
  update partner.contract set partner_id = p_kept where partner_id = p_merged and deleted_at is null;
  update core.note set entity_id = p_kept
  where entity_table = 'partner.partner' and entity_id = p_merged and deleted_at is null;
  if kept.logo_file_id is null and gone.logo_file_id is not null then
    update partner.partner set logo_file_id = gone.logo_file_id where id = p_kept;
  end if;
  update core.file_link l set entity_id = p_kept
  where l.entity_table = 'partner.partner' and l.entity_id = p_merged and l.deleted_at is null
    and (l.purpose <> 'logo' or (kept.logo_file_id is null and l.file_id = gone.logo_file_id))
    and not exists (select 1 from core.file_link x where x.file_id = l.file_id and x.entity_table = 'partner.partner'
                    and x.entity_id = p_kept and x.purpose = l.purpose and x.deleted_at is null);
  update partner.partner set archived_at = pg_catalog.now(), merged_into_id = p_kept where id = p_merged;
  perform audit.end();
  return pg_catalog.jsonb_build_object('kept', p_kept, 'merged', p_merged, 'request_id', req);
end
$$;

-- ================================================================ grants and the door (V124)
grant execute on function core.note_add(text, uuid, text, text, date, uuid[]), core.note_edit(uuid, text, int, uuid[], date),
  core.notes_remove(uuid[], text), core.notes(text, uuid, text[], timestamptz, int),
  partner.log_call(uuid, text, text, date, uuid[]),
  core.file_begin(text, uuid, text, text, text, bigint, text, text), core.file_finish(uuid, text), core.files(text, uuid),
  core.file_download(uuid, text), core.files_remove(uuid[], text),
  partner.contract_save(uuid, uuid, jsonb, int, text), partner.contracts_remove(uuid[], text), partner.contracts(uuid)
  to authenticated;

create function api.note_add(p_entity text, p_id uuid, p_kind text, p_body text, p_occurred_on date default null,
                             p_mentions uuid[] default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.note_add(p_entity, p_id, p_kind, p_body, p_occurred_on, p_mentions) $$;
create function api.note_edit(p_id uuid, p_body text, p_version int, p_mentions uuid[] default null,
                              p_occurred_on date default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.note_edit(p_id, p_body, p_version, p_mentions, p_occurred_on) $$;
create function api.notes_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.notes_remove(p_ids, p_reason) $$;
create function api.notes(p_entity text, p_id uuid, p_kinds text[] default null, p_before timestamptz default null,
                          p_limit int default 50) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.notes(p_entity, p_id, p_kinds, p_before, p_limit) $$;
create function api.partner_log_call(p_partner uuid, p_outcome text, p_note text default null, p_occurred_on date default null,
                                     p_mentions uuid[] default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.log_call(p_partner, p_outcome, p_note, p_occurred_on, p_mentions) $$;
create function api.file_begin(p_entity text, p_id uuid, p_kind text, p_purpose text, p_original_name text, p_size bigint,
                               p_mime text, p_sensitivity text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.file_begin(p_entity, p_id, p_kind, p_purpose, p_original_name, p_size, p_mime, p_sensitivity) $$;
create function api.file_finish(p_id uuid, p_sha256 text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.file_finish(p_id, p_sha256) $$;
create function api.files(p_entity text, p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.files(p_entity, p_id) $$;
create function api.file_download(p_id uuid, p_locale text default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.file_download(p_id, p_locale) $$;
create function api.files_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.files_remove(p_ids, p_reason) $$;
create function api.contract_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null,
                                  p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.contract_save(p_partner, p_id, p_values, p_version, p_reason) $$;
create function api.contracts_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.contracts_remove(p_ids, p_reason) $$;
create function api.contracts(p_partner uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select partner.contracts(p_partner) $$;

grant execute on function api.note_add(text, uuid, text, text, date, uuid[]), api.note_edit(uuid, text, int, uuid[], date),
  api.notes_remove(uuid[], text), api.notes(text, uuid, text[], timestamptz, int),
  api.partner_log_call(uuid, text, text, date, uuid[]),
  api.file_begin(text, uuid, text, text, text, bigint, text, text), api.file_finish(uuid, text), api.files(text, uuid),
  api.file_download(uuid, text), api.files_remove(uuid[], text),
  api.contract_save(uuid, uuid, jsonb, int, text), api.contracts_remove(uuid[], text), api.contracts(uuid)
  to authenticated;

-- ================================================================ the starting file kinds (generic words)
select audit.begin('system', 'core.file_kinds_seeded');
insert into core.file_kind (key, name_en, name_ar, name_pattern_en, name_pattern_ar, sensitivity, sort) values
  ('invoice', 'Invoice', 'فاتورة', '{number} · {partner} · {amount} SAR · {date}', '{number} · {partner} · {amount} ر.س · {date}', 'normal', 10),
  ('contract', 'Contract', 'عقد', 'Contract · {partner official} · {title} · {start} to {end}',
   'عقد · {partner official} · {title} · {start} إلى {end}', 'normal', 20),
  ('agreement', 'Agreement', 'اتفاقية', 'Agreement · {partner official} · {title} · {start} to {end}',
   'اتفاقية · {partner official} · {title} · {start} إلى {end}', 'restricted', 30),
  ('rate_sheet', 'Rate sheet', 'جدول الأسعار', 'Rate sheet · {partner} · {date}', 'جدول الأسعار · {partner} · {date}', 'normal', 40),
  ('certificate', 'Certificate', 'شهادة', 'Certificate · {partner} · {date}', 'شهادة · {partner} · {date}', 'normal', 50),
  ('meeting_note', 'Meeting note', 'محضر اجتماع', 'Meeting note · {record} · {date}', 'محضر اجتماع · {record} · {date}', 'normal', 60),
  ('evidence', 'Evidence', 'دليل', 'Evidence · {record} · {date}', 'دليل · {record} · {date}', 'normal', 70),
  ('report', 'Report', 'تقرير', 'Report · {record} · {date}', 'تقرير · {record} · {date}', 'normal', 80),
  ('legacy_report', 'Legacy report', 'تقرير سابق', '{original}', '{original}', 'normal', 90),
  ('logo', 'Logo', 'شعار', 'Logo · {partner}', 'شعار · {partner}', 'normal', 100),
  ('avatar', 'Photo', 'صورة', 'Photo · {person}', 'صورة · {person}', 'normal', 110),
  ('other', 'Other', 'أخرى', '{original}', '{original}', 'normal', 120);
select audit.end();
