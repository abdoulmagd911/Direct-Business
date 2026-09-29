-- v2 partners, part 1 — the doors (P3-8a): setting lists, partners and their names as identifiers, roles, status,
-- account managers, bulk assign, identifiers and codes, contacts, credit limits, merge, and the reads (list, card,
-- search, hover cards). TECH-SPEC §3.0, §3.4, §3.5; V26, V52, V62–V65, V70, V77, V78, V92; V133–V136. Every function
-- the Data API reaches is a security-invoker wrapper (V124). Forward-only (V103).

-- ================================================================ owners (§3.3, V127)
-- A partner's owners are its account managers today; each record of a partner is owned by its partner's owners.
create function partner.owners(p_partner uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.person_id from partner.account_manager m
  where m.partner_id = p_partner and m.deleted_at is null and m.effective_from <= core.riyadh_today()
    and (m.effective_to is null or m.effective_to > core.riyadh_today())
$$;

create function partner.owners_via(p_table text, p_id uuid) returns setof uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  pid uuid;
begin
  execute pg_catalog.format('select t.partner_id from %s t where t.id = $1', pg_catalog.to_regclass(p_table))
    into pid using p_id;
  return query select partner.owners(pid);
end
$$;

create function partner.partner_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners(p_id) $$;
create function partner.partner_role_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners_via('partner.partner_role', p_id) $$;
create function partner.status_change_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners_via('partner.status_change', p_id) $$;
create function partner.credit_limit_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners_via('partner.credit_limit', p_id) $$;
create function partner.identifier_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners_via('partner.identifier', p_id) $$;
create function partner.account_manager_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select partner.owners_via('partner.account_manager', p_id) union select m.person_id from partner.account_manager m where m.id = p_id $$;
create function partner.contact_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners_via('partner.contact', p_id) $$;

-- ================================================================ setting lists (§3.0, V76, V133)
create function core.list_entity(p_list text) returns core.entity
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
begin
  select * into e from core.entity x where x.key = p_list and x.active and x.is_list
    and (select pg_catalog.count(*) from pg_catalog.pg_attribute a
         where a.attrelid = pg_catalog.to_regclass(x.table_name) and a.attnum > 0 and not a.attisdropped
           and a.attname = any (core.list_columns())) = pg_catalog.cardinality(core.list_columns());
  if e.id is null then
    raise exception using errcode = 'P0002', message = 'list.unknown', detail = p_list;
  end if;
  return e;
end
$$;

-- A list's entries, for every signed-in person (labels are read everywhere); retired ones only when asked.
create function core.list_items(p_list text, p_include_retired boolean default false) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
  r jsonb;
begin
  if authz.me() is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  e := core.list_entity(p_list);
  execute pg_catalog.format(
    'select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) - array[''created_at'', ''created_by'', ''updated_at'','
    || ' ''updated_by''] order by t.sort, t.name_en), ''[]''::jsonb) from %s t where $1 or t.active',
    pg_catalog.to_regclass(e.table_name))
    into r using p_include_retired;
  return r;
end
$$;

-- Add or change a list entry: Full on the list's settings page. Both names are required (V76); a key never changes;
-- an entry is retired (active false), never deleted (M40).
create function core.list_save(p_list text, p_id uuid, p_values jsonb, p_version int default null,
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
begin
  select pg_catalog.array_agg(a.attname::text) into cols from pg_catalog.pg_attribute a
  where a.attrelid = t and a.attnum > 0 and not a.attisdropped
    and a.attname::text not in ('id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'version', 'deleted_at',
                                'deleted_by', 'delete_reason');
  if p_values is null or pg_catalog.jsonb_typeof(p_values) <> 'object' then
    raise exception using errcode = 'P0001', message = 'list.nothing_to_change';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_values) loop
    if not (k = any (cols)) then
      raise exception using errcode = 'P0001', message = 'list.unknown_field', detail = k;
    end if;
  end loop;
  begin
    if p_id is null then
      req := audit.begin('ui', 'list.saved', pg_catalog.jsonb_build_object('list', p_list), p_reason);
      execute pg_catalog.format('insert into %s (%s) select %s from pg_catalog.jsonb_populate_record(null::%s, $1) x returning id',
        t, (select pg_catalog.string_agg(pg_catalog.quote_ident(c), ', ') from pg_catalog.jsonb_object_keys(p_values) c),
        (select pg_catalog.string_agg('x.' || pg_catalog.quote_ident(c), ', ') from pg_catalog.jsonb_object_keys(p_values) c),
        t)
        into rid using p_values;
    else
      execute pg_catalog.format('select pg_catalog.to_jsonb(t) from %s t where t.id = $1', t) into cur using p_id;
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

-- ================================================================ helpers
create function partner.stop_words() returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce((select pg_catalog.array_agg(x) from pg_catalog.jsonb_array_elements_text(
                     core.setting_at('partner.name_stop_words', null, core.riyadh_today())) x), '{}')
$$;

-- A live partner the caller may change (Full on Partners — D7, helpers not locks); archived and merged ones are read-only.
create function partner.writable(p_id uuid) returns partner.partner
language plpgsql stable security definer set search_path = ''
as $$
declare
  p partner.partner;
begin
  perform authz.require('partners', 'full');
  select * into p from partner.partner where id = p_id and deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'partner.archived';
  end if;
  return p;
end
$$;

-- Who holds a value now, for a refusal that names them.
create function partner.holder(p_kind text, p_key text) returns text
language sql stable security definer set search_path = ''
as $$
  select p.number || ' · ' || p.trade_name_en from partner.identifier i join partner.partner p on p.id = i.partner_id
  where i.kind = p_kind and i.value_key = p_key and i.deleted_at is null limit 1
$$;

-- Adds one identifier, or refuses in words: a blocked value, an empty key, a value another partner holds (V133).
create function partner.identifier_insert(p_partner uuid, p_kind text, p_value text, p_subkind text, p_reason text,
                                          p_source text default 'person', p_valid_from date default null,
                                          p_valid_to date default null, p_note text default null) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  k text := norm.key(p_kind, p_value, partner.stop_words());
  blocked text;
  new_id uuid;
begin
  if k is null then
    raise exception using errcode = 'P0001', message = 'identifier.empty_key', detail = p_kind;
  end if;
  select b.reason into blocked from partner.identifier_block b
  where b.kind = p_kind and b.deleted_at is null
    and ((b.match = 'exact' and b.value_key = k) or (b.match = 'domain' and k like '%@' || b.value_key))
  limit 1;
  if blocked is not null then
    raise exception using errcode = 'P0001', message = 'identifier.blocked', detail = blocked;
  end if;
  begin
    insert into partner.identifier (partner_id, kind, subkind, value_raw, value_key, norm_version, reason, source,
                                    valid_from, valid_to, note)
    values (p_partner, p_kind, p_subkind, pg_catalog.btrim(p_value), k, norm.version(), p_reason, p_source,
            p_valid_from, p_valid_to, p_note)
    returning identifier.id into new_id;
  exception when unique_violation or exclusion_violation then
    raise exception using errcode = '23505', message = 'identifier.held',
      detail = coalesce(partner.holder(p_kind, k), pg_catalog.format('%s %s', p_kind, k));
  end;
  return new_id;
end
$$;

-- The four names are identifiers (V77): one per distinct name key, labelled by the first of trade_en, trade_ar,
-- official_en, official_ar that gives it. A rename removes what no longer holds (a key, or the name a key now comes
-- from) and adds what is new, in the same request; an alias is left alone.
create function partner.names_sync(p_partner uuid, p_reason text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner;
  me uuid := authz.me();
  want record;
  stop text[] := partner.stop_words();
  wanted jsonb;
begin
  select * into p from partner.partner where id = p_partner;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('k', x.k, 'sub', x.sub, 'v', x.v)), '[]') into wanted
  from (select distinct on (norm.name_key(n.v, stop)) norm.name_key(n.v, stop) as k, n.sub, n.v
        from (values (p.trade_name_en, 'trade_en', 1), (p.trade_name_ar, 'trade_ar', 2),
                     (p.official_name_en, 'official_en', 3), (p.official_name_ar, 'official_ar', 4)) n(v, sub, ord)
        where norm.name_key(n.v, stop) is not null
        order by norm.name_key(n.v, stop), n.ord) x;
  update partner.identifier i set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'name changed'
  where i.partner_id = p_partner and i.kind = 'name' and i.subkind <> 'alias' and i.deleted_at is null
    and not exists (select 1 from pg_catalog.jsonb_array_elements(wanted) w
                    where w ->> 'k' = i.value_key and w ->> 'sub' = i.subkind);
  for want in select w ->> 'k' as k, w ->> 'sub' as sub, w ->> 'v' as v from pg_catalog.jsonb_array_elements(wanted) w loop
    if not exists (select 1 from partner.identifier i where i.partner_id = p_partner and i.kind = 'name'
                   and i.value_key = want.k and i.subkind = want.sub and i.deleted_at is null) then
      update partner.identifier i set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'name changed'
      where i.partner_id = p_partner and i.kind = 'name' and i.value_key = want.k and i.deleted_at is null;
      perform partner.identifier_insert(p_partner, 'name', want.v, want.sub, coalesce(p_reason, 'partner name'));
    end if;
  end loop;
end
$$;

create function partner.fields(p_changes jsonb) returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  k text;
begin
  if p_changes is null or pg_catalog.jsonb_typeof(p_changes) <> 'object' then
    raise exception using errcode = 'P0001', message = 'partner.nothing_to_change';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_changes) loop
    if k not in ('trade_name_en', 'trade_name_ar', 'official_name_en', 'official_name_ar', 'category_id', 'tier_id',
                 'segment_id', 'priority_id', 'key_partner', 'website', 'city', 'country', 'address', 'notes',
                 'client_since') then
      raise exception using errcode = 'P0001', message = 'partner.unknown_field', detail = k;
    end if;
  end loop;
  if p_changes ? 'trade_name_en' and coalesce(pg_catalog.btrim(p_changes ->> 'trade_name_en'), '') = '' then
    raise exception using errcode = 'P0001', message = 'partner.trade_name_required';
  end if;
  return p_changes;
end
$$;

-- The status of a partner on a day (V62): the latest change effective on or before it; null when it never had one.
create function partner.status_of(p_partner uuid, p_on date default null) returns text
language sql stable security definer set search_path = ''
as $$
  select s.status from partner.status_change s
  where s.partner_id = p_partner and s.deleted_at is null and s.effective_on <= coalesce(p_on, core.riyadh_today())
  order by s.effective_on desc, s.created_at desc limit 1
$$;

-- ================================================================ partners: create, change, roles (V134)
create function partner.partner_create(p_partner jsonb, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'full');
  pv jsonb := partner.fields(p_partner - array['roles', 'account_manager_id']);
  fmt jsonb := core.setting_at('partner.id_format', null, core.riyadh_today());
  pid uuid;
  num text;
  req uuid;
  r text;
begin
  if not (pv ? 'trade_name_en') then
    raise exception using errcode = 'P0001', message = 'partner.trade_name_required';
  end if;
  if p_partner ->> 'account_manager_id' is not null and (p_partner ->> 'account_manager_id')::uuid <> me then
    perform authz.require_capability('partners.assign');
  end if;
  req := audit.begin('ui', 'partner.created', null, p_reason);
  -- partner numbers never restart: the counter's year 2000 row is their all-time row
  num := (fmt ->> 'prefix') || '-' || pg_catalog.lpad(core.next_number('partner', 2000)::text, coalesce((fmt ->> 'width')::int, 4), '0');
  insert into partner.partner (number, trade_name_en, trade_name_ar, official_name_en, official_name_ar, category_id,
                               tier_id, segment_id, priority_id, key_partner, website, city, country, address, notes,
                               client_since)
  select num, pg_catalog.btrim(x.trade_name_en), x.trade_name_ar, x.official_name_en, x.official_name_ar, x.category_id,
         x.tier_id, x.segment_id, x.priority_id, coalesce(x.key_partner, false), x.website, x.city, x.country, x.address,
         x.notes, x.client_since
  from pg_catalog.jsonb_populate_record(null::partner.partner, pv) x
  returning id into pid;
  perform partner.names_sync(pid, p_reason);
  for r in select pg_catalog.jsonb_array_elements_text(coalesce(p_partner -> 'roles', '[]')) loop
    insert into partner.partner_role (partner_id, role_id, since)
    select pid, ro.id, core.riyadh_today() from partner.role ro where ro.key = r and ro.active;
    if not found then
      raise exception using errcode = 'P0002', message = 'partner.unknown_role', detail = r;
    end if;
  end loop;
  if p_partner ->> 'account_manager_id' is not null then
    perform partner.manager_set_inner(pid, (p_partner ->> 'account_manager_id')::uuid, core.riyadh_today(), p_reason);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'number', num, 'version', 1, 'request_id', req);
end
$$;

create function partner.partner_update(p_id uuid, p_changes jsonb, p_version int, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_id);
  pv jsonb := partner.fields(p_changes);
  req uuid;
begin
  perform core.check_version('partner.partner', p_id, p_version,
    (select pg_catalog.array_agg(k) from pg_catalog.jsonb_object_keys(pv) k where (pg_catalog.to_jsonb(p) -> k) is distinct from (pv -> k)));
  req := audit.begin('ui', 'partner.updated', null, p_reason);
  perform audit.write_fields('partner.partner', p_id, pv);
  if pv ?| array['trade_name_en', 'trade_name_ar', 'official_name_en', 'official_name_ar'] then
    perform partner.names_sync(p_id, p_reason);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from partner.partner x where x.id = p_id),
                                       'request_id', req);
end
$$;

-- A role's own fields are checked against its definitions (V62): required ones present, each of its type.
create function partner.role_fields_check(p_role uuid, p_values jsonb) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  f partner.role_field;
  k text;
  v jsonb;
begin
  for k in select pg_catalog.jsonb_object_keys(coalesce(p_values, '{}')) loop
    if not exists (select 1 from partner.role_field x where x.role_id = p_role and x.key = k and x.deleted_at is null) then
      raise exception using errcode = 'P0001', message = 'partner.unknown_role_field', detail = k;
    end if;
  end loop;
  for f in select * from partner.role_field x where x.role_id = p_role and x.deleted_at is null loop
    v := p_values -> f.key;
    if v is null or v = 'null'::jsonb then
      if f.required then
        raise exception using errcode = 'P0001', message = 'partner.role_field_required', detail = f.key;
      end if;
      continue;
    end if;
    if not (case f.type
              when 'text' then pg_catalog.jsonb_typeof(v) = 'string'
              when 'number' then pg_catalog.jsonb_typeof(v) = 'number'
              when 'boolean' then pg_catalog.jsonb_typeof(v) = 'boolean'
              when 'date' then pg_catalog.jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$'
              when 'select' then exists (select 1 from pg_catalog.jsonb_array_elements(f.options) o where o -> 'key' = v)
            end) then
      raise exception using errcode = 'P0001', message = 'partner.role_field_invalid', detail = f.key;
    end if;
  end loop;
end
$$;

-- Set a partner's roles (V62): [{role, subkind, fields, since, until}] — roles left out are removed. One request.
create function partner.roles_set(p_id uuid, p_roles jsonb, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_id);
  me uuid := authz.me();
  x jsonb;
  ro partner.role;
  cur partner.partner_role;
  keep uuid[] := '{}';
  req uuid;
begin
  if pg_catalog.jsonb_typeof(p_roles) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'partner.roles_list_expected';
  end if;
  req := audit.begin('ui', 'partner.roles_set', null, p_reason);
  for x in select * from pg_catalog.jsonb_array_elements(p_roles) loop
    select * into ro from partner.role r where r.key = x ->> 'role' and r.active;
    if ro.id is null then
      raise exception using errcode = 'P0002', message = 'partner.unknown_role', detail = x ->> 'role';
    end if;
    perform partner.role_fields_check(ro.id, coalesce(x -> 'fields', '{}'));
    keep := keep || ro.id;
    select * into cur from partner.partner_role r where r.partner_id = p_id and r.role_id = ro.id and r.deleted_at is null;
    if cur.id is null then
      insert into partner.partner_role (partner_id, role_id, subkind, field_values, since, until)
      values (p_id, ro.id, x ->> 'subkind', coalesce(x -> 'fields', '{}'), coalesce((x ->> 'since')::date, core.riyadh_today()),
              (x ->> 'until')::date);
    else
      perform audit.write_fields('partner.partner_role', cur.id, pg_catalog.jsonb_build_object(
        'subkind', x -> 'subkind', 'field_values', coalesce(x -> 'fields', '{}'),
        'since', coalesce(x -> 'since', pg_catalog.to_jsonb(cur.since)), 'until', x -> 'until'));
    end if;
  end loop;
  update partner.partner_role set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = coalesce(p_reason, 'role removed')
  where partner_id = p_id and deleted_at is null and not (role_id = any (keep));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- ================================================================ status, account managers, bulk assign (V62, V63)
-- The account manager and anyone holding partners.assign set a partner's status; at risk and lost need a reason.
create function partner.status_set(p_id uuid, p_status text, p_effective_on date default null,
                                   p_reason_id uuid default null, p_note text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_id);
  me uuid := authz.me();
  req uuid;
  sid uuid;
begin
  if not (me in (select partner.owners(p_id))) then
    perform authz.require_capability('partners.assign');
  end if;
  if p_status in ('at_risk', 'lost') and p_reason_id is null then
    raise exception using errcode = 'P0001', message = 'partner.status_reason_required';
  end if;
  req := audit.begin('ui', 'partner.status_set', pg_catalog.jsonb_build_object('status', p_status), p_note);
  insert into partner.status_change (partner_id, status, effective_on, reason_id, note)
  values (p_id, p_status, coalesce(p_effective_on, core.riyadh_today()), p_reason_id, p_note)
  returning id into sid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', sid, 'status', partner.status_of(p_id), 'request_id', req);
end
$$;

-- The account manager from a date (partners.assign; V26): the one before ends that day. The revenue rule of V26/V27
-- (changing it where revenue exists stays with heads and admins) joins when revenue exists (P4-2).
create function partner.manager_set_inner(p_id uuid, p_person uuid, p_from date, p_reason text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  cur partner.account_manager;
begin
  if p_person is not null and not exists (select 1 from core.person x where x.id = p_person and x.kind = 'staff'
                                          and x.active and x.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into cur from partner.account_manager m
  where m.partner_id = p_id and m.deleted_at is null and m.effective_from <= p_from
    and (m.effective_to is null or m.effective_to > p_from);
  if cur.id is not null and cur.person_id is not distinct from p_person then
    return;
  end if;
  if cur.id is not null then
    if cur.effective_from = p_from then
      update partner.account_manager set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
      where id = cur.id;
    else
      update partner.account_manager set effective_to = p_from where id = cur.id;
    end if;
  end if;
  if p_person is not null then
    begin
      insert into partner.account_manager (partner_id, person_id, effective_from, reason)
      values (p_id, p_person, p_from, p_reason);
    exception when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'partner.manager_later_change';
    end;
  end if;
end
$$;

create function partner.manager_set(p_id uuid, p_person uuid, p_from date default null, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_id);
  req uuid;
begin
  perform authz.require_capability('partners.assign');
  req := audit.begin('ui', 'partner.manager_set', null, p_reason);
  perform partner.manager_set_inner(p_id, p_person, coalesce(p_from, core.riyadh_today()), p_reason);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- Assign owner and priority to many partners in one action (V63): one request, one Undo; a partner with no status
-- becomes a Prospect.
create function partner.bulk_assign(p_ids uuid[], p_owner uuid, p_priority uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'full');
  pid uuid;
  req uuid;
  n int := 0;
begin
  perform authz.require_capability('partners.assign');
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_priority is not null and not exists (select 1 from work.priority x where x.id = p_priority and x.active) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'partner.bulk_assigned', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  foreach pid in array p_ids loop
    perform partner.writable(pid);
    if p_owner is not null then
      perform partner.manager_set_inner(pid, p_owner, core.riyadh_today(), p_reason);
    end if;
    if p_priority is not null then
      update partner.partner set priority_id = p_priority where id = pid;
    end if;
    if partner.status_of(pid) is null then
      insert into partner.status_change (partner_id, status, effective_on) values (pid, 'prospect', core.riyadh_today());
    end if;
    n := n + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', n, 'request_id', req);
end
$$;

-- ================================================================ identifiers, blocks, individuals, codes (V133, V135)
-- Add an identifier: partners.identify. The four names follow the partner's name fields (only an alias is added here).
-- One live discount code per partner by default (partner.one_code_per_partner); a second needs partners.assign and
-- says so (p_second_code).
create function partner.identifier_add(p_partner uuid, p_kind text, p_value text, p_reason text, p_subkind text default null,
                                       p_valid_from date default null, p_valid_to date default null, p_note text default null,
                                       p_second_code boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_partner);
  why text;
  req uuid;
  iid uuid;
begin
  perform authz.require_capability('partners.identify');
  why := core.access_reason(p_reason);
  if p_kind = 'name' and p_subkind is distinct from 'alias' then
    raise exception using errcode = 'P0001', message = 'identifier.name_follows_partner';
  end if;
  if p_kind = 'discount_code'
     and coalesce((core.setting_at('partner.one_code_per_partner', null, core.riyadh_today()) #>> '{}')::boolean, true)
     and exists (select 1 from partner.identifier i where i.partner_id = p_partner and i.kind = 'discount_code'
                 and i.deleted_at is null
                 and pg_catalog.daterange(i.valid_from, i.valid_to, '[]') && pg_catalog.daterange(p_valid_from, p_valid_to, '[]')) then
    if not p_second_code then
      raise exception using errcode = 'P0001', message = 'identifier.one_code_per_partner';
    end if;
    perform authz.require_capability('partners.assign');
  end if;
  req := audit.begin('ui', 'identifier.added', pg_catalog.jsonb_build_object('kind', p_kind), why);
  iid := partner.identifier_insert(p_partner, p_kind, p_value, p_subkind, why, 'person', p_valid_from, p_valid_to, p_note);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', iid, 'request_id', req);
end
$$;

create function partner.identifier_remove(p_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  i partner.identifier;
  why text;
  req uuid;
begin
  select * into i from partner.identifier where id = p_id and deleted_at is null;
  if i.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.writable(i.partner_id);
  perform authz.require_capability('partners.identify');
  why := core.access_reason(p_reason);
  if i.kind = 'name' and i.subkind <> 'alias' then
    raise exception using errcode = 'P0001', message = 'identifier.name_follows_partner';
  end if;
  req := audit.begin('ui', 'identifier.removed', pg_catalog.jsonb_build_object('kind', i.kind), why);
  update partner.identifier set deleted_at = pg_catalog.now(), deleted_by = authz.me(), delete_reason = why where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- Values that can never be identifiers (staff domains, test customers): Settings → Partners · Full.
create function partner.block_add(p_kind text, p_match text, p_value text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.partners', 'full');
  why text := core.access_reason(p_reason);
  k text := case when p_match = 'domain' then pg_catalog.ltrim(pg_catalog.lower(pg_catalog.btrim(p_value)), '@')
                 else norm.key(p_kind, p_value, partner.stop_words()) end;
  req uuid;
  bid uuid;
begin
  if k is null or k = '' then
    raise exception using errcode = 'P0001', message = 'identifier.empty_key', detail = p_kind;
  end if;
  req := audit.begin('ui', 'identifier.blocked', pg_catalog.jsonb_build_object('kind', p_kind), why);
  insert into partner.identifier_block (kind, match, value, value_key, reason)
  values (p_kind, coalesce(p_match, 'exact'), pg_catalog.btrim(p_value), k, why) returning id into bid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', bid, 'request_id', req);
end
$$;

-- "Individual (not an organisation)" (D25): partners.identify.
create function partner.individual_add(p_name text, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'full');
  k text := norm.name_key(p_name, partner.stop_words());
  req uuid;
  iid uuid;
begin
  perform authz.require_capability('partners.identify');
  if k is null then
    raise exception using errcode = 'P0001', message = 'identifier.empty_key', detail = 'name';
  end if;
  if exists (select 1 from partner.identifier i where i.kind = 'name' and i.value_key = k and i.deleted_at is null) then
    raise exception using errcode = '23505', message = 'identifier.held', detail = partner.holder('name', k);
  end if;
  req := audit.begin('ui', 'individual.added', null, p_reason);
  begin
    insert into partner.individual_name (name_raw, name_key, reason) values (pg_catalog.btrim(p_name), k, p_reason)
    returning id into iid;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'individual.already_listed', detail = p_name;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', iid, 'request_id', req);
end
$$;

-- A campaign code (V65): credited to no partner; its key is live on one partner or campaign at a time.
create function partner.campaign_code_add(p_code text, p_name text, p_valid_from date, p_valid_to date, p_owner uuid,
                                          p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'full');
  why text;
  k text := norm.code_key(p_code);
  req uuid;
  cid uuid;
begin
  perform authz.require_capability('partners.identify');
  why := core.access_reason(p_reason);
  if k is null then
    raise exception using errcode = 'P0001', message = 'identifier.empty_key', detail = 'discount_code';
  end if;
  req := audit.begin('ui', 'campaign_code.added', null, why);
  begin
    insert into partner.campaign_code (code_raw, code_key, name, valid_from, valid_to, owner_id, reason)
    values (pg_catalog.btrim(p_code), k, p_name, p_valid_from, p_valid_to, p_owner, why) returning id into cid;
  exception when exclusion_violation then
    raise exception using errcode = '23505', message = 'identifier.held', detail = p_code;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'request_id', req);
end
$$;

-- A code's terms (V65), a new row per change (history); approver and approval date required.
create function partner.code_terms_add(p_identifier uuid, p_campaign uuid, p_fee_percent numeric, p_approved_by uuid,
                                       p_approved_on date, p_effective_from date, p_services uuid[] default '{}',
                                       p_countries text[] default '{}', p_tiers jsonb default '[]',
                                       p_review_on date default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'full');
  req uuid;
  tid uuid;
begin
  perform authz.require_capability('partners.identify');
  if p_identifier is not null and not exists (select 1 from partner.identifier i where i.id = p_identifier
                                              and i.kind = 'discount_code' and i.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'code_terms.added', null, null);
  insert into partner.code_terms (identifier_id, campaign_code_id, fee_percent, services, countries, tiers, review_on,
                                  approved_by, approved_on, effective_from)
  values (p_identifier, p_campaign, p_fee_percent, coalesce(p_services, '{}'), coalesce(p_countries, '{}'),
          coalesce(p_tiers, '[]'), p_review_on, p_approved_by, p_approved_on, p_effective_from)
  returning id into tid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', tid, 'request_id', req);
end
$$;

-- ================================================================ contacts, credit limits (V70, V92)
create function partner.contact_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_partner);
  c partner.contact;
  k text;
  req uuid;
  cid uuid;
begin
  for k in select pg_catalog.jsonb_object_keys(coalesce(p_values, '{}')) loop
    if k not in ('name_en', 'name_ar', 'job_title', 'email', 'phone', 'notes', 'is_primary') then
      raise exception using errcode = 'P0001', message = 'contact.unknown_field', detail = k;
    end if;
  end loop;
  begin
    if p_id is null then
      req := audit.begin('ui', 'contact.saved', null, null);
      insert into partner.contact (partner_id, name_en, name_ar, job_title, email, phone, notes, is_primary)
      select p_partner, x.name_en, x.name_ar, x.job_title, x.email, x.phone, x.notes, coalesce(x.is_primary, false)
      from pg_catalog.jsonb_populate_record(null::partner.contact, p_values) x
      returning id into cid;
    else
      select * into c from partner.contact where id = p_id and partner_id = p_partner and deleted_at is null;
      if c.id is null then
        raise exception using errcode = 'P0002', message = 'common.not_found';
      end if;
      perform core.check_version('partner.contact', p_id, p_version,
        (select pg_catalog.array_agg(k2) from pg_catalog.jsonb_object_keys(p_values) k2 where (pg_catalog.to_jsonb(c) -> k2) is distinct from (p_values -> k2)));
      req := audit.begin('ui', 'contact.saved', null, null);
      perform audit.write_fields('partner.contact', p_id, p_values);
      cid := p_id;
    end if;
  exception
    when not_null_violation or check_violation then
      raise exception using errcode = 'P0001', message = 'contact.name_required';
    when unique_violation then
      raise exception using errcode = '23505', message = 'contact.one_primary';
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'version', (select x.version from partner.contact x where x.id = cid),
                                       'request_id', req);
end
$$;

create function partner.contacts_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'full');
  req uuid;
  n int;
begin
  if exists (select 1 from pg_catalog.unnest(p_ids) i(id) where not exists (
               select 1 from partner.contact c join partner.partner p on p.id = c.partner_id
               where c.id = i.id and c.deleted_at is null and p.archived_at is null)) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'contact.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update partner.contact set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics n = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', n, 'request_id', req);
end
$$;

-- The credit limit from a date (finance.credit_control — V70): who approved it and why are required; 0 is "Prepaid
-- only" (V92). A second change on the same date replaces the first in the same request.
create function partner.credit_limit_set(p_partner uuid, p_amount numeric, p_effective_from date, p_approved_by uuid,
                                         p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_partner);
  me uuid := authz.require_capability('finance.credit_control');
  why text := core.access_reason(p_reason);
  req uuid;
  cid uuid;
begin
  if p_approved_by is null or not exists (select 1 from core.person x where x.id = p_approved_by and x.kind = 'staff') then
    raise exception using errcode = 'P0001', message = 'credit.approver_required';
  end if;
  req := audit.begin('ui', 'credit_limit.set', null, why);
  update partner.credit_limit set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
  where partner_id = p_partner and effective_from = coalesce(p_effective_from, core.riyadh_today()) and deleted_at is null;
  insert into partner.credit_limit (partner_id, amount_sar, effective_from, approved_by, reason)
  values (p_partner, p_amount, coalesce(p_effective_from, core.riyadh_today()), p_approved_by, why)
  returning id into cid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'request_id', req);
exception when check_violation then
  raise exception using errcode = 'P0001', message = 'credit.amount_invalid';
end
$$;

-- ================================================================ merge (V136)
-- partners.merge: the merged partner's identifiers move to the kept one (source 'merge'; its names as aliases), its
-- roles the kept one lacks are added, its contacts move; it keeps its status and account-manager history and is
-- archived, pointing at the kept one. One request, so one Undo. Files, notes, tasks, projects and achievements are
-- re-pointed by the steps that bring them.
create function partner.partner_merge(p_kept uuid, p_merged uuid, p_reason text) returns jsonb
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
  update partner.partner set archived_at = pg_catalog.now(), merged_into_id = p_kept where id = p_merged;
  perform audit.end();
  return pg_catalog.jsonb_build_object('kept', p_kept, 'merged', p_merged, 'request_id', req);
end
$$;

-- ================================================================ reading (V78, V136)
-- The Partners list (View on Partners): filters role · segment · owner · status, text, key partners, archived.
create function partner.partners_list(p_filters jsonb default '{}', p_limit int default 100, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'view');
  f jsonb := coalesce(p_filters, '{}');
  q text := norm.fold(f ->> 'q');
begin
  return (
    with base as (
      select p.*, partner.status_of(p.id) as status,
             (select m.person_id from partner.account_manager m where m.partner_id = p.id and m.deleted_at is null
                and m.effective_from <= core.riyadh_today() and (m.effective_to is null or m.effective_to > core.riyadh_today())
              limit 1) as owner_id,
             (select pg_catalog.array_agg(ro.key order by ro.sort) from partner.partner_role r join partner.role ro on ro.id = r.role_id
              where r.partner_id = p.id and r.deleted_at is null) as roles
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
          'logo_file_id', h.logo_file_id, 'archived', h.archived_at is not null, 'version', h.version)
          order by pg_catalog.lower(h.trade_name_en), h.id)
        from (select * from hit order by pg_catalog.lower(hit.trade_name_en), hit.id
              limit greatest(1, least(coalesce(p_limit, 100), 500)) offset greatest(coalesce(p_offset, 0), 0)) h), '[]'::jsonb)));
end
$$;

-- One partner, as the card needs it (View on Partners); credit limits with Finance · View (V70).
create function partner.partner_get(p_id uuid) returns jsonb
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
        from partner.credit_limit c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb) end);
end
$$;

-- Hover cards (V53): the few facts the canvas's HoverCards artboard shows.
create function partner.hover(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'view');
begin
  return (select pg_catalog.jsonb_build_object(
      'id', p.id, 'number', p.number, 'trade_name_en', p.trade_name_en, 'trade_name_ar', p.trade_name_ar,
      'logo_file_id', p.logo_file_id, 'key_partner', p.key_partner, 'segment_id', p.segment_id,
      'status', partner.status_of(p.id), 'owner_id', (select x from partner.owners(p.id) x limit 1),
      'roles', coalesce((select pg_catalog.jsonb_agg(ro.key order by ro.sort) from partner.partner_role r
                         join partner.role ro on ro.id = r.role_id where r.partner_id = p.id and r.deleted_at is null), '[]'::jsonb))
    from partner.partner p where p.id = p_id and p.deleted_at is null);
end
$$;

create function core.hover_person(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if authz.me() is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return (select pg_catalog.jsonb_build_object(
      'id', p.id, 'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
      'display_name_en', coalesce(pr.display_name_en, p.nickname_en, p.full_name_en),
      'display_name_ar', coalesce(pr.display_name_ar, p.nickname_ar, p.full_name_ar),
      'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
      'department_en', d.name_en, 'department_ar', d.name_ar, 'team_en', t.name_en, 'team_ar', t.name_ar,
      'manager_id', p.manager_id, 'avatar_color', pr.avatar_color, 'avatar_file_id', pr.avatar_file_id,
      'badge_kind', pr.badge_kind, 'badge_value', pr.badge_value, 'active', p.active)
    from core.person p left join core.person_profile pr on pr.person_id = p.id
    left join core.department d on d.id = p.department_id left join core.team t on t.id = p.team_id
    where p.id = p_id and p.kind = 'staff' and p.deleted_at is null);
end
$$;

-- Ctrl K (§6): partners by any identifier (folded — every Arabic spelling, V77), by trade name or number; people by
-- name. Partners only for those who can open Partners.
create function core.search(p_q text, p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  q text := norm.fold(p_q);
  lim int := greatest(1, least(coalesce(p_limit, 10), 50));
  stop text[] := partner.stop_words();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if q is null or pg_catalog.length(q) < 2 then
    return pg_catalog.jsonb_build_object('partners', '[]'::jsonb, 'people', '[]'::jsonb);
  end if;
  return pg_catalog.jsonb_build_object(
    'partners', case when authz.level_of(me, 'partners') = 'none' then '[]'::jsonb else coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', y.id, 'number', y.number,
               'trade_name_en', y.trade_name_en, 'trade_name_ar', y.trade_name_ar, 'matched_by', y.matched_by)
               order by y.rank, pg_catalog.lower(y.trade_name_en))
      from (select * from (select distinct on (p.id) p.id, p.number, p.trade_name_en, p.trade_name_ar, m.matched_by, m.rank
            from partner.partner p
            join (select i.partner_id, i.kind as matched_by, 0 as rank from partner.identifier i
                  where i.deleted_at is null
                    and i.value_key in (norm.key('payments_client_id', p_q), norm.key('vat', p_q), norm.key('email', p_q),
                                        norm.key('phone', p_q), norm.key('discount_code', p_q), norm.key('name', p_q, stop))
                  union all
                  select p2.id, 'name', 1 from partner.partner p2
                  where norm.fold(p2.trade_name_en) like '%' || q || '%' or norm.fold(p2.trade_name_ar) like '%' || q || '%'
                     or norm.fold(p2.official_name_en) like '%' || q || '%' or norm.fold(p2.official_name_ar) like '%' || q || '%'
                  union all
                  select p3.id, 'number', 0 from partner.partner p3 where norm.fold(p3.number) = q) m on m.partner_id = p.id
            where p.deleted_at is null and p.archived_at is null
            order by p.id, m.rank) x
            order by x.rank, pg_catalog.lower(x.trade_name_en) limit lim) y), '[]'::jsonb) end,
    'people', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', p.id, 'full_name_en', p.full_name_en,
               'full_name_ar', p.full_name_ar, 'job_title_en', p.job_title_en) order by pg_catalog.lower(p.full_name_en))
      from (select * from core.person p0
            where p0.kind = 'staff' and p0.active and p0.deleted_at is null
              and (norm.fold(p0.full_name_en) like '%' || q || '%' or norm.fold(p0.full_name_ar) like '%' || q || '%'
                   or norm.fold(p0.nickname_en) like '%' || q || '%' or norm.fold(p0.nickname_ar) like '%' || q || '%')
            order by pg_catalog.lower(p0.full_name_en) limit lim) p), '[]'::jsonb));
end
$$;

-- ================================================================ keys stay true (§3.5, A17)
-- Stored keys that no longer equal their recomputation. Must be empty (NORM-DRIFT, and nightly).
create function norm.drift() returns table (source text, id uuid, stored text, now_is text)
language sql stable security definer set search_path = ''
as $$
  select 'partner.identifier', i.id, i.value_key,
         case when i.kind = 'discount_code' then norm.code_key(i.value_raw) else norm.key(i.kind, i.value_raw, partner.stop_words()) end
  from partner.identifier i
  where i.deleted_at is null
    and i.value_key is distinct from (case when i.kind = 'discount_code' then norm.code_key(i.value_raw)
                                           else norm.key(i.kind, i.value_raw, partner.stop_words()) end)
  union all
  select 'partner.individual_name', n.id, n.name_key, norm.name_key(n.name_raw, partner.stop_words())
  from partner.individual_name n
  where n.deleted_at is null and n.name_key is distinct from norm.name_key(n.name_raw, partner.stop_words())
  union all
  select 'partner.campaign_code', c.id, c.code_key, norm.code_key(c.code_raw)
  from partner.campaign_code c where c.deleted_at is null and c.code_key is distinct from norm.code_key(c.code_raw)
$$;

-- Recomputes every stored key, logged as one system request (a migration that changes a norm function, or a change to
-- partner.name_stop_words, ends with it). A key that now collides with another holder is left for a person: the
-- answer lists it.
create function norm.rebuild() returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  d record;
  changed int := 0;
  stuck jsonb := '[]';
begin
  perform audit.begin('system', 'norm.rebuilt');
  for d in select * from norm.drift() loop
    begin
      if d.now_is is null then
        stuck := stuck || pg_catalog.jsonb_build_object('source', d.source, 'id', d.id, 'why', 'empty key');
        continue;
      end if;
      execute pg_catalog.format('update %s set %I = $1%s where id = $2', pg_catalog.to_regclass(d.source),
        case d.source when 'partner.identifier' then 'value_key' when 'partner.individual_name' then 'name_key' else 'code_key' end,
        case d.source when 'partner.identifier' then ', norm_version = norm.version()' else '' end)
        using d.now_is, d.id;
      changed := changed + 1;
    exception when unique_violation or exclusion_violation then
      stuck := stuck || pg_catalog.jsonb_build_object('source', d.source, 'id', d.id, 'why', 'held by another');
    end;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('changed', changed, 'stuck', stuck);
end
$$;

-- ================================================================ grants and the door (V124)
grant usage on schema partner to authenticated;
grant execute on function core.list_items(text, boolean), core.list_save(text, uuid, jsonb, int, text),
  partner.partner_create(jsonb, text), partner.partner_update(uuid, jsonb, int, text), partner.roles_set(uuid, jsonb, text),
  partner.status_set(uuid, text, date, uuid, text), partner.manager_set(uuid, uuid, date, text),
  partner.bulk_assign(uuid[], uuid, uuid, text),
  partner.identifier_add(uuid, text, text, text, text, date, date, text, boolean), partner.identifier_remove(uuid, text),
  partner.block_add(text, text, text, text), partner.individual_add(text, text),
  partner.campaign_code_add(text, text, date, date, uuid, text),
  partner.code_terms_add(uuid, uuid, numeric, uuid, date, date, uuid[], text[], jsonb, date),
  partner.contact_save(uuid, uuid, jsonb, int), partner.contacts_remove(uuid[], text),
  partner.credit_limit_set(uuid, numeric, date, uuid, text), partner.partner_merge(uuid, uuid, text),
  partner.partners_list(jsonb, int, int), partner.partner_get(uuid), partner.hover(uuid), core.hover_person(uuid),
  core.search(text, int) to authenticated;

create function api.list(p_list text, p_include_retired boolean default false) returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.list_items(p_list, p_include_retired) $$;
create function api.list_save(p_list text, p_id uuid, p_values jsonb, p_version int default null, p_reason text default null)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select core.list_save(p_list, p_id, p_values, p_version, p_reason) $$;
create function api.partner_create(p_partner jsonb, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.partner_create(p_partner, p_reason) $$;
create function api.partner_update(p_id uuid, p_changes jsonb, p_version int, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.partner_update(p_id, p_changes, p_version, p_reason) $$;
create function api.partner_roles_set(p_id uuid, p_roles jsonb, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.roles_set(p_id, p_roles, p_reason) $$;
create function api.partner_status_set(p_id uuid, p_status text, p_effective_on date default null, p_reason_id uuid default null,
                                       p_note text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.status_set(p_id, p_status, p_effective_on, p_reason_id, p_note) $$;
create function api.partner_manager_set(p_id uuid, p_person uuid, p_from date default null, p_reason text default null)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select partner.manager_set(p_id, p_person, p_from, p_reason) $$;
create function api.partner_bulk_assign(p_ids uuid[], p_owner uuid, p_priority uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.bulk_assign(p_ids, p_owner, p_priority, p_reason) $$;
create function api.identifier_add(p_partner uuid, p_kind text, p_value text, p_reason text, p_subkind text default null,
                                   p_valid_from date default null, p_valid_to date default null, p_note text default null,
                                   p_second_code boolean default false) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.identifier_add(p_partner, p_kind, p_value, p_reason, p_subkind, p_valid_from, p_valid_to, p_note, p_second_code) $$;
create function api.identifier_remove(p_id uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.identifier_remove(p_id, p_reason) $$;
create function api.identifier_block_add(p_kind text, p_match text, p_value text, p_reason text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.block_add(p_kind, p_match, p_value, p_reason) $$;
create function api.individual_add(p_name text, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.individual_add(p_name, p_reason) $$;
create function api.campaign_code_add(p_code text, p_name text, p_valid_from date, p_valid_to date, p_owner uuid,
                                      p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.campaign_code_add(p_code, p_name, p_valid_from, p_valid_to, p_owner, p_reason) $$;
create function api.code_terms_add(p_identifier uuid, p_campaign uuid, p_fee_percent numeric, p_approved_by uuid,
                                   p_approved_on date, p_effective_from date, p_services uuid[] default '{}',
                                   p_countries text[] default '{}', p_tiers jsonb default '[]', p_review_on date default null)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select partner.code_terms_add(p_identifier, p_campaign, p_fee_percent, p_approved_by, p_approved_on, p_effective_from,
                                    p_services, p_countries, p_tiers, p_review_on) $$;
create function api.contact_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.contact_save(p_partner, p_id, p_values, p_version) $$;
create function api.contacts_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.contacts_remove(p_ids, p_reason) $$;
create function api.credit_limit_set(p_partner uuid, p_amount numeric, p_effective_from date, p_approved_by uuid,
                                     p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.credit_limit_set(p_partner, p_amount, p_effective_from, p_approved_by, p_reason) $$;
create function api.partner_merge(p_kept uuid, p_merged uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select partner.partner_merge(p_kept, p_merged, p_reason) $$;
create function api.partners(p_filters jsonb default '{}', p_limit int default 100, p_offset int default 0) returns jsonb
language sql stable security invoker set search_path = '' as $$ select partner.partners_list(p_filters, p_limit, p_offset) $$;
create function api.partner(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select partner.partner_get(p_id) $$;
create function api.hover_partner(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select partner.hover(p_id) $$;
create function api.hover_person(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.hover_person(p_id) $$;
create function api.search(p_q text, p_limit int default 10) returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.search(p_q, p_limit) $$;

grant execute on function api.list(text, boolean), api.list_save(text, uuid, jsonb, int, text),
  api.partner_create(jsonb, text), api.partner_update(uuid, jsonb, int, text), api.partner_roles_set(uuid, jsonb, text),
  api.partner_status_set(uuid, text, date, uuid, text), api.partner_manager_set(uuid, uuid, date, text),
  api.partner_bulk_assign(uuid[], uuid, uuid, text),
  api.identifier_add(uuid, text, text, text, text, date, date, text, boolean), api.identifier_remove(uuid, text),
  api.identifier_block_add(text, text, text, text), api.individual_add(text, text),
  api.campaign_code_add(text, text, date, date, uuid, text),
  api.code_terms_add(uuid, uuid, numeric, uuid, date, date, uuid[], text[], jsonb, date),
  api.contact_save(uuid, uuid, jsonb, int), api.contacts_remove(uuid[], text),
  api.credit_limit_set(uuid, numeric, date, uuid, text), api.partner_merge(uuid, uuid, text),
  api.partners(jsonb, int, int), api.partner(uuid), api.hover_partner(uuid), api.hover_person(uuid), api.search(text, int)
  to authenticated;

-- ================================================================ the starting lists (made-up-free: generic words)
select audit.begin('system', 'partner.lists_seeded');
insert into partner.role (key, name_en, name_ar, short_name_en, short_name_ar, card_sections, sort) values
  ('client', 'Client', 'عميل', 'Client', 'عميل', '{sales,finance}', 10),
  ('supplier', 'Supplier', 'مورد', 'Supplier', 'مورد', '{contracts_terms}', 20),
  ('strategic_partner', 'Strategic partner', 'شريك استراتيجي', 'Strategic', 'استراتيجي', '{subkind,stage,contract}', 30);
insert into partner.segment (key, name_en, name_ar, sort) values
  ('government', 'Government (B2G)', 'حكومي', 10), ('corporate', 'Corporate', 'الشركات', 20),
  ('agencies', 'Agencies', 'الوكالات', 30), ('individuals', 'Individuals', 'الأفراد', 40);
insert into partner.status_reason (key, name_en, name_ar, status, sort) values
  ('price', 'Price', 'السعر', 'at_risk', 10), ('service_issue', 'Service issue', 'مشكلة في الخدمة', 'at_risk', 20),
  ('competitor', 'Competitor', 'منافس', 'at_risk', 30), ('no_response', 'No response', 'لا استجابة', 'at_risk', 40),
  ('lost_price', 'Price', 'السعر', 'lost', 10), ('lost_service_issue', 'Service issue', 'مشكلة في الخدمة', 'lost', 20),
  ('lost_competitor', 'Competitor', 'منافس', 'lost', 30), ('lost_no_response', 'No response', 'لا استجابة', 'lost', 40);
insert into partner.call_outcome (key, name_en, name_ar, counts_as_demo, sort) values
  ('no_answer', 'No answer', 'لم يرد', false, 10), ('answered', 'Answered', 'تم الرد', false, 20),
  ('meeting_set', 'Meeting set', 'تم تحديد اجتماع', false, 30), ('demo_set', 'Demo set', 'تم تحديد عرض توضيحي', true, 40),
  ('demo_held', 'Demo held', 'تم تقديم العرض التوضيحي', true, 50), ('not_interested', 'Not interested', 'غير مهتم', false, 60),
  ('call_back_later', 'Call back later', 'معاودة الاتصال لاحقاً', false, 70), ('wrong_number', 'Wrong number', 'رقم خاطئ', false, 80);
insert into partner.term (key, name_en, name_ar, unit, sort) values
  ('corporate_rate', 'Corporate rate', 'سعر الشركات', 'percent', 10),
  ('free_cancellation', 'Free cancellation', 'الإلغاء المجاني', 'days', 20),
  ('payment_terms', 'Payment terms', 'شروط الدفع', 'days', 30), ('peak_allotment', 'Peak allotment', 'حصة الذروة', 'count', 40);
insert into work.priority (key, name_en, name_ar, sort) values
  ('high', 'High', 'عالية', 10), ('medium', 'Medium', 'متوسطة', 20), ('low', 'Low', 'منخفضة', 30);
select audit.end();
