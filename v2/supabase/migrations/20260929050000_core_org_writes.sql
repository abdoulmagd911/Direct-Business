-- v2 the writes behind Settings (P3-6, part 3, for P3-5's screens): TECH-SPEC §3.1, §3.2, §4, §8; V9, V45, V74, V76,
-- V125; V131, V132. Settings by their schema, My profile, people, departments, teams and roles — each one logged
-- request, checked against the version it read (A14), and refused in words. Every function the Data API reaches is a
-- security-invoker wrapper (V124). Forward-only (V103).

-- ================================================================ a setting's value is checked against its schema
-- The registry stores each setting's zod schema as JSON Schema (V123). The database checks a value against it itself —
-- the subset the registry writes; a schema using anything else is refused rather than half-checked. Answers null when
-- the value fits, else where and why it does not.
create function core.json_check(p_schema jsonb, p_value jsonb, p_path text default '$') returns text
language plpgsql immutable set search_path = ''
as $$
declare
  k text;
  t text := pg_catalog.jsonb_typeof(p_value);
  types jsonb := p_schema -> 'type';
  ok boolean;
  n numeric;
  e jsonb;
  i int := 0;
  bad text;
begin
  if pg_catalog.jsonb_typeof(p_schema) is distinct from 'object' then
    return p_path || ': no schema';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_schema) loop
    if k not in ('$schema', 'type', 'enum', 'const', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
                 'minLength', 'maxLength', 'pattern', 'items', 'minItems', 'maxItems', 'uniqueItems', 'properties',
                 'required', 'additionalProperties', 'title', 'description') then
      return p_path || ': the schema uses "' || k || '", which the database does not check';
    end if;
  end loop;
  if types is not null then
    if pg_catalog.jsonb_typeof(types) = 'string' then
      types := pg_catalog.jsonb_build_array(types);
    end if;
    select pg_catalog.bool_or(case x
                                when 'integer' then t = 'number'
                                  and (p_value #>> '{}')::numeric = pg_catalog.trunc((p_value #>> '{}')::numeric)
                                else t = x end)
      into ok
    from pg_catalog.jsonb_array_elements_text(types) x;
    if not coalesce(ok, false) then
      return p_path || ': expected ' || (select pg_catalog.string_agg(x, ' or ') from pg_catalog.jsonb_array_elements_text(types) x);
    end if;
  end if;
  if p_schema ? 'enum' and not ((p_schema -> 'enum') @> pg_catalog.jsonb_build_array(p_value)) then
    return p_path || ': not one of ' || (p_schema ->> 'enum');
  end if;
  if p_schema ? 'const' and p_value is distinct from (p_schema -> 'const') then
    return p_path || ': must be ' || (p_schema ->> 'const');
  end if;
  if t = 'number' then
    n := (p_value #>> '{}')::numeric;
    if (p_schema ? 'minimum' and n < (p_schema ->> 'minimum')::numeric)
       or (p_schema ? 'exclusiveMinimum' and n <= (p_schema ->> 'exclusiveMinimum')::numeric) then
      return p_path || ': too small';
    end if;
    if (p_schema ? 'maximum' and n > (p_schema ->> 'maximum')::numeric)
       or (p_schema ? 'exclusiveMaximum' and n >= (p_schema ->> 'exclusiveMaximum')::numeric) then
      return p_path || ': too large';
    end if;
  elsif t = 'string' then
    if p_schema ? 'minLength' and pg_catalog.char_length(p_value #>> '{}') < (p_schema ->> 'minLength')::int then
      return p_path || ': too short';
    end if;
    if p_schema ? 'maxLength' and pg_catalog.char_length(p_value #>> '{}') > (p_schema ->> 'maxLength')::int then
      return p_path || ': too long';
    end if;
    if p_schema ? 'pattern' and not ((p_value #>> '{}') ~ (p_schema ->> 'pattern')) then
      return p_path || ': does not match its pattern';
    end if;
  elsif t = 'array' then
    if p_schema ? 'minItems' and pg_catalog.jsonb_array_length(p_value) < (p_schema ->> 'minItems')::int then
      return p_path || ': too few items';
    end if;
    if p_schema ? 'maxItems' and pg_catalog.jsonb_array_length(p_value) > (p_schema ->> 'maxItems')::int then
      return p_path || ': too many items';
    end if;
    if coalesce((p_schema ->> 'uniqueItems')::boolean, false)
       and (select pg_catalog.count(distinct x) from pg_catalog.jsonb_array_elements(p_value) x)
           <> pg_catalog.jsonb_array_length(p_value) then
      return p_path || ': an item is repeated';
    end if;
    if p_schema ? 'items' then
      for e in select x from pg_catalog.jsonb_array_elements(p_value) x loop
        bad := core.json_check(p_schema -> 'items', e, p_path || '[' || i || ']');
        if bad is not null then
          return bad;
        end if;
        i := i + 1;
      end loop;
    end if;
  elsif t = 'object' then
    if p_schema ? 'required' then
      select pg_catalog.string_agg(r, ', ') into bad
      from pg_catalog.jsonb_array_elements_text(p_schema -> 'required') r where not (p_value ? r);
      if bad is not null then
        return p_path || ': missing ' || bad;
      end if;
    end if;
    if p_schema ? 'properties' then
      for k in select pg_catalog.jsonb_object_keys(p_value) loop
        if p_schema -> 'properties' ? k then
          bad := core.json_check(p_schema -> 'properties' -> k, p_value -> k, p_path || '.' || k);
          if bad is not null then
            return bad;
          end if;
        elsif (p_schema -> 'additionalProperties') = 'false'::jsonb then
          return p_path || ': "' || k || '" is not allowed';
        end if;
      end loop;
    end if;
  end if;
  return null;
end
$$;
comment on function core.json_check(jsonb, jsonb, text) is 'Null when a value fits its JSON Schema (the subset the registry writes), else where and why not.';

-- ================================================================ settings (§3.2, V131)
-- A group's settings for Settings: each definition, today's company-wide value, and every live row (company-wide and
-- by department, newest first) — for View on the group's page; can_edit says whether the reader has Full.
create function core.settings(p_group text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require(p_group, 'view');
  today date := core.riyadh_today();
begin
  return pg_catalog.jsonb_build_object(
    'can_edit', authz.level_of(me, p_group) = 'full',
    'settings', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'key', d.key, 'label_key', d.label_key, 'schema', d.schema, 'default', d.default_value,
               'effective_dated', d.effective_dated, 'value', core.setting_at(d.key, null, today),
               'rows', coalesce((
                 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                          'id', s.id, 'department_id', s.department_id, 'value', s.value, 'valid_from', s.valid_from,
                          'reason', s.reason, 'set_by', s.created_by, 'set_at', s.created_at)
                          order by s.department_id nulls first, s.valid_from desc)
                 from core.setting s where s.key = d.key and s.deleted_at is null), '[]'::jsonb))
               order by d.key)
      from core.setting_def d where d.group_page = p_group and d.active), '[]'::jsonb));
end
$$;

-- Change a setting: Full on its group's page, a reason, a value its schema accepts. A setting with an effective date
-- takes the date given (today when none); any other applies from today. A change on a day that already has a row for
-- that department replaces it (the old row is removed in the same request, so one Undo brings it back). A row is never
-- changed in place (SET-02).
create function core.setting_set(p_key text, p_department uuid, p_value jsonb, p_valid_from date default null,
                                 p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  d core.setting_def;
  me uuid;
  why text;
  day date;
  bad text;
  req uuid;
  s core.setting;
begin
  select * into d from core.setting_def where key = p_key and active;
  if d.id is null then
    raise exception using errcode = 'P0002', message = 'setting.unknown_key', detail = p_key;
  end if;
  me := authz.require(d.group_page, 'full');
  why := core.access_reason(p_reason);
  if p_department is not null
     and not exists (select 1 from core.department x where x.id = p_department and x.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  bad := core.json_check(d.schema, p_value);
  if bad is not null then
    raise exception using errcode = 'P0001', message = 'setting.invalid_value', detail = bad;
  end if;
  if d.effective_dated then
    day := coalesce(p_valid_from, core.riyadh_today());
  elsif p_valid_from is not null and p_valid_from <> core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'setting.not_effective_dated', detail = p_key;
  else
    day := core.riyadh_today();
  end if;
  req := audit.begin('ui', 'setting.changed', pg_catalog.jsonb_build_object('key', p_key), why);
  update core.setting set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
  where key = p_key and department_id is not distinct from p_department and valid_from = day and deleted_at is null;
  insert into core.setting (key, department_id, value, valid_from, reason)
  values (p_key, p_department, p_value, day, why)
  returning * into s;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', s.id, 'valid_from', s.valid_from, 'request_id', req);
end
$$;

-- A department follows the company-wide value again: its rows for the setting are removed (logged, undoable).
create function core.setting_clear(p_key text, p_department uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  d core.setting_def;
  me uuid;
  why text;
  req uuid;
  n int;
begin
  select * into d from core.setting_def where key = p_key and active;
  if d.id is null then
    raise exception using errcode = 'P0002', message = 'setting.unknown_key', detail = p_key;
  end if;
  me := authz.require(d.group_page, 'full');
  why := core.access_reason(p_reason);
  if p_department is null then
    raise exception using errcode = 'P0001', message = 'setting.company_value_stays';
  end if;
  req := audit.begin('ui', 'setting.cleared', pg_catalog.jsonb_build_object('key', p_key), why);
  update core.setting set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = why
  where key = p_key and department_id = p_department and deleted_at is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('removed', n, 'request_id', req);
end
$$;

-- ================================================================ My profile (§3.1, V9, V131)
-- The signed-in person's own profile — nobody else's — and their own names. The first save makes the profile row.
-- Each part names the version it read (A14): p_version the profile's, p_person_version the person's (api.me gives both).
create function core.profile_update(p_changes jsonb, p_version int default null, p_person_version int default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  pr core.person_profile;
  p core.person;
  k text;
  pv jsonb := '{}';
  nv jsonb := '{}';
  kinds jsonb;
  v jsonb;
  req uuid;
  what text;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_changes is null or pg_catalog.jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'profile.nothing_to_change';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_changes) loop
    if k in ('display_name_en', 'display_name_ar', 'avatar_color', 'badge_kind', 'badge_value', 'theme', 'density',
             'locale', 'start_page', 'drawer_pinned', 'notify') then
      pv := pv || pg_catalog.jsonb_build_object(k, p_changes -> k);
    elsif k in ('full_name_en', 'full_name_ar', 'nickname_en', 'nickname_ar') then
      nv := nv || pg_catalog.jsonb_build_object(k, p_changes -> k);
    else
      raise exception using errcode = 'P0001', message = 'profile.unknown_field', detail = k;
    end if;
  end loop;
  if nv ? 'full_name_en' and coalesce(pg_catalog.btrim(nv ->> 'full_name_en'), '') = '' then
    raise exception using errcode = 'P0001', message = 'person.full_name_required';
  end if;
  if pv ->> 'locale' = 'ar'
     and not coalesce((core.setting_at('app.arabic_enabled', null, core.riyadh_today()) #>> '{}')::boolean, false) then
    raise exception using errcode = 'P0001', message = 'profile.arabic_not_enabled';
  end if;
  if pv ->> 'start_page' is not null and authz.level_of(me, pv ->> 'start_page') = 'none' then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', pv ->> 'start_page', 'level', 'view')::text;
  end if;
  if pv ? 'notify' and (pv -> 'notify') <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(pv -> 'notify') <> 'object' then
      raise exception using errcode = 'P0001', message = 'profile.invalid', detail = 'notify';
    end if;
    kinds := (select d.default_value from core.setting_def d where d.key = 'notify.kinds_enabled');
    for k, v in select * from pg_catalog.jsonb_each(pv -> 'notify') loop
      if not (kinds ? k)
         or not (pg_catalog.jsonb_typeof(v) = 'boolean'
                 or (pg_catalog.jsonb_typeof(v) = 'object'
                     and not exists (select 1 from pg_catalog.jsonb_each(v) c
                                     where c.key not in ('in_app', 'email')
                                        or pg_catalog.jsonb_typeof(c.value) <> 'boolean'))) then
        raise exception using errcode = 'P0001', message = 'profile.invalid', detail = 'notify.' || k;
      end if;
    end loop;
  end if;

  select * into pr from core.person_profile where person_id = me;
  select * into p from core.person where id = me;
  if pr.id is not null then
    perform core.check_version('core.person_profile', pr.id, p_version,
      (select pg_catalog.array_agg(k2) from pg_catalog.jsonb_object_keys(pv) k2
       where (pg_catalog.to_jsonb(pr) -> k2) is distinct from (pv -> k2)));
  end if;
  if exists (select 1 from pg_catalog.jsonb_object_keys(nv) k2 where (pg_catalog.to_jsonb(p) -> k2) is distinct from (nv -> k2)) then
    perform core.check_version('core.person', me, p_person_version,
      (select pg_catalog.array_agg(k2) from pg_catalog.jsonb_object_keys(nv) k2
       where (pg_catalog.to_jsonb(p) -> k2) is distinct from (nv -> k2)));
  end if;

  req := audit.begin('ui', 'profile.updated', null, null);
  begin
    if pr.id is null then
      insert into core.person_profile (person_id, display_name_en, display_name_ar, avatar_color, badge_kind, badge_value,
                                       theme, density, locale, start_page, drawer_pinned, notify)
      select me, x.display_name_en, x.display_name_ar, x.avatar_color, coalesce(x.badge_kind, 'none'), x.badge_value,
             x.theme, x.density, x.locale, x.start_page, x.drawer_pinned, x.notify
      from pg_catalog.jsonb_populate_record(null::core.person_profile, pv) x
      returning * into pr;
    else
      perform audit.write_fields('core.person_profile', pr.id, pv);
    end if;
    perform audit.write_fields('core.person', me, nv);
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = '23514', message = 'profile.invalid', detail = what;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object(
    'version', (select x.version from core.person_profile x where x.id = pr.id),
    'person_version', (select x.version from core.person x where x.id = me),
    'request_id', req);
end
$$;

-- api.me() as P3-4 wrote it, now also giving the person's version (for My profile's names, above).
create or replace function core.me() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  a core.person_auth;
  p core.person;
  r core.role;
  pr core.person_profile;
  d core.device_session;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'auth.not_signed_in';
  end if;
  select * into a from core.person_auth where auth_user_id = uid;
  if a.id is null or not exists (select 1 from core.person_email e
                                 where e.person_id = a.person_id and e.email operator(extensions.=) a.email
                                   and e.deleted_at is null) then
    return pg_catalog.jsonb_build_object('status', 'not_listed');
  end if;
  select * into p from core.person where id = a.person_id;
  if p.kind <> 'staff' or not p.active or not p.can_sign_in or p.deleted_at is not null then
    return pg_catalog.jsonb_build_object('status', 'switched_off');
  end if;
  select * into d from core.device_session s where s.auth_session_id = core.jwt_session_id() and s.auth_user_id = uid;
  if d.id is null then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', 'unknown');
  end if;
  if d.signed_out_at is not null then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', d.sign_out_reason);
  end if;
  if d.last_seen_at <= core.clock() - pg_catalog.make_interval(days => core.device_idle_days()) then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', 'inactive');
  end if;
  select * into r from core.role where id = p.role_id;
  select * into pr from core.person_profile where person_id = p.id;
  return pg_catalog.jsonb_build_object(
    'status', 'ok',
    'session', pg_catalog.jsonb_build_object(
      'device_id', d.id, 'signed_in_at', d.signed_in_at, 'last_seen_at', d.last_seen_at, 'email', a.email),
    'person', pg_catalog.jsonb_build_object(
      'id', p.id, 'kind', p.kind, 'version', p.version,
      'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
      'nickname_en', p.nickname_en, 'nickname_ar', p.nickname_ar,
      'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
      'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id,
      'role', case when r.id is null then null else pg_catalog.jsonb_build_object(
        'id', r.id, 'key', r.key, 'name_en', r.name_en, 'name_ar', r.name_ar, 'is_admin', r.is_admin) end),
    'levels', coalesce((
      select pg_catalog.jsonb_object_agg(pg.key, authz.level_of(p.id, pg.key))
      from core.page pg where pg.active), '{}'::jsonb),
    'capabilities', coalesce((
      select pg_catalog.jsonb_agg(c.key order by c.key)
      from core.capability c where c.active and authz.can_of(p.id, c.key)), '[]'::jsonb),
    'departments', (
      select pg_catalog.jsonb_agg(ds.dep order by ds.dep)
      from (select p.department_id as dep
            union
            select pd.department_id from core.person_department pd
            where pd.person_id = p.id and pd.deleted_at is null) ds),
    'profile', case when pr.id is null then null else pg_catalog.jsonb_build_object(
      'display_name_en', pr.display_name_en, 'display_name_ar', pr.display_name_ar,
      'avatar_file_id', pr.avatar_file_id, 'avatar_color', pr.avatar_color,
      'badge_kind', pr.badge_kind, 'badge_value', pr.badge_value,
      'theme', pr.theme, 'density', pr.density, 'locale', pr.locale, 'start_page', pr.start_page,
      'drawer_pinned', pr.drawer_pinned, 'notify', pr.notify, 'version', pr.version) end
  );
end
$$;

-- ================================================================ the organisation, for everyone (§3.1)
-- Departments, teams, roles and people as names and ids, for pickers, chips and hover cards: every signed-in person
-- (names are always read live — V58). What a person may do is not here: that is api.me() and the access pages.
create function core.org() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return pg_catalog.jsonb_build_object(
    'departments', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', d.id, 'code', d.code, 'name_en', d.name_en, 'name_ar', d.name_ar, 'head_person_id', d.head_person_id,
        'active', d.active, 'version', d.version) order by d.name_en)
      from core.department d where d.deleted_at is null), '[]'::jsonb),
    'teams', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', t.id, 'department_id', t.department_id, 'code', t.code, 'name_en', t.name_en, 'name_ar', t.name_ar,
        'lead_person_id', t.lead_person_id, 'active', t.active, 'retired_at', t.retired_at,
        'retired_into_team_id', t.retired_into_team_id, 'version', t.version) order by t.name_en)
      from core.team t), '[]'::jsonb),
    'roles', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', r.id, 'key', r.key, 'name_en', r.name_en, 'name_ar', r.name_ar, 'sort', r.sort, 'is_admin', r.is_admin,
        'active', r.active, 'version', r.version) order by r.sort, r.key)
      from core.role r), '[]'::jsonb),
    'people', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', p.id, 'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
        'nickname_en', p.nickname_en, 'nickname_ar', p.nickname_ar,
        'display_name_en', coalesce(pr.display_name_en, p.nickname_en, p.full_name_en),
        'display_name_ar', coalesce(pr.display_name_ar, p.nickname_ar, p.full_name_ar),
        'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
        'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id,
        'avatar_color', pr.avatar_color, 'avatar_file_id', pr.avatar_file_id, 'badge_kind', pr.badge_kind,
        'badge_value', pr.badge_value) order by pg_catalog.lower(p.full_name_en))
      from core.person p left join core.person_profile pr on pr.person_id = p.id
      where p.kind = 'staff' and p.active and p.deleted_at is null), '[]'::jsonb));
end
$$;

-- ================================================================ people (Settings → Organization & access, §8, V132)
-- The people list: Organization & access · View. Each person with their role, allowed emails and last sign-in.
create function core.people() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('settings.org', 'view');
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', p.id, 'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar, 'nickname_en', p.nickname_en,
      'nickname_ar', p.nickname_ar, 'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
      'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id, 'joined_on', p.joined_on,
      'left_on', p.left_on, 'can_sign_in', p.can_sign_in, 'active', p.active, 'version', p.version,
      'role', case when r.id is null then null
                   else pg_catalog.jsonb_build_object('id', r.id, 'key', r.key, 'is_admin', r.is_admin) end,
      'emails', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                  'id', e.id, 'email', e.email, 'is_primary', e.is_primary) order by e.is_primary desc, e.email)
                from core.person_email e where e.person_id = p.id and e.deleted_at is null), '[]'::jsonb),
      'last_sign_in_at', (select pg_catalog.max(l.at) from core.sign_in_log l
                          where l.person_id = p.id and l.result = 'ok'))
      order by pg_catalog.lower(p.full_name_en))
    from core.person p left join core.role r on r.id = p.role_id
    where p.kind = 'staff' and p.deleted_at is null), '[]'::jsonb);
end
$$;

-- Someone whose record the caller may change: Full on Organization & access, and an admin's only by an admin.
create function core.person_guard_write(p_person uuid) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
begin
  if not exists (select 1 from core.person p where p.id = p_person and p.kind = 'staff' and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not authz.is_admin() and exists (select 1 from core.person p join core.role r on r.id = p.role_id
                                      where p.id = p_person and r.is_admin) then
    raise exception using errcode = '42501', message = 'access.admins_only';
  end if;
  return me;
end
$$;

-- The fields of a person Settings edits (a role and sign-in have their own doors: api.access_set_person_role,
-- api.person_switch).
create function core.person_fields(p_changes jsonb) returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  k text;
begin
  if p_changes is null or pg_catalog.jsonb_typeof(p_changes) <> 'object' then
    raise exception using errcode = 'P0001', message = 'person.nothing_to_change';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_changes) loop
    if k not in ('full_name_en', 'full_name_ar', 'nickname_en', 'nickname_ar', 'job_title_en', 'job_title_ar',
                 'department_id', 'team_id', 'manager_id', 'joined_on', 'left_on') then
      raise exception using errcode = 'P0001', message = 'person.unknown_field', detail = k;
    end if;
  end loop;
  if p_changes ? 'full_name_en' and coalesce(pg_catalog.btrim(p_changes ->> 'full_name_en'), '') = '' then
    raise exception using errcode = 'P0001', message = 'person.full_name_required';
  end if;
  if p_changes ? 'department_id' and p_changes ->> 'department_id' is null then
    raise exception using errcode = 'P0001', message = 'person.department_required';
  end if;
  return p_changes;
end
$$;

-- Add a person: Full on Organization & access. With a role (the three rules of V125 apply), and allowed to sign in
-- when asked (their emails are allowed through /auth/admin/emails — V118). One request.
create function core.person_create(p_person jsonb, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
  pv jsonb;
  pid uuid;
  req uuid;
begin
  pv := core.person_fields(p_person - array['role_id', 'can_sign_in']);
  if not (pv ? 'full_name_en') then
    raise exception using errcode = 'P0001', message = 'person.full_name_required';
  end if;
  if not (pv ? 'department_id') then
    raise exception using errcode = 'P0001', message = 'person.department_required';
  end if;
  req := audit.begin('ui', 'person.created', null, p_reason);
  insert into core.person (full_name_en, full_name_ar, nickname_en, nickname_ar, job_title_en, job_title_ar,
                           department_id, team_id, manager_id, joined_on, left_on)
  select pg_catalog.btrim(x.full_name_en), x.full_name_ar, x.nickname_en, x.nickname_ar, x.job_title_en,
         x.job_title_ar, x.department_id, x.team_id, x.manager_id, x.joined_on, x.left_on
  from pg_catalog.jsonb_populate_record(null::core.person, pv) x
  returning id into pid;
  if p_person ->> 'role_id' is not null then
    perform core.access_set_person_role(pid, (p_person ->> 'role_id')::uuid, coalesce(p_reason, 'new person'));
  end if;
  if coalesce((p_person ->> 'can_sign_in')::boolean, false) then
    perform core.person_switch(pid, true, coalesce(p_reason, 'new person'));
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'version', (select p.version from core.person p where p.id = pid),
                                       'request_id', req);
end
$$;

-- Change a person's details, naming the version read (A14).
create function core.person_update(p_id uuid, p_changes jsonb, p_version int, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.person_guard_write(p_id);
  pv jsonb := core.person_fields(p_changes);
  p core.person;
  req uuid;
begin
  select * into p from core.person where id = p_id;
  perform core.check_version('core.person', p_id, p_version,
    (select pg_catalog.array_agg(k) from pg_catalog.jsonb_object_keys(pv) k
     where (pg_catalog.to_jsonb(p) -> k) is distinct from (pv -> k)));
  req := audit.begin('ui', 'person.updated', null, p_reason);
  perform audit.write_fields('core.person', p_id, pv);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from core.person x where x.id = p_id),
                                       'request_id', req);
end
$$;

-- Allow a person to sign in, or switch them off: switching off ends every device at once (V74) — the server then bans
-- their auth users (/auth/admin/sync, V118). Nobody switches themselves; an admin only an admin. Only an admin undoes it
-- (V128).
create function core.person_switch(p_id uuid, p_on boolean, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.person_guard_write(p_id);
  why text := core.access_reason(p_reason);
  req uuid;
  ended int := 0;
begin
  if p_id = me then
    raise exception using errcode = '42501', message = 'access.not_your_own';
  end if;
  req := audit.begin('ui', case when p_on then 'person.switched_on' else 'person.switched_off' end, null, why);
  update core.person set can_sign_in = p_on where id = p_id;
  if not p_on then
    ended := core.end_devices(p_id, null, null, 'switched_off', me);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('can_sign_in', p_on, 'devices_ended', ended, 'request_id', req);
end
$$;

-- The sign-in log (§4): one's own always; anyone's with Organization & access · View. Newest first.
create function core.sign_in_log(p_person uuid default null, p_before timestamptz default null, p_limit int default 50)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_person is distinct from me then
    perform authz.require('settings.org', 'view');
  end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', x.id, 'at', x.at, 'person_id', x.person_id, 'email', x.email, 'provider', x.provider, 'result', x.result,
      'detail', x.detail, 'user_agent', x.user_agent) order by x.at desc, x.id)
    from (select l.* from core.sign_in_log l
          where (p_person is null or l.person_id = p_person) and (p_before is null or l.at < p_before)
          order by l.at desc, l.id
          limit greatest(1, least(coalesce(p_limit, 50), 500))) x), '[]'::jsonb);
end
$$;

-- ================================================================ departments, teams and roles (§3.1, D11)
create function core.department_save(p_id uuid, p_code text, p_name_en text, p_name_ar text default null,
                                     p_head uuid default null, p_version int default null, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
  d core.department;
  v jsonb := pg_catalog.jsonb_build_object('code', p_code, 'name_en', pg_catalog.btrim(p_name_en), 'name_ar', p_name_ar,
                                           'head_person_id', p_head);
  req uuid;
begin
  if coalesce(pg_catalog.btrim(p_name_en), '') = '' then
    raise exception using errcode = 'P0001', message = 'org.name_required';
  end if;
  if p_id is null then
    req := audit.begin('ui', 'department.saved', null, p_reason);
    insert into core.department (code, name_en, name_ar, head_person_id)
    values (p_code, pg_catalog.btrim(p_name_en), p_name_ar, p_head) returning * into d;
  else
    select * into d from core.department where id = p_id and deleted_at is null;
    if d.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    perform core.check_version('core.department', p_id, p_version,
      (select pg_catalog.array_agg(k) from pg_catalog.jsonb_object_keys(v) k
       where (pg_catalog.to_jsonb(d) -> k) is distinct from (v -> k)));
    req := audit.begin('ui', 'department.saved', null, p_reason);
    perform audit.write_fields('core.department', p_id, v);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', d.id, 'version', (select x.version from core.department x where x.id = d.id),
                                       'request_id', req);
exception when unique_violation then
  raise exception using errcode = '23505', message = 'org.code_taken', detail = p_code;
end
$$;

-- A team stays in the department it was made in (its people are in that department — ORG-01).
create function core.team_save(p_id uuid, p_department uuid, p_code text, p_name_en text, p_name_ar text default null,
                               p_lead uuid default null, p_version int default null, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
  t core.team;
  v jsonb := pg_catalog.jsonb_build_object('code', p_code, 'name_en', pg_catalog.btrim(p_name_en), 'name_ar', p_name_ar,
                                           'lead_person_id', p_lead);
  req uuid;
begin
  if coalesce(pg_catalog.btrim(p_name_en), '') = '' then
    raise exception using errcode = 'P0001', message = 'org.name_required';
  end if;
  if p_id is null then
    req := audit.begin('ui', 'team.saved', null, p_reason);
    insert into core.team (department_id, code, name_en, name_ar, lead_person_id)
    values (p_department, p_code, pg_catalog.btrim(p_name_en), p_name_ar, p_lead) returning * into t;
  else
    select * into t from core.team where id = p_id;
    if t.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not t.active then
      raise exception using errcode = 'P0001', message = 'team.retired';
    end if;
    if p_department is distinct from t.department_id then
      raise exception using errcode = 'P0001', message = 'team.department_fixed';
    end if;
    perform core.check_version('core.team', p_id, p_version,
      (select pg_catalog.array_agg(k) from pg_catalog.jsonb_object_keys(v) k
       where (pg_catalog.to_jsonb(t) -> k) is distinct from (v -> k)));
    req := audit.begin('ui', 'team.saved', null, p_reason);
    perform audit.write_fields('core.team', p_id, v);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', t.id, 'version', (select x.version from core.team x where x.id = t.id),
                                       'request_id', req);
exception when unique_violation then
  raise exception using errcode = '23505', message = 'org.code_taken', detail = p_code;
end
$$;

-- Retire a team (D11: retired, never deleted): its people move to another active team of the same department, or to
-- none; helpers of the team stop helping it. One request, one Undo.
create function core.team_retire(p_id uuid, p_move_to uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
  why text := core.access_reason(p_reason);
  t core.team;
  req uuid;
  moved int;
begin
  select * into t from core.team where id = p_id;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not t.active then
    raise exception using errcode = 'P0001', message = 'team.retired';
  end if;
  if p_move_to is not null and not exists (select 1 from core.team x where x.id = p_move_to and x.id <> p_id
                                           and x.active and x.department_id = t.department_id) then
    raise exception using errcode = 'P0001', message = 'team.move_to_invalid';
  end if;
  req := audit.begin('ui', 'team.retired', null, why);
  update core.person set team_id = p_move_to where team_id = p_id;
  get diagnostics moved = row_count;
  update core.person_team_assist set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = why
  where team_id = p_id and deleted_at is null;
  update core.team set active = false, retired_at = pg_catalog.now(), retired_into_team_id = p_move_to where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('moved', moved, 'request_id', req);
end
$$;

-- A role only sets starting levels (D2): made or renamed here, its levels set in the matrix (api.access_set_role_*).
-- A role's key never changes; a new role is never an admin role; the admin role is renamed only by an admin.
create function core.role_save(p_id uuid, p_key text, p_name_en text, p_name_ar text default null, p_sort int default 0,
                               p_version int default null, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
  r core.role;
  v jsonb := pg_catalog.jsonb_build_object('name_en', pg_catalog.btrim(p_name_en), 'name_ar', p_name_ar,
                                           'sort', coalesce(p_sort, 0));
  req uuid;
begin
  if coalesce(pg_catalog.btrim(p_name_en), '') = '' then
    raise exception using errcode = 'P0001', message = 'org.name_required';
  end if;
  if p_id is null then
    req := audit.begin('ui', 'role.saved', null, p_reason);
    insert into core.role (key, name_en, name_ar, sort, is_admin)
    values (p_key, pg_catalog.btrim(p_name_en), p_name_ar, coalesce(p_sort, 0), false) returning * into r;
  else
    select * into r from core.role where id = p_id;
    if r.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if p_key is distinct from r.key then
      raise exception using errcode = 'P0001', message = 'role.key_fixed';
    end if;
    if r.is_admin and not authz.is_admin() then
      raise exception using errcode = '42501', message = 'access.admins_only';
    end if;
    perform core.check_version('core.role', p_id, p_version,
      (select pg_catalog.array_agg(k) from pg_catalog.jsonb_object_keys(v) k
       where (pg_catalog.to_jsonb(r) -> k) is distinct from (v -> k)));
    req := audit.begin('ui', 'role.saved', null, p_reason);
    perform audit.write_fields('core.role', p_id, v);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', r.id, 'version', (select x.version from core.role x where x.id = r.id),
                                       'request_id', req);
exception when unique_violation then
  raise exception using errcode = '23505', message = 'org.code_taken', detail = p_key;
end
$$;

grant execute on function core.settings(text), core.setting_set(text, uuid, jsonb, date, text),
  core.setting_clear(text, uuid, text), core.profile_update(jsonb, int, int), core.org(), core.people(),
  core.person_create(jsonb, text), core.person_update(uuid, jsonb, int, text), core.person_switch(uuid, boolean, text),
  core.sign_in_log(uuid, timestamptz, int),
  core.department_save(uuid, text, text, text, uuid, int, text),
  core.team_save(uuid, uuid, text, text, text, uuid, int, text), core.team_retire(uuid, uuid, text),
  core.role_save(uuid, text, text, text, int, int, text) to authenticated;

-- ================================================================ the door (V124)
create function api.settings(p_group text) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.settings(p_group) $$;

create function api.setting_set(p_key text, p_department uuid, p_value jsonb, p_valid_from date default null,
                                p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.setting_set(p_key, p_department, p_value, p_valid_from, p_reason) $$;

create function api.setting_clear(p_key text, p_department uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.setting_clear(p_key, p_department, p_reason) $$;

create function api.profile_update(p_changes jsonb, p_version int default null, p_person_version int default null)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.profile_update(p_changes, p_version, p_person_version) $$;

create function api.org() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.org() $$;

create function api.people() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.people() $$;

create function api.person_create(p_person jsonb, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.person_create(p_person, p_reason) $$;

create function api.person_update(p_id uuid, p_changes jsonb, p_version int, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.person_update(p_id, p_changes, p_version, p_reason) $$;

create function api.person_switch(p_id uuid, p_on boolean, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.person_switch(p_id, p_on, p_reason) $$;

create function api.sign_in_log(p_person uuid default null, p_before timestamptz default null, p_limit int default 50)
returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.sign_in_log(p_person, p_before, p_limit) $$;

create function api.department_save(p_id uuid, p_code text, p_name_en text, p_name_ar text default null,
                                    p_head uuid default null, p_version int default null, p_reason text default null)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.department_save(p_id, p_code, p_name_en, p_name_ar, p_head, p_version, p_reason) $$;

create function api.team_save(p_id uuid, p_department uuid, p_code text, p_name_en text, p_name_ar text default null,
                              p_lead uuid default null, p_version int default null, p_reason text default null)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.team_save(p_id, p_department, p_code, p_name_en, p_name_ar, p_lead, p_version, p_reason) $$;

create function api.team_retire(p_id uuid, p_move_to uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.team_retire(p_id, p_move_to, p_reason) $$;

create function api.role_save(p_id uuid, p_key text, p_name_en text, p_name_ar text default null, p_sort int default 0,
                              p_version int default null, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.role_save(p_id, p_key, p_name_en, p_name_ar, p_sort, p_version, p_reason) $$;

grant execute on function api.settings(text), api.setting_set(text, uuid, jsonb, date, text),
  api.setting_clear(text, uuid, text), api.profile_update(jsonb, int, int), api.org(), api.people(),
  api.person_create(jsonb, text), api.person_update(uuid, jsonb, int, text), api.person_switch(uuid, boolean, text),
  api.sign_in_log(uuid, timestamptz, int), api.department_save(uuid, text, text, text, uuid, int, text),
  api.team_save(uuid, uuid, text, text, text, uuid, int, text), api.team_retire(uuid, uuid, text),
  api.role_save(uuid, text, text, text, int, int, text) to authenticated;
