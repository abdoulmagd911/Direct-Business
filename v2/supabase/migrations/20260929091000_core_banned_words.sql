-- v2 the banned words cover the data too (V404): a list value, a side's field, the name of a department, a team or a
-- role, or a seed never carries one of V59's five names — nor "B2G", which joins them beside "B2B"; the segment is
-- Government. Google, Zoom, the sign-in tick and GMV are banned on screens only (V59, V73, V74): in data they are
-- ordinary words — a meeting channel, a reference system (QA-67). core.banned_word names the first one a text carries;
-- the list editor and the side-field editor refuse a value that carries one, and the three org tables a name, naming
-- it. The words check (scripts/checks/forbidden-words.mjs) holds the same data list and scans the seeds of every
-- migration from this one on; WORDS-01 scans the database built from zero. V156. Forward-only (V103).

-- The banned word a text carries, or null: spacing, hyphens and case do not matter ("Direct-KSA", "b 2 g").
create function core.banned_word(p text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select w.label from (values
  -- check-allow: forbidden-words — the database's own copy of the banned words (V404)
    (1, '\mdirect[[:space:]_.-]*ksa\M', 'Direct KSA'),
  -- check-allow: forbidden-words — the database's own copy of the banned words (V404)
    (2, '\mdirect[[:space:]_.-]*corporate\M', 'Direct Corporate'),
  -- check-allow: forbidden-words — the database's own copy of the banned words (V404)
    (3, '\mb[[:space:]_.-]*2[[:space:]_.-]*b\M', 'B2B'),
  -- check-allow: forbidden-words — the database's own copy of the banned words (V404)
    (4, '\mb[[:space:]_.-]*2[[:space:]_.-]*g\M', 'B2G'),
  -- check-allow: forbidden-words — the database's own copy of the banned words (V404)
    (5, '\mmice\M', 'MICE')) w(n, re, label)
  where coalesce(p, '') ~* w.re
  order by w.n
  limit 1
$$;
comment on function core.banned_word(text) is 'The first banned word in data (V59, V404) a text carries, or null — the words check holds the same list (FORBIDDEN_IN_DATA).';

-- A department, a team or a role is named on every person's card and in Organization & access: its names carry no
-- banned word either, whichever door saves them (QA-68). A name left as it was is not asked again.
create function core.name_banned() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  bad text;
begin
  if tg_op = 'UPDATE' and new.name_en is not distinct from old.name_en and new.name_ar is not distinct from old.name_ar then
    return new;
  end if;
  bad := core.banned_word(pg_catalog.concat_ws(' · ', new.name_en, new.name_ar));
  if bad is not null then
    raise exception using errcode = 'P0001', message = 'list.banned_word', detail = bad;
  end if;
  return new;
end
$$;
create trigger name_banned before insert or update on core.department for each row execute function core.name_banned();
create trigger name_banned before insert or update on core.team for each row execute function core.name_banned();
create trigger name_banned before insert or update on core.role for each row execute function core.name_banned();

-- core.list_save as P3-6d wrote it, refusing a value that carries a banned word.
create or replace function core.list_save(p_list text, p_id uuid, p_values jsonb, p_version int default null,
                                          p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.list_entity(p_list);
  me uuid := authz.require(e.page_key, 'full');
  t regclass := pg_catalog.to_regclass(e.table_name);
  cols text[];
  k text;
  cur jsonb;
  rid uuid;
  req uuid;
  what text;
  bad text;
begin
  select pg_catalog.array_agg(a.attname::text) into cols from pg_catalog.pg_attribute a
  where a.attrelid = t and a.attnum > 0 and not a.attisdropped
    and a.attname::text not in ('id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'version', 'deleted_at',
                                'deleted_by', 'delete_reason', 'meaning');
  if p_values is null or pg_catalog.jsonb_typeof(p_values) <> 'object' then
    raise exception using errcode = 'P0001', message = 'list.nothing_to_change';
  end if;
  if p_values ? 'meaning' then
    raise exception using errcode = 'P0001', message = 'list.meaning_locked';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_values) loop
    if not (k = any (cols)) then
      raise exception using errcode = 'P0001', message = 'list.unknown_field', detail = k;
    end if;
  end loop;
  bad := (select core.banned_word(x.value) from pg_catalog.jsonb_each_text(p_values) x
          where core.banned_word(x.value) is not null limit 1);
  if bad is not null then
    raise exception using errcode = 'P0001', message = 'list.banned_word', detail = bad;
  end if;
  begin
    if p_id is null then
      req := audit.begin('ui', 'list.saved', pg_catalog.jsonb_build_object('list', p_list), p_reason);
      execute pg_catalog.format('insert into %s (%s) select %s from pg_catalog.jsonb_populate_record(null::%s, $1) x returning id',
        t, (select pg_catalog.string_agg(pg_catalog.quote_ident(c), ', ') from pg_catalog.jsonb_object_keys(p_values) c),
        (select pg_catalog.string_agg('x.' || pg_catalog.quote_ident(c), ', ') from pg_catalog.jsonb_object_keys(p_values) c),
        t)
        into rid using p_values;
    else
      execute pg_catalog.format('select pg_catalog.to_jsonb(t) from %s t where t.id = $1 and t.deleted_at is null', t)
        into cur using p_id;
      if cur is null then
        raise exception using errcode = 'P0002', message = 'common.not_found';
      end if;
      if p_values ? 'key' and (p_values -> 'key') is distinct from (cur -> 'key') then
        raise exception using errcode = 'P0001', message = 'list.key_fixed';
      end if;
      perform core.check_version(e.table_name, p_id, p_version,
        (select pg_catalog.array_agg(c) from pg_catalog.jsonb_object_keys(p_values) c where (cur -> c) is distinct from (p_values -> c)));
      req := audit.begin('ui', 'list.saved', pg_catalog.jsonb_build_object('list', p_list), p_reason);
      perform audit.write_fields(e.table_name, p_id, p_values);
      rid := p_id;
    end if;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'list.key_taken', detail = p_values ->> 'key';
    when not_null_violation or check_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'list.invalid', detail = coalesce(nullif(what, ''), sqlerrm);
  end;
  perform audit.end();
  execute pg_catalog.format('select pg_catalog.jsonb_build_object(''id'', t.id, ''version'', t.version) from %s t where t.id = $1', t)
    into cur using rid;
  return cur || pg_catalog.jsonb_build_object('request_id', req);
end
$$;

-- partner.side_field_save as P3-8b-1 wrote it, refusing a label or an option that carries a banned word.
create or replace function partner.side_field_save(p_id uuid, p_values jsonb, p_version int default null, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.partners', 'full');
  cur partner.side_field;
  k text;
  req uuid;
  fid uuid;
  what text;
  bad text;
begin
  if p_values is null or pg_catalog.jsonb_typeof(p_values) <> 'object' then
    raise exception using errcode = 'P0001', message = 'list.nothing_to_change';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_values) loop
    if k not in ('side', 'key', 'label_en', 'label_ar', 'type', 'required', 'options', 'sort') then
      raise exception using errcode = 'P0001', message = 'list.unknown_field', detail = k;
    end if;
  end loop;
  bad := (select core.banned_word(x.value) from pg_catalog.jsonb_each_text(p_values) x
          where core.banned_word(x.value) is not null limit 1);
  if bad is not null then
    raise exception using errcode = 'P0001', message = 'list.banned_word', detail = bad;
  end if;
  begin
    if p_id is null then
      req := audit.begin('ui', 'partner.side_field_saved', null, p_reason);
      insert into partner.side_field (side, key, label_en, label_ar, type, required, options, sort)
      select x.side, x.key, x.label_en, x.label_ar, x.type, coalesce(x.required, false), x.options, coalesce(x.sort, 0)
      from pg_catalog.jsonb_populate_record(null::partner.side_field, p_values) x
      returning id into fid;
    else
      select * into cur from partner.side_field where id = p_id and deleted_at is null;
      if cur.id is null then
        raise exception using errcode = 'P0002', message = 'common.not_found';
      end if;
      if (p_values ? 'key' and p_values ->> 'key' is distinct from cur.key)
         or (p_values ? 'side' and p_values ->> 'side' is distinct from cur.side) then
        raise exception using errcode = 'P0001', message = 'list.key_fixed';
      end if;
      perform core.check_version('partner.side_field', p_id, p_version,
        (select pg_catalog.array_agg(c) from pg_catalog.jsonb_object_keys(p_values) c
         where (pg_catalog.to_jsonb(cur) -> c) is distinct from (p_values -> c)));
      req := audit.begin('ui', 'partner.side_field_saved', null, p_reason);
      perform audit.write_fields('partner.side_field', p_id, p_values);
      fid := p_id;
    end if;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'list.key_taken', detail = p_values ->> 'key';
    when check_violation then
      get stacked diagnostics what = constraint_name;
      if what = 'side_field_no_secrets' then
        raise exception using errcode = 'P0001', message = 'partner.no_secrets',
          detail = 'Cards hold references to Direct''s systems, never passwords.';
      end if;
      raise exception using errcode = 'P0001', message = 'list.invalid', detail = coalesce(nullif(what, ''), sqlerrm);
    when not_null_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'list.invalid', detail = coalesce(nullif(what, ''), sqlerrm);
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', fid, 'version', (select x.version from partner.side_field x where x.id = fid),
                                       'request_id', req);
end
$$;
