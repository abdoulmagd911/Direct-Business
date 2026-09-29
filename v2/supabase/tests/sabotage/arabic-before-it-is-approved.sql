-- Sabotage: arabic-before-it-is-approved
-- Breaks: sql:PROF-01
-- Expect: Arabic waits until it is switched on
-- My profile lets anyone pick Arabic before the owner switches it on (V122).
create or replace function core.profile_update(p_changes jsonb, p_version int default null, p_person_version int default null)
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
